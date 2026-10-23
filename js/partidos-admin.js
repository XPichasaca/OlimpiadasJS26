
import { supabase } from "./supabase.js";

console.log("✅ partidos-admin.js cargado");

// =====================================================
// ESTADO DEL MÓDULO
// =====================================================

let usuarioActual = null;
let competencias = [];
let equiposInscritos = [];
let grupos = [];
let partidosActuales = [];
let competenciaId = "";
let temporizadorPantalla = null;
let ultimaAsignacionMostrada = null;
let cargandoDatos = false;

const $ = (id) => document.getElementById(id);

const esPantallaPublica =
  new URLSearchParams(window.location.search).get("pantalla") === "sorteo";

// =====================================================
// UTILIDADES
// =====================================================

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function normalizarTexto(valor) {
  return String(valor ?? "").trim().toUpperCase();
}

function mostrarAviso(mensaje, tipo = "info") {
  console.log(`[${tipo.toUpperCase()}] ${mensaje}`);

  const aviso = $("aviso");

  if (!aviso) {
    console.log(mensaje);
    return;
  }

  aviso.textContent = mensaje;
  aviso.className = "aviso visible";

  aviso.classList.add(
    tipo === "success"
      ? "exito"
      : ["danger", "warning"].includes(tipo)
        ? "error"
        : "info"
  );
}

function ocultarAviso() {
  const aviso = $("aviso");

  if (aviso) {
    aviso.className = "aviso";
    aviso.textContent = "";
  }
}

function nombreEstado(estado) {
  return String(estado || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function obtenerCompetenciaSeleccionada() {
  return (
    $("competenciaSorteo")?.value ||
    $("competenciaGrupos")?.value ||
    $("competenciaPartidos")?.value ||
    $("competenciaInicio")?.value ||
    competenciaId ||
    ""
  );
}

function sincronizarCompetencias(valor) {
  competenciaId = String(valor || "");

  [
    "competenciaInicio",
    "competenciaSorteo",
    "competenciaGrupos",
    "competenciaPartidos"
  ].forEach((id) => {
    const selector = $(id);

    if (
      selector &&
      selector.value !== competenciaId
    ) {
      selector.value = competenciaId;
    }
  });
}

function estadosHabilitados() {
  return [
    "APROBADA",
    "APROBADO",
    "HABILITADO",
    "HABILITADA",
    "ACTIVA",
    "ACTIVO"
  ];
}

// =====================================================
// AUTENTICACIÓN Y NAVEGACIÓN
// =====================================================

async function verificarSesion() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    mostrarAviso(
      error
        ? "No se pudo verificar la sesión: " + error.message
        : "Inicia sesión como administrador.",
      "danger"
    );

    return false;
  }

  usuarioActual = data.user;

  return true;
}

function mostrarSeccion(nombre) {
  document.querySelectorAll(".seccion").forEach((seccion) => {
    seccion.classList.toggle(
      "activa",
      seccion.id === `seccion-${nombre}`
    );
  });

  document.querySelectorAll("[data-seccion]").forEach((boton) => {
    boton.classList.toggle(
      "activo",
      boton.dataset.seccion === nombre
    );
  });

  const titulos = {
    inicio: "Dashboard deportivo",
    sorteo: "Sorteo mundialista",
    partidos: "Gestión de partidos",
    grupos: "Consultar grupos",
    nomina: "Nóminas de partidos"
  };

  if ($("tituloSeccion")) {
    $("tituloSeccion").textContent =
      titulos[nombre] || "Gestión deportiva";
  }
}

function conectarNavegacion() {
  document.querySelectorAll("[data-seccion]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const destino = boton.dataset.seccion;

      mostrarSeccion(destino);

      if (destino === "partidos") {
        const valor = obtenerCompetenciaSeleccionada();

        if (valor) {
          sincronizarCompetencias(valor);
          await cargarPartidos();
        }
      }

      if (destino === "sorteo" || destino === "grupos") {
        const valor = obtenerCompetenciaSeleccionada();

        if (valor) {
          sincronizarCompetencias(valor);
          await cargarEquipos();
        }
      }
    });
  });

  document.querySelectorAll("[data-ir]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const destino = boton.dataset.ir;

      mostrarSeccion(destino);

      const valor = obtenerCompetenciaSeleccionada();

      if (!valor) return;

      sincronizarCompetencias(valor);

      if (["sorteo", "grupos"].includes(destino)) {
        await cargarEquipos();
      }

      if (destino === "partidos") {
        await cargarPartidos();
      }
    });
  });

  $("btnVolver")?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  // Si el HTML tiene dos botones con este ID, solo se conecta
  // el primero. Es recomendable dejar un solo ID duplicado.
  $("btnAbrirPantalla")?.addEventListener("click", abrirPantallaPublica);
}

