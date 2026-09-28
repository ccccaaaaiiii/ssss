# PRD — ssss Stremio Addon (Serverless)
**Versão:** 1.1 | **Branch referência:** master | **Alvo:** Serverless / Workers / Smart TVs

---

## 1. Visão Geral e Problema

Perfis públicos no X (Twitter), como `@monroesheriffny`, compartilham vídeos institucionais hospedados no Google Drive através de links encurtados `t.co`.
- O Stremio não possui integração nativa para ler feeds do X ou reproduzir links do Google Drive.
- O Google Drive força o download de arquivos grandes (`Content-Disposition: attachment` e telas de confirmação de vírus), impedindo o streaming direto nativo no Stremio em TVs e outros clientes.
- **Ambiente de Destino:** O addon deve rodar em infraestrutura **Serverless** (Cloudflare Workers, Vercel, Node.js Serverless) e ser consumido em **Smart TVs** (Android TV, Tizen, WebOS, Apple TV, Fire TV), sem necessidade de nenhum programa adicional ou execução em `localhost`.

---

## 2. Requisitos do Sistema

### 2.1 Requisitos Obrigatórios
1. **100% Serverless e Nuvem:** Nenhuma dependência de processos locais na máquina do usuário (proibido o uso de `localhost`, daemons Python ou binários nativos).
2. **Compatibilidade Total com Smart TVs:** O player do Stremio na TV deve receber uma URL HTTP/HTTPS diretamente streamável (com suporte a `Range` requests para seek/avanço/retrocesso).
3. **Sem Credenciais / Chaves de API do Usuário:** O addon deve funcionar de forma autônoma sem exigir que o usuário final configure API keys do X ou do Google Drive.
4. **Resolução de Streams do Google Drive:** O addon deve resolver o link de streaming contornando o aviso de vírus de arquivos grandes e servindo os headers corretos de vídeo (`video/mp4`, `Accept-Ranges: bytes`).
5. **Varredura Dinâmica no X:** Extrair posts e links `t.co` que apontem para `drive.google.com/file/d/ID`.
6. **Política de Testes Seguros (Anti-Rate Limit):** É expressamente proibido fazer testes de carga ou requisições repetidas ao link de referência do Google Drive (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`), sob pena de esgotamento de cota do Google. Os testes devem utilizar mocks, fixtures ou URLs de vídeo abertas.

### 2.2 Requisitos Não Obrigatórios (Desejáveis)
- Suporte a cache de resoluções de streaming e catálogo em memória / KV / Edge.
- Tratamento silencioso e fallback elegante caso algum link do Drive não seja um vídeo legível.

---

## 3. Arquitetura Serverless

```
[Cliente Stremio (Smart TV / Mobile / PC)]
                 │
                 ▼ (HTTPS / Manifest / Catalog / Stream)
┌─────────────────────────────────────────────────────────────┐
│              Addon Serverless (JavaScript / Worker)         │
│                                                             │
│  1. Scraper / Indexador X:                                  │
│     syndication.twitter.com → extrai t.co → resolve Drive ID│
│                                                             │
│  2. Catalog Handler:                                        │
│     Retorna catálogo com itens (metas) formatados           │
│                                                             │
│  3. Stream Resolver / Proxy Endpoint (JS Nativo):           │
│     - Obtém UUID de confirmação do Google Drive             │
│     - Fornece stream direto com headers de vídeo/Range      │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
[Google Drive Storage (drive.usercontent.google.com)]
```

---

## 4. Componentes Técnicos

### 4.1 Scraper do Perfil X (100% JavaScript / Fetch)
- **Endpoint:** `https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}` ou endpoints de timeline públicos.
- **Processamento:**
  - Faz requisição GET com `User-Agent` de navegador moderno.
  - Extrai links `https://t.co/XXXXX` via Regex.
  - Faz resolução de redirecionamento (HEAD / GET com `redirect: 'manual'` ou `follow`) para obter a URL final.
  - Filtra links correspondentes ao padrão `drive.google.com/file/d/{FILE_ID}`.

### 4.2 Stream Resolver do Google Drive (JS / Serverless)
Para arquivos grandes (ex: 992 MB), o Google Drive exige confirmação de download:
1. Faz GET em `https://drive.usercontent.google.com/download?id={ID}&export=download`.
2. Extrai o token `uuid` ou `confirm` presente no formulário/link HTML de resposta.
3. Monta a URL de streaming direto:
   `https://drive.usercontent.google.com/download?id={ID}&export=download&confirm=t&uuid={UUID}`
4. O addon pode:
   - **Opção A:** Retornar a URL resolvida diretamente para o player do Stremio se compatível.
   - **Opção B:** Servir como um endpoint de stream/proxy serverless em JS (usando `fetch` com streaming body / `TransformStream` repassando `Range` headers e removendo o cabeçalho `Content-Disposition: attachment`).

---

## 5. Estratégia de Testes e Prevenção de Limite de Cota (Google Drive)

Para evitar bloqueio de IP ou esgotamento de quota (*"Download quota exceeded for this file"*):
- **Testes Unitários:** Usar dados mockados da resposta HTML do Drive e das timelines do X.
- **Testes E2E de Player no Stremio:** Utilizar URLs de vídeo públicas de teste:
  - `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
  - `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`
- **Validação com o Google Drive Real:** Apenas 1 (uma) requisição pontual de validação final antes da entrega com o arquivo `NATURAL (MCSO 2018).mp4`.

---

## 6. Especificação do Stremio Addon SDK

- **Resources:** `['catalog', 'meta', 'stream']`
- **Types:** `['other', 'movie']`
- **Prefixes:** `['mcso_', 'drive_']`
- **Compatibilidade:** `stremio-addon-sdk` ou roteador compatível com a especificação HTTP do Stremio Addon Protocol v2.

---

## 7. Critérios de Sucesso
- Instalação no Stremio via URL HTTPS pública (sem rodar nada local).
- O catálogo exibe o vídeo `NATURAL (MCSO 2018)`.
- Ao clicar em reproduzir em uma Smart TV ou app Stremio, o vídeo toca fluidamente com seek funcional.
