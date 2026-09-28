# Extraction method (confirmed)

## Post
https://x.com/monroesheriffny/status/1078703782916227072

## Steps (no API key)

1. `GET https://publish.x.com/oembed?url=https://x.com/i/status/1078703782916227072`
2. Read `https://t.co/…` from the HTML/JSON payload
3. Follow the `t.co` redirect
4. Keep destinations matching `drive.google.com/file/d/{ID}`
5. Confirmed file id: `1D8zEdsjkLe2zqSZYCjksy8ppfYMVkk3z` (lowercase `k` at position 9)
6. File name: `NATURAL (MCSO 2018).mp4`

## Stream (no API key)

Large Drive files return a virus-scan HTML form. The playable URL is:

```
GET drive.usercontent.google.com/download?id=ID&export=download
  → extract form field uuid
GET drive.usercontent.google.com/download?id=ID&export=download&confirm=t&uuid=UUID
  → video/mp4, Accept-Ranges: bytes, 206 Partial Content
```

The proxy **must** rewrite `Content-Disposition: attachment` to `inline` and drop Drive CSP/CORP headers, or Stremio and browsers download instead of playing.

## Profile scan

`syndication.twitter.com/srv/timeline-profile/screen-name/{handle}` returns ~20 recent posts and `t.co` links. Older posts (this 2018 film) do not appear there — oEmbed of known tweet ids is the fallback.
