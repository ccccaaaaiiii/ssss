const http = require('http');
const https = require('https');
const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('../addon');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    reject(new Error(`Failed to parse JSON from ${url}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

function testStreamRange(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Range': 'bytes=0-1024'
            }
        }, (res) => {
            resolve({
                statusCode: res.statusCode,
                contentType: res.headers['content-type'],
                contentRange: res.headers['content-range'],
                contentLength: res.headers['content-length'],
                acceptRanges: res.headers['accept-ranges']
            });
            res.resume(); // discard stream
        }).on('error', reject);
    });
}

async function runE2ETests() {
    console.log('=== INICIANDO TESTE END-TO-END DO ADDON STREMIO ===\n');
    
    // 1. Iniciar servidor local
    const { server, url } = await serveHTTP(addonInterface, { port: 7001 });
    const baseUrl = url.replace(/\/manifest\.json$/, '');
    console.log(`[1] Servidor Stremio rodando em: ${baseUrl}`);
    
    try {
        // 2. Testar /manifest.json
        console.log('\n[2] Testando /manifest.json...');
        const manifestRes = await fetchJson(`${baseUrl}/manifest.json`);
        console.log(`    Status: ${manifestRes.status}`);
        console.log(`    Nome do Addon: ${manifestRes.data.name}`);
        console.log(`    Recursos: ${JSON.stringify(manifestRes.data.resources)}`);
        console.log(`    Tipos: ${JSON.stringify(manifestRes.data.types)}`);
        if (!manifestRes.data.id || manifestRes.status !== 200) {
            throw new Error('Falha no Manifesto');
        }
        console.log('    -> Manifesto VÁLIDO ✅');

        // 3. Testar Catálogo
        console.log('\n[3] Testando /catalog/movie/mcso_catalog.json...');
        const catalogRes = await fetchJson(`${baseUrl}/catalog/movie/mcso_catalog.json`);
        console.log(`    Status: ${catalogRes.status}`);
        console.log(`    Metas retornados: ${catalogRes.data.metas.length}`);
        console.log(`    Primeiro item: ${catalogRes.data.metas[0].name} (${catalogRes.data.metas[0].id})`);
        if (!catalogRes.data.metas || catalogRes.data.metas.length === 0) {
            throw new Error('Catálogo vazio');
        }
        console.log('    -> Catálogo VÁLIDO ✅');

        // 4. Testar Metadados
        console.log('\n[4] Testando /meta/movie/mcso_natural_2018.json...');
        const metaRes = await fetchJson(`${baseUrl}/meta/movie/mcso_natural_2018.json`);
        console.log(`    Status: ${metaRes.status}`);
        console.log(`    Título: ${metaRes.data.meta.name}`);
        console.log(`    Gêneros: ${JSON.stringify(metaRes.data.meta.genres)}`);
        if (!metaRes.data.meta) {
            throw new Error('Metadados não encontrados');
        }
        console.log('    -> Metadados VÁLIDOS ✅');

        // 5. Testar Stream
        console.log('\n[5] Testando /stream/movie/mcso_natural_2018.json...');
        const streamRes = await fetchJson(`${baseUrl}/stream/movie/mcso_natural_2018.json`);
        console.log(`    Status: ${streamRes.status}`);
        console.log(`    Streams disponíveis: ${streamRes.data.streams.length}`);
        const stream = streamRes.data.streams[0];
        console.log(`    Stream nome: ${stream.name}`);
        console.log(`    Stream URL: ${stream.url.substring(0, 80)}...`);
        if (!stream || !stream.url) {
            throw new Error('Stream URL não gerada');
        }
        console.log('    -> Endpoint de Stream VÁLIDO ✅');

        // 6. Testar Range Request do Player de Vídeo (Reprodução real)
        console.log('\n[6] Testando Streaming Real de Vídeo (Range Request HTTP 206)...');
        const playback = await testStreamRange(stream.url);
        console.log(`    Status Code do Vídeo: ${playback.statusCode}`);
        console.log(`    Content-Type: ${playback.contentType}`);
        console.log(`    Content-Range: ${playback.contentRange}`);
        console.log(`    Content-Length (chunk): ${playback.contentLength} bytes`);
        
        if (playback.statusCode !== 206) {
            throw new Error(`Falha no streaming: Esperado HTTP 206, recebido HTTP ${playback.statusCode}`);
        }
        if (!playback.contentType || !playback.contentType.includes('video')) {
            throw new Error(`Falha no streaming: Content-Type inválido (${playback.contentType})`);
        }
        console.log('    -> Reprodução de Vídeo COMPROVADA e FUNCIONANDO ✅');

        console.log('\n==================================================');
        console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
        console.log('==================================================\n');
    } finally {
        server.close();
    }
}

runE2ETests().catch(err => {
    console.error('❌ ERRO NO TESTE:', err);
    process.exit(1);
});
