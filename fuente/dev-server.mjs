// Servidor local de pruebas: sirve la carpeta del proyecto y guarda en salida/ lo que el visor
// le mande por PUT /__save/<archivo> (renders y .glb generados desde el navegador).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, normalize, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'PUT' && url.startsWith('/__save/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await mkdir(join(root, 'salida'), { recursive: true });
    const file = join(root, 'salida', basename(url));
    await writeFile(file, Buffer.concat(chunks));
    res.writeHead(200).end('ok');
    return;
  }
  const path = normalize(join(root, url === '/' ? 'index.html' : url));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch {
    res.writeHead(404).end('no encontrado');
  }
}).listen(Number(process.env.PORT) || 8731, '127.0.0.1', () => console.log('http://127.0.0.1:8731'));
