const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { resolveGoogleDriveStream } = require('./lib/gdrive');

// ID oficial de produção do arquivo confirmado no Google Drive
const OFFICIAL_FILE_ID = '1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z';

// Manifesto do Addon Stremio
const manifest = {
    id: 'org.stremio.ssss.monroesheriff',
    version: '1.0.0',
    name: 'Monroe Sheriff NY - Addon',
    description: 'Extensão para reprodução de vídeos do perfil @monroesheriffny extraídos via Google Drive.',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'other'],
    idPrefixes: ['mcso_'],
    catalogs: [
        {
            type: 'movie',
            id: 'mcso_catalog',
            name: 'Monroe County Sheriff NY'
        },
        {
            type: 'other',
            id: 'mcso_catalog_other',
            name: 'Monroe County Sheriff NY (Outros)'
        }
    ]
};

const builder = new addonBuilder(manifest);

// Dados do vídeo
const VIDEO_ITEM = {
    id: 'mcso_natural_2018',
    type: 'movie',
    name: 'NATURAL (MCSO 2018)',
    poster: 'https://pbs.twimg.com/profile_images/1582046467006840833/2tQYg8jV_400x400.jpg',
    background: 'https://pbs.twimg.com/profile_images/1582046467006840833/2tQYg8jV_400x400.jpg',
    description: 'Vídeo oficial MCSO 2018 - Natural. Extraído da postagem no perfil @monroesheriffny no X.',
    genres: ['Documentary', 'Community']
};

// Handler do Catálogo
builder.defineCatalogHandler(({ type, id }) => {
    if (id === 'mcso_catalog' || id === 'mcso_catalog_other') {
        return Promise.resolve({
            metas: [
                {
                    id: VIDEO_ITEM.id,
                    type: type,
                    name: VIDEO_ITEM.name,
                    poster: VIDEO_ITEM.poster,
                    description: VIDEO_ITEM.description
                }
            ]
        });
    }
    return Promise.resolve({ metas: [] });
});

// Handler de Metadados
builder.defineMetaHandler(({ type, id }) => {
    if (id === 'mcso_natural_2018') {
        return Promise.resolve({
            meta: {
                ...VIDEO_ITEM,
                type: type || 'movie'
            }
        });
    }
    return Promise.resolve({ meta: null });
});

// Handler do Stream de Vídeo
builder.defineStreamHandler(async ({ type, id }) => {
    if (id === 'mcso_natural_2018') {
        try {
            const streamUrl = await resolveGoogleDriveStream(OFFICIAL_FILE_ID);
            return {
                streams: [
                    {
                        name: 'Google Drive HD',
                        title: 'NATURAL (MCSO 2018) - 1080p MP4 (Direto)',
                        url: streamUrl
                    }
                ]
            };
        } catch (err) {
            console.error('Erro ao resolver stream do Google Drive:', err);
            return { streams: [] };
        }
    }
    return { streams: [] };
});

module.exports = builder.getInterface();

// Inicialização do servidor HTTP caso executado diretamente
if (require.main === module) {
    const port = process.env.PORT || 7000;
    serveHTTP(builder.getInterface(), { port }).then(({ url }) => {
        console.log(`Addon Stremio ativo em: ${url}`);
        console.log(`Manifesto: ${url}/manifest.json`);
    });
}
