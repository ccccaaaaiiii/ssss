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

## 3. Fontes e Dados Confirmados de Referência
- **Perfil X confirmado:** [https://x.com/monroesheriffny](https://x.com/monroesheriffny)
- **Postagem base confirmada:** [https://x.com/monroesheriffny/status/1078703782916227072](https://x.com/monroesheriffny/status/1078703782916227072)
- **Arquivo confirmado no Google Drive:** `NATURAL (MCSO 2018).mp4` (Tamanho: ~992 MB)
- **ID correto do Google Drive:** `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (*atenção: "k" minúsculo no índice 9*)
- **URL confirmada:** `https://drive.google.com/file/d/1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z/view`

---

## 4. Estrutura de Branches do Projeto
- **`master`:** Documentação oficial do projeto (`README.md`, `PRD.md`, `CHALLENGES.md`, `plan.md`).
- **Branches de Implementação dos Agentes:**
  - `gem37f` (ou branches com prefixo `gem`) — Implementação dos agentes Gemini
  - `son46l` — Implementação dos agentes Sonnet
  - `grokb46` — Implementação dos agentes Grok
  - `kilo-agent` — Implementação do agente Kilo

---

## 5. Próximos Passos Técnicos
Consulte o [PRD.md](./PRD.md) para a arquitetura completa e o [CHALLENGES.md](./CHALLENGES.md) para o guia detalhado dos desafios e soluções compatíveis com Serverless.
