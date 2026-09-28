# screenshots/ — Evidências visuais do teste REAL do Stremio (branch `Screenshot`)
**Data:** 2026-09-28 · **Agente:** `arena` · **App:** Stremio flatpak v1.2.0 em tela virtual (Xvfb 1920×1080)
**Contexto:** validação GUI completa do addon **MCSO Drive v2.0.0** (branch `arena`).
O passo a passo reproduzível está em **`HABILIDADE.md`** (branch `master`); os números da validação
estão no **`RELATORIO.md` → ADDENDUM** (branch `master`).
*(Binários ficam apenas nesta branch, a pedido do usuário — o restante do repositório segue sem imagens.)*

## Galeria (ordem do roteiro)

| Arquivo | O que mostra |
|---|---|
| `01-primeira-tela.png` | Stremio real abrindo direto no Board (sem login nesta versão) |
| `02-tela-addons.png` | Tooltip "Addons" na barra lateral — calibração de coordenadas (§7.2 da HABILIDADE) |
| `03-addons-page.png` | Página de Add-ons com os addons oficiais (Cinemeta, YouTube, WatchHub…) |
| `04-add-addon-dialog.png` | Diálogo **"Add addon"** com o campo "Paste addon URL" |
| `05-url-digitada.png` | URL `http://127.0.0.1:7000/manifest.json` digitada no campo |
| `06-apos-add.png` | Diálogo persistindo após cliques do xdotool — motiva o fallback de teclado (§7.3) |
| `09-tab-focus.png` | Navegação por teclado (Tab) — a técnica que resolve 100% dos diálogos |
| `10-apos-space.png` | Submissão via Espaço — o Stremio passa a buscar o manifesto |
| `11-antes-install-check.png` | ★ Confirmação **"MCSO Drive v2.0.0 · Supported types: other & movie"** (o addon foi lido de verdade) |
| `12-pos-install.png` | Lista de addons instalados logo após a instalação |
| `13-explorar.png` | Página **Explorar/Discover** com os filtros (Movie / Popular / Genre) |
| `14-dropdown-catalogo.png` | ★ Seletor de catálogos listando **"MCSO — X Profile (Drive)"** |
| `15-nosso-catalogo.png` | ★ Nosso catálogo com o item **"NATURAL (MCSO 2018)"** e poster real do Google Drive |
| `16-detalhe-item.png` | Página do item (título, gênero Documentary, sinopse com o link do X) |
| `16-painel-direito.png` | ★ Recorte dos streams: **MCSO Drive [MP4+]** e **MCSO Drive [HLS]** |
| `17-play.png` / `18-play-6s-depois.png` | Player iniciando o stream (frames escuros — decodificação software, §11 da HABILIDADE) |
| `19-t0.png` / `19-t4.png` | ★ Player tocando: **00:00:33 / 01:50:16**, qualidade **1080p** (duração real do arquivo) |
| `20-depois-seek.png` | Após seek — o mesmo player com o overlay de controles |
| `21-addons-mcso.png` | ★ **MCSO Drive v2.0.0** em "Installed" com botão **Uninstall** (instalação confirmada) |
| `painel-provas-stremio-real.png` | Montagem 2×2 das provas principais (instalação / catálogo / streams / playback) |

## Resumo das provas
1. **Instalação via GUI** a partir do `manifest.json` servido pelo addon ✔
2. **Explorar** mostra o catálogo do addon e o item com poster do Drive ✔
3. **Streams** exatamente como o endpoint `/stream` retorna ✔
4. **Playback real** com ~172 MB fluídos pelo proxy (contadores TCP) e seek `206` no meio do arquivo ✔
