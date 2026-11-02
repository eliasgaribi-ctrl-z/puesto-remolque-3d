import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStatic, edgesFor } from './merge.js';
import {
  scene, camera, controls, renderer, stageEl, setGrid, applyTheme, fitLight, fitContact, contactDirty,
  invalidate, onFrame, onResize, start, capture, quality, setQuality, onQuality, coarse,
  coveredFraction, visibleAspect,
} from './stage.js';
import { TECH, fontTextures } from './materials.js';
import { dimMats } from './annot.js';
import { buildPuesto } from './puesto.js';
import { buildRemolque } from './remolque.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ICON = {
  chev: '<svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  arrow: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

// Cada modelo se construye cuando se necesita: al abrir solo se arma el que se ve, y el otro
// se prepara después, en un momento libre, para que cambiar de pestaña sea inmediato.
const builders = { puesto: buildPuesto, remolque: buildRemolque };
const models = {};
const original = new WeakMap(), edges = new WeakMap();
let technical = false;

function ensureModel(key) {
  if (models[key]) return models[key];
  const m = builders[key]();
  m.movers.forEach(applyMover);
  m.tick.forEach(fn => fn());
  const b = new THREE.Box3().setFromObject(m.geo), c = b.getCenter(new THREE.Vector3());
  m.root.position.set(-c.x, 0, -c.z);
  m.root.updateMatrixWorld(true);
  m.box = new THREE.Box3().setFromObject(m.geo).expandByScalar(25);
  // Esquinas de cada pieza: encuadra la silueta real, no la caja que envuelve todo.
  // Se calcula antes de unir piezas, cuando todavía están separadas.
  m.hull = [];
  const pb = new THREE.Box3();
  m.geo.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    pb.setFromObject(o);
    for (const x of [pb.min.x, pb.max.x]) for (const y of [pb.min.y, pb.max.y]) for (const z of [pb.min.z, pb.max.z]) m.hull.push(new THREE.Vector3(x, y, z));
  });
  mergeStatic(m.geo);
  m.geo.traverse(o => { if (o.isMesh) original.set(o, o.material); });
  m.onHotspot = spot => {
    if (state.model !== m.key) return;
    if (state.area === spot.id) { markArea(m, null); return; }
    focusArea(m, spot);
    selectTab(tabFor('recorrido'));
  };
  // Las etiquetas HTML no heredan lo oculto del modelo: se esconden una por una hasta mostrarlo.
  m.root.visible = false;
  m.root.traverse(o => { if (o.isCSS2DObject) o.visible = false; });
  scene.add(m.root);
  models[key] = m;
  if (technical) applyTechnical(m, true);
  return m;
}

// Nombres sobre el modelo: encendidos en pantallas grandes con mouse, donde caben sin encimarse.
const state = {
  model: 'puesto', view: 'iso', dims: false, area: null,
  names: matchMedia('(min-width: 1100px) and (pointer: fine)').matches,
};

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
// Estado de un control de "Acabado" (puerta, tapas, bancos): encendido o apagado.
const actionOn = (m, a) => (a.mover ? moverOn(m, a.mover) : a.get());
function setAction(m, a, on) {
  if (a.mover) setMover(m, a.mover, on);
  else { a.set(on); contactDirty(); }
  renderAcabado(m);
  updateStopActions(m);
}

// ---------- Modo técnico: maqueta blanca con aristas ----------
function applyTechnical(m, on) {
  m.geo.traverse(o => {
    if (!o.isMesh) return;
    const base = original.get(o), glass = base?.userData?.glass;
    o.material = on ? (glass ? TECH.glass : TECH.solid) : base;
    if (on && !edges.has(o) && !glass && !o.isInstancedMesh) {
      const line = new THREE.LineSegments(edgesFor(o), TECH.edge);
      line.raycast = () => {};
      o.add(line);
      edges.set(o, line);
    }
    if (edges.has(o)) edges.get(o).visible = on;
  });
}
function setTechnical(on) {
  technical = on;
  for (const m of Object.values(models)) applyTechnical(m, on);
  $('#modo-real').setAttribute('aria-pressed', String(!on));
  $('#sw-tecnico').setAttribute('aria-pressed', String(on));
  refreshTheme();
}
$('#modo-real').addEventListener('click', () => setTechnical(false));
$('#sw-tecnico').addEventListener('click', () => setTechnical(true));

