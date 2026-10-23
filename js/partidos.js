
import { supabase } from './supabase.js';

console.log('✅ partidos.js público cargado');

// =====================================================
// ELEMENTOS HTML
// =====================================================

const filtroDisciplina = document.getElementById('filtroDisciplina');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroEstado = document.getElementById('filtroEstado');
const filtroFase = document.getElementById('filtroFase');

const listaPartidos = document.getElementById('listaPartidos');
const totalResultados = document.getElementById('totalResultados');

const statTotal = document.getElementById('statTotal');
const statProgramados = document.getElementById('statProgramados');
const statEnJuego = document.getElementById('statEnJuego');
const statFinalizados = document.getElementById('statFinalizados');

// =====================================================
// ESTADO DEL MÓDULO
// =====================================================

let partidos = [];
let cargando = false;

// =====================================================
// UTILIDADES
// =====================================================

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caracter]);
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function textoEstado(estado) {
    const valor = normalizar(estado);

    const estados = {
        PROGRAMADO: 'Programado',
        PROGRAMADA: 'Programado',
        PENDIENTE: 'Pendiente',
        EN_JUEGO: 'En juego',
        EN_CURSO: 'En curso',
        FINALIZADO: 'Finalizado',
        FINALIZADA: 'Finalizado',
        SUSPENDIDO: 'Suspendido',
        APLAZADO: 'Aplazado',
        CANCELADO: 'Cancelado'
    };

    return estados[valor] || estado || 'Por definir';
}

function claseEstado(estado) {
    const valor = normalizar(estado);

    if (['FINALIZADO', 'FINALIZADA'].includes(valor)) {
        return 'finalizado';
    }

    if (['EN_JUEGO', 'EN_CURSO'].includes(valor)) {
        return 'enjuego';
    }

    if (['SUSPENDIDO', 'CANCELADO'].includes(valor)) {
        return 'suspendido';
    }

    return 'programado';
}

