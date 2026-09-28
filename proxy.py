#!/usr/bin/env python3
import http.server, urllib.request, re, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

def get_stream_url(file_id):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    opener.addheaders = [("User-Agent", "Mozilla/5.0")]
    r = opener.open(f"https://drive.usercontent.google.com/download?id={file_id}&export=download")
    html = r.read().decode("utf-8", errors="ignore")
    uuid = re.search(r'name="uuid" value="([^"]+)"', html)
    uuid = uuid.group(1) if uuid else ""
    return f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t&uuid={uuid}", opener

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_HEAD(self): self._serve(head=True)
    def do_GET(self):  self._serve(head=False)
    def _serve(self, head=False):
        fid = self.path.lstrip("/").split("?")[0]
        if not fid:
            self.send_error(400, "Use: http://localhost:8080/SEU_ID"); return
        try:
            url, opener = get_stream_url(fid)
            rng = self.headers.get("Range", "bytes=0-1")
            req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0","Range":rng})
            up = opener.open(req)
            self.send_response(206 if "Range" in self.headers else 200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            for h in ("Content-Length","Content-Range"):
                v = up.headers.get(h)
                if v: self.send_header(h, v)
            self.end_headers()
            if not head:
                while chunk := up.read(65536):
                    self.wfile.write(chunk)
        except Exception as e:
            self.send_error(500, str(e))

print(f"Proxy: http://localhost:{PORT}/<ID_DO_DRIVE>")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
