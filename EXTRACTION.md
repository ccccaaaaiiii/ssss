# Metodo de Extracao — ssss addon

## Objetivo
Documentar o processo manual de descoberta da postagem e extracao do link do Google Drive, de modo que seja reproduzivel e sirva de base para automatizacao futura.

## Fontes confirmadas
- Perfil X: https://x.com/monroesheriffny
- Postagem base: https://x.com/monroesheriffny/status/1078703782916227072
- Arquivo no Google Drive: NATURAL (MCSO 2018).mp4
- File ID do Drive: 1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z
- URL de visualizacao: https://drive.google.com/file/d/1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z/view
- URL de stream: https://drive.google.com/uc?export=download&id=1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z

## Passo a passo (manual)

### 1. Localizar a postagem
1. Acessar https://x.com/monroesheriffny
2. Encontrar a postagem com ID 1078703782916227072
3. Confirmar que a postagem referencia o video "NATURAL (MCSO 2018).mp4"

### 2. Extrair o link do Google Drive
1. Dentro da postagem, localizar o link publico do Google Drive
2. Copiar a URL de visualizacao: https://drive.google.com/file/d/1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z/view
3. Extrair o file ID da URL: 1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z
   - Padrao: https://drive.google.com/file/d/<FILE_ID>/view
   - FILE_ID e a string entre /d/ e /view

### 3. Construir a URL de stream
- Formato: https://drive.google.com/uc?export=download&id=<FILE_ID>
- Exemplo: https://drive.google.com/uc?export=download&id=1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z

### 4. Injetar no addon
- Atualizar FILE_ID e DRIVE_VIEW_URL em addon.js
- O idPrefix do manifest e "mcso2018" — o Stremio mapeia o conteudo com esse prefixo para este addon

## Validacao
1. `npm start` (ou `PORT=7000 node addon.js`)
2. `curl http://127.0.0.1:7000/manifest.json`
3. `curl http://127.0.0.1:7000/stream/movie/mcso2018`
4. Confirmar que a resposta contem o URL de stream correto
5. Abrir o URL de stream em um player para confirmar que o video carrega

## Notas
- O Google Drive pode exigir confirmacao de permissao para arquivos grandes; o endpoint /uc?export=download retorna uma pagina de confirmacao que o player pode precisar resolver
- A automatizacao futura pode usar a API do Google Drive (drive.files.get) ou fazer scraping da pagina publica

## Estado atual
- [x] FILE_ID corrigido em addon.js (na branch kilo-agent)
- [x] EXTRACTION.md criado
- [x] Validar addon localmente
- [x] manifest.json responde com idPrefix mcso2018
- [x] stream/movie/mcso2018.json retorna stream com FILE_ID correto