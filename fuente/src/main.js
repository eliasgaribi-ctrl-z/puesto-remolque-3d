import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  scene, camera, controls, renderer, stageEl, setGrid, applyTheme, fitLight, fitContact, contactDirty,
  invalidate, onFrame, onResize, start, capture, quality, setQuality, onQuality, coarse,
} from './stage.js';
import { TECH, fontTextures } from './materials.js';
import { dimMats } from './annot.js';
import { buildPuesto } from './puesto.js';
import { buildRemolque } from './remolque.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const models = { puesto: buildPuesto(), remolque: buildRemolque() };
const original = new WeakMap(), edges = new WeakMap();
let technical = false;

for (const m of Object.values(models)) {
  scene.add(m.root);
  m.geo.traverse(o => { if (o.isMesh) original.set(o, o.material); });
  m.movers.forEach(applyMover);
  m.tick.forEach(fn => fn());
  const b = new THREE.Box3().setFromObject(m.geo), c = b.getCenter(new THREE.Vector3());
  m.root.position.set(-c.x, 0, -c.z);
  m.root.updateMatrixWorld(true);
  m.box = new THREE.Box3().setFromObject(m.geo).expandByScalar(25);
  // Esquinas de cada pieza: encuadra la silueta real, no la caja que envuelve todo.
  m.hull = [];
  const pb = new THREE.Box3();
  m.geo.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    pb.setFromObject(o);
    for (const x of [pb.min.x, pb.max.x]) for (const y of [pb.min.y, pb.max.y]) for (const z of [pb.min.z, pb.max.z]) m.hull.push(new THREE.Vector3(x, y, z));
  });
  m.onHotspot = spot => focusArea(m, spot);
}

const state = { model: 'puesto', view: 'iso', dims: false, labels: true, area: null };

// ---------- Piezas móviles y acabados ----------
function applyMover(mv) {
  mv.obj.rotation[mv.axis] = mv.closed + (mv.open - mv.closed) * ease(mv.state);
}
const moverOn = (m, id) => m.movers.some(mv => mv.id === id && mv.target === 1);
function setMover(m, id, on) {
  m.movers.filter(mv => mv.id === id).forEach(mv => {
    mv.target = on ? 1 : 0;
    if (reduced) { mv.state = mv.target; applyMover(mv); }
  });
  m.tick.forEach(fn => fn());
  contactDirty();
}
function setFinish(m, key) {
  m.finish = key;
  const mat = m.finishMats[key];
  m.geo.traverse(o => {
    if (o.isMesh && o.userData.role === m.finishRole) {
      original.set(o, mat);
      if (!technical) o.material = mat;
    }
  });
  invalidate();
}

// ---------- Modo técnico: maqueta blanca con aristas ----------
function setTechnical(on) {
  technical = on;
  for (const m of Object.values(models)) m.geo.traverse(o => {
    if (!o.isMesh) return;
    const base = original.get(o), glass = base?.userData?.glass;
    o.material = on ? (glass ? TECH.glass : TECH.solid) : base;
    if (on && !edges.has(o) && !glass && !o.isInstancedMesh) {
      const b = o.geometry.userData.box;
      const eg = b ? new THREE.EdgesGeometry(new THREE.BoxGeometry(...b)) : new THREE.EdgesGeometry(o.geometry, 28);
      const line = new THREE.LineSegments(eg, TECH.edge);
      line.raycast = () => {};
      o.add(line);
      edges.set(o, line);
    }
    if (edges.has(o)) edges.get(o).visible = on;
  });
  refreshTheme();
}

// ---------- Tema claro / oscuro ----------
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
function refreshTheme() {
  dimMats.boceto.color.set(css('--cota') || '#1d5fd1');
  dimMats.supuesto.color.set(css('--supuesto') || '#b76a00');
  applyTheme(isDark());
  setGrid(technical, css('--grid-major'), css('--grid'));
  $('#theme')?.setAttribute('aria-label', isDark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  // La barra de estado del celular toma el color del encabezado, también al cambiar de tema a mano.
  const surface = css('--surface');
  if (surface) document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = surface; });
  invalidate();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
try {
  const saved = localStorage.getItem('visor-tema');
  if (saved) document.documentElement.dataset.theme = saved;
} catch {}
$('#theme').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('visor-tema', next); } catch {}
  refreshTheme();
});

