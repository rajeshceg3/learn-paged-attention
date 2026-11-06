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
let PORTRAIT = innerWidth / innerHeight < 0.75;
let baseTargetY = PORTRAIT ? 0.3 : 0.35;
controls.target.set(0, baseTargetY, 0);
controls.enablePan = false;
controls.enableZoom = true;
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

/* ink-lettered numbers and letters: small planes that wait for the font.
   userData.setText redraws, so chips can be re-numbered live. */
const redraws = [];
function textPlane(text, size, color = "#33241c", billboard = false) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.font = '600 84px "Fredoka", system-ui, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(m ? m.userData.text : text, 64, 70);
    tex.needsUpdate = true;
  };
  let m = null;
  draw(); redraws.push(draw);
  m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.raycast = () => {};
  m.userData.billboard = billboard;
  m.userData.text = text;
  m.userData.setText = (t) => { m.userData.text = t; draw(); };
  return m;
}
if (document.fonts && document.fonts.load) {
  document.fonts.load('600 40px "Fredoka"').then(() => redraws.forEach((d) => d())).catch(() => {});
}

const C_A = "#e8735a", C_B = "#7fb3d5", C_C = "#9b8bd0", C_GREY = "#b8ab98";

/* the shelf (GPU memory) */
const slabGeo = () => new RoundedBoxGeometry(PORTRAIT ? 3.6 : 5.1, 0.5, PORTRAIT ? 4.5 : 3.5, 5, 0.22);
const tileXY = (i) => { const c = i % COLS_(), r = Math.floor(i / COLS_()); return [(c - (COLS_() - 1) / 2) * (PORTRAIT ? 1.1 : 1.18), (r - (ROWS_() - 1) / 2) * (PORTRAIT ? 1.02 : 1.08) + 0.15]; };
const COLS_ = () => (PORTRAIT ? 3 : 4), ROWS_ = () => (PORTRAIT ? 4 : 3);
const slab = new THREE.Mesh(slabGeo(), clay("#f2b25c"));
slab.position.y = 0.25;
engine.add(slab);
const slabHull = inkify(slab, 1.03);

/* twelve boxes (physical blocks - the numbers are their addresses) */
const COLS = PORTRAIT ? 3 : 4, ROWS = PORTRAIT ? 4 : 3;
const tiles = [];
const TILE_Y = 0.64;
const tileGeo = new RoundedBoxGeometry(1.0, 0.28, 0.92, 4, 0.1);
for (let i = 0; i < COLS * ROWS; i++) {
  const c = i % COLS, r = Math.floor(i / COLS);
  const t = new THREE.Mesh(tileGeo, clay("#ffe9c4"));
  { const [tx, tz] = tileXY(i); t.position.set(tx, TILE_Y, tz); }
  engine.add(t);
  inkify(t, 1.05);
  const num = textPlane(String(i), 0.46);
  num.rotation.x = -Math.PI / 2; num.position.set(0, 0.146, 0.2);
  t.add(num);
  t.userData.index = i;
  tiles.push(t);
}
/* per-tile wash: a thin coloured film that marks a reservation, a taken
   box, or a pulsing free box in the Why? story. Invisible otherwise. */
const WASH_H = 0.07;
const washGeo = new RoundedBoxGeometry(1.02, WASH_H, 0.94, 3, 0.03);
const washes = [];
for (let i = 0; i < COLS * ROWS; i++) {
  const w = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ color: C_GREY, transparent: true, opacity: 0 }));
  w.position.set(0, 0.145, 0);
  w.raycast = () => {};
  tiles[i].add(w);
  washes.push({ mesh: w, target: 0, pulse: false });
}

/* coloured stacks of saved notes (keys and values). Any tile can grow one;
   ensureCol builds it on first use so every chapter can reuse the shelf. */
const colGeo = new RoundedBoxGeometry(0.72, 1, 0.66, 3, 0.1);
colGeo.translate(0, 0.5, 0);
const COL_H = 0.5;
const cols = new Map();
function ensureCol(i, color) {
  if (!cols.has(i)) {
    const col = new THREE.Mesh(colGeo, clay(color));
    col.position.set(0, 0.14, -0.04);
    col.scale.set(1, 0.001, 1);
    tiles[i].add(col);
    inkify(col, 1.07);
    cols.set(i, col);
    col.userData.tileIndex = i;
  }
  if (!(i in fillNow)) { fillNow[i] = 0; fillTarget[i] = 0; }
  const col = cols.get(i);
  col.material.color.set(color);
  return col;
}
const fillNow = {};          /* current drawn fill, per tile */
const fillTarget = {};       /* what the active chapter wants, per tile */
const FILLABLE = [0, 1, 2, 4, 5, 6, 7, 8, 9, 11];
for (const i of FILLABLE) { fillNow[i] = 0; fillTarget[i] = 0; }
const OWNER_GO = { 5: C_A, 2: C_A, 9: C_A, 0: C_B, 7: C_B };
for (const k of Object.keys(OWNER_GO)) ensureCol(+k, OWNER_GO[k]);

/* the map (each request's block table). Three rows: A, B and - once the
   Why? story needs it - C. Chips are re-numbered live as boxes move. */
const boardPop = new THREE.Group();          /* layout owns this wrapper */
boardPop.position.set(0, PORTRAIT ? 1.12 : 1.5, PORTRAIT ? -3.35 : -2.25);
boardPop.rotation.x = -0.1;
boardPop.scale.setScalar(PORTRAIT ? 0.68 : 1); if (PORTRAIT) boardPop.position.x = -0.25;
engine.add(boardPop);
const board = new THREE.Mesh(new RoundedBoxGeometry(4.0, 1.95, 0.22, 4, 0.12), clay("#7dcfa0"));
boardPop.add(board);
const boardHull = inkify(board, 1.035);
const boardGhost = ghostify(board);
const slabGhost = ghostify(slab);
/* board pop-in is driven by boardProxy.v in the render loop */

