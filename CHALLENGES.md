# CHALLENGES — ssss Stremio Addon (Serverless)

Registro técnico dos desafios e soluções de referência para os agentes de desenvolvimento.

---

## DESAFIO 1 — Stream do Google Drive em Serverless

### ✅ Solução em JavaScript (Fetch)
1. **Descoberta do UUID:**
   GET em `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download`
2. **Extração do Token:**
   ```javascript
   const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i) || html.match(/uuid=([a-zA-Z0-9_-]+)/i);
   ```
3. **URL Direta de Stream:**
   `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download&confirm=t&uuid=${uuid}`
4. **Entrega:** Retornar a URL resolvida ou repassar os cabeçalhos `Range` com `Content-Type: video/mp4`.

---

## DESAFIO 2 — Cota de Download e Ambiente de Testes

- **Problema:** O Google Drive possui limite estrito de cota de download por arquivo público (*"Download quota exceeded"*).
- **Regra para Testes:**
  - **Testes com Google Drive:** Devem ser feitos utilizando **outros links/IDs secundários descartáveis do Google Drive**.
  - **Proibido em rotinas diárias:** Não realizar requisições contínuas com o arquivo oficial (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`).
  - **Teste de Player:** Usar o clipe curto do samplelib (5s, ~2,8 MB, MP4/H.264): `https://samplelib.com/mp4/sample-5s.mp4`.
    - O host de download `https://download.samplelib.com/mp4/sample-5s.mp4` apenas redireciona (301) para a URL acima — use a URL final direta.
    - ⚠️ **Observação importante:** o samplelib **ignora requisições `Range`** (responde `200` + arquivo inteiro, sem `Accept-Ranges`). Isso o torna o caso de teste real perfeito para o *Range Shim* do proxy: testando a URL de stream **do addon**, o player recebe `206` + `Content-Range` normalizados.
  - **Validação Oficial:** Apenas 1 checagem final antes da entrega com o arquivo de produção.

---

## DESAFIO 3 — ID do Google Drive de Referência

- **ID Canônico:** `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (*"k" minúsculo no 9º caractere*).

---

## DESAFIO 4 — Scraping do X sem Chaves de API

- Endpoint público: `https://syndication.twitter.com/srv/timeline-profile/screen-name/monroesheriffny`
- Captura de `t.co` e resolução do `Location` redirecionando para `drive.google.com/file/d/{ID}`.

---

## DESAFIO 5 — Compatibilidade Serverless

- Código 100% JavaScript executável em Cloudflare Workers / Vercel / Edge.
- Compatibilidade nativa com apps Stremio em Smart TVs (Android TV, Tizen, webOS).
