
import { supabase } from './supabase.js';

console.log('✅ jugadores-capitan.js cargado');

// =====================================================
// ESTADO DEL MÓDULO
// =====================================================

let usuarioActual = null;
let perfilActual = null;
let equipoActual = null;
let inscripcionesEquipo = [];
let jugadores = [];
let jugadorEditando = null;

// =====================================================
// ELEMENTOS HTML
// =====================================================

const pantallaCarga = document.getElementById('pantallaCarga');
const contenedor = document.querySelector('.contenedor');

const usuarioNombre = document.getElementById('usuarioNombre');
const nombreEquipo = document.getElementById('nombreEquipo');
const escudoEquipo = document.getElementById('escudoEquipo');
const contactoEquipo = document.getElementById('contactoEquipo');
const nombreCapitan = document.getElementById('nombreCapitan');

const totalJugadores = document.getElementById('totalJugadores');
const totalActivos = document.getElementById('totalActivos');
const totalNomina = document.getElementById('totalNomina');

const tablaJugadores = document.getElementById('tablaJugadores');
const vacio = document.getElementById('vacio');
const buscar = document.getElementById('buscar');

const btnNuevoJugador = document.getElementById('btnNuevoJugador');
const btnSalir = document.getElementById('btnSalir');

const modal = document.getElementById('modal');
const btnCerrar = document.getElementById('btnCerrar');
const btnCancelar = document.getElementById('btnCancelar');

const formJugador = document.getElementById('formJugador');
const tituloModal = document.getElementById('tituloModal');
const mensaje = document.getElementById('mensaje');
const btnGuardar = formJugador?.querySelector('button[type="submit"]');

const fotoJugadorInput = document.getElementById('fotoJugador');
const cedulaArchivoInput = document.getElementById('cedulaArchivo');

const vistaFotoJugador = document.getElementById('vistaFotoJugador');
const vistaCedulaJugador = document.getElementById('vistaCedulaJugador');

const archivoAvalInput = document.getElementById('archivoAval');
const archivoInscripcionInput = document.getElementById('archivoInscripcion');

const btnSubirAval = document.getElementById('btnSubirAval');
const btnSubirInscripcion = document.getElementById('btnSubirInscripcion');

const estadoAval = document.getElementById('estadoAval');
const estadoInscripcion = document.getElementById('estadoInscripcion');
const mensajeDocumentos = document.getElementById('mensajeDocumentos');

// =====================================================
// CONFIGURACIÓN DE STORAGE
// =====================================================

const BUCKET_JUGADORES = 'jugadores';
const BUCKET_DOCUMENTOS_EQUIPO = 'documentos-campeonato';

const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;

const MIME_IMAGEN = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const MIME_DOCUMENTO = [
  ...MIME_IMAGEN,
  'application/pdf'
];

// =====================================================
// INICIO
// =====================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}

async function iniciar() {
  mostrarLoading('Verificando autenticación...');

  try {
    const {
      data: sessionData,
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(`Error al comprobar la sesión: ${sessionError.message}`);
    }

    const session = sessionData?.session;

    if (!session) {
      mostrarError('No existe una sesión activa. Inicia sesión para continuar.');

      setTimeout(() => {
        window.location.href = '../login.html';
      }, 1800);

      return;
    }

    usuarioActual = session.user;

    mostrarLoading('Cargando perfil del capitán...');

    const {
      data: perfil,
      error: perfilError
    } = await supabase
      .from('perfil_usuario')
      .select('id, nombres, apellidos, activo')
      .eq('id', usuarioActual.id)
      .maybeSingle();

    if (perfilError) {
      throw new Error(`Error al cargar el perfil: ${perfilError.message}`);
    }

    if (!perfil) {
      throw new Error('No existe un perfil_usuario asociado a este usuario.');
    }

    if (perfil.activo === false) {
      throw new Error('El perfil del usuario está inactivo.');
    }

    perfilActual = perfil;

    if (usuarioNombre) {
      usuarioNombre.textContent =
        [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ') ||
        usuarioActual.email ||
        'Capitán';
    }

    mostrarLoading('Verificando permisos de capitán...');
    await verificarRolCapitan();

    mostrarLoading('Buscando equipo asignado...');

    const {
      data: inscripciones,
      error: inscripcionesError
    } = await supabase
      .from('inscripcion_equipo')
      .select(`
        id,
        equipo_id,
        competencia_id,
        capitan_id,
        estado,
        fecha_inscripcion,
        documento_aval,
        documento_inscripcion
      `)
      .eq('capitan_id', usuarioActual.id)
      .order('fecha_inscripcion', { ascending: false });

    if (inscripcionesError) {
      throw new Error(
        `Error al buscar las inscripciones: ${inscripcionesError.message}`
      );
    }

    if (!inscripciones?.length) {
      mostrarError(
        'No tienes ningún equipo asignado como capitán. ' +
        'Solicita al administrador que te asigne un equipo.'
      );
      return;
    }

    inscripcionesEquipo = inscripciones;

    const equipoId = inscripciones[0].equipo_id;

    mostrarLoading('Cargando información del equipo...');

    const {
      data: equipo,
      error: equipoError
    } = await supabase
      .from('equipo')
      .select('id, nombre, logo, representante, contacto, activo')
      .eq('id', equipoId)
      .maybeSingle();

    if (equipoError) {
      throw new Error(`Error al cargar el equipo: ${equipoError.message}`);
    }

    if (!equipo) {
      throw new Error('No se encontró el equipo asignado.');
    }

    equipoActual = equipo;

    mostrarEquipo();
    await mostrarDocumentosEquipo();

    mostrarLoading('Cargando nómina de jugadores...');
    await cargarJugadores();

    ocultarLoading();

    console.log('🎉 Módulo de capitán cargado correctamente');

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error);
    mostrarError(error?.message || 'Ocurrió un error al cargar el módulo.');
  }
}

// =====================================================
// VALIDAR ROL
// =====================================================