// ---------- Tema claro / oscuro / automático ----------
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
  for (const b of document.querySelectorAll('#tema button')) b.setAttribute('aria-pressed', String(b.dataset.k === themeMode()));
  invalidate();
}
const themeMode = () => document.documentElement.dataset.theme || 'auto';
function setThemeMode(mode) {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  try {
    if (mode === 'auto') localStorage.removeItem('visor-tema');
    else localStorage.setItem('visor-tema', mode);
  } catch {}
  refreshTheme();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
try {
  const saved = localStorage.getItem('visor-tema');
  if (saved) document.documentElement.dataset.theme = saved;
} catch {}
$('#theme').addEventListener('click', () => setThemeMode(isDark() ? 'light' : 'dark'));

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
// Encuadre: el modelo debe caber en la parte del visor que no tapa el panel.
function fitDistance(m, dir, center) {
  const corners = m.hull, k = coveredFraction();
  const cx = -k, hw = 1 - k;
  const cam = camera.clone(), mx = 0.86 * hw, my = visibleAspect() < 1 ? 0.8 : 0.76;
  let lo = 40, hi = 8000;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    cam.position.copy(center).addScaledVector(dir, mid);
    cam.lookAt(center);
    cam.updateMatrixWorld(true);
    const fits = corners.every(c => { _v.copy(c).project(cam); return Math.abs(_v.x - cx) <= mx && Math.abs(_v.y) <= my && _v.z <= 1; });
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
  syncViews();
}
// Acercar y alejar con botones, para quien no tiene rueda ni pantalla táctil.
function zoom(factor) {
  const off = camera.position.clone().sub(controls.target);
  const d = THREE.MathUtils.clamp(off.length() * factor, controls.minDistance, controls.maxDistance);
  flyTo(controls.target.clone().add(off.setLength(d)), controls.target.clone(), 320);
}
$('#zoomIn').addEventListener('click', () => zoom(0.75));
$('#zoomOut').addEventListener('click', () => zoom(1 / 0.75));
$('#center').addEventListener('click', () => {
  const m = models[state.model];
  goView(m, m.views.find(v => v.id === state.view) || m.views[0]);
});
controls.addEventListener('start', () => {
  flight = null;
  state.view = null;
  syncViews();
});

// ---------- Recorrido por las áreas ----------
function focusArea(m, spot, byKey = false) {
  markArea(m, spot, byKey);
  const tgt = spot.pos.clone().add(m.root.position);
  let dir = camera.position.clone().sub(controls.target).normalize();
  // Si el área queda del otro lado (la puerta del remolque, por ejemplo), la cámara se pone de frente a ella.
  if (spot.n && dir.dot(spot.n) < 0.2) dir = spot.n.clone().add(new THREE.Vector3(0, 0.45, 0)).normalize();
  if (dir.y < 0.25) { dir.y = 0.35; dir.normalize(); }
  flyTo(tgt.clone().add(dir.multiplyScalar(300 * Math.max(1, 1.2 / visibleAspect()))), tgt, 850);
  state.view = null;
  syncViews();
}
function markArea(m, spot, byKey = false) {
  const prev = state.area;
  state.area = spot ? spot.id : null;
  for (const h of m.hotspots) h.el.classList.toggle('on', h === spot);
  for (const li of document.querySelectorAll('#areas .stop')) {
    const on = !!spot && li.dataset.id === spot.id;
    li.classList.toggle('on', on);
    li.querySelector('.stop-h').setAttribute('aria-expanded', String(on));
    const body = li.querySelector('.stop-b');
    body.hidden = !on;
    // Al pasar de una parada a otra con clic, el texto se funde con un desenfoque breve.
    // Con teclado no se anima: se repite muchas veces y debe sentirse inmediato.
    if (on && prev && prev !== spot.id && !byKey) {
      body.classList.remove('swap');
      void body.offsetWidth;
      body.classList.add('swap');
    }
  }
  renderTourNav(m);
}
function stepArea(d, byKey = false) {
  const m = models[state.model], list = m.hotspots;
  const i = list.findIndex(h => h.id === state.area);
  const next = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
  focusArea(m, list[next], byKey);
}
function renderTourNav(m) {
  const list = m.hotspots, i = list.findIndex(h => h.id === state.area), n = list.length;
  $('#tourCount').textContent = i < 0 ? '' : `${i + 1} / ${n}`;
  $('#tourSegs').querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', k <= i));
  $('#tourPrev').disabled = i <= 0;
  const [kicker, title] = i < 0 ? [`${n} paradas`, 'Empezar recorrido']
    : i === n - 1 ? ['Terminaste', 'Empezar de nuevo']
    : [`Siguiente · ${i + 2} de ${n}`, list[i + 1].title];
  $('#tourKicker').textContent = kicker;
  $('#tourTitle').textContent = title;
}
$('#tourPrev').addEventListener('click', () => stepArea(-1));
$('#tourNext').addEventListener('click', () => {
  const m = models[state.model], i = m.hotspots.findIndex(h => h.id === state.area);
  if (i === m.hotspots.length - 1) focusArea(m, m.hotspots[0]);
  else stepArea(1);
});
// Flechas para recorrer las áreas como en una presentación; Esc cierra la parada o la ayuda.
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, [role="tablist"], [role="group"]')) return;
  if (e.key === 'Escape') {
    if (!help.hidden) showHelp(false);
    else if (state.area) markArea(models[state.model], null);
    return;
  }
  if (!state.area) return;
  if (e.key === 'ArrowRight') stepArea(1, true);
  if (e.key === 'ArrowLeft') stepArea(-1, true);
});

