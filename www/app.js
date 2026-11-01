"use strict";
/* Chùa Online v0.3.0 — 2.5D điện ảnh: nền ảnh thật + sprite phật tử tách nền.
   Event vẫn qua handleJoin / handleChat / handleGift — nối TikTok thật chỉ thay nguồn gọi. */
const $ = s => document.querySelector(s);
const stage = $("#stage"), floorLayer = $("#floorLayer"), fx = $("#fx");

const NAMES = ["Bảo Ngọc","Hoàng Long","Lan Phương","Quang Huy","Minh Anh","Khánh Vy","Thu Hà","Mai Chi",
"Đức Thịnh","Tâm An","Hải Đăng","Hồng Nhung","Văn Toàn","Tuấn Kiệt","Diệu Linh","An Nhiên","Thanh Tâm",
"Trung Kiên","Ngọc Trâm","Phúc An","Thảo Nguyên","Minh Khang","Phương Anh","Gia Bảo","Tuệ Nhi","Đức Trí",
"Khánh Linh","Hoàng Nam","Yến Nhi","Quốc Huy","Trâm Anh","Minh Đức","Hương Giang","Thanh Hà","Bình An",
"Ngọc Mai","Văn Đức","Thùy Dương","Hoàng Yến","Minh Tuấn","Lan Anh","Phúc Lâm","Tú Anh"];
const PRAYERS = ["Cầu gia đình khỏe mạnh 🙏","Mô Phật 🙏","Xin cầu bình an cho cha mẹ","Cầu công việc hanh thông",
"Cầu thi cử đỗ đạt 📚","Xin xả hết nghiệp tuần này 😌","Cầu duyên lành sớm đến 💛","Nam mô A Di Đà Phật",
"Cầu nhà nhà no ấm","Xin bình an cho người thương","Cầu sức khỏe cho ông bà","Mong mọi việc thuận buồm ⛵",
"Cầu tài lộc vừa đủ dùng","Xin tâm an, ngủ ngon 🌙","Cầu cho Quy Nhơn mưa thuận gió hòa"];
const AVCOLORS = ["#c94f4f","#4f79c9","#4fc97a","#c94fb8","#e08a2e","#7a5fd0","#2ea3a3","#b03a5b","#5b8c3e","#8a6d3b"];
const GIFTS = [
  {id:"huong",  icon:"🌹", name:"Hoa hồng",     act:"Thắp nén hương",      pts:1,   fx:"incense"},
  {id:"nen",    icon:"🫰", name:"Tim ngón tay", act:"Thắp nến",            pts:5,   fx:"candle"},
  {id:"hoasen", icon:"💐", name:"Bó hoa",       act:"Dâng hoa sen",        pts:20,  fx:"lotus"},
  {id:"chuong", icon:"🍩", name:"Bánh donut",   act:"Thỉnh chuông",        pts:30,  fx:"bell"},
  {id:"nguqua", icon:"🫶", name:"Tay bắn tim",  act:"Dâng mâm ngũ quả",    pts:50,  fx:"fruit"},
  {id:"ca",     icon:"🐶", name:"Chó Corgi",    act:"Phóng sinh cá chép",  pts:99,  fx:"carp"},
  {id:"dang",   icon:"🔫", name:"Súng tiền",    act:"Thả hoa đăng",        pts:199, fx:"lantern"},
  {id:"rong",   icon:"🦁", name:"Sư tử",        act:"Rồng Vàng hộ pháp",   pts:999, fx:"dragon"},
  {id:"thienha",icon:"🌌", name:"Thiên hà",     act:"Rồng Vàng hộ pháp",   pts:1199,fx:"dragon"},
];
/* anchors (% of stage) measured on the backdrop art */
const A = { buddha:{x:50,y:11}, burner:{x:50,y:40}, smoke:{x:50,y:33},
            candleL:{x:44,y:20}, candleR:{x:56,y:20},
            fruitL:{x:46,y:25}, fruitR:{x:54,y:25}, vaseL:{x:36,y:14}, vaseR:{x:64,y:14},
            bell:{x:88.5,y:31} };
/* seats: rows back->front {feetY %, width %, xs[]}. Back rows spread wider
   (8 across) and the front row keeps only 4 large figures flanking the
   carpet — the hall reads wide instead of two bunched columns. */
const ROWS = [
  {y:47,   w:8,    z:3, xs:[29, 39, 61, 71]},
  {y:56,   w:9,    z:4, xs:[24, 34.5, 65.5, 76]},
  {y:67.5, w:10.5, z:5, xs:[20, 31, 42, 58, 69, 80]},
  {y:75.5, w:12,   z:6, xs:[18.5, 30.5, 42.5, 54.5, 66.5, 78.5]},
  {y:85,   w:14,   z:7, xs:[17, 30, 43, 56, 69, 82]},
  {y:93.5, w:15.5, z:8, xs:[15.5, 29, 42.5, 56, 69.5, 83]},
];
const SEATS = [];
ROWS.forEach(r=>{ r.xs.forEach(x=>SEATS.push({x, y:r.y, w:r.w, z:r.z, taken:null})); });
const SPOT = {x:50, y:54, w:15.5};

let devotees = [], congduc = 0; const boardMap = new Map(), usedNames = new Set();
/* Avatar types: comment one word (nam / nữ / sư / ni / bà / tiểu / cao tăng)
   to change your devotee's form — borrowed from the community temple idea.
   Devotees are articulated CARTOON figures drawn as SVG (no image files):
   they walk in from the door, settle, and bow in prayer on their own rhythm. */
const SKIN = "#eec39b";
const TYPE_CONF = {
  woman: { robe:"#93a3b8", shade:"#7c8ca3", arm:"#5f6d84", hair:"#2e2622", bun:true, pin:true },
  man:   { robe:"#8593a8", shade:"#71809a", arm:"#55637a", hair:"#36302b", bun:false },
  monk:  { robe:"#e08a3c", shade:"#c06f27", arm:"#9c5416", bald:true, sash:true },
  nun:   { robe:"#7a5a3c", shade:"#644832", arm:"#48331f", bald:true },
  elder: { robe:"#8a5560", shade:"#74434d", arm:"#57313a", hair:"#b3aca2", bun:true },
  child: { robe:"#a9b9cb", shade:"#8fa2b8", arm:"#6d7f96", hair:"#2e2622", bun:true },
};
function shade(hex, f){ const n = parseInt(hex.slice(1), 16);
  let r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  if(f >= 0){ r += (255-r)*f; g += (255-g)*f; b += (255-b)*f; } else { r *= 1+f; g *= 1+f; b *= 1+f; }
  return `rgb(${r|0},${g|0},${b|0})`; }
function headSVG(c, type){
  return `<ellipse cx="31.5" cy="33" rx="3" ry="4.5" fill="${SKIN}"/>
    <ellipse cx="68.5" cy="33" rx="3" ry="4.5" fill="${SKIN}"/>
    <circle cx="50" cy="32" r="17" fill="url(#hg${type})"/>
    ${c.bald ? '<ellipse cx="43" cy="23" rx="5.5" ry="3.4" fill="rgba(255,255,255,.38)"/>' : ""}
    ${c.bun ? `<circle cx="50" cy="13" r="6.5" fill="url(#hg${type})"/>` : ""}
    ${c.pin ? '<circle cx="56.4" cy="11" r="1.9" fill="#f5c542"/>' : ""}`;
}
/* Devotee seen from above-behind (high-angle hall): big head, shoulders,
   shaded robe, praying arms rising in front and joining above the head. */
