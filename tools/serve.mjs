// Local dev server (no dependencies). Caching is off so edits show up on a normal refresh.
// Usage: npm start            -> http://localhost:5173
//        npm run start:lan    -> also reachable from your phone on the same Wi-Fi
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 5173;
const LAN = process.argv.includes("--lan");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || rel.includes("/data-src/")) { res.writeHead(403).end("Forbidden"); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
});

server.listen(PORT, LAN ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Koine Practice running at http://localhost:${PORT}  (Ctrl+C to stop)`);
  if (LAN) {
    for (const nets of Object.values(networkInterfaces())) for (const n of nets || []) {
      if (n.family === "IPv4" && !n.internal) console.log(`  On your phone: http://${n.address}:${PORT}`);
    }
  }
});