async function verificarRolCapitan() {
  const {
    data: relaciones,
    error: relacionError
  } = await supabase
    .from('usuario_rol')
    .select('rol_id')
    .eq('usuario_id', usuarioActual.id);

  if (relacionError) {
    throw new Error(`No se pudieron consultar los roles: ${relacionError.message}`);
  }

  if (!relaciones?.length) {
    throw new Error('El usuario no tiene roles asignados.');
  }

  const idsRol = relaciones.map(r => r.rol_id);

  const {
    data: roles,
    error: rolesError
  } = await supabase
    .from('rol')
    .select('id, nombre')
    .in('id', idsRol);

  if (rolesError) {
    throw new Error(`No se pudieron consultar los nombres de roles: ${rolesError.message}`);
  }

  const esCapitan = (roles || []).some(
    rol => String(rol.nombre || '').trim().toUpperCase() === 'CAPITAN'
  );

  if (!esCapitan) {
    throw new Error(
      'Acceso denegado: esta página es exclusiva para usuarios con rol CAPITAN.'
    );
  }

  console.log('✅ Rol CAPITAN confirmado');
}

// =====================================================
// INFORMACIÓN DEL EQUIPO
// =====================================================

function mostrarEquipo() {
  if (!equipoActual) return;

  if (nombreEquipo) {
    nombreEquipo.textContent = equipoActual.nombre || 'Equipo sin nombre';
  }

  if (contactoEquipo) {
    contactoEquipo.textContent =
      equipoActual.contacto || 'Sin contacto registrado';
  }

  if (nombreCapitan) {
    nombreCapitan.textContent =
      [perfilActual?.nombres, perfilActual?.apellidos].filter(Boolean).join(' ') ||
      'Capitán';
  }

  if (escudoEquipo) {
    escudoEquipo.replaceChildren();

    if (equipoActual.logo) {
      const imagen = document.createElement('img');
      imagen.src = equipoActual.logo;
      imagen.alt = `Escudo de ${equipoActual.nombre || 'equipo'}`;
      imagen.style.width = '100%';
      imagen.style.height = '100%';
      imagen.style.objectFit = 'contain';
      imagen.style.borderRadius = 'inherit';

      imagen.onerror = () => {
        escudoEquipo.textContent = '🛡️';
      };

      escudoEquipo.appendChild(imagen);
    } else {
      escudoEquipo.textContent = '🛡️';
    }
  }
}

// =====================================================
// VALIDACIÓN DE ARCHIVOS
// =====================================================

function extensionArchivo(file) {
  const extensiones = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };

  return extensiones[file.type] || '';
}

function validarArchivo(file, soloImagen = false) {
  if (!file) throw new Error('No se seleccionó ningún archivo.');

  if (file.size === 0) {
    throw new Error(`El archivo "${file.name}" está vacío.`);
  }

  if (file.size > MAX_ARCHIVO_BYTES) {
    throw new Error(`El archivo "${file.name}" supera el límite de 10 MB.`);
  }

  const permitidos = soloImagen ? MIME_IMAGEN : MIME_DOCUMENTO;

  if (!permitidos.includes(file.type)) {
    throw new Error(
      soloImagen
        ? 'La fotografía debe ser JPG, PNG o WEBP.'
        : 'El archivo debe ser JPG, PNG, WEBP o PDF.'
    );
  }
}

// =====================================================
// SUBIR ARCHIVO A STORAGE
// =====================================================

async function subirArchivoPrivado(bucket, file, ruta, soloImagen = false) {
  validarArchivo(file, soloImagen);

  const extension = extensionArchivo(file);

  if (!extension) {
    throw new Error('No se pudo identificar el formato del archivo.');
  }

  const rutaFinal = `${ruta}.${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(rutaFinal, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600'
    });

  if (error) {
    console.error('❌ Error de Storage:', error);

    throw new Error(
      `No se pudo subir "${file.name}" al bucket "${bucket}": ${error.message}`
    );
  }

  return rutaFinal;
}

// =====================================================
// GUARDAR RUTA DE ARCHIVO EN TABLA JUGADOR
// =====================================================

async function guardarRutaJugador(jugadorId, columna, ruta) {
  const columnasPermitidas = ['foto', 'foto_cedula'];

  if (!columnasPermitidas.includes(columna)) {
    throw new Error('Columna de archivo no permitida.');
  }

  const {
    data,
    error
  } = await supabase
    .from('jugador')
    .update({ [columna]: ruta })
    .eq('id', jugadorId)
    .select('id, foto, foto_cedula')
    .maybeSingle();

  if (error) {
    throw new Error(
      `El archivo se subió, pero no se pudo guardar su ruta en jugador.${columna}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `No se pudo actualizar jugador.${columna}. Verifica los permisos RLS de la tabla jugador.`
    );
  }

  return data;
}

// =====================================================
// SUBIR SOLO LOS ARCHIVOS NUEVOS O REEMPLAZADOS
// =====================================================

async function subirArchivosJugador(jugadorId) {
  const foto = fotoJugadorInput?.files?.[0];
  const cedula = cedulaArchivoInput?.files?.[0];

  // Si no se selecciona un archivo nuevo, se conserva el existente.
  if (!foto && !cedula) return;

  if (foto) {
    const rutaFoto = await subirArchivoPrivado(
      BUCKET_JUGADORES,
      foto,
      `${usuarioActual.id}/jugadores/${jugadorId}/foto`,
      true
    );

    await guardarRutaJugador(jugadorId, 'foto', rutaFoto);
  }

  if (cedula) {
    const rutaCedula = await subirArchivoPrivado(
      BUCKET_JUGADORES,
      cedula,
      `${usuarioActual.id}/jugadores/${jugadorId}/cedula`,
      false
    );

    await guardarRutaJugador(jugadorId, 'foto_cedula', rutaCedula);
  }
}

// =====================================================
// ENLACES TEMPORALES DE ARCHIVOS PRIVADOS
// =====================================================

