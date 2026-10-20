
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const BUCKET_JUGADORES = "jugadores";
const BUCKET_DOCUMENTOS = "documentos-campeonato";

let nominas = [];
let nominaActual = null;
let mensajeTemporizador = null;
let usuarioRevisorId = null;

const operacionesJugador = new Set();

const FOTO_VACIA =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="140">
      <rect width="120" height="140" fill="#edf3ef"/>
      <circle cx="60" cy="46" r="23" fill="#bdcec2"/>
      <path d="M18 132c3-30 19-46 42-46s39 16 42 46" fill="#bdcec2"/>
      <text x="60" y="17" font-size="8" text-anchor="middle" fill="#42634e">SIN FOTO</text>
    </svg>
  `);

/* =====================================================
   UTILIDADES
===================================================== */

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function normalizarEstado(estado) {
  return String(estado ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function nombrePersona(persona) {
  if (!persona) return "No asignado";

  return [persona.nombres, persona.apellidos]
    .filter(Boolean)
    .join(" ")
    .trim() || persona.email || "Sin nombre";
}

function fechaLegible(fecha) {
  if (!fecha) return "No registrada";

  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) return String(fecha);

  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function etiquetaEstado(estado) {
  const valor = String(estado || "PENDIENTE").trim();
  const e = normalizarEstado(valor);

  let clase = "estado-pendiente";

  if (["HABILITADO", "APROBADA", "APROBADO"].includes(e)) {
    clase = "estado-aprobada";
  } else if (
    ["RECHAZADO", "RECHAZADA", "DESHABILITADO"].includes(e)
  ) {
    clase = "estado-observada";
  } else if (e.includes("OBSERVACION") || e.includes("OBSERVADA")) {
    clase = "estado-observada";
  } else if (e === "EN REVISION") {
    clase = "estado-en-revision";
  }

  const etiquetas = {
    HABILITADO: "HABILITADO",
    APROBADA: "APROBADA",
    APROBADO: "APROBADO",
    "EN OBSERVACION": "EN OBSERVACIÓN",
    RECHAZADO: "RECHAZADO",
    RECHAZADA: "RECHAZADA",
    DESHABILITADO: "DESHABILITADO",
    "EN REVISION": "EN REVISIÓN",
    PENDIENTE: "PENDIENTE"
  };

  return `<span class="estado ${clase}">${escapar(etiquetas[e] || valor)}</span>`;
}

function mostrarMensaje(texto, tipo = "info") {
  const el = $("mensaje");

  if (!el) {
    console.log(texto);
    return;
  }

  clearTimeout(mensajeTemporizador);

  el.textContent = texto;
  el.className = `mensaje visible ${tipo}`;

  mensajeTemporizador = setTimeout(() => {
    el.classList.remove("visible");
  }, 6500);
}

function actualizarCarga(texto) {
  if ($("textoCarga")) {
    $("textoCarga").textContent = texto;
  }

  $("pantallaCarga")?.classList.remove("oculto");
}

function ocultarCarga() {
  $("pantallaCarga")?.classList.add("oculto");
}

function mostrarModal() {
  $("modalNomina")?.classList.add("abierto");
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
  $("modalNomina")?.classList.remove("abierto");
  document.body.style.overflow = "";
  nominaActual = null;
}

function esURLCompleta(valor) {
  return /^(https?:|data:|blob:)/i.test(String(valor || ""));
}

async function resolverArchivoPrivado(bucket, ruta) {
  if (!ruta) return "";

  const valor = String(ruta).trim();

  if (!valor) return "";
  if (esURLCompleta(valor)) return valor;

  const rutaFinal = valor.replace(/^\/+/, "");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rutaFinal, 3600);

  if (error) {
    console.error(
      "Error generando URL:",
      bucket,
      rutaFinal,
      error.message
    );

    return "";
  }

  return data?.signedUrl || "";
}

const resolverFotoJugador = ruta =>
  resolverArchivoPrivado(BUCKET_JUGADORES, ruta);

const resolverDocumento = ruta =>
  resolverArchivoPrivado(BUCKET_DOCUMENTOS, ruta);

function enlaceDocumento(url, texto = "Abrir documento") {
  if (!url) {
    return `<span class="nota-pequena">Documento no disponible o sin permiso de lectura.</span>`;
  }

  return `
    <a href="${escapar(url)}" target="_blank" rel="noopener noreferrer">
      ${escapar(texto)} ↗
    </a>`;
}

async function consultarPorIds(tabla, columna, ids, campos = "*") {
  const unicos = [...new Set(
    (ids || []).filter(id =>
      id !== null && id !== undefined && id !== ""
    )
  )];

  if (!unicos.length) return [];

  const { data, error } = await supabase
    .from(tabla)
    .select(campos)
    .in(columna, unicos);

  if (error) throw error;

  return data || [];
}

/* =====================================================
   ACCESO Y PERMISOS
===================================================== */

async function verificarAcceso() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const usuario = data?.session?.user;

  if (!usuario) {
    window.location.href = "../login.html";
    return false;
  }

  usuarioRevisorId = usuario.id;

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfil_usuario")
    .select("id,nombres,apellidos,activo")
    .eq("id", usuario.id)
    .maybeSingle();

  if (errorPerfil) throw errorPerfil;

  if (!perfil || perfil.activo !== true) {
    throw new Error("Su perfil no existe o se encuentra inactivo.");
  }

  const { data: relaciones, error: errorRoles } = await supabase
    .from("usuario_rol")
    .select("rol_id")
    .eq("usuario_id", usuario.id);

  if (errorRoles) throw errorRoles;

  const rolIds = (relaciones || [])
    .map(r => r.rol_id)
    .filter(Boolean);

  let roles = [];

  if (rolIds.length) {
    const { data: listaRoles, error } = await supabase
      .from("rol")
      .select("id,nombre")
      .in("id", rolIds);

    if (error) throw error;

    roles = (listaRoles || []).map(r =>
      normalizarEstado(r.nombre)
    );
  }

  if (!roles.some(r =>
    ["ADMINISTRADOR", "COMISION"].includes(r)
  )) {
    throw new Error("No tiene permisos para revisar las nóminas.");
  }

  if ($("usuarioNombre")) {
    $("usuarioNombre").textContent = nombrePersona(perfil);
  }

  return true;
}

/* =====================================================
   CARGAR INFORMACIÓN
===================================================== */

async function cargarNominas() {
  actualizarCarga("Cargando inscripciones, jugadores y fotografías...");

  try {
    const { data: inscripciones, error } = await supabase
      .from("inscripcion_equipo")
      .select(`
        id,equipo_id,competencia_id,capitan_id,estado,
        fecha_inscripcion,observacion,documento_inscripcion,documento_aval
      `)
      .order("fecha_inscripcion", { ascending: false });

    if (error) throw error;

    const lista = inscripciones || [];

    const [equipos, competencias, perfiles, relacionesJugadores] =
      await Promise.all([
        consultarPorIds(
          "equipo",
          "id",
          lista.map(i => i.equipo_id),
          "id,nombre,logo,contacto"
        ),
        consultarPorIds(
          "competencia",
          "id",
          lista.map(i => i.competencia_id),
          "id,disciplina_id,categoria_id"
        ),
        consultarPorIds(
          "perfil_usuario",
          "id",
          lista.map(i => i.capitan_id),
          "id,nombres,apellidos,activo"
        ),
        consultarPorIds(
          "inscripcion_jugador",
          "inscripcion_equipo_id",
          lista.map(i => i.id),
          "id,inscripcion_equipo_id,jugador_id,numero,posicion,es_especial,estado,observacion,fecha_revision,revisado_por"
        )
      ]);

    const jugadores = await consultarPorIds(
      "jugador",
      "id",
      relacionesJugadores.map(r => r.jugador_id),
      "id,nombres,apellidos,fecha_nacimiento,numero_cedula,foto,foto_cedula,origen,activo"
    );

    const [disciplinas, categorias] = await Promise.all([
      consultarPorIds(
        "disciplina",
        "id",
        competencias.map(c => c.disciplina_id),
        "id,nombre"
      ),
      consultarPorIds(
        "categoria",
        "id",
        competencias.map(c => c.categoria_id),
        "id,nombre"
      )
    ]);

    const mapa = datos =>
      new Map(datos.map(x => [String(x.id), x]));

    const equipoMap = mapa(equipos);
    const competenciaMap = mapa(competencias);
    const perfilMap = mapa(perfiles);
    const jugadorMap = mapa(jugadores);
    const disciplinaMap = mapa(disciplinas);
    const categoriaMap = mapa(categorias);

    const porInscripcion = new Map();

    for (const relacion of relacionesJugadores) {
      const clave = String(relacion.inscripcion_equipo_id);

      if (!porInscripcion.has(clave)) {
        porInscripcion.set(clave, []);
      }

      const jugador =
        jugadorMap.get(String(relacion.jugador_id)) || {};

      porInscripcion.get(clave).push({
        ...jugador,
        ...relacion,
        jugadorId: jugador.id ?? relacion.jugador_id,
        nombreCompleto: [
          jugador.nombres,
          jugador.apellidos
        ].filter(Boolean).join(" ").trim() || "Jugador sin nombre"
      });
    }

    nominas = await Promise.all(lista.map(async inscripcion => {
      const equipo =
        equipoMap.get(String(inscripcion.equipo_id)) || {};

      const competencia =
        competenciaMap.get(String(inscripcion.competencia_id)) || {};

      const capitan =
        perfilMap.get(String(inscripcion.capitan_id)) || {};

      const registrados =
        porInscripcion.get(String(inscripcion.id)) || [];

      const jugadoresConFotos = await Promise.all(
        registrados.map(async j => {
          const [fotoUrl, cedulaUrl] = await Promise.all([
            resolverFotoJugador(j.foto),
            resolverFotoJugador(j.foto_cedula)
          ]);

          return {
            ...j,
            foto_url: fotoUrl,
            foto_cedula_url: cedulaUrl
          };
        })
      );

      const [logoUrl, docInscripcion, docAval] = await Promise.all([
        resolverArchivoPrivado(BUCKET_DOCUMENTOS, equipo.logo),
        resolverDocumento(inscripcion.documento_inscripcion),
        resolverDocumento(inscripcion.documento_aval)
      ]);

      return {
        ...inscripcion,
        equipo: { ...equipo, logo_url: logoUrl },
        competencia,
        capitan,
        disciplina:
          disciplinaMap.get(String(competencia.disciplina_id)) || {},
        categoria:
          categoriaMap.get(String(competencia.categoria_id)) || {},
        documento_inscripcion_url: docInscripcion,
        documento_aval_url: docAval,
        jugadores: jugadoresConFotos
      };
    }));

    prepararFiltroEquipos();
    actualizarEstadisticas();
    renderizarNominas();

  } catch (error) {
    console.error("Error cargando nóminas:", error);

    mostrarMensaje(
      `No se pudieron cargar las nóminas: ${error.message || error}`,
      "error"
    );
  } finally {
    ocultarCarga();
  }
}

/* =====================================================
   FILTROS Y ESTADÍSTICAS
===================================================== */

function prepararFiltroEquipos() {
  const select = $("filtroEquipo");

  if (!select) return;

  const anterior = select.value;
  const equipos = new Map();

  nominas.forEach(n => {
    if (n.equipo_id) {
      equipos.set(
        String(n.equipo_id),
        n.equipo?.nombre || "Equipo sin nombre"
      );
    }
  });

  select.innerHTML = `<option value="">Todos los equipos</option>`;

  [...equipos.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([id, nombre]) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${escapar(id)}">${escapar(nombre)}</option>`
      );
    });

  if ([...select.options].some(o => o.value === anterior)) {
    select.value = anterior;
  }
}

