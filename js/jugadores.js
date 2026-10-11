import { supabase } from './supabase.js';
import {
    obtenerUsuarioActual,
    nombreCompleto,
    rolesTexto,
    protegerAdmin
} from './admin-auth.js';


/* =========================================================
   VARIABLES
========================================================= */

let usuarioActual = null;
let inscripciones = [];
let jugadores = [];

const bucketDocumentos = 'documentos_inscripciones';
const bucketJugadores = 'jugadores';


/* =========================================================
   ELEMENTOS
========================================================= */

const nombreUsuario = document.getElementById('nombreUsuario');
const rolUsuario = document.getElementById('rolUsuario');

const listaInscripciones =
    document.getElementById('listaInscripciones');

const listaJugadores =
    document.getElementById('listaJugadores');

const jugadorId =
    document.getElementById('jugadorId');

const nombres =
    document.getElementById('nombres');

const apellidos =
    document.getElementById('apellidos');

const documento =
    document.getElementById('documento');

const fechaNacimiento =
    document.getElementById('fechaNacimiento');

const origen =
    document.getElementById('origen');

const numero =
    document.getElementById('numero');

const posicion =
    document.getElementById('posicion');

const esEspecial =
    document.getElementById('esEspecial');

const foto =
    document.getElementById('foto');

const fotoCedula =
    document.getElementById('fotoCedula');

const competenciasJugador =
    document.getElementById('competenciasJugador');

const guardarJugador =
    document.getElementById('guardarJugador');

const cancelarJugador =
    document.getElementById('cancelarJugador');

const tituloJugador =
    document.getElementById('tituloJugador');

const mensajeJugador =
    document.getElementById('mensajeJugador');


/* =========================================================
   INICIAR
========================================================= */

async function iniciar() {

    console.log(
        '===================================='
    );

    console.log(
        'INICIANDO MÓDULO DE JUGADORES'
    );

    console.log(
        '===================================='
    );


    /* =====================================================
       COMPROBAR SESIÓN
    ===================================================== */

    usuarioActual =
        await protegerAdmin();


    if (!usuarioActual) {
        return;
    }


    console.log(
        'USUARIO ACTUAL:',
        usuarioActual
    );


    /* =====================================================
       ESTE MÓDULO ES EXCLUSIVO PARA CAPITANES
       
       IMPORTANTE:
       ADMINISTRADOR NO PUEDE ENTRAR.
    ===================================================== */

    const esCapitan =
        usuarioActual.roles &&
        usuarioActual.roles.includes(
            'CAPITAN'
        );


    if (!esCapitan) {

        alert(
            'Este módulo es exclusivo para CAPITANES.'
        );

        window.location.href =
            '/admin/index.html';

        return;
    }


    /* =====================================================
       MOSTRAR USUARIO
    ===================================================== */

    if (nombreUsuario) {

        nombreUsuario.textContent =
            nombreCompleto(
                usuarioActual
            );
    }


    if (rolUsuario) {

        rolUsuario.textContent =
            rolesTexto(
                usuarioActual
            );
    }


    /* =====================================================
       CARGAR INFORMACIÓN
    ===================================================== */

    await cargarInscripciones();

    await cargarJugadores();


    /* =====================================================
       EVENTOS
    ===================================================== */

    if (guardarJugador) {

        guardarJugador.addEventListener(
            'click',
            guardarJugadorFormulario
        );
    }


    if (cancelarJugador) {

        cancelarJugador.addEventListener(
            'click',
            cancelarEdicion
        );
    }


    console.log(
        'MÓDULO DE JUGADORES LISTO'
    );
}


/* =========================================================
   CARGAR INSCRIPCIONES DEL CAPITÁN
========================================================= */

