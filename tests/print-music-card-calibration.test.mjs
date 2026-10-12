import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '../src/screens/playlist/PrintMusicCardScreen.js'), 'utf8');
const codeStart = source.indexOf('function buildPrintHtml({');
const codeEnd = source.indexOf('export default function PrintMusicCardScreen()');
assert.ok(codeStart > 0 && codeEnd > codeStart, 'Generador de impresión localizado');

// Ejecutamos el generador puro de HTML aislado de React/Expo.
const buildPrintHtml = vm.runInNewContext(
  `${source.slice(codeStart, codeEnd)}\n buildPrintHtml;`,
  { esc: x => String(x ?? ''), qrUrl: x => `qr://${x}`, MIN_BACK_OFFSET_MM: -3, MAX_BACK_OFFSET_MM: 3, DEFAULT_BACK_OFFSET_Y_MM: 0 },
);

const common = {
  title: 'Prueba', author: 'Autor', subtitle: '',
  cards: [{ title: 'Canción', author: 'Autor', url: 'https://www.youtube.com/watch?v=abc', cover: '' }],
  distinctCards: false, format: 'a4', copies: 10,
  cropMarks: true, doubleSided: true, duplexFlip: 'long',
  coverUri: '', contactEmail: '', landingUrl: '',
};

function html(x, y) { return buildPrintHtml({ ...common, backOffsetX: x, backOffsetY: y }); }

test('Los valores iniciales y el botón Restablecer no aplican +2 mm', () => {
  assert.match(source, /const DEFAULT_BACK_OFFSET_X_MM = 0;/);
  assert.match(source, /const DEFAULT_BACK_OFFSET_Y_MM = 0;/);
  assert.match(source, /Restablecer ajustes: X 0 mm · Y 0 mm/);
  assert.doesNotMatch(source, /const DEFAULT_BACK_OFFSET_Y_MM = 2;/);
});

test('X=0/Y=0 colocan el reverso en el mismo origen que el anverso', () => {
  const result = html(0, 0);
  assert.ok(result.includes('top:8.5mm;left:15mm;width:180mm;height:280mm'));
  assert.ok(result.includes('.back-sheet .cards-grid{top:calc(8.5mm + 0mm);left:calc(15mm + 0mm);}'));
  assert.equal((result.match(/class="sheet /g) || []).length, 2);
  assert.equal((result.match(/class="card front"/g) || []).length, 10);
  assert.equal((result.match(/class="card back"/g) || []).length, 10);
});

test('Se aplican solo los valores X e Y seleccionados por el usuario', () => {
  const result = html(-1.5, 0.5);
  assert.ok(result.includes('.back-sheet .cards-grid{top:calc(8.5mm + 0.5mm);left:calc(15mm + -1.5mm);}'));
  assert.ok(result.includes('grid-template-columns:90mm 90mm;grid-template-rows:repeat(5,56mm)'));
});

test('Los valores de calibración fuera del rango se limitan a ±3 mm', () => {
  const result = html(50, -50);
  assert.ok(result.includes('top:calc(8.5mm + -3mm);left:calc(15mm + 3mm)'));
});
