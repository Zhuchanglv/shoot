/*!
 * PixelFont - a hand-crafted 5x7 pixel bitmap font (classic arcade style)
 * packaged for Phaser 3's RetroFont / BitmapText.
 *
 * Dependency-free classic <script>. Exposes a single global:
 *   window.PixelFont  (and the top-level `var PixelFont`).
 *
 * Usage inside a Phaser.Scene:
 *   PixelFont.register(this);
 *   this.add.bitmapText(x, y, 'pixel', 'HELLO WORLD', 8);
 *
 * The glyph sheet is drawn white (#ffffff); tint the BitmapText later.
 */
var PixelFont = (function () {
  'use strict';

  /* ---- glyph metrics ------------------------------------------------- */
  var GLYPH_W = 5;   // every glyph is exactly 5 columns wide
  var GLYPH_H = 7;   // every glyph is exactly 7 rows tall

  var CELL_W = GLYPH_W;   // RetroFont cell width
  var CELL_H = GLYPH_H;   // RetroFont cell height

  var CHARS_PER_ROW = 16; // sheet columns before wrapping

  /* ---- character set (draw order == cell order) ----------------------
   * No double-quote character is needed. Uppercase only; lowercase input
   * is folded to the uppercase glyph by getGlyph().
   */
  var CHARS = " !#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /* ---- glyph bitmaps -------------------------------------------------
   * Every entry: exactly 7 strings of exactly 5 chars, using '1' for an
   * opaque pixel and '0' for a transparent pixel.
   */
  var GLYPHS = {
    ' ' : ['00000','00000','00000','00000','00000','00000','00000'],
    '!' : ['00100','00100','00100','00100','00100','00000','00100'],
    '#' : ['01010','01010','11111','01010','11111','01010','01010'],
    '$' : ['00100','01111','10100','01110','00101','11110','00100'],
    '%' : ['11001','11001','00010','00100','01000','10011','10011'],
    '&' : ['01100','10010','10010','01100','10101','10010','01101'],
    "'" : ['00100','00100','00000','00000','00000','00000','00000'],
    '(' : ['00010','00100','01000','01000','01000','00100','00010'],
    ')' : ['01000','00100','00010','00010','00010','00100','01000'],
    '*' : ['00000','00100','10101','01110','10101','00100','00000'],
    '+' : ['00000','00100','00100','11111','00100','00100','00000'],
    ',' : ['00000','00000','00000','00000','00000','00100','01000'],
    '-' : ['00000','00000','00000','11110','00000','00000','00000'],
    '.' : ['00000','00000','00000','00000','00000','00100','00100'],
    '/' : ['00000','00001','00010','00100','01000','10000','00000'],
    '0' : ['01100','10010','10010','10110','11010','10010','01100'],
    '1' : ['00100','01100','10100','00100','00100','00100','01110'],
    '2' : ['01100','10010','00010','00100','01000','10000','11110'],
    '3' : ['11110','00010','00010','01110','00010','00010','11110'],
    '4' : ['00010','00110','01010','10010','11110','00010','00010'],
    '5' : ['11110','10000','10000','11100','00010','00010','11100'],
    '6' : ['01100','10000','10000','11100','10010','10010','01100'],
    '7' : ['11110','00010','00100','00100','01000','01000','01000'],
    '8' : ['01100','10010','10010','01100','10010','10010','01100'],
    '9' : ['01100','10010','10010','01110','00010','00010','01100'],
    ':' : ['00000','00100','00100','00000','00100','00100','00000'],
    ';' : ['00000','00100','00100','00000','00100','00100','01000'],
    '<' : ['00010','00100','01000','10000','01000','00100','00010'],
    '=' : ['00000','00000','11110','00000','11110','00000','00000'],
    '>' : ['01000','00100','00010','00001','00010','00100','01000'],
    '?' : ['01100','10010','00010','00100','00100','00000','00100'],
    '@' : ['01110','10001','10111','10101','10111','10000','01110'],
    'A' : ['01100','10010','10010','11110','10010','10010','10010'],
    'B' : ['11100','10010','10010','11100','10010','10010','11100'],
    'C' : ['01100','10010','10000','10000','10000','10010','01100'],
    'D' : ['11100','10010','10010','10010','10010','10010','11100'],
    'E' : ['11110','10000','10000','11100','10000','10000','11110'],
    'F' : ['11110','10000','10000','11100','10000','10000','10000'],
    'G' : ['01100','10010','10000','10110','10010','10010','01100'],
    'H' : ['10010','10010','10010','11110','10010','10010','10010'],
    'I' : ['11100','01000','01000','01000','01000','01000','11100'],
    'J' : ['00110','00010','00010','00010','00010','10010','01100'],
    'K' : ['10010','10010','10100','11000','10100','10010','10010'],
    'L' : ['10000','10000','10000','10000','10000','10000','11110'],
    'M' : ['10001','11011','10101','10101','10001','10001','10001'],
    'N' : ['10001','11001','10101','10011','10001','10001','10001'],
    'O' : ['01100','10010','10010','10010','10010','10010','01100'],
    'P' : ['11100','10010','10010','11100','10000','10000','10000'],
    'Q' : ['01100','10010','10010','10010','10010','01110','00011'],
    'R' : ['11100','10010','10010','11100','10100','10010','10010'],
    'S' : ['01100','10010','10000','01100','00010','00010','01100'],
    'T' : ['11111','00100','00100','00100','00100','00100','00100'],
    'U' : ['10010','10010','10010','10010','10010','10010','01100'],
    'V' : ['10001','10001','10001','10001','01010','01010','00100'],
    'W' : ['10001','10001','10001','10101','10101','11011','01010'],
    'X' : ['10001','10001','01010','00100','01010','10001','10001'],
    'Y' : ['10001','10001','01010','00100','00100','00100','00100'],
    'Z' : ['11110','00010','00100','01000','10000','10000','11110']
  };

  /* ---- helpers ------------------------------------------------------- */

  /* Resolve a single character to its 7x5 bitmap. Lowercase letters and
   * unknown characters fall back gracefully (letters -> uppercase -> space). */
  function getGlyph(ch) {
    if (ch === null || ch === undefined) { return GLYPHS[' ']; }
    var key = String(ch);
    if (Object.prototype.hasOwnProperty.call(GLYPHS, key)) { return GLYPHS[key]; }
    var up = key.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(GLYPHS, up)) { return GLYPHS[up]; }
    return GLYPHS[' '];
  }

  /* Pixel width of a string at 1 screen pixel per glyph column. */
  function measure(text) {
    if (text === null || text === undefined) { return 0; }
    return String(text).length * CELL_W;
  }

  /* Rows (sheet height / CELL_H) needed to hold the whole character set. */
  function sheetRows() {
    return Math.ceil(CHARS.length / CHARS_PER_ROW);
  }

  /* ---- Phaser integration ------------------------------------------- */

  /* Build the "pixelfont" canvas texture and register a bitmap font called
   * "pixel" on the given Phaser.Scene. Returns true on success. */
  function register(scene) {
    if (!scene) { return false; }
    if (typeof document === 'undefined') { return false; }
    if (typeof Phaser === 'undefined' ||
        !Phaser.GameObjects ||
        !Phaser.GameObjects.RetroFont) { return false; }

    var rows = sheetRows();
    var canvas = document.createElement('canvas');
    canvas.width = CHARS_PER_ROW * CELL_W;
    canvas.height = rows * CELL_H;

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';

    for (var i = 0; i < CHARS.length; i++) {
      var glyph = GLYPHS[CHARS.charAt(i)];
      if (!glyph) { continue; }
      var ox = (i % CHARS_PER_ROW) * CELL_W;
      var oy = Math.floor(i / CHARS_PER_ROW) * CELL_H;
      for (var y = 0; y < GLYPH_H; y++) {
        var bits = glyph[y];
        for (var x = 0; x < GLYPH_W; x++) {
          if (bits.charAt(x) === '1') {
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
    }

    var texture = scene.textures.addCanvas('pixelfont', canvas);

    var entry = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: 'pixelfont',
      width: CELL_W,
      height: CELL_H,
      chars: CHARS,
      charsPerRow: CHARS_PER_ROW,
      spacing: { x: 0, y: 0 }
    });

    scene.cache.bitmapFont.add('pixel', entry);

    /* Keep a reference for debugging / potential tinting. */
    texture.pixelFont = true;
    return true;
  }

  /* ---- public API ---------------------------------------------------- */
  var api = {
    GLYPH_W: GLYPH_W,
    GLYPH_H: GLYPH_H,
    CELL_W: CELL_W,
    CELL_H: CELL_H,
    CHARS_PER_ROW: CHARS_PER_ROW,
    CHARS: CHARS,
    GLYPHS: GLYPHS,

    /* Phaser */
    register: register,
    /* metadata helpers */
    sheetRows: sheetRows,
    /* character -> bitmap (with lowercase fallback) */
    getGlyph: getGlyph,
    /* text -> pixel width */
    measure: measure
  };

  return api;
})();

/* Classic-script global (top-level `var` already creates it in a browser;
 * this keeps it explicit and makes the eval-based tests work too). */
if (typeof window !== 'undefined') {
  window.PixelFont = PixelFont;
}
