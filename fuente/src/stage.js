// Escenario: render de estudio con reflejos de softbox, sombra suave, oclusión ambiental (GTAO)
// y fondo infinito. Dibuja solo cuando algo cambia, para no calentar laptops ni celulares.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export const stageEl = document.querySelector('#stage');
export const coarse = matchMedia('(pointer: coarse)').matches;

// Niveles de calidad. `budget` es el máximo de megapíxeles que se dibujan: en un monitor 4K o un
// celular con pantalla de 3x se baja la resolución interna en vez de ahogar la tarjeta de video.
export const QUALITY = {
  alta: { budget: 4.2, maxPR: 2, samples: 4, ao: true, aoMotion: true, aoSamples: 16, shadow: 2048 },
  media: { budget: 2.4, maxPR: 1.75, samples: 4, ao: true, aoMotion: false, aoSamples: 10, shadow: 2048 },
  ligera: { budget: 1.3, maxPR: 1.25, samples: 2, ao: false, aoMotion: false, aoSamples: 8, shadow: 1024 },
};
const ORDER = ['alta', 'media', 'ligera'];

export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// La sombra no cambia al girar la cámara: se recalcula solo cuando cambia el modelo o se mueve una pieza.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.domElement.className = 'gl';
stageEl.prepend(renderer.domElement);

export const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
stageEl.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(30, 1, 5, 40000);
camera.position.set(500, 350, 700);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 60;
controls.maxDistance = 3200;
controls.autoRotateSpeed = 0.8;

// Estudio virtual: domo en degradado + softboxes. Es lo que el inox refleja.
function studioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(100, 48, 24), p = dome.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 100;
    const v = y > 0 ? 0.52 + 0.4 * y : 0.52 - 0.14 * Math.min(1, -y * 2);
    col.push(v, v, v * 1.03);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, k, pos, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(90, 40, 3.2, [0, 72, 0]);
  panel(16, 56, 6, [-62, 24, 44]);
  panel(9, 56, 5, [66, 22, -26], 0xf2f6ff);
  panel(64, 12, 2.2, [24, 6, 72], 0xfff7ee);
  panel(90, 26, 0.75, [8, -14, 72]);
  panel(56, 7, 3, [-18, 32, -72]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env).texture;
  pm.dispose();
  return tex;
}
scene.environment = studioEnvironment();

// Fondo infinito (degradado radial con grano fino para que no se vean escalones).
function backdrop(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d', { willReadFrequently: true });
  const grd = g.createRadialGradient(256, 190, 8, 256, 250, 400);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (Math.random() - 0.5) * 3;
    img.data[i] += d; img.data[i + 1] += d; img.data[i + 2] += d;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Se genera solo el fondo del tema que se está usando; el otro, si alguien cambia de tema.
const BACKDROPS = { light: ['#fbfcfc', '#cfd5d9'], dark: ['#323a41', '#0d1013'] };
const backdrops = {};
const backdropFor = k => (backdrops[k] ||= backdrop(...BACKDROPS[k]));

export const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 5;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.5;
scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9095, 0.35);
scene.add(hemi);

// Piso que solo recibe la sombra de la luz principal. Con subdivisiones: un plano gigante de 2 triángulos
// pierde precisión y la sombra desaparece.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 26, 26), new THREE.ShadowMaterial({ opacity: 0.3 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Sombra de contacto: vista desde abajo, difuminada. Asienta el modelo en el piso como en una foto de producto.
const contact = (() => {
  const target = new THREE.WebGLRenderTarget(512, 512), blurTarget = new THREE.WebGLRenderTarget(512, 512);
  target.texture.generateMipmaps = blurTarget.texture.generateMipmaps = false;
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
  const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: target.texture, transparent: true, depthWrite: false, opacity: 0.85 }));
  plane.renderOrder = 1;
  plane.position.y = 0.15;
  const blurPlane = new THREE.Mesh(geo);
  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  cam.rotation.x = Math.PI / 2;
  const depth = new THREE.MeshDepthMaterial();
  depth.userData.darkness = { value: 2.4 };
  depth.onBeforeCompile = shader => {
    shader.uniforms.darkness = depth.userData.darkness;
    shader.fragmentShader = `uniform float darkness;
` + shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );');
  };
  depth.depthTest = depth.depthWrite = false;
  const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader), vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  hBlur.depthTest = vBlur.depthTest = false;
  const blur = amount => {
    blurPlane.material = hBlur;
    hBlur.uniforms.tDiffuse.value = target.texture;
    hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(blurTarget);
    renderer.render(blurPlane, cam);
    blurPlane.material = vBlur;
    vBlur.uniforms.tDiffuse.value = blurTarget.texture;
    vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(target);
    renderer.render(blurPlane, cam);
  };
  return { plane, blurPlane, cam, depth, blur, target, dirty: true };
})();
scene.add(contact.plane);

