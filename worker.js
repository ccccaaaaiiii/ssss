// worker.js — Cloudflare Workers entrypoint (produção)
// Deploy: npx wrangler@3 deploy  (ver wrangler.toml)
// O mesmo código roda em Vercel Edge/Deno (export default { fetch }).

import { handleRequest } from './src/router.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env || {});
  },
};
