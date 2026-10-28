import { supabase } from "./supabase.js";

/*
 * OLIMPIADAS JUAN SOLANO 2026
 * Gestión de partidos de FÚTBOL:
 * - Nómina de titulares y suplentes.
 * - Marcador y estado del partido.
 * - Registro de goles y tarjetas.
 * - Historial y resumen.
 * - Suscripción Supabase Realtime.
 *
 * Archivo HTML: admin/nomina-partido.html
 * Este archivo: js/nomina-partido.js
 */

const $ = (id) => document.getElementById(id);

const el = {
  fechaDesde: $("fechaDesde"),
  fechaHasta: $("fechaHasta"),
  filtroGenero: $("filtroGenero"),
  filtroPartido: $("filtroPartido"),
  mensaje: $("mensaje"),
  btnRecargar: $("btnRecargar"),
  partidoNomina: $("partidoNomina"),
  partidoGestion: $("partidoGestion"),
  partidoResumen: $("partidoResumen"),
  buscarJugador: $("buscarJugador"),
  filtroEquipoNomina: $("filtroEquipoNomina"),
  btnCargarJugadores: $("btnCargarJugadores"),
  contadorNomina: $("contadorNomina"),
  jugadoresNomina: $("jugadoresNomina"),
  btnGuardarNomina: $("btnGuardarNomina"),
  golesLocal: $("golesLocal"),
  golesVisitante: $("golesVisitante"),
  resultadoTexto: $("resultadoTexto"),
  btnGuardarMarcador: $("btnGuardarMarcador"),
  equipoEvento: $("equipoEvento"),
  jugadorEvento: $("jugadorEvento"),
  tipoEvento: $("tipoEvento"),
  minutoEvento: $("minutoEvento"),
  periodoEvento: $("periodoEvento"),
  observacionEvento: $("observacionEvento"),
  btnGuardarEvento: $("btnGuardarEvento"),
  listaEventos: $("listaEventos"),
  totalConvocados: $("totalConvocados"),
  totalTitulares: $("totalTitulares"),
  totalGoles: $("totalGoles"),
  totalEventos: $("totalEventos"),
  btnActualizarResumen: $("btnActualizarResumen"),
  resumenEventos: $("resumenEventos"),
  labelGolesLocal: $("labelGolesLocal"),
  labelGolesVisitante: $("labelGolesVisitante")
};

let partidos = [];
let partidoActual = null;
let jugadoresPartido = [];
let nominaActual = [];
let eventosActuales = [];
let inscripcionesEquipo = new Map();
let canalRealtime = null;
let cargando = false;

const EVENTOS_PERMITIDOS = [
  "GOL",
  "AMARILLA",
  "ROJA_DIRECTA",
  "ROJA_DOBLE_AMARILLA"
];

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function mostrarMensaje(texto, tipo = "info") {
  if (!el.mensaje) return;
  el.mensaje.className = `mensaje ${tipo}`;
  el.mensaje.textContent = texto || "";
}

function bloquearBotones(bloquear) {
  [
    el.btnRecargar,
    el.btnCargarJugadores,
    el.btnGuardarNomina,
    el.btnGuardarMarcador,
    el.btnGuardarEvento,
    el.btnActualizarResumen
  ].forEach((b) => {
    if (b) b.disabled = bloquear;
  });
}

function nombreCompleto(j) {
  return [j?.nombres, j?.apellidos]
    .filter(Boolean)
    .join(" ")
    .trim() || "Jugador sin nombre";
}

function nombreEquipoDeInscripcion(inscripcionId) {
  const ins = inscripcionesEquipo.get(Number(inscripcionId));
  return ins?.equipo?.nombre ||
    ins?.nombre_equipo ||
    `Equipo ${inscripcionId}`;
}

function nombreLocal(p = partidoActual) {
  return p
    ? nombreEquipoDeInscripcion(p.equipo_local_id)
    : "Equipo local";
}

function nombreVisitante(p = partidoActual) {
  return p
    ? nombreEquipoDeInscripcion(p.equipo_visitante_id)
    : "Equipo visitante";
}

function textoEstado(estado) {
  return ({
    PROGRAMADO: "Programado",
    EN_VIVO: "EN VIVO",
    FINALIZADO: "Finalizado",
    SUSPENDIDO: "Suspendido"
  })[estado] || estado || "Sin estado";
}

function fechaHoraPartido(p) {
  const fecha = p?.fecha || "";
  const hora = p?.hora ? String(p.hora).slice(0, 5) : "";
  return [fecha, hora].filter(Boolean).join(" · ");
}