function figureSVG(type){
  const c = TYPE_CONF[type] || TYPE_CONF.woman;
  return `<svg viewBox="0 0 100 118" aria-hidden="true">
    <defs>
      <linearGradient id="rg${type}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(c.robe, .22)}"/><stop offset=".45" stop-color="${c.robe}"/><stop offset="1" stop-color="${shade(c.robe, -.28)}"/>
      </linearGradient>
      <radialGradient id="hg${type}" cx=".38" cy=".3" r=".95">
        <stop offset="0" stop-color="${shade(c.bald ? "#e8b98d" : c.hair, .3)}"/><stop offset="1" stop-color="${c.bald ? SKIN : c.hair}"/>
      </radialGradient>
    </defs>
    <path d="M50 34 C33 36 24 48 21 66 L25 100 C29 110 71 110 75 100 L79 66 C76 48 67 36 50 34Z" fill="url(#rg${type})" stroke="rgba(43,20,4,.30)" stroke-width="1.3"/>
    <path d="M50 50 L50 102" stroke="rgba(0,0,0,.13)" stroke-width="2.5"/>
    <path d="M34 62 C32 78 33 90 35 102 M66 62 C68 78 67 90 65 102" stroke="rgba(0,0,0,.10)" stroke-width="2" fill="none"/>
    <path d="M31 48 C39 39 61 39 69 48" stroke="rgba(255,255,255,.20)" stroke-width="3" fill="none"/>
    ${c.sash ? '<path d="M30 42 L74 70 L68 78 L26 52Z" fill="#a85b1e" opacity=".8"/>' : ""}
    <path d="M28 56 C22 34 29 14 43 6" stroke="${c.arm}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M72 56 C78 34 71 14 57 6" stroke="${c.arm}" stroke-width="13" fill="none" stroke-linecap="round"/>
    ${headSVG(c, type)}
    <ellipse cx="50" cy="4" rx="8" ry="11" fill="${SKIN}" stroke="rgba(0,0,0,.16)" stroke-width="1.2"/>
  </svg>`;
}
/* Standing/walking form for the high-angle view: narrower robe with a
   higher hem; from above, the stepping shows as alternating shoe tips
   under the hem (CSS) plus the body bob on the wrapper. */
function figureWalkSVG(type){
  const c = TYPE_CONF[type] || TYPE_CONF.woman;
  return `<svg class="wfig" viewBox="0 0 100 118" aria-hidden="true">
    <defs>
      <linearGradient id="wg${type}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(c.robe, .22)}"/><stop offset=".45" stop-color="${c.robe}"/><stop offset="1" stop-color="${shade(c.robe, -.28)}"/>
      </linearGradient>
      <radialGradient id="hg${type}" cx=".38" cy=".3" r=".95">
        <stop offset="0" stop-color="${shade(c.bald ? "#e8b98d" : c.hair, .3)}"/><stop offset="1" stop-color="${c.bald ? SKIN : c.hair}"/>
      </radialGradient>
    </defs>
    <g class="shoeL"><ellipse cx="41" cy="112" rx="7" ry="4" fill="#26221f"/></g>
    <g class="shoeR"><ellipse cx="59" cy="112" rx="7" ry="4" fill="#26221f"/></g>
    <path d="M50 34 C36 36 28 47 26 63 L29 96 C34 104 66 104 71 96 L74 63 C72 47 64 36 50 34Z" fill="url(#wg${type})" stroke="rgba(43,20,4,.28)" stroke-width="1.2"/>
    <path d="M50 84 L50 100" stroke="${c.shade}" stroke-width="2.5"/>
    ${c.sash ? '<path d="M31 40 L69 62 L63 69 L28 48Z" fill="#a85b1e" opacity=".85"/>' : ""}
    <path d="M26 54 C21 70 22 84 26 94" stroke="${c.arm}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M74 54 C79 70 78 84 74 94" stroke="${c.arm}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <circle cx="26.5" cy="97" r="3.2" fill="${SKIN}"/><circle cx="73.5" cy="97" r="3.2" fill="${SKIN}"/>
    ${headSVG(c, type)}
  </svg>`;
}
const BOW_SPRITES = { woman:1, man:1, monk:1, nun:1 };
function spriteImg(type, pose){
  if (pose === "bow" && !BOW_SPRITES[type]) pose = "sit";
  return `<img class="spr" src="assets/sp-${type}-${pose}.webp" alt="" draggable="false">`;
}
function renderFig(dev){
  const pose = dev.pose === "bow" ? "bow" : dev.el.classList.contains("walking") ? "stand" : "sit";
  dev.fig.innerHTML = spriteImg(dev.type, pose);
}
["woman","man","monk","nun","elder","child"].forEach(t =>
  ["sit","stand","bow"].forEach(p => { const i = new Image(); i.src = `assets/sp-${t}-${p}.webp`; }));
const AVATAR_WORDS = { "nam": "man", "nữ": "woman", "nu": "woman", "sư": "monk", "su": "monk",
                       "ni": "nun", "bà": "elder", "ba": "elder", "tiểu": "child", "tieu": "child",
                       "cao tăng": "monk", "cao tang": "monk" };
const AVATAR_LABEL = { man: "phật tử nam", woman: "phật tử nữ", monk: "sư thầy",
                       nun: "sư cô", elder: "bà", child: "tiểu đồng" };
const lastWish = new Map();    /* viewer's latest comment — read back as hồi hướng on their gift */
const likeThrottle = new Map();

