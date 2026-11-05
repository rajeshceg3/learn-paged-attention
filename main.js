import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ---------- tiny spring tween ---------- */
const springs = [];
function spring(obj, key, to, { stiffness = 55, damping = 9 } = {}) {
  let s = springs.find((e) => e.obj === obj && e.key === key);
  if (!s) { s = { obj, key, v: 0 }; springs.push(s); }
  s.to = to; s.stiffness = stiffness; s.damping = damping;
}
function stepSprings(dt) {
  for (let i = springs.length - 1; i >= 0; i--) {
    const s = springs[i];
    const x = s.obj[s.key];
    const F = -s.stiffness * (x - s.to) - s.damping * s.v;
    s.v += F * dt;
    s.obj[s.key] = x + s.v * dt;
    if (Math.abs(s.v) < 0.0004 && Math.abs(s.obj[s.key] - s.to) < 0.0004) {
      s.obj[s.key] = s.to; springs.splice(i, 1);
    }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- renderer ---------- */
const canvas = document.getElementById("engine");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color("#f7eedd");
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(4.8, 3.8, 6.8);

const hemi = new THREE.HemisphereLight(0xfff8ec, 0xe6cba6, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(4, 8, 5);
scene.add(sun);

const controls = new OrbitControls(camera, canvas);
/* look a touch lower so the engine rides higher in frame, reserving the
   bottom band for the hint line (no card, no pill) - tall screens lift
   further, laptop gets a milder lift plus a slightly longer camera */
const PORTRAIT = innerWidth / innerHeight < 0.75;
let baseTargetY = PORTRAIT ? 0.3 : 0.35;
controls.target.set(0, baseTargetY, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4.5;
controls.maxDistance = 17;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.5;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.8;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (camera.aspect < 0.75) camera.position.setLength(16);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* soft ground blob - a paper shadow */
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(3.7, 48),
  new THREE.MeshBasicMaterial({ color: "#e4d3b6", transparent: true, opacity: 0.8 })
);
blob.rotation.x = -Math.PI / 2; blob.position.y = -0.02;
scene.add(blob);

/* ---------- ink helpers ---------- */
const INK = "#33241c";
/* hand-inked outline: inverted hull with a fixed, per-part wobble */
function inkify(mesh, thickness = 1.03) {
  const hull = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true })
  );
  hull.scale.setScalar(thickness);
  hull.rotation.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02);
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}
/* wireframe ghost for x-ray mode: ink edges, barely-there paper fill */
function ghostify(mesh) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 24),
    new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 })
  );
  edges.raycast = () => {};
  mesh.add(edges);
  return edges;
}
const toon3 = (() => {
  const c = document.createElement("canvas"); c.width = 3; c.height = 1;
  const g = c.getContext("2d");
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, 1, 1);
  g.fillStyle = "#c8c8c8"; g.fillRect(1, 0, 1, 1);
  g.fillStyle = "#ffffff"; g.fillRect(2, 0, 1, 1);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const clay = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toon3 });

/* ---------- paged memory (a friendly toy, drawn in ink) ---------- */
const engine = new THREE.Group();
scene.add(engine);

/* ink-lettered numbers and letters: small planes that wait for the font */
const redraws = [];
function textPlane(text, size, color = "#33241c", billboard = false) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.font = '600 92px "Caveat", cursive';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(text, 64, 70);
    tex.needsUpdate = true;
  };
  draw(); redraws.push(draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.raycast = () => {};
  m.userData.billboard = billboard;
  return m;
}
if (document.fonts && document.fonts.load) {
  document.fonts.load('600 40px "Caveat"').then(() => redraws.forEach((d) => d())).catch(() => {});
}

const C_A = "#e8735a", C_B = "#7fb3d5";

/* the shelf (GPU memory) */
const slab = new THREE.Mesh(new RoundedBoxGeometry(PORTRAIT ? 3.9 : 5.1, 0.5, PORTRAIT ? 4.7 : 3.5, 5, 0.22), clay("#f2b25c"));
slab.position.y = 0.25;
engine.add(slab);
inkify(slab, 1.03);

