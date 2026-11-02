// Remolque con barra: caja de 320 × 200 × 210 sobre un eje, barra frontal y repisa trasera.
// Las medidas son las del boceto original; las ventanas ahora son huecos reales con cocina adentro.
import * as THREE from 'three';
import { box, cyl, rod, beam, disc, slab, placeRod, DEG, V } from './kit.js';
import { M, logoMat } from './materials.js';
import { newModel, dim, hotspot } from './annot.js';

export function buildRemolque() {
  const R = newModel('remolque'), g = R.geo;
  const t = 320, n = 200, s = 50, hBox = 210, a = s + hBox;
  const body = M.white, skin = 2, lin = 1;

  // Ventanas: [eje del muro, rango horizontal, rango vertical].
  const win = {
    side: [100, 220, 140, 230],   // costado +z, x × y
    front: [25, 175, 110, 205],   // frente -x (barra), z × y
    rear: [40, 160, 150, 212],    // trasera +x, z × y
  };

  // Caja: piel exterior pintada + recubrimiento interior claro, con huecos en las ventanas.
  slab(g, 'z', [0, t, s, a], [win.side], n - skin, n, body, { role: 'body' });
  slab(g, 'z', [3, t - 3, s + 3, a - 3], [win.side], n - skin - lin, n - skin, M.liner, { cast: false });
  slab(g, 'z', [0, t, s, a], [], 0, skin, body, { role: 'body' });
  slab(g, 'z', [3, t - 3, s + 3, a - 3], [], skin, skin + lin, M.liner, { cast: false });
  slab(g, 'x', [0, n, s, a], [win.front], 0, skin, body, { role: 'body' });
  slab(g, 'x', [3, n - 3, s + 3, a - 3], [win.front], skin, skin + lin, M.liner, { cast: false });
  slab(g, 'x', [0, n, s, a], [win.rear], t - skin, t, body, { role: 'body' });
  slab(g, 'x', [3, n - 3, s + 3, a - 3], [win.rear], t - skin - lin, t - skin, M.liner, { cast: false });
  box(g, 0, s, 0, t, s + 3, n, M.floor, { r: 0 });
  box(g, 0, a - 2, 0, t, a, n, body, { role: 'body', r: 0 });
  box(g, 3, a - 3, 3, t - 3, a - 2, n - 3, M.liner, { cast: false, r: 0 });
  box(g, -3, a, -3, t + 3, a + 5, n + 3, M.inox, { r: 1.5 });
  // Extractor en el techo.
  box(g, 205, a + 5, 80, 255, a + 14, 120, M.inox, { r: 2, seg: 3 });
  for (let i = 0; i < 6; i++) box(g, 209, a + 13.6, 84 + i * 6.2, 251, a + 14.4, 86.4 + i * 6.2, M.steelDark, { r: 0.3 });
  // Esquineros redondeados.
  for (const [cx, cz] of [[0, 0], [t, 0], [0, n], [t, n]]) box(g, cx - 2, s, cz - 2, cx + 2, a, cz + 2, M.inox, { r: 1.8 });
  // Faldón de lámina antiderrapante (18 cm), solo el perímetro para no tapar el piso interior.
  box(g, -0.6, s, n, t + 0.6, s + 18, n + 0.6, M.treadPlate, { r: 0.2 });
  box(g, -0.6, s, -0.6, t + 0.6, s + 18, 0, M.treadPlate, { r: 0.2 });
  box(g, -0.6, s, 0, 0, s + 18, n, M.treadPlate, { r: 0.2 });
  box(g, t, s, 0, t + 0.6, s + 18, n, M.treadPlate, { r: 0.2 });

  // Chasis, lanza, enganche y gato.
  box(g, -4, s - 10, 22, t + 4, s, 30, M.chassis, { r: 0.8 });
  box(g, -4, s - 10, n - 30, t + 4, s, n - 22, M.chassis, { r: 0.8 });
  for (const x of [10, 110, 230, 310]) box(g, x - 3, s - 10, 22, x + 3, s - 4, n - 22, M.chassis, { r: 0.6 });
  beam(g, V(0, s - 6, 26), V(-140, 44, 100), 7, M.chassis);
  beam(g, V(0, s - 6, n - 26), V(-140, 44, 100), 7, M.chassis);
  box(g, -150, 38, 94, -136, 50, 106, M.chassis, { r: 2 });
  cyl(g, 4.5, 6, M.chassis, -146, 37, 100, 'y', 24, { bevel: 1.2 });
  cyl(g, 2.5, 46, M.chassis, -112, 22, 76, 'y', 16);
  cyl(g, 3.2, 12, M.chassis, -112, 40, 76, 'y', 16);
  cyl(g, 5, 4, M.rubber, -112, 5, 76, 'x', 24, { bevel: 1.2 });
  box(g, -116, 44.5, 75, -104, 46, 77, M.tube, { r: 0.5 });

  // Eje, llantas y salpicaderas.
  const ax = 182, wr = 33;
  cyl(g, 3, n + 30, M.chassis, ax, wr, n / 2, 'z', 16);
  for (const z of [-12, n + 12]) wheel(g, ax, wr, z, Math.sign(z - n / 2));

  // Calaveras traseras y plafones laterales.
  for (const z of [8, n - 22]) box(g, t, s + 24, z, t + 1.5, s + 34, z + 14, M.tail, { r: 0.6 });
  for (const [x, z] of [[6, n + 0.6], [t - 10, n + 0.6], [6, -1.4], [t - 10, -1.4]]) box(g, x, s + 26, z, x + 4, s + 30, z + 0.8, M.amber, { r: 0.3 });

  // Ventana de servicio (costado) con tapa abatible que hace de techito.
  const [h0, h1, f0, f1] = win.side;
  opening(g, 'z', n, h0, h1, f0, f1);
  const flap = new THREE.Group();
  flap.position.set((h0 + h1) / 2, f1 + 1.5, n + 1.1);
  g.add(flap);
  box(flap, -(h1 - h0) / 2 - 2, -(f1 - f0) - 3, -0.8, (h1 - h0) / 2 + 2, 0, 0.8, body, { role: 'body', r: 0.6 });
  box(flap, -(h1 - h0) / 2 - 2, -(f1 - f0) - 3, 0.8, (h1 - h0) / 2 + 2, -(f1 - f0) - 1, 2, M.inox, { r: 0.5 });
  R.movers.push({ id: 'ventanas', obj: flap, axis: 'x', open: -72 * DEG, closed: 0, state: 1, target: 1 });
  // Pistones de gas que sostienen la tapa.
  const struts = [-1, 1].map(sd => ({ sd, m: rod(g, V(0, 0, 0), V(0, 1, 0), 0.6, M.tube, { cast: false }) }));
  const tip = new THREE.Vector3();
  R.tick.push(() => {
    flap.updateMatrix();
    const open = flap.rotation.x < -0.12;
    for (const { sd, m } of struts) {
      m.visible = open;
      tip.set(sd * ((h1 - h0) / 2 - 4), -(f1 - f0) * 0.62, 1.6).applyMatrix4(flap.matrix);
      placeRod(m, V((h0 + h1) / 2 + sd * ((h1 - h0) / 2 + 3.5), f0 + 18, n + 1.6), tip);
    }
  });

  for (const x of [50, 270]) {
    disc(g, 30, logoMat, x, 160, n + 0.45);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(30.5, 0.9, 10, 96), M.tube);
    ring.position.set(x, 160, n + 0.5);
    g.add(ring);
  }
  for (const x of [80, 240]) {
    cyl(g, 6, 1.4, M.inox, x, 236, n + 0.6, 'z', 40, { bevel: 0.5 });
    cyl(g, 4.8, 1.8, M.lamp, x, 236, n + 0.7, 'z', 40);
  }

  // Barra frontal sobre ménsulas.
  box(g, -60, 91, 0, 0, 95, n, M.inox, { r: 0.8 });
  box(g, -60.8, 86, 0, -59.2, 95, n, M.inox, { r: 0.6 });
  for (const z of [6, n / 2, n - 6]) beam(g, V(-0.5, 58, z), V(-52, 90, z), 3.5, M.tube, { r: 0.6 });

  // Ventana del frente (hacia la barra).
  const [fz0, fz1, fy0, fy1] = win.front;
  opening(g, '-x', 0, fz0, fz1, fy0, fy1);
  const fFlap = new THREE.Group();
  fFlap.position.set(-1.1, fy1 + 1.5, (fz0 + fz1) / 2);
  g.add(fFlap);
  box(fFlap, -0.8, -(fy1 - fy0) - 3, -(fz1 - fz0) / 2 - 2, 0.8, 0, (fz1 - fz0) / 2 + 2, body, { role: 'body', r: 0.6 });
  R.movers.push({ id: 'ventanas', obj: fFlap, axis: 'z', open: -70 * DEG, closed: 0, state: 1, target: 1 });

  // Ventana trasera.
  const [rz0, rz1, ry0, ry1] = win.rear;
  opening(g, 'x', t, rz0, rz1, ry0, ry1);
  const rFlap = new THREE.Group();
  rFlap.position.set(t + 1.1, ry1 + 1.5, (rz0 + rz1) / 2);
  g.add(rFlap);
  box(rFlap, -0.8, -(ry1 - ry0) - 3, -(rz1 - rz0) / 2 - 2, 0.8, 0, (rz1 - rz0) / 2 + 2, body, { role: 'body', r: 0.6 });
  R.movers.push({ id: 'ventanas', obj: rFlap, axis: 'z', open: 68 * DEG, closed: 0, state: 1, target: 1 });

  // Repisa trasera abatible con cadenas.
  const sd = 40, sy = 108, sw = 150;
  const shelf = new THREE.Group();
  shelf.position.set(t + 0.6, sy, n / 2);
  g.add(shelf);
  box(shelf, 0, 0, -sw / 2, 2.2, sd, sw / 2, M.inox, { r: 0.5 });
  box(shelf, 2.2, sd - 2.5, -sw / 2, 3.4, sd, sw / 2, M.inox, { r: 0.4 });
  for (const k of [-1, 1]) cyl(g, 1.6, 3, M.tube, t + 1.5, sy, n / 2 + k * (sw / 2 - 6), 'z', 16);
  R.movers.push({ id: 'repisa', obj: shelf, axis: 'z', open: -90 * DEG, closed: 0, state: 1, target: 1 });
  const chains = [-1, 1].map(k => ({ k, m: rod(g, V(0, 0, 0), V(0, 1, 0), 0.45, M.tube, { cast: false }) }));
  const end = new THREE.Vector3();
  R.tick.push(() => {
    shelf.updateMatrix();
    for (const { k, m } of chains) {
      end.set(0, sd, k * (sw / 2 - 4)).applyMatrix4(shelf.matrix);
      placeRod(m, V(t + 0.8, sy + 46, n / 2 + k * (sw / 2 - 4)), end);
    }
  });

  // Puerta de acceso (propuesta) con escalón.
  box(g, 236, s + 6, -0.6, 304, s + 196, 0, M.inoxMate, { r: 0.4 });
  box(g, 234.5, s + 4.5, -1, 305.5, s + 6, 0, M.tube, { r: 0.4 });
  box(g, 234.5, s + 196, -1, 305.5, s + 197.5, 0, M.tube, { r: 0.4 });
  box(g, 234.5, s + 6, -1, 236, s + 196, 0, M.tube, { r: 0.4 });
  box(g, 304, s + 6, -1, 305.5, s + 196, 0, M.tube, { r: 0.4 });
  box(g, 237, s + 8, -1.1, 303, s + 40, -0.6, M.treadPlate, { r: 0.2 });
  box(g, 292, s + 90, -2.6, 295, s + 112, -0.6, M.tube, { r: 0.8 });
  for (const y of [s + 30, s + 100, s + 170]) cyl(g, 1, 8, M.tube, 236.5, y, -1.2, 'y', 16);
  box(g, 236, 26, -26, 304, 30, 0, M.treadPlate, { r: 0.4 });
  for (const x of [238, 302]) box(g, x - 1, 26, -2, x + 1, s - 10, 0, M.chassis, { r: 0.3 });

  kitchen(g, t, n, s, a);

  // Bancos sencillos para la barra.
  const stools = new THREE.Group();
  g.add(stools);
  for (const z of [16, 56, 100, 144, 184]) {
    cyl(stools, 16, 5, M.seat, -98, 68.5, z, 'y', 48, { bevel: 2 });
    cyl(stools, 13, 2, M.tube, -98, 65, z, 'y', 40, { bevel: 0.6 });
    for (const [kx, kz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      rod(stools, V(-98 + kx * 12, 0.5, z + kz * 12), V(-98 + kx * 8, 65, z + kz * 8), 1.2, M.tube);
      cyl(stools, 1.8, 1.2, M.rubber, -98 + kx * 12, 0.6, z + kz * 12, 'y', 12, { bevel: 0.4 });
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.9, 10, 40), M.tube);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-98, 24, z);
    ring.castShadow = true;
    stools.add(ring);
  }
  R.stools = stools;

  dim(R, V(-150, 0, n), V(t, 0, n), V(0, 0, 1), 70, '470');
  dim(R, V(0, a + 5, n), V(t, a + 5, n), V(0, 1, 0), 20, '320');
  dim(R, V(h0, f0, n), V(h1, f0, n), V(0, -1, 0), 12, '120');
  dim(R, V(t + 3, a + 5, 0), V(t + 3, a + 5, n), V(1, 0, 0), 20, '200', 'supuesto');
  dim(R, V(t, s, n), V(t, a, n), V(1, 0, 0), 62, '210', 'supuesto');
  dim(R, V(t, 0, n), V(t, s, n), V(1, 0, 0), 62, '50', 'supuesto');
  dim(R, V(-60, 95, n), V(0, 95, n), V(0, 0, 1), 16, '60');
  dim(R, V(-60, 0, n), V(-60, 95, n), V(0, 0, 1), 16, '95');
  dim(R, V(t + 0.6, sy - 2, n / 2 - sw / 2), V(t + sd + 0.6, sy - 2, n / 2 - sw / 2), V(0, 0, -1), 12, '40');

  hotspot(R, 'ventana', V(160, 196, n + 30), 'Ventana de servicio', 'Ventana de 120 cm al centro del costado, con tapa abatible hacia arriba que hace de techito.', V(0, 0, 1));
  hotspot(R, 'barra', V(-40, 104, 165), 'Barra frontal', 'Barra de 60 cm de fondo a 95 cm de altura, al frente del remolque, para 5 bancos sencillos.', V(-0.5, 0, 0.85));
  hotspot(R, 'repisa', V(t + 30, sy + 12, n / 2 + 40), 'Repisa abatible', 'Repisa trasera de 40 cm. Se baja con cadenas para servir y se sube para viajar.', V(1, 0, 0.3));
  hotspot(R, 'graficos', V(50, 200, n + 4), 'Logos y lámparas', 'Dos gráficos circulares a los lados de la ventana y dos lámparas chicas arriba.', V(0, 0, 1));
  hotspot(R, 'eje', V(ax, 78, n + 26), 'Eje y salpicaderas', 'Un eje con llantas por fuera de la caja y salpicaderas de inox.', V(0, 0, 1));
  hotspot(R, 'puerta', V(270, 160, -6), 'Puerta de acceso', 'Propuesta: no viene en el boceto. Puerta del lado contrario a la ventana, con escalón.', V(0, 0, -1));

  R.views = [
    { id: 'iso', label: '3/4', pos: [470, 340, 680], tgt: [0, 120, 0] },
    { id: 'lado', label: 'Lado ventana', pos: [0, 160, 860], tgt: [0, 125, 0] },
    { id: 'barra', label: 'Barra', pos: [-780, 200, 160], tgt: [0, 115, 0] },
    { id: 'trasera', label: 'Trasera', pos: [780, 210, -200], tgt: [0, 120, 0] },
    { id: 'planta', label: 'Planta', pos: [0, 1250, 0.1], tgt: [0, 0, 0] },
  ];
  R.title = 'Remolque con barra';
  R.table = [
    ['Medidas generales', [['Largo total con lanza', '470', 'b'], ['Largo de la caja', '320', 'b'], ['Ancho de la caja', '200', 's'], ['Alto de la caja', '210', 's'], ['Altura del piso', '50', 's']]],
    ['Servicio', [['Ventana de servicio, ancho', '120', 'b'], ['Ventana de servicio, alto', '90', 's'], ['Repisa abatible trasera', '40', 'b']]],
    ['Barra y bancos', [['Fondo de barra', '60', 'b'], ['Altura de barra', '95', 'b'], ['Bancos sencillos', '5 pzas', 'b'], ['Altura de asiento', '70', 's']]],
    ['Gráficos', [['Círculos grandes', 'ø 60', 's'], ['Lámparas', 'ø 12', 's']]],
  ];
  R.finish = 'blanco';
  R.finishRole = 'body';
  R.finishMats = { blanco: M.white, grafito: M.graphite, inox: M.inox };
  R.actions = [
    { id: 'act-ventanas', type: 'switch', label: 'Ventanas abiertas', mover: 'ventanas' },
    { id: 'act-repisa', type: 'switch', label: 'Repisa trasera abajo', mover: 'repisa' },
    { id: 'act-bancos', type: 'switch', label: 'Mostrar bancos', get: () => stools.visible, set: v => { stools.visible = v; } },
    { id: 'act-color', type: 'seg', label: 'Color de la caja', options: [['blanco', 'Blanco'], ['grafito', 'Grafito'], ['inox', 'Inox']], finish: true },
  ];
  return R;
}

