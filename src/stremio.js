// src/stremio.js — Construtores do protocolo Stremio (manifest/catalog/meta/stream)

import { ALIASES } from './xscan.js';

export const CATALOG_ID = 'mcso_x';

export function buildManifest() {
  return {
    id: 'community.mcso.drive',
    version: '2.0.0',
    name: 'MCSO Drive',
    description:
      'Vídeos do perfil X @monroesheriffny hospedados no Google Drive, servidos como stream HTTP compatível com Smart TVs (proxy normalizado com Range 206 garantido).',
    resources: ['catalog', 'meta', 'stream'],
    types: ['other', 'movie'],
    catalogs: [
      { type: 'other', id: CATALOG_ID, name: 'MCSO — X Profile (Drive)' },
      { type: 'movie', id: CATALOG_ID, name: 'MCSO — X Profile (Drive)' },
    ],
    idPrefixes: ['mcso_', 'drive_'],
    behaviorHints: { adult: false, configurable: false },
  };
}

export function buildCatalog(items, type) {
  return {
    metas: items.map((it) => ({
      id: it.id,
      type,
      name: it.name,
      poster: it.poster,
      posterShape: 'poster',
      background: it.poster,
      description: it.description || undefined,
      releaseDate: it.released || undefined,
    })),
  };
}

export function buildMeta(item, type) {
  return {
    meta: {
      id: item.id,
      type,
      name: item.name,
      poster: item.poster,
      posterShape: 'poster',
      background: item.poster,
      description: item.description || `Google Drive — ${item.fileId}`,
      releaseDate: item.released || undefined,
      genres: ['Documentary'],
      runtime: undefined,
      behaviorHints: { bingeGroup: 'mcso-drive' },
    },
  };
}

export function buildStreams(base, item) {
  const fileId = item.fileId;
  const mp4 = `${base}/drive/${fileId}/video.mp4`;
  const hls = `${base}/hls/${fileId}/index.m3u8`;
  return {
    streams: [
      {
        name: 'MCSO Drive [MP4+]',
        title: `${item.name}\nProxy normalizado — 206/Range garantido (Stremio/TV)`,
        url: mp4,
        behaviorHints: { bingeGroup: 'mcso-drive', notWebReady: false },
      },
      {
        name: 'MCSO Drive [HLS]',
        title: `${item.name}\nHLS por byte-range (m3u8)`,
        url: hls,
        behaviorHints: { bingeGroup: 'mcso-drive', notWebReady: false },
      },
    ],
  };
}

/** Resolve um id (drive_XXX / mcso_alias) para um item completo. */
export function itemFromId(id, scanItems = []) {
  if (typeof id !== 'string' || !id) return null;

  if (id.startsWith('drive_')) {
    const fileId = id.slice('drive_'.length);
    const found = scanItems.find((i) => i.fileId === fileId);
    return (
      found || {
        id,
        fileId,
        name: `MCSO Drive ${fileId.slice(0, 8)}`,
        description: '',
        poster: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      }
    );
  }

  const fileId = ALIASES[id] || scanItems.find((i) => i.id === id)?.fileId;
  if (!fileId) return null;
  const found = scanItems.find((i) => i.fileId === fileId);
  return (
    found || {
      id: `drive_${fileId}`,
      fileId,
      name: id === 'mcso_natural_2018' ? 'NATURAL (MCSO 2018)' : `MCSO Drive ${fileId.slice(0, 8)}`,
      description: '',
      poster: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
    }
  );
}