const CHIP_X = [-0.45, 0.4, 1.25];
const ROW_Y = { A: 0.62, B: 0.02, C: -0.58 };
const ROW_COLOR = { A: C_A, B: C_B, C: C_C };
const chipRows = {};                         /* letter -> {tag, chips[3]} */
for (const req of ["A", "B", "C"]) {
  const tag = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.5, 0.12, 3, 0.08), clay(ROW_COLOR[req]));
  tag.position.set(-1.35, ROW_Y[req], 0.15);
  board.add(tag); inkify(tag, 1.08);
  const tl = textPlane(req, 0.5, "#33241c"); tl.position.set(0, 0, 0.07); tag.add(tl);
  const chips = [];
  const slots = [];
  for (let k = 0; k < 3; k++) {
    const slot = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.54, 0.06, 3, 0.08), new THREE.MeshBasicMaterial({ color: "#63b88a" }));
    slot.position.set(CHIP_X[k], ROW_Y[req], 0.125);
    slot.raycast = () => {};
    board.add(slot);
    slots.push(slot);
    const chip = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.46, 0.14, 3, 0.08), clay(ROW_COLOR[req]));
    chip.position.set(CHIP_X[k], ROW_Y[req], 0.19);
    chip.scale.setScalar(0.001);
    board.add(chip); inkify(chip, 1.08);
    const n = textPlane("", 0.46); n.position.set(0, 0, 0.075); chip.add(n);
    chip.userData.numPlane = n;
    chip.userData.row = req;
    chip.userData.tile = -1;
    chips.push(chip);
  }
  chipRows[req] = { tag, chips, slots };
}
/* what each row maps right now, per chapter. -1 = empty slot. */
const chipData = { A: [5, 2, 9], B: [0, 7], C: [] };
function applyChipData(data) {
  for (const req of ["A", "B", "C"]) {
    const list = data[req] || [];
    chipData[req] = list;
    chipRows[req].chips.forEach((chip, k) => {
      const t = k < list.length ? list[k] : -1;
      chip.userData.tile = t;
      if (t >= 0) chip.userData.numPlane.userData.setText(String(t));
    });
  }
  const cUsed = (data.C || []).length > 0;
  chipRows.C.tag.visible = cUsed;
  chipRows.C.slots.forEach((sl) => (sl.visible = cUsed));
  chipRows.C.chips.forEach((c) => { if (!cUsed) c.scale.setScalar(0.001); });
  buildLines();
}
/* the questions themselves */
function makeAsker(color, letter, x, z = 0.7) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), clay(color));
  m.position.set(x, 3.3, z);
  engine.add(m); inkify(m, 1.06);
  const l = textPlane(letter, 0.5, "#33241c", true);
  l.position.set(0, 0, 0.0);
  m.add(l);
  return m;
}
const askA = makeAsker(C_A, "A", PORTRAIT ? -1.0 : -1.2);
const askB = makeAsker(C_B, "B", PORTRAIT ? 1.0 : 1.2);
const askC = makeAsker(C_C, "C", 0, 1.5);
askC.position.y = 2.05;
askC.scale.setScalar(0.001);                 /* hidden until the story needs it */
const askers = { A: askA, B: askB, C: askC };

/* flying words, the next-token spark and dashed leader lines */
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
const lineMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0 });
let lookLines = [];
function buildLines() {
  lookLines.forEach((g) => { scene.remove(g); g.children.forEach((m) => m.geometry.dispose()); });
  const order = (chipData.A || []).filter((t) => t >= 0);
  lookLines = order.map((ti) => {
    const chip = chipRows.A.chips.find((c) => c.userData.tile === ti);
    if (!chip) return null;
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
  }).filter(Boolean);
}

/* x-ray: the shelf and the map fade to ink edges, like the reference's shells */
const xrayItems = [[slab, slabGhost, slabHull], [board, boardGhost, boardHull]];
function setXrayTargets(on) {
  for (const [mesh, edges, hull] of xrayItems) {
    spring(edges.material, "opacity", on ? 0.9 : 0, { stiffness: 40, damping: 10 });
    spring(mesh.material, "opacity", on ? 0.16 : 1, { stiffness: 40, damping: 10 });
    if (!mesh.material.transparent) { mesh.material.transparent = true; mesh.material.needsUpdate = true; }
    spring(hull.material, "opacity", on ? 0 : 1, { stiffness: 40, damping: 10 });
  }
}
/* re-lay the scene when the screen flips between tall and wide */
function applyLayout() {
  const g = slabGeo();
  slab.geometry.dispose(); slab.geometry = g; slabHull.geometry = g;
  slabGhost.geometry.dispose(); slabGhost.geometry = new THREE.EdgesGeometry(g, 24);
  tiles.forEach((t, i) => { const [tx, tz] = tileXY(i); t.position.x = tx; t.position.z = tz; });
  boardPop.position.z = PORTRAIT ? -3.35 : -2.25;
  boardPop.position.y = PORTRAIT ? 1.12 : 1.5;
  boardPop.scale.setScalar(PORTRAIT ? 0.68 : 1); boardPop.position.x = PORTRAIT ? -0.25 : 0;
  askA.position.x = PORTRAIT ? -1.0 : -1.2; askB.position.x = PORTRAIT ? 1.0 : 1.2;
  askC.position.x = 0;
  const sp = PARTS.find((p) => p.mesh === slab);
  if (sp) sp.anchor.set(PORTRAIT ? 1.6 : 2.3, 0, PORTRAIT ? 2.0 : 1.5);
  baseTargetY = PORTRAIT ? 0.3 : 0.35;
  if (typeof setTileLabels === "function" && typeof labeledParts !== "undefined") setTileLabels();
  scene.updateMatrixWorld(true);
  buildLines();
}

addEventListener("resize", () => {
  const p = innerWidth / innerHeight < 0.75;
  if (p === PORTRAIT) return;
  PORTRAIT = p;
  applyLayout();
  if (p) camera.position.set(3.6, 6.2, 5.0); else camera.position.set(4.8, 3.8, 6.8);
  camDist = camFor(mode);
  controls.maxDistance = camDist + 1;
  camera.position.setLength(camDist);
});

/* ---------- parts registry ---------- */
/* every friendly name sits beside its real term, and every real term sits
   on the thing you can tap - the mapping is the lesson */
const tileName = (i) => (cols.has(i) && cols.get(i).scale.y > 0.02 ? "A block of saved notes" : "A free block");
const tileText = (i) => (cols.has(i) && cols.get(i).scale.y > 0.02
  ? "A fixed-size box of the KV cache: it holds the saved keys and values for a few tokens of one answer. The number is just this block's address on the shelf."
  : "An empty block. Any request can claim it next - it does not have to sit beside that request's other blocks.");
