// src/shim.js — ★ Range Shim + normalização de headers (a peça que faltava)
//
// Por que o VLC toca o link do Drive e o Stremio/Smart TV não:
//   - cross-origin-resource-policy: same-site   → bloqueia mídia em WebView/Chromium
//   - cross-origin-embedder-policy: require-corp → idem
//   - content-disposition: attachment           → player web/TV trata como download
//   - content-type: application/octet-stream    → TV recusa decoder desconhecido
//   - Range respondido com 200 (sem Content-Range) → ExoPlayer/Tizen/webOS exigem 206
//
// Este módulo serve SEMPRE:
//   - content-type: video/*, accept-ranges: bytes, access-control-allow-origin: *
//   - status 206 + content-range correto para QUALQUER Range pedido pelo player
//     (se o origin ignorar o Range, sintetizamos o 206 fatiando o stream — sliceStream)

const STRIP_HEADERS = new Set([
  'content-disposition', 'content-encoding', 'content-length', 'content-range',
  'content-type', 'accept-ranges', 'set-cookie', 'transfer-encoding', 'connection',
  'keep-alive', 'www-authenticate', 'content-security-policy',
  'content-security-policy-report-only', 'cross-origin-embedder-policy',
  'cross-origin-opener-policy', 'cross-origin-resource-policy',
  'x-content-type-options', 'x-frame-options', 'strict-transport-security',
  'report-to', 'nel', 'alt-svc', 'timing-allow-origin',
]);

/** parseia "bytes=a-b" | "bytes=a-" | "bytes=-n" → {start,end} | {suffix} | null */
export function parseRange(header) {
  if (!header) return null;
  const m = /^\s*bytes=(\d*)-(\d*)\s*$/.exec(String(header));
  if (!m) return null;
  const [, a, b] = m;
  if (a === '' && b === '') return null;
  if (a === '') return { suffix: parseInt(b, 10) };
  return { start: parseInt(a, 10), end: b === '' ? null : parseInt(b, 10) };
}

export function parseContentRange(header) {
  if (!header) return null;
  const m = /^\s*bytes\s+(\d+)-(\d+)\/(\d+|\*)\s*$/i.exec(header);
  if (!m) return null;
  return {
    start: parseInt(m[1], 10),
    end: parseInt(m[2], 10),
    total: m[3] === '*' ? null : parseInt(m[3], 10),
  };
}

/** Converte o Range do cliente em limites absolutos (ou null se insatisfazível). */
export function resolveBounds(range, total) {
  if (!range) return null;
  let start, end;
  if (range.suffix != null) {
    if (total == null) return { start: null, end: null, unbounded: true };
    if (range.suffix === 0) return null;
    start = Math.max(0, total - range.suffix);
    end = total - 1;
  } else {
    start = range.start;
    if (range.end != null) {
      end = range.end;
    } else if (total != null) {
      end = total - 1;
    } else {
      return { start, end: null, unbounded: true };
    }
    if (total != null) {
      if (start >= total) return null;
      end = Math.min(end, total - 1);
    }
  }
  if (start < 0 || (end != null && end < start)) return null;
  return { start, end, unbounded: end == null };
}

/**
 * Fatia um ReadableStream: pula `skip` bytes e entrega no máximo `count` bytes.
 * Não bufferiza o arquivo inteiro (seguro para Workers/memória).
 */
export function sliceStream(body, skip, count) {
  const reader = body.getReader();
  let skipped = 0;
  let taken = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          let chunk = value;
          if (skipped < skip) {
            const need = skip - skipped;
            if (chunk.length <= need) {
              skipped += chunk.length;
              continue;
            }
            chunk = chunk.subarray(need);
            skipped = skip;
          }
          const remain = count - taken;
          if (chunk.length >= remain) {
            controller.enqueue(chunk.subarray(0, remain));
            taken = remain;
            controller.close();
            try { await reader.cancel(); } catch { /* ignora */ }
            return;
          }
          taken += chunk.length;
          controller.enqueue(chunk);
        }
      } catch (err) {
        try { controller.error(err); } catch { /* ignora */ }
      }
    },
    cancel(reason) {
      try { reader.cancel(reason); } catch { /* ignora */ }
    },
  });
}

/** Headers finais SEMPRE seguros para players web/TV. */
export function mediaHeaders({ originHeaders, mime, total, start, end, partial }) {
  const h = new Headers();
  if (originHeaders) {
    for (const [k, v] of originHeaders.entries()) {
      if (!STRIP_HEADERS.has(k.toLowerCase())) h.set(k, v);
    }
  }
  h.set('content-type', mime || 'video/mp4');
  h.set('accept-ranges', 'bytes');
  h.set('access-control-allow-origin', '*');
  h.set('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag, Last-Modified');
  h.set('cache-control', 'public, max-age=300');
  h.delete('content-disposition'); // garante mesmo que venha duplicado
  if (partial) {
    h.set('content-range', `bytes ${start}-${end}/${total != null ? total : '*'}`);
    h.set('content-length', String(end - start + 1));
  } else if (total != null) {
    h.set('content-length', String(total));
  }
  return h;
}

