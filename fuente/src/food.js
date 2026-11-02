// Charolas y su contenido: encurtidos en montón con escabeche, quesos acomodados.
import * as THREE from 'three';
import { box, boxGeo, roundCylGeo, instanced, rng } from './kit.js';
import { M, FOOD } from './materials.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function m4(x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

// Piezas chicas con pocos vértices: a esta escala no se nota y el .glb queda ligero.
const G = {
  chile: new THREE.CapsuleGeometry(0.95, 3.4, 2, 8).rotateZ(Math.PI / 2),
  chileChico: new THREE.CapsuleGeometry(0.7, 3.0, 2, 8).rotateZ(Math.PI / 2),
  guero: new THREE.CapsuleGeometry(1.05, 3.0, 2, 8).rotateZ(Math.PI / 2),
  rodaja: new THREE.CylinderGeometry(1.3, 1.3, 0.45, 10),
  aro: new THREE.TorusGeometry(1.2, 0.3, 4, 12, Math.PI * 1.3),
  tira: boxGeo(4.6, 0.35, 0.85, 0),
  florete: new THREE.SphereGeometry(1.35, 8, 6),
  dome: new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  oaxaca: new THREE.TorusKnotGeometry(3.3, 1.15, 80, 8, 3, 7),
};

// Mezclas reales de escabeche: cada charola trae su verdura principal y algo de acompañamiento.
const RECIPES = {
  jalapeno: [[G.chile, FOOD.jalapeno, 0.75], [G.rodaja, FOOD.zanahoria, 0.25]],
  zanahoria: [[G.rodaja, FOOD.zanahoria, 0.8], [G.chile, FOOD.jalapeno, 0.2]],
  cebolla: [[G.aro, FOOD.cebolla, 0.75], [G.aro, FOOD.cebollaB, 0.25]],
  chileRojo: [[G.chileChico, FOOD.chileRojo, 1]],
  nopal: [[G.tira, FOOD.nopal, 0.85], [G.aro, FOOD.cebollaB, 0.15]],
  coliflor: [[G.florete, FOOD.coliflor, 0.8], [G.rodaja, FOOD.zanahoria, 0.2]],
  guero: [[G.guero, FOOD.guero, 1]],
};

// Charola tipo gastronorm: borde pulido al ras de la cubierta, fondo de inox.
export function pan(parent, x, z, w, d, y) {
  const t = 0.9, top = y + 1.1, bot = y - 0.4;
  box(parent, x, bot, z, x + w, top, z + t, M.tube, { r: 0.35 });
  box(parent, x, bot, z + d - t, x + w, top, z + d, M.tube, { r: 0.35 });
  box(parent, x, bot, z, x + t, top, z + d, M.tube, { r: 0.35 });
  box(parent, x + w - t, bot, z, x + w, top, z + d, M.tube, { r: 0.35 });
  box(parent, x + t, bot, z + t, x + w - t, y + 0.3, z + d - t, M.inoxMate, { cast: false, r: 0.2 });
}

export function pickles(parent, x, z, w, d, y, kind, seed) {
  pan(parent, x, z, w, d, y);
  const r = rng(seed), recipe = RECIPES[kind];
  const main = recipe[0][1];
  const cx = x + w / 2, cz = z + d / 2;

  // Cama en forma de domo para que no se vea el fondo entre piezas.
  const bed = new THREE.Mesh(G.dome, main);
  bed.scale.set(w / 2 - 1.4, 2.4, d / 2 - 1.4);
  bed.position.set(cx, y + 0.3, cz);
  bed.receiveShadow = true;
  parent.add(bed);

  const n = Math.round((w * d) / 8);
  const groups = recipe.map(() => []);
  for (let i = 0; i < n; i++) {
    const u = r(), v = r(), dx = (u - 0.5) * 2, dz = (v - 0.5) * 2;
    const dome = Math.max(0, 1 - 0.55 * (dx * dx + dz * dz));
    const h = 0.5 + dome * 3 * (0.4 + 0.6 * r());
    let pick = r(), gi = 0;
    while (gi < recipe.length - 1 && pick > recipe[gi][2]) { pick -= recipe[gi][2]; gi++; }
    const k = 0.85 + r() * 0.3;
    groups[gi].push(m4(x + 2 + u * (w - 4), y + 0.3 + h, z + 2 + v * (d - 4),
      (r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 1.2, k));
  }
  recipe.forEach(([geo, mat], gi) => groups[gi].length && instanced(parent, geo, mat, groups[gi]));

  // Escabeche: superficie brillante que moja la parte baja del montón.
  const brine = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, d - 2), FOOD.brine);
  brine.rotation.x = -Math.PI / 2;
  brine.position.set(cx, y + 1.25, cz);
  parent.add(brine);
}

function grid(cols, rows, x, z, w, d, r, fn) {
  const cw = w / cols, cd = d / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    out.push(fn(x + cw * (i + 0.5) + (r() - 0.5) * cw * 0.12, z + cd * (j + 0.5) + (r() - 0.5) * cd * 0.12, r));
  }
  return out;
}

export function cheeses(parent, x, z, w, d, y, kind, seed) {
  pan(parent, x, z, w, d, y);
  const r = rng(seed), xi = x + 1.5, zi = z + 1.5, wi = w - 3, di = d - 3, base = y + 0.3;
  const yaw = () => (r() - 0.5) * 0.5;
  if (kind === 'fresco') {
    instanced(parent, roundCylGeo(5.6, 4.2, 1.3), FOOD.fresco,
      grid(4, 2, xi, zi, wi, di, r, (px, pz) => m4(px, base + 2.1, pz, 0, r() * 6, 0, 0.95 + r() * 0.08)));
  } else if (kind === 'panela') {
    instanced(parent, boxGeo(9.4, 4.4, 7, 1.6), FOOD.panela,
      grid(4, 3, xi, zi, wi, di, r, (px, pz) => m4(px, base + 2.2, pz, 0, yaw(), 0, 1)));
  } else if (kind === 'oaxaca') {
    instanced(parent, G.oaxaca, FOOD.oaxaca,
      grid(4, 2, xi, zi, wi, di, r, (px, pz) => m4(px, base + 3.6, pz, r() * 6, r() * 6, r() * 6, 1, 0.85, 1)));
  } else {
    instanced(parent, boxGeo(10.5, 5.6, 7.6, 0.7), FOOD.amarillo,
      grid(4, 3, xi, zi, wi, di, r, (px, pz) => m4(px, base + 2.8, pz, 0, yaw(), 0, 1)));
  }
}

// Rueda de queso con canto redondeado.
export function wheel(parent, r, h, mat, x, y, z) {
  const m = new THREE.Mesh(roundCylGeo(r, h, Math.min(1.8, h * 0.3), 48), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
