import * as THREE from 'three';

export interface ArenaFloorTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

/**
 * ArenaFloorTextureGenerator - High-Fidelity 2048x2048 Procedural PBR Canvas Maps
 * Implements the Neon Trading Floor specification from docs/arena/prd.md & docs/arena/arena.png:
 * - Central Iconic Bull Mascot Emblem (Crimson outline + glowing green horns/eyes)
 * - Financial Candlestick Charts (Bullish green & Bearish red with wick lines)
 * - Key Financial Demarcation Levels ($100K RESISTANCE, $85K PIVOT, $69K BREAKOUT, $42K SUPPORT)
 * - Modular graphite tile seams with Sobel normal mapping
 * - High-roughness satin finish eliminating specular glare
 */
export class ArenaFloorTextureGenerator {
  private static cachedTextures: ArenaFloorTextures | null = null;

  public static generateTextures(): ArenaFloorTextures {
    if (this.cachedTextures) return this.cachedTextures;

    const size = 2048;

    // 1. Synthesize Canvas Layers
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d')!;

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = size;
    emissiveCanvas.height = size;
    const eCtx = emissiveCanvas.getContext('2d')!;

    const roughnessCanvas = document.createElement('canvas');
    roughnessCanvas.width = size;
    roughnessCanvas.height = size;
    const rCtx = roughnessCanvas.getContext('2d')!;

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = size;
    heightCanvas.height = size;
    const hCtx = heightCanvas.getContext('2d')!;

    // --- STEP 1: BASE GRAPHITE TILE GRID ---
    // Albedo: Dark graphite asphalt
    aCtx.fillStyle = '#181d27';
    aCtx.fillRect(0, 0, size, size);

    // Roughness: high default matte (0.84 -> gray ~214)
    rCtx.fillStyle = '#d6d6d6';
    rCtx.fillRect(0, 0, size, size);

    // Emissive: pitch black base
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, size, size);

