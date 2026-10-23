import { supabase } from './supabase.js';

console.log('✅ equipos.js cargado');

// =====================================================
// ELEMENTOS HTML
// =====================================================

const listaEquipos = document.getElementById('listaEquipos');
const buscarEquipo = document.getElementById('buscarEquipo');
const totalEquipos = document.getElementById('totalEquipos');

let equiposInscritos = [];

// =====================================================
// UTILIDADES
// =====================================================

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mostrarEstado(estado) {
  const valor = normalizarTexto(estado);

  const estados = {
    'aprobada': 'Aprobada',
    'aprobado': 'Aprobado',
    'pendiente': 'Pendiente',
    'en revision': 'En revisión',
    'observada': 'Observada',
    'rechazada': 'Rechazada',
    'habilitado': 'Habilitado',
    'habilitada': 'Habilitada',
    'activa': 'Activa',
    'activo': 'Activo'
  };

  return estados[valor] || estado || 'Sin estado';
}

function claseEstado(estado) {
  const valor = normalizarTexto(estado);

  if (
    valor === 'aprobada' ||
    valor === 'aprobado' ||
    valor === 'habilitado' ||
    valor === 'habilitada' ||
    valor === 'activo' ||
    valor === 'activa'
  ) {
    return 'estado-aprobado';
  }

  if (valor === 'rechazada') return 'estado-rechazado';
  if (valor === 'observada') return 'estado-observado';

  return 'estado-pendiente';
}

// =====================================================
// LOGO DEL EQUIPO
// =====================================================

function obtenerUrlLogo(logo) {
  if (!logo) return '';

  // Si Supabase ya guarda una URL completa, se utiliza directamente.
  if (/^https?:\/\//i.test(logo)) {
    return logo;
  }

  // Si guarda una ruta, se busca en el bucket público de logos.
  const ruta = logo
    .replace(/^logos-equipos\//, '')
    .replace(/^\/+/, '');

  const { data } = supabase.storage
    .from('logos-equipos')
    .getPublicUrl(ruta);

  return data?.publicUrl || '';
}

// =====================================================
// CONSULTAR EQUIPOS INSCRITOS
// =====================================================

async function cargarEquipos() {
  if (!listaEquipos) {
    console.error('No existe el elemento HTML #listaEquipos');
    return;
  }

  listaEquipos.innerHTML = `
    <div class="estado-equipos">
      Cargando equipos inscritos...
    </div>
  `;

  try {
    const { data: inscripciones, error } = await supabase
      .from('inscripcion_equipo')
      .select(`
        id,
        equipo_id,
        competencia_id,
        estado,
        equipo:equipo_id (
          id,
          nombre,
          logo
        )
      `)
      .order('id', { ascending: true });

    if (error) throw error;

    if (!inscripciones || inscripciones.length === 0) {
      equiposInscritos = [];
      renderizarEquipos();

      listaEquipos.innerHTML = `
        <div class="estado-equipos">
          Todavía no hay equipos inscritos.
        </div>
      `;

      return;
    }

    // Consultar los nombres de las competencias.
    const competenciaIds = [
      ...new Set(
        inscripciones
          .map(item => item.competencia_id)
          .filter(id => id != null)
      )
    ];

    let competencias = [];

    if (competenciaIds.length > 0) {
      const { data, error: errorCompetencias } = await supabase
        .from('competencia')
        .select('id, nombre')
        .in('id', competenciaIds);

      if (errorCompetencias) {
        console.warn(
          'No se pudieron cargar los nombres de las competencias:',
          errorCompetencias.message
        );
      } else {
        competencias = data || [];
      }
    }

    const mapaCompetencias = new Map(
      competencias.map(competencia => [
        String(competencia.id),
        competencia.nombre
      ])
    );

    equiposInscritos = inscripciones
      .filter(inscripcion => inscripcion.equipo)
      .map(inscripcion => ({
        inscripcionId: inscripcion.id,
        equipoId: inscripcion.equipo_id,
        nombre: inscripcion.equipo.nombre || 'Equipo sin nombre',
        logo: inscripcion.equipo.logo || '',
        competenciaId: inscripcion.competencia_id,
        competencia:
          mapaCompetencias.get(String(inscripcion.competencia_id)) ||
          'Competencia no disponible',
        estado: inscripcion.estado || 'Sin estado'
      }));

    renderizarEquipos();

    console.log(
      `✅ Inscripciones de equipos cargadas: ${equiposInscritos.length}`
    );

  } catch (error) {
    console.error('❌ Error consultando equipos inscritos:', error);

    listaEquipos.innerHTML = `
      <div class="estado-equipos">
        <strong>No se pudieron cargar los equipos.</strong>
        <p>${escaparHTML(error.message || 'Error de conexión con Supabase.')}</p>
        <p>Verifica los permisos de lectura y las relaciones de la tabla
        inscripcion_equipo.</p>
      </div>
    `;

    if (totalEquipos) totalEquipos.textContent = '0';
  }
}

// =====================================================
// MOSTRAR EQUIPOS
// =====================================================

function renderizarEquipos() {
  if (!listaEquipos) return;

  const busqueda = normalizarTexto(buscarEquipo?.value || '');

  const filtrados = equiposInscritos.filter(equipo => {
    const contenido = normalizarTexto(
      `${equipo.nombre} ${equipo.competencia} ${equipo.estado}`
    );

    return contenido.includes(busqueda);
  });

  if (totalEquipos) {
    totalEquipos.textContent = String(filtrados.length);
  }

  if (filtrados.length === 0) {
    listaEquipos.innerHTML = `
      <div class="estado-equipos">
        No se encontraron equipos inscritos con ese criterio.
      </div>
    `;
    return;
  }

  listaEquipos.innerHTML = filtrados.map((equipo, indice) => {
    const nombre = escaparHTML(equipo.nombre);
    const competencia = escaparHTML(equipo.competencia);
    const estado = escaparHTML(mostrarEstado(equipo.estado));
    const clase = claseEstado(equipo.estado);
    const logoUrl = obtenerUrlLogo(equipo.logo);
    const logoSeguro = escaparHTML(logoUrl);

    return `
      <article class="tarjeta-equipo-publico">
        <div class="equipo-publico-cabecera">
          ${
            logoSeguro
              ? `
                <img
                  class="escudo-equipo-publico"
                  src="${logoSeguro}"
                  alt="Escudo de ${nombre}"
                  loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.hidden=false">

                <div class="escudo-equipo-fallback" hidden>
                  ${indice + 1}
                </div>
              `
              : `
                <div class="escudo-equipo-fallback">
                  ${indice + 1}
                </div>
              `
          }

          <div class="equipo-publico-datos">
            <h3>${nombre}</h3>
            <p class="equipo-publico-competencia">
              ${competencia}
            </p>
          </div>
        </div>

        <div class="equipo-publico-pie">
          <span class="etiqueta-estado ${clase}">
            ${estado}
          </span>
          <span class="equipo-publico-numero">
            Inscripción #${escaparHTML(equipo.inscripcionId)}
          </span>
        </div>
      </article>
    `;
  }).join('');
}

// =====================================================
// BUSCADOR
// =====================================================

if (buscarEquipo) {
  buscarEquipo.addEventListener('input', renderizarEquipos);
}

// =====================================================
// INICIO
// =====================================================

cargarEquipos();