function abrirPantallaPublica() {
  const id =
    obtenerCompetenciaSeleccionada();

  if (!id) {
    mostrarAviso(
      "Selecciona una competencia antes de abrir la pantalla pública.",
      "warning"
    );
    return;
  }

  const url = new URL(window.location.href);

  url.search = "";
  url.searchParams.set("pantalla", "sorteo");
  url.searchParams.set("competencia", id);

  const ventana = window.open(
    url.href,
    "pantallaSorteo",
    "popup=yes,width=1400,height=900"
  );

  if (!ventana) {
    mostrarAviso(
      "El navegador bloqueó la ventana. Permite las ventanas emergentes.",
      "warning"
    );
    return;
  }

  mostrarAviso(
    "Pantalla pública abierta. Puedes moverla al proyector.",
    "success"
  );
}

// =====================================================
// COMPETENCIAS
// =====================================================

async function cargarCompetencias() {
  mostrarAviso("Cargando competencias...", "info");

  const { data, error } = await supabase
    .from("competencia")
    .select(`
      id,
      nombre,
      estado,
      disciplina:disciplina_id(nombre),
      categoria:categoria_id(nombre)
    `)
    .order("id");

  if (error) {
    console.error("Error consultando competencias:", error);

    mostrarAviso(
      "Error al consultar competencias: " + error.message,
      "danger"
    );

    return;
  }

  competencias = data || [];

  const selectores = [
    "competenciaInicio",
    "competenciaSorteo",
    "competenciaGrupos",
    "competenciaPartidos"
  ];

  selectores.forEach((id) => {
    const selector = $(id);

    if (!selector) return;

    selector.innerHTML =
      '<option value="">Seleccione una competencia...</option>';

    competencias.forEach((competencia) => {
      const opcion = document.createElement("option");

      opcion.value = competencia.id;

      opcion.textContent = [
        competencia.nombre,
        competencia.disciplina?.nombre,
        competencia.categoria?.nombre
      ].filter(Boolean).join(" — ");

      selector.appendChild(opcion);
    });
  });

  if (!competencias.length) {
    mostrarAviso("No hay competencias registradas.", "warning");
    actualizarEstadisticas();
    return;
  }

  // Recupera la competencia de la URL si se abre la pantalla
  // administrativa desde un enlace con ?competencia=...
  const params = new URLSearchParams(window.location.search);
  const idUrl = params.get("competencia");

  const existeUrl = competencias.some(
    (c) => String(c.id) === String(idUrl)
  );

  const valorInicial = existeUrl
    ? idUrl
    : String(competencias[0].id);

  sincronizarCompetencias(valorInicial);

  await cargarEquipos();

  ocultarAviso();
}

// =====================================================
// EQUIPOS HABILITADOS
// =====================================================

async function cargarEquipos() {
  const valor = obtenerCompetenciaSeleccionada();

  if (!valor) {
    equiposInscritos = [];
    grupos = [];
    partidosActuales = [];

    renderizarGrupo("A", []);
    renderizarGrupo("B", []);
    renderizarPartidos();
    actualizarEstadisticas();

    mostrarAviso(
      "Selecciona una competencia primero.",
      "warning"
    );

    return;
  }

  if (cargandoDatos) return;

  cargandoDatos = true;
  sincronizarCompetencias(valor);

  try {
    const { data, error } = await supabase
      .from("inscripcion_equipo")
      .select(`
        id,
        equipo_id,
        competencia_id,
        estado,
        equipo:equipo_id(id, nombre, logo)
      `)
      .eq("competencia_id", Number(valor))
      .order("id");

    if (error) throw error;

    equiposInscritos = (data || []).filter((item) =>
      estadosHabilitados().includes(normalizarTexto(item.estado))
    );

    await cargarGrupos();

    actualizarSelectorEquipos();
    actualizarEstadisticas();

  } catch (error) {
    console.error("Error cargando equipos:", error);

    mostrarAviso(
      "Error al consultar equipos: " +
      (error.message || String(error)),
      "danger"
    );
  } finally {
    cargandoDatos = false;
  }
}

function actualizarSelectorEquipos() {
  const selector = $("equipoSorteo");

  if (!selector) return;

  const asignados = new Set(
    grupos.map((g) => String(g.inscripcion_equipo_id))
  );

  selector.innerHTML =
    '<option value="">Seleccione el equipo sorteado...</option>';

  equiposInscritos
    .filter((item) => !asignados.has(String(item.id)))
    .forEach((item) => {
      const opcion = document.createElement("option");

      opcion.value = item.id;
      opcion.textContent =
        item.equipo?.nombre || `Inscripción ${item.id}`;

      selector.appendChild(opcion);
    });

  selector.disabled = selector.options.length <= 1;

  if ($("btnAsignar")) {
    $("btnAsignar").disabled = selector.disabled;
  }
}

