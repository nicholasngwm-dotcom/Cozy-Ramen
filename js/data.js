'use strict';
/* Menu, ingredients and the world layout shared by every other file.
   The screen is 960x540. The world is one long strip: the serving room sits at x 0-960, then
   toppings and kitchen share x 960-2480 (their views overlap on the topping bins and bowl mat). */
const VW = 960, VH = 540;

/* Tares (the seasoning spooned in first) and broths. Every recipe names one of each. The kitchen has a crock or pot
   for each (the *_SLOTS lists). node: the level-road step that unlocks it (none = available from the start).
   short names: 5 letters at most, so they fit the label on a crock or pot. */
const TARES = {
  miso:  { name: 'Miso tare', short: 'MISO', c: '#93451f' },
  shoyu: { name: 'Shoyu tare', short: 'SHOYU', c: '#4a2010' },
  shio:  { name: 'Shio tare', short: 'SHIO', c: '#e6dcc4', node: 'shio' }
};
const BROTHS = {
  pork:    { name: 'Pork bone broth', short: 'PORK', c: '#c8792e', dark: '#8a4518', light: '#efb45e', mid: '#b0652a' },
  chicken: { name: 'Tori (chicken) broth', short: 'TORI', c: '#e8b850', dark: '#a8782a', light: '#fff0b0', mid: '#d0a040' },
  dashi:   { name: 'Dashi broth', short: 'DASHI', c: '#c89a5a', dark: '#7a5a30', light: '#f0d8a0', mid: '#a8804a', node: 'seaside' },
  // the two story broths: a deep red dragonbone stock, and a pale spirit dashi with sparks drifting in it
  dragon:  { name: 'Dragonbone broth', short: 'BONE', c: '#b8402a', dark: '#6e1a12', light: '#ff9a5a', mid: '#962e1e', node: 'dragon' },
  spirit:  { name: 'Spirit dashi', short: 'SPIRIT', c: '#cfd8c8', dark: '#8a9a8e', light: '#ffffff', mid: '#b4c4b8', node: 'fox' }
};
const TARE_SLOTS = ['miso', 'shoyu', 'shio'];
const BROTH_SLOTS = ['pork', 'chicken', 'dashi', 'dragon', 'spirit'];
const tareKey = k => 'tare.' + k, brothKey = k => 'broth.' + k;   // their ids in G.stock / STOCK / jobs

/* The 26 ramen the shop can learn, in three tiers (a topping at 2 counts as 2):
   basic: 3 toppings, 10-12G, the everyday menu; unique: 4 toppings, 13-15G, the regional bowls; premium: 5 toppings,
   16-22G, showpiece bowls with at least one special step. Recipes that share a tare and broth never share the same
   toppings. The price is the bowl as listed; a guest who asks for extra toppings pays each extra too (TOP_PRICE).
   short: what slips, tickets and the menu board print (8 letters at most, or two words that wrap at the space).
   node: the road stop that unlocks the recipe (none = known from day one). Flags: spicy (the broth is made spicy with
   chili oil from the bottle, right after the broth: it is part of the base, like the tare and broth), cold (served chilled: the noodles go
   through the ice bath), night (only ordered after dark), strict (every special step must be perfect).
   Knowing a recipe is not the same as selling it: the shop's menu (G.menu) holds 8 of them, 10 with the menu board
   upgrades, and the player chooses which (see menuSlots and the menu editor in game.js). Special steps are in game.js. */
