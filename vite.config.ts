import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Definimos la raíz explícitamente como el directorio actual
  root: './',
  
  // Especificamos que los archivos estáticos (manifest, sw.js, logos) están en la raíz
  publicDir: './',

  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  plugins: [react()],

  // Eliminamos 'define' ya que no usarás la API KEY y causa conflictos en el build
  
  resolve: {
    alias: {
      // Mantenemos el alias apuntando a la raíz para tus importaciones internas
      '@': path.resolve(__dirname, '.'),
    }
  },

  build: {
    outDir: 'dist',
    // Esto asegura que Vite encuentre tu index.html en la raíz
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  }
});
