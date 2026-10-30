
import { supabase } from "./supabase.js";

"use strict";

const $ = (id) => document.getElementById(id);

const estado = {
  eventos: [],
  inscripcionesJugador: [],
  personas: [],
  inscripcionesEquipo: [],
  equipos: [],
  partidos: [],
  fases: [],
  competencias: [],
  categorias: [],
  vista: "goleadores"
};

const buscarElemento = (...ids) => ids.map($).find(Boolean) || null;

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function mostrarMensaje(mensaje, tipo = "info") {
  const contenedor = buscarElemento(
    "mensaje",
    "mensajeEstado",
    "estadoCarga",
    "mensajeError"
  );

  if (contenedor) {
    contenedor.textContent = mensaje;
    contenedor.hidden = false;
    contenedor.className = `mensaje ${tipo}`;
  } else {
    console.info(mensaje);
  }
}

async function consultar(tabla) {
  const { data, error } = await supabase.from(tabla).select("*");

  if (error) {
    throw new Error(`Error leyendo ${tabla}: ${error.message}`);
  }

  return data || [];
}

function porId(lista, id) {
  if (id === null || id === undefined || id === "") return null;

  return lista.find((fila) => String(fila.id) === String(id)) || null;
}

function nombrePersona(persona) {
  if (!persona) return "Jugador no identificado";

  const nombre = [
    persona.nombres,
    persona.apellidos
  ].filter(Boolean).join(" ").trim();

  return nombre || persona.nombre_completo || persona.nombre || "Jugador sin nombre";
}

function personaDeInscripcion(inscripcion) {
  if (!inscripcion) return null;

  return porId(estado.personas, inscripcion.jugador_id);
}

function inscripcionDeEvento(evento) {
  // Esta es la relación utilizada por la página de nómina de partidos.
  return porId(
    estado.inscripcionesJugador,
    evento.inscripcion_jugador_id
  );
}

function equipoDeInscripcion(inscripcion) {
  if (!inscripcion) return null;

  const inscripcionEquipo = porId(
    estado.inscripcionesEquipo,
    inscripcion.inscripcion_equipo_id
  );

  if (!inscripcionEquipo) return null;

  return porId(estado.equipos, inscripcionEquipo.equipo_id);
}

function nombreEquipoDeInscripcion(inscripcion) {
  const equipo = equipoDeInscripcion(inscripcion);

  return equipo?.nombre ||
    equipo?.nombre_equipo ||
    equipo?.nombre_completo ||
    "Equipo no identificado";
}

function partidoDeEvento(evento) {
  return porId(estado.partidos, evento.partido_id);
}

function categoriaDePartido(partido) {
  if (!partido) return "Por definir";

  let competencia = porId(
    estado.competencias,
    partido.competencia_id
  );

  if (!competencia && partido.fase_id != null) {
    const fase = porId(estado.fases, partido.fase_id);

    if (fase) {
      competencia = porId(
        estado.competencias,
        fase.competencia_id
      );
    }
  }

  const categoriaId =
    partido.categoria_id ??
    competencia?.categoria_id;

  const categoria = porId(estado.categorias, categoriaId);

  return categoria?.nombre ||
    categoria?.nombre_categoria ||
    competencia?.categoria ||
    "Por definir";
}

function tipoEvento(evento) {
  return normalizar(evento.tipo ?? evento.tipo_evento ?? evento.evento);
}

function esGol(evento) {
  return tipoEvento(evento) === "GOL";
}

function esAmarilla(evento) {
  const tipo = tipoEvento(evento);
  return tipo === "AMARILLA";
}

function esRoja(evento) {
  const tipo = tipoEvento(evento);

  return tipo === "ROJA_DIRECTA" ||
    tipo === "ROJA_DOBLE_AMARILLA" ||
    tipo === "ROJA" ||
    tipo === "TARJETA_ROJA";
}