const MENU = {
  // ---- basic ----
  miso:      { name: 'Miso Ramen', short: 'MISO', c: '#d98a2b', price: 12, tier: 'basic', tare: 'miso', broth: 'pork',
               desc: 'Rich, nutty miso broth over springy noodles. Gentle and warming.',
               tops: { chashu: 1, egg: 1, scallion: 1 } },
  shoyu:     { name: 'Shoyu Ramen', short: 'SHOYU', c: '#7a3a1a', price: 12, tier: 'basic', tare: 'shoyu', broth: 'chicken',
               desc: 'Clear chicken broth seasoned with dark soy. A classic.',
               tops: { chashu: 1, menma: 1, nori: 1 } },
  shio:      { name: 'Shio Ramen', short: 'SHIO', c: '#4a7a9a', price: 11, tier: 'basic', tare: 'shio', broth: 'chicken', node: 'shio',
               desc: 'Light, golden and salty-clean, with pale chicken chashu and soft wakame.',
               tops: { torichashu: 1, wakame: 1, scallion: 1 } },
  spicy:     { name: 'Spicy Miso', short: 'SPICY', c: '#c8302a', price: 12, tier: 'basic', tare: 'miso', broth: 'pork', node: 'spicy', spicy: true,
               desc: 'Our miso broth turned red with chili oil, and a tangle of fiery chili threads on top.',
               tops: { chashu: 1, scallion: 1, chili: 1 } },
  traveller: { name: "Traveller's Bowl", short: 'TRAVELER', c: '#a8743a', price: 10, tier: 'basic', tare: 'shoyu', broth: 'pork', node: 'traveller',
               desc: 'Cheap, filling and quick. Adventurers order these by the dozen.',
               tops: { chashu: 1, moyashi: 1, egg: 1 } },
  garden:    { name: 'Garden Miso', short: 'GARDEN', c: '#6aa040', price: 11, tier: 'basic', tare: 'miso', broth: 'chicken', node: 'garden',
               desc: 'A meat-free miso full of greens, sprouts and sweet corn from the vale.',
               tops: { bokchoy: 1, moyashi: 1, corn: 1 } },
  tonkotsu:  { name: 'Tonkotsu', short: 'TONKOTSU', c: '#b8905a', price: 12, tier: 'basic', tare: 'shio', broth: 'pork', node: 'tonkotsu',
               desc: 'Creamy pork bone broth with chashu and a heap of red pickled ginger.',
               tops: { chashu: 1, benishoga: 1, scallion: 1 } },
  seaside:   { name: 'Seaside Dashi', short: 'SEASIDE', c: '#2f7a8a', price: 11, tier: 'basic', tare: 'shio', broth: 'dashi', node: 'seaside',
               desc: 'Delicate fish and kelp broth from the harbour towns.',
               tops: { naruto: 1, nori: 1, scallion: 1 } },
  // ---- unique ----
  yuzu:      { name: 'Blossom Shio', short: 'BLOSSOM', c: '#e88aa8', price: 13, tier: 'unique', tare: 'shio', broth: 'chicken', node: 'yuzu',
               desc: 'The prettiest bowl in the vale: sunpetals and yuzu peel on a clear shio. A blossom-festival favourite.',
               tops: { torichashu: 1, sunpetal: 1, yuzupeel: 1, wakame: 1 } },
  mandrake:  { name: 'Mandrake Shoyu', short: 'MANDRAKE', c: '#9a7a4a', price: 13, tier: 'unique', tare: 'shoyu', broth: 'chicken', node: 'mandrake',
               desc: 'Crunchy mandrake root sliced thin over shoyu. It squeaks when you slice it. Do not worry about it.',
               tops: { mandrake: 1, egg: 1, menma: 1, scallion: 1 } },
  kyoto:     { name: 'Lantern Shoyu', short: 'LANTERN', c: '#5a2a18', price: 14, tier: 'unique', tare: 'shoyu', broth: 'chicken', node: 'kyoto',
               desc: 'Dark shoyu buried in green onion, with glowcaps that shine softly after dark.',
               tops: { glowcap: 1, scallion: 2, chashu: 1 } },
  hakata:    { name: 'Hakata Red', short: 'HAKATA', c: '#c8503a', price: 14, tier: 'unique', tare: 'shio', broth: 'pork', node: 'hakata',
               desc: 'Bold and garlicky: milky pork broth, red ginger, wood ear and crisp garlic chips.',
               tops: { chashu: 1, benishoga: 1, kikurage: 1, garlicchip: 1 } },
  butter:    { name: 'Canal Butter Corn', short: 'BUTTER CORN', c: '#c89a18', price: 14, tier: 'unique', tare: 'miso', broth: 'pork', node: 'butter',
               desc: 'Canal-side miso with sweet corn and a pat of butter. Serve it before the butter melts away.',
               tops: { corn: 1, butter: 1, chashu: 1, menma: 1 } },
  tantan:    { name: 'Market Tantanmen', short: 'TANTAN', c: '#d0502a', price: 15, tier: 'unique', tare: 'miso', broth: 'chicken', node: 'tantan', spicy: true,
               desc: 'Chili-oil miso broth with spicy minced pork and fresh-ground sesame. Nutty, hot and sweat-inducing.',
               tops: { minced: 1, chili: 1, bokchoy: 1, sesame: 1 } },
  hiyashi:   { name: 'Frostleaf Hiyashi', short: 'HIYASHI', c: '#4aa8c8', price: 15, tier: 'unique', tare: 'shoyu', broth: 'dashi', node: 'hiyashi', cold: true,
               desc: 'Cold ramen for hot days: noodles rinsed in the ice bath, frostleaf, shrimp and egg on chilled dashi.',
               tops: { frostleaf: 1, shrimp: 1, egg: 1, nori: 1 } },
  forest:    { name: 'Glowcap Forest Miso', short: 'FOREST', c: '#4a6a3a', price: 14, tier: 'unique', tare: 'miso', broth: 'chicken', node: 'forest',
               desc: 'A meat-free bowl of three mushrooms and bok choy. It glows a little in the dark.',
               tops: { glowcap: 1, shiitake: 1, bokchoy: 1, kikurage: 1 } },
  tokyo:     { name: 'Neon Shoyu', short: 'NEON', c: '#8a4a28', price: 14, tier: 'unique', tare: 'shoyu', broth: 'dashi', node: 'tokyo',
               desc: 'Classic city ramen: soy and fish broth with a naruto swirl.',
               tops: { naruto: 1, menma: 1, nori: 1, chashu: 1 } },
  clam:      { name: 'Clam Shio', short: 'CLAM', c: '#3a8ab0', price: 15, tier: 'unique', tare: 'shio', broth: 'dashi', node: 'clam',
               desc: "The fishers' lunch: little clams, yuzu peel and wakame in a clean sea-salt dashi.",
               tops: { clam: 1, yuzupeel: 1, scallion: 1, wakame: 1 } },
  // ---- premium ----
  feast:     { name: 'Feast Bowl', short: 'FEAST', c: '#b04a2a', price: 17, tier: 'premium', tare: 'shoyu', broth: 'pork', node: 'feast',
               desc: 'What the party orders after a big win: braised pork belly and chashu, piled high.',
               tops: { kakuni: 1, chashu: 1, egg: 1, menma: 1, nori: 1 } },
  garlic:    { name: 'Black Garlic Tonkotsu', short: 'GARLIC', c: '#3a3036', price: 17, tier: 'premium', tare: 'shio', broth: 'pork', node: 'garlic',
               desc: 'Rich tonkotsu swirled with smoky black garlic oil and a torched chashu.',
               tops: { mayu: 1, chashu: 1, egg: 1, kikurage: 1, scallion: 1 } },
  golden:    { name: 'Golden Cockatrice', short: 'GOLDEN', c: '#e8b830', price: 18, tier: 'premium', tare: 'shio', broth: 'chicken', node: 'golden',
               desc: 'A giant cockatrice egg, halved to show its golden yolk. Only as many as the eggs last.',
               tops: { cockegg: 1, torichashu: 1, butter: 1, corn: 1, scallion: 1 } },
  wyvern:    { name: 'Wyvern Tonkotsu', short: 'WYVERN', c: '#7a2a2a', price: 19, tier: 'premium', tare: 'shio', broth: 'pork', node: 'wyvern',
               desc: "Smoky wyvern chashu, torched at the counter, with ginger and garlic chips. Leona's favourite.",
               tops: { wyvern: 1, benishoga: 1, garlicchip: 1, egg: 1, scallion: 1 } },
  kraken:    { name: 'Kraken King', short: 'KRAKEN', c: '#8a4a8a', price: 20, tier: 'premium', tare: 'miso', broth: 'dashi', node: 'kraken',
               desc: 'A coastal feast: torched kraken tentacle, clams and shrimp in buttery miso dashi.',
               tops: { kraken: 1, clam: 1, shrimp: 1, butter: 1, nori: 1 } },
  fox:       { name: "Fox's Moonlight Bowl", short: 'MOONLIGHT', c: '#6a7ab8', price: 18, tier: 'premium', tare: 'shio', broth: 'spirit', node: 'fox', night: true,
               desc: 'Night only. Sweet fried tofu, the old fox offering, on glowing spirit dashi. The first bowl Aoi ever ordered.',
               tops: { aburaage: 1, naruto: 1, yuzupeel: 1, sunpetal: 1, scallion: 1 } },
  hiro:      { name: "Hiro's House Ramen", short: 'HOUSE', c: '#c87a2a', price: 20, tier: 'premium', tare: 'miso', broth: 'pork', node: 'hiro', strict: true,
               desc: 'The classic, done perfectly: every special step must be perfect. It looks like the old starter bowl, which is the point.',
               tops: { chashu: 1, egg: 1, scallion: 1, menma: 1, nori: 1 } },
  dragon:    { name: "Dragon's Fire", short: 'DRAGON', c: '#a01e3a', price: 22, tier: 'premium', tare: 'shoyu', broth: 'dragon', node: 'dragon',
               desc: "The bowl you cook for the dragon: dragonbone broth, torched wyvern and a double pour of ember pepper oil. Hiro's last page.",
               tops: { wyvern: 1, emberpep: 2, egg: 1, scallion: 1 } }
};
const TIER_NAME = { basic: 'Basic', unique: 'Unique', premium: 'Premium' };
// Recipes with a meat that gets torched at the counter (a special step: see game.js), and the meats a torch works on.
const TORCH_RECIPES = ['garlic', 'wyvern', 'kraken', 'dragon'];
const TORCH_MEATS = ['chashu', 'wyvern', 'kraken'];
// The menu the shop sells from: up to menuSlots() of the known recipes, in the player's order (see game.js).
const MENU_BASE = 8;
const menuSlots = () => MENU_BASE + (gearOn('board9') ? 1 : 0) + (gearOn('board10') ? 1 : 0);
// Toppings that need a road stop before they can be stocked and used (the first recipe that uses each).
const TOP_NODE = {
  chili: 'spicy', moyashi: 'traveller', bokchoy: 'garden', corn: 'garden', torichashu: 'shio', wakame: 'shio', sunpetal: 'yuzu', yuzupeel: 'yuzu',
  mandrake: 'mandrake', benishoga: 'tonkotsu', naruto: 'seaside', glowcap: 'kyoto', kikurage: 'hakata', garlicchip: 'hakata', butter: 'butter',
  minced: 'tantan', sesame: 'tantan', frostleaf: 'hiyashi', shrimp: 'hiyashi', shiitake: 'forest', kakuni: 'feast', mayu: 'garlic', wyvern: 'wyvern',
  clam: 'clam', kraken: 'kraken', cockegg: 'golden', aburaage: 'fox', emberpep: 'dragon'
};