function htmlMarcador(p) {
  if (!p) {
    return `
      <div class="nombre-equipo">Equipo local</div>
      <div class="marcador">VS</div>
      <div class="nombre-equipo">Equipo visitante</div>`;
  }

  return `
    <div>
      <div class="nombre-equipo">${escapar(nombreLocal(p))}</div>
      <div class="fecha-partido">LOCAL</div>
    </div>

    <div>
      <div class="marcador">
        ${Number(p.goles_local || 0)} -
        ${Number(p.goles_visitante || 0)}
      </div>
      <div class="fecha-partido">
        ${escapar(textoEstado(p.estado))}
        · ${escapar(fechaHoraPartido(p))}
      </div>
    </div>

    <div>
      <div class="nombre-equipo">${escapar(nombreVisitante(p))}</div>
      <div class="fecha-partido">VISITANTE</div>
    </div>`;
}

function pintarMarcadores() {
  [
    el.partidoNomina,
    el.partidoGestion,
    el.partidoResumen
  ].forEach((n) => {
    if (n) n.innerHTML = htmlMarcador(partidoActual);
  });

  if (el.labelGolesLocal) {
    el.labelGolesLocal.textContent =
      `Goles de ${nombreLocal()}`;
  }

  if (el.labelGolesVisitante) {
    el.labelGolesVisitante.textContent =
      `Goles de ${nombreVisitante()}`;
  }

  if (el.golesLocal && partidoActual) {
    el.golesLocal.value = Number(partidoActual.goles_local || 0);
  }

  if (el.golesVisitante && partidoActual) {
    el.golesVisitante.value =
      Number(partidoActual.goles_visitante || 0);
  }

  actualizarTextoResultado();
}

function actualizarTextoResultado() {
  if (!el.resultadoTexto) return;

  if (!partidoActual) {
    el.resultadoTexto.textContent =
      "Seleccione un partido para consultar el resultado.";
    return;
  }

  const a = Number(
    el.golesLocal?.value ?? partidoActual.goles_local ?? 0
  );

  const b = Number(
    el.golesVisitante?.value ??
    partidoActual.goles_visitante ??
    0
  );

  const resultado = a === b
    ? "Empate"
    : a > b
      ? `Ventaja de ${nombreLocal()}`
      : `Ventaja de ${nombreVisitante()}`;

  el.resultadoTexto.textContent =
    `${nombreLocal()} ${a} - ${b} ${nombreVisitante()} · ${resultado}`;
}

function partidoEsFutbol(p) {
  const nombre = String(
    p?.competencia?.disciplina?.nombre ||
    p?.disciplina_nombre ||
    ""
  ).toLowerCase();

  return nombre.includes("fútbol") ||
    nombre.includes("futbol") ||
    nombre.includes("football");
}

async function cargarPartidos() {
  mostrarMensaje("Cargando partidos de fútbol…", "info");

  const { data: partidosBase, error: errorPartidos } =
    await supabase
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
        tipo_resultado,
        tiempo_extra_jugado,
        iniciado_en,
        finalizado_en,
        observacion,
        goles_local,
        goles_visitante,
        fase(
          competencia_id,
          nombre,
          tipo,
          orden
        )
      `)
      .order("fecha", {
        ascending: true,
        nullsFirst: false
      })
      .order("hora", {
        ascending: true,
        nullsFirst: false
      });

  if (errorPartidos) throw errorPartidos;

  const idsCompetencia = [
    ...new Set(
      (partidosBase || [])
        .map(p => p.fase?.competencia_id)
        .filter(Boolean)
        .map(Number)
    )
  ];

  let competencias = [];

  if (idsCompetencia.length) {
    const { data, error } = await supabase
      .from("competencia")
      .select(`
        id,
        nombre,
        estado,
        disciplina_id,
        categoria_id,
        genero_id,
        disciplina(id,nombre),
        categoria(id,nombre),
        genero(id,nombre)
      `)
      .in("id", idsCompetencia);

    if (error) throw error;
    competencias = data || [];
  }

  const compMap = new Map(
    competencias.map(c => [Number(c.id), c])
  );

  let todos = (partidosBase || []).map(p => ({
    ...p,
    competencia:
      compMap.get(Number(p.fase?.competencia_id)) || null
  }));

  todos = todos.filter(partidoEsFutbol);

  const idsInscripcion = [
    ...new Set(
      todos.flatMap(p => [
        p.equipo_local_id,
        p.equipo_visitante_id
      ])
      .filter(Boolean)
      .map(Number)
    )
  ];

  inscripcionesEquipo = new Map();

  if (idsInscripcion.length) {
    const { data: inscripciones, error } = await supabase
      .from("inscripcion_equipo")
      .select(`
        id,
        equipo_id,
        competencia_id,
        estado,
        equipo(id,nombre,logo)
      `)
      .in("id", idsInscripcion);

    if (error) throw error;

    (inscripciones || []).forEach(i => {
      inscripcionesEquipo.set(Number(i.id), i);
    });
  }

  partidos = todos;
  llenarFiltroGenero();
  await aplicarFiltrosPartidos(true);

  mostrarMensaje(
    `Se cargaron ${partidos.length} partidos de fútbol.`,
    "ok"
  );
}

function llenarFiltroGenero() {
  if (!el.filtroGenero) return;

  const seleccionado = el.filtroGenero.value;
  const generos = new Map();

  partidos.forEach(p => {
    const g = p.competencia?.genero;
    if (g?.id != null) {
      generos.set(String(g.id), g.nombre);
    }
  });

  el.filtroGenero.innerHTML =
    `<option value="">Todos los géneros</option>` +
    [...generos.entries()].map(([id, nombre]) =>
      `<option value="${escapar(id)}">${escapar(nombre)}</option>`
    ).join("");

  if ([...generos.keys()].includes(seleccionado)) {
    el.filtroGenero.value = seleccionado;
  }
}

async function aplicarFiltrosPartidos(seleccionarPrimero = true) {
  const desde = el.fechaDesde?.value || "";
  const hasta = el.fechaHasta?.value || "";
  const genero = el.filtroGenero?.value || "";

  const filtrados = partidos.filter(p => {
    if (desde && p.fecha && p.fecha < desde) return false;
    if (hasta && p.fecha && p.fecha > hasta) return false;

    if (
      genero &&
      String(p.competencia?.genero?.id || "") !== genero
    ) return false;

    return true;
  });

  const previo = el.filtroPartido?.value;

  if (el.filtroPartido) {
    el.filtroPartido.innerHTML =
      `<option value="">Seleccione un partido</option>` +
      filtrados.map(p => {
        const label =
          `#${p.id} · ${nombreLocal(p)} ` +
          `${p.goles_local}-${p.goles_visitante} ` +
          `${nombreVisitante(p)} · ` +
          `${p.competencia?.nombre || "Fútbol"} · ` +
          `${fechaHoraPartido(p)} · ${textoEstado(p.estado)}`;

        return `<option value="${p.id}">${escapar(label)}</option>`;
      }).join("");

    if (filtrados.some(p => String(p.id) === previo)) {
      el.filtroPartido.value = previo;
    } else if (seleccionarPrimero && filtrados.length) {
      el.filtroPartido.value = String(filtrados[0].id);
    }
  }

  const id = el.filtroPartido?.value;

  if (id) {
    await seleccionarPartido(Number(id));
  } else if (!filtrados.length) {
    limpiarPartido("No hay partidos de fútbol con esos filtros.");
  } else {
    limpiarPartido("Seleccione un partido.");
  }
}