// Acción de cada parada: ver medidas, abrir la puerta, cambiar de vista o ir al acabado.
function spotActionLabel(m, s) {
  const a = m.spotActions?.[s.id];
  if (!a) return null;
  if (a.kind === 'action') return actionOn(m, m.actions.find(x => x.id === a.id)) ? a.on : a.off;
  return a.label;
}
function runSpotAction(m, s) {
  const a = m.spotActions?.[s.id];
  if (!a) return;
  if (a.kind === 'dims') { setDims(true); selectTab(tabFor('medidas')); }
  else if (a.kind === 'tab') selectTab(tabFor(a.id));
  else if (a.kind === 'view') goView(m, m.views.find(v => v.id === a.id) || m.views[0]);
  else if (a.kind === 'action') {
    const act = m.actions.find(x => x.id === a.id);
    setAction(m, act, !actionOn(m, act));
  }
}
function updateStopActions(m) {
  for (const s of m.hotspots) {
    const b = document.getElementById(`act-${m.key}-${s.id}`);
    if (b) b.querySelector('span').textContent = spotActionLabel(m, s);
  }
}

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
  if (!m) return busy;
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

// ---------- Botones del visor ----------
function syncVisibility() {
  for (const m of Object.values(models)) {
    const on = m.key === state.model;
    m.root.visible = on;
    m.dims.visible = on && state.dims;
    m.dims.traverse(o => { if (o.isCSS2DObject) o.visible = on && state.dims; });
    m.labels.traverse(o => { if (o.isCSS2DObject) o.visible = on; });
  }
  $('#legend').hidden = !state.dims;
  invalidate();
}
function setDims(on) {
  state.dims = on;
  for (const b of document.querySelectorAll('[data-dims]')) b.setAttribute('aria-pressed', String(on));
  syncVisibility();
}
function setNames(on) {
  state.names = on;
  stageEl.classList.toggle('names-on', on);
  $('#sw-nombres').setAttribute('aria-pressed', String(on));
}
function setSpin(on) {
  controls.autoRotate = on;
  $('#sw-girar').setAttribute('aria-pressed', String(on));
  invalidate();
}
for (const b of document.querySelectorAll('[data-dims]')) b.addEventListener('click', () => setDims(!state.dims));
$('#sw-nombres').addEventListener('click', () => setNames(!state.names));
$('#sw-girar').addEventListener('click', () => setSpin(!controls.autoRotate));
setNames(state.names);

