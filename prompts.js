// Doodle prompts organized by category. Each has a loose/medium/guided hint.
// These are seeds — the visual engine draws an abstract silhouette from the shape list.
window.PROMPTS = [
  // Creatures & critters
  { cat: "creatures", text: "a mushroom with legs wandering home", shape: "mushroomBeing" },
  { cat: "creatures", text: "a moth the size of a dinner plate", shape: "moth" },
  { cat: "creatures", text: "a cat loaf on a sunny windowsill", shape: "catLoaf" },
  { cat: "creatures", text: "a frog wearing a little hat", shape: "frogHat" },
  { cat: "creatures", text: "a snail carrying a teacup shell", shape: "snailCup" },
  { cat: "creatures", text: "a tiny dragon napping on coins", shape: "dragonCoins" },
  { cat: "creatures", text: "a jellyfish drifting with trailing ribbons", shape: "jellyfish" },
  { cat: "creatures", text: "a bookish owl with reading glasses", shape: "owlGlasses" },
  { cat: "creatures", text: "a fox curled into a cinnamon roll", shape: "foxRoll" },
  { cat: "creatures", text: "a bee the size of a grape", shape: "bee" },

  // Landscapes / tiny scenes
  { cat: "landscape", text: "a single tree on a misty hill", shape: "lonelyTree" },
  { cat: "landscape", text: "moonlit desert with a tiny cactus", shape: "desertMoon" },
  { cat: "landscape", text: "a lighthouse at the edge of nothing", shape: "lighthouse" },
  { cat: "landscape", text: "rice terraces stepping down a slope", shape: "terraces" },
  { cat: "landscape", text: "a frozen lake with one skater", shape: "frozenLake" },
  { cat: "landscape", text: "a hot spring in a pine forest", shape: "hotSpring" },

  // Architecture / cozy interiors
  { cat: "interior", text: "a reading nook under a sloped window", shape: "readingNook" },
  { cat: "interior", text: "a crowded bookshelf with a sleeping cat", shape: "bookshelf" },
  { cat: "interior", text: "a tiny bathhouse tucked between buildings", shape: "bathhouse" },
  { cat: "interior", text: "a café with steam rising from cups", shape: "cafeSteam" },
  { cat: "interior", text: "a greenhouse cluttered with plants", shape: "greenhouse" },
  { cat: "interior", text: "a crooked house with too many chimneys", shape: "crookedHouse" },

  // Botanical
  { cat: "botanical", text: "a single monstera leaf, up close", shape: "monstera" },
  { cat: "botanical", text: "a bouquet of weeds from the sidewalk", shape: "weedBouquet" },
  { cat: "botanical", text: "a pomegranate cut in half", shape: "pomegranate" },
  { cat: "botanical", text: "a sprig of rosemary with morning dew", shape: "rosemary" },
  { cat: "botanical", text: "a cluster of honey mushrooms", shape: "mushroomCluster" },
  { cat: "botanical", text: "a fig, whole and sliced beside it", shape: "fig" },
  { cat: "botanical", text: "a single poppy, wind-bent", shape: "poppy" },

  // Food
  { cat: "food", text: "a stack of lopsided pancakes", shape: "pancakes" },
  { cat: "food", text: "a bowl of ramen with a soft egg", shape: "ramen" },
  { cat: "food", text: "a slice of layered cake on a plate", shape: "cakeSlice" },
  { cat: "food", text: "a single strawberry, leaves and all", shape: "strawberry" },
  { cat: "food", text: "a croissant with too much butter", shape: "croissant" },
  { cat: "food", text: "a mug of something steaming", shape: "steamingMug" },

  // Tiny objects
  { cat: "objects", text: "an antique brass key", shape: "key" },
  { cat: "objects", text: "a teacup with a chip on the rim", shape: "teacupChip" },
  { cat: "objects", text: "a pair of scissors, open", shape: "scissors" },
  { cat: "objects", text: "a matchbook with one match missing", shape: "matchbook" },
  { cat: "objects", text: "a pocket watch, slightly running late", shape: "pocketWatch" },
  { cat: "objects", text: "a single dice on a checkered surface", shape: "dice" },
  { cat: "objects", text: "a polaroid photo of somewhere warm", shape: "polaroid" },

  // Celestial & weather
  { cat: "celestial", text: "a crescent moon tangled in clouds", shape: "crescentMoon" },
  { cat: "celestial", text: "a comet with a long soft tail", shape: "comet" },
  { cat: "celestial", text: "a rain cloud over one tiny house", shape: "rainCloud" },
  { cat: "celestial", text: "a constellation you just made up", shape: "constellation" },
  { cat: "celestial", text: "a sun setting behind layered hills", shape: "layeredSunset" },
  { cat: "celestial", text: "fog rolling over a bridge", shape: "foggyBridge" },

  // Characters / faces
  { cat: "character", text: "a stranger glimpsed through a window", shape: "windowFace" },
  { cat: "character", text: "a self-portrait with closed eyes", shape: "closedFace" },
  { cat: "character", text: "someone laughing mid-sentence", shape: "laughFace" },
  { cat: "character", text: "a tired barista at closing time", shape: "baristaFace" },

  // Abstract shapes & patterns
  { cat: "abstract", text: "soft shapes overlapping like bubbles", shape: "blobs" },
  { cat: "abstract", text: "wavy horizontal bands of color", shape: "bands" },
  { cat: "abstract", text: "a radial burst from a single point", shape: "radial" },
  { cat: "abstract", text: "nested arches like a memory palace", shape: "arches" },
  { cat: "abstract", text: "a pattern of tiny repeating dots", shape: "dots" },
  { cat: "abstract", text: "a single gesture line, thick and expressive", shape: "gesture" },

  // Everyday mundane
  { cat: "mundane", text: "the inside of your fridge", shape: "fridge" },
  { cat: "mundane", text: "your desk, without cleaning it first", shape: "desk" },
  { cat: "mundane", text: "a tangle of headphone wires", shape: "wires" },
  { cat: "mundane", text: "the plant you almost killed", shape: "droopyPlant" },
  { cat: "mundane", text: "a single sock, very alone", shape: "sock" },
];