function limpiarPartido(texto) {
  partidoActual = null;
  jugadoresPartido = [];
  nominaActual = [];
  eventosActuales = [];

  pintarMarcadores();

  if (el.jugadoresNomina) {
    el.jugadoresNomina.innerHTML =
      `<div class="vacio">${escapar(texto)}</div>`;
  }

  if (el.listaEventos) {
    el.listaEventos.innerHTML =
      `<div class="vacio">${escapar(texto)}</div>`;
  }

  if (el.resumenEventos) {
    el.resumenEventos.innerHTML =
      `<div class="vacio">${escapar(texto)}</div>`;
  }

  if (el.jugadorEvento) {
    el.jugadorEvento.innerHTML =
      `<option value="">Seleccione un partido</option>`;
  }

  if (el.contadorNomina) {
    el.contadorNomina.textContent =
      "Ningún jugador seleccionado.";
  }

  actualizarEstadisticas();
  detenerRealtime();
}

async function seleccionarPartido(id) {
  partidoActual =
    partidos.find(p => Number(p.id) === Number(id)) || null;

  if (!partidoActual) {
    limpiarPartido("No se encontró el partido seleccionado.");
    return;
  }

  pintarMarcadores();
  await cargarNomina();
  await cargarEventos();
  activarRealtime();
  actualizarResumen();
}

async function cargarNomina() {
  if (!partidoActual) return;

  const { data: nomina, error: errorNomina } = await supabase
    .from("nomina_partido")
    .select("id,partido_id,inscripcion_jugador_id,titular")
    .eq("partido_id", partidoActual.id);

  if (errorNomina) throw errorNomina;
  nominaActual = nomina || [];

  const idsInscripcionesEquipo = [
    Number(partidoActual.equipo_local_id),
    Number(partidoActual.equipo_visitante_id)
  ];

  const { data: jugadores, error: errorJugadores } =
    await supabase
      .from("inscripcion_jugador")
      .select(`
        id,
        inscripcion_equipo_id,
        jugador_id,
        numero,
        posicion,
        estado,
        jugador(id,nombres,apellidos,activo)
      `)
      .in("inscripcion_equipo_id", idsInscripcionesEquipo)
      .eq("estado", "HABILITADO");

  if (errorJugadores) throw errorJugadores;

  jugadoresPartido = (jugadores || []).map(j => {
    const n = nominaActual.find(
      x => Number(x.inscripcion_jugador_id) === Number(j.id)
    );

    return {
      ...j,
      convocado: Boolean(n),
      nomina_id: n?.id || null,
      titular: Boolean(n?.titular)
    };
  });

  pintarJugadores();
  llenarSelectorJugadorEvento();
  actualizarEstadisticas();
}

