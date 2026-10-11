import { supabase } from './supabase.js';

let competenciaEditando = null;

document.addEventListener('DOMContentLoaded', async () => {

    console.log('Iniciando módulo de competencias...');

    await cargarCampeonatos();
    await cargarDisciplinas();
    await cargarCategorias();
    await cargarGeneros();
    await cargarCompetencias();

    const formulario = document.getElementById('formCompetencia');

    if (formulario) {
        formulario.addEventListener('submit', guardarCompetencia);
    }
});


/* =====================================================
   MENSAJES
===================================================== */

function mostrarMensaje(texto, tipo = 'ok') {

    const elemento = document.getElementById('mensaje');

    if (!elemento) {
        console.warn('No existe el elemento #mensaje');
        return;
    }

    elemento.textContent = texto;
    elemento.className = `mensaje ${tipo}`;

    setTimeout(() => {

        elemento.textContent = '';
        elemento.className = 'mensaje';

    }, 5000);
}


/* =====================================================
   NUEVA COMPETENCIA
===================================================== */

window.nuevaCompetencia = function () {

    competenciaEditando = null;

    const formulario =
        document.getElementById('formCompetencia');

    if (formulario) {
        formulario.reset();
    }

    const titulo =
        document.getElementById('tituloFormulario');

    if (titulo) {
        titulo.textContent = 'Nueva competencia';
    }

    const contenedor =
        document.getElementById('formularioContenedor');

    if (contenedor) {
        contenedor.classList.add('mostrar');
    }

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};


/* =====================================================
   CANCELAR FORMULARIO
===================================================== */

window.cancelarFormulario = function () {

    competenciaEditando = null;

    const formulario =
        document.getElementById('formCompetencia');

    if (formulario) {
        formulario.reset();
    }

    const contenedor =
        document.getElementById('formularioContenedor');

    if (contenedor) {
        contenedor.classList.remove('mostrar');
    }
};


/* =====================================================
   CARGAR CAMPEONATOS
===================================================== */