window.CATEGORIES = {
  creatures:  "Creatures & critters",
  landscape:  "Landscapes",
  interior:   "Interiors",
  botanical:  "Botanical",
  food:       "Food",
  objects:    "Tiny objects",
  celestial:  "Celestial & weather",
  character:  "Faces",
  abstract:   "Abstract & pattern",
  mundane:    "Mundane",
};

// 7-day challenges — curated arcs
window.CHALLENGES = [
  {
    title: "Warm / Cool Week",
    blurb: "Each day swaps dominance between warm and cool. Notice how mood shifts.",
    days: [
      { promptIdx: "cafeSteam",     palette: "warmCool", notes: "Warm dominant" },
      { promptIdx: "frozenLake",    palette: "warmCool", notes: "Cool dominant" },
      { promptIdx: "strawberry",    palette: "warmCool", notes: "Warm dominant" },
      { promptIdx: "jellyfish",     palette: "warmCool", notes: "Cool dominant" },
      { promptIdx: "layeredSunset", palette: "warmCool", notes: "Warm → cool gradient" },
      { promptIdx: "foggyBridge",   palette: "warmCool", notes: "Cool dominant" },
      { promptIdx: "mushroomBeing", palette: "warmCool", notes: "Your choice" },
    ],
  },
  {
    title: "Three Colors Only",
    blurb: "A different limited trio each day. Forces mixing and restraint.",
    days: [
      { promptIdx: "lonelyTree",     palette: "limited" },
      { promptIdx: "teacupChip",     palette: "limited" },
      { promptIdx: "moth",           palette: "limited" },
      { promptIdx: "pomegranate",    palette: "limited" },
      { promptIdx: "crookedHouse",   palette: "limited" },
      { promptIdx: "constellation",  palette: "limited" },
      { promptIdx: "weedBouquet",    palette: "limited" },
    ],
  },
  {
    title: "Harmony Sampler",
    blurb: "One harmony type each day. End the week knowing which feels like you.",
    days: [
      { promptIdx: "cakeSlice",     palette: "complementary",    notes: "Complementary" },
      { promptIdx: "monstera",      palette: "analogous",        notes: "Analogous" },
      { promptIdx: "catLoaf",       palette: "triadic",          notes: "Triadic" },
      { promptIdx: "lighthouse",    palette: "splitComplement",  notes: "Split-complement" },
      { promptIdx: "ramen",         palette: "warmCool",         notes: "Warm vs cool" },
      { promptIdx: "bee",           palette: "limited",          notes: "3 colors only" },
      { promptIdx: "bathhouse",     palette: "atmospheric",      notes: "Atmospheric — dusk" },
    ],
  },
];