/* The Ramen Road. The journey runs through five provinces. It is XP only: the moment you reach a stop's level
   (XP from serving and daily quests) it unlocks on its own. Recipe stops add a ramen, upgrade stops put a tool on
   sale at Kitsune-ya, landmark stops give gold and a decoration for the shop. Finishing a province's landmark opens
   the next one, where you can move the shop. (cost = the tool's price at the night shop, for upgrade stops.)
   ids of the recipe/upgrade stops are the unlock ids the rest of the game checks with owns(); a recipe stop's id is
   its MENU key. LEVEL_XP[i] = total XP needed to reach level i + 1. */
// Exponential: each level costs 20% more XP than the one before (50, 60, 70, 85 ... 1330 for the last), so the first
// levels come quickly and the late road takes real work.
const XP_FIRST = 50, XP_GROWTH = 1.2;
const LEVEL_XP = Array.from({ length: 20 }, (_, i) => { let t = 0; for (let k = 0; k < i; k++) t += Math.round(XP_FIRST * XP_GROWTH ** k / 5) * 5; return t; });
const REGIONS = [
  { id: 'sakura', name: 'Blossom Vale',  short: 'Blossom', c: '#e88aa8' },
  { id: 'kyoto',  name: 'Lantern City',  short: 'Lantern', c: '#c8443a' },
  { id: 'osaka',  name: 'Canal Market',  short: 'Canal',   c: '#e8902a' },
  { id: 'tokyo',  name: 'Neon Capital',  short: 'Neon',    c: '#c060e0' },
  { id: 'coast',  name: 'Ember Coast',   short: 'Ember',   c: '#3a9ab8' }
];
const ROAD_NAME = 'Ramen Road';
// goal kinds: served / perfect (bowls, lifetime), sold (bowls of one ramen), met (guests), bestDay (gold in one day), days
const STOPS = [
  // Blossom Vale (levels 1-4)
  { id: 'home',      region: 0, level: 1,  cost: 0,   kind: 'start',   place: 'Hanami Village', name: 'Your first shop', desc: 'Where the journey begins: a little ramen stall under the blossom trees.' },
  { id: 'shio',      region: 0, level: 2,  cost: 0,   kind: 'recipe',  place: 'Salt Spring Inn', menu: 'shio', name: 'Shio Ramen', also: 'Shio tare, chicken chashu, wakame' },
  { id: 'spicy',     region: 0, level: 2,  cost: 0,   kind: 'recipe',  place: 'Chili Farm', menu: 'spicy', name: 'Spicy Miso', also: 'Chili topping' },
  { id: 'quick',     region: 0, level: 3,  cost: 60,  kind: 'upgrade', place: 'Rice Terraces', name: 'Waiting Bench', desc: 'Up to five guests wait in line instead of three.' },
  { id: 'traveller', region: 0, level: 3,  cost: 0,   kind: 'recipe',  place: 'Crossroads Shrine', menu: 'traveller', name: "Traveller's Bowl", also: 'Bean sprouts' },
  { id: 'garden',    region: 0, level: 3,  cost: 0,   kind: 'recipe',  place: 'Temple Garden', menu: 'garden', name: 'Garden Miso', also: 'Bok choy, corn' },
  { id: 'yuzu',      region: 0, level: 4,  cost: 0,   kind: 'recipe',  place: 'Sunpetal Meadow', menu: 'yuzu', name: 'Blossom Shio', also: 'Sunpetals, yuzu peel' },
  { id: 'mandrake',  region: 0, level: 4,  cost: 0,   kind: 'recipe',  place: 'Root Witch’s Plot', menu: 'mandrake', name: 'Mandrake Shoyu', also: 'Mandrake root' },
  { id: 'sakuraLm',  region: 0, level: 4,  cost: 0,   kind: 'landmark', place: 'Cherry Blossom Hill', name: 'Blossom branch', deco: 0, gold: 60, desc: 'A sprig of blossom for the shop, and the road to Lantern City.' },
  // Lantern City (levels 4-8)
  { id: 'tonkotsu',  region: 1, level: 5,  cost: 0,   kind: 'recipe',  place: 'Thousand Gates', menu: 'tonkotsu', name: 'Tonkotsu', also: 'Red pickled ginger' },
  { id: 'bins',      region: 1, level: 5,  cost: 120, kind: 'upgrade', place: 'Bamboo Grove', name: 'Bulk Crates', desc: 'Every pack from Kitsune-ya holds half as much again.' },
  { id: 'seaside',   region: 1, level: 6,  cost: 0,   kind: 'recipe',  place: 'River Fish Market', menu: 'seaside', name: 'Seaside Dashi', also: 'Dashi broth, naruto' },
  { id: 'stall5',    region: 1, level: 6,  cost: 150, kind: 'upgrade', place: 'Lantern Market', name: 'Stall 5', desc: 'Opens a fifth stall at the counter: room for one more guest.' },
  { id: 'kyoto',     region: 1, level: 7,  cost: 0,   kind: 'recipe',  place: 'Glowcap Caves', menu: 'kyoto', name: 'Lantern Shoyu', also: 'Glowcaps' },
  { id: 'hakata',    region: 1, level: 7,  cost: 0,   kind: 'recipe',  place: 'Night Yatai Row', menu: 'hakata', name: 'Hakata Red', also: 'Wood ear, garlic chips' },
  { id: 'caddy',     region: 1, level: 7,  cost: 140, kind: 'upgrade', place: 'Spice Merchant Row', name: 'Garnish Caddy', desc: 'Spring onion and nori sprinkle themselves in when the noodles go into a bowl that needs them.' },
  { id: 'kyotoLm',   region: 1, level: 8,  cost: 0,   kind: 'landmark', place: 'Lantern Street', name: 'Red paper lantern', deco: 1, gold: 120, desc: 'A city lantern for the shop, and the road to Canal Market.' },
  // Canal Market (levels 8-12)
  { id: 'butter',    region: 2, level: 8,  cost: 0,   kind: 'recipe',  place: 'Canal Lights', menu: 'butter', name: 'Canal Butter Corn', also: 'Butter' },
  { id: 'boil',      region: 2, level: 9,  cost: 200, kind: 'upgrade', place: 'Fishmonger Row', name: 'Fast Boil', desc: 'Noodles cook in 4 seconds instead of 6.' },
  { id: 'tantan',    region: 2, level: 9,  cost: 0,   kind: 'recipe',  place: 'Sesame Mill', menu: 'tantan', name: 'Market Tantanmen', also: 'Minced pork, sesame (and the grinder)' },
  { id: 'stall6',    region: 2, level: 10, cost: 220, kind: 'upgrade', place: 'New World Arcade', name: 'Stall 6', desc: 'Opens a sixth stall at the counter: room for one more guest.' },
  { id: 'hiyashi',   region: 2, level: 10, cost: 0,   kind: 'recipe',  place: 'Frost Traders’ Wharf', menu: 'hiyashi', name: 'Frostleaf Hiyashi', also: 'Frostleaf, shrimp (and the ice bath)' },
  { id: 'board9',    region: 2, level: 11, cost: 200, kind: 'upgrade', place: 'Signwright’s Lane', name: 'Menu Board Plank', desc: 'A ninth slot on your menu: sell one more ramen at a time.' },
  { id: 'osakaLm',   region: 2, level: 12, cost: 0,   kind: 'landmark', place: 'Canal Castle', name: 'Food stall banner', deco: 2, gold: 160, desc: 'A street-food banner for the shop, and the road to the Neon Capital.' },
  // Neon Capital (levels 12-16)
  { id: 'tips',      region: 3, level: 12, cost: 260, kind: 'upgrade', place: 'Neon Crossing', name: 'Generous Tips', desc: 'Perfect bowls earn 3G more in tips.' },
  { id: 'akibaLm',   region: 3, level: 12, cost: 0,   kind: 'landmark', place: 'Electric Town', name: 'Arcade prize', gold: 150, desc: 'A bag of arcade tokens, cashed in for gold.' },
  { id: 'forest',    region: 3, level: 13, cost: 0,   kind: 'recipe',  place: 'Sunken Park', menu: 'forest', name: 'Glowcap Forest Miso', also: 'Shiitake' },
  { id: 'stall7',    region: 3, level: 13, cost: 300, kind: 'upgrade', place: 'Old Temple Gate', name: 'Stall 7', desc: 'Opens a seventh stall at the counter: room for one more guest.' },
  { id: 'tokyo',     region: 3, level: 14, cost: 0,   kind: 'recipe',  place: 'Old Town Street', menu: 'tokyo', name: 'Neon Shoyu' },
  { id: 'feast',     region: 3, level: 14, cost: 0,   kind: 'recipe',  place: 'Guild Hall', menu: 'feast', name: 'Feast Bowl', also: 'Kakuni (braised pork belly)' },
  { id: 'garlic',    region: 3, level: 15, cost: 0,   kind: 'recipe',  place: 'Garlic Smokehouse', menu: 'garlic', name: 'Black Garlic Tonkotsu', also: 'Mayu (black garlic oil)' },
  { id: 'wyvern',    region: 3, level: 15, cost: 0,   kind: 'recipe',  place: 'Hunters’ Guild', menu: 'wyvern', name: 'Wyvern Tonkotsu', also: 'Wyvern chashu' },
  { id: 'tokyoLm',   region: 3, level: 16, cost: 0,   kind: 'landmark', place: 'Neon Spire', name: 'Neon ramen sign', deco: 3, gold: 200, desc: 'A buzzing neon sign for the shop, and the road to the Ember Coast.' },
  // Ember Coast (levels 16-20)
  { id: 'clam',      region: 4, level: 16, cost: 0,   kind: 'recipe',  place: 'Clam Flats', menu: 'clam', name: 'Clam Shio', also: 'Clams' },
  { id: 'kraken',    region: 4, level: 17, cost: 0,   kind: 'recipe',  place: 'Fishers’ Wharf', menu: 'kraken', name: 'Kraken King', also: 'Kraken tentacle' },
  { id: 'golden',    region: 4, level: 17, cost: 0,   kind: 'recipe',  place: 'Golden Beach', menu: 'golden', name: 'Golden Cockatrice', also: 'Cockatrice eggs (a few a night at Kitsune-ya)' },
  { id: 'stall8',    region: 4, level: 18, cost: 400, kind: 'upgrade', place: 'Great Buddha Cove', name: 'Stall 8', desc: 'Opens the eighth and last stall at the counter.' },
  { id: 'fox',       region: 4, level: 18, cost: 0,   kind: 'recipe',  place: 'Fox Shrine at Moonrise', menu: 'fox', name: "Fox's Moonlight Bowl", also: 'Spirit dashi, aburaage' },
  { id: 'board10',   region: 4, level: 19, cost: 350, kind: 'upgrade', place: 'Lantern Workshop', name: 'Grand Menu Board', desc: 'A tenth slot on your menu: sell one more ramen at a time.' },
  { id: 'hiro',      region: 4, level: 19, cost: 0,   kind: 'recipe',  place: 'Hiro’s Old Stall', menu: 'hiro', name: "Hiro's House Ramen" },
  { id: 'dragon',    region: 4, level: 20, cost: 0,   kind: 'recipe',  place: 'Dragon’s Peak', menu: 'dragon', name: "Dragon's Fire", also: 'Dragonbone broth, ember pepper' },
  { id: 'harborLm',  region: 4, level: 20, cost: 0,   kind: 'landmark', place: 'Fishing Harbour', name: 'Fisher’s thanks', gold: 250, desc: 'The harbour cooks pay you a visit, and their respects.' },
  { id: 'lightLm',   region: 4, level: 20, cost: 0,   kind: 'landmark', place: 'Lighthouse Point', name: 'Lighthouse lamp', gold: 300, desc: 'The keeper trades a lamp for a bowl.' },
  { id: 'endLm',     region: 4, level: 20, cost: 0,   kind: 'landmark', place: 'Journey’s End', name: 'Glass fishing float', deco: 4, gold: 500, desc: 'The end of the road: a glass float for the shop, and a famous name across the land.' }
];
const NODES = STOPS.filter(s => s.kind === 'recipe' || s.kind === 'upgrade');   // the stops that unlock something in the shop

