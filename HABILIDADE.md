# HABILIDADE — Teste REAL do Stremio usando apenas o terminal
**Para quem é:** agentes de IA (e humanos) que só têm um terminal headless — sem mouse, sem monitor, sem GUI.
**O que ensina:** instalar o app Stremio de verdade, instalar o addon pela URL, navegar na Explorar, dar play
no vídeo e **provar** que o streaming funciona — tudo por linha de comando, com capturas de tela como evidência.
**Validado por:** agente `arena` em 2026-09-28 (Stremio flatpak v1.2.0, addon MCSO Drive). As capturas de cada
etapa estão na **branch `Screenshot`**, pasta `screenshots/`.
**Tempo estimado:** ~10–15 min (o download do flatpak é o maior pedaço).

---

## 0. O que você vai conseguir fazer
1. Instalar o **Stremio real** (flatpak) dentro de uma **tela virtual (Xvfb)**;
2. Automatizar o app com `xdotool` (mouse/teclado) e capturar cada tela com `import`;
3. Instalar o addon via URL (`http://127.0.0.1:7000/manifest.json`) pela interface;
4. Navegar em **Explorar**, abrir o item, ver os streams e **dar play**;
5. Levantar **provas de rede** (bytes fluindo + `206` com `Content-Range`) de que o vídeo toca pelo proxy.

---

## 1. Pré-requisitos — checar o terreno
```bash
id; df -h / | tail -1
for t in flatpak apt-get sudo xvfb-run xdotool import curl; do
  printf "%-12s" "$t"; which $t 2>/dev/null || echo "-"
done
curl -s -o /dev/null -w "addon local: %{http_code}\n" http://127.0.0.1:7000/manifest.json
```
Você precisa de: `sudo` (ou root), ~2 GB livres, rede para o Flathub, e o addon rodando localmente.

## 2. Instalar as ferramentas
```bash
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  flatpak xvfb xdotool x11-utils dbus dbus-x11 imagemagick libgbm1 libnss3 libasound2t64
```
> `imagemagick` = capturas (`import`/`convert`). `dbus-x11` = o Stremio (Electron) espera um barramento.

## 3. Instalar o Stremio (flatpak)
```bash
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y --noninteractive flathub com.stremio.Stremio   # ~1–2 GB de runtimes
flatpak list --user | head
```
**Fallback** (se o flatpak/bwrap falhar no sandbox): baixe o `.deb` oficial em
`https://www.stremio.com/downloads` e `sudo apt install ./stremio*.deb` (com `xvfb` o resto do guia é igual).

## 4. Subir a mesa virtual (Xvfb)
```bash
nohup Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
sleep 2 && DISPLAY=:99 xdpyinfo | head -3   # deve imprimir "name of display: :99"
```
> Se o processo morrer entre chamadas de terminal, use o gerenciador de processos do seu ambiente
> (ex.: `start_process`) para manter `Xvfb` e o Stremio vivos. `nohup ... &` também funciona na maioria.

## 5. Ligar o addon (servidor local de teste)
```bash
cd <repo> && PORT=7000 node addon.js &     # ou: npm start
curl -s http://127.0.0.1:7000/manifest.json | head -5
```

## 6. Ligar o Stremio na mesa virtual
```bash
DISPLAY=:99 dbus-run-session -- flatpak run com.stremio.Stremio &
```
Ignore os avisos: `MESA-EGL: DRI3` (sem GPU — renderiza por software), `PipeWire` (sem áudio),
`portal.Background` (falta desktop portal). Nenhum impede o teste.
~5–10 s depois, tire a primeira captura (§7.1). **Nesta versão (1.2.0) o Stremio abre sem pedir login.**

---

## 7. Técnica de automação GUI só com terminal

### 7.1 Capturas de tela
```bash
mkdir -p shots
DISPLAY=:99 import -window root shots/01-primeira-tela.png
identify shots/01-primeira-tela.png     # confirma dimensão real (ex.: 1920x1080)
```

### 7.2 Mapeamento de coordenadas (a matemática)
A imagem que você "vê" costuma chegar redimensionada. Descubra o fator:
```
escala = largura_real_da_imagem / largura_como_você_esta_lendo
```
No meu caso: `identify` deu **1920** e eu lia a imagem em **~1568** → **escala ≈ 1,2245**.
Para clicar num elemento que você vê na posição (x, y):
```bash
DISPLAY=:99 xdotool mousemove $((x*12245/10000)) $((y*12245/10000))
```
**Calibre primeiro** num elemento óbvio (ex.: ícone da barra lateral) e confirme pelo *tooltip*
que aparece na captura seguinte antes de sair clicando em tudo.

### 7.3 Clique que "não pega" → teclado resolve
Webviews (diálogos do Stremio) às vezes ignoram `xdotool click`. Sequência que funciona:
```bash
# clique "duro" (funciona na maioria dos casos):
DISPLAY=:99 xdotool mousemove X Y; sleep 0.7
DISPLAY=:99 xdotool mousedown 1; sleep 0.25; DISPLAY=:99 xdotool mouseup 1

# fallback de TECLADO (funciona em 100% dos diálogos que testei):
DISPLAY=:99 xdotool key Tab        # move o foco
DISPLAY=:99 xdotool key space      # ativa o botão focado
DISPLAY=:99 xdotool key Return     # ativa o botão primário (ex.: Install)
DISPLAY=:99 xdotool type --delay 25 "http://127.0.0.1:7000/manifest.json"
```