// Marco de inox por fuera y forro del canto del hueco.
function opening(g, face, w, a0, a1, b0, b1) {
  const k = 2.2, th = 0.9;
  if (face === 'z') {
    box(g, a0 - k, b0 - k, w, a1 + k, b0, w + th, M.inox, { r: 0.4 });
    box(g, a0 - k, b1, w, a1 + k, b1 + k, w + th, M.inox, { r: 0.4 });
    box(g, a0 - k, b0, w, a0, b1, w + th, M.inox, { r: 0.4 });
    box(g, a1, b0, w, a1 + k, b1, w + th, M.inox, { r: 0.4 });
    box(g, a0, b0 - 0.5, w - 3, a1, b0, w, M.inox, { r: 0.2 });
    box(g, a0, b1, w - 3, a1, b1 + 0.5, w, M.inox, { r: 0.2 });
    box(g, a0, b0, w - 3, a0 + 0.5, b1, w, M.inox, { r: 0.2 });
    box(g, a1 - 0.5, b0, w - 3, a1, b1, w, M.inox, { r: 0.2 });
  } else {
    const out = face === 'x' ? 1 : -1;
    const [o0, o1] = [Math.min(w, w + out * th), Math.max(w, w + out * th)];
    const [i0, i1] = [Math.min(w, w - out * 3), Math.max(w, w - out * 3)];
    box(g, o0, b0 - k, a0 - k, o1, b0, a1 + k, M.inox, { r: 0.4 });
    box(g, o0, b1, a0 - k, o1, b1 + k, a1 + k, M.inox, { r: 0.4 });
    box(g, o0, b0, a0 - k, o1, b1, a0, M.inox, { r: 0.4 });
    box(g, o0, b0, a1, o1, b1, a1 + k, M.inox, { r: 0.4 });
    box(g, i0, b0 - 0.5, a0, i1, b0, a1, M.inox, { r: 0.2 });
    box(g, i0, b1, a0, i1, b1 + 0.5, a1, M.inox, { r: 0.2 });
    box(g, i0, b0, a0, i1, b1, a0 + 0.5, M.inox, { r: 0.2 });
    box(g, i0, b0, a1 - 0.5, i1, b1, a1, M.inox, { r: 0.2 });
  }
}

