
import { supabase } from './supabase.js';

/* =====================================================
   OLIMPIADAS JUAN SOLANO 2026
   CONTROL DE ACCESO POR ROLES
   ===================================================== */

// Acceso predeterminado al panel administrativo
const ROLES_PERMITIDOS = [
    'ADMINISTRADOR',
    'COMISION'
];

/* =====================================================
   OBTENER SESIÓN
   ===================================================== */

export async function obtenerSesion() {

    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('ERROR OBTENIENDO SESIÓN:', error);
        return null;
    }

    return data.session;
}

/* =====================================================
   OBTENER USUARIO Y SUS ROLES
   ===================================================== */

export async function obtenerUsuarioActual() {

    const session = await obtenerSesion();

    if (!session) {
        console.error('NO EXISTE SESIÓN ACTIVA');
        return null;
    }

    const usuarioId = session.user.id;

    console.log('USUARIO ID:', usuarioId);

    // Consultar perfil
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
        console.error('ERROR OBTENIENDO PERFIL:', errorPerfil);
    }

    if (perfil && perfil.activo === false) {

        console.error('USUARIO DESACTIVADO');

        await supabase.auth.signOut();

        return null;
    }

    // Consultar roles
    const {
        data: rolesData,
        error: errorRoles
    } = await supabase
        .from('usuario_rol')
        .select(`
            rol:rol_id (
                nombre
            )
        `)
        .eq('usuario_id', usuarioId);

    if (errorRoles) {
        console.error('ERROR OBTENIENDO ROLES:', errorRoles);
    }

    const roles = (rolesData || [])
        .map(item => item.rol?.nombre)
        .filter(Boolean)
        .map(nombre => String(nombre).trim().toUpperCase());

    const usuario = {

        id: usuarioId,

        email: session.user.email,

        nombres: perfil?.nombres || '',

        apellidos: perfil?.apellidos || '',

        activo: perfil?.activo ?? true,

        roles: roles,

        session: session
    };

    console.log('USUARIO ACTUAL:', usuario);
    console.log('ROLES DEL USUARIO:', roles);

    return usuario;
}

/* =====================================================
   COMPROBAR SI TIENE UN ROL AUTORIZADO
   ===================================================== */

export function tieneRol(usuario, rolesPermitidos = []) {

    if (!usuario) {
        return false;
    }

    const rolesUsuario = (usuario.roles || [])
        .map(rol => String(rol).trim().toUpperCase());

    const rolesAutorizados = rolesPermitidos
        .map(rol => String(rol).trim().toUpperCase());

    // El administrador tiene acceso general
    if (rolesUsuario.includes('ADMINISTRADOR')) {
        return true;
    }

    return rolesUsuario.some(
        rol => rolesAutorizados.includes(rol)
    );
}

/* =====================================================
   DETERMINAR PÁGINA SEGÚN EL ROL
   ===================================================== */

function obtenerDestinoPorRol(usuario) {

    const roles = usuario?.roles || [];

    if (roles.includes('ARBITRO')) {
        return '/admin/nomina-partido.html';
    }

    if (roles.includes('CAPITAN')) {
        return '/admin/jugadores-capitan.html';
    }

    if (roles.includes('ADMINISTRADOR')) {
        return '/admin/index.html';
    }

    if (roles.includes('COMISION')) {
        return '/admin/index.html';
    }

    if (roles.includes('DELEGADO_MESA')) {
        return '/admin/index.html';
    }

    return '/login.html';
}

/* =====================================================
   PROTEGER PÁGINAS ADMINISTRATIVAS

   Por defecto:
   ADMINISTRADOR y COMISION.

   El árbitro debe autorizarse expresamente
   en su página de nóminas.
   ===================================================== */

export async function protegerAdmin(
    rolesPermitidos = ROLES_PERMITIDOS
) {

    const usuario = await obtenerUsuarioActual();

    // Sin sesión
    if (!usuario) {

        alert('Debe iniciar sesión para acceder a esta página.');

        window.location.replace('/login.html');

        return null;
    }

    console.log('VERIFICANDO ACCESO...');
    console.log('ROLES:', usuario.roles);
    console.log('ROLES PERMITIDOS:', rolesPermitidos);

    // Comprobar permisos
    if (!tieneRol(usuario, rolesPermitidos)) {

        console.warn('ACCESO DENEGADO');

        const destino = obtenerDestinoPorRol(usuario);

        alert(
            'No tiene permisos para acceder a esta sección.\n' +
            'Su rol es: ' + usuario.roles.join(', ')
        );

        // Evitar redireccionamiento repetido
        if (window.location.pathname !== destino) {
            window.location.replace(destino);
        }

        return null;
    }

    console.log('ACCESO AUTORIZADO');

    return usuario;
}

/* =====================================================
   NOMBRE COMPLETO
   ===================================================== */

export function nombreCompleto(usuario) {

    if (!usuario) return '';

    const nombre = usuario.nombres || '';
    const apellido = usuario.apellidos || '';

    const completo = `${nombre} ${apellido}`.trim();

    return completo || usuario.email || 'Usuario';
}

/* =====================================================
   MOSTRAR ROLES
   ===================================================== */

export function rolesTexto(usuario) {

    if (!usuario) {
        return 'SIN USUARIO';
    }

    if (!usuario.roles || usuario.roles.length === 0) {
        return 'SIN ROLES ASIGNADOS';
    }

    return usuario.roles.join(' / ');
}

/* =====================================================
   CERRAR SESIÓN
   ===================================================== */

export async function cerrarSesion() {

    const { error } = await supabase.auth.signOut();

    if (error) {

        console.error('ERROR CERRANDO SESIÓN:', error);

        alert('No fue posible cerrar la sesión.');

        return;
    }

    window.location.replace('/login.html');
}

/* =====================================================
   ESCUCHAR CAMBIOS DE SESIÓN
   ===================================================== */

export function escucharSesion(callback) {

    return supabase.auth.onAuthStateChange(
        (event, session) => {

            console.log('CAMBIO DE AUTENTICACIÓN:', event);

            callback(event, session);
        }
    );
}