// =====================================================
// CARGAR Y MOSTRAR GRUPOS
// =====================================================

async function cargarGrupos() {
  const idCompetencia = obtenerCompetenciaSeleccionada();

  if (!idCompetencia) {
    grupos = [];

    renderizarGrupo("A", []);
    renderizarGrupo("B", []);
    actualizarEstadisticas();

    return;
  }

  competenciaId = String(idCompetencia);

  const { data, error } = await supabase
    .from("grupo_equipo")
    .select(`
      id,
      competencia_id,
      inscripcion_equipo_id,
      grupo,
      sorteo_orden
    `)
    .eq("competencia_id", Number(idCompetencia))
    .order("sorteo_orden", { ascending: true });

  if (error) {
    console.error("Error consultando grupos:", error);

    mostrarAviso(
      "Error al consultar grupos: " + error.message,
      "danger"
    );

    return;
  }

  grupos = data || [];

  const ids = [
    ...new Set(
      grupos.map((g) => g.inscripcion_equipo_id)
    )
  ];

  let inscripciones = [];

  if (ids.length) {
    const resultado = await supabase
      .from("inscripcion_equipo")
      .select("id, equipo:equipo_id(id, nombre, logo)")
      .in("id", ids);

    if (resultado.error) {
      throw resultado.error;
    }

    inscripciones = resultado.data || [];
  }

  const mapa = new Map(
    inscripciones.map((i) => [
      String(i.id),
      {
        nombre: i.equipo?.nombre || `Inscripción ${i.id}`,
        logo: i.equipo?.logo || ""
      }
    ])
  );

  const lista = grupos.map((g) => ({
    ...g,
    nombreEquipo:
      mapa.get(String(g.inscripcion_equipo_id))?.nombre ||
      `Inscripción ${g.inscripcion_equipo_id}`,
    logoEquipo:
      mapa.get(String(g.inscripcion_equipo_id))?.logo || ""
  }));

  renderizarGrupo("A", lista);
  renderizarGrupo("B", lista);

  actualizarSelectorEquipos();
  actualizarEstadisticas();

  if ($("btnGenerarCalendario")) {
    $("btnGenerarCalendario").disabled = grupos.length < 2;
  }
}

function renderizarGrupo(letra, lista) {
  const contenedor =
    letra === "A" ? $("listaA") : $("listaB");

  const consulta =
    letra === "A"
      ? $("consultaListaA")
      : $("consultaListaB");

  const equipos = lista
    .filter((item) => normalizarTexto(item.grupo) === letra)
    .sort(
      (a, b) =>
        Number(a.sorteo_orden) - Number(b.sorteo_orden)
    );

  const html = equipos.length
    ? equipos.map((item, indice) => `
        <div class="equipo">
          <span class="orden">
            ${escapar(item.sorteo_orden || indice + 1)}
          </span>

          <div>
            <div class="equipo-nombre">
              ${escapar(item.nombreEquipo)}
            </div>

            <div class="equipo-subtitulo">
              Grupo ${letra}
            </div>
          </div>
        </div>
      `).join("")
    : '<p class="vacio">Todavía no hay equipos asignados.</p>';

  if (contenedor) contenedor.innerHTML = html;
  if (consulta) consulta.innerHTML = html;

  if ($("total" + letra)) {
    $("total" + letra).textContent =
      `${equipos.length} equipos`;
  }

  if ($("consultaTotal" + letra)) {
    $("consultaTotal" + letra).textContent =
      `${equipos.length} equipos`;
  }
}

// =====================================================
// GUARDAR ASIGNACIÓN DE SORTEO
// =====================================================

async function asignarEquipo() {
  const competencia = $("competenciaSorteo")?.value;
  const inscripcionId = $("equipoSorteo")?.value;
  const grupo = normalizarTexto($("grupoSorteo")?.value);
  const orden = Number($("ordenSorteo")?.value);

  if (!competencia || !inscripcionId || !grupo) {
    mostrarAviso(
      "Selecciona la competencia, el equipo y el grupo.",
      "warning"
    );
    return;
  }

  if (!["A", "B"].includes(grupo)) {
    mostrarAviso("El grupo debe ser A o B.", "warning");
    return;
  }

  if (!Number.isInteger(orden) || orden < 1) {
    mostrarAviso(
      "El orden debe ser un entero mayor que cero.",
      "warning"
    );
    return;
  }

  if (
    grupos.some(
      (g) =>
        String(g.inscripcion_equipo_id) ===
        String(inscripcionId)
    )
  ) {
    mostrarAviso(
      "Este equipo ya fue asignado a un grupo.",
      "warning"
    );
    return;
  }

  if (
    grupos.some(
      (g) =>
        normalizarTexto(g.grupo) === grupo &&
        Number(g.sorteo_orden) === orden
    )
  ) {
    mostrarAviso(
      `El orden ${orden} ya está ocupado en el grupo ${grupo}.`,
      "warning"
    );
    return;
  }

  const boton = $("btnAsignar");

  if (boton) boton.disabled = true;

  try {
    const { error } = await supabase
      .from("grupo_equipo")
      .insert({
        competencia_id: Number(competencia),
        inscripcion_equipo_id: Number(inscripcionId),
        grupo,
        sorteo_orden: orden
      });

    if (error) throw error;

    if ($("ordenSorteo")) {
      $("ordenSorteo").value = "";
    }

    mostrarAviso(
      `¡Equipo asignado al grupo ${grupo}!`,
      "success"
    );

    await cargarEquipos();

    // Refresca la proyección si existe en esta ventana.
    if (esPantallaPublica) {
      await actualizarPantallaPublica();
    }

  } catch (error) {
    console.error("Error guardando asignación:", error);

    mostrarAviso(
      "No se pudo guardar la asignación: " +
      (error.message || String(error)),
      "danger"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      actualizarSelectorEquipos();
    }
  }
}