async function cargarInscripciones() {

    if (!usuarioActual) {
        return;
    }


    console.log(
        'CARGANDO INSCRIPCIONES DEL CAPITÁN...'
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
            documento_inscripcion,
            documento_aval,
            estado,
            observacion,

            equipo (
                id,
                nombre,
                contacto
            ),

            competencia (
                id,
                nombre,
                estado
            )
        `)
        .eq(
            'capitan_id',
            usuarioActual.id
        )
        .order(
            'fecha_inscripcion',
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            'ERROR CARGANDO INSCRIPCIONES:',
            error
        );

        mostrarMensaje(
            'No fue posible cargar las inscripciones.',
            'error'
        );

        return;
    }


    inscripciones =
        data || [];


    console.log(
        'INSCRIPCIONES:',
        inscripciones
    );


    mostrarInscripciones();
}


/* =========================================================
   MOSTRAR INSCRIPCIONES
========================================================= */

function mostrarInscripciones() {

    if (!listaInscripciones) {
        return;
    }


    listaInscripciones.innerHTML = '';


    if (inscripciones.length === 0) {

        listaInscripciones.innerHTML = `
            <div class="mensaje-vacio">
                No existen inscripciones de equipo
                asignadas a este capitán.
            </div>
        `;

        if (competenciasJugador) {
            competenciasJugador.innerHTML = '';
        }

        return;
    }


    inscripciones.forEach(
        inscripcion => {

            const competencia =
                inscripcion.competencia?.nombre ||
                'Sin competencia';


            const equipo =
                inscripcion.equipo?.nombre ||
                'Sin equipo';


            const estado =
                inscripcion.estado ||
                'Pendiente';


            const div =
                document.createElement(
                    'div'
                );


            div.className =
                'tarjeta-inscripcion';


            div.innerHTML = `

                <div class="inscripcion-info">

                    <strong>
                        ${escapeHtml(equipo)}
                    </strong>

                    <span>
                        ${escapeHtml(competencia)}
                    </span>

                    <small>
                        Estado:
                        ${escapeHtml(estado)}
                    </small>

                </div>

                <div class="documentos-inscripcion">

                    <button
                        type="button"
                        class="btn-documento"
                        data-id="${inscripcion.id}"
                        data-tipo="inscripcion"
                    >
                        ${
                            inscripcion.documento_inscripcion
                                ? '📄 Ver documento'
                                : '📄 Subir documento'
                        }
                    </button>

                    <button
                        type="button"
                        class="btn-documento"
                        data-id="${inscripcion.id}"
                        data-tipo="aval"
                    >
                        ${
                            inscripcion.documento_aval
                                ? '📑 Ver aval'
                                : '📑 Subir aval'
                        }
                    </button>

                </div>
            `;


            listaInscripciones.appendChild(
                div
            );
        }
    );


    /* =====================================================
       EVENTOS DE DOCUMENTOS
    ===================================================== */

    const botones =
        listaInscripciones.querySelectorAll(
            '.btn-documento'
        );


    botones.forEach(
        boton => {

            boton.addEventListener(
                'click',
                async () => {

                    const id =
                        boton.dataset.id;

                    const tipo =
                        boton.dataset.tipo;

                    await gestionarDocumento(
                        id,
                        tipo
                    );
                }
            );
        }
    );


    cargarCompetenciasParaJugador();
}


/* =========================================================
   DOCUMENTOS
========================================================= */

async function gestionarDocumento(
    inscripcionId,
    tipo
) {

    const inscripcion =
        inscripciones.find(
            item =>
                String(item.id) ===
                String(inscripcionId)
        );


    if (!inscripcion) {

        alert(
            'No se encontró la inscripción.'
        );

        return;
    }


    const campo =
        tipo === 'aval'
            ? 'documento_aval'
            : 'documento_inscripcion';


    const bucket =
        bucketDocumentos;


    const documentoExistente =
        inscripcion[campo];


    /* =====================================================
       SI YA EXISTE → MOSTRAR DOCUMENTO
    ===================================================== */

    if (documentoExistente) {

        const {
            data,
            error
        } = await supabase.storage
            .from(bucket)
            .createSignedUrl(
                documentoExistente,
                300
            );


        if (error) {

            console.error(
                'ERROR GENERANDO URL:',
                error
            );

            alert(
                'No fue posible abrir el documento.'
            );

            return;
        }


        if (data?.signedUrl) {

            window.open(
                data.signedUrl,
                '_blank'
            );
        }


        return;
    }


    /* =====================================================
       INPUT PARA SUBIR
    ===================================================== */

    const input =
        document.createElement(
            'input'
        );

    input.type = 'file';

    input.accept =
        '.pdf,.jpg,.jpeg,.png';


    input.click();


    input.addEventListener(
        'change',
        async () => {

            const archivo =
                input.files?.[0];


            if (!archivo) {
                return;
            }


            await subirDocumento(
                inscripcion,
                tipo,
                archivo
            );
        }
    );
}


/* =========================================================
   SUBIR DOCUMENTO
========================================================= */

async function subirDocumento(
    inscripcion,
    tipo,
    archivo
) {

    if (!inscripcion) {
        return;
    }


    mostrarMensaje(
        'Subiendo documento...',
        'info'
    );


    const extension =
        archivo.name
            .split('.')
            .pop()
            .toLowerCase();


    const nombreArchivo =
        `${inscripcion.equipo_id}/` +
        `${inscripcion.competencia_id}/` +
        `${tipo}-${Date.now()}.${extension}`;


    const {
        error: errorUpload
    } = await supabase.storage
        .from(bucketDocumentos)
        .upload(
            nombreArchivo,
            archivo,
            {
                upsert: true
            }
        );


    if (errorUpload) {

        console.error(
            'ERROR SUBIENDO DOCUMENTO:',
            errorUpload
        );

        mostrarMensaje(
            'No fue posible subir el documento.',
            'error'
        );

        return;
    }


    const campo =
        tipo === 'aval'
            ? 'documento_aval'
            : 'documento_inscripcion';


    const {
        error: errorUpdate
    } = await supabase
        .from('inscripcion_equipo')
        .update({
            [campo]: nombreArchivo
        })
        .eq(
            'id',
            inscripcion.id
        )
        .eq(
            'capitan_id',
            usuarioActual.id
        );


    if (errorUpdate) {

        console.error(
            'ERROR GUARDANDO DOCUMENTO:',
            errorUpdate
        );

        mostrarMensaje(
            'El archivo se subió, pero no se pudo registrar en la inscripción.',
            'error'
        );

        return;
    }


    inscripcion[campo] =
        nombreArchivo;


    mostrarMensaje(
        'Documento guardado correctamente.',
        'success'
    );


    mostrarInscripciones();
}


/* =========================================================
   CARGAR COMPETENCIAS PARA JUGADOR
========================================================= */

function cargarCompetenciasParaJugador() {

    if (!competenciasJugador) {
        return;
    }


    competenciasJugador.innerHTML = '';


    if (inscripciones.length === 0) {

        competenciasJugador.innerHTML = `
            <p>
                El equipo todavía no tiene
                competencias asignadas.
            </p>
        `;

        return;
    }


    inscripciones.forEach(
        inscripcion => {

            const competencia =
                inscripcion.competencia?.nombre ||
                'Competencia';


            const equipo =
                inscripcion.equipo?.nombre ||
                'Equipo';


            const label =
                document.createElement(
                    'label'
                );


            label.className =
                'check-competencia';


            label.innerHTML = `

                <input
                    type="checkbox"
                    value="${inscripcion.id}"
                    data-competencia-id="${inscripcion.competencia_id}"
                >

                <span>
                    ${escapeHtml(equipo)}
                    -
                    ${escapeHtml(competencia)}
                </span>

            `;


            competenciasJugador.appendChild(
                label
            );
        }
    );
}


/* =========================================================
   CARGAR JUGADORES
========================================================= */

async function cargarJugadores() {

    if (!usuarioActual) {
        return;
    }


    /*
     * Primero obtenemos las inscripciones
     * que pertenecen al capitán.
     */

    const inscripcionIds =
        inscripciones.map(
            item => item.id
        );


    if (inscripcionIds.length === 0) {

        jugadores = [];

        mostrarJugadores();

        return;
    }


    const {
        data,
        error
    } = await supabase
        .from('inscripcion_jugador')
        .select(`
            id,
            inscripcion_equipo_id,
            jugador_id,
            numero,
            posicion,
            es_especial,
            estado,
            observacion,

            jugador (
                id,
                nombres,
                apellidos,
                fecha_nacimiento,
                numero_cedula,
                foto,
                foto_cedula,
                origen,
                activo
            )
        `)
        .in(
            'inscripcion_equipo_id',
            inscripcionIds
        );


    if (error) {

        console.error(
            'ERROR CARGANDO JUGADORES:',
            error
        );

        mostrarMensaje(
            'No fue posible cargar los jugadores.',
            'error'
        );

        return;
    }


    jugadores =
        data || [];


    console.log(
        'JUGADORES:',
        jugadores
    );


    mostrarJugadores();
}


/* =========================================================
   MOSTRAR JUGADORES
========================================================= */

function mostrarJugadores() {

    if (!listaJugadores) {
        return;
    }


    listaJugadores.innerHTML = '';


    if (jugadores.length === 0) {

        listaJugadores.innerHTML = `
            <tr>
                <td colspan="8">
                    No existen jugadores registrados.
                </td>
            </tr>
        `;

        return;
    }


    /*
     * Agrupar por jugador.
     */

    const agrupados = {};


    jugadores.forEach(
        registro => {

            const id =
                registro.jugador_id;


            if (!agrupados[id]) {

                agrupados[id] = {

                    jugador:
                        registro.jugador,

                    registros: []
                };
            }


            agrupados[id]
                .registros
                .push(registro);
        }
    );


    Object.values(agrupados)
        .forEach(
            grupo => {

                const jugador =
                    grupo.jugador;


                const competencias =
                    grupo.registros
                        .map(
                            registro => {

                                const inscripcion =
                                    inscripciones.find(
                                        item =>
                                            String(item.id) ===
                                            String(
                                                registro.inscripcion_equipo_id
                                            )
                                    );

                                return (
                                    inscripcion
                                        ?.competencia
                                        ?.nombre ||
                                    'Competencia'
                                );
                            }
                        )
                        .join(', ');


                const estados =
                    grupo.registros
                        .map(
                            registro =>
                                registro.estado ||
                                'Pendiente'
                        )
                        .join(', ');


                const tr =
                    document.createElement(
                        'tr'
                    );


                tr.innerHTML = `

                    <td>
                        ${escapeHtml(
                            jugador?.nombres || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            jugador?.apellidos || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            jugador?.numero_cedula || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            jugador?.fecha_nacimiento || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            grupo.registros[0]?.numero || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            grupo.registros[0]?.posicion || ''
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            competencias
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            estados
                        )}
                    </td>

                `;


                listaJugadores.appendChild(
                    tr
                );
            }
        );
}


/* =========================================================
   GUARDAR JUGADOR
========================================================= */

async function guardarJugadorFormulario(
    event
) {

    if (event) {
        event.preventDefault();
    }


    if (!usuarioActual) {
        return;
    }


    /* =====================================================
       VALIDACIONES
    ===================================================== */

    const nombresValor =
        nombres?.value.trim();


    const apellidosValor =
        apellidos?.value.trim();


    const documentoValor =
        documento?.value.trim();


    const fechaValor =
        fechaNacimiento?.value;


    if (!nombresValor) {

        alert(
            'Ingrese los nombres del jugador.'
        );

        return;
    }


    if (!apellidosValor) {

        alert(
            'Ingrese los apellidos del jugador.'
        );

        return;
    }


    if (!documentoValor) {

        alert(
            'Ingrese el número de cédula.'
        );

        return;
    }


    if (!fechaValor) {

        alert(
            'Seleccione la fecha de nacimiento.'
        );

        return;
    }


    /* =====================================================
       COMPETENCIAS SELECCIONADAS
    ===================================================== */

    const checkboxes =
        competenciasJugador
            ?.querySelectorAll(
                'input[type="checkbox"]:checked'
            ) || [];


    const competenciasSeleccionadas =
        Array.from(
            checkboxes
        ).map(
            checkbox => checkbox.value
        );


    if (
        competenciasSeleccionadas.length === 0
    ) {

        alert(
            'Seleccione al menos una competencia para el jugador.'
        );

        return;
    }


    mostrarMensaje(
        'Guardando jugador...',
        'info'
    );


    /* =====================================================
       DATOS DEL JUGADOR
    ===================================================== */

    const datosJugador = {

        nombres:
            nombresValor,

        apellidos:
            apellidosValor,

        fecha_nacimiento:
            fechaValor,

        numero_cedula:
            documentoValor,

        origen:
            origen?.value || null,

        activo:
            true
    };


    let jugadorActual = null;


    /* =====================================================
       CREAR O ACTUALIZAR
    ===================================================== */

    if (jugadorId?.value) {

        const {
            data,
            error
        } = await supabase
            .from('jugador')
            .update(
                datosJugador
            )
            .eq(
                'id',
                jugadorId.value
            )
            .select()
            .single();


        if (error) {

            console.error(
                'ERROR ACTUALIZANDO JUGADOR:',
                error
            );

            mostrarMensaje(
                'No fue posible actualizar el jugador.',
                'error'
            );

            return;
        }


        jugadorActual =
            data;

    } else {

        const {
            data,
            error
        } = await supabase
            .from('jugador')
            .insert(
                datosJugador
            )
            .select()
            .single();


        if (error) {

            console.error(
                'ERROR CREANDO JUGADOR:',
                error
            );

            mostrarMensaje(
                'No fue posible registrar el jugador.',
                'error'
            );

            return;
        }


        jugadorActual =
            data;
    }


    /* =====================================================
       SUBIR FOTO
    ===================================================== */

    if (
        foto?.files &&
        foto.files.length > 0
    ) {

        const archivoFoto =
            foto.files[0];


        const extension =
            archivoFoto.name
                .split('.')
                .pop()
                .toLowerCase();


        const rutaFoto =
            `${jugadorActual.id}/foto.${extension}`;


        const {
            error: errorFoto
        } = await supabase.storage
            .from(bucketJugadores)
            .upload(
                rutaFoto,
                archivoFoto,
                {
                    upsert: true
                }
            );


        if (errorFoto) {

            console.error(
                'ERROR SUBIENDO FOTO:',
                errorFoto
            );

        } else {

            await supabase
                .from('jugador')
                .update({
                    foto: rutaFoto
                })
                .eq(
                    'id',
                    jugadorActual.id
                );
        }
    }


    /* =====================================================
       SUBIR FOTO CÉDULA
    ===================================================== */

    if (
        fotoCedula?.files &&
        fotoCedula.files.length > 0
    ) {

        const archivoCedula =
            fotoCedula.files[0];


        const extension =
            archivoCedula.name
                .split('.')
                .pop()
                .toLowerCase();


        const rutaCedula =
            `${jugadorActual.id}/cedula.${extension}`;


        const {
            error: errorCedula
        } = await supabase.storage
            .from(bucketJugadores)
            .upload(
                rutaCedula,
                archivoCedula,
                {
                    upsert: true
                }
            );


        if (errorCedula) {

            console.error(
                'ERROR SUBIENDO FOTO CÉDULA:',
                errorCedula
            );

        } else {

            await supabase
                .from('jugador')
                .update({
                    foto_cedula:
                        rutaCedula
                })
                .eq(
                    'id',
                    jugadorActual.id
                );
        }
    }


    /* =====================================================
       ELIMINAR INSCRIPCIONES ANTERIORES
       SOLO SI ESTAMOS EDITANDO
    ===================================================== */

    if (jugadorId?.value) {

        const {
            error
        } = await supabase
            .from('inscripcion_jugador')
            .delete()
            .eq(
                'jugador_id',
                jugadorActual.id
            );


        if (error) {

            console.error(
                'ERROR ELIMINANDO INSCRIPCIONES ANTERIORES:',
                error
            );

            mostrarMensaje(
                'El jugador se guardó, pero no se pudieron actualizar sus competencias.',
                'error'
            );

            return;
        }
    }


    /* =====================================================
       CREAR INSCRIPCIONES DEL JUGADOR
    ===================================================== */

    const registros =
        competenciasSeleccionadas
            .map(
                inscripcionId => ({

                    inscripcion_equipo_id:
                        inscripcionId,

                    jugador_id:
                        jugadorActual.id,

                    numero:
                        numero?.value || null,

                    posicion:
                        posicion?.value || null,

                    es_especial:
                        esEspecial?.checked || false,

                    estado:
                        'Pendiente'
                })
            );


    const {
        error: errorRegistros
    } = await supabase
        .from('inscripcion_jugador')
        .insert(
            registros
        );


    if (errorRegistros) {

        console.error(
            'ERROR CREANDO INSCRIPCIONES DEL JUGADOR:',
            errorRegistros
        );

        mostrarMensaje(
            'El jugador fue guardado, pero no se pudieron registrar sus competencias.',
            'error'
        );

        return;
    }


    mostrarMensaje(
        'Jugador guardado correctamente.',
        'success'
    );


    limpiarFormulario();

    await cargarJugadores();
}


/* =========================================================
   CANCELAR EDICIÓN
========================================================= */

function cancelarEdicion() {

    limpiarFormulario();

    if (tituloJugador) {

        tituloJugador.textContent =
            'Registrar jugador';
    }
}


/* =========================================================
   LIMPIAR FORMULARIO
========================================================= */

function limpiarFormulario() {

    if (jugadorId) {
        jugadorId.value = '';
    }

    if (nombres) {
        nombres.value = '';
    }

    if (apellidos) {
        apellidos.value = '';
    }

    if (documento) {
        documento.value = '';
    }

    if (fechaNacimiento) {
        fechaNacimiento.value = '';
    }

    if (origen) {
        origen.value = '';
    }

    if (numero) {
        numero.value = '';
    }

    if (posicion) {
        posicion.value = '';
    }

    if (esEspecial) {
        esEspecial.checked = false;
    }

    if (foto) {
        foto.value = '';
    }

    if (fotoCedula) {
        fotoCedula.value = '';
    }


    if (competenciasJugador) {

        const checkboxes =
            competenciasJugador
                .querySelectorAll(
                    'input[type="checkbox"]'
                );


        checkboxes.forEach(
            checkbox => {

                checkbox.checked =
                    false;
            }
        );
    }
}


/* =========================================================
   MENSAJES
========================================================= */

function mostrarMensaje(
    texto,
    tipo = 'info'
) {

    if (!mensajeJugador) {

        console.log(
            texto
        );

        return;
    }


    mensajeJugador.textContent =
        texto;


    mensajeJugador.className =
        `mensaje-${tipo}`;
}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escapeHtml(
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


/* =========================================================
   INICIAR SISTEMA
========================================================= */

iniciar();