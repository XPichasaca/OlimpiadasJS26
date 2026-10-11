import { supabase } from './supabase.js';

let usuarioActual = null;
let perfilActual = null;
let rolActual = null;
let equipoActual = null;
let inscripcionActual = null;

let competencias = [];
let equipos = [];
let capitanes = [];
let jugadores = [];


// =====================================================
// INICIO
// =====================================================

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {

    console.log('====================================');
    console.log('INICIANDO MODULO DE JUGADORES');
    console.log('====================================');

    configurarMenu();
    configurarEventos();

    mostrarEstadoInicial();

    const usuarioOk = await obtenerUsuario();

    if (!usuarioOk) {
        console.error('No se pudo obtener el usuario.');
        return;
    }

    console.log('Usuario autenticado:', usuarioActual.id);
    console.log('Rol:', rolActual);

    await cargarCompetencias();

    if (esAdministrador()) {

        console.log('Modo ADMINISTRADOR');

        await cargarEquipos();
        await cargarCapitanes();

    } else if (esCapitan()) {

        console.log('Modo CAPITÁN');

        await cargarEquipoCapitan();

    } else {

        console.warn('Rol no reconocido:', rolActual);
    }

    actualizarInterfazRol();
    actualizarDatosPantalla();
    actualizarResumen();

    console.log('====================================');
    console.log('MODULO CARGADO CORRECTAMENTE');
    console.log('====================================');
}


// =====================================================
// ESTADO INICIAL
// =====================================================

function mostrarEstadoInicial() {

    const nombre = document.getElementById('nombreUsuario');
    const rol = document.getElementById('rolUsuario');

    if (nombre) nombre.textContent = 'Cargando usuario...';
    if (rol) rol.textContent = 'Cargando...';
}


// =====================================================
// AUTENTICACIÓN
// =====================================================

async function obtenerUsuario() {

    try {

        console.log('1. Consultando sesión de Supabase...');

        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) {

            console.error('Error obteniendo usuario:', error);

            mostrarErrorUsuario(
                'No se pudo verificar la sesión de usuario.'
            );

            return false;
        }

        if (!user) {

            console.warn('No existe sesión activa.');

            mostrarErrorUsuario(
                'No existe una sesión iniciada. Inicie sesión nuevamente.'
            );

            return false;
        }

        usuarioActual = user;

        console.log('2. Usuario autenticado:', user.id);
        console.log('Correo:', user.email);

        // ---------------------------------------------
        // PERFIL
        // ---------------------------------------------

        try {

            const {
                data: perfil,
                error: errorPerfil
            } = await supabase
                .from('perfil_usuario')
                .select('id, nombres, apellidos, activo')
                .eq('id', user.id)
                .maybeSingle();

            if (errorPerfil) {

                console.warn(
                    'No se pudo cargar perfil_usuario:',
                    errorPerfil
                );

            } else {

                perfilActual = perfil;
            }

        } catch (errorPerfil) {

            console.warn(
                'Error consultando perfil_usuario:',
                errorPerfil
            );
        }


        // ---------------------------------------------
        // ROL
        // ---------------------------------------------

        let rolGuardado = localStorage.getItem('rol');

        if (rolGuardado) {

            rolActual = normalizarRol(rolGuardado);

            console.log(
                'Rol obtenido desde localStorage:',
                rolActual
            );

        } else {

            console.log(
                'No hay rol en localStorage. Consultando base de datos...'
            );

            rolActual = await obtenerRolDesdeBD(user.id);
        }


        // Si todavía no hay rol
        if (!rolActual) {

            console.warn('No se pudo determinar el rol.');

            rolActual = 'SIN_ROL';
        }


        // ---------------------------------------------
        // MOSTRAR USUARIO
        // ---------------------------------------------

        const nombreUsuario =
            document.getElementById('nombreUsuario');

        const rolUsuario =
            document.getElementById('rolUsuario');


        let nombreCompleto = '';

        if (perfilActual) {

            nombreCompleto =
                `${perfilActual.nombres || ''} ${perfilActual.apellidos || ''}`
                    .trim();
        }

        if (!nombreCompleto) {

            nombreCompleto =
                user.email || 'Usuario';
        }


        if (nombreUsuario) {

            nombreUsuario.textContent = nombreCompleto;
        }

        if (rolUsuario) {

            rolUsuario.textContent =
                formatearRol(rolActual);
        }


        console.log(
            '3. Usuario listo:',
            nombreCompleto,
            rolActual
        );

        return true;

    } catch (error) {

        console.error(
            'ERROR GENERAL OBTENIENDO USUARIO:',
            error
        );

        mostrarErrorUsuario(
            'Error al cargar el usuario.'
        );

        return false;
    }
}


// =====================================================
// OBTENER ROL DESDE BD
// =====================================================

