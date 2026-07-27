// ============================================================================
// Doodlebench — MIXING GUIDE.
// Curated, artist-tested guidance for combining the specific media in this
// library: which goes down first, how to layer, how to blend, what to avoid.
// Written from how marker/pencil/Inktense artists actually work — not theory.
// ============================================================================

// per-medium accent used by the layer-stack visual (rough swatch colours)
window.MED_COLOR = {
  ink:"#1f5fa6", alcohol:"#3bc0d8", pencil:"#d8a22b", acrylic:"#ee7a22", gel:"#d085d8",
};

window.MIXING = {

  // The one rule that ties everything together. Bottom (first) -> top (last).
  stack: [
    { type:"ink",     label:"Inktense wash",      note:"permanent, waterproof base" },
    { type:"alcohol", label:"Alcohol markers",     note:"transparent colour & gradients" },
    { type:"pencil",  label:"Coloured pencils",    note:"detail, texture, deep darks" },
    { type:"acrylic", label:"Acrylic / opaque",    note:"opaque shapes & corrections" },
    { type:"gel",     label:"Gel & white pens",    note:"highlights & sparkle — dead last" },
  ],
  stackWhy:"Transparent and solvent-based media go down first; opaque and dry media go on top. Anything that dissolves a layer below it has to come before that layer — so save opaque highlights for the very end.",

  // The pairings people actually ask about.
  combos: [
    {
      id:"marker-pencil",
      involves:["alcohol","pencil"],
      a:"alcohol", b:"pencil",
      title:"Alcohol markers + Coloured pencils",
      verdict:"Marker down first, pencil on top — never the reverse.",
      order:[
        { type:"alcohol", label:"Alcohol marker base" },
        { type:"pencil",  label:"Coloured pencil on top" },
      ],
      steps:[
        "Lay your marker base first, working light → dark, and let it dry fully (a minute or two).",
        "Add coloured pencil on top for detail, texture, crisp edges and the deep darks markers can't reach.",
        "Build the pencil in light layers; press hard only at the very end.",
        "Burnish with a pale pencil or the Derwent burnisher to fuse it into a smooth finish.",
      ],
      blend:"Soften marker edges with the colourless blender before you pencil. To blend the pencil itself, layer a lighter pencil over it and burnish, or pull it together with the Derwent blender pencil.",
      watch:"Don't pencil onto damp marker — it skips and drags. And don't run markers back over heavy wax pencil; the alcohol smears it and gums up your nib. **Marker is the floor, pencil is the ceiling.**",
      note:"The most-loved combo in the marker world: markers do fast, flat colour, pencils do everything fiddly.",
    },
    {
      id:"inktense-marker",
      involves:["ink","alcohol"],
      a:"ink", b:"alcohol",
      title:"Derwent Inktense + Alcohol markers",
      verdict:"Inktense wash first and bone-dry, then markers over the top.",
      order:[
        { type:"ink",     label:"Inktense — drawn, then washed with water" },
        { type:"alcohol", label:"Alcohol markers once it's fully dry" },
      ],
      steps:[
        "Sketch lightly with the Inktense pencil — it looks dull and chalky dry, which is normal.",
        "Pull clean water through with a brush, light → dark. It turns vivid, and once dry it's permanent and waterproof.",
        "Let it dry completely before any marker touches it.",
        "Layer alcohol markers on top for smooth gradients and opacity the wash can't give.",
      ],
      blend:"Blend the Inktense with water while it's wet — it's a wash medium. Blend the markers among themselves wet-into-wet or feather them with the colourless blender.",
      watch:"Alcohol can lift a little dried Inktense onto the nib if you scrub, so work gently and keep a 'dirty' nib for darks. Never lay water-activated Inktense over wet marker, and don't try to use the dry pencil on a slick marker surface — it won't grip.",
      note:"Inktense gives you a permanent underpainting that markers can't disturb — the safest way to combine a wash with markers.",
    },
    {
      id:"inktense-pencil",
      involves:["ink","pencil"],
      a:"ink", b:"pencil",
      title:"Derwent Inktense + Coloured pencils",
      verdict:"Inktense underpainting first (dry), pencil detail on top.",
      order:[
        { type:"ink",    label:"Inktense wash, dried" },
        { type:"pencil", label:"Coloured pencil detail" },
      ],
      steps:[
        "Block in vivid base colour with Inktense, activate with water, and let it dry.",
        "Layer coloured pencil over the dry wash — Inktense leaves a lovely tooth for pencil to grab.",
        "Build details, texture and shadows; burnish to finish.",
        "For the darkest accents you can even draw with the Inktense pencil dry on top — gritty but rich.",
      ],
      blend:"Inktense blends with water; pencil blends by layering and burnishing (Derwent blender pencil or a pale pencil).",
      watch:"Don't burnish before the wash is bone-dry. Go light with the pencil at first — heavy wax early kills the tooth and you lose your ability to layer.",
      note:"No solvent conflict here at all: a water wash and wax pencil love each other, and the wash actually improves grip.",
    },
    {
      id:"acrylic",
      involves:["acrylic"],
      a:"acrylic", b:null,
      title:"Acrylic brush markers (the opaque outlier)",
      verdict:"Opaque — light covers dark, the opposite of markers. Base layer or top accents.",
      order:[
        { type:"acrylic", label:"Acrylic shapes — let cure hard" },
        { type:"pencil",  label:"Pencil / gel on top once dry" },
      ],
      steps:[
        "As a base: block in solid shapes and let them dry hard before doing anything else.",
        "Over dry acrylic you can add coloured pencil or gel accents — but markers will bead and won't blend in.",
        "As accents: use opaque acrylic for bold edges or corrections on top of finished work.",
      ],
      blend:"Blend acrylic while it's still wet, brush to brush. Once it cures it's plastic — no solvent will move it.",
      watch:"Never go back into half-dry acrylic — it lifts and turns muddy. And don't expect alcohol markers to blend over a cured acrylic layer; the surface is sealed.",
      note:"Because lighter colours cover darker ones, acrylic is your tool for fixing mistakes and adding pop on dark paper.",
    },
    {
      id:"gel-highlights",
      involves:["gel"],
      a:"gel", b:null,
      title:"Gel & white pens (the highlight layer)",
      verdict:"Always last. Opaque accents that sit on top of everything.",
      order:[
        { type:"gel", label:"Gel / white pen highlights — the final move" },
      ],
      steps:[
        "Finish all your marker, wash and pencil work first.",
        "Add opaque gel on top for highlights, dots, stars and fine texture — the macaron pastels glow on dark areas.",
        "Use the Posca or white gel for the brightest sparkle on the closest sunlit edge.",
        "Let each mark dry before layering another so it doesn't smear.",
      ],
      blend:"Gel doesn't blend — it's for crisp, opaque accents. Shake the pen and prime the tip on scrap so it lays down juicy.",
      watch:"Never run an alcohol marker over gel or white pen — it smears the ink and clogs your nib. These are the last thing you touch the page with.",
      note:"One restrained pass of white at the end does more than a dozen scattered dots — put it only where the light actually hits.",
    },
  ],

  // How to actually move pigment around — matched to the right medium.
  blenders: [
    { glyph:"◖", name:"Colourless alcohol blender", works:"Alcohol markers",
      note:"Feathers edges, lightens, and melts two markers into one gradient. Lifts a little Inktense too — but won't budge wax pencil or acrylic." },
    { glyph:"💧", name:"Water + brush", works:"Derwent Inktense only",
      note:"The only thing that activates and moves Inktense. Pull light → dark; once it dries the colour is locked for good." },
    { glyph:"✎", name:"Derwent blender pencil", works:"Coloured pencils",
      note:"Colourless wax that smooths and fuses pencil layers without shifting the colour underneath." },
    { glyph:"✦", name:"Derwent burnisher", works:"Coloured pencils — last step",
      note:"A hard colourless pencil that flattens the tooth for a glassy, fused finish. Always the final pencil pass." },
    { glyph:"●", name:"Posca & white gel pens", works:"On top of everything",
      note:"Opaque highlights and sparkle — the very last layer, and never underneath a solvent." },
  ],
};

