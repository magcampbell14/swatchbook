// colorqueue — hand-drawn doodle SVG engine (extracted from Doodlebench).
// window.Sketch.render(shapeKey, complexity) -> svg string.

window.Sketch = (function () {
  // Wobble utility — adds hand-drawn jitter to paths
  function wob(n = 1.5) { return (Math.random() - 0.5) * n; }

  // Build a rough hand-drawn rectangle path
  function rough(x, y, w, h, jitter = 2) {
    const p = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      p.push([x + (w * i) / steps + wob(jitter), y + wob(jitter)]);
    }
    for (let i = 0; i <= steps; i++) {
      p.push([x + w + wob(jitter), y + (h * i) / steps + wob(jitter)]);
    }
    for (let i = 0; i <= steps; i++) {
      p.push([x + w - (w * i) / steps + wob(jitter), y + h + wob(jitter)]);
    }
    for (let i = 0; i <= steps; i++) {
      p.push([x + wob(jitter), y + h - (h * i) / steps + wob(jitter)]);
    }
    return "M" + p.map(pt => pt.join(",")).join(" L") + " Z";
  }

  // Rough circle/ellipse
  function roughEllipse(cx, cy, rx, ry, jitter = 1.5, steps = 36) {
    const p = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      p.push([cx + Math.cos(a) * rx + wob(jitter), cy + Math.sin(a) * ry + wob(jitter)]);
    }
    return "M" + p.map(pt => pt.join(",")).join(" L") + " Z";
  }

  // Common style: thin ink stroke on cream, no fill
  const INK = "#2a2520";
  const INK_LIGHT = "#6a635a";
  const strokeProps = (w = 1.6) =>
    `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const lightStroke = (w = 1) =>
    `fill="none" stroke="${INK_LIGHT}" stroke-width="${w}" stroke-dasharray="3 3" stroke-linecap="round"`;

  // Many small helpers each return an inner SVG fragment drawn in a 300x300 viewbox.
  const shapes = {
    mushroomBeing: (lvl) => {
      let s = "";
      // cap
      s += `<path d="${roughEllipse(150, 130, 80, 55, 1.8)}" ${strokeProps()} />`;
      // stem silhouette
      s += `<path d="M110,155 Q100,215 125,225 L175,225 Q200,215 190,155 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // legs
        s += `<path d="M130,225 Q128,255 135,270" ${strokeProps()} />`;
        s += `<path d="M170,225 Q172,255 165,270" ${strokeProps()} />`;
        // little feet
        s += `<path d="${roughEllipse(135, 272, 12, 5, 0.8)}" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(165, 272, 12, 5, 0.8)}" ${strokeProps()} />`;
        // cap spots
        s += `<circle cx="120" cy="115" r="8" ${strokeProps()} />`;
        s += `<circle cx="170" cy="105" r="6" ${strokeProps()} />`;
        s += `<circle cx="160" cy="140" r="5" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        // tiny eyes
        s += `<circle cx="140" cy="190" r="2" fill="${INK}" />`;
        s += `<circle cx="160" cy="190" r="2" fill="${INK}" />`;
        s += `<path d="M144,200 Q150,204 156,200" ${strokeProps()} />`;
        // guide lines
        s += `<path d="M150,90 L150,225" ${lightStroke()} />`;
      }
      return s;
    },
    moth: (lvl) => {
      let s = "";
      // body
      s += `<path d="M150,100 Q145,200 150,230 Q155,200 150,100 Z" ${strokeProps()} />`;
      // upper wings
      s += `<path d="M150,120 Q60,80 50,160 Q90,200 150,180 Z" ${strokeProps()} />`;
      s += `<path d="M150,120 Q240,80 250,160 Q210,200 150,180 Z" ${strokeProps()} />`;
      // lower wings
      s += `<path d="M150,180 Q85,195 80,230 Q130,245 150,225 Z" ${strokeProps()} />`;
      s += `<path d="M150,180 Q215,195 220,230 Q170,245 150,225 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // eyespots
        s += `<circle cx="90" cy="150" r="10" ${strokeProps()} />`;
        s += `<circle cx="210" cy="150" r="10" ${strokeProps()} />`;
        // antennae
        s += `<path d="M145,100 Q130,70 115,65" ${strokeProps()} />`;
        s += `<path d="M155,100 Q170,70 185,65" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<circle cx="90" cy="150" r="4" fill="${INK}" />`;
        s += `<circle cx="210" cy="150" r="4" fill="${INK}" />`;
        s += `<path d="M150,100 L150,240" ${lightStroke()} />`;
      }
      return s;
    },
    catLoaf: (lvl) => {
      let s = "";
      s += `<path d="M60,200 Q55,140 95,130 Q105,115 130,115 Q140,105 160,115 Q170,105 195,115 Q235,125 240,200 Q230,230 150,230 Q70,230 60,200 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // ears
        s += `<path d="M110,120 L100,95 L130,115 Z" ${strokeProps()} />`;
        s += `<path d="M190,120 L200,95 L170,115 Z" ${strokeProps()} />`;
        // windowsill
        s += `<line x1="40" y1="230" x2="260" y2="230" ${strokeProps(2)} />`;
        s += `<line x1="40" y1="250" x2="260" y2="250" ${strokeProps(1.2)} />`;
      }
      if (lvl === "guided") {
        // face
        s += `<circle cx="140" cy="155" r="2" fill="${INK}" />`;
        s += `<circle cx="170" cy="155" r="2" fill="${INK}" />`;
        s += `<path d="M150,165 Q155,170 160,165" ${strokeProps()} />`;
        // sun stripe
        s += `<path d="M30,80 L280,80" ${lightStroke()} />`;
        s += `<path d="M30,130 L280,130" ${lightStroke()} />`;
      }
      return s;
    },
    frogHat: (lvl) => {
      let s = "";
      s += `<path d="${roughEllipse(150, 180, 90, 60, 1.8)}" ${strokeProps()} />`;
      // eyes bulging
      s += `<path d="${roughEllipse(115, 130, 22, 22, 1.2)}" ${strokeProps()} />`;
      s += `<path d="${roughEllipse(185, 130, 22, 22, 1.2)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // hat
        s += `<path d="M120,100 L180,100 L175,70 L125,70 Z" ${strokeProps()} />`;
        s += `<path d="M115,100 L185,100" ${strokeProps()} />`;
        // mouth
        s += `<path d="M110,190 Q150,210 190,190" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<circle cx="115" cy="130" r="5" fill="${INK}" />`;
        s += `<circle cx="185" cy="130" r="5" fill="${INK}" />`;
      }
      return s;
    },
    snailCup: (lvl) => {
      let s = "";
      // shell as teacup
      s += `<path d="M80,140 Q80,100 140,100 Q200,100 200,140 L210,180 L70,180 Z" ${strokeProps()} />`;
      // handle
      s += `<path d="M200,130 Q235,140 225,170" ${strokeProps()} />`;
      // body
      s += `<path d="M70,180 Q40,200 50,220 Q100,235 230,225 Q250,215 240,195 L210,180 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // eyestalks
        s += `<path d="M55,205 Q45,180 50,165" ${strokeProps()} />`;
        s += `<path d="M65,210 Q60,185 68,170" ${strokeProps()} />`;
        s += `<circle cx="50" cy="163" r="4" ${strokeProps()} />`;
        s += `<circle cx="69" cy="168" r="4" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        // tea line
        s += `<path d="M90,130 Q140,138 190,130" ${lightStroke()} />`;
      }
      return s;
    },
    jellyfish: (lvl) => {
      let s = "";
      s += `<path d="M80,120 Q150,60 220,120 Q215,160 150,160 Q85,160 80,120 Z" ${strokeProps()} />`;
      s += `<path d="M80,120 Q100,145 95,165" ${strokeProps()} />`;
      s += `<path d="M220,120 Q200,145 205,165" ${strokeProps()} />`;
      if (lvl !== "loose") {
        for (let i = 0; i < 6; i++) {
          const x = 100 + i * 20;
          s += `<path d="M${x},160 Q${x + wob(8)},200 ${x + wob(12)},240 Q${x + wob(8)},260 ${x + wob(4)},280" ${strokeProps()} />`;
        }
      }
      if (lvl === "guided") {
        s += `<path d="M80,140 Q150,155 220,140" ${lightStroke()} />`;
      }
      return s;
    },
    bee: (lvl) => {
      let s = "";
      s += `<path d="${roughEllipse(150, 160, 75, 55, 1.5)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // stripes
        s += `<path d="M110,140 Q115,185 120,185" ${strokeProps()} />`;
        s += `<path d="M140,130 Q145,190 150,195" ${strokeProps()} />`;
        s += `<path d="M170,130 Q175,190 180,195" ${strokeProps()} />`;
        // wings
        s += `<path d="${roughEllipse(135, 110, 25, 18, 1)}" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(175, 110, 25, 18, 1)}" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<circle cx="90" cy="150" r="3" fill="${INK}" />`;
        s += `<path d="M78,155 Q75,165 80,170" ${strokeProps()} />`;
      }
      return s;
    },
    lonelyTree: (lvl) => {
      let s = "";
      // hill
      s += `<path d="M20,220 Q150,180 280,220 L280,260 L20,260 Z" ${strokeProps()} />`;
      // tree trunk
      s += `<path d="M145,220 L148,150 Q148,140 152,140 Q155,150 155,220 Z" ${strokeProps()} />`;
      // crown
      s += `<path d="${roughEllipse(150, 120, 55, 45, 2.5)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // mist lines
        s += `<path d="M30,200 Q90,195 150,200" ${lightStroke(1)} />`;
        s += `<path d="M160,205 Q220,200 270,205" ${lightStroke(1)} />`;
      }
      if (lvl === "guided") {
        // horizon
        s += `<path d="M0,230 L300,230" ${lightStroke()} />`;
      }
      return s;
    },
    desertMoon: (lvl) => {
      let s = "";
      s += `<path d="M20,240 Q80,210 140,230 Q210,250 280,220 L280,260 L20,260 Z" ${strokeProps()} />`;
      // moon
      s += `<path d="${roughEllipse(220, 80, 25, 25, 1)}" ${strokeProps()} />`;
      // cactus
      s += `<path d="M90,230 L90,170 Q90,160 100,160 Q110,160 110,175 L110,230 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // cactus arm
        s += `<path d="M110,195 Q125,195 125,180 L125,170" ${strokeProps()} />`;
        // ridges
        s += `<path d="M20,245 Q70,235 140,240" ${lightStroke(1)} />`;
      }
      if (lvl === "guided") {
        s += `<path d="M95,170 L95,225" ${lightStroke()} />`;
        s += `<path d="M105,170 L105,225" ${lightStroke()} />`;
      }
      return s;
    },
    lighthouse: (lvl) => {
      let s = "";
      s += `<path d="M130,230 L120,120 L180,120 L170,230 Z" ${strokeProps()} />`;
      s += `<path d="M115,120 L185,120 L180,105 L120,105 Z" ${strokeProps()} />`;
      s += `<path d="M125,105 L175,105 L170,80 L130,80 Z" ${strokeProps()} />`;
      s += `<path d="M135,80 L165,80 L160,60 L140,60 Z" ${strokeProps()} />`;
      s += `<path d="M20,240 Q150,225 280,245 L280,260 L20,260 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // window
        s += `<rect x="142" y="88" width="16" height="14" ${strokeProps()} />`;
        // stripes
        s += `<path d="M122,160 L178,160" ${strokeProps()} />`;
        s += `<path d="M124,190 L176,190" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<path d="M160,70 L250,40" ${lightStroke()} />`;
        s += `<path d="M160,70 L260,90" ${lightStroke()} />`;
      }
      return s;
    },
    terraces: (lvl) => {
      let s = "";
      for (let i = 0; i < 5; i++) {
        const y = 80 + i * 30;
        const offset = i * 5;
        s += `<path d="M${30 + offset},${y} Q150,${y - 10} ${270 - offset},${y + 5} Q150,${y + 20} ${30 + offset},${y + 15} Z" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<path d="M150,60 L150,260" ${lightStroke()} />`;
      }
      return s;
    },
    frozenLake: (lvl) => {
      let s = "";
      s += `<path d="M30,180 Q150,160 270,180 Q270,220 150,230 Q30,220 30,180 Z" ${strokeProps()} />`;
      // skater dot
      s += `<circle cx="150" cy="195" r="5" fill="${INK}" />`;
      s += `<path d="M150,200 L150,215" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // pine trees silhouette
        s += `<path d="M50,180 L45,140 L35,180 Z" ${strokeProps()} />`;
        s += `<path d="M80,180 L75,130 L65,180 Z" ${strokeProps()} />`;
        s += `<path d="M240,180 L235,135 L225,180 Z" ${strokeProps()} />`;
        s += `<path d="M270,180 L265,150 L255,180 Z" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<path d="M40,205 Q150,198 260,205" ${lightStroke()} />`;
      }
      return s;
    },
    hotSpring: (lvl) => {
      let s = "";
      // spring pool
      s += `<path d="${roughEllipse(150, 200, 100, 30, 2)}" ${strokeProps()} />`;
      // rocks
      s += `<path d="${roughEllipse(60, 185, 25, 15, 2)}" ${strokeProps()} />`;
      s += `<path d="${roughEllipse(240, 190, 30, 18, 2)}" ${strokeProps()} />`;
      // pines
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 60;
        const h = 60 + Math.random() * 30;
        s += `<path d="M${x - 15},140 L${x},140-${h} L${x + 15},140 Z" ${strokeProps()} />`.replace("140-", "");
        s += `<path d="M${x - 15},140 L${x},${140 - h} L${x + 15},140 Z" ${strokeProps()} />`;
      }
      if (lvl !== "loose") {
        // steam curls
        s += `<path d="M120,190 Q115,170 130,160 Q140,150 125,140" ${lightStroke(1.2)} />`;
        s += `<path d="M170,195 Q175,175 160,165 Q150,155 170,145" ${lightStroke(1.2)} />`;
      }
      return s;
    },
    readingNook: (lvl) => {
      let s = "";
      // sloped ceiling
      s += `<path d="M30,60 L270,180 L270,260 L30,260 Z" ${strokeProps()} />`;
      // window
      s += `<path d="M150,100 L250,175 L250,225 L150,225 Z" ${strokeProps()} />`;
      s += `<path d="M150,162 L250,200" ${strokeProps()} />`;
      s += `<path d="M200,130 L200,225" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // cushion
        s += `<path d="M45,235 Q80,210 130,215 L130,260 L45,260 Z" ${strokeProps()} />`;
        // book
        s += `<path d="M70,225 L100,222 L100,212 L70,215 Z" ${strokeProps()} />`;
      }
      return s;
    },
    bookshelf: (lvl) => {
      let s = "";
      // shelf box
      s += rough(50, 40, 200, 220) ? `<path d="${rough(50, 40, 200, 220, 1.5)}" ${strokeProps()} />` : "";
      // shelves
      for (let i = 1; i < 5; i++) {
        s += `<line x1="52" y1="${40 + i * 44}" x2="248" y2="${40 + i * 44}" ${strokeProps()} />`;
      }
      if (lvl !== "loose") {
        // books
        for (let row = 0; row < 4; row++) {
          let x = 55;
          while (x < 240) {
            const w = 10 + Math.random() * 14;
            const h = 30 + Math.random() * 8;
            s += `<rect x="${x}" y="${40 + row * 44 + (44 - h)}" width="${w}" height="${h}" ${strokeProps(1.2)} />`;
            x += w + 2;
          }
        }
        // sleeping cat on top shelf
        s += `<path d="M160,225 Q155,215 165,212 Q175,210 185,215 Q200,214 210,220 Q215,227 200,228 L165,228 Z" ${strokeProps()} />`;
      }
      return s;
    },
    bathhouse: (lvl) => {
      let s = "";
      // wall left
      s += `<path d="M30,260 L30,100 L90,100 L90,260 Z" ${strokeProps()} />`;
      s += `<path d="M210,260 L210,100 L270,100 L270,260 Z" ${strokeProps()} />`;
      // bathhouse middle, lower
      s += `<path d="M90,260 L90,140 Q150,100 210,140 L210,260 Z" ${strokeProps()} />`;
      // roof curve
      s += `<path d="M80,140 Q150,110 220,140 L215,135 Q150,108 85,135 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // chimney with steam
        s += `<rect x="140" y="105" width="20" height="30" ${strokeProps()} />`;
        s += `<path d="M150,95 Q140,80 150,65 Q160,55 148,45" ${lightStroke(1.2)} />`;
        // door
        s += `<path d="M140,260 L140,210 Q150,200 160,210 L160,260" ${strokeProps()} />`;
        // lanterns
        s += `<circle cx="110" cy="180" r="7" ${strokeProps()} />`;
        s += `<circle cx="190" cy="180" r="7" ${strokeProps()} />`;
      }
      return s;
    },
    cafeSteam: (lvl) => {
      let s = "";
      // counter
      s += `<line x1="20" y1="240" x2="280" y2="240" ${strokeProps(2)} />`;
      // mug
      s += `<path d="M90,190 L90,235 Q90,240 95,240 L145,240 Q150,240 150,235 L150,190 Z" ${strokeProps()} />`;
      s += `<path d="M150,200 Q175,200 175,220 Q175,235 150,235" ${strokeProps()} />`;
      // second mug
      s += `<path d="M180,195 L180,235 L210,235 L210,195 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // steam
        s += `<path d="M115,185 Q110,170 120,160 Q128,150 118,140" ${lightStroke(1.3)} />`;
        s += `<path d="M195,190 Q190,175 200,165" ${lightStroke(1.3)} />`;
        // saucer
        s += `<path d="M80,240 L160,240" ${strokeProps()} />`;
      }
      return s;
    },
    greenhouse: (lvl) => {
      let s = "";
      s += `<path d="M40,260 L40,120 L150,70 L260,120 L260,260 Z" ${strokeProps()} />`;
      s += `<line x1="40" y1="120" x2="260" y2="120" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // window panes
        for (let i = 1; i < 4; i++) {
          s += `<line x1="${40 + i * 55}" y1="120" x2="${40 + i * 55}" y2="260" ${strokeProps(1)} />`;
        }
        s += `<line x1="40" y1="180" x2="260" y2="180" ${strokeProps(1)} />`;
        s += `<line x1="40" y1="220" x2="260" y2="220" ${strokeProps(1)} />`;
        // plant silhouettes inside
        s += `<path d="${roughEllipse(75, 215, 10, 20, 1)}" ${strokeProps(1)} />`;
        s += `<path d="${roughEllipse(140, 210, 14, 25, 1)}" ${strokeProps(1)} />`;
        s += `<path d="${roughEllipse(210, 215, 12, 22, 1)}" ${strokeProps(1)} />`;
      }
      return s;
    },
    crookedHouse: (lvl) => {
      let s = "";
      s += `<path d="M60,260 L55,140 L150,80 L245,145 L240,260 Z" ${strokeProps()} />`;
      // multiple chimneys
      s += `<rect x="90" y="90" width="20" height="35" ${strokeProps()} />`;
      s += `<rect x="130" y="85" width="16" height="40" ${strokeProps()} />`;
      s += `<rect x="180" y="95" width="18" height="30" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // windows
        s += `<rect x="85" y="170" width="30" height="35" ${strokeProps(1.2)} />`;
        s += `<rect x="135" y="165" width="30" height="38" ${strokeProps(1.2)} />`;
        s += `<rect x="185" y="175" width="30" height="35" ${strokeProps(1.2)} />`;
        // door
        s += `<path d="M140,260 L140,220 Q150,212 160,220 L160,260" ${strokeProps()} />`;
      }
      return s;
    },
    monstera: (lvl) => {
      let s = "";
      s += `<path d="M150,260 Q148,180 150,90" ${strokeProps(2)} />`;
      // leaf outline
      s += `<path d="M150,100 Q60,110 50,180 Q80,230 150,220 Q220,230 250,180 Q240,110 150,100 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // splits
        s += `<path d="M90,130 Q110,160 100,200" ${strokeProps()} />`;
        s += `<path d="M150,110 L150,220" ${strokeProps()} />`;
        s += `<path d="M210,130 Q190,160 200,200" ${strokeProps()} />`;
        // holes
        s += `<path d="${roughEllipse(120, 175, 10, 15, 1)}" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(180, 175, 10, 15, 1)}" ${strokeProps()} />`;
      }
      return s;
    },
    weedBouquet: (lvl) => {
      let s = "";
      // stems
      for (let i = 0; i < 6; i++) {
        const x = 120 + i * 10;
        s += `<path d="M150,240 Q${x + wob(10)},180 ${x - 10 + wob(15)},100" ${strokeProps()} />`;
      }
      if (lvl !== "loose") {
        // flower/bud heads
        s += `<circle cx="110" cy="100" r="8" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(135, 90, 6, 10, 1)}" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(155, 85, 8, 5, 1)}" ${strokeProps()} />`;
        s += `<circle cx="180" cy="100" r="10" ${strokeProps()} />`;
        s += `<path d="${roughEllipse(200, 95, 5, 8, 1)}" ${strokeProps()} />`;
        // wrap
        s += `<path d="M130,235 L170,235 L175,250 L125,250 Z" ${strokeProps()} />`;
      }
      return s;
    },
    pomegranate: (lvl) => {
      let s = "";
      // whole
      s += `<path d="${roughEllipse(95, 160, 55, 60, 1.5)}" ${strokeProps()} />`;
      s += `<path d="M90,100 L95,115 L100,100" ${strokeProps()} />`;
      // cut half
      s += `<path d="${roughEllipse(210, 160, 60, 60, 1.5)}" ${strokeProps()} />`;
      s += `<path d="M150,160 Q210,150 270,160" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // seeds
        for (let i = 0; i < 14; i++) {
          const x = 160 + Math.random() * 100;
          const y = 165 + Math.random() * 45;
          s += `<circle cx="${x}" cy="${y}" r="3" ${strokeProps(1)} />`;
        }
      }
      return s;
    },
    rosemary: (lvl) => {
      let s = "";
      s += `<path d="M50,240 Q100,180 180,130 Q240,95 265,75" ${strokeProps()} />`;
      if (lvl !== "loose") {
        for (let i = 0; i < 10; i++) {
          const t = i / 10;
          const cx = 50 + t * 215;
          const cy = 240 - t * 165;
          s += `<path d="M${cx},${cy} L${cx - 8},${cy - 6} M${cx},${cy} L${cx + 8},${cy - 6}" ${strokeProps()} />`;
        }
      }
      return s;
    },
    mushroomCluster: (lvl) => {
      let s = "";
      const caps = [[80, 180, 30], [130, 160, 40], [180, 175, 35], [220, 190, 25]];
      caps.forEach(([x, y, r]) => {
        s += `<path d="${roughEllipse(x, y, r, r * 0.7, 1.5)}" ${strokeProps()} />`;
        s += `<path d="M${x - r * 0.6},${y + 5} Q${x - r * 0.5},${y + 40} ${x + r * 0.5},${y + 40} Q${x + r * 0.6},${y + 5}" ${strokeProps()} />`;
      });
      if (lvl !== "loose") {
        caps.forEach(([x, y, r]) => {
          s += `<circle cx="${x - r * 0.3}" cy="${y - 3}" r="3" ${strokeProps()} />`;
          s += `<circle cx="${x + r * 0.2}" cy="${y + 3}" r="2" ${strokeProps()} />`;
        });
      }
      return s;
    },
    fig: (lvl) => {
      let s = "";
      s += `<path d="M100,200 Q60,180 70,130 Q85,100 110,100 Q130,110 110,200 Z" ${strokeProps()} />`;
      s += `<path d="${roughEllipse(200, 160, 60, 50, 1.5)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // inner fig
        s += `<path d="${roughEllipse(200, 160, 48, 38, 1.5)}" ${strokeProps()} />`;
        // tiny seeds
        for (let i = 0; i < 20; i++) {
          const x = 160 + Math.random() * 80;
          const y = 130 + Math.random() * 60;
          s += `<circle cx="${x}" cy="${y}" r="1.5" fill="${INK}" />`;
        }
      }
      return s;
    },
    poppy: (lvl) => {
      let s = "";
      s += `<path d="M150,240 Q155,180 145,120" ${strokeProps()} />`;
      s += `<path d="${roughEllipse(135, 90, 35, 30, 2.2)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // petals
        s += `<path d="M120,75 Q110,90 125,95" ${strokeProps()} />`;
        s += `<path d="M155,80 Q170,90 160,105" ${strokeProps()} />`;
        s += `<circle cx="135" cy="95" r="6" ${strokeProps()} />`;
        // leaf
        s += `<path d="M148,170 Q175,165 180,145 Q170,155 150,160" ${strokeProps()} />`;
      }
      return s;
    },
    pancakes: (lvl) => {
      let s = "";
      for (let i = 0; i < 4; i++) {
        s += `<path d="${roughEllipse(150 + wob(10), 220 - i * 22, 85, 14, 1.5)}" ${strokeProps()} />`;
      }
      if (lvl !== "loose") {
        // syrup drip
        s += `<path d="M110,150 Q120,170 130,160 Q140,180 150,165 Q170,185 180,170 Q190,190 195,175" ${strokeProps()} />`;
        // butter pat
        s += `<rect x="140" y="135" width="20" height="12" ${strokeProps()} />`;
      }
      return s;
    },
    ramen: (lvl) => {
      let s = "";
      s += `<path d="M50,170 Q150,160 250,170 L240,240 Q150,255 60,240 Z" ${strokeProps()} />`;
      s += `<path d="M45,170 Q150,165 255,170" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // egg
        s += `<path d="${roughEllipse(120, 190, 22, 15, 1)}" ${strokeProps()} />`;
        s += `<circle cx="118" cy="188" r="6" ${strokeProps()} />`;
        // noodles
        s += `<path d="M80,180 Q120,175 160,185 Q200,180 220,180" ${strokeProps()} />`;
        s += `<path d="M90,195 Q130,190 170,200" ${strokeProps()} />`;
        // nori
        s += `<rect x="170" y="175" width="15" height="25" ${strokeProps()} />`;
        // green onion dots
        for (let i = 0; i < 6; i++) {
          s += `<circle cx="${150 + i * 10}" cy="${175 + wob(4)}" r="2" fill="${INK}" />`;
        }
        // steam
        s += `<path d="M130,160 Q125,140 135,125" ${lightStroke(1.2)} />`;
        s += `<path d="M190,160 Q195,140 188,125" ${lightStroke(1.2)} />`;
      }
      return s;
    },
    cakeSlice: (lvl) => {
      let s = "";
      s += `<path d="M60,240 L100,130 L220,130 L250,240 Z" ${strokeProps()} />`;
      s += `<path d="M60,240 L250,240" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // layers
        s += `<path d="M75,180 L235,180" ${strokeProps()} />`;
        s += `<path d="M90,215 L240,215" ${strokeProps()} />`;
        // top decoration
        s += `<path d="M110,130 Q140,120 170,130 Q200,120 220,130" ${strokeProps()} />`;
        s += `<circle cx="160" cy="118" r="5" ${strokeProps()} />`;
      }
      return s;
    },
    strawberry: (lvl) => {
      let s = "";
      s += `<path d="M150,100 Q95,105 100,165 Q130,230 150,240 Q170,230 200,165 Q205,105 150,100 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // leaves
        s += `<path d="M125,95 L115,70 L140,90 L145,65 L160,90 L170,70 L175,95 Z" ${strokeProps()} />`;
        // seeds
        for (let i = 0; i < 14; i++) {
          const x = 115 + Math.random() * 70;
          const y = 130 + Math.random() * 80;
          s += `<path d="M${x},${y} L${x + 3},${y + 6}" ${strokeProps(1.4)} />`;
        }
      }
      return s;
    },
    croissant: (lvl) => {
      let s = "";
      s += `<path d="M60,180 Q90,120 150,110 Q210,120 240,180 Q230,200 200,195 Q180,170 150,165 Q120,170 100,195 Q70,200 60,180 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // layers
        s += `<path d="M80,170 Q90,155 105,165" ${strokeProps()} />`;
        s += `<path d="M115,150 Q135,138 155,148" ${strokeProps()} />`;
        s += `<path d="M165,150 Q185,138 205,148" ${strokeProps()} />`;
        s += `<path d="M210,170 Q220,155 230,165" ${strokeProps()} />`;
      }
      return s;
    },
    steamingMug: (lvl) => {
      let s = "";
      s += `<path d="M90,140 L90,225 Q90,235 100,235 L200,235 Q210,235 210,225 L210,140 Z" ${strokeProps()} />`;
      s += `<path d="M210,155 Q245,160 240,200 Q230,225 210,220" ${strokeProps()} />`;
      if (lvl !== "loose") {
        s += `<path d="M125,130 Q120,105 135,85 Q145,70 135,55" ${lightStroke(1.4)} />`;
        s += `<path d="M155,130 Q160,110 150,90 Q140,75 155,60" ${lightStroke(1.4)} />`;
        s += `<path d="M180,130 Q175,110 185,95" ${lightStroke(1.4)} />`;
      }
      return s;
    },
    key: (lvl) => {
      let s = "";
      s += `<circle cx="90" cy="150" r="40" ${strokeProps()} />`;
      s += `<circle cx="90" cy="150" r="15" ${strokeProps()} />`;
      s += `<path d="M130,150 L250,150 L250,160 L130,160 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // teeth
        s += `<path d="M230,160 L230,175 L220,175 L220,160" ${strokeProps()} />`;
        s += `<path d="M205,160 L205,180 L195,180 L195,160" ${strokeProps()} />`;
      }
      return s;
    },
    teacupChip: (lvl) => {
      let s = "";
      s += `<path d="M80,140 L85,230 Q85,240 95,240 L195,240 Q205,240 205,230 L210,140 Z" ${strokeProps()} />`;
      s += `<path d="M205,170 Q240,180 235,215 Q225,230 205,225" ${strokeProps()} />`;
      // saucer
      s += `<path d="M55,245 L235,245" ${strokeProps()} />`;
      s += `<path d="M45,250 Q145,260 245,250" ${strokeProps()} />`;
      // chip on rim
      s += `<path d="M140,140 L148,130 L160,142" ${strokeProps()} />`;
      if (lvl !== "loose") {
        s += `<path d="M85,160 Q145,168 205,160" ${lightStroke()} />`;
      }
      return s;
    },
    scissors: (lvl) => {
      let s = "";
      s += `<circle cx="80" cy="200" r="25" ${strokeProps()} />`;
      s += `<circle cx="80" cy="100" r="25" ${strokeProps()} />`;
      s += `<path d="M95,115 L240,175 L240,185 L95,140 Z" ${strokeProps()} />`;
      s += `<path d="M95,185 L240,145" ${strokeProps()} />`;
      return s;
    },
    matchbook: (lvl) => {
      let s = "";
      s += rough(60, 80, 180, 160, 1.5) ? `<path d="${rough(60, 80, 180, 160, 1.5)}" ${strokeProps()} />` : "";
      s += `<path d="M60,130 L240,130" ${strokeProps()} />`;
      if (lvl !== "loose") {
        for (let i = 0; i < 6; i++) {
          const x = 80 + i * 25;
          s += `<path d="M${x},230 L${x},160" ${strokeProps()} />`;
          s += `<circle cx="${x}" cy="155" r="3" fill="${INK}" />`;
        }
        // missing match
        s += `<path d="M180,230 L180,170" ${lightStroke()} />`;
      }
      return s;
    },
    pocketWatch: (lvl) => {
      let s = "";
      s += `<circle cx="150" cy="160" r="75" ${strokeProps()} />`;
      s += `<path d="M145,80 L155,80 L158,70 L142,70 Z" ${strokeProps()} />`;
      s += `<path d="M148,70 L152,55" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // hands
        s += `<path d="M150,160 L150,110" ${strokeProps(2)} />`;
        s += `<path d="M150,160 L185,170" ${strokeProps(2)} />`;
        // ticks
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 150 + Math.cos(a) * 65, y1 = 160 + Math.sin(a) * 65;
          const x2 = 150 + Math.cos(a) * 70, y2 = 160 + Math.sin(a) * 70;
          s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${strokeProps(1.2)} />`;
        }
      }
      return s;
    },
    dice: (lvl) => {
      let s = "";
      s += rough(80, 100, 140, 140, 1.5) ? `<path d="${rough(80, 100, 140, 140, 1.5)}" ${strokeProps()} />` : "";
      // checker bg
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        if ((r + c) % 2 === 0) continue;
        s += `<rect x="${15 + c * 70}" y="${245 + r * 5}" width="70" height="5" fill="${INK_LIGHT}" opacity="0.25" />`;
      }
      if (lvl !== "loose") {
        s += `<circle cx="130" cy="150" r="5" fill="${INK}" />`;
        s += `<circle cx="170" cy="150" r="5" fill="${INK}" />`;
        s += `<circle cx="150" cy="170" r="5" fill="${INK}" />`;
        s += `<circle cx="130" cy="190" r="5" fill="${INK}" />`;
        s += `<circle cx="170" cy="190" r="5" fill="${INK}" />`;
      }
      return s;
    },
    polaroid: (lvl) => {
      let s = "";
      s += rough(60, 60, 180, 200, 1.5) ? `<path d="${rough(60, 60, 180, 200, 1.5)}" ${strokeProps()} />` : "";
      s += rough(75, 75, 150, 140, 1.2) ? `<path d="${rough(75, 75, 150, 140, 1.2)}" ${strokeProps()} />` : "";
      if (lvl !== "loose") {
        // beach scene
        s += `<path d="M80,180 Q150,170 220,180 L220,210 L80,210 Z" ${strokeProps()} />`;
        s += `<circle cx="180" cy="110" r="14" ${strokeProps()} />`;
        s += `<path d="M85,200 Q150,195 215,200" ${lightStroke()} />`;
      }
      return s;
    },
    crescentMoon: (lvl) => {
      let s = "";
      s += `<path d="M150,80 Q90,100 90,170 Q90,240 160,240 Q130,200 125,170 Q125,130 150,80 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // clouds around
        s += `<path d="M30,120 Q80,110 130,125 Q150,140 120,150 Q70,145 30,140 Z" ${strokeProps()} />`;
        s += `<path d="M170,210 Q220,200 265,215 Q260,230 200,235 Q170,230 170,210 Z" ${strokeProps()} />`;
      }
      return s;
    },
    comet: (lvl) => {
      let s = "";
      s += `<circle cx="220" cy="90" r="18" ${strokeProps()} />`;
      s += `<path d="M210,105 Q150,140 80,240" ${strokeProps(2)} />`;
      s += `<path d="M220,110 Q170,150 110,240" ${strokeProps(1.5)} />`;
      s += `<path d="M230,105 Q190,150 150,240" ${strokeProps(1.2)} />`;
      if (lvl !== "loose") {
        // stars around
        for (let i = 0; i < 8; i++) {
          const x = 30 + Math.random() * 240;
          const y = 30 + Math.random() * 100;
          s += `<path d="M${x},${y - 4} L${x},${y + 4} M${x - 4},${y} L${x + 4},${y}" ${strokeProps(1)} />`;
        }
      }
      return s;
    },
    rainCloud: (lvl) => {
      let s = "";
      s += `<path d="M60,130 Q40,100 70,90 Q85,60 120,70 Q145,50 170,70 Q210,65 220,100 Q250,110 235,145 Q200,160 150,155 Q90,160 60,130 Z" ${strokeProps()} />`;
      // tiny house below
      s += `<path d="M130,240 L130,200 L150,185 L170,200 L170,240 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // rain lines
        for (let i = 0; i < 10; i++) {
          const x = 70 + i * 18;
          s += `<line x1="${x}" y1="165" x2="${x - 4}" y2="185" ${strokeProps(1.2)} />`;
        }
      }
      return s;
    },
    constellation: (lvl) => {
      let s = "";
      const pts = [[60, 80], [110, 130], [170, 100], [220, 150], [180, 210], [90, 220]];
      pts.forEach(([x, y]) => {
        s += `<circle cx="${x}" cy="${y}" r="4" fill="${INK}" />`;
      });
      if (lvl !== "loose") {
        for (let i = 0; i < pts.length - 1; i++) {
          s += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[i + 1][0]}" y2="${pts[i + 1][1]}" ${strokeProps(1.2)} />`;
        }
      }
      if (lvl === "guided") {
        s += `<path d="M60,80 Q150,150 90,220" ${lightStroke()} />`;
      }
      return s;
    },
    layeredSunset: (lvl) => {
      let s = "";
      s += `<circle cx="150" cy="140" r="30" ${strokeProps()} />`;
      for (let i = 0; i < 4; i++) {
        const y = 170 + i * 22;
        s += `<path d="M20,${y} Q${80 + i * 20},${y - 8 - i * 3} 150,${y} Q${220 - i * 20},${y + 8 + i * 3} 280,${y}" ${strokeProps()} />`;
      }
      return s;
    },
    foggyBridge: (lvl) => {
      let s = "";
      // bridge arch
      s += `<path d="M30,200 L30,170 Q150,120 270,170 L270,200" ${strokeProps()} />`;
      s += `<path d="M30,200 L270,200" ${strokeProps()} />`;
      s += `<path d="M30,200 L30,240" ${strokeProps()} />`;
      s += `<path d="M270,200 L270,240" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // fog
        s += `<path d="M0,180 Q80,175 140,185 Q200,175 300,180" ${lightStroke(1.5)} />`;
        s += `<path d="M0,220 Q80,215 140,225 Q200,215 300,220" ${lightStroke(1.5)} />`;
      }
      return s;
    },
    owlGlasses: (lvl) => {
      let s = "";
      s += `<path d="${roughEllipse(150, 170, 80, 90, 1.8)}" ${strokeProps()} />`;
      // ear tufts
      s += `<path d="M95,100 L105,85 L115,105 Z" ${strokeProps()} />`;
      s += `<path d="M205,100 L195,85 L185,105 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // glasses
        s += `<circle cx="125" cy="150" r="20" ${strokeProps(2)} />`;
        s += `<circle cx="175" cy="150" r="20" ${strokeProps(2)} />`;
        s += `<line x1="145" y1="150" x2="155" y2="150" ${strokeProps(2)} />`;
        // beak
        s += `<path d="M145,175 L155,175 L150,185 Z" ${strokeProps()} />`;
      }
      return s;
    },
    foxRoll: (lvl) => {
      let s = "";
      s += `<path d="${roughEllipse(150, 160, 90, 70, 2)}" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // ears
        s += `<path d="M90,120 L80,90 L110,110 Z" ${strokeProps()} />`;
        // tail spiral
        s += `<path d="M210,160 Q240,170 225,195 Q205,200 195,175" ${strokeProps()} />`;
        // closed eye
        s += `<path d="M120,150 Q130,155 140,150" ${strokeProps()} />`;
      }
      return s;
    },
    dragonCoins: (lvl) => {
      let s = "";
      // coin pile
      for (let i = 0; i < 8; i++) {
        s += `<ellipse cx="${100 + (i % 3) * 30}" cy="${230 - Math.floor(i / 3) * 8}" rx="18" ry="4" ${strokeProps()} />`;
      }
      // dragon body
      s += `<path d="M70,200 Q90,170 150,160 Q220,160 240,200" ${strokeProps()} />`;
      s += `<path d="M200,170 Q215,140 240,145 Q245,160 230,175" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // spikes
        s += `<path d="M100,180 L105,170 L110,180" ${strokeProps()} />`;
        s += `<path d="M130,175 L135,165 L140,175" ${strokeProps()} />`;
        s += `<path d="M160,170 L165,160 L170,170" ${strokeProps()} />`;
        s += `<circle cx="232" cy="155" r="2" fill="${INK}" />`;
      }
      return s;
    },
    windowFace: (lvl) => {
      let s = "";
      s += rough(60, 60, 180, 200, 1.5) ? `<path d="${rough(60, 60, 180, 200, 1.5)}" ${strokeProps()} />` : "";
      s += `<line x1="150" y1="60" x2="150" y2="260" ${strokeProps()} />`;
      s += `<line x1="60" y1="160" x2="240" y2="160" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // silhouette
        s += `<path d="${roughEllipse(105, 130, 18, 22, 1)}" ${strokeProps()} />`;
        s += `<path d="M85,150 L85,200 L125,200 L125,150" ${strokeProps()} />`;
      }
      return s;
    },
    closedFace: (lvl) => {
      let s = "";
      s += `<path d="M90,120 Q90,80 150,75 Q210,80 210,120 L205,195 Q190,240 150,240 Q110,240 95,195 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        s += `<path d="M110,140 Q125,145 140,140" ${strokeProps(1.8)} />`;
        s += `<path d="M160,140 Q175,145 190,140" ${strokeProps(1.8)} />`;
        s += `<path d="M145,165 L145,180 L155,185" ${strokeProps()} />`;
        s += `<path d="M130,210 Q150,215 170,210" ${strokeProps()} />`;
      }
      if (lvl === "guided") {
        s += `<line x1="150" y1="75" x2="150" y2="240" ${lightStroke()} />`;
        s += `<line x1="90" y1="145" x2="210" y2="145" ${lightStroke()} />`;
      }
      return s;
    },
    laughFace: (lvl) => {
      let s = "";
      s += `<path d="M85,120 Q85,75 150,70 Q215,75 215,120 L210,200 Q200,245 150,245 Q100,245 90,200 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // closed eyes (crinkled)
        s += `<path d="M110,135 Q120,125 135,135" ${strokeProps(2)} />`;
        s += `<path d="M165,135 Q175,125 190,135" ${strokeProps(2)} />`;
        // open mouth
        s += `<path d="M120,190 Q150,225 180,190 Q160,205 120,190 Z" ${strokeProps()} />`;
      }
      return s;
    },
    baristaFace: (lvl) => {
      let s = "";
      s += `<path d="M90,130 Q90,85 150,82 Q210,85 210,130 L205,200 Q190,245 150,245 Q110,245 95,200 Z" ${strokeProps()} />`;
      // apron top (little)
      s += `<path d="M80,260 L120,245 L180,245 L220,260" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // tired eyes
        s += `<path d="M115,145 Q125,150 135,145" ${strokeProps()} />`;
        s += `<path d="M165,145 Q175,150 185,145" ${strokeProps()} />`;
        // flat mouth
        s += `<path d="M135,210 L165,210" ${strokeProps()} />`;
        // cap / hair
        s += `<path d="M85,120 Q110,95 150,92 Q190,95 215,120" ${strokeProps()} />`;
      }
      return s;
    },
    blobs: (lvl) => {
      let s = "";
      const blobs = [[90, 120, 50], [180, 100, 45], [150, 180, 60], [220, 200, 40], [90, 220, 35]];
      blobs.forEach(([x, y, r]) => {
        s += `<path d="${roughEllipse(x, y, r, r * (0.7 + Math.random() * 0.4), 2)}" ${strokeProps()} />`;
      });
      return s;
    },
    bands: (lvl) => {
      let s = "";
      for (let i = 0; i < 6; i++) {
        const y = 50 + i * 35;
        s += `<path d="M20,${y} Q80,${y + wob(15)} 150,${y + wob(10)} Q220,${y + wob(15)} 280,${y}" ${strokeProps(2)} />`;
      }
      return s;
    },
    radial: (lvl) => {
      let s = "";
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const x2 = 150 + Math.cos(a) * (90 + wob(20));
        const y2 = 150 + Math.sin(a) * (90 + wob(20));
        s += `<line x1="150" y1="150" x2="${x2}" y2="${y2}" ${strokeProps()} />`;
      }
      s += `<circle cx="150" cy="150" r="8" ${strokeProps()} />`;
      return s;
    },
    arches: (lvl) => {
      let s = "";
      for (let i = 0; i < 4; i++) {
        const r = 40 + i * 25;
        s += `<path d="M${150 - r},240 L${150 - r},${240 - r} Q${150 - r},${240 - r * 2} 150,${240 - r * 2} Q${150 + r},${240 - r * 2} ${150 + r},${240 - r} L${150 + r},240" ${strokeProps()} />`;
      }
      return s;
    },
    dots: (lvl) => {
      let s = "";
      const rows = 10, cols = 10;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = 50 + c * 22 + wob(3);
        const y = 50 + r * 22 + wob(3);
        s += `<circle cx="${x}" cy="${y}" r="${3 + Math.random() * 2}" fill="${INK}" />`;
      }
      return s;
    },
    gesture: (lvl) => {
      let s = "";
      s += `<path d="M40,200 Q100,120 160,180 Q220,240 260,100" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" />`;
      return s;
    },
    fridge: (lvl) => {
      let s = "";
      s += rough(60, 40, 180, 220, 1.5) ? `<path d="${rough(60, 40, 180, 220, 1.5)}" ${strokeProps()} />` : "";
      // shelves
      s += `<line x1="60" y1="100" x2="240" y2="100" ${strokeProps()} />`;
      s += `<line x1="60" y1="160" x2="240" y2="160" ${strokeProps()} />`;
      s += `<line x1="60" y1="210" x2="240" y2="210" ${strokeProps()} />`;
      if (lvl !== "loose") {
        // items
        s += `<rect x="75" y="60" width="40" height="35" ${strokeProps(1.2)} />`;
        s += `<circle cx="150" cy="80" r="15" ${strokeProps(1.2)} />`;
        s += `<rect x="185" y="65" width="20" height="30" ${strokeProps(1.2)} />`;
        s += `<path d="${roughEllipse(100, 135, 18, 18, 1)}" ${strokeProps(1.2)} />`;
        s += `<rect x="140" y="115" width="60" height="40" ${strokeProps(1.2)} />`;
        s += `<rect x="75" y="170" width="25" height="35" ${strokeProps(1.2)} />`;
        s += `<path d="${roughEllipse(150, 185, 20, 15, 1)}" ${strokeProps(1.2)} />`;
      }
      return s;
    },
    desk: (lvl) => {
      let s = "";
      s += `<line x1="30" y1="220" x2="270" y2="220" ${strokeProps(2)} />`;
      // laptop
      s += `<path d="M90,220 L120,160 L220,160 L240,220 Z" ${strokeProps()} />`;
      // mug
      s += `<path d="M50,220 L50,185 L85,185 L85,220" ${strokeProps()} />`;
      // papers
      s += rough(130, 170, 60, 35, 1) ? `<path d="${rough(130, 170, 60, 35, 1)}" ${strokeProps()} />` : "";
      if (lvl !== "loose") {
        // pen
        s += `<line x1="160" y1="215" x2="200" y2="225" ${strokeProps()} />`;
        // headphones tangle
        s += `<path d="M240,180 Q260,200 245,215 Q265,220 250,200" ${strokeProps(1.2)} />`;
      }
      return s;
    },
    wires: (lvl) => {
      let s = "";
      // tangled path
      s += `<path d="M40,130 Q80,60 120,130 Q160,220 200,130 Q240,50 270,150 Q250,220 180,200 Q110,180 60,220" ${strokeProps(2)} />`;
      s += `<path d="M60,150 Q100,100 150,160 Q200,220 230,140" ${strokeProps(1.5)} />`;
      if (lvl !== "loose") {
        // earbuds at ends
        s += `<circle cx="40" cy="130" r="7" ${strokeProps()} />`;
        s += `<circle cx="230" cy="140" r="7" ${strokeProps()} />`;
      }
      return s;
    },
    droopyPlant: (lvl) => {
      let s = "";
      // pot
      s += `<path d="M100,200 L90,260 L210,260 L200,200 Z" ${strokeProps()} />`;
      s += `<path d="M100,200 L200,200" ${strokeProps()} />`;
      // droopy leaves
      s += `<path d="M130,200 Q120,170 100,165 Q85,165 90,180" ${strokeProps()} />`;
      s += `<path d="M150,200 Q145,160 155,125 Q150,115 140,120" ${strokeProps()} />`;
      s += `<path d="M170,200 Q180,170 205,170 Q215,170 210,185" ${strokeProps()} />`;
      return s;
    },
    sock: (lvl) => {
      let s = "";
      s += `<path d="M110,80 L110,180 Q90,195 90,220 L180,220 Q180,200 160,185 L160,80 Z" ${strokeProps()} />`;
      if (lvl !== "loose") {
        s += `<line x1="110" y1="95" x2="160" y2="95" ${strokeProps()} />`;
        s += `<line x1="110" y1="110" x2="160" y2="110" ${strokeProps()} />`;
      }
      return s;
    },
  };

  function render(shapeKey, complexity = "medium") {
    const draw = shapes[shapeKey] || shapes.blobs;
    const inner = draw(complexity);
    return `<svg viewBox="0 0 300 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  return { render, shapes };
})();
