import { supabase } from './supabase.js';

console.log('✅ inscripciones.js cargado');


// ======================================================
// VARIABLES
// ======================================================

let inscripciones = [];
let equipos = [];
let capitanes = [];
let competencias = [];

let modo = 'nuevo';


// ======================================================
// ELEMENTOS
// ======================================================

const tabla =
    document.getElementById('tablaInscripciones');

const buscar =
    document.getElementById('buscar');

const filtroEstado =
    document.getElementById('filtroEstado');

const btnNueva =
    document.getElementById('btnNueva');

const modal =
    document.getElementById('modal');

const btnCerrar =
    document.getElementById('btnCerrar');

const btnCancelar =
    document.getElementById('btnCancelar');

const btnGuardar =
    document.getElementById('btnGuardar');

const inscripcionId =
    document.getElementById('inscripcionId');

const modalEquipo =
    document.getElementById('modalEquipo');

const modalCapitan =
    document.getElementById('modalCapitan');

const modalCompetencia =
    document.getElementById('modalCompetencia');

const modalEstado =
    document.getElementById('modalEstado');

const modalObservacion =
    document.getElementById('modalObservacion');

const tituloModal =
    document.getElementById('tituloModal');

const listaCompetencias =
    document.getElementById('listaCompetencias');

const contenedorCompetenciasNueva =
    document.getElementById(
        'contenedorCompetenciasNueva'
    );

const contenedorCompetenciaEditar =
    document.getElementById(
        'contenedorCompetenciaEditar'
    );

const mensaje =
    document.getElementById('mensaje');


// ======================================================
// INICIO
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    iniciar
);


async function iniciar() {

    try {

        console.log(
            '🔎 Comprobando autenticación...'
        );

        const {
            data: sessionData,
            error: sessionError
        } = await supabase.auth.getSession();


        if (sessionError) {

            throw sessionError;
        }


        if (!sessionData.session) {

            window.location.href =
                '../login.html';

            return;
        }


        console.log(
            '✅ Administrador autenticado'
        );


        await cargarDatos();

        await cargarInscripciones();

        renderizar();


    } catch (error) {

        console.error(
            '❌ Error iniciando inscripciones:',
            error
        );

        mostrarMensaje(
            error.message ||
            'No se pudo cargar la gestión de inscripciones.',
            'error'
        );
    }
}


// ======================================================
// CARGAR DATOS
// ======================================================

async function cargarDatos() {

    await Promise.all([
        cargarEquipos(),
        cargarCapitanes(),
        cargarCompetencias()
    ]);
}


// ======================================================
// EQUIPOS
// ======================================================

async function cargarEquipos() {

    const {
        data,
        error
    } = await supabase
        .from('equipo')
        .select(`
            id,
            nombre,
            activo
        `)
        .eq('activo', true)
        .order('nombre');


    if (error) {

        throw new Error(
            'Error cargando equipos: ' +
            error.message
        );
    }


    equipos = data || [];

    llenarSelectEquipos();
}


// ======================================================
// CAPITANES
// ======================================================

async function cargarCapitanes() {

    console.log(
        '🔎 Cargando capitanes...'
    );


    // --------------------------------------------------
    // Buscar rol CAPITAN
    // --------------------------------------------------

    const {
        data: roles,
        error: rolesError
    } = await supabase
        .from('rol')
        .select(`
            id,
            nombre
        `)
        .eq(
            'nombre',
            'CAPITAN'
        );


    if (rolesError) {

        throw new Error(
            'Error buscando rol CAPITAN: ' +
            rolesError.message
        );
    }


    if (!roles || roles.length === 0) {

        console.warn(
            '⚠️ No existe el rol CAPITAN'
        );

        capitanes = [];

        llenarSelectCapitanes();

        return;
    }


    const rolId =
        roles[0].id;


    // --------------------------------------------------
    // Usuarios que tienen CAPITAN
    // --------------------------------------------------

    const {
        data: relaciones,
        error: relacionesError
    } = await supabase
        .from('usuario_rol')
        .select(`
            usuario_id
        `)
        .eq(
            'rol_id',
            rolId
        );


    if (relacionesError) {

        throw new Error(
            'Error buscando capitanes: ' +
            relacionesError.message
        );
    }


    if (!relaciones || relaciones.length === 0) {

        capitanes = [];

        llenarSelectCapitanes();

        return;
    }


    const ids =
        relaciones.map(
            item => item.usuario_id
        );


    // --------------------------------------------------
    // Perfiles
    // --------------------------------------------------

    const {
        data: perfiles,
        error: perfilesError
    } = await supabase
        .from('perfil_usuario')
        .select(`
            id,
            nombres,
            apellidos,
            activo
        `)
        .in(
            'id',
            ids
        )
        .eq(
            'activo',
            true
        )
        .order('nombres');


    if (perfilesError) {

        throw new Error(
            'Error cargando perfiles de capitanes: ' +
            perfilesError.message
        );
    }


    capitanes =
        perfiles || [];


    llenarSelectCapitanes();

    console.log(
        '✅ Capitanes:',
        capitanes
    );
}


