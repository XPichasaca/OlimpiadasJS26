
import { supabase } from './supabase.js';

console.log('✅ partidos.js cargado');

// =====================================================
// ELEMENTOS HTML
// =====================================================

const filtroEquipo = document.getElementById('filtroEquipo');
const filtroFase = document.getElementById('filtroFase');
const filtroGenero = document.getElementById('filtroGenero');

const btnLimpiar = document.getElementById('btnLimpiar');
const btnActualizar = document.getElementById('btnActualizar');

const listaPartidos = document.getElementById('listaPartidos');
const totalResultados = document.getElementById('totalResultados');
const mensajeGeneral = document.getElementById('mensajeGeneral');
const ultimaActualizacion = document.getElementById('ultimaActualizacion');

const statTotal = document.getElementById('statTotal');
const statProgramados = document.getElementById('statProgramados');
const statEnJuego = document.getElementById('statEnJuego');
const statFinalizados = document.getElementById('statFinalizados');

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

function obtenerRelacion(relacion) {
    return Array.isArray(relacion) ? relacion[0] : relacion;
}

function formatearFecha(fecha) {
    if (!fecha) return 'Fecha por definir';

    const partes = String(fecha).slice(0, 10).split('-');

    if (partes.length !== 3) return String(fecha);

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearHora(hora) {
    if (!hora) return 'Hora por definir';
    return String(hora).slice(0, 5);
}

function obtenerDiaSemana(fecha) {
    if (!fecha) return 'SIN_FECHA';

    const partes = String(fecha).slice(0, 10).split('-');

    if (partes.length !== 3) return 'SIN_FECHA';

    const anio = Number(partes[0]);
    const mes = Number(partes[1]);
    const dia = Number(partes[2]);

    const fechaLocal = new Date(anio, mes - 1, dia);

    if (
        Number.isNaN(fechaLocal.getTime()) ||
        fechaLocal.getFullYear() !== anio ||
        fechaLocal.getMonth() !== mes - 1 ||
        fechaLocal.getDate() !== dia
    ) {
        return 'SIN_FECHA';
    }

    return [
        'DOMINGO',
        'LUNES',
        'MARTES',
        'MIERCOLES',
        'JUEVES',
        'VIERNES',
        'SABADO'
    ][fechaLocal.getDay()];
}

function ordenarPorFechaHora(a, b) {
    const fechaA = a.fecha || '9999-12-31';
    const fechaB = b.fecha || '9999-12-31';

    const comparacionFecha = fechaA.localeCompare(fechaB);

    if (comparacionFecha !== 0) return comparacionFecha;

    const horaA = a.hora || '23:59:59';
    const horaB = b.hora || '23:59:59';

    return horaA.localeCompare(horaB);
}

function textoEstado(estado) {
    const valor = normalizar(estado);

    const estados = {
        PROGRAMADO: 'Programado',
        PROGRAMADA: 'Programado',
        PENDIENTE: 'Pendiente',
        EN_VIVO: 'En vivo',
        EN_JUEGO: 'En juego',
        EN_CURSO: 'En curso',
        FINALIZADO: 'Finalizado',
        FINALIZADA: 'Finalizado',
        SUSPENDIDO: 'Suspendido',
        SUSPENDIDA: 'Suspendido',
        CANCELADO: 'Cancelado'
    };

    return estados[valor] || estado || 'Por definir';
}

function claseEstado(estado) {
    const valor = normalizar(estado);

    if (['FINALIZADO', 'FINALIZADA'].includes(valor)) {
        return 'finalizado';
    }

    if (['EN_VIVO', 'EN_JUEGO', 'EN_CURSO'].includes(valor)) {
        return 'enjuego';
    }

    if (['SUSPENDIDO', 'SUSPENDIDA', 'CANCELADO'].includes(valor)) {
        return 'suspendido';
    }

    return 'programado';
}

// =====================================================
// EQUIPOS Y ESCUDOS
// =====================================================

function obtenerEquipo(inscripcion) {
    if (!inscripcion) return null;
    return obtenerRelacion(inscripcion.equipo);
}

function nombreEquipo(inscripcion) {
    return obtenerEquipo(inscripcion)?.nombre || 'Equipo por definir';
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
                alt="Escudo de ${escaparHTML(nombre)}"
                loading="lazy"
                onerror="
                    this.hidden=true;
                    this.nextElementSibling.hidden=false;
                "
            >
            <div class="logo-equipo-fallback" hidden>
                ${escaparHTML(iniciales || 'E')}
            </div>
        </div>
    `;
}

// =====================================================
// COMPETENCIA, CATEGORÍA Y GÉNERO
// =====================================================

function obtenerCompetencia(partido) {
    return obtenerRelacion(partido.competencia);
}

function obtenerDisciplina(partido) {
    const competencia = obtenerCompetencia(partido);
    const disciplina = obtenerRelacion(competencia?.disciplina);

    return disciplina?.nombre || 'Disciplina';
}

function obtenerCategoria(partido) {
    const competencia = obtenerCompetencia(partido);
    const categoria = obtenerRelacion(competencia?.categoria);

    return categoria?.nombre || 'Categoría';
}

function obtenerNombreFase(partido) {
    const fase = obtenerRelacion(partido.fase);
    return fase?.nombre || 'Fase por definir';
}

function obtenerGenero(partido) {
    const competencia = obtenerCompetencia(partido);
    const genero = obtenerRelacion(competencia?.genero);
    const nombre = normalizar(genero?.nombre);

    if (['FEMENINO', 'FEMENINA', 'FEM'].includes(nombre)) {
        return 'FEMENINO';
    }

    if (['MASCULINO', 'MASCULINA', 'MASC'].includes(nombre)) {
        return 'MASCULINO';
    }

    return 'SIN_GENERO';
}

function textoGenero(partido) {
    const genero = obtenerGenero(partido);

    if (genero === 'FEMENINO') return 'Femenino';
    if (genero === 'MASCULINO') return 'Masculino';

    return 'Género por verificar';
}

// =====================================================
// CONSULTAR PARTIDOS EN SUPABASE
// =====================================================

async function cargarPartidos() {
    if (cargando) return;

    cargando = true;

    if (btnActualizar) {
        btnActualizar.disabled = true;
        btnActualizar.textContent = 'Actualizando...';
    }

    try {
        mostrarMensaje('Consultando calendario...');

        // 1. Consultar las fases.
        const { data: fases, error: errorFases } = await supabase
            .from('fase')
            .select('id, competencia_id, nombre, tipo, orden')
            .order('orden', { ascending: true });

        if (errorFases) throw errorFases;

        if (!fases?.length) {
            partidos = [];
            actualizarFiltros();
            mostrarPartidos();
            actualizarHoraCarga();
            return;
        }

        const idsFases = fases.map(fase => fase.id);

        // 2. Consultar partidos, incluyendo los resultados.
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
                observacion,
                goles_local,
                goles_visitante
            `)
            .in('fase_id', idsFases);

        if (errorPartidos) throw errorPartidos;

        const partidosDBLista = partidosDB || [];

        if (!partidosDBLista.length) {
            partidos = [];
            actualizarFiltros();
            mostrarPartidos();
            actualizarHoraCarga();
            return;
        }

        // 3. Obtener inscripciones de los equipos.
        const idsInscripciones = [
            ...new Set(
                partidosDBLista.flatMap(partido => [
                    partido.equipo_local_id,
                    partido.equipo_visitante_id
                ]).filter(id => id !== null && id !== undefined)
            )
        ];

        let inscripciones = [];

        if (idsInscripciones.length) {
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

        // 4. Obtener competencias, disciplinas, categorías y géneros.
        const idsCompetencias = [
            ...new Set(
                fases
                    .map(fase => fase.competencia_id)
                    .filter(id => id !== null && id !== undefined)
            )
        ];

        let competencias = [];

        if (idsCompetencias.length) {
            const { data, error } = await supabase
                .from('competencia')
                .select(`
                    id,
                    nombre,
                    disciplina:disciplina_id (
                        id,
                        nombre
                    ),
                    categoria:categoria_id (
                        id,
                        nombre
                    ),
                    genero:genero_id (
                        id,
                        nombre
                    )
                `)
                .in('id', idsCompetencias);

            if (error) throw error;

            competencias = data || [];
        }

        // 5. Crear mapas para relacionar los datos.
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

        // 6. Unir cada partido con sus relaciones.
        partidos = partidosDBLista.map(partido => {
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
        }).sort(ordenarPorFechaHora);

        actualizarFiltros();
        mostrarPartidos();
        actualizarHoraCarga();

        console.log('✅ Partidos consultados:', partidos.length);
        console.log('📊 Resultados cargados:', partidos.map(p => ({
            id: p.id,
            local: p.goles_local,
            visitante: p.goles_visitante,
            estado: p.estado
        })));

    } catch (error) {
        console.error('❌ Error al cargar partidos:', error);

        if (listaPartidos) listaPartidos.innerHTML = '';

        if (mensajeGeneral) {
            mensajeGeneral.hidden = false;
            mensajeGeneral.textContent =
                'No se pudo cargar el calendario. Revisa la conexión con Supabase y los permisos de lectura.';
        }

    } finally {
        cargando = false;

        if (btnActualizar) {
            btnActualizar.disabled = false;
            btnActualizar.textContent = '↻ Actualizar partidos';
        }
    }
}