function actualizarEstadisticas() {
  if ($("totalInscripciones")) {
    $("totalInscripciones").textContent = nominas.length;
  }

  if ($("totalJugadores")) {
    $("totalJugadores").textContent = nominas.reduce(
      (suma, n) => suma + (n.jugadores?.length || 0),
      0
    );
  }

  if ($("totalPendientes")) {
    $("totalPendientes").textContent = nominas.filter(n =>
      ["PENDIENTE", "EN REVISION"].includes(
        normalizarEstado(n.estado)
      )
    ).length;
  }

  if ($("totalAprobadas")) {
    $("totalAprobadas").textContent = nominas.filter(n =>
      normalizarEstado(n.estado) === "HABILITADO"
    ).length;
  }
}

function estadoFiltroCoincide(estadoRegistro, filtro) {
  const estado = normalizarEstado(estadoRegistro);
  const buscado = normalizarEstado(filtro);

  if (!buscado) return true;

  const equivalencias = {
    APROBADA: ["HABILITADO", "APROBADA", "APROBADO"],
    OBSERVADA: ["EN OBSERVACION", "OBSERVADA", "OBSERVADO"],
    RECHAZADA: ["RECHAZADO", "RECHAZADA"],
    "EN REVISION": ["EN REVISION"],
    PENDIENTE: ["PENDIENTE"]
  };

  return (equivalencias[buscado] || [buscado]).includes(estado);
}

