
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const paginas = {
  index: 'index.html',
  equipos: 'equipos.html',
  inscripcion: 'inscripcion.html',
  jugadores: 'jugadores.html',
  login: 'login.html',
  partidos: 'partidos.html',
  registro: 'registro.html',
  tabla: 'tabla.html',
  adminIndex: 'admin/index.html',
  adminCompetencias: 'admin/competencias.html',
  adminEquipos: 'admin/equipos.html',
  adminInscripciones: 'admin/inscripciones.html',
  adminJugadores: 'admin/jugadores.html',
  adminJugadoresCapitan: 'admin/jugadores-capitan.html',
  adminNomina: 'admin/nomina.html',
  adminPerfiles: 'admin/perfiles.html',
  adminUsuarios: 'admin/usuarios.html',
  adminPruebaFuncion: 'admin/prueba-funcion.html',
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(paginas).map(([nombre, archivo]) => [
          nombre,
          resolve(root, archivo),
        ])
      ),
    },
  },
});