/* twelve boxes (physical blocks) */
const COLS = PORTRAIT ? 3 : 4, ROWS = PORTRAIT ? 4 : 3;
const tiles = [];
const TILE_Y = 0.64;
const tileGeo = new RoundedBoxGeometry(1.0, 0.28, 0.92, 4, 0.1);
for (let i = 0; i < COLS * ROWS; i++) {
  const c = i % COLS, r = Math.floor(i / COLS);
  const t = new THREE.Mesh(tileGeo, clay("#ffe9c4"));
  t.position.set((c - (COLS - 1) / 2) * 1.18, TILE_Y, (r - (ROWS - 1) / 2) * 1.08 + 0.15);
  engine.add(t);
  inkify(t, 1.05);
  const num = textPlane(String(i), 0.46);
  num.rotation.x = -Math.PI / 2; num.position.set(0, 0.146, 0.2);
  t.add(num);
  t.userData.index = i;
  tiles.push(t);
}
/* coloured stacks of saved notes */
const OWNER = { 5: C_A, 2: C_A, 9: C_A, 0: C_B, 7: C_B };
const colGeo = new RoundedBoxGeometry(0.72, 1, 0.66, 3, 0.1);
colGeo.translate(0, 0.5, 0);
const COL_H = 0.5;
const cols = new Map();
for (const k of Object.keys(OWNER)) {
  const t = tiles[+k];
  const col = new THREE.Mesh(colGeo, clay(OWNER[k]));
  col.position.set(0, 0.14, -0.04);
  col.scale.set(1, 0.001, 1);
  t.add(col);
  inkify(col, 1.07);
  cols.set(+k, col);
}

/* the map (block table) */
const board = new THREE.Mesh(new RoundedBoxGeometry(4.0, 1.5, 0.22, 4, 0.12), clay("#7dcfa0"));
board.position.set(0, 1.45, PORTRAIT ? -3.1 : -2.25);
board.rotation.x = -0.1;
engine.add(board);
inkify(board, 1.035);
const CHIP_X = [-0.45, 0.4, 1.25];
const ROW_Y = { A: 0.36, B: -0.3 };
const chips = [];
for (const [req, list] of [["A", [5, 2, 9]], ["B", [0, 7]]]) {
  const tag = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.5, 0.12, 3, 0.08), clay(req === "A" ? C_A : C_B));
  tag.position.set(-1.35, ROW_Y[req], 0.15);
  board.add(tag); inkify(tag, 1.08);
  const tl = textPlane(req, 0.5, "#33241c"); tl.position.set(0, 0, 0.07); tag.add(tl);
  for (let k = 0; k < 3; k++) {
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.54, 0.06, 3, 0.08), new THREE.MeshBasicMaterial({ color: "#63b88a" }));
    slot.position.set(CHIP_X[k], ROW_Y[req], 0.125);
    slot.raycast = () => {};
    board.add(slot);
    if (k < list.length) {
      const chip = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.46, 0.14, 3, 0.08), clay(req === "A" ? C_A : C_B));
      chip.position.set(CHIP_X[k], ROW_Y[req], 0.19);
      chip.scale.setScalar(0.001);
      board.add(chip); inkify(chip, 1.08);
      const n = textPlane(String(list[k]), 0.46); n.position.set(0, 0, 0.075); chip.add(n);
      chip.userData.tile = list[k];
      chips.push(chip);
    }
  }
}

/* the two questions */
function makeAsker(color, letter, x) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), clay(color));
  m.position.set(x, 3.3, 0.7);
  engine.add(m); inkify(m, 1.06);
  const l = textPlane(letter, 0.5, "#33241c", true);
  l.position.set(0, 0, 0.0);
  m.add(l);
  return m;
}
const askA = makeAsker(C_A, "A", PORTRAIT ? -1.0 : -1.2);
const askB = makeAsker(C_B, "B", PORTRAIT ? 1.0 : 1.2);
const askers = { A: askA, B: askB };

/* flying words, the lookup hopper and dashed leader lines */
const flyGeo = new THREE.SphereGeometry(0.09, 8, 8);
const flyDots = [];
for (let i = 0; i < 16; i++) {
  const d = new THREE.Mesh(flyGeo, new THREE.MeshBasicMaterial({ color: C_A, transparent: true, opacity: 0 }));
  scene.add(d); flyDots.push(d);
}
const hopMat = new THREE.MeshBasicMaterial({ color: "#ff9d3c", transparent: true, opacity: 0 });
const hop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), hopMat);
scene.add(hop);

