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

let tiktok = { user: null, conn: null, state: "idle", roomId: null, lastError: "" };
let stopTimer = null;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
               ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, clients: wss.clients.size,
      tiktok: { user: tiktok.user, state: tiktok.state, roomId: tiktok.roomId, lastError: tiktok.lastError } }));
  }
  if (p === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta charset="utf-8"><title>Cầu nối Chùa Online</title>
<body style="font-family:sans-serif;background:#17100a;color:#f3e3bb;text-align:center;padding:40px 16px">
<h1>⛩️ Cầu nối Chùa Online đang chạy</h1>
<p>Trạng thái TikTok: <b>${tiktok.state}</b>${tiktok.user ? " · @" + tiktok.user : ""}</p>
<p>Mở trang chùa tại địa chỉ này thêm <b>/?live=1</b> là dùng được.</p>
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
