import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const BUCKET_JUGADORES = "documentos-campeonato";
const BUCKET_DOCUMENTOS = "documentos-campeonato";

let nominas = [];
let nominaActual = null;
let mensajeTemporizador = null;

const FOTO_VACIA =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="120" height="140" viewBox="0 0 120 140">
      <rect width="120" height="140" fill="#edf3ef"/>
      <circle cx="60" cy="46" r="23" fill="#bdcec2"/>
      <path d="M18 132c3-30 19-46 42-46s39 16 42 46"
            fill="#bdcec2"/>
      <text x="60" y="17" font-size="8"
            text-anchor="middle" fill="#42634e">SIN FOTO</text>
    </svg>
  `);

/* =====================================================
   UTILIDADES
===================================================== */

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
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

  return [
    persona.nombres,
    persona.apellidos
  ].filter(Boolean).join(" ").trim()
    || persona.email
    || "Sin nombre";
}

function fechaLegible(fecha) {
  if (!fecha) return "No registrada";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return String(fecha);
  }

  return valor.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function etiquetaEstado(estado) {
  const original = String(estado || "PENDIENTE").trim();
  const normalizado = normalizarEstado(original);

  let clase = "estado-pendiente";

  if (
    normalizado.includes("APROBAD") ||
    normalizado === "HABILITADO"
  ) {
    clase = "estado-aprobada";
  } else if (
    normalizado.includes("OBSERVAD") ||
    normalizado.includes("RECHAZAD")
  ) {
    clase = "estado-observada";
  } else if (normalizado.includes("REVISION")) {
    clase = "estado-en-revision";
  }

  return `
    <span class="estado ${clase}">
      ${escapar(original)}
    </span>
  `;
}

function mostrarMensaje(texto, tipo = "info") {
  const elemento = $("mensaje");

  if (!elemento) {
    console.log(texto);
    return;
  }

  clearTimeout(mensajeTemporizador);

  elemento.textContent = texto;
  elemento.className = `mensaje visible ${tipo}`;

  mensajeTemporizador = setTimeout(() => {
    elemento.classList.remove("visible");
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

/* =====================================================
   ARCHIVOS DE SUPABASE STORAGE

   La ruta se conserva completa.
   Ejemplo:
   UUID/jugadores/1/foto.png

   No se añade otra carpeta "jugadores".
===================================================== */

function esURLCompleta(valor) {
  return /^(https?:|data:|blob:)/i.test(String(valor || ""));
}

function normalizarRutaArchivo(ruta) {
  return String(ruta || "").trim().replace(/^\/+/, "");
}

async function resolverArchivoPrivado(bucket, ruta) {
  if (!ruta) return "";

  const valor = String(ruta).trim();

  if (!valor) return "";

  // Si ya es una URL, se utiliza tal como está.
  if (esURLCompleta(valor)) {
    return valor;
  }

  // Conservar UUID, carpetas y nombre del archivo.
  const rutaFinal = normalizarRutaArchivo(valor);

  if (!rutaFinal) return "";

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rutaFinal, 3600);

  if (error) {
    console.error("Error al generar URL firmada:", {
      bucket,
      ruta: rutaFinal,
      error: error.message
    });

    return "";
  }

  return data?.signedUrl || "";
}

async function resolverFotoJugador(ruta) {
  return resolverArchivoPrivado(
    BUCKET_JUGADORES,
    ruta
  );
}

async function resolverDocumento(ruta) {
  return resolverArchivoPrivado(
    BUCKET_DOCUMENTOS,
    ruta
  );
}

function enlaceDocumento(url, texto = "Abrir documento") {
  if (!url) {
    return `
      <span class="nota-pequena">
        Documento no disponible o sin permiso de lectura.
      </span>
    `;
  }

  return `
    <a href="${escapar(url)}"
       target="_blank"
       rel="noopener noreferrer">
      ${escapar(texto)} ↗
    </a>
  `;
}

/* =====================================================
   CONSULTAS A SUPABASE
===================================================== */

async function consultarPorIds(
  tabla,
  columna,
  ids,
  campos = "*"
) {
  const unicos = [
    ...new Set(
      (ids || []).filter(
        (id) => id !== null &&
                id !== undefined &&
                id !== ""
      )
    )
  ];

  if (!unicos.length) return [];

  const { data, error } = await supabase
    .from(tabla)
    .select(campos)
    .in(columna, unicos);

  if (error) throw error;

  return data || [];
}

/* =====================================================
   VALIDAR ACCESO DEL ADMINISTRADOR
===================================================== */

async function verificarAcceso() {
  const { data: sesionData, error: sesionError } =
    await supabase.auth.getSession();

  if (sesionError) throw sesionError;

  const usuario = sesionData?.session?.user;

  if (!usuario) {
    window.location.href = "../login.html";
    return false;
  }

  const { data: perfil, error: perfilError } =
    await supabase
      .from("perfil_usuario")
      .select("id,nombres,apellidos,activo")
      .eq("id", usuario.id)
      .maybeSingle();

  if (perfilError) throw perfilError;

  if (!perfil || perfil.activo !== true) {
    throw new Error(
      "Su perfil no existe o se encuentra inactivo."
    );
  }

  const { data: relaciones, error: rolesError } =
    await supabase
      .from("usuario_rol")
      .select("rol_id")
      .eq("usuario_id", usuario.id);

  if (rolesError) throw rolesError;

  const rolIds = (relaciones || [])
    .map((r) => r.rol_id)
    .filter(Boolean);

  let nombresRoles = [];

  if (rolIds.length) {
    const { data: roles, error } = await supabase
      .from("rol")
      .select("id,nombre")
      .in("id", rolIds);

    if (error) throw error;

    nombresRoles = (roles || [])
      .map((r) => normalizarEstado(r.nombre));
  }

  const autorizado = nombresRoles.some((rol) =>
    ["ADMINISTRADOR", "COMISION"].includes(rol)
  );

  if (!autorizado) {
    throw new Error(
      "No tiene permisos para revisar las nóminas."
    );
  }

  if ($("usuarioNombre")) {
    $("usuarioNombre").textContent =
      nombrePersona(perfil);
  }

  return true;
}

/* =====================================================
   CARGAR INSCRIPCIONES, EQUIPOS Y JUGADORES
===================================================== */

async function cargarNominas() {
  actualizarCarga(
    "Cargando inscripciones y fotografías..."
  );

  try {
    const { data: inscripciones, error } =
      await supabase
        .from("inscripcion_equipo")
        .select(`
          id,
          equipo_id,
          competencia_id,
          capitan_id,
          estado,
          fecha_inscripcion,
          observacion,
          documento_inscripcion,
          documento_aval
        `)
        .order("fecha_inscripcion", {
          ascending: false
        });

    if (error) throw error;

    const lista = inscripciones || [];

    const [
      equipos,
      competencias,
      perfiles,
      relacionesJugadores
    ] = await Promise.all([
      consultarPorIds(
        "equipo",
        "id",
        lista.map((i) => i.equipo_id),
        "id,nombre,logo,contacto"
      ),

      consultarPorIds(
        "competencia",
        "id",
        lista.map((i) => i.competencia_id),
        "id,disciplina_id,categoria_id"
      ),

      consultarPorIds(
        "perfil_usuario",
        "id",
        lista.map((i) => i.capitan_id),
        "id,nombres,apellidos,activo"
      ),

      consultarPorIds(
        "inscripcion_jugador",
        "inscripcion_equipo_id",
        lista.map((i) => i.id),
        "id,inscripcion_equipo_id,jugador_id,numero,posicion,es_especial,estado,observacion"
      )
    ]);

    const jugadores = await consultarPorIds(
      "jugador",
      "id",
      relacionesJugadores.map((r) => r.jugador_id),
      "id,nombres,apellidos,fecha_nacimiento,numero_cedula,foto,foto_cedula,origen,activo"
    );

    const [disciplinas, categorias] =
      await Promise.all([
        consultarPorIds(
          "disciplina",
          "id",
          competencias.map((c) => c.disciplina_id),
          "id,nombre"
        ),

        consultarPorIds(
          "categoria",
          "id",
          competencias.map((c) => c.categoria_id),
          "id,nombre"
        )
      ]);

    const crearMapa = (elementos) =>
      new Map(
        elementos.map((x) => [String(x.id), x])
      );

    const equipoPorId = crearMapa(equipos);
    const competenciaPorId = crearMapa(competencias);
    const perfilPorId = crearMapa(perfiles);
    const jugadorPorId = crearMapa(jugadores);
    const disciplinaPorId = crearMapa(disciplinas);
    const categoriaPorId = crearMapa(categorias);

    const jugadoresPorInscripcion = new Map();

    for (const relacion of relacionesJugadores) {
      const clave = String(
        relacion.inscripcion_equipo_id
      );

      if (!jugadoresPorInscripcion.has(clave)) {
        jugadoresPorInscripcion.set(clave, []);
      }

      const jugador =
        jugadorPorId.get(
          String(relacion.jugador_id)
        ) || {};

      jugadoresPorInscripcion.get(clave).push({
        ...jugador,
        ...relacion,

        jugadorId:
          jugador.id ?? relacion.jugador_id,

        nombreCompleto: [
          jugador.nombres,
          jugador.apellidos
        ].filter(Boolean).join(" ").trim()
          || "Jugador sin nombre"
      });
    }

    nominas = await Promise.all(
      lista.map(async (inscripcion) => {
        const equipo =
          equipoPorId.get(
            String(inscripcion.equipo_id)
          ) || {};

        const competencia =
          competenciaPorId.get(
            String(inscripcion.competencia_id)
          ) || {};

        const capitan =
          perfilPorId.get(
            String(inscripcion.capitan_id)
          ) || {};

        const jugadoresInscritos =
          jugadoresPorInscripcion.get(
            String(inscripcion.id)
          ) || [];

        // Generar enlaces de fotos sin alterar la ruta original.
        const jugadoresConFotos = await Promise.all(
          jugadoresInscritos.map(async (jugador) => {
            const [fotoUrl, fotoCedulaUrl] =
              await Promise.all([
                resolverFotoJugador(jugador.foto),
                resolverFotoJugador(
                  jugador.foto_cedula
                )
              ]);

            return {
              ...jugador,
              foto_url: fotoUrl,
              foto_cedula_url: fotoCedulaUrl
            };
          })
        );

        const [
          logoUrl,
          documentoInscripcionUrl,
          documentoAvalUrl
        ] = await Promise.all([
          resolverArchivoPrivado(
            BUCKET_DOCUMENTOS,
            equipo.logo
          ),

          resolverDocumento(
            inscripcion.documento_inscripcion
          ),

          resolverDocumento(
            inscripcion.documento_aval
          )
        ]);

        return {
          ...inscripcion,

          equipo: {
            ...equipo,
            logo_url: logoUrl
          },

          competencia,
          capitan,

          disciplina:
            disciplinaPorId.get(
              String(competencia.disciplina_id)
            ) || {},

          categoria:
            categoriaPorId.get(
              String(competencia.categoria_id)
            ) || {},

          documento_inscripcion_url:
            documentoInscripcionUrl,

          documento_aval_url:
            documentoAvalUrl,

          jugadores: jugadoresConFotos
        };
      })
    );

    prepararFiltroEquipos();
    actualizarEstadisticas();
    renderizarNominas();

  } catch (error) {
    console.error(
      "Error cargando nóminas:",
      error
    );

    mostrarMensaje(
      `No se pudieron cargar las nóminas: ${
        error.message || error
      }`,
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

  for (const n of nominas) {
    if (n.equipo_id) {
      equipos.set(
        String(n.equipo_id),
        n.equipo?.nombre || "Equipo sin nombre"
      );
    }
  }

  select.innerHTML =
    `<option value="">Todos los equipos</option>`;

  [...equipos.entries()]
    .sort((a, b) =>
      a[1].localeCompare(b[1], "es")
    )
    .forEach(([id, nombre]) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${escapar(id)}">${escapar(nombre)}</option>`
      );
    });

  if (
    [...select.options].some(
      (opcion) => opcion.value === anterior
    )
  ) {
    select.value = anterior;
  }
}