function pickName(){
  const free = NAMES.filter(n=>!usedNames.has(n));
  if(!free.length) return null;
  const n = free[Math.floor(Math.random()*free.length)]; usedNames.add(n); return n;
}
function randDev(){ return devotees.length ? devotees[Math.floor(Math.random()*devotees.length)] : null; }
function updateTop(){ $("#devCount").textContent = devotees.filter(d=>!d.leaving).length; $("#congduc").textContent = congduc.toLocaleString("vi-VN"); }
function renderBoard(){
  const top = [...boardMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("#boardList").innerHTML = top.map(([n,p],i)=>
    `<li><span class="medal">${i+1}</span><span class="bname">${n}</span><span class="bpts">${p.toLocaleString("vi-VN")}</span></li>`).join("");
}
function ticker(msg){ const t = $("#tickerText"); t.textContent = msg; t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }
function bow(dev){ if(!dev) return; dev.el.classList.remove("bow"); void dev.el.offsetWidth; dev.el.classList.add("bow"); }
function bowAll(){ devotees.forEach(d=>{ d.el.classList.remove("bigbow"); void d.el.offsetWidth; d.el.classList.add("bigbow");
  setTimeout(()=>d.el.classList.remove("bigbow"), 2700); }); }
function say(dev, text, ms=2600){
  if(!dev) return;
  dev.bubble.textContent = text; dev.bubble.classList.add("show");
  clearTimeout(dev._bt); dev._bt = setTimeout(()=>dev.bubble.classList.remove("show"), ms);
}

/* ---------- audio ---------- */
let audioCtx = null;
function ac(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(audioCtx && audioCtx.state==="suspended") audioCtx.resume(); return audioCtx; }
function tone(freq, t0, dur, gain=.11, type="sine"){
  const c = ac(); if(!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const s = c.currentTime + t0;
  g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(gain, s+.015);
  g.gain.exponentialRampToValueAtTime(.0001, s+dur);
  o.connect(g).connect(c.destination); o.start(s); o.stop(s+dur+.05);
}
const sndBell = ()=>{ tone(1318,0,2.2,.09); tone(1975,.01,1.7,.045); tone(2637,.02,1.1,.028); };
const sndChime = ()=>{ tone(1568,0,.7,.06); tone(2093,.09,.8,.05); };
const sndPop = ()=>{ tone(660,0,.16,.07,"triangle"); };

/* ---------- generative temple music (WebAudio, no audio files, no copyright) ---------- */
let musicWanted = true;
const Music = {
  on:false, timer:null, gain:null, delay:null, drones:[],
  start(){
    const c = ac(); if(!c || this.on) return; this.on = true;
    this.gain = c.createGain(); this.gain.gain.value = 0;
    this.gain.connect(c.destination);
    this.gain.gain.linearRampToValueAtTime(.5, c.currentTime + 2);
    this.delay = c.createDelay(1); this.delay.delayTime.value = .34;
    const fb = c.createGain(); fb.gain.value = .32;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.gain);
    [65.41, 98.00, 130.81].forEach((f,i)=>{
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle"; o.frequency.value = f; g.gain.value = i === 2 ? .010 : .018;
      o.connect(g); g.connect(this.gain); o.start(); this.drones.push(o);
    });
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    const bell = (f, vel)=>{
      if(!this.on) return; const t0 = c.currentTime;
      [[1,.20],[2.76,.07],[5.4,.03]].forEach(([m,g0])=>{
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sine"; o.frequency.value = f*m;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(g0*vel, t0+.01);
        g.gain.exponentialRampToValueAtTime(.0001, t0+2.8);
        o.connect(g); g.connect(this.gain);
        const send = c.createGain(); send.gain.value = .5; g.connect(send); send.connect(this.delay);
        o.start(t0); o.stop(t0+3);
      });
    };
    const mo = ()=>{
      if(!this.on) return; const t0 = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = "square";
      o.frequency.setValueAtTime(210, t0); o.frequency.exponentialRampToValueAtTime(90, t0+.07);
      f.type = "bandpass"; f.frequency.value = 800; f.Q.value = 6;
      g.gain.setValueAtTime(.10, t0); g.gain.exponentialRampToValueAtTime(.0001, t0+.09);
      o.connect(f); f.connect(g); g.connect(this.gain); o.start(t0); o.stop(t0+.1);
    };
    let step = 0;
    const loop = ()=>{
      if(!this.on) return; step++;
      if(Math.random() < .85) bell(scale[Math.floor(Math.random()*scale.length)], .55 + Math.random()*.5);
      if(step % 4 === 0 && Math.random() < .7) setTimeout(()=>bell(scale[Math.floor(Math.random()*scale.length)], .32), 720);
      if(step % 6 === 0) mo();
      if(step % 6 === 3) setTimeout(mo, 360);
      this.timer = setTimeout(loop, 2100 + Math.random()*900);
    };
    loop();
  },
  stop(){
    this.on = false; clearTimeout(this.timer);
    if(this.gain && audioCtx) this.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + .6);
    this.drones.forEach(o=>{ try{ o.stop(); }catch(e){} }); this.drones = [];
  }
};
document.addEventListener("pointerdown", ()=>{ ac(); if(musicWanted) Music.start(); }, {once:true});

/* ---------- thank-you: banner + Vietnamese TTS voice ---------- */
const BLESSINGS = ["Chúc bạn tâm an, vạn sự hanh thông 🌿","Chúc gia đình bạn bình an, mạnh khỏe 🙏",
"Phước lành đến với bạn và người thương ✨","Chúc bạn ngủ ngon, mai ngày mới an lành 🌙",
"Chúc công việc của bạn thuận buồm xuôi gió ⛵","Chúc bạn một ngày thật nhẹ nhàng, an yên 🪷",
"Mong mọi điều tốt đẹp nhất đến với bạn 💛","Chúc bạn và gia đình sức khỏe dồi dào 🌸"];
let blessIdx = 0, voiceOn = true;
const speechQ = []; let speaking = false;
function pumpSpeech(){
  if(speaking || !speechQ.length || !("speechSynthesis" in window)) return;
  const text = speechQ.shift();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN"; u.rate = 1.02; u.pitch = 1.05;
  const vs = speechSynthesis.getVoices().filter(v=>v.lang && v.lang.toLowerCase().startsWith("vi"));
  if(vs.length) u.voice = vs[0];
  speaking = true;
  u.onend = u.onerror = ()=>{ speaking = false; pumpSpeech(); };
  speechSynthesis.speak(u);
}
if("speechSynthesis" in window) speechSynthesis.getVoices();
function speakBrowser(text){
  if(!("speechSynthesis" in window)) return;
  speechQ.push(text);
  while(speechQ.length > 2) speechQ.shift();
  pumpSpeech();
}
/* Server voice (Edge TTS — Vietnamese neural voice) when the page is served
   by a bridge, cloud or PC: much better Vietnamese than most phone voices.
   Any failure falls back to the browser voice. */
const ttsQ = []; let ttsPlaying = false;
function pumpTts(){
  if(ttsPlaying || !ttsQ.length) return;
  const text = ttsQ.shift(); ttsPlaying = true;
  const a = new Audio("/tts?text=" + encodeURIComponent(text));
  a.onended = ()=>{ ttsPlaying = false; pumpTts(); };
  a.onerror = ()=>{ ttsPlaying = false; speakBrowser(text); pumpTts(); };
  a.play().catch(()=>{ ttsPlaying = false; speakBrowser(text); pumpTts(); });
}
function speak(text){
  if(!voiceOn) return;
  if(LIVE_MODE && !PHONE_MODE){ ttsQ.push(text); while(ttsQ.length > 2) ttsQ.shift(); pumpTts(); }
  else speakBrowser(text);
}
function showThanks(dev, gift){
  const b = $("#thanksBanner"), bless = BLESSINGS[blessIdx++ % BLESSINGS.length];
  const wish = lastWish.get(dev.name) || "";
  $("#thanksTitle").textContent = `🙏 Cảm ơn ${dev.name}`;
  $("#thanksSub").textContent = `đã dâng ${gift.name.toLowerCase()} · ${gift.act} — ${bless}` +
    (wish ? ` · Hồi hướng lời nguyện của ${dev.name}: “${wish}”` : "");
  b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  clearTimeout(b._t); b._t = setTimeout(()=>b.classList.remove("show"), 4200);
  return { bless, wish };
}
/* Periodic peaceful verse: a soft bell, a blessing line on the banner, and
   the voice reads it aloud — keeps a quiet hall feeling alive. */
const VERSES = [
  "Nam mô A Di Đà Phật. Chúc các sen tâm an, nhà an.",
  "Một nén hương lòng, cầu cho cha mẹ bình an, mạnh khỏe.",
  "Buông xuống muộn phiền, giữ tâm nhẹ như mây chiều.",
  "Cầu cho người thương của các sen luôn được bình an che chở.",
  "Tâm tĩnh thì sóng yên, lòng an thì nhà ấm.",
  "Mỗi ngày một việc thiện, phước lành tự tìm về bên mình."
];
let verseIdx = 0;
function showVerse(){
  if(!devotees.some(d=>!d.leaving)) return;
  const line = VERSES[verseIdx++ % VERSES.length];
  const b = $("#thanksBanner");
  $("#thanksTitle").textContent = "📿 Lời kinh an lành";
  $("#thanksSub").textContent = line;
  b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
  clearTimeout(b._t); b._t = setTimeout(()=>b.classList.remove("show"), 6500);
  ringBell(false);
  speak(line);
}
function toggleFs(){
  if(document.fullscreenElement){ document.exitFullscreen && document.exitFullscreen().catch(()=>{}); return; }
  if(document.documentElement.requestFullscreen){
    document.documentElement.requestFullscreen().catch(()=>{});
    if(screen.orientation && screen.orientation.lock) screen.orientation.lock("portrait").catch(()=>{});
  }
}
$("#btnFs").addEventListener("click", e=>{ e.stopPropagation(); toggleFs(); });
$("#btnMusic").addEventListener("click", e=>{
  musicWanted = !musicWanted;
  e.currentTarget.classList.toggle("off", !musicWanted);
  if(musicWanted) Music.start(); else Music.stop();
});
$("#btnVoice").addEventListener("click", e=>{
  voiceOn = !voiceOn;
  e.currentTarget.classList.toggle("off", !voiceOn);
  if(!voiceOn && "speechSynthesis" in window){ speechSynthesis.cancel(); speechQ.length = 0; ttsQ.length = 0; speaking = false; }
});

