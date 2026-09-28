// test/e2e.test.js — Protocolo de testes obrigatório (AGENTS.md §2)
//
// Simula ponta a ponta o ciclo de vida do Stremio e o player de vídeo (Range 206),
// SEM GUI e sem queimar cota do Google Drive:
//   - mock do Drive fiel ao comportamento real (muro uuid + headers letais)
//   - mock do syndication do X (fixture)
//   - teste LIVE apenas informativo com o ID descartável sancionado
//
// Regra de ouro: este script deve passar com 100% de sucesso (`npm test`).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { startServer } from '../src/node-server.js';
import { startMockDrive, buildMedia, MEDIA_SIZE } from './mock-drive.js';
import { parseWall, extractFileId, filenameFromDisposition } from '../src/gdrive.js';
import { extractUrls, extractTweetBlocks } from '../src/xscan.js';
import { base64urlEncode } from '../src/util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------
let passed = 0;
const t = (label) => console.log(`\n[TEST] ${label}`);
const ok = (msg) => { passed++; console.log(`    ✅ ${msg}`); };

async function getJson(url) {
  const res = await fetch(url);
  const data = JSON.parse(await res.text());
  return { status: res.status, data, headers: res.headers };
}

async function getRange(url, range, method = 'GET') {
  const res = await fetch(url, { method, headers: range ? { Range: range } : {} });
  const buf = method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, body: buf };
}