async function crearEnlacePrivado(bucket, ruta) {
  if (!ruta) return null;

  if (/^https?:\/\//i.test(ruta)) {
    return ruta;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(ruta, 600);

  if (error) {
    console.warn(`No se pudo generar enlace desde ${bucket}:`, error.message);
    return null;
  }

  return data?.signedUrl || null;
}

// =====================================================
// VISTA PREVIA DE ARCHIVOS EXISTENTES AL EDITAR
// =====================================================

async function cargarVistaPreviaArchivo(ruta, contenedorVista, tipo) {
  if (!contenedorVista) return;

  contenedorVista.replaceChildren();

  if (!ruta) {
    contenedorVista.textContent = tipo === 'imagen'
      ? '📷 No hay fotografía cargada.'
      : '📄 No hay documento cargado.';
    return;
  }

  const url = await crearEnlacePrivado(BUCKET_JUGADORES, ruta);

  if (!url) {
    contenedorVista.textContent =
      'Archivo guardado, pero no se pudo abrir. Verifica el bucket y sus permisos.';
    return;
  }

  if (tipo === 'imagen') {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = 'Fotografía guardada del jugador';
    imagen.loading = 'lazy';
    imagen.style.display = 'block';
    imagen.style.maxWidth = '100%';
    imagen.style.maxHeight = '220px';
    imagen.style.objectFit = 'contain';
    imagen.style.margin = '10px auto';
    imagen.style.borderRadius = '10px';

    imagen.onerror = () => {
      contenedorVista.textContent = 'No se pudo mostrar la fotografía guardada.';
    };

    contenedorVista.appendChild(imagen);
    return;
  }

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.target = '_blank';
  enlace.rel = 'noopener noreferrer';
  enlace.textContent = '📄 Abrir documento guardado';

  contenedorVista.appendChild(enlace);

  if (/\.(jpg|jpeg|png|webp)(?:$|\?)/i.test(ruta)) {
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = 'Documento de identidad';
    imagen.loading = 'lazy';
    imagen.style.display = 'block';
    imagen.style.maxWidth = '100%';
    imagen.style.maxHeight = '220px';
    imagen.style.objectFit = 'contain';
    imagen.style.margin = '10px auto';

    contenedorVista.appendChild(imagen);
  } else if (/\.pdf(?:$|\?)/i.test(ruta)) {
    const nota = document.createElement('p');
    nota.textContent = 'El PDF se abrirá en una pestaña nueva.';
    contenedorVista.appendChild(nota);
  }
}

async function mostrarArchivosActuales(jugador) {
  await Promise.all([
    cargarVistaPreviaArchivo(jugador?.foto, vistaFotoJugador, 'imagen'),
    cargarVistaPreviaArchivo(jugador?.foto_cedula, vistaCedulaJugador, 'documento')
  ]);
}

// =====================================================
// FICHA AMPLIA: CREACIÓN AUTOMÁTICA DEL MODAL
// =====================================================

let fichaModal = null;
let fichaImagen = null;
let fichaNombreElemento = null;
let fichaNumeroElemento = null;
let fichaCedulaElemento = null;
let fichaFechaElemento = null;
let fichaPosicionElemento = null;
let fichaOrigenElemento = null;
let fichaEstadoElemento = null;
let fichaEspecialElemento = null;
let fichaObservacionElemento = null;
let fichaDocumentoElemento = null;

function prepararFichaJugador() {
  // Si el HTML ya contiene la ficha, reutilizarla.
  const existente = document.getElementById('modalVerJugador');

  if (existente) {
    fichaModal = existente;
    fichaImagen = existente.querySelector('#fichaFoto');
    fichaNombreElemento = existente.querySelector('#fichaNombre');
    fichaNumeroElemento = existente.querySelector('#fichaNumero');
    fichaCedulaElemento = existente.querySelector('#fichaCedula');
    fichaFechaElemento = existente.querySelector('#fichaFecha');
    fichaPosicionElemento = existente.querySelector('#fichaPosicion');
    fichaOrigenElemento = existente.querySelector('#fichaOrigen');
    fichaEstadoElemento = existente.querySelector('#fichaEstado');
    fichaEspecialElemento = existente.querySelector('#fichaEspecial');
    fichaObservacionElemento = existente.querySelector('#fichaObservacion');
    fichaDocumentoElemento = existente.querySelector('#fichaDocumento');

    if (!existente.dataset.eventosFicha) {
      existente.dataset.eventosFicha = '1';

      existente.addEventListener('click', event => {
        if (
          event.target === existente ||
          event.target.closest('[data-cerrar-ficha]')
        ) {
          cerrarFichaJugador();
        }
      });

      existente.querySelectorAll('[data-cerrar-ficha]').forEach(boton => {
        boton.addEventListener('click', cerrarFichaJugador);
      });
    }

    return existente;
  }

  // Si no existe, construir la ficha automáticamente.
  const estilo = document.createElement('style');
  estilo.id = 'estilosFichaJugador';
  estilo.textContent = `
    #modalVerJugador {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(9, 20, 15, .78);
      backdrop-filter: blur(5px);
      box-sizing: border-box;
    }
    #modalVerJugador * { box-sizing: border-box; }
    #modalVerJugador .ficha-panel {
      width: min(1120px, 96vw);
      max-height: 94vh;
      overflow-y: auto;
      background: #fff;
      color: #24342a;
      border-radius: 20px;
      box-shadow: 0 25px 80px rgba(0,0,0,.3);
    }
    #modalVerJugador .ficha-cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 20px 26px;
      background: #174d32;
      color: white;
      border-bottom: 4px solid #d7b34b;
    }
    #modalVerJugador .ficha-cabecera h2 {
      margin: 0;
      font-size: 1.35rem;
    }
    #modalVerJugador .ficha-cerrar {
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      background: #fff;
      color: #174d32;
      font-weight: 700;
    }
    #modalVerJugador .ficha-cuerpo { padding: 26px; }
    #modalVerJugador .ficha-superior {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }
    #modalVerJugador .ficha-foto-contenedor {
      text-align: center;
    }
    #modalVerJugador #fichaFoto {
      width: 200px;
      height: 220px;
      max-width: 100%;
      object-fit: cover;
      border-radius: 16px;
      background: #eef1ed;
      border: 3px solid #e5e9e4;
    }
    #modalVerJugador .ficha-nombre {
      margin: 0 0 18px;
      font-size: 1.65rem;
      overflow-wrap: anywhere;
    }
    #modalVerJugador .ficha-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    #modalVerJugador .ficha-dato {
      padding: 13px;
      border: 1px solid #e2e8e1;
      border-radius: 12px;
      background: #f8faf7;
      min-width: 0;
    }
    #modalVerJugador .ficha-etiqueta {
      display: block;
      color: #637267;
      font-size: .78rem;
      margin-bottom: 5px;
    }
    #modalVerJugador .ficha-valor {
      display: block;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    #modalVerJugador .ficha-seccion {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid #e3e8e2;
    }
    #modalVerJugador .ficha-seccion h3 {
      margin: 0 0 14px;
      color: #174d32;
    }
    #modalVerJugador .ficha-documento img {
      display: block;
      max-width: 100%;
      max-height: 500px;
      object-fit: contain;
      margin-top: 14px;
      border: 1px solid #e0e5df;
      border-radius: 10px;
    }
    #modalVerJugador .ficha-pie {
      display: flex;
      justify-content: flex-end;
      padding-top: 24px;
    }
    #modalVerJugador .ficha-enlace {
      display: inline-block;
      padding: 10px 14px;
      color: #174d32;
      background: #edf5ed;
      border-radius: 9px;
      font-weight: 700;
      text-decoration: none;
    }
    @media(max-width:650px) {
      #modalVerJugador { padding: 7px; }
      #modalVerJugador .ficha-panel { width: 100%; max-height: 96vh; }
      #modalVerJugador .ficha-cuerpo { padding: 16px; }
      #modalVerJugador .ficha-superior { grid-template-columns: 1fr; gap: 18px; }
      #modalVerJugador .ficha-grid { grid-template-columns: 1fr; }
      #modalVerJugador .ficha-nombre { font-size: 1.3rem; }
      #modalVerJugador #fichaFoto { width: 170px; height: 180px; }
    }
  `;

  document.head.appendChild(estilo);

  fichaModal = document.createElement('div');
  fichaModal.id = 'modalVerJugador';
  fichaModal.setAttribute('role', 'dialog');
  fichaModal.setAttribute('aria-modal', 'true');
  fichaModal.setAttribute('aria-labelledby', 'fichaNombre');

  fichaModal.innerHTML = `
    <div class="ficha-panel">
      <div class="ficha-cabecera">
        <h2>Ficha del jugador</h2>
        <button type="button" class="ficha-cerrar" data-cerrar-ficha>
          ✕ Cerrar
        </button>
      </div>

      <div class="ficha-cuerpo">
        <div class="ficha-superior">
          <div class="ficha-foto-contenedor">
            <img id="fichaFoto" alt="Fotografía del jugador">
          </div>

          <div>
            <h2 id="fichaNombre" class="ficha-nombre">Jugador</h2>

            <div class="ficha-grid">
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Número de camiseta</span>
                <span id="fichaNumero" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Cédula</span>
                <span id="fichaCedula" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Fecha de nacimiento</span>
                <span id="fichaFecha" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Posición</span>
                <span id="fichaPosicion" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Origen</span>
                <span id="fichaOrigen" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Estado del jugador</span>
                <span id="fichaEstado" class="ficha-valor">—</span>
              </div>
              <div class="ficha-dato">
                <span class="ficha-etiqueta">Jugador especial</span>
                <span id="fichaEspecial" class="ficha-valor">—</span>
              </div>
            </div>
          </div>
        </div>

        <div class="ficha-seccion">
          <h3>Observaciones de la inscripción</h3>
          <p id="fichaObservacion">Sin observaciones registradas.</p>
        </div>

        <div class="ficha-seccion ficha-documento">
          <h3>Documento de identidad</h3>
          <div id="fichaDocumento">Consultando documento...</div>
        </div>

        <div class="ficha-pie">
          <button type="button" class="ficha-cerrar" data-cerrar-ficha>
            Cerrar ficha
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(fichaModal);

  fichaImagen = fichaModal.querySelector('#fichaFoto');
  fichaNombreElemento = fichaModal.querySelector('#fichaNombre');
  fichaNumeroElemento = fichaModal.querySelector('#fichaNumero');
  fichaCedulaElemento = fichaModal.querySelector('#fichaCedula');
  fichaFechaElemento = fichaModal.querySelector('#fichaFecha');
  fichaPosicionElemento = fichaModal.querySelector('#fichaPosicion');
  fichaOrigenElemento = fichaModal.querySelector('#fichaOrigen');
  fichaEstadoElemento = fichaModal.querySelector('#fichaEstado');
  fichaEspecialElemento = fichaModal.querySelector('#fichaEspecial');
  fichaObservacionElemento = fichaModal.querySelector('#fichaObservacion');
  fichaDocumentoElemento = fichaModal.querySelector('#fichaDocumento');

  fichaModal.addEventListener('click', event => {
    if (
      event.target === fichaModal ||
      event.target.closest('[data-cerrar-ficha]')
    ) {
      cerrarFichaJugador();
    }
  });

  return fichaModal;
}

// =====================================================
// VER FICHA COMPLETA
// =====================================================

async function verJugador(id) {
  const registro = jugadores.find(r => String(r.id) === String(id));

  if (!registro?.jugador) {
    alert('No se encontraron los datos del jugador.');
    return;
  }

  const modalFicha = prepararFichaJugador();
  const j = registro.jugador;
  const nombre = `${j.nombres || ''} ${j.apellidos || ''}`.trim();

  const texto = (elemento, valor, alternativo = '—') => {
    if (elemento) {
      elemento.textContent =
        valor === null || valor === undefined || valor === ''
          ? alternativo
          : String(valor);
    }
  };

  texto(fichaNombreElemento, nombre, 'Jugador');
  texto(fichaNumeroElemento, registro.numero, 'Sin número');
  texto(fichaCedulaElemento, j.numero_cedula, 'No registrada');
  texto(fichaFechaElemento, formatearFecha(j.fecha_nacimiento));
  texto(fichaPosicionElemento, registro.posicion, 'No registrada');
  texto(fichaOrigenElemento, j.origen, 'No registrado');
  texto(
    fichaEstadoElemento,
    j.activo === false ? 'Inactivo' : 'Activo'
  );
  texto(
    fichaEspecialElemento,
    registro.es_especial ? 'Sí' : 'No'
  );
  texto(
    fichaObservacionElemento,
    registro.observacion,
    'Sin observaciones registradas.'
  );

  if (fichaImagen) {
    fichaImagen.removeAttribute('src');
    fichaImagen.alt = `Fotografía de ${nombre || 'jugador'}`;
  }

  if (fichaDocumentoElemento) {
    fichaDocumentoElemento.replaceChildren();
    fichaDocumentoElemento.textContent = 'Cargando documento...';
  }

  modalFicha.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // La ficha aparece primero; los archivos se cargan después.
  const idConsultado = registro.id;

  const [urlFoto, urlDocumento] = await Promise.all([
    crearEnlacePrivado(BUCKET_JUGADORES, j.foto),
    crearEnlacePrivado(BUCKET_JUGADORES, j.foto_cedula)
  ]);

  // No mostrar archivos de una consulta anterior si se abrió otra ficha.
  if (
    !fichaModal ||
    fichaModal.style.display !== 'flex' ||
    !jugadores.some(r => String(r.id) === String(idConsultado))
  ) {
    return;
  }

  if (fichaImagen) {
    if (urlFoto) {
      fichaImagen.src = urlFoto;
    } else {
      fichaImagen.alt = 'No hay fotografía disponible';
    }
  }

  if (fichaDocumentoElemento) {
    fichaDocumentoElemento.replaceChildren();

    if (!urlDocumento) {
      fichaDocumentoElemento.textContent =
        j.foto_cedula
          ? 'No se pudo abrir el documento. Verifica que exista en el bucket jugadores y que Storage permita generar enlaces firmados.'
          : 'No hay documento de identidad cargado.';
    } else {
      const enlace = document.createElement('a');
      enlace.href = urlDocumento;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.className = 'ficha-enlace';
      enlace.textContent = 'Abrir documento en otra pestaña';

      fichaDocumentoElemento.appendChild(enlace);

      const ruta = String(j.foto_cedula || '').split('?')[0];
      const esImagen = /\.(jpg|jpeg|png|webp)$/i.test(ruta);

      if (esImagen) {
        const imagen = document.createElement('img');
        imagen.src = urlDocumento;
        imagen.alt = 'Documento de identidad del jugador';
        imagen.loading = 'lazy';
        fichaDocumentoElemento.appendChild(imagen);
      } else if (/\.pdf$/i.test(ruta)) {
        const nota = document.createElement('p');
        nota.textContent = 'El documento está en PDF. Usa el enlace para abrirlo.';
        fichaDocumentoElemento.appendChild(nota);
      }
    }
  }
}

function cerrarFichaJugador() {
  if (fichaModal) {
    fichaModal.style.display = 'none';
  }

  document.body.style.overflow = '';
}

// =====================================================
// DOCUMENTOS DE INSCRIPCIÓN DEL EQUIPO
// =====================================================

function obtenerInscripcionEquipoActual() {
  return inscripcionesEquipo.find(
    i => String(i.equipo_id) === String(equipoActual?.id)
  ) || null;
}

async function mostrarDocumentosEquipo() {
  const inscripcion = obtenerInscripcionEquipoActual();

  if (!inscripcion) return;

  if (estadoAval) {
    estadoAval.replaceChildren();

    const url = await crearEnlacePrivado(
      BUCKET_DOCUMENTOS_EQUIPO,
      inscripcion.documento_aval
    );

    if (url) {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = 'Ver aval cargado';
      estadoAval.appendChild(enlace);
    } else {
      estadoAval.textContent = inscripcion.documento_aval
        ? 'Archivo guardado; no se pudo generar la vista previa.'
        : 'Sin cargar';
    }
  }

  if (estadoInscripcion) {
    estadoInscripcion.replaceChildren();

    const url = await crearEnlacePrivado(
      BUCKET_DOCUMENTOS_EQUIPO,
      inscripcion.documento_inscripcion
    );

    if (url) {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = 'Ver documento cargado';
      estadoInscripcion.appendChild(enlace);
    } else {
      estadoInscripcion.textContent = inscripcion.documento_inscripcion
        ? 'Archivo guardado; no se pudo generar la vista previa.'
        : 'Sin cargar';
    }
  }
}

async function subirDocumentoEquipo(tipo) {
  const inscripcion = obtenerInscripcionEquipoActual();

  if (!inscripcion) {
    mostrarMensajeDocumento(
      'No se encontró una inscripción de equipo para cargar documentos.',
      'error'
    );
    return;
  }

  const input = tipo === 'aval' ? archivoAvalInput : archivoInscripcionInput;
  const boton = tipo === 'aval' ? btnSubirAval : btnSubirInscripcion;
  const columna = tipo === 'aval' ? 'documento_aval' : 'documento_inscripcion';
  const archivo = input?.files?.[0];

  if (!archivo) {
    mostrarMensajeDocumento('Selecciona primero el archivo que deseas subir.', 'error');
    return;
  }

  try {
    validarArchivo(archivo, false);

    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Subiendo...';
    }

    const ruta = await subirArchivoPrivado(
      BUCKET_DOCUMENTOS_EQUIPO,
      archivo,
      `${usuarioActual.id}/equipos/${equipoActual.id}/inscripciones/${inscripcion.id}/${tipo}`,
      false
    );

    const {
      data,
      error
    } = await supabase
      .from('inscripcion_equipo')
      .update({ [columna]: ruta })
      .eq('id', inscripcion.id)
      .eq('capitan_id', usuarioActual.id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`El archivo se subió, pero no se pudo guardar su ruta: ${error.message}`);
    }

    if (!data) {
      throw new Error('La inscripción no se actualizó. Verifica los permisos RLS.');
    }

    inscripcion[columna] = ruta;

    if (input) input.value = '';

    await mostrarDocumentosEquipo();
    mostrarMensajeDocumento('Documento subido y registrado correctamente.', 'ok');

  } catch (error) {
    console.error('Error subiendo documento del equipo:', error);
    mostrarMensajeDocumento(error?.message || 'No se pudo subir el documento.', 'error');

  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = tipo === 'aval' ? 'Subir aval' : 'Subir inscripción';
    }
  }
}

function mostrarMensajeDocumento(texto, tipo) {
  if (!mensajeDocumentos) return;

  mensajeDocumentos.textContent = texto;
  mensajeDocumentos.className = `mensaje ${tipo || ''}`;
  mensajeDocumentos.style.display = texto ? 'block' : 'none';
}

// =====================================================
// CARGAR NÓMINA
// =====================================================

async function cargarJugadores() {
  if (!equipoActual) return;

  const idsInscripciones = inscripcionesEquipo
    .filter(i => String(i.equipo_id) === String(equipoActual.id))
    .map(i => i.id);

  if (!idsInscripciones.length) {
    jugadores = [];
    renderizarJugadores();
    return;
  }

  const {
    data: inscripcionesJugadores,
    error: inscripcionesError
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
      observacion
    `)
    .in('inscripcion_equipo_id', idsInscripciones);

  if (inscripcionesError) {
    throw new Error(`Error al cargar la nómina: ${inscripcionesError.message}`);
  }

  if (!inscripcionesJugadores?.length) {
    jugadores = [];
    renderizarJugadores();
    return;
  }

  const idsJugadores = [
    ...new Set(inscripcionesJugadores.map(i => i.jugador_id).filter(Boolean))
  ];

  const {
    data: jugadoresDB,
    error: jugadoresError
  } = await supabase
    .from('jugador')
    .select(`
      id,
      nombres,
      apellidos,
      fecha_nacimiento,
      numero_cedula,
      foto,
      foto_cedula,
      origen,
      activo
    `)
    .in('id', idsJugadores);

  if (jugadoresError) {
    throw new Error(`Error al cargar los datos de jugadores: ${jugadoresError.message}`);
  }

  jugadores = inscripcionesJugadores.map(inscripcion => ({
    ...inscripcion,
    jugador: (jugadoresDB || []).find(
      j => String(j.id) === String(inscripcion.jugador_id)
    ) || null
  }));

  renderizarJugadores();
}

