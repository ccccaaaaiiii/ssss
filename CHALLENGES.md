# CHALLENGES — ssss Stremio Addon

Registro técnico de desafios encontrados e resolvidos (ou pendentes) durante o desenvolvimento.
Destina-se a agentes futuros que assumirem qualquer branch.

---

## DESAFIO 1 — Stream de vídeo do Google Drive [RESOLVIDO — branch: son46l]

**Problema:**
O endpoint `/uc?id=ID&export=download` retorna `Content-Disposition: attachment`, forçando download.
Navegadores e Stremio respeitam esse header. VLC ignora. Resultado: vídeo baixa em vez de tocar.

**Tentativas que falharam:**
- `&export=download&confirm=t` direto → retorna página HTML de confirmação (vírus warning)
- `yt-dlp` → 404 no arquivo (ID errado, ver Desafio 2)
- Endpoint `drive.usercontent.google.com/download` sem uuid → 404
- URLs `googlevideo.com` internas → descontinuadas pelo Google em 2023

**Solução encontrada:**
Fluxo de dois passos:
1. GET em `drive.usercontent.google.com/download?id=ID&export=download` → extrai `uuid` do form HTML
2. GET em `drive.usercontent.google.com/download?id=ID&export=download&confirm=t&uuid=UUID`
   → retorna `Content-Type: video/mp4` sem `Content-Disposition: attachment`

Proxy local Python (`proxy.py`) faz esse fluxo e serve via HTTP com suporte a `Range` (seek).
Resultado: `206 Partial Content`, `Accept-Ranges: bytes`, arquivo de 992 MB streamável.

**URL local para Stremio:**
`http://localhost:8080/<ID_DO_DRIVE>`

**Arquivo:** `proxy.py` na branch `son46l`

---

## DESAFIO 2 — ID incorreto na documentação [RESOLVIDO — master]

**Problema:**
O README original tinha ID `1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z` (K maiúsculo).
ID real extraído do post do X via `publish.twitter.com/oembed` + expansão do `t.co`:
`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (k minúsculo na posição 9).
Diferença de 1 caractere causava 404 em todos os endpoints.

**Correção:** `sed` no README, commit `75bfabe` no master.

---

## DESAFIO 3 — Varredura do perfil X [PENDENTE]

**Objetivo:**
Dado um perfil X (ex: `monroesheriffny`), varrer todos os posts (ou até um limite N)
e extrair todos os links de Google Drive presentes.

**Por que é difícil:**
- X bloqueia scraping sem JavaScript (curl/wget retornam HTML vazio ou redirect)
- Nitter (proxies alternativos) instáveis e frequentemente offline
- API oficial do X requer autenticação e tem limites severos no plano gratuito
- `cdn.syndication.twimg.com` retorna `{}` para posts antigos
- `publish.twitter.com/oembed` funciona post a post mas não lista posts de um perfil

**Caminhos a explorar:**
1. API v2 do X com Bearer Token (app gratuito tem 500k tweets/mês de leitura)
   - Endpoint: `GET /2/users/:id/tweets?max_results=100`
   - Requer: criar app em developer.x.com, extrair Bearer Token
2. Playwright/Puppeteer headless com scroll automático (simula browser real)
   - Mais pesado mas mais confiável
3. Serviço terceiro como Apify, SocialData.tools ou RapidAPI Twitter
4. Syndication endpoint com lista de IDs conhecidos (limitado, não faz varredura)

**Decisão pendente:** definir se o addon vai usar API oficial ou scraping headless.

---

## DESAFIO 4 — Filtrar links Drive que são vídeo [PENDENTE]

**Objetivo:**
Dos links Drive extraídos, identificar quais são vídeos (vs docs, imagens, etc.)
sem baixar o arquivo inteiro.

**Abordagem provável:**
- HEAD request no proxy → checar `Content-Type: video/*`
- Ou checar extensão do filename no header `Content-Disposition` (ex: `.mp4`, `.mkv`, `.avi`)
- Fazer isso de forma assíncrona para não travar a listagem do Stremio

---

## DESAFIO 5 — Integração com protocolo Stremio Addon [PENDENTE]

**Objetivo:**
Empacotar tudo como addon Stremio real com `manifest.json` e handler de `stream`.

**Estrutura mínima necessária:**
- `manifest.json` com `id`, `version`, `resources: ["catalog","stream"]`
- Catalog: lista os vídeos encontrados no perfil X configurado
- Stream: para cada item, chama o proxy e devolve a URL streamável
- Configuração: campo para o usuário inserir o handle do perfil X e limite de posts

**Referência:** https://github.com/Stremio/stremio-addon-sdk

---

## ORDEM DE ATAQUE SUGERIDA

```
[1] Resolver varredura X (Desafio 3) — branch: a definir
[2] Filtrar vídeos Drive (Desafio 4) — integrar ao proxy.py (son46l)
[3] Montar addon.js com manifest + catalog + stream (Desafio 5)
[4] Unir branches em master
```
