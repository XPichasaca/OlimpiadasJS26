
import { supabase } from './supabase.js';

const form = document.getElementById('formLogin');
const mensaje = document.getElementById('mensaje');
const btnLogin = document.getElementById('btnLogin');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    mensaje.textContent = 'Iniciando sesión...';
    mensaje.className = '';
    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';

    try {
        // 1. Iniciar sesión
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const user = data.user;

        if (!user) {
            throw new Error('No se pudo identificar al usuario.');
        }

        console.log('USUARIO AUTENTICADO:', user);
        console.log('SESION:', data.session);

        // 2. Consultar los roles del usuario
        const { data: rolesUsuario, error: errorRoles } =
            await supabase
                .from('usuario_rol')
                .select(`
                    rol:rol_id (
                        nombre
                    )
                `)
                .eq('usuario_id', user.id);

        if (errorRoles) {
            console.error('ERROR AL CONSULTAR ROLES:', errorRoles);
            throw new Error(
                'No se pudieron consultar tus roles. Verifica los permisos de Supabase.'
            );
        }

        const roles = (rolesUsuario || [])
            .map(item => item.rol?.nombre)
            .filter(Boolean);

        console.log('ROLES DEL USUARIO:', roles);

        // 3. Redirigir según el rol
        let destino = '';

        if (roles.includes('ADMINISTRADOR')) {
            destino = '/admin/index.html';
        } else if (roles.includes('CAPITAN')) {
            destino = '/admin/jugadores-capitan.html';
        } else if (roles.includes('COMISION')) {
            destino = '/admin/index.html';
        } else if (roles.includes('ARBITRO')) {
            destino = '/admin/nomina-partido.html';
        } else if (roles.includes('DELEGADO_MESA')) {
            destino = '/admin/index.html';
        } else {
            await supabase.auth.signOut();
            throw new Error(
                'Tu usuario no tiene un rol autorizado para ingresar.'
            );
        }

        // 4. Mostrar confirmación y redirigir
        mensaje.textContent = '✅ Inicio de sesión correcto';
        mensaje.className = 'mensaje-exito';
        btnLogin.textContent = 'Accediendo al sistema...';

        console.log('DESTINO DE REDIRECCIÓN:', destino);

        window.location.assign(destino);

    } catch (error) {
        console.error('ERROR LOGIN:', error);

        mensaje.textContent = '❌ ' + error.message;
        mensaje.className = 'mensaje-error';

        btnLogin.disabled = false;
        btnLogin.textContent = 'Ingresar al sistema';
    }
});
