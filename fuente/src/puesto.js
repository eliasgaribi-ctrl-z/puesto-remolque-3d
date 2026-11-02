// Puesto de acero inoxidable: 2 módulos de 224.7 cm (chiles y quesos) + mueble de rebanadoras.
// Las medidas son las del boceto original; solo cambia el nivel de detalle.
import * as THREE from 'three';
import { box, cyl, disc, DEG, V } from './kit.js';
import { M, FOOD, logoMat, numberMat } from './materials.js';
import { pickles, cheeses, wheel } from './food.js';
import { newModel, dim, hotspot } from './annot.js';

export function buildPuesto() {
  const P = newModel('puesto'), g = P.geo;
  const L = 224.7, D = 70, H = 90, VH = 55;

  function module(x0, kind) {
    const xe = x0 + L;
    // Patas de PTR 4×4 con niveladores de bala.
    for (const px of [x0 + 2.5, x0 + L / 2, xe - 2.5]) for (const pz of [2.5, D - 2.5]) {
      box(g, px - 2, 5, pz - 2, px + 2, H - 3, pz + 2, M.tube, { r: 0.6 });
      cyl(g, 2.2, 1.2, M.tube, px, 4.4, pz, 'y', 24);
      cyl(g, 1.4, 2.6, M.tube, px, 2.5, pz, 'y', 20, { r2: 0.9 });
      cyl(g, 2.4, 1.2, M.rubber, px, 0.6, pz, 'y', 24, { bevel: 0.4 });
    }
    box(g, x0, H - 3, 0, xe, H, D, M.inox, { r: 0.8 });
    box(g, x0, H - 6, D - 0.2, xe, H - 3, D + 0.8, M.inox, { r: 0.4 });
    box(g, x0 + 1, 12, 1, xe - 1, 13.5, D - 2, M.inoxMate, { r: 0.4 });
    box(g, x0 + 1, 32, 18, xe - 1, 33.5, D - 2, M.inoxMate, { r: 0.4 });
    // Frente al cliente: lámina, franja de vidrio ahumado, lámina.
    box(g, x0 + 0.4, 6, D - 1, xe - 0.4, 33, D + 0.2, M.inox, { role: 'lamina' });
    box(g, x0 + 0.4, 33, D - 0.7, xe - 0.4, 60, D - 0.1, M.glassTint);
    box(g, x0 + 0.4, 60, D - 1, xe - 0.4, 87, D + 0.2, M.inox, { role: 'lamina' });
    box(g, x0 + 0.4, 32, D - 1, xe - 0.4, 34, D + 0.6, M.tube, { r: 0.5 });
    box(g, x0 + 0.4, 59, D - 1, xe - 0.4, 61, D + 0.6, M.tube, { r: 0.5 });
    disc(g, 11.5, logoMat, x0 + L / 2, 73.5, D + 0.32);
    box(g, x0, 6, 0.5, x0 + 0.8, 87, D - 1, M.inox, { role: 'lamina' });
    box(g, xe - 0.8, 6, 0.5, xe, 87, D - 1, M.inox, { role: 'lamina' });
    // Vitrina: postes pulidos, repisa superior y vidrios.
    for (const px of [x0 + 1.5, x0 + L / 2, xe - 1.5]) for (const pz of [1.5, D - 1.5]) {
      box(g, px - 1.5, H, pz - 1.5, px + 1.5, H + VH, pz + 1.5, M.tube, { r: 0.7 });
    }
    box(g, x0, H + VH, 0, xe, H + VH + 2.5, D, M.inox, { r: 0.6 });
    box(g, x0, H + VH - 3, D - 0.6, xe, H + VH, D + 0.4, M.inox, { r: 0.3 });
    // Tira LED bajo la repisa: ilumina la mercancía.
    box(g, x0 + 4, H + VH - 0.9, D - 7, xe - 4, H + VH - 0.3, D - 5.5, M.led, { cast: false, r: 0.2 });
    box(g, x0 + 3, H + 0.5, D - 2.2, x0 + L / 2 - 1.5, H + VH - 0.5, D - 1.6, M.glass);
    box(g, x0 + L / 2 + 1.5, H + 0.5, D - 2.2, xe - 3, H + VH - 0.5, D - 1.6, M.glass);
    box(g, x0 + 0.9, H + 0.5, 3, x0 + 1.5, H + VH - 0.5, D - 3, M.glass);
    box(g, xe - 1.5, H + 0.5, 3, xe - 0.9, H + VH - 0.5, D - 3, M.glass);

    if (kind === 'chiles') {
      const kinds = ['jalapeno', 'zanahoria', 'cebolla', 'chileRojo', 'nopal', 'coliflor', 'guero', 'zanahoria'];
      const n = 8, gap = 1.2, margin = 6, w = (L - 2 * margin - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const x = x0 + margin + i * (w + gap);
        pickles(g, x, 14, w, 32, H, kinds[i], 101 + i * 13);
        const t = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), numberMat(i + 1));
        t.rotation.x = -Math.PI / 2;
        t.position.set(x + w / 2, H + 0.06, 52);
        g.add(t);
      }
    } else {
      const kinds = ['fresco', 'panela', 'oaxaca', 'amarillo'];
      const n = 4, gap = 1.5, margin = 6, w = (L - 2 * margin - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) cheeses(g, x0 + margin + i * (w + gap), 14, w, 32, H, kinds[i], 301 + i * 7);
      // Repisa intermedia de 25 cm de fondo, 28 cm arriba de las charolas.
      const y = H + 28;
      for (const px of [x0 + 3, x0 + L / 2, xe - 3]) box(g, px - 1, y - 2.5, 0, px + 1, y, D - 2, M.tube, { r: 0.4 });
      box(g, x0 + 3, y, 18, xe - 3, y + 1.5, 43, M.inox, { r: 0.4 });
      box(g, x0 + 3, y + 1.5, 42, xe - 3, y + 3.5, 43, M.inox, { r: 0.3 });
      for (const [px, r] of [[x0 + 30, 10], [x0 + 58, 8.5], [x0 + 150, 10], [x0 + 182, 9]]) {
        wheel(g, r, 8, FOOD.amarillo, px, y + 5.5, 30);
      }
      box(g, x0 + 92, y + 1.5, 22, x0 + 122, y + 9, 38, FOOD.fresco, { r: 2 });
    }
  }
  module(0, 'chiles');
  module(L, 'quesos');

  // Banqueta de concreto.
  const kerb = 18;
  box(g, 462, 0, -45, 640, kerb, 125, M.concrete, { r: 2.5, seg: 3 });

  // Mueble de rebanadoras.
  const c = 482, l = 562, h = 70, top = kerb + 88;
  box(g, c, kerb, 0, l, kerb + 1.2, h, M.inox);
  box(g, c, kerb, 0, l, top - 2, 1.2, M.inox);
  box(g, c, kerb, 0, c + 1.2, top - 2, h, M.inox, { r: 0.4 });
  box(g, l - 1.2, kerb, 0, l, top - 2, h, M.inox, { r: 0.4 });
  box(g, c - 0.6, top - 2, -0.6, l + 0.6, top, h + 0.8, M.inox, { r: 0.6 });
  box(g, c + 1.2, kerb + 1.2, 1.2, l - 1.2, top - 2, 2, M.interior, { cast: false });
  box(g, c + 1.2, kerb + 44, 2, l - 1.2, kerb + 45.2, h - 3, M.inoxMate, { r: 0.3 });
  for (let i = 0; i < 4; i++) {
    box(g, c + 8 + i * 17, kerb + 45.2, 12, c + 22 + i * 17, kerb + 58, 40, M.bread, { r: 4.5, seg: 3 });
  }
  const door = new THREE.Group();
  door.position.set(c + 0.8, 0, h + 0.7);
  g.add(door);
  box(door, 0, kerb + 1, -0.7, 78.4, kerb + 86, 0.7, M.inox, { r: 0.5 });
  box(door, 71, kerb + 50, 0.7, 73, kerb + 72, 3, M.tube, { r: 0.8 });
  box(door, 70.6, kerb + 51, 0.7, 73.4, kerb + 53, 1.6, M.tube, { r: 0.4 });
  box(door, 70.6, kerb + 69, 0.7, 73.4, kerb + 71, 1.6, M.tube, { r: 0.4 });
  for (const hy of [kerb + 12, kerb + 75]) cyl(g, 0.9, 7, M.tube, c + 0.4, hy, h + 0.7, 'y', 16);
  P.movers.push({ id: 'puerta', obj: door, axis: 'y', open: -105 * DEG, closed: 0, state: 0, target: 0 });
  // Marco y vidrio sobre el mueble.
  box(g, c + 1, top, h - 3.2, c + 3, H + VH, h - 1.2, M.tube, { r: 0.6 });
  box(g, l - 3, top, h - 3.2, l - 1, H + VH, h - 1.2, M.tube, { r: 0.6 });
  box(g, c + 1, H + VH - 2, h - 3.2, l - 1, H + VH, h - 1.2, M.tube, { r: 0.6 });
  box(g, c + 3, top + 0.5, h - 2.5, l - 3, H + VH - 2, h - 1.9, M.glass);

  for (const sx of [c + 20, c + 60]) slicer(g, sx, top);

  const d = H + VH + 2.5;
  dim(P, V(0, d, D), V(L, d, D), V(0, 1, 0), 18, '224.7');
  dim(P, V(L, d, D), V(2 * L, d, D), V(0, 1, 0), 18, '224.7');
  dim(P, V(0, 0, D + 1), V(2 * L, 0, D + 1), V(0, 0, 1), 46, '449.4');
  dim(P, V(0, d, 0), V(0, d, D), V(-1, 0, 0), 18, '70');
  dim(P, V(0, H, D), V(0, H + VH, D), V(-1, 0, 0), 18, '55');
  dim(P, V(0, 0, D), V(0, H, D), V(-1, 0, 0), 18, '90', 'supuesto');
  dim(P, V(2 * L, H, 43), V(2 * L, H + 28, 43), V(1, 0, 0), 9, '28', 'supuesto');
  dim(P, V(2 * L, H + 29.5, 18), V(2 * L, H + 29.5, 43), V(1, 0, 0), 9, '25', 'supuesto');
  dim(P, V(c, H + VH, h), V(l, H + VH, h), V(0, 1, 0), 14, '80');
  dim(P, V(l, kerb, h), V(l, top, h), V(1, 0, 0), 16, '88');
  dim(P, V(c, kerb + 1, h + 0.8), V(c, kerb + 86, h + 0.8), V(-1, 0, 0), 9, '85');
  dim(P, V(l, top, 0), V(l, top, h), V(1, 0, 0), 16, '70', 'supuesto');
  dim(P, V(640, 0, 125), V(640, kerb, 125), V(1, 0, 0), 14, '18');

  hotspot(P, 'chiles', V(L / 2, H + 34, 30), 'Chiles y zanahorias', '8 charolas numeradas para encurtidos: chiles, zanahorias y verduras. Van dentro de la vitrina de vidrio de 55 cm.');
  hotspot(P, 'quesos', V(L * 1.5, H + 44, 30), 'Quesos', 'Charolas para quesos y una repisa intermedia de 25 cm de fondo, 28 cm arriba de las charolas.');
  hotspot(P, 'rebanadoras', V((c + l) / 2, top + 30, 30), 'Rebanadoras', 'Mueble de 80 × 88 cm sobre la banqueta de 18 cm, con puerta de 85 cm y vidrio al frente. Arriba caben dos rebanadoras compactas.');
  hotspot(P, 'repisa', V(L * 1.78, d + 3, 14), 'Repisa superior', 'Repisa de inox sobre la vitrina, 70 cm de fondo, para insumos ligeros.', V(0, 1, 0));
  hotspot(P, 'frente', V(L * 1.5, 47, D + 2), 'Frente al cliente', 'Lámina, franja de vidrio y lámina, con el logo del cliente al centro de cada módulo.', V(0, 0, 1));

  P.views = [
    { id: 'iso', label: '3/4', pos: [430, 360, 690], tgt: [0, 70, 0] },
    { id: 'frente', label: 'Frente', pos: [0, 120, 880], tgt: [0, 80, 0] },
    { id: 'trabajo', label: 'Lado de trabajo', pos: [-260, 300, -700], tgt: [0, 80, 0] },
    { id: 'costado', label: 'Costado', pos: [920, 170, 60], tgt: [0, 80, 0] },
    { id: 'planta', label: 'Planta', pos: [0, 1150, 0.1], tgt: [0, 0, 0] },
  ];
  P.title = 'Puesto de acero inoxidable';
  P.table = [
    ['Módulo de chiles y zanahorias', [['Largo', '224.7', 'b'], ['Fondo', '70', 'b'], ['Vitrina de vidrio', '55', 'b'], ['Altura de cubierta', '90', 's'], ['Charolas', '8 pzas', 'b']]],
    ['Módulo de quesos', [['Largo', '224.7', 'b'], ['Fondo', '70', 'b'], ['Repisa intermedia, altura', '28', 's'], ['Repisa intermedia, fondo', '25', 's']]],
    ['Mueble de rebanadoras', [['Ancho', '80', 'b'], ['Altura', '88', 'b'], ['Puerta', '85', 'b'], ['Fondo', '70', 's'], ['Banqueta', '18', 'b']]],
    ['Conjunto', [['Largo de los 2 módulos', '449.4', 'b']]],
  ];
  P.finish = 'inox';
  P.finishRole = 'lamina';
  P.finishMats = { inox: M.inox, blanco: M.white };
  P.actions = [
    { id: 'act-puerta', type: 'switch', label: 'Abrir puerta del mueble', mover: 'puerta' },
    { id: 'act-frente', type: 'seg', label: 'Acabado del frente', options: [['inox', 'Inox'], ['blanco', 'Blanco']], finish: true },
  ];
  return P;
}