// ---------- Cámara ----------
let flight = null;
function flyTo(pos, tgt, dur = 900) {
  if (reduced) dur = 0;
  if (dur === 0) {
    flight = null;
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  } else {
    flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt, start: performance.now(), dur };
  }
  invalidate();
}
const _v = new THREE.Vector3();
function fitDistance(m, dir, center) {
  const corners = m.hull;
  const cam = camera.clone(), mx = 0.86, my = camera.aspect < 1 ? 0.8 : 0.76;
  let lo = 40, hi = 8000;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    cam.position.copy(center).addScaledVector(dir, mid);
    cam.lookAt(center);
    cam.updateMatrixWorld(true);
    const fits = corners.every(c => { _v.copy(c).project(cam); return Math.abs(_v.x) <= mx && Math.abs(_v.y) <= my && _v.z <= 1; });
    if (fits) hi = mid; else lo = mid;
  }
  return hi;
}
function goView(m, view, dur) {
  const center = m.box.getCenter(new THREE.Vector3());
  center.y = Math.min(center.y, view.tgt[1] + 20);
  const dir = new THREE.Vector3(...view.pos).sub(new THREE.Vector3(...view.tgt)).normalize();
  flyTo(center.clone().addScaledVector(dir, fitDistance(m, dir, center)), center, dur);
  state.view = view.id;
  renderViews();
}
function focusArea(m, spot) {
  state.area = spot.id;
  for (const h of m.hotspots) h.el.classList.toggle('on', h === spot);
  $('#areas').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.id === `area-${m.key}-${spot.id}`)));
  const tgt = spot.pos.clone().add(m.root.position);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.y < 0.25) { dir.y = 0.35; dir.normalize(); }
  flyTo(tgt.clone().add(dir.multiplyScalar(300 * Math.max(1, 1.2 / camera.aspect))), tgt, 850);
  state.view = null;
  renderViews();
}
controls.addEventListener('start', () => {
  flight = null;
  state.view = null;
  $('#views').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
});

onFrame((dt, now) => {
  let busy = false;
  if (flight) {
    const k = flight.dur ? Math.min(1, (now - flight.start) / flight.dur) : 1, e = ease(k);
    camera.position.lerpVectors(flight.p0, flight.p1, e);
    controls.target.lerpVectors(flight.t0, flight.t1, e);
    if (k >= 1) flight = null;
    busy = true;
  }
  const m = models[state.model];
  for (const mv of m.movers) {
    if (mv.state === mv.target) continue;
    const step = dt / 0.9;
    mv.state = mv.target > mv.state ? Math.min(mv.target, mv.state + step) : Math.max(mv.target, mv.state - step);
    applyMover(mv);
    busy = true;
  }
  if (busy) m.tick.forEach(fn => fn());
  if (busy && !flight) contactDirty();
  for (const h of m.hotspots) {
    if (!h.n) continue;
    _v.copy(h.pos).add(m.root.position);
    _v.subVectors(camera.position, _v);
    const away = _v.dot(h.n) < 0;
    if (h.away !== away) { h.away = away; h.el.classList.toggle('away', away); }
  }
  return busy;
});

// ---------- Interfaz ----------
function syncVisibility() {
  for (const m of Object.values(models)) {
    const on = m.key === state.model;
    m.root.visible = on;
    m.dims.visible = on && state.dims;
    m.dims.traverse(o => { if (o.isCSS2DObject) o.visible = on && state.dims; });
    m.labels.traverse(o => { if (o.isCSS2DObject) o.visible = on && state.labels; });
  }
  $('.legend').hidden = !state.dims;
  invalidate();
}

function renderViews() {
  const m = models[state.model], box = $('#views');
  box.innerHTML = '';
  for (const v of m.views) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'view-' + v.id;
    b.textContent = v.label;
    b.setAttribute('aria-pressed', String(state.view === v.id));
    b.addEventListener('click', () => goView(m, v));
    box.appendChild(b);
  }
}

function switchBtn(id, label, on, set) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sw';
  b.id = id;
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = '<span class="sw-l"></span><span class="sw-t" aria-hidden="true"><span></span></span>';
  b.querySelector('.sw-l').textContent = label;
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(v));
    set(v);
  });
  return b;
}

function segRow(id, label, options, value, set) {
  const row = document.createElement('div');
  row.className = 'segrow';
  const l = document.createElement('span');
  l.className = 'segrow-l';
  l.textContent = label;
  const seg = document.createElement('div');
  seg.className = 'mini-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', label);
  for (const [k, text] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `${id}-${k}`;
    b.textContent = text;
    b.setAttribute('aria-pressed', String(k === value));
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      set(k);
    });
    seg.appendChild(b);
  }
  row.append(l, seg);
  return row;
}

