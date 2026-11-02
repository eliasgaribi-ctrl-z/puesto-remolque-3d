// Empaqueta todo (three.js incluido) en un solo HTML que funciona sin internet.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const out = process.argv[2] || '../index.html';
const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'eof',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const html = (await readFile('index.html', 'utf8')).replace('<!--APP-->', () => `<script>${js}</script>`);
await writeFile(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);
