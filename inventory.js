// ============================================================================
// Doodlebench — full material library.
// Every set carries a `type` (alcohol / pencil / gel / acrylic / ink) so tools
// can mix freely across materials and show the right contextual tips.
// White pens, blenders and burnishing/blending pencils live in `finishing`
// (a separate category — they're highlights/blending aids, not base color).
// Hex values are careful approximations from published swatch charts; brands
// rarely publish exact values, so a few are eyeballed and easy to hand-correct.
// ============================================================================

window.MATERIAL_TYPES = {
  alcohol: { label: "Alcohol marker", short: "Alcohol", glyph: "◖",
             blurb: "Blends wet-into-wet, layers light→dark, streak-free with a colorless blender." },
  pencil:  { label: "Colored pencil", short: "Pencil", glyph: "✎",
             blurb: "Layer light pressure first; burnish at the end to fuse and shine." },
  ink:     { label: "Ink pencil (water-soluble)", short: "Inktense", glyph: "💧",
             blurb: "Draw dry, then wash with water to turn it into vivid ink. Permanent once dry." },
  gel:     { label: "Acrylic gel pen", short: "Gel", glyph: "✦",
             blurb: "Opaque — sits on top, great on dark paper and for fine accents." },
  acrylic: { label: "Acrylic brush marker", short: "Acrylic", glyph: "▰",
             blurb: "Opaque and bold; lighter colors cover darker ones. Let layers dry." },
};

