# ssss

Stremio addon that finds public Google Drive videos shared on X and streams them.

Branch: `grokb46` (from master only).

## What it does

1. Scan a public X profile, a post URL, or a Drive link — no API keys
2. Expand `t.co` short links and keep `drive.google.com/file/d/{ID}`
3. Proxy the Drive file so it **plays** (Range / 206) instead of downloading

## Confirmed source

- Profile: https://x.com/monroesheriffny
- Post: https://x.com/monroesheriffny/status/1078703782916227072
- File: `NATURAL (MCSO 2018).mp4`
- Drive: https://drive.google.com/file/d/1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z/view

Extraction steps: [EXTRACTION.md](./EXTRACTION.md)

## Run locally

```sh
node addon.js
```

Addon manifest: `http://127.0.0.1:7000/manifest.json`

Install that URL in Stremio → Addons. The catalog lists Drive files; the stream handler points at `/drive/{ID}` on the same process.

## Layout

| File | Role |
|------|------|
| `addon.js` | Stremio protocol + Drive proxy |
| `scraper.js` | X syndication + oEmbed + t.co expand |
| `drive.js` | uuid + confirm=t ticket and Range proxy |
| `package.json` | Node 18+, no extra deps |
