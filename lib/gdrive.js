const https = require('https');

/**
 * Resolve direct streaming URL for a Google Drive file, bypassing large file virus check.
 * @param {string} fileId
 * @returns {Promise<string>} direct stream URL with uuid and confirm token
 */
async function resolveGoogleDriveStream(fileId) {
    const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                const uuidMatch = data.match(/name="uuid"\s+value="([^"]+)"/);
                const confirmMatch = data.match(/name="confirm"\s+value="([^"]+)"/);
                
                if (uuidMatch) {
                    const uuid = uuidMatch[1];
                    const confirm = confirmMatch ? confirmMatch[1] : 't';
                    const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}&uuid=${uuid}`;
                    return resolve(directUrl);
                }
                
                // If no virus scan wall was triggered, return the standard direct download URL
                return resolve(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = { resolveGoogleDriveStream };