// ---------------------------------------------------------------------------
// SETS
// ---------------------------------------------------------------------------
window.SETS = [
  // ---- Ohuhu Honolulu 48 (alcohol) ----
  { id: "ohuhu", name: "Ohuhu Honolulu 48", short: "Ohuhu 48", type: "alcohol",
    colors: [
      { code:"Y07", name:"Banana Cream", hex:"#f5e19a" },
      { code:"Y111", name:"Mustard", hex:"#d9a72c" },
      { code:"Y26", name:"Light Gold", hex:"#f2d03a" },
      { code:"Y213", name:"Dark Marigold", hex:"#c66e3c" },
      { code:"Y216", name:"Caramel", hex:"#9d7541" },
      { code:"YR07", name:"Salmon Orange", hex:"#f5a580" },
      { code:"YR112", name:"Orange", hex:"#ef7a2e" },
      { code:"YR39", name:"Cinnamon", hex:"#d59a7a" },
      { code:"YR313", name:"Potato Brown", hex:"#8a563a" },
      { code:"YR515", name:"Burnt Sienna", hex:"#8c3a3c" },
      { code:"E415", name:"Cedar Brown", hex:"#5c3a2f" },
      { code:"R014", name:"Deep Vermilion", hex:"#e8343e" },
      { code:"R28", name:"Pink Carnation", hex:"#f2b8c4" },
      { code:"R210", name:"Deep Blush", hex:"#b85468" },
      { code:"R215", name:"Morello Cherry", hex:"#8c2f3c" },
      { code:"R412", name:"Cerise", hex:"#c73054" },
      { code:"R413", name:"Amaranth", hex:"#d53166" },
      { code:"R514", name:"Prune Juice", hex:"#6a2836" },
      { code:"RV08", name:"Pastel Pink", hex:"#ef77b5" },
      { code:"RV212", name:"Rich Raspberry", hex:"#c22d74" },
      { code:"RV311", name:"Pansy", hex:"#a34c8c" },
      { code:"RV314", name:"Grape Juice", hex:"#6a2e55" },
      { code:"V010", name:"Faded Violet", hex:"#5e3a78" },
      { code:"V13", name:"Greyed Lavender", hex:"#baa4c0" },
      { code:"V18", name:"Bright Lavender", hex:"#d085d8" },
      { code:"V416", name:"Deep Purple", hex:"#3a2c6a" },
      { code:"BV38", name:"Sky Blue", hex:"#8aa3d8" },
      { code:"BV310", name:"Brilliant Blue", hex:"#2f4a86" },
      { code:"B08", name:"Cotton Candy Blue", hex:"#3bc0d8" },
      { code:"B111", name:"Pool Blue", hex:"#0a7a96" },
      { code:"B115", name:"Classic Blue", hex:"#205a7a" },
      { code:"BG114", name:"Faded Teal", hex:"#2e6c6a" },
      { code:"BG311", name:"Turquoise", hex:"#1b8f8a" },
      { code:"G114", name:"Aged Pine Green", hex:"#4a6a5e" },
      { code:"G36", name:"Glass Green", hex:"#3ea852" },
      { code:"G310", name:"Shamrock Green", hex:"#4a9b5c" },
      { code:"G312", name:"Emerald Green", hex:"#1e6a48" },
      { code:"G315", name:"Dark Emerald", hex:"#185440" },
      { code:"G49", name:"Sour Apple", hex:"#b8d958" },
      { code:"G410", name:"Grass Green", hex:"#5aa03a" },
      { code:"YG012", name:"Yellow Green", hex:"#bac92e" },
      { code:"YG211", name:"Edamame", hex:"#8ca23a" },
      { code:"YG510", name:"Bud Green", hex:"#7ab43a" },
      { code:"CG18", name:"Icy Grey", hex:"#cfd4d2" },
      { code:"BGY24", name:"Storm Grey", hex:"#555f66" },
      { code:"YGY11", name:"Collingwood Grey", hex:"#c7bfb0" },
      { code:"WG10", name:"Porcelain", hex:"#dcdbd6" },
      { code:"120", name:"Black", hex:"#1a1a1a" },
    ] },

  // ---- Ohuhu Honolulu Blue Tone 6 (alcohol) — SKU Honolulu-02 ----
  // Hex values sampled directly off the box swatch chart. Secondary (B###) codes
  // kept in the name for cross-reference. All 6 are new — no code/shade overlap.
  { id: "ohuhu-blue", name: "Ohuhu Honolulu Blue Tone 6", short: "Blue Tone", type: "alcohol",
    note: "Honolulu-02 Blue Tone 6-pack. Cool muted blues — soft skies through deep teal.",
    colors: [
      { code:"BV32",  name:"Powder Blue (B220)",  hex:"#a8b9c0" },
      { code:"BV35",  name:"Dusty Blue (B120)",   hex:"#8eaaba" },
      { code:"BV58",  name:"Cornflower (B140)",   hex:"#759fba" },
      { code:"B05",   name:"Sky Blue (B050)",     hex:"#97becf" },
      { code:"B09",   name:"Teal Blue (B070)",    hex:"#6793a2" },
      { code:"B112",  name:"Deep Teal (B080)",    hex:"#5d8396" },
    ] },

  // ---- Ohuhu Skintones 6 (alcohol) — SKU Oahu-01 ----
  // Skin-tone set: gold tan, beige, peach, soft pink, caramel, cocoa.
  // YR37 / E613 warmed slightly from the sample — the matte ink photographed cool.
  { id: "ohuhu-oahu", name: "Ohuhu Skintones 6", short: "Skintones", type: "alcohol",
    note: "Oahu-01 Portrait 6-pack. Warm skin tones — a base, two mid-tones and a deep shadow brown.",
    colors: [
      { code:"Y43",   name:"Golden Tan (E191)",   hex:"#d2b88f" },
      { code:"YR02",  name:"Warm Beige (WG140)",  hex:"#ccc0b6" },
      { code:"YR04",  name:"Soft Peach (E494)",   hex:"#d4baac" },
      { code:"YR54",  name:"Petal Pink (R198)",   hex:"#cbb4b3" },
      { code:"YR37",  name:"Caramel (E477)",      hex:"#b07c5b" },
      { code:"E613",  name:"Cocoa Brown (E769)",  hex:"#5e4a42" },
    ] },

  // ---- Ohuhu Honolulu 48 · Set B/S (alcohol) ----
  // Second Honolulu 48-pack (Honolulu | Honolulu B | Honolulu S). Hex sampled off
  // the printed swatch chart. Old reference codes kept in the name after each color.
  { id: "ohuhu-honolulu-b", name: "Ohuhu Honolulu 48 · Set B", short: "Honolulu B", type: "alcohol",
    note: "Second Honolulu 48 set (Honolulu / Honolulu B / Honolulu S). A full spectrum — brights, earths and greys.",
    colors: [
      { code:"Y09",   name:"Summer Lemon (Y050)",      hex:"#d6d43c" },
      { code:"Y39",   name:"Straw (Y260)",             hex:"#b59730" },
      { code:"Y311",  name:"Termite Beige (Y270)",     hex:"#95863a" },
      { code:"Y46",   name:"Peach Yogurt (YR250)",     hex:"#e3a44f" },
      { code:"Y410",  name:"Goldenrod (YR260)",        hex:"#e0a24a" },
      { code:"Y412",  name:"Apple Cider (E490)",       hex:"#d18a48" },
      { code:"Y413",  name:"Fawn (E240)",              hex:"#b57a44" },
      { code:"YR19",  name:"Marigold Orange (YR170)",  hex:"#f47a1e" },
      { code:"YR312", name:"Light Earth Brown (E110)", hex:"#a56a44" },
      { code:"YR513", name:"Papaya (YR190)",           hex:"#ef5a2a" },
      { code:"E19",   name:"Dried Sage (YG080)",       hex:"#b1a998" },
      { code:"E211",  name:"Light Elm Wood (E440)",    hex:"#9c8a44" },
      { code:"E311",  name:"Sandbar Brown (E300)",     hex:"#7d7259" },
      { code:"E413",  name:"Dark Brown (E310)",        hex:"#5c463a" },
      { code:"E58",   name:"Fawn Brown (E170)",        hex:"#9c6b52" },
      { code:"E610",  name:"Light Mahogany (E060)",    hex:"#a94a3e" },
      { code:"E97",   name:"Deep Rose Grey (E400)",    hex:"#8a7078" },
      { code:"R23",   name:"Sakura (RV270)",           hex:"#f4b8cc" },
      { code:"R48",   name:"Cherry Rose (R200)",       hex:"#d82f6a" },
      { code:"R410",  name:"Raspberry (R160)",         hex:"#cf2050" },
      { code:"R57",   name:"Rose Dust (R280)",         hex:"#a56475" },
      { code:"RV09",  name:"Disco Pink (RV070)",       hex:"#ec2b8f" },
      { code:"RV28",  name:"Hibiscus Pink (RV200)",    hex:"#d84a86" },
      { code:"RV29",  name:"Plum Pink (RV320)",        hex:"#d12e78" },
      { code:"RV39",  name:"Bright Fuchsia (RV080)",   hex:"#e42b9a" },
      { code:"RV57",  name:"Dark Lilac (V160)",        hex:"#b072a6" },
      { code:"V29",   name:"Dull Violet (V060)",       hex:"#6f5a86" },
      { code:"V46",   name:"Lavender (V250)",          hex:"#9a80c0" },
      { code:"V412",  name:"Lobelia (V270)",           hex:"#6a4a9c" },
      { code:"BV08",  name:"Havelock Blue (B350)",     hex:"#4a63b0" },
      { code:"BV013", name:"French Ultramarine (B380)",hex:"#3f36a0" },
      { code:"BV28",  name:"Bluebonnet (V370)",        hex:"#6a5ab5" },
      { code:"BV48",  name:"Distressed Denim (B260)",  hex:"#6f95c0" },
      { code:"BV415", name:"Antwerp Blue (B290)",      hex:"#2a5a8a" },
      { code:"BV58",  name:"Crystal Blue (B140)",      hex:"#5a8ec8" },
      { code:"B09",   name:"Tahitian Blue (B070)",     hex:"#2aaae0" },
      { code:"B311",  name:"Stone Blue (MG060)",       hex:"#7a9aa8" },
      { code:"BG211", name:"Spearmint (G360)",         hex:"#2ba885" },
      { code:"G44",   name:"Sea Glass Green (G440)",   hex:"#8ccaa0" },
      { code:"YG111", name:"Celery (G060)",            hex:"#b8bf3e" },
      { code:"YG112", name:"Lemon Lime (G070)",        hex:"#e6d92a" },
      { code:"YG36",  name:"Beige Green (G240)",       hex:"#b0c088" },
      { code:"YG610", name:"Bright Lime (G170)",       hex:"#5cb83a" },
      { code:"YG611", name:"Mantis Green (G190)",      hex:"#5ab03a" },
      { code:"CG28",  name:"Web Grey (CG070)",         hex:"#8a9098" },
      { code:"BGY13", name:"Seagull Grey (GG060)",     hex:"#9aa2a4" },
      { code:"WG06",  name:"Star Dust (RG150)",        hex:"#b8a4b0" },
      { code:"GG12",  name:"Pastel Icy Grey (BG070)",  hex:"#aab4c8" },
    ] },

  // ---- SFAIH Pastel Alcohol Markers (read off the swatch chart; pastels) ----
  { id: "sfaih", name: "SFAIH Pastel 51", short: "SFAIH Pastel", type: "alcohol",
    note: "Soft pastel alcohol set. A few codes were hidden in the photo — easy to add.",
    colors: [
      { code:"Y030", name:"Lemon Chiffon", hex:"#f4eeb0" },
      { code:"Y230", name:"Deep Cream", hex:"#f2e6a4" },
      { code:"Y120", name:"Buttercup Yellow", hex:"#f5e08a" },
      { code:"G020", name:"Pale Lemon Yellow", hex:"#eaf0b4" },
      { code:"YR030", name:"Carmine Red", hex:"#f2a78c" },
      { code:"YR4", name:"Salmon Pink", hex:"#f6c1a2" },
      { code:"YR205", name:"Powdery Orange", hex:"#f7cb9e" },
      { code:"YR110", name:"Mellow Peach", hex:"#f8cbb0" },
      { code:"YR070", name:"Light Orange", hex:"#f9c79a" },
      { code:"YR170", name:"Chrome Orange", hex:"#f6b46a" },
      { code:"E280", name:"Sand White", hex:"#efe6d2" },
      { code:"E220", name:"Sand", hex:"#f0d8b0" },
      { code:"E210", name:"Brick Beige", hex:"#e8c4a0" },
      { code:"E470", name:"Tea Rose", hex:"#f0c4bc" },
      { code:"BR208", name:"Buck Brown", hex:"#c8a07a" },
      { code:"R250", name:"Antique Fuchsia", hex:"#d99fb2" },
      { code:"R110", name:"Sardonyx", hex:"#e8a0a0" },
      { code:"R120", name:"Light Prawn", hex:"#f4b4b0" },
      { code:"RV260", name:"Pink", hex:"#f4b8cf" },
      { code:"RV180", name:"Hollyhock", hex:"#e9a8cf" },
      { code:"RV030", name:"Light Hot Pink", hex:"#f4a8c8" },
      { code:"RV160", name:"Thistle", hex:"#e2c4e0" },
      { code:"RV280", name:"Light Pink", hex:"#f6c8da" },
      { code:"V230", name:"Viola", hex:"#c9b8e0" },
      { code:"V030", name:"Mauve", hex:"#d9c0dc" },
      { code:"V060", name:"Amethyst", hex:"#c4b0dc" },
      { code:"V020", name:"Pale Lilac", hex:"#d8c8e8" },
      { code:"B340", name:"Lavender Mist", hex:"#c4c8e8" },
      { code:"B220", name:"Pale Grayish Blue", hex:"#b8cdd8" },
      { code:"B250", name:"Light Blue", hex:"#aacfe6" },
      { code:"B120", name:"Pale Blue", hex:"#bcd6ec" },
      { code:"B140", name:"Aquamarine", hex:"#a8d8d8" },
      { code:"B050", name:"Robin's Egg Blue", hex:"#a0d0e8" },
      { code:"G340", name:"Horizon Green", hex:"#bfe0d2" },
      { code:"G120", name:"Yellowish Green", hex:"#cfe0a0" },
      { code:"G140", name:"Horseradish", hex:"#c2dca0" },
      { code:"G220", name:"Lime Green", hex:"#c2e0b0" },
      { code:"YR217", name:"Milk White", hex:"#efe8dc" },
      { code:"YG040", name:"Yellow Grey 04", hex:"#d8d4b8" },
      { code:"RG110", name:"Red Grey 11", hex:"#d8c4c0" },
      { code:"RG030", name:"Red Grey 03", hex:"#e0d0cc" },
      { code:"BG070", name:"Cool Grey 07", hex:"#b8c0c0" },
      { code:"CG020", name:"Neutral Grey 02", hex:"#dadcdc" },
      { code:"CG050", name:"Neutral Grey 05", hex:"#b0b4b4" },
      { code:"CG070", name:"Neutral Grey 07", hex:"#909494" },
    ] },

];

