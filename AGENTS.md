# AGENTS — Regras de Trabalho e Fluxo de Desenvolvimento

Este documento define como todos os agentes de IA e desenvolvedores devem colaborar neste repositório.

---

## 1. Organização de Branches e Responsabilidades

| Branch | Responsabilidade | O que aceita |
|---|---|---|
| **`master`** | **Fonte Canônica de Documentação** | `README.md`, `PRD.md`, `CHALLENGES.md`, `AGENTS.md`, `.gitignore` |
| **`gem37f`**, **`son46l`**, **`grokb46`**, **`kilo-agent`** | **Implementação de Código** | Código-fonte do Addon (JS/TS), manifests, rotas, testes da branch |

### Regras Obrigatórias:
1. **Atualizações de Documentação e Requisitos:**
   - Sempre que uma regra, especificação técnica ou requisito for alterado/adicionado, deve ser comitado e enviado para a branch **`master`**.
2. **Desenvolvimento de Código:**
   - O código funcional, dependências e implementações do addon devem ser feitos exclusivamente na **branch de trabalho do respectivo agente** (ex: `gem37f`).
3. **Sincronização:**
   - As branches de implementação devem sempre fazer merge da `master` para manter o alinhamento com os requisitos canônicos.
4. **Higiene do Repositório:**
   - Nunca comitar `node_modules/`, logs temporários ou arquivos binários.

---

## 2. Política de Testes e Prevenção de Rate Limit (Google Drive)

### ⛔ Proibição Estrita no Link de Produção
- **Arquivo Oficial:** `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (`NATURAL (MCSO 2018).mp4` — ~992 MB)
- **Regra:** **NUNCA** executar loops de testes automatizados ou requisições repetidas contra este arquivo. O Google Drive bloqueia temporariamente o download quando a cota do arquivo é excedida (*"Download quota exceeded"*).
- Este arquivo fica reservado exclusivamente para a **validação manual final de entrega**.

---

## 3. Links Oficiais para Testes e Desenvolvimento

Para testes de desenvolvimento, utilize as referências públicas seguras e de reputação verificada:

### A. Para testar o Resolvedor do Google Drive (Fluxo completo com token/uuid)
- **Fonte Reputável / Open-Source (Blender Foundation / yt-dlp test suite):**
  - **Arquivo:** `Big Buck Bunny.mp4` (177 MB — dispara página de confirmação de vírus e token uuid)
  - **Google Drive ID:** `0ByeS4oOUV-49Zzh4R1J6R09zazQ`
  - **URL Base:** `https://drive.google.com/file/d/0ByeS4oOUV-49Zzh4R1J6R09zazQ/view`

### B. Para testar o Player de Vídeo no Stremio (Stream direto)
- **Big Buck Bunny (Direct MP4):**
  - `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
