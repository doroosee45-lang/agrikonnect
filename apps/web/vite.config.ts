import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';

/** Le port est-il libre sur cette adresse ? */
function portLibreSur(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sonde = createServer();
    sonde.once('error', () => resolve(false));
    sonde.once('listening', () => sonde.close(() => resolve(true)));
    sonde.listen({ port, host, exclusive: true });
  });
}

/**
 * Premier port libre à partir de `depart`.
 *
 * Sous Windows, une autre application peut écouter sur `127.0.0.1:5173` pendant
 * que Vite réserve `0.0.0.0:5173` sans erreur : `http://localhost:5173` ouvre
 * alors l'AUTRE application. On teste donc les deux adresses avant de choisir.
 */
async function premierPortLibre(depart: number): Promise<number> {
  for (let port = depart; port < depart + 50; port += 1) {
    if ((await portLibreSur(port, '127.0.0.1')) && (await portLibreSur(port, '0.0.0.0'))) return port;
  }
  return depart;
}

export default defineConfig(async ({ command, isPreview }): Promise<UserConfig> => {
  // Uniquement pour `vite` (dev) et `vite preview` : le build n'ouvre aucun port.
  const serveur = command === 'serve';
  const portDev = serveur && !isPreview ? await premierPortLibre(5173) : 5173;
  const portPreview = isPreview ? await premierPortLibre(4173) : 4173;

  return {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // `strictPort` : le port vient d'être vérifié libre ; s'il est pris entre-temps,
  // mieux vaut une erreur claire qu'un glissement silencieux vers un port occupé.
  server: { host: '0.0.0.0', port: portDev, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: portPreview, strictPort: true, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 350,
    rolldownOptions: {
      output: {
        codeSplitting: {
          maxSize: 300_000,
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 100 },
            { name: 'vendor-router', test: /[\\/]node_modules[\\/](?:react-router|react-router-dom|@remix-run[\\/]router)[\\/]/, priority: 90 },
            { name: 'vendor-query', test: /[\\/]node_modules[\\/]@tanstack[\\/]/, priority: 80 },
            { name: 'vendor-motion', test: /[\\/]node_modules[\\/](?:framer-motion|motion-dom|motion-utils)[\\/]/, priority: 70 },
            { name: 'vendor-realtime', test: /[\\/]node_modules[\\/](?:socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io[\\/]component-emitter)[\\/]/, priority: 60 },
            { name: 'vendor-http', test: /[\\/]node_modules[\\/](?:axios|follow-redirects|proxy-from-env)[\\/]/, priority: 50 },
            { name: 'vendor-ui-state', test: /[\\/]node_modules[\\/](?:zustand|class-variance-authority|clsx|tailwind-merge)[\\/]/, priority: 40 },
            // SDK audio des appels : chargé seulement quand on rejoint un appel.
            { name: 'vendor-livekit', test: /[\\/]node_modules[\\/](?:livekit-client|@livekit[\\/][^\\/]+)[\\/]/, priority: 65 },
            { name: 'vendor-misc', test: /[\\/]node_modules[\\/]/, priority: 0 },
          ],
        },
      },
    },
  },
  };
});