// =====================================================
// GENERACIÓN DEL CALENDARIO
// =====================================================

function generarEnfrentamientos() {
  const mapa = new Map();

  grupos.forEach((item) => {
    const letra = normalizarTexto(item.grupo);

    if (!["A", "B"].includes(letra)) return;

    if (!mapa.has(letra)) {
      mapa.set(letra, []);
    }

    mapa.get(letra).push(item);
  });

  const jornadasPorGrupo = [];

  for (const [letra, equiposOriginales] of mapa.entries()) {
    const equipos = [...equiposOriginales].sort(
      (a, b) =>
        Number(a.sorteo_orden) - Number(b.sorteo_orden)
    );

    if (equipos.length < 2) continue;

    const participantes = [...equipos];

    if (participantes.length % 2 !== 0) {
      participantes.push(null);
    }

    const total = participantes.length;
    const totalJornadas = total - 1;

    for (let jornada = 0; jornada < totalJornadas; jornada++) {
      const partidosJornada = [];

      for (let i = 0; i < total / 2; i++) {
        const primero = participantes[i];
        const segundo = participantes[total - 1 - i];

        if (!primero || !segundo) continue;

        const alternar = jornada % 2 === 1;

        const local = alternar ? segundo : primero;
        const visitante = alternar ? primero : segundo;

        partidosJornada.push({
          grupo: letra,
          jornada: jornada + 1,
          equipo_local_id: Number(local.inscripcion_equipo_id),
          equipo_visitante_id: Number(segundo === local
            ? primero.inscripcion_equipo_id
            : visitante.inscripcion_equipo_id)
        });
      }

      jornadasPorGrupo.push({
        grupo: letra,
        numero: jornada + 1,
        partidos: partidosJornada
      });

      const ultimo = participantes.pop();
      participantes.splice(1, 0, ultimo);
    }
  }

  const calendario = [];

  const maxJornada = Math.max(
    0,
    ...jornadasPorGrupo.map((j) => j.numero)
  );

  for (let n = 1; n <= maxJornada; n++) {
    jornadasPorGrupo
      .filter((j) => j.numero === n)
      .forEach((j) => calendario.push(...j.partidos));
  }

  return calendario;
}

async function obtenerFaseInicial(idCompetencia) {
  const { data, error } = await supabase
    .from("fase")
    .select("id, competencia_id, nombre, tipo, orden")
    .eq("competencia_id", Number(idCompetencia))
    .order("orden", { ascending: true });

  if (error) {
    throw new Error(
      "Error consultando fases: " + error.message
    );
  }

  if (data?.length) {
    return data[0];
  }

  const { data: nuevaFase, error: errorCrear } = await supabase
    .from("fase")
    .insert({
      competencia_id: Number(idCompetencia),
      nombre: "Primera fase",
      tipo: "GRUPOS",
      orden: 1
    })
    .select("id, competencia_id, nombre, tipo, orden")
    .single();

  if (errorCrear) {
    throw new Error(
      "No se pudo crear la fase inicial: " +
      errorCrear.message
    );
  }

  return nuevaFase;
}

function claveEnfrentamiento(localId, visitanteId) {
  return [
    Number(localId),
    Number(visitanteId)
  ].sort((a, b) => a - b).join("-");
}