export function fitContact(box, height) {
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const w = s.x + 140, d = s.z + 140;
  contact.plane.position.set(c.x, 0.15, c.z);
  contact.plane.scale.set(w, -1, d);
  contact.blurPlane.position.set(c.x, 0, c.z);
  contact.blurPlane.scale.set(w, 1, d);
  Object.assign(contact.cam, { left: -w / 2, right: w / 2, top: d / 2, bottom: -d / 2, near: 0, far: height });
  contact.cam.position.set(c.x, 0, c.z);
  contact.cam.updateProjectionMatrix();
  contact.target.setSize(512, Math.round(512 * d / w));
  contact.dirty = true;
  invalidate();
}
// Algo cambió de lugar (puerta, tapas, bancos, otro modelo): hay que rehacer ambas sombras.
export const contactDirty = () => {
  contact.dirty = true;
  renderer.shadowMap.needsUpdate = true;
  invalidate();
};

function renderContact() {
  const hidden = [];
  scene.traverse(o => {
    if (o.visible && (o === ground || o === contact.plane || o.isLine || o.material?.userData?.glass)) { hidden.push(o); o.visible = false; }
  });
  const bg = scene.background, alpha = renderer.getClearAlpha();
  scene.background = null;
  scene.overrideMaterial = contact.depth;
  renderer.setClearAlpha(0);
  renderer.setRenderTarget(contact.target);
  renderer.clear();
  renderer.render(scene, contact.cam);
  scene.overrideMaterial = null;
  contact.blur(4);
  contact.blur(1.8);
  renderer.setRenderTarget(null);
  renderer.setClearAlpha(alpha);
  scene.background = bg;
  hidden.forEach(o => { o.visible = true; });
  contact.dirty = false;
}

let grid = null;
export function setGrid(on, major = '#9aa3aa', minor = '#c4cacf') {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid = null; }
  if (!on) return;
  grid = new THREE.GridHelper(2000, 40, new THREE.Color(major), new THREE.Color(minor));
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  grid.material.depthWrite = false;
  grid.position.y = 0.05;
  scene.add(grid);
}

export function applyTheme(dark) {
  scene.background = backdropFor(dark ? 'dark' : 'light');
  scene.environmentIntensity = dark ? 0.9 : 1;
  ground.material.opacity = dark ? 0.4 : 0.24;
  contact.plane.material.opacity = dark ? 1 : 0.85;
  invalidate();
}

// La luz principal y su sombra se ajustan al modelo visible.
export function fitLight(box) {
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  key.target.position.set(c.x, 0, c.z);
  key.position.copy(key.target.position).add(new THREE.Vector3(-0.34, 1, 0.42).normalize().multiplyScalar(r * 3));
  Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: r * 0.5, far: r * 6 });
  key.shadow.camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
  invalidate();
}

// Oclusión ambiental: ignora vidrios y escabeche para que no ensucien lo que hay detrás.
class StudioAO extends GTAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse(o => { if (o.material?.userData?.glass) o.visible = false; });
  }
}