/* ---------- fx helpers ---------- */
function spawnFx(txt, xPct, yPct, anim, dur=2600, sizePx=26){
  const d = document.createElement("div");
  d.className = "fxEl"; d.textContent = txt;
  d.style.left = xPct+"%"; d.style.top = yPct+"%"; d.style.fontSize = sizePx+"px";
  d.style.animation = `${anim} ${dur}ms ease-out forwards`;
  fx.appendChild(d); setTimeout(()=>d.remove(), dur+60); return d;
}
function smokeBurst(n=6){
  const sm = $("#smoke");
  for(let i=0;i<n;i++){
    const p = document.createElement("div");
    p.className = "puff";
    p.style.left = (30+Math.random()*40)+"%";
    p.style.setProperty("--drift", (Math.random()*30-15)+"px");
    p.style.animationDelay = (Math.random()*.5)+"s";
    sm.appendChild(p); setTimeout(()=>p.remove(), 4300);
  }
}
setInterval(()=>smokeBurst(1), 1600);

/* ---------- devotees ---------- */
function makeDev(name, seat, instant){
  const el = document.createElement("div");
  el.className = "dev";
  const av = AVCOLORS[name.length % AVCOLORS.length];
  const type = Math.random() < .5 ? "woman" : "man";
  el.innerHTML = `<div class="bubble"></div>
    <div class="chip" style="--av:${av}"><span class="ava">${name.trim()[0]}</span><span class="cname">${name}</span><span class="cpts"></span></div>
    <div class="shadow"></div><div class="fig">${spriteImg(type, instant ? "sit" : "stand")}</div>`;
  const fig = el.querySelector(".fig");
  fig.style.animationDuration = (6.5 + Math.random()*4).toFixed(1) + "s";
  fig.style.animationDelay = (-Math.random()*8).toFixed(1) + "s";
  el.style.zIndex = seat.z;
  el.style.width = seat.w+"%";
  el.style.left = (instant ? seat.x : 50)+"%";
  el.style.top = (instant ? seat.y : 106)+"%";
  floorLayer.appendChild(el);
  const dev = {name, seat, el, fig, type, scale: 1, bubble: el.querySelector(".bubble"), chip: el.querySelector(".chip"),
               cpts: el.querySelector(".cpts"), home:{x:seat.x, y:seat.y, w:seat.w}, busy:false, lastAct: Date.now()};
  seat.taken = dev; devotees.push(dev);
  el.addEventListener("click", e=>{ e.stopPropagation(); bow(dev); say(dev, "Mô Phật 🙏"); sndPop(); });
  if(!instant){
    el.classList.add("walking");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ el.style.left = seat.x+"%"; el.style.top = seat.y+"%"; }));
    setTimeout(()=>{ el.classList.remove("walking"); renderFig(dev); bow(dev); }, 1750);
  }
  updateTop(); return dev;
}
function flashChip(dev, pts){
  dev.cpts.textContent = "+" + pts;
  dev.chip.classList.add("gold");
  clearTimeout(dev._ct); dev._ct = setTimeout(()=>{ dev.chip.classList.remove("gold"); dev.cpts.textContent = ""; }, 3000);
}
/* Camera: on a gift, the whole hall zooms to the devotee at the offering
   spot for a close-up deep prostration, then zooms back out (like the big
   temple lives). At most one zoom every 9s so gifts do not fight over it. */
let camBusy = false, lastZoomAt = 0;
function zoomTo(dev){
  const st = $("#stage"), w = $("#world"); if(!st || !w) return;
  const W = st.clientWidth, H = st.clientHeight; if(!W || !H) return;
  const wPct = SPOT.w * (dev.scale || 1);
  const k = Math.min(3.4, Math.max(2.1, 30 / wPct));
  const figH = (wPct / 100 * W) * 1.18;
  const cx = SPOT.x / 100 * W, cy = SPOT.y / 100 * H - figH * .45;
  w.style.transform = `translate(${W * .5 - cx * k}px, ${H * .58 - cy * k}px) scale(${k})`;
}
function zoomOut(){ const w = $("#world"); if(w) w.style.transform = ""; }
function perform(dev, fn, holdMs=1400){
  if(!dev){ fn && fn(null); return; }
  if(dev.busy){ fn && fn(dev); return; }
  dev.busy = true; dev.el.classList.add("spot"); dev.el.style.zIndex = 30;
  dev.el.classList.add("walking"); renderFig(dev);
  dev.el.style.left = SPOT.x+"%"; dev.el.style.top = SPOT.y+"%"; dev.el.style.width = (SPOT.w * (dev.scale || 1))+"%";
  setTimeout(()=>{
    dev.el.classList.remove("walking"); renderFig(dev);
    fn && fn(dev); bow(dev);
    const hasBow = !!BOW_SPRITES[dev.type];
    if (hasBow){ dev.pose = "bow"; renderFig(dev); }
    for(let i=0;i<5;i++) spawnFx("🌸", 24+Math.random()*52, 4+Math.random()*8, "fallDown", 2600+Math.random()*900, 19);
    const doZoom = !camBusy && Date.now() - lastZoomAt > 9000;
    if(doZoom){ camBusy = true; lastZoomAt = Date.now(); zoomTo(dev); if(!hasBow) dev.el.classList.add("prostrate"); }
    setTimeout(()=>{
      if(doZoom){ zoomOut(); dev.el.classList.remove("prostrate"); setTimeout(()=>{ camBusy = false; }, 1400); }
      dev.pose = null;
      dev.el.classList.add("walking"); renderFig(dev);
      dev.el.style.left = dev.home.x+"%"; dev.el.style.top = dev.home.y+"%"; dev.el.style.width = dev.home.w+"%";
      setTimeout(()=>{ dev.el.classList.remove("walking"); renderFig(dev);
        dev.busy = false; dev.el.classList.remove("spot"); dev.el.style.zIndex = dev.seat.z; }, 1750);
    }, holdMs + (doZoom ? 2700 : 0));
  }, 1750);
}

/* ---------- events ---------- */
function evictOldest(){
  const idle = devotees.filter(d=>!d.busy && !d.leaving).sort((a,b)=>a.lastAct-b.lastAct)[0];
  if(idle) removeDev(idle);
}
function removeDev(dev){
  if(!dev || dev.leaving) return;
  dev.leaving = true; dev.seat.taken = null;
  dev.el.classList.add("walking"); renderFig(dev);
  dev.el.style.left = "50%"; dev.el.style.top = "109%";
  setTimeout(()=>{ dev.el.style.transition = "opacity .45s ease"; dev.el.style.opacity = "0"; }, 1350);
  setTimeout(()=>{ dev.el.remove(); devotees = devotees.filter(d=>d !== dev); updateTop(); }, 1850);
  updateTop();
}
function removeByName(name){
  const dev = devotees.find(d=>d.name === name);
  if(dev) removeDev(dev);
}
/* TikTok reports the room's real viewer count periodically — if more
   devotees are seated than people actually watching, walk the idlest out.
   The count's field name varies by provider, so probe every known alias,
   including a top-viewers rank list whose length is a lower bound. */
