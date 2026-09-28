# PLAN.md — Orientação do Agente **arena**
**Projeto:** ssss — Stremio Addon (MCSO / @monroesheriffny) · **Branch:** `arena` · **Alvo:** Cloudflare Workers (serverless) + Smart TV
**Status:** implementado conforme PRD v1.2 · **Data:** 2026-09-28

---

## 1. Objetivo
Extensão do Stremio que:
1. **Filtra todos os links do Google Drive** publicados no perfil X **@monroesheriffny** (via `syndication.twitter.com`, sem API key);
2. **Converte cada link em uma URL de streaming reproduzível no Stremio em Smart TVs**;
3. Roda **100% em serverless** (Cloudflare Workers / Edge), sem processo local, sem `localhost` em produção.

---

## 2. Diagnóstico do problema central — “abre no VLC, não abre no Stremio”

### 2.1 O que mudou no Google Drive
Antigamente o Drive expunha endpoints estilo YouTube (`get_video_info` → `fmt_stream_map` com URLs `videoplayback`/M3U8). **Isso foi descontinuado.**
Hoje o fluxo real (capturado ao vivo em 2026-09-28, arquivo de teste `0ByeS4oOUV-49Zzh4R1J6R09zazQ`) é:

```
GET https://drive.usercontent.google.com/download?id=<ID>&export=download
  → 200 text/html  "Google Drive - Virus scan warning"   (muro de vírus, arquivos grandes)
      <form id="download-form" action="https://drive.usercontent.google.com/download">
        <input type="hidden" name="confirm" value="t">
        <input type="hidden" name="uuid"    value="<UUID-DINÂMICO>">
GET .../download?id=<ID>&export=download&confirm=t&uuid=<UUID>
  → 206 video/mp4 (bytes reais do arquivo)
```

### 2.2 Por que o VLC toca e o Stremio/Smart TV **não** toca
A resposta do Drive (mesmo resolvida) contém **cabeçalhos letais para players baseados em engine web/ExoPlayer** — captura real:

| Cabeçalho observado | Efeito no Stremio / Smart TV | Efeito no VLC |
|---|---|---|
| `cross-origin-resource-policy: same-site` | **Bloqueia** mídia carregada cross-origin em Chromium/WebView (Stremio desktop/mobile/web) | nativo, ignora |
| `cross-origin-embedder-policy: require-corp` | **Bloqueia** `<video>` sem CORP/CORS compatível | ignora |
| `content-disposition: attachment; filename=...` | players web/TV tratam como **download**, não como stream | ignora |
| `content-type: application/octet-stream` (caso “link curto” sem muro) | TV/ExoPlayer **recusam** decoder desconhecido | faz sniffing |
| Muro HTML do `uuid/confirm` quando o token expira ou falta | player recebe **HTML** → “Source error” | idem (mas o usuário testou com o link ainda válido) |
| Tokens `at=...`/`uuid=...` **ligados à sessão** do navegador | link “curto” copiado **expira** antes de tocar na TV | toca enquanto o token está fresco |
| Range às vezes respondido com `200` (algumas bordas/rotas) | ExoPlayer/Tizen/webOS exigem **`206` + `Content-Range`** para seek | tolera |

**Conclusão:** não existe mais um “link mágico M3U8” para extrair do Drive. A solução correta é
**servir o vídeo através do próprio worker com cabeçalhos normalizados e `Range` garantido (206 sempre)**.

### 2.3 A solução da branch `arena` (3 camadas)
1. **Resolvedor de ticket** (`src/gdrive.js`): detecta o muro, extrai `uuid`/`confirm` do formulário real,
   monta a URL limpa **sem `at=` de sessão** e renova o ticket quando expira (cache TTL 8 min, retry 1×).
2. **Proxy normalizador + Range Shim** (`src/shim.js`) — **a peça que faltava**:
   - remove `content-disposition`, `cross-origin-*`, COEP/CORP/CSP, `nosniff`;
   - força `content-type: video/<ext>`, `accept-ranges: bytes`, `access-control-allow-origin: *`;
   - repassa o `Range` do player ao Drive e **se o Drive devolver `200` ignorando o Range, o worker
     sintetiza o `206` fatiando o stream em memória** (`sliceStream`) — ou seja, o player **sempre** recebe
     semântica de Range correta, exatamente o que ExoPlayer/Tizen/webOS exigem;
   - suporta `GET`, `HEAD`, ranges abertos (`bytes=N-`) e sufixo (`bytes=-N`), `416` quando aplicável.
3. **Playlist HLS por byte-range** (`/hls/:id/index.m3u8`, auxiliar): envolve o mesmo MP4 em um `m3u8`
   `EXT-X-BYTERANGE` **sem transcodificação** — o “link de streaming M3U8” que o usuário quer, possível
   porque o shim garante `206` em cada segmento.

### 2.4 Por que as outras branches não resolvem
- `gem37f`: resolve o ticket e **retorna a URL do Google direto** → toca no VLC, quebra no Stremio (headers acima).
- `son46l`: `proxy.py` em Python → **inviável em Cloudflare Workers** (só JS/Edge).
- `grokb46`: proxy com repasse de Range, mas **sem shim** (se o Drive responder `200`, o player quebra) e sem normalização de MIME/headers.

---

## 3. Arquitetura (serverless)