function obtenerNominasFiltradas() {
  const equipo = $("filtroEquipo")?.value || "";
  const estado = $("filtroEstado")?.value || "";
  const busqueda = normalizarEstado(
    $("buscarJugador")?.value || ""
  );

  return nominas.filter(n => {
    if (equipo && String(n.equipo_id) !== equipo) {
      return false;
    }

    if (estado && !estadoFiltroCoincide(n.estado, estado)) {
      return false;
    }

    if (busqueda) {
      const texto = [
        n.equipo?.nombre,
        nombrePersona(n.capitan),
        n.disciplina?.nombre,
        n.categoria?.nombre,
        ...(n.jugadores || []).map(j => j.nombreCompleto),
        ...(n.jugadores || []).map(j => j.numero_cedula)
      ].join(" ");

      if (!normalizarEstado(texto).includes(busqueda)) {
        return false;
      }
    }

    return true;
  });
}

/* =====================================================
   TABLA PRINCIPAL
===================================================== */

function renderizarNominas() {
  const tbody = $("tablaNomina");

  if (!tbody) return;

  const filtradas = obtenerNominasFiltradas();

  tbody.innerHTML = filtradas.map(n => {
    const logo = n.equipo?.logo_url || FOTO_VACIA;

    const competencia = [
      n.disciplina?.nombre,
      n.categoria?.nombre
    ].filter(Boolean).join(" · ") || "Competencia no definida";

    return `
      <tr>
        <td>
          <div class="equipo-celda">
            <img class="logo-equipo"
              src="${escapar(logo)}"
              alt="Logo"
              onerror="this.onerror=null;this.src='${FOTO_VACIA}'">
            <div>
              <strong>${escapar(n.equipo?.nombre || "Equipo sin nombre")}</strong>
              <small>ID: ${escapar(n.id)}</small>
            </div>
          </div>
        </td>
        <td>${escapar(competencia)}</td>
        <td>${escapar(nombrePersona(n.capitan))}</td>
        <td><strong>${n.jugadores?.length || 0}</strong></td>
        <td>${etiquetaEstado(n.estado)}</td>
        <td>${escapar(fechaLegible(n.fecha_inscripcion))}</td>
        <td>
          <button class="btn btn-verde btn-pequeno"
            data-ver-nomina="${escapar(n.id)}">
            Ver nómina →
          </button>
        </td>
      </tr>`;
  }).join("");

  if ($("sinResultados")) {
    $("sinResultados").hidden = filtradas.length > 0;
  }

  if ($("tablaNominas")) {
    $("tablaNominas").style.display =
      filtradas.length ? "table" : "none";
  }

  if ($("contadorResultados")) {
    $("contadorResultados").textContent =
      `${filtradas.length} ${
        filtradas.length === 1 ? "inscripción" : "inscripciones"
      }`;
  }
}