// What the player owns right now (reads the live game state; safe to call before it exists).
const owns = id => !id || !!(typeof window !== 'undefined' && window.G && G.owned && G.owned.includes(id));
const menuOn = k => owns(MENU[k].node), tareOn = k => owns(TARES[k].node), brothOn = k => owns(BROTHS[k].node), topOn = id => owns(TOP_NODE[id]);
const nodeFor = id => STOPS.find(n => n.id === id);
const levelFor = node => (nodeFor(node) || { level: 1 }).level;   // the level a locked thing opens at
// Road progress (reads the live game state).
const stopDone = s => s.kind === 'start' || owns(s.id);
const frontierIdx = () => STOPS.findIndex(s => !stopDone(s));     // the next stop on the road; -1 once the journey is complete
const regionEnd = r => STOPS.filter(s => s.region === r).pop();
const regionOpen = r => r === 0 || STOPS.some(s => s.region === r && s.kind !== 'start' && stopDone(s)) || stopDone(regionEnd(r - 1));
const goalHave = g => {
  if (!g || typeof window === 'undefined' || !window.G) return 0;
  const L = G.life || {};
  if (g.k === 'served') return L.served || 0;
  if (g.k === 'perfect') return L.perfect || 0;
  if (g.k === 'sold') return (L.sold || {})[g.type] || 0;
  if (g.k === 'met') return (G.met || []).length;
  if (g.k === 'bestDay') return Math.max(L.bestDay || 0, (G.stats && G.stats.earned) || 0);
  if (g.k === 'days') return L.days || 0;
  return 0;
};
const goalText = g => !g ? '' : g.k === 'served' ? `Serve ${g.n} bowls` : g.k === 'perfect' ? `Serve ${g.n} perfect bowls`
  : g.k === 'sold' ? `Serve ${g.n} ${MENU[g.type].name}` : g.k === 'met' ? `Meet ${g.n} different guests`
  : g.k === 'bestDay' ? `Earn ${g.n}G in one day` : `Run the shop for ${g.n} days`;