    // Height: mid gray (128)
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Subtle micro-noise / asphalt grain
    const noiseCount = 18000;
    aCtx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let i = 0; i < noiseCount; i++) {
      const nx = Math.random() * size;
      const ny = Math.random() * size;
      const nRad = Math.random() * 2 + 1;
      aCtx.fillRect(nx, ny, nRad, nRad);
    }

    // Modular Paver Grid Lines (16x16 grid across 48m -> ~3m tiles)
    const gridCols = 16;
    const step = size / gridCols;

    aCtx.strokeStyle = '#0e121a';
    aCtx.lineWidth = 4;
    hCtx.strokeStyle = '#404040'; // Recessed joint in normal map
    hCtx.lineWidth = 4;

    for (let i = 0; i <= size; i += step) {
      aCtx.beginPath(); aCtx.moveTo(i, 0); aCtx.lineTo(i, size); aCtx.stroke();
      aCtx.beginPath(); aCtx.moveTo(0, i); aCtx.lineTo(size, i); aCtx.stroke();

      hCtx.beginPath(); hCtx.moveTo(i, 0); hCtx.lineTo(i, size); hCtx.stroke();
      hCtx.beginPath(); hCtx.moveTo(0, i); hCtx.lineTo(size, i); hCtx.stroke();
    }

    // Secondary subtle cyber coordinate grid (dotted)
    aCtx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    aCtx.lineWidth = 1;
    aCtx.setLineDash([8, 16]);
    for (let i = step * 0.5; i < size; i += step) {
      aCtx.beginPath(); aCtx.moveTo(i, 0); aCtx.lineTo(i, size); aCtx.stroke();
      aCtx.beginPath(); aCtx.moveTo(0, i); aCtx.lineTo(size, i); aCtx.stroke();
    }
    aCtx.setLineDash([]);

    // --- STEP 2: FINANCIAL LEVEL DEMARCATION LINES ---
    const drawPriceLine = (
      yPos: number,
      label: string,
      color: string,
      emissiveColor: string,
      isDashed = false
    ) => {
      // Line
      aCtx.save();
      eCtx.save();
      aCtx.strokeStyle = color;
      aCtx.lineWidth = 3;
      if (isDashed) aCtx.setLineDash([16, 12]);
      aCtx.beginPath(); aCtx.moveTo(80, yPos); aCtx.lineTo(size - 80, yPos); aCtx.stroke();

      eCtx.strokeStyle = emissiveColor;
      eCtx.lineWidth = 2;
      if (isDashed) eCtx.setLineDash([16, 12]);
      eCtx.beginPath(); eCtx.moveTo(80, yPos); eCtx.lineTo(size - 80, yPos); eCtx.stroke();

      // Label at left and right flanks
      aCtx.font = 'bold 22px monospace';
      aCtx.fillStyle = color;
      eCtx.font = 'bold 22px monospace';
      eCtx.fillStyle = emissiveColor;

      aCtx.textAlign = 'left';
      eCtx.textAlign = 'left';
      aCtx.fillText(label, 100, yPos - 8);
      eCtx.fillText(label, 100, yPos - 8);

      aCtx.textAlign = 'right';
      eCtx.textAlign = 'right';
      aCtx.fillText(label, size - 100, yPos - 8);
      eCtx.fillText(label, size - 100, yPos - 8);

      aCtx.restore();
      eCtx.restore();
    };

    // Four trading levels (mapped to top and bottom quadrants)
    drawPriceLine(size * 0.16, '$100K // MAJOR RESISTANCE', '#ff3366', 'rgba(255, 51, 102, 0.5)', true);
    drawPriceLine(size * 0.32, '$85K // BULL PIVOT LEVEL', '#00ff88', 'rgba(0, 255, 136, 0.45)');
    drawPriceLine(size * 0.68, '$69K // MEME BREAKOUT ZONE', '#ffaa00', 'rgba(255, 170, 0, 0.45)');
    drawPriceLine(size * 0.84, '$42K // LIQUIDATION SUPPORT', '#00d9ff', 'rgba(0, 217, 255, 0.45)', true);

    // --- STEP 3: FINANCIAL CANDLESTICK PATTERNS (FLANKS) ---
    const drawCandlestick = (
      cx: number,
      openY: number,
      closeY: number,
      highY: number,
      lowY: number,
      isBullish: boolean
    ) => {
      const col = isBullish ? '#00e575' : '#ff2b55';
      const emCol = isBullish ? 'rgba(0, 229, 117, 0.6)' : 'rgba(255, 43, 85, 0.6)';
      const bodyW = 22;

      // Wick (thin line)
      aCtx.strokeStyle = col;
      aCtx.lineWidth = 2.5;
      aCtx.beginPath(); aCtx.moveTo(cx, highY); aCtx.lineTo(cx, lowY); aCtx.stroke();

      eCtx.strokeStyle = emCol;
      eCtx.lineWidth = 2;
      eCtx.beginPath(); eCtx.moveTo(cx, highY); eCtx.lineTo(cx, lowY); eCtx.stroke();

      // Body (rectangle)
      const top = Math.min(openY, closeY);
      const height = Math.max(8, Math.abs(openY - closeY));

      aCtx.fillStyle = col;
      aCtx.fillRect(cx - bodyW * 0.5, top, bodyW, height);

      eCtx.fillStyle = emCol;
      eCtx.fillRect(cx - bodyW * 0.5, top, bodyW, height);

      // Height map emboss
      hCtx.fillStyle = isBullish ? '#b0b0b0' : '#a0a0a0';
      hCtx.fillRect(cx - bodyW * 0.5, top, bodyW, height);

      // Roughness: satin decal (120)
      rCtx.fillStyle = '#787878';
      rCtx.fillRect(cx - bodyW * 0.5, top, bodyW, height);
    };

    // West flank candlestick chart cluster
    const westCandles = [
      { x: 260, o: 920, c: 840, h: 810, l: 950, bull: true },
      { x: 295, o: 840, c: 780, h: 750, l: 870, bull: true },
      { x: 330, o: 780, c: 830, h: 760, l: 860, bull: false },
      { x: 365, o: 830, c: 720, h: 700, l: 850, bull: true },
      { x: 400, o: 720, c: 660, h: 630, l: 740, bull: true },
      { x: 435, o: 660, c: 710, h: 640, l: 730, bull: false },
      { x: 470, o: 710, c: 610, h: 580, l: 730, bull: true },
    ];
    westCandles.forEach((c) => drawCandlestick(c.x, c.o, c.c, c.h, c.l, c.bull));

    // East flank candlestick chart cluster
    const eastCandles = [
      { x: size - 470, o: 1300, c: 1380, h: 1280, l: 1410, bull: false },
      { x: size - 435, o: 1380, c: 1440, h: 1350, l: 1470, bull: false },
      { x: size - 400, o: 1440, c: 1370, h: 1340, l: 1460, bull: true },
      { x: size - 365, o: 1370, c: 1460, h: 1330, l: 1500, bull: false },
      { x: size - 330, o: 1460, c: 1520, h: 1430, l: 1550, bull: false },
      { x: size - 295, o: 1520, c: 1450, h: 1420, l: 1540, bull: true },
      { x: size - 260, o: 1450, c: 1550, h: 1410, l: 1580, bull: false },
    ];
    eastCandles.forEach((c) => drawCandlestick(c.x, c.o, c.c, c.h, c.l, c.bull));

    // --- STEP 4: CENTERPIECE BULL MASCOT MEDALLION ---
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Outer cybernetic ring
    const ringRadius = 420;
    aCtx.save();
    eCtx.save();

    // Concentric ring guides
    aCtx.strokeStyle = 'rgba(255, 42, 68, 0.4)';
    aCtx.lineWidth = 8;
    aCtx.beginPath(); aCtx.arc(cx, cy, ringRadius, 0, Math.PI * 2); aCtx.stroke();

    eCtx.strokeStyle = 'rgba(255, 42, 68, 0.6)';
    eCtx.lineWidth = 6;
    eCtx.beginPath(); eCtx.arc(cx, cy, ringRadius, 0, Math.PI * 2); eCtx.stroke();

    // Dashed inner neon ring
    aCtx.strokeStyle = '#00ff88';
    aCtx.lineWidth = 4;
    aCtx.setLineDash([24, 18]);
    aCtx.beginPath(); aCtx.arc(cx, cy, ringRadius - 32, 0, Math.PI * 2); aCtx.stroke();

    eCtx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
    eCtx.lineWidth = 3;
    eCtx.setLineDash([24, 18]);
    eCtx.beginPath(); eCtx.arc(cx, cy, ringRadius - 32, 0, Math.PI * 2); eCtx.stroke();
    aCtx.setLineDash([]);
    eCtx.setLineDash([]);

    // Circular arena label text
    const textRadius = ringRadius - 75;
    const text = '★ BUMP.TRADE  NEON  MARKET  ARENA #01 ★';
    aCtx.font = 'bold 28px monospace';
    aCtx.fillStyle = '#ffffff';
    eCtx.font = 'bold 28px monospace';
    eCtx.fillStyle = '#00e5ff';

    const angleStep = (Math.PI * 1.8) / text.length;
    const startAngle = -Math.PI * 0.9;
    for (let i = 0; i < text.length; i++) {
      const angle = startAngle + i * angleStep;
      const tx = cx + Math.cos(angle) * textRadius;
      const ty = cy + Math.sin(angle) * textRadius;

      aCtx.save();
      eCtx.save();
      aCtx.translate(tx, ty);
      eCtx.translate(tx, ty);
      aCtx.rotate(angle + Math.PI / 2);
      eCtx.rotate(angle + Math.PI / 2);
      aCtx.textAlign = 'center';
      eCtx.textAlign = 'center';
      aCtx.fillText(text[i], 0, 0);
      eCtx.fillText(text[i], 0, 0);
      aCtx.restore();
      eCtx.restore();
    }

    // Stylized Bull Head & Horns Decal
    this.drawBullMascot(aCtx, eCtx, hCtx, rCtx, cx, cy, 260);

    aCtx.restore();
    eCtx.restore();

    // --- STEP 5: CORNER CAUTION CHEVRONS ---
    this.drawCornerHazardChevrons(aCtx, eCtx, hCtx, rCtx, size);

    // --- STEP 6: SOBEL NORMAL MAP GENERATION ---
    const normalCanvas = this.generateSobelNormalMap(heightCanvas, size);

    // --- STEP 7: BUILD THREE.JS TEXTURES ---
    const map = new THREE.CanvasTexture(albedoCanvas);
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = 8;
    map.needsUpdate = true;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS = THREE.ClampToEdgeWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
    normalMap.anisotropy = 8;
    normalMap.needsUpdate = true;

    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
    roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
    roughnessMap.anisotropy = 8;
    roughnessMap.needsUpdate = true;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.wrapS = THREE.ClampToEdgeWrapping;
    emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
    emissiveMap.anisotropy = 8;
    emissiveMap.needsUpdate = true;

    this.cachedTextures = { map, normalMap, roughnessMap, emissiveMap };
    return this.cachedTextures;
  }

  /**
   * Draws the iconic central Bull Head outline with glowing green horns and eyes.
   */
  private static drawBullMascot(
    aCtx: CanvasRenderingContext2D,
    eCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number
  ): void {
    const s = scale / 100;

    aCtx.save();
    eCtx.save();
    hCtx.save();
    rCtx.save();

    aCtx.translate(cx, cy);
    eCtx.translate(cx, cy);
    hCtx.translate(cx, cy);
    rCtx.translate(cx, cy);

    // 1. Bull Head Silhouette (Crimson Red #ff2a44 outline)
    aCtx.strokeStyle = '#ff2a44';
    aCtx.lineWidth = 9;
    aCtx.lineCap = 'round';
    aCtx.lineJoin = 'round';

    eCtx.strokeStyle = 'rgba(255, 42, 68, 0.8)';
    eCtx.lineWidth = 7;
    eCtx.lineCap = 'round';
    eCtx.lineJoin = 'round';

    // Face shield outline
    aCtx.beginPath();
    eCtx.beginPath();

    // Forehead top
    aCtx.moveTo(-35 * s, -45 * s);
    aCtx.lineTo(35 * s, -45 * s);
    // Right cheek & muzzle taper
    aCtx.lineTo(48 * s, -10 * s);
    aCtx.lineTo(36 * s, 35 * s);
    aCtx.lineTo(24 * s, 65 * s);
    aCtx.lineTo(0, 75 * s);
    aCtx.lineTo(-24 * s, 65 * s);
    aCtx.lineTo(-36 * s, 35 * s);
    aCtx.lineTo(-48 * s, -10 * s);
    aCtx.closePath();

    eCtx.moveTo(-35 * s, -45 * s);
    eCtx.lineTo(35 * s, -45 * s);
    eCtx.lineTo(48 * s, -10 * s);
    eCtx.lineTo(36 * s, 35 * s);
    eCtx.lineTo(24 * s, 65 * s);
    eCtx.lineTo(0, 75 * s);
    eCtx.lineTo(-24 * s, 65 * s);
    eCtx.lineTo(-36 * s, 35 * s);
    eCtx.lineTo(-48 * s, -10 * s);
    eCtx.closePath();

    aCtx.stroke();
    eCtx.stroke();

    // 2. Large Arching Bull Horns (Lucky Green #00ff88)
    aCtx.strokeStyle = '#00ff88';
    aCtx.lineWidth = 14;
    eCtx.strokeStyle = '#00ff88';
    eCtx.lineWidth = 11;

    // Left Horn
    aCtx.beginPath();
    eCtx.beginPath();
    aCtx.moveTo(-32 * s, -42 * s);
    aCtx.bezierCurveTo(-75 * s, -70 * s, -95 * s, -35 * s, -85 * s, 10 * s);
    eCtx.moveTo(-32 * s, -42 * s);
    eCtx.bezierCurveTo(-75 * s, -70 * s, -95 * s, -35 * s, -85 * s, 10 * s);
    aCtx.stroke();
    eCtx.stroke();

    // Right Horn
    aCtx.beginPath();
    eCtx.beginPath();
    aCtx.moveTo(32 * s, -42 * s);
    aCtx.bezierCurveTo(75 * s, -70 * s, 95 * s, -35 * s, 85 * s, 10 * s);
    eCtx.moveTo(32 * s, -42 * s);
    eCtx.bezierCurveTo(75 * s, -70 * s, 95 * s, -35 * s, 85 * s, 10 * s);
    aCtx.stroke();
    eCtx.stroke();

    // 3. Glowing Eyes (Fierce diagonal slits)
    aCtx.fillStyle = '#00ff88';
    eCtx.fillStyle = '#00ff88';

    // Left eye
    aCtx.beginPath();
    eCtx.beginPath();
    aCtx.moveTo(-28 * s, -10 * s);
    aCtx.lineTo(-12 * s, -6 * s);
    aCtx.lineTo(-24 * s, -2 * s);
    aCtx.closePath();
    eCtx.moveTo(-28 * s, -10 * s);
    eCtx.lineTo(-12 * s, -6 * s);
    eCtx.lineTo(-24 * s, -2 * s);
    eCtx.closePath();
    aCtx.fill();
    eCtx.fill();

    // Right eye
    aCtx.beginPath();
    eCtx.beginPath();
    aCtx.moveTo(28 * s, -10 * s);
    aCtx.lineTo(12 * s, -6 * s);
    aCtx.lineTo(24 * s, -2 * s);
    aCtx.closePath();
    eCtx.moveTo(28 * s, -10 * s);
    eCtx.lineTo(12 * s, -6 * s);
    eCtx.lineTo(24 * s, -2 * s);
    eCtx.closePath();
    aCtx.fill();
    eCtx.fill();

    // 4. Nostrils & Septum Ring
    aCtx.strokeStyle = '#ffaa00';
    aCtx.lineWidth = 5;
    eCtx.strokeStyle = '#ffaa00';
    eCtx.lineWidth = 3;

    aCtx.beginPath();
    eCtx.beginPath();
    aCtx.arc(0, 52 * s, 14 * s, Math.PI * 0.2, Math.PI * 0.8, false);
    eCtx.arc(0, 52 * s, 14 * s, Math.PI * 0.2, Math.PI * 0.8, false);
    aCtx.stroke();
    eCtx.stroke();

    // Roughness mask for medallion area (satin decal ~0.35)
    rCtx.fillStyle = '#585858';
    rCtx.beginPath();
    rCtx.arc(0, 0, 110 * s, 0, Math.PI * 2);
    rCtx.fill();

    aCtx.restore();
    eCtx.restore();
    hCtx.restore();
    rCtx.restore();
  }

  /**
   * Draws corner hazard warning chevrons framing the arena boundary.
   */
  private static drawCornerHazardChevrons(
    aCtx: CanvasRenderingContext2D,
    _eCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    size: number
  ): void {
    const corners = [
      { x: 120, y: 120, angle: Math.PI * 0.25 },
      { x: size - 120, y: 120, angle: -Math.PI * 0.25 },
      { x: 120, y: size - 120, angle: Math.PI * 0.75 },
      { x: size - 120, y: size - 120, angle: -Math.PI * 0.75 },
    ];

    corners.forEach((c) => {
      aCtx.save();
      hCtx.save();
      rCtx.save();

      aCtx.translate(c.x, c.y);
      hCtx.translate(c.x, c.y);
      rCtx.translate(c.x, c.y);
      aCtx.rotate(c.angle);
      hCtx.rotate(c.angle);
      rCtx.rotate(c.angle);

      // Warning chevron bars
      const stripeW = 20;
      const stripeH = 140;
      const count = 5;

      for (let i = -count * 0.5; i < count * 0.5; i++) {
        const isYellow = Math.abs(Math.floor(i)) % 2 === 0;
        aCtx.fillStyle = isYellow ? '#ffaa00' : '#141414';
        aCtx.fillRect(i * stripeW, -stripeH * 0.5, stripeW, stripeH);

        hCtx.fillStyle = isYellow ? '#a8a8a8' : '#707070';
        hCtx.fillRect(i * stripeW, -stripeH * 0.5, stripeW, stripeH);

        rCtx.fillStyle = isYellow ? '#606060' : '#b0b0b0';
        rCtx.fillRect(i * stripeW, -stripeH * 0.5, stripeW, stripeH);
      }

      aCtx.restore();
      hCtx.restore();
      rCtx.restore();
    });
  }

  /**
   * Generates a tangent-space Sobel normal map from the grayscale height canvas.
   */
  private static generateSobelNormalMap(heightCanvas: HTMLCanvasElement, size: number): HTMLCanvasElement {
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d')!;

    const hCtx = heightCanvas.getContext('2d')!;
    const hData = hCtx.getImageData(0, 0, size, size);
    const nData = nCtx.createImageData(size, size);

    const src = hData.data;
    const dst = nData.data;
    const strength = 1.8;

    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = (y * size + x) * 4;

        // Sobel filter kernels
        const tl = src[((y - 1) * size + (x - 1)) * 4];
        const tc = src[((y - 1) * size + x) * 4];
        const tr = src[((y - 1) * size + (x + 1)) * 4];
        const ml = src[(y * size + (x - 1)) * 4];
        const mr = src[(y * size + (x + 1)) * 4];
        const bl = src[((y + 1) * size + (x - 1)) * 4];
        const bc = src[((y + 1) * size + x) * 4];
        const br = src[((y + 1) * size + (x + 1)) * 4];

        const dX = (tr + 2 * mr + br - (tl + 2 * ml + bl)) / 255.0;
        const dY = (bl + 2 * bc + br - (tl + 2 * tc + tr)) / 255.0;

        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;

        dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        dst[idx + 3] = 255;
      }
    }

    nCtx.putImageData(nData, 0, 0);
    return normalCanvas;
  }
}