// ---------------------------------------------------------------------------
// FINISHING TOOLS — highlights, opaque whites, and the alcohol blender.
// Not palette fills; surfaced separately so a palette can call for "+ white pen".
// ---------------------------------------------------------------------------
window.FINISHING = [
  { code:"PC-1M", name:"Posca White — extra fine (0.7mm)", role:"highlight", hex:"#fbfbf8", kind:"acrylic pen" },
  { code:"PC-3M", name:"Posca White — fine (1.3mm)", role:"highlight", hex:"#fbfbf8", kind:"acrylic pen" },
  { code:"PC-5M", name:"Posca White — medium (1.8–2.5mm)", role:"highlight", hex:"#fbfbf8", kind:"acrylic pen" },
  { code:"GEL-W", name:"White gel pens (assorted)", role:"sparkle highlight", hex:"#ffffff", kind:"gel pen" },
  { code:"ACR-W", name:"White acrylic markers/pens", role:"opaque highlight", hex:"#fafaf6", kind:"acrylic pen" },
  { code:"BLEND-A", name:"Colorless alcohol blender", role:"blend / lift", hex:"#f3f1ec", kind:"alcohol blender" },
];

// ---------------------------------------------------------------------------
// TIPS — material-attached + tool-attached + color-theory mini-lessons.
// Focus per the artist: shadow/highlight placement, and bold high-contrast
// complementary shading.
// ---------------------------------------------------------------------------
window.TIPS = {
  // attached to a material type
  material: {
    alcohol: [
      "Work light → dark, and while the ink is still damp the next layer melts in seamlessly.",
      "A colorless blender pushes pigment outward — great for soft edges and gradients.",
      "Feather two close colors into each other instead of one hard line for smooth transitions.",
    ],
    pencil: [
      "Build up in many light layers; pressing hard too early flattens the tooth and you can't layer further.",
      "Burnish last with a light pencil or burnisher to fuse layers into a smooth, waxy finish.",
      "Layer a complement underneath a color to knock it back for natural shadow.",
    ],
    ink: [
      "Inktense looks dull dry — it only goes vivid once water touches it.",
      "Lay the pencil down dry, then pull clean water through with a brush from light to dark.",
      "Once a wash dries it's permanent, so you can layer a second color on top without lifting the first.",
    ],
    gel: [
      "Opaque gel sits on top — perfect for tiny highlights, stars and texture over finished color.",
      "Let each dot dry before layering or it'll smear; shake well so the tip stays juicy.",
    ],
    acrylic: [
      "Acrylic is opaque, so lighter colors cover darker ones — the reverse of markers.",
      "Let each layer dry fully before going back over it, or it lifts and muddies.",
    ],
  },
  // attached to a tool/screen
  tool: {
    library: "Tap any color to see its family, value, and what it bridges to.",
    bridge:  "The gaps show where you'll blend by hand — reach for the blender or a burnisher there.",
    builder: "A palette needs lights AND darks to read — that's why the slots run highlight → dark.",
  },
  // color-theory mini-lessons (the artist's stated focus)
  theory: [
    { t: "Shadows aren't just darker", b: "Shade with the color's complement, not black — it stays vibrant. Reds shadow toward green, blues toward orange. Black flattens; complements add life." },
    { t: "Bold complementary shading", b: "Put your brightest color next to its opposite at the focal point. Maximum hue contrast there pulls the eye exactly where you want it." },
    { t: "Where highlights land", b: "One light source = one set of highlights, all on the same side. Hit the closest edge and the top plane; leave the rest to mid-tone." },
    { t: "Value does the heavy lifting", b: "Squint at your piece — if the lights and darks read with no color, the drawing works. Get value right and any palette looks good." },
    { t: "Keep one color in charge", b: "Let one hue dominate (~60%), a second support (~30%), and a bold accent finish it (~10%). Equal amounts of everything fights for attention." },
    { t: "Warm light, cool shadow", b: "If light is warm (golden sun), push shadows cooler — and vice versa. That temperature shift reads as real, dimensional light." },
  ],
};