async function cargarDatos() {
  mostrarMensaje("Cargando goleadores y tarjetas...", "info");

  try {
    const [
      eventos,
      inscripcionesJugador,
      inscripcionesEquipo,
      equipos,
      partidos,
      fases,
      competencias,
      categorias
    ] = await Promise.all([
      consultar("evento_partido"),
      consultar("inscripcion_jugador"),
      consultar("inscripcion_equipo"),
      consultar("equipo"),
      consultar("partido"),
      consultar("fase"),
      consultar("competencia"),
      consultar("categoria")
    ]);

    estado.eventos = eventos;
    estado.inscripcionesJugador = inscripcionesJugador;
    estado.inscripcionesEquipo = inscripcionesEquipo;
    estado.equipos = equipos;
    estado.partidos = partidos;
    estado.fases = fases;
    estado.competencias = competencias;
    estado.categorias = categorias;

    // Consultar los perfiles de jugador por separado.
    // No dependemos de una relación anidada de PostgREST.
    const idsPersonas = [
      ...new Set(
        inscripcionesJugador
          .map((inscripcion) => inscripcion.jugador_id)
          .filter((id) => id !== null && id !== undefined)
          .map(String)
      )
    ];

    if (idsPersonas.length) {
      const personas = [];

      // Consultas por bloques para evitar URL demasiado extensa.
      for (let inicio = 0; inicio < idsPersonas.length; inicio += 100) {
        const bloque = idsPersonas.slice(inicio, inicio + 100);

        const { data, error } = await supabase
          .from("jugador")
          .select("id,nombres,apellidos")
          .in("id", bloque);

        if (error) {
          throw new Error(
            `No se pudieron leer los nombres desde la tabla jugador: ${error.message}`
          );
        }

        personas.push(...(data || []));
      }

      estado.personas = personas;
    } else {
      estado.personas = [];
    }

    llenarFiltros();
    renderizar();

    const eventosSinJugador = eventos.filter(
      (evento) => !inscripcionDeEvento(evento)
    ).length;

    if (eventosSinJugador > 0) {
      mostrarMensaje(
        `Datos cargados, pero ${eventosSinJugador} evento(s) no se relacionan con inscripcion_jugador. Revise evento_partido.inscripcion_jugador_id.`,
        "error"
      );
    } else if (!eventos.length) {
      mostrarMensaje(
        "Los equipos y jugadores se cargaron, pero todavía no hay eventos registrados en evento_partido.",
        "info"
      );
    } else {
      mostrarMensaje("Datos cargados correctamente.", "exito");
    }
  } catch (error) {
    console.error("Error en goleadores y tarjetas:", error);

    mostrarMensaje(
      error.message || "No se pudieron cargar los datos de Supabase.",
      "error"
    );
  }
}

function filtros() {
  return {
    categoria: buscarElemento(
      "filtroCategoria",
      "categoriaFiltro",
      "selectCategoria"
    )?.value || "",

    equipo: buscarElemento(
      "filtroEquipo",
      "filtroEquipoNomina",
      "equipoFiltro",
      "selectEquipo"
    )?.value || "",

    busqueda: normalizar(
      buscarElemento(
        "buscarJugador",
        "filtroJugador",
        "busquedaJugador",
        "buscar"
      )?.value || ""
    )
  };
}

function eventoPasaFiltros(evento, inscripcion, persona) {
  const filtro = filtros();
  const partido = partidoDeEvento(evento);

  if (filtro.categoria) {
    if (
      normalizar(categoriaDePartido(partido)) !==
      normalizar(filtro.categoria)
    ) {
      return false;
    }
  }

  const nombreEquipo = nombreEquipoDeInscripcion(inscripcion);

  if (filtro.equipo) {
    if (normalizar(nombreEquipo) !== normalizar(filtro.equipo)) {
      return false;
    }
  }

  if (filtro.busqueda) {
    const nombre = normalizar(nombrePersona(persona));

    if (
      !nombre.includes(filtro.busqueda) &&
      !normalizar(nombreEquipo).includes(filtro.busqueda)
    ) {
      return false;
    }
  }

  return true;
}