// =====================================================
// TABLA Y BOTONES
// =====================================================

function renderizarJugadores() {
  if (!tablaJugadores) return;

  const termino = (buscar?.value || '').trim().toLocaleLowerCase('es');

  const lista = jugadores.filter(registro => {
    const j = registro.jugador;
    if (!j) return false;

    const texto = `
      ${j.nombres || ''}
      ${j.apellidos || ''}
      ${j.numero_cedula || ''}
      ${registro.numero ?? ''}
      ${registro.posicion || ''}
      ${j.origen || ''}
    `.toLocaleLowerCase('es');

    return texto.includes(termino);
  });

  tablaJugadores.replaceChildren();

  for (const registro of lista) {
    const j = registro.jugador;
    const fila = document.createElement('tr');
    const nombre = `${j.nombres || ''} ${j.apellidos || ''}`.trim();

    const celdaNombre = document.createElement('td');
    const contenedorFoto = document.createElement('div');

    contenedorFoto.style.display = 'flex';
    contenedorFoto.style.alignItems = 'center';
    contenedorFoto.style.gap = '10px';

    if (j.foto) {
      const imagen = document.createElement('img');
      imagen.alt = `Fotografía de ${nombre || 'jugador'}`;
      imagen.style.width = '44px';
      imagen.style.height = '44px';
      imagen.style.objectFit = 'cover';
      imagen.style.borderRadius = '50%';
      imagen.style.background = '#eee';

      crearEnlacePrivado(BUCKET_JUGADORES, j.foto).then(url => {
        if (url) {
          imagen.src = url;
        } else {
          imagen.alt = 'Fotografía no disponible';
        }
      }).catch(error => {
        console.warn('No se pudo cargar la miniatura:', error);
      });

      contenedorFoto.appendChild(imagen);
    }

    const datosNombre = document.createElement('div');
    const fuerte = document.createElement('strong');
    fuerte.textContent = nombre || 'Sin nombre';

    const cedula = document.createElement('small');
    cedula.style.display = 'block';
    cedula.style.opacity = '0.7';
    cedula.textContent = `C.I.: ${j.numero_cedula || 'No registrada'}`;

    datosNombre.append(fuerte, cedula);
    contenedorFoto.appendChild(datosNombre);
    celdaNombre.appendChild(contenedorFoto);
    fila.appendChild(celdaNombre);

    const celdaNumero = document.createElement('td');
    celdaNumero.textContent = registro.numero ?? '—';
    fila.appendChild(celdaNumero);

    const celdaPosicion = document.createElement('td');
    celdaPosicion.textContent = registro.posicion || '—';
    fila.appendChild(celdaPosicion);

    const celdaFecha = document.createElement('td');
    celdaFecha.textContent = formatearFecha(j.fecha_nacimiento);
    fila.appendChild(celdaFecha);

    const celdaOrigen = document.createElement('td');
    celdaOrigen.textContent = j.origen || '—';
    fila.appendChild(celdaOrigen);

    const celdaAcciones = document.createElement('td');
    celdaAcciones.className = 'acciones-tabla';

    const btnVer = document.createElement('button');
    btnVer.type = 'button';
    btnVer.className = 'btn-ver';
    btnVer.textContent = 'Ver';
    btnVer.setAttribute('aria-label', `Ver ficha de ${nombre}`);
    btnVer.addEventListener('click', () => verJugador(registro.id));

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-editar';
    btnEditar.textContent = 'Editar';
    btnEditar.setAttribute('aria-label', `Editar a ${nombre}`);
    btnEditar.addEventListener('click', () => abrirEditar(registro.id));

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar';
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.setAttribute('aria-label', `Quitar a ${nombre} de la nómina`);
    btnEliminar.addEventListener('click', () => eliminarJugador(registro.id));

    celdaAcciones.append(btnVer, btnEditar, btnEliminar);
    fila.appendChild(celdaAcciones);
    tablaJugadores.appendChild(fila);
  }

  if (vacio) {
    vacio.style.display = lista.length ? 'none' : 'block';

    const h3 = vacio.querySelector('h3');
    const p = vacio.querySelector('p');

    if (termino && lista.length === 0 && jugadores.length > 0) {
      if (h3) h3.textContent = 'No se encontraron jugadores';
      if (p) p.textContent = 'Prueba con otro nombre, cédula o número.';
    } else {
      if (h3) h3.textContent = 'No hay jugadores registrados';
      if (p) p.textContent = 'Comienza agregando el primer jugador de tu equipo.';
    }
  }

  actualizarEstadisticas();
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

function actualizarEstadisticas() {
  const total = jugadores.filter(r => r.jugador).length;
  const activos = jugadores.filter(
    r => r.jugador && r.jugador.activo !== false
  ).length;

  if (totalJugadores) totalJugadores.textContent = String(total);
  if (totalActivos) totalActivos.textContent = String(activos);
  if (totalNomina) totalNomina.textContent = String(total);
}

// =====================================================
// AGREGAR JUGADOR
// =====================================================

function abrirAgregar() {
  jugadorEditando = null;

  formJugador?.reset();

  if (fotoJugadorInput) fotoJugadorInput.value = '';
  if (cedulaArchivoInput) cedulaArchivoInput.value = '';

  if (tituloModal) tituloModal.textContent = 'Agregar jugador';

  if (vistaFotoJugador) {
    vistaFotoJugador.textContent = '📷 La fotografía aparecerá aquí.';
  }

  if (vistaCedulaJugador) {
    vistaCedulaJugador.textContent = '📄 El documento aparecerá aquí.';
  }

  mostrarMensaje('', '');

  if (modal) modal.style.display = 'flex';
}

// =====================================================
// EDITAR JUGADOR
// =====================================================

async function abrirEditar(id) {
  const registro = jugadores.find(r => String(r.id) === String(id));

  if (!registro?.jugador) return;

  jugadorEditando = registro;
  const j = registro.jugador;

  setValue('nombres', j.nombres);
  setValue('apellidos', j.apellidos);
  setValue('numeroCedula', j.numero_cedula);
  setValue('fechaNacimiento', j.fecha_nacimiento);
  setValue('numero', registro.numero);
  setValue('posicion', registro.posicion);
  setValue('origen', j.origen);
  setValue('jugadorId', j.id);

  // No se rellenan inputs de archivo; los navegadores lo impiden.
  // Los archivos existentes se muestran y se conservan si no se reemplazan.
  if (fotoJugadorInput) fotoJugadorInput.value = '';
  if (cedulaArchivoInput) cedulaArchivoInput.value = '';

  if (tituloModal) tituloModal.textContent = 'Editar jugador';

  mostrarMensaje('', '');

  if (vistaFotoJugador) vistaFotoJugador.textContent = 'Cargando fotografía...';
  if (vistaCedulaJugador) vistaCedulaJugador.textContent = 'Cargando documento...';

  if (modal) modal.style.display = 'flex';

  try {
    await mostrarArchivosActuales(j);
  } catch (error) {
    console.error('Error mostrando archivos del jugador:', error);
  }
}

// =====================================================
// GUARDAR JUGADOR NUEVO O EDITADO
// =====================================================

async function guardarJugador(event) {
  event.preventDefault();

  if (!equipoActual || !usuarioActual) {
    mostrarMensaje('No existe un equipo asignado o una sesión activa.', 'error');
    return;
  }

  const nombres = getValue('nombres');
  const apellidos = getValue('apellidos');
  const cedula = getValue('numeroCedula');
  const fechaNacimiento = getValue('fechaNacimiento') || null;

  const numeroTexto = getValue('numero');
  const numero = numeroTexto === '' ? null : Number(numeroTexto);

  const posicion = getValue('posicion') || null;
  const origen = getValue('origen') || null;

  if (!nombres || !apellidos || !cedula) {
    mostrarMensaje('Complete nombres, apellidos y número de cédula.', 'error');
    return;
  }

  if (numero !== null && (!Number.isInteger(numero) || numero < 0)) {
    mostrarMensaje('El número de camiseta debe ser un número entero válido.', 'error');
    return;
  }

  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
  }

  mostrarMensaje('', '');

  try {
    if (jugadorEditando) {
      const jugadorId = jugadorEditando.jugador.id;

      const { error: jugadorError } = await supabase
        .from('jugador')
        .update({
          nombres,
          apellidos,
          numero_cedula: cedula,
          fecha_nacimiento: fechaNacimiento,
          origen
        })
        .eq('id', jugadorId);

      if (jugadorError) {
        throw new Error(`Error actualizando jugador: ${jugadorError.message}`);
      }

      await subirArchivosJugador(jugadorId);

      const {
        error: inscripcionError
      } = await supabase
        .from('inscripcion_jugador')
        .update({ numero, posicion })
        .eq('id', jugadorEditando.id)
        .eq('inscripcion_equipo_id', jugadorEditando.inscripcion_equipo_id);

      if (inscripcionError) {
        throw new Error(
          'Los datos personales se guardaron, pero no se pudo actualizar ' +
          `la inscripción: ${inscripcionError.message}`
        );
      }

      mostrarMensaje('Jugador actualizado correctamente.', 'ok');

    } else {
      let jugador;

      const {
        data: existente,
        error: buscarError
      } = await supabase
        .from('jugador')
        .select(`
          id,
          nombres,
          apellidos,
          numero_cedula,
          fecha_nacimiento,
          foto,
          foto_cedula,
          origen,
          activo
        `)
        .eq('numero_cedula', cedula)
        .maybeSingle();

      if (buscarError) {
        throw new Error(`No se pudo verificar la cédula: ${buscarError.message}`);
      }

      if (existente) {
        jugador = existente;
      } else {
        const {
          data: nuevo,
          error: crearError
        } = await supabase
          .from('jugador')
          .insert({
            nombres,
            apellidos,
            numero_cedula: cedula,
            fecha_nacimiento: fechaNacimiento,
            origen,
            activo: true
          })
          .select(`
            id,
            nombres,
            apellidos,
            numero_cedula,
            fecha_nacimiento,
            foto,
            foto_cedula,
            origen,
            activo
          `)
          .single();

        if (crearError) {
          throw new Error(`Error creando jugador: ${crearError.message}`);
        }

        jugador = nuevo;
      }

      const inscripcion = obtenerInscripcionEquipoActual();

      if (!inscripcion) {
        throw new Error('No se encontró una inscripción para el equipo.');
      }

      const {
        data: duplicada,
        error: dupError
      } = await supabase
        .from('inscripcion_jugador')
        .select('id')
        .eq('inscripcion_equipo_id', inscripcion.id)
        .eq('jugador_id', jugador.id)
        .maybeSingle();

      if (dupError) {
        throw new Error(
          'No se pudo comprobar si el jugador ya está en la nómina: ' +
          dupError.message
        );
      }

      if (duplicada) {
        throw new Error(
          'Este jugador ya está registrado en la nómina. ' +
          'Utiliza Editar para modificar sus datos.'
        );
      }

      const { error: inscripcionError } = await supabase
        .from('inscripcion_jugador')
        .insert({
          inscripcion_equipo_id: inscripcion.id,
          jugador_id: jugador.id,
          numero,
          posicion,
          es_especial: false,
          estado: 'PENDIENTE'
        });

      if (inscripcionError) {
        throw new Error(
          'Jugador localizado, pero no se pudo añadir a la nómina: ' +
          inscripcionError.message
        );
      }

      await subirArchivosJugador(jugador.id);
      mostrarMensaje('Jugador agregado correctamente.', 'ok');
    }

    await cargarJugadores();

    setTimeout(() => cerrarModal(), 700);

  } catch (error) {
    console.error('❌ Error guardando jugador:', error);
    mostrarMensaje(error?.message || 'No se pudo guardar el jugador.', 'error');

  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar jugador';
    }
  }
}

