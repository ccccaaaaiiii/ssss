// addon.js — Entry do addon Stremio (MCSO Drive)
//
// - `node addon.js` sobe o servidor de DESENVOLVIMENTO local (porta 7000).
// - Em PRODUÇÃO o código roda 100% serverless via worker.js (Cloudflare Workers).
//   Nunca use localhost na TV: aponte para a URL pública do worker.

import { handleRequest } from './src/router.js';

export { handleRequest };

export default { fetch: (request, env) => handleRequest(request, env || {}) };

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('addon.js') || process.argv[1].endsWith('addon'));

if (isMain) {
  const { startServer } = await import('./src/node-server.js');
  const port = parseInt(process.env.PORT || '7000', 10);
  const { url } = await startServer({ port, host: '0.0.0.0', env: {} });
  console.log(`MCSO Drive Addon (dev server)`);
  console.log(`  Manifesto: ${url}/manifest.json`);
  console.log(`  Health:    ${url}/healthz`);
}