// The next stop unlocks as soon as its level is reached.
const stopReady = s => { const i = STOPS.indexOf(s); return i === frontierIdx() && !!window.G && G.level >= s.level; };

/* Every topping (33): the twelve everyday ones, then the new real ingredients, then the fantasy ones (rare, and late).
   TOP_PRICE: what a guest pays for each extra portion they ask for (on top of the bowl's price). The toppings a recipe
   already has are in its price: they never add to the bill. Removing a topping never makes a bowl cheaper. */
const TOPS = ['chashu', 'egg', 'nori', 'scallion', 'menma', 'chili', 'corn', 'butter', 'moyashi', 'bokchoy', 'kikurage', 'naruto',
  'torichashu', 'wakame', 'benishoga', 'yuzupeel', 'minced', 'garlicchip', 'sesame', 'aburaage', 'kakuni', 'shiitake', 'clam', 'shrimp', 'mayu',
  'sunpetal', 'mandrake', 'glowcap', 'frostleaf', 'emberpep', 'kraken', 'cockegg', 'wyvern'];
const FANTASY = ['sunpetal', 'mandrake', 'glowcap', 'frostleaf', 'emberpep', 'kraken', 'cockegg', 'wyvern'];
const TOP_NAME = { chashu: 'Chashu', egg: 'Ramen egg', nori: 'Nori', scallion: 'Spring onion', menma: 'Bamboo shoots', chili: 'Chili', corn: 'Corn', butter: 'Butter',
  moyashi: 'Bean sprouts', bokchoy: 'Bok choy', kikurage: 'Wood ear', naruto: 'Naruto',
  torichashu: 'Chicken chashu', wakame: 'Wakame', benishoga: 'Red ginger', yuzupeel: 'Yuzu peel', minced: 'Minced pork', garlicchip: 'Garlic chips',
  sesame: 'Sesame', aburaage: 'Aburaage', kakuni: 'Kakuni', shiitake: 'Shiitake', clam: 'Clams', shrimp: 'Shrimp', mayu: 'Black garlic oil',
  sunpetal: 'Sunpetal', mandrake: 'Mandrake root', glowcap: 'Glowcap', frostleaf: 'Frostleaf', emberpep: 'Ember pepper', kraken: 'Kraken tentacle',
  cockegg: 'Cockatrice egg', wyvern: 'Wyvern chashu' };
