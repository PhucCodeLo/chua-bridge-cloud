"use strict";
/* Cầu nối Chùa Online <-> TikTok LIVE — bản chạy trên mây (Render free)
   - Phục vụ trang chùa + WebSocket /ws trên cùng một địa chỉ
   - Chỉ nối TikTok khi có trang chùa đang mở (tiết kiệm), tự dò phòng live,
     tự ngắt sau 2 phút khi không còn trang nào mở
   - Cấu hình qua biến môi trường: TIKTOK_USER, EULER_API_KEY (tùy chọn)
*/
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8787;
const WWW = path.join(__dirname, "www");
const DEFAULT_USER = (process.env.TIKTOK_USER || "cuocsongvuituoihehe").replace(/^@/, "");
const EULER_KEY = process.env.EULER_API_KEY || "";

/* ---------- Giọng đọc Edge TTS (tiếng Việt neural, miễn phí) ----------
   Trang chùa gọi GET /tts?text=... để đọc lời cảm ơn + lời kinh bằng giọng
   vi-VN-HoaiMyNeural (đổi giọng qua biến TTS_VOICE). Có cache theo nội dung.
   Nếu thư viện/giọng đọc lỗi, endpoint trả 502 và trang tự dùng giọng dự phòng. */
let MsEdgeTTS = null, TTS_FORMAT = null;
try { const m = require("msedge-tts"); MsEdgeTTS = m.MsEdgeTTS; TTS_FORMAT = m.OUTPUT_FORMAT; }
catch (e) { console.log("[TTS] msedge-tts chưa sẵn sàng:", e.message); }
const TTS_VOICE = process.env.TTS_VOICE || "vi-VN-HoaiMyNeural";
const ttsCache = new Map();
/* Dự phòng khi Edge TTS bị mạng/máy chủ chặn: giọng Google Dịch (kém tự nhiên
   hơn Edge nhưng chạy được từ hầu hết mọi nơi). */
function googleTts(text) {
  const https = require("https");
  const q = encodeURIComponent(text.slice(0, 190));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${q}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, r => {
      if (r.statusCode !== 200) { r.resume(); return reject(new Error("google tts " + r.statusCode)); }
      const chunks = [];
      r.on("data", c => chunks.push(c));
      r.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}
async function ttsMp3(text) {
  if (ttsCache.has(text)) return ttsCache.get(text);
  let buf = null, edgeErr = null;
  if (MsEdgeTTS) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(TTS_VOICE, TTS_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      buf = await new Promise((resolve, reject) => {
        const chunks = [];
        audioStream.on("data", c => chunks.push(c));
        audioStream.on("end", () => resolve(Buffer.concat(chunks)));
        audioStream.on("error", reject);
      });
    } catch (e) { edgeErr = e; buf = null; }
  }
  if (!buf || !buf.length) {
    if (edgeErr) console.log("[TTS] Edge lỗi (" + String(edgeErr.message || edgeErr).slice(0, 80) + ") — dùng giọng Google dự phòng");
    buf = await googleTts(text);
  }
  if (ttsCache.size > 40) ttsCache.clear();
  ttsCache.set(text, buf);
  return buf;
}

