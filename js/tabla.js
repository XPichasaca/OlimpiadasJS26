
import { supabase } from './supabase.js';

console.log('✅ tabla.js cargado');

const contenedor = document.getElementById('listaTablas');
const estadoTabla = document.getElementById('estadoTabla');
const btnActualizar = document.getElementById('btnActualizarTabla');

let cargando = false;

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function obtenerRelacion(valor) {
    return Array.isArray(valor) ? valor[0] : valor;
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caracter]);
}

function esFinalizado(estado) {
    return ['FINALIZADO', 'FINALIZADA'].includes(normalizar(estado));
}

function tieneMarcador(partido) {
    return partido.goles_local !== null
        && partido.goles_local !== undefined
        && partido.goles_visitante !== null
        && partido.goles_visitante !== undefined
        && Number.isFinite(Number(partido.goles_local))
        && Number.isFinite(Number(partido.goles_visitante));
}

function obtenerGrupo(observacion) {
    const coincidencia = String(observacion ?? '')
        .match(/\bgrupo\s+([a-z0-9]+)\b/i);

    return coincidencia
        ? `Grupo ${coincidencia[1].toUpperCase()}`
        : 'Grupo por verificar';
}

function obtenerGenero(competencia) {
    const genero = obtenerRelacion(competencia?.genero);
    const nombre = normalizar(genero?.nombre);

    if (['FEMENINO', 'FEMENINA', 'FEM'].includes(nombre)) {
        return 'Femenino';
    }

    if (['MASCULINO', 'MASCULINA', 'MASC'].includes(nombre)) {
        return 'Masculino';
    }

    return 'Género por verificar';
}

function clave(...valores) {
    return valores.map(valor => String(valor ?? '')).join('::');
}

function crearFila(inscripcion, competencia, grupo) {
    const equipo = obtenerRelacion(inscripcion.equipo);
    const disciplina = obtenerRelacion(competencia?.disciplina);
    const categoria = obtenerRelacion(competencia?.categoria);

    return {
        inscripcionId: String(inscripcion.id),
        competenciaId: String(inscripcion.competencia_id),
        equipo: equipo?.nombre || 'Equipo por definir',
        disciplina: disciplina?.nombre || 'Disciplina por verificar',
        categoria: categoria?.nombre || 'Categoría por verificar',
        genero: obtenerGenero(competencia),
        grupo,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        pts: 0
    };
}

function compararEquipos(a, b) {
    return (b.pts - a.pts)
        || ((b.gf - b.gc) - (a.gf - a.gc))
        || (b.gf - a.gf)
        || (b.pg - a.pg)
        || a.equipo.localeCompare(b.equipo, 'es');
}

function actualizarEstadisticas(local, visitante, golesLocal, golesVisitante) {
    local.pj++;
    visitante.pj++;

    local.gf += golesLocal;
    local.gc += golesVisitante;

    visitante.gf += golesVisitante;
    visitante.gc += golesLocal;

    if (golesLocal > golesVisitante) {
        local.pg++;
        local.pts += 3;
        visitante.pp++;
    } else if (golesLocal < golesVisitante) {
        visitante.pg++;
        visitante.pts += 3;
        local.pp++;
    } else {
        local.pe++;
        visitante.pe++;
        local.pts++;
        visitante.pts++;
    }
}

function insertarEstilos() {
    if (document.getElementById('estilosTablaPosiciones')) return;

    const estilo = document.createElement('style');
    estilo.id = 'estilosTablaPosiciones';

    estilo.textContent = `
        .tp-grupo {
            margin: 20px 0;
            padding: 16px;
            background: #191f19;
            border: 1px solid #3a4538;
            border-radius: 13px;
        }

        .tp-titulo {
            color: #e3bd56;
            margin: 0 0 5px;
            font-size: 1.2rem;
        }

        .tp-subtitulo {
            margin: 0 0 14px;
            color: #b9c1b8;
            font-size: .9rem;
        }

        .tp-nota {
            margin: 10px 0;
            color: #e3bd56;
            font-size: .85rem;
        }

        .tp-tabla-contenedor {
            overflow-x: auto;
        }

        .tp-tabla {
            width: 100%;
            min-width: 720px;
            border-collapse: collapse;
            font-size: .9rem;
        }

        .tp-tabla th {
            padding: 11px 9px;
            background: #222a22;
            color: #e3bd56;
            white-space: nowrap;
            text-align: center;
        }

        .tp-tabla td {
            padding: 11px 9px;
            border-bottom: 1px solid #303830;
            text-align: center;
        }

        .tp-tabla td:nth-child(2) {
            text-align: left;
            font-weight: bold;
        }

        .tp-tabla tbody tr:hover {
            background: #222a22;
        }

        .tp-posicion {
            color: #e3bd56;
            font-weight: bold;
        }

        .tp-puntos {
            color: #e3bd56;
            font-weight: bold;
        }

        .tp-mensaje {
            padding: 18px;
            background: #191f19;
            border: 1px solid #3a4538;
            border-radius: 10px;
            color: #b9c1b8;
        }

        .tp-error {
            color: #ffb5a8;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
    `;

    document.head.appendChild(estilo);
}