function datoMini(etiqueta, valor) {
  return `
    <div class="dato-mini">
      <span>${escapar(etiqueta)}</span>
      <strong>${escapar(valor || "No registrado")}</strong>
    </div>`;
}

function detalleDato(etiqueta, valor) {
  return `
    <div class="detalle-dato">
      <span>${escapar(etiqueta)}</span>
      <strong>${escapar(valor || "No registrado")}</strong>
    </div>`;
}

/* =====================================================
   TARJETA DE JUGADOR
   CHECK EXISTENTE + MENÚ MÁS
===================================================== */

function tarjetaJugador(item, indice) {
  const id = String(item.id);
  const nombre = item.nombreCompleto || "Jugador sin nombre";
  const foto = item.foto_url || FOTO_VACIA;
  const fotoCedula = item.foto_cedula_url || "";

  const estado = normalizarEstado(item.estado || "PENDIENTE");

  const fichaId =
    `ficha-${id.replace(/[^a-zA-Z0-9_-]/g, "")}-${indice}`;

  const estadoJugador = item.activo === true
    ? "Activo"
    : item.activo === false
      ? "Inactivo"
      : "No especificado";

  const especial = item.es_especial === true
    ? "Sí"
    : item.es_especial === false
      ? "No"
      : "No registrado";

  const estaHabilitado = estado === "HABILITADO";

  const estadoExtra = [
    "EN OBSERVACION",
    "RECHAZADO"
  ].includes(estado);

  return `
    <article class="jugador-fila">
      <div class="jugador-foto-mini">
        <img
          src="${escapar(foto)}"
          alt="Foto de ${escapar(nombre)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${FOTO_VACIA}'">
      </div>

      <div class="jugador-contenido">
        <div class="jugador-linea-superior">
          <div class="jugador-identidad-mini">
            <span class="camiseta">
              N.º ${escapar(item.numero ?? "—")}
            </span>
            <strong>${escapar(nombre)}</strong>
            <span class="cedula-mini">
              CI: ${escapar(item.numero_cedula || "No registrada")}
            </span>
          </div>

          ${etiquetaEstado(item.estado)}

          <div class="acciones-habilitacion"
            style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">

            <label class="check-habilitacion"
              style="display:flex;align-items:center;gap:6px">
              <input
                type="checkbox"
                data-habilitar-jugador="${escapar(id)}"
                ${estaHabilitado ? "checked" : ""}
                aria-label="Habilitar o deshabilitar a ${escapar(nombre)}">
              Habilitar
            </label>

            <div class="menu-mas-contenedor" style="position:relative">
              <button
                type="button"
                class="btn btn-claro btn-pequeno"
                data-toggle-mas="${escapar(id)}"
                aria-expanded="false">
                Más <span aria-hidden="true">▾</span>
              </button>

              <div
                class="menu-mas-opciones"
                data-menu-mas="${escapar(id)}"
                hidden
                style="
                  position:absolute;
                  top:calc(100% + 5px);
                  right:0;
                  z-index:20;
                  min-width:175px;
                  padding:6px;
                  background:#ffffff;
                  border:1px solid #d9e2dc;
                  border-radius:8px;
                  box-shadow:0 5px 16px rgba(0,0,0,.13);
                ">

                <button
                  type="button"
                  data-estado-extra="${escapar(id)}"
                  data-estado-valor="EN OBSERVACION"
                  style="
                    display:block;
                    width:100%;
                    padding:10px;
                    text-align:left;
                    border:0;
                    background:transparent;
                    cursor:pointer;
                  ">
                  En observación
                </button>

                <button
                  type="button"
                  data-estado-extra="${escapar(id)}"
                  data-estado-valor="RECHAZADO"
                  style="
                    display:block;
                    width:100%;
                    padding:10px;
                    text-align:left;
                    border:0;
                    background:transparent;
                    cursor:pointer;
                    color:#b42318;
                  ">
                  Rechazado
                </button>
              </div>
            </div>

            <button
              type="button"
              class="btn btn-claro btn-pequeno"
              data-ver-jugador="${escapar(fichaId)}">
              Ver detalles
            </button>
          </div>
        </div>

        ${
          estadoExtra
            ? `<p class="nota-pequena" style="margin-top:8px">
                Este jugador está marcado como
                <strong>${estado === "RECHAZADO" ? "Rechazado" : "En observación"}</strong>.
                Para habilitarlo nuevamente, marca el check de Habilitar.
              </p>`
            : ""
        }

        <div class="jugador-resumen-datos">
          ${datoMini("Nacimiento", fechaLegible(item.fecha_nacimiento))}
          ${datoMini("Posición", item.posicion)}
          ${datoMini("Origen", item.origen)}
          ${datoMini("Especial", especial)}
          ${datoMini("Estado del jugador", estadoJugador)}
          ${datoMini("Observación", item.observacion)}
        </div>

        <section class="jugador-detalle" id="${escapar(fichaId)}" hidden>
          <h4>Ficha completa del jugador</h4>

          <div class="detalle-grid">
            ${detalleDato("Nombres", item.nombres)}
            ${detalleDato("Apellidos", item.apellidos)}
            ${detalleDato("Cédula", item.numero_cedula)}
            ${detalleDato("Fecha de nacimiento", fechaLegible(item.fecha_nacimiento))}
            ${detalleDato("Número de camiseta", item.numero)}
            ${detalleDato("Posición", item.posicion)}
            ${detalleDato("Origen", item.origen)}
            ${detalleDato("Jugador especial", especial)}
            ${detalleDato("Estado del jugador", item.estado)}
            ${detalleDato("Observación", item.observacion)}
            ${detalleDato("ID del registro de nómina", item.id)}
            ${detalleDato("Fecha de revisión", fechaLegible(item.fecha_revision))}
          </div>

          <div class="documento-jugador">
            <div class="documento-imagen">
              <strong>Fotografía del jugador</strong>
              <a href="${escapar(foto)}"
                target="_blank"
                rel="noopener noreferrer">
                <img
                  src="${escapar(foto)}"
                  alt="Fotografía"
                  onerror="this.onerror=null;this.src='${FOTO_VACIA}'">
              </a>

              ${
                item.foto_url
                  ? ""
                  : `<span class="nota-pequena">
                      No se pudo cargar la foto. Revise Storage.
                    </span>`
              }
            </div>

            <div class="documento-imagen">
              <strong>Fotografía de cédula</strong>

              ${
                fotoCedula
                  ? `
                    <a href="${escapar(fotoCedula)}"
                      target="_blank"
                      rel="noopener noreferrer">
                      <img
                        src="${escapar(fotoCedula)}"
                        alt="Cédula"
                        onerror="this.style.display='none'">
                    </a>`
                  : `<span class="nota-pequena">
                      Documento no disponible o sin permiso.
                    </span>`
              }
            </div>
          </div>
        </section>
      </div>
    </article>`;
}

