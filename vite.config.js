import { defineConfig } from "vite";
import { resolve } from "node:path";

const paginas = [
  "index.html",
  "equipos.html",
  "inscripcion.html",
  "jugadores.html",
  "login.html",
  "partidos.html",
  "registro.html",
  "tabla.html",
  "admin/index.html",
  "admin/competencias.html",
  "admin/equipos.html",
  "admin/inscripciones.html",
  "admin/jugadores-capitan.html",
  "admin/jugadores.html",
  "admin/nomina.html",
  "admin/perfiles.html",
  "admin/usuarios.html",
  "admin/partido.html",
  "admin/prueba-funcion.html"
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        paginas.map((pagina) => [
          pagina.replaceAll("/", "_").replace(".html", ""),
          resolve(process.cwd(), pagina)
        ])
      )
    }
  }
});
