// src/node-server.js — Adaptador Node ↔ Web API (apenas para testes/dev local).
// Em produção o mesmo router roda em Cloudflare Workers (worker.js) sem este arquivo.

import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { handleRequest } from './router.js';

export function startServer({ port = 7000, host = '0.0.0.0', env = {} } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        const hostHdr = req.headers.host || `${host}:${port}`;
        const target = `${proto}://${hostHdr}${req.url || '/'}`;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (v == null) continue;
          headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
        }
        const method = (req.method || 'GET').toUpperCase();
        const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);
        const request = new Request(target, {
          method,
          headers,
          body: hasBody ? Readable.toWeb(req) : undefined,
          ...(hasBody ? { duplex: 'half' } : {}),
        });
        const response = await handleRequest(request, env);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        if (response.body && method !== 'HEAD') {
          await pipeline(Readable.fromWeb(response.body), res);
        } else {
          res.end();
        }
      } catch (err) {
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(String(err && err.message ? err.message : err));
      }
    });

    server.listen(port, host, () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}