/* =====================================================
   DETALLE DE LA INSCRIPCIÓN
===================================================== */

function mostrarDetalleNomina(id) {
  const n = nominas.find(x => String(x.id) === String(id));

  if (!n) {
    mostrarMensaje("No se encontró la inscripción seleccionada.", "error");
    return;
  }

  nominaActual = n;

  if ($("tituloModal")) {
    $("tituloModal").textContent =
      `Nómina: ${n.equipo?.nombre || "Equipo sin nombre"}`;
  }

  const competencia = [
    n.disciplina?.nombre,
    n.categoria?.nombre
  ].filter(Boolean).join(" · ") || "No definida";

  const jugadoresHTML = n.jugadores?.length
    ? n.jugadores.map((j, i) => tarjetaJugador(j, i)).join("")
    : `
      <div class="sin-resultados">
        <strong>Esta inscripción todavía no tiene jugadores.</strong>
        <p>Los jugadores aparecerán cuando el capitán registre la nómina.</p>
      </div>`;

  const contenedor = $("detalleNomina");

  if (!contenedor) return;

  contenedor.innerHTML = `
    <section class="resumen-equipo">
      <img
        src="${escapar(n.equipo?.logo_url || FOTO_VACIA)}"
        alt="Logo"
        onerror="this.onerror=null;this.src='${FOTO_VACIA}'">

      <div>
        <h3>${escapar(n.equipo?.nombre || "Equipo sin nombre")}</h3>
        <p><strong>Competencia:</strong> ${escapar(competencia)}</p>
        <p><strong>Capitán:</strong> ${escapar(nombrePersona(n.capitan))}</p>
        <p><strong>Estado:</strong> ${etiquetaEstado(n.estado)}</p>
        <p><strong>Fecha:</strong> ${escapar(fechaLegible(n.fecha_inscripcion))}</p>
        <p><strong>Última revisión:</strong> ${escapar(fechaLegible(n.fecha_revision))}</p>
      </div>
    </section>

    <section class="documentos">
      <div class="documento-box">
        <strong>Documento de inscripción</strong>
        ${enlaceDocumento(n.documento_inscripcion_url)}
      </div>

      <div class="documento-box">
        <strong>Documento de aval</strong>
        ${enlaceDocumento(n.documento_aval_url)}
      </div>
    </section>

    <section class="seccion-jugadores">
      <div class="seccion-jugadores-cabecera">
        <h3>Jugadores registrados (${n.jugadores?.length || 0})</h3>
        <span class="nota-pequena">
          Los cambios individuales se guardan inmediatamente.
        </span>
      </div>

      <div class="jugadores-lista">${jugadoresHTML}</div>
    </section>

    <section class="decision-panel">
      <h3>Decisión sobre la inscripción</h3>

      <div class="campo">
        <label for="observacionDecision">
          Observación de la comisión
        </label>

        <textarea
          id="observacionDecision"
          rows="3"
          placeholder="Motivo de rechazo, documentos faltantes u observaciones...">${escapar(n.observacion || "")}</textarea>
      </div>

      <div class="decision-acciones">
        <button class="btn btn-rojo" data-decision="RECHAZADO">
          Rechazar
        </button>

        <button class="btn btn-dorado" data-decision="EN OBSERVACION">
          En observación
        </button>

        <button class="btn btn-claro" data-decision="EN REVISION">
          Volver a revisión
        </button>

        <button class="btn btn-verde" data-decision="HABILITADO">
          Aprobar inscripción
        </button>
      </div>

      <p class="decision-ayuda">
        Las decisiones de esta sección corresponden a la inscripción
        del equipo. Los estados individuales de los jugadores son
        independientes.
      </p>
    </section>`;

  mostrarModal();
}