function startFixtureSyndication({ fixtureHtml }) {
  const tcoMap = {
    '/tco/AAA111link': 'https://drive.google.com/file/d/FILEIDNATURAL2018/view?usp=sharing',
    '/tco/BBB222link': 'https://drive.google.com/file/d/FILEIDPATROL9999/view?usp=sharing',
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname.startsWith('/srv/timeline-profile/')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
      return;
    }
    if (u.pathname.startsWith('/tco/') && tcoMap[u.pathname]) {
      res.writeHead(302, { location: tcoMap[u.pathname] });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

// ---------------------------------------------------------------------------
// bateria principal
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== INICIANDO TESTE END-TO-END DO ADDON STREMIO (branch arena) ===\n');

  const media = buildMedia();
  const fixtureHtml = readFileSync(join(__dirname, 'fixtures', 'syndication-sample.html'), 'utf8');
  const wallFixture = readFileSync(join(__dirname, 'fixtures', 'drive-wall-real.html'), 'utf8');

  // 0. mocks + servidor do addon (env apontando para os mocks — determinístico)
  const mockDrive = await startMockDrive({ media });
  const mockSynd = await startFixtureSyndication({ fixtureHtml });
  const env = {
    GDRIVE_ORIGIN: mockDrive.origin,
    SYNDICATION_ORIGIN: mockSynd.origin,
    TCO_ORIGIN: `${mockSynd.origin}/tco`,
  };
  const { server, url: base } = await startServer({ port: 0, host: '127.0.0.1', env });
  console.log(`[0] Mock Drive:   ${mockDrive.origin}`);
  console.log(`[0] Mock X:       ${mockSynd.origin}`);
  console.log(`[0] Addon Stremio: ${base}`);

  try {
    // -----------------------------------------------------------------
    t('[1] /manifest.json — manifesto válido conforme PRD');
    {
      const { status, data } = await getJson(`${base}/manifest.json`);
      assert.equal(status, 200);
      assert.ok(data.id, 'manifest.id');
      assert.ok(data.name, 'manifest.name');
      for (const r of ['catalog', 'meta', 'stream']) assert.ok(data.resources.includes(r), `resource ${r}`);
      for (const ty of ['other', 'movie']) assert.ok(data.types.includes(ty), `type ${ty}`);
      for (const p of ['mcso_', 'drive_']) assert.ok(data.idPrefixes.includes(p), `idPrefix ${p}`);
      assert.ok(Array.isArray(data.catalogs) && data.catalogs.length >= 1);
      ok(`manifesto válido — id=${data.id} v${data.version} resources=${data.resources.join(',')}`);
    }

    // -----------------------------------------------------------------
    t('[2] /catalog — itens do perfil X listados (links do Drive filtrados)');
    let firstId = null;
    {
      const { status, data } = await getJson(`${base}/catalog/other/mcso_x.json`);
      assert.equal(status, 200);
      assert.ok(Array.isArray(data.metas) && data.metas.length >= 1, 'catálogo não vazio');
      firstId = data.metas[0].id;
      assert.ok(firstId.startsWith('mcso_') || firstId.startsWith('drive_'), 'prefixo de id');
      const ids = data.metas.map((m) => m.id).join(', ');
      ok(`catálogo com ${data.metas.length} itens: ${ids}`);
      const { data: movieCat } = await getJson(`${base}/catalog/movie/mcso_x.json`);
      assert.ok(movieCat.metas.length >= 1, 'catálogo movie também populado');
      ok('catálogo type=movie também disponível');
    }

    // -----------------------------------------------------------------
    t('[3] /meta — metadados (nome, sinopse, poster)');
    {
      const { status, data } = await getJson(`${base}/meta/other/drive_FILEIDNATURAL2018.json`);
      assert.equal(status, 200);
      assert.ok(data.meta.name, 'meta.name');
      assert.ok(data.meta.name.includes('NATURAL'), 'título do tweet presente');
      assert.ok(data.meta.poster && data.meta.poster.includes('FILEIDNATURAL2018'), 'poster');
      ok(`meta ok — "${data.meta.name}"`);
    }
    {
      // alias legado (compatibilidade com branch gem37f)
      const { status, data } = await getJson(`${base}/meta/movie/mcso_natural_2018.json`);
      assert.equal(status, 200);
      assert.equal(data.meta.name, 'NATURAL (MCSO 2018)');
      ok('alias mcso_natural_2018 → arquivo oficial resolvido');
    }

    // -----------------------------------------------------------------
    t('[4] /stream — URL de streaming gerada');
    let streamUrl = null;
    {
      const { status, data } = await getJson(`${base}/stream/other/drive_FILEIDNATURAL2018.json`);
      assert.equal(status, 200);
      assert.ok(Array.isArray(data.streams) && data.streams.length >= 1);
      streamUrl = data.streams[0].url;
      assert.ok(/^https?:\/\//.test(streamUrl), 'URL absoluta');
      assert.ok(streamUrl.includes('/drive/FILEIDNATURAL2018/'), 'URL aponta para o proxy do Drive');
      assert.ok(data.streams.some((s) => s.url.endsWith('.m3u8')), 'stream alternativo HLS presente');
      ok(`stream URL: ${streamUrl}`);
    }

    // -----------------------------------------------------------------
    t('[5] ★ SIMULAÇÃO DO PLAYER (Range: bytes=0-1024 → HTTP 206)');
    {
      const r = await getRange(streamUrl, 'bytes=0-1024');
      assert.equal(r.status, 206, `esperado 206, veio ${r.status}`);
      assert.ok((r.headers.get('content-type') || '').includes('video'), 'content-type de vídeo');
      const cr = r.headers.get('content-range') || '';
      assert.ok(cr.startsWith('bytes 0-1024/'), `content-range correto (${cr})`);
      assert.equal(r.body.length, 1025, 'chunk com 1025 bytes');
      ok(`HTTP 206 · ${r.headers.get('content-type')} · ${cr} · ${r.body.length} bytes`);
    }

    // -----------------------------------------------------------------
    t('[6] Higiene de headers (o que quebrava o Stremio/TV)');
    {
      const r = await getRange(streamUrl, 'bytes=0-0');
      assert.equal(r.status, 206);
      assert.equal(r.headers.get('content-disposition'), null, 'content-disposition removido');
      assert.equal(r.headers.get('cross-origin-resource-policy'), null, 'CORP removido');
      assert.equal(r.headers.get('cross-origin-embedder-policy'), null, 'COEP removido');
      assert.equal(r.headers.get('accept-ranges'), 'bytes', 'accept-ranges presente');
      assert.equal(r.headers.get('access-control-allow-origin'), '*', 'CORS liberado');
      ok('sem attachment/CORP/COEP · accept-ranges=bytes · CORS=*');
    }

    // -----------------------------------------------------------------
    t('[7] ★ RANGE SHIM — origin IGNORANDO o Range (o player recebe 206 mesmo assim)');
    {
      // file id com sufixo RANGEIGN → mock responde 200 cheio, sem Content-Range
      const url = `${base}/drive/MOCKRANGEIGNFILE01/video.mp4`;
      const r = await getRange(url, 'bytes=100-199');
      assert.equal(r.status, 206, `shim deve sintetizar 206 (veio ${r.status})`);
      const cr = r.headers.get('content-range') || '';
      assert.equal(cr, `bytes 100-199/${MEDIA_SIZE}`, `content-range fatiado (${cr})`);
      assert.equal(r.body.length, 100);
      for (let i = 0; i < 100; i++) {
        assert.equal(r.body[i], (100 + i) & 0xff, `byte ${100 + i} do slice confere`);
      }
      ok(`206 sintetizado fatiando o stream: ${cr} · 100 bytes exatos`);
    }

    // -----------------------------------------------------------------
    t('[8] Range aberto (bytes=N-) e sufixo (bytes=-N)');
    {
      const url = `${base}/drive/MOCKRANGEIGNFILE01/video.mp4`;
      const open = await getRange(url, `bytes=${MEDIA_SIZE - 10}-`);
      assert.equal(open.status, 206);
      assert.equal(open.body.length, 10, '10 bytes finais');
      const suffix = await getRange(url, 'bytes=-100');
      assert.equal(suffix.status, 206);
      assert.equal(suffix.headers.get('content-range'), `bytes ${MEDIA_SIZE - 100}-${MEDIA_SIZE - 1}/${MEDIA_SIZE}`);
      assert.equal(suffix.body.length, 100);
      ok('range aberto e por sufixo funcionando');
    }

    // -----------------------------------------------------------------
    t('[9] Range insatisfazível → HTTP 416 com bytes */total');
    {
      const r = await getRange(`${base}/drive/MOCKRANGEIGNFILE01/video.mp4`, 'bytes=3000000-3000001');
      assert.equal(r.status, 416);
      assert.equal(r.headers.get('content-range'), `bytes */${MEDIA_SIZE}`);
      ok('416 correto');
    }

    // -----------------------------------------------------------------
    t('[10] "Link curto" direto (octet-stream + attachment) → normalizado');
    {
      const url = `${base}/drive/MOCKDIRECTFILE00001/video.mp4`;
      const r = await getRange(url, 'bytes=0-99');
      assert.equal(r.status, 206);
      assert.ok((r.headers.get('content-type') || '').includes('video'), 'MIME normalizado para vídeo');
      assert.ok(!(r.headers.get('content-type') || '').includes('octet-stream'), 'octet-stream substituído');
      assert.equal(r.headers.get('content-disposition'), null, 'attachment removido');
      assert.equal(r.body.length, 100);
      ok(`octet-stream+attachment → ${r.headers.get('content-type')} · sem attachment · 206`);
    }

    // -----------------------------------------------------------------
    t('[11] HEAD — metadados para players que sondam antes de tocar');
    {
      const r = await getRange(streamUrl, null, 'HEAD');
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('accept-ranges'), 'bytes');
      assert.equal(r.headers.get('content-length'), String(MEDIA_SIZE), 'tamanho total');
      ok(`HEAD 200 · accept-ranges=bytes · content-length=${MEDIA_SIZE}`);
    }

    // -----------------------------------------------------------------
    t('[12] HLS por byte-range (o "link M3U8" gerado sem transcodificar)');
    {
      const res = await fetch(`${base}/hls/FILEIDNATURAL2018/index.m3u8`);
      const body = await res.text();
      assert.equal(res.status, 200);
      assert.ok(body.startsWith('#EXTM3U'), 'playlist m3u8 válida');
      assert.ok(body.includes('#EXT-X-BYTERANGE:'), 'segmentos por byte-range');
      assert.ok(body.includes('#EXT-X-ENDLIST'), 'VOD completo');
      assert.ok(body.includes('/drive/FILEIDNATURAL2018/video.mp4'), 'segmentos apontam para o proxy');
      const totalBytes = [...body.matchAll(/#EXT-X-BYTERANGE:(\d+)@/g)].reduce((s, m) => s + parseInt(m[1], 10), 0);
      assert.equal(totalBytes, MEDIA_SIZE, 'segmentos cobrem o arquivo inteiro');
      ok(`m3u8 com ${[...body.matchAll(/#EXT-X-BYTERANGE:/g)].length} segmentos somando ${totalBytes} bytes`);
    }

    // -----------------------------------------------------------------
    t('[13] Resolvedor — fixture do muro REAL do Google Drive (capturado em produção)');
    {
      const { uuid, confirm, filename } = parseWall(wallFixture);
      assert.equal(uuid, 'cf3e4a3b-18e7-468e-9c64-26a1e5a96d58', 'uuid extraído do form real');
      assert.equal(confirm, 't');
      assert.equal(filename, 'Big Buck Bunny.mp4', 'filename extraído');
      ok(`uuid=${uuid.slice(0, 8)}… · confirm=${confirm} · filename="${filename}"`);
    }

    // -----------------------------------------------------------------
    t('[14] Parser do X — extração de links do Drive e t.co (fixture)');
    {
      const { drive, tco } = extractUrls(fixtureHtml);
      assert.ok(drive.some((u) => u.includes('FILEIDPATROL9999')), 'link direto do Drive');
      assert.ok(drive.some((u) => u.includes('FILEIDARCHIVE7777')), 'link docs.google.com');
      assert.ok(drive.some((u) => u.includes('FILEIDNATURAL2018')), 'expanded_url do JSON embutido');
      assert.ok(tco.length >= 2, 'links t.co');
      const blocks = extractTweetBlocks(fixtureHtml);
      assert.equal(blocks.length, 3, '3 tweets extraídos');
      ok(`${drive.length} links do Drive · ${tco.length} t.co · ${blocks.length} tweets`);
    }

    // -----------------------------------------------------------------
    t('[15] extractFileId — todas as formas de link do Drive');
    {
      const cases = [
        ['1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z', '1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z'],
        ['https://drive.google.com/file/d/FILEIDNATURAL2018/view?usp=sharing', 'FILEIDNATURAL2018'],
        ['https://drive.google.com/uc?id=FILEIDARCHIVE7777&export=download', 'FILEIDARCHIVE7777'],
        ['https://drive.usercontent.google.com/download?id=FILEIDPATROL9999&export=download', 'FILEIDPATROL9999'],
        ['https://example.com/file/d/NOPE123456789/view', null],
      ];
      for (const [input, expected] of cases) {
        assert.equal(extractFileId(input), expected, `extractFileId(${input.slice(0, 40)})`);
      }
      const fn = filenameFromDisposition('attachment; filename="NATURAL (MCSO 2018).mp4"');
      assert.equal(fn, 'NATURAL (MCSO 2018).mp4');
      ok('todas as formas de URL reconhecidas');
    }

    // -----------------------------------------------------------------
    t('[16] LIVE (informativo, não falha o teste) — ID descartável sancionado no Drive real');
    try {
      const probe = await fetch(
        'https://drive.usercontent.google.com/download?id=0ByeS4oOUV-49Zzh4R1J6R09zazQ&export=download',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }
      );
      const html = await probe.text();
      const { uuid, confirm } = parseWall(html);
      if (!uuid) throw new Error('sem uuid (comportamento do Drive mudou?)');
      const live = await fetch(
        `https://drive.usercontent.google.com/download?id=0ByeS4oOUV-49Zzh4R1J6R09zazQ&export=download&confirm=${confirm}&uuid=${uuid}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(15000) }
      );
      const ct = live.headers.get('content-type') || '';
      if (live.status === 206 && ct.includes('video')) {
        ok(`LIVE: fluxo uuid→206 comprovado ao vivo (${ct}, ${live.headers.get('content-range')})`);
        await live.body?.cancel();
      } else {
        console.log(`    ⚠️ LIVE: resposta inesperada (${live.status}/${ct}) — não fatal, mocks cobriram a lógica`);
      }
    } catch (err) {
      console.log(`    ⚠️ LIVE pulado (${err.message}) — não fatal, mocks cobriram a lógica`);
    }

    // -----------------------------------------------------------------
    t('[17] LIVE player — samplelib via proxy (★ shim contra origin real que ignora Range)');
    try {
      // Link de teste canônico (master): https://samplelib.com/mp4/sample-5s.mp4
      // O samplelib responde 200 + arquivo inteiro MESMO com Range — o shim deve
      // sintetizar o 206 exatamente como faria com o "link curto" do Drive.
      const target = 'https://samplelib.com/mp4/sample-5s.mp4';
      const b64 = base64urlEncode(target);
      const r = await getRange(`${base}/proxy/${b64}`, 'bytes=0-1024');
      if (r.status === 206 && (r.headers.get('content-type') || '').includes('video')) {
        assert.match(r.headers.get('content-range') || '', /^bytes 0-1024\/\d+$/, 'content-range sintetizado');
        assert.equal(r.body.length, 1025);
        ok(`LIVE: samplelib 200-ignorando-Range → shim devolveu 206 · ${r.headers.get('content-range')}`);
      } else {
        console.log(`    ⚠️ LIVE samplelib: resposta inesperada (${r.status}) — não fatal, mocks cobriram a lógica`);
      }
    } catch (err) {
      console.log(`    ⚠️ LIVE samplelib pulado (${err.message}) — não fatal, mocks cobriram a lógica`);
    }

    console.log('\n==================================================');
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log(`==================================================  (${passed} asserções verdes)`);
  } finally {
    server.close();
    mockDrive.server.close();
    mockSynd.server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