async function generarCalendario() {
  const idCompetencia =
    $("competenciaPartidos")?.value ||
    $("competenciaSorteo")?.value ||
    competenciaId;

  if (!idCompetencia) {
    mostrarAviso("Selecciona una competencia.", "warning");
    return;
  }

  const boton = $("btnGenerarCalendario");

  if (boton) boton.disabled = true;

  try {
    sincronizarCompetencias(idCompetencia);

    mostrarAviso("Preparando calendario...", "info");

    await cargarEquipos();

    if (!grupos.length) {
      mostrarAviso(
        "Primero debes asignar los equipos a los grupos.",
        "warning"
      );
      return;
    }

    const calendario = generarEnfrentamientos();

    if (!calendario.length) {
      mostrarAviso(
        "No hay al menos dos equipos en un mismo grupo para generar partidos.",
        "warning"
      );
      return;
    }

    const fase = await obtenerFaseInicial(idCompetencia);

    const { data: existentes, error } = await supabase
      .from("partido")
      .select(`
        id,
        fase_id,
        equipo_local_id,
        equipo_visitante_id,
        observacion
      `)
      .eq("fase_id", fase.id);

    if (error) {
      throw new Error(
        "Error consultando partidos existentes: " +
        error.message
      );
    }

    // Incluye el grupo en la clave para que dos equipos
    // pertenecientes a grupos distintos no se confundan.
    const clave = (p) =>
      `${normalizarTexto(p.grupo || "")}|${claveEnfrentamiento(
        p.equipo_local_id,
        p.equipo_visitante_id
      )}`;

    const clavesExistentes = new Set(
      (existentes || []).map((p) => {
        const texto = String(p.observacion || "");
        const coincide = texto.match(/Grupo\s+([AB])/i);

        return `${normalizarTexto(coincide?.[1] || "")}|${claveEnfrentamiento(
          p.equipo_local_id,
          p.equipo_visitante_id
        )}`;
      })
    );

    const nuevos = calendario
      .filter((p) => !clavesExistentes.has(clave(p)))
      .map((p) => ({
        fase_id: Number(fase.id),
        equipo_local_id: p.equipo_local_id,
        equipo_visitante_id: p.equipo_visitante_id,
        estado: "PROGRAMADO",
        tipo_resultado: "NORMAL",
        tiempo_extra_jugado: false,
        observacion: `Grupo ${p.grupo} - Jornada ${p.jornada}`,
        creado_por: usuarioActual?.id || null
      }));

    if (!nuevos.length) {
      await cargarPartidos();

      mostrarAviso(
        "El calendario ya existe. No se agregaron duplicados.",
        "success"
      );

      return;
    }

    const { error: errorInsertar } = await supabase
      .from("partido")
      .insert(nuevos);

    if (errorInsertar) {
      throw new Error(
        "No se pudieron guardar los partidos: " +
        errorInsertar.message
      );
    }

    await cargarPartidos();

    mostrarAviso(
      `Se generaron ${nuevos.length} partidos nuevos.`,
      "success"
    );

  } catch (error) {
    console.error("Error generando calendario:", error);

    mostrarAviso(
      "Error al generar calendario: " +
      (error.message || String(error)),
      "danger"
    );
  } finally {
    if (boton) {
      boton.disabled = grupos.length < 2;
    }
  }
}

// =====================================================
// CONSULTAR PARTIDOS
// =====================================================

async function cargarPartidos() {
  const idCompetencia =
    $("competenciaPartidos")?.value ||
    competenciaId;

  if (!idCompetencia) {
    partidosActuales = [];
    renderizarPartidos();
    actualizarEstadisticas();

    mostrarAviso(
      "Selecciona una competencia.",
      "warning"
    );

    return;
  }

  sincronizarCompetencias(idCompetencia);

  try {
    mostrarAviso("Consultando calendario...", "info");

    const { data: fases, error: errorFases } = await supabase
      .from("fase")
      .select("id, nombre, orden")
      .eq("competencia_id", Number(idCompetencia))
      .order("orden", { ascending: true });

    if (errorFases) throw errorFases;

    const idsFases = (fases || []).map((f) => f.id);

    if (!idsFases.length) {
      partidosActuales = [];

      renderizarPartidos();
      actualizarEstadisticas();

      mostrarAviso(
        "Esta competencia todavía no tiene fases ni partidos.",
        "info"
      );

      return;
    }

    const { data, error } = await supabase
      .from("partido")
      .select(`
        id,
        fase_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha,
        hora,
        cancha,
        estado,
        observacion,
        fase:fase_id(nombre, orden)
      `)
      .in("fase_id", idsFases)
      .order("fecha", {
        ascending: true,
        nullsFirst: true
      })
      .order("hora", {
        ascending: true,
        nullsFirst: true
      });

    if (error) throw error;

    const idsInscripciones = [
      ...new Set(
        (data || []).flatMap((p) => [
          p.equipo_local_id,
          p.equipo_visitante_id
        ]).filter((id) => id != null)
      )
    ];

    let inscripciones = [];

    if (idsInscripciones.length) {
      const resultado = await supabase
        .from("inscripcion_equipo")
        .select("id, equipo:equipo_id(nombre)")
        .in("id", idsInscripciones);

      if (resultado.error) throw resultado.error;

      inscripciones = resultado.data || [];
    }

    const nombres = new Map(
      inscripciones.map((i) => [
        String(i.id),
        i.equipo?.nombre || `Inscripción ${i.id}`
      ])
    );

    partidosActuales = (data || []).map((p) => ({
      ...p,
      local_nombre:
        nombres.get(String(p.equipo_local_id)) ||
        `Inscripción ${p.equipo_local_id}`,
      visitante_nombre:
        nombres.get(String(p.equipo_visitante_id)) ||
        `Inscripción ${p.equipo_visitante_id}`
    }));

    renderizarPartidos();
    actualizarEstadisticas();

    mostrarAviso(
      `Se encontraron ${partidosActuales.length} partidos.`,
      "success"
    );

  } catch (error) {
    console.error("Error cargando partidos:", error);

    mostrarAviso(
      "No se pudo cargar el calendario: " +
      (error.message || String(error)),
      "danger"
    );
  }
}