// =====================================================
// FILTROS AUTOMÁTICOS
// =====================================================

function llenarFiltro(elemento, valores, textoInicial) {
    if (!elemento) return;

    const seleccionado = elemento.value;

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

    if ([...elemento.options].some(
        opcion => opcion.value === seleccionado
    )) {
        elemento.value = seleccionado;
    }
}

function actualizarFiltros() {
    llenarFiltro(
        filtroFase,
        partidos.map(obtenerNombreFase),
        'Todos los grupos'
    );
}

function obtenerPartidosFiltrados() {
    const equipoBuscado = normalizar(filtroEquipo?.value);
    const fase = normalizar(filtroFase?.value);
    const genero = normalizar(filtroGenero?.value);

    return partidos.filter(partido => {
        const nombresEquipos = normalizar(
            `${nombreEquipo(partido.inscripcionLocal)} ${nombreEquipo(partido.inscripcionVisitante)}`
        );

        const coincideEquipo =
            !equipoBuscado || nombresEquipos.includes(equipoBuscado);

        const coincideFase =
            !fase || normalizar(obtenerNombreFase(partido)) === fase;

        const generoPartido = obtenerGenero(partido);
        const coincideGenero = !genero || generoPartido === genero;

        return coincideEquipo && coincideFase && coincideGenero;
    }).sort(ordenarPorFechaHora);
}

