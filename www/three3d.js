/* Chùa Online — 3D mode (?3d=1). Three.js scene layered over the 2D hall:
   stylized devotees (or a GLB character via ?model=<url>, Mixamo/VRoid
   exports) with walk / kneel / bow / prostrate actions, per-person robe
   tints, floating name labels, golden light, falling petals and a smooth
   camera that dollies in on whoever is offering a gift.
   The 2D app keeps running the shared UI (board, banners, ticker, voice);
   this module mirrors joins/gifts into the 3D scene and replaces the 2D
   stage performance with its own. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const QS = new URLSearchParams(location.search);
if (QS.has("3d")) init().catch(e => console.error("3D init failed:", e));

async function init(){
  document.body.classList.add("mode3d");
  const style = document.createElement("style");
  style.textContent = `
    body.mode3d #floorLayer{display:none}
    #gl3d{position:absolute;inset:0;z-index:6;pointer-events:none}
    #labels3d{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
    .n3d{position:absolute;transform:translate(-50%,-100%);background:rgba(12,6,2,.74);
      border:1px solid rgba(255,255,255,.16);color:#ffe9b0;border-radius:20px;
      padding:1px 8px;font-size:10px;font-weight:700;white-space:nowrap;max-width:110px;
      overflow:hidden;text-overflow:ellipsis}`;
  document.head.appendChild(style);

  const stage = document.getElementById("stage");
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.id = "gl3d";
  stage.appendChild(renderer.domElement);
  const labelsEl = document.createElement("div");
  labelsEl.id = "labels3d";
  stage.appendChild(labelsEl);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const CAM_HOME = { pos:new THREE.Vector3(0, 4.6, 11), tgt:new THREE.Vector3(0, .35, -.4) };
  camera.position.copy(CAM_HOME.pos);
  camera.lookAt(CAM_HOME.tgt);

  /* warm temple light */
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x4a2410, .95));
  const key = new THREE.DirectionalLight(0xffbe78, 1.6);
  key.position.set(3.5, 6, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe9c4, .5);
  rim.position.set(-3, 3, -4);
  scene.add(rim);

  /* invisible floor that only catches shadows (the painted hall shows through) */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 10),
    new THREE.ShadowMaterial({ opacity:.38 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -.2;
  ground.receiveShadow = true;
  scene.add(ground);

  function fit(){
    const w = stage.clientWidth, h = stage.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  new ResizeObserver(fit).observe(stage);

  /* ---------- seats: same map as the 2D hall, projected to the floor ---- */
  const ROWS = [
    {y:47.8,   xs:[29, 39, 61, 71]},
    {y:55.4,   xs:[24, 34.5, 65.5, 76]},
    {y:65.3, xs:[20, 31, 42, 58, 69, 80]},
    {y:72.6, xs:[18.5, 30.5, 42.5, 54.5, 66.5, 78.5]},
    {y:80.8,   xs:[17, 30, 43, 56, 69, 82]},
    {y:88.5, xs:[15.5, 29, 42.5, 56, 69.5, 83]},
    {y:42.4,   xs:[35, 45, 55, 65]},
  ];
  const toWorld = (x, y)=>({ x:(x - 50) * .088, z:(y - 71.5) * .145 });
  const SEATS = [];
  ROWS.forEach(r => r.xs.forEach(x => { const p = toWorld(x, r.y); SEATS.push({ ...p, taken:null }); }));
  const SPOT3 = { x:0, z:-1.03 };                    // in front of the altar (50%, 64.4%)
  const DOOR3 = { x:0, z:4.1 };                     // bottom-center entrance

  /* ---------- optional GLB character (Mixamo / VRoid export) ----------- */
  const TYPE_CONF = {
    woman:{ robe:0x93a3b8, hair:0x2e2622, bun:true },
    man:  { robe:0x8593a8, hair:0x36302b },
    monk: { robe:0xe08a3c, bald:true },
    nun:  { robe:0x7a5a3c, bald:true },
    elder:{ robe:0x8a5560, hair:0xb3aca2, bun:true },
    child:{ robe:0xa9b9cb, hair:0x2e2622, bun:true, scale:.74 },
  };
  const TYPES = Object.keys(TYPE_CONF);
  const SKIN = 0xe8b98d;
  let glbTemplate = null, glbClips = {};
  const modelUrl = QS.get("model");
  const MODEL_PARTS = ["https://chua-online-phucvjps-projects.vercel.app/assets/model-0.bin",
                       "https://chua-online-phucvjps-projects.vercel.app/assets/model-1.bin"];
  async function fetchJoined(urls){
    const bufs = await Promise.all(urls.map(u => fetch(u).then(r => {
      if (!r.ok) throw new Error("model part " + r.status); return r.arrayBuffer(); })));
    const total = bufs.reduce((a, b) => a + b.byteLength, 0);
    const out = new Uint8Array(total); let o = 0;
    for (const b of bufs){ out.set(new Uint8Array(b), o); o += b.byteLength; }
    return out.buffer;
  }
  try {
    const buf = modelUrl ? await (await fetch(modelUrl)).arrayBuffer()
                         : await fetchJoined(MODEL_PARTS);
    const g = await new GLTFLoader().parseAsync(buf, "");
    glbTemplate = g.scene;
    g.animations.forEach(c => glbClips[c.name.toLowerCase()] = c);
    console.log("3D model loaded, clips:", Object.keys(glbClips));
  } catch(e){ console.warn("3D model failed, using built-in figures:", e); }
  function findClip(...names){
    for (const n of names) for (const k of Object.keys(glbClips))
      if (k.includes(n)) return glbClips[k];
    return null;
  }

  /* Stylized devotee built from primitives — same pose language as the
     painted hall: robe, head seen from behind, arms raised to joined palms. */
  function buildProcedural(type, tintJitter){
    const c = TYPE_CONF[type];
    const robeColor = new THREE.Color(c.robe);
    robeColor.offsetHSL(0, 0, tintJitter);
    const armColor = robeColor.clone(); armColor.offsetHSL(0, 0, -.16);
    const g = new THREE.Group();          // root (floor point)
    const body = new THREE.Group();       // bow pivot at the base
    g.add(body);
    const robeMat = new THREE.MeshStandardMaterial({ color:robeColor, roughness:.85 });
    const pts = [[.001,0],[.20,0],[.208,.03],[.163,.20],[.148,.38],[.102,.46],[.056,.50]]
      .map(p => new THREE.Vector2(p[0], p[1]));
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), robeMat);
    robe.castShadow = true;
    body.add(robe);
    const headG = new THREE.Group();
    headG.position.y = .50;
    body.add(headG);
    const skinMat = new THREE.MeshStandardMaterial({ color:SKIN, roughness:.55 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 16), skinMat);
    skull.position.y = .075;
    skull.castShadow = true;
    headG.add(skull);
    if (!c.bald){
      const hairMat = new THREE.MeshStandardMaterial({ color:c.hair, roughness:.7 });
      const hair = new THREE.Mesh(new THREE.SphereGeometry(.108, 20, 16), hairMat);
      hair.scale.set(1, .84, 1);
      hair.position.set(0, .096, .014);
      headG.add(hair);
      if (c.bun){
        const bun = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 10), hairMat);
        bun.position.set(0, .185, .048);
        headG.add(bun);
      }
    }
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.027, 10, 8), skinMat);
      ear.position.set(.102 * s, .07, 0);
      headG.add(ear);
    });
    const armMat = new THREE.MeshStandardMaterial({ color:armColor, roughness:.85 });
    function limb(from, to, r, mat){
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 10), mat);
      m.position.copy(from).addScaledVector(dir, .5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      m.castShadow = true;
      return m;
    }
    [-1, 1].forEach(s => body.add(limb(
      new THREE.Vector3(.115 * s, .44, -.005),
      new THREE.Vector3(.014 * s, .695, -.07), .031, armMat)));
    const palms = new THREE.Mesh(new THREE.SphereGeometry(.042, 12, 10), skinMat);
    palms.scale.set(1, 1.3, 1);
    palms.position.set(0, .715, -.078);
    body.add(palms);
    /* legs for walking — mostly hidden under the robe hem */
    const legMat = new THREE.MeshStandardMaterial({ color:0x333a47, roughness:.9 });
    const legs = new THREE.Group();
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.034, .03, .17, 8), legMat);
      leg.position.set(.055 * s, .085, 0);
      legs.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(.068, .03, .115), legMat);
      shoe.position.set(.055 * s, .015, -.012);
      legs.add(shoe);
    });
    legs.visible = false;
    g.add(legs);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(.21, 20),
      new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.24, depthWrite:false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = .006;
    g.add(blob);
    if (c.scale) g.scale.setScalar(c.scale);
    return { root:g, body, robe, legs, mixer:null, actions:null };
  }

  /* His two supplied colors lead the palette (pink, gold), then temple tones. */
  const PALETTE = [0xED7399, 0xFAC719, 0xE08A3C, 0x7A5A3C, 0x8593A8, 0x9E4A54, 0x7A6AA8, 0x5F8A6A];
  function buildFigure(type){
    if (!glbTemplate) return buildProcedural(type, (Math.random() * .1 - .05));
    const tint = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const root = SkeletonUtils.clone(glbTemplate);
    root.traverse(o => { if (o.isMesh){ o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map(m => { const c = m.clone();
        if (c.name === "vai") c.color.setHex(tint); return c; });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    }});
    const box = new THREE.Box3().setFromObject(root);
    const h = Math.max(box.max.y - box.min.y, .001);
    root.scale.setScalar(.68 / h);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    const want = { idle:["nghi","idle","stand"], walk:["walk","run"], kneel:["nghi","kneel"],
                   bow:["chao","bow","pray"], prostrate:["lay","prostrat","bow"] };
    for (const k of Object.keys(want)){
      const clip = findClip(...want[k]);
      if (clip) actions[k] = mixer.clipAction(clip);
    }
    for (const k of ["bow", "prostrate"])
      if (actions[k]){ actions[k].setLoop(THREE.LoopOnce, 1); actions[k].clampWhenFinished = true; }
    const wrap = new THREE.Group();
    wrap.rotation.y = Math.PI;   /* the model faces +Z; the hall needs its back to the camera */
    wrap.add(root);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(.21, 20),
      new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.24, depthWrite:false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = .006;
    wrap.add(blob);
    return { root:wrap, body:wrap, robe:null, legs:null, mixer, actions, glbRoot:root,
             walkClip:!!actions.walk, spine:root.getObjectByName("Spine") };
  }

  /* ---------- devotees + tiny action engine ---------------------------- */
  const devotees = new Map();
  const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  function setKneel(d, kneel){
    d.kneeling = kneel;
    if (d.fig.mixer){ /* GLB: crossfade to the rest clip; squash reads as kneeling */
      const target = kneel ? (d.fig.actions.kneel || d.fig.actions.idle) : d.fig.actions.idle;
      if (target && d.current !== target){
        if (d.current) d.current.fadeOut(.3);
        target.reset().fadeIn(.3).play();
        d.current = target;
      }
      d.fig.root.scale.y = kneel ? .82 : 1;
      return;
    }
    d.fig.body.scale.y = kneel ? .8 : 1;
    d.fig.robe.scale.x = d.fig.robe.scale.z = kneel ? 1.2 : 1;
    d.fig.legs.visible = !kneel;
  }
  function playClip(d, name, fade = .25){
    if (!d.fig.mixer) return false;
    const a = d.fig.actions[name];
    if (!a) return false;
    if (d.current) d.current.fadeOut(fade);
    a.reset().fadeIn(fade).play();
    d.current = a;
    return true;
  }
  function anim(d, dur, update, done){ d.anim = { t:0, dur, update, done }; }
  function walkTo(d, tx, tz, done){
    const sx = d.fig.root.position.x, sz = d.fig.root.position.z;
    const dist = Math.hypot(tx - sx, tz - sz);
    const dur = Math.max(.7, dist / 1.55);
    setKneel(d, false);
    playClip(d, "walk");
    anim(d, dur, k => {
      d.fig.root.position.x = sx + (tx - sx) * k;
      d.fig.root.position.z = sz + (tz - sz) * k;
      if (!d.fig.walkClip) d.fig.body.position.y = Math.abs(Math.sin(k * dist * 9)) * .022;
    }, () => { d.fig.body.position.y = 0; setKneel(d, true); playClip(d, "kneel"); done && done(); });
  }
  function bowAnim(d, deep, done){
    if (playClip(d, deep ? "prostrate" : "bow")){
      const cd = d.current && d.current.getClip() ? d.current.getClip().duration
               : (deep ? 3.4 : 1.1);
      anim(d, cd, () => {}, () => { playClip(d, "kneel"); done && done(); });
      return;
    }
    const peak = deep ? -1.02 : -.5, dur = deep ? 3.6 : 1.15;
    anim(d, dur, k => {
      const bend = k < .38 ? easeIO(k / .38) : k < .62 ? 1 : 1 - easeIO((k - .62) / .38);
      d.fig.body.rotation.x = peak * bend;
      if (deep) d.fig.body.position.y = -.05 * bend;
    }, () => { d.fig.body.rotation.x = 0; d.fig.body.position.y = 0; done && done(); });
  }

  function join(name){
    if (!name || devotees.has(name)) return devotees.get(name);
    const seat = SEATS.find(s => !s.taken);
    if (!seat) return null;
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const fig = buildFigure(type);
    fig.root.position.set(DOOR3.x, 0, DOOR3.z);
    scene.add(fig.root);
    const label = document.createElement("div");
    label.className = "n3d";
    label.textContent = name;
    labelsEl.appendChild(label);
    const d = { name, seat, fig, label, busy:false, kneeling:false, anim:null, current:null };
    seat.taken = d;
    devotees.set(name, d);
    walkTo(d, seat.x, seat.z, () => bowAnim(d, false));
    return d;
  }
  function leave(name){
    const d = devotees.get(name);
    if (!d) return;
    devotees.delete(name);
    d.label.remove();
    if (d.seat) d.seat.taken = null;
    walkTo(d, DOOR3.x, DOOR3.z + .8, () => {
      scene.remove(d.fig.root);
      d.label.remove();
    });
  }

  /* ---------- camera ---------------------------------------------------- */
  let camAnim = null, camBusy = false, lastZoomAt = 0;
  let curTgt = CAM_HOME.tgt.clone();
  const worldEl = document.getElementById("world");
  function flyCam(toPos, toTgt, dur, bgScale, done){
    const fromPos = camera.position.clone(), fromTgt = curTgt.clone();
    const startBg = parseFloat(worldEl && worldEl.dataset.s ? worldEl.dataset.s : "1") || 1;
    camAnim = { t:0, dur, fromPos, toPos, fromTgt, toTgt, startBg, bgScale, done };
  }
  function giftCam(d, holdMs){
    const p = d.fig.root.position;
    flyCam(new THREE.Vector3(p.x * .45, 1.65, p.z + 3.1),
           new THREE.Vector3(p.x, .5, p.z), 1.5, 1.32, () => {});
    setTimeout(() => flyCam(CAM_HOME.pos, CAM_HOME.tgt, 1.5, 1, () => { camBusy = false; }),
               250 + (holdMs || 3600));
    setTimeout(() => { camBusy = false; }, 9000);
  }

  /* ---------- gifts ------------------------------------------------------ */
  function gift(name){
    const d = devotees.get(name) || join(name);
    if (!d || d.busy) return;
    d.busy = true;
    walkTo(d, SPOT3.x, SPOT3.z, () => {
      const doZoom = !camBusy && Date.now() - lastZoomAt > 9000;
      if (doZoom){ camBusy = true; lastZoomAt = Date.now(); }
      petalBurst();
      bowAnim(d, true, () => {
        walkTo(d, d.seat.x, d.seat.z, () => { d.busy = false; });
      });
      if (doZoom){
        const bowMs = d.fig.actions && d.fig.actions.prostrate
          ? d.fig.actions.prostrate.getClip().duration * 1000 : 3600;
        giftCam(d, bowMs);
      }
    });
  }
  function bowAll(){ devotees.forEach(d => { if (!d.busy) bowAnim(d, false); }); }

  /* ---------- petals ------------------------------------------------------ */
  const PETALS = 70;
  const petalMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.16, .16),
    new THREE.MeshBasicMaterial({ color:0xff9ecb, side:THREE.DoubleSide, transparent:true, opacity:.95 }),
    PETALS);
  const petalData = [];
  function spawnPetal(p, burst){
    p.x = burst ? (Math.random() - .5) * 1.6 : (Math.random() - .5) * 6.8;
    p.y = burst ? 1.6 + Math.random() * .8 : Math.random() * 2.4;
    p.z = burst ? (Math.random() - .5) * 1.6 : -3.4 + Math.random() * 6.6;
    p.vy = .25 + Math.random() * .3;
    p.ph = Math.random() * 6.28;
    p.rs = (Math.random() - .5) * 2.4;
  }
  for (let i = 0; i < PETALS; i++){ const p = {}; spawnPetal(p, false); p.y = Math.random() * 2.4; petalData.push(p); }
  function petalBurst(){ for (let i = 0; i < 26 && i < PETALS; i++) spawnPetal(petalData[i], true); }
  const dummy = new THREE.Object3D();

  /* ---------- main loop --------------------------------------------------- */
  const clock = new THREE.Clock();
  const projV = new THREE.Vector3();
  function tick(){
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), .05);
    const t = clock.elapsedTime;
    devotees.forEach(d => {
      if (d.fig.mixer) d.fig.mixer.update(dt);
      if (d.anim){
        d.anim.t += dt;
        const k = Math.min(d.anim.t / d.anim.dur, 1);
        d.anim.update(k, dt);
        if (k >= 1){ const dn = d.anim.done; d.anim = null; dn && dn(); }
      } else if (!d.fig.mixer && d.kneeling){
        d.fig.body.rotation.z = Math.sin(t * .9 + d.seat.x * 3) * .032;   // idle sway
      }
      /* name label projection */
      projV.setFromMatrixPosition(d.fig.root.matrixWorld);
      let lift;
      if (d.fig.mixer) lift = d.kneeling ? .64 : .78;
      else {
        lift = d.kneeling ? .8 : .95;
        if (d.fig.body) lift += d.fig.body.rotation.x * .38;
        lift *= (d.fig.root.scale.y || 1);
      }
      projV.y += lift;
      projV.project(camera);
      if (projV.z > 1){ d.label.style.display = "none"; return; }
      d.label.style.display = "";
      d.label.style.left = ((projV.x * .5 + .5) * 100) + "%";
      d.label.style.top = ((-projV.y * .5 + .5) * 100) + "%";
    });
    /* petals */
    petalData.forEach((p, i) => {
      p.y -= p.vy * dt;
      p.x += Math.sin(t * 1.7 + p.ph) * .12 * dt;
      if (p.y < .02) spawnPetal(p, false);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(t * p.rs, p.ph + t * p.rs * .7, t * p.rs * .5);
      dummy.updateMatrix();
      petalMesh.setMatrixAt(i, dummy.matrix);
    });
    petalMesh.instanceMatrix.needsUpdate = true;
    /* camera flight */
    if (camAnim){
      camAnim.t += dt;
      const k = easeIO(Math.min(camAnim.t / camAnim.dur, 1));
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
      const tgt = new THREE.Vector3().lerpVectors(camAnim.fromTgt, camAnim.toTgt, k);
      curTgt.copy(tgt);
      camera.lookAt(tgt);
      if (worldEl){
        const s = camAnim.startBg + (camAnim.bgScale - camAnim.startBg) * k;
        worldEl.dataset.s = s;
        worldEl.style.transformOrigin = "50% 62%";
        worldEl.style.transform = `scale(${s})`;
      }
      if (camAnim.t >= camAnim.dur){ const dn = camAnim.done; camAnim = null; dn && dn(); }
    }
    renderer.render(scene, camera);
  }
  tick();

  /* ---------- seed + bridges to the 2D app ------------------------------- */
  ["Bảo Ngọc", "Hoàng Long", "Lan Phương", "Quang Huy", "Minh Anh", "Thanh Tâm",
   "Đức Thịnh", "Khánh Linh", "Hồng Nhung", "Văn Đức", "Phúc Lâm", "Tâm An"]
   .forEach(n => { const d = join(n); if (d){ /* seed devotees start seated */
     d.anim = null; d.fig.root.position.set(d.seat.x, 0, d.seat.z); setKneel(d, true); } });

  window.__temple3D = { join, leave, gift, bowAll,
    setType(name, type){ const d = devotees.get(name); if (!d) return;
      scene.remove(d.fig.root); d.label.remove(); devotees.delete(name); d.seat.taken = null;
      const nd = join(name); if (nd){ nd.anim = null; nd.fig.root.position.set(nd.seat.x, 0, nd.seat.z); setKneel(nd, true); } } };

  /* The 2D stage performance is replaced; joins/gifts still update the
     shared board/banners/voice through the original handlers, and mirror
     into the 3D scene here. */
  if (typeof window.perform === "function")
    window.perform = function(dev, fn){ if (fn) try { fn(dev); } catch(e){} };
  if (typeof window.handleJoin === "function"){
    const hj = window.handleJoin;
    window.handleJoin = function(name){ const d = hj(name); if (d) join(d.name); return d; };
  }
  if (typeof window.handleGift === "function"){
    const hg = window.handleGift, giftMirror = gift;
    window.handleGift = function(dev, g, pts){ const r = hg(dev, g, pts);
      if (dev && dev.name) setTimeout(() => giftMirror(dev.name), 60); return r; };
  }
  if (typeof window.setAvatar === "function"){
    const sa = window.setAvatar;
    window.setAvatar = function(dev, type){ const r = sa(dev, type);
      if (dev && dev.name && window.__temple3D) window.__temple3D.setType(dev.name, type); return r; };
  }
  /* a bow-all button for the 3D hall inside the existing test panel */
  const tp = document.getElementById("testPanel");
  if (tp){
    const b = document.createElement("button");
    b.className = "simBtn";
    b.textContent = "🧎 3D: tất cả cùng lạy";
    b.addEventListener("click", bowAll);
    tp.appendChild(b);
  }
  if (QS.has("test")){
    const dbg = document.createElement("div");
    dbg.id = "dbg3d";
    dbg.style.cssText = "position:absolute;left:6px;bottom:46px;z-index:40;background:rgba(0,0,0,.75);color:#7dff9a;font:11px monospace;padding:3px 7px;border-radius:6px;pointer-events:none";
    stage.appendChild(dbg);
    setInterval(() => {
      let line = "3D: no performance";
      devotees.forEach(d => {
        if (d.busy){
          const clip = d.current && d.current.getClip() ? d.current.getClip().name : "-";
          const bend = d.fig.spine ? Math.round(THREE.MathUtils.radToDeg(d.fig.spine.rotation.x)) + "deg" : "-";
          line = `3D ${d.name}: clip=${clip} spine=${bend} busy=true`;
        }
      });
      dbg.textContent = line;
    }, 250);
  }
  console.log("Chùa 3D ready" + (glbTemplate ? " (GLB model)" : " (built-in figures)"));
}