// Names short enough for a bin label and an order slip line (8 letters at most).
const TOP_SHORT = { chashu: 'CHASHU', egg: 'EGG', nori: 'NORI', scallion: 'SCALLION', menma: 'BAMBOO', chili: 'CHILI', corn: 'CORN', butter: 'BUTTER', moyashi: 'SPROUTS', bokchoy: 'BOK CHOY', kikurage: 'WOOD EAR', naruto: 'NARUTO',
  torichashu: 'CHICKEN', wakame: 'WAKAME', benishoga: 'GINGER', yuzupeel: 'YUZU', minced: 'MINCE', garlicchip: 'GARLIC', sesame: 'SESAME', aburaage: 'ABURAAGE', kakuni: 'KAKUNI', shiitake: 'SHIITAKE',
  clam: 'CLAMS', shrimp: 'SHRIMP', mayu: 'MAYU', sunpetal: 'SUNPETAL', mandrake: 'MANDRAKE', glowcap: 'GLOWCAP', frostleaf: 'FROST', emberpep: 'EMBER', kraken: 'KRAKEN', cockegg: 'GOLD EGG', wyvern: 'WYVERN' };
// Bin labels: the kitchen prints each name under its bin in the 5x7 pixel font, and a bin is 44px wide (42px of text).
// Names too wide for that get a short form here (the hint bar shows the full name while the bin is hovered).
const TOP_BIN = { scallion: 'SCALL.', bokchoy: 'BOK CH.', kikurage: 'WD EAR', aburaage: 'ABURA.', shiitake: 'SHIITA.',
  sunpetal: 'SUNPET.', mandrake: 'MANDR.', cockegg: 'G. EGG' };
const binName = id => TOP_BIN[id] || TOP_SHORT[id];
const TOP_DESC = {
  chashu: 'Slow-braised pork belly', egg: 'Soft egg marinated in soy', nori: 'Toasted seaweed sheet', scallion: 'Fresh sliced spring onion',
  menma: 'Seasoned bamboo shoots', chili: 'Fiery chili threads', corn: 'Sweet butter corn', butter: 'A melting pat of butter',
  moyashi: 'Crunchy blanched bean sprouts', bokchoy: 'Tender baby bok choy', kikurage: 'Crisp wood ear mushroom', naruto: 'A fish cake with a pink swirl',
  torichashu: 'Pale, tender sliced chicken breast', wakame: 'Soft green seaweed ribbons', benishoga: 'Bright red pickled ginger', yuzupeel: 'Curls of fragrant citrus zest',
  minced: 'Spicy ground pork, fried until crumbly', garlicchip: 'Thin golden slices of fried garlic', sesame: 'Toasted sesame seeds, ground at the counter',
  aburaage: 'Sweet fried tofu pouch, the old fox offering', kakuni: 'A glossy cube of braised pork belly', shiitake: 'Brown mushroom caps with a cross cut',
  clam: 'Little asari clams in the shell', shrimp: 'Whole cooked shrimp', mayu: 'Smoky black garlic oil, poured in a swirl',
  sunpetal: 'An edible meadow flower, faintly sweet', mandrake: 'Crunchy root, sliced thin. It squeaks', glowcap: 'A mushroom that glows softly after dark',
  frostleaf: 'A cooling herb from the mountain passes', emberpep: 'A pepper that keeps smouldering. Poured as oil', kraken: 'Thick-cut grilled tentacle',
  cockegg: 'A huge egg with a golden yolk', wyvern: 'Smoky dark wyvern meat with a charred edge'
};
// Extra-topping prices: 1G garnishes, 2G everyday toppings, 3G meat and seafood, 4G fantasy ingredients.
const TOP_PRICE = { chashu: 3, egg: 2, nori: 1, scallion: 1, menma: 2, chili: 2, corn: 2, butter: 2, moyashi: 1, bokchoy: 2, kikurage: 2, naruto: 2,
  torichashu: 3, wakame: 1, benishoga: 1, yuzupeel: 1, minced: 3, garlicchip: 1, sesame: 1, aburaage: 2, kakuni: 3, shiitake: 2, clam: 3, shrimp: 3, mayu: 3,
  sunpetal: 4, mandrake: 4, glowcap: 4, frostleaf: 4, emberpep: 4, kraken: 4, cockegg: 4, wyvern: 4 };