function wheel(g, x, y, z, side) {
  const R = 33.5, ri = 19, wd = 7.5;
  const prof = [[ri, -wd + 1], [ri + 3, -wd + 0.2], [26, -wd], [30.5, -wd + 0.3], [32.6, -wd + 1.4], [R, -wd + 3],
    [R, wd - 3], [32.6, wd - 1.4], [30.5, wd - 0.3], [26, wd], [ri + 3, wd - 0.2], [ri, wd - 1]];
  const tire = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 72).rotateX(Math.PI / 2), M.rubber);
  tire.position.set(x, y, z);
  tire.castShadow = tire.receiveShadow = true;
  g.add(tire);
  cyl(g, ri + 0.3, 13, M.alu, x, y, z, 'z', 48, { open: true });
  cyl(g, 17.5, 1.6, M.alu, x, y, z + side * 4.6, 'z', 48, { bevel: 0.6 });
  cyl(g, 7.5, 2, M.tube, x, y, z + side * 5.8, 'z', 40, { bevel: 0.8 });
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    cyl(g, 0.9, 1.6, M.tube, x + Math.cos(ang) * 10.5, y + Math.sin(ang) * 10.5, z + side * 5.8, 'z', 6);
  }
  cyl(g, 3, 1.8, M.chassis, x, y, z + side * 7, 'z', 24, { bevel: 0.6 });
  // Salpicadera de inox con canto enrollado.
  const fg = new THREE.CylinderGeometry(39, 39, 22, 48, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  const fender = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ name: 'Salpicadera', color: 0xc9ccce, metalness: 1, roughness: 0.28, side: THREE.DoubleSide }));
  fender.position.set(x, y, z);
  fender.castShadow = true;
  g.add(fender);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(39, 0.8, 8, 48, Math.PI), M.inox);
  lip.position.set(x, y, z + side * 11);
  g.add(lip);
}