// Rebanadora comercial compacta, dentro de la misma huella del boceto.
function slicer(g, x, top) {
  for (const [fx, fz] of [[-15, 14], [15, 14], [-15, 42], [15, 42]]) cyl(g, 1.4, 1, M.rubber, x + fx, top + 0.5, fz, 'y', 16);
  box(g, x - 17, top + 1, 12, x + 17, top + 9, 44, M.alu, { r: 2.5, seg: 3 });
  box(g, x - 12, top + 9, 14, x + 4, top + 22, 30, M.alu, { r: 3, seg: 3 });
  const blade = cyl(g, 12, 0.8, M.tube, x + 6, top + 21, 28, 'x', 64);
  blade.rotation.z = -10 * DEG;
  const guard = new THREE.Mesh(new THREE.TorusGeometry(12.6, 0.9, 10, 48, Math.PI * 1.25), M.alu);
  guard.rotation.set(-0.4, Math.PI / 2, 0);
  guard.position.set(x + 6.8, top + 21, 28);
  guard.castShadow = true;
  g.add(guard);
  cyl(g, 3.2, 1.6, M.alu, x + 7, top + 21, 28, 'x', 32, { bevel: 0.6 });
  const tray = box(g, x + 6, top + 12, 22, x + 20, top + 13.2, 42, M.tube, { r: 0.5 });
  tray.rotation.x = 0.12;
  cyl(g, 1.3, 7, M.plastic, x + 13, top + 17, 32, 'y', 20, { bevel: 0.5 });
  cyl(g, 2.6, 2.2, M.plastic, x - 8, top + 5, 44.6, 'z', 32, { bevel: 0.7 });
  cyl(g, 1, 0.8, M.red, x + 10, top + 5, 44.2, 'z', 20);
}