function llenarFiltros() {
  const filtroCategoria = buscarElemento(
    "filtroCategoria",
    "categoriaFiltro",
    "selectCategoria"
  );

  if (filtroCategoria) {
    const anterior = filtroCategoria.value;

    const nombres = [
      ...new Set(
        estado.partidos
          .map(categoriaDePartido)
          .filter((nombre) => nombre !== "Por definir")
      )
    ].sort((a, b) => a.localeCompare(b, "es"));

    filtroCategoria.innerHTML =
      '<option value="">Todas las categorías</option>' +
      nombres.map((nombre) =>
        `<option value="${escapar(nombre)}">${escapar(nombre)}</option>`
      ).join("");

    filtroCategoria.value = nombres.includes(anterior) ? anterior : "";
  }

  const filtroEquipo = buscarElemento(
    "filtroEquipo",
    "filtroEquipoNomina",
    "equipoFiltro",
    "selectEquipo"
  );

  if (filtroEquipo) {
    const anterior = filtroEquipo.value;

    const nombres = [
      ...new Set(
        estado.equipos
          .map((equipo) =>
            equipo.nombre || equipo.nombre_equipo || equipo.nombre_completo
          )
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "es"));

    filtroEquipo.innerHTML =
      '<option value="">Todos los equipos</option>' +
      nombres.map((nombre) =>
        `<option value="${escapar(nombre)}">${escapar(nombre)}</option>`
      ).join("");

    filtroEquipo.value = nombres.includes(anterior) ? anterior : "";
  }
}

function calcularEstadisticas() {
  const goleadores = new Map();
  const tarjetas = new Map();

  for (const evento of estado.eventos) {
    const inscripcion = inscripcionDeEvento(evento);

    if (!inscripcion) continue;

    const persona = personaDeInscripcion(inscripcion);

    if (!eventoPasaFiltros(evento, inscripcion, persona)) continue;

    const jugadorId = String(inscripcion.id);
    const nombre = nombrePersona(persona);
    const equipo = nombreEquipoDeInscripcion(inscripcion);
    const categoria = categoriaDePartido(partidoDeEvento(evento));

    if (esGol(evento)) {
      if (!goleadores.has(jugadorId)) {
        goleadores.set(jugadorId, {
          id: jugadorId,
          nombre,
          equipo,
          categoria,
          goles: 0
        });
      }

      goleadores.get(jugadorId).goles += 1;
    }

    if (esAmarilla(evento) || esRoja(evento)) {
      if (!tarjetas.has(jugadorId)) {
        tarjetas.set(jugadorId, {
          id: jugadorId,
          nombre,
          equipo,
          categoria,
          amarillas: 0,
          rojas: 0
        });
      }

      const fila = tarjetas.get(jugadorId);

      if (esAmarilla(evento)) fila.amarillas += 1;
      if (esRoja(evento)) fila.rojas += 1;

      // Una roja por doble amarilla es una expulsión.
      // No se suman dos amarillas ficticias si no hay dos eventos
      // AMARILLA registrados individualmente en la base de datos.
    }
  }

  const listaGoles = [...goleadores.values()].sort(
    (a, b) =>
      b.goles - a.goles ||
      a.nombre.localeCompare(b.nombre, "es")
  );

  const listaTarjetas = [...tarjetas.values()].sort(
    (a, b) =>
      b.rojas - a.rojas ||
      b.amarillas - a.amarillas ||
      a.nombre.localeCompare(b.nombre, "es")
  );

  return {
    listaGoles,
    listaTarjetas,
    totalGoles: listaGoles.reduce((suma, fila) => suma + fila.goles, 0),
    totalGoleadores: listaGoles.length,
    totalAmarillas: listaTarjetas.reduce(
      (suma, fila) => suma + fila.amarillas,
      0
    ),
    totalRojas: listaTarjetas.reduce(
      (suma, fila) => suma + fila.rojas,
      0
    )
  };
}

function pintarGoleadores(lista) {
  const contenedor = buscarElemento(
    "tablaGoleadores",
    "cuerpoGoleadores",
    "listaGoleadores",
    "goleadoresBody",
    "contenedorGoleadores"
  );

  if (!contenedor) {
    console.warn("No se encontró el contenedor HTML de goleadores.");
    return;
  }

  const vacio = `
    <tr>
      <td colspan="5" class="tabla-vacia">
        No hay goles registrados para estos filtros.
      </td>
    </tr>
  `;

  contenedor.innerHTML = lista.length
    ? lista.map((fila, indice) => `
        <tr>
          <td>${indice + 1}</td>
          <td>${escapar(fila.nombre)}</td>
          <td>${escapar(fila.equipo)}</td>
          <td>${escapar(fila.categoria)}</td>
          <td><strong>${fila.goles}</strong></td>
        </tr>
      `).join("")
    : vacio;
}

