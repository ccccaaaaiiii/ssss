const sdk = require("stremio-addon-sdk")

const addonBuilder = sdk.addonBuilder
const serveHTTP = sdk.serveHTTP
const PORT = Number(process.env.PORT || 7000)
const POST_URL = "https://x.com/monroesheriffny/status/1078703782916227072"
const DRIVE_VIEW_URL = "https://drive.google.com/file/d/1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z/view"
const FILE_ID = "1D8zEdsjKLe2zqSZYCjksy8ppfYMVkk3z"
const STREAM_URL = "https://drive.google.com/uc?export=download&id=" + FILE_ID

const manifest = {
  id: "co.agentgit.ssss",
  version: "0.0.1",
  name: "ssss",
  description: "proof of concept stremio addon for the confirmed post and drive video",
  resources: ["stream"],
  types: ["movie"],
  idPrefixes: ["mcso2018"],
  catalogs: []
}

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(async ({ type, id }) => {
  const normalizedId = String(id || "").toLowerCase()

  if (type !== "movie" || normalizedId !== "mcso2018") {
    return { streams: [] }
  }

  return {
    streams: [
      {
        name: "ssss",
        title: "confirmed google drive source",
        url: STREAM_URL,
        externalUrl: POST_URL,
        description: "post " + POST_URL + " drive " + DRIVE_VIEW_URL
      }
    ]
  }
})

serveHTTP(builder.getInterface(), { port: PORT })

console.log("ssss addon running at http://127.0.0.1:" + PORT + "/manifest.json")