let lastViewerCount = null;
let lastEventAt = Date.now();
function parseViewerCount(d, m){
  const srcs = [d, m || {}];
  const fields = ["totalViewers", "viewerCount", "totalViewerCount", "viewersCount",
                  "onlineUsers", "onlineCount", "userCount", "totalUsers", "total"];
  for(const s of srcs) for(const f of fields){
    const v = parseInt(s[f], 10);
    if(!isNaN(v) && v >= 0) return v;
  }
  const ranks = d.ranks || d.rankList || d.topViewers;
  if(Array.isArray(ranks) && ranks.length) return ranks.length;
  return null;
}
function reconcileViewers(total){
  total = parseInt(total, 10);
  if(isNaN(total)) return;
  lastViewerCount = total;
  let over = devotees.filter(d=>!d.leaving).length - total;
  if(over <= 0) return;
  const cands = devotees.filter(d=>!d.busy && !d.leaving && Date.now() - d.lastAct > 8000)
                        .sort((a,b)=>a.lastAct - b.lastAct);
  for(const dev of cands){ if(over-- <= 0) break; removeDev(dev); }
}
function clearAllDevotees(){
  devotees.filter(d=>!d.leaving).slice().forEach(removeDev);
}
function handleJoin(name){
  name = name || pickName(); if(!name) return null;
  const existing = devotees.find(d=>d.name===name);
  if(existing) return existing;
  let seat = SEATS.find(s=>!s.taken);
  if(!seat && SEATS.length < 36){
    /* hall expansion: one extra back row (26 -> 34 seats) before anyone is evicted */
    [25,33,67,75].forEach(x=>SEATS.push({x, y:41, w:7, z:2, taken:null}));
    seat = SEATS.find(s=>!s.taken);
    if(seat) ticker("Chùa mở thêm hàng ghế phía sau — mời các sen vào lễ 🙏");
  }
  if(!seat){ evictOldest(); seat = SEATS.find(s=>!s.taken); if(!seat) return null; }
  return makeDev(name, seat, false);
}
function handleChat(dev, text){
  dev = dev || randDev(); if(!dev) return;
  dev.lastAct = Date.now();
  bow(dev); say(dev, text || PRAYERS[Math.floor(Math.random()*PRAYERS.length)], text ? 5400 : 4200);
}
function findOrJoin(name){ return devotees.find(d=>d.name===name) || handleJoin(name); }
/* Change a devotee's form (avatar) — monk / nun / elder / child / lay. */
function setAvatar(dev, type){
  if(!dev) return;
  if(dev.type === type){ bow(dev); return; }
  dev.type = type; dev.scale = type === "child" ? .74 : 1;
  renderFig(dev);
  dev.home.w = dev.seat.w * dev.scale;
  if(!dev.busy) dev.el.style.width = dev.home.w + "%";
  for(let i=0;i<5;i++)
    setTimeout(()=>spawnFx("✨", dev.home.x + (Math.random()*10-5), dev.home.y - dev.home.w * .8, "floatUp", 1100, 16), i*90);
  bow(dev);
}
/* All live chat flows through here: one-word comments change the sender's
   avatar (an exact whole-comment match, so "Nam mô A Di Đà Phật" is safe);
   anything else is remembered as their wish and shown as a speech bubble. */
function routeChat(name, txt){
  if(!txt) return;
  const key = txt.trim().toLowerCase().replace(/\s+/g, " ");
  const dev = findOrJoin(name); if(!dev) return;
  if(AVATAR_WORDS[key]){
    setAvatar(dev, AVATAR_WORDS[key]);
    ticker(`${name} hóa thân thành ${AVATAR_LABEL[AVATAR_WORDS[key]]} 🙏`);
    return;
  }
  lastWish.set(name, txt.trim().slice(0, 90));
  handleChat(dev, cleanText(txt));
}
/* Likes: hearts float above the liker's own devotee (if seated). */
function handleLike(name){
  const dev = devotees.find(d=>d.name===name && !d.leaving); if(!dev) return;
  const now = Date.now();
  if(now - (likeThrottle.get(name) || 0) < 4000) return;
  likeThrottle.set(name, now);
  dev.lastAct = now;
  const cx = dev.home.x, cy = dev.home.y - dev.home.w * 1.32;
  for(let i=0;i<3;i++)
    setTimeout(()=>spawnFx("❤️", cx + (Math.random()*7-3.5), cy, "floatUp", 1500 + Math.random()*500, 16 + Math.random()*6), i*170);
}
function ringBell(big){
  const b = $("#bell");
  b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring");
  sndBell();
  for(let i=0;i<(big?3:2);i++){
    const r = spawnFx("", A.bell.x, A.bell.y, "ringWave", 1150, 0);
    r.classList.add("ringWave"); r.style.animationDelay = (i*180)+"ms";
  }
}
function handleGift(dev, gift, ptsOverride){
  dev = dev || randDev();
  if(!dev){ dev = handleJoin(); if(!dev) return; }
  const effPts = ptsOverride || gift.pts;
  dev.lastAct = Date.now();
  congduc += effPts;
  boardMap.set(dev.name, (boardMap.get(dev.name)||0) + effPts);
  updateTop(); renderBoard(); flashChip(dev, effPts);
  const th = showThanks(dev, gift);
  if(effPts >= 20){
    const clean = s => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
    speak(th.wish
      ? `Cảm ơn ${dev.name} đã dâng ${gift.name}. Hồi hướng lời nguyện của ${dev.name}: ${clean(th.wish).slice(0, 90)}. ${clean(th.bless)}`
      : `Cảm ơn ${dev.name} đã dâng ${gift.name}. ${clean(th.bless)}`);
  }
  ticker(`${dev.name} tặng ${gift.icon} ${gift.name} · ${gift.act.toLowerCase()}`);
  const FX = {
    incense(){ $("#burnerGlow").classList.add("big"); smokeBurst(13); sndChime();
      setTimeout(()=>$("#burnerGlow").classList.remove("big"), 3600); },
    candle(){ document.querySelectorAll(".candleGlow").forEach(c=>c.classList.add("big")); sndChime();
      setTimeout(()=>document.querySelectorAll(".candleGlow").forEach(c=>c.classList.remove("big")), 3200); },
    lotus(){ [A.vaseL, A.vaseR].forEach(v=>spawnFx("🪷", v.x, v.y, "floatUp", 1500, 30));
      for(let i=0;i<8;i++) spawnFx(Math.random()<.5?"🌸":"🪷", 22+Math.random()*56, 8+Math.random()*8, "fallDown", 2500+Math.random()*900, 21);
      sndChime(); },
    bell(){ ringBell(true); },
    fruit(){ [A.fruitL, A.fruitR].forEach(f=>spawnFx("✨", f.x, f.y, "floatUp", 1300, 22)); sndPop(); },
    carp(){ for(let i=0;i<3;i++){
        const c = spawnFx("🐠", -12, 90+i*3.2, "swimR", 4200+i*500, 24);
        c.style.animationDelay = (i*.5)+"s"; c.style.top = (89+i*3.4)+"%"; }
      sndPop(); },
    lantern(d){ for(let i=0;i<5;i++)
        spawnFx("🏮", SPOT.x+(Math.random()*16-8), 72+Math.random()*4, "floatUp", 3500+Math.random()*900, 25);
      if(d) say(d, "Thả hoa đăng · cầu bình an 🏮", 3000); sndChime(); },
    dragon(){ const dr = $("#dragon"); dr.classList.remove("fly"); void dr.offsetWidth; dr.classList.add("fly");
      const hg = $("#haloGlow"); hg.classList.remove("boom"); void hg.offsetWidth; hg.classList.add("boom");
      for(let i=0;i<14;i++) spawnFx("🪙", Math.random()*96, -4, "fallDown", 2700+Math.random()*1200, 19);
      devotees.forEach((dv,i)=>setTimeout(()=>bow(dv), i*85));
      sndBell(); setTimeout(sndChime, 350); },
  };
  const startPerform = ()=>perform(dev, FX[gift.fx], gift.fx==="dragon" ? 2200 : 1400);
  /* a brand-new devotee is still walking in — let them reach their seat
     first, then walk up to perform the offering */
  if(dev.el.classList.contains("walking") && !dev.busy) setTimeout(startPerform, 1850);
  else startPerform();
}

