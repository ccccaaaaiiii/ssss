# ssss — Stremio Addon (Serverless)

Extensão do Stremio para localizar postagens no perfil X (Twitter) @monroesheriffny, extrair links públicos de vídeos no Google Drive e disponibilizá-los diretamente como catálogo e streaming no Stremio.

---

## 1. Objetivo do Repositório
Este repositório (`master`) é a **fonte canônica de documentação, requisitos e desafios técnicos** do projeto. 
Qualquer agente ou desenvolvedor deve encontrar aqui todo o contexto necessário para implementar sua própria versão nas branches designadas.

---

## 2. Restrições e Premissas Fundamentais

> ⚠️ **ATENÇÃO — ARQUITETURA SERVERLESS & SUPORTE A SMART TVs:**
> - **Zero Dependências Locais:** O addon **NÃO** pode depender de daemons locais, scripts em Python ou servidores rodando em `localhost`.
> - **Compatibilidade com Smart TVs:** O Stremio é executado em Smart TVs (Samsung Tizen, LG webOS, Android TV), TV Boxes e dispositivos móveis que **não** possuem terminal nem capacidade de executar scripts auxiliares.
> - **100% Serverless / Cloud Ready:** Toda a lógica (scraping, manifesto, catálogo e resolução/streaming de vídeo) deve ser implementada em **JavaScript / TypeScript puro** compatível com ambientes Serverless (ex: Cloudflare Workers, Vercel, Node.js edge/cloud functions).

---

## 3. Diretrizes de Testes e Prevenção de Rate Limit (Google Drive Quota)

> ⛔ **IMPORTANTE — NÃO USAR O LINK DE PRODUÇÃO/REFERÊNCIA NOS TESTES DIÁRIOS:**
> - O link de referência oficial (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` — ~992 MB) **NÃO deve ser consumido repetidamente durante testes unitários ou de integração**.
> - O Google Drive aplica restrições de cota (*"Download quota exceeded for this file"* ou *403/429 Rate Limit*) quando um arquivo público sofre downloads frequentes em curto período de tempo. Se esgotar a cota durante o desenvolvimento, o link ficará temporariamente bloqueado na validação final.
> - **O que usar para testes automatizados e desenvolvimento:**
>   1. **Mocks e Fixtures:** Simule a resposta HTML do Google Drive e as páginas de syndication do X localmente nos testes.
>   2. **Streams de Teste Públicos (Open Source):** Use links de vídeos de demonstração leves para testar o player Stremio, tais como:
>      - Big Buck Bunny MP4: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
>      - Elephants Dream MP4: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`
>      - For Bigger Blazes: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4`
>   3. **Links Alternativos do Google Drive:** Utilize IDs secundários descartáveis de arquivos menores (< 5MB) para testes de validação de fluxo.
>   4. **Validação do Link Oficial:** Reserve o arquivo oficial do Monroe Sheriff apenas para a validação manual final de entrega.

---

## 4. Fontes e Dados Confirmados de Referência
- **Perfil X confirmado:** [https://x.com/monroesheriffny](https://x.com/monroesheriffny)
- **Postagem base confirmada:** [https://x.com/monroesheriffny/status/1078703782916227072](https://x.com/monroesheriffny/status/1078703782916227072)
- **Arquivo confirmado no Google Drive:** `NATURAL (MCSO 2018).mp4` (Tamanho: ~992 MB)
- **ID correto do Google Drive:** `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (*atenção: "k" minúsculo no índice 9*)
- **URL confirmada:** `https://drive.google.com/file/d/1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z/view`

---

## 5. Estrutura de Branches do Projeto
- **`master`:** Documentação oficial do projeto (`README.md`, `PRD.md`, `CHALLENGES.md`).
- **Branches de Implementação dos Agentes:**
  - `gem37f` (ou branches com prefixo `gem`) — Implementação dos agentes Gemini
  - `son46l` — Implementação dos agentes Sonnet
  - `grokb46` — Implementação dos agentes Grok
  - `kilo-agent` — Implementação do agente Kilo

---

## 6. Próximos Passos Técnicos
Consulte o [PRD.md](./PRD.md) para a arquitetura completa e o [CHALLENGES.md](./CHALLENGES.md) para o guia detalhado dos desafios e soluções compatíveis com Serverless.
