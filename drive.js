const DOWNLOAD = "https://drive.usercontent.google.com/download";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const tickets = new Map();

export async function getTicket(id) {
  const cached = tickets.get(id);
  if (cached && cached.expires > Date.now()) return cached;
  const res = await fetch(`${DOWNLOAD}?id=${encodeURIComponent(id)}&export=download`, {
    headers: { "User-Agent": UA },
  });
  const html = await res.text();
  const uuid = html.match(/name="uuid"\s+value="([^"]+)"/i)?.[1];
  const filename = html.match(/>([^<]+\.(?:mp4|mkv|webm|mov|avi))</i)?.[1];
  const ticket = { id, uuid, filename, expires: Date.now() + 8 * 60 * 1000 };
  tickets.set(id, ticket);
  return ticket;
}

export function mediaUrl(ticket) {
  const params = new URLSearchParams({ id: ticket.id, export: "download", confirm: "t" });
  if (ticket.uuid) params.set("uuid", ticket.uuid);
  return `${DOWNLOAD}?${params.toString()}`;
}

export async function proxyDrive(id, range) {
  const ticket = await getTicket(id);
  const headers = { "User-Agent": UA, Accept: "*/*" };
  if (range) headers.Range = range;
  return fetch(mediaUrl(ticket), { headers, redirect: "follow" });
}
