import * as THREE from 'three';

export interface CarPBRMaps {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface BumperPBRMaps {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface CarbonFiberMaps {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
}

export interface WheelPBRMaps {
  tireAlbedo: THREE.CanvasTexture;
  tireNormal: THREE.CanvasTexture;
  tireRoughness: THREE.CanvasTexture;
  rimAlbedo: THREE.CanvasTexture;
  rimNormal: THREE.CanvasTexture;
  rimRoughness: THREE.CanvasTexture;
  rimMetalness: THREE.CanvasTexture;
  rimEmissive: THREE.CanvasTexture;
}

/**
 * Procedural PBR Texture Generator for BUMP.TRADE.
 * Generates high-resolution 2048x2048 PBR texture maps directly via Canvas 2D:
 * - Base Color / Albedo: Metallic emerald green (#00B84B) with micro-flakes, twill carbon-fiber pattern,
 *   gold Bull Mascot head emblem on hood/doors, dual white racing stripes with electric yellow pinstripes,
 *   bold '$85' cash lettering, and honeycomb grille mesh.
 * - Normal Map: Tangent-space normal map generated from precision height map (panel seams, embossed bull relief,
 *   hood louvers, bumper shock ribs, tire treads).
 * - Roughness Map: 0.16 glossy clearcoat, 0.35 carbon fiber, 0.84 bumper rubber, 0.06 mirror chrome.
 * - Metalness Map: 0.88-0.98 for paint and chrome, 0.0 for rubber/carbon/glass/decals.
 * - Emissive Map: Glowing neon green (#00FF6A) horn tips & eyes, electric yellow (#FFD600) halos,
 *   ruby red (#FF2E2E) taillights, and glowing '$85' cash display.
 */
export class CarTextureGenerator {
  private static cachedBodyPBR?: CarPBRMaps;
  private static cachedBumperPBR?: BumperPBRMaps;
  private static cachedCarbonPBR?: CarbonFiberMaps;
  private static cachedWheelPBR?: WheelPBRMaps;

  /**
   * Generates or retrieves the cached 2048x2048 Car Body PBR texture suite.
   */
  public static generateBodyPBR(resolution = 2048): CarPBRMaps {
    if (this.cachedBodyPBR) {
      return this.cachedBodyPBR;
    }

    const width = resolution;
    const height = resolution;

    // Create 5 canvases
    const albedoCanvas = this.createCanvas(width, height);
    const heightCanvas = this.createCanvas(width, height);
    const roughnessCanvas = this.createCanvas(width, height);
    const metalnessCanvas = this.createCanvas(width, height);
    const emissiveCanvas = this.createCanvas(width, height);

    const albedoCtx = albedoCanvas.getContext('2d')!;
    const heightCtx = heightCanvas.getContext('2d')!;
    const roughnessCtx = roughnessCanvas.getContext('2d')!;
    const metalnessCtx = metalnessCanvas.getContext('2d')!;
    const emissiveCtx = emissiveCanvas.getContext('2d')!;

    // 1. BASE BACKGROUND: Metallic Emerald Green (#00B84B)
    albedoCtx.fillStyle = '#00B84B';
    albedoCtx.fillRect(0, 0, width, height);

    // Micro-flakes: fine metallic paint speckle
    const flakeCount = Math.floor((width * height) / 32);
    albedoCtx.fillStyle = '#05d459';
    for (let i = 0; i < flakeCount; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.cos(i * 78.233) * 43758.5453) % 1;
      const fx = Math.floor(Math.abs(rx) * width);
      const fy = Math.floor(Math.abs(ry) * height);
      albedoCtx.fillRect(fx, fy, 2, 2);
    }
    // Subdued darker flakes
    albedoCtx.fillStyle = '#009e40';
    for (let i = 0; i < flakeCount / 2; i++) {
      const rx = (Math.cos(i * 23.411) * 31234.123) % 1;
      const ry = (Math.sin(i * 54.123) * 31234.123) % 1;
      const fx = Math.floor(Math.abs(rx) * width);
      const fy = Math.floor(Math.abs(ry) * height);
      albedoCtx.fillRect(fx, fy, 2, 2);
    }

    // Default Height: Flat (128)
    heightCtx.fillStyle = 'rgb(128, 128, 128)';
    heightCtx.fillRect(0, 0, width, height);

    // Default Roughness: 0.16 (Glossy Metallic Clearcoat) -> 0.16 * 255 ≈ 41
    roughnessCtx.fillStyle = 'rgb(41, 41, 41)';
    roughnessCtx.fillRect(0, 0, width, height);

    // Default Metalness: 0.88 -> 0.88 * 255 ≈ 224
    metalnessCtx.fillStyle = 'rgb(224, 224, 224)';
    metalnessCtx.fillRect(0, 0, width, height);

    // Default Emissive: Pure Black (0)
    emissiveCtx.fillStyle = '#000000';
    emissiveCtx.fillRect(0, 0, width, height);

    // 2. CENTER TWILL CARBON FIBER INLAY (Hood & Roof Center)
    const carbonMinX = Math.round(width * 0.36);
    const carbonMaxX = Math.round(width * 0.64);
    const carbonWidth = carbonMaxX - carbonMinX;
    const carbonMinY = Math.round(height * 0.08);
    const carbonMaxY = Math.round(height * 0.72);
    const carbonHeight = carbonMaxY - carbonMinY;

    this.drawTwillCarbon(albedoCtx, roughnessCtx, metalnessCtx, heightCtx, carbonMinX, carbonMinY, carbonWidth, carbonHeight);

    // 3. DUAL WHITE RACING STRIPES WITH ELECTRIC YELLOW PINSTRIPES
    const stripeWidth = Math.round(width * 0.038); // ~78px
    const stripeGap = Math.round(width * 0.048);   // ~98px center gap
    const pinstripeWidth = Math.round(width * 0.007); // ~14px
    const centerX = width * 0.5;

    const leftStripeX = centerX - (stripeGap * 0.5) - stripeWidth;
    const rightStripeX = centerX + (stripeGap * 0.5);