function formatearFecha(fecha) {
    if (!fecha) return 'Fecha por definir';

    const partes = String(fecha).split('-');

    if (partes.length !== 3) {
        return escaparHTML(fecha);
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearHora(hora) {
    if (!hora) return 'Hora por definir';

    return String(hora).slice(0, 5);
}

// =====================================================
// OBTENER INFORMACIÓN DE LOS EQUIPOS
// =====================================================

function obtenerEquipo(inscripcion) {
    if (!inscripcion) return null;

    return Array.isArray(inscripcion.equipo)
        ? inscripcion.equipo[0]
        : inscripcion.equipo;
}

function nombreEquipo(inscripcion) {
    const equipo = obtenerEquipo(inscripcion);

    return equipo?.nombre || 'Equipo por definir';
}


function logoEquipo(inscripcion) {
    const equipo = obtenerEquipo(inscripcion);
    const nombre = equipo?.nombre || 'Equipo';
    const logo = equipo?.logo;

    const iniciales = nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(palabra => palabra.charAt(0))
        .join('')
        .toUpperCase();

    const respaldo = `
        <div class="logo-equipo-fallback">
            ${escaparHTML(iniciales || 'E')}
        </div>
    `;

    if (!logo) return respaldo;

    return `
        <div class="logo-equipo-contenedor">
            <img
                class="logo-equipo"
                src="${escaparHTML(logo)}"
                alt="Escudo ${escaparHTML(nombre)}"
                loading="lazy"
                onerror="this.hidden=true;
                    this.nextElementSibling.hidden=false;"
            >
            <div class="logo-equipo-fallback" hidden>
                ${escaparHTML(iniciales || 'E')}
            </div>
        </div>
    `;
}


// =====================================================
// OBTENER INFORMACIÓN DE FASE Y COMPETENCIA
// =====================================================

function obtenerNombreFase(partido) {
    const fase = Array.isArray(partido.fase)
        ? partido.fase[0]
        : partido.fase;

    return fase?.nombre || 'Fase por definir';
}

function obtenerDisciplina(partido) {
    const competencia = partido.competencia;

    const disciplina = Array.isArray(competencia?.disciplina)
        ? competencia.disciplina[0]
        : competencia?.disciplina;

    return disciplina?.nombre || 'Disciplina';
}

function obtenerCategoria(partido) {
    const competencia = partido.competencia;

    const categoria = Array.isArray(competencia?.categoria)
        ? competencia.categoria[0]
        : competencia?.categoria;

    return categoria?.nombre || 'Categoría';
}

// =====================================================
// CARGAR PARTIDOS DESDE SUPABASE
// =====================================================

async function cargarPartidos() {
    if (cargando) return;

    cargando = true;

    try {
        if (listaPartidos && partidos.length === 0) {
            listaPartidos.innerHTML = `
                <div class="mensaje-partidos">
                    Cargando partidos...
                </div>
            `;
        }

        // 1. Cargar fases existentes.
        const { data: fases, error: errorFases } = await supabase
            .from('fase')
            .select('id, competencia_id, nombre, tipo, orden')
            .order('orden', { ascending: true });

        if (errorFases) throw errorFases;

        if (!fases || fases.length === 0) {
            partidos = [];
            actualizarFiltros();
            mostrarPartidos();
            return;
        }

        const idsFases = fases.map(fase => fase.id);

        // 2. Cargar partidos de esas fases.
        const { data: partidosDB, error: errorPartidos } = await supabase
            .from('partido')
            .select(`
                id,
                fase_id,
                equipo_local_id,
                equipo_visitante_id,
                fecha,
                hora,
                cancha,
                estado,
                observacion
            `)
            .in('fase_id', idsFases)
            .order('fecha', { ascending: true });

        if (errorPartidos) throw errorPartidos;

        const listaBase = partidosDB || [];

        // Si todavía no existen partidos, mostrar la página vacía.
        if (listaBase.length === 0) {
            partidos = [];
            actualizarFiltros();
            mostrarPartidos();
            return;
        }

        // 3. Obtener IDs de las inscripciones participantes.
        // Los IDs de los partidos corresponden a inscripcion_equipo.
        const idsInscripciones = [
            ...new Set(
                listaBase.flatMap(partido => [
                    partido.equipo_local_id,
                    partido.equipo_visitante_id
                ]).filter(id => id !== null && id !== undefined)
            )
        ];

        // 4. Cargar nombres y logos de los equipos.
        let inscripciones = [];

        if (idsInscripciones.length > 0) {
            const { data, error } = await supabase
                .from('inscripcion_equipo')
                .select(`
                    id,
                    competencia_id,
                    equipo_id,
                    equipo:equipo_id (
                        id,
                        nombre,
                        logo
                    )
                `)
                .in('id', idsInscripciones);

            if (error) throw error;

            inscripciones = data || [];
        }

        // 5. Obtener las competencias de las fases.
        const idsCompetencias = [
            ...new Set(
                fases
                    .map(fase => fase.competencia_id)
                    .filter(id => id !== null && id !== undefined)
            )
        ];

        let competencias = [];

        if (idsCompetencias.length > 0) {
            const { data, error } = await supabase
                .from('competencia')
                .select(`
                    id,
                    disciplina:disciplina_id (
                        id,
                        nombre
                    ),
                    categoria:categoria_id (
                        id,
                        nombre
                    )
                `)
                .in('id', idsCompetencias);

            if (error) throw error;

            competencias = data || [];
        }

        // 6. Crear mapas para relacionar los datos.
        const mapaFases = new Map(
            fases.map(fase => [String(fase.id), fase])
        );

        const mapaInscripciones = new Map(
            inscripciones.map(inscripcion => [
                String(inscripcion.id),
                inscripcion
            ])
        );

        const mapaCompetencias = new Map(
            competencias.map(competencia => [
                String(competencia.id),
                competencia
            ])
        );

        // 7. Combinar información de partidos, fases y equipos.
        partidos = listaBase.map(partido => {
            const fase = mapaFases.get(String(partido.fase_id));

            const competencia = fase
                ? mapaCompetencias.get(String(fase.competencia_id))
                : null;

            return {
                ...partido,
                fase: fase || null,
                competencia: competencia || null,
                inscripcionLocal:
                    mapaInscripciones.get(
                        String(partido.equipo_local_id)
                    ) || null,
                inscripcionVisitante:
                    mapaInscripciones.get(
                        String(partido.equipo_visitante_id)
                    ) || null
            };
        });

        actualizarFiltros();
        mostrarPartidos();

        console.log(`✅ Se cargaron ${partidos.length} partidos públicos`);

    } catch (error) {
        console.error('❌ Error al cargar partidos:', error);

        if (listaPartidos) {
            listaPartidos.innerHTML = `
                <div class="mensaje-partidos error">
                    <h3>No se pudieron cargar los partidos</h3>
                    <p>
                        Comprueba la conexión con Supabase
                        y los permisos de lectura de las tablas.
                    </p>
                </div>
            `;
        }

        if (totalResultados) {
            totalResultados.textContent = 'Error al cargar los resultados';
        }

    } finally {
        cargando = false;
    }
}

// =====================================================
// LLENAR FILTROS
// =====================================================

function llenarFiltro(elemento, valores, textoInicial) {
    if (!elemento) return;

    const seleccionActual = elemento.value;

    const valoresUnicos = [...new Set(
        valores.filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));

    elemento.innerHTML = `
        <option value="">${escaparHTML(textoInicial)}</option>
        ${valoresUnicos.map(valor => `
            <option value="${escaparHTML(valor)}">
                ${escaparHTML(valor)}
            </option>
        `).join('')}
    `;

    if (
        [...elemento.options].some(
            opcion => opcion.value === seleccionActual
        )
    ) {
        elemento.value = seleccionActual;
    }
}

function actualizarFiltros() {
    llenarFiltro(
        filtroDisciplina,
        partidos.map(partido => obtenerDisciplina(partido)),
        'Todas las disciplinas'
    );

    llenarFiltro(
        filtroCategoria,
        partidos.map(partido => obtenerCategoria(partido)),
        'Todas las categorías'
    );

    llenarFiltro(
        filtroFase,
        partidos.map(partido => obtenerNombreFase(partido)),
        'Todas las fases'
    );
}

// =====================================================
// FILTRAR PARTIDOS
// =====================================================

function obtenerPartidosFiltrados() {
    const disciplinaSeleccionada = normalizar(
        filtroDisciplina?.value
    );

    const categoriaSeleccionada = normalizar(
        filtroCategoria?.value
    );

    const estadoSeleccionado = normalizar(
        filtroEstado?.value
    );

    const faseSeleccionada = normalizar(
        filtroFase?.value
    );

    return partidos.filter(partido => {
        const coincideDisciplina =
            !disciplinaSeleccionada ||
            normalizar(obtenerDisciplina(partido)) ===
                disciplinaSeleccionada;

        const coincideCategoria =
            !categoriaSeleccionada ||
            normalizar(obtenerCategoria(partido)) ===
                categoriaSeleccionada;

        const coincideEstado =
            !estadoSeleccionado ||
            normalizar(partido.estado) === estadoSeleccionado;

        const coincideFase =
            !faseSeleccionada ||
            normalizar(obtenerNombreFase(partido)) ===
                faseSeleccionada;

        return coincideDisciplina &&
            coincideCategoria &&
            coincideEstado &&
            coincideFase;
    });
}

// =====================================================
// MOSTRAR PARTIDOS
// =====================================================

function mostrarPartidos() {
    if (!listaPartidos) return;

    const filtrados = obtenerPartidosFiltrados();

    actualizarEstadisticas(filtrados);

    if (totalResultados) {
        totalResultados.textContent =
            `${filtrados.length} partido${filtrados.length === 1 ? '' : 's'}`;
    }

    if (filtrados.length === 0) {
        listaPartidos.innerHTML = `
            <div class="mensaje-partidos">
                <h3>No hay partidos disponibles</h3>
                <p>
                    Prueba con otros filtros o vuelve más tarde.
                </p>
            </div>
        `;
        return;
    }

    listaPartidos.innerHTML = filtrados.map(partido => {
        const local = nombreEquipo(partido.inscripcionLocal);
        const visitante = nombreEquipo(partido.inscripcionVisitante);

        const estado = textoEstado(partido.estado);
        const clase = claseEstado(partido.estado);

        const fase = obtenerNombreFase(partido);
        const disciplina = obtenerDisciplina(partido);
        const categoria = obtenerCategoria(partido);

        return `
            <article class="partido-card">

                <div class="partido-cabecera">
                    <span class="partido-disciplina">
                        ${escaparHTML(disciplina)}
                    </span>

                    <span class="partido-categoria">
                        ${escaparHTML(categoria)}
                    </span>

                    <span class="partido-estado ${clase}">
                        ${escaparHTML(estado)}
                    </span>
                </div>

                <div class="partido-fase">
                    ${escaparHTML(fase)}
                </div>

                <div class="partido-enfrentamiento">

                    <div class="partido-equipo local">
                        ${logoEquipo(partido.inscripcionLocal)}

                        <span class="equipo-nombre">
                            ${escaparHTML(local)}
                        </span>

                        <small>LOCAL</small>
                    </div>

                    <div class="partido-vs">VS</div>

                    <div class="partido-equipo visitante">
                        ${logoEquipo(partido.inscripcionVisitante)}

                        <span class="equipo-nombre">
                            ${escaparHTML(visitante)}
                        </span>

                        <small>VISITANTE</small>
                    </div>

                </div>

                <div class="partido-detalles">
                    <span>
                        📅 ${escaparHTML(formatearFecha(partido.fecha))}
                    </span>

                    <span>
                        🕒 ${escaparHTML(formatearHora(partido.hora))}
                    </span>

                    <span>
                        📍 ${escaparHTML(
                            partido.cancha || 'Cancha por definir'
                        )}
                    </span>
                </div>

                ${partido.observacion ? `
                    <div class="partido-observacion">
                        ${escaparHTML(partido.observacion)}
                    </div>
                ` : ''}

            </article>
        `;
    }).join('');
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

function actualizarEstadisticas(filtrados = obtenerPartidosFiltrados()) {
    if (statTotal) {
        statTotal.textContent = filtrados.length;
    }

    if (statProgramados) {
        statProgramados.textContent = filtrados.filter(partido =>
            [
                'PROGRAMADO',
                'PROGRAMADA',
                'PENDIENTE'
            ].includes(normalizar(partido.estado))
        ).length;
    }

    if (statEnJuego) {
        statEnJuego.textContent = filtrados.filter(partido =>
            [
                'EN_JUEGO',
                'EN_CURSO'
            ].includes(normalizar(partido.estado))
        ).length;
    }

    if (statFinalizados) {
        statFinalizados.textContent = filtrados.filter(partido =>
            [
                'FINALIZADO',
                'FINALIZADA'
            ].includes(normalizar(partido.estado))
        ).length;
    }
}

// =====================================================
// EVENTOS DE FILTROS
// =====================================================

[
    filtroDisciplina,
    filtroCategoria,
    filtroEstado,
    filtroFase
].forEach(filtro => {
    if (filtro) {
        filtro.addEventListener('change', mostrarPartidos);
    }
});

// =====================================================
// INICIO Y ACTUALIZACIÓN AUTOMÁTICA
// =====================================================

cargarPartidos();

// Actualizar cada 30 segundos sin recargar toda la página.
setInterval(cargarPartidos, 30000);