const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, target);
// Solo el primer búfer necesita antialiasing; el segundo sin multisample ahorra mucha memoria.
composer.renderTarget2.samples = 0;
composer.addPass(new RenderPass(scene, camera));
export const ao = new StudioAO(scene, camera, 1, 1);
ao.blendIntensity = 1;
ao.updateGtaoMaterial({ radius: 38, distanceExponent: 1.4, thickness: 12, scale: 1.4, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(ao);
composer.addPass(new OutputPass());

// Calidad inicial según el equipo; si después se traba, baja sola un nivel.
function detectQuality() {
  let gpu = '';
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {}
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'ligera';
  if (coarse) return navigator.deviceMemory && navigator.deviceMemory <= 2 ? 'ligera' : 'media';
  if (/intel.*(hd|uhd) graphics/i.test(gpu)) return 'media';
  return 'alta';
}
let saved = null;
try { saved = localStorage.getItem('visor-calidad'); } catch {}
export const quality = { name: QUALITY[saved] ? saved : detectQuality(), fixed: !!QUALITY[saved] };
const qualityHooks = [];
export const onQuality = fn => qualityHooks.push(fn);

export function setQuality(name, byUser = false) {
  if (!QUALITY[name]) return;
  const q = QUALITY[name], prev = QUALITY[quality.name];
  quality.name = name;
  if (byUser) {
    quality.fixed = true;
    try { localStorage.setItem('visor-calidad', name); } catch {}
  }
  if (composer.renderTarget1.samples !== q.samples) {
    composer.renderTarget1.samples = q.samples;
    composer.renderTarget1.dispose();
  }
  if (key.shadow.mapSize.x !== q.shadow) {
    key.shadow.mapSize.set(q.shadow, q.shadow);
    key.shadow.map?.dispose();
    key.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  }
  if (prev.aoSamples !== q.aoSamples || !qualityReady) {
    ao.updateGtaoMaterial({ samples: q.aoSamples });
    ao.updatePdMaterial({ samples: q.aoSamples });
  }
  qualityReady = true;
  slow = 0;
  resize();
  qualityHooks.forEach(fn => fn(name));
}
let qualityReady = false;

// El panel flota sobre el visor en pantallas anchas. La cámara se recorre con un "view offset"
// para que el centro de la imagen quede en la parte visible y el modelo no se esconda detrás.
const panelEl = document.querySelector('.panel');
const isFullscreen = () => document.fullscreenElement === stageEl || document.webkitFullscreenElement === stageEl
  || document.body.classList.contains('stage-max');
function measureInset(r) {
  if (!panelEl || isFullscreen()) return 0;
  const pos = getComputedStyle(panelEl).position;
  if (pos !== 'absolute' && pos !== 'fixed') return 0;
  const p = panelEl.getBoundingClientRect();
  if (p.bottom <= r.top || p.top >= r.bottom) return 0;
  return Math.round(Math.max(0, Math.min(r.width * 0.6, r.right - p.left)));
}

let size = { w: 1, h: 1 }, inset = 0, visAspect = 1;
// Parte del ancho que tapa el panel (0 a 1) y proporción de lo que sí se ve.
export const coveredFraction = () => inset / size.w;
export const visibleAspect = () => visAspect;
export function resize() {
  const r = stageEl.getBoundingClientRect();
  size = { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
  inset = measureInset(r);
  const q = QUALITY[quality.name];
  const pr = Math.max(1, Math.min(window.devicePixelRatio || 1, q.maxPR, Math.sqrt((q.budget * 1e6) / (size.w * size.h))));
  renderer.setPixelRatio(pr);
  renderer.setSize(size.w, size.h, false);
  composer.setPixelRatio(pr);
  composer.setSize(size.w, size.h);
  labelRenderer.setSize(size.w, size.h);
  const prev = visAspect;
  visAspect = (size.w - inset) / size.h;
  // Cuadro virtual más ancho (lo visible + lo tapado a cada lado): su centro cae en la parte visible.
  camera.aspect = (size.w + inset) / size.h;
  if (inset > 0) camera.setViewOffset(size.w + inset, size.h, inset, 0, size.w, size.h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  if (Math.abs(prev - visAspect) > 0.01) resizeHooks.forEach(fn => fn());
  invalidate();
}
const resizeHooks = [];
export const onResize = fn => resizeHooks.push(fn);
const ro = new ResizeObserver(() => resize());
ro.observe(stageEl);
if (panelEl) ro.observe(panelEl);

let frames = 0, lastMotion = -1e9;
export const invalidate = (n = 2) => { frames = Math.max(frames, n); };
controls.addEventListener('change', () => { lastMotion = performance.now(); invalidate(); });

// Si el visor queda fuera de pantalla (en el celular, al bajar al panel), deja de dibujar.
let onScreen = true;
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) invalidate(); }).observe(stageEl);

// El primer búfer (con antialiasing) siempre recibe la escena; el segundo solo los pasos de después.
function draw() {
  if (contact.dirty) renderContact();
  composer.readBuffer = composer.renderTarget1;
  composer.writeBuffer = composer.renderTarget2;
  composer.render();
}

const hooks = [];
export const onFrame = fn => hooks.push(fn);
let last = performance.now(), wasMoving = false, slow = 0, frameAvg = 16;
function loop(now) {
  const raw = now - last;
  const dt = Math.min(0.05, raw / 1000);
  last = now;
  let busy = controls.autoRotate;
  for (const fn of hooks) busy = fn(dt, now) || busy;
  controls.update(dt);
  if (busy) { lastMotion = now; invalidate(1); }
  // En movimiento, los equipos modestos se saltan la oclusión ambiental; al soltar se dibuja completa.
  const q = QUALITY[quality.name], moving = now - lastMotion < 220;
  ao.enabled = q.ao && (q.aoMotion || !moving);
  if (wasMoving && !moving) invalidate(2);
  wasMoving = moving;
  if (frames > 0 && onScreen) {
    frames--;
    draw();
    labelRenderer.render(scene, camera);
    // Medición de fluidez: si en movimiento va a menos de ~22 cuadros por segundo, baja un nivel.
    if (moving && raw < 250) {
      frameAvg = frameAvg * 0.9 + raw * 0.1;
      slow = frameAvg > 45 ? slow + 1 : 0;
      const next = ORDER[ORDER.indexOf(quality.name) + 1];
      if (slow > 45 && next && !quality.fixed) { frameAvg = 16; setQuality(next); }
    }
  }
  requestAnimationFrame(loop);
}
export function start() {
  setQuality(quality.name);
  requestAnimationFrame(t => { last = t; loop(t); });
}

// Foto en alta resolución del encuadre actual (sin etiquetas HTML). Se limita al máximo que
// soporta la tarjeta de video; en celular sale más chica para no agotar la memoria.
// La foto sale con la proporción de lo que se ve (sin la parte que tapa el panel) y el modelo al centro.
export function capture(longSide = coarse ? 1920 : 2560) {
  longSide = Math.min(longSide, renderer.capabilities.maxTextureSize, 4096);
  const vw = size.w - inset;
  const k = longSide / Math.max(vw, size.h);
  const W = Math.round(vw * k), H = Math.round(size.h * k);
  camera.clearViewOffset();
  camera.aspect = vw / size.h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  ao.enabled = QUALITY[quality.name].ao;
  draw();
  const url = renderer.domElement.toDataURL('image/png');
  resize();
  return url;
}
