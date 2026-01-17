import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carga todas las variables de entorno, incluyendo las de Vercel (API_KEY)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Esto reemplaza 'process.env.API_KEY' en tu código por el valor real durante el 'build'
      // Evita el error "ReferenceError: process is not defined" en el navegador
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
    },
  };
});