function renderPanel() {
  const m = models[state.model];
  $('#modelTitle').textContent = m.title;
  const acts = $('#actions');
  acts.innerHTML = '';
  for (const a of m.actions) {
    if (a.type === 'seg') acts.appendChild(segRow(a.id, a.label, a.options, m.finish, k => setFinish(m, k)));
    else if (a.mover) acts.appendChild(switchBtn(a.id, a.label, moverOn(m, a.mover), v => setMover(m, a.mover, v)));
    else acts.appendChild(switchBtn(a.id, a.label, a.get(), v => { a.set(v); invalidate(); }));
  }
  const areas = $('#areas');
  areas.innerHTML = '';
  for (const s of m.hotspots) {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.id = `area-${m.key}-${s.id}`;
    b.innerHTML = '<span class="a-t"></span><span class="a-b"></span>';
    b.querySelector('.a-t').textContent = s.title;
    b.querySelector('.a-b').textContent = s.body;
    b.setAttribute('aria-pressed', String(state.area === s.id));
    b.addEventListener('click', () => focusArea(m, s));
    li.appendChild(b);
    areas.appendChild(li);
  }
  const tb = $('#dims');
  tb.innerHTML = '';
  for (const [group, rows] of m.table) {
    const tr = document.createElement('tr');
    tr.className = 'grp';
    tr.innerHTML = '<th colspan="3" scope="colgroup"></th>';
    tr.firstChild.textContent = group;
    tb.appendChild(tr);
    for (const [k, v, src] of rows) {
      const r = document.createElement('tr');
      r.innerHTML = '<td class="k"></td><td class="v"></td><td class="s"><span class="chip"></span></td>';
      r.querySelector('.k').textContent = k;
      r.querySelector('.v').textContent = v;
      const chip = r.querySelector('.chip');
      chip.textContent = src === 'b' ? 'Boceto' : 'Supuesto';
      chip.classList.add(src === 'b' ? 'is-b' : 'is-s');
      tb.appendChild(r);
    }
  }
  $('#tab-puesto').setAttribute('aria-selected', String(state.model === 'puesto'));
  $('#tab-remolque').setAttribute('aria-selected', String(state.model === 'remolque'));
}

function showModel(key, instant = false) {
  if (!models[key]) key = 'puesto';
  state.model = key;
  state.area = null;
  for (const m of Object.values(models)) for (const h of m.hotspots) h.el.classList.remove('on');
  syncVisibility();
  renderPanel();
  const m = models[key];
  fitLight(m.box);
  fitContact(m.box, key === 'remolque' ? 190 : 140);
  goView(m, m.views[0], instant ? 0 : 900);
  if (location.hash.slice(1) !== key) try { history.replaceState(null, '', '#' + key); } catch {}
}
$('#tab-puesto').addEventListener('click', () => showModel('puesto'));
$('#tab-remolque').addEventListener('click', () => showModel('remolque'));
window.addEventListener('hashchange', () => {
  const k = location.hash.slice(1);
  if (models[k] && k !== state.model) showModel(k);
});

$('#show').append(
  switchBtn('sw-cotas', 'Cotas', state.dims, v => { state.dims = v; syncVisibility(); }),
  switchBtn('sw-etiquetas', 'Etiquetas de áreas', state.labels, v => { state.labels = v; syncVisibility(); }),
  switchBtn('sw-tecnico', 'Modo técnico', false, setTechnical),
  switchBtn('sw-girar', 'Girar solo', false, v => { controls.autoRotate = v; invalidate(); }),
  segRow('calidad', 'Calidad', [['alta', 'Alta'], ['media', 'Media'], ['ligera', 'Ligera']], quality.name, k => setQuality(k, true)),
);
// Si el visor baja la calidad solo (equipo lento), el selector lo refleja.
onQuality(name => {
  document.querySelectorAll('#show .mini-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'calidad-' + name)));
});

// ---------- Exportar .glb ----------
function bakeInstances(root) {
  const list = [];
  root.traverse(o => { if (o.isInstancedMesh) list.push(o); });
  const mm = new THREE.Matrix4();
  for (const im of list) {
    const parts = [];
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, mm); parts.push(im.geometry.clone().applyMatrix4(mm)); }
    const mesh = new THREE.Mesh(mergeGeometries(parts), im.material);
    mesh.position.copy(im.position);
    mesh.quaternion.copy(im.quaternion);
    mesh.scale.copy(im.scale);
    im.parent.add(mesh);
    im.parent.remove(im);
  }
}
function exportGLB(key) {
  return new Promise((resolve, reject) => {
    const m = models[key], wasTech = technical;
    if (wasTech) setTechnical(false);
    const copy = m.geo.clone(true);
    if (wasTech) setTechnical(true);
    const lines = [];
    copy.traverse(o => { if (o.isLine || o.isLineSegments) lines.push(o); });
    lines.forEach(o => o.parent.remove(o));
    bakeInstances(copy);
    const out = new THREE.Group();
    out.name = key;
    copy.position.copy(m.root.position);
    out.add(copy);
    out.scale.setScalar(0.01);
    new GLTFExporter().parse(out, resolve, reject, { binary: true });
  });
}
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const FILES = { puesto: 'Puesto-inox', remolque: 'Remolque-barra' };
const dl = $('#download');
dl.addEventListener('click', async () => {
  dl.disabled = true;
  const label = dl.textContent;
  dl.textContent = 'Preparando archivo…';
  try {
    saveBlob(new Blob([await exportGLB(state.model)], { type: 'model/gltf-binary' }), FILES[state.model] + '.glb');
    dl.textContent = 'Descargado: ' + FILES[state.model] + '.glb';
  } catch {
    dl.textContent = 'No se pudo exportar. Intenta de nuevo.';
  }
  setTimeout(() => { dl.textContent = label; dl.disabled = false; }, 2600);
});