// Cocina interior: se ve por las ventanas abiertas.
function kitchen(g, t, n, s, a) {
  const fl = s + 3;
  // Mostrador bajo la ventana de servicio, con tarja.
  box(g, 60, fl, n - 60, 300, 134, n - 3, M.inox, { r: 0.5 });
  box(g, 58, 134, n - 63, 300, 137.5, n - 3, M.inox, { r: 0.6 });
  box(g, 250, 137.5, n - 52, 290, 137.7, n - 14, M.steelDark, { r: 0 });
  cyl(g, 1.2, 26, M.tube, 270, 150, n - 8, 'y', 16);
  rod(g, V(270, 162.5, n - 8), V(270, 160, n - 26), 1, M.tube);
  for (const x of [90, 150, 210]) box(g, x - 7, 125, n - 61.5, x + 7, 126.4, n - 60, M.tube, { r: 0.5 });

  // Línea caliente en la pared de la puerta: plancha, estufa y campana.
  box(g, 62, fl, 3, 225, 134, 68, M.inox, { r: 0.5 });
  box(g, 62, 134, 3, 225, 137.5, 70, M.inox, { r: 0.6 });
  for (const x of [102, 142, 182]) box(g, x - 0.2, fl + 6, 68, x + 0.2, 130, 68.3, M.interior, { r: 0 });
  for (const x of [82, 122, 162, 202]) box(g, x - 6, 124, 68, x + 6, 125.4, 70, M.tube, { r: 0.5 });
  box(g, 72, 137.5, 8, 142, 146, 62, M.inox, { r: 0.8 });
  box(g, 73, 146, 9, 141, 147, 61, M.steelDark, { r: 0.3 });
  box(g, 72, 146, 8, 142, 156, 10, M.inox, { r: 0.4 });
  for (const x of [82, 98, 116, 132]) cyl(g, 1.6, 1.6, M.plastic, x, 141.5, 62.8, 'z', 20, { bevel: 0.5 });
  box(g, 150, 137.5, 8, 215, 143, 62, M.inox, { r: 0.8 });
  for (const x of [166, 199]) {
    cyl(g, 6.5, 1.2, M.steelDark, x, 143.6, 32, 'y', 32);
    box(g, x - 13, 144.2, 31.4, x + 13, 145, 32.6, M.steelDark, { r: 0.2 });
    box(g, x - 0.6, 144.2, 20, x + 0.6, 145, 44, M.steelDark, { r: 0.2 });
  }
  box(g, 62, 212, 3, 225, 238, 58, M.inox, { r: 1.2 });
  box(g, 66, 211.4, 8, 221, 212, 54, M.steelDark, { r: 0 });

  // Mostrador bajo la ventana del frente y contrabarra trasera.
  box(g, 3, fl, 3, 56, 104, n - 3, M.inox, { r: 0.5 });
  box(g, 3, 104, 3, 58, 107, n - 3, M.inox, { r: 0.6 });
  box(g, t - 48, fl, 75, t - 3, 134, 135, M.inox, { r: 0.5 });
  box(g, t - 50, 134, 75, t - 3, 137.5, 135, M.inox, { r: 0.6 });

  // Panel LED en el techo.
  box(g, 70, a - 3.7, 80, 250, a - 3, 120, M.led, { cast: false, r: 0.4 });
}
