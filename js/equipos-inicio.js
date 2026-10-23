const rejilla = document.getElementById('rejillaEquipos');

// Evitar que un nombre o una URL inserten HTML no deseado
function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

// Tarjeta con solo logo y nombre (sin escudo de relleno)
function crearTarjetaEquipo(equipo) {
  const nombre = escaparHTML(equipo.nombre || 'Equipo');
  const logo = equipo.logo ? escaparHTML(equipo.logo) : '';

  const escudo = logo
    ? `<img
         class="escudo-equipo"
         src="${logo}"
         alt="Escudo de ${nombre}"
         loading="lazy"
         onerror="this.remove()">`
    : '';

  return `
    <a
      class="tarjeta-equipo"
      href="equipos.html"
      aria-label="Ver equipo ${nombre}">

      ${escudo}

      <span class="nombre-equipo">${nombre}</span>
    </a>
  `;
}

async function cargarEquipos() {
  rejilla.innerHTML = `
    <div class="estado-equipos">Cargando equipos...</div>
  `;

  try {
    // Import dinámico: si supabase.js no existe o no carga, se captura el error
    const { supabase } = await import('./supabase.js');

    const { data, error } = await supabase
      .from('equipo')
      .select('id,nombre,logo')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      rejilla.innerHTML = `
        <div class="estado-equipos">
          Todavía no hay equipos activos registrados.
        </div>
      `;
      return;
    }

    rejilla.innerHTML = data
      .map(equipo => crearTarjetaEquipo(equipo))
      .join('');

  } catch (error) {
    console.error('Error al cargar los equipos:', error);

    rejilla.innerHTML = `
      <div class="estado-equipos">
        No se pudieron cargar los equipos. Revisa la conexión,
        los nombres de las columnas y los permisos de Supabase.
      </div>
    `;
  }
}

cargarEquipos();