async function obtenerRolDesdeBD(usuarioId) {

    try {

        const {
            data: relaciones,
            error
        } = await supabase
            .from('usuario_rol')
            .select('rol_id')
            .eq('usuario_id', usuarioId);

        if (error) {

            console.error(
                'Error consultando usuario_rol:',
                error
            );

            return null;
        }

        if (!relaciones || relaciones.length === 0) {

            console.warn(
                'El usuario no tiene roles asignados.'
            );

            return null;
        }


        const idsRol =
            relaciones
                .map(r => r.rol_id)
                .filter(Boolean);


        if (idsRol.length === 0) {

            return null;
        }


        const {
            data: roles,
            error: errorRoles
        } = await supabase
            .from('rol')
            .select('id, nombre')
            .in('id', idsRol);


        if (errorRoles) {

            console.error(
                'Error consultando rol:',
                errorRoles
            );

            return null;
        }


        if (!roles || roles.length === 0) {

            return null;
        }


        // Prioridad de roles
        const prioridad = [
            'ADMINISTRADOR',
            'COMISION',
            'CAPITAN',
            'ARBITRO',
            'DELEGADO_MESA'
        ];


        for (const prioridadRol of prioridad) {

            const encontrado =
                roles.find(
                    r =>
                        normalizarRol(r.nombre) ===
                        prioridadRol
                );

            if (encontrado) {

                localStorage.setItem(
                    'rol',
                    prioridadRol
                );

                return prioridadRol;
            }
        }


        return normalizarRol(roles[0].nombre);

    } catch (error) {

        console.error(
            'Error obteniendo rol:',
            error
        );

        return null;
    }
}


// =====================================================
// UTILIDADES DE ROL
// =====================================================

function normalizarRol(rol) {

    if (!rol) return '';

    return String(rol)
        .trim()
        .toUpperCase()
        .replace(/Á/g, 'A')
        .replace(/É/g, 'E')
        .replace(/Í/g, 'I')
        .replace(/Ó/g, 'O')
        .replace(/Ú/g, 'U')
        .replace(/\s+/g, '_');
}


function formatearRol(rol) {

    const roles = {

        ADMINISTRADOR: 'Administrador',

        COMISION: 'Comisión',

        CAPITAN: 'Capitán',

        ARBITRO: 'Árbitro',

        DELEGADO_MESA: 'Delegado de mesa',

        SIN_ROL: 'Sin rol'
    };

    return roles[rol] || rol;
}


function esAdministrador() {

    return rolActual === 'ADMINISTRADOR';
}


function esCapitan() {

    return rolActual === 'CAPITAN';
}


// =====================================================
// ERROR DE USUARIO
// =====================================================

function mostrarErrorUsuario(mensaje) {

    const nombre =
        document.getElementById('nombreUsuario');

    const rol =
        document.getElementById('rolUsuario');

    if (nombre) {

        nombre.textContent = 'Usuario no disponible';
    }

    if (rol) {

        rol.textContent = 'Error';
    }

    mostrarMensaje(
        'mensajeEquipo',
        mensaje,
        'error'
    );
}


// =====================================================
// MENÚ
// =====================================================

function configurarMenu() {

    const botones =
        document.querySelectorAll('[data-seccion]');


    botones.forEach(boton => {

        boton.addEventListener('click', () => {

            const seccion =
                boton.dataset.seccion;

            mostrarSeccion(seccion);

        });

    });


    const secciones =
        document.querySelectorAll('.seccion');


    if (secciones.length > 0) {

        mostrarSeccion('inicio');
    }
}


function mostrarSeccion(nombre) {

    const secciones =
        document.querySelectorAll('.seccion');


    secciones.forEach(seccion => {

        seccion.style.display = 'none';

    });


    const activa =
        document.getElementById(nombre);


    if (activa) {

        activa.style.display = 'block';
    }


    const botones =
        document.querySelectorAll('[data-seccion]');


    botones.forEach(boton => {

        boton.classList.remove('activo');

        if (
            boton.dataset.seccion === nombre
        ) {

            boton.classList.add('activo');
        }

    });
}


// =====================================================
// EVENTOS
// =====================================================

function configurarEventos() {

    const botonInscripcion =
        document.getElementById(
            'crearInscripcionEquipo'
        );

    if (botonInscripcion) {

        botonInscripcion.addEventListener(
            'click',
            guardarInscripcionEquipo
        );
    }


    const formulario =
        document.getElementById('formJugador');

    if (formulario) {

        formulario.addEventListener(
            'submit',
            guardarJugador
        );
    }


    const cancelar =
        document.getElementById('cancelarJugador');

    if (cancelar) {

        cancelar.addEventListener(
            'click',
            limpiarFormularioJugador
        );
    }


    const competencia =
        document.getElementById('competencia');

    if (competencia) {

        competencia.addEventListener(
            'change',
            async () => {

                await buscarInscripcionEquipo();

                actualizarDatosPantalla();
                actualizarResumen();

            }
        );
    }


    const equipo =
        document.getElementById('equipo');

    if (equipo) {

        equipo.addEventListener(
            'change',
            async () => {

                await buscarInscripcionEquipo();

                actualizarDatosPantalla();
                actualizarResumen();

            }
        );
    }
}


// =====================================================
// CARGAR COMPETENCIAS
// =====================================================