scene.updateMatrixWorld(true);
const tileTop = (i) => { const v = new THREE.Vector3(0, 0.3, 0); tiles[i].localToWorld(v); return v; };
const A_ORDER = [5, 2, 9];
const lineMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0 });
const lookLines = A_ORDER.map((ti, k) => {
  const chip = chips.find((c) => c.userData.tile === ti);
  const a = new THREE.Vector3(); chip.getWorldPosition(a);
  const b = tileTop(ti);
  const mid = a.clone().lerp(b, 0.5); mid.y += 1.1; mid.z += 0.6;
  const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(32);
  const line = new THREE.Group();
  for (let q = 0; q < pts.length - 1; q += 2) {
    const seg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pts[q], pts[q + 1]), 1, 0.022, 5, false), lineMat);
    line.add(seg);
  }
  line.visible = false;
  scene.add(line);
  return line;
});

/* ---------- parts registry ---------- */
const tileName = (i) => (cols.has(i) && cols.get(i).scale.y > 0.02 ? "Box of notes" : "Free box");
const tileText = (i) => (cols.has(i) && cols.get(i).scale.y > 0.02
  ? "A small box with a fixed size. It keeps the saved notes (keys and values) for a few words."
  : "An empty box. Any question can use it next. It can sit anywhere on the shelf.");
const PARTS = [];
PARTS.push({ mesh: slab, name: () => "GPU memory", text: () => "The big shelf. All the saved notes live here.", out: 0, label: "gpu memory", anchor: new THREE.Vector3(PORTRAIT ? 1.8 : 2.3, 0, PORTRAIT ? 2.1 : 1.5) });
tiles.forEach((t, i) => {
  const r = Math.floor(i / COLS);
  const p = { mesh: t, name: () => tileName(i), text: () => tileText(i), out: [0.7, 1.2, 1.7, 2.2][r] };
  if (i === 5) { p.label = "box of notes"; p.anchor = new THREE.Vector3(0.45, 0.15, 0.1); }
  if (i === 10) { p.label = "free box"; p.anchor = new THREE.Vector3(0.0, 0.15, 0.1); }
  PARTS.push(p);
});
PARTS.push({ mesh: board, name: () => "Block table", text: () => "The map. It says which box holds which page of notes.", out: 1.0, label: "block table", anchor: new THREE.Vector3(1.7, 0.7, 0.15) });
PARTS.push({ mesh: askA, name: () => "A question", text: () => "Someone asking the model something. Its notes grow, word by word.", out: 0.9, label: "question A", anchor: new THREE.Vector3(-0.1, 0.2, 0) });
PARTS.push({ mesh: askB, name: () => "A question", text: () => "Someone asking the model something. Its notes grow, word by word.", out: 0.9 });
PARTS.forEach((p) => { p.home = p.mesh.position.y; p.mesh.userData.part = p; });
const pickMeshes = PARTS.map((p) => p.mesh).concat([...cols.values()], chips);
cols.forEach((c, k) => { c.userData.part = PARTS.find((p) => p.mesh === tiles[k]); });
chips.forEach((c) => { c.userData.part = PARTS.find((p) => p.mesh === board); });
const tmpV = new THREE.Vector3();

/* ---------- x-ray labels (leader lines) ---------- */
const labelLayer = document.getElementById("labels");
const leaderSvg = document.getElementById("leaders");
const labeledParts = PARTS.filter((p) => p.label);
const labelEls = new Map();
labeledParts.forEach((p) => {
  const el = document.createElement("div");
  el.className = "xlabel";
  el.textContent = p.label;
  labelLayer.appendChild(el);
  labelEls.set(p, el);
});
const leaderPaths = new Map();
labeledParts.forEach((p) => {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "leader");
  leaderSvg.appendChild(path);
  leaderPaths.set(p, path);
});
/* top band reserved for the narration banner while it runs (mode 2).
   Measured from the live DOM, so it holds at any width, font or safe-area.
   94 matches the long-standing stacking floor when no banner is up. */
