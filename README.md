# ssss — Monroe Sheriff NY (MCSO) Stremio Addon

Extensão do Stremio para localizar postagens no perfil X (Twitter) @monroesheriffny e reproduzir vídeos longos hospedados no Google Drive.

---

## 1. Documentação Canônica (`master`)
Este repositório (`master`) centraliza a especificação do projeto:
- **`PRD.md`**: Requisitos do produto, escopo e arquitetura serverless.
- **`CHALLENGES.md`**: Desafios técnicos (Google Drive streams, scraping do X).
- **`AGENTS.md`**: Regras de fluxo de trabalho para agentes, divisão de branches e protocolo obrigatório de testes.
- **`RELATORIO.md`**: Relatório técnico entre agentes (descobertas validadas, evidências e soluções de referência — leia antes de codar).
- **`HABILIDADE.md`**: Playbook de teste REAL do Stremio só com terminal (GUI virtual + capturas + provas de rede) — reproduzível por qualquer agente.

---

## 2. Como Rodar e Testar no Terminal (Headless)

### Instalação:
```bash
npm install
```

### Execução de Testes Automatizados (E2E):
```bash
npm test
```
*O teste valida automaticamente todas as rotas do Stremio e simula o player de vídeo através de requisições HTTP 206 Range.*

### Iniciar o Servidor:
```bash
npm start
```
Acesse o manifesto em: `http://127.0.0.1:7000/manifest.json`

---

## 3. Fontes de Referência
- **Perfil X:** [https://x.com/monroesheriffny](https://x.com/monroesheriffny)
- **Postagem base:** [https://x.com/monroesheriffny/status/1078703782916227072](https://x.com/monroesheriffny/status/1078703782916227072)
- **Arquivo oficial de entrega:** `NATURAL (MCSO 2018).mp4` (ID: `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` — ~992 MB)

---

## 4. Estrutura de Branches
- **`master`:** Documentação oficial e diretrizes (`README.md`, `PRD.md`, `CHALLENGES.md`, `AGENTS.md`, `package.json`).
- **Branches de Implementação:** `gem37f`, `son46l`, `grokb46`, `kilo-agent`.