/* =====================================================
   ACTUALIZAR ESTADO INDIVIDUAL DEL JUGADOR
===================================================== */

async function guardarEstadoJugador(id, nuevoEstado, checkbox = null) {
  const permitidos = [
    "PENDIENTE",
    "HABILITADO",
    "EN OBSERVACION",
    "RECHAZADO",
    "DESHABILITADO",
    "EN REVISION"
  ];

  if (!permitidos.includes(nuevoEstado)) {
    mostrarMensaje("El estado seleccionado no es válido.", "error");
    return;
  }

  const clave = String(id);

  if (operacionesJugador.has(clave)) return;

  const inscripcion = nominas.find(n =>
    n.jugadores?.some(j => String(j.id) === clave)
  );

  const jugador = inscripcion?.jugadores?.find(
    j => String(j.id) === clave
  );

  if (!inscripcion || !jugador) {
    mostrarMensaje("No se encontró el registro del jugador.", "error");
    return;
  }

  const estadoAnterior = jugador.estado || "PENDIENTE";
  const observacionAnterior = jugador.observacion || null;

  
let nuevaObservacion = observacionAnterior;

// Si se habilita al jugador, borrar la observación anterior.
if (nuevoEstado === "HABILITADO") {
  nuevaObservacion = null;
}

// Si se marca en observación o rechazado, solicitar el motivo.
if (["EN OBSERVACION", "RECHAZADO"].includes(nuevoEstado)) {
  const pregunta = nuevoEstado === "RECHAZADO"
    ? "Indique el motivo del rechazo (opcional):"
    : "Indique la observación o corrección solicitada (opcional):";

  const respuesta = window.prompt(
    pregunta,
    observacionAnterior || ""
  );

  if (respuesta === null) {
    return;
  }

  nuevaObservacion = respuesta.trim() || null;
}


  operacionesJugador.add(clave);

  if (checkbox) checkbox.disabled = true;

  try {
    actualizarCarga("Guardando estado del jugador...");

    const cambios = {
      estado: nuevoEstado,
      observacion: nuevaObservacion,
      fecha_revision: new Date().toISOString(),
      revisado_por: usuarioRevisorId
    };

    const { data, error } = await supabase
      .from("inscripcion_jugador")
      .update(cambios)
      .eq("id", id)
      .select("id,estado,observacion,fecha_revision,revisado_por")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "No se confirmó el cambio en la base de datos."
      );
    }

    jugador.estado = data.estado;
    jugador.observacion = data.observacion;
    jugador.fecha_revision = data.fecha_revision;
    jugador.revisado_por = data.revisado_por;

    actualizarEstadisticas();
    renderizarNominas();
    mostrarDetalleNomina(inscripcion.id);

    mostrarMensaje(
      `Jugador actualizado correctamente: ${data.estado}.`,
      "ok"
    );

  } catch (error) {
    console.error("Error guardando estado del jugador:", error);

    if (checkbox) {
      checkbox.checked =
        normalizarEstado(estadoAnterior) === "HABILITADO";
    }

    mostrarMensaje(
      `No se pudo guardar el estado del jugador: ${error.message || error}`,
      "error"
    );

  } finally {
    operacionesJugador.delete(clave);
    ocultarCarga();
  }
}