const PARTS = [];
PARTS.push({ mesh: slab, name: () => "GPU memory", text: () => "The big shelf. Every block of every conversation's KV cache lives here.", out: 0, label: "gpu memory", anchor: new THREE.Vector3(PORTRAIT ? 1.6 : 2.3, 0, PORTRAIT ? 2.0 : 1.5) });
tiles.forEach((t, i) => {
  const r = Math.floor(i / COLS);
  const p = { mesh: t, name: () => tileName(i), text: () => tileText(i), out: [0.7, 1.2, 1.7, 2.2][r] };
  if (i === 5 || i === 7) { p.label = "block of notes"; p.anchor = new THREE.Vector3(0.5, 0.15, 0.0); p.labelOn = false; }
  if (i === 6 || i === 8) { p.label = "free block"; p.anchor = new THREE.Vector3(-0.5, 0.15, 0.0); p.labelOn = false; }
  PARTS.push(p);
});
PARTS.push({ mesh: board, name: () => "Block table", text: () => "Each request's map: which physical blocks hold its tokens, in order. Your computer uses the very same trick for its own memory - it is called virtual memory, and PagedAttention borrows it.", out: 1.0, label: "block table", anchor: new THREE.Vector3(PORTRAIT ? 1.0 : 1.6, 1.45, 0.15) });
PARTS.push({ mesh: askA, name: () => "A request", text: () => "Someone talking to the model. The answer grows token by token, and each token's keys and values are cached in this request's blocks.", out: 0.9, label: "request A", anchor: new THREE.Vector3(-0.1, 0.2, 0) });
PARTS.push({ mesh: askB, name: () => "A request", text: () => "Someone talking to the model. The answer grows token by token, and each token's keys and values are cached in this request's blocks.", out: 0.9 });
PARTS.forEach((p) => { p.home = p.mesh.position.y; p.mesh.userData.part = p; });
const pickMeshes = PARTS.map((p) => p.mesh).concat([...cols.values()], ...Object.values(chipRows).flatMap((r) => r.chips));
cols.forEach((c) => { c.userData.part = PARTS.find((p) => p.mesh === tiles[c.userData.tileIndex]); });
Object.values(chipRows).forEach((r) => r.chips.forEach((c) => { c.userData.part = PARTS.find((p) => p.mesh === board); }));
const tmpV = new THREE.Vector3();

/* ---------- x-ray labels (leader lines) ---------- */
const labelLayer = document.getElementById("labels");
const leaderSvg = document.getElementById("leaders");
const labeledParts = PARTS.filter((p) => p.label);
function setTileLabels() {
  const notes = PORTRAIT ? 5 : 7, free = PORTRAIT ? 6 : 8;
  for (const p of labeledParts) {
    const i = tiles.indexOf(p.mesh);
    if (i >= 0) p.labelOn = i === notes || i === free;
  }
}
setTileLabels();
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
/* One selected annotation lives outside the model stage. Other parts stay
   available as semantic controls, not a stack of text over the scene. */
let selectedAnnotation = 0;
const annotationNav = document.createElement("nav");
annotationNav.id = "annotation-nav";
annotationNav.setAttribute("aria-label", "Model parts");
document.body.appendChild(annotationNav);
const annotationSelect = document.createElement("select");
annotationSelect.setAttribute("aria-label","Named model part");
annotationNav.appendChild(annotationSelect);
const annotationButtons = labeledParts.map((p,i)=>{
 const option=document.createElement("option");option.value=String(i);option.textContent=p.label;annotationSelect.appendChild(option);return option;
});
annotationSelect.addEventListener("change",()=>{selectedAnnotation=Number(annotationSelect.value);wakeChrome();});
let fittedDistance=0, zoomScale=1, lastFittedMode=-1;
let modelStage = {x:0,y:0,w:innerWidth,h:innerHeight};
function spatialStage() {
  const annotated = mode === 2 || mode === 3;
  if (!annotated) return {x:0,y:0,w:innerWidth,h:innerHeight};
  if(innerHeight<500)return {x:14,y:20,w:innerWidth-310,h:innerHeight-40};
  const top = mode === 3 ? Math.max(150, oneliner.getBoundingClientRect().bottom + 24) : 42;
  const bottom = Math.min(card.classList.contains("show") ? card.getBoundingClientRect().top-20 : innerHeight, hint.getBoundingClientRect().top - 112,
    (mode === 3 ? stepui : document.getElementById("modes")).getBoundingClientRect().top - 110);
  return {x:14,y:top,w:innerWidth-28,h:Math.max(100,bottom-top)};
}
function projectLabels() {
  const show = (mode === 2 || mode === 3) && !card.classList.contains("show");
  annotationNav.hidden = !show;
  for (const [i,p] of labeledParts.entries()) {labelEls.get(p).classList.remove("on");if(!show||i!==selectedAnnotation)leaderPaths.get(p).classList.remove("on");}
  if (!show) {for(const part of labeledParts)if(part.mesh.material?.emissive)part.mesh.material.emissive.set(0);return;}
  const available = labeledParts.map((p,i)=>p.labelOn !== false ? i : -1).filter(i=>i>=0);
  if (!available.includes(selectedAnnotation)) selectedAnnotation = available[0];
  annotationButtons.forEach((b,i)=>{b.hidden=!available.includes(i);b.disabled=!available.includes(i);});
  annotationSelect.value=String(selectedAnnotation);
  annotationNav.style.top = innerHeight<500 ? `${innerHeight-65}px` : `${modelStage.y+modelStage.h+26}px`;
  annotationNav.style.left = innerHeight<500 ? `${innerWidth-285}px` : '14px';
  const p=labeledParts[selectedAnnotation], b=annotationSelect;
  for(const part of labeledParts){if(part.mesh.material?.emissive){part.mesh.material.emissive.set(part===p ? '#8a5c22':'#000000');part.mesh.material.emissiveIntensity=part===p ? .24 : 0;}}
  p.mesh.geometry.computeBoundingBox();
  tmpV.copy(p.anchor).clamp(p.mesh.geometry.boundingBox.min,p.mesh.geometry.boundingBox.max); p.mesh.localToWorld(tmpV); tmpV.project(camera);
  const ax=modelStage.x+(tmpV.x*.5+.5)*modelStage.w;
  const ay=modelStage.y+(-tmpV.y*.5+.5)*modelStage.h;
  if(tmpV.z>1||tmpV.z< -1||ax<modelStage.x||ax>modelStage.x+modelStage.w||ay<modelStage.y||ay>modelStage.y+modelStage.h)return;
  const r=b.getBoundingClientRect(),lx=r.left+r.width/2,ly=r.top-5;
  const path=leaderPaths.get(p);
  leaderSvg.setAttribute("viewBox",`0 0 ${innerWidth} ${innerHeight}`);
  const rail = modelStage.x+modelStage.w+3;
  path.setAttribute("d",`M ${ax} ${ay} L ${lx} ${ly}`);
  const hitRay=new THREE.Raycaster();
  hitRay.setFromCamera(new THREE.Vector2(tmpV.x,tmpV.y),camera);
  const hits=hitRay.intersectObjects([slab,board,askA,askB,...tiles,...cols.values()],false);
  if(hits[0]?.object===p.mesh)path.classList.add("on");else path.classList.remove("on");
}
function fitSpatialStage() {
  modelStage=spatialStage();
  camera.aspect=modelStage.w/modelStage.h;
  camera.updateProjectionMatrix();
  if(mode!==2&&mode!==3){lastFittedMode=-1;return;}
  // Fit all meaningful parts (including exploded poses) at every camera angle.
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3();
  for(const m of [slab,board,askA,askB,...tiles,...cols.values()]) {
    if(m.visible && m.scale.length()>0.05)box.expandByObject(m);
  }
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const half=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
  let distance=0;
  const inverse=camera.quaternion.clone().invert();
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanX=tanY*camera.aspect;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const v=new THREE.Vector3(x,y,z).sub(sphere.center).applyQuaternion(inverse);
    distance=Math.max(distance,v.z+Math.max(Math.abs(v.x)/tanX,Math.abs(v.y)/tanY));
  }
  distance*=1.08;
  const dir=camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(dir,distance*zoomScale);
  if(lastFittedMode===mode&&fittedDistance>0)zoomScale=Math.max(1,Math.min(1.7,camera.position.distanceTo(controls.target)/fittedDistance));
  else zoomScale=1;
  fittedDistance=distance;lastFittedMode=mode;
  controls.minDistance=distance;controls.maxDistance=distance*1.7;
  camera.lookAt(sphere.center);
  camera.updateMatrixWorld(true);
}