async function cargarCompetencias() {

    try {

        console.log('Cargando competencias...');


        const {
            data,
            error
        } = await supabase
            .from('competencia')
            .select(`
                id,
                nombre,
                estado,
                campeonato_id,
                disciplina_id,
                categoria_id,
                genero_id,
                fecha_limite_inscripcion,
                disciplina(nombre),
                categoria(id,nombre),
                genero(id,nombre),
                campeonato(nombre)
            `)
            .order('nombre');


        if (error) {

            console.error(
                'Error cargando competencias:',
                error
            );

            return;
        }


        competencias = data || [];


        const select =
            document.getElementById('competencia');


        if (!select) return;


        select.innerHTML =
            '<option value="">Seleccione una competencia</option>';


        competencias.forEach(comp => {

            const option =
                document.createElement('option');


            option.value = comp.id;


            option.textContent =
                comp.nombre ||
                construirNombreCompetencia(comp);


            select.appendChild(option);

        });


        console.log(
            'Competencias cargadas:',
            competencias.length
        );


    } catch (error) {

        console.error(
            'Error general cargando competencias:',
            error
        );
    }
}


// =====================================================
// NOMBRE DE COMPETENCIA
// =====================================================

function construirNombreCompetencia(comp) {

    const disciplina =
        comp.disciplina?.nombre || '';

    const categoria =
        comp.categoria?.nombre || '';

    const genero =
        comp.genero?.nombre || '';


    return [
        disciplina,
        categoria,
        genero
    ]
        .filter(Boolean)
        .join(' - ');
}


// =====================================================
// CARGAR EQUIPOS
// =====================================================

async function cargarEquipos() {

    try {

        console.log('Cargando equipos...');


        const {
            data,
            error
        } = await supabase
            .from('equipo')
            .select(`
                id,
                nombre,
                logo,
                representante,
                contacto,
                activo
            `)
            .eq('activo', true)
            .order('nombre');


        if (error) {

            console.error(
                'Error cargando equipos:',
                error
            );

            return;
        }


        equipos = data || [];


        const select =
            document.getElementById('equipo');


        if (!select) return;


        select.innerHTML =
            '<option value="">Seleccione un equipo</option>';


        equipos.forEach(equipo => {

            const option =
                document.createElement('option');


            option.value = equipo.id;

            option.textContent = equipo.nombre;

            select.appendChild(option);

        });


        console.log(
            'Equipos cargados:',
            equipos.length
        );


    } catch (error) {

        console.error(
            'Error general cargando equipos:',
            error
        );
    }
}


// =====================================================
// CARGAR CAPITANES
// =====================================================

async function cargarCapitanes() {

    try {

        console.log('Cargando capitanes...');


        const {
            data: relaciones,
            error: errorRelaciones
        } = await supabase
            .from('usuario_rol')
            .select('usuario_id, rol_id')
            .limit(1000);


        if (errorRelaciones) {

            console.error(
                'Error cargando relaciones de roles:',
                errorRelaciones
            );

            return;
        }


        if (!relaciones || relaciones.length === 0) {

            console.warn(
                'No existen relaciones usuario_rol.'
            );

            return;
        }


        const rolIds =
            [...new Set(
                relaciones
                    .map(r => r.rol_id)
                    .filter(Boolean)
            )];


        const {
            data: roles,
            error: errorRoles
        } = await supabase
            .from('rol')
            .select('id,nombre')
            .in('id', rolIds);


        if (errorRoles) {

            console.error(
                'Error cargando roles:',
                errorRoles
            );

            return;
        }


        const rolCapitan =
            roles.find(
                r =>
                    normalizarRol(r.nombre) ===
                    'CAPITAN'
            );


        if (!rolCapitan) {

            console.warn(
                'No se encontró el rol CAPITAN.'
            );

            return;
        }


        const idsCapitanes =
            relaciones
                .filter(
                    r =>
                        String(r.rol_id) ===
                        String(rolCapitan.id)
                )
                .map(r => r.usuario_id);


        if (idsCapitanes.length === 0) {

            console.warn(
                'No existen usuarios con rol CAPITAN.'
            );

            return;
        }


        const {
            data: perfiles,
            error: errorPerfiles
        } = await supabase
            .from('perfil_usuario')
            .select(`
                id,
                nombres,
                apellidos,
                activo
            `)
            .in('id', idsCapitanes)
            .eq('activo', true)
            .order('apellidos');


        if (errorPerfiles) {

            console.error(
                'Error cargando perfiles de capitanes:',
                errorPerfiles
            );

            return;
        }


        capitanes = perfiles || [];


        const select =
            document.getElementById('capitan');


        if (!select) return;


        select.innerHTML =
            '<option value="">Seleccione un capitán</option>';


        capitanes.forEach(capitan => {

            const option =
                document.createElement('option');


            option.value = capitan.id;


            option.textContent =
                `${capitan.nombres || ''} ${capitan.apellidos || ''}`
                    .trim();


            select.appendChild(option);

        });


        console.log(
            'Capitanes cargados:',
            capitanes.length
        );


    } catch (error) {

        console.error(
            'Error general cargando capitanes:',
            error
        );
    }
}


// =====================================================
// EQUIPO DEL CAPITÁN
// =====================================================