function pintarJugadores() {
  if (!el.jugadoresNomina) return;

  if (!partidoActual) {
    el.jugadoresNomina.innerHTML =
      `<div class="vacio">Seleccione un partido.</div>`;
    return;
  }

  const busqueda =
    (el.buscarJugador?.value || "").trim().toLowerCase();

  const filtroEquipo = el.filtroEquipoNomina?.value || "";

  const lista = jugadoresPartido.filter(j => {
    const esLocal =
      Number(j.inscripcion_equipo_id) ===
      Number(partidoActual.equipo_local_id);

    if (filtroEquipo === "local" && !esLocal) return false;
    if (filtroEquipo === "visitante" && esLocal) return false;

    const texto =
      `${nombreCompleto(j.jugador)} ${j.posicion || ""} ${j.numero || ""}`
      .toLowerCase();

    return !busqueda || texto.includes(busqueda);
  });

  if (!lista.length) {
    el.jugadoresNomina.innerHTML =
      `<div class="vacio">No hay jugadores habilitados que coincidan con el filtro.</div>`;
    actualizarContadorNomina();
    return;
  }

  el.jugadoresNomina.innerHTML = lista.map(j => {
    const equipo =
      Number(j.inscripcion_equipo_id) ===
      Number(partidoActual.equipo_local_id)
        ? nombreLocal()
        : nombreVisitante();

    return `
      <article class="jugador">
        <input
          type="checkbox"
          class="chk-convocado"
          data-id="${j.id}"
          ${j.convocado ? "checked" : ""}
          aria-label="Convocar a ${escapar(nombreCompleto(j.jugador))}">

        <div class="jugador-info">
          <div class="jugador-nombre">
            ${escapar(nombreCompleto(j.jugador))}
          </div>

          <div class="jugador-detalle">
            ${escapar(equipo)} · Camiseta ${escapar(j.numero ?? "—")}
            · ${escapar(j.posicion || "Sin posición")}
          </div>

          <span class="estado">
            ${j.convocado
              ? (j.titular ? "TITULAR" : "SUPLENTE")
              : "NO CONVOCADO"}
          </span>

          <select
            class="selector-titular"
            data-titular-id="${j.id}"
            ${j.convocado ? "" : "disabled"}>
            <option value="false" ${!j.titular ? "selected" : ""}>
              Suplente
            </option>
            <option value="true" ${j.titular ? "selected" : ""}>
              Titular
            </option>
          </select>
        </div>
      </article>`;
  }).join("");

  el.jugadoresNomina
    .querySelectorAll(".chk-convocado")
    .forEach(chk => {
      chk.addEventListener("change", () => {
        const j = jugadoresPartido.find(
          x => Number(x.id) === Number(chk.dataset.id)
        );

        if (!j) return;

        j.convocado = chk.checked;
        if (!j.convocado) j.titular = false;

        pintarJugadores();
        llenarSelectorJugadorEvento();
        actualizarEstadisticas();
      });
    });

  el.jugadoresNomina
    .querySelectorAll("[data-titular-id]")
    .forEach(sel => {
      sel.addEventListener("change", () => {
        const j = jugadoresPartido.find(
          x => Number(x.id) === Number(sel.dataset.titularId)
        );

        if (j) j.titular = sel.value === "true";

        pintarJugadores();
        actualizarEstadisticas();
      });
    });

  actualizarContadorNomina();
}

function actualizarContadorNomina() {
  if (!el.contadorNomina) return;

  const convocados = jugadoresPartido.filter(j => j.convocado);
  const titulares = convocados.filter(j => j.titular);

  el.contadorNomina.textContent =
    `${convocados.length} convocados · ${titulares.length} titulares · ` +
    `${convocados.length - titulares.length} suplentes`;
}

function llenarSelectorJugadorEvento() {
  if (!el.jugadorEvento) return;

  const lado = el.equipoEvento?.value || "local";

  const inscripcionId = lado === "local"
    ? Number(partidoActual?.equipo_local_id)
    : Number(partidoActual?.equipo_visitante_id);

  const convocados = jugadoresPartido.filter(j =>
    j.convocado &&
    Number(j.inscripcion_equipo_id) === inscripcionId
  );

  el.jugadorEvento.innerHTML =
    `<option value="">Seleccione jugador</option>` +
    convocados.map(j =>
      `<option value="${j.id}">` +
      `${escapar(j.numero ? `#${j.numero} ` : "")}` +
      `${escapar(nombreCompleto(j.jugador))}` +
      `</option>`
    ).join("");
}