// =====================================================
// MARCADOR
// =====================================================

function tieneMarcador(partido) {
    return partido.goles_local !== null &&
        partido.goles_local !== undefined &&
        partido.goles_visitante !== null &&
        partido.goles_visitante !== undefined;
}

function crearMarcador(partido) {
    if (!tieneMarcador(partido)) {
        return '<div class="partido-vs">VS</div>';
    }

    const local = Number(partido.goles_local);
    const visitante = Number(partido.goles_visitante);

    const estado = normalizar(partido.estado);

    const etiqueta = ['FINALIZADO', 'FINALIZADA'].includes(estado)
        ? 'RESULTADO FINAL'
        : ['EN_VIVO', 'EN_JUEGO', 'EN_CURSO'].includes(estado)
            ? 'EN JUEGO'
            : 'MARCADOR';

    return `
        <div class="marcador-contenedor">
            <div class="marcador-resultado">
                <span class="marcador-gol">${escaparHTML(local)}</span>
                <span class="marcador-separador">:</span>
                <span class="marcador-gol">${escaparHTML(visitante)}</span>
            </div>
            <div class="marcador-etiqueta">
                ${etiqueta}
            </div>
        </div>
    `;
}

// =====================================================
// CREAR TARJETA DEL PARTIDO
// =====================================================

function crearTarjetaPartido(partido) {
    const local = nombreEquipo(partido.inscripcionLocal);
    const visitante = nombreEquipo(partido.inscripcionVisitante);

    const estado = textoEstado(partido.estado);
    const clase = claseEstado(partido.estado);

    const disciplina = obtenerDisciplina(partido);
    const categoria = obtenerCategoria(partido);
    const fase = obtenerNombreFase(partido);
    const genero = textoGenero(partido);

    return `
        <article class="partido-card">
            <div class="partido-cabecera">
                <span class="partido-disciplina">
                    ${escaparHTML(disciplina)}
                </span>

                <span class="partido-categoria">
                    ${escaparHTML(categoria)}
                </span>

                <span class="partido-genero ${normalizar(genero).toLowerCase()}">
                    ${escaparHTML(genero)}
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

                ${crearMarcador(partido)}

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
                    📍 ${escaparHTML(partido.cancha || 'Cancha por definir')}
                </span>
            </div>

            ${partido.observacion ? `
                <div class="partido-observacion">
                    ${escaparHTML(partido.observacion)}
                </div>
            ` : ''}
        </article>
    `;
}

// =====================================================
// MENSAJES Y ACTUALIZACIÓN
// =====================================================

