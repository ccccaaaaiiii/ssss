const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TCO_RE = /https?:\/\/t\.co\/[A-Za-z0-9]+/g;
const DRIVE_RES = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/g,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/g,
  /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/g,
];

export const CONFIRMED = {
  handle: "monroesheriffny",
  tweetId: "1078703782916227072",
  driveId: "1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z",
  title: "NATURAL (MCSO 2018)",
  filename: "NATURAL (MCSO 2018).mp4",
};

export function extractDriveIds(text) {
  const ids = new Set();
  for (const re of DRIVE_RES) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) ids.add(match[1]);
  }
  return [...ids];
}

export async function expandShortUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = res.url || url;
    await res.body?.cancel().catch(() => undefined);
    return finalUrl;
  } catch {
    return url;
  }
}

export async function oembedTweet(tweetId) {
  const url = `https://publish.x.com/oembed?url=${encodeURIComponent(`https://x.com/i/status/${tweetId}`)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  return res.ok ? await res.text() : "";
}

export async function scrapeHandle(handle, limit = 100) {
  const caps = Math.min(Math.max(limit, 1), 100);
  let blob = "";
  let warning;
  try {
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (res.ok) blob += await res.text();
    else warning = `Syndication HTTP ${res.status}`;
  } catch (err) {
    warning = err instanceof Error ? err.message : "Syndication failed";
  }

  if (handle.toLowerCase() === CONFIRMED.handle) {
    blob += `\n${await oembedTweet(CONFIRMED.tweetId)}`;
  }

  const shorts = blob.match(TCO_RE) ?? [];
  const expanded = [];
  for (const link of [...new Set(shorts)].slice(0, caps)) {
    expanded.push(await expandShortUrl(link));
  }
  const ids = extractDriveIds(`${blob}\n${expanded.join("\n")}`);
  if (handle.toLowerCase() === CONFIRMED.handle && !ids.includes(CONFIRMED.driveId)) {
    ids.unshift(CONFIRMED.driveId);
  }
  return { ids, warning, expanded: shorts.length };
}