async function guardarNomina() {
  if (!partidoActual) {
    throw new Error("Seleccione un partido.");
  }

  const seleccionados = jugadoresPartido.filter(j => j.convocado);

  if (!seleccionados.length) {
    throw new Error("Seleccione al menos un jugador para la nómina.");
  }

  const titulares = seleccionados.filter(j => j.titular);

  if (titulares.length > 22) {
    throw new Error("No puede registrar más de 22 titulares en total.");
  }

  const idsLocales = seleccionados.filter(j =>
    Number(j.inscripcion_equipo_id) ===
    Number(partidoActual.equipo_local_id)
  );

  const idsVisitantes = seleccionados.filter(j =>
    Number(j.inscripcion_equipo_id) ===
    Number(partidoActual.equipo_visitante_id)
  );

  if (
    idsLocales.filter(j => j.titular).length > 11 ||
    idsVisitantes.filter(j => j.titular).length > 11
  ) {
    throw new Error("Cada equipo puede tener como máximo 11 titulares.");
  }

  const actuales = new Map(
    nominaActual.map(n => [Number(n.inscripcion_jugador_id), n])
  );

  const seleccionadosIds = new Set(
    seleccionados.map(j => Number(j.id))
  );

  const quitar = nominaActual
    .filter(n => !seleccionadosIds.has(Number(n.inscripcion_jugador_id)))
    .map(n => n.id);

  if (quitar.length) {
    const { error } = await supabase
      .from("nomina_partido")
      .delete()
      .in("id", quitar);

    if (error) throw error;
  }

  const insertar = [];

  for (const j of seleccionados) {
    const existente = actuales.get(Number(j.id));

    if (existente) {
      if (Boolean(existente.titular) !== Boolean(j.titular)) {
        const { error } = await supabase
          .from("nomina_partido")
          .update({ titular: Boolean(j.titular) })
          .eq("id", existente.id);

        if (error) throw error;
      }
    } else {
      insertar.push({
        partido_id: Number(partidoActual.id),
        inscripcion_jugador_id: Number(j.id),
        titular: Boolean(j.titular)
      });
    }
  }

  if (insertar.length) {
    const { error } = await supabase
      .from("nomina_partido")
      .insert(insertar);

    if (error) throw error;
  }

  await cargarNomina();
  mostrarMensaje("Nómina guardada correctamente.", "ok");
}

async function guardarMarcador() {
  if (!partidoActual) {
    throw new Error("Seleccione un partido.");
  }

  const local = Number(el.golesLocal?.value);
  const visitante = Number(el.golesVisitante?.value);

  if (
    !Number.isInteger(local) || local < 0 ||
    !Number.isInteger(visitante) || visitante < 0
  ) {
    throw new Error(
      "Los goles deben ser números enteros iguales o mayores que cero."
    );
  }

  const { data, error } = await supabase
    .from("partido")
    .update({
      goles_local: local,
      goles_visitante: visitante
    })
    .eq("id", partidoActual.id)
    .select("id,goles_local,goles_visitante")
    .single();

  if (error) throw error;

  partidoActual.goles_local = data.goles_local;
  partidoActual.goles_visitante = data.goles_visitante;

  actualizarPartidoEnLista();
  pintarMarcadores();

  mostrarMensaje("Marcador guardado correctamente.", "ok");
}

function actualizarPartidoEnLista() {
  if (!partidoActual) return;

  const i = partidos.findIndex(
    p => Number(p.id) === Number(partidoActual.id)
  );

  if (i >= 0) {
    partidos[i] = { ...partidos[i], ...partidoActual };
  }

  if (el.filtroPartido) {
    const seleccionado = String(partidoActual.id);
    const opciones = [...el.filtroPartido.options];
    const opcion = opciones.find(o => o.value === seleccionado);

    if (opcion) {
      opcion.textContent =
        `#${partidoActual.id} · ${nombreLocal()} ` +
        `${partidoActual.goles_local}-${partidoActual.goles_visitante} ` +
        `${nombreVisitante()} · ${partidoActual.competencia?.nombre || "Fútbol"} ` +
        `· ${fechaHoraPartido(partidoActual)} · ${textoEstado(partidoActual.estado)}`;
    }

    el.filtroPartido.value = seleccionado;
  }
}

