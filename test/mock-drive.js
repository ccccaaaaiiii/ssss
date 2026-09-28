// test/mock-drive.js — Mock fiel do Google Drive para testes determinísticos.
//
// Reproduz EXATAMENTE o comportamento real capturado em 2026-09-28:
//   - muro "Virus scan warning" com formulário uuid/confirm
//   - headers letais ao Stremio: content-disposition: attachment,
//     cross-origin-resource-policy: same-site, cross-origin-embedder-policy: require-corp
//   - modos de falha controlados pelo SUFIXO do file id:
//       * ...RANGEIGN  → ignora Range (responde 200 cheio)  → testa o ★ Range Shim
//       * ...DIRECT    → sem muro, octet-stream + attachment → testa normalização de MIME
//       * (demais)     → muro + Range honrado (206)

import http from 'node:http';

export const MEDIA_SIZE = 2_000_000;

/** Buffer de "vídeo" determinístico (bytes = offset & 0xff) com magic ftyp. */
export function buildMedia(size = MEDIA_SIZE) {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = i & 0xff;
  // box ftyp (MP4) no início
  buf.writeUInt32BE(24, 0);
  buf.write('ftyp', 4, 'latin1');
  buf.write('isom', 8, 'latin1');
  return buf;
}

function wallHtml(fileId, uuid) {
  return `<!DOCTYPE html><html><head><title>Google Drive - Virus scan warning</title></head>
<body><p class="uc-name-size"><a href="/open?id=${fileId}">Big Buck Bunny.mp4</a> (177M) is too large for Google to scan for viruses. Would you still like to download this file?</p>
<form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
<input type="hidden" name="id" value="${fileId}">
<input type="hidden" name="export" value="download">
<input type="hidden" name="confirm" value="t">
<input type="hidden" name="uuid" value="${uuid}">
<button type="submit" id="uc-download-link">Download anyway</button>
</form></body></html>`;
}

const KILLER_HEADERS = {
  'content-disposition': 'attachment; filename="Big Buck Bunny.mp4"',
  'cross-origin-resource-policy': 'same-site',
  'cross-origin-embedder-policy': 'require-corp',
  'content-security-policy': 'sandbox',
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': '*',
  'accept-ranges': 'bytes',
  'last-modified': 'Sun, 28 Feb 2021 23:03:45 GMT',
};

function modeOf(fileId) {
  if (fileId.includes('RANGEIGN')) return 'range-ignored';
  if (fileId.includes('DIRECT')) return 'direct';
  return 'wall';
}

/**
 * Sobe o mock. Retorna { server, port, origin, media }.
 * Qualquer file id funciona; o modo é escolhido pelo sufixo do id.
 */
export function startMockDrive({ port = 0, media = buildMedia() } = {}) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname !== '/download') {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const fileId = u.searchParams.get('id') || 'UNKNOWN';
    const confirm = u.searchParams.get('confirm');
    const uuid = u.searchParams.get('uuid');
    const mode = modeOf(fileId);

    // ----- muro (exceto modo DIRECT) -----
    if (mode !== 'direct' && !(confirm === 't' && uuid)) {
      const html = wallHtml(fileId, `uuid-${fileId}-dynamic-token`);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-store, max-age=0',
      });
      res.end(html);
      return;
    }

    // ----- mídia -----
    const rangeHdr = req.headers.range || null;
    const mediaHeaders = {
      ...KILLER_HEADERS,
      // modo "link curto": MIME genérico + attachment (o caso clássico do usuário)
      'content-type': mode === 'direct' ? 'application/octet-stream' : 'video/mp4',
    };

    if (mode === 'range-ignored' || !rangeHdr) {
      res.writeHead(200, {
        ...mediaHeaders,
        'content-length': String(media.length),
      });
      res.end(media);
      return;
    }

    // origin RFC-compliant (o Drive real honra ranges inclusive sufixo)
    const m = /^bytes=(?:(\d+)-(\d*)|-(\d+))$/.exec(rangeHdr.trim());
    if (!m) {
      res.writeHead(416, { 'content-range': `bytes */${media.length}` });
      res.end();
      return;
    }
    let start, end;
    if (m[3] != null) {
      start = Math.max(0, media.length - parseInt(m[3], 10));
      end = media.length - 1;
    } else {
      start = parseInt(m[1], 10);
      end = m[2] === '' ? media.length - 1 : Math.min(parseInt(m[2], 10), media.length - 1);
    }
    if (start >= media.length) {
      res.writeHead(416, { 'content-range': `bytes */${media.length}` });
      res.end();
      return;
    }
    const chunk = media.subarray(start, end + 1);
    res.writeHead(206, {
      ...mediaHeaders,
      'content-range': `bytes ${start}-${end}/${media.length}`,
      'content-length': String(chunk.length),
    });
    res.end(chunk);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port, origin: `http://127.0.0.1:${addr.port}`, media });
    });
  });
}