async function cargarCampeonatos() {

    const select =
        document.getElementById('campeonato');

    if (!select) {

        console.error(
            'No existe el elemento #campeonato'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Cargando campeonatos...</option>';

    const { data, error } = await supabase
        .from('campeonato')
        .select('id, nombre')
        .order('nombre');

    if (error) {

        console.error(
            'Error cargando campeonatos:',
            error
        );

        select.innerHTML =
            '<option value="">Error al cargar</option>';

        mostrarMensaje(
            'No se pudieron cargar los campeonatos.',
            'error'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Seleccione campeonato...</option>';

    if (!data || data.length === 0) {

        select.innerHTML +=
            '<option value="">No existen campeonatos</option>';

        return;
    }

    data.forEach(item => {

        const option =
            document.createElement('option');

        option.value = item.id;
        option.textContent = item.nombre;

        select.appendChild(option);
    });

    console.log(
        'Campeonatos cargados:',
        data
    );
}


/* =====================================================
   CARGAR DISCIPLINAS
===================================================== */

async function cargarDisciplinas() {

    const select =
        document.getElementById('disciplina');

    if (!select) {

        console.error(
            'No existe el elemento #disciplina'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Cargando disciplinas...</option>';

    const { data, error } = await supabase
        .from('disciplina')
        .select('id, nombre')
        .order('nombre');

    if (error) {

        console.error(
            'Error cargando disciplinas:',
            error
        );

        select.innerHTML =
            '<option value="">Error al cargar</option>';

        mostrarMensaje(
            'No se pudieron cargar las disciplinas.',
            'error'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Seleccione disciplina...</option>';

    if (!data || data.length === 0) {

        select.innerHTML +=
            '<option value="">No existen disciplinas</option>';

        return;
    }

    data.forEach(item => {

        const option =
            document.createElement('option');

        option.value = item.id;
        option.textContent = item.nombre;

        select.appendChild(option);
    });

    console.log(
        'Disciplinas cargadas:',
        data
    );
}


/* =====================================================
   CARGAR CATEGORÍAS
===================================================== */

async function cargarCategorias() {

    const select =
        document.getElementById('categoria');

    if (!select) {

        console.error(
            'No existe el elemento #categoria'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Cargando categorías...</option>';

    const { data, error } = await supabase
        .from('categoria')
        .select('id, nombre')
        .order('nombre');

    if (error) {

        console.error(
            'Error cargando categorías:',
            error
        );

        select.innerHTML =
            '<option value="">Error al cargar</option>';

        mostrarMensaje(
            'No se pudieron cargar las categorías.',
            'error'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Seleccione categoría...</option>';

    if (!data || data.length === 0) {

        select.innerHTML +=
            '<option value="">No existen categorías</option>';

        return;
    }

    data.forEach(item => {

        const option =
            document.createElement('option');

        /*
         * Se guarda el ID,
         * no el nombre.
         */
        option.value = item.id;

        option.textContent = item.nombre;

        select.appendChild(option);
    });

    console.log(
        'Categorías cargadas:',
        data
    );
}


/* =====================================================
   CARGAR GÉNEROS
===================================================== */

async function cargarGeneros() {

    const select =
        document.getElementById('genero');

    if (!select) {

        console.error(
            'No existe el elemento #genero'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Cargando géneros...</option>';

    const { data, error } = await supabase
        .from('genero')
        .select('id, nombre')
        .order('nombre');

    if (error) {

        console.error(
            'Error cargando géneros:',
            error
        );

        select.innerHTML =
            '<option value="">Error al cargar</option>';

        mostrarMensaje(
            'No se pudieron cargar los géneros.',
            'error'
        );

        return;
    }

    select.innerHTML =
        '<option value="">Seleccione género...</option>';

    if (!data || data.length === 0) {

        select.innerHTML +=
            '<option value="">No existen géneros</option>';

        return;
    }

    data.forEach(item => {

        const option =
            document.createElement('option');

        /*
         * Se guarda el ID,
         * no el nombre.
         */
        option.value = item.id;

        option.textContent = item.nombre;

        select.appendChild(option);
    });

    console.log(
        'Géneros cargados:',
        data
    );
}


/* =====================================================
   CARGAR COMPETENCIAS
===================================================== */

async function cargarCompetencias() {

    const tbody =
        document.getElementById('listaCompetencias');

    if (!tbody) {

        console.error(
            'No existe el elemento #listaCompetencias'
        );

        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="sin-datos">
                Cargando competencias...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from('competencia')
        .select(`
            id,
            nombre,
            campeonato_id,
            disciplina_id,
            categoria_id,
            genero_id,
            fecha_limite_inscripcion,
            estado,
            campeonato(nombre),
            disciplina(nombre),
            categoria(id, nombre),
            genero(id, nombre)
        `)
        .order(
            'fecha_limite_inscripcion',
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            'Error cargando competencias:',
            error
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="sin-datos">
                    Error al cargar las competencias.
                </td>
            </tr>
        `;

        mostrarMensaje(
            error.message,
            'error'
        );

        return;
    }

    if (!data || data.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="sin-datos">
                    No existen competencias registradas.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = '';

    data.forEach(item => {

        const fila =
            document.createElement('tr');

        const campeonato =
            item.campeonato?.nombre || '-';

        const disciplina =
            item.disciplina?.nombre || '-';

        const categoria =
            item.categoria?.nombre || '-';

        const genero =
            item.genero?.nombre || '-';

        fila.innerHTML = `

            <td>
                ${campeonato}
            </td>

            <td>
                ${disciplina}
            </td>

            <td>
                ${categoria}
            </td>

            <td>
                ${genero}
            </td>

            <td>
                ${formatearFecha(
                    item.fecha_limite_inscripcion
                )}
            </td>

            <td>
                ${estadoHTML(item.estado)}
            </td>

            <td>

                <div class="acciones">

                    <button
                        type="button"
                        class="btn-ver"
                        onclick="verCompetencia('${item.id}')">
                        👁️ Ver
                    </button>

                    <button
                        type="button"
                        class="btn-editar"
                        onclick="editarCompetencia('${item.id}')">
                        ✏️
                    </button>

                    <button
                        type="button"
                        class="btn-eliminar"
                        onclick="eliminarCompetencia('${item.id}')">
                        🗑️
                    </button>

                </div>

            </td>
        `;

        tbody.appendChild(fila);
    });

    console.log(
        'Competencias cargadas:',
        data
    );
}


/* =====================================================
   GUARDAR COMPETENCIA
===================================================== */

async function guardarCompetencia(event) {

    event.preventDefault();

    const campeonatoSelect =
        document.getElementById('campeonato');

    const disciplinaSelect =
        document.getElementById('disciplina');

    const categoriaSelect =
        document.getElementById('categoria');

    const generoSelect =
        document.getElementById('genero');


    const campeonato_id =
        campeonatoSelect.value;

    const disciplina_id =
        disciplinaSelect.value;

    const categoria_id =
        categoriaSelect.value;

    const genero_id =
        generoSelect.value;


    /*
     * Obtenemos los nombres mostrados
     * en los desplegables.
     */

    const disciplinaNombre =
        disciplinaSelect
            .options[
                disciplinaSelect.selectedIndex
            ]?.text || '';

    const categoriaNombre =
        categoriaSelect
            .options[
                categoriaSelect.selectedIndex
            ]?.text || '';

    const generoNombre =
        generoSelect
            .options[
                generoSelect.selectedIndex
            ]?.text || '';


    /*
     * Generamos automáticamente
     * el nombre de la competencia.
     *
     * Ejemplo:
     *
     * Fútbol - Abierta - Masculino
     */

    const nombre =
        `${disciplinaNombre} - ${categoriaNombre} - ${generoNombre}`;


    const datos = {

        nombre: nombre,

        campeonato_id:
            campeonato_id,

        disciplina_id:
            disciplina_id,

        categoria_id:
            categoria_id,

        genero_id:
            genero_id,

        fecha_limite_inscripcion:
            document.getElementById(
                'fechaLimite'
            ).value,

        estado:
            document.getElementById(
                'estado'
            ).value
    };


    console.log(
        'Datos que se enviarán:',
        datos
    );


    /*
     * Validación
     */

    if (
        !datos.campeonato_id ||
        !datos.disciplina_id ||
        !datos.categoria_id ||
        !datos.genero_id ||
        !datos.fecha_limite_inscripcion
    ) {

        mostrarMensaje(
            'Complete todos los campos.',
            'error'
        );

        return;
    }


    let resultado;


    /*
     * EDITAR
     */

    if (competenciaEditando) {

        resultado = await supabase
            .from('competencia')
            .update(datos)
            .eq(
                'id',
                competenciaEditando
            );

    }

    /*
     * NUEVA
     */

    else {

        resultado = await supabase
            .from('competencia')
            .insert([
                datos
            ]);
    }


    /*
     * ERROR
     */

    if (resultado.error) {

        console.error(
            'Error guardando competencia:',
            resultado.error
        );


        if (
            resultado.error.code ===
            '23505'
        ) {

            mostrarMensaje(
                'Ya existe esta competencia para la misma disciplina, categoría y género.',
                'error'
            );

        }

        else {

            mostrarMensaje(
                resultado.error.message,
                'error'
            );
        }

        return;
    }


    /*
     * ÉXITO
     */

    mostrarMensaje(
        competenciaEditando
            ? 'Competencia actualizada correctamente.'
            : 'Competencia creada correctamente.'
    );


    cancelarFormulario();


    await cargarCompetencias();
}


/* =====================================================
   EDITAR COMPETENCIA
===================================================== */

window.editarCompetencia =
    async function (id) {

        const {
            data,
            error
        } = await supabase

            .from('competencia')

            .select(`
                id,
                nombre,
                campeonato_id,
                disciplina_id,
                categoria_id,
                genero_id,
                fecha_limite_inscripcion,
                estado
            `)

            .eq(
                'id',
                id
            )

            .single();


        if (error) {

            console.error(
                'Error editando competencia:',
                error
            );

            mostrarMensaje(
                'No se pudo cargar la competencia.',
                'error'
            );

            return;
        }


        competenciaEditando =
            id;


        const titulo =
            document.getElementById(
                'tituloFormulario'
            );

        if (titulo) {

            titulo.textContent =
                'Editar competencia';
        }


        document.getElementById(
            'campeonato'
        ).value =
            data.campeonato_id;


        document.getElementById(
            'disciplina'
        ).value =
            data.disciplina_id;


        document.getElementById(
            'categoria'
        ).value =
            data.categoria_id;


        document.getElementById(
            'genero'
        ).value =
            data.genero_id;


        document.getElementById(
            'fechaLimite'
        ).value =
            data.fecha_limite_inscripcion || '';


        document.getElementById(
            'estado'
        ).value =
            data.estado ||
            'PLANIFICADO';


        document
            .getElementById(
                'formularioContenedor'
            )
            .classList
            .add('mostrar');


        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };


/* =====================================================
   VER COMPETENCIA
===================================================== */

window.verCompetencia =
    function (id) {

        window.location.href =
            `detalle-competencia.html?id=${id}`;
    };


/* =====================================================
   ELIMINAR COMPETENCIA
===================================================== */

window.eliminarCompetencia =
    async function (id) {

        const confirmar =
            confirm(
                '¿Está seguro de eliminar esta competencia?'
            );


        if (!confirmar) {
            return;
        }


        const {
            error
        } = await supabase

            .from('competencia')

            .delete()

            .eq(
                'id',
                id
            );


        if (error) {

            console.error(
                'Error eliminando competencia:',
                error
            );

            mostrarMensaje(
                'No se puede eliminar esta competencia porque puede tener información relacionada.',
                'error'
            );

            return;
        }


        mostrarMensaje(
            'Competencia eliminada correctamente.'
        );


        await cargarCompetencias();
    };


/* =====================================================
   ESTADO
===================================================== */

function estadoHTML(estado) {

    if (!estado) {
        return '-';
    }


    let clase =
        'planificado';


    if (
        estado ===
        'INSCRIPCIONES'
    ) {

        clase =
            'inscripciones';
    }


    if (
        estado ===
        'EN_CURSO'
    ) {

        clase =
            'curso';
    }


    if (
        estado ===
        'FINALIZADO'
    ) {

        clase =
            'finalizado';
    }


    return `
        <span class="estado ${clase}">
            ${estado.replace(
                '_',
                ' '
            )}
        </span>
    `;
}


/* =====================================================
   FORMATEAR FECHA
===================================================== */

function formatearFecha(fecha) {

    if (!fecha) {
        return '-';
    }


    const partes =
        fecha.split('-');


    if (
        partes.length !== 3
    ) {

        return fecha;
    }


    return `
        ${partes[2]}/${partes[1]}/${partes[0]}
    `;
}