/* ---------- Why? - feel the problem before meeting the fix ---------- */
/* The old way (reserve one unbroken run up front) fails on the same shelf
   the paged way then solves. compare pills flip between the two. */
const WHY_TAKEN = [3, 7, 10];       /* older work already on the shelf */
const WHY_A_OLD = { 0: 1, 1: 0.6 }, WHY_B_OLD = { 4: 0.7 };
const WHY_PAGED = [
  ["A", { 0: 1, 8: 1, 5: 0.5 }],
  ["B", { 4: 1, 9: 0.45 }],
  ["C", { 1: 1, 6: 1, 11: 0.35 }],
];
const WHY_STATES = [
  { banner: "One shelf, many questions",
    line: "Lots of people ask the model things at once - and every answer needs room to grow, token by token.",
    stacks: {}, claims: [], cFree: false, cShown: false, board: null },
  { banner: "Save your spot",
    line: "The old way: each question must reserve one unbroken run of boxes, sized for the longest answer it might ever give.",
    stacks: { ...WHY_A_OLD, ...WHY_B_OLD },
    claims: [["A", [0, 1, 2]], ["B", [4, 5, 6]]], cFree: false, cShown: false, board: null },
  { banner: "Turned away",
    line: "C needs 3 boxes in a row. 3 boxes are free - but scattered. So C waits, while reserved boxes sit half-empty.",
    stacks: { ...WHY_A_OLD, ...WHY_B_OLD },
    claims: [["A", [0, 1, 2]], ["B", [4, 5, 6]]], cFree: true, cShown: true, board: null },
  { banner: "Grab as you go",
    line: "The paged way: a request takes boxes only as its answer grows - any free box, anywhere. A small map keeps the order.",
    stacks: Object.assign({}, ...WHY_PAGED.map(([, m]) => m)),
    claims: [], cFree: false, cShown: true, board: { A: [0, 8, 5], B: [4, 9], C: [1, 6, 11] } },
  { banner: "Same shelf",
    line: "Old way: C waits with 3 boxes free. Paged way: everyone fits - and the only waste left is the empty corner of each answer's last box.",
    stacks: Object.assign({}, ...WHY_PAGED.map(([, m]) => m)),
    claims: [], cFree: false, cShown: true, board: { A: [0, 8, 5], B: [4, 9], C: [1, 6, 11] } },
];
let whyState = 0;
const compareEl = document.getElementById("compare");
const cmpOld = document.getElementById("cmp-old");
const cmpNew = document.getElementById("cmp-new");
function applyWhy() {
  const s = WHY_STATES[whyState];
  /* the storytellers dip below the narration band while the story runs */
  spring(askA.position, "y", 2.05, { stiffness: 42, damping: 9 });
  spring(askB.position, "y", 2.05, { stiffness: 42, damping: 9 });
  /* stacks: zero everything first, then grow what this state owns */
  for (const i of FILLABLE) fillTarget[i] = 0;
  for (const [req, m] of WHY_PAGED) { /* keep colours honest for whichever story owns the tile */ }
  const ownerOf = {};
  if (whyState >= 3) { WHY_PAGED.forEach(([req, m]) => Object.keys(m).forEach((k) => (ownerOf[k] = ROW_COLOR[req]))); }
  else { Object.keys(WHY_A_OLD).forEach((k) => (ownerOf[k] = C_A)); Object.keys(WHY_B_OLD).forEach((k) => (ownerOf[k] = C_B)); }
  for (const [k, v] of Object.entries(s.stacks)) { ensureCol(+k, ownerOf[k]); fillTarget[k] = v; }
  /* washes: taken boxes grey; claims tinted by owner; free boxes pulse in the blocked state */
  washes.forEach((w, i) => { w.target = 0; w.pulse = false; });
  for (const i of WHY_TAKEN) { washes[i].mesh.material.color.set(C_GREY); washes[i].target = 0.6; }
  for (const [req, list] of s.claims) for (const i of list) { washes[i].mesh.material.color.set(ROW_COLOR[req]); washes[i].target = 0.38; }
  if (s.cFree) for (const i of [8, 9, 11]) { washes[i].mesh.material.color.set(C_C); washes[i].pulse = true; }
  /* C shows up when the story needs it - greyed while it is turned away */
  spring(askC.scale, "x", s.cShown ? 1 : 0.001, { stiffness: 60, damping: 9 });
  spring(askC.scale, "y", s.cShown ? 1 : 0.001, { stiffness: 60, damping: 9 });
  spring(askC.scale, "z", s.cShown ? 1 : 0.001, { stiffness: 60, damping: 9 });
  askC.material.transparent = true;
  spring(askC.material, "opacity", whyState === 2 ? 0.5 : 1, { stiffness: 40, damping: 10 });
  /* the map only exists in the paged telling - that contrast is the point */
  spring(boardProxy, "v", s.board ? 1 : 0.001, { stiffness: 42, damping: 9 });
  applyChipData(s.board || { A: [5, 2, 9], B: [0, 7], C: [] });
  banner.textContent = s.banner;
  banner.classList.remove("pop"); void banner.offsetWidth; banner.classList.add("pop");
  oneliner.textContent = s.line;
  oneliner.classList.add("show");
  cmpOld.classList.toggle("active", whyState <= 2);
  cmpNew.classList.toggle("active", whyState >= 3);
  updateStepUI();
}
cmpOld.addEventListener("click", () => { whyState = 2; applyWhy(); wakeChrome(); });
cmpNew.addEventListener("click", () => { whyState = 3; applyWhy(); wakeChrome(); });

