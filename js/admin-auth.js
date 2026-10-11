import { supabase } from './supabase.js';

/* ROLES PERMITIDOS */
const ROLES_PERMITIDOS = [
    'ADMINISTRADOR',
    'COMISION',
    'CAPITAN',
    'ARBITRO',
    'DELEGADO_MESA'
];

/* OBTENER SESIÓN */
export async function obtenerSesion() {

    const { data, error } =
        await supabase.auth.getSession();

    if (error) {
        console.error(
            'ERROR OBTENIENDO SESIÓN:',
            error
        );
        return null;
    }

    console.log(
        'SESIÓN ACTUAL:',
        data.session
    );

    return data.session;
}

/* OBTENER USUARIO ACTUAL */
export async function obtenerUsuarioActual() {

    const session =
        await obtenerSesion();

    if (!session) {

        console.error(
            'NO EXISTE SESIÓN ACTIVA'
        );

        return null;
    }

    const usuarioId =
        session.user.id;

    console.log(
        'USUARIO ID:',
        usuarioId
    );

    const {
        data: perfil,
        error: errorPerfil
    } = await supabase
        .from('perfil_usuario')
        .select(`
            id,
            nombres,
            apellidos,
            activo
        `)
        .eq('id', usuarioId)
        .maybeSingle();

    if (errorPerfil) {

        console.error(
            'ERROR OBTENIENDO PERFIL:',
            errorPerfil
        );

        return null;
    }

    /*
     * Si no existe perfil, NO bloqueamos
     * el acceso mientras terminamos de
     * configurar los roles.
     */
    if (!perfil) {

        console.warn(
            'NO EXISTE PERFIL PARA ESTE USUARIO'
        );

        return {
            id: usuarioId,
            email: session.user.email,
            nombres: '',
            apellidos: '',
            activo: true,
            roles: [],
            session: session
        };
    }

    if (perfil.activo === false) {

        console.error(
            'EL USUARIO ESTÁ DESACTIVADO'
        );

        await supabase.auth.signOut();

        return null;
    }

    /*
     * Intentamos obtener los roles.
     * Si todavía no están configurados,
     * no bloqueamos la sesión.
     */

    const {
        data: rolesData,
        error: errorRoles
    } = await supabase
        .from('usuario_rol')
        .select(`
            rol_id,
            rol (
                id,
                nombre
            )
        `)
        .eq('usuario_id', usuarioId);

    if (errorRoles) {

        console.warn(
            'ERROR OBTENIENDO ROLES:',
            errorRoles
        );

        return {
            id: usuarioId,
            email: session.user.email,
            nombres: perfil.nombres || '',
            apellidos: perfil.apellidos || '',
            activo: perfil.activo,
            roles: [],
            session: session
        };
    }

    const roles =
        (rolesData || [])
            .map(item => item.rol?.nombre)
            .filter(Boolean);

    console.log(
        'ROLES DEL USUARIO:',
        roles
    );

    return {

        id: usuarioId,

        email: session.user.email,

        nombres: perfil.nombres || '',

        apellidos: perfil.apellidos || '',

        activo: perfil.activo,

        roles: roles,

        session: session
    };
}

/* COMPROBAR ROL */
export function tieneRol(
    usuario,
    rolesPermitidos = []
) {

    if (!usuario) {
        return false;
    }

    /*
     * ADMINISTRADOR tiene acceso general.
     */
    if (
        usuario.roles &&
        usuario.roles.includes(
            'ADMINISTRADOR'
        )
    ) {
        return true;
    }

    return usuario.roles?.some(
        rol =>
            rolesPermitidos.includes(rol)
    ) || false;
}

/* PROTEGER PANEL */
export async function protegerAdmin(
    rolesPermitidos = ROLES_PERMITIDOS
) {

    const usuario =
        await obtenerUsuarioActual();

    if (!usuario) {

        alert(
            'Debe iniciar sesión para acceder al panel administrativo.'
        );

        window.location.href =
            '/login.html';

        return null;
    }

    /*
     * TEMPORALMENTE:
     * cualquier usuario con sesión puede
     * entrar mientras terminamos la
     * configuración de roles.
     */
    return usuario;
}

/* NOMBRE COMPLETO */
export function nombreCompleto(
    usuario
) {

    if (!usuario) return '';

    const nombre =
        usuario.nombres || '';

    const apellido =
        usuario.apellidos || '';

    const completo =
        `${nombre} ${apellido}`.trim();

    return (
        completo ||
        usuario.email ||
        'Usuario'
    );
}

/* MOSTRAR ROLES */
export function rolesTexto(
    usuario
) {

    if (!usuario) {
        return 'SIN USUARIO';
    }

    if (
        !usuario.roles ||
        usuario.roles.length === 0
    ) {
        return 'ACCESO ADMINISTRATIVO';
    }

    return usuario.roles.join(
        ' / '
    );
}

/* CERRAR SESIÓN */
export async function cerrarSesion() {

    const {
        error
    } = await supabase.auth.signOut();

    if (error) {

        console.error(
            'ERROR CERRANDO SESIÓN:',
            error
        );

        alert(
            'No fue posible cerrar la sesión.'
        );

        return;
    }

    window.location.href =
        '/login.html';
}

/* ESCUCHAR CAMBIOS DE SESIÓN */
export function escucharSesion(
    callback
) {

    return supabase.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

            console.log(
                'CAMBIO DE AUTENTICACIÓN:',
                event
            );

            callback(
                event,
                session
            );
        }
    );
}