let tiktok = { user: null, conn: null, state: "idle", roomId: null, lastError: "" };
let stopTimer = null;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
               ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/tts") {
    const text = (new URL(req.url, "http://x").searchParams.get("text") || "").slice(0, 220).trim();
    if (!text) { res.writeHead(400); return res.end(); }
    ttsMp3(text).then(buf => {
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" });
      res.end(buf);
    }).catch(e => { console.log("[TTS]", e.message); res.writeHead(502); res.end(); });
    return;
  }
  if (p === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, clients: wss.clients.size,
      tiktok: { user: tiktok.user, state: tiktok.state, roomId: tiktok.roomId, lastError: tiktok.lastError } }));
  }
  if (p === "/") {
    /* "/?live=1" is the natural URL to type — send it to the temple page. */
    if (req.url.includes("live=1")) {
      res.writeHead(302, { Location: "/index.html?live=1" });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta charset="utf-8"><title>Cầu nối Chùa Online</title>
<body style="font-family:sans-serif;background:#17100a;color:#f3e3bb;text-align:center;padding:40px 16px">
<h1>⛩️ Cầu nối Chùa Online đang chạy</h1>
<p>Trạng thái TikTok: <b>${tiktok.state}</b>${tiktok.user ? " · @" + tiktok.user : ""}</p>
<p><a style="color:#ffd970;font-size:20px" href="/index.html?live=1">👉 Bấm vào đây để mở trang chùa</a></p>
<p style="opacity:.7">Trang này mở ra cũng là để "đánh thức" máy chủ trước buổi live.</p></body>`);
  }
  const file = path.join(WWW, p === "/" ? "index.html" : p);
  if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("404");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
                       "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: "/ws" });
function broadcast(obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(s); });
  console.log("  ->", s.slice(0, 140));
}
function userName(data) {
  const u = data && data.user;
  return (u && (u.nickname || u.uniqueId)) || "Sen ẩn danh";
}

async function startTikTok(user) {
  if (tiktok.conn && tiktok.user === user && tiktok.state !== "idle") return;
  stopTikTok();
  tiktok.user = user; tiktok.state = "connecting"; tiktok.lastError = "";
  const { TikTokLiveConnection, WebcastEvent } = require("tiktok-live-connector");
  const opts = { enableExtendedGiftInfo: true };
  if (EULER_KEY) opts.signApiKey = EULER_KEY;
  const conn = new TikTokLiveConnection(user, opts);
  tiktok.conn = conn;
  conn.on(WebcastEvent.MEMBER, d => broadcast({ type: "join", name: userName(d) }));
  conn.on(WebcastEvent.CHAT, d => broadcast({ type: "chat", name: userName(d), text: d.comment || "" }));
  conn.on(WebcastEvent.FOLLOW, d => broadcast({ type: "follow", name: userName(d) }));
  const likeAt = new Map();
  conn.on(WebcastEvent.LIKE, d => {
    const name = userName(d); const now = Date.now();
    if (now - (likeAt.get(name) || 0) < 5000) return;   /* tim bay tối đa 5s/lần/người */
    likeAt.set(name, now);
    broadcast({ type: "like", name });
  });
  conn.on(WebcastEvent.GIFT, d => {
    if (d.giftType === 1 && !d.repeatEnd) return;
    const ext = d.extendedGiftInfo || {};
    broadcast({ type: "gift", name: userName(d),
                giftName: d.giftName || ext.name || "",
                diamonds: d.diamondCount != null ? d.diamondCount : (ext.diamond_count || 0),
                count: d.repeatCount || 1 });
  });
  conn.on("streamEnd", () => { tiktok.state = "ended"; setTimeout(() => { if (wss.clients.size) startTikTok(user).catch(()=>{}); }, 20000); });
  conn.on("disconnected", () => { if (tiktok.state === "live") tiktok.state = "connecting"; });
  try {
    const state = await conn.connect();
    tiktok.state = "live"; tiktok.roomId = state.roomId;
    console.log(`[TikTok] ✅ ĐÃ NỐI @${user} roomId=${state.roomId}`);
  } catch (e) {
    tiktok.state = "waiting"; tiktok.lastError = String(e.message || e).slice(0, 110);
    console.log(`[TikTok] chưa vào được phòng @${user} (${tiktok.lastError}) — thử lại sau 15s`);
    setTimeout(() => { if (wss.clients.size && tiktok.user === user) startTikTok(user).catch(()=>{}); }, 15000);
  }
}
function stopTikTok() {
  if (tiktok.conn) { try { tiktok.conn.disconnect(); } catch (e) {} }
  tiktok.conn = null; tiktok.state = "idle"; tiktok.roomId = null;
}

wss.on("connection", (ws, req) => {
  console.log("[trang chùa] đã kết nối");
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  let user = DEFAULT_USER;
  try { user = (new URL(req.url, "http://x").searchParams.get("user") || user).replace(/^@/, ""); } catch (e) {}
  startTikTok(user).catch(e => console.log("startTikTok err", e.message));
  ws.on("close", () => {
    if (!wss.clients.size) {
      stopTimer = setTimeout(() => { console.log("[TikTok] không còn trang nào mở — ngắt kết nối"); stopTikTok(); }, 120000);
    }
  });
});

server.listen(PORT, () => console.log(`⛩️ Cầu nối mây chạy tại cổng ${PORT} — user mặc định @${DEFAULT_USER}`));
