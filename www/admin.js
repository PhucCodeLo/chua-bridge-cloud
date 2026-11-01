"use strict";
/* Bảng điều khiển Chùa Online — talks to the live page (index.html) in
   another tab of the same browser/origin: BroadcastChannel first,
   localStorage as fallback. */
const $ = s => document.querySelector(s);
const bc = ("BroadcastChannel" in window) ? new BroadcastChannel("chua-admin") : null;
let cmdSeq = 0, lastStatus = null, lastStatusAt = 0;

const GIFTS = [
  ["huong","🌹","Hoa hồng",1],["nen","🫰","Tim ngón tay",5],["hoasen","💐","Bó hoa",20],
  ["chuong","🍩","Bánh donut",30],["nguqua","🫶","Tay bắn tim",50],["ca","🐶","Chó Corgi",99],
  ["dang","🔫","Súng tiền",199],["rong","🦁","Sư tử",999],["thienha","🌌","Thiên hà",1199]
];
const TYPES = { woman:"Phật tử nữ", man:"Phật tử nam", monk:"Sư thầy", nun:"Sư cô", elder:"Cụ", child:"Em nhỏ" };

function send(name, args){
  const msg = { kind:"cmd", id: Date.now() * 1000 + (cmdSeq++ % 1000), name, args: args || {} };
  if(bc) bc.postMessage(msg);
  try{ localStorage.setItem("chua-cmd", JSON.stringify(msg)); }catch(e){}
}
function ping(){
  const msg = { kind:"ping", ts: Date.now() };
  if(bc) bc.postMessage(msg);
  try{ localStorage.setItem("chua-cmd", JSON.stringify(msg)); }catch(e){}
}

/* ---------- status rendering ---------- */
function render(st){
  lastStatus = st; lastStatusAt = Date.now();
  $("#livePill").textContent = `🟢 Đã nối trang live${st.ver ? " · " + st.ver : ""}`;
  $("#livePill").className = "pill on";
  $("#stMode").textContent = st.mode || "—";
  $("#stCount").textContent = st.count ?? "—";
  $("#stMerit").textContent = (st.congduc ?? 0).toLocaleString("vi-VN");
  $("#stConn").textContent = st.connUp ? "🟢 Đã nối kênh" : "⚪ Chưa nối";
  $("#stNarr").textContent = !st.narrOn ? "Đã tắt" : (st.narrPlaying ? `Đang giảng · ${st.narrTitle || ""}` : "Bật · đang nghỉ giữa hai bài");
  setChip("#chipMusic", st.music); setChip("#chipVoice", st.voice);
  setChip("#chipNarr", st.narrOn); setChip("#chipAuto", st.auto);
  $("#boardList").innerHTML = (st.board && st.board.length)
    ? st.board.map(([n,p], i)=>`<li>${["🥇","🥈","🥉","4.","5."][i] || ""} ${esc(n)} — <span class="pts">${p}</span></li>`).join("")
    : "<li>—</li>";
  $("#devList").innerHTML = (st.devotees && st.devotees.length)
    ? st.devotees.map(d=>`<div class="devRow"><span class="nm">${esc(d.name)}</span><span class="tp">${TYPES[d.type] || d.type}</span><button class="rm" data-name="${esc(d.name)}">✕ Cho ra</button></div>`).join("")
    : '<p class="aNote">Điện đang trống.</p>';
  document.querySelectorAll("#devList .rm").forEach(b=>b.addEventListener("click", ()=>send("remove", { name: b.dataset.name })));
}
function setChip(sel, on){
  const el = $(sel); if(!el) return;
  el.classList.toggle("on", !!on);
  el.dataset.on = on ? "1" : "";
}
function esc(t){ const d = document.createElement("div"); d.textContent = t ?? ""; return d.innerHTML; }
function checkStale(){
  if(!lastStatusAt || Date.now() - lastStatusAt > 7000){
    $("#livePill").textContent = "⚪ Chưa thấy trang live";
    $("#livePill").className = "pill off";
  }
}
if(bc) bc.onmessage = e=>{ if(e.data && e.data.kind === "status") render(e.data); };
setInterval(()=>{ /* localStorage fallback */
  try{ const raw = localStorage.getItem("chua-status"); if(raw){ const st = JSON.parse(raw); if(st.ts && st.ts !== (lastStatus && lastStatus.ts)) render(st); } }catch(e){}
}, 1500);
setInterval(()=>{ ping(); checkStale(); }, 4000);

