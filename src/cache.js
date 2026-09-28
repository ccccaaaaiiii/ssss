// src/cache.js — cache em memória com TTL (por isolate). Em Workers pode ser
// substituído por KV/Cache API via env sem mudar o restante do código.

const store = new Map();

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires && hit.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = 10 * 60 * 1000) {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function cacheDelete(key) {
  store.delete(key);
}

export function cacheClear() {
  store.clear();
}
