// Materiales y texturas procedurales. Nada se descarga: el HTML sigue funcionando sin internet.
import * as THREE from 'three';
import { rng } from './kit.js';

function canvasTex(w, h, draw, { color = true, repeat = 1, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.userData.redraw = () => {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    t.needsUpdate = true;
  };
  return t;
}

// Texturas con letra: se redibujan cuando terminan de cargar las fuentes.
export const fontTextures = [];

// Veta de inox cepillado: renglones independientes suavizados a lo largo de x (se repite sin costura).
// Va en el canal G (rugosidad); R y B en blanco para que el .glb no altere el metalizado.
// La veta corre en horizontal: basta la mitad de resolución a lo ancho, y se genera el doble de rápido.
const brushed = canvasTex(256, 512, (g, w, h) => {
  const img = g.createImageData(w, h), r = rng(11), win = 24;
  for (let y = 0; y < h; y++) {
    const row = r(), raw = new Float32Array(w);
    for (let x = 0; x < w; x++) raw[x] = r();
    let acc = 0;
    for (let x = -win; x < win; x++) acc += raw[(x + w) % w];
    for (let x = 0; x < w; x++) {
      acc += raw[(x + win) % w] - raw[(x - win + w) % w];
      const v = 0.5 * row + 0.5 * (acc / (2 * win)) + (r() - 0.5) * 0.12;
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = Math.round(255 * (0.68 + 0.32 * Math.min(1, Math.max(0, v))));
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}, { color: false });

// Lámina antiderrapante (diamante) para faldón, escalón y piso.
const tread = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 5;
  const step = w / 4;
  for (let j = -1; j <= 4; j++) for (let i = -1; i <= 4; i++) {
    const cx = i * step + (j % 2 ? step / 2 : 0), cy = j * step;
    g.save(); g.translate(cx + step / 4, cy + step / 4);
    g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
    g.beginPath(); g.ellipse(0, 0, step * 0.36, step * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}, { color: false, repeat: 5 });

const concreteTex = canvasTex(512, 512, (g, w, h) => {
  const r = rng(5);
  g.fillStyle = '#b8b5ad'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = r() * w, y = r() * h, s = 20 + r() * 90, a = 0.01 + r() * 0.022;
    const grd = g.createRadialGradient(x, y, 0, x, y, s);
    const c = r() > 0.5 ? '255,255,255' : '60,58,54';
    grd.addColorStop(0, `rgba(${c},${a})`); grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  for (let i = 0; i < 9000; i++) {
    const v = r() > 0.5 ? 255 : 40;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}, { repeat: 1 });

const phys = o => new THREE.MeshPhysicalMaterial(o);
const std = o => new THREE.MeshStandardMaterial(o);
const tag = (m, data) => Object.assign(m.userData, data) && m;

const glassBase = { metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, ior: 1.5, specularIntensity: 1 };

export const M = {
  inox: phys({ name: 'Inox cepillado', color: 0xcfd2d4, metalness: 1, roughness: 0.28, roughnessMap: brushed, anisotropy: 0.55 }),
  inoxMate: phys({ name: 'Inox mate', color: 0xb4b8bb, metalness: 1, roughness: 0.5, roughnessMap: brushed, anisotropy: 0.4 }),
  tube: phys({ name: 'Inox pulido', color: 0xdadddf, metalness: 1, roughness: 0.13 }),
  treadPlate: phys({ name: 'Lámina antiderrapante', color: 0xbfc2c4, metalness: 1, roughness: 0.36, bumpMap: tread, bumpScale: 2.2 }),
  glass: tag(phys({ name: 'Vidrio', color: 0xf0f7f5, roughness: 0.02, opacity: 0.13, ...glassBase }), { glass: true, r: 0 }),
  glassTint: tag(phys({ name: 'Vidrio ahumado', color: 0x27353b, roughness: 0.05, opacity: 0.62, ...glassBase }), { glass: true, r: 0 }),
  white: phys({ name: 'Pintura blanca', color: 0xf0f0ed, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.08 }),
  graphite: phys({ name: 'Pintura grafito', color: 0x30353a, metalness: 0.2, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.1 }),
  rubber: std({ name: 'Hule', color: 0x1b1c1e, roughness: 0.86 }),
  chassis: phys({ name: 'Chasis negro', color: 0x222426, metalness: 0.35, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
  interior: std({ name: 'Interior oscuro', color: 0x2b2f33, roughness: 0.85 }),
  liner: std({ name: 'Recubrimiento interior', color: 0xe6e8e9, roughness: 0.6 }),
  floor: std({ name: 'Piso', color: 0x3b3e41, roughness: 0.7, bumpMap: tread, bumpScale: 1.5 }),
  concrete: std({ name: 'Concreto', map: concreteTex, color: 0xe4e1da, roughness: 0.95 }),
  alu: phys({ name: 'Aluminio', color: 0xcfd3d6, metalness: 0.85, roughness: 0.34 }),
  plastic: std({ name: 'Plástico negro', color: 0x1e2125, roughness: 0.5 }),
  red: phys({ name: 'Botón rojo', color: 0xc4242a, roughness: 0.3, clearcoat: 1 }),
  steelDark: phys({ name: 'Plancha', color: 0x2a2b2d, metalness: 0.7, roughness: 0.42 }),
  seat: phys({ name: 'Vinil', color: 0x272b30, roughness: 0.5, sheen: 0.5, sheenRoughness: 0.5, sheenColor: 0x5a626b, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
  lamp: std({ name: 'Lámpara', color: 0xfff6dc, emissive: 0xffe6a8, emissiveIntensity: 2.4, roughness: 0.3 }),
  led: std({ name: 'Tira LED', color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 3 }),
  tail: phys({ name: 'Calavera', color: 0x9a0f14, emissive: 0x6a0508, roughness: 0.12, clearcoat: 1 }),
  amber: phys({ name: 'Plafón ámbar', color: 0xd88a0c, emissive: 0x5a3000, roughness: 0.12, clearcoat: 1 }),
  bread: phys({ name: 'Pan', color: 0xc78645, roughness: 0.7, sheen: 0.3, sheenColor: 0xf0c890 }),
};

// Comida: brillo de encurtido (clearcoat) en verduras, mate en quesos.
const veg = (name, color) => phys({ name, color, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.15 });
const cheese = (name, color, rough = 0.78) => phys({ name, color, roughness: rough, sheen: 0.25, sheenColor: 0xffffff });
export const FOOD = {
  jalapeno: veg('Jalapeño', 0x2f6e14),
  zanahoria: veg('Zanahoria', 0xf2600a),
  cebolla: veg('Cebolla morada', 0x9c2f72),
  cebollaB: veg('Cebolla', 0xe8dfe6),
  chileRojo: veg('Chile rojo', 0xb8100f),
  nopal: veg('Nopal', 0x2f6f24),
  coliflor: veg('Coliflor', 0xece3c9),
  guero: veg('Chile güero', 0xcfc037),
  brine: tag(phys({ name: 'Escabeche', color: 0xd9b860, roughness: 0.03, opacity: 0.14, ...glassBase }), { glass: true, r: 0 }),
  fresco: cheese('Queso fresco', 0xf5f2ea),
  panela: cheese('Queso panela', 0xf1ede1, 0.7),
  oaxaca: cheese('Queso Oaxaca', 0xf3ead2, 0.6),
  amarillo: cheese('Queso amarillo', 0xeaa83c, 0.55),
};

// Logo provisional del cliente (mismo diseño del boceto, a mayor resolución).
export const logoTex = canvasTex(1024, 1024, (g) => {
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.fillStyle = '#f7f7f5'; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#15191c';
  g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 196, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#15191c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 250px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; g.fillText('R', 256, 270);
  g.font = '600 34px "Barlow Condensed", Arial, sans-serif'; g.fillText('LOGO DEL CLIENTE', 256, 410);
}, { repeat: 1 });
logoTex.wrapS = logoTex.wrapT = THREE.ClampToEdgeWrapping;
fontTextures.push(logoTex);
export const logoMat = phys({ name: 'Logo', map: logoTex, transparent: true, roughness: 0.35, clearcoat: 0.6 });

// Etiqueta numerada de cada charola.
export function numberMat(n) {
  const t = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#16191c';
    g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 26); g.fill();
    g.fillStyle = '#f4f5f6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 132px "Barlow Condensed", Arial, sans-serif'; g.fillText(String(n), w / 2, h / 2 + 8);
  }, { repeat: 1 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  fontTextures.push(t);
  return phys({ name: 'Etiqueta ' + n, map: t, transparent: true, roughness: 0.4, clearcoat: 0.5 });
}

// Modo técnico: maqueta blanca con aristas.
export const TECH = {
  solid: std({ color: 0xdfe2e5, roughness: 0.92 }),
  glass: tag(std({ color: 0xbcd8ee, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), { glass: true }),
  edge: new THREE.LineBasicMaterial({ color: 0x2a3036, transparent: true, opacity: 0.85 }),
};