function mostrarMensaje(texto) {
    if (!mensajeGeneral) return;

    mensajeGeneral.hidden = false;
    mensajeGeneral.textContent = texto;
}

function ocultarMensaje() {
    if (mensajeGeneral) mensajeGeneral.hidden = true;
}

function actualizarHoraCarga() {
    if (!ultimaActualizacion) return;

    ultimaActualizacion.textContent =
        `Última actualización: ${new Date().toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
}

// =====================================================
// MOSTRAR CALENDARIO AGRUPADO POR DÍA
// =====================================================

function mostrarPartidos() {
    const filtrados = obtenerPartidosFiltrados();

    actualizarEstadisticas(filtrados);

    if (totalResultados) {
        totalResultados.textContent =
            `${filtrados.length} partido${filtrados.length === 1 ? '' : 's'}`;
    }

    if (!listaPartidos) return;

    if (!filtrados.length) {
        listaPartidos.innerHTML = '';
        mostrarMensaje(
            'No hay partidos que coincidan con los filtros seleccionados.'
        );
        return;
    }

    const gruposPorDia = new Map();

    filtrados.forEach(partido => {
        const clave = partido.fecha
            ? String(partido.fecha).slice(0, 10)
            : 'SIN_FECHA';

        if (!gruposPorDia.has(clave)) {
            gruposPorDia.set(clave, []);
        }

        gruposPorDia.get(clave).push(partido);
    });

    const nombresDias = {
        DOMINGO: 'DOMINGO',
        LUNES: 'LUNES',
        MARTES: 'MARTES',
        MIERCOLES: 'MIÉRCOLES',
        JUEVES: 'JUEVES',
        VIERNES: 'VIERNES',
        SABADO: 'SÁBADO',
        SIN_FECHA: 'FECHA POR DEFINIR'
    };

    listaPartidos.innerHTML = [...gruposPorDia.entries()]
        .map(([fecha, encuentros]) => {
            const dia = fecha === 'SIN_FECHA'
                ? 'SIN_FECHA'
                : obtenerDiaSemana(fecha);

            const fechaTexto = fecha === 'SIN_FECHA'
                ? ''
                : formatearFecha(fecha);

            const titulo = nombresDias[dia] || 'ENCUENTROS DEPORTIVOS';

            return `
                <section class="jornada">
                    <h3 class="jornada-titulo">
                        <span>📅</span>
                        ${escaparHTML(titulo)}
                        ${fechaTexto
                            ? `<small class="fecha-jornada">${escaparHTML(fechaTexto)}</small>`
                            : ''}
                    </h3>

                    <div class="partidos-jornada">
                        ${[...encuentros]
                            .sort(ordenarPorFechaHora)
                            .map(crearTarjetaPartido)
                            .join('')}
                    </div>
                </section>
            `;
        }).join('');

    ocultarMensaje();
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

function actualizarEstadisticas(datos) {
    if (statTotal) {
        statTotal.textContent = datos.length;
    }

    if (statProgramados) {
        statProgramados.textContent = datos.filter(partido =>
            normalizar(partido.estado) === 'PROGRAMADO'
        ).length;
    }

    if (statEnJuego) {
        statEnJuego.textContent = datos.filter(partido =>
            ['EN_VIVO', 'EN_JUEGO', 'EN_CURSO'].includes(
                normalizar(partido.estado)
            )
        ).length;
    }

    if (statFinalizados) {
        statFinalizados.textContent = datos.filter(partido =>
            ['FINALIZADO', 'FINALIZADA'].includes(
                normalizar(partido.estado)
            )
        ).length;
    }
}

// =====================================================
// EVENTOS DE LOS FILTROS
// =====================================================

if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
        if (filtroEquipo) filtroEquipo.value = '';
        if (filtroFase) filtroFase.value = '';
        if (filtroGenero) filtroGenero.value = '';

        mostrarPartidos();
    });
}

if (btnActualizar) {
    btnActualizar.addEventListener('click', cargarPartidos);
}

if (filtroEquipo) {
    filtroEquipo.addEventListener('input', mostrarPartidos);
}

[filtroFase, filtroGenero].forEach(filtro => {
    if (filtro) {
        filtro.addEventListener('change', mostrarPartidos);
    }
});

// =====================================================
// INICIAR
// =====================================================

cargarPartidos();

// Actualizar automáticamente cada 30 segundos.
setInterval(() => {
    if (!document.hidden) {
        cargarPartidos();
    }
}, 30000);