/* =====================================================
   ACTUALIZAR ESTADO DE INSCRIPCIÓN
===================================================== */

async function guardarDecision(estado) {
  if (!nominaActual) {
    mostrarMensaje("No hay una inscripción seleccionada.", "error");
    return;
  }

  const permitidos = [
    "HABILITADO",
    "EN OBSERVACION",
    "RECHAZADO",
    "EN REVISION"
  ];

  if (!permitidos.includes(estado)) {
    mostrarMensaje("La decisión seleccionada no es válida.", "error");
    return;
  }

  const id = nominaActual.id;
  const observacion = $("observacionDecision")?.value.trim() || null;
  const botones = document.querySelectorAll("[data-decision]");

  botones.forEach(b => b.disabled = true);

  try {
    actualizarCarga("Guardando decisión de la inscripción...");

    const { data, error } = await supabase
      .from("inscripcion_equipo")
      .update({
        estado,
        observacion,
        fecha_revision: new Date().toISOString(),
        revisado_por: usuarioRevisorId
      })
      .eq("id", id)
      .select("id,estado,observacion,fecha_revision,revisado_por")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "No se confirmó la actualización. Revise las políticas RLS."
      );
    }

    const indice = nominas.findIndex(
      n => String(n.id) === String(data.id)
    );

    if (indice !== -1) {
      Object.assign(nominas[indice], data);
    }

    cerrarModal();
    actualizarEstadisticas();
    renderizarNominas();

    mostrarMensaje(
      `Inscripción actualizada: ${data.estado}.`,
      "ok"
    );

  } catch (error) {
    console.error("Error guardando decisión:", error);

    mostrarMensaje(
      `No se pudo guardar la decisión: ${error.message || error}`,
      "error"
    );

  } finally {
    ocultarCarga();
    botones.forEach(b => b.disabled = false);
  }
}

