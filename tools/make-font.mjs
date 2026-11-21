/* Builds assets/fonts/CozyPixel.ttf from the game's pixel font (js/fontdata.js), so the HTML can use the same
   glyphs as the canvas. Dev-only: run `npm install` once, then `npm run font` in tools/ after editing glyphs.

   1 font pixel = 100 units and unitsPerEm = 1000, so at font-size 10px one font pixel is one CSS pixel (20px: two,
   and so on). Use whole multiples of 10px only. The baseline is the bottom of row 6; rows 7-8 hang below it.
   Ascent 800 + descent 300 = 11 pixels, the same line spacing as the canvas (PX.lineH). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = fs.readFileSync(path.join(root, 'js/fontdata.js'), 'utf8');
const ctx = {};
vm.runInNewContext(src.replace('const PIXEL_FONT', 'this.PIXEL_FONT'), ctx);
const PF = ctx.PIXEL_FONT;

const U = 100, BASE = PF.height - 1;   // row 6 sits on the baseline
function shape(rowsSrc) {
  const rows = rowsSrc.split(' '), w = rows[0].length, p = new opentype.Path();
  rows.forEach((row, r) => {
    const yTop = (BASE - r + 1) * U, yBot = (BASE - r) * U;
    for (let x = 0; x < w;) {   // one rectangle per run of lit pixels in the row (clockwise, y up)
      if (row[x] !== '#') { x++; continue; }
      let e = x; while (e < w && row[e] === '#') e++;
      p.moveTo(x * U, yTop); p.lineTo(e * U, yTop); p.lineTo(e * U, yBot); p.lineTo(x * U, yBot); p.close();
      x = e;
    }
  });
  return { path: p, adv: (w + PF.spacing) * U };
}

const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 400, path: new opentype.Path() })];
const add = (ch, rowsSrc) => {
  const { path: p, adv } = shape(rowsSrc);
  glyphs.push(new opentype.Glyph({ name: 'u' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), unicode: ch.codePointAt(0), advanceWidth: adv, path: p }));
};
for (const ch in PF.glyphs) add(ch, PF.glyphs[ch]);
for (const ch in PF.map) if (!PF.glyphs[ch] && PF.glyphs[PF.map[ch]]) add(ch, PF.glyphs[PF.map[ch]]);

const font = new opentype.Font({
  familyName: 'CozyPixel', styleName: 'Regular', unitsPerEm: 1000,
  ascender: 800, descender: -300, glyphs,
  designer: 'Cozy Ramen', description: "Cozy Ramen's own 5x7 pixel font, built from js/fontdata.js."
});
const out = path.join(root, 'assets/fonts/CozyPixel.ttf');
fs.writeFileSync(out, Buffer.from(font.toArrayBuffer()));
console.log(`CozyPixel.ttf: ${glyphs.length - 1} glyphs -> ${path.relative(root, out)}`);