/* ---------- controls ---------- */
$("#btnOpenLive").addEventListener("click", ()=>window.open("index.html", "_blank"));
function chipToggle(sel, cmd){
  $(sel).addEventListener("click", ()=>send(cmd, { on: !$(sel).dataset.on }));
}
chipToggle("#chipMusic", "musicSet");
chipToggle("#chipVoice", "voiceSet");
chipToggle("#chipNarr", "narrSet");
chipToggle("#chipAuto", "autoSet");
$("#btnNarrNow").addEventListener("click", ()=>send("narrNow"));
$("#btnNarrStop").addEventListener("click", ()=>send("narrStop"));
$("#btnVerse").addEventListener("click", ()=>send("verse"));
$("#btnBell").addEventListener("click", ()=>send("bell"));
$("#btnBow").addEventListener("click", ()=>send("bow"));
$("#btnReset").addEventListener("click", ()=>{ if(confirm("Làm mới trang live? (tải lại từ đầu, công đức về như mới mở)")) send("reset"); });
$("#btnClear").addEventListener("click", ()=>{ if(confirm("Cho tất cả phật tử ra khỏi điện?")) send("clear"); });

const aName = ()=> ($("#aName").value || "Sen Test").trim().slice(0, 24) || "Sen Test";
const giftSel = $("#aGift");
GIFTS.forEach(([id, icon, name, pts])=>{ const o = document.createElement("option"); o.value = id; o.textContent = `${icon} ${name} (+${pts})`; giftSel.appendChild(o); });
giftSel.value = "hoasen";
$("#btnJoin").addEventListener("click", ()=>send("join", { name: aName() }));
$("#btnChat").addEventListener("click", ()=>{ const t = $("#aChat").value.trim(); if(t) send("chat", { name: aName(), text: t }); });
$("#btnLike").addEventListener("click", ()=>send("like", { name: aName() }));
$("#btnGift").addEventListener("click", ()=>send("gift", { name: aName(), giftId: giftSel.value }));
$("#btnFill8").addEventListener("click", ()=>send("fill", { n: 8 }));
$("#btnFill15").addEventListener("click", ()=>send("fillTo", { n: 15 }));
$("#btnFill32").addEventListener("click", ()=>send("fillTo", { n: 999 }));

/* ---------- narration voice tuning (phone voice) ---------- */
const rgP = $("#rgPitch"), rgR = $("#rgRate");
function loadVoiceSet(){
  let v = {}; try{ v = JSON.parse(localStorage.getItem("chua-narr-set") || "{}"); }catch(e){}
  if(v.pitch != null){ rgP.value = v.pitch; $("#pitchVal").textContent = (+v.pitch).toFixed(2); }
  if(v.rate != null){ rgR.value = v.rate; $("#rateVal").textContent = (+v.rate).toFixed(2); }
}
function saveVoiceSet(){
  $("#pitchVal").textContent = (+rgP.value).toFixed(2);
  $("#rateVal").textContent = (+rgR.value).toFixed(2);
  try{ localStorage.setItem("chua-narr-set", JSON.stringify({ pitch: +rgP.value, rate: +rgR.value })); }catch(e){}
}
rgP.addEventListener("input", saveVoiceSet);
rgR.addEventListener("input", saveVoiceSet);
$("#btnVoiceDefault").addEventListener("click", ()=>{ rgP.value = 0.72; rgR.value = 0.96; saveVoiceSet(); });
$("#btnTryVoice").addEventListener("click", ()=>{
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance("Nam mô A Di Đà Phật. Nguyện cầu cho chư vị Phật tử thân tâm thường an lạc, vạn sự cát tường.");
  u.lang = "vi-VN"; u.pitch = +rgP.value; u.rate = +rgR.value;
  const vs = speechSynthesis.getVoices().filter(v=>v.lang && v.lang.toLowerCase().startsWith("vi"));
  const alt = vs.find(v=>/minh|male/i.test(v.name)) || vs.find(v=>v !== vs[0]);
  if(alt) u.voice = alt; else if(vs[0]) u.voice = vs[0];
  speechSynthesis.speak(u);
});
loadVoiceSet();
ping();
