# PRD — ssss Stremio Addon
**Versão:** 0.2 | **Branch referência:** master | **Atualizado por:** son46l

---

## 1. Problema

Perfis públicos do X (Twitter) compartilham vídeos hospedados no Google Drive.
Não existe forma nativa de assistir esses vídeos diretamente no Stremio.
O link padrão do Drive força download em vez de streaming.

---

## 2. Solução

Addon para Stremio que:
1. Varre um perfil público do X sem autenticação
2. Coleta todos os links de Google Drive encontrados
3. Serve cada link como stream via proxy local (removendo o header `attachment`)
4. Exibe como catálogo no Stremio — o usuário clica, tenta reproduzir; se falhar, não é vídeo

---

## 3. Requisitos

### Obrigatórios
- Nenhuma chave de API, token ou credencial configurada pelo usuário
- Funciona 100% local (proxy + addon rodando na máquina do usuário)
- Suporte a `Range` requests (seeking no vídeo)
- Varredura dinâmica: o usuário informa o handle do perfil X, o addon varre
- Limite configurável de posts a varrer (padrão: 100 posts mais recentes)

### Não obrigatórios
- Filtrar se o link Drive é vídeo antes de exibir (falha silenciosa no player = aceitável)
- Suporte a perfis privados
- Suporte a vídeos que exijam login no Drive

---

## 4. Arquitetura

```
[X Syndication API] → [scraper.js] → lista de t.co
       ↓
[t.co expander] → filtra drive.google.com/file/d/ID
       ↓
[catalog handler] → lista no Stremio
       ↓
[stream handler] → chama proxy.py com o ID
       ↓
[proxy.py :8080] → busca uuid → monta URL confirm → pipe stream sem attachment
       ↓
[Stremio player] → reproduz
```

---

## 5. Varredura do X (sem chave)

**Endpoint escolhido:** `syndication.twitter.com/srv/timeline-profile/screen-name/{handle}`

- Público, sem autenticação, sem chave de desenvolvedor
- Retorna HTML com links `t.co` encurtados
- Limitação: retorna ~20 posts mais recentes por chamada
- Rate limit por IP: moderado (problema de sandbox, não de produção)

**Fluxo do scraper:**
1. GET no endpoint de syndication com `User-Agent` de browser
2. Extrai todos os `https://t.co/XXXXX` únicos via regex
3. Para cada `t.co`, faz HEAD e segue redirect — filtra destinos com `drive.google.com/file/d/`
4. Extrai o `ID` do Drive da URL filtrada
5. Monta item de catálogo com título genérico + ID

**Limitação conhecida:** posts antigos (ex: 2018) podem não aparecer na syndication.
Solução futura: paginação via cursor ou abordagem complementar com Playwright headless.

---

## 6. Stream do Google Drive (sem chave)

**Fluxo (resolvido — branch son46l / proxy.py):**
1. GET `drive.usercontent.google.com/download?id=ID&export=download`
   → retorna HTML com form contendo campo `uuid`
2. GET `drive.usercontent.google.com/download?id=ID&export=download&confirm=t&uuid=UUID`
   → retorna `Content-Type: video/mp4` sem `Content-Disposition: attachment`
3. Proxy serve com `Accept-Ranges: bytes` e `206 Partial Content`

**Testado com:** arquivo `NATURAL (MCSO 2018).mp4` (992 MB) — 200 OK confirmado

---

## 7. Desafios Abertos

Ver `CHALLENGES.md` para detalhes técnicos. Resumo:

| # | Desafio | Status |
|---|---------|--------|
| 3 | Varredura X sem chave — posts antigos (paginação) | 🟡 Parcial |
| 4 | Filtro vídeo Drive | ✅ Descartado — falha silenciosa aceitável |
| 5 | Empacotar como addon Stremio (manifest + catalog + stream) | 🔴 Próximo |

---

## 8. Stack

| Componente | Tecnologia |
|-----------|-----------|
| Addon Stremio | Node.js + stremio-addon-sdk |
| Proxy stream | Python 3 (stdlib pura, sem deps) |
| Scraper X | Node.js fetch nativo |
| t.co expander | HEAD request + follow redirect |

**Referência SDK:** https://github.com/Stremio/stremio-addon-sdk

---

## 9. Próximos Passos (ordem)

1. `scraper.js` — varredura syndication + expansão t.co → IDs Drive (branch: son46l)
2. `addon.js` — manifest + catalog handler + stream handler integrando proxy (branch: son46l)
3. Teste end-to-end com Stremio real
4. PR son46l → master
