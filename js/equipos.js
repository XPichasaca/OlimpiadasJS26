import { supabase } from './supabase.js';

const form = document.getElementById('formEquipo');
const lista = document.getElementById('listaEquipos');

async function cargarEquipos() {

    const { data, error } = await supabase
        .from('equipo')
        .select('id, nombre, representante, contacto, activo')
        .order('nombre');

        console.log('DATA:', data);
        console.log('ERROR:', error);

    if (error) {
        console.error(error);
        lista.innerHTML = '<p>Error al cargar los equipos.</p>';
        return;
    }

    lista.innerHTML = '';

    data.forEach(equipo => {

        const div = document.createElement('div');

        div.innerHTML = `
            <strong>${equipo.nombre}</strong>
            <br>
            Representante: ${equipo.representante || '-'}
            <br>
            Contacto: ${equipo.contacto || '-'}
            <br>
            Estado: ${equipo.activo ? 'Activo' : 'Inactivo'}
            <hr>
        `;

        lista.appendChild(div);
    });
}


form.addEventListener('submit', async (event) => {

    event.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const representante = document.getElementById('representante').value.trim();
    const contacto = document.getElementById('contacto').value.trim();

    const { error } = await supabase
        .from('equipo')
        .insert({
            nombre,
            representante,
            contacto
        });

    if (error) {
        alert('Error: ' + error.message);
        return;
    }

    form.reset();

    cargarEquipos();
});

const { data: { user } } = await supabase.auth.getUser();

console.log('USUARIO:', user);


cargarEquipos();