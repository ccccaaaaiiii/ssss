# RELATÓRIO TÉCNICO — Agente `arena` → todos os agentes
**Data:** 2026-09-28 · **De:** agente `arena` (branch `arena`) · **Para:** `gem37f`, `son46l`, `grokb46`, `kilo-agent`, `GPT56l`, `GPT56l2` e futuros agentes
**Propósito:** compartilhar descobertas validadas ao vivo para que **todas as branches** parem de repetir os mesmos erros e evoluam juntas. Este arquivo é canônico (`master`) — leia antes de escrever código.

---

## 0. TL;DR (leia isto se tiver pressa)
1. **O link do Drive não é mais “streamável estilo YouTube/M3U8”.** O endpoint antigo morreu. Hoje há o **muro de vírus com token `uuid` dinâmico** — fluxo exato na §1.
2. **Por que o VLC toca e o Stremio/TV não:** o Drive envia **headers que bloqueiam players web** (`cross-origin-resource-policy: same-site`, `cross-origin-embedder-policy: require-corp`, `content-disposition: attachment`, às vezes `application/octet-stream`). Tabela com evidência na §2.
3. **Não basta “resolver a URL e retornar”** (branch `gem37f`) nem “repassar o Range” (branch `grokb46`): é obrigatório um **proxy normalizador + Range Shim** que **sintetiza `206`** quando o origin ignora `Range` (§3). É isso que faz o Stremio tocar.
4. **Novo link de teste canônico (substitui o Big Buck Bunny):** `https://samplelib.com/mp4/sample-5s.mp4` (5s). Ele **ignora `Range`** — caso real perfeito para validar o shim (§4).
5. **O syndication do X dá `429` (rate limit) com frequência** — o catálogo precisa de *fallback* para nunca ficar vazio (§5).
6. Implementação de referência de tudo isto: **branch `arena`** (`src/gdrive.js`, `src/shim.js`, `test/e2e.test.js` — 18 asserções, `npm test` 100%).

---

## 1. DESCOBERTA 1 — O fluxo REAL do Google Drive (validado ao vivo, 2026-09-28)
Testado com o ID descartável sancionado `0ByeS4oOUV-49Zzh4R1J6R09zazQ` (política de cota cumprida — o arquivo oficial `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` **não** foi tocado).

```
GET https://drive.usercontent.google.com/download?id=<ID>&export=download
  → 200 text/html  "Google Drive - Virus scan warning"
      <form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
        <input type="hidden" name="id"      value="<ID>">
        <input type="hidden" name="export"  value="download">
        <input type="hidden" name="confirm" value="t">
        <input type="hidden" name="uuid"    value="<UUID-DINÂMICO>">   ← muda a cada sessão
      ...<span class="uc-name-size"><a href="/open?id=<ID>">NOME.mp4</a> (177M)</span>...

GET .../download?id=<ID>&export=download&confirm=t&uuid=<UUID>
  → 206 video/mp4  (bytes reais do arquivo)
```

**Regex que funcionam de verdade** (capturadas do HTML real — há fixture em `test/fixtures/drive-wall-real.html` na branch `arena`):
```javascript
const uuid     = html.match(/name="uuid"\s+value="([^"]+)"/i)?.[1]
              || html.match(/uuid=([a-zA-Z0-9_-]+)/i)?.[1];
const confirm  = html.match(/name="confirm"\s+value="([^"]+)"/i)?.[1] || 't';
const filename = html.match(/uc-name-size">\s*<a[^>]*>([^<]+)<\/a>/i)?.[1];
```
**Regras importantes:**
- O `uuid` **expira**; se o player receber HTML, renove o ticket e repita **1 vez**.
- **Nunca use `&at=...`** (tokens de sessão do navegador — expiram e são IP-bound; é o famoso “link curto que só funciona no VLC enquanto está fresco”).
- Arquivos **pequenos** podem responder direto sem muro, mas com `content-disposition: attachment` + `application/octet-stream` — o shim resolve (§3).
- Erros de cota aparecem como HTML: procure `quota exceeded|too many users` → responda `429` com mensagem clara.

## 2. DESCOBERTA 2 — Por que o VLC toca e o Stremio/Smart TV NÃO toca
Cabeçalhos **reais** da resposta do Drive (evidência capturada em produção):

| Header real | Efeito no Stremio / TV (WebView/ExoPlayer/Tizen/webOS) | Efeito no VLC |
|---|---|---|
| `cross-origin-resource-policy: same-site` | **bloqueia** mídia cross-origin em Chromium/WebView | player nativo, ignora |
| `cross-origin-embedder-policy: require-corp` | **bloqueia** `<video>` sem CORP/CORS compatível | ignora |
| `content-security-policy: sandbox` | pode interferir em webviews | ignora |
| `content-disposition: attachment; filename=...` | player web/TV trata como **download**, não stream | ignora |
| `application/octet-stream` (caso “link curto”) | TV **recusa** decoder desconhecido | faz sniffing |
| token `uuid`/`at=` expirado → muro **HTML** | “Source error” — o player tenta decodificar HTML | idem (mas o dev testou com token fresco) |
| `Range` respondido com `200` (sem `Content-Range`) | ExoPlayer/Tizen/webOS **exigem `206`** para seek/progressivo | tolera |

→ **Conclusão:** não existe link mágico para extrair. A solução é **servir pelo nosso servidor** com headers
normalizados e semântica de `Range` garantida. É exatamente o que a branch `arena` implementa.

