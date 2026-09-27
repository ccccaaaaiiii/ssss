const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// ID e URL direta de reprodução do arquivo confirmado no Google Drive
const GOOGLE_DRIVE_FILE_ID = '1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z';
const DIRECT_STREAM_URL = `https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_FILE_ID}`;

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
            type: 'other',
            id: 'mcso_catalog',
            name: 'Monroe County Sheriff NY'
        }
    ]
};

const builder = new addonBuilder(manifest);

// Handler do Catálogo
builder.defineCatalogHandler(({ type, id }) => {
    if (type === 'other' && id === 'mcso_catalog') {
        return Promise.resolve({
            metas: [
                {
                    id: 'mcso_natural_2018',
                    type: 'other',
                    name: 'NATURAL (MCSO 2018)',
                    poster: 'https://pbs.twimg.com/profile_images/1582046467006840833/2tQYg8jV_400x400.jpg',
                    description: 'Vídeo NATURAL (MCSO 2018) localizado na postagem do perfil @monroesheriffny no X.'
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
                id: 'mcso_natural_2018',
                type: 'other',
                name: 'NATURAL (MCSO 2018)',
                genres: ['Documentary', 'Community'],
                poster: 'https://pbs.twimg.com/profile_images/1582046467006840833/2tQYg8jV_400x400.jpg',
                description: 'Postagem base: https://x.com/monroesheriffny/status/1078703782916227072\nArquivo Drive: NATURAL (MCSO 2018).mp4\nID: 1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z'
            }
        });
    }
    return Promise.resolve({ meta: null });
});

// Handler do Stream de Vídeo
builder.defineStreamHandler(({ type, id }) => {
    if (id === 'mcso_natural_2018') {
        return Promise.resolve({
            streams: [
                {
                    name: 'Google Drive',
                    title: 'NATURAL (MCSO 2018).mp4 - 1080p/720p',
                    url: DIRECT_STREAM_URL
                }
            ]
        });
    }
    return Promise.resolve({ streams: [] });
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