/* ---------- simulator UI ---------- */
const menu = $("#giftMenuList"), grid = $("#giftGrid");
GIFTS.forEach(g=>{
  const m = document.createElement("div");
  m.className = "gm"; m.innerHTML = `<b>${g.icon} ${g.name}</b><span>${g.act}</span>`;
  m.addEventListener("click", ()=>handleGift(null, g)); menu.appendChild(m);
  const b = document.createElement("button");
  b.className = "giftBtn";
  b.innerHTML = `<span class="gi">${g.icon}</span><span class="gn">${g.name}</span><span class="ga">${g.act}</span><span class="gp">+${g.pts} công đức</span>`;
  b.addEventListener("click", ()=>handleGift(null, g)); grid.appendChild(b);
});
document.querySelectorAll(".tier").forEach(t=>{
  t.addEventListener("click", ()=>{ const g = GIFTS.find(x=>x.id===t.dataset.gift); if(g) handleGift(null, g); });
});
$("#btnJoin").addEventListener("click", ()=>{ const d = handleJoin(); if(d) ticker(`${d.name} vừa vào lễ 🙏`); });
$("#btnChat").addEventListener("click", ()=>handleChat());
$("#btnReset").addEventListener("click", ()=>location.reload());
$("#bell").addEventListener("click", ()=>{ ringBell(false); ticker("Thỉnh chuông 🔔 — chuông chùa ngân vang"); });
let autoTimer = null;
function autoStep(){
  const r = Math.random();
  if(r < .30 && devotees.length < SEATS.length){ const d = handleJoin(); if(d && Math.random()<.5) setTimeout(()=>handleChat(d), 1500); }
  else if(r < .62) handleChat();
  else { const w = Math.random();
    const g = w<.45?GIFTS[0]:w<.65?GIFTS[1]:w<.78?GIFTS[2]:w<.88?GIFTS[3]:w<.94?GIFTS[4]:w<.975?GIFTS[5]:w<.99?GIFTS[6]:GIFTS[7+Math.floor(Math.random()*2)];
    handleGift(null, g); }
}
const autoBtn = $("#btnAuto");
function setAuto(on){
  clearInterval(autoTimer); autoTimer = null;
  if(on){ autoTimer = setInterval(autoStep, 2400); autoBtn.textContent = "⏸️ Tự chạy demo"; autoBtn.classList.add("on"); }
  else { autoBtn.textContent = "▶️ Tự chạy demo"; autoBtn.classList.remove("on"); }
}
autoBtn.addEventListener("click", ()=>setAuto(!autoTimer));

/* ---------- parallax drag (2.5D depth) ---------- */
let parT = 0, par = 0, dragX = null;
stage.addEventListener("pointerdown", e=>{ dragX = e.clientX; });
stage.addEventListener("pointermove", e=>{
  if(dragX === null) return;
  parT = Math.max(-16, Math.min(16, parT + (e.clientX - dragX) * .12));
  dragX = e.clientX;
});
addEventListener("pointerup", ()=>{ dragX = null; });
(function parLoop(t){
  requestAnimationFrame(parLoop);
  const idle = Math.sin((t||0)*.0004)*3;
  par += ((parT + idle) - par) * .05;
  $("#bgWrap").style.transform = `translateX(${par * -.4}px) scale(1.02)`;
  floorLayer.style.transform = `translateX(${par * .55}px)`;
  if(Math.abs(parT) > .1 && dragX === null) parT *= .985;
})(0);

/* ---------- LIVE MODE: real TikTok events via local bridge ---------- */
const QS = new URLSearchParams(location.search);
const PHONE_MODE = QS.has("phone");
const LIVE_MODE = QS.has("live") || PHONE_MODE;
const TT_GIFT_NAME = { "rose":"huong", "tiktok":"huong", "finger heart":"nen", "heart":"nen",
  "bouquet":"hoasen", "flower bouquet":"hoasen", "wreath":"hoasen", "donut":"chuong", "doughnut":"chuong",
  "hand heart":"nguqua", "heart me":"nguqua", "corgi":"ca", "money gun":"dang",
  "lion":"rong", "galaxy":"thienha", "universe":"thienha", "planet":"thienha" };
function ttGift(giftName, diamonds){
  const byName = TT_GIFT_NAME[(giftName || "").toLowerCase().trim()];
  if(byName) return GIFTS.find(g=>g.id === byName);
  const d = diamonds || 0;
  const id = d <= 1 ? "huong" : d <= 9 ? "nen" : d <= 29 ? "hoasen" : d <= 99 ? "chuong" :
             d <= 199 ? "nguqua" : d <= 499 ? "ca" : d <= 999 ? "dang" : "rong";
  return GIFTS.find(g=>g.id === id);
}
const cleanName = n => String(n || "").replace(/[<>\s]+/g, " ").trim().slice(0, 24);
const cleanText = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 70);
/* Phone mode: the page itself connects to Euler Stream's WebSocket service —
   no PC, no local bridge. Needs the streamer's TikTok username (+ Euler key). */
let eulerAuthFailed = false;
async function connectEuler(){
  const user = (QS.get("user") || "").replace(/^@/, "");
  if(!user){ ticker("⚠️ Thiếu username TikTok trong link (?phone=1&user=...)"); return; }
  ticker("Đang nối thẳng tới TikTok qua Euler…");
  let sdk;
  try{ sdk = await import("https://esm.sh/@eulerstream/euler-websocket-sdk@1.1.0"); }
  catch(e){ ticker("🔴 Không tải được thư viện Euler — kiểm tra mạng, đang thử lại…"); setTimeout(connectEuler, 5000); return; }
  const opts = { uniqueId: "@" + user };
  const key = QS.get("key"); if(key) opts.jwtKey = key;
  try{ opts.features = { schemaVersion: sdk.SchemaVersion ? sdk.SchemaVersion.v2 : "v2" }; }catch(e){}
  let url;
  try{ url = sdk.createWebSocketUrl(opts); }
  catch(e){ ticker("🔴 Không tạo được link nối Euler"); return; }
  const ws = new WebSocket(url); ws.binaryType = "arraybuffer";
  let opened = false;
  ws.onopen = ()=>{ opened = true; ticker("🟢 Đã nối kênh sự kiện TikTok — chờ phòng live"); };
  ws.onclose = ev=>{
    if(ev.code === 4404){ ticker("⏳ Chưa thấy phòng live — anh bấm LIVE là chùa tự bắt sóng"); setTimeout(connectEuler, 15000); }
    else if(ev.code === 4401 || ev.code === 4403){ eulerAuthFailed = true; ticker(`🔴 Euler từ chối key (mã ${ev.code}) — kênh WebSocket cần key riêng của Euler`); }
    else if(!opened){ ticker(`🔴 Euler không cho nối (mã ${ev.code}) — kênh này cần key WebSocket riêng, key ký miễn phí không mở được`); }
    else if(!eulerAuthFailed){ ticker(`🔴 Mất kênh sự kiện (mã ${ev.code}) — đang nối lại…`); setTimeout(connectEuler, 5000); }
  };
  ws.onerror = ()=>{ try{ ws.close(); }catch(e){} };
  ws.onmessage = ev=>{
    let frame;
    try{ frame = sdk.decodeFrame(new Uint8Array(ev.data)); }catch(e){ return; }
    const msgs = (frame && (frame.messages || frame.decodedMessages)) || [];
    for(const msg of msgs){
      const type = msg.type || msg.method || "", d = msg.data || msg.payload || msg;
      lastEventAt = Date.now();
      if(type === "WebcastRoomUserSeqMessage"){ const vc = parseViewerCount(d, msg); if(vc != null) reconcileViewers(vc); continue; }
      if(type === "WebcastLiveEndMessage" || type === "WebcastStreamEndMessage"){ clearAllDevotees(); continue; }
      const u = d.user || {};
      const name = cleanName(u.nickname || u.displayId || u.uniqueId || d.uniqueId);
      if(!name) continue;
      if(type === "WebcastMemberMessage"){ const dv = handleJoin(name); if(dv) ticker(`${name} vừa vào lễ 🙏`); }
      else if(type === "WebcastChatMessage"){ if(d.comment) routeChat(name, d.comment); }
      else if(type === "WebcastLikeMessage"){ handleLike(name); }
      else if(type === "WebcastSocialMessage"){
        if(String(d.displayText || d.label || "").toLowerCase().includes("follow") || d.action === 3){
          const dv = handleJoin(name); if(dv) ticker(`${name} vừa follow chùa 🙏`);
        }
      }
      else if(type === "WebcastGiftMessage"){
        const g = d.gift || d.giftDetails || {};
        const streakable = g.type === 1 || g.giftType === 1;
        if(streakable && d.repeatEnd === false) continue; // combo: chốt khi dứt chuỗi
        const dv = findOrJoin(name); if(!dv) continue;
        const diamonds = g.diamondCount || d.diamondCount || 0;
        const gift = ttGift(g.name || d.giftName || "", diamonds);
        handleGift(dv, gift, diamonds > 0 ? diamonds * (d.repeatCount || 1) : undefined);
      }
    }
  };
}

