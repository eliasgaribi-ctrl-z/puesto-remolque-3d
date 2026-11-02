// Cotas y puntos de interés sobre el modelo, y la estructura común de cada modelo.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const dimMats = {
  boceto: new THREE.LineBasicMaterial({ color: 0x1d5fd1, depthTest: false, transparent: true, opacity: 0.9 }),
  supuesto: new THREE.LineBasicMaterial({ color: 0xb76a00, depthTest: false, transparent: true, opacity: 0.9 }),
};

export function newModel(key) {
  const root = new THREE.Group(), geo = new THREE.Group(), dims = new THREE.Group(), labels = new THREE.Group();
  root.add(geo, dims, labels);
  return { key, root, geo, dims, labels, movers: [], hotspots: [], views: [], table: [], tick: [], actions: [] };
}

// Cota entre a y b, desplazada `off` cm en la dirección `n`, con su texto al centro.
export function dim(model, a, b, n, off, text, kind = 'boceto') {
  const a2 = a.clone().addScaledVector(n, off), b2 = b.clone().addScaledVector(n, off);
  const ext = n.clone().multiplyScalar(4);
  const dir = new THREE.Vector3().subVectors(b2, a2).normalize();
  const tick = dir.clone().add(n).normalize().multiplyScalar(3);
  const pts = [
    a.clone().addScaledVector(n, 2), a2.clone().add(ext),
    b.clone().addScaledVector(n, 2), b2.clone().add(ext),
    a2.clone().addScaledVector(dir, -4), b2.clone().addScaledVector(dir, 4),
    a2.clone().sub(tick), a2.clone().add(tick),
    b2.clone().sub(tick), b2.clone().add(tick),
  ];
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), dimMats[kind]);
  line.renderOrder = 10;
  model.dims.add(line);
  const el = document.createElement('div');
  el.className = 'cota ' + kind;
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.copy(a2).lerp(b2, 0.5);
  model.dims.add(label);
}

// Punto de interés: botón sobre el modelo + entrada en la lista de áreas.
// `n` es la normal de la cara: si la cámara queda detrás, el punto se oculta.
export function hotspot(model, id, pos, title, body, n = null) {
  const num = model.hotspots.length + 1;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'hs';
  el.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="t"></span>';
  el.querySelector('.dot').textContent = num;
  el.querySelector('.t').textContent = title;
  el.setAttribute('aria-label', `${num}. ${title}`);
  const obj = new CSS2DObject(el);
  obj.position.copy(pos);
  model.labels.add(obj);
  const spot = { id, num, title, body, pos, el, n: n ? n.clone().normalize() : null };
  el.addEventListener('click', e => { e.stopPropagation(); model.onHotspot?.(spot); });
  model.hotspots.push(spot);
}
