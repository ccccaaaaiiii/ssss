// src/router.js — Roteador Web (Request/Response) — roda igual em Workers e Node.
//
// Rotas Stremio:   /manifest.json · /catalog/:type/:id · /meta/:type/:id · /stream/:type/:id
// Rotas de mídia:  /drive/:fileId[/video.mp4] · /hls/:fileId/index.m3u8 · /proxy/:b64
// Utilitários:     /healthz · / (página de instalação)

import { json, text, corsPreflight, HttpError, baseUrl, base64urlDecode, BROWSER_UA, timeoutSignal } from './util.js';
import { scanProfile } from './xscan.js';
import { buildManifest, buildCatalog, buildMeta, buildStreams, itemFromId } from './stremio.js';
import { openFile, probeSize, resolveTicket, inferMime } from './gdrive.js';
import { serveMedia } from './shim.js';

const PROXY_ALLOWED_HOSTS = [
  /^commondatastorage\.googleapis\.com$/i,
  /^storage\.googleapis\.com$/i,
  /^drive\.google\.com$/i,
  /^drive\.usercontent\.google\.com$/i,
  /^docs\.google\.com$/i,
  /\.googleusercontent\.com$/i,
  /^video\.google\.com$/i,
  /^lh3\.googleusercontent\.com$/i,
];

function landingPage(base) {
  const install = `stremio://${base.replace(/^https?:\/\//, '')}/manifest.json`;
  return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCSO Drive — Addon Stremio</title>
<style>
 body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e8eaf0;margin:0;padding:2rem;display:flex;flex-direction:column;align-items:center;gap:1rem}
 h1{margin:0;font-size:1.6rem} p{max-width:42rem;line-height:1.5;color:#aab2c5}
 a.btn{background:#7b5cff;color:#fff;text-decoration:none;padding:.85rem 1.4rem;border-radius:.6rem;font-weight:600}
 code{background:#1a1f2b;padding:.15rem .45rem;border-radius:.35rem}
</style></head><body>
<h1>MCSO Drive — Addon Stremio</h1>
<p>Vídeos do perfil <b>@monroesheriffny</b> (Google Drive) reproduzíveis em Smart TVs.
Proxy normalizado com <code>Range 206</code> garantido.</p>
<a class="btn" href="${install}">Instalar no Stremio</a>
<p>Manifesto: <a href="${base}/manifest.json" style="color:#9db4ff">${base}/manifest.json</a></p>
</body></html>`;
}

async function handleStream(request, env, id) {
  const scan = await scanProfile(env);
  const item = itemFromId(id, scan.items);
  if (!item) throw new HttpError(404, `Stream não encontrado para id "${id}"`);
  return json(buildStreams(baseUrl(request, env), item));
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return corsPreflight();
  if (!['GET', 'HEAD'].includes(method)) return text('Method Not Allowed', 405);

  try {
    // ---------- página inicial ----------
    if (path === '/' || path === '/index.html') {
      return text(landingPage(baseUrl(request, env)), 200, 'text/html; charset=utf-8');
    }

    if (path === '/healthz') {
      return json({ ok: true, service: 'mcso-drive-addon', ts: new Date().toISOString() });
    }

    // ---------- manifesto ----------
    if (path === '/manifest.json') {
      return json(buildManifest());
    }

    // ---------- catálogo ----------
    let m = path.match(/^\/catalog\/([^/]+)\/([^/]+?)(?:\/[^/]*?)?\.json$/);
    if (m) {
      const [, type, id] = m;
      const scan = await scanProfile(env);
      return json(buildCatalog(scan.items, type));
    }

    // ---------- meta ----------
    m = path.match(/^\/meta\/([^/]+)\/([^/]+?)\.json$/);
    if (m) {
      const [, type, id] = m;
      const scan = await scanProfile(env);
      const item = itemFromId(id, scan.items);
      if (!item) throw new HttpError(404, `Meta não encontrada para id "${id}"`);
      return json(buildMeta(item, type));
    }

    // ---------- stream ----------
    m = path.match(/^\/stream\/([^/]+)\/([^/]+?)\.json$/);
    if (m) {
      return handleStream(request, env, m[2]);
    }

    // ---------- HLS (m3u8 por byte-range) ----------
    m = path.match(/^\/hls\/([A-Za-z0-9_-]{10,})\/index\.m3u8$/);
    if (m) {
      const fileId = m[1];
      const base = baseUrl(request, env);
      let total = null;
      try {
        total = await probeSize(fileId, env);
      } catch {
        total = null;
      }
      const SEG = 1_200_000;
      const SEG_DUR = 8;
      const segCount = total ? Math.max(1, Math.ceil(total / SEG)) : 1;
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:4',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        `#EXT-X-TARGETDURATION:${SEG_DUR + 2}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
      ];
      for (let i = 0; i < segCount; i++) {
        const start = i * SEG;
        const end = total ? Math.min(total - 1, start + SEG - 1) : start + SEG - 1;
        const len = end - start + 1;
        lines.push(`#EXTINF:${SEG_DUR}.0,`);
        lines.push(`#EXT-X-BYTERANGE:${len}@${start}`);
        lines.push(`${base}/drive/${fileId}/video.mp4`);
      }
      lines.push('#EXT-X-ENDLIST');
      return text(lines.join('\n') + '\n', 200, 'application/vnd.apple.mpegurl', {
        'cache-control': 'public, max-age=600',
      });
    }

    // ---------- proxy do Google Drive (★ caminho principal) ----------
    m = path.match(/^\/drive\/([A-Za-z0-9_-]{10,})(?:\/[^/]+)?$/);
    if (m) {
      const fileId = m[1];
      // ticket é cacheado (8 min); serve para refinar o MIME pelo nome do arquivo
      const ticket = await resolveTicket(fileId, env);
      const mime = inferMime(ticket.filename, 'video/mp4');
      return serveMedia({
        clientMethod: method,
        clientRange: request.headers.get('range'),
        mime,
        fetchMedia: (range) => openFile(fileId, { range, method: 'GET' }, env).then(({ res }) => res),
      });
    }

    // ---------- proxy genérico (allowlist) — usado por testes/player ----------
    m = path.match(/^\/proxy\/([A-Za-z0-9_-]+)$/);
    if (m) {
      let target;
      try {
        target = new URL(base64urlDecode(m[1]));
      } catch {
        throw new HttpError(400, 'URL inválida');
      }
      if (!['http:', 'https:'].includes(target.protocol)) throw new HttpError(400, 'Protocolo inválido');
      if (!PROXY_ALLOWED_HOSTS.some((re) => re.test(target.hostname))) {
        throw new HttpError(403, `Host não permitido: ${target.hostname}`);
      }
      return serveMedia({
        clientMethod: method,
        clientRange: request.headers.get('range'),
        mime: inferMime(target.pathname.split('/').pop() || ''),
        fetchMedia: async (range) => {
          const headers = { 'User-Agent': BROWSER_UA, Accept: '*/*' };
          if (range) headers.Range = range;
          return fetch(target.toString(), {
            headers,
            redirect: 'follow',
            signal: timeoutSignal(),
          });
        },
      });
    }

    return text('Not Found', 404);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (err instanceof HttpError) return json({ error: err.message }, status);
    return json({ error: String(err && err.message ? err.message : err) }, status);
  }
}