async function cargarEquipoCapitan() {

    try {

        console.log(
            'Buscando equipo del capitán...'
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
                estado,
                documento_autorizado,
                equipo(
                    id,
                    nombre,
                    logo,
                    contacto,
                    representante,
                    activo
                ),
                competencia(
                    id,
                    nombre,
                    estado
                )
            `)
            .eq('capitan_id', usuarioActual.id)
            .order('fecha_inscripcion', {
                ascending: false
            });


        if (error) {

            console.error(
                'Error buscando equipo del capitán:',
                error
            );

            mostrarMensaje(
                'mensajeEquipo',
                'No se pudo cargar el equipo del capitán.',
                'error'
            );

            return;
        }


        if (!data || data.length === 0) {

            console.warn(
                'El capitán todavía no tiene inscripción.'
            );

            mostrarMensaje(
                'mensajeEquipo',
                'Todavía no tiene un equipo asignado.',
                'info'
            );

            return;
        }


        // Tomamos la inscripción más reciente
        const inscripcion = data[0];

        inscripcionActual = inscripcion;

        equipoActual = inscripcion.equipo;


        mostrarEquipo(equipoActual);


        // Seleccionar equipo
        const selectEquipo =
            document.getElementById('equipo');


        if (selectEquipo && equipoActual) {

            selectEquipo.innerHTML = '';

            const option =
                document.createElement('option');

            option.value = equipoActual.id;

            option.textContent =
                equipoActual.nombre;

            option.selected = true;

            selectEquipo.appendChild(option);
        }


        // Seleccionar competencia
        const selectCompetencia =
            document.getElementById('competencia');


        if (
            selectCompetencia &&
            inscripcion.competencia_id
        ) {

            selectCompetencia.value =
                inscripcion.competencia_id;
        }


        // Seleccionar capitán
        const selectCapitan =
            document.getElementById('capitan');


        if (selectCapitan) {

            selectCapitan.innerHTML = '';

            const option =
                document.createElement('option');

            option.value =
                usuarioActual.id;

            option.textContent =
                obtenerNombreUsuario();

            option.selected = true;

            selectCapitan.appendChild(option);
        }


        actualizarEstadoInscripcion(
            inscripcion
        );


        await cargarNomina();

        actualizarDatosPantalla();
        actualizarResumen();


    } catch (error) {

        console.error(
            'Error general cargando equipo del capitán:',
            error
        );
    }
}


// =====================================================
// MOSTRAR EQUIPO
// =====================================================

function mostrarEquipo(equipo) {

    if (!equipo) return;


    const nombre =
        document.getElementById(
            'infoNombreEquipo'
        );


    const contacto =
        document.getElementById(
            'infoContactoEquipo'
        );


    const inicioEquipo =
        document.getElementById(
            'inicioEquipo'
        );


    if (nombre) {

        nombre.textContent =
            equipo.nombre || '-';
    }


    if (contacto) {

        contacto.textContent =
            equipo.contacto || '-';
    }


    if (inicioEquipo) {

        inicioEquipo.textContent =
            equipo.nombre || '-';
    }
}


// =====================================================
// BUSCAR INSCRIPCIÓN
// =====================================================

async function buscarInscripcionEquipo() {

    const competenciaSelect =
        document.getElementById('competencia');

    const equipoSelect =
        document.getElementById('equipo');


    if (!competenciaSelect || !equipoSelect) {

        return null;
    }


    const competenciaId =
        competenciaSelect.value;

    const equipoId =
        equipoSelect.value;


    if (!competenciaId || !equipoId) {

        inscripcionActual = null;

        limpiarEstadoInscripcion();

        return null;
    }


    try {

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
                documento_autorizado,
                estado,
                observacion,
                fecha_revision,
                revisado_por,
                sorteo_orden,
                equipo(
                    id,
                    nombre,
                    logo,
                    contacto
                ),
                competencia(
                    id,
                    nombre
                )
            `)
            .eq('competencia_id', competenciaId)
            .eq('equipo_id', equipoId)
            .maybeSingle();


        if (error) {

            console.error(
                'Error buscando inscripción:',
                error
            );

            return null;
        }


        inscripcionActual = data || null;


        if (data) {

            actualizarEstadoInscripcion(data);

            if (
                data.documento_autorizado
            ) {

                mostrarDocumento(
                    data.documento_autorizado
                );
            }

            await cargarNomina();

        } else {

            limpiarEstadoInscripcion();
            jugadores = [];
            renderizarNomina();
        }


        actualizarDatosPantalla();
        actualizarResumen();


        return data;


    } catch (error) {

        console.error(
            'Error general buscando inscripción:',
            error
        );

        return null;
    }
}


// =====================================================
// GUARDAR INSCRIPCIÓN DEL EQUIPO
// =====================================================