/* Phone mode via TikTool: plain-JSON WebSocket, free 7-day Sandbox key.
   Sandbox quota is tight (60 connects/hour, 3 concurrent, 2h per socket —
   close code 4429 = rate limited), so reconnects use real backoff instead
   of hammering: waiting-for-live retries slow down to one per 5 minutes,
   and tapping the stage retries immediately. */
let ttSocket = null, ttTimer = null, ttRetryMs = 0;
function connectTikTool(){
  const user = (QS.get("user") || "").replace(/^@/, "");
  const key = QS.get("key") || "";
  if(!user || !key){ ticker("⚠️ Thiếu user hoặc key TikTool trong link (?provider=tiktool&user=...&key=...)"); return; }
  if(ttSocket && (ttSocket.readyState === 0 || ttSocket.readyState === 1)) return;
  clearTimeout(ttTimer); ttTimer = null;
  ticker("Đang nối TikTok qua TikTool…");
  const ws = new WebSocket(`wss://api.tik.tools?uniqueId=${encodeURIComponent(user)}&apiKey=${encodeURIComponent(key)}`);
  ttSocket = ws;
  let opened = false;
  ws.onopen = ()=>{ opened = true; ttRetryMs = 0; ticker("🟢 Đã nối kênh sự kiện TikTok (TikTool) — chờ phòng live"); };
  ws.onclose = ev=>{
    ttSocket = null;
    if(ev.code === 4404){
      ttRetryMs = ttRetryMs ? Math.min(ttRetryMs * 2, 300000) : 30000;
      ticker(`⏳ Chưa thấy phòng live — chùa tự dò lại sau ${Math.round(ttRetryMs / 1000)} giây, hoặc anh chạm màn hình để nối ngay`);
      ttTimer = setTimeout(connectTikTool, ttRetryMs);
    }
    else if(ev.code === 4429){
      ttRetryMs = Math.min(Math.max(ttRetryMs * 2, 120000), 300000);
      ticker("🟠 TikTool tạm giới hạn số lần nối (mã 4429) — key cần nghỉ ít phút, chùa sẽ tự nối lại, anh đừng tắt trang");
      ttTimer = setTimeout(connectTikTool, ttRetryMs);
    }
    else if(!opened) ticker(`🔴 TikTool không cho nối (mã ${ev.code}) — kiểm tra key Sandbox còn hạn không`);
    else {
      ttRetryMs = Math.min(Math.max(ttRetryMs * 2, 15000), 120000);
      ticker(`🔴 Mất kênh sự kiện (mã ${ev.code}) — đang nối lại…`);
      ttTimer = setTimeout(connectTikTool, ttRetryMs);
    }
  };
  ws.onerror = ()=>{ try{ ws.close(); }catch(e){} };
  ws.onmessage = ev=>{
    let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
    lastEventAt = Date.now();
    const d = m.data || m, type = String(m.event || m.type || d.event || d.type || "").toLowerCase();
    if(QS.has("debug")){
      const scalars = {};
      for(const k in d){ const v = d[k]; if(v == null || typeof v !== "object") scalars[k] = v; }
      ticker(`📩 ${type || "?"} · ${JSON.stringify(scalars).slice(0, 150)}`);
    }
    if(type.includes("roomuserseq") || type.includes("roomuser")){
      const vc = parseViewerCount(d, m);
      if(vc != null) reconcileViewers(vc);
      return;
    }
    if(type.includes("liveend") || type.includes("streamend") || type.includes("roomfinish") || type === "finish" || type === "end"){
      clearAllDevotees(); ticker("Buổi live đã kết thúc — cảm ơn các sen đã ghé lễ 🙏");
      return;
    }
    const u = d.user || {};
    const name = cleanName(u.nickname || u.displayName || u.uniqueId || d.uniqueId);
    if(!name) return;
    if(type.includes("leave")){ removeByName(name); return; }
    if(type.includes("member") || type === "join"){ const dv = handleJoin(name); if(dv) ticker(`${name} vừa vào lễ 🙏`); }
    else if(type.includes("chat") || type === "comment"){
      const txt = d.comment || d.text || d.content;
      if(txt) routeChat(name, txt);
    }
    else if(type.includes("follow")){ const dv = handleJoin(name); if(dv) ticker(`${name} vừa follow chùa 🙏`); }
    else if(type.includes("like")){ handleLike(name); }
    else if(type.includes("gift")){
      if(d.giftType === 1 && d.repeatEnd === false) return;
      const dv = findOrJoin(name); if(!dv) return;
      const diamonds = d.diamondCount || (d.gift && d.gift.diamondCount) || 0;
      const gift = ttGift(d.giftName || (d.gift && d.gift.name) || "", diamonds);
      handleGift(dv, gift, diamonds > 0 ? diamonds * (d.repeatCount || 1) : undefined);
    }
  };
}

