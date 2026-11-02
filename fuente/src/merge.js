// Une las piezas fijas que comparten material en una sola malla. Un celular paga por cada pieza
// que dibuja, no tanto por sus triángulos: así pasa de ~250 piezas a unas cuantas decenas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Piezas originales de cada malla unida, para dibujar sus aristas en el modo técnico.
// Va aparte de userData para que no termine dentro del .glb.
const parts = new WeakMap();

// Copia directa de vértices ya transformados a un solo búfer: sin geometrías intermedias,
// que en un celular hacían que unir piezas tardara más que construirlas.
const _v = new THREE.Vector3(), _n = new THREE.Matrix3();
function bake(list) {
  let vCount = 0, iCount = 0;
  for (const m of list) {
    const g = m.geometry;
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const m of list) {
    m.updateMatrix();
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _n.getNormalMatrix(m.matrix);
    for (let i = 0; i < P.count; i++) {
      const o3 = (vo + i) * 3;
      _v.fromBufferAttribute(P, i).applyMatrix4(m.matrix);
      pos[o3] = _v.x; pos[o3 + 1] = _v.y; pos[o3 + 2] = _v.z;
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      nor[o3] = _v.x; nor[o3 + 1] = _v.y; nor[o3 + 2] = _v.z;
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
    }
    if (g.index) {
      const I = g.index.array;
      for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo;
      io += I.length;
    } else {
      for (let k = 0; k < P.count; k++) idx[io + k] = vo + k;
      io += P.count;
    }
    vo += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// Une los hijos directos de cada grupo (el modelo, la puerta, las tapas, los bancos...), así lo que
// se mueve sigue moviéndose. Las piezas con userData.dynamic se recolocan cada cuadro y se dejan solas.
export function mergeStatic(root) {
  const groups = [];
  root.traverse(o => { if (o.isGroup) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const m of g.children) {
      if (!m.isMesh || m.isInstancedMesh || m.userData.dynamic || m.children.length) continue;
      const k = [m.material.uuid, m.castShadow, m.receiveShadow, m.userData.role || ''].join('|');
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(m);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const first = list[0], mesh = new THREE.Mesh(bake(list), first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      if (first.userData.role) mesh.userData.role = first.userData.role;
      parts.set(mesh, list.map(m => ({ geometry: m.geometry, matrix: m.matrix.clone() })));
      list.forEach(m => g.remove(m));
      g.add(mesh);
    }
  }
}

// Aristas para el modo técnico: las cajas usan su contorno recto (no el redondeado), el resto el ángulo.
const edgeCache = new Map();
function edgesOf(geometry) {
  let e = edgeCache.get(geometry);
  if (!e) {
    const b = geometry.userData.box;
    e = b ? new THREE.EdgesGeometry(new THREE.BoxGeometry(...b)) : new THREE.EdgesGeometry(geometry, 28);
    edgeCache.set(geometry, e);
  }
  return e;
}
export function edgesFor(mesh) {
  const src = parts.get(mesh);
  if (!src) return edgesOf(mesh.geometry).clone();
  return mergeGeometries(src.map(({ geometry, matrix }) => edgesOf(geometry).clone().applyMatrix4(matrix)));
}
