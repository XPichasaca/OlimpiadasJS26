
import { supabase } from "./supabase.js";

"use strict";

// =====================================================
// GOLEADORES Y TARJETAS - OLIMPIADAS JUAN SOLANO 2026
// Masculino: genero_id = 1
// Femenino:  genero_id = 2
// =====================================================

const $ = (id) => document.getElementById(id);

const BUCKET_JUGADORES = "jugadores";
const BUCKET_ESCUDOS = "logos-equipos";

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
  vista: "goleadores",
  historialAbierto: null
};

// =====================================================
// UTILIDADES
// =====================================================

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caracter]);
}

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function porId(lista, id) {
  return lista.find((fila) => String(fila.id) === String(id));
}

function nombrePersona(persona) {
  if (!persona) return "Jugador sin identificar";

  return [
    persona.nombres,
    persona.apellidos
  ].filter(Boolean).join(" ") || "Jugador sin identificar";
}

function consultar(tabla) {
  return supabase
    .from(tabla)
    .select("*");
}

function urlImagen(bucket, archivo) {
  if (!archivo) return "";

  const valor = String(archivo).trim();

  if (/^https?:\/\//i.test(valor)) {
    return valor;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(valor);

  return data?.publicUrl || "";
}

function imagenJugadorHTML(inscripcion) {
  const persona = personaDeInscripcion(inscripcion);
  const url = urlImagen(BUCKET_JUGADORES, persona?.foto);

  if (url) {
    return `
      <img
        class="gt-avatar"
        src="${escapar(url)}"
        alt="${escapar(nombrePersona(persona))}"
        loading="lazy"
        onerror="this.outerHTML='<span class=&quot;gt-avatar gt-avatar-vacio&quot;>👤</span>'"
      >
    `;
  }

  return `<span class="gt-avatar gt-avatar-vacio">👤</span>`;
}

function imagenEquipoHTML(inscripcionEquipo) {
  const equipo = equipoDeInscripcion(inscripcionEquipo);
  const url = urlImagen(BUCKET_ESCUDOS, equipo?.logo);

  if (url) {
    return `
      <img
        class="gt-escudo"
        src="${escapar(url)}"
        alt="${escapar(equipo?.nombre || "Equipo")}"
        loading="lazy"
        onerror="this.outerHTML='<span class=&quot;gt-escudo gt-escudo-vacio&quot;>⚽</span>'"
      >
    `;
  }

  return `<span class="gt-escudo gt-escudo-vacio">⚽</span>`;
}

// =====================================================
// RELACIONES DE SUPABASE
// =====================================================

function personaDeInscripcion(inscripcion) {
  if (!inscripcion) return null;

  return porId(
    estado.personas,
    inscripcion.jugador_id
  );
}

function equipoDeInscripcion(inscripcionEquipo) {
  if (!inscripcionEquipo) return null;

  return porId(
    estado.equipos,
    inscripcionEquipo.equipo_id
  );
}

function equipoInscritoDeJugador(inscripcionJugador) {
  if (!inscripcionJugador) return null;

  return porId(
    estado.inscripcionesEquipo,
    inscripcionJugador.inscripcion_equipo_id
  );
}

function partidoDeEvento(evento) {
  return porId(estado.partidos, evento.partido_id);
}

function faseDePartido(partido) {
  if (!partido) return null;

  return porId(estado.fases, partido.fase_id);
}

function competenciaDePartido(partido) {
  const fase = faseDePartido(partido);

  if (!fase) return null;

  return porId(
    estado.competencias,
    fase.competencia_id
  );
}

function categoriaDePartido(partido) {
  const competencia = competenciaDePartido(partido);

  if (!competencia) return "Por definir";

  const categoria = porId(
    estado.categorias,
    competencia.categoria_id
  );

  return categoria?.nombre || "Por definir";
}

function generoDePartido(partido) {
  const competencia = competenciaDePartido(partido);

  if (!competencia) return null;

  const id = Number(competencia.genero_id);

  if (id === 1) return "MASCULINO";
  if (id === 2) return "FEMENINO";

  return null;
}

function rivalDeJugador(partido, inscripcionEquipoJugador) {
  if (!partido || !inscripcionEquipoJugador) {
    return null;
  }

  if (
    String(partido.equipo_local_id) ===
    String(inscripcionEquipoJugador.id)
  ) {
    return porId(
      estado.inscripcionesEquipo,
      partido.equipo_visitante_id
    );
  }

  if (
    String(partido.equipo_visitante_id) ===
    String(inscripcionEquipoJugador.id)
  ) {
    return porId(
      estado.inscripcionesEquipo,
      partido.equipo_local_id
    );
  }

  return null;
}

function marcadorDePartido(partido, inscripcionEquipoJugador) {
  if (!partido) return "Sin marcador";

  const local = Number(partido.goles_local ?? 0);
  const visitante = Number(partido.goles_visitante ?? 0);

  if (
    String(partido.equipo_local_id) ===
    String(inscripcionEquipoJugador?.id)
  ) {
    return `${local} - ${visitante}`;
  }

  return `${visitante} - ${local}`;
}

// =====================================================
// CARGA DE DATOS
// =====================================================

async function cargarDatos() {
  const resultado = await Promise.all([
    consultar("evento_partido"),
    consultar("inscripcion_jugador"),
    consultar("inscripcion_equipo"),
    consultar("equipo"),
    consultar("partido"),
    consultar("fase"),
    consultar("competencia"),
    consultar("categoria")
  ]);

  const nombres = [
    "eventos",
    "inscripcionesJugador",
    "inscripcionesEquipo",
    "equipos",
    "partidos",
    "fases",
    "competencias",
    "categorias"
  ];

  for (let i = 0; i < resultado.length; i++) {
    const { data, error } = resultado[i];

    if (error) {
      console.error(
        `Error cargando ${nombres[i]}:`,
        error
      );

      throw new Error(
        `No se pudo cargar ${nombres[i]}: ${error.message}`
      );
    }

    estado[nombres[i]] = data || [];
  }

  // Cargar personas por bloques para evitar consultas muy grandes.
  const ids = [
    ...new Set(
      estado.inscripcionesJugador
        .map((fila) => fila.jugador_id)
        .filter(Boolean)
        .map(String)
    )
  ];

  estado.personas = [];

  for (let i = 0; i < ids.length; i += 100) {
    const bloque = ids.slice(i, i + 100);

    const { data, error } = await supabase
      .from("jugador")
      .select("id,nombres,apellidos,foto")
      .in("id", bloque);

    if (error) {
      console.error("Error cargando jugadores:", error);
      throw new Error(
        `No se pudieron cargar las fotografías y nombres: ${error.message}`
      );
    }

    estado.personas.push(...(data || []));
  }

  console.log("Datos cargados:", {
    eventos: estado.eventos.length,
    jugadoresInscritos: estado.inscripcionesJugador.length,
    personas: estado.personas.length,
    equipos: estado.equipos.length,
    partidos: estado.partidos.length,
    competencias: estado.competencias.length
  });

  const noRelacionados = estado.eventos.filter((evento) => {
    return !porId(
      estado.inscripcionesJugador,
      evento.inscripcion_jugador_id
    );
  });

  if (noRelacionados.length) {
    console.warn(
      `${noRelacionados.length} evento(s) no se relacionan con inscripcion_jugador.`,
      noRelacionados
    );
  }
}

// =====================================================
// FILTROS
// =====================================================

function llenarFiltros() {
  const filtroCategoria = $("filtroCategoria");
  const filtroEquipo = $("filtroEquipo");

  if (filtroCategoria) {
    const categorias = [
      ...new Set(
        estado.categorias
          .map((fila) => fila.nombre)
          .filter(Boolean)
      )
    ].sort();

    filtroCategoria.innerHTML =
      `<option value="">Todas las categorías</option>` +
      categorias.map((nombre) =>
        `<option value="${escapar(nombre)}">${escapar(nombre)}</option>`
      ).join("");
  }

  if (filtroEquipo) {
    const equipos = [...estado.equipos]
      .sort((a, b) =>
        String(a.nombre).localeCompare(String(b.nombre))
      );

    filtroEquipo.innerHTML =
      `<option value="">Todos los equipos</option>` +
      equipos.map((equipo) =>
        `<option value="${escapar(equipo.id)}">${escapar(equipo.nombre)}</option>`
      ).join("");
  }
}

function eventoPasaFiltros(evento) {
  const partido = partidoDeEvento(evento);

  if (!partido) return false;

  // Solo partidos de fútbol con género identificado.
  if (!generoDePartido(partido)) return false;

  const filtroCategoria = $("filtroCategoria")?.value || "";
  const filtroEquipo = $("filtroEquipo")?.value || "";
  const buscar = normalizar(
    $("buscarJugador")?.value || ""
  );

  if (
    filtroCategoria &&
    categoriaDePartido(partido) !== filtroCategoria
  ) {
    return false;
  }

  const inscripcion = porId(
    estado.inscripcionesJugador,
    evento.inscripcion_jugador_id
  );

  const equipoInscrito = equipoInscritoDeJugador(inscripcion);

  if (
    filtroEquipo &&
    String(equipoInscrito?.equipo_id) !== String(filtroEquipo)
  ) {
    return false;
  }

  if (buscar) {
    const persona = personaDeInscripcion(inscripcion);
    const equipo = equipoDeInscripcion(equipoInscrito);

    const texto = normalizar(
      `${nombrePersona(persona)} ${equipo?.nombre || ""}`
    );

    if (!texto.includes(buscar)) return false;
  }

  return true;
}

// =====================================================
// CÁLCULO DE ESTADÍSTICAS
// =====================================================

function calcularEstadisticas() {
  const goleadores = new Map();
  const tarjetas = new Map();

  const eventosFiltrados = estado.eventos.filter(
    eventoPasaFiltros
  );

  for (const evento of eventosFiltrados) {
    const tipo = normalizar(evento.tipo);

    const partido = partidoDeEvento(evento);

    const genero = generoDePartido(partido);

    const inscripcion = porId(
      estado.inscripcionesJugador,
      evento.inscripcion_jugador_id
    );

    if (!inscripcion || !genero) continue;

    const clave = `${genero}|${inscripcion.id}`;

    const persona = personaDeInscripcion(inscripcion);
    const equipoInscrito = equipoInscritoDeJugador(inscripcion);
    const equipo = equipoDeInscripcion(equipoInscrito);

    const base = {
      clave,
      genero,
      inscripcion,
      persona,
      equipoInscrito,
      equipo,
      categoria: categoriaDePartido(partido)
    };

    if (tipo === "GOL") {
      if (!goleadores.has(clave)) {
        goleadores.set(clave, {
          ...base,
          goles: 0,
          eventos: []
        });
      }

      const fila = goleadores.get(clave);
      fila.goles++;
      fila.eventos.push(evento);
    }

    if (
      tipo === "AMARILLA" ||
      tipo === "ROJA_DIRECTA" ||
      tipo === "ROJA_DOBLE_AMARILLA"
    ) {
      if (!tarjetas.has(clave)) {
        tarjetas.set(clave, {
          ...base,
          amarillas: 0,
          rojas: 0,
          eventos: []
        });
      }

      const fila = tarjetas.get(clave);

      if (tipo === "AMARILLA") {
        fila.amarillas++;
      } else {
        fila.rojas++;
      }

      fila.eventos.push(evento);
    }
  }

  return {
    goleadores: [...goleadores.values()].sort(
      (a, b) => b.goles - a.goles
    ),

    tarjetas: [...tarjetas.values()].sort(
      (a, b) =>
        (b.amarillas + b.rojas) -
        (a.amarillas + a.rojas)
    )
  };
}

// =====================================================
// HISTORIAL DE EVENTOS
// =====================================================

function historialHTML(fila) {
  const eventos = [...fila.eventos].sort((a, b) => {
    return Number(a.minuto || 0) - Number(b.minuto || 0);
  });

  if (!eventos.length) {
    return `<div class="gt-sin-historial">No hay eventos registrados.</div>`;
  }

  return `
    <div class="gt-evento-detalle">
      ${eventos.map((evento) => {
        const partido = partidoDeEvento(evento);

        const rival = rivalDeJugador(
          partido,
          fila.equipoInscrito
        );

        const equipoRival = equipoDeInscripcion(rival);

        const tipo = normalizar(evento.tipo);

        const icono =
          tipo === "GOL" ? "⚽" :
          tipo === "AMARILLA" ? "🟨" :
          "🟥";

        const descripcion =
          tipo === "GOL" ? "Gol" :
          tipo === "AMARILLA" ? "Tarjeta amarilla" :
          tipo === "ROJA_DIRECTA" ? "Tarjeta roja directa" :
          "Roja por doble amarilla";

        const fecha = partido?.fecha
          ? new Date(`${partido.fecha}T00:00:00`).toLocaleDateString("es-EC")
          : "Fecha no disponible";

        return `
          <div class="gt-evento-item">
            <div class="gt-evento-icono">${icono}</div>

            <div class="gt-evento-info">
              <strong>${descripcion}</strong>

              <span>
                Minuto ${escapar(evento.minuto ?? "—")}
                · ${escapar(fecha)}
              </span>

              <span>
                Rival: ${escapar(equipoRival?.nombre || "No identificado")}
              </span>

              <span>
                Marcador:
                ${escapar(marcadorDePartido(partido, fila.equipoInscrito))}
              </span>

              ${evento.observacion ? `
                <small>${escapar(evento.observacion)}</small>
              ` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// =====================================================
// FILAS Y SEPARACIÓN POR GÉNERO
// =====================================================

function agruparPorGenero(lista) {
  return {
    MASCULINO: lista.filter(
      (fila) => fila.genero === "MASCULINO"
    ),
    FEMENINO: lista.filter(
      (fila) => fila.genero === "FEMENINO"
    )
  };
}

function filaGeneroHTML(nombre, cantidad, columnas) {
  if (!cantidad) return "";

  return `
    <tr class="gt-grupo-genero">
      <td colspan="${columnas}">
        <span>${nombre}</span>
        <small>${cantidad} jugador(es)</small>
      </td>
    </tr>
  `;
}

function filaGoleadorHTML(fila, posicion) {
  const persona = nombrePersona(fila.persona);

  return `
    <tr>
      <td>${posicion}</td>

      <td>
        <div class="gt-jugador">
          ${imagenJugadorHTML(fila.inscripcion)}

          <div>
            <strong>${escapar(persona)}</strong>
            <small>
              Camiseta #${escapar(fila.inscripcion.numero ?? "—")}
            </small>
          </div>
        </div>
      </td>

      <td>
        <div class="gt-equipo">
          ${imagenEquipoHTML(fila.equipoInscrito)}
          <span>${escapar(fila.equipo?.nombre || "Equipo no identificado")}</span>
        </div>
      </td>

      <td>${escapar(fila.categoria)}</td>

      <td>
        <strong class="gt-numero-goles">${fila.goles}</strong>
      </td>
    </tr>
  `;
}

function filaTarjetaHTML(fila, posicion) {
  const persona = nombrePersona(fila.persona);

  return `
    <tr>
      <td>${posicion}</td>

      <td>
        <div class="gt-jugador">
          ${imagenJugadorHTML(fila.inscripcion)}

          <div>
            <strong>${escapar(persona)}</strong>
            <small>
              Camiseta #${escapar(fila.inscripcion.numero ?? "—")}
            </small>
          </div>
        </div>
      </td>

      <td>
        <div class="gt-equipo">
          ${imagenEquipoHTML(fila.equipoInscrito)}
          <span>${escapar(fila.equipo?.nombre || "Equipo no identificado")}</span>
        </div>
      </td>

      <td>${escapar(fila.categoria)}</td>

      <td>
        <strong class="gt-numero-amarillas">${fila.amarillas}</strong>
      </td>

      <td>
        <strong class="gt-numero-rojas">${fila.rojas}</strong>
      </td>
    </tr>
  `;
}

// =====================================================
// PINTAR TABLAS
// =====================================================

function pintarGoleadores(lista) {
  const tabla = $("tablaGoleadores");
  if (!tabla) return;

  const grupos = agruparPorGenero(lista);

  let html = "";

  for (const genero of ["MASCULINO", "FEMENINO"]) {
    const filas = grupos[genero];

    html += filaGeneroHTML(
      genero,
      filas.length,
      5
    );

    filas.forEach((fila, index) => {
      html += filaGoleadorHTML(fila, index + 1);
    });
  }

  tabla.innerHTML = html || `
    <tr>
      <td colspan="5" class="gt-vacio">
        Todavía no hay goleadores registrados.
      </td>
    </tr>
  `;
}

function pintarTarjetas(lista) {
  const tabla = $("tablaTarjetas");
  if (!tabla) return;

  const grupos = agruparPorGenero(lista);

  let html = "";

  for (const genero of ["MASCULINO", "FEMENINO"]) {
    const filas = grupos[genero];

    html += filaGeneroHTML(
      genero,
      filas.length,
      6
    );

    filas.forEach((fila, index) => {
      html += filaTarjetaHTML(fila, index + 1);
    });
  }

  tabla.innerHTML = html || `
    <tr>
      <td colspan="6" class="gt-vacio">
        Todavía no hay tarjetas registradas.
      </td>
    </tr>
  `;
}

// =====================================================
// RESUMEN
// =====================================================

function actualizarResumen(goleadores, tarjetas) {
  const totalGoles = goleadores.reduce(
    (total, fila) => total + fila.goles,
    0
  );

  const totalGoleadores = goleadores.length;

  const totalAmarillas = tarjetas.reduce(
    (total, fila) => total + fila.amarillas,
    0
  );

  const totalRojas = tarjetas.reduce(
    (total, fila) => total + fila.rojas,
    0
  );

  if ($("totalGoles")) {
    $("totalGoles").textContent = totalGoles;
  }

  if ($("totalGoleadores")) {
    $("totalGoleadores").textContent = totalGoleadores;
  }

  if ($("totalAmarillas")) {
    $("totalAmarillas").textContent = totalAmarillas;
  }

  if ($("totalRojas")) {
    $("totalRojas").textContent = totalRojas;
  }
}

// =====================================================
// RENDERIZADO
// =====================================================

function renderizar() {
  const { goleadores, tarjetas } = calcularEstadisticas();

  actualizarResumen(goleadores, tarjetas);

  pintarGoleadores(goleadores);
  pintarTarjetas(tarjetas);
}

// =====================================================
// PESTAÑAS
// =====================================================

function cambiarVista(vista) {
  estado.vista = vista;

  document.querySelectorAll("[data-pestana]").forEach((boton) => {
    boton.classList.toggle(
      "activo",
      boton.dataset.pestana === vista
    );
  });

  if ($("panelGoleadores")) {
    $("panelGoleadores").hidden = vista !== "goleadores";
  }

  if ($("panelTarjetas")) {
    $("panelTarjetas").hidden = vista !== "tarjetas";
  }

  if ($("btnGoleadores")) {
    $("btnGoleadores").classList.toggle(
      "activo",
      vista === "goleadores"
    );
  }

  if ($("btnTarjetas")) {
    $("btnTarjetas").classList.toggle(
      "activo",
      vista === "tarjetas"
    );
  }
}

// =====================================================
// ESTILOS ADICIONALES
// =====================================================

function agregarEstilos() {
  if ($("estilosGoleadoresTarjetas")) return;

  const estilo = document.createElement("style");
  estilo.id = "estilosGoleadoresTarjetas";

  estilo.textContent = `
    .gt-jugador {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 180px;
    }

    .gt-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid #dce7df;
    }

    .gt-avatar-vacio {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e8eee9;
      font-size: 20px;
    }

    .gt-jugador strong {
      display: block;
      color: #183526;
    }

    .gt-jugador small {
      display: block;
      color: #78857c;
      font-size: 11px;
      margin-top: 3px;
    }

    .gt-equipo {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 120px;
    }

    .gt-escudo {
      width: 30px;
      height: 30px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .gt-escudo-vacio {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
      background: #edf1ed;
      font-size: 17px;
    }

    .gt-grupo-genero td {
      background: #e9f0e9 !important;
      color: #173b28;
      font-weight: 800;
      padding: 13px 12px !important;
      border-top: 2px solid #cbd9ce;
      text-align: left;
    }

    .gt-grupo-genero td span {
      letter-spacing: .6px;
    }

    .gt-grupo-genero small {
      float: right;
      font-weight: 500;
      color: #66776a;
    }

    .gt-numero-goles {
      color: #14733d;
      font-size: 18px;
    }

    .gt-numero-amarillas {
      color: #b77900;
      font-size: 17px;
    }

    .gt-numero-rojas {
      color: #c62828;
      font-size: 17px;
    }

    .gt-vacio {
      padding: 25px !important;
      text-align: center;
      color: #77847b;
    }

    .gt-evento-detalle {
      padding: 12px 15px;
      background: #f5f8f5;
      border-radius: 10px;
    }

    .gt-evento-item {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #e1e8e2;
    }

    .gt-evento-item:last-child {
      border-bottom: 0;
    }

    .gt-evento-icono {
      font-size: 23px;
    }

    .gt-evento-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gt-evento-info span,
    .gt-evento-info small {
      color: #66746a;
      font-size: 12px;
    }

    .gt-sin-historial {
      padding: 15px;
      color: #66746a;
    }

    @media (max-width: 650px) {
      .gt-avatar {
        width: 34px;
        height: 34px;
      }

      .gt-jugador {
        min-width: 150px;
      }

      .gt-grupo-genero small {
        float: none;
        display: block;
        margin-top: 4px;
      }
    }
  `;

  document.head.appendChild(estilo);
}

// =====================================================
// EVENTOS
// =====================================================

function configurarEventos() {
  [
    "filtroCategoria",
    "filtroEquipo",
    "buscarJugador"
  ].forEach((id) => {
    $(id)?.addEventListener("input", renderizar);
    $(id)?.addEventListener("change", renderizar);
  });

  $("btnActualizar")?.addEventListener("click", iniciar);

  document.querySelectorAll("[data-pestana]").forEach((boton) => {
    boton.addEventListener("click", () => {
      cambiarVista(boton.dataset.pestana);
    });
  });

  $("btnGoleadores")?.addEventListener("click", () => {
    cambiarVista("goleadores");
  });

  $("btnTarjetas")?.addEventListener("click", () => {
    cambiarVista("tarjetas");
  });
}

// =====================================================
// INICIO
// =====================================================

async function iniciar() {
  const boton = $("btnActualizar");

  try {
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Cargando...";
    }

    await cargarDatos();

    llenarFiltros();
    agregarEstilos();
    renderizar();

    cambiarVista(estado.vista);

    console.log("Goleadores y tarjetas cargados correctamente.");
  } catch (error) {
    console.error(error);

    alert(
      "No se pudieron cargar los datos: " +
      (error.message || error)
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = "Actualizar";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  configurarEventos();
  iniciar();
});
