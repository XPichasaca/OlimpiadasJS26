/* =========================================================
   MENÚ MÓVIL
   ========================================================= */
const botonMenu = document.getElementById('botonMenu');
const menuMovil = document.getElementById('menuMovil');

botonMenu.addEventListener('click', () => {
  const abierto = botonMenu.getAttribute('aria-expanded') === 'true';

  botonMenu.setAttribute('aria-expanded', String(!abierto));
  botonMenu.setAttribute('aria-label', abierto ? 'Abrir menú' : 'Cerrar menú');
  menuMovil.classList.toggle('abierto', !abierto);
});

menuMovil.querySelectorAll('a').forEach(enlace => {
  enlace.addEventListener('click', () => {
    menuMovil.classList.remove('abierto');
    botonMenu.setAttribute('aria-expanded', 'false');
    botonMenu.setAttribute('aria-label', 'Abrir menú');
  });
});

// Marcar la página actual en el menú (funciona con o sin ".html" en la URL)
const normalizarRuta = ruta => (ruta || 'index').replace(/\.html$/, '') || 'index';
const paginaActual = normalizarRuta(location.pathname.split('/').pop());

document.querySelectorAll('.menu-escritorio a, .menu-movil a').forEach(enlace => {
  if (normalizarRuta(enlace.getAttribute('href')) === paginaActual) {
    enlace.classList.add('activo');
  }
});

/* =========================================================
   ENCABEZADO COMPACTO AL HACER SCROLL
   ========================================================= */
const encabezadoFijo = document.querySelector('.encabezado');

// Dos umbrales distintos para evitar parpadeos al cambiar de tamaño
window.addEventListener('scroll', () => {
  const y = window.scrollY;

  if (y > 140) {
    encabezadoFijo.classList.add('compacto');
  } else if (y < 40) {
    encabezadoFijo.classList.remove('compacto');
  }
}, { passive: true });

/* =========================================================
   AVISO BREVE EN PANTALLA
   ========================================================= */
const avisoEl = document.getElementById('aviso');
let temporizadorAviso;

function mostrarAviso(mensaje) {
  avisoEl.textContent = mensaje;
  avisoEl.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => avisoEl.classList.remove('visible'), 3200);
}

/* =========================================================
   COMPARTIR
   ========================================================= */
const tituloCompartir = 'Olimpiadas Juan Solano 2026';
const textoCompartir =
  'Sigue las noticias, los equipos y los partidos de las Olimpiadas Juan Solano 2026.';
const textoOficial =
  'Consulta la información oficial de las Olimpiadas Juan Solano 2026.';

const enlaceCompartir = () => window.location.href.split('#')[0];

function urlAbsoluta(ruta) {
  return new URL(ruta || 'index.html', window.location.href).href;
}