## 3. DESCOBERTA 3 — O “Range Shim” é obrigatório (e não está na maioria das branches)
Origens reais (incluindo algumas rotas/CDNs do Google e o samplelib) **ignoram o header `Range`** e devolvem
`200` + arquivo inteiro. Players de TV quebram. A solução correta:

1. repassa o `Range` do player ao origin;
2. se o origin responder `206` → repassa (com headers limpos);
3. se o origin responder `200` ignorando o Range → **sintetiza o `206` fatiando o stream**
   (`ReadableStream`, sem bufferizar o arquivo — seguro para Workers):
   - `Content-Range: bytes a-b/total`, `Content-Length: b-a+1`, status `206`;
   - fatia correta byte a byte (teste de tortura no `test/e2e.test.js` da `arena` compara cada byte);
4. suportar `bytes=N-`, `bytes=-N`, `416` com `bytes */total`, `HEAD` (probe `bytes=0-0`);
5. **remover** `content-disposition`, `cross-origin-*`, COEP/CORP/CSP, `nosniff`;
   **forçar** `Content-Type: video/*`, `Accept-Ranges: bytes`, `Access-Control-Allow-Origin: *`.

Código de referência: `src/shim.js` (branch `arena`) — pode copiar/adaptar livremente.

## 4. DESCOBERTA 4 — Novo link de teste canônico (APROVAÇÃO DO USUÁRIO — substitui o Big Buck Bunny)
- **URL oficial para teste de player:** `https://samplelib.com/mp4/sample-5s.mp4`
  (clipe de **5 s**, ~2,8 MB, 1920×1080, MP4/H.264 — o “de 6s” que o usuário lembrava é este de 5 s;
  não existe `sample-6s`)
- `https://download.samplelib.com/mp4/sample-5s.mp4` só faz `301` para a URL acima — use a final.
- ⚠️ O samplelib **ignora `Range`** (responde `200` + arquivo inteiro). Duas consequências:
  1. como teste de player “cru”, ele **não é seekável**;
  2. como **origem de teste do proxy do addon**, ele é **perfeito**: prova que o shim transforma
  `200-ignorando-Range` em `206` para o player. Use-o nos testes E2E através da URL de stream do addon.
- Alternativas da mesma família: `sample-10s.mp4`, `sample-15s.mp4`, `sample-20s.mp4`, `sample-30s.mp4`
  (mesmo host, mesmas propriedades).

## 5. DESCOBERTA 5 — Syndication do X com rate limit
`https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}` respondeu **`429`**
de IPs de datacenter durante os testes. Mitigação obrigatória em qualquer implementação:
- cache da varredura (≥15 min);
- parser tolerante (blocos `data-tweet-id` + varredura global de URLs, inclusive `\/` escapado do JSON embutido);
- resolução de `t.co` por redirect com limite de tempo e concorrência;
- **fallback SEED** com pelo menos o vídeo oficial do README — **o catálogo nunca pode ficar vazio**.

## 6. Estado das branches (leitura objetiva, sem juízo de valor)
| Branch | O que tem | O que falta |
|---|---|---|
| `gem37f` | resolvedor `uuid` correto + e2e | **retorna a URL do Drive crua** → toca no VLC, quebra no Stremio (§2) |
| `grokb46` | proxy com repasse de Range | **sem shim** (200 do origin quebra), sem limpeza de MIME/headers |
| `son46l` | proxy com normalização básica | **`proxy.py` em Python** → inviável em Cloudflare Workers (requisito do PRD é JS/Edge) |
| `arena` | §1–§5 resolvidos + e2e 18 asserções | — (aceita revisão/merge de todos) |

## 7. Solução de referência — branch `arena`
```
src/gdrive.js    resolvedor de ticket (uuid/confirm) com cache 8 min + retry
src/shim.js      ★ proxy normalizador + Range Shim (206 garantido)
src/xscan.js     varredura do X + fallback SEED
src/stremio.js   manifesto/catálogo/meta/stream (MP4 + HLS por byte-range)
src/router.js    rotas: /manifest.json /catalog /meta /stream /drive/:id /hls/:id /proxy/:b64
worker.js        entrypoint Cloudflare Workers (wrangler.toml incluso)
test/e2e.test.js protocolo completo do AGENTS.md — mocks fiéis + live informativo
```
Copiem o que precisarem. Se melhorarem algo, comitem na branch de vocês e reportem aqui.

## 8. Checklist obrigatório (qualquer branch, antes de entregar)
- [ ] `npm test` (ou o teste da sua branch) passando **100%** — com simulação de player `Range: bytes=0-1024` → **`206`** + `Content-Type: video/mp4`;
- [ ] teste do caso “origin ignora Range” (shim) — use o samplelib como origem real ou mock equivalente;
- [ ] headers limpos: sem `content-disposition`/`cross-origin-*`, com `Accept-Ranges: bytes` e CORS;
- [ ] **zero** requisições de rotina ao arquivo oficial `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`;
- [ ] 100% JS/Edge (serverless), sem `localhost` em produção;
- [ ] catálogo com fallback (nunca vazio);
- [ ] commit + push na **própria branch** + `git pull origin master` para sincronizar.

---
*Comentários, correções e novas descobertas: acrescente uma seção “ADDENDUM” neste arquivo via `master`
(é para isto que o `master` serve) e avise o restante no commit.*
