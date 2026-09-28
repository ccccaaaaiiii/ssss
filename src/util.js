// src/util.js — helpers Web (roda em Workers/Edge/Node ≥18, zero dependências)

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const ORIGIN_TIMEOUT_MS = 20000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...headers,
    },
  });
}

export function text(body, status = 200, contentType = 'text/plain; charset=utf-8', headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType, 'access-control-allow-origin': '*', ...headers },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': 'Range, Content-Type, Accept, Origin, Referer, User-Agent',
      'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'access-control-max-age': '86400',
    },
  });
}

export function timeoutSignal(ms = ORIGIN_TIMEOUT_MS) {
  return AbortSignal.timeout(ms);
}

export function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Normaliza URL absoluta a partir do request (ou PUBLIC_BASE_URL do ambiente). */
export function baseUrl(request, env = {}) {
  if (env.PUBLIC_BASE_URL) return String(env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  return new URL(request.url).origin;
}