### 7.4 Sempre valide com captura
Depois de **cada** ação: `DISPLAY=:99 import -window root shots/NN-descricao.png` e leia a imagem.
Nunca assuma que o clique funcionou.

---

## 8. Roteiro completo (com as coordenadas que usei em 1920×1080)
> Coordenadas do **meu** mapeamento (escala 1,2245). Recalcule para o seu caso (§7.2).

| # | Ação | Comando | Esperado |
|---|---|---|---|
| 1 | Tela inicial | captura `01` | Board "Popular" carregando |
| 2 | Addons (peça) | `mousemove 49 533` + clique | página "Installed": Cinemeta, YouTube… |
| 3 | "+ Add addon" | `mousemove 1302 181` + clique | diálogo com campo "Paste addon URL" |
| 4 | Digitar URL | `mousemove 849 562` + clique + `type` a URL | URL no campo |
| 5 | Submeter | `key Tab` + `key space` (ou Enter) | diálogo **"MCSO Drive vX.Y.Z · Supported types…"** |
| 6 | Instalar | `key Return` (botão primário = **Install**) | addon na lista com botão **Uninstall** |
| 7 | Explorar | `mousemove 49 266` + clique | Discover com 3 dropdowns (tipo/catálogo/gênero) |
| 8 | Abrir catálogos | `mousemove 476 181` + clique | lista de catálogos — **o do seu addon aparece aqui** |
| 9 | Escolher o catálogo | clique no nome do seu catálogo | itens do addon em grade, com poster |
| 10 | Abrir item | clique no poster | página do item + **lista de streams** |
| 11 | Dar play | clique no 1º stream | player abre, mostra qualidade/duração reais |
| 12 | Capturar evidências | §9 | bytes fluindo + `206` |

## 9. Prova de que o vídeo ESTÁ fluindo (não é só tela bonita)
```bash
# (a) conexões do player no addon e do proxy para o Google:
ss -tin | grep -A1 ":7000" | grep -E "bytes_sent|bytes_received" | head -6
ss -tn | grep ":443" | head -6          # IPs do Google (74.125.x / 192.178.x)

# (b) seek no MEIO do arquivo (o player faz isso ao buscar): tem que voltar 206:
curl -s -D - -o /dev/null -H "Range: bytes=500000000-500000100" \
  "http://127.0.0.1:7000/drive/<FILE_ID>/video.mp4" | grep -iE "HTTP/|content-range|content-type"
# esperado: HTTP/1.1 206 · content-range: bytes 500000000-500000100/<total> · video/mp4
```
Contadores `bytes_sent` crescendo (ordem de MB) = o player está recebendo o stream pelo proxy. ✔

## 10. Regras de segurança (COTA — leia antes de dar play)
- O **arquivo oficial de produção** tem cota diária do Google: faça **UMA única sessão** de playback
  ("checagem final"), nunca loops. Para testes repetidos, use o **ID de teste descartável** do `AGENTS.md`.
- O catálogo/posters (`/thumbnail?id=`) não consomem cota de download de vídeo.
- Testes de `Range`/`206` com 1 byte não estouram cota relevante — pode fazê-los à vontade.

## 11. Artefatos do ambiente headless (NÃO são bugs do addon)
| Sintoma | Causa | Como confirmar |
|---|---|---|
| Relógio de playback congela | sem GPU + sem PipeWire (áudio) | `bytes_sent` continua subindo |
| Quadro preto do vídeo | renderização software/Escuro | player reconhece codec/qualidade/duração |
| Clique em botão de diálogo não pega | webview ignora eventos sintéticos | use Tab+Espaço (§7.3) |
| Avisos MESA/PipeWire/portal | falta de dispositivos no sandbox | ignorar |

## 12. Referência rápida (copiar e colar)
```bash
# --- setup (uma vez) ---
sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  flatpak xvfb xdotool x11-utils dbus dbus-x11 imagemagick libgbm1 libnss3 libasound2t64
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y --noninteractive flathub com.stremio.Stremio
nohup Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &

# --- sessão de teste ---
PORT=7000 node addon.js &                                             # terminal 1
DISPLAY=:99 dbus-run-session -- flatpak run com.stremio.Stremio &     # terminal 2
DISPLAY=:99 import -window root shots/01.png                          # a cada passo
DISPLAY=:99 xdotool mousemove 1302 181 mousedown 1 mouseup 1          # clique
DISPLAY=:99 xdotool type --delay 25 "http://127.0.0.1:7000/manifest.json"
DISPLAY=:99 xdotool key Tab space Return                              # diálogos
ss -tin | grep -A1 ":7000" | grep bytes_sent | head -3                # evidência
```

## 13. Evidências deste caso
- **Branch `Screenshot`** → pasta `screenshots/`: as ~20 capturas numeradas do roteiro inteiro
  (instalação, Explorar, catálogo, streams, player, lista final com "Uninstall") +
  `painel-provas-stremio-real.png` (montagem 2×2 das provas principais).
- **`RELATORIO.md`** (ADDENDUM no `master`): números da validação (~172 MB fluídos, seek `206` no byte 500 M).

---
*Melhorias, outros atalhos de teclado, novas telas: atualize este arquivo no `master` e registre no commit.*