// Vistas rápidas: el dibujito muestra el puesto visto desde arriba y un punto donde queda la cámara.
function viewIcon(v) {
  const dx = v.pos[0] - v.tgt[0], dz = v.pos[2] - v.tgt[2], len = Math.hypot(dx, dz);
  const [cx, cy] = len < 1 ? [12, 12] : [12 + (dx / len) * 9.5, 12 + (dz / len) * 9.5];
  const p = n => n.toFixed(1);
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="14" height="6" rx="1.5"/>`
    + `<line class="sight" x1="${p(cx)}" y1="${p(cy)}" x2="12" y2="12"/><circle class="cam" cx="${p(cx)}" cy="${p(cy)}" r="2.4"/></svg>`;
}
function renderViews() {
  const m = models[state.model], box = $('#views');
  box.innerHTML = '';
  for (const v of m.views) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'view-' + v.id;
    b.innerHTML = viewIcon(v) + '<span></span>';
    b.querySelector('span').textContent = v.label;
    b.setAttribute('aria-label', v.title || v.label);
    b.title = v.title || v.label;
    b.addEventListener('click', () => goView(m, v));
    box.appendChild(b);
  }
  syncViews();
}
function syncViews() {
  for (const b of document.querySelectorAll('#views button')) b.setAttribute('aria-pressed', String(b.id === 'view-' + state.view));
}

// Ayuda de gestos: se abre sola la primera vez; se cierra con "Entendido", Esc o al mover el modelo.
const help = $('#help');
function showHelp(on) {
  help.hidden = !on;
  $('#helpBtn').setAttribute('aria-expanded', String(on));
  if (!on) try { localStorage.setItem('visor-ayuda', '1'); } catch {}
}
$('#helpBtn').addEventListener('click', () => showHelp(help.hidden));
for (const b of document.querySelectorAll('[data-help-close]')) b.addEventListener('click', () => showHelp(false));
controls.addEventListener('start', () => { if (!help.hidden) showHelp(false); });
let helpSeen = false;
try { helpSeen = localStorage.getItem('visor-ayuda') === '1'; } catch {}

// Aviso breve: confirma lo que pasó (foto guardada, enlace copiado) sin tapar el modelo.
const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg) {
  clearTimeout(toastTimer);
  toastEl.querySelector('.toast-t').textContent = msg;
  toastEl.classList.remove('out');
  toastEl.hidden = false;
  toastTimer = setTimeout(() => {
    toastEl.classList.add('out');
    toastTimer = setTimeout(() => { toastEl.hidden = true; toastEl.classList.remove('out'); }, reduced ? 0 : 160);
  }, 2600);
}

// ---------- Panel ----------
// Botones de opción: uno queda marcado; `pick` recibe la clave elegida.
function segButtons(box, id, options, value, pick) {
  box.innerHTML = '';
  for (const [k, text] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `${id}-${k}`;
    b.dataset.k = String(k);
    b.textContent = text;
    b.setAttribute('aria-pressed', String(k === value));
    b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      pick(k);
    });
    box.appendChild(b);
  }
  return box;
}
function field(label) {
  const f = document.createElement('div');
  f.className = 'field';
  const l = document.createElement('span');
  l.className = 'field-l';
  l.textContent = label;
  f.appendChild(l);
  return f;
}

function renderTour(m) {
  const segs = $('#tourSegs');
  segs.innerHTML = '<span></span>'.repeat(m.hotspots.length);
  const list = $('#areas');
  list.innerHTML = '';
  for (const s of m.hotspots) {
    const li = document.createElement('li');
    li.className = 'stop';
    li.dataset.id = s.id;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'stop-h';
    head.id = `area-${m.key}-${s.id}`;
    head.setAttribute('aria-expanded', 'false');
    head.setAttribute('aria-controls', `stop-${m.key}-${s.id}`);
    head.innerHTML = `<span class="n" aria-hidden="true"></span><span class="st"></span>${ICON.chev}`;
    head.querySelector('.n').textContent = s.num;
    head.querySelector('.st').textContent = s.title;
    head.addEventListener('click', () => (state.area === s.id ? markArea(m, null) : focusArea(m, s)));
    const body = document.createElement('div');
    body.className = 'stop-b';
    body.id = `stop-${m.key}-${s.id}`;
    body.hidden = true;
    const p = document.createElement('p');
    p.textContent = s.body;
    body.appendChild(p);
    const label = spotActionLabel(m, s);
    if (label) {
      const act = document.createElement('button');
      act.type = 'button';
      act.className = 'stop-act';
      act.id = `act-${m.key}-${s.id}`;
      act.innerHTML = `<span></span>${ICON.arrow}`;
      act.querySelector('span').textContent = label;
      act.addEventListener('click', () => runSpotAction(m, s));
      body.appendChild(act);
    }
    li.append(head, body);
    list.appendChild(li);
  }
  markArea(m, null);
}

function renderMedidas(m) {
  const s = m.summary, hero = $('#hero');
  hero.innerHTML = '<div><span class="kicker"></span><div class="hero-v"><b></b><span></span></div></div><div class="hero-stats"></div>';
  hero.querySelector('.kicker').textContent = s.label;
  hero.querySelector('.hero-v b').textContent = s.value;
  hero.querySelector('.hero-v span').textContent = s.note;
  for (const [k, v] of s.stats) {
    const d = document.createElement('div');
    d.innerHTML = '<span></span><b></b>';
    d.querySelector('span').textContent = k;
    d.querySelector('b').textContent = v;
    hero.querySelector('.hero-stats').appendChild(d);
  }
  const pending = m.table.reduce((n, [, rows]) => n + rows.filter(r => r[2] === 's').length, 0);
  $('#pending').hidden = pending === 0;
  $('#pendingTitle').textContent = pending === 1 ? '1 medida por confirmar' : `${pending} medidas por confirmar`;
  const box = $('#dims');
  box.innerHTML = '';
  for (const [group, rows] of m.table) {
    const sec = document.createElement('section');
    sec.className = 'dgroup';
    const h = document.createElement('h3');
    h.textContent = group;
    sec.appendChild(h);
    for (const [k, v, src] of rows) {
      const r = document.createElement('div');
      r.className = 'drow';
      r.innerHTML = '<span class="k"></span>' + (src === 's' ? '<span class="tag">por confirmar</span>' : '') + '<span class="v"></span>';
      r.querySelector('.k').textContent = k;
      const val = r.querySelector('.v');
      val.textContent = v;
      if (src === 's') val.classList.add('s');
      sec.appendChild(r);
    }
    box.appendChild(sec);
  }
}

function renderAcabado(m) {
  const fin = $('#finishes'), mov = $('#movers');
  fin.innerHTML = '';
  mov.innerHTML = '';
  for (const a of m.actions) {
    const f = field(a.label);
    if (a.type === 'seg') {
      const grid = document.createElement('div');
      grid.className = 'swatches' + (a.options.length > 2 ? ' n3' : '');
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', a.label);
      for (const [k, text] of a.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.id = `${a.id}-${k}`;
        b.setAttribute('aria-pressed', String(k === m.finish));
        b.innerHTML = `<span class="swatch-c c-${k}" aria-hidden="true"></span><span class="swatch-l"><span></span><span class="ok" aria-hidden="true">${ICON.check}</span></span>`;
        b.querySelector('.swatch-l span').textContent = text;
        b.addEventListener('click', () => {
          grid.querySelectorAll('.swatch').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          setFinish(m, k);
        });
        grid.appendChild(b);
      }
      f.appendChild(grid);
      fin.appendChild(f);
    } else {
      const seg = document.createElement('div');
      seg.className = 'seg-track';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', a.label);
      const states = a.states || ['No', 'Sí'];
      segButtons(seg, a.id, [[false, states[0]], [true, states[1]]], actionOn(m, a), v => setAction(m, a, v));
      f.appendChild(seg);
      mov.appendChild(f);
    }
  }
}

function renderPanel() {
  const m = models[state.model];
  $('#modelTitle').textContent = m.title;
  renderTour(m);
  renderMedidas(m);
  renderAcabado(m);
  $('#tab-puesto').setAttribute('aria-selected', String(state.model === 'puesto'));
  $('#tab-remolque').setAttribute('aria-selected', String(state.model === 'remolque'));
  placePill();
}

function showModel(key, instant = false) {
  if (!builders[key]) key = 'puesto';
  const m = ensureModel(key);
  state.model = key;
  state.area = null;
  for (const x of Object.values(models)) for (const h of x.hotspots) h.el.classList.remove('on');
  syncVisibility();
  renderPanel();
  renderViews();
  fitLight(m.box);
  fitContact(m.box, key === 'remolque' ? 190 : 140);
  goView(m, m.views[0], instant ? 0 : 900);
  if (location.hash.slice(1) !== key) try { history.replaceState(null, '', '#' + key); } catch {}
}
$('#tab-puesto').addEventListener('click', () => showModel('puesto'));
$('#tab-remolque').addEventListener('click', () => showModel('remolque'));
window.addEventListener('hashchange', () => {
  const k = location.hash.slice(1);
  if (builders[k] && k !== state.model) showModel(k);
});

// ---------- Pestañas ----------
// Una píldora se desliza bajo la pestaña elegida; flechas izquierda/derecha cambian de pestaña.
const ptabs = [...document.querySelectorAll('.ptabs [role="tab"]')];
const ptabsPill = $('.ptabs-pill');
const tabFor = id => document.getElementById('pt-' + id);
function placeTabPill() {
  const b = ptabs.find(t => t.getAttribute('aria-selected') === 'true');
  if (!b || !b.offsetWidth) return;
  ptabsPill.style.width = b.offsetWidth + 'px';
  ptabsPill.style.transform = `translateX(${b.offsetLeft}px)`;
}
// Con teclado el cambio es instantáneo: animar una acción repetida la hace sentir lenta.
function selectTab(tab, byKey = false) {
  if (!tab) return;
  for (const t of ptabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  $('#tourNav').hidden = tab.id !== 'pt-recorrido';
  if (byKey) tab.focus();
  $('.panes').scrollTop = 0;
  ptabsPill.classList.toggle('instant', byKey);
  placeTabPill();
  if (byKey) requestAnimationFrame(() => ptabsPill.classList.remove('instant'));
}
ptabs.forEach((t, i) => {
  t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); selectTab(ptabs[(i + d + ptabs.length) % ptabs.length], true); }
  });
});
new ResizeObserver(placeTabPill).observe($('.ptabs'));

// Píldora del selector Puesto/Remolque.
const pill = $('.tabs-pill');
function placePill() {
  const b = document.querySelector('.tabs [aria-selected="true"]');
  if (!b || !b.offsetWidth) return;
  pill.style.width = b.offsetWidth + 'px';
  pill.style.transform = `translateX(${b.offsetLeft}px)`;
}
new ResizeObserver(placePill).observe($('.tabs'));

// Los controles del visor empiezan debajo del encabezado flotante, mida lo que mida.
const header = $('.top');
new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', header.offsetHeight + 'px')).observe(header);

// Ajustes del visor.
segButtons($('#calidad'), 'calidad', [['alta', 'Alta'], ['media', 'Media'], ['ligera', 'Ligera']], quality.name, k => setQuality(k, true));
// Si el visor baja la calidad solo (equipo lento), el selector lo refleja.
onQuality(name => {
  document.querySelectorAll('#calidad button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === name)));
});
segButtons($('#tema'), 'tema', [['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']], themeMode(), setThemeMode);

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
// Se exporta una copia recién armada, sin unir piezas: el .glb reutiliza las piezas repetidas
// y pesa mucho menos. Se le copian el estado de puertas y tapas, los bancos y el acabado elegido.
function exportGLB(key) {
  return new Promise((resolve, reject) => {
    const m = ensureModel(key), fresh = builders[key]();
    fresh.movers.forEach((mv, i) => { mv.state = m.movers[i].state; applyMover(mv); });
    fresh.tick.forEach(fn => fn());
    if (m.stools) fresh.stools.visible = m.stools.visible;
    const finish = m.finishMats[m.finish];
    fresh.geo.traverse(o => { if (o.isMesh && o.userData.role === m.finishRole) o.material = finish; });
    const copy = fresh.geo;
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
const dl = $('#download'), dlLabel = dl.querySelector('small'), dlText = dlLabel.textContent;
dl.addEventListener('click', async () => {
  dl.disabled = true;
  dlLabel.textContent = 'Preparando archivo…';
  try {
    saveBlob(new Blob([await exportGLB(state.model)], { type: 'model/gltf-binary' }), FILES[state.model] + '.glb');
    toast('Descargado: ' + FILES[state.model] + '.glb');
  } catch {
    toast('No se pudo exportar. Intenta de nuevo.');
  }
  dlLabel.textContent = dlText;
  dl.disabled = false;
});

// Enlace directo al modelo que se está viendo.
$('#copyLink').addEventListener('click', async () => {
  const url = location.href.split('#')[0] + '#' + state.model;
  try {
    await navigator.clipboard.writeText(url);
    toast('Enlace copiado');
  } catch {
    toast('No se pudo copiar. El enlace es: ' + url);
  }
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
    toast('Foto guardada: ' + name);
  } finally {
    btn.disabled = false;
  }
}
for (const b of document.querySelectorAll('[data-photo]')) {
  b.addEventListener('click', () => savePhoto(b));
  if (canShareFiles) {
    b.setAttribute('aria-label', 'Compartir foto en alta resolución');
    const label = b.querySelector('.label');
    if (label) label.textContent = b.classList.contains('share') ? 'Compartir foto HD' : 'Compartir foto';
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

// Para automatizar renders y exportaciones desde la consola.
const toggles = { 'sw-cotas': setDims, 'sw-tecnico': setTechnical, 'sw-nombres': setNames, 'sw-girar': setSpin };
window.__studio = {
  photo,
  exportGLB,
  view: id => { const m = models[state.model]; goView(m, m.views.find(v => v.id === id) || m.views[0], 0); },
  show: showModel,
  set: (id, v) => {
    if (toggles[id]) { toggles[id](v); return; }
    const m = models[state.model], a = m.actions.find(x => x.id === id);
    if (a && a.type !== 'seg') setAction(m, a, v);
  },
  // Piezas y triángulos que dibuja el modelo visible en una pasada (diagnóstico de rendimiento).
  stats: () => {
    renderer.info.autoReset = false;
    renderer.info.reset();
    renderer.render(scene, camera);
    const { calls, triangles } = renderer.info.render;
    renderer.info.autoReset = true;
    invalidate();
    return { model: state.model, calls, triangles, built: Object.keys(models) };
  },
};

// ---------- Arranque ----------
refreshTheme();
start();
const first = location.hash.slice(1);
showModel(builders[first] ? first : 'puesto', true);
selectTab(tabFor('recorrido'));
// Si la pantalla cambia de proporción (girar el celular), se reencuadra la vista activa.
onResize(() => {
  const m = models[state.model], v = m.views.find(x => x.id === state.view);
  if (v && !flight) goView(m, v, 0);
});
// La interfaz no usa Barlow Condensed, pero el logo y los números de las charolas sí: se pide aparte
// y se vuelven a dibujar esas texturas en cuanto llega, aunque sea después de la pantalla de carga.
const fontSheet = document.querySelector('link[data-fonts]');
const sheetReady = new Promise(r => {
  if (!fontSheet || fontSheet.sheet) r();
  else { fontSheet.addEventListener('load', r, { once: true }); fontSheet.addEventListener('error', r, { once: true }); }
});
const canvasFonts = document.fonts
  ? sheetReady.then(() => Promise.all([
    document.fonts.load('700 132px "Barlow Condensed"'), document.fonts.load('600 34px "Barlow Condensed"'), document.fonts.ready,
  ])).catch(() => {})
  : Promise.resolve();
const redraw = () => { fontTextures.forEach(t => t.userData.redraw()); invalidate(); };
canvasFonts.then(redraw);
const fontsReady = Promise.race([canvasFonts, new Promise(r => setTimeout(r, 2500))]);
Promise.all([renderer.compileAsync(scene, camera).catch(() => {}), fontsReady]).then(() => {
  invalidate();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // La pantalla de carga se desvanece en vez de desaparecer de golpe.
    const loading = $('#loading');
    loading.classList.add('done');
    setTimeout(() => { loading.hidden = true; }, 320);
    placeTabPill();
    placePill();
    document.documentElement.classList.add('ready');
    if (!helpSeen) showHelp(true);
    prepareOthers();
  }));
});

// El otro modelo se arma cuando el equipo está libre, con sus materiales ya compilados.
function prepareOthers() {
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => {
    for (const k of Object.keys(builders)) {
      if (models[k]) continue;
      const m = ensureModel(k);
      m.root.visible = true;
      renderer.compileAsync(m.root, camera, scene).catch(() => {});
      m.root.visible = false;
    }
  }, { timeout: 5000 });
}
