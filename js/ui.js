'use strict';
/* HUD pixel icons + the shared palette. Icons are tiny pixel maps rendered to data URLs once, then shown at
   1 icon pixel = 1 HUD unit (2 canvas pixels), the same scale as the game text. */
const PAL = {
  ink: '#2a1a26',                                                   // outlines and dark text (warm plum-black)
  walnut: '#5a3a22', walnutHi: '#7a5230', walnutLo: '#3e2616',      // HUD wood
  hinoki: '#e6c08a', honey: '#c8995e',                              // light woods
  washi: '#fff5e0', washiLo: '#ead9b5',                             // paper
  brass: '#e0b040', brassHi: '#ffe08a', brassLo: '#9a6a22',         // trims, coins
  lacquer: '#b8302a', lacquerLo: '#7a1e18',                         // red accents
  indigo: '#2f3f78', indigoLo: '#1f2a52', indigoHi: '#4a5c9a', jade: '#6fbf4a', jadeLo: '#3d7a45', cream: '#f6e6c0',
  // building materials shared by the kitchen, serving room and props
  beam: '#4a2e1c', beamHi: '#6e4a2c', post: '#5a3820', postWarm: '#6e4428', plaster: '#ecdcb8', plasterWarm: '#e2cba0',
  panel: '#8a5a32', wallDark: '#4e3220', cork: '#b8865a',
  brick: '#a8553a', mortar: '#5e3a2e', stone: '#8c8078', stoneLo: '#5e5550', stoneHi: '#b4a89c',
  copper: '#c87a3e', copperHi: '#f2b878', copperLo: '#8a4a22', copperDk: '#5e2e16',
  iron: '#3a3438', ironHi: '#5e5458', lacquerBlack: '#2a1c1e', lacquerDeep: '#9a2a22',
  steelLite: '#dfe6ee', steel: '#aab4c4'
};

const UI = (() => {
  const C = {
    k: PAL.ink, w: PAL.washi, p: PAL.washiLo, g: PAL.brass, G: PAL.brassLo, y: PAL.brassHi, c: PAL.cream,
    r: PAL.lacquer, R: PAL.lacquerLo, o: '#e2812e', j: PAL.jade, n: '#b07c48', N: '#6e4a2c', b: '#6f8fd0'
  };
  const MAPS = {
    coin: ['..kkkkk..', '.kgggggk.', 'kgyGGGggk', 'kgGgggGgk', 'kgGgggGgk', 'kgGgggGgk', 'kggGGGGgk', '.kgggggk.', '..kkkkk..'],
    sun: ['....g....', '.g.....g.', '...ggg...', '..gyyyg..', 'g.gyyyg.g', '..gyyyg..', '...ggg...', '.g.....g.', '....g....'],
    rain: ['..ccccc....', '.cccccccc..', 'ccccccccccc', 'ccccccccccc', '.ccccccccc.', '...........', '.b..b..b...', 'b..b..b..b.', '...........', '..b..b..b..', '.b..b..b...'],
    moon: ['..ccccc..', '.cccyy...', 'cccy.....', 'ccy......', 'ccy......', 'ccy....y.', 'cccy.....', '.cccyy...', '..ccccc..'],
    menu: ['.kkkkkkkkk.', '.kRRRRRRRk.', '.kRRRRRRRk.', '.kwwwwwwwk.', '.kwowpppwk.', '.kwwwwwwwk.', '.kwrwpppwk.', '.kwwwwwwwk.', '.kwjwpppwk.', '.kwwwwwwwk.', '.kkkkkkkkk.'],
    book: ['...........', '.kkkk.kkkk.', 'kwwwwkwwwwk', 'kwppwkwppwk', 'kwwwwkwwwwk', 'kwppwkwppwk', 'kwwwwkwwwwk', 'kwppwkwppwk', 'kRRRRkRRRRk', '.kkkkkkkkk.', '...........'],
    sound: ['...........', '....k......', '...kk...c..', 'kkkck.c..c.', 'kccck..c.c.', 'kccck..c.c.', 'kccck..c.c.', 'kkkck.c..c.', '...kk...c..', '....k......', '...........'],
    mute: ['...........', '....k......', '...kk......', 'kkkck.r...r', 'kccck..r.r.', 'kccck...r..', 'kccck..r.r.', 'kkkck.r...r', '...kk......', '....k......', '...........'],
    help: ['...........', '...cccc....', '..cc..cc...', '......cc...', '.....cc....', '....cc.....', '....cc.....', '...........', '....cc.....', '....cc.....', '...........'].map(r => '.' + r.slice(0, 10)),
    pause: ['...........', '...........', '..ccc.ccc..', '..ccc.ccc..', '..ccc.ccc..', '..ccc.ccc..', '..ccc.ccc..', '..ccc.ccc..', '..ccc.ccc..', '...........', '...........'],
    serving: ['...c...c...', '....c...c..', '...c...c...', '...........', 'kkkkkkkkkkk', 'krrrrrrrrrk', '.krrrrrrrk.', '..kRRRRRk..', '...kkkkk...', '....kkk....', '...........'],
    toppings: ['...........', '..kk...kk..', '.kRRk.kjjk.', '.kRRk.kjjk.', '..kk...kk..', '...........', '..kk...kk..', '.kook.kwwk.', '.kook.kwwk.', '..kk...kk..', '...........'],
    guests: ['...........', '....kkk....', '...kccck...', '...kccck...', '....kkk....', '...........', '..kkkkkkk..', '.kbbbbbbbk.', '.kbbbbbbbk.', '.kkkkkkkkk.', '...........'],
    street: ['....kkk....', '...kRRRk...', '..krrrrrk..', '.krryrrrrk.', '.krrrrrrrk.', '.kRRRRRRRk.', '.krrrrrrrk.', '..krrrrrk..', '...kRRRk...', '....kkk....', '.....g.....'],
    kitchen: ['....c.c....', '...c.c.....', '....c.c....', '.kkkkkkkkk.', 'kNnnnnnnnNk', '.kNnnnnnNk.', '.kNnnnnnNk.', '..kNnnnNk..', '...kkkkk...', '..r.o.r.o..', '...........']
  };
  const cache = {};
  function url(name) {
    if (cache[name]) return cache[name];
    const rows = MAPS[name], c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (C[r[x]]) { g.fillStyle = C[r[x]]; g.fillRect(x, y, 1, 1); } });
    return (cache[name] = c.toDataURL());
  }
  // <img class="pxi"> sized by its pixel map (CSS turns the width into HUD units).
  function img(name) {
    const rows = MAPS[name];
    return `<img class="pxi" alt="" src="${url(name)}" style="--w:${rows[0].length};--h:${rows.length}">`;
  }
  // Fill every element that has data-icon="name".
  function mount(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = img(el.dataset.icon); }); }
  function set(el, name) { if (el.dataset.icon !== name) { el.dataset.icon = name; el.innerHTML = img(name); } }
  return { img, mount, set, url };
})();