let reserveCacheW = -1, reserveCacheY = 94;
function topReserveY() {
  if (mode !== 2) return 94;
  if (reserveCacheW !== innerWidth) {
    reserveCacheW = innerWidth;
    reserveCacheY = oneliner.getBoundingClientRect().bottom + 30;
  }
  return reserveCacheY;
}
function projectLabels() {
  const show = mode === 1 || mode === 2;
  const w = innerWidth, h = innerHeight;
  leaderSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  /* first pass: project anchors */
  const items = [];
  labeledParts.forEach((p, i) => {
    const el = labelEls.get(p);
    const path = leaderPaths.get(p);
    if (!show) { el.classList.remove("on"); path.classList.remove("on"); return; }
    tmpV.copy(p.anchor);
    p.mesh.localToWorld(tmpV);
    tmpV.project(camera);
    if (tmpV.z > 1) { el.classList.remove("on"); path.classList.remove("on"); return; }
    items.push({
      p, el, path,
      ax: (tmpV.x * 0.5 + 0.5) * w,
      ay: (-tmpV.y * 0.5 + 0.5) * h,
      side: i % 2 === 0 ? -1 : 1,
    });
  });
  /* wide screens: leftmost parts get left-hand labels, rightmost get right,
     so leader lines do not run across neighbouring parts */
  if (w >= 500) {
    const byX = items.slice().sort((a, b) => a.ax - b.ax);
    byX.forEach((it, k) => { it.side = k < byX.length / 2 ? -1 : 1; });
  }
  /* second pass: stack per side with a minimum gap so labels never collide */
  const columns = w < 500 ? [[0, items.slice().sort((a, b) => a.ay - b.ay)]] : [[-1, []], [1, []]];
  if (w >= 500) {
    columns[0][1] = items.filter((it) => it.side === -1).sort((a, b) => a.ay - b.ay);
    columns[1][1] = items.filter((it) => it.side === 1).sort((a, b) => a.ay - b.ay);
  }
  const minAx = Math.min(...items.map((it) => it.ax)), maxAx = Math.max(...items.map((it) => it.ax));
  for (const [side0, col] of columns) {
    let prevY = topReserveY() + 4;
    for (const it of col) {
      let ly = Math.max(prevY + 34, it.ay - 18);
      ly = Math.min(h - 110, ly);
      const side = w < 500 ? (it.ax < w / 2 ? -1 : 1) : it.side;
      /* wide screens: park each label column just outside the whole model
         so a label never sits on a neighbouring part */
      /* phones: park labels in the outer margins (measured width) so they
         neither touch the model nor run past the screen edge */
      const half = it.el.offsetWidth / 2 + 8;
      const lx0 = w >= 500
        ? Math.max(70, Math.min(w - 70, side < 0 ? minAx - 125 : maxAx + 125))
        : (side < 0 ? half : w - half);
      const lx = Math.max(half, Math.min(w - half, lx0));
      it.el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px) translate(-50%, -100%)`;
      const kx = (it.ax + lx) / 2 + side * 8;
      const ky = (it.ay + ly) / 2 - 6;
      it.path.setAttribute("d", `M ${it.ax.toFixed(1)} ${it.ay.toFixed(1)} Q ${kx.toFixed(1)} ${ky.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)}`);
      it.el.classList.add("on"); it.path.classList.add("on");
      prevY = ly;
    }
  }
}


/* ---------- four-stroke cycle ---------- */
const STROKES = [
  { word: "Ask!", line: "Two questions arrive. Each one grabs only the boxes it needs." },
  { word: "Write!", line: "New words go in the last box. Box full? Grab any free box." },
  { word: "Look up!", line: "The map tells attention where every box is, wherever it sits." },
  { word: "Give back!", line: "Done! The boxes go back to the free pile for the next question." },
];
const STROKE_T = 2.0;
let cycleT = 0, lastStroke = -1, boomSeen = false, graceUntil = 0, graceMax = 0;
/* learner-paced stepping: the default way through the four moves is one
   press, one move, then the engine waits for the next press */
let stepMode = true;    /* true: Next! advances one stroke; false: runs on its own */
let stepRunning = false; /* a pressed stroke is animating right now */
let curStroke = -1;      /* stroke playing or last played in step mode (-1 = none yet) */
let runUntil = 0;        /* absolute cycleT where the current step pauses */

/* ---------- modes + chrome ---------- */
const banner = document.getElementById("banner");
const oneliner = document.getElementById("oneliner");
const hint = document.getElementById("hint");
const card = document.getElementById("card");
const cardName = document.getElementById("card-name");
const cardText = document.getElementById("card-text");
const chrome = [...document.querySelectorAll(".chrome")].filter((c) => c.id !== "modes");
const modeBtns = [...document.querySelectorAll(".modebtn")];
const stepui = document.getElementById("stepui");
const nextBtn = document.getElementById("next");
const autoBtn = document.getElementById("autotoggle");
let mode = 0;
const tallScreen = () => innerWidth / innerHeight < 0.75;
const CAM = { tall: [20.5, 23, 22], wide: [10.2, 12, 12.5] };
const camFor = (m) => (tallScreen() ? CAM.tall : CAM.wide)[m];
let camDist = camFor(0);
controls.maxDistance = camDist + 1;
camera.position.setLength(camDist);

const HINTS = [
  "Drag to spin it around",
  "Tap a part to meet it",
  "Watch it go - four moves, over and over",
];
const MAGIC = "Paging secret: boxes never need to sit side by side. A little map remembers where each one is.";

let secretTimer = 0;
function setMode(m) {
  const prevMode = mode;
  /* a pending secret-card timer from an earlier visit must not fire late */
  clearTimeout(secretTimer);
  mode = m;
  /* mode 2 pulls back so the whole engine fits between the narration
     band and the hint band - genuinely separate space, both widths */
  camDist = camFor(m);
  controls.maxDistance = camDist + 1;
  modeBtns.forEach((b, i) => {
    b.classList.toggle("active", i === m);
    if (i === m) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
  controls.autoRotate = m === 0 && !reducedMotion;
  card.classList.remove("show");
  stepui.classList.remove("show");
  hint.textContent = HINTS[m];
  hint.classList.add("show");
  if (m === 1) {
    banner.classList.remove("pop"); oneliner.classList.remove("show");
    for (const p of PARTS) spring(p.mesh.position, "y", p.home + p.out, { stiffness: 42, damping: 8.5 });
  } else {
    for (const p of PARTS) spring(p.mesh.position, "y", p.home, { stiffness: 48, damping: 9 });
  }
  if (m === 2) {
    cycleT = 0; lastStroke = -1; boomSeen = false;
    curStroke = -1; stepRunning = false; runUntil = 0;
    updateStepUI();
    /* let the camera finish easing before the first headline appears, so the
       lifted valves never pass through the narration */
    graceUntil = performance.now() + (prevMode === 1 ? 2100 : 1200);
    graceMax = performance.now() + 5000;
  } else {
    setTimeout(() => { if (mode !== 2) { banner.classList.remove("pop"); oneliner.classList.remove("show"); } }, 400);
  }
  wakeChrome();
}
modeBtns.forEach((b, i) => b.addEventListener("click", () => setMode(i)));

/* step mode hides the hint: the pulsing button is the invitation.
   run mode brings back the original "watch it go" hint. */
function updateStepUI() {
  if (mode !== 2) { stepui.classList.remove("show"); return; }
  stepui.classList.add("show");
  if (stepMode) {
    nextBtn.hidden = stepRunning;
    nextBtn.textContent = curStroke < 0 ? "Go!" : curStroke >= 3 ? "Go again!" : "Next!";
    nextBtn.classList.toggle("invite", !stepRunning && !reducedMotion);
    autoBtn.textContent = "Let it run";
    hint.classList.remove("show");
  } else {
    nextBtn.hidden = true;
    autoBtn.textContent = "Step it";
    hint.textContent = HINTS[2];
    hint.classList.add("show");
  }
}

nextBtn.addEventListener("click", () => {
  if (mode !== 2 || !stepMode || stepRunning) return;
  if (curStroke >= 3) { cycleT = 0; curStroke = -1; }
  curStroke++;
  runUntil = cycleT + STROKE_T;
  stepRunning = true;
  updateStepUI();
  wakeChrome();
});

autoBtn.addEventListener("click", () => {
  if (mode !== 2) return;
  stepMode = !stepMode;
  if (stepMode) {
    /* pause at the end of the stroke already in flight, never rewind */
    curStroke = Math.floor((cycleT / STROKE_T) % 4);
    runUntil = (Math.floor(cycleT / STROKE_T) + 1) * STROKE_T;
    stepRunning = true;
  } else {
    /* the paused pose sits exactly on a stroke boundary, so the cycle
       simply continues into the next move */
    stepRunning = false;
  }
  updateStepUI();
  wakeChrome();
});

document.getElementById("card-ok").addEventListener("click", () => {
  card.classList.remove("show");
  wakeChrome();
});

let idleTimer;
function wakeChrome() {
  chrome.forEach((c) => c.classList.remove("idle"));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => chrome.forEach((c) => c.classList.add("idle")), 6000);
}

/* ---------- picking ---------- */
const ray = new THREE.Raycaster();
let downX = 0, downY = 0, moved = 0;
canvas.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; moved = 0; wakeChrome(); });
canvas.addEventListener("pointermove", (e) => { moved += Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY); downX = e.clientX; downY = e.clientY; });
canvas.addEventListener("pointerup", (e) => {
  if (moved > 14 || mode !== 1) return;
  const nd = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  ray.setFromCamera(nd, camera);
  const hit = ray.intersectObjects(pickMeshes, false)[0];
  if (hit && hit.object.userData.part) {
    const p = hit.object.userData.part;
    cardName.textContent = p.name();
    cardText.textContent = p.text();
    card.classList.remove("secret");
    card.classList.add("show");
    spring(p.mesh.scale, "x", 1.18, { stiffness: 90, damping: 7 });
    spring(p.mesh.scale, "y", 1.18, { stiffness: 90, damping: 7 });
    spring(p.mesh.scale, "z", 1.18, { stiffness: 90, damping: 7 });
    setTimeout(() => {
      spring(p.mesh.scale, "x", 1); spring(p.mesh.scale, "y", 1); spring(p.mesh.scale, "z", 1);
    }, 450);
  }
});


/* ---------- loop ---------- */
const clock = new THREE.Clock();
/* what each box holds (0..1) at the end of each move */
const FILL_STAGES = [
  { 5: 0, 2: 0, 9: 0, 0: 0, 7: 0 },
  { 5: 1, 2: 0.25, 9: 0, 0: 0.625, 7: 0 },   /* after Ask! */
  { 5: 1, 2: 1, 9: 0.5, 0: 1, 7: 0.25 },     /* after Write! */
  { 5: 1, 2: 1, 9: 0.5, 0: 1, 7: 0.25 },     /* after Look up! */
  { 5: 0, 2: 0, 9: 0, 0: 0, 7: 0 },          /* after Give back! */
];
const SNAP = FILL_STAGES[2];
/* when inside a move each box fills: [start, end] as fractions of the move */
const WIN = [
  { 5: [0.05, 0.55], 2: [0.35, 0.85], 0: [0.15, 0.75] },
  { 2: [0.05, 0.45], 9: [0.4, 0.9], 0: [0.05, 0.4], 7: [0.4, 0.85] },
  {},
  { 0: [0.05, 0.45], 7: [0.1, 0.5], 5: [0.35, 0.8], 2: [0.45, 0.9], 9: [0.55, 0.95] },
];
/* word flights: who sends, which box, when */
const FLY = [
  [["A", 5, 0.0, 0.5], ["A", 2, 0.3, 0.8], ["B", 0, 0.1, 0.7]],
  [["A", 2, 0.0, 0.45], ["A", 9, 0.35, 0.9], ["B", 0, 0.0, 0.4], ["B", 7, 0.35, 0.85]],
  [], [],
];
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const fillNow = {}; for (const k of cols.keys()) fillNow[k] = 0;
const chipWant = new Map();
const arc = (a, b, u, h, out) => out.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * h, lerp(a.z, b.z, u));
const pa = new THREE.Vector3(), pb = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const target = {};
  let stroke = 0, f = 0;
  hopMat.opacity = 0;
  flyDots.forEach((d) => (d.material.opacity = 0));
  lookLines.forEach((l) => (l.visible = false));

  if (mode === 2) {
    const nowMs = performance.now();
    const inGrace = !stepMode && (nowMs < graceUntil || (nowMs < graceMax && Math.abs(camera.position.length() - camDist) > 0.45));
    if (!inGrace && (!stepMode || stepRunning)) cycleT += dt;
    if (stepMode && stepRunning && cycleT >= runUntil) {
      cycleT = runUntil;
      stepRunning = false;
      updateStepUI();
    }
    const ph = stepMode && !stepRunning ? (curStroke < 0 ? 0 : curStroke + 0.9999) : (cycleT / STROKE_T) % 4;
    stroke = Math.floor(ph);
    f = ph - stroke;
    const idle = stepMode && !stepRunning && curStroke < 0;

    if (!inGrace && stroke !== lastStroke && (!stepMode || stepRunning)) {
      lastStroke = stroke;
      banner.textContent = STROKES[stroke].word;
      banner.classList.remove("pop"); void banner.offsetWidth;
      banner.classList.add("pop");
      oneliner.textContent = STROKES[stroke].line;
      oneliner.classList.add("show");
      if (stroke === 2 && !boomSeen) {
        boomSeen = true;
        secretTimer = setTimeout(() => {
          if (mode === 2) { cardName.textContent = "The paging secret"; cardText.textContent = MAGIC; card.classList.add("secret", "show"); }
        }, 2600);
      }
    }
    for (const k of cols.keys()) {
      const a = FILL_STAGES[idle ? 0 : stroke][k], b = FILL_STAGES[idle ? 0 : stroke + 1][k];
      const w = WIN[stroke][k];
      target[k] = idle ? 0 : (w ? lerp(a, b, sm((f - w[0]) / (w[1] - w[0]))) : b);
    }
    /* words flying from a question into a box */
    if (!idle) {
      let di = 0;
      for (const [who, ti, s0, s1] of FLY[stroke]) {
        askers[who].getWorldPosition(pa);
        pb.copy(tileTop(ti));
        for (let n = 0; n < 4 && di < flyDots.length; n++, di++) {
          const u = (f - s0) / (s1 - s0) - n * 0.14;
          const d = flyDots[di];
          if (u <= 0 || u >= 1) continue;
          arc(pa, pb, u, 0.8, d.position);
          d.material.color.set(who === "A" ? C_A : C_B);
          d.material.opacity = Math.sin(u * Math.PI) * 0.95;
        }
      }
    }
    /* Look up!: the hopper visits boxes in the map's order */
    if (stroke === 2 && !idle) {
      askA.getWorldPosition(pa);
      const stops = [pa.clone(), ...A_ORDER.map(tileTop), pa.clone()];
      const leg = Math.min(3, Math.floor(f * 4)), u = sm(f * 4 - leg);
      arc(stops[leg], stops[leg + 1], u, 0.7, hop.position);
      hopMat.opacity = f > 0.97 ? 0 : 0.9;
      lineMat.opacity = 0.8;
      lookLines.forEach((l, k) => {
        l.visible = f >= (k + 0.2) / 4;
      });
    }
  } else {
    if (lastStroke !== -1 && mode !== 2) lastStroke = -1;
    for (const k of cols.keys()) target[k] = SNAP[k];
    if (mode === 0 && !reducedMotion) {
      target[9] = SNAP[9] + Math.sin(t * 1.4) * 0.1;
      askA.position.y = 3.3 + Math.sin(t * 1.4) * 0.1;
      askB.position.y = 3.3 + Math.sin(t * 1.4 + 1.5) * 0.1;
    }
  }

  /* settle each stack toward its target, then paint the map to match */
  for (const [k, col] of cols) {
    fillNow[k] = lerp(fillNow[k], target[k], 1 - Math.exp(-(mode === 2 ? 14 : 5) * dt));
    const h = Math.max(0.001, fillNow[k] * COL_H);
    col.scale.y = h;
    col.visible = fillNow[k] > 0.012;
  }
  for (const chip of chips) {
    chip.visible = chip.scale.x > 0.03;
    const want = target[chip.userData.tile] > 0.01 ? 1 : 0;
    if (chipWant.get(chip) !== want) {
      chipWant.set(chip, want);
      const o = { stiffness: 80, damping: 8 };
      spring(chip.scale, "x", want || 0.001, o); spring(chip.scale, "y", want || 0.001, o); spring(chip.scale, "z", want || 0.001, o);
    }
  }
  for (const m of [askA, askB]) m.children.forEach((c) => { if (c.userData.billboard) c.quaternion.copy(camera.quaternion); });

  const len = camera.position.length();
  camera.position.setLength(lerp(len, camDist, 1 - Math.exp(-2.2 * dt)));
  const tall = innerWidth / innerHeight < 0.75;
  const lift = mode === 1 ? (tall ? 1.4 : 1.0) : mode === 2 ? (tall ? 1.2 : 1.7) : 0;
  controls.target.y = lerp(controls.target.y, baseTargetY + lift, 1 - Math.exp(-2.2 * dt));
  stepSprings(dt);
  controls.update();
  projectLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ---------- veil ---------- */
setTimeout(() => {
  document.getElementById("veil").classList.add("gone");
  if (mode === 0) {
    modeBtns[0].classList.add("active");
    modeBtns[0].setAttribute("aria-current", "true");
    hint.textContent = HINTS[0];
  }
  setTimeout(() => hint.classList.add("show"), 800);
  wakeChrome();
}, 1900);
