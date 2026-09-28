# CHALLENGES — ssss Stremio Addon (Serverless)

Registro técnico dos desafios encontrados e soluções projetadas para o desenvolvimento do addon.
Este documento serve como referência técnica para os agentes implementando nas suas respectivas branches.

---

## DESAFIO 1 — Stream de Vídeo do Google Drive em Ambiente Serverless

### ❌ Abordagens Inválidas (Descartadas)
- **Proxy local em Python (`localhost:8080`):** Incompatível com o modelo de implantação Serverless/Worker e inviável para usuários de Smart TVs (Tizen, LG webOS, Android TV) que não possuem capacidade de rodar scripts locais.
- **URL direta `/uc?id=ID&export=download`:** Força o cabeçalho `Content-Disposition: attachment`, fazendo o navegador ou TV tentar baixar o arquivo ou abortar em vez de tocar.
- **Requisição direta sem confirmação em arquivos grandes (>100MB):** O Google Drive retorna uma página HTML de aviso de vírus ("Google Drive can't scan this file for viruses").

### ✅ Solução Serverless em JavaScript
Fluxo executado diretamente no backend serverless (Node.js / Cloudflare Worker):
1. **Passo 1 (Descoberta do UUID):**
   Realizar `fetch` na URL:
   `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download`
2. **Passo 2 (Extração do Token):**
   Extrair o campo `uuid` (ou token de confirmação `confirm=...`) do corpo HTML retornado via regex:
   ```javascript
   const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i) || html.match(/uuid=([a-zA-Z0-9_-]+)/i);
   ```
3. **Passo 3 (URL Direta de Stream):**
   Construir a URL direta:
   `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download&confirm=t&uuid=${uuid}`
4. **Passo 4 (Entrega ao Stremio):**
   - Retornar a URL direta no handler de `stream` do Stremio; ou
   - Prover uma rota serverless HTTP no próprio addon que faz o `fetch` repassando os cabeçalhos `Range` e definindo `Content-Type: video/mp4` sem `Content-Disposition`.

---

## DESAFIO 2 — Correção do ID do Google Drive de Teste

- **Problema:** A URL inicial possuía um erro de maiúscula/minúscula no ID (`1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z`).
- **Correção Confirmada:** O ID canônico extraído da postagem original do Twitter/X é:
  `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (*"k" minúsculo no 9º caractere*).

---

## DESAFIO 3 — Varredura do Perfil X (Twitter) sem Chaves de API

- **Objetivo:** Coletar postagens públicas do perfil `@monroesheriffny` sem exigir credenciais pagas ou tokens do usuário.
- **Estratégia Serverless (JS Fetch):**
  - Utilizar endpoints públicos de syndication (ex: `https://syndication.twitter.com/srv/timeline-profile/screen-name/monroesheriffny`).
  - Extrair links encurtados `https://t.co/XXXXX`.
  - Resolver os redirects de `t.co` via chamadas HTTP `HEAD`/`GET` capturando o header `Location`.
  - Filtrar URLs com o padrão `drive.google.com/file/d/{ID}`.

---

## DESAFIO 4 — Catálogo e Metadados Dinâmicos no Stremio

- **Objetivo:** Disponibilizar os vídeos encontrados de forma limpa na interface do Stremio.
- **Implementação:**
  - `catalogHandler`: Lista os vídeos disponíveis com pôster, título e ID exclusivo (`mcso_natural_2018` ou `drive_{ID}`).
  - `metaHandler`: Fornece a descrição, ano, gênero e link da postagem original de referência.
  - `streamHandler`: Executa a resolução do link direto do Google Drive (Desafio 1) e retorna o stream.

---

## DESAFIO 5 — Empacotamento e Execução Serverless

- O código em cada branch de agente (`gem`, `son`, `grok`, etc.) deve ser 100% JavaScript (ou TS compilado) utilizando `stremio-addon-sdk` ou manipulação direta de rotas HTTP para Serverless/Edge.
- O addon deve iniciar com `npm start` ou ser facilmente empacotável para deploy em Cloudflare Workers / Vercel.