// =====================================================
// ELIMINAR JUGADOR DE LA NÓMINA
// =====================================================

async function eliminarJugador(id) {
  const registro = jugadores.find(r => String(r.id) === String(id));

  if (!registro?.jugador) return;

  const j = registro.jugador;
  const nombre = `${j.nombres || ''} ${j.apellidos || ''}`.trim();

  const confirmado = confirm(
    `¿Deseas quitar a ${nombre} de la nómina de este equipo? ` +
    'Esta acción no elimina sus datos personales.'
  );

  if (!confirmado) return;

  try {
    const { error } = await supabase
      .from('inscripcion_jugador')
      .delete()
      .eq('id', registro.id)
      .eq('inscripcion_equipo_id', registro.inscripcion_equipo_id);

    if (error) {
      throw new Error(`No se pudo quitar al jugador de la nómina: ${error.message}`);
    }

    await cargarJugadores();

  } catch (error) {
    console.error('❌ Error eliminando jugador:', error);
    alert(error?.message || 'No se pudo quitar al jugador de la nómina.');
  }
}

// =====================================================
// CERRAR FORMULARIO
// =====================================================

function cerrarModal() {
  jugadorEditando = null;

  if (modal) modal.style.display = 'none';

  formJugador?.reset();

  if (fotoJugadorInput) fotoJugadorInput.value = '';
  if (cedulaArchivoInput) cedulaArchivoInput.value = '';

  if (vistaFotoJugador) {
    vistaFotoJugador.replaceChildren();
    vistaFotoJugador.textContent = '📷 No hay fotografía seleccionada.';
  }

  if (vistaCedulaJugador) {
    vistaCedulaJugador.replaceChildren();
    vistaCedulaJugador.textContent = '📄 No hay documento seleccionado.';
  }

  mostrarMensaje('', '');
}