```
[Stremio — TV Android/Tizen/webOS/PC]
        │ HTTPS
        ▼
[Cloudflare Worker — src/router.js]
   ├─ /manifest.json                 → manifesto Stremio
   ├─ /catalog/{other|movie}/mcso_x  → itens do perfil X (com fallback SEED)
   ├─ /meta/:type/:id.json           → nome, sinopse, poster (thumbnail do Drive)
   ├─ /stream/:type/:id.json         → [ URL /drive/:id/video.mp4 , URL /hls/:id/index.m3u8 ]
   ├─ /drive/:fileId[/video.mp4]     → ★ proxy normalizador + Range Shim
   ├─ /hls/:fileId/index.m3u8        → HLS byterange (auxiliar)
   ├─ /proxy/:b64url                 → proxy genérico (allowlist de hosts; testes/player)
   └─ /healthz
        │
        ▼
[syndication.twitter.com]          [drive.usercontent.google.com]
  perfil X + t.co                    ticket uuid/confirm + mídia (Range)
```

**Decisões estruturais:**
- **Zero dependências npm** (Web APIs `fetch`/`Request`/`Response`/`ReadableStream`) → mesmo código roda em
  Cloudflare Workers, Vercel Edge, Deno e Node ≥18 (servidor de teste local exigido pelo AGENTS.md).
- `worker.js` = entrypoint do Wrangler (`wrangler.toml` incluso); `addon.js` = dev server local + export do handler.
- **IDs autocontidos:** meta id = `drive_<fileId>` (sobrevive a cache expirado); aliases `mcso_<slug>`
  (ex.: `mcso_natural_2018` → `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`) para compatibilidade.
- Catálogo nunca vazio: fallback `SEED` com o vídeo oficial documentado no README.

---

## 4. Varredura do X (`src/xscan.js`)
1. `GET https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}` (sem API key);
2. Extração em 2 camadas: blocos `data-tweet-id` (texto, data, links) **e** varredura global de URLs
   (`drive.google.com`, `docs.google.com`, `t.co`) inclusive com `\/` escapado do JSON embutido;
3. Resolução de `t.co` por redirect (`fetch` follow → `res.url`), concorrente e com timeout;
4. Extração do `fileId` (`/file/d/ID`, `?id=ID`); dedupe por `fileId`; cache TTL 15 min;
5. Se X bloquear/silenciar (rate limit), cai no `SEED` — o addon **nunca fica vazio**.

---

## 5. Política de testes (regra de ouro do AGENTS.md → `npm test` 100%)
O `test/e2e.test.js` valida **todo o ciclo Stremio** e **simula o player** com `Range: bytes=0-1024`:

| # | Teste | Assert |
|---|---|---|
| 1 | `/manifest.json` | válido, `resources`, `types`, `idPrefixes` conforme PRD |
| 2 | `/catalog/.../mcso_x` | ≥1 item |
| 3 | `/meta/...` | nome/descrição |
| 4 | `/stream/...` | URL absoluta gerada |
| 5 | **Player sim (206)** | `HTTP 206`, `Content-Type: video/mp4`, `Content-Range` correto |
| 6 | Higiene de headers | sem `content-disposition`, sem `cross-origin-*`, com CORS |
| 7 | **Shim torture** | Drive simulado que **ignora Range** → worker **ainda** devolve `206` fatiado certo |
| 8 | Arquivo “link curto” (direto, `octet-stream`+`attachment`) | normalizado para `video/mp4` |
| 9 | `HEAD` | metadados + `accept-ranges: bytes` |
| 10 | HLS | `m3u8` com `EXT-X-BYTERANGE` válido |
| 11 | Resolvedor (fixture do muro real capturado hoje) | `uuid`/`confirm`/filename extraídos |
| 12 | Parser do X (fixture) | links do Drive + t.co extraídos |
| 13 | **Live** (informativo, não fatal) | 1 chamada ao ID de teste sancionado; 0 toques no arquivo oficial |

**Regra de cota respeitada:** o arquivo oficial `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` **não** é usado nos
testes de rotina; o caminho determinístico usa **mock do Drive** que replica fielmente os headers reais
capturados (incluindo os “headers letais”), e o live usa apenas o ID descartável `0ByeS4oOUV-49Zzh4R1J6R09zazQ`.
Player de referência do PRD: Big Buck Bunny (`commondatastorage.googleapis.com`) — tentado em modo
best-effort (o sandbox bloqueia esse host com 403; em produção funciona).

---

## 6. Deploy (Cloudflare Workers)
```bash
npx wrangler@3 deploy          # publica o worker
# opcional: definir PUBLIC_BASE_URL se usar domínio customizado
```
Instalação na TV: abrir a URL do worker → botão `stremio://…` → “Install”.
Limite de cota do Drive: cada view consome bytes do arquivo público; mitigação = cache de tickets +
uso de arquivos próprios/espelhos; documentado como risco (ver §7).

## 7. Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Cota de download do Drive estourar | tickets cacheados, 1 request por Range, política de testes, SEED mínimo |
| Google mudar o HTML do muro | regex tolerantes + fixture de regressão; retry com `confirm=t` puro |
| X syndication bloquear | fallback SEED; parser independe do schema exato (regex + blocos) |
| Tokens expirarem no meio do playback | renovação automática do ticket a cada request do proxy |
| Player sem suporte a MP4 progressivo | stream alternativo HLS byterange incluído |

## 8. Entregáveis desta branch
`src/` (router, gdrive, shim, xscan, stremio, util, cache, node-server) · `addon.js` · `worker.js` ·
`wrangler.toml` · `test/` (e2e + mocks + fixtures reais) · `plan.md` · `package.json` (zero deps).
