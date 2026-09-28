# ssss — Stremio Addon (Serverless)

Extensão do Stremio para localizar postagens no perfil X (Twitter) @monroesheriffny, extrair links públicos de vídeos no Google Drive e disponibilizá-los diretamente como catálogo e streaming no Stremio.

---

## 1. Objetivo do Repositório
Este repositório (`master`) é a **fonte canônica de documentação, requisitos e desafios técnicos** do projeto. 
Qualquer agente ou desenvolvedor deve encontrar aqui todo o contexto necessário para implementar sua própria versão nas branches designadas.

---

## 2. Restrições e Premissas Fundamentais

> ⚠️ **ARQUITETURA SERVERLESS & SUPORTE A SMART TVs:**
> - **Zero Dependências Locais:** O addon **NÃO** pode depender de daemons locais, scripts em Python ou servidores em `localhost`.
> - **Compatibilidade com Smart TVs:** Suporte direto a clientes Stremio em TVs e mobile sem terminais auxiliares.
> - **100% Serverless / Cloud Ready:** Implementado em **JavaScript / TypeScript** para Cloudflare Workers / Vercel / Edge functions.

---

## 3. Diretrizes de Testes e Prevenção de Rate Limit

> ⛔ **REGRA DE TESTE COM GOOGLE DRIVE:**
> - **Nunca usar o link oficial (`1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z`) nos testes diários** para não esgotar a cota de download do arquivo de produção (*"Download quota exceeded"*).
> - **Para testar o resolvedor do Google Drive:** Utilize IDs secundários e descartáveis do próprio Google Drive.
> - **Para testar o player de vídeo no Stremio:** Use o link direto de demonstração:
>   - Big Buck Bunny: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
> - **Validação Final:** O link oficial de produção é reservado apenas para o teste de validação de entrega.

---

## 4. Fontes de Referência
- **Perfil X:** [https://x.com/monroesheriffny](https://x.com/monroesheriffny)
- **Postagem base:** [https://x.com/monroesheriffny/status/1078703782916227072](https://x.com/monroesheriffny/status/1078703782916227072)
- **Arquivo oficial:** `NATURAL (MCSO 2018).mp4` (ID: `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` — ~992 MB)

---

## 5. Estrutura de Branches
- **`master`:** Documentação oficial (`README.md`, `PRD.md`, `CHALLENGES.md`).
- **Branches de Implementação:** `gem37f`, `son46l`, `grokb46`, `kilo-agent`.
