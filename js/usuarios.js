import { supabase } from './supabase.js';

import {
    protegerAdmin,
    nombreCompleto,
    rolesTexto
} from './admin-auth.js';


/* =========================================================
   VARIABLES
========================================================= */

let usuarioActual = null;

const form = document.getElementById('formUsuario');
const mensaje = document.getElementById('mensaje');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');

const listaUsuarios = document.getElementById('listaUsuarios');

const nombreUsuario = document.getElementById('nombreUsuario');
const rolUsuario = document.getElementById('rolUsuario');


/* =========================================================
   INICIAR
========================================================= */

async function iniciar() {

    console.log('INICIANDO MÓDULO DE USUARIOS...');

    usuarioActual = await protegerAdmin();

    if (!usuarioActual) {
        return;
    }

    console.log('USUARIO ACTUAL:', usuarioActual);

    nombreUsuario.textContent =
        nombreCompleto(usuarioActual);

    rolUsuario.textContent =
        rolesTexto(usuarioActual);

    await cargarUsuarios();
}


/* =========================================================
   CREAR USUARIO
========================================================= */

form.addEventListener('submit', async (event) => {

    event.preventDefault();

    const nombres =
        document.getElementById('nombres')
        .value
        .trim();

    const apellidos =
        document.getElementById('apellidos')
        .value
        .trim();

    const email =
        document.getElementById('email')
        .value
        .trim();

    const password =
        document.getElementById('password')
        .value;

    const rol =
        document.getElementById('rol')
        .value;

    const activo =
        document.getElementById('activo')
        .value === 'true';


    if (!nombres ||
        !apellidos ||
        !email ||
        !password ||
        !rol) {

        mostrarMensaje(
            'Complete todos los campos obligatorios.',
            'error'
        );

        return;
    }


    if (password.length < 6) {

        mostrarMensaje(
            'La contraseña debe tener al menos 6 caracteres.',
            'error'
        );

        return;
    }


    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Creando usuario...';

    mostrarMensaje(
        'Creando usuario...',
        ''
    );


    try {

        const {
            data: sessionData,
            error: sessionError
        } = await supabase.auth.getSession();


        if (sessionError || !sessionData.session) {

            throw new Error(
                'No existe una sesión administrativa activa.'
            );
        }


        const token =
            sessionData.session.access_token;


        const respuesta =
            await fetch(
                `${supabase.supabaseUrl}/functions/v1/crear-usuario`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization':
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        nombres,
                        apellidos,
                        email,
                        password,
                        rol,
                        activo

                    })
                }
            );


        const resultado =
            await respuesta.json();


        console.log(
            'RESPUESTA CREAR USUARIO:',
            resultado
        );


        if (!respuesta.ok) {

            throw new Error(
                resultado.error ||
                'No fue posible crear el usuario.'
            );
        }


        mostrarMensaje(
            '✅ Usuario creado correctamente.',
            'exito'
        );


        form.reset();

        document.getElementById('activo').value =
            'true';


        await cargarUsuarios();


    } catch (error) {

        console.error(
            'ERROR CREANDO USUARIO:',
            error
        );

        mostrarMensaje(
            '❌ ' + error.message,
            'error'
        );

    } finally {

        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Crear usuario';

    }

});


/* =========================================================
   CARGAR USUARIOS
========================================================= */

async function cargarUsuarios() {

    listaUsuarios.innerHTML = `
        <tr>
            <td colspan="4">
                Cargando usuarios...
            </td>
        </tr>
    `;


    try {

        const {
            data,
            error
        } = await supabase
            .from('perfil_usuario')
            .select(`
                id,
                nombres,
                apellidos,
                activo,
                usuario_rol (
                    rol (
                        nombre
                    )
                )
            `)
            .order('nombres', {
                ascending: true
            });


        if (error) {

            console.error(
                'ERROR CARGANDO USUARIOS:',
                error
            );

            throw error;
        }


        console.log(
            'USUARIOS:',
            data
        );


        if (!data || data.length === 0) {

            listaUsuarios.innerHTML = `
                <tr>
                    <td colspan="4">
                        No existen usuarios registrados.
                    </td>
                </tr>
            `;

            return;
        }


        listaUsuarios.innerHTML = '';


        data.forEach(usuario => {

            const roles =
                (usuario.usuario_rol || [])
                    .map(item =>
                        item.rol?.nombre
                    )
                    .filter(Boolean);


            const rolesTextoLista =
                roles.length > 0
                    ? roles.join(' / ')
                    : 'SIN ROL';


            const estado =
                usuario.activo === false
                    ? 'INACTIVO'
                    : 'ACTIVO';


            const claseEstado =
                usuario.activo === false
                    ? 'estado-inactivo'
                    : 'estado-activo';


            const fila =
                document.createElement('tr');


            fila.innerHTML = `

                <td>
                    ${escapeHTML(
                        usuario.nombres || ''
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        usuario.apellidos || ''
                    )}
                </td>

                <td class="rol">
                    ${escapeHTML(
                        rolesTextoLista
                    )}
                </td>

                <td class="${claseEstado}">
                    ${estado}
                </td>

            `;


            listaUsuarios.appendChild(fila);

        });


    } catch (error) {

        console.error(
            'ERROR:',
            error
        );

        listaUsuarios.innerHTML = `
            <tr>
                <td colspan="4">
                    ❌ Error cargando los usuarios.
                </td>
            </tr>
        `;

    }

}


/* =========================================================
   MENSAJES
========================================================= */

function mostrarMensaje(texto, tipo) {

    mensaje.textContent = texto;

    mensaje.className =
        'mensaje ' + tipo;

}


/* =========================================================
   SEGURIDAD HTML
========================================================= */

function escapeHTML(texto) {

    return String(texto)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


/* =========================================================
   CANCELAR
========================================================= */

btnCancelar.addEventListener(
    'click',
    () => {

        form.reset();

        mensaje.textContent = '';

    }
);


/* =========================================================
   EJECUTAR
========================================================= */

iniciar();