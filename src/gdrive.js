// src/gdrive.js — Resolvedor Google Drive (serverless)
//
// Fluxo real do Drive (verificado ao vivo em 2026-09-28):
//   GET /download?id=<ID>&export=download
//     → 200 text/html  "Google Drive - Virus scan warning"
//        <form id="download-form"> com inputs hidden: id, export, confirm=t, uuid=<dinâmico>
//   GET /download?id=<ID>&export=download&confirm=t&uuid=<UUID>
//     → 206 video/mp4 (bytes do arquivo)
//
// Arquivos pequenos podem responder direto (sem muro) com
// content-disposition: attachment + octet-stream — o shim normaliza depois.

import { HttpError, BROWSER_UA, timeoutSignal } from './util.js';
import { cacheGet, cacheSet, cacheDelete } from './cache.js';

export const GDRIVE_DEFAULT_ORIGIN = 'https://drive.usercontent.google.com';

const TICKET_TTL_MS = 8 * 60 * 1000; // tickets uuid costumam durar minutos
const FILE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;
const ALLOWED_ID_HOSTS = /(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$|(^|\.)drive\.usercontent\.google\.com$|(^|\.)googleusercontent\.com$/i;

export function gdriveOrigin(env = {}) {
  return (env.GDRIVE_ORIGIN || GDRIVE_DEFAULT_ORIGIN).replace(/\/+$/, '');
}

/** Aceita ID puro ou qualquer formato de link do Drive/Docs. */
export function extractFileId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (FILE_ID_RE.test(s) && !s.includes('/') && !s.includes('.')) return s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!ALLOWED_ID_HOSTS.test(u.hostname)) return null;
  const idParam = u.searchParams.get('id');
  if (idParam && FILE_ID_RE.test(idParam)) return idParam;
  const m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return null; // pastas (/folders/) não são arquivos de vídeo
}

/** Extrai uuid/confirm/filename do HTML do muro de vírus (regex tolerantes). */
export function parseWall(html) {
  const uuid =
    html.match(/name="uuid"\s+value="([^"]+)"/i)?.[1] ||
    html.match(/[?&]uuid=([a-zA-Z0-9_-]{8,})/i)?.[1] ||
    null;
  const confirm = html.match(/name="confirm"\s+value="([^"]+)"/i)?.[1] || 't';
  const filename =
    html.match(/uc-name-size">\s*<a[^>]*>([^<]+)<\/a>/i)?.[1]?.trim() ||
    html.match(/<a[^>]*href="\/open\?id=[^"]*"[^>]*>([^<]+)<\/a>/i)?.[1]?.trim() ||
    null;
  return { uuid, confirm, filename };
}

export function filenameFromDisposition(disposition) {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]).trim();
    } catch { /* segue */ }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

export function inferMime(filename, fallback = 'video/mp4') {
  if (!filename) return fallback;
  const ext = String(filename).toLowerCase().split('.').pop();
  const map = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
    mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
    ts: 'video/mp2t', m2ts: 'video/mp2t', mpg: 'video/mpeg', mpeg: 'video/mpeg',
    wmv: 'video/x-ms-wmv', flv: 'video/x-flv', '3gp': 'video/3gpp',
  };
  return map[ext] || fallback;
}

function detectWallError(html) {
  if (/quota exceeded|too many users|download quota/i.test(html)) {
    return new HttpError(429, 'Google Drive: cota de download excedida para este arquivo (tente mais tarde)');
  }
  if (/you need access|request access|sign in to continue/i.test(html)) {
    return new HttpError(403, 'Google Drive: arquivo exige autenticação/autorização');
  }
  return null;
}

/**
 * Resolve o "ticket" (URL final reproduzível) de um arquivo.
 * Cacheia por 8 min; renova automaticamente quando expira.
 */
export async function resolveTicket(fileId, env = {}) {
  const key = `ticket:${fileId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const origin = gdriveOrigin(env);
  const probeUrl = `${origin}/download?id=${encodeURIComponent(fileId)}&export=download`;
  const res = await fetch(probeUrl, {
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
    redirect: 'follow',
    signal: timeoutSignal(),
  });

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    const html = await res.text();
    const { uuid, confirm, filename } = parseWall(html);
    if (!uuid) {
      const err = detectWallError(html);
      throw err || new HttpError(502, 'Google Drive: não foi possível extrair o token (uuid) do muro de confirmação');
    }
    const ticket = {
      fileId,
      url: `${origin}/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${encodeURIComponent(confirm)}&uuid=${encodeURIComponent(uuid)}`,
      filename,
      via: 'uuid',
    };
    cacheSet(key, ticket, TICKET_TTL_MS);
    return ticket;
  }

  // Arquivo pequeno / sem muro: a própria URL já é o stream.
  const filename = filenameFromDisposition(res.headers.get('content-disposition'));
  try { await res.body?.cancel(); } catch { /* ignora */ }
  const ticket = { fileId, url: probeUrl, filename, via: 'direct' };
  cacheSet(key, ticket, TICKET_TTL_MS);
  return ticket;
}

export function invalidateTicket(fileId) {
  cacheDelete(`ticket:${fileId}`);
}

function isHtmlResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml');
}

async function fetchMedia(ticket, { range = null, method = 'GET' } = {}) {
  const headers = { 'User-Agent': BROWSER_UA, Accept: '*/*' };
  if (range) headers.Range = range;
  return fetch(ticket.url, {
    method,
    headers,
    redirect: 'follow',
    signal: timeoutSignal(),
  });
}

/**
 * Abre o stream de mídia do Drive já tratando o muro:
 * se a resposta vier HTML (ticket expirado), renova UMA vez.
 * Retorna { res, ticket }.
 */
export async function openFile(fileId, opts = {}, env = {}) {
  if (!FILE_ID_RE.test(fileId)) throw new HttpError(400, 'ID do Google Drive inválido');
  let ticket = await resolveTicket(fileId, env);
  let res = await fetchMedia(ticket, opts);

  if (isHtmlResponse(res)) {
    try { await res.body?.cancel(); } catch { /* ignora */ }
    invalidateTicket(fileId);
    ticket = await resolveTicket(fileId, env);
    res = await fetchMedia(ticket, opts);
    if (isHtmlResponse(res)) {
      const html = await res.text().catch(() => '');
      const err = detectWallError(html);
      throw err || new HttpError(502, 'Google Drive retornou HTML em vez de mídia (ticket recusado)');
    }
  }
  return { res, ticket };
}

/** Descobre o tamanho total do arquivo com um probe barato (bytes=0-0). */
export async function probeSize(fileId, env = {}) {
  const key = `size:${fileId}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const { res } = await openFile(fileId, { range: 'bytes=0-0' }, env);
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+|\*)$/);
  let total = m && m[1] !== '*' ? parseInt(m[1], 10) : null;
  if (total == null) {
    const cl = res.headers.get('content-length');
    if (cl && res.status === 200) total = parseInt(cl, 10);
  }
  try { await res.body?.cancel(); } catch { /* ignora */ }
  if (total != null) cacheSet(key, total, TICKET_TTL_MS);
  return total;
}