function connectLive(){
  if(PHONE_MODE){ (QS.get("provider") === "tiktool" ? connectTikTool : connectEuler)(); return; }
  const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const url = QS.get("ws") || (localHost ? `ws://${location.hostname}:8787/ws`
                                         : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  let ws;
  try{ ws = new WebSocket(url); }catch(e){ setTimeout(connectLive, 3000); return; }
  ws.onopen = ()=>ticker("🟢 Đã nối TikTok LIVE — chờ sen vào lễ");
  ws.onclose = ()=>{ ticker("🔴 Mất nối cầu nối — đang tự nối lại…"); setTimeout(connectLive, 3000); };
  ws.onerror = ()=>{ try{ ws.close(); }catch(e){} };
  ws.onmessage = ev=>{
    let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
    const name = cleanName(m.name); if(!name) return;
    if(m.type === "join"){ const d = handleJoin(name); if(d) ticker(`${name} vừa vào lễ 🙏`); }
    else if(m.type === "chat"){ if(m.text) routeChat(name, m.text); }
    else if(m.type === "like"){ handleLike(name); }
    else if(m.type === "follow"){ const d = handleJoin(name); if(d) ticker(`${name} vừa follow chùa 🙏`); }
    else if(m.type === "gift"){
      const d = findOrJoin(name); if(!d) return;
      const g = ttGift(m.giftName, m.diamonds);
      handleGift(d, g, Math.max(1, (m.diamonds || g.pts) * (m.count || 1)));
    }
  };
}

/* ---------- seed (demo mode only) ---------- */
function seed(){
  const first = ["Bảo Ngọc","Hoàng Long","Lan Phương","Quang Huy","Minh Anh","Khánh Vy","Thu Hà","Mai Chi","Đức Thịnh","Tâm An","Hải Đăng","Hồng Nhung"];
  first.forEach(n=>{ usedNames.add(n); const seat = SEATS.find(s=>!s.taken); if(seat) makeDev(n, seat, true); });
  [["Bảo Ngọc",99],["Hoàng Long",49],["Lan Phương",20],["Quang Huy",10],["Minh Anh",5],
   ["Khánh Vy",8],["Thu Hà",6],["Mai Chi",5]].forEach(([n,p])=>boardMap.set(n,p));
  congduc = 202; updateTop(); renderBoard();
  const kv = devotees.find(d=>d.name==="Khánh Vy");
  if(kv) setTimeout(()=>say(kv, "Cầu gia đình khỏe mạnh 🙏", 3600), 800);
  setAuto(true);
}
/* Home-screen app restore: reopening from the phone's home screen icon
   (standalone display) jumps straight back to the saved live configuration. */
const IS_STANDALONE = window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches);
if(IS_STANDALONE && !LIVE_MODE){
  try{
    const cfg = JSON.parse(localStorage.getItem("chuaLiveCfg") || "null");
    if(cfg && cfg.user) location.replace(`?phone=1${cfg.provider ? "&provider=" + cfg.provider : ""}&user=${encodeURIComponent(cfg.user)}${cfg.key ? "&key=" + encodeURIComponent(cfg.key) : ""}`);
  }catch(e){}
}
/* Fit the stage to the REAL visible viewport (some phone webviews report
   100dvh taller than the visible area, which made the page scroll). */
function fitStage(){
  if(!document.body.classList.contains("overlay")) return;
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  if(h) $("#stage").style.height = h + "px";
}
window.addEventListener("resize", fitStage);
if(window.visualViewport) visualViewport.addEventListener("resize", fitStage);

if(LIVE_MODE){
  document.body.classList.add("overlay");
  fitStage(); setTimeout(fitStage, 300); setTimeout(fitStage, 1200);
  if(PHONE_MODE && QS.get("user")){
    try{ localStorage.setItem("chuaLiveCfg", JSON.stringify({ user: QS.get("user"), provider: QS.get("provider") || "", key: QS.get("key") || "" })); }catch(e){}
  }
  /* Housekeeper (live mode): keeps the hall matching the real room.
     1. Re-apply the last known viewer count — TikTok stops sending room
        updates once the room empties, so the count must keep working even
        when no new event arrives.
     2. If the event channel has been totally silent for 100+ seconds while
        devotees are still seated (phone modes stream room updates every
        few seconds in a live room), the room is empty or over: walk the
        idlest devotee out, one per pass.
     3. A devotee silent for 4+ minutes quietly leaves the hall. */
  setInterval(()=>{
    const now = Date.now();
    if(lastViewerCount != null) reconcileViewers(lastViewerCount);
    if(PHONE_MODE && devotees.some(d=>!d.leaving) && now - lastEventAt > 100000){
      const idle = devotees.filter(d=>!d.busy && !d.leaving).sort((a,b)=>a.lastAct - b.lastAct)[0];
      if(idle) removeDev(idle);
    }
    devotees.filter(d=>!d.busy && !d.leaving && now - d.lastAct > 4 * 60 * 1000).forEach(removeDev);
  }, 20000);
  /* Periodic peaceful verse (showVerse lives near the thank-you banner). */
  setInterval(()=>{ if(!document.hidden) showVerse(); }, 390000);
  if(PHONE_MODE && !QS.get("user")){
    const u = prompt("Nhập username TikTok của bạn (không có @):", "");
    if(u){ location.search = "?phone=1&user=" + encodeURIComponent(u.replace(/^@/, "")) + (QS.get("key") ? "&key=" + encodeURIComponent(QS.get("key")) : ""); }
  }
  if(PHONE_MODE){
    if(QS.get("provider") === "tiktool"){
      /* tap the stage while waiting = retry the connection right now */
      document.getElementById("stage").addEventListener("pointerdown", ()=>{
        if(ttTimer && !ttSocket){ clearTimeout(ttTimer); ttTimer = null; ttRetryMs = 0; connectTikTool(); }
      });
    }
    const keepAwake = ()=>{ if(navigator.wakeLock) navigator.wakeLock.request("screen").catch(()=>{}); };
    keepAwake(); document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) keepAwake(); });
    window.addEventListener("pointerdown", function fs(){
      window.removeEventListener("pointerdown", fs);
      if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
    });
    ticker("Chế độ điện thoại — đang nối TikTok…");
  } else {
    ticker("Đang nối tới cầu nối TikTok…");
  }
  connectLive();
} else {
  seed();
}
if(QS.has("overlay")) document.body.classList.add("overlay");

/* ---------- TEST PANEL (?test=1): drive the live features by hand ----------
   Avatar words, likes, hồi hướng wishes, seat expansion, verses — all the
   things that normally only fire from real TikTok events. */
const TEST_MODE = QS.has("test");
if(TEST_MODE && $("#testPanel")){
  $("#testPanel").style.display = "block";
  setAuto(false);
  const giftSel = $("#testGift");
  GIFTS.forEach(g=>{ const o = document.createElement("option"); o.value = g.id; o.textContent = `${g.icon} ${g.name} (+${g.pts})`; giftSel.appendChild(o); });
  giftSel.value = "hoasen";
  const tName = ()=> ($("#testName").value || "Sen Test").trim().slice(0, 24) || "Sen Test";
  $("#btnTestJoin").addEventListener("click", ()=>{ const d = findOrJoin(tName()); if(d) ticker(`${tName()} vừa vào lễ 🙏`); });
  $("#btnTestChat").addEventListener("click", ()=>{ const t = $("#testChat").value.trim(); if(t) routeChat(tName(), t); });
  $("#btnTestLike").addEventListener("click", ()=>{ if(findOrJoin(tName())) handleLike(tName()); });
  $("#btnTestGift").addEventListener("click", ()=>{ const g = GIFTS.find(x=>x.id === giftSel.value); const d = findOrJoin(tName()); if(d && g) handleGift(d, g); });
  $("#btnTestFill").addEventListener("click", ()=>{ for(let i=0;i<8;i++) handleJoin(); });
  $("#btnTestVerse").addEventListener("click", ()=>showVerse());
  $("#btnTestBow").addEventListener("click", ()=>bowAll());
}

/* Rotating couplet banners on the two pillars (verses change every 14s). */
const COUPLETS = [["Đây là nơi thanh tịnh", "Vui lòng đi nhẹ nói khẽ"],
                  ["Sống không giận không hờn", "Sống không oán không trách"],
                  ["Gieo hạt giống thiện lành", "Gặt quả ngọt bình an"]];
let coupIdx = 0;
setInterval(()=>{ const L = $("#coupL"), R = $("#coupR"); if(!L || !R) return;
  L.classList.add("flip"); R.classList.add("flip");
  setTimeout(()=>{ coupIdx = (coupIdx + 1) % COUPLETS.length;
    L.textContent = COUPLETS[coupIdx][0]; R.textContent = COUPLETS[coupIdx][1];
    L.classList.remove("flip"); R.classList.remove("flip"); }, 620);
}, 14000);