const extraPrice = id => TOP_PRICE[id] || 2;
/* Toppings a guest may ask to add to any bowl (when the kitchen has them on its rack). The rest (chili and the poured
   oils, the fantasy ingredients, the special meats and seafood) are only asked for on recipes that already have them. */
const EXTRA_OK = ['chashu', 'egg', 'nori', 'scallion', 'menma', 'corn', 'butter', 'moyashi', 'bokchoy', 'kikurage', 'naruto',
  'torichashu', 'wakame', 'benishoga', 'garlicchip', 'sesame', 'shiitake', 'kakuni'];

// add: portions in one pack bought at Kitsune-ya (cap / time are left over from kitchen prep and no longer used)
const STOCK = { noodle: { cap: 12, add: 6, time: 6, label: 'NOODLES' } };
for (const id of TOPS) STOCK[id] = { cap: 10, add: 5, time: 4 };
STOCK.cockegg.add = 2;   // cockatrice eggs come two to a pack
for (const k in TARES) STOCK[tareKey(k)] = { cap: 16, add: 8, time: 7, label: TARES[k].short, ...TARES[k].stock };
for (const k in BROTHS) STOCK[brothKey(k)] = { cap: 16, add: 8, time: 12, label: BROTHS[k].short, ...BROTHS[k].stock };
const MAX_PASS = 4;
// Chili oil: a bottle in the kitchen that makes a bowl's broth spicy (Spicy Miso, Market Tantanmen). Bought like a tare.
const CHILI_OIL = 'chilioil';
STOCK[CHILI_OIL] = { cap: 16, add: 8, time: 6, label: 'CHILI OIL' };
const chiliOilOn = () => owns('spicy');

/* The kitchen's topping rack: 24 lacquered bins (eight to a row, three rows). It holds every topping the menu needs,
   in TOPS order, then fills the free bins with other toppings you have unlocked that guests like as extras. So the
   menu can only need 24 different toppings (the menu editor says so when a dish would not fit). */
const RACK = 24;
// the ice bath (for cold ramen) is in the kitchen once a cold recipe is learned
const iceOn = () => Object.keys(MENU).some(k => MENU[k].cold && menuOn(k));
const menuTops = menu => { const s = new Set(); for (const k of menu) if (MENU[k]) for (const id in MENU[k].tops) s.add(id); return TOPS.filter(id => s.has(id)); };
function rackTops() {
  const need = menuTops((typeof window !== 'undefined' && window.G && G.menu) || ['miso']);
  const fill = EXTRA_OK.filter(id => !need.includes(id) && topOn(id)).slice(0, Math.max(0, RACK - need.length));
  return TOPS.filter(id => need.includes(id) || fill.includes(id)).slice(0, RACK);
}
// Guest affinity: every bowl you serve someone earns points (a perfect one earns double). Five ranks; from the second
// rank up, a guest adds a little extra to the tip for a perfect bowl (+1G per rank above the first).
const AFFINITY = [
  { at: 0, name: 'Stranger' }, { at: 3, name: 'Regular' }, { at: 8, name: 'Friend' }, { at: 15, name: 'Close friend' }, { at: 25, name: 'Family' }
];
const affLevel = pts => { let l = 0; AFFINITY.forEach((a, i) => { if ((pts || 0) >= a.at) l = i; }); return l; };   // 0-based
const affNext = pts => { const l = affLevel(pts); return l >= AFFINITY.length - 1 ? null : AFFINITY[l + 1].at; };

/* Stock comes from Aoi's night supply shop across the street (js/nightshop.js), open SHOP_HOURS after closing:
   a pack bought there goes straight into the kitchen's bin, crock, pot or noodle tray (packSize portions, no cap).
   SUPPLY_PRICE: gold per pack. Equipment is the road's upgrade stops: the road unlocks them, the shop sells them
   (for the stop's cost), and they only work once bought (G.gear). */
const SHOP_HOURS = { open: 4, close: 15 };   // Kitsune-ya opens when the ramen shop fully closes (04:00) and stays open until 15:00
const SUPPLY_IDS = ['noodle', ...TOPS, ...Object.keys(TARES).map(tareKey), CHILI_OIL, ...Object.keys(BROTHS).map(brothKey)];
const SUPPLY_PRICE = { noodle: 4, chashu: 5, egg: 4, nori: 2, scallion: 2, menma: 3, chili: 3, corn: 3, butter: 4, moyashi: 2, bokchoy: 2, kikurage: 3, naruto: 3,
  torichashu: 5, wakame: 2, benishoga: 2, yuzupeel: 3, minced: 5, garlicchip: 2, sesame: 2, aburaage: 4, kakuni: 7, shiitake: 3, clam: 6, shrimp: 6, mayu: 5,
  sunpetal: 6, mandrake: 7, glowcap: 7, frostleaf: 7, emberpep: 8, kraken: 9, cockegg: 10, wyvern: 9 };