// =====================================================
// INDICADOR DE CARGA
// =====================================================

function mostrarLoading(texto) {
  if (pantallaCarga) {
    pantallaCarga.style.display = 'flex';

    const p = pantallaCarga.querySelector('.carga-box p');
    if (p) p.textContent = texto;
  }

  if (contenedor) contenedor.style.visibility = 'hidden';
}

function ocultarLoading() {
  if (pantallaCarga) pantallaCarga.style.display = 'none';
  if (contenedor) contenedor.style.visibility = 'visible';
}

// =====================================================
// ERRORES GENERALES
// =====================================================

function mostrarError(texto) {
  console.error('⚠️ Módulo de capitán:', texto);

  if (pantallaCarga) {
    pantallaCarga.style.display = 'flex';

    const caja = pantallaCarga.querySelector('.carga-box');

    if (caja) {
      caja.replaceChildren();

      const icono = document.createElement('div');
      icono.style.fontSize = '2.4rem';
      icono.style.marginBottom = '12px';
      icono.textContent = '⚠️';

      const titulo = document.createElement('h2');
      titulo.style.margin = '0 0 12px';
      titulo.style.color = '#fff';
      titulo.textContent = 'No se pudo cargar el módulo';

      const parrafo = document.createElement('p');
      parrafo.style.color = '#fff';
      parrafo.style.lineHeight = '1.5';
      parrafo.textContent = texto;

      const boton = document.createElement('button');
      boton.textContent = 'Reintentar';
      boton.style.marginTop = '16px';
      boton.style.padding = '10px 18px';
      boton.style.border = '0';
      boton.style.borderRadius = '8px';
      boton.style.cursor = 'pointer';
      boton.style.fontWeight = '700';
      boton.addEventListener('click', () => window.location.reload());

      caja.append(icono, titulo, parrafo, boton);
    }
  } else {
    alert(texto);
  }
}

