# AGENTS — Regras de Trabalho e Fluxo de Desenvolvimento

Este documento define como todos os agentes de IA e desenvolvedores devem colaborar neste repositório.

---

## 1. Organização de Branches e Responsabilidades

| Branch | Responsabilidade | O que aceita |
|---|---|---|
| **`master`** | **Fonte Canônica de Documentação e Configurações Globais** | `README.md`, `PRD.md`, `CHALLENGES.md`, `AGENTS.md`, `package.json`, `.gitignore` |
| **`gem37f`**, **`son46l`**, **`grokb46`**, **`kilo-agent`** | **Implementação de Código** | Código-fonte do Addon (JS/TS), manifests, rotas, testes da branch |

### Regras Obrigatórias para Agentes:
1. **Leitura Prévia Obrigatória:**
   - Ao iniciar qualquer conversa ou sessão limpa, o agente deve ler `AGENTS.md`, `PRD.md` e `CHALLENGES.md` para entender o contexto do projeto.
2. **Atualizações de Documentação e Requisitos:**
   - Sempre que uma regra, especificação técnica ou requisito for alterado/adicionado, deve ser comitado e enviado para a branch **`master`**.
3. **Desenvolvimento de Código:**
   - O código funcional, dependências e implementações do addon devem ser feitos exclusivamente na **branch de trabalho do respectivo agente** (ex: `gem37f`).
4. **Sincronização:**
   - As branches de implementação devem sempre fazer merge da `master` para manter o alinhamento com os requisitos canônicos (`git pull origin master` / `git merge master`).
5. **Higiene do Repositório:**
   - Nunca comitar `node_modules/`, logs temporários ou arquivos binários.

---

## 🚨 REGRA CRÍTICA — COMMIT E PUSH OBRIGATÓRIOS

**NUNCA termine uma tarefa sem salvar o trabalho no Git.** Após qualquer modificação, o agente deve obrigatoriamente:

1. Verificar se a identidade está configurada com `git config user.name` e `git config user.email`; se estiver ausente, configurar antes de continuar, por exemplo:
   ```bash
   git config user.name "Nome do Agente"
   git config user.email "agente@exemplo.com"
   ```
2. Verificar as alterações com `git status` e `git diff`;
3. Criar um commit descritivo com `git add <arquivos> && git commit -m "<descrição>"`;
3. Enviar o commit com `git push origin <sua-branch>`;
4. Confirmar o push e informar o hash do commit na resposta final.

A regra vale também para documentação, instruções, testes e configurações. Se o push falhar, relatar claramente o erro e não declarar a tarefa concluída. Cada agente deve trabalhar na própria branch (por exemplo, `GPT56l`) e nunca alterar `master` sem autorização.

## 2. Protocolo de Testes Automatizados no Terminal (Headless / Sem GUI)

Como agentes de IA operam exclusivamente em ambiente de terminal e não possuem interface gráfica (GUI) do Stremio ou navegador visual:

### ⚡ Regra de Ouro da Validação Automática:
**Todo agente DEVE rodar e garantir que o teste automatizado passe com 100% de sucesso antes de entregar qualquer resposta:**
```bash
npm test
# ou
node test/e2e.test.js
```

### 🔍 O que o teste automatizado valida:
O script `test/e2e.test.js` simula ponta a ponta o ciclo de vida completo do Stremio:
1. **Inicialização do Servidor:** Sobe o servidor HTTP do addon em porta local de teste.
2. **Manifesto (`/manifest.json`):** Verifica se o manifesto é válido e cumpre a especificação do Stremio SDK.
3. **Catálogo (`/catalog/:type/:id.json`):** Verifica se os itens de mídia são listados corretamente.
4. **Metadados (`/meta/:type/:id.json`):** Valida títulos, sinopses e imagens dos itens.
5. **Stream Endpoint (`/stream/:type/:id.json`):** Valida a geração da URL de streaming.
6. **Simulação Real do Player de Vídeo (HTTP 206 Range Request):**
   - O teste envia um cabeçalho `Range: bytes=0-1024` para a URL retornada (idêntico ao comportamento dos players ExoPlayer/VLC/Stremio).
   - Valida se o servidor responde com **`HTTP 206 Partial Content`** e `Content-Type: video/mp4`.
   - Isso **comprova matematicamente e funcionalmente** que o vídeo toca sem precisar abrir o app do Stremio.

---

## 3. Política de Prevenção de Rate Limit (Google Drive)

### ⛔ Cuidado com Quotas no Google Drive:
- **Arquivo Oficial de Entrega:** `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (`NATURAL (MCSO 2018).mp4` — ~992 MB)
- **Regra:** Não executar loops massivos ou requisições repetidas contínuas contra este arquivo para não estourar a cota de download.
- Durante o desenvolvimento de novas features, caso queira testar fluxos repetitivos, utilize o ID de teste: `0ByeS4oOUV-49Zzh4R1J6R09zazQ` (Big Buck Bunny).
