// Primitivas de modelado. Todo en centímetros, igual que el boceto.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// Aleatorio con semilla: el modelo sale idéntico en cada carga y en cada exportación.
export function rng(seed = 7) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// UV por proyección de caja en cm reales: la textura del inox cepillado conserva
// su escala en piezas chicas y grandes, y la veta corre siempre horizontal.
export function boxUV(geo, tile = 60) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const cache = new Map();
const keyOf = (...a) => a.map(v => (typeof v === 'number' ? +v.toFixed(2) : v)).join('|');

// Caja con canto redondeado. El radio se limita al grosor de la pieza, así una lámina de 0.8 cm
// no se deforma; las piezas iguales comparten geometría (menos memoria y .glb más ligero).
export function boxGeo(w, h, d, r = 0.5, seg) {
  let rr = Math.min(r, Math.min(w, h, d) * 0.45);
  if (rr < 0.1) rr = 0;
  const s = seg ?? (rr > 2 ? 3 : 2);
  const k = keyOf('b', w, h, d, rr, s);
  let g = cache.get(k);
  if (!g) {
    g = rr > 0 ? new RoundedBoxGeometry(w, h, d, s, rr) : new THREE.BoxGeometry(w, h, d);
    boxUV(g);
    g.userData.box = [w, h, d];
    cache.set(k, g);
  }
  return g;
}

function finish(mesh, mat, o) {
  mesh.castShadow = o.cast ?? !mat.userData.glass;
  mesh.receiveShadow = o.receive ?? true;
  if (o.role) mesh.userData.role = o.role;
  if (o.name) mesh.name = o.name;
  return mesh;
}

// Caja definida por dos esquinas, igual que en el boceto original.
export function box(parent, x0, y0, z0, x1, y1, z1, mat, o = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const m = new THREE.Mesh(boxGeo(w, h, d, o.r ?? mat.userData.r ?? 0.5, o.seg), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(m);
  return finish(m, mat, o);
}

// Perfil de cilindro con canto redondeado (asientos, quesos, perillas).
export function roundCylGeo(r, h, b, seg = 40) {
  b = Math.min(b, r * 0.5, h * 0.5);
  const k = keyOf('rc', r, h, b, seg);
  let g = cache.get(k);
  if (!g) {
    const pts = [new THREE.Vector2(0, -h / 2)];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b));
    }
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b));
    }
    pts.push(new THREE.Vector2(0, h / 2));
    g = new THREE.LatheGeometry(pts, seg);
    cache.set(k, g);
  }
  return g;
}

function orient(geo, axis) {
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  return geo;
}

// Cilindro centrado en (x, y, z) con su eje en x, y o z.
export function cyl(parent, r, h, mat, x, y, z, axis = 'y', seg = 32, o = {}) {
  const k = keyOf('c', o.r2 ?? r, r, h, seg, axis, o.bevel ?? 0, o.open ? 1 : 0);
  let g = cache.get(k);
  if (!g) {
    g = o.bevel
      ? roundCylGeo(r, h, o.bevel, seg).clone()
      : new THREE.CylinderGeometry(o.r2 ?? r, r, h, seg, 1, !!o.open);
    orient(g, axis);
    cache.set(k, g);
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return finish(m, mat, o);
}

// Barra redonda entre dos puntos (patas inclinadas, cadenas).
export function rod(parent, a, b, r, mat, o = {}) {
  const k = keyOf('rod', r);
  let g = cache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(r, r, 1, 14); cache.set(k, g); }
  const m = new THREE.Mesh(g, mat);
  placeRod(m, a, b);
  parent.add(m);
  return finish(m, mat, o);
}

export function placeRod(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(d.length(), 0.01);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}

// Perfil cuadrado entre dos puntos (lanza del remolque, ménsulas).
export function beam(parent, a, b, size, mat, o = {}) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(boxGeo(size, d.length(), size, o.r ?? 0.8), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  parent.add(m);
  return finish(m, mat, o);
}

export function disc(parent, r, mat, x, y, z, face = 'z') {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat);
  if (face === 'x') m.rotation.y = Math.PI / 2;
  if (face === '-x') m.rotation.y = -Math.PI / 2;
  if (face === 'y') m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Lámina plana con huecos (paredes del remolque con sus ventanas).
// plane 'z': rect = [x0, x1, y0, y1], grosor de w0 a w1 en z.
// plane 'x': rect = [z0, z1, y0, y1], grosor de w0 a w1 en x.
export function slab(parent, plane, rect, holes, w0, w1, mat, o = {}) {
  const A = plane === 'x' ? v => -v : v => v;
  const path = (p, a0, a1, b0, b1) => {
    const lo = Math.min(A(a0), A(a1)), hi = Math.max(A(a0), A(a1));
    p.moveTo(lo, b0); p.lineTo(hi, b0); p.lineTo(hi, b1); p.lineTo(lo, b1); p.closePath();
    return p;
  };
  const shape = path(new THREE.Shape(), ...rect);
  for (const h of holes) shape.holes.push(path(new THREE.Path(), ...h));
  const g = new THREE.ExtrudeGeometry(shape, { depth: w1 - w0, bevelEnabled: false });
  if (plane === 'x') g.rotateY(Math.PI / 2);
  boxUV(g);
  const m = new THREE.Mesh(g, mat);
  if (plane === 'x') m.position.x = w0; else m.position.z = w0;
  parent.add(m);
  return finish(m, mat, o);
}

// Muchas piezas iguales en una sola llamada de dibujo (comida en charolas, eslabones).
export function instanced(parent, geo, mat, mats) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m4, i) => im.setMatrixAt(i, m4));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingBox();
  im.computeBoundingSphere();
  im.castShadow = false;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}