function mostrarMensaje(mensaje, error = false) {
    contenedor.innerHTML = `
        <div class="tp-mensaje ${error ? 'tp-error' : ''}">
            ${escaparHTML(mensaje)}
        </div>
    `;
}

async function cargarTabla() {
    if (cargando || !contenedor) return;

    cargando = true;

    if (btnActualizar) {
        btnActualizar.disabled = true;
        btnActualizar.textContent = 'Actualizando...';
    }

    if (estadoTabla) {
        estadoTabla.textContent = 'Consultando Supabase...';
    }

    mostrarMensaje('Cargando equipos y resultados...');

    try {
        // 1. Obtener fases.
        const { data: fases, error: errorFases } = await supabase
            .from('fase')
            .select('id, competencia_id, nombre, tipo, orden')
            .order('orden', { ascending: true });

        if (errorFases) throw errorFases;

        if (!fases?.length) {
            mostrarMensaje('No se encontraron fases registradas.');
            return;
        }

        const idsFases = fases.map(fase => fase.id);

        // 2. Obtener partidos.
        const { data: partidosDB, error: errorPartidos } = await supabase
            .from('partido')
            .select(`
                id,
                fase_id,
                equipo_local_id,
                equipo_visitante_id,
                estado,
                observacion,
                goles_local,
                goles_visitante
            `)
            .in('fase_id', idsFases);

        if (errorPartidos) throw errorPartidos;

        const partidos = partidosDB || [];

        // 3. Obtener competencias.
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
                    disciplina:disciplina_id (id, nombre),
                    categoria:categoria_id (id, nombre),
                    genero:genero_id (id, nombre)
                `)
                .in('id', idsCompetencias);

            if (error) throw error;

            competencias = data || [];
        }

        // 4. Obtener todas las inscripciones de las competencias.
        let inscripciones = [];

        if (idsCompetencias.length) {
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
                .in('competencia_id', idsCompetencias);

            if (error) throw error;

            inscripciones = data || [];
        }

        const mapaFases = new Map(
            fases.map(fase => [String(fase.id), fase])
        );

        const mapaCompetencias = new Map(
            competencias.map(competencia => [
                String(competencia.id),
                competencia
            ])
        );

        const mapaInscripciones = new Map(
            inscripciones.map(inscripcion => [
                String(inscripcion.id),
                inscripcion
            ])
        );

        // 5. Determinar grupos usando la observación de los partidos.
        // Si hay contradicciones, no se asigna un grupo arbitrariamente.
        const gruposPorInscripcion = new Map();

        for (const partido of partidos) {
            const grupo = obtenerGrupo(partido.observacion);

            if (grupo === 'Grupo por verificar') continue;

            for (const id of [
                partido.equipo_local_id,
                partido.equipo_visitante_id
            ]) {
                if (id === null || id === undefined) continue;

                const inscripcion = mapaInscripciones.get(String(id));
                if (!inscripcion) continue;

                const llave = clave(inscripcion.id, inscripcion.competencia_id);
                const anterior = gruposPorInscripcion.get(llave);

                if (!anterior) {
                    gruposPorInscripcion.set(llave, grupo);
                } else if (anterior !== grupo) {
                    gruposPorInscripcion.set(
                        llave,
                        'Grupo por verificar'
                    );
                }
            }
        }

        // 6. Crear una fila para cada inscripción.
        const tabla = new Map();

        for (const inscripcion of inscripciones) {
            const competencia = mapaCompetencias.get(
                String(inscripcion.competencia_id)
            );

            const grupo = gruposPorInscripcion.get(
                clave(inscripcion.id, inscripcion.competencia_id)
            ) || 'Grupo por verificar';

            const fila = crearFila(inscripcion, competencia, grupo);

            tabla.set(
                clave(fila.inscripcionId, fila.competenciaId, grupo),
                fila
            );
        }

        // 7. Calcular estadísticas de partidos finalizados.
        for (const partido of partidos) {
            if (!esFinalizado(partido.estado) || !tieneMarcador(partido)) {
                continue;
            }

            const fase = mapaFases.get(String(partido.fase_id));
            if (!fase) continue;

            const competenciaId = String(fase.competencia_id);

            const local = mapaInscripciones.get(
                String(partido.equipo_local_id)
            );

            const visitante = mapaInscripciones.get(
                String(partido.equipo_visitante_id)
            );

            if (!local || !visitante) continue;

            if (
                String(local.competencia_id) !== competenciaId ||
                String(visitante.competencia_id) !== competenciaId
            ) {
                continue;
            }

            const grupoPartido = obtenerGrupo(partido.observacion);

            const grupoLocal = gruposPorInscripcion.get(
                clave(local.id, local.competencia_id)
            ) || 'Grupo por verificar';

            const grupoVisitante = gruposPorInscripcion.get(
                clave(visitante.id, visitante.competencia_id)
            ) || 'Grupo por verificar';

            // Si el grupo se identifica en la observación, ambos equipos
            // deben corresponder a ese mismo grupo para sumar el resultado.
            if (grupoPartido !== 'Grupo por verificar') {
                if (
                    grupoLocal !== grupoPartido ||
                    grupoVisitante !== grupoPartido
                ) {
                    console.warn(
                        'Partido omitido por discrepancia de grupo:',
                        partido.id
                    );
                    continue;
                }
            }

            const filaLocal = tabla.get(
                clave(local.id, competenciaId, grupoLocal)
            );

            const filaVisitante = tabla.get(
                clave(visitante.id, competenciaId, grupoVisitante)
            );

            if (!filaLocal || !filaVisitante) continue;

            actualizarEstadisticas(
                filaLocal,
                filaVisitante,
                Number(partido.goles_local),
                Number(partido.goles_visitante)
            );
        }

        mostrarTablas([...tabla.values()]);

        if (estadoTabla) {
            estadoTabla.textContent =
                `Actualizado: ${new Date().toLocaleTimeString('es-EC', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}`;
        }

        console.log('✅ Inscripciones procesadas:', inscripciones.length);
        console.log('✅ Partidos consultados:', partidos.length);

    } catch (error) {
        console.error('❌ Error al cargar posiciones:', error);

        mostrarMensaje(
            `No se pudo cargar la tabla de posiciones.\n\n${error.message || error}`,
            true
        );

        if (estadoTabla) {
            estadoTabla.textContent = 'Error al consultar las posiciones.';
        }
    } finally {
        cargando = false;

        if (btnActualizar) {
            btnActualizar.disabled = false;
            btnActualizar.textContent = '↻ Actualizar posiciones';
        }
    }
}

function mostrarTablas(filas) {
    if (!filas.length) {
        mostrarMensaje(
            'No hay equipos inscritos en las competencias consultadas.'
        );
        return;
    }

    // Separar por disciplina, categoría, género y grupo.
    const agrupaciones = new Map();

    for (const fila of filas) {
        const llave = clave(
            fila.disciplina,
            fila.categoria,
            fila.genero,
            fila.grupo
        );

        if (!agrupaciones.has(llave)) {
            agrupaciones.set(llave, {
                disciplina: fila.disciplina,
                categoria: fila.categoria,
                genero: fila.genero,
                grupo: fila.grupo,
                equipos: []
            });
        }

        agrupaciones.get(llave).equipos.push(fila);
    }

    const contenido = [...agrupaciones.values()]
        .sort((a, b) =>
            a.disciplina.localeCompare(b.disciplina, 'es')
            || a.categoria.localeCompare(b.categoria, 'es')
            || a.genero.localeCompare(b.genero, 'es')
            || a.grupo.localeCompare(b.grupo, 'es')
        )
        .map(grupo => {
            const equipos = [...grupo.equipos].sort(compararEquipos);

            const filasHTML = equipos.map((equipo, indice) => `
                <tr>
                    <td class="tp-posicion">${indice + 1}</td>
                    <td>${escaparHTML(equipo.equipo)}</td>
                    <td>${equipo.pj}</td>
                    <td>${equipo.pg}</td>
                    <td>${equipo.pe}</td>
                    <td>${equipo.pp}</td>
                    <td>${equipo.gf}</td>
                    <td>${equipo.gc}</td>
                    <td>${equipo.gf - equipo.gc}</td>
                    <td class="tp-puntos">${equipo.pts}</td>
                </tr>
            `).join('');

            return `
                <section class="tp-grupo">
                    <h3 class="tp-titulo">
                        ${escaparHTML(grupo.disciplina)}
                        · ${escaparHTML(grupo.categoria)}
                    </h3>

                    <p class="tp-subtitulo">
                        ${escaparHTML(grupo.genero)}
                        · ${escaparHTML(grupo.grupo)}
                    </p>

                    ${grupo.grupo === 'Grupo por verificar' ? `
                        <p class="tp-nota">
                            No se ha podido confirmar el grupo desde las
                            observaciones de los partidos.
                        </p>
                    ` : ''}

                    <div class="tp-tabla-contenedor">
                        <table class="tp-tabla">
                            <thead>
                                <tr>
                                    <th>Pos.</th>
                                    <th>Equipo</th>
                                    <th>PJ</th>
                                    <th>PG</th>
                                    <th>PE</th>
                                    <th>PP</th>
                                    <th>GF</th>
                                    <th>GC</th>
                                    <th>DG</th>
                                    <th>Pts.</th>
                                </tr>
                            </thead>
                            <tbody>${filasHTML}</tbody>
                        </table>
                    </div>
                </section>
            `;
        }).join('');

    contenedor.innerHTML = contenido;
}

insertarEstilos();

btnActualizar?.addEventListener('click', cargarTabla);

cargarTabla();