/* ---------- four-stroke cycle ---------- */
const STROKES = [
  { word: "Ask!", line: "Two requests arrive. Answers grow token by token - and every token saves its keys and values (its KV cache) into a block." },
  { word: "Write!", line: "Blocks are fixed-size. One full? Grab ANY free block - the block table just adds it to the list." },
  { word: "Look up!", line: "To write the next token, attention reads from all of the request's blocks at once - right where they sit. Nothing is copied together." },
  { word: "Give back!", line: "Answer finished. Its blocks go back to the free pile, ready for the next request. Only the last block's empty corner is ever wasted." },
];
const STROKE_T = 2.0;
let cycleT = 0, lastStroke = -1, boomSeen = false, graceUntil = 0, graceMax = 0;
let stepMode = true;     /* true: Next! advances one stroke; false: runs on its own */
let stepRunning = false; /* a pressed stroke is animating right now */
let curStroke = -1;      /* stroke playing or last played in step mode (-1 = none yet) */
let runUntil = 0;
/* the learner picks A's next block the first time one runs out - prediction
   before demonstration. aThird is whatever free box they tapped. */
let aThird = null;
let predictPending = false, predictDone = false;
const A_THIRD_DEFAULT = 9;
const thirdBox = () => (aThird === null ? A_THIRD_DEFAULT : aThird);
/* stage maps depend on the chosen box, so they are built on demand */
function stageMaps() {
  const t3 = thirdBox();
  const STAGES = [
    { 5: 0, 2: 0, 0: 0, 7: 0 },
    { 5: 1, 2: 0.25, 0: 0.625, 7: 0 },
    { 5: 1, 2: 1, 0: 1, 7: 0.25 },
    { 5: 1, 2: 1, 0: 1, 7: 0.25 },
    { 5: 0, 2: 0, 0: 0, 7: 0 },
  ];
  STAGES[1][t3] = 0; STAGES[2][t3] = 0.5; STAGES[3][t3] = 0.5; STAGES[4][t3] = 0;
  const WIN = [
    { 5: [0.05, 0.55], 2: [0.35, 0.85], 0: [0.15, 0.75] },
    { 2: [0.05, 0.45], 0: [0.05, 0.4], 7: [0.4, 0.85] },
    {},
    { 0: [0.05, 0.45], 7: [0.1, 0.5], 5: [0.35, 0.8], 2: [0.45, 0.9] },
  ];
  WIN[1][t3] = [0.4, 0.9]; WIN[3][t3] = [0.55, 0.95];
  const FLY = [
    [["A", 5, 0.0, 0.5], ["A", 2, 0.3, 0.8], ["B", 0, 0.1, 0.7]],
    [["A", 2, 0.0, 0.45], ["A", t3, 0.35, 0.9], ["B", 0, 0.0, 0.4], ["B", 7, 0.35, 0.85]],
    [], [],
  ];
  return { STAGES, WIN, FLY };
}
const SNAP = { 5: 1, 2: 1, 9: 0.5, 0: 1, 7: 0.25 };
function setGoColors() {
  ensureCol(5, C_A); ensureCol(2, C_A); ensureCol(thirdBox(), C_A);
  ensureCol(0, C_B); ensureCol(7, C_B);
}

/* ---------- modes + chrome ---------- */
const banner = document.getElementById("banner");
const oneliner = document.getElementById("oneliner");
const hint = document.getElementById("hint");
const card = document.getElementById("card");
const cardName = document.getElementById("card-name");
const cardText = document.getElementById("card-text");
const cardChoices = document.getElementById("card-choices");
const cardOk = document.getElementById("card-ok");
const chrome = [...document.querySelectorAll(".chrome")].filter((c) => !["modes","card","stepui"].includes(c.id));
const modeBtns = [...document.querySelectorAll(".modebtn")];
const stepui = document.getElementById("stepui");
const nextBtn = document.getElementById("next");
const backBtn = document.getElementById("back");
const autoBtn = document.getElementById("autotoggle");
let mode = 0;
const tallScreen = () => innerWidth / innerHeight < 0.75;
const CAM = { tall: [17, 17, 18, 17.5, 17], wide: [11.2, 11.2, 12, 12.5, 11.2] };
const camFor = (m) => (tallScreen() ? CAM.tall : CAM.wide)[m];
let camDist = camFor(0);
controls.maxDistance = camDist + 1;
if (PORTRAIT) camera.position.set(3.6, 6.2, 5.0);
camera.position.setLength(camDist);

const HINTS = [
  "Step through the old way and the paged way",
  "Drag to spin it around",
  "Tap a part to meet it",
  "Watch it go - four moves, over and over",
  "Two quick checks, then say it back",
];
const MAGIC = "Paging secret: a request's blocks never need to sit side by side - its block table remembers where each one is, exactly like your computer's virtual memory maps its pages. Same trick, new home: the GPU.";

