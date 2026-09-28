import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy compartido por `vite dev` y `vite preview`: el frontend nunca habla
// directo con el backend, siempre pasa por el mismo origen. Eso permite
// exponer toda la app detrás de una sola URL publica (por ejemplo un tunel),
// sin configurar CORS ni una VITE_API_URL distinta por entorno.
const backendProxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  // handshake y upgrade de socket.io
  '/socket.io': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    ws: true,
  },
}

// Vite rechaza peticiones cuyo header Host no reconoce (defensa contra DNS
// rebinding). Un tunel sirve la app bajo un dominio generado, asi que hay que
// declararlo o la respuesta es un 403 que en el navegador se ve como pantalla
// en blanco.
const tunnelHosts = ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: backendProxy,
    allowedHosts: tunnelHosts,
  },
  preview: {
    proxy: backendProxy,
    allowedHosts: tunnelHosts,
  },
})