for (const k in TARES) SUPPLY_PRICE[tareKey(k)] = 4;
SUPPLY_PRICE[CHILI_OIL] = 4;
for (const k in BROTHS) SUPPLY_PRICE[brothKey(k)] = 6;
SUPPLY_PRICE[brothKey('dragon')] = 12; SUPPLY_PRICE[brothKey('spirit')] = 10;
const supplyName = id => id === CHILI_OIL ? 'Chili oil' : id === 'noodle' ? 'Fresh noodles' : TOP_NAME[id] || (id.startsWith('tare.') ? TARES[id.slice(5)].name : BROTHS[id.slice(6)].name);
const supplyOn = id => id === CHILI_OIL ? chiliOilOn() : id === 'noodle' || (TOPS.includes(id) ? topOn(id) : id.startsWith('tare.') ? tareOn(id.slice(5)) : brothOn(id.slice(6)));
const supplyNode = id => id === CHILI_OIL ? 'spicy' : TOP_NODE[id] || (id.startsWith('tare.') ? TARES[id.slice(5)].node : id.startsWith('broth.') ? BROTHS[id.slice(6)].node : null);
const GEAR = NODES.filter(s => s.kind === 'upgrade').map(s => s.id);
const gearOn = id => owns(id) && !!(typeof window !== 'undefined' && window.G && G.gear && G.gear.includes(id));
const claimCost = s => 0;   // the road costs nothing: XP unlocks it (upgrades are then bought at the night shop)
// values the equipment changes (once bought)
const packSize = id => Math.round(STOCK[id].add * (gearOn('bins') ? 1.5 : 1));   // portions in one pack from the shop
const cookTime = () => (gearOn('boil') ? 4 : 6);   // seconds until noodles are ready; ready noodles never overcook
const maxWait = () => (gearOn('quick') ? 5 : 3);   // guests who will queue for a stall
const perfectTip = () => (gearOn('tips') ? 7 : 4);
// Seats 1-4 are always open; seats 5-8 open once bought at Kitsune-ya (after the road unlocks them). (ids: stall5-8)
const stallOpen = i => i < 4 || gearOn('stall' + (i + 1));

// Two stations, both wide pages you pan along between cam and camMax (hold A / D or use the mouse wheel):
// the serving room (the staff door and stalls 1-4 at the left, where you start; 5-8 to the right) and the kitchen (toppings, then the cooking line).
const STATIONS = [
  { id: 'serving', name: 'Serving', cam: -960, camMax: 0 },   // starts at cam (the far left)
  { id: 'kitchen', name: 'Kitchen', cam: 960, camMax: 1520 }
];
const PAN_SPEED = 820;    // px per second while A / D is held
const EDGE = 46;          // width of the screen-edge zones that pan to the next station

// Toppings + kitchen (local x 0-1520, drawn at world x 960). Toppings view shows local 0-960, kitchen view 560-1520.
// Left to right: pass, recipe book + bin, topping bins over the bowl mat (seen from both views), tare crocks, broth range, noodle boiler.
const KL = {
  X0: 960, W: 1520,
  PASS: { x: 50, y: 52, w: 166, h: 244 },
  passPos: i => [96 + (i % 2) * 74, 240 + Math.floor(i / 2) * 24],   // on the serving tray in the pass window
  BOOK: { x: 286, y: 352, w: 116, h: 74 },
  TRASH: { x: 470, y: 440, w: 46, h: 58 },
  // stepped hinoki topping rack: three rows of eight bins right above the bowls (RACK = 24; see rackTops)
  bin: k => ({ x: 572 + 48 * (k % 8), y: 182 + 70 * Math.floor(k / 8), w: 44, h: 46 }),
  MAT: { x: 636, y: 386, w: 248, h: 112 },
  bowlX: [700, 820], BOWL_Y: 420,
  tare: i => ({ cx: 976 + 64 * i, y: 330 }),            // crock i: centre x, rim y
  pot: i => ({ cx: 1150 + 48 * i, cy: 340, rx: 21 }),    // broth pot i on the hearth (five smaller pots)
  ICE: { cx: 1030, cy: 452, rx: 40 },                   // the ice bath for cold ramen, on the counter in front of the crocks
  OIL: { cx: 1040, by: 240 },                           // the chili oil bottle, on the window sill above the crocks (by = its bottom)
  BOIL: { cx: 1440, cy: 352, rx: 66 }, basketX: [1398, 1440, 1482],
  NOODLE: { x: 1394, y: 226, w: 92, h: 40 },            // tray of noodle nests on the shelf above the boiler
  // where each stock's "+" restock button sits
  badge(id) {
    if (id === 'noodle') return [this.NOODLE.x - 14, this.NOODLE.y + 20];
    const tk = TARE_SLOTS.findIndex(k => k && tareKey(k) === id);
    if (tk >= 0) { const t = this.tare(tk); return [t.cx - 10, t.y - 14]; }
    const bk = BROTH_SLOTS.findIndex(k => k && brothKey(k) === id);
    if (bk >= 0) { const p = this.pot(bk); return [p.cx - 20, p.cy - 26]; }
    const b = this.bin(Math.max(0, rackTops().indexOf(id))); return [b.x + b.w - 13, b.y + b.h - 13];
  },
  SLIP_Y: 40
};

// Serving room: two screens wide (local x 0-1920, drawn at world x -960), seen from the chef's side of one long counter
// split into eight stalls, numbered 1-8 from left to right. The player starts at the far left: the staff door, then
// stalls 1-4 fill the first screen; stalls 5-8 continue to the right, towards the kitchen noren at the far end.
const SL = {
  X0: -960, W: 1920, OX: 960, COUNTER_Y: 348, BACK_Y: 330, NSTALL: 8, STALL_W: 180,
  stallX: i => 240 + 180 * i,
  stallCX: i => SL.stallX(i) + 90,
  LEFT: 240, RIGHT: 240 + 180 * 8,                   // the outer edges of the stall row
  DOOR: { x: 42, y: 93, w: 111, h: 237 }              // the staff door (local)
};