// ============================================================================
// EFFECTS — signature "how do they do that?" looks from the alcohol-marker /
// Ohuhu & cozy-coloring world, written for THIS kit. Each one is recipe-style:
// the effect, the materials it leans on, the moves in order, and the trap.
// ============================================================================
window.TECHNIQUES = [
  {
    id:"neon",
    glyph:"💡",
    name:"Neon glow",
    effect:"Make a colour look like it's actually emitting light.",
    materials:["a dark base","brightest alcohol marker","white acrylic marker","white gel / Posca"],
    steps:[
      "Work on a dark or deep-coloured area — neon only reads as glow against dark, never on white paper.",
      "Lay your brightest alcohol marker for the glowing shape and build 2–3 passes so it's fully saturated.",
      "Paint a white acrylic core down the hottest centre of the shape and let it cure hard.",
      "Glaze the same neon marker lightly back over the white edges so white blooms into colour — that white→neon gradient IS the light.",
      "Finish with one tiny white gel dot at the very hottest point and a couple of short rays.",
    ],
    watch:"Let the acrylic **cure before** you glaze marker over it, or it lifts and goes muddy. And never run marker over the gel — save the gel for dead last.",
    note:"The glow lives in the white-to-colour transition, not the colour itself. Keep pure white to the smallest area.",
  },
  {
    id:"stained-glass",
    glyph:"🪟",
    name:"Stained glass",
    effect:"Jewel-bright cells held inside dark leading.",
    materials:["pencil","vivid alcohol markers","thick black liner","white gel"],
    steps:[
      "Pencil the design as separate closed cells — keep shapes simple, bold and a little geometric.",
      "Fill each cell with one flat, saturated marker colour; push the brights and keep neighbours contrasting.",
      "Once fills are dry, ink the dividing 'leading' with a thick black liner so every cell is fully bordered.",
      "Drop a darker shade of each colour into one corner of its cell for a hint of depth.",
      "Tick a few white-gel glints where imaginary light catches the glass.",
    ],
    watch:"Let the fills dry (or leave a hair of white paper at the edges) **before inking** — wet marker drags the black everywhere. Keep the leading thick and even; thin patchy gaps just read as a mistake.",
    note:"Limit yourself to 5–6 colours. Stained glass sings on bold repeating colour, not subtlety.",
  },
  {
    id:"brick",
    glyph:"🧱",
    name:"Brick & stone",
    effect:"Convincing masonry without drawing every single brick.",
    materials:["2–3 earth-tone markers","sharp grey/brown pencil","white gel pen"],
    steps:[
      "Lay one flat mid-tone marker base across the whole wall.",
      "Draw the mortar lines with a sharp pencil, offsetting each row like real brickwork — don't make them ruler-perfect.",
      "Randomly deepen about one brick in five with a darker marker so the wall isn't uniform.",
      "Tuck pencil shadow into the mortar grooves and along the underside of each brick.",
      "Flick a few tiny white-pen chips and top-edge highlights for worn, catching-the-light stone.",
    ],
    watch:"Vary the brick colours slightly — a wall of identical bricks looks fake. And keep mortar lines **thinner** than your instinct says.",
    note:"Irregularity sells it: wobble the lines and stagger the colour brick to brick.",
  },
  {
    id:"grass",
    glyph:"🌿",
    name:"Grass & foliage",
    effect:"Lush layered greenery with real depth.",
    materials:["3 greens (light/mid/dark)","a yellow-green","pencil","light gel pen"],
    steps:[
      "Block the area with your mid green, then pool the darkest green into the base and shadows — grass is darkest at the roots.",
      "Flick upward strokes, lifting the nib at the tip, working light over dark; let strokes overlap and cross.",
      "Drop a few yellow-green and lightest blades on top, in front, for sunlit depth.",
      "Add pencil for the finest individual blades and crisp edges where they're needed.",
      "Catch the odd blade tip with a light gel pen for a spark of sun.",
    ],
    watch:"Always flick **in the growth direction** and vary blade height and angle — even spacing reads as a mown lawn stripe, not nature.",
    note:"Depth = dark at the base, light at the tips, and a few blades clearly standing in front of the rest.",
  },
  {
    id:"galaxy",
    glyph:"🌌",
    name:"Galaxy night sky",
    effect:"A deep cosmic gradient scattered with stars.",
    materials:["dark blue / purple / magenta markers","colourless blender","white acrylic","white gel"],
    steps:[
      "Map a diagonal band for the milky way, then lay the darkest indigo at the outer edges.",
      "While it's wet, blend toward lighter blue with a touch of magenta through the band, feathering with the colourless blender.",
      "Once it's bone-dry, flick white acrylic off a stiff brush or old nib for a fine star spray (tap, don't paint).",
      "Scatter deliberate white-gel stars in varied sizes — a few with tiny cross-glints.",
      "Keep the darkest corners almost starless so the band reads as the densest part.",
    ],
    watch:"Marker must be **fully dry** before any white, or the acrylic beads and the gel smears. Don't space stars evenly — clump and scatter them.",
    note:"Restraint with the very brightest stars is what makes the field feel deep.",
  },
  {
    id:"wood",
    glyph:"🪵",
    name:"Wood grain",
    effect:"Warm planks and knots that read as real timber.",
    materials:["2 wood-tone markers (light/mid)","brown pencil","colourless blender","light gel pen"],
    steps:[
      "Base each plank with the lighter wood marker, leaving a thin gap between boards.",
      "Drag long wavy grain lines with the mid marker and brown pencil, curving them around a couple of oval knots.",
      "Deepen the gaps between planks and the rings around each knot with pencil.",
      "Pull the colourless blender along the grain to soften and streak it.",
      "Run a thin light-gel highlight along one edge of each plank for a waxed sheen.",
    ],
    watch:"Keep grain lines slightly irregular and roughly parallel — perfectly straight lines look like laminate flooring, not wood.",
    note:"Knots plus a subtle colour shift plank-to-plank are what sell genuine timber.",
  },
];