async function guardarInscripcionEquipo() {

    try {

        const competencia =
            document.getElementById(
                'competencia'
            )?.value;

        const equipo =
            document.getElementById(
                'equipo'
            )?.value;

        const capitan =
            document.getElementById(
                'capitan'
            )?.value;


        const documento =
            document.getElementById(
                'documentoAutorizado'
            )?.value?.trim() || null;


        if (!competencia) {

            mostrarMensaje(
                'mensajeEquipo',
                'Seleccione una competencia.',
                'error'
            );

            return;
        }


        if (!equipo) {

            mostrarMensaje(
                'mensajeEquipo',
                'Seleccione un equipo.',
                'error'
            );

            return;
        }


        let capitanFinal =
            capitan || null;


        if (esCapitan()) {

            capitanFinal =
                usuarioActual.id;
        }


        if (!capitanFinal) {

            mostrarMensaje(
                'mensajeEquipo',
                'Seleccione un capitán.',
                'error'
            );

            return;
        }


        const datos = {

            equipo_id: equipo,

            competencia_id: competencia,

            capitan_id: capitanFinal,

            documento_autorizado:
                documento,

            estado: 'Pendiente',

            fecha_inscripcion:
                new Date().toISOString()
        };


        // ---------------------------------------------
        // SI YA EXISTE
        // ---------------------------------------------

        if (inscripcionActual?.id) {

            const {
                data,
                error
            } = await supabase
                .from('inscripcion_equipo')
                .update({

                    capitan_id:
                        capitanFinal,

                    documento_autorizado:
                        documento || inscripcionActual.documento_autorizado

                })
                .eq(
                    'id',
                    inscripcionActual.id
                )
                .select()
                .single();


            if (error) {

                console.error(
                    'Error actualizando inscripción:',
                    error
                );

                mostrarMensaje(
                    'mensajeEquipo',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }


            inscripcionActual = data;


            mostrarMensaje(
                'mensajeEquipo',
                'Inscripción actualizada correctamente.',
                'success'
            );

        } else {

            // -----------------------------------------
            // NUEVA INSCRIPCIÓN
            // -----------------------------------------

            const {
                data,
                error
            } = await supabase
                .from('inscripcion_equipo')
                .insert(datos)
                .select()
                .single();


            if (error) {

                console.error(
                    'Error creando inscripción:',
                    error
                );

                mostrarMensaje(
                    'mensajeEquipo',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }


            inscripcionActual = data;


            mostrarMensaje(
                'mensajeEquipo',
                'Equipo inscrito correctamente en la competencia.',
                'success'
            );
        }


        await buscarInscripcionEquipo();

        actualizarDatosPantalla();
        actualizarResumen();


    } catch (error) {

        console.error(
            'Error general guardando inscripción:',
            error
        );

        mostrarMensaje(
            'mensajeEquipo',
            'Ocurrió un error al guardar la inscripción.',
            'error'
        );
    }
}


// =====================================================
// ESTADO INSCRIPCIÓN
// =====================================================

function actualizarEstadoInscripcion(inscripcion) {

    const elemento =
        document.getElementById(
            'estadoEquipo'
        );


    if (!elemento) return;


    if (!inscripcion) {

        elemento.textContent =
            'Sin inscripción';

        elemento.className =
            'estado pendiente';

        return;
    }


    elemento.textContent =
        inscripcion.estado || 'Pendiente';


    elemento.className =
        `estado ${claseEstado(inscripcion.estado)}`;
}


function claseEstado(estado) {

    const valor =
        normalizarRol(estado || '');


    if (valor === 'APROBADA') {

        return 'aprobada';
    }

    if (
        valor === 'RECHAZADA'
    ) {

        return 'rechazada';
    }

    if (
        valor === 'OBSERVADA'
    ) {

        return 'observada';
    }

    if (
        valor === 'EN_REVISION'
    ) {

        return 'revision';
    }

    return 'pendiente';
}


function limpiarEstadoInscripcion() {

    const elemento =
        document.getElementById(
            'estadoEquipo'
        );


    if (elemento) {

        elemento.textContent =
            'Sin inscripción';

        elemento.className =
            'estado pendiente';
    }
}


// =====================================================
// CARGAR NÓMINA
// =====================================================

async function cargarNomina() {

    if (!inscripcionActual?.id) {

        jugadores = [];

        renderizarNomina();

        return;
    }


    try {

        console.log(
            'Cargando nómina:',
            inscripcionActual.id
        );


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
                fecha_revision,
                revisado_por,
                jugador(
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
            .eq(
                'inscripcion_equipo_id',
                inscripcionActual.id
            )
            .order('numero');


        if (error) {

            console.error(
                'Error cargando nómina:',
                error
            );

            jugadores = [];

            renderizarNomina();

            return;
        }


        jugadores = data || [];


        renderizarNomina();


        const nominaEquipo =
            document.getElementById(
                'nominaEquipo'
            );


        const nominaCompetencia =
            document.getElementById(
                'nominaCompetencia'
            );


        if (nominaEquipo) {

            nominaEquipo.textContent =
                equipoActual?.nombre ||
                inscripcionActual?.equipo?.nombre ||
                obtenerEquipoSeleccionadoNombre() ||
                '-';
        }


        if (nominaCompetencia) {

            nominaCompetencia.textContent =
                inscripcionActual?.competencia?.nombre ||
                obtenerCompetenciaSeleccionadaNombre() ||
                '-';
        }


    } catch (error) {

        console.error(
            'Error general cargando nómina:',
            error
        );

        jugadores = [];

        renderizarNomina();
    }
}


// =====================================================
// RENDERIZAR NÓMINA
// =====================================================

function renderizarNomina() {

    const contenedor =
        document.getElementById(
            'listaJugadores'
        );


    if (!contenedor) return;


    if (!jugadores.length) {

        contenedor.innerHTML = `
            <div class="sin-datos">
                No existen jugadores registrados en esta nómina.
            </div>
        `;

        return;
    }


    contenedor.innerHTML = '';


    jugadores.forEach(item => {

        const jugador =
            item.jugador || {};


        const nombre =
            `${jugador.nombres || ''} ${jugador.apellidos || ''}`
                .trim();


        const div =
            document.createElement('div');


        div.className =
            'jugador-item';


        div.innerHTML = `

            <div class="jugador-info">

                <strong>
                    ${escapeHTML(nombre || 'Sin nombre')}
                </strong>

                <span>
                    N.º ${escapeHTML(
                        String(item.numero ?? '-')
                    )}
                </span>

                <span>
                    ${escapeHTML(
                        item.posicion || 'Sin posición'
                    )}
                </span>

                ${
                    item.es_especial
                        ? '<span>Especial</span>'
                        : ''
                }

            </div>

            <div class="jugador-estado">

                <span class="estado ${claseEstado(item.estado)}">
                    ${escapeHTML(
                        item.estado || 'Pendiente'
                    )}
                </span>

                <button
                    type="button"
                    class="btn-editar-jugador"
                    data-id="${item.id}">
                    Editar
                </button>

            </div>
        `;


        const boton =
            div.querySelector(
                '.btn-editar-jugador'
            );


        if (boton) {

            boton.addEventListener(
                'click',
                () =>
                    editarJugador(item.id)
            );
        }


        contenedor.appendChild(div);

    });
}


// =====================================================
// GUARDAR JUGADOR
// =====================================================

async function guardarJugador(evento) {

    evento.preventDefault();


    try {

        if (!usuarioActual) {

            mostrarMensaje(
                'mensajeJugador',
                'No existe una sesión activa.',
                'error'
            );

            return;
        }


        if (!inscripcionActual?.id) {

            mostrarMensaje(
                'mensajeJugador',
                'Primero debe crear o seleccionar la inscripción del equipo.',
                'error'
            );

            return;
        }


        const jugadorId =
            document.getElementById(
                'jugadorId'
            )?.value;


        const nombres =
            document.getElementById(
                'nombres'
            )?.value.trim();


        const apellidos =
            document.getElementById(
                'apellidos'
            )?.value.trim();


        const documento =
            document.getElementById(
                'documento'
            )?.value.trim();


        const fechaNacimiento =
            document.getElementById(
                'fechaNacimiento'
            )?.value || null;


        const origen =
            document.getElementById(
                'origen'
            )?.value || null;


        const numero =
            document.getElementById(
                'numero'
            )?.value;


        const posicion =
            document.getElementById(
                'posicion'
            )?.value || null;


        const esEspecial =
            document.getElementById(
                'esEspecial'
            )?.checked || false;


        const fotoInput =
            document.getElementById(
                'foto'
            );


        const fotoCedulaInput =
            document.getElementById(
                'fotoCedula'
            );


        if (!nombres) {

            mostrarMensaje(
                'mensajeJugador',
                'Ingrese los nombres del jugador.',
                'error'
            );

            return;
        }


        if (!apellidos) {

            mostrarMensaje(
                'mensajeJugador',
                'Ingrese los apellidos del jugador.',
                'error'
            );

            return;
        }


        if (!documento) {

            mostrarMensaje(
                'mensajeJugador',
                'Ingrese el número de cédula.',
                'error'
            );

            return;
        }


        if (!fechaNacimiento) {

            mostrarMensaje(
                'mensajeJugador',
                'Ingrese la fecha de nacimiento.',
                'error'
            );

            return;
        }


        if (!numero) {

            mostrarMensaje(
                'mensajeJugador',
                'Ingrese el número del jugador.',
                'error'
            );

            return;
        }


        const datosJugador = {

            nombres,

            apellidos,

            fecha_nacimiento:
                fechaNacimiento,

            numero_cedula:
                documento,

            origen,

            activo: true
        };


        // ---------------------------------------------
        // JUGADOR NUEVO
        // ---------------------------------------------

        let jugador;


        if (jugadorId) {

            const {
                data,
                error
            } = await supabase
                .from('jugador')
                .update(datosJugador)
                .eq('id', jugadorId)
                .select()
                .single();


            if (error) {

                console.error(
                    'Error actualizando jugador:',
                    error
                );

                mostrarMensaje(
                    'mensajeJugador',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }


            jugador = data;

        } else {

            const {
                data,
                error
            } = await supabase
                .from('jugador')
                .insert(datosJugador)
                .select()
                .single();


            if (error) {

                console.error(
                    'Error creando jugador:',
                    error
                );

                mostrarMensaje(
                    'mensajeJugador',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }


            jugador = data;
        }


        // ---------------------------------------------
        // ACTUALIZAR FOTOS SI SE USAN
        // ---------------------------------------------

        // Por ahora se conservan los campos de foto.
        // La subida a Storage la implementaremos
        // después de verificar el funcionamiento
        // completo de la inscripción.


        // ---------------------------------------------
        // INSCRIPCIÓN DEL JUGADOR
        // ---------------------------------------------

        const datosInscripcion = {

            inscripcion_equipo_id:
                inscripcionActual.id,

            jugador_id:
                jugador.id,

            numero:
                parseInt(numero, 10),

            posicion,

            es_especial:
                esEspecial,

            estado:
                'Pendiente'
        };


        // Verificar si ya está inscrito
        const {
            data: existente,
            error: errorExistente
        } = await supabase
            .from('inscripcion_jugador')
            .select('id')
            .eq(
                'inscripcion_equipo_id',
                inscripcionActual.id
            )
            .eq(
                'jugador_id',
                jugador.id
            )
            .maybeSingle();


        if (errorExistente) {

            console.error(
                'Error verificando inscripción del jugador:',
                errorExistente
            );

            mostrarMensaje(
                'mensajeJugador',
                obtenerMensajeError(errorExistente),
                'error'
            );

            return;
        }


        if (existente) {

            const {
                error
            } = await supabase
                .from('inscripcion_jugador')
                .update({

                    numero:
                        datosInscripcion.numero,

                    posicion:
                        datosInscripcion.posicion,

                    es_especial:
                        datosInscripcion.es_especial

                })
                .eq(
                    'id',
                    existente.id
                );


            if (error) {

                console.error(
                    'Error actualizando inscripción del jugador:',
                    error
                );

                mostrarMensaje(
                    'mensajeJugador',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }


        } else {

            const {
                error
            } = await supabase
                .from('inscripcion_jugador')
                .insert(
                    datosInscripcion
                );


            if (error) {

                console.error(
                    'Error agregando jugador a nómina:',
                    error
                );

                mostrarMensaje(
                    'mensajeJugador',
                    obtenerMensajeError(error),
                    'error'
                );

                return;
            }
        }


        mostrarMensaje(
            'mensajeJugador',
            jugadorId
                ? 'Jugador actualizado correctamente.'
                : 'Jugador registrado y agregado a la nómina.',
            'success'
        );


        limpiarFormularioJugador();


        await cargarNomina();

        actualizarResumen();


    } catch (error) {

        console.error(
            'Error general guardando jugador:',
            error
        );

        mostrarMensaje(
            'mensajeJugador',
            'Ocurrió un error al guardar el jugador.',
            'error'
        );
    }
}


// =====================================================
// EDITAR JUGADOR
// =====================================================

function editarJugador(inscripcionJugadorId) {

    const item =
        jugadores.find(
            j =>
                String(j.id) ===
                String(inscripcionJugadorId)
        );


    if (!item || !item.jugador) {

        return;
    }


    const jugador =
        item.jugador;


    const campoId =
        document.getElementById(
            'jugadorId'
        );


    const nombres =
        document.getElementById(
            'nombres'
        );


    const apellidos =
        document.getElementById(
            'apellidos'
        );


    const documento =
        document.getElementById(
            'documento'
        );


    const fecha =
        document.getElementById(
            'fechaNacimiento'
        );


    const origen =
        document.getElementById(
            'origen'
        );


    const numero =
        document.getElementById(
            'numero'
        );


    const posicion =
        document.getElementById(
            'posicion'
        );


    const especial =
        document.getElementById(
            'esEspecial'
        );


    if (campoId)
        campoId.value = jugador.id;


    if (nombres)
        nombres.value =
            jugador.nombres || '';


    if (apellidos)
        apellidos.value =
            jugador.apellidos || '';


    if (documento)
        documento.value =
            jugador.numero_cedula || '';


    if (fecha)
        fecha.value =
            jugador.fecha_nacimiento || '';


    if (origen)
        origen.value =
            jugador.origen || '';


    if (numero)
        numero.value =
            item.numero ?? '';


    if (posicion)
        posicion.value =
            item.posicion || '';


    if (especial)
        especial.checked =
            !!item.es_especial;


    const titulo =
        document.getElementById(
            'tituloJugador'
        );


    if (titulo) {

        titulo.textContent =
            'Editar jugador';
    }


    const boton =
        document.getElementById(
            'guardarJugador'
        );


    if (boton) {

        boton.textContent =
            'Actualizar jugador';
    }


    mostrarSeccion('jugadores');


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


// =====================================================
// LIMPIAR FORMULARIO
// =====================================================

function limpiarFormularioJugador() {

    const formulario =
        document.getElementById(
            'formJugador'
        );


    if (formulario) {

        formulario.reset();
    }


    const id =
        document.getElementById(
            'jugadorId'
        );


    if (id) {

        id.value = '';
    }


    const titulo =
        document.getElementById(
            'tituloJugador'
        );


    if (titulo) {

        titulo.textContent =
            'Registrar jugador';
    }


    const boton =
        document.getElementById(
            'guardarJugador'
        );


    if (boton) {

        boton.textContent =
            'Guardar jugador';
    }


    const mensaje =
        document.getElementById(
            'mensajeJugador'
        );


    if (mensaje) {

        mensaje.textContent = '';

        mensaje.className = '';
    }
}


// =====================================================
// ACTUALIZAR INTERFAZ SEGÚN ROL
// =====================================================

function actualizarInterfazRol() {

    const selectEquipo =
        document.getElementById(
            'equipo'
        );


    const selectCapitan =
        document.getElementById(
            'capitan'
        );


    if (esCapitan()) {

        // El capitán no cambia de equipo
        if (selectEquipo) {

            selectEquipo.disabled =
                true;
        }


        // El capitán no cambia de capitán
        if (selectCapitan) {

            selectCapitan.disabled =
                true;
        }


        const botonInscripcion =
            document.getElementById(
                'crearInscripcionEquipo'
            );


        if (botonInscripcion) {

            botonInscripcion.textContent =
                'Guardar inscripción';
        }
    }


    if (esAdministrador()) {

        if (selectEquipo) {

            selectEquipo.disabled =
                false;
        }


        if (selectCapitan) {

            selectCapitan.disabled =
                false;
        }
    }


    // ---------------------------------------------
    // DOCUMENTOS
    // ---------------------------------------------

    actualizarDocumento();
}


// =====================================================
// ACTUALIZAR DATOS EN PANTALLA
// =====================================================

function actualizarDatosPantalla() {

    const inicioEquipo =
        document.getElementById(
            'inicioEquipo'
        );


    const inicioCompetencia =
        document.getElementById(
            'inicioCompetencia'
        );


    const nominaEquipo =
        document.getElementById(
            'nominaEquipo'
        );


    const nominaCompetencia =
        document.getElementById(
            'nominaCompetencia'
        );


    const equipoNombre =
        obtenerEquipoSeleccionadoNombre();


    const competenciaNombre =
        obtenerCompetenciaSeleccionadaNombre();


    if (inicioEquipo) {

        inicioEquipo.textContent =
            equipoActual?.nombre ||
            equipoNombre ||
            '-';
    }


    if (inicioCompetencia) {

        inicioCompetencia.textContent =
            inscripcionActual?.competencia?.nombre ||
            competenciaNombre ||
            '-';
    }


    if (nominaEquipo) {

        nominaEquipo.textContent =
            equipoActual?.nombre ||
            equipoNombre ||
            '-';
    }


    if (nominaCompetencia) {

        nominaCompetencia.textContent =
            inscripcionActual?.competencia?.nombre ||
            competenciaNombre ||
            '-';
    }


    actualizarDocumento();
}


// =====================================================
// RESUMEN
// =====================================================

function actualizarResumen() {

    const totalJugadores =
        document.getElementById(
            'totalJugadores'
        );


    const totalNomina =
        document.getElementById(
            'totalNomina'
        );


    const totalPendientes =
        document.getElementById(
            'totalPendientes'
        );


    const totalAprobados =
        document.getElementById(
            'totalAprobados'
        );


    const cantidad =
        jugadores.length;


    const pendientes =
        jugadores.filter(
            j =>
                normalizarRol(j.estado || '') ===
                'PENDIENTE'
        ).length;


    const aprobados =
        jugadores.filter(
            j =>
                normalizarRol(j.estado || '') ===
                'APROBADA'
        ).length;


    if (totalJugadores)
        totalJugadores.textContent =
            cantidad;


    if (totalNomina)
        totalNomina.textContent =
            cantidad;


    if (totalPendientes)
        totalPendientes.textContent =
            pendientes;


    if (totalAprobados)
        totalAprobados.textContent =
            aprobados;
}


// =====================================================
// DOCUMENTO
// =====================================================

function actualizarDocumento() {

    const elemento =
        document.getElementById(
            'documentoActual'
        );


    if (!elemento) return;


    const documento =
        inscripcionActual?.documento_autorizado;


    if (!documento) {

        elemento.textContent =
            'No se ha registrado documento autorizado.';

        return;
    }


    mostrarDocumento(documento);
}


function mostrarDocumento(documento) {

    const elemento =
        document.getElementById(
            'documentoActual'
        );


    if (!elemento) return;


    elemento.innerHTML = `

        <a
            href="${escapeAttribute(documento)}"
            target="_blank"
            rel="noopener noreferrer">
            Ver documento autorizado
        </a>

    `;
}


// =====================================================
// OBTENER NOMBRES
// =====================================================

function obtenerNombreUsuario() {

    if (perfilActual) {

        return `${perfilActual.nombres || ''} ${perfilActual.apellidos || ''}`
            .trim();
    }


    return usuarioActual?.email ||
        'Capitán';
}


function obtenerEquipoSeleccionadoNombre() {

    const select =
        document.getElementById(
            'equipo'
        );


    if (!select) return '';


    const option =
        select.options[
            select.selectedIndex
        ];


    return option?.textContent || '';
}


function obtenerCompetenciaSeleccionadaNombre() {

    const select =
        document.getElementById(
            'competencia'
        );


    if (!select) return '';


    const option =
        select.options[
            select.selectedIndex
        ];


    return option?.textContent || '';
}


// =====================================================
// MENSAJES
// =====================================================

function mostrarMensaje(
    id,
    mensaje,
    tipo = 'info'
) {

    const elemento =
        document.getElementById(id);


    if (!elemento) return;


    elemento.textContent =
        mensaje;


    elemento.className =
        `mensaje ${tipo}`;
}


// =====================================================
// ERROR SUPABASE
// =====================================================

function obtenerMensajeError(error) {

    if (!error) {

        return 'Ocurrió un error.';
    }


    console.error(error);


    if (
        error.code === '42501'
    ) {

        return 'No tiene permisos para realizar esta operación.';
    }


    if (
        error.code === '23505'
    ) {

        return 'Este registro ya existe.';
    }


    if (
        error.code === '23503'
    ) {

        return 'El registro está relacionado con otro dato que no existe.';
    }


    if (
        error.code === 'PGRST116'
    ) {

        return 'No se encontró el registro solicitado.';
    }


    return (
        error.message ||
        error.details ||
        error.hint ||
        'Ocurrió un error en la base de datos.'
    );
}


// =====================================================
// SEGURIDAD HTML
// =====================================================

function escapeHTML(valor) {

    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function escapeAttribute(valor) {

    return escapeHTML(valor);
}