let secretTimer = 0;
function setMode(m) {
  const prevMode = mode;
  clearTimeout(secretTimer);
  mode = m;
  camDist = camFor(m);
  controls.maxDistance = camDist + 1;
  modeBtns.forEach((b, i) => {
    b.classList.toggle("active", i === m);
    if (i === m) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
  controls.autoRotate = m === 1 && !reducedMotion;
  card.classList.remove("show", "secret");
  banner.classList.remove("muted");
  cardChoices.classList.remove("show");
  /* Your turn gives the stage to the learner's words: on wide screens the map
     drops out of the final headline's way */
  const quizStage = m === 4 && !PORTRAIT;
  spring(boardPop.position, "y", quizStage ? 0.9 : (PORTRAIT ? 1.12 : 1.5));
  spring(boardPop.position, "z", quizStage ? -2.75 : (PORTRAIT ? -3.35 : -2.25));
  compareEl.classList.toggle("show", m === 0);
  stepui.classList.remove("show");
  hint.textContent = HINTS[m];
  hint.classList.toggle("show",m!==2&&m!==3);
  if (m === 2) {
    banner.classList.remove("pop"); oneliner.classList.remove("show");
    for (const p of PARTS) spring(p.mesh.position, "y", p.home + p.out, { stiffness: 42, damping: 8.5 });
    setXrayTargets(true);
  } else {
    for (const p of PARTS) spring(p.mesh.position, "y", p.home, { stiffness: 48, damping: 9 });
    setXrayTargets(m === 3);
  }
  /* chapters that are not the Why? story clear its washes and its guest */
  if (m !== 0) {
    washes.forEach((w) => { w.target = 0; w.pulse = false; });
    spring(askC.scale, "x", 0.001); spring(askC.scale, "y", 0.001); spring(askC.scale, "z", 0.001);
    askC.material.transparent = true; askC.material.opacity = 1;
    spring(boardProxy, "v", 1, { stiffness: 48, damping: 9 });
    setGoColors();
    applyChipData({ A: [5, 2, thirdBox()], B: [0, 7], C: [] });
    for (const i of FILLABLE) fillTarget[i] = SNAP[i] || 0;
  }
  if (m === 0) {
    whyState = 0;
    banner.classList.remove("pop"); oneliner.classList.remove("show");
    applyWhy();
  }
  if (m === 3) {
    cycleT = 0; lastStroke = -1; boomSeen = false;
    curStroke = -1; stepRunning = false; runUntil = 0; predictPending = false;
    for (const i of FILLABLE) fillTarget[i] = 0;
    updateStepUI();
    graceUntil = performance.now() + (prevMode === 2 ? 2100 : 1200);
    graceMax = performance.now() + 5000;
  } else {
    setTimeout(() => { if (mode !== 3) { banner.classList.remove("pop"); oneliner.classList.remove("show"); } }, 400);
  }
  /* the quiz keeps the stage to itself: requests step off so the card and
     the final banner own the frame */
  const askOut = m === 4 ? 0.001 : 1;
  for (const a of [askA, askB]) {
    spring(a.scale, "x", askOut); spring(a.scale, "y", askOut); spring(a.scale, "z", askOut);
  }
  if (m === 4) startQuiz();
  wakeChrome();
}
modeBtns.forEach((b, i) => b.addEventListener("click", () => setMode(i)));

/* step mode hides the hint: the pulsing button is the invitation. */
function updateStepUI() {
  if (mode !== 0 && mode !== 3) { stepui.classList.remove("show"); return; }
  stepui.classList.add("show");
  if (mode === 0) {
    autoBtn.hidden = true;
    backBtn.hidden = whyState === 0;
    nextBtn.hidden = false;
    nextBtn.textContent = whyState >= 4 ? "Meet it!" : "Next!";
    nextBtn.classList.toggle("invite", !reducedMotion);
    hint.classList.remove("show");
    return;
  }
  autoBtn.hidden = false;
  if (stepMode) {
    nextBtn.hidden = stepRunning || predictPending;
    backBtn.hidden = stepRunning || (curStroke < 0 && !predictPending);
    nextBtn.textContent = curStroke < 0 ? "Go!" : curStroke >= 3 ? "Go again!" : "Next!";
    nextBtn.classList.toggle("invite", !stepRunning && !predictPending && !reducedMotion);
    autoBtn.textContent = "Let it run";
    hint.classList.remove("show");
  } else {
    nextBtn.hidden = true;
    backBtn.hidden = true;
    autoBtn.textContent = "Step it";
    hint.textContent = HINTS[3];
    hint.classList.add("show");
  }
}

/* one press, one move - or, the first time a block runs full, the learner
   predicts where the answer can possibly grow next */
nextBtn.addEventListener("click", () => {
  if (mode === 0) {
    if (whyState >= 4) { setMode(1); return; }
    whyState++; applyWhy(); wakeChrome(); return;
  }
  if (mode !== 3 || !stepMode || stepRunning || predictPending) return;
  if (curStroke >= 3) { cycleT = 0; curStroke = -1; }
  const nextStroke = curStroke + 1;
  if (nextStroke === 1 && !predictDone) {
    predictPending = true;
    banner.textContent = "You tell me!";
    banner.classList.remove("pop"); void banner.offsetWidth; banner.classList.add("pop");
    oneliner.textContent = "Block 2 just filled up. A's answer is still growing - which block can it grab next? Tap any box on the shelf.";
    oneliner.classList.add("show");
    lastStroke = 1; /* keep the Ask! pose on screen */
    updateStepUI();
    wakeChrome();
    return;
  }
  curStroke = nextStroke;
  runUntil = cycleT + STROKE_T;
  stepRunning = true;
  updateStepUI();
  wakeChrome();
});

/* undo one move: the engine settles back to the end of the previous one */
backBtn.addEventListener("click", () => {
  if (mode === 0) {
    if (whyState > 0) { whyState--; applyWhy(); }
    wakeChrome(); return;
  }
  if (mode !== 3 || !stepMode || stepRunning) return;
  if (predictPending) {
    predictPending = false;
    banner.classList.remove("pop"); oneliner.classList.remove("show");
    lastStroke = 0;
    updateStepUI(); wakeChrome(); return;
  }
  if (curStroke < 0) return;
  curStroke--;
  cycleT = (curStroke + 1) * STROKE_T;
  lastStroke = -1;         /* let the tick re-announce this pose quietly */
  const { STAGES } = stageMaps();
  const pose = STAGES[curStroke + 1];
  for (const k of cols.keys()) fillNow[k] = pose[k] || 0;
  if (curStroke >= 0) {
    banner.textContent = STROKES[curStroke].word;
    oneliner.textContent = STROKES[curStroke].line;
    oneliner.classList.add("show");
  } else {
    banner.classList.remove("pop"); banner.textContent = ""; oneliner.classList.remove("show");
  }
  updateStepUI();
  wakeChrome();
});

autoBtn.addEventListener("click", () => {
  if (mode !== 3) return;
  if (predictPending) return;      /* the prediction is the point - answer it first */
  stepMode = !stepMode;
  if (stepMode) {
    curStroke = Math.floor((cycleT / STROKE_T) % 4);
    runUntil = (Math.floor(cycleT / STROKE_T) + 1) * STROKE_T;
    stepRunning = true;
  } else {
    if (!predictDone) { predictDone = true; }   /* auto-run uses block 9 quietly */
    stepRunning = false;
  }
  updateStepUI();
  wakeChrome();
});

cardOk.addEventListener("click", () => {
  if (mode === 4 && quizAdvance()) { wakeChrome(); return; }
  if (card.classList.contains("secret")) banner.classList.remove("muted");
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
  if (moved > 14) return;
  if(e.clientX<modelStage.x||e.clientX>modelStage.x+modelStage.w||e.clientY<modelStage.y||e.clientY>modelStage.y+modelStage.h)return;
  const nd = new THREE.Vector2(((e.clientX-modelStage.x) / modelStage.w) * 2 - 1, -((e.clientY-modelStage.y) / modelStage.h) * 2 + 1);
  ray.setFromCamera(nd, camera);
  /* the prediction: the shelf itself is the answer sheet */
  if (mode === 3 && predictPending) {
    const hit = ray.intersectObjects(tiles, false)[0];
    if (!hit) return;
    const i = hit.object.userData.index;
    if ((fillNow[i] || 0) > 0.02) {
      cardName.textContent = "That one's taken";
      cardText.textContent = "Block " + i + " is already full of notes. A can grab any FREE block - tap an empty one.";
      card.classList.remove("secret"); card.classList.add("show");
      wakeChrome();
      return;
    }
    aThird = i; predictDone = true; predictPending = false;
    setGoColors();
    applyChipData({ A: [5, 2, aThird], B: [0, 7], C: [] });
    banner.textContent = "Write!";
    banner.classList.remove("pop"); void banner.offsetWidth; banner.classList.add("pop");
    oneliner.textContent = "Yes - block " + i + " works. ANY free block does; the block table simply adds it to A's list. " + STROKES[1].line;
    oneliner.classList.add("show");
    curStroke = 1;
    runUntil = cycleT + STROKE_T;
    stepRunning = true;
    updateStepUI();
    wakeChrome();
    return;
  }
  if (mode !== 2) return;
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

/* ---------- Your turn: two checks, a say-back, and the honest edges ---------- */
const QUIZ = [
  { kind: "q", name: "Quick check · 1 of 2",
    text: "A's answer finishes. What happens to its blocks?",
    choices: ["They stay saved for A, just in case", "They go back to the free pile"],
    right: 1,
    yes: "Right - free again for the next request. Keeping them 'just in case' is the old way's waste.",
    no: "Not quite - keeping them 'just in case' is exactly the old way's waste. In the paged way, finished blocks go straight back to the free pile." },
  { kind: "q", name: "Quick check · 2 of 2",
    text: "Do a request's blocks need to sit side by side?",
    choices: ["Yes - one unbroken run", "No - anywhere works, the map keeps track"],
    right: 1,
    yes: "Right. The block table remembers the order, wherever the blocks sit - the same idea as your computer's virtual memory.",
    no: "Not quite - needing one unbroken run is what turned C away in the Why? story. The block table keeps the order, so blocks can sit anywhere. Your computer's virtual memory works the same way." },
  { kind: "note", name: "Say it back",
    text: "Answers grow token by token. Each token's keys and values - the KV cache - fill fixed-size blocks that can sit anywhere in GPU memory. A block table maps each request to its blocks, and attention reads them through the map without copying anything together. Finished requests hand their blocks back - so almost nothing is wasted, and one GPU can serve many requests at once.",
    ok: "I've got it" },
  { kind: "note", name: "What this toy simplifies",
    text: "12 blocks and tiny answers stand in for thousands of blocks and long answers. Real systems also share blocks - two requests with the same opening words can point at the same blocks. The idea is exactly this.",
    ok: "Done" },
];
let quizStep = 0, quizWaiting = false;
function renderQuiz() {
  const q = QUIZ[quizStep];
  cardName.textContent = q.name;
  cardText.textContent = q.text;
  cardChoices.innerHTML = "";
  quizWaiting = false;
  if (q.kind === "q") {
    q.choices.forEach((c, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => {
        const good = k === q.right;
        b.classList.add(good ? "right" : "wrong");
        cardText.textContent = good ? q.yes : q.no;
        [...cardChoices.children].forEach((x) => (x.disabled = true));
        setTimeout(() => { cardChoices.classList.remove("show"); quizWaiting = true; }, good ? 350 : 650);
      });
      cardChoices.appendChild(b);
    });
    cardChoices.classList.add("show");
    cardOk.textContent = "Next";
  } else {
    cardOk.textContent = q.ok;
    quizWaiting = true;
  }
  card.classList.remove("secret");
  card.classList.add("show");
}
function startQuiz() {
  quizStep = 0;
  banner.classList.remove("pop"); banner.textContent = "";
  oneliner.classList.remove("show");
  renderQuiz();
}
/* returns true while the quiz still owns the card */
function quizAdvance() {
  if (cardChoices.classList.contains("show")) return true;   /* answer first */
  if (!quizWaiting) return true;
  quizStep++;
  if (quizStep < QUIZ.length) { renderQuiz(); return true; }
  card.classList.remove("show");
  banner.textContent = "You've got it";
  banner.classList.remove("pop"); void banner.offsetWidth; banner.classList.add("pop");
  hint.textContent = "Tell a friend how the shelf works - explaining it is the real test";
  hint.classList.add("show");
  return true;
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const chipWant = new Map();
const arc = (a, b, u, h, out) => out.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * h, lerp(a.z, b.z, u));
const pa = new THREE.Vector3(), pb = new THREE.Vector3();
const boardProxy = { v: 1 };
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  hopMat.opacity = 0;
  flyDots.forEach((d) => (d.material.opacity = 0));
  lookLines.forEach((l) => (l.visible = false));

  if (mode === 3) {
    const { STAGES, WIN, FLY } = stageMaps();
    const nowMs = performance.now();
    const inGrace = !stepMode && (nowMs < graceUntil || (nowMs < graceMax && Math.abs(camera.position.length() - camDist) > 0.45));
    if (!inGrace && (!stepMode || stepRunning)) cycleT += dt;
    if (stepMode && stepRunning && cycleT >= runUntil) {
      cycleT = runUntil;
      stepRunning = false;
      updateStepUI();
    }
    const ph = stepMode && !stepRunning ? (curStroke < 0 ? 0 : curStroke + 0.9999) : (cycleT / STROKE_T) % 4;
    const stroke = Math.floor(ph);
    const f = ph - stroke;
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
          if (mode === 3) { cardName.textContent = "The paging secret"; cardText.textContent = MAGIC; card.classList.add("secret", "show"); banner.classList.add("muted"); }
        }, 2600);
      }
    }
    for (const k of cols.keys()) {
      const a = STAGES[idle ? 0 : stroke][k] || 0, b = STAGES[idle ? 0 : stroke + 1][k] || 0;
      const w = WIN[stroke][k];
      fillTarget[k] = idle ? 0 : (w ? lerp(a, b, sm((f - w[0]) / (w[1] - w[0]))) : b);
    }
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
          d.material.color.set(ROW_COLOR[who]);
          d.material.opacity = Math.sin(u * Math.PI) * 0.95;
        }
      }
    }
    /* Look up!: all of A's blocks light up together, and their read
       gathers into the next token, which flies back to A. The blocks
       never move - the map points, attention reads in place. */
    if (stroke === 2 && !idle) {
      lineMat.opacity = 0.8;
      lookLines.forEach((l, k) => { l.visible = f >= 0.1 + k * 0.08; });
      const chip0 = chipRows.A.chips.find((c) => c.userData.tile >= 0);
      if (chip0 && f >= 0.35) {
        chip0.getWorldPosition(pa);
        askA.getWorldPosition(pb); pb.y += 0.15;
        const u = sm((f - 0.35) / 0.55);
        arc(pa, pb, u, 0.9, hop.position);
        hopMat.opacity = f > 0.95 ? 0 : 0.9;
      }
    }
  } else if (mode !== 0) {
    /* Meet it / Peek inside / Your turn: the posed shelf, gently alive */
    if (lastStroke !== -1) lastStroke = -1;
    const snap = { 5: 1, 2: 1, 0: 1, 7: 0.25 };
    snap[thirdBox()] = 0.5;
    for (const i of FILLABLE) fillTarget[i] = snap[i] || 0;
    if (mode === 1 && !reducedMotion) {
      fillTarget[thirdBox()] = snap[thirdBox()] + Math.sin(t * 1.4) * 0.1;
      askA.position.y = 3.3 + Math.sin(t * 1.4) * 0.1;
      askB.position.y = 3.3 + Math.sin(t * 1.4 + 1.5) * 0.1;
    }
  }

  /* settle stacks, washes, chips and the map toward what the chapter wants */
  for (const [k, col] of cols) {
    fillNow[k] = lerp(fillNow[k] || 0, fillTarget[k] || 0, 1 - Math.exp(-(mode === 3 ? 14 : 5) * dt));
    const h = Math.max(0.001, (fillNow[k] || 0) * COL_H);
    col.scale.y = h;
    col.visible = (fillNow[k] || 0) > 0.012;
  }
  for (const w of washes) {
    if (w.pulse) w.mesh.material.opacity = 0.34 + 0.22 * Math.sin(t * 4);
    else w.mesh.material.opacity = lerp(w.mesh.material.opacity, w.target, 1 - Math.exp(-6 * dt));
  }
  board.scale.setScalar(Math.max(0.001, boardProxy.v));
  for (const row of Object.values(chipRows)) {
    for (const chip of row.chips) {
      chip.visible = chip.scale.x > 0.03;
      const want = chip.userData.tile >= 0 && (fillTarget[chip.userData.tile] || 0) > 0.01 ? 1 : 0;
      if (chipWant.get(chip) !== want) {
        chipWant.set(chip, want);
        const o = { stiffness: 80, damping: 8 };
        spring(chip.scale, "x", want || 0.001, o); spring(chip.scale, "y", want || 0.001, o); spring(chip.scale, "z", want || 0.001, o);
      }
    }
  }
  for (const m of [askA, askB, askC]) m.children.forEach((c) => { if (c.userData.billboard) c.quaternion.copy(camera.quaternion); });

  const len = camera.position.length();
  if(mode!==2&&mode!==3)camera.position.setLength(lerp(len, camDist, 1 - Math.exp(-2.2 * dt)));
  const tall = innerWidth / innerHeight < 0.75;
  const lift = mode === 2 ? (tall ? 1.4 : 1.0) : mode === 3 ? (tall ? 1.2 : 1.7) : 0;
  controls.target.y = lerp(controls.target.y, baseTargetY + lift, 1 - Math.exp(-2.2 * dt));
  stepSprings(dt);
  controls.update();
  fitSpatialStage();
  projectLabels();
  renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setScissorTest(false);renderer.clear();
  renderer.setViewport(modelStage.x,innerHeight-modelStage.y-modelStage.h,modelStage.w,modelStage.h);
  renderer.setScissor(modelStage.x,innerHeight-modelStage.y-modelStage.h,modelStage.w,modelStage.h);
  renderer.setScissorTest(true);
  if(mode!==4 && !(card.classList.contains("show")&&!card.classList.contains("secret")))renderer.render(scene, camera);
  renderer.setScissorTest(false);
  requestAnimationFrame(tick);
}
tick();
setMode(0);


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

// Read-only layout evidence for regression checks, no scene mutation hooks.
export function spatialLayoutEvidence() {
 const bounds=[];
 for(const m of [slab,board,askA,askB,...tiles,...cols.values()]){
  if(!m.visible||m.scale.length()<.05)continue;
  const box=new THREE.Box3().setFromObject(m);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const v=new THREE.Vector3(x,y,z).project(camera);bounds.push({x:modelStage.x+(v.x*.5+.5)*modelStage.w,y:modelStage.y+(-v.y*.5+.5)*modelStage.h});
  }
 }
 return {mode,stage:{...modelStage},bounds,selected:selectedAnnotation,occluded:!document.querySelector('.leader.on')};
}