// ======================================================
// COMPETENCIAS
// ======================================================

async function cargarCompetencias() {

    const {
        data,
        error
    } = await supabase
        .from('competencia')
        .select(`
            id,
            nombre,
            estado,
            fecha_limite_inscripcion
        `)
        .order(
            'nombre',
            {
                ascending: true
            }
        );


    if (error) {

        throw new Error(
            'Error cargando competencias: ' +
            error.message
        );
    }


    competencias =
        data || [];


    llenarCompetencias();

    console.log(
        '✅ Competencias:',
        competencias
    );
}


// ======================================================
// CARGAR INSCRIPCIONES
// ======================================================

async function cargarInscripciones() {

    console.log(
        '🔎 Cargando inscripciones...'
    );


    const {
        data,
        error
    } = await supabase
        .from('inscripcion_equipo')
        .select(`
            id,
            equipo_id,
            competencia_id,
            capitan_id,
            fecha_inscripcion,
            estado,
            observacion,
            fecha_revision
        `)
        .order(
            'fecha_inscripcion',
            {
                ascending: false
            }
        );


    if (error) {

        throw new Error(
            'Error cargando inscripciones: ' +
            error.message
        );
    }


    inscripciones =
        data || [];


    console.log(
        '✅ Inscripciones:',
        inscripciones
    );
}


// ======================================================
// LLENAR EQUIPOS
// ======================================================

function llenarSelectEquipos() {

    modalEquipo.innerHTML = `
        <option value="">
            Seleccione un equipo
        </option>
    `;


    equipos.forEach(
        equipo => {

            const option =
                document.createElement('option');

            option.value =
                equipo.id;

            option.textContent =
                equipo.nombre;

            modalEquipo.appendChild(
                option
            );
        }
    );
}


// ======================================================
// LLENAR CAPITANES
// ======================================================

function llenarSelectCapitanes() {

    modalCapitan.innerHTML = `
        <option value="">
            Seleccione un capitán
        </option>
    `;


    capitanes.forEach(
        capitan => {

            const option =
                document.createElement('option');

            option.value =
                capitan.id;

            option.textContent =
                `${capitan.nombres || ''} ${capitan.apellidos || ''}`.trim();

            modalCapitan.appendChild(
                option
            );
        }
    );
}


// ======================================================
// LLENAR COMPETENCIAS
// ======================================================

function llenarCompetencias() {

    // Para edición

    modalCompetencia.innerHTML = `
        <option value="">
            Seleccione una competencia
        </option>
    `;


    competencias.forEach(
        competencia => {

            const option =
                document.createElement('option');

            option.value =
                competencia.id;

            option.textContent =
                competencia.nombre;

            modalCompetencia.appendChild(
                option
            );
        }
    );


    // Para creación múltiple

    listaCompetencias.innerHTML = '';


    if (competencias.length === 0) {

        listaCompetencias.innerHTML = `
            <div class="sin-datos">
                No existen competencias registradas.
            </div>
        `;

        return;
    }


    competencias.forEach(
        competencia => {

            const div =
                document.createElement('label');

            div.className =
                'competencia-item';


            const checkbox =
                document.createElement('input');

            checkbox.type =
                'checkbox';

            checkbox.className =
                'competencia-checkbox';

            checkbox.value =
                competencia.id;


            const info =
                document.createElement('div');

            info.className =
                'competencia-info';


            const nombre =
                document.createElement('strong');

            nombre.textContent =
                competencia.nombre;


            const estado =
                document.createElement('small');

            estado.textContent =
                `Estado: ${competencia.estado || 'SIN ESTADO'}`;


            info.appendChild(
                nombre
            );

            info.appendChild(
                estado
            );


            div.appendChild(
                checkbox
            );

            div.appendChild(
                info
            );


            listaCompetencias.appendChild(
                div
            );
        }
    );
}


// ======================================================
// RENDERIZAR TABLA
// ======================================================