function actualizarEstadisticas() {
  if ($("totalInscripciones")) {
    $("totalInscripciones").textContent =
      nominas.length;
  }

  if ($("totalJugadores")) {
    $("totalJugadores").textContent =
      nominas.reduce(
        (total, n) =>
          total + (n.jugadores?.length || 0),
        0
      );
  }

  if ($("totalPendientes")) {
    $("totalPendientes").textContent =
      nominas.filter((n) => {
        const estado = normalizarEstado(n.estado);

        return estado === "PENDIENTE" ||
               estado === "EN REVISION";
      }).length;
  }

  if ($("totalAprobadas")) {
    $("totalAprobadas").textContent =
      nominas.filter(
        (n) =>
          normalizarEstado(n.estado) === "APROBADA"
      ).length;
  }
}

function obtenerNominasFiltradas() {
  const equipo = $("filtroEquipo")?.value || "";

  const estado = normalizarEstado(
    $("filtroEstado")?.value || ""
  );

  const busqueda = normalizarEstado(
    $("buscarJugador")?.value || ""
  );

  return nominas.filter((n) => {
    if (
      equipo &&
      String(n.equipo_id) !== equipo
    ) {
      return false;
    }

    if (
      estado &&
      normalizarEstado(n.estado) !== estado
    ) {
      return false;
    }

    if (busqueda) {
      const texto = [
        n.equipo?.nombre,
        nombrePersona(n.capitan),
        n.disciplina?.nombre,
        n.categoria?.nombre,
        ...(n.jugadores || []).map(
          (j) => j.nombreCompleto
        ),
        ...(n.jugadores || []).map(
          (j) => j.numero_cedula
        )
      ].join(" ");

      if (
        !normalizarEstado(texto).includes(busqueda)
      ) {
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

  tbody.innerHTML = filtradas.map((n) => {
    const logo =
      n.equipo?.logo_url || FOTO_VACIA;

    const competencia = [
      n.disciplina?.nombre,
      n.categoria?.nombre
    ].filter(Boolean).join(" · ")
      || "Competencia no definida";

    return `
      <tr>
        <td>
          <div class="equipo-celda">
            <img class="logo-equipo"
                 src="${escapar(logo)}"
                 alt="Logo del equipo"
                 onerror="this.onerror=null;this.src='${FOTO_VACIA}'">

            <div>
              <strong>
                ${escapar(n.equipo?.nombre || "Equipo sin nombre")}
              </strong>
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
      </tr>
    `;
  }).join("");

  if ($("sinResultados")) {
    $("sinResultados").hidden =
      filtradas.length > 0;
  }

  if ($("tablaNominas")) {
    $("tablaNominas").style.display =
      filtradas.length ? "table" : "none";
  }

  if ($("contadorResultados")) {
    $("contadorResultados").textContent =
      `${filtradas.length} ${
        filtradas.length === 1
          ? "inscripción"
          : "inscripciones"
      }`;
  }
}

function datoMini(etiqueta, valor) {
  return `
    <div class="dato-mini">
      <span>${escapar(etiqueta)}</span>
      <strong>${escapar(valor || "No registrado")}</strong>
    </div>
  `;
}

function detalleDato(etiqueta, valor) {
  return `
    <div class="detalle-dato">
      <span>${escapar(etiqueta)}</span>
      <strong>${escapar(valor || "No registrado")}</strong>
    </div>
  `;
}

/* =====================================================
   TARJETA DE JUGADOR Y FOTOGRAFÍAS
===================================================== */

function tarjetaJugador(item, indice) {
  const id = String(item.id);
  const nombre =
    item.nombreCompleto || "Jugador sin nombre";

  const foto = item.foto_url || FOTO_VACIA;
  const fotoCedula = item.foto_cedula_url || "";

  const estadoRelacion =
    item.estado || "PENDIENTE";

  const estadoJugador =
    item.activo === true
      ? "Activo"
      : item.activo === false
        ? "Inactivo"
        : "No especificado";

  const especial =
    item.es_especial === true
      ? "Sí"
      : item.es_especial === false
        ? "No"
        : "No registrado";

  const fichaId =
    `ficha-${id.replace(/[^a-zA-Z0-9_-]/g, "")}-${indice}`;

  return `
    <article class="jugador-fila">

      <div class="jugador-foto-mini">
        <img src="${escapar(foto)}"
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

          ${etiquetaEstado(estadoRelacion)}

          <label class="check-habilitacion">
            <input type="checkbox"
                   data-habilitar-jugador="${escapar(id)}"
                   ${normalizarEstado(estadoRelacion) === "HABILITADO" ? "checked" : ""}>
            Habilitar
          </label>

          <button class="btn btn-claro btn-pequeno"
                  data-ver-jugador="${escapar(fichaId)}">
            Ver detalles
          </button>

        </div>

        <div class="jugador-resumen-datos">
          ${datoMini("Nacimiento", fechaLegible(item.fecha_nacimiento))}
          ${datoMini("Posición", item.posicion)}
          ${datoMini("Origen", item.origen)}
          ${datoMini("Especial", especial)}
          ${datoMini("Estado jugador", estadoJugador)}
          ${datoMini("Observación", item.observacion)}
        </div>

        <section class="jugador-detalle"
                 id="${escapar(fichaId)}"
                 hidden>

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
            ${detalleDato("Estado del jugador", estadoJugador)}
            ${detalleDato("Estado de inscripción", estadoRelacion)}
            ${detalleDato("Observación", item.observacion)}
            ${detalleDato("ID del registro de nómina", item.id)}
          </div>

          <div class="documento-jugador">

            <div class="documento-imagen">
              <strong>Fotografía del jugador</strong>

              <a href="${escapar(foto)}"
                 target="_blank"
                 rel="noopener noreferrer">
                <img src="${escapar(foto)}"
                     alt="Fotografía del jugador"
                     onerror="this.onerror=null;this.src='${FOTO_VACIA}'">
              </a>

              ${
                item.foto_url
                  ? ""
                  : `<span class="nota-pequena">
                       No se pudo cargar la foto. Revise la ruta y los permisos de Storage.
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
                      <img src="${escapar(fotoCedula)}"
                           alt="Fotografía de cédula"
                           onerror="this.style.display='none'">
                    </a>
                  `
                  : `
                    <span class="nota-pequena">
                      No disponible o sin permiso para consultar el documento.
                    </span>
                  `
              }
            </div>

          </div>
        </section>

      </div>
    </article>
  `;
}

/* =====================================================
   DETALLE COMPLETO DE LA NÓMINA
===================================================== */

function mostrarDetalleNomina(id) {
  const n = nominas.find(
    (item) => String(item.id) === String(id)
  );

  if (!n) {
    mostrarMensaje(
      "No se encontró la inscripción seleccionada.",
      "error"
    );
    return;
  }

  nominaActual = n;

  $("tituloModal").textContent =
    `Nómina: ${n.equipo?.nombre || "Equipo sin nombre"}`;

  const competencia = [
    n.disciplina?.nombre,
    n.categoria?.nombre
  ].filter(Boolean).join(" · ") || "No definida";

  const jugadoresHTML = n.jugadores?.length
    ? n.jugadores.map((j, i) =>
        tarjetaJugador(j, i)
      ).join("")
    : `
      <div class="sin-resultados">
        <strong>
          Esta inscripción todavía no tiene jugadores registrados.
        </strong>
        <p>
          Cuando el capitán registre la nómina,
          los jugadores aparecerán aquí.
        </p>
      </div>
    `;

  $("detalleNomina").innerHTML = `
    <section class="resumen-equipo">

      <img src="${escapar(n.equipo?.logo_url || FOTO_VACIA)}"
           alt="Logo del equipo"
           onerror="this.onerror=null;this.src='${FOTO_VACIA}'">

      <div>
        <h3>${escapar(n.equipo?.nombre || "Equipo sin nombre")}</h3>

        <p>
          <strong>Competencia:</strong>
          ${escapar(competencia)}
        </p>

        <p>
          <strong>Capitán:</strong>
          ${escapar(nombrePersona(n.capitan))}
        </p>

        <p>
          <strong>Inscripción:</strong>
          ${etiquetaEstado(n.estado)}
        </p>

        <p>
          <strong>Fecha:</strong>
          ${escapar(fechaLegible(n.fecha_inscripcion))}
        </p>
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
        <h3>
          Jugadores registrados (${n.jugadores?.length || 0})
        </h3>

        <span class="nota-pequena">
          Use “Ver detalles” para revisar las fotografías y la ficha.
        </span>
      </div>

      <div class="jugadores-lista">
        ${jugadoresHTML}
      </div>

    </section>

    <section class="decision-panel">

      <h3>Decisión sobre la inscripción</h3>

      <div class="campo">
        <label for="observacionDecision">
          Observación de la comisión
        </label>

        <textarea id="observacionDecision"
                  rows="3"
                  placeholder="Escriba observaciones o documentos faltantes...">${escapar(n.observacion || "")}</textarea>
      </div>

      <div class="decision-acciones">

        <button class="btn btn-rojo"
                data-decision="RECHAZADA">
          Rechazar
        </button>

        <button class="btn btn-dorado"
                data-decision="OBSERVADA">
          Registrar observación
        </button>

        <button class="btn btn-claro"
                data-decision="EN REVISION">
          En revisión
        </button>

        <button class="btn btn-verde"
                data-decision="APROBADA">
          Aprobar inscripción
        </button>

      </div>

      <p class="decision-ayuda">
        La decisión se guarda en inscripcion_equipo.
        La casilla individual “Habilitar” es solamente visual;
        no modifica la base de datos.
      </p>

    </section>
  `;

  mostrarModal();
}

/* =====================================================
   GUARDAR DECISIÓN DE LA COMISIÓN
===================================================== */

async function guardarDecision(estado) {
  if (!nominaActual) {
    mostrarMensaje(
      "No hay una inscripción seleccionada.",
      "error"
    );
    return;
  }

  const permitidos = [
    "APROBADA",
    "OBSERVADA",
    "RECHAZADA",
    "EN REVISION"
  ];

  if (!permitidos.includes(estado)) {
    mostrarMensaje(
      "La decisión seleccionada no es válida.",
      "error"
    );
    return;
  }

  const observacion =
    $("observacionDecision")?.value.trim() || null;

  const botones =
    document.querySelectorAll("[data-decision]");

  botones.forEach((b) => {
    b.disabled = true;
  });

  actualizarCarga("Guardando decisión...");

  try {
    const { data, error } = await supabase
      .from("inscripcion_equipo")
      .update({
        estado,
        observacion
      })
      .eq("id", nominaActual.id)
      .select("id,estado,observacion")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "No se devolvió la inscripción actualizada. Revise las políticas RLS."
      );
    }

    const indice = nominas.findIndex(
      (n) => String(n.id) === String(data.id)
    );

    if (indice !== -1) {
      nominas[indice].estado = data.estado;
      nominas[indice].observacion = data.observacion;
    }

    cerrarModal();
    actualizarEstadisticas();
    renderizarNominas();

    mostrarMensaje(
      `Inscripción actualizada: ${estado}.`,
      "ok"
    );

  } catch (error) {
    console.error(
      "Error guardando decisión:",
      error
    );

    mostrarMensaje(
      `No se pudo guardar la decisión: ${error.message || error}`,
      "error"
    );

  } finally {
    ocultarCarga();

    botones.forEach((b) => {
      b.disabled = false;
    });
  }
}

/* =====================================================
   EVENTOS
===================================================== */

function configurarEventos() {
  $("filtroEquipo")?.addEventListener(
    "change",
    renderizarNominas
  );

  $("filtroEstado")?.addEventListener(
    "change",
    renderizarNominas
  );

  $("buscarJugador")?.addEventListener(
    "input",
    renderizarNominas
  );

  $("btnLimpiar")?.addEventListener("click", () => {
    if ($("filtroEquipo")) $("filtroEquipo").value = "";
    if ($("filtroEstado")) $("filtroEstado").value = "";
    if ($("buscarJugador")) $("buscarJugador").value = "";

    renderizarNominas();
  });

  $("btnActualizar")?.addEventListener(
    "click",
    cargarNominas
  );

  $("cerrarModal")?.addEventListener(
    "click",
    cerrarModal
  );

  $("modalNomina")?.addEventListener(
    "click",
    (evento) => {
      if (evento.target === $("modalNomina")) {
        cerrarModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key === "Escape") cerrarModal();
    }
  );

  $("tablaNomina")?.addEventListener(
    "click",
    (evento) => {
      const boton = evento.target.closest(
        "[data-ver-nomina]"
      );

      if (boton) {
        mostrarDetalleNomina(
          boton.dataset.verNomina
        );
      }
    }
  );

  $("detalleNomina")?.addEventListener(
    "click",
    (evento) => {
      const botonDetalle = evento.target.closest(
        "[data-ver-jugador]"
      );

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

      const botonDecision = evento.target.closest(
        "[data-decision]"
      );

      if (botonDecision) {
        guardarDecision(
          botonDecision.dataset.decision
        );
      }
    }
  );

  $("detalleNomina")?.addEventListener(
    "change",
    (evento) => {
      const checkbox = evento.target.closest(
        "[data-habilitar-jugador]"
      );

      if (!checkbox) return;

      const jugador = nominaActual?.jugadores?.find(
        (j) =>
          String(j.id) ===
          String(checkbox.dataset.habilitarJugador)
      );

      // No guardar un cambio ficticio en la interfaz.
      checkbox.checked =
        normalizarEstado(jugador?.estado) === "HABILITADO";

      mostrarMensaje(
        "La habilitación individual todavía no está conectada a Supabase.",
        "info"
      );
    }
  );

  $("btnSalir")?.addEventListener(
    "click",
    async () => {
      actualizarCarga("Cerrando sesión...");

      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error(
          "Error al cerrar sesión:",
          error
        );
      } finally {
        window.location.href = "../login.html";
      }
    }
  );

  $("btnVolver")?.addEventListener(
    "click",
    () => {
      window.location.href = "./index.html";
    }
  );
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