// =====================================================
// MENSAJES DEL FORMULARIO
// =====================================================

function mostrarMensaje(texto, tipo) {
  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = 'mensaje';

  if (tipo) mensaje.classList.add(tipo);

  mensaje.style.display = texto ? 'block' : 'none';
}

// =====================================================
// UTILIDADES
// =====================================================

function getValue(id) {
  return (document.getElementById(id)?.value ?? '').trim();
}

function setValue(id, value) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.value = value ?? '';
}

function formatearFecha(fecha) {
  if (!fecha) return '—';

  const partes = String(fecha).split('-');

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(fecha);
}

// =====================================================
// EVENTOS
// =====================================================

btnNuevoJugador?.addEventListener('click', abrirAgregar);

btnSubirAval?.addEventListener('click', () => {
  subirDocumentoEquipo('aval');
});

btnSubirInscripcion?.addEventListener('click', () => {
  subirDocumentoEquipo('inscripcion');
});

btnCerrar?.addEventListener('click', cerrarModal);
btnCancelar?.addEventListener('click', cerrarModal);

formJugador?.addEventListener('submit', guardarJugador);
buscar?.addEventListener('input', renderizarJugadores);

btnSalir?.addEventListener('click', async () => {
  btnSalir.disabled = true;

  try {
    const { error } = await supabase.auth.signOut();

    if (error) console.error('Error cerrando sesión:', error);
  } finally {
    window.location.href = '../login.html';
  }
});

modal?.addEventListener('click', event => {
  if (event.target === modal) cerrarModal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    cerrarFichaJugador();

    if (modal?.style.display === 'flex') {
      cerrarModal();
    }
  }
});