/* =====================================================
   EVENTOS
===================================================== */

function configurarEventos() {
  $("filtroEquipo")?.addEventListener("change", renderizarNominas);
  $("filtroEstado")?.addEventListener("change", renderizarNominas);
  $("buscarJugador")?.addEventListener("input", renderizarNominas);

  $("btnLimpiar")?.addEventListener("click", () => {
    if ($("filtroEquipo")) $("filtroEquipo").value = "";
    if ($("filtroEstado")) $("filtroEstado").value = "";
    if ($("buscarJugador")) $("buscarJugador").value = "";

    renderizarNominas();
  });

  $("btnActualizar")?.addEventListener("click", cargarNominas);
  $("cerrarModal")?.addEventListener("click", cerrarModal);

  $("modalNomina")?.addEventListener("click", evento => {
    if (evento.target === $("modalNomina")) {
      cerrarModal();
    }
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") cerrarModal();
  });

  $("tablaNomina")?.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-ver-nomina]");

    if (boton) {
      mostrarDetalleNomina(boton.dataset.verNomina);
    }
  });

  $("detalleNomina")?.addEventListener("click", evento => {
    /* Abrir o cerrar el menú Más */
    const botonMas = evento.target.closest("[data-toggle-mas]");

    if (botonMas) {
      const id = botonMas.dataset.toggleMas;
      const menu = $("detalleNomina").querySelector(
        `[data-menu-mas="${CSS.escape(id)}"]`
      );

      if (menu) {
        const abrir = menu.hidden;

        /* Cerrar otros menús antes de abrir el seleccionado */
        $("detalleNomina")
          .querySelectorAll("[data-menu-mas]")
          .forEach(otroMenu => {
            otroMenu.hidden = true;
          });

        $("detalleNomina")
          .querySelectorAll("[data-toggle-mas]")
          .forEach(otroBoton => {
            otroBoton.setAttribute("aria-expanded", "false");
          });

        menu.hidden = !abrir;
        botonMas.setAttribute("aria-expanded", String(abrir));
      }

      return;
    }

    /* Seleccionar En observación o Rechazado */
    const botonEstado = evento.target.closest("[data-estado-extra]");

    if (botonEstado) {
      const id = botonEstado.dataset.estadoExtra;
      const estado = botonEstado.dataset.estadoValor;

      const menu = botonEstado.closest("[data-menu-mas]");

      if (menu) menu.hidden = true;

      guardarEstadoJugador(id, estado);
      return;
    }

    /* Mostrar ficha completa */
    const botonDetalle = evento.target.closest("[data-ver-jugador]");

    if (botonDetalle) {
      const ficha = document.getElementById(
        botonDetalle.dataset.verJugador
      );

      if (ficha) {
        ficha.hidden = !ficha.hidden;

        botonDetalle.textContent = ficha.hidden
          ? "Ver detalles"
          : "Ocultar detalles";
      }

      return;
    }

    /* Decisiones sobre la inscripción del equipo */
    const decision = evento.target.closest("[data-decision]");

    if (decision) {
      guardarDecision(decision.dataset.decision);
    }
  });

  $("detalleNomina")?.addEventListener("change", evento => {
    const checkbox = evento.target.closest(
      "[data-habilitar-jugador]"
    );

    if (!checkbox) return;

    const id = checkbox.dataset.habilitarJugador;

    /* El mismo check habilita y deshabilita */
    const estado = checkbox.checked
      ? "HABILITADO"
      : "DESHABILITADO";

    guardarEstadoJugador(id, estado, checkbox);
  });

  $("btnSalir")?.addEventListener("click", async () => {
    actualizarCarga("Cerrando sesión...");

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      window.location.href = "../login.html";
    }
  });

  $("btnVolver")?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });
}

/* =====================================================
   INICIO
===================================================== */

async function inicializarNominas() {
  actualizarCarga("Verificando permisos...");

  try {
    const autorizado = await verificarAcceso();

    if (!autorizado) {
      ocultarCarga();
      return;
    }

    configurarEventos();
    await cargarNominas();

  } catch (error) {
    console.error(
      "Error inicializando revisión de nóminas:",
      error
    );

    ocultarCarga();

    mostrarMensaje(
      `No se pudo iniciar el módulo: ${error.message || error}`,
      "error"
    );
  }
}

inicializarNominas();