function rangeNotSatisfiable(total) {
  return new Response(null, {
    status: 416,
    headers: {
      'content-range': `bytes */${total != null ? total : '*'}`,
      'access-control-allow-origin': '*',
    },
  });
}

/**
 * Serve mídia com semântica de Range GARANTIDA.
 *
 * @param {object}   opts
 * @param {string}   opts.clientMethod  GET|HEAD do player
 * @param {string|null} opts.clientRange header Range do player
 * @param {Function} opts.fetchMedia    async (rangeHeader|null) => Response (origin)
 * @param {string}   opts.mime          content-type final
 */
export async function serveMedia({ clientMethod = 'GET', clientRange = null, fetchMedia, mime = 'video/mp4' }) {
  const isHead = clientMethod === 'HEAD';
  const range = parseRange(clientRange);

  // HEAD: probe barata (alguns origins dão 403 em HEAD — usamos GET bytes=0-0).
  if (isHead) {
    const probe = await fetchMedia('bytes=0-0');
    if (!probe.ok && probe.status !== 206) {
      return new Response(null, { status: probe.status, headers: { 'access-control-allow-origin': '*' } });
    }
    const cr = parseContentRange(probe.headers.get('content-range'));
    const total = cr?.total ?? null;
    try { await probe.body?.cancel(); } catch { /* ignora */ }
    return new Response(null, {
      status: 200,
      headers: mediaHeaders({ originHeaders: probe.headers, mime, total, partial: false }),
    });
  }

  // GET sem Range: repassa o corpo inteiro, headers normalizados.
  if (!range) {
    const res = await fetchMedia(null);
    if (res.status === 416) {
      const cr = parseContentRange(res.headers.get('content-range'));
      try { await res.body?.cancel(); } catch { /* ignora */ }
      return rangeNotSatisfiable(cr?.total ?? null);
    }
    if (!res.ok && res.status !== 206) {
      const msg = await res.text().catch(() => '');
      return new Response(msg.slice(0, 2000), {
        status: res.status,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' },
      });
    }
    const cr = parseContentRange(res.headers.get('content-range'));
    const total = cr?.total ?? (res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : null);
    return new Response(res.body, {
      status: 200,
      headers: mediaHeaders({ originHeaders: res.headers, mime, total, partial: false }),
    });
  }

  // GET com Range: repassa e GARANTE 206.
  const res = await fetchMedia(clientRange);

  if (res.status === 416) {
    const cr = parseContentRange(res.headers.get('content-range'));
    try { await res.body?.cancel(); } catch { /* ignora */ }
    return rangeNotSatisfiable(cr?.total ?? null);
  }
  if (!res.ok && res.status !== 206) {
    const msg = await res.text().catch(() => '');
    return new Response(msg.slice(0, 2000), {
      status: res.status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' },
    });
  }

  const cr = parseContentRange(res.headers.get('content-range'));
  const originPartial = res.status === 206 && cr != null;
  const total = originPartial
    ? cr.total
    : (res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : null);

  const bounds = resolveBounds(range, total);
  if (!bounds) {
    try { await res.body?.cancel(); } catch { /* ignora */ }
    return rangeNotSatisfiable(total);
  }
  if (bounds.unbounded) {
    // Sem total conhecido e range aberto: entrega o que o origin mandar (normalizado).
    return new Response(res.body, {
      status: originPartial ? 206 : 200,
      headers: mediaHeaders({
        originHeaders: res.headers,
        mime,
        total,
        start: originPartial ? cr.start : bounds.start ?? 0,
        end: originPartial ? cr.end : 0,
        partial: originPartial,
      }),
    });
  }

  const { start, end } = bounds;

  if (originPartial && cr.start === start && cr.end === end) {
    // Origin honrou o Range exatamente: passa direto.
    return new Response(res.body, {
      status: 206,
      headers: mediaHeaders({ originHeaders: res.headers, mime, total, start, end, partial: true }),
    });
  }

  if (originPartial && cr.start <= start && cr.end >= end) {
    // Origin honrou um range maior (raro): fatia dentro dele.
    const sub = sliceStream(res.body, start - cr.start, end - start + 1);
    return new Response(sub, {
      status: 206,
      headers: mediaHeaders({ originHeaders: res.headers, mime, total, start, end, partial: true }),
    });
  }

  // Origin IGNOROU o Range (respondeu 200/cheio) — ★ sintetiza o 206 fatiando o stream.
  const skip = originPartial ? cr.start : 0;
  const body = sliceStream(res.body, start - skip, end - start + 1);
  return new Response(body, {
    status: 206,
    headers: mediaHeaders({ originHeaders: res.headers, mime, total, start, end, partial: true }),
  });
}
