// src/xscan.js — Varredura do perfil X (Twitter) sem API key
//
// Fonte: https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}
// Extração em 2 camadas (resistente a mudanças de layout):
//   1. blocos data-tweet-id → texto, data e links daquele tweet
//   2. varredura global de URLs (drive.google.com, docs.google.com, t.co),
//      inclusive com barras escapadas (\/) do JSON embutido
// t.co é resolvido por redirect (fetch follow → res.url).

import { BROWSER_UA, timeoutSignal } from './util.js';
import { cacheGet, cacheSet } from './cache.js';
import { extractFileId } from './gdrive.js';

export const DEFAULT_HANDLE = 'monroesheriffny';
const SCAN_TTL_MS = 15 * 60 * 1000;

/** Último recurso: itens canônicos do README (catálogo nunca fica vazio). */
export const SEED_ITEMS = [
  {
    id: 'drive_1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z',
    fileId: '1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z',
    name: 'NATURAL (MCSO 2018)',
    description: 'Vídeo institucional — Monroe Sheriff NY (MCSO 2018). Fonte: https://x.com/monroesheriffny/status/1078703782916227072',
    released: '2018-12-26T00:00:00.000Z',
    poster: 'https://drive.google.com/thumbnail?id=1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z&sz=w1000',
    tweetUrl: 'https://x.com/monroesheriffny/status/1078703782916227072',
    source: 'seed',
  },
];

/** Aliases estáveis (compatibilidade com ids antigos das branches gem37f etc.). */
export const ALIASES = {
  mcso_natural_2018: '1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z',
  mcso_1078703782916227072: '1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z',
};

const DRIVE_URL_RE = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s"'<>\\)]+/gi;
const TCO_RE = /https?:\/\/t\.co\/[A-Za-z0-9]+/gi;

export function unescapeJsonSlashes(html) {
  return html.replace(/\\\//g, '/');
}

function trimTrailingPunct(url) {
  return url.replace(/[.,;:!?)\]}]+$/, '');
}

/** Extrai todas as URLs relevantes (drive + t.co) de um HTML/JSON. */
export function extractUrls(html) {
  const src = unescapeJsonSlashes(html);
  const drive = new Set();
  const tco = new Set();
  for (const m of src.matchAll(DRIVE_URL_RE)) drive.add(trimTrailingPunct(m[0]));
  for (const m of src.matchAll(TCO_RE)) tco.add(trimTrailingPunct(m[0]));
  return { drive: [...drive], tco: [...tco] };
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Blocos de tweets (data-tweet-id) com texto, data e links. */
export function extractTweetBlocks(html) {
  const src = unescapeJsonSlashes(html);
  const marks = [...src.matchAll(/data-tweet-id="(\d+)"/g)];
  const blocks = [];
  for (let i = 0; i < marks.length; i++) {
    const tweetId = marks[i][1];
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : Math.min(src.length, start + 12000);
    const chunk = src.slice(start, end);
    const textEl = chunk.match(/class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const text = textEl ? stripTags(textEl[1]) : '';
    const created = chunk.match(/datetime="([^"]+)"/i)?.[1] || null;
    const urls = extractUrls(chunk);
    blocks.push({ tweetId, text, created, ...urls });
  }
  return blocks;
}

export async function resolveRedirect(url, env = {}) {
  // Em testes, TCO_ORIGIN reescreve https://t.co/xxx → mock local (mesmo pathname).
  const rewrite = (u) => {
    if (!env.TCO_ORIGIN) return u;
    try {
      const parsed = new URL(u);
      if (parsed.hostname === 't.co') {
        return `${String(env.TCO_ORIGIN).replace(/\/+$/, '')}${parsed.pathname}`;
      }
    } catch { /* ignora */ }
    return u;
  };

  let current = url;
  for (let i = 0; i < 5; i++) {
    if (extractFileId(current)) return current; // já é link do Drive: para aqui
    try {
      const res = await fetch(rewrite(current), {
        headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
        redirect: 'manual',
        signal: timeoutSignal(8000),
      });
      try { await res.body?.cancel(); } catch { /* ignora */ }
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, rewrite(current)).toString();
        continue;
      }
      return current;
    } catch {
      return null;
    }
  }
  return current;
}

function tweetTitle(text, fallbackId) {
  if (!text) return `MCSO Drive ${fallbackId}`;
  const firstLine = text.split(/\n|(?<=[.!?])\s/)[0].trim();
  return (firstLine || `MCSO Drive ${fallbackId}`).slice(0, 120);
}

function itemFromFileId(fileId, extra = {}) {
  return {
    id: `drive_${fileId}`,
    fileId,
    name: extra.name || `MCSO Drive ${fileId.slice(0, 8)}`,
    description: extra.description || '',
    released: extra.released || null,
    poster: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    tweetUrl: extra.tweetUrl || null,
    source: extra.source || 'scan',
  };
}

/**
 * Varre o perfil X e retorna os itens (metas) com links do Drive.
 * Nunca retorna vazio: usa SEED_ITEMS como fallback.
 */
export async function scanProfile(env = {}, handle = DEFAULT_HANDLE) {
  const key = `scan:${handle}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const base = (env.SYNDICATION_ORIGIN || 'https://syndication.twitter.com').replace(/\/+$/, '');
  const url = `${base}/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: timeoutSignal(15000),
    });
    html = await res.text();
  } catch {
    html = '';
  }

  const blocks = extractTweetBlocks(html);
  const global = extractUrls(html);

  // Resolve t.co (limitado e concorrente para não estourar tempo no serverless)
  const tcoTargets = [...new Set([...global.tco, ...blocks.flatMap((b) => b.tco)])].slice(0, 16);
  const resolved = new Map();
  await Promise.all(
    tcoTargets.map(async (t) => {
      const dest = await resolveRedirect(t, env);
      if (dest) resolved.set(t, dest);
    })
  );

  const itemsById = new Map();
  const add = (fileId, extra) => {
    if (!fileId) return;
    const item = itemFromFileId(fileId, extra);
    const prev = itemsById.get(item.id);
    if (!prev) itemsById.set(item.id, item);
    else if (!prev.description && item.description) itemsById.set(item.id, { ...prev, ...item });
  };

  for (const b of blocks) {
    const urls = [
      ...b.drive,
      ...b.tco.map((t) => resolved.get(t)).filter(Boolean),
    ];
    for (const u of urls) {
      const fileId = extractFileId(u);
      add(fileId, {
        name: tweetTitle(b.text, b.tweetId),
        description: b.text,
        released: b.created,
        tweetUrl: b.tweetId ? `https://x.com/i/status/${b.tweetId}` : null,
        source: 'scan',
      });
    }
  }

  // Links avulsos (posts fora dos blocos parseados)
  for (const u of global.drive) {
    add(extractFileId(u), { source: 'scan' });
  }
  for (const t of global.tco) {
    const dest = resolved.get(t);
    if (dest) add(extractFileId(dest), { source: 'scan' });
  }

  let items = [...itemsById.values()];
  if (items.length === 0) items = SEED_ITEMS.slice();

  const result = { items, scannedAt: new Date().toISOString(), handle };
  cacheSet(key, result, SCAN_TTL_MS);
  return result;
}
