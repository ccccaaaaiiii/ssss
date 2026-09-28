# ssss — Stremio Addon (Serverless)

Extensão do Stremio para localizar postagens no perfil X (Twitter) @monroesheriffny, extrair links públicos de vídeos no Google Drive e disponibilizá-los diretamente como catálogo e streaming no Stremio.

---

## 1. Documentação Canônica (`master`)
Este repositório (`master`) centraliza a especificação do projeto:
- **`PRD.md`**: Requisitos do produto, escopo e arquitetura serverless.
- **`CHALLENGES.md`**: Desafios técnicos (Google Drive streams, scraping do X).
- **`AGENTS.md`**: Regras de fluxo de trabalho para agentes, divisão de branches e políticas de teste.

---

## 2. Restrições e Premissas Fundamentais

> ⚠️ **ARQUITETURA SERVERLESS & SUPORTE A SMART TVs:**
> - **Zero Dependências Locais:** O addon **NÃO** pode depender de daemons locais, scripts em Python ou servidores em `localhost`.
> - **Compatibilidade com Smart TVs:** Suporte direto a clientes Stremio em TVs e mobile sem terminais auxiliares.
> - **100% Serverless / Cloud Ready:** Implementado em **JavaScript / TypeScript** para Cloudflare Workers / Vercel / Edge functions.

---

## 3. Diretrizes de Testes

> ⛔ **GOOGLE DRIVE ANTI-RATE LIMIT:**
> - Não usar o arquivo de produção (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`) em testes de rotina.
> - **Resolvedor Google Drive (teste seguro):** Usar ID verificado `0ByeS4oOUV-49Zzh4R1J6R09zazQ` (Big Buck Bunny).
> - **Player Stremio:** Usar stream direto `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`.
> - Consulte **`AGENTS.md`** para diretrizes detalhadas.

---

## 4. Fontes de Referência
- **Perfil X:** [https://x.com/monroesheriffny](https://x.com/monroesheriffny)
- **Postagem base:** [https://x.com/monroesheriffny/status/1078703782916227072](https://x.com/monroesheriffny/status/1078703782916227072)
- **Arquivo oficial de entrega:** `NATURAL (MCSO 2018).mp4` (ID: `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` — ~992 MB)

---

## 5. Estrutura de Branches
- **`master`:** Documentação oficial (`README.md`, `PRD.md`, `CHALLENGES.md`, `AGENTS.md`).
- **Branches de Implementação:** `gem37f`, `son46l`, `grokb46`, `kilo-agent`.
