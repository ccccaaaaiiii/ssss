# PRD — ssss Stremio Addon (Serverless)
**Versão:** 1.2 | **Branch referência:** master | **Alvo:** Serverless / Workers / Smart TVs

---

## 1. Visão Geral e Problema
O perfil `@monroesheriffny` no X compartilha vídeos institucionais no Google Drive via links encurtados `t.co`.
- O addon deve extrair esses links e disponibilizar catálogo e streaming no Stremio.
- **Ambiente:** Serverless (Cloudflare Workers, Vercel, Edge) compatível com Smart TVs (sem `localhost` nem scripts locais).

---

## 2. Requisitos do Sistema

### 2.1 Requisitos Obrigatórios
1. **100% Serverless:** Sem processos locais (`localhost` proibido).
2. **Compatibilidade com Smart TVs:** Entrega de stream HTTP/HTTPS com suporte a `Range` requests.
3. **Autônomo:** Sem exigir chaves de API do usuário.
4. **Resolvedor Google Drive em JS:** Contornar tela de confirmação de vírus para arquivos grandes e servir headers adequados (`video/mp4`, `Accept-Ranges`).
5. **Varredura no X:** Extrair posts e resolver `t.co` apontando para `drive.google.com/file/d/ID`.
6. **Política de Testes:**
   - **Google Drive nos testes:** Usar links/IDs secundários descartáveis do Google Drive para validar o resolvedor. **Não usar o link oficial (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`) em testes de rotina** para não queimar a cota de download.
   - **Player no Stremio:** Testar playback com o clipe curto do samplelib (5s): `https://samplelib.com/mp4/sample-5s.mp4`.

---

## 3. Arquitetura Serverless

```
[Stremio (TV / Mobile / PC)] ──(HTTPS)──► [Addon Serverless (JS)]
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                         [X Timeline (t.co)]      [Google Drive Direct]
```

---

## 4. Componentes Técnicos

### 4.1 Scraper X (JavaScript / Fetch)
- Endpoint: `https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}`
- Captura links `t.co` e resolve redirects para URLs do Google Drive (`drive.google.com/file/d/{ID}`).

### 4.2 Resolvedor Google Drive (JS / Serverless)
1. Faz `fetch` em `https://drive.usercontent.google.com/download?id={ID}&export=download`.
2. Extrai o token `uuid`/`confirm` do HTML retornado.
3. Monta e repassa o stream direto: `https://drive.usercontent.google.com/download?id={ID}&export=download&confirm=t&uuid={UUID}`.

---

## 5. Especificação do Stremio Addon SDK
- **Resources:** `['catalog', 'meta', 'stream']`
- **Types:** `['other', 'movie']`
- **Prefixes:** `['mcso_', 'drive_']`