function renderizar() {

    const texto =
        buscar.value
            .trim()
            .toLowerCase();

    const estadoFiltro =
        filtroEstado.value;


    const filtradas =
        inscripciones.filter(
            item => {

                const equipo =
                    obtenerEquipo(
                        item.equipo_id
                    );

                const capitan =
                    obtenerCapitan(
                        item.capitan_id
                    );

                const competencia =
                    obtenerCompetencia(
                        item.competencia_id
                    );


                const nombreCapitan =
                    capitan
                        ? `${capitan.nombres || ''} ${capitan.apellidos || ''}`.trim()
                        : '';


                const coincideTexto =
                    !texto ||
                    equipo.nombre
                        .toLowerCase()
                        .includes(texto) ||
                    nombreCapitan
                        .toLowerCase()
                        .includes(texto) ||
                    competencia.nombre
                        .toLowerCase()
                        .includes(texto);


                const coincideEstado =
                    !estadoFiltro ||
                    item.estado === estadoFiltro;


                return (
                    coincideTexto &&
                    coincideEstado
                );
            }
        );


    tabla.innerHTML = '';


    if (filtradas.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="sin-datos">
                    No existen inscripciones para mostrar.
                </td>
            </tr>
        `;

        actualizarEstadisticas();

        return;
    }


    filtradas.forEach(
        (item, index) => {

            const equipo =
                obtenerEquipo(
                    item.equipo_id
                );

            const capitan =
                obtenerCapitan(
                    item.capitan_id
                );

            const competencia =
                obtenerCompetencia(
                    item.competencia_id
                );


            const nombreCapitan =
                capitan
                    ? `${capitan.nombres || ''} ${capitan.apellidos || ''}`.trim()
                    : 'Sin capitán';


            const fecha =
                item.fecha_inscripcion
                    ? new Date(
                        item.fecha_inscripcion
                    ).toLocaleDateString(
                        'es-EC'
                    )
                    : '-';


            const estadoClase =
                String(
                    item.estado || 'PENDIENTE'
                )
                .toLowerCase();


            const tr =
                document.createElement('tr');


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td>
                    <strong>
                        ${escaparHTML(
                            equipo?.nombre ||
                            'Sin equipo'
                        )}
                    </strong>
                </td>

                <td>
                    ${escaparHTML(
                        competencia?.nombre ||
                        'Sin competencia'
                    )}
                </td>

                <td>
                    ${escaparHTML(
                        nombreCapitan
                    )}
                </td>

                <td>
                    ${fecha}
                </td>

                <td>

                    <span
                        class="estado estado-${estadoClase}">

                        ${escaparHTML(
                            item.estado ||
                            'PENDIENTE'
                        )}

                    </span>

                </td>

                <td>

                    <button
                        class="btn-editar"
                        data-id="${item.id}">
                        ✏️ Editar
                    </button>

                    <button
                        class="btn-eliminar"
                        data-id="${item.id}">
                        🗑️ Eliminar
                    </button>

                </td>
            `;


            tabla.appendChild(
                tr
            );
        }
    );


    document
        .querySelectorAll('.btn-editar')
        .forEach(
            boton => {

                boton.addEventListener(
                    'click',
                    () => {

                        editar(
                            Number(
                                boton.dataset.id
                            )
                        );
                    }
                );
            }
        );


    document
        .querySelectorAll('.btn-eliminar')
        .forEach(
            boton => {

                boton.addEventListener(
                    'click',
                    () => {

                        eliminar(
                            Number(
                                boton.dataset.id
                            )
                        );
                    }
                );
            }
        );


    actualizarEstadisticas();
}


// ======================================================
// ESTADÍSTICAS
// ======================================================

function actualizarEstadisticas() {

    document.getElementById(
        'totalInscripciones'
    ).textContent =
        inscripciones.length;


    document.getElementById(
        'totalPendientes'
    ).textContent =
        inscripciones.filter(
            item =>
                item.estado === 'PENDIENTE'
        ).length;


    document.getElementById(
        'totalRevision'
    ).textContent =
        inscripciones.filter(
            item =>
                item.estado === 'EN_REVISION'
        ).length;


    document.getElementById(
        'totalAprobadas'
    ).textContent =
        inscripciones.filter(
            item =>
                item.estado === 'APROBADA'
        ).length;
}


// ======================================================
// OBTENER DATOS
// ======================================================

function obtenerEquipo(id) {

    return equipos.find(
        item =>
            String(item.id) ===
            String(id)
    ) || {
        nombre: 'Sin equipo'
    };
}


function obtenerCapitan(id) {

    return capitanes.find(
        item =>
            String(item.id) ===
            String(id)
    ) || null;
}


function obtenerCompetencia(id) {

    return competencias.find(
        item =>
            String(item.id) ===
            String(id)
    ) || {
        nombre: 'Sin competencia'
    };
}