function textoDeContenido(elemento) {
  if (!elemento) return textoOficial;

  const texto = (elemento.innerText || elemento.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  return texto || textoOficial;
}

// Facebook toma título, texto e imagen de las metaetiquetas og: de la página de destino.
function compartirEnRed(tipo, titulo, texto, url) {
  if (tipo === 'whatsapp') {
    const mensaje = `${titulo}\n${texto}\n${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
      '_blank',
      'noopener,noreferrer'
    );
  } else {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }
}

// Ventana con botones (en lugar de prompt)
const dialogoCompartir = document.getElementById('menuCompartir');
const tituloDialogo = document.getElementById('menuCompartirTitulo');
const botonImagen = dialogoCompartir.querySelector('[data-accion="imagen"]');
let contextoCompartir = null;

function abrirMenuCompartir(contexto) {
  contextoCompartir = contexto;
  tituloDialogo.textContent = contexto.titulo;
  botonImagen.hidden = !contexto.imagen;
  dialogoCompartir.showModal();
}

dialogoCompartir.addEventListener('click', async evento => {
  // Cerrar al tocar fuera de la ventana
  if (evento.target === dialogoCompartir) {
    dialogoCompartir.close();
    return;
  }

  const boton = evento.target.closest('button[data-accion]');
  if (!boton || !contextoCompartir) return;

  const accion = boton.dataset.accion;
  const { titulo, texto, url } = contextoCompartir;

  dialogoCompartir.close();

  if (accion === 'whatsapp' || accion === 'facebook') {
    compartirEnRed(accion, titulo, texto, url);
  } else if (accion === 'imagen') {
    try {
      await generarTarjetaCompartible(titulo, texto);
    } catch (error) {
      console.error(error);
      mostrarAviso('No se pudo generar la imagen.');
    }
  }
});

// Ajustar texto en varias líneas para la imagen
function ajustarLineas(ctx, texto, anchoMaximo) {
  const palabras = String(texto || '').split(/\s+/);
  const lineas = [];
  let linea = '';

  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;

    if (ctx.measureText(prueba).width > anchoMaximo && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }

  if (linea) {
    lineas.push(linea);
  }

  return lineas;
}

// Generar tarjeta gráfica para compartir
async function generarTarjetaCompartible(titulo, texto) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;

  const ctx = canvas.getContext('2d');

  const fondo = ctx.createLinearGradient(0, 0, 1200, 630);
  fondo.addColorStop(0, '#07110c');
  fondo.addColorStop(.55, '#123c26');
  fondo.addColorStop(1, '#07110c');

  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, 1200, 630);

  // Trazos decorativos
  ctx.strokeStyle = 'rgba(229,185,54,.35)';
  ctx.lineWidth = 5;

  for (let x = -500; x < 1500; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 420, 630);
    ctx.stroke();
  }

  // Franja lateral dorada
  ctx.fillStyle = '#e5b936';
  ctx.fillRect(70, 65, 12, 500);

  // Encabezado
  ctx.fillStyle = '#e5b936';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('OLIMPIADAS JUAN SOLANO · 2026', 115, 105);

  // Título
  ctx.fillStyle = '#f5f5ee';
  ctx.font = 'bold 58px Arial';

  const tituloLineas = ajustarLineas(ctx, titulo.toUpperCase(), 1000);
  let y = 195;

  tituloLineas.slice(0, 2).forEach(linea => {
    ctx.fillText(linea, 115, y);
    y += 70;
  });

  // Texto
  ctx.fillStyle = '#e2e9e2';
  ctx.font = '30px Arial';

  const lineas = ajustarLineas(ctx, texto, 990);

  lineas.slice(0, 5).forEach(linea => {
    ctx.fillText(linea, 115, y + 20);
    y += 48;
  });

  // Pie de la tarjeta
  ctx.fillStyle = '#e5b936';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('DEPORTE · CULTURA · COMUNIDAD', 115, 575);

  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('No se pudo generar la imagen.');
  }

  const archivo = new File(
    [blob],
    'olimpiadas-juan-solano.png',
    { type: 'image/png' }
  );

  // Compartir directamente si el navegador lo permite
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({
        files: [archivo],
        title: titulo,
        text: `${texto}\n${enlaceCompartir()}`
      });

      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  // Si no se puede compartir directamente, descargar el PNG
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'olimpiadas-juan-solano.png';
  enlace.click();

  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);

  mostrarAviso('Imagen descargada. Ya puedes adjuntarla en WhatsApp o Facebook.');
}

// Botones generales de la portada
document.querySelectorAll('[data-share]').forEach(boton => {
  const textoOriginal = boton.textContent;

  boton.addEventListener('click', async () => {
    const tipo = boton.dataset.share;
    const url = enlaceCompartir();

    if (tipo === 'whatsapp' || tipo === 'facebook') {
      compartirEnRed(tipo, tituloCompartir, textoCompartir, url);

    } else if (tipo === 'native') {
      if (navigator.share) {
        try {
          await navigator.share({
            title: tituloCompartir,
            text: textoCompartir,
            url
          });
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Error al compartir:', error);
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(`${textoCompartir} ${url}`);
          boton.textContent = '¡Copiado!';
          setTimeout(() => { boton.textContent = textoOriginal; }, 2200);
        } catch {
          window.prompt('Copia el enlace:', url);
        }
      }

    } else if (tipo === 'copy') {
      try {
        await navigator.clipboard.writeText(`${textoCompartir} ${url}`);
        boton.textContent = '¡Texto y enlace copiados!';
        setTimeout(() => { boton.textContent = textoOriginal; }, 2200);
      } catch {
        window.prompt('Copia el texto y enlace:', `${textoCompartir} ${url}`);
      }
    }
  });
});

// Compartir marcador, próximos partidos, tabla y noticia
document.querySelectorAll('[data-share-content]').forEach(boton => {
  boton.addEventListener('click', () => {
    const id = boton.dataset.shareContent;
    const titulo = boton.dataset.shareTitle || tituloCompartir;
    const texto = textoDeContenido(document.getElementById(id));

    let ruta = 'partidos.html';

    if (id === 'tablaPosiciones') {
      ruta = 'tabla.html';
    } else if (id === 'noticiaPrincipal') {
      ruta = 'noticias.html';
    }

    abrirMenuCompartir({ titulo, texto, url: urlAbsoluta(ruta), imagen: true });
  });
});

// Compartir enlaces específicos: goleadores, tarjetas y tabla
document.querySelectorAll('[data-share-link]').forEach(boton => {
  boton.addEventListener('click', () => {
    const titulo = boton.dataset.shareTitle || tituloCompartir;

    abrirMenuCompartir({
      titulo,
      texto: textoOficial,
      url: urlAbsoluta(boton.dataset.shareLink),
      imagen: false
    });
  });
});

/* =========================================================
   SUPABASE (se carga una sola vez; si falla, la página sigue)
   ========================================================= */
const supabasePromesa = import('./supabase.js').catch(error => {
  console.error('No se pudo cargar supabase.js:', error);
  return null;
});

/* =========================================================
   EQUIPOS DESDE SUPABASE
   ========================================================= */
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
    const modulo = await supabasePromesa;
    if (!modulo) throw new Error('supabase.js no está disponible');

    const { data, error } = await modulo.supabase
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

/* =========================================================
   DATOS PRINCIPALES Y SORTEO
   ========================================================= */

// EDITA ESTO: hora y lugar del sorteo (hora de Ecuador = -05:00).
// Si dejas fechaHora en null, no se muestra la cuenta regresiva.
const CONFIG_SORTEO = {
  fechaHora: null,   // ejemplo: '2026-10-23T19:00:00-05:00'
  lugar: ''          // ejemplo: 'Cancha de Quilloac'
};

// EDITA ESTO si tus tablas se llaman distinto.
const TABLAS_DATOS = {
  equipos: 'equipo',
  jugadores: 'jugador',
  partidos: 'partido'
};

async function contarRegistros(tabla, soloActivos = false) {
  const modulo = await supabasePromesa;
  if (!modulo) throw new Error('supabase.js no está disponible');

  let consulta = modulo.supabase
    .from(tabla)
    .select('*', { count: 'exact', head: true });

  if (soloActivos) consulta = consulta.eq('activo', true);

  const { count, error } = await consulta;
  if (error) throw error;

  return count ?? 0;
}

function animarNumero(elemento, valor) {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (sinMovimiento || valor === 0) {
    elemento.textContent = valor;
    return;
  }

  const duracion = 900;
  const inicio = performance.now();

  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    elemento.textContent = Math.round(valor * progreso);
    if (progreso < 1) requestAnimationFrame(paso);
  }

  requestAnimationFrame(paso);
}

async function cargarDato(idElemento, tabla, soloActivos) {
  const elemento = document.getElementById(idElemento);

  try {
    animarNumero(elemento, await contarRegistros(tabla, soloActivos));
  } catch (error) {
    console.error(`No se pudo contar "${tabla}":`, error);
    elemento.textContent = '—';
  }
}

cargarDato('datoEquipos', TABLAS_DATOS.equipos, true);
cargarDato('datoJugadores', TABLAS_DATOS.jugadores, false);
cargarDato('datoPartidos', TABLAS_DATOS.partidos, false);

// Detalle y cuenta regresiva del sorteo
(function iniciarSorteo() {
  const detalle = document.getElementById('sorteoDetalle');
  const cuenta = document.getElementById('cuentaRegresiva');
  const horas = document.getElementById('cuentaHoras');
  const minutos = document.getElementById('cuentaMinutos');
  const segundos = document.getElementById('cuentaSegundos');

  const fecha = CONFIG_SORTEO.fechaHora ? new Date(CONFIG_SORTEO.fechaHora) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return;

  const hora = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  const lugar = CONFIG_SORTEO.lugar ? ` · ${CONFIG_SORTEO.lugar}` : '';
  detalle.textContent = `Hoy a las ${hora}${lugar}. Conoce a los equipos y a los jugadores de las Olimpiadas Juan Solano 2026.`;

  const dos = n => String(n).padStart(2, '0');
  let temporizador = null;

  function actualizar() {
    const faltan = fecha - Date.now();

    if (faltan <= 0) {
      cuenta.hidden = true;
      detalle.textContent = `¡El sorteo ya comenzó${lugar}!`;
      clearInterval(temporizador);
      return;
    }

    cuenta.hidden = false;
    horas.textContent = dos(Math.floor(faltan / 3600000));
    minutos.textContent = dos(Math.floor((faltan % 3600000) / 60000));
    segundos.textContent = dos(Math.floor((faltan % 60000) / 1000));
  }

  temporizador = setInterval(actualizar, 1000);
  actualizar();
})();

/* =========================================================
   GALERÍA (CARRUSEL)
   ========================================================= */

// EDITA ESTO: tus fotografías (guárdalas en la carpeta img/galeria/)
const FOTOS_GALERIA = [
  { src: './img/galeria/foto1.jpg', titulo: 'Lanzamiento oficial', texto: 'La comunidad de Quilloac se reúne para dar inicio a las Olimpiadas Juan Solano 2026.' },
  { src: './img/galeria/foto2.jpg', titulo: 'Los equipos', texto: 'Los equipos participantes listos para competir por el campeonato.' },
  { src: './img/galeria/foto3.jpg', titulo: 'El sorteo', texto: 'El momento en que se define el camino de cada equipo.' },
  { src: './img/galeria/foto4.jpg', titulo: 'La afición', texto: 'Familias y barras que llenan la cancha de color y alegría.' },
  { src: './img/galeria/foto5.jpg', titulo: 'En la cancha', texto: 'Goles, jugadas y emoción en cada encuentro.' },
  { src: './img/galeria/foto6.jpg', titulo: 'Deporte y cultura', texto: 'Una comunidad, una pasión, una identidad.' }
];

const INTERVALO_GALERIA = 5000; // milisegundos entre fotos

(function iniciarCarrusel() {
  const seccion = document.getElementById('galeria');
  const fotos = FOTOS_GALERIA.filter(foto => foto && foto.src);

  if (!seccion) return;
  if (fotos.length === 0) { seccion.remove(); return; }

  const carrusel = document.getElementById('carrusel');
  const marco = document.getElementById('carruselMarco');
  const miniaturas = document.getElementById('carruselMiniaturas');
  const contadorActual = document.getElementById('carruselActual');
  const contadorTotal = document.getElementById('carruselTotal');
  const titulo = document.getElementById('carruselTitulo');
  const texto = document.getElementById('carruselTexto');
  const progreso = document.getElementById('carruselProgreso');
  const botonAnterior = document.getElementById('carruselAnterior');
  const botonSiguiente = document.getElementById('carruselSiguiente');
  const botonPausa = document.getElementById('carruselPausa');

  const total = fotos.length;
  const dos = n => String(n).padStart(2, '0');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let indice = 0;
  let enMarcha = !sinMovimiento;
  let temporizador = null;

  progreso.style.setProperty('--duracion', `${INTERVALO_GALERIA}ms`);
  contadorTotal.textContent = `/ ${dos(total)}`;

  // Construir diapositivas y miniaturas (con textContent: sin HTML inyectado)
  const diapositivas = fotos.map((foto, i) => {
    const slide = document.createElement('div');
    slide.className = 'carrusel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'diapositiva');
    slide.setAttribute('aria-label', `${i + 1} de ${total}`);

    const img = document.createElement('img');
    img.src = foto.src;
    img.alt = foto.titulo || `Fotografía ${i + 1}`;
    img.draggable = false;
    if (i > 0) img.loading = 'lazy';
    img.addEventListener('error', () => slide.classList.add('sin-foto'));

    slide.appendChild(img);
    marco.appendChild(slide);
    return slide;
  });

  const botonesMini = fotos.map((foto, i) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-label', `Ver foto ${i + 1}: ${foto.titulo || ''}`);

    const img = document.createElement('img');
    img.src = foto.src;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

    boton.appendChild(img);
    boton.addEventListener('click', () => ir(i));
    miniaturas.appendChild(boton);
    return boton;
  });

  function mostrar() {
    diapositivas.forEach((slide, i) => slide.classList.toggle('activo', i === indice));

    botonesMini.forEach((boton, i) => {
      boton.classList.toggle('activo', i === indice);
      if (i === indice) boton.setAttribute('aria-current', 'true');
      else boton.removeAttribute('aria-current');
    });

    contadorActual.textContent = dos(indice + 1);
    titulo.textContent = fotos[indice].titulo || '';
    texto.textContent = fotos[indice].texto || '';

    // Centrar la miniatura activa sin mover la página
    const mini = botonesMini[indice];
    miniaturas.scrollTo({
      left: mini.offsetLeft - (miniaturas.clientWidth - mini.clientWidth) / 2,
      behavior: sinMovimiento ? 'auto' : 'smooth'
    });
  }

  function programar() {
    clearTimeout(temporizador);
    progreso.classList.remove('corriendo');
    void progreso.offsetWidth; // reinicia la animación de la barra

    if (!enMarcha || total < 2 || document.hidden) return;

    progreso.classList.add('corriendo');
    temporizador = setTimeout(() => ir(indice + 1), INTERVALO_GALERIA);
  }

  function ir(nuevo) {
    indice = (nuevo + total) % total;
    mostrar();
    programar();
  }

  function actualizarBotonPausa() {
    botonPausa.textContent = enMarcha ? '❚❚' : '▶';
    botonPausa.setAttribute('aria-label', enMarcha ? 'Pausar' : 'Reproducir');
  }

  botonAnterior.addEventListener('click', () => ir(indice - 1));
  botonSiguiente.addEventListener('click', () => ir(indice + 1));

  botonPausa.addEventListener('click', () => {
    enMarcha = !enMarcha;
    actualizarBotonPausa();
    programar();
  });

  // Teclado: flechas izquierda y derecha
  carrusel.addEventListener('keydown', evento => {
    if (evento.key === 'ArrowLeft') { evento.preventDefault(); ir(indice - 1); }
    if (evento.key === 'ArrowRight') { evento.preventDefault(); ir(indice + 1); }
  });

  // Pausa temporal con el cursor encima
  carrusel.addEventListener('mouseenter', () => {
    clearTimeout(temporizador);
    progreso.classList.remove('corriendo');
  });
  carrusel.addEventListener('mouseleave', programar);

  // Deslizar con el dedo o el mouse
  let inicioX = null;

  marco.addEventListener('pointerdown', evento => { inicioX = evento.clientX; });

  marco.addEventListener('pointerup', evento => {
    if (inicioX === null) return;
    const diferencia = evento.clientX - inicioX;
    inicioX = null;
    if (Math.abs(diferencia) > 45) ir(indice + (diferencia < 0 ? 1 : -1));
  });

  marco.addEventListener('pointercancel', () => { inicioX = null; });

  // No avanzar cuando la pestaña no está visible
  document.addEventListener('visibilitychange', programar);

  actualizarBotonPausa();
  mostrar();
  programar();
})();