    const stripeStartY = Math.round(height * 0.05);
    const stripeEndY = Math.round(height * 0.95);
    const stripeTotalLen = stripeEndY - stripeStartY;

    const drawStripeSet = (sx: number) => {
      // Main White Stripe
      albedoCtx.fillStyle = '#FFFFFF';
      albedoCtx.fillRect(sx, stripeStartY, stripeWidth, stripeTotalLen);

      // Flanking Electric Yellow Pinstripes (#FFD600)
      albedoCtx.fillStyle = '#FFD600';
      albedoCtx.fillRect(sx - pinstripeWidth, stripeStartY, pinstripeWidth, stripeTotalLen);
      albedoCtx.fillRect(sx + stripeWidth, stripeStartY, pinstripeWidth, stripeTotalLen);

      // Roughness: 0.22 (Glossy Vinyl Decal)
      roughnessCtx.fillStyle = 'rgb(56, 56, 56)';
      roughnessCtx.fillRect(sx - pinstripeWidth, stripeStartY, stripeWidth + pinstripeWidth * 2, stripeTotalLen);

      // Metalness: 0.0 (Dielectric Vinyl)
      metalnessCtx.fillStyle = 'rgb(0, 0, 0)';
      metalnessCtx.fillRect(sx - pinstripeWidth, stripeStartY, stripeWidth + pinstripeWidth * 2, stripeTotalLen);

      // Height: Slight raised decal relief (145)
      heightCtx.fillStyle = 'rgb(148, 148, 148)';
      heightCtx.fillRect(sx - pinstripeWidth, stripeStartY, stripeWidth + pinstripeWidth * 2, stripeTotalLen);
    };

    drawStripeSet(leftStripeX);
    drawStripeSet(rightStripeX);

    // 4. EMBOSSED GOLDEN BULL MASCOT HEAD EMBLEM (Hood Center - forward of cockpit)
    const emblemCenterX = centerX;
    const emblemCenterY = Math.round(height * 0.56);
    const emblemScale = width * 0.00068; // Scale for ~340px size

    this.drawBullEmblem(
      albedoCtx,
      heightCtx,
      roughnessCtx,
      metalnessCtx,
      emissiveCtx,
      emblemCenterX,
      emblemCenterY,
      emblemScale
    );

    // 5. BOLD '$85' CASH BRANDING (Front Hood Scoop)
    const cashY = Math.round(height * 0.74);
    this.drawCashLettering(
      albedoCtx,
      heightCtx,
      roughnessCtx,
      metalnessCtx,
      emissiveCtx,
      centerX,
      cashY,
      width * 0.055
    );

    // 6. FRONT HONEYCOMB GRILLE MESH (Front Nose)
    const grilleX = Math.round(width * 0.35);
    const grilleY = Math.round(height * 0.83);
    const grilleW = Math.round(width * 0.30);
    const grilleH = Math.round(height * 0.13);
    this.drawHoneycombMesh(albedoCtx, heightCtx, roughnessCtx, metalnessCtx, emissiveCtx, grilleX, grilleY, grilleW, grilleH);

    // 7. SIDE DOOR BULL GRAPHICS & RACING ACCENTS
    // Left Door Panel
    this.drawDoorGraphics(
      albedoCtx,
      heightCtx,
      roughnessCtx,
      metalnessCtx,
      emissiveCtx,
      Math.round(width * 0.16),
      Math.round(height * 0.46),
      emblemScale * 0.68,
      false
    );
    // Right Door Panel (Mirrored)
    this.drawDoorGraphics(
      albedoCtx,
      heightCtx,
      roughnessCtx,
      metalnessCtx,
      emissiveCtx,
      Math.round(width * 0.84),
      Math.round(height * 0.46),
      emblemScale * 0.68,
      true
    );

    // 8. HOOD AIR LOUVERS / VENT SLATS
    this.drawAirLouvers(heightCtx, albedoCtx, roughnessCtx, Math.round(width * 0.28), Math.round(height * 0.26), Math.round(width * 0.06), Math.round(height * 0.12));
    this.drawAirLouvers(heightCtx, albedoCtx, roughnessCtx, Math.round(width * 0.66), Math.round(height * 0.26), Math.round(width * 0.06), Math.round(height * 0.12));

    // 9. PANEL SEAMS & SHUT LINES (Precise recessed grooves)
    this.drawPanelSeams(albedoCtx, heightCtx, roughnessCtx, metalnessCtx, width, height);

    // 10. GENERATE TANGENT-SPACE NORMAL MAP FROM HEIGHT MAP
    const normalCanvas = this.generateNormalMapFromHeight(heightCanvas, 3.2);

    // Convert Canvases to Three.js CanvasTextures
    const albedoMap = new THREE.CanvasTexture(albedoCanvas);
    albedoMap.colorSpace = THREE.SRGBColorSpace;
    albedoMap.wrapS = THREE.ClampToEdgeWrapping;
    albedoMap.wrapT = THREE.ClampToEdgeWrapping;
    albedoMap.needsUpdate = true;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.wrapS = THREE.ClampToEdgeWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
    normalMap.needsUpdate = true;

    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
    roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
    roughnessMap.needsUpdate = true;

    const metalnessMap = new THREE.CanvasTexture(metalnessCanvas);
    metalnessMap.colorSpace = THREE.NoColorSpace;
    metalnessMap.wrapS = THREE.ClampToEdgeWrapping;
    metalnessMap.wrapT = THREE.ClampToEdgeWrapping;
    metalnessMap.needsUpdate = true;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = THREE.ClampToEdgeWrapping;
    emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
    emissiveMap.needsUpdate = true;

    this.cachedBodyPBR = {
      albedoMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      emissiveMap,
    };

    return this.cachedBodyPBR;
  }

  /**
   * Generates Bumper PBR maps: Heavy scuffed rubber (#1A1A1A) with horizontal impact ribs and lower neon lip (#00FF6A).
   */
  public static generateBumperPBR(width = 1024, height = 256): BumperPBRMaps {
    if (this.cachedBumperPBR) return this.cachedBumperPBR;

    const albedoCanvas = this.createCanvas(width, height);
    const heightCanvas = this.createCanvas(width, height);
    const roughnessCanvas = this.createCanvas(width, height);
    const metalnessCanvas = this.createCanvas(width, height);
    const emissiveCanvas = this.createCanvas(width, height);

    const aCtx = albedoCanvas.getContext('2d')!;
    const hCtx = heightCanvas.getContext('2d')!;
    const rCtx = roughnessCanvas.getContext('2d')!;
    const mCtx = metalnessCanvas.getContext('2d')!;
    const eCtx = emissiveCanvas.getContext('2d')!;

    // 1. Rubber base
    aCtx.fillStyle = '#1A1A1A';
    aCtx.fillRect(0, 0, width, height);

    // Micro rubber scuffs
    aCtx.fillStyle = '#262626';
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * width;
      const ry = Math.random() * (height * 0.75);
      const rw = 4 + Math.random() * 24;
      aCtx.fillRect(rx, ry, rw, 1.5);
    }

    hCtx.fillStyle = 'rgb(128, 128, 128)';
    hCtx.fillRect(0, 0, width, height);

    // Horizontal impact absorption ribs (4 grooves)
    const ribCount = 4;
    for (let i = 0; i < ribCount; i++) {
      const ry = Math.round((height * 0.16) + (i * height * 0.14));
      // Dark groove in height
      hCtx.fillStyle = 'rgb(40, 40, 40)';
      hCtx.fillRect(0, ry, width, 6);
      // Raised ridge next to groove
      hCtx.fillStyle = 'rgb(190, 190, 190)';
      hCtx.fillRect(0, ry - 4, width, 4);

      aCtx.fillStyle = '#111111';
      aCtx.fillRect(0, ry, width, 4);
    }

    // Lower Neon Lip (bottom 20% of bumper)
    const lipY = Math.round(height * 0.80);
    const lipHeight = height - lipY;

    aCtx.fillStyle = '#00FF6A';
    aCtx.fillRect(0, lipY, width, lipHeight);

    // Thin chrome separator bead
    aCtx.fillStyle = '#C0C7D1';
    aCtx.fillRect(0, lipY - 2, width, 2);

    // Roughness: Rubber 0.84 (rgb 214), Neon Lip 0.18 (rgb 46)
    rCtx.fillStyle = 'rgb(214, 214, 214)';
    rCtx.fillRect(0, 0, width, lipY);
    rCtx.fillStyle = 'rgb(46, 46, 46)';
    rCtx.fillRect(0, lipY, width, lipHeight);

    // Metalness: Rubber 0.0, chrome bead 0.98
    mCtx.fillStyle = 'rgb(0, 0, 0)';
    mCtx.fillRect(0, 0, width, height);
    mCtx.fillStyle = 'rgb(240, 240, 240)';
    mCtx.fillRect(0, lipY - 2, width, 2);

    // Emissive: Neon Lip glows brightly (#00FF6A)
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, width, height);
    eCtx.fillStyle = '#00FF6A';
    eCtx.fillRect(0, lipY, width, lipHeight);

    const normalCanvas = this.generateNormalMapFromHeight(heightCanvas, 3.8);

    const albedoMap = new THREE.CanvasTexture(albedoCanvas);
    albedoMap.colorSpace = THREE.SRGBColorSpace;
    albedoMap.wrapS = THREE.RepeatWrapping;
    albedoMap.wrapT = THREE.ClampToEdgeWrapping;
    albedoMap.needsUpdate = true;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
    normalMap.needsUpdate = true;

    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
    roughnessMap.needsUpdate = true;

    const metalnessMap = new THREE.CanvasTexture(metalnessCanvas);
    metalnessMap.colorSpace = THREE.NoColorSpace;
    metalnessMap.wrapS = THREE.RepeatWrapping;
    metalnessMap.wrapT = THREE.ClampToEdgeWrapping;
    metalnessMap.needsUpdate = true;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.ClampToEdgeWrapping;
    emissiveMap.needsUpdate = true;

    this.cachedBumperPBR = { albedoMap, normalMap, roughnessMap, metalnessMap, emissiveMap };
    return this.cachedBumperPBR;
  }

  /**
   * Generates seamless Twill 2x2 Carbon Fiber PBR textures for spoiler, splitters, diffusers.
   */
  public static generateCarbonFiberPBR(size = 512): CarbonFiberMaps {
    if (this.cachedCarbonPBR) return this.cachedCarbonPBR;

    const albedoCanvas = this.createCanvas(size, size);
    const heightCanvas = this.createCanvas(size, size);
    const roughnessCanvas = this.createCanvas(size, size);
    const metalnessCanvas = this.createCanvas(size, size);

    const aCtx = albedoCanvas.getContext('2d')!;
    const hCtx = heightCanvas.getContext('2d')!;
    const rCtx = roughnessCanvas.getContext('2d')!;
    const mCtx = metalnessCanvas.getContext('2d')!;

    this.drawTwillCarbon(aCtx, rCtx, mCtx, hCtx, 0, 0, size, size, 8);

    const normalCanvas = this.generateNormalMapFromHeight(heightCanvas, 2.5);

    const albedoMap = new THREE.CanvasTexture(albedoCanvas);
    albedoMap.colorSpace = THREE.SRGBColorSpace;
    albedoMap.wrapS = THREE.RepeatWrapping;
    albedoMap.wrapT = THREE.RepeatWrapping;
    albedoMap.repeat.set(4, 4);
    albedoMap.needsUpdate = true;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 4);
    normalMap.needsUpdate = true;

    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(4, 4);
    roughnessMap.needsUpdate = true;

    const metalnessMap = new THREE.CanvasTexture(metalnessCanvas);
    metalnessMap.colorSpace = THREE.NoColorSpace;
    metalnessMap.wrapS = THREE.RepeatWrapping;
    metalnessMap.wrapT = THREE.RepeatWrapping;
    metalnessMap.repeat.set(4, 4);
    metalnessMap.needsUpdate = true;

    this.cachedCarbonPBR = { albedoMap, normalMap, roughnessMap, metalnessMap };
    return this.cachedCarbonPBR;
  }

  /**
   * Generates Wheel & Rim PBR maps: Directional chevron tire tread and 5-spoke chrome rim with neon green lip.
   */
  public static generateWheelPBR(size = 512): WheelPBRMaps {
    if (this.cachedWheelPBR) return this.cachedWheelPBR;

    // --- 1. TIRE TREAD (1024x256 cylindrical wrap) ---
    const tWidth = 1024;
    const tHeight = 256;
    const tAlbedoCanvas = this.createCanvas(tWidth, tHeight);
    const tHeightCanvas = this.createCanvas(tWidth, tHeight);
    const tRoughCanvas = this.createCanvas(tWidth, tHeight);

    const taCtx = tAlbedoCanvas.getContext('2d')!;
    const thCtx = tHeightCanvas.getContext('2d')!;
    const trCtx = tRoughCanvas.getContext('2d')!;

    taCtx.fillStyle = '#141414';
    taCtx.fillRect(0, 0, tWidth, tHeight);

    thCtx.fillStyle = 'rgb(128, 128, 128)';
    thCtx.fillRect(0, 0, tWidth, tHeight);

    trCtx.fillStyle = 'rgb(224, 224, 224)'; // 0.88 matte rubber
    trCtx.fillRect(0, 0, tWidth, tHeight);

    // Directional chevron tread blocks
    const chevronStep = 32;
    for (let x = 0; x < tWidth; x += chevronStep) {
      thCtx.strokeStyle = 'rgb(30, 30, 30)';
      thCtx.lineWidth = 6;
      thCtx.beginPath();
      thCtx.moveTo(x, 20);
      thCtx.lineTo(x + 16, tHeight * 0.5);
      thCtx.lineTo(x, tHeight - 20);
      thCtx.stroke();

      // Outer shoulder ribs
      thCtx.fillStyle = 'rgb(180, 180, 180)';
      thCtx.fillRect(x, 4, 18, 12);
      thCtx.fillRect(x, tHeight - 16, 18, 12);
    }

    const tNormalCanvas = this.generateNormalMapFromHeight(tHeightCanvas, 4.0);

    const tireAlbedo = new THREE.CanvasTexture(tAlbedoCanvas);
    tireAlbedo.colorSpace = THREE.SRGBColorSpace;
    tireAlbedo.wrapS = THREE.RepeatWrapping;
    tireAlbedo.wrapT = THREE.ClampToEdgeWrapping;
    tireAlbedo.needsUpdate = true;

    const tireNormal = new THREE.CanvasTexture(tNormalCanvas);
    tireNormal.colorSpace = THREE.NoColorSpace;
    tireNormal.wrapS = THREE.RepeatWrapping;
    tireNormal.wrapT = THREE.ClampToEdgeWrapping;
    tireNormal.needsUpdate = true;

    const tireRoughness = new THREE.CanvasTexture(tRoughCanvas);
    tireRoughness.colorSpace = THREE.NoColorSpace;
    tireRoughness.wrapS = THREE.RepeatWrapping;
    tireRoughness.wrapT = THREE.ClampToEdgeWrapping;
    tireRoughness.needsUpdate = true;

    // --- 2. 5-SPOKE CHROME RIM FACE (size x size) ---
    const rAlbedoCanvas = this.createCanvas(size, size);
    const rHeightCanvas = this.createCanvas(size, size);
    const rRoughCanvas = this.createCanvas(size, size);
    const rMetalCanvas = this.createCanvas(size, size);
    const rEmissCanvas = this.createCanvas(size, size);

    const raCtx = rAlbedoCanvas.getContext('2d')!;
    const rhCtx = rHeightCanvas.getContext('2d')!;
    const rrCtx = rRoughCanvas.getContext('2d')!;
    const rmCtx = rMetalCanvas.getContext('2d')!;
    const reCtx = rEmissCanvas.getContext('2d')!;

    const cx = size * 0.5;
    const cy = size * 0.5;
    const outerRadius = size * 0.46;
    const lipWidth = size * 0.04;
    const hubRadius = size * 0.16;

    // Rim Barrel Base (Dark Polished Chrome)
    raCtx.fillStyle = '#1A1E24';
    raCtx.fillRect(0, 0, size, size);

    rhCtx.fillStyle = 'rgb(128, 128, 128)';
    rhCtx.fillRect(0, 0, size, size);

    rrCtx.fillStyle = 'rgb(18, 18, 18)'; // 0.07 mirror polish
    rrCtx.fillRect(0, 0, size, size);

    rmCtx.fillStyle = 'rgb(250, 250, 250)'; // 0.98 chrome metal
    rmCtx.fillRect(0, 0, size, size);

    reCtx.fillStyle = '#000000';
    reCtx.fillRect(0, 0, size, size);

    // Glowing Neon Green Lip Ring (#00FF6A)
    raCtx.strokeStyle = '#00FF6A';
    raCtx.lineWidth = lipWidth;
    raCtx.beginPath();
    raCtx.arc(cx, cy, outerRadius - lipWidth * 0.5, 0, Math.PI * 2);
    raCtx.stroke();

    reCtx.strokeStyle = '#00FF6A';
    reCtx.lineWidth = lipWidth;
    reCtx.beginPath();
    reCtx.arc(cx, cy, outerRadius - lipWidth * 0.5, 0, Math.PI * 2);
    reCtx.stroke();

    // 5 Sculpted Chrome Spokes
    const spokeCount = 5;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI * 2) / spokeCount;
      raCtx.save();
      raCtx.translate(cx, cy);
      raCtx.rotate(angle);

      // Chrome Spoke body
      const grad = raCtx.createLinearGradient(-18, 0, 18, 0);
      grad.addColorStop(0, '#C0C8D0');
      grad.addColorStop(0.5, '#F4F8FC');
      grad.addColorStop(1, '#9098A2');
      raCtx.fillStyle = grad;
      raCtx.beginPath();
      raCtx.moveTo(-16, hubRadius * 0.8);
      raCtx.lineTo(-24, outerRadius - lipWidth);
      raCtx.lineTo(24, outerRadius - lipWidth);
      raCtx.lineTo(16, hubRadius * 0.8);
      raCtx.closePath();
      raCtx.fill();

      // Height relief
      rhCtx.save();
      rhCtx.translate(cx, cy);
      rhCtx.rotate(angle);
      rhCtx.fillStyle = 'rgb(190, 190, 190)';
      rhCtx.beginPath();
      rhCtx.moveTo(-14, hubRadius * 0.8);
      rhCtx.lineTo(-22, outerRadius - lipWidth);
      rhCtx.lineTo(22, outerRadius - lipWidth);
      rhCtx.lineTo(14, hubRadius * 0.8);
      rhCtx.closePath();
      rhCtx.fill();
      rhCtx.restore();

      raCtx.restore();
    }

    // Center Hub Cap (Gold Bull Emblem Accent)
    raCtx.fillStyle = '#C8D0D8';
    raCtx.beginPath();
    raCtx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
    raCtx.fill();

    raCtx.fillStyle = '#FFD700'; // Gold center ring
    raCtx.beginPath();
    raCtx.arc(cx, cy, hubRadius * 0.65, 0, Math.PI * 2);
    raCtx.fill();

    raCtx.fillStyle = '#061008';
    raCtx.beginPath();
    raCtx.arc(cx, cy, hubRadius * 0.52, 0, Math.PI * 2);
    raCtx.fill();

    // Miniature Golden Bull Horns on Hubcap
    raCtx.strokeStyle = '#00FF6A';
    raCtx.lineWidth = 3;
    raCtx.beginPath();
    raCtx.arc(cx, cy + 4, hubRadius * 0.35, Math.PI * 1.1, Math.PI * 1.9);
    raCtx.stroke();

    reCtx.strokeStyle = '#00FF6A';
    reCtx.lineWidth = 2.5;
    reCtx.beginPath();
    reCtx.arc(cx, cy + 4, hubRadius * 0.35, Math.PI * 1.1, Math.PI * 1.9);
    reCtx.stroke();

    const rNormalCanvas = this.generateNormalMapFromHeight(rHeightCanvas, 3.2);

    const rimAlbedo = new THREE.CanvasTexture(rAlbedoCanvas);
    rimAlbedo.colorSpace = THREE.SRGBColorSpace;
    rimAlbedo.needsUpdate = true;

    const rimNormal = new THREE.CanvasTexture(rNormalCanvas);
    rimNormal.colorSpace = THREE.NoColorSpace;
    rimNormal.needsUpdate = true;

    const rimRoughness = new THREE.CanvasTexture(rRoughCanvas);
    rimRoughness.colorSpace = THREE.NoColorSpace;
    rimRoughness.needsUpdate = true;

    const rimMetalness = new THREE.CanvasTexture(rMetalCanvas);
    rimMetalness.colorSpace = THREE.NoColorSpace;
    rimMetalness.needsUpdate = true;

    const rimEmissive = new THREE.CanvasTexture(rEmissCanvas);
    rimEmissive.colorSpace = THREE.SRGBColorSpace;
    rimEmissive.needsUpdate = true;

    this.cachedWheelPBR = {
      tireAlbedo,
      tireNormal,
      tireRoughness,
      rimAlbedo,
      rimNormal,
      rimRoughness,
      rimMetalness,
      rimEmissive,
    };

    return this.cachedWheelPBR;
  }

  // --- DRAWING HELPER METHODS ---

  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c;
    }
    // Fallback for non-DOM environments if any
    return {
      width,
      height,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  /**
   * Draws 2x2 Twill Carbon Fiber weave across the given rectangle.
   */
  private static drawTwillCarbon(
    aCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    cellSize = 12
  ): void {
    aCtx.save();
    rCtx.save();
    mCtx.save();
    hCtx.save();

    aCtx.beginPath();
    aCtx.rect(x, y, w, h);
    aCtx.clip();

    rCtx.beginPath();
    rCtx.rect(x, y, w, h);
    rCtx.clip();

    mCtx.beginPath();
    mCtx.rect(x, y, w, h);
    mCtx.clip();

    hCtx.beginPath();
    hCtx.rect(x, y, w, h);
    hCtx.clip();

    // Base carbon background
    aCtx.fillStyle = '#121212';
    aCtx.fillRect(x, y, w, h);

    rCtx.fillStyle = 'rgb(89, 89, 89)'; // 0.35 satin sheen
    rCtx.fillRect(x, y, w, h);

    mCtx.fillStyle = 'rgb(0, 0, 0)'; // 0.0 non-metallic resin
    mCtx.fillRect(x, y, w, h);

    // Diagonal twill weave stripes
    const c1 = '#202020';
    const c2 = '#0d0d0d';

    for (let py = y; py < y + h + cellSize; py += cellSize) {
      for (let px = x; px < x + w + cellSize; px += cellSize) {
        const toggle = ((px - x) / cellSize + (py - y) / cellSize) % 2 === 0;
        aCtx.fillStyle = toggle ? c1 : c2;
        aCtx.fillRect(px, py, cellSize, cellSize);

        // Micro weave bump height
        hCtx.fillStyle = toggle ? 'rgb(136, 136, 136)' : 'rgb(120, 120, 120)';
        hCtx.fillRect(px, py, cellSize, cellSize);
      }
    }

    aCtx.restore();
    rCtx.restore();
    mCtx.restore();
    hCtx.restore();
  }

  /**
   * Draws the signature Golden Bull Mascot Head Emblem with glowing neon horns and eyes.
   */
  private static drawBullEmblem(
    aCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    eCtx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number
  ): void {
    const s = scale;

    aCtx.save();
    hCtx.save();
    rCtx.save();
    mCtx.save();
    eCtx.save();

    aCtx.translate(cx, cy);
    hCtx.translate(cx, cy);
    rCtx.translate(cx, cy);
    mCtx.translate(cx, cy);
    eCtx.translate(cx, cy);

    // 1. EMBOSSED GOLD BULL HORNS (Sweeping curved horns)
    const drawHornsPath = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      // Left Horn
      ctx.moveTo(-35 * s, -40 * s);
      ctx.bezierCurveTo(-110 * s, -60 * s, -190 * s, -100 * s, -210 * s, -170 * s);
      ctx.bezierCurveTo(-180 * s, -145 * s, -110 * s, -95 * s, -20 * s, -70 * s);
      // Right Horn
      ctx.lineTo(20 * s, -70 * s);
      ctx.bezierCurveTo(110 * s, -95 * s, 180 * s, -145 * s, 210 * s, -170 * s);
      ctx.bezierCurveTo(190 * s, -100 * s, 110 * s, -60 * s, 35 * s, -40 * s);
      ctx.closePath();
    };

    // Albedo Horns: Gold Gradient (#FFF2A3 -> #FFD700 -> #A87000)
    const goldGrad = aCtx.createLinearGradient(0, -180 * s, 0, -30 * s);
    goldGrad.addColorStop(0, '#FFF6B8');
    goldGrad.addColorStop(0.35, '#FFD700');
    goldGrad.addColorStop(0.8, '#D49200');
    goldGrad.addColorStop(1, '#8A5200');

    drawHornsPath(aCtx);
    aCtx.fillStyle = goldGrad;
    aCtx.fill();
    aCtx.lineWidth = 4 * s;
    aCtx.strokeStyle = '#FFE875';
    aCtx.stroke();

    // Height: High embossed relief (value 210)
    drawHornsPath(hCtx);
    hCtx.fillStyle = 'rgb(210, 210, 210)';
    hCtx.fill();

    // Roughness: 0.10 (mirror gold polish)
    drawHornsPath(rCtx);
    rCtx.fillStyle = 'rgb(25, 25, 25)';
    rCtx.fill();

    // Metalness: 0.98 pure gold metal
    drawHornsPath(mCtx);
    mCtx.fillStyle = 'rgb(250, 250, 250)';
    mCtx.fill();

    // Horn Tips Glowing Neon Green (#00FF6A)
    const drawHornTips = (ctx: CanvasRenderingContext2D, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      // Left tip
      ctx.arc(-205 * s, -165 * s, 14 * s, 0, Math.PI * 2);
      ctx.fill();
      // Right tip
      ctx.arc(205 * s, -165 * s, 14 * s, 0, Math.PI * 2);
      ctx.fill();
    };
    drawHornTips(aCtx, '#00FF6A');
    drawHornTips(eCtx, '#00FF6A');

    // 2. BULL HEAD SHIELD / FOREHEAD PLATE
    const drawFacePath = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.moveTo(0, -75 * s);
      ctx.lineTo(65 * s, -45 * s);
      ctx.lineTo(85 * s, 15 * s);
      ctx.lineTo(45 * s, 85 * s);
      ctx.lineTo(0, 115 * s);
      ctx.lineTo(-45 * s, 85 * s);
      ctx.lineTo(-85 * s, 15 * s);
      ctx.lineTo(-65 * s, -45 * s);
      ctx.closePath();
    };

    drawFacePath(aCtx);
    aCtx.fillStyle = goldGrad;
    aCtx.fill();
    aCtx.lineWidth = 3 * s;
    aCtx.strokeStyle = '#FFEAA0';
    aCtx.stroke();

    drawFacePath(hCtx);
    hCtx.fillStyle = 'rgb(195, 195, 195)';
    hCtx.fill();

    drawFacePath(rCtx);
    rCtx.fillStyle = 'rgb(25, 25, 25)';
    rCtx.fill();

    drawFacePath(mCtx);
    mCtx.fillStyle = 'rgb(250, 250, 250)';
    mCtx.fill();

    // 3. AGGRESSIVE SLIT EYES (Glowing Neon Green #00FF6A)
    const drawEyes = (ctx: CanvasRenderingContext2D, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      // Left eye
      ctx.moveTo(-52 * s, -8 * s);
      ctx.lineTo(-24 * s, 4 * s);
      ctx.lineTo(-48 * s, 12 * s);
      ctx.closePath();
      ctx.fill();
      // Right eye
      ctx.moveTo(52 * s, -8 * s);
      ctx.lineTo(24 * s, 4 * s);
      ctx.lineTo(48 * s, 12 * s);
      ctx.closePath();
      ctx.fill();
    };
    drawEyes(aCtx, '#00FF6A');
    drawEyes(eCtx, '#00FF6A');

    // 4. BULL SNOUT & GOLD SEPTUM NOSE RING
    aCtx.fillStyle = '#C88500';
    aCtx.beginPath();
    aCtx.ellipse(0, 58 * s, 32 * s, 22 * s, 0, 0, Math.PI * 2);
    aCtx.fill();

    // Gold Septum Ring
    aCtx.strokeStyle = '#FFD700';
    aCtx.lineWidth = 5 * s;
    aCtx.beginPath();
    aCtx.arc(0, 80 * s, 18 * s, 0, Math.PI);
    aCtx.stroke();

    hCtx.strokeStyle = 'rgb(230, 230, 230)';
    hCtx.lineWidth = 5 * s;
    hCtx.beginPath();
    hCtx.arc(0, 80 * s, 18 * s, 0, Math.PI);
    hCtx.stroke();

    aCtx.restore();
    hCtx.restore();
    rCtx.restore();
    mCtx.restore();
    eCtx.restore();
  }

  /**
   * Draws the prominent '$85' cash typography with neon green borders and emissive glow.
   */
  private static drawCashLettering(
    aCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    eCtx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    fontSize: number
  ): void {
    const fontStr = `900 ${Math.round(fontSize)}px "Impact", "Arial Black", sans-serif`;

    aCtx.save();
    hCtx.save();
    rCtx.save();
    mCtx.save();
    eCtx.save();

    aCtx.font = fontStr;
    hCtx.font = fontStr;
    rCtx.font = fontStr;
    mCtx.font = fontStr;
    eCtx.font = fontStr;

    aCtx.textAlign = 'center';
    hCtx.textAlign = 'center';
    rCtx.textAlign = 'center';
    mCtx.textAlign = 'center';
    eCtx.textAlign = 'center';

    aCtx.textBaseline = 'middle';
    hCtx.textBaseline = 'middle';
    rCtx.textBaseline = 'middle';
    mCtx.textBaseline = 'middle';
    eCtx.textBaseline = 'middle';

    const text = '$85';

    // Albedo: White fill with bold Neon Green (#00FF6A) stroke
    aCtx.strokeStyle = '#00FF6A';
    aCtx.lineWidth = fontSize * 0.16;
    aCtx.strokeText(text, cx, cy);

    aCtx.fillStyle = '#FFFFFF';
    aCtx.fillText(text, cx, cy);

    // Height: Embossed typography relief (value 175)
    hCtx.fillStyle = 'rgb(175, 175, 175)';
    hCtx.fillText(text, cx, cy);

    // Roughness: 0.20
    rCtx.fillStyle = 'rgb(51, 51, 51)';
    rCtx.fillText(text, cx, cy);

    // Metalness: 0.0
    mCtx.fillStyle = 'rgb(0, 0, 0)';
    mCtx.fillText(text, cx, cy);

    // Emissive: Neon Green stroke glow
    eCtx.strokeStyle = '#00FF6A';
    eCtx.lineWidth = fontSize * 0.14;
    eCtx.strokeText(text, cx, cy);

    eCtx.fillStyle = '#00FF6A';
    eCtx.fillText(text, cx, cy);

    aCtx.restore();
    hCtx.restore();
    rCtx.restore();
    mCtx.restore();
    eCtx.restore();
  }

  /**
   * Draws the front honeycomb grille mesh pattern with lower neon LED strip.
   */
  private static drawHoneycombMesh(
    aCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    eCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    aCtx.save();
    hCtx.save();
    rCtx.save();
    mCtx.save();
    eCtx.save();

    // Dark metallic intake recess
    aCtx.fillStyle = '#0B0F0C';
    aCtx.fillRect(x, y, w, h);

    hCtx.fillStyle = 'rgb(60, 60, 60)';
    hCtx.fillRect(x, y, w, h);

    rCtx.fillStyle = 'rgb(178, 178, 178)'; // 0.70 matte metal
    rCtx.fillRect(x, y, w, h);

    mCtx.fillStyle = 'rgb(214, 214, 214)'; // 0.84 dark steel
    mCtx.fillRect(x, y, w, h);

    // Hexagonal cell grid
    const hexRadius = 14;
    const hexW = hexRadius * Math.sqrt(3);
    const hexH = hexRadius * 1.5;

    aCtx.strokeStyle = '#1F2922';
    aCtx.lineWidth = 2.5;

    hCtx.strokeStyle = 'rgb(165, 165, 165)';
    hCtx.lineWidth = 2.5;

    for (let py = y + hexRadius; py < y + h; py += hexH) {
      const offsetX = ((py - y) / hexH) % 2 === 0 ? 0 : hexW * 0.5;
      for (let px = x + hexRadius + offsetX; px < x + w - hexRadius; px += hexW) {
        aCtx.beginPath();
        hCtx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = px + hexRadius * Math.cos(angle);
          const hy = py + hexRadius * Math.sin(angle);
          if (i === 0) {
            aCtx.moveTo(hx, hy);
            hCtx.moveTo(hx, hy);
          } else {
            aCtx.lineTo(hx, hy);
            hCtx.lineTo(hx, hy);
          }
        }
        aCtx.closePath();
        hCtx.closePath();
        aCtx.stroke();
        hCtx.stroke();
      }
    }

    // Lower Neon Lip LED Bar (#00FF6A)
    const lipY = y + h - 10;
    aCtx.fillStyle = '#00FF6A';
    aCtx.fillRect(x, lipY, w, 10);

    eCtx.fillStyle = '#00FF6A';
    eCtx.fillRect(x, lipY, w, 10);

    hCtx.fillStyle = 'rgb(180, 180, 180)';
    hCtx.fillRect(x, lipY, w, 10);

    aCtx.restore();
    hCtx.restore();
    rCtx.restore();
    mCtx.restore();
    eCtx.restore();
  }

  /**
   * Draws side door graphics (Mirrored Bull Decal, speed lines, and race number).
   */
  private static drawDoorGraphics(
    aCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    eCtx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    flipX: boolean
  ): void {
    aCtx.save();
    hCtx.save();
    rCtx.save();
    mCtx.save();
    eCtx.save();

    if (flipX) {
      aCtx.translate(cx, cy);
      aCtx.scale(-1, 1);
      aCtx.translate(-cx, -cy);

      hCtx.translate(cx, cy);
      hCtx.scale(-1, 1);
      hCtx.translate(-cx, -cy);

      rCtx.translate(cx, cy);
      rCtx.scale(-1, 1);
      rCtx.translate(-cx, -cy);

      mCtx.translate(cx, cy);
      mCtx.scale(-1, 1);
      mCtx.translate(-cx, -cy);

      eCtx.translate(cx, cy);
      eCtx.scale(-1, 1);
      eCtx.translate(-cx, -cy);
    }

    // Bull Emblem on Door
    this.drawBullEmblem(aCtx, hCtx, rCtx, mCtx, eCtx, cx, cy - 30 * scale, scale * 0.7);

    // Neon Green Aerodynamic Speed Pinstripes
    const speedY = cy + 120 * scale;
    aCtx.fillStyle = '#00FF6A';
    aCtx.fillRect(cx - 140 * scale, speedY, 280 * scale, 8 * scale);
    aCtx.fillRect(cx - 100 * scale, speedY + 16 * scale, 200 * scale, 5 * scale);

    eCtx.fillStyle = '#00FF6A';
    eCtx.fillRect(cx - 140 * scale, speedY, 280 * scale, 8 * scale);
    eCtx.fillRect(cx - 100 * scale, speedY + 16 * scale, 200 * scale, 5 * scale);

    // Side Door "$85"
    aCtx.font = `bold ${Math.round(44 * scale)}px monospace`;
    aCtx.fillStyle = '#FFFFFF';
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.fillText('$85', cx, cy + 65 * scale);

    aCtx.restore();
    hCtx.restore();
    rCtx.restore();
    mCtx.restore();
    eCtx.restore();
  }

  /**
   * Draws hood air louvers / cooling slats with directional normal slope in height map.
   */
  private static drawAirLouvers(
    hCtx: CanvasRenderingContext2D,
    aCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const louverCount = 5;
    const louverH = Math.floor(h / louverCount);

    for (let i = 0; i < louverCount; i++) {
      const ly = y + i * louverH;
      // Slanted louver ramp in height
      const grad = hCtx.createLinearGradient(0, ly, 0, ly + louverH - 3);
      grad.addColorStop(0, 'rgb(70, 70, 70)');
      grad.addColorStop(1, 'rgb(190, 190, 190)');
      hCtx.fillStyle = grad;
      hCtx.fillRect(x, ly, w, louverH - 3);

      // Deep intake shadow slot
      hCtx.fillStyle = 'rgb(30, 30, 30)';
      hCtx.fillRect(x, ly + louverH - 3, w, 3);

      // Albedo shadow
      aCtx.fillStyle = '#00471c';
      aCtx.fillRect(x, ly + louverH - 3, w, 3);

      rCtx.fillStyle = 'rgb(120, 120, 120)';
      rCtx.fillRect(x, ly, w, louverH);
    }
  }

  /**
   * Draws crisp recessed panel seams and shut lines.
   */
  private static drawPanelSeams(
    aCtx: CanvasRenderingContext2D,
    hCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    mCtx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    const drawSeam = (x1: number, y1: number, x2: number, y2: number) => {
      // Dark seam in Albedo
      aCtx.strokeStyle = '#003314';
      aCtx.lineWidth = 3;
      aCtx.beginPath();
      aCtx.moveTo(x1, y1);
      aCtx.lineTo(x2, y2);
      aCtx.stroke();

      // Deep groove in Height map (value 40)
      hCtx.strokeStyle = 'rgb(40, 40, 40)';
      hCtx.lineWidth = 3;
      hCtx.beginPath();
      hCtx.moveTo(x1, y1);
      hCtx.lineTo(x2, y2);
      hCtx.stroke();

      // Roughness 0.86 in seam
      rCtx.strokeStyle = 'rgb(220, 220, 220)';
      rCtx.lineWidth = 3;
      rCtx.beginPath();
      rCtx.moveTo(x1, y1);
      rCtx.lineTo(x2, y2);
      rCtx.stroke();

      // Metalness 0.0 in seam
      mCtx.strokeStyle = 'rgb(0, 0, 0)';
      mCtx.lineWidth = 3;
      mCtx.beginPath();
      mCtx.moveTo(x1, y1);
      mCtx.lineTo(x2, y2);
      mCtx.stroke();
    };

    // Hood perimeter shut lines
    drawSeam(w * 0.32, h * 0.12, w * 0.32, h * 0.74);
    drawSeam(w * 0.68, h * 0.12, w * 0.68, h * 0.74);
    drawSeam(w * 0.32, h * 0.74, w * 0.68, h * 0.74);
    drawSeam(w * 0.32, h * 0.12, w * 0.68, h * 0.12);

    // Side Door Seams
    drawSeam(w * 0.08, h * 0.38, w * 0.28, h * 0.38);
    drawSeam(w * 0.08, h * 0.68, w * 0.28, h * 0.68);
    drawSeam(w * 0.72, h * 0.38, w * 0.92, h * 0.38);
    drawSeam(w * 0.72, h * 0.68, w * 0.92, h * 0.68);
  }

  /**
   * Fast, mathematical Sobel / Central-difference height-to-normal tangent space converter.
   * Converts height canvas into an RGB normal map: (R = Nx, G = Ny, B = Nz).
   */
  private static generateNormalMapFromHeight(heightCanvas: HTMLCanvasElement, strength = 3.0): HTMLCanvasElement {
    const width = heightCanvas.width;
    const height = heightCanvas.height;

    const normalCanvas = this.createCanvas(width, height);
    const normalCtx = normalCanvas.getContext('2d')!;
    const heightCtx = heightCanvas.getContext('2d')!;

    const heightImg = heightCtx.getImageData(0, 0, width, height);
    const heightData = heightImg.data;

    const normalImg = normalCtx.createImageData(width, height);
    const normalData = normalImg.data;

    for (let y = 0; y < height; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(height - 1, y + 1);
      const rowOffset = y * width;
      const rowPrev = yPrev * width;
      const rowNext = yNext * width;

      for (let x = 0; x < width; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(width - 1, x + 1);

        // Sample grayscale height (R channel)
        const left = heightData[(rowOffset + xPrev) * 4];
        const right = heightData[(rowOffset + xNext) * 4];
        const top = heightData[(rowPrev + x) * 4];
        const bottom = heightData[(rowNext + x) * 4];

        // Central difference gradient
        const dx = (right - left) / 255.0;
        const dy = (bottom - top) / 255.0;

        // Tangent space normal vector
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1.0;

        // Normalize
        const len = Math.hypot(nx, ny, nz);
        const invLen = len > 0.0001 ? 1.0 / len : 1.0;

        const idx = (rowOffset + x) * 4;
        normalData[idx] = Math.round(((nx * invLen) * 0.5 + 0.5) * 255);
        normalData[idx + 1] = Math.round(((ny * invLen) * 0.5 + 0.5) * 255);
        normalData[idx + 2] = Math.round(((nz * invLen) * 0.5 + 0.5) * 255);
        normalData[idx + 3] = 255;
      }
    }

    normalCtx.putImageData(normalImg, 0, 0);
    return normalCanvas;
  }
}