// ======================================================
// NUEVA INSCRIPCIÓN
// ======================================================

btnNueva.addEventListener(
    'click',
    abrirNueva
);


function abrirNueva() {

    modo = 'nuevo';


    tituloModal.textContent =
        'Nueva inscripción';


    inscripcionId.value =
        '';


    modalEquipo.value =
        '';


    modalCapitan.value =
        '';


    modalEstado.value =
        'PENDIENTE';


    modalObservacion.value =
        '';


    // Mostrar selección múltiple

    contenedorCompetenciasNueva.style.display =
        'block';

    contenedorCompetenciaEditar.style.display =
        'none';


    // Desmarcar competencias

    document
        .querySelectorAll(
            '.competencia-checkbox'
        )
        .forEach(
            checkbox => {
                checkbox.checked =
                    false;
            }
        );


    btnGuardar.textContent =
        'Crear inscripción';


    limpiarMensaje();


    modal.style.display =
        'flex';
}


// ======================================================
// EDITAR
// ======================================================

function editar(id) {

    const item =
        inscripciones.find(
            registro =>
                registro.id === id
        );


    if (!item) {
        return;
    }


    modo = 'editar';


    tituloModal.textContent =
        'Editar inscripción';


    inscripcionId.value =
        item.id;


    modalEquipo.value =
        item.equipo_id;


    modalCapitan.value =
        item.capitan_id || '';


    modalCompetencia.value =
        item.competencia_id;


    modalEstado.value =
        item.estado || 'PENDIENTE';


    modalObservacion.value =
        item.observacion || '';


    // En edición solamente una competencia

    contenedorCompetenciasNueva.style.display =
        'none';

    contenedorCompetenciaEditar.style.display =
        'block';


    btnGuardar.textContent =
        'Guardar cambios';


    limpiarMensaje();


    modal.style.display =
        'flex';
}


// ======================================================
// GUARDAR
// ======================================================

btnGuardar.addEventListener(
    'click',
    guardar
);


async function guardar() {

    try {

        const equipoId =
            modalEquipo.value;

        const capitanId =
            modalCapitan.value;

        const estado =
            modalEstado.value;

        const observacion =
            modalObservacion.value.trim();


        // --------------------------------------------------
        // VALIDACIONES
        // --------------------------------------------------

        if (!equipoId) {

            mostrarMensaje(
                'Seleccione un equipo.',
                'error'
            );

            return;
        }


        if (!capitanId) {

            mostrarMensaje(
                'Seleccione un capitán.',
                'error'
            );

            return;
        }


        btnGuardar.disabled =
            true;


        // ==================================================
        // NUEVO
        // ==================================================

        if (modo === 'nuevo') {

            const seleccionadas =
                Array.from(
                    document.querySelectorAll(
                        '.competencia-checkbox:checked'
                    )
                )
                .map(
                    checkbox =>
                        Number(
                            checkbox.value
                        )
                );


            if (
                seleccionadas.length === 0
            ) {

                mostrarMensaje(
                    'Seleccione al menos una competencia.',
                    'error'
                );

                btnGuardar.disabled =
                    false;

                return;
            }


            // ----------------------------------------------
            // Evitar duplicados
            // ----------------------------------------------

            const existentes =
                inscripciones.filter(
                    item =>
                        String(
                            item.equipo_id
                        ) === String(
                            equipoId
                        )
                );


            const yaRegistradas =
                seleccionadas.filter(
                    competenciaId =>
                        existentes.some(
                            item =>
                                String(
                                    item.competencia_id
                                ) === String(
                                    competenciaId
                                )
                        )
                );


            if (
                yaRegistradas.length > 0
            ) {

                const nombres =
                    yaRegistradas.map(
                        id =>
                            obtenerCompetencia(
                                id
                            ).nombre
                    );


                mostrarMensaje(
                    `El equipo ya está inscrito en: ${nombres.join(', ')}`,
                    'error'
                );

                btnGuardar.disabled =
                    false;

                return;
            }


            // ----------------------------------------------
            // Crear registros
            // ----------------------------------------------

            const registros =
                seleccionadas.map(
                    competenciaId => ({

                        equipo_id:
                            Number(
                                equipoId
                            ),

                        competencia_id:
                            Number(
                                competenciaId
                            ),

                        capitan_id:
                            capitanId,

                        estado,

                        observacion:
                            observacion ||
                            null
                    })
                );


            console.log(
                '📤 Creando inscripciones:',
                registros
            );


            const {
                error
            } = await supabase
                .from(
                    'inscripcion_equipo'
                )
                .insert(
                    registros
                );


            if (error) {

                throw new Error(
                    error.message
                );
            }


            mostrarMensaje(
                `${registros.length} inscripción(es) creada(s) correctamente.`,
                'ok'
            );

        }

        // ==================================================
        // EDITAR
        // ==================================================

        else {

            const competenciaId =
                modalCompetencia.value;


            if (!competenciaId) {

                mostrarMensaje(
                    'Seleccione una competencia.',
                    'error'
                );

                btnGuardar.disabled =
                    false;

                return;
            }


            const id =
                Number(
                    inscripcionId.value
                );


            // ----------------------------------------------
            // Verificar duplicado
            // ----------------------------------------------

            const duplicado =
                inscripciones.some(
                    item =>
                        item.id !== id &&
                        String(
                            item.equipo_id
                        ) === String(
                            equipoId
                        ) &&
                        String(
                            item.competencia_id
                        ) === String(
                            competenciaId
                        )
                );


            if (duplicado) {

                mostrarMensaje(
                    'Ese equipo ya tiene una inscripción para esa competencia.',
                    'error'
                );

                btnGuardar.disabled =
                    false;

                return;
            }


            const {
                error
            } = await supabase
                .from(
                    'inscripcion_equipo'
                )
                .update({

                    equipo_id:
                        Number(
                            equipoId
                        ),

                    competencia_id:
                        Number(
                            competenciaId
                        ),

                    capitan_id:
                        capitanId,

                    estado,

                    observacion:
                        observacion ||
                        null,

                    fecha_revision:
                        (
                            estado === 'APROBADA' ||
                            estado === 'RECHAZADA' ||
                            estado === 'OBSERVADA'
                        )
                        ? new Date().toISOString()
                        : null
                })
                .eq(
                    'id',
                    id
                );


            if (error) {

                throw new Error(
                    error.message
                );
            }


            mostrarMensaje(
                'Inscripción actualizada correctamente.',
                'ok'
            );
        }


        // --------------------------------------------------
        // Recargar
        // --------------------------------------------------

        await cargarInscripciones();

        renderizar();


        setTimeout(
            cerrarModal,
            900
        );


    } catch (error) {

        console.error(
            '❌ Error guardando inscripción:',
            error
        );


        mostrarMensaje(
            'No se pudo guardar: ' +
            error.message,
            'error'
        );


    } finally {

        btnGuardar.disabled =
            false;
    }
}


