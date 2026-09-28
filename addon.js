#!/usr/bin/env node
/**
 * ssss — Stremio addon
 *
 * 1. Scan a public X profile (syndication + oEmbed, no API key)
 * 2. Expand t.co links and keep Google Drive file ids
 * 3. Proxy Drive with uuid + confirm=t so Stremio streams instead of downloading
 *
 * Confirmed extraction method (master README):
 *   post https://x.com/monroesheriffny/status/1078703782916227072
 *   oEmbed → t.co → https://drive.google.com/file/d/1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z/view
 */
import http from "node:http";
import { CONFIRMED, scrapeHandle } from "./scraper.js";
import { getTicket, proxyDrive } from "./drive.js";

const PORT = Number(process.env.PORT || 7000);
const PREFIX = "ssss:";

const manifest = {
  id: "com.ssss.drive",
  version: "0.2.0",
  name: "ssss",
  description: "Public Google Drive videos shared on X. No API keys.",
  catalogs: [
    {
      type: "movie",
      id: "ssss",
      name: "ssss · Drive from X",
      extra: [{ name: "search", isRequired: false }],
    },
  ],
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  idPrefixes: [PREFIX],
};

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function originOf(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function metaOf(id, origin, title) {
  return {
    id: PREFIX + id,
    type: "movie",
    name: title || id,
    poster: `${origin}/poster/${id}`,
    posterShape: "landscape",
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === "/manifest.json") {
      json(res, manifest);
      return;
    }

    if (path.startsWith("/catalog/")) {
      const extra = path.replace(/\.json$/, "");
      const search = extra.match(/search=([^/&]+)/)?.[1];
      const handle = decodeURIComponent(search || CONFIRMED.handle);
      const origin = originOf(req);
      const scraped = await scrapeHandle(handle, 100);
      const metas = [];
      for (const id of scraped.ids) {
        const ticket = await getTicket(id).catch(() => ({ id }));
        metas.push(metaOf(id, origin, ticket.filename?.replace(/\.[a-z0-9]+$/i, "") || CONFIRMED.title));
      }
      json(res, { metas });
      return;
    }

    if (path.startsWith("/meta/") || path.startsWith("/stream/")) {
      const raw = path.replace(/\.json$/, "").split("/").pop() || "";
      const id = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
      const origin = originOf(req);
      if (path.startsWith("/meta/")) {
        json(res, { meta: metaOf(id, origin) });
        return;
      }
      json(res, {
        streams: [{ name: "ssss", url: `${origin}/drive/${id}` }],
      });
      return;
    }

    if (path.startsWith("/drive/")) {
      const id = path.slice("/drive/".length);
      const range = req.headers.range || null;
      const upstream = await proxyDrive(id, range);
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
        "Content-Type": upstream.headers.get("content-type") || "video/mp4",
        "Content-Disposition": "inline",
      };
      const cr = upstream.headers.get("content-range");
      const cl = upstream.headers.get("content-length");
      if (cr) headers["Content-Range"] = cr;
      if (cl) headers["Content-Length"] = cl;
      res.writeHead(upstream.status, headers);
      if (!upstream.body) {
        res.end();
        return;
      }
      for await (const chunk of upstream.body) res.write(chunk);
      res.end();
      return;
    }

    json(res, { err: "not found" }, 404);
  } catch (err) {
    json(res, { err: err instanceof Error ? err.message : "error" }, 500);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ssss addon listening on http://127.0.0.1:${PORT}/manifest.json`);
});