// ---------- Foto HD ----------
function photo(longSide) {
  const m = models[state.model], dimsWere = m.dims.visible;
  m.dims.visible = false;
  const url = capture(longSide);
  m.dims.visible = dimsWere;
  invalidate();
  return url;
}
// Conversión síncrona: el menú de compartir del celular solo abre si se llama durante el toque.
function dataUrlToBlob(url) {
  const [head, data] = url.split(','), bin = atob(data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
}
const canShareFiles = coarse && !!navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] });
async function savePhoto(btn) {
  btn.disabled = true;
  try {
    const name = `${FILES[state.model]}-${state.view || 'vista'}.png`;
    const blob = dataUrlToBlob(photo());
    if (canShareFiles) {
      try {
        await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: models[state.model].title });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    saveBlob(blob, name);
  } finally {
    btn.disabled = false;
  }
}
for (const b of document.querySelectorAll('[data-photo]')) {
  b.addEventListener('click', () => savePhoto(b));
  if (canShareFiles) {
    b.setAttribute('aria-label', 'Compartir foto en alta resolución');
    b.title = 'Compartir foto';
    const label = b.querySelector('.label');
    if (label) label.textContent = 'Compartir foto';
  }
}

// ---------- Pantalla completa ----------
// En iPhone no existe la pantalla completa para páginas: se simula fijando el visor a toda la pantalla.
const fsBtn = $('#fullscreen');
const nativeFs = !!(stageEl.requestFullscreen || stageEl.webkitRequestFullscreen);
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || document.body.classList.contains('stage-max');
function setFs(on) {
  if (nativeFs) {
    if (on) (stageEl.requestFullscreen || stageEl.webkitRequestFullscreen).call(stageEl);
    else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    document.body.classList.toggle('stage-max', on);
    fsBtn.setAttribute('aria-pressed', String(on));
  }
}
fsBtn.addEventListener('click', () => setFs(!isFs()));
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(ev, () => fsBtn.setAttribute('aria-pressed', String(isFs())));
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('stage-max')) setFs(false); });

// ---------- Ayuda táctil ----------
// En pantallas táctiles se explica el gesto una vez; desaparece al primer toque al modelo.
const hint = $('#touchHint');
if (coarse && hint) {
  hint.hidden = false;
  const hide = () => hint.classList.add('gone');
  controls.addEventListener('start', hide, { once: true });
  setTimeout(hide, 6000);
}

// Para automatizar renders y exportaciones desde la consola.
window.__studio = {
  photo,
  exportGLB,
  view: id => { const m = models[state.model]; goView(m, m.views.find(v => v.id === id) || m.views[0], 0); },
  show: showModel,
  set: (id, v) => { const b = document.getElementById(id); if (b && (b.getAttribute('aria-pressed') === 'true') !== v) b.click(); },
};

// ---------- Arranque ----------
refreshTheme();
start();
const first = location.hash.slice(1);
showModel(models[first] ? first : 'puesto', true);
// Si la pantalla cambia de proporción (girar el celular), se reencuadra la vista activa.
onResize(() => {
  const m = models[state.model], v = m.views.find(x => x.id === state.view);
  if (v && !flight) goView(m, v, 0);
});
const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
fontsReady.then(() => { fontTextures.forEach(t => t.userData.redraw()); invalidate(); });
Promise.all([renderer.compileAsync(scene, camera).catch(() => {}), fontsReady]).then(() => {
  invalidate();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $('#loading').hidden = true;
    document.documentElement.classList.add('ready');
  }));
});