// ======================================================
// ELIMINAR
// ======================================================

async function eliminar(id) {

    const item =
        inscripciones.find(
            registro =>
                registro.id === id
        );


    if (!item) {
        return;
    }


    const equipo =
        obtenerEquipo(
            item.equipo_id
        );


    const competencia =
        obtenerCompetencia(
            item.competencia_id
        );


    const confirmar =
        confirm(
            `¿Está seguro de eliminar la inscripción?\n\nEquipo: ${equipo.nombre}\nCompetencia: ${competencia.nombre}`
        );


    if (!confirmar) {
        return;
    }


    try {

        const {
            error
        } = await supabase
            .from(
                'inscripcion_equipo'
            )
            .delete()
            .eq(
                'id',
                id
            );


        if (error) {

            throw new Error(
                error.message
            );
        }


        mostrarMensaje(
            'Inscripción eliminada correctamente.',
            'ok'
        );


        await cargarInscripciones();

        renderizar();


    } catch (error) {

        console.error(
            '❌ Error eliminando:',
            error
        );


        mostrarMensaje(
            'No se pudo eliminar: ' +
            error.message,
            'error'
        );
    }
}


// ======================================================
// CERRAR MODAL
// ======================================================

btnCerrar.addEventListener(
    'click',
    cerrarModal
);


btnCancelar.addEventListener(
    'click',
    cerrarModal
);


function cerrarModal() {

    modal.style.display =
        'none';

    limpiarMensaje();
}


// Cerrar haciendo clic fuera

modal.addEventListener(
    'click',
    event => {

        if (
            event.target === modal
        ) {

            cerrarModal();
        }
    }
);


// ======================================================
// FILTROS
// ======================================================

buscar.addEventListener(
    'input',
    renderizar
);


filtroEstado.addEventListener(
    'change',
    renderizar
);


// ======================================================
// MENSAJES
// ======================================================

function mostrarMensaje(
    texto,
    tipo
) {

    mensaje.textContent =
        texto;

    mensaje.className =
        `mensaje ${tipo}`;
}


function limpiarMensaje() {

    mensaje.textContent =
        '';

    mensaje.className =
        'mensaje';
}


// ======================================================
// ESCAPAR HTML
// ======================================================

function escaparHTML(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return '';
    }


    return String(valor)
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );
}