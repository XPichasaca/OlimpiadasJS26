
import { supabase } from "./supabase.js";

/* =========================================================
   OLIMPIADAS JUAN SOLANO 2026
   Gestión de nóminas, marcador y eventos de fútbol
   ========================================================= */

const $ = (id) => document.getElementById(id);

const estado = {
  partidos: [],
  partido: null,
  fases: new Map(),
  competencias: new Map(),
  categorias: new Map(),
  equipos: new Map(),
  inscripciones: [],
  jugadores: new Map(),
  jugadoresLocal: [],
  jugadoresVisitante: [],
  inscripcionLocal: null,
  inscripcionVisitante: null,
  nominaLocal: new Map(),
  nominaVisitante: new Map(),
  eventos: [],
  canal: null,
  cargando: false
};

const MAX_CONVOCADOS = 22;
const MAX_TITULARES = 11;

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function mostrarMensaje(texto, tipo = "info") {
  const elemento = $("mensaje");
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `mensaje ${tipo}`;

  if (texto) {
    elemento.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function limpiarMensaje() {
  const elemento = $("mensaje");
  if (elemento) {
    elemento.textContent = "";
    elemento.className = "mensaje";
  }
}

function nombreDeEquipo(equipo) {
  if (!equipo) return "Equipo sin nombre";

  return (
    equipo.nombre_equipo ||
    equipo.nombre ||
    equipo.denominacion ||
    equipo.nombre_completo ||
    equipo.descripcion ||
    `Equipo ${equipo.id}`
  );
}

function nombreDeJugador(jugador) {
  if (!jugador) return "Jugador sin nombre";

  const nombreCompleto = [
    jugador.nombres,
    jugador.apellidos
  ].filter(Boolean).join(" ").trim();

  return (
    nombreCompleto ||
    jugador.nombre_completo ||
    jugador.nombre ||
    jugador.apellidos ||
    `Jugador ${jugador.id}`
  );
}

function fechaLegible(fecha) {
  if (!fecha) return "Fecha pendiente";

  const fechaSolo = String(fecha).slice(0, 10);
  const partes = fechaSolo.split("-");

  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return fechaSolo;
}

function horaLegible(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function obtenerError(error, contexto) {
  console.error(contexto, error);
  return error?.message || error?.details || contexto;
}

async function consultarTabla(tabla) {
  const { data, error } = await supabase
    .from(tabla)
    .select("*");

  if (error) throw error;
  return data || [];
}

async function consultarPorIds(tabla, columna, ids) {
  const valores = [...new Set(
    (ids || [])
      .filter((id) => id !== null && id !== undefined)
      .map(String)
  )];

  if (!valores.length) return [];

  const { data, error } = await supabase
    .from(tabla)
    .select("*")
    .in(columna, valores);

  if (error) throw error;
  return data || [];
}

function obtenerFase(partido) {
  return estado.fases.get(String(partido?.fase_id)) || null;
}

function obtenerCompetencia(partido) {
  const fase = obtenerFase(partido);
  return estado.competencias.get(String(fase?.competencia_id)) || null;
}

function obtenerCategoria(partido) {
  const competencia = obtenerCompetencia(partido);
  if (!competencia) return "Sin categoría";

  const categoria = estado.categorias.get(
    String(competencia.categoria_id)
  );

  return (
    categoria?.nombre ||
    categoria?.nombre_categoria ||
    categoria?.descripcion ||
    competencia.nombre ||
    "Sin categoría"
  );
}

function buscarEquipo(id) {
  return estado.equipos.get(String(id)) || null;
}

function buscarInscripcionPorId(id) {
  return estado.inscripciones.find(
    (inscripcion) => String(inscripcion.id) === String(id)
  ) || null;
}

/*
 * Los campos equipo_local_id y equipo_visitante_id pueden referirse
 * a equipo.id o, según cómo se generó el sorteo, a
 * inscripcion_equipo.id. Se contemplan ambas posibilidades.
 */
function resolverEquipoYInscripcion(idPartido, partido) {
  const competencia = obtenerCompetencia(partido);
  const competenciaId = competencia?.id;

  const inscripcionDirecta = buscarInscripcionPorId(idPartido);

  if (
    inscripcionDirecta &&
    (
      competenciaId == null ||
      String(inscripcionDirecta.competencia_id) === String(competenciaId)
    )
  ) {
    const equipoInscrito = buscarEquipo(inscripcionDirecta.equipo_id);

    return {
      equipo: equipoInscrito,
      inscripcion: inscripcionDirecta
    };
  }

  const equipo = buscarEquipo(idPartido);

  let inscripcion = estado.inscripciones.find((item) => {
    if (String(item.equipo_id) !== String(idPartido)) return false;

    return (
      competenciaId == null ||
      String(item.competencia_id) === String(competenciaId)
    );
  });

  if (!inscripcion && equipo) {
    inscripcion = estado.inscripciones.find((item) => {
      if (String(item.equipo_id) !== String(equipo.id)) return false;

      return (
        competenciaId == null ||
        String(item.competencia_id) === String(competenciaId)
      );
    });
  }

  return { equipo, inscripcion: inscripcion || null };
}

function obtenerJugadorDesdeInscripcion(inscripcionJugador) {
  const id = inscripcionJugador?.jugador_id;
  return estado.jugadores.get(String(id)) || null;
}

function jugadorHabilitado(inscripcionJugador) {
  const estadoJugador = String(inscripcionJugador?.estado || "")
    .trim()
    .toUpperCase();

  return [
    "HABILITADO",
    "APROBADO",
    "APROBADA",
    "ACTIVO",
    "CONFIRMADO"
  ].includes(estadoJugador);
}

function obtenerIdJugadorNomina(registro) {
  return String(registro.inscripcion_jugador_id);
}

function nombreEstadoPartido(estadoPartido) {
  const valor = String(estadoPartido || "").toUpperCase();

  const nombres = {
    PROGRAMADO: "Programado",
    EN_VIVO: "En vivo",
    FINALIZADO: "Finalizado",
    SUSPENDIDO: "Suspendido",
    APLAZADO: "Aplazado"
  };

  return nombres[valor] || estadoPartido || "Sin estado";
}

function obtenerTextoPartido(partido) {
  if (!partido) return "Seleccione un partido";

  const local = resolverEquipoYInscripcion(
    partido.equipo_local_id,
    partido
  );

  const visitante = resolverEquipoYInscripcion(
    partido.equipo_visitante_id,
    partido
  );

  return [
    `${nombreDeEquipo(local.equipo)} vs ${nombreDeEquipo(visitante.equipo)}`,
    obtenerCategoria(partido),
    fechaLegible(partido.fecha),
    horaLegible(partido.hora)
  ].filter(Boolean).join(" · ");
}

/* =========================================================
   CARGA INICIAL
   ========================================================= */

async function cargarDatosBase() {
  mostrarMensaje("⏳ Cargando partidos y equipos...", "info");

  const [partidos, fases, competencias, equipos, inscripciones] =
    await Promise.all([
      consultarTabla("partido"),
      consultarTabla("fase"),
      consultarTabla("competencia"),
      consultarTabla("equipo"),
      consultarTabla("inscripcion_equipo")
    ]);

  estado.fases = new Map(
    fases.map((fila) => [String(fila.id), fila])
  );

  estado.competencias = new Map(
    competencias.map((fila) => [String(fila.id), fila])
  );

  estado.equipos = new Map(
    equipos.map((fila) => [String(fila.id), fila])
  );

  estado.inscripciones = inscripciones;

  estado.partidos = partidos.map((partido) => ({
    ...partido,
    categoriaTexto: obtenerCategoriaConDatos(partido),
    texto: obtenerTextoConDatos(partido)
  }));

  /*
   * La tabla categoria se consulta por separado para evitar
   * depender de una relación automática de Supabase.
   */
  try {
    const categorias = await consultarTabla("categoria");

    estado.categorias = new Map(
      categorias.map((fila) => [String(fila.id), fila])
    );
  } catch (error) {
    console.warn(
      "No se pudo consultar la tabla categoria. Se usarán los nombres de competencia.",
      error
    );
    estado.categorias = new Map();
  }

  estado.partidos = partidos.map((partido) => ({
    ...partido,
    categoriaTexto: obtenerCategoria(partido),
    texto: obtenerTextoPartido(partido)
  }));

  llenarFiltroCategorias();
  llenarSelectorPartidos();
}

function obtenerCategoriaConDatos(partido) {
  const fase = estado.fases.get(String(partido.fase_id));
  const competencia = estado.competencias.get(
    String(fase?.competencia_id)
  );

  return competencia?.nombre || "Sin categoría";
}

function obtenerTextoConDatos(partido) {
  const local = resolverEquipoYInscripcion(
    partido.equipo_local_id,
    partido
  );

  const visitante = resolverEquipoYInscripcion(
    partido.equipo_visitante_id,
    partido
  );

  return `${nombreDeEquipo(local.equipo)} vs ${nombreDeEquipo(visitante.equipo)}`;
}

function llenarFiltroCategorias() {
  const selector = $("filtroGenero");
  if (!selector) return;

  const seleccionAnterior = selector.value;

  const categorias = [
    ...new Set(
      estado.partidos
        .map((partido) => obtenerCategoria(partido))
        .filter((nombre) => nombre && nombre !== "Sin categoría")
    )
  ].sort((a, b) => a.localeCompare(b, "es"));

  selector.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categorias.map((categoria) =>
      `<option value="${escapar(categoria)}">${escapar(categoria)}</option>`
    ).join("");

  if (categorias.includes(seleccionAnterior)) {
    selector.value = seleccionAnterior;
  }
}

function partidoPasaFiltros(partido) {
  const desde = $("fechaDesde")?.value || "";
  const hasta = $("fechaHasta")?.value || "";
  const categoriaSeleccionada = $("filtroGenero")?.value || "";

  const fecha = String(partido.fecha || "").slice(0, 10);

  if (desde && (!fecha || fecha < desde)) return false;
  if (hasta && (!fecha || fecha > hasta)) return false;

  if (
    categoriaSeleccionada &&
    obtenerCategoria(partido) !== categoriaSeleccionada
  ) {
    return false;
  }

  return true;
}

function llenarSelectorPartidos() {
  const selector = $("filtroPartido");
  if (!selector) return;

  const seleccionAnterior = selector.value;

  const partidosFiltrados = estado.partidos
    .filter(partidoPasaFiltros)
    .sort((a, b) => {
      const fechaA = `${a.fecha || ""} ${a.hora || ""}`;
      const fechaB = `${b.fecha || ""} ${b.hora || ""}`;
      return fechaA.localeCompare(fechaB);
    });

  selector.innerHTML = "";

  if (!partidosFiltrados.length) {
    selector.innerHTML =
      '<option value="">No hay partidos con esos filtros</option>';

    estado.partido = null;
    mostrarMensaje(
      "No se encontraron partidos para las fechas y categoría seleccionadas.",
      "info"
    );
    limpiarPaneles();
    return;
  }

  selector.innerHTML = partidosFiltrados.map((partido) => {
    const local = resolverEquipoYInscripcion(
      partido.equipo_local_id,
      partido
    );

    const visitante = resolverEquipoYInscripcion(
      partido.equipo_visitante_id,
      partido
    );

    const etiqueta = [
      `${nombreDeEquipo(local.equipo)} vs ${nombreDeEquipo(visitante.equipo)}`,
      obtenerCategoria(partido),
      fechaLegible(partido.fecha),
      horaLegible(partido.hora)
    ].filter(Boolean).join(" · ");

    return `<option value="${escapar(partido.id)}">${escapar(etiqueta)}</option>`;
  }).join("");

  const conservaSeleccion = partidosFiltrados.some(
    (partido) => String(partido.id) === seleccionAnterior
  );

  selector.value = conservaSeleccion
    ? seleccionAnterior
    : String(partidosFiltrados[0].id);

  const seleccionado = partidosFiltrados.find(
    (partido) => String(partido.id) === selector.value
  );

  if (seleccionado) {
    seleccionarPartido(seleccionado.id);
  }
}

/* =========================================================
   SELECCIÓN Y JUGADORES
   ========================================================= */

async function seleccionarPartido(id) {
  const partido = estado.partidos.find(
    (fila) => String(fila.id) === String(id)
  );

  if (!partido) {
    estado.partido = null;
    limpiarPaneles();
    return;
  }

  estado.partido = partido;
  estado.inscripcionLocal = null;
  estado.inscripcionVisitante = null;
  estado.jugadoresLocal = [];
  estado.jugadoresVisitante = [];
  estado.nominaLocal.clear();
  estado.nominaVisitante.clear();

  mostrarMensaje("⏳ Cargando nóminas del partido...", "info");

  try {
    const local = resolverEquipoYInscripcion(
      partido.equipo_local_id,
      partido
    );

    const visitante = resolverEquipoYInscripcion(
      partido.equipo_visitante_id,
      partido
    );

    estado.inscripcionLocal = local.inscripcion;
    estado.inscripcionVisitante = visitante.inscripcion;

    actualizarEncabezados(local.equipo, visitante.equipo);
    mostrarDatosPartido();

    if (!local.inscripcion || !visitante.inscripcion) {
      const faltan = [];

      if (!local.inscripcion) {
        faltan.push(`local: ${nombreDeEquipo(local.equipo)}`);
      }

      if (!visitante.inscripcion) {
        faltan.push(`visitante: ${nombreDeEquipo(visitante.equipo)}`);
      }

      await cargarMarcador();
      await cargarEventos();
      actualizarEstadisticas();

      mostrarMensaje(
        "No se encontró la inscripción de " + faltan.join(" y ") +
        " para la competencia de este partido. Verifique que los equipos " +
        "estén inscritos en la misma competencia que la fase del partido.",
        "error"
      );

      pintarJugadores("local");
      pintarJugadores("visitante");
      return;
    }

    const [jugadores, nominas] = await Promise.all([
      cargarJugadoresDeInscripciones([
        estado.inscripcionLocal.id,
        estado.inscripcionVisitante.id
      ]),
      consultarPorIds("nomina_partido", "partido_id", [partido.id])
    ]);

    const inscripcionIds = new Set([
      String(estado.inscripcionLocal.id),
      String(estado.inscripcionVisitante.id)
    ]);

    const jugadoresPartido = jugadores.filter((fila) =>
      inscripcionIds.has(String(fila.inscripcion_equipo_id))
    );

    estado.jugadoresLocal = jugadoresPartido.filter(
      (fila) =>
        String(fila.inscripcion_equipo_id) ===
        String(estado.inscripcionLocal.id)
    );

    estado.jugadoresVisitante = jugadoresPartido.filter(
      (fila) =>
        String(fila.inscripcion_equipo_id) ===
        String(estado.inscripcionVisitante.id)
    );

    estado.nominaLocal.clear();
    estado.nominaVisitante.clear();

    for (const registro of nominas) {
      const idJugador = String(registro.inscripcion_jugador_id);

      const localEs = estado.jugadoresLocal.some(
        (jugador) => String(jugador.id) === idJugador
      );

      const visitanteEs = estado.jugadoresVisitante.some(
        (jugador) => String(jugador.id) === idJugador
      );

      const datos = {
        convocado: true,
        titular: Boolean(registro.titular)
      };

      if (localEs) estado.nominaLocal.set(idJugador, datos);
      if (visitanteEs) estado.nominaVisitante.set(idJugador, datos);
    }

    pintarJugadores("local");
    pintarJugadores("visitante");

    await cargarMarcador();
    await cargarEventos();
    actualizarEstadisticas();

    if (!estado.jugadoresLocal.length || !estado.jugadoresVisitante.length) {
      mostrarMensaje(
        "Partido cargado. Una o ambas inscripciones no tienen jugadores registrados. Revise inscripcion_jugador.inscripcion_equipo_id y el estado HABILITADO.",
        "info"
      );
    } else {
      mostrarMensaje("✅ Partido y nóminas cargados correctamente.", "ok");
    }
  } catch (error) {
    mostrarMensaje(
      "Error al cargar el partido: " + obtenerError(error, "seleccionarPartido"),
      "error"
    );
  }
}

async function cargarJugadoresDeInscripciones(ids) {
  const inscripcionIds = [...new Set(ids.map(String))];

  if (!inscripcionIds.length) return [];

  const [inscripcionesJugadores, jugadores] = await Promise.all([
    consultarPorIds(
      "inscripcion_jugador",
      "inscripcion_equipo_id",
      inscripcionIds
    ),
    consultarTabla("jugador")
  ]);

  estado.jugadores = new Map(
    jugadores.map((fila) => [String(fila.id), fila])
  );

  return inscripcionesJugadores
    .filter(jugadorHabilitado)
    .map((fila) => ({
      ...fila,
      jugador: obtenerJugadorDesdeInscripcion(fila)
    }))
    .sort((a, b) => {
      const numeroA = Number(a.numero || 999);
      const numeroB = Number(b.numero || 999);

      if (numeroA !== numeroB) return numeroA - numeroB;

      return nombreDeJugador(a.jugador).localeCompare(
        nombreDeJugador(b.jugador),
        "es"
      );
    });
}

function actualizarEncabezados(local, visitante) {
  if ($("nombreEquipoLocal")) {
    $("nombreEquipoLocal").textContent = nombreDeEquipo(local);
  }

  if ($("nombreEquipoVisitante")) {
    $("nombreEquipoVisitante").textContent = nombreDeEquipo(visitante);
  }

  if ($("labelGolesLocal")) {
    $("labelGolesLocal").textContent = nombreDeEquipo(local);
  }

  if ($("labelGolesVisitante")) {
    $("labelGolesVisitante").textContent = nombreDeEquipo(visitante);
  }
}

function mostrarDatosPartido() {
  const partido = estado.partido;
  if (!partido) return;

  const local = resolverEquipoYInscripcion(
    partido.equipo_local_id,
    partido
  );

  const visitante = resolverEquipoYInscripcion(
    partido.equipo_visitante_id,
    partido
  );

  const contenido = `
    <strong>⚽ ${escapar(nombreDeEquipo(local.equipo))}</strong>
    <span> vs </span>
    <strong>${escapar(nombreDeEquipo(visitante.equipo))}</strong>
    <br>
    <span>🏷️ ${escapar(obtenerCategoria(partido))}</span>
    <span> · 📅 ${escapar(fechaLegible(partido.fecha))}</span>
    <span> · ⏰ ${escapar(horaLegible(partido.hora) || "Hora pendiente")}</span>
    <br>
    <span>📌 ${escapar(nombreEstadoPartido(partido.estado))}</span>
    <span> · ID del partido: ${escapar(partido.id)}</span>
  `;

  if ($("partidoNomina")) $("partidoNomina").innerHTML = contenido;
  if ($("partidoGestion")) $("partidoGestion").innerHTML = contenido;
  if ($("partidoResumen")) $("partidoResumen").innerHTML = contenido;
}

function limpiarPaneles() {
  for (const id of [
    "jugadoresNomina",
    "jugadoresVisitante",
    "listaEventos",
    "resumenEventos"
  ]) {
    if ($(id)) {
      $(id).innerHTML = '<div class="vacio">Seleccione un partido.</div>';
    }
  }

  if ($("partidoNomina")) $("partidoNomina").textContent = "Seleccione un partido.";
  if ($("partidoGestion")) $("partidoGestion").textContent = "Seleccione un partido.";
  if ($("partidoResumen")) $("partidoResumen").textContent = "Seleccione un partido.";

  actualizarEstadisticas();
}

/* =========================================================
   PINTAR Y FILTRAR JUGADORES
   ========================================================= */

function pintarJugadores(lado) {
  const esLocal = lado === "local";
  const jugadores = esLocal
    ? estado.jugadoresLocal
    : estado.jugadoresVisitante;

  const nomina = esLocal
    ? estado.nominaLocal
    : estado.nominaVisitante;

  const contenedor = $(esLocal ? "jugadoresNomina" : "jugadoresVisitante");
  const contador = $(esLocal ? "contadorNomina" : "contadorVisitante");

  if (!contenedor) return;

  const busqueda = (
    $(esLocal ? "buscarJugador" : "buscarJugadorVisitante")?.value || ""
  ).toLocaleLowerCase("es").trim();

  const filtro = $(
    esLocal ? "filtroEquipoNomina" : "filtroEquipoVisitante"
  )?.value || "todos";

  const filtrados = jugadores.filter((fila) => {
    const registro = nomina.get(String(fila.id)) || {
      convocado: false,
      titular: false
    };

    const nombre = nombreDeJugador(fila.jugador).toLocaleLowerCase("es");
    const numero = String(fila.numero || "");

    if (busqueda && !nombre.includes(busqueda) && !numero.includes(busqueda)) {
      return false;
    }

    if (filtro === "titulares" && !(registro.convocado && registro.titular)) {
      return false;
    }

    if (filtro === "suplentes" && !(registro.convocado && !registro.titular)) {
      return false;
    }

    return true;
  });

  if (contador) {
    const convocados = jugadores.filter((fila) =>
      nomina.get(String(fila.id))?.convocado
    ).length;

    contador.textContent =
      `${convocados} convocados · ${jugadores.length} habilitados`;
  }

  if (!filtrados.length) {
    contenedor.innerHTML = `
      <div class="vacio">
        ${jugadores.length
          ? "No hay jugadores que coincidan con la búsqueda."
          : "No se encontraron jugadores habilitados para esta inscripción."}
      </div>
    `;
    return;
  }

  contenedor.innerHTML = filtrados.map((fila) => {
    const id = String(fila.id);
    const registro = nomina.get(id) || {
      convocado: false,
      titular: false
    };

    const nombre = nombreDeJugador(fila.jugador);
    const numero = fila.numero ?? "—";
    const posicion = fila.posicion || "Sin posición";

    return `
      <article class="jugador">
        <div class="jugador-principal">
          <input
            type="checkbox"
            class="check-convocado"
            data-lado="${lado}"
            data-id="${escapar(id)}"
            aria-label="Convocar a ${escapar(nombre)}"
            ${registro.convocado ? "checked" : ""}
          >

          <div class="jugador-nombre">
            ${escapar(nombre)}
            <div class="jugador-detalle">
              Camiseta: ${escapar(numero)} · ${escapar(posicion)}
            </div>
          </div>

          <span class="estado-jugador">HABILITADO</span>
        </div>

        <label class="jugador-titular">
          <input
            type="checkbox"
            class="check-titular"
            data-lado="${lado}"
            data-id="${escapar(id)}"
            ${registro.titular ? "checked" : ""}
            ${registro.convocado ? "" : "disabled"}
          >
          ⭐ Titular
          <span style="margin-left:auto;color:#718078">
            ${registro.titular ? "Inicialista" : "Suplente"}
          </span>
        </label>
      </article>
    `;
  }).join("");

  contenedor.querySelectorAll(".check-convocado").forEach((check) => {
    check.addEventListener("change", manejarCambioJugador);
  });

  contenedor.querySelectorAll(".check-titular").forEach((check) => {
    check.addEventListener("change", manejarCambioJugador);
  });
}

function manejarCambioJugador(evento) {
  const check = evento.currentTarget;
  const lado = check.dataset.lado;
  const id = String(check.dataset.id);

  const nomina = lado === "local"
    ? estado.nominaLocal
    : estado.nominaVisitante;

  const registro = nomina.get(id) || {
    convocado: false,
    titular: false
  };

  if (check.classList.contains("check-convocado")) {
    if (check.checked) {
      const total = [...nomina.values()].filter(
        (item) => item.convocado
      ).length;

      if (total >= MAX_CONVOCADOS) {
        check.checked = false;
        mostrarMensaje(
          `Cada equipo puede tener hasta ${MAX_CONVOCADOS} convocados.`,
          "error"
        );
        return;
      }

      registro.convocado = true;
    } else {
      registro.convocado = false;
      registro.titular = false;
    }
  } else if (check.classList.contains("check-titular")) {
    if (check.checked) {
      if (!registro.convocado) {
        mostrarMensaje("Primero debe convocar al jugador.", "error");
        check.checked = false;
        return;
      }

      const titulares = [...nomina.values()].filter(
        (item) => item.convocado && item.titular
      ).length;

      if (titulares >= MAX_TITULARES) {
        check.checked = false;
        mostrarMensaje(
          `Cada equipo puede tener como máximo ${MAX_TITULARES} titulares.`,
          "error"
        );
        return;
      }

      registro.titular = true;
    } else {
      registro.titular = false;
    }
  }

  nomina.set(id, registro);
  pintarJugadores(lado);
  actualizarEstadisticas();
}

/* =========================================================
   GUARDAR NÓMINAS
   ========================================================= */

async function guardarNominaLado(lado) {
  if (!estado.partido) {
    mostrarMensaje("Seleccione un partido antes de guardar.", "error");
    return;
  }

  const esLocal = lado === "local";
  const jugadores = esLocal
    ? estado.jugadoresLocal
    : estado.jugadoresVisitante;

  const inscripcion = esLocal
    ? estado.inscripcionLocal
    : estado.inscripcionVisitante;

  const nomina = esLocal
    ? estado.nominaLocal
    : estado.nominaVisitante;

  if (!inscripcion) {
    mostrarMensaje(
      `No se encontró la inscripción del equipo ${lado}.`,
      "error"
    );
    return;
  }

  const convocados = jugadores.filter(
    (fila) => nomina.get(String(fila.id))?.convocado
  );

  const titulares = convocados.filter(
    (fila) => nomina.get(String(fila.id))?.titular
  );

  if (convocados.length > MAX_CONVOCADOS) {
    mostrarMensaje(
      `La nómina no puede superar ${MAX_CONVOCADOS} convocados.`,
      "error"
    );
    return;
  }

  if (titulares.length > MAX_TITULARES) {
    mostrarMensaje(
      `La nómina no puede superar ${MAX_TITULARES} titulares.`,
      "error"
    );
    return;
  }

  const boton = $(esLocal ? "btnGuardarNomina" : "btnGuardarNominaVisitante");

  if (boton) boton.disabled = true;

  try {
    /*
     * Se eliminan únicamente los registros correspondientes a los
     * jugadores de la inscripción del lado seleccionado. La nómina
     * del otro equipo no se modifica.
     */
    const idsJugadores = jugadores.map((fila) => String(fila.id));

    if (idsJugadores.length) {
      const { error: errorEliminar } = await supabase
        .from("nomina_partido")
        .delete()
        .eq("partido_id", estado.partido.id)
        .in("inscripcion_jugador_id", idsJugadores);

      if (errorEliminar) throw errorEliminar;
    }

    if (convocados.length) {
      const filas = convocados.map((fila) => ({
        partido_id: estado.partido.id,
        inscripcion_jugador_id: fila.id,
        titular: Boolean(nomina.get(String(fila.id))?.titular)
      }));

      const { error: errorInsertar } = await supabase
        .from("nomina_partido")
        .insert(filas);

      if (errorInsertar) throw errorInsertar;
    }

    mostrarMensaje(
      `✅ Nómina ${lado} guardada. Convocados: ${convocados.length}; titulares: ${titulares.length}.`,
      "ok"
    );

    actualizarEstadisticas();
    await cargarEventos();
  } catch (error) {
    mostrarMensaje(
      "No se pudo guardar la nómina: " +
      obtenerError(error, "guardarNominaLado"),
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

/* =========================================================
   MARCADOR
   ========================================================= */

async function cargarMarcador() {
  const partido = estado.partido;
  if (!partido) return;

  if ($("golesLocal")) {
    $("golesLocal").value = partido.goles_local ?? 0;
  }

  if ($("golesVisitante")) {
    $("golesVisitante").value = partido.goles_visitante ?? 0;
  }

  actualizarTextoResultado();
}

function actualizarTextoResultado() {
  const local = Number($("golesLocal")?.value || 0);
  const visitante = Number($("golesVisitante")?.value || 0);

  let texto = "Empate";

  if (local > visitante) texto = "Ventaja del equipo local";
  if (visitante > local) texto = "Ventaja del equipo visitante";

  if ($("resultadoTexto")) {
    $("resultadoTexto").textContent = `${texto} · ${local} - ${visitante}`;
  }
}

async function guardarMarcador() {
  if (!estado.partido) {
    mostrarMensaje("Seleccione un partido.", "error");
    return;
  }

  const localTexto = $("golesLocal")?.value ?? "";
  const visitanteTexto = $("golesVisitante")?.value ?? "";

  const local = Number(localTexto);
  const visitante = Number(visitanteTexto);

  if (
    localTexto.trim() === "" ||
    visitanteTexto.trim() === "" ||
    !Number.isInteger(local) ||
    !Number.isInteger(visitante) ||
    local < 0 ||
    visitante < 0
  ) {
    mostrarMensaje("Ingrese goles válidos para ambos equipos.", "error");
    return;
  }

  const boton = $("btnGuardarMarcador");
  if (boton) boton.disabled = true;

  try {
    const { data, error } = await supabase
      .from("partido")
      .update({
        goles_local: local,
        goles_visitante: visitante
      })
      .eq("id", estado.partido.id)
      .select()
      .single();

    if (error) throw error;

    estado.partido = { ...estado.partido, ...data };

    const indice = estado.partidos.findIndex(
      (fila) => String(fila.id) === String(data.id)
    );

    if (indice !== -1) {
      estado.partidos[indice] = {
        ...estado.partidos[indice],
        ...data
      };
    }

    actualizarTextoResultado();
    mostrarDatosPartido();
    actualizarEstadisticas();
    mostrarMensaje("✅ Marcador guardado correctamente.", "ok");
  } catch (error) {
    mostrarMensaje(
      "No se pudo guardar el marcador: " +
      obtenerError(error, "guardarMarcador"),
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

/* =========================================================
   EVENTOS: GOLES Y TARJETAS
   ========================================================= */

function jugadoresConvocadosPorLado(lado) {
  const jugadores = lado === "local"
    ? estado.jugadoresLocal
    : estado.jugadoresVisitante;

  const nomina = lado === "local"
    ? estado.nominaLocal
    : estado.nominaVisitante;

  return jugadores.filter((fila) =>
    nomina.get(String(fila.id))?.convocado
  );
}

function llenarSelectorJugadoresEvento() {
  const selector = $("jugadorEvento");
  if (!selector) return;

  const lado = $("equipoEvento")?.value || "local";
  const jugadores = jugadoresConvocadosPorLado(lado);

  selector.innerHTML =
    '<option value="">Seleccione un jugador...</option>' +
    jugadores.map((fila) => {
      const etiqueta = [
        nombreDeJugador(fila.jugador),
        fila.numero != null ? `N.º ${fila.numero}` : ""
      ].filter(Boolean).join(" · ");

      return `<option value="${escapar(fila.id)}">${escapar(etiqueta)}</option>`;
    }).join("");
}

async function registrarEvento() {
  if (!estado.partido) {
    mostrarMensaje("Seleccione un partido.", "error");
    return;
  }

  const jugadorId = $("jugadorEvento")?.value;
  const tipo = $("tipoEvento")?.value;
  const minutoTexto = $("minutoEvento")?.value;
  const periodo = $("periodoEvento")?.value;
  const observacion = $("observacionEvento")?.value?.trim() || null;

  if (!jugadorId) {
    mostrarMensaje("Seleccione un jugador convocado.", "error");
    return;
  }

  if (!tipo) {
    mostrarMensaje("Seleccione el tipo de evento.", "error");
    return;
  }

  let minuto = null;

  if (minutoTexto !== "") {
    minuto = Number(minutoTexto);

    if (!Number.isInteger(minuto) || minuto < 0 || minuto > 200) {
      mostrarMensaje("El minuto debe ser un número entre 0 y 200.", "error");
      return;
    }
  }

  const boton = $("btnGuardarEvento");
  if (boton) boton.disabled = true;

  try {
    const registro = {
      partido_id: estado.partido.id,
      inscripcion_jugador_id: jugadorId,
      tipo,
      minuto,
      periodo,
      observacion
    };

    const { error } = await supabase
      .from("evento_partido")
      .insert(registro);

    if (error) throw error;

    if (tipo === "GOL") {
      const localActual = Number(estado.partido.goles_local || 0);
      const visitanteActual = Number(estado.partido.goles_visitante || 0);

      const lado = $("equipoEvento")?.value || "local";

      const resultado = lado === "local"
        ? { goles_local: localActual + 1 }
        : { goles_visitante: visitanteActual + 1 };

      const { data, error: errorMarcador } = await supabase
        .from("partido")
        .update(resultado)
        .eq("id", estado.partido.id)
        .select()
        .single();

      if (errorMarcador) {
        mostrarMensaje(
          "El evento se registró, pero no se pudo actualizar el marcador: " +
          obtenerError(errorMarcador, "actualizar marcador tras gol"),
          "error"
        );
      } else {
        estado.partido = { ...estado.partido, ...data };

        const indice = estado.partidos.findIndex(
          (fila) => String(fila.id) === String(data.id)
        );

        if (indice !== -1) {
          estado.partidos[indice] = {
            ...estado.partidos[indice],
            ...data
          };
        }

        await cargarMarcador();
      }
    }

    if ($("minutoEvento")) $("minutoEvento").value = "";
    if ($("observacionEvento")) $("observacionEvento").value = "";

    await cargarEventos();
    actualizarEstadisticas();

    mostrarMensaje("✅ Evento registrado correctamente.", "ok");
  } catch (error) {
    mostrarMensaje(
      "No se pudo registrar el evento. Compruebe las columnas de evento_partido: " +
      obtenerError(error, "registrarEvento"),
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function cargarEventos() {
  if (!estado.partido) {
    estado.eventos = [];
    pintarEventos();
    return;
  }

  try {
    const { data, error } = await supabase
      .from("evento_partido")
      .select("*")
      .eq("partido_id", estado.partido.id)
      .order("minuto", { ascending: true });

    if (error) throw error;

    estado.eventos = data || [];
    pintarEventos();
  } catch (error) {
    console.error("Error cargando eventos:", error);

    estado.eventos = [];
    pintarEventos(
      "No se pudieron cargar los eventos. Revise la tabla evento_partido."
    );
  }
}

function buscarJugadorDeEvento(evento) {
  const id = String(evento.inscripcion_jugador_id);

  const jugadorLocal = estado.jugadoresLocal.find(
    (fila) => String(fila.id) === id
  );

  const jugadorVisitante = estado.jugadoresVisitante.find(
    (fila) => String(fila.id) === id
  );

  const fila = jugadorLocal || jugadorVisitante;
  return fila ? nombreDeJugador(fila.jugador) : `Jugador ${id}`;
}

function nombreTipoEvento(tipo) {
  const tipos = {
    GOL: "⚽ Gol",
    AMARILLA: "🟨 Tarjeta amarilla",
    ROJA_DIRECTA: "🟥 Roja directa",
    ROJA_DOBLE_AMARILLA: "🟥 Roja por doble amarilla"
  };

  return tipos[tipo] || tipo || "Evento";
}

function pintarEventos(mensajeAlternativo = "") {
  const contenedor = $("listaEventos");
  const resumen = $("resumenEventos");

  if (!contenedor) return;

  if (mensajeAlternativo) {
    contenedor.innerHTML =
      `<div class="vacio">${escapar(mensajeAlternativo)}</div>`;

    if (resumen) resumen.innerHTML = contenedor.innerHTML;
    return;
  }

  if (!estado.eventos.length) {
    const vacio = '<div class="vacio">Todavía no hay goles ni tarjetas registrados.</div>';
    contenedor.innerHTML = vacio;
    if (resumen) resumen.innerHTML = vacio;
    return;
  }

  const html = estado.eventos.map((evento) => `
    <article class="evento">
      <div>
        <strong>${escapar(nombreTipoEvento(evento.tipo))}</strong>
        <div style="margin-top:5px">
          ${escapar(buscarJugadorDeEvento(evento))}
        </div>
        <div class="jugador-detalle">
          ${escapar(evento.periodo || "")}
          ${evento.minuto != null ? ` · Minuto ${escapar(evento.minuto)}` : ""}
        </div>
        ${evento.observacion
          ? `<div class="jugador-detalle">${escapar(evento.observacion)}</div>`
          : ""}
      </div>
      <span style="color:#718078;font-weight:800">
        ${evento.minuto != null ? `${escapar(evento.minuto)}'` : ""}
      </span>
    </article>
  `).join("");

  contenedor.innerHTML = html;
  if (resumen) resumen.innerHTML = html;
}

/* =========================================================
   ESTADÍSTICAS
   ========================================================= */

function actualizarEstadisticas() {
  const convocadosLocal = [...estado.nominaLocal.values()].filter(
    (fila) => fila.convocado
  ).length;

  const convocadosVisitante = [...estado.nominaVisitante.values()].filter(
    (fila) => fila.convocado
  ).length;

  const titularesLocal = [...estado.nominaLocal.values()].filter(
    (fila) => fila.convocado && fila.titular
  ).length;

  const titularesVisitante = [...estado.nominaVisitante.values()].filter(
    (fila) => fila.convocado && fila.titular
  ).length;

  const golesLocal = Number(estado.partido?.goles_local || 0);
  const golesVisitante = Number(estado.partido?.goles_visitante || 0);
  const totalGoles = golesLocal + golesVisitante;

  const totalConvocados = convocadosLocal + convocadosVisitante;
  const totalTitulares = titularesLocal + titularesVisitante;
  const totalEventos = estado.eventos.length;

  const valores = {
    totalConvocados,
    totalTitulares,
    totalGoles,
    totalEventos,
    totalConvocadosResumen: totalConvocados,
    totalTitularesResumen: totalTitulares,
    totalGolesResumen: totalGoles,
    totalEventosResumen: totalEventos
  };

  for (const [id, valor] of Object.entries(valores)) {
    if ($(id)) $(id).textContent = String(valor);
  }

  llenarSelectorJugadoresEvento();
}

/* =========================================================
   PESTAÑAS, FILTROS Y BOTONES
   ========================================================= */

function configurarPestanas() {
  document.querySelectorAll("[data-pestana]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const destino = boton.dataset.pestana;

      document.querySelectorAll("[data-pestana]").forEach((item) => {
        item.classList.toggle("activa", item === boton);
      });

      for (const nombre of ["nomina", "gestion", "resumen"]) {
        const panel = $(`panel-${nombre}`);
        if (panel) {
          panel.classList.toggle("oculto", nombre !== destino);
        }
      }

      if (destino === "gestion") {
        llenarSelectorJugadoresEvento();
      }

      if (destino === "resumen") {
        actualizarEstadisticas();
      }
    });
  });
}

function configurarFiltros() {
  ["fechaDesde", "fechaHasta", "filtroGenero"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      llenarSelectorPartidos();
    });
  });

  $("filtroPartido")?.addEventListener("change", (evento) => {
    if (evento.target.value) {
      seleccionarPartido(evento.target.value);
    }
  });

  $("buscarJugador")?.addEventListener("input", () => {
    pintarJugadores("local");
  });

  $("buscarJugadorVisitante")?.addEventListener("input", () => {
    pintarJugadores("visitante");
  });

  $("filtroEquipoNomina")?.addEventListener("change", () => {
    pintarJugadores("local");
  });

  $("filtroEquipoVisitante")?.addEventListener("change", () => {
    pintarJugadores("visitante");
  });

  $("golesLocal")?.addEventListener("input", actualizarTextoResultado);
  $("golesVisitante")?.addEventListener("input", actualizarTextoResultado);

  $("equipoEvento")?.addEventListener("change", llenarSelectorJugadoresEvento);
}

function configurarBotones() {
  $("btnRecargar")?.addEventListener("click", async () => {
    try {
      const idActual = estado.partido?.id;

      await cargarDatosBase();

      if (idActual && estado.partidos.some(
        (partido) => String(partido.id) === String(idActual)
      )) {
        const selector = $("filtroPartido");
        if (selector) selector.value = String(idActual);
        await seleccionarPartido(idActual);
      }

      mostrarMensaje("✅ Información actualizada.", "ok");
    } catch (error) {
      mostrarMensaje(
        "Error al actualizar: " + obtenerError(error, "btnRecargar"),
        "error"
      );
    }
  });

  $("btnGuardarNomina")?.addEventListener("click", () => {
    guardarNominaLado("local");
  });

  $("btnGuardarNominaVisitante")?.addEventListener("click", () => {
    guardarNominaLado("visitante");
  });

  $("btnGuardarMarcador")?.addEventListener("click", guardarMarcador);
  $("btnGuardarEvento")?.addEventListener("click", registrarEvento);

  $("btnActualizarResumen")?.addEventListener("click", async () => {
    await cargarEventos();
    actualizarEstadisticas();
    mostrarMensaje("📊 Resumen actualizado.", "ok");
  });
}

/* =========================================================
   ACTUALIZACIÓN EN TIEMPO REAL
   ========================================================= */

function configurarRealtime() {
  try {
    if (estado.canal) {
      supabase.removeChannel(estado.canal);
      estado.canal = null;
    }

    estado.canal = supabase
      .channel("nomina-partido-cambios")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partido" },
        async () => {
          try {
            const idActual = estado.partido?.id;
            await cargarDatosBase();

            if (idActual) {
              await seleccionarPartido(idActual);
            }
          } catch (error) {
            console.warn("No se pudo actualizar la lista en tiempo real:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evento_partido" },
        async (payload) => {
          const partidoId =
            payload.new?.partido_id || payload.old?.partido_id;

          if (
            estado.partido &&
            String(partidoId) === String(estado.partido.id)
          ) {
            await cargarEventos();
            actualizarEstadisticas();
          }
        }
      )
      .subscribe((status) => {
        console.info("Realtime nóminas:", status);
      });
  } catch (error) {
    console.warn("Realtime no disponible:", error);
  }
}

/* =========================================================
   INICIO
   ========================================================= */

async function iniciar() {
  configurarPestanas();
  configurarFiltros();
  configurarBotones();

  try {
    await cargarDatosBase();
    configurarRealtime();

    if (!estado.partidos.length) {
      mostrarMensaje(
        "No hay partidos registrados en la tabla partido.",
        "info"
      );
      limpiarPaneles();
      return;
    }

    mostrarMensaje("✅ Sistema de nóminas listo.", "ok");
  } catch (error) {
    mostrarMensaje(
      "No se pudo iniciar la gestión de nóminas: " +
      obtenerError(error, "iniciar"),
      "error"
    );
  }
}

iniciar();