async function registrarEvento() {
  if (!partidoActual) {
    throw new Error("Seleccione un partido.");
  }

  const tipo = el.tipoEvento?.value;
  const jugadorId = Number(el.jugadorEvento?.value);
  const minutoRaw = el.minutoEvento?.value;
  const minuto = minutoRaw === "" ? null : Number(minutoRaw);

  if (!EVENTOS_PERMITIDOS.includes(tipo)) {
    throw new Error("Tipo de evento no permitido.");
  }

  if (!jugadorId) {
    throw new Error("Seleccione el jugador que registra el evento.");
  }

  if (
    minuto !== null &&
    (!Number.isInteger(minuto) || minuto < 0 || minuto > 200)
  ) {
    throw new Error("Ingrese un minuto válido entre 0 y 200.");
  }

  const jugador = jugadoresPartido.find(
    j => Number(j.id) === jugadorId
  );

  if (!jugador || !jugador.convocado) {
    throw new Error(
      "El jugador debe estar convocado en la nómina de este partido."
    );
  }

  const lado =
    Number(jugador.inscripcion_equipo_id) ===
    Number(partidoActual.equipo_local_id)
      ? "local"
      : Number(jugador.inscripcion_equipo_id) ===
        Number(partidoActual.equipo_visitante_id)
        ? "visitante"
        : null;

  if (!lado) {
    throw new Error(
      "El jugador no pertenece a uno de los equipos de este partido."
    );
  }

  const payload = {
    partido_id: Number(partidoActual.id),
    inscripcion_jugador_id: jugadorId,
    tipo,
    minuto,
    periodo: el.periodoEvento?.value || "REGLAMENTARIO",
    observacion: (el.observacionEvento?.value || "").trim() || null
  };

  const { error } = await supabase
    .from("evento_partido")
    .insert(payload);

  if (error) throw error;

  if (tipo === "GOL") {
    const campo = lado === "local"
      ? "goles_local"
      : "goles_visitante";

    const nuevoValor =
      Number(partidoActual[campo] || 0) + 1;

    const { error: errorMarcador } = await supabase
      .from("partido")
      .update({ [campo]: nuevoValor })
      .eq("id", partidoActual.id);

    if (errorMarcador) {
      mostrarMensaje(
        "El evento se registró, pero no se pudo actualizar el marcador. Use «Guardar marcador» para corregirlo.",
        "error"
      );
      throw errorMarcador;
    }

    partidoActual[campo] = nuevoValor;
    actualizarPartidoEnLista();
    pintarMarcadores();
  }

  if (el.observacionEvento) {
    el.observacionEvento.value = "";
  }

  if (el.minutoEvento) {
    el.minutoEvento.value = "";
  }

  await cargarEventos();
  actualizarResumen();

  const mensaje = tipo === "GOL"
    ? "Gol registrado correctamente."
    : tipo === "AMARILLA"
      ? "Tarjeta amarilla registrada correctamente."
      : "Tarjeta roja registrada correctamente.";

  mostrarMensaje(mensaje, "ok");
}

async function cargarEventos() {
  if (!partidoActual) return;

  const { data, error } = await supabase
    .from("evento_partido")
    .select(`
      id,
      partido_id,
      inscripcion_jugador_id,
      tipo,
      minuto,
      periodo,
      created_at,
      observacion
    `)
    .eq("partido_id", partidoActual.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const eventos = data || [];

  const jugadorIds = [
    ...new Set(
      eventos
        .map(e => e.inscripcion_jugador_id)
        .filter(Boolean)
        .map(Number)
    )
  ];

  let jugadorMap = new Map();

  if (jugadorIds.length) {
    const { data: inscripciones, error: errorIns } =
      await supabase
        .from("inscripcion_jugador")
        .select(`
          id,
          inscripcion_equipo_id,
          jugador(id,nombres,apellidos)
        `)
        .in("id", jugadorIds);

    if (errorIns) throw errorIns;

    jugadorMap = new Map(
      (inscripciones || []).map(j => [Number(j.id), j])
    );
  }

  eventosActuales = eventos.map(e => {
    const ins = jugadorMap.get(Number(e.inscripcion_jugador_id));

    const lado =
      Number(ins?.inscripcion_equipo_id) ===
      Number(partidoActual.equipo_local_id)
        ? "local"
        : Number(ins?.inscripcion_equipo_id) ===
          Number(partidoActual.equipo_visitante_id)
          ? "visitante"
          : "";

    return {
      ...e,
      jugador: ins?.jugador || null,
      inscripcion_equipo_id: ins?.inscripcion_equipo_id,
      lado
    };
  });

  pintarEventos();
  actualizarEstadisticas();
}

function etiquetaEvento(tipo) {
  return ({
    GOL: "⚽ Gol",
    AMARILLA: "🟨 Tarjeta amarilla",
    ROJA_DIRECTA: "🟥 Tarjeta roja directa",
    ROJA_DOBLE_AMARILLA: "🟥 Roja por doble amarilla"
  })[tipo] || tipo;
}

function pintarEventos() {
  const html = eventosActuales.length
    ? eventosActuales.map(e => {
      const equipo = e.lado === "local"
        ? nombreLocal()
        : e.lado === "visitante"
          ? nombreVisitante()
          : "Equipo no identificado";

      const minuto = e.minuto == null
        ? "Minuto no indicado"
        : `${e.minuto}'`;

      return `
        <article class="evento">
          <div>
            <strong>
              ${escapar(etiquetaEvento(e.tipo))} · ${escapar(minuto)}
            </strong>
            <small>
              ${escapar(nombreCompleto(e.jugador))}
              · ${escapar(equipo)}
              · ${escapar(e.periodo || "REGLAMENTARIO")}
            </small>
            ${e.observacion
              ? `<small>${escapar(e.observacion)}</small>`
              : ""}
          </div>

          <button
            type="button"
            class="btn-secundario btn-eliminar-evento"
            data-evento-id="${e.id}">
            Eliminar
          </button>
        </article>`;
    }).join("")
    : `<div class="vacio">Todavía no hay goles ni tarjetas registrados.</div>`;

  if (el.listaEventos) el.listaEventos.innerHTML = html;
  if (el.resumenEventos) el.resumenEventos.innerHTML = html;

  document.querySelectorAll(".btn-eliminar-evento").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.eventoId);

      const evento = eventosActuales.find(
        e => Number(e.id) === id
      );

      if (!evento) return;

      const confirmar = confirm(
        "¿Desea eliminar este evento? Si es un gol, también se descontará del marcador."
      );

      if (!confirmar) return;

      try {
        bloquearBotones(true);

        const { error } = await supabase
          .from("evento_partido")
          .delete()
          .eq("id", id)
          .eq("partido_id", partidoActual.id);

        if (error) throw error;

        if (evento.tipo === "GOL" && evento.lado) {
          const campo = evento.lado === "local"
            ? "goles_local"
            : "goles_visitante";

          const nuevo = Math.max(
            0,
            Number(partidoActual[campo] || 0) - 1
          );

          const { error: errUpdate } = await supabase
            .from("partido")
            .update({ [campo]: nuevo })
            .eq("id", partidoActual.id);

          if (errUpdate) throw errUpdate;

          partidoActual[campo] = nuevo;
          actualizarPartidoEnLista();
          pintarMarcadores();
        }

        await cargarEventos();
        actualizarResumen();

        mostrarMensaje("Evento eliminado.", "ok");
      } catch (err) {
        console.error(err);
        mostrarMensaje(
          `No se pudo eliminar el evento: ${err.message || err}`,
          "error"
        );
      } finally {
        bloquearBotones(false);
      }
    });
  });
}