function pintarTarjetas(lista) {
  const contenedor = buscarElemento(
    "tablaTarjetas",
    "cuerpoTarjetas",
    "listaTarjetas",
    "tarjetasBody",
    "contenedorTarjetas"
  );

  if (!contenedor) {
    console.warn("No se encontró el contenedor HTML de tarjetas.");
    return;
  }

  const vacio = `
    <tr>
      <td colspan="6" class="tabla-vacia">
        No hay tarjetas registradas para estos filtros.
      </td>
    </tr>
  `;

  contenedor.innerHTML = lista.length
    ? lista.map((fila, indice) => `
        <tr>
          <td>${indice + 1}</td>
          <td>${escapar(fila.nombre)}</td>
          <td>${escapar(fila.equipo)}</td>
          <td>${escapar(fila.categoria)}</td>
          <td><span class="tarjeta-amarilla">${fila.amarillas}</span></td>
          <td><span class="tarjeta-roja">${fila.rojas}</span></td>
        </tr>
      `).join("")
    : vacio;
}

function renderizar() {
  const datos = calcularEstadisticas();

  const actualizarTexto = (ids, valor) => {
    const el = buscarElemento(...ids);
    if (el) el.textContent = String(valor);
  };

  actualizarTexto(
    ["totalGoles", "resumenGoles", "contadorGoles"],
    datos.totalGoles
  );

  actualizarTexto(
    ["totalGoleadores", "resumenGoleadores", "contadorGoleadores"],
    datos.totalGoleadores
  );

  actualizarTexto(
    ["totalAmarillas", "resumenAmarillas", "contadorAmarillas"],
    datos.totalAmarillas
  );

  actualizarTexto(
    ["totalRojas", "resumenRojas", "contadorRojas"],
    datos.totalRojas
  );

  pintarGoleadores(datos.listaGoles);
  pintarTarjetas(datos.listaTarjetas);
  actualizarVista();
}

function cambiarVista(vista) {
  if (vista !== "goleadores" && vista !== "tarjetas") return;

  estado.vista = vista;
  actualizarVista();
}

function actualizarVista() {
  const panelGoles = buscarElemento(
    "panelGoleadores",
    "seccionGoleadores",
    "vistaGoleadores"
  );

  const panelTarjetas = buscarElemento(
    "panelTarjetas",
    "seccionTarjetas",
    "vistaTarjetas"
  );

  if (panelGoles) panelGoles.hidden = estado.vista !== "goleadores";
  if (panelTarjetas) panelTarjetas.hidden = estado.vista !== "tarjetas";

  document.querySelectorAll("[data-pestana]").forEach((boton) => {
    const activa = boton.dataset.pestana === estado.vista;
    boton.classList.toggle("activo", activa);
    boton.setAttribute("aria-selected", String(activa));
  });
}

function configurarEventos() {
  const escuchar = (ids, evento, callback) => {
    const el = buscarElemento(...ids);
    if (el) el.addEventListener(evento, callback);
  };

  escuchar(
    ["filtroCategoria", "categoriaFiltro", "selectCategoria"],
    "change",
    renderizar
  );

  escuchar(
    ["filtroEquipo", "filtroEquipoNomina", "equipoFiltro", "selectEquipo"],
    "change",
    renderizar
  );

  escuchar(
    ["buscarJugador", "filtroJugador", "busquedaJugador", "buscar"],
    "input",
    renderizar
  );

  escuchar(
    ["btnActualizar", "actualizarDatos", "btnRecargar", "recargar"],
    "click",
    cargarDatos
  );

  escuchar(
    ["btnGoleadores", "tabGoleadores", "verGoleadores"],
    "click",
    () => cambiarVista("goleadores")
  );

  escuchar(
    ["btnTarjetas", "tabTarjetas", "verTarjetas"],
    "click",
    () => cambiarVista("tarjetas")
  );

  document.querySelectorAll("[data-pestana]").forEach((boton) => {
    boton.addEventListener("click", () => {
      cambiarVista(boton.dataset.pestana);
    });
  });
}

function iniciar() {
  configurarEventos();
  actualizarVista();
  cargarDatos();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}