// =====================================================
// TABLA DEL CALENDARIO
// =====================================================

function renderizarPartidos() {
  const tbody = $("tablaPartidos");

  if (!tbody) return;

  if (!partidosActuales.length) {
    tbody.innerHTML =
      '<tr><td colspan="8">No hay partidos registrados para esta competencia.</td></tr>';

    return;
  }

  tbody.innerHTML = partidosActuales.map((p) => {
    const estados = [
      "PROGRAMADO",
      "EN_CURSO",
      "FINALIZADO",
      "SUSPENDIDO",
      "APLAZADO"
    ];

    const estadoActual = normalizarTexto(p.estado);

    if (estadoActual && !estados.includes(estadoActual)) {
      estados.push(estadoActual);
    }

    return `
      <tr>
        <td>
          ${escapar(p.fase?.nombre || "Primera fase")}
          <br>
          <small>${escapar(p.observacion || "")}</small>
        </td>

        <td>${escapar(p.local_nombre)}</td>
        <td>${escapar(p.visitante_nombre)}</td>

        <td>
          <input
            type="date"
            id="fecha-${p.id}"
            value="${escapar(p.fecha || "")}"
          >
        </td>

        <td>
          <input
            type="time"
            id="hora-${p.id}"
            value="${escapar(String(p.hora || "").slice(0, 5))}"
          >
        </td>

        <td>
          <input
            type="text"
            id="cancha-${p.id}"
            maxlength="150"
            value="${escapar(p.cancha || "")}"
            placeholder="Cancha"
          >
        </td>

        <td>
          <select id="estado-${p.id}">
            ${estados.map((estado) => `
              <option
                value="${escapar(estado)}"
                ${estadoActual === estado ? "selected" : ""}
              >
                ${escapar(nombreEstado(estado))}
              </option>
            `).join("")}
          </select>
        </td>

        <td>
          <button
            type="button"
            class="btn btn-verde"
            data-guardar-partido="${p.id}"
          >
            Guardar
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-guardar-partido]").forEach((boton) => {
    boton.addEventListener("click", () => {
      guardarProgramacion(
        Number(boton.dataset.guardarPartido),
        boton
      );
    });
  });
}

async function guardarProgramacion(idPartido, boton) {
  const fecha = $(`fecha-${idPartido}`)?.value || null;
  const hora = $(`hora-${idPartido}`)?.value || null;
  const cancha =
    $(`cancha-${idPartido}`)?.value.trim() || null;
  const estado = $(`estado-${idPartido}`)?.value;

  if (!estado) {
    mostrarAviso(
      "Selecciona un estado válido.",
      "warning"
    );

    return;
  }

  if (boton) boton.disabled = true;

  try {
    const { error } = await supabase
      .from("partido")
      .update({
        fecha,
        hora,
        cancha,
        estado
      })
      .eq("id", idPartido);

    if (error) throw error;

    mostrarAviso(
      "La programación del partido se actualizó correctamente.",
      "success"
    );

    await cargarPartidos();

  } catch (error) {
    console.error("Error guardando programación:", error);

    mostrarAviso(
      "No se pudo actualizar el partido: " +
      (error.message || String(error)),
      "danger"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

// =====================================================
// ESTADÍSTICAS DEL DASHBOARD
// =====================================================

function actualizarEstadisticas() {
  const habilitados = equiposInscritos.length;
  const sorteados = grupos.length;

  const programados = partidosActuales.filter((p) =>
    normalizarTexto(p.estado) === "PROGRAMADO"
  ).length;

  const finalizados = partidosActuales.filter((p) =>
    normalizarTexto(p.estado) === "FINALIZADO"
  ).length;

  // Indicadores principales.
  if ($("statEquipos")) {
    $("statEquipos").textContent = habilitados;
  }

  if ($("statSorteados")) {
    $("statSorteados").textContent = sorteados;
  }

  if ($("statProgramados")) {
    $("statProgramados").textContent = programados;
  }

  if ($("statFinalizados")) {
    $("statFinalizados").textContent = finalizados;
  }

  // Indicadores adicionales, si existen en el HTML.
  if ($("statEquiposPartidos")) {
    $("statEquiposPartidos").textContent = habilitados;
  }

  if ($("statSorteadosPartidos")) {
    $("statSorteadosPartidos").textContent = sorteados;
  }

  if ($("statProgramadosPartidos")) {
    $("statProgramadosPartidos").textContent = programados;
  }

  if ($("statFinalizadosPartidos")) {
    $("statFinalizadosPartidos").textContent = finalizados;
  }

  console.log("📊 Estadísticas actualizadas:", {
    competenciaId,
    equiposHabilitados: habilitados,
    equiposSorteados: sorteados,
    partidosProgramados: programados,
    partidosFinalizados: finalizados
  });
}

// =====================================================
// EVENTOS
// =====================================================

function conectarEventos() {
  conectarNavegacion();

  $("btnCargarSorteo")?.addEventListener(
    "click",
    cargarEquipos
  );

  $("btnActualizarGrupos")?.addEventListener(
    "click",
    cargarEquipos
  );

  $("btnAsignar")?.addEventListener(
    "click",
    asignarEquipo
  );

  $("btnConsultarGrupos")?.addEventListener(
    "click",
    async () => {
      const valor = $("competenciaGrupos")?.value;

      if (!valor) {
        mostrarAviso(
          "Selecciona una competencia.",
          "warning"
        );
        return;
      }

      sincronizarCompetencias(valor);
      await cargarEquipos();
    }
  );

  $("btnGenerarCalendario")?.addEventListener(
    "click",
    generarCalendario
  );

  $("btnCargarPartidos")?.addEventListener(
    "click",
    cargarPartidos
  );

  [
    "competenciaInicio",
    "competenciaSorteo",
    "competenciaGrupos",
    "competenciaPartidos"
  ].forEach((id) => {
    $(id)?.addEventListener("change", async (evento) => {
      const valor = evento.target.value;

      if (!valor) {
        competenciaId = "";
        equiposInscritos = [];
        grupos = [];
        partidosActuales = [];

        renderizarGrupo("A", []);
        renderizarGrupo("B", []);
        renderizarPartidos();
        actualizarEstadisticas();

        return;
      }

      sincronizarCompetencias(valor);

      await cargarEquipos();

      if (id === "competenciaPartidos") {
        await cargarPartidos();
      }
    });
  });
}

// =====================================================
// PANTALLA PÚBLICA DEL SORTEO
// =====================================================

function mostrarListaPublica(id, lista, letra) {
  const destino = $(id);

  if (!destino) return;

  const equipos = lista
    .filter((g) => normalizarTexto(g.grupo) === letra)
    .sort(
      (a, b) =>
        Number(a.sorteo_orden) - Number(b.sorteo_orden)
    );

  destino.innerHTML = equipos.length
    ? equipos.map((g, i) => `
        <div class="proy-item">
          <span class="proy-num">
            ${escapar(g.sorteo_orden || i + 1)}.
          </span>

          <span>${escapar(g.nombreEquipo)}</span>
        </div>
      `).join("")
    : '<div class="proy-item">Sin equipos todavía.</div>';
}

async function actualizarPantallaPublica() {
  const params = new URLSearchParams(window.location.search);
  const idCompetencia = params.get("competencia");

  if (!idCompetencia) {
    if ($("proyCompetencia")) {
      $("proyCompetencia").textContent =
        "Falta seleccionar una competencia.";
    }

    return;
  }

  try {
    const { data: competencia, error: errorCompetencia } =
      await supabase
        .from("competencia")
        .select(`
          id,
          nombre,
          disciplina:disciplina_id(nombre),
          categoria:categoria_id(nombre)
        `)
        .eq("id", Number(idCompetencia))
        .maybeSingle();

    if (errorCompetencia) throw errorCompetencia;

    if (!competencia) {
      if ($("proyActualizado")) {
        $("proyActualizado").textContent =
          "No se encontró la competencia.";
      }

      return;
    }

    if ($("proyCompetencia")) {
      $("proyCompetencia").textContent = [
        competencia.nombre,
        competencia.disciplina?.nombre,
        competencia.categoria?.nombre
      ].filter(Boolean).join(" · ");
    }

    const { data: asignaciones, error } = await supabase
      .from("grupo_equipo")
      .select(`
        id,
        competencia_id,
        inscripcion_equipo_id,
        grupo,
        sorteo_orden
      `)
      .eq("competencia_id", Number(idCompetencia))
      .order("id", { ascending: true });

    if (error) throw error;

    const ids = [
      ...new Set(
        (asignaciones || []).map((g) => g.inscripcion_equipo_id)
      )
    ];

    let inscripciones = [];

    if (ids.length) {
      const resultado = await supabase
        .from("inscripcion_equipo")
        .select("id, equipo:equipo_id(id, nombre, logo)")
        .in("id", ids);

      if (resultado.error) throw resultado.error;

      inscripciones = resultado.data || [];
    }

    const mapa = new Map(
      inscripciones.map((i) => [
        String(i.id),
        {
          nombre: i.equipo?.nombre || `Inscripción ${i.id}`,
          logo: i.equipo?.logo || ""
        }
      ])
    );

    const lista = (asignaciones || []).map((g) => ({
      ...g,
      nombreEquipo:
        mapa.get(String(g.inscripcion_equipo_id))?.nombre ||
        `Inscripción ${g.inscripcion_equipo_id}`,
      logoEquipo:
        mapa.get(String(g.inscripcion_equipo_id))?.logo || ""
    }));

    mostrarListaPublica("proyListaA", lista, "A");
    mostrarListaPublica("proyListaB", lista, "B");

    // Orden real de la última asignación guardada.
    const ultimo = [...lista].sort(
      (a, b) => Number(b.id) - Number(a.id)
    )[0] || null;

    const claveUltimo = ultimo ? String(ultimo.id) : "";

    if (ultimo && claveUltimo !== ultimaAsignacionMostrada) {
      ultimaAsignacionMostrada = claveUltimo;

      const contenedor = $("proyEquipo");

      if (contenedor) {
        const logoEsUrl =
          /^https?:\/\//i.test(ultimo.logoEquipo || "");

        contenedor.innerHTML = `
          <div class="proy-kicker">
            ✦ EQUIPO ASIGNADO ✦
          </div>

          ${logoEsUrl
            ? `<img
                class="proy-escudo"
                src="${escapar(ultimo.logoEquipo)}"
                alt="Escudo de ${escapar(ultimo.nombreEquipo)}"
              >`
            : ""}

          <h2 class="proy-nombre">
            ${escapar(ultimo.nombreEquipo)}
          </h2>

          <div class="proy-subtitulo">
            Ha sido asignado oficialmente a
          </div>

          <div class="proy-grupo">
            GRUPO ${escapar(normalizarTexto(ultimo.grupo))}
          </div>

          <div class="proy-orden">
            ORDEN DE SORTEO: ${escapar(ultimo.sorteo_orden)}
          </div>
        `;

        contenedor.classList.remove("animar");
        void contenedor.offsetWidth;
        contenedor.classList.add("animar");
      }
    } else if (!ultimo && !ultimaAsignacionMostrada) {
      if ($("proyEquipo")) {
        $("proyEquipo").innerHTML = `
          <div class="proy-kicker">
            EL SORTEO ESTÁ POR COMENZAR
          </div>

          <div class="proy-sin-equipo" style="margin-top:20px">
            El primer equipo aparecerá aquí cuando el administrador
            guarde la primera asignación.
          </div>
        `;
      }
    }

    if ($("proyActualizado")) {
      $("proyActualizado").textContent =
        `Actualizado: ${new Date().toLocaleTimeString("es-EC")}`;
    }

  } catch (error) {
    console.error("Error actualizando proyección:", error);

    if ($("proyActualizado")) {
      $("proyActualizado").textContent =
        "Error actualizando la pantalla: " +
        (error.message || String(error));
    }
  }
}

function iniciarPantallaPublica() {
  document.body.classList.add("modo-proyeccion");

  $("btnPantallaCompleta")?.addEventListener(
    "click",
    async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.error(
          "No se pudo activar pantalla completa:",
          error
        );

        if ($("proyActualizado")) {
          $("proyActualizado").textContent =
            "No se pudo activar pantalla completa. Usa F11.";
        }
      }
    }
  );

  $("btnCerrarPantalla")?.addEventListener("click", () => {
    if (temporizadorPantalla) {
      clearInterval(temporizadorPantalla);
      temporizadorPantalla = null;
    }

    window.close();

    if ($("proyActualizado")) {
      $("proyActualizado").textContent =
        "Puedes cerrar esta pestaña desde el navegador.";
    }
  });

  actualizarPantallaPublica();

  temporizadorPantalla = setInterval(
    actualizarPantallaPublica,
    4000
  );
}

// =====================================================
// INICIO DEL MÓDULO
// =====================================================

async function iniciar() {
  try {
    if (esPantallaPublica) {
      iniciarPantallaPublica();
      return;
    }

    conectarEventos();

    if (!(await verificarSesion())) return;

    await cargarCompetencias();

  } catch (error) {
    console.error("Error iniciando el módulo:", error);

    mostrarAviso(
      "Error al iniciar: " +
      (error?.message || String(error)),
      "danger"
    );
  }
}

iniciar();