function actualizarEstadisticas() {
  if (el.totalConvocados) {
    el.totalConvocados.textContent =
      jugadoresPartido.filter(j => j.convocado).length;
  }

  if (el.totalTitulares) {
    el.totalTitulares.textContent =
      jugadoresPartido.filter(j => j.convocado && j.titular).length;
  }

  if (el.totalGoles) {
    el.totalGoles.textContent =
      eventosActuales.filter(e => e.tipo === "GOL").length;
  }

  if (el.totalEventos) {
    el.totalEventos.textContent = eventosActuales.length;
  }

  actualizarContadorNomina();
}

function actualizarResumen() {
  pintarMarcadores();
  actualizarEstadisticas();
}

async function cambiarEstado(estado) {
  if (!partidoActual) {
    throw new Error("Seleccione un partido.");
  }

  const cambios = { estado };

  if (estado === "EN_VIVO") {
    cambios.iniciado_en = new Date().toISOString();
  }

  if (estado === "FINALIZADO") {
    cambios.finalizado_en = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("partido")
    .update(cambios)
    .eq("id", partidoActual.id)
    .select("id,estado,iniciado_en,finalizado_en")
    .single();

  if (error) throw error;

  Object.assign(partidoActual, data);

  actualizarPartidoEnLista();
  pintarMarcadores();

  mostrarMensaje(
    `Partido actualizado: ${textoEstado(estado)}.`,
    "ok"
  );
}

function agregarControlesEstado() {
  const zona = document.querySelector("#panel-gestion h2");

  if (!zona || $("accionesEstadoPartido")) return;

  const cont = document.createElement("div");
  cont.id = "accionesEstadoPartido";
  cont.className = "acciones";

  cont.innerHTML = `
    <button type="button" class="btn" id="btnIniciarPartido">
      ▶ Iniciar partido
    </button>

    <button type="button" class="btn-secundario" id="btnFinalizarPartido">
      ■ Finalizar partido
    </button>

    <button type="button" class="btn-secundario" id="btnSuspenderPartido">
      Ⅱ Suspender
    </button>

    <button type="button" class="btn-secundario" id="btnProgramarPartido">
      ↻ Volver a programado
    </button>`;

  zona.insertAdjacentElement("afterend", cont);

  $("btnIniciarPartido").addEventListener("click", () =>
    ejecutar(() => cambiarEstado("EN_VIVO"))
  );

  $("btnFinalizarPartido").addEventListener("click", () => {
    if (confirm("¿Confirma que el partido ha finalizado?")) {
      ejecutar(() => cambiarEstado("FINALIZADO"));
    }
  });

  $("btnSuspenderPartido").addEventListener("click", () =>
    ejecutar(() => cambiarEstado("SUSPENDIDO"))
  );

  $("btnProgramarPartido").addEventListener("click", () =>
    ejecutar(() => cambiarEstado("PROGRAMADO"))
  );
}

function detenerRealtime() {
  if (canalRealtime) {
    supabase.removeChannel(canalRealtime);
    canalRealtime = null;
  }
}

function activarRealtime() {
  detenerRealtime();

  if (!partidoActual) return;

  const id = Number(partidoActual.id);

  canalRealtime = supabase
    .channel(`partido-futbol-${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "partido",
        filter: `id=eq.${id}`
      },
      async payload => {
        if (
          payload.new &&
          Number(payload.new.id) === Number(partidoActual?.id)
        ) {
          Object.assign(partidoActual, payload.new);
          actualizarPartidoEnLista();
          pintarMarcadores();
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "evento_partido",
        filter: `partido_id=eq.${id}`
      },
      async () => {
        try {
          await cargarEventos();
          actualizarResumen();
        } catch (err) {
          console.error("Realtime eventos:", err);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "nomina_partido",
        filter: `partido_id=eq.${id}`
      },
      async () => {
        try {
          await cargarNomina();
        } catch (err) {
          console.error("Realtime nómina:", err);
        }
      }
    )
    .subscribe(status => {
      if (status === "CHANNEL_ERROR") {
        console.warn(
          "No se pudo iniciar la suscripción Realtime para este partido."
        );
      }
    });
}

async function ejecutar(accion) {
  if (cargando) return;

  cargando = true;
  bloquearBotones(true);

  try {
    await accion();
  } catch (err) {
    console.error(err);

    mostrarMensaje(
      err?.message || "Ocurrió un error inesperado.",
      "error"
    );
  } finally {
    cargando = false;
    bloquearBotones(false);
  }
}

function configurarPestanas() {
  document.querySelectorAll("[data-pestana]").forEach(btn => {
    btn.addEventListener("click", () => {
      const nombre = btn.dataset.pestana;

      document.querySelectorAll("[data-pestana]").forEach(b => {
        const activo = b === btn;

        b.classList.toggle("activa", activo);
        b.setAttribute("aria-pressed", String(activo));
      });

      ["nomina", "gestion", "resumen"].forEach(n => {
        const panel = $(`panel-${n}`);

        if (panel) {
          panel.classList.toggle("oculto", n !== nombre);
        }
      });
    });
  });
}

function configurarEventosUI() {
  el.btnRecargar?.addEventListener("click", () =>
    ejecutar(async () => {
      const seleccionado = el.filtroPartido?.value;

      await cargarPartidos();

      if (
        seleccionado &&
        partidos.some(p => String(p.id) === seleccionado)
      ) {
        el.filtroPartido.value = seleccionado;
        await seleccionarPartido(Number(seleccionado));
      }
    })
  );

  el.filtroPartido?.addEventListener("change", () =>
    ejecutar(async () => {
      const id = Number(el.filtroPartido.value);

      if (id) {
        await seleccionarPartido(id);
      } else {
        limpiarPartido("Seleccione un partido.");
      }
    })
  );

  [
    el.fechaDesde,
    el.fechaHasta,
    el.filtroGenero
  ].forEach(campo => {
    campo?.addEventListener("change", () =>
      ejecutar(() => aplicarFiltrosPartidos(true))
    );
  });

  el.btnCargarJugadores?.addEventListener(
    "click",
    pintarJugadores
  );

  el.buscarJugador?.addEventListener(
    "input",
    pintarJugadores
  );

  el.filtroEquipoNomina?.addEventListener(
    "change",
    pintarJugadores
  );

  el.equipoEvento?.addEventListener(
    "change",
    llenarSelectorJugadorEvento
  );

  el.golesLocal?.addEventListener(
    "input",
    actualizarTextoResultado
  );

  el.golesVisitante?.addEventListener(
    "input",
    actualizarTextoResultado
  );

  el.btnGuardarNomina?.addEventListener(
    "click",
    () => ejecutar(guardarNomina)
  );

  el.btnGuardarMarcador?.addEventListener(
    "click",
    () => ejecutar(guardarMarcador)
  );

  el.btnGuardarEvento?.addEventListener(
    "click",
    () => ejecutar(registrarEvento)
  );

  el.btnActualizarResumen?.addEventListener("click", () =>
    ejecutar(async () => {
      if (!partidoActual) {
        throw new Error("Seleccione un partido.");
      }

      await cargarNomina();
      await cargarEventos();
      actualizarResumen();

      mostrarMensaje("Resumen actualizado.", "ok");
    })
  );
}

async function iniciar() {
  configurarPestanas();
  configurarEventosUI();
  agregarControlesEstado();

  try {
    await cargarPartidos();
  } catch (err) {
    console.error("Error al cargar partidos:", err);

    limpiarPartido("No se pudieron cargar los partidos.");

    mostrarMensaje(
      `Error al cargar partidos: ${err.message || err}. ` +
      "Revise las relaciones de Supabase y las políticas RLS.",
      "error"
    );
  }
}

iniciar();