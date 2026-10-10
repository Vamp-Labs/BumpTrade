import * as THREE from 'three';

/**
 * ArenaProps - Stadium Environment Framing & Digital Market Signage.
 * Features:
 * - Elevated North Marquee Screen with live pulse line
 * - East and West Wall Ticker Screens ($DOGE +42%, $GME +69%, $NVDA +4.6%, $TSLA -1.2%)
 * - 4 Exterior Industrial Corner Towers (outside the driving box at ±25.5m)
 * - Perimeter Spectator Neon Barriers & Retro Arcade Cabinets (outside walls, zero driving obstruction)
 */
export class ArenaProps {
  public readonly group: THREE.Group = new THREE.Group();

  private animatedTextures: { tex: THREE.CanvasTexture; speed: number }[] = [];
  private animTime: number = 0;
  private cornerBeacons: THREE.Mesh[] = [];

  constructor() {
    this.buildElevatedNorthBillboard();
    this.buildEastWestBillboards();
    this.buildCornerStadiumTowers();
    this.buildPerimeterArcadeAndBarriers();
  }

  // --- 1. ELEVATED NORTH WALL BILLBOARD (Y = 4.8m, Z = 24.2m) ---
  private buildElevatedNorthBillboard(): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x161b26,
      metalness: 0.85,
      roughness: 0.3,
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x10141e,
      metalness: 0.9,
      roughness: 0.2,
    });

    const marqueeTex = this.createBumpTradeMarqueeTexture();
    const marqueeMat = new THREE.MeshBasicMaterial({ map: marqueeTex });

    const marqueeGroup = new THREE.Group();
    const mW = 12.0;
    const mH = 3.4;
    const mD = 0.6;

    // Outer heavy steel box frame
    const mFrameGeo = new THREE.BoxGeometry(mW + 0.4, mH + 0.4, mD);
    const mFrame = new THREE.Mesh(mFrameGeo, frameMat);
    marqueeGroup.add(mFrame);

    // Beveled angled sun hood / visor
    const visorGeo = new THREE.BoxGeometry(mW + 0.6, 0.2, mD + 0.35);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, mH * 0.5 + 0.15, 0.15);
    marqueeGroup.add(visor);

    // Screen face
    const mScreenGeo = new THREE.PlaneGeometry(mW, mH);
    const mScreen = new THREE.Mesh(mScreenGeo, marqueeMat);
    mScreen.position.set(0, 0, mD * 0.5 + 0.02);
    marqueeGroup.add(mScreen);

    // Mount high as an exterior stadium billboard (Y = 8.2m, Z = 26.5m - clears center UI corridor!)
    marqueeGroup.position.set(0, 8.2, 26.5);
    marqueeGroup.rotation.y = Math.PI; // Faces into arena (-Z)
    this.group.add(marqueeGroup);
  }

  // --- 2. EAST & WEST WALL TICKER SCREENS ---
  private buildEastWestBillboards(): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      metalness: 0.88,
      roughness: 0.32,
    });

    // East Screen ($DOGE & $GME tickers)
    const eastTex = this.createSideTickerTexture(
      '$DOGE +42.0% ▲',
      '$GME +69.0% ▲',
      '#ffaa00',
      '#ff2a5f',
      'MEME SECTOR VOLATILITY: EXTREME'
    );
    const eastMat = new THREE.MeshBasicMaterial({ map: eastTex });
    const eastGroup = new THREE.Group();
    const sW = 7.5;
    const sH = 2.4;

    const eastFrame = new THREE.Mesh(new THREE.BoxGeometry(sW + 0.3, sH + 0.3, 0.4), frameMat);
    eastGroup.add(eastFrame);
    const eastScreen = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), eastMat);
    eastScreen.position.set(0, 0, 0.22);
    eastGroup.add(eastScreen);
    eastGroup.position.set(24.2, 3.8, 0);
    eastGroup.rotation.y = -Math.PI / 2; // Faces West into arena
    this.group.add(eastGroup);

    // West Screen ($NVDA & $TSLA tickers)
    const westTex = this.createSideTickerTexture(
      '$NVDA +4.6% ▲',
      '$TSLA -1.2% ▼',
      '#00ff88',
      '#ff3b5f',
      'TECH INDEX LEVERAGE: 100X'
    );
    const westMat = new THREE.MeshBasicMaterial({ map: westTex });
    const westGroup = new THREE.Group();

    const westFrame = new THREE.Mesh(new THREE.BoxGeometry(sW + 0.3, sH + 0.3, 0.4), frameMat);
    westGroup.add(westFrame);
    const westScreen = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), westMat);
    westScreen.position.set(0, 0, 0.22);
    westGroup.add(westScreen);
    westGroup.position.set(-24.2, 3.8, 0);
    westGroup.rotation.y = Math.PI / 2; // Faces East into arena
    this.group.add(westGroup);
  }

  // --- 3. 4 EXTERIOR CORNER STADIUM TOWERS (Outside Wall Corners at ±25.5m) ---
  private buildCornerStadiumTowers(): void {
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x121622,
      metalness: 0.9,
      roughness: 0.3,
    });

    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    });

    const cornerDist = 25.5;
    const towerH = 6.2;
    const towerW = 1.8;

    const corners = [
      { x: cornerDist, z: cornerDist, rotY: -Math.PI * 0.75 },
      { x: -cornerDist, z: cornerDist, rotY: Math.PI * 0.75 },
      { x: cornerDist, z: -cornerDist, rotY: -Math.PI * 0.25 },
      { x: -cornerDist, z: -cornerDist, rotY: Math.PI * 0.25 },
    ];

    corners.forEach((c) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(c.x, 0, c.z);
      towerGroup.rotation.y = c.rotY;

      // Base Pillar Column
      const colGeo = new THREE.BoxGeometry(towerW, towerH, towerW);
      const colMesh = new THREE.Mesh(colGeo, towerMat);
      colMesh.position.y = towerH * 0.5;
      colMesh.castShadow = true;
      towerGroup.add(colMesh);

      // Vertical LED status screen face
      const screenTex = this.createVerticalTowerScreenTexture();
      const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
      const screenGeo = new THREE.PlaneGeometry(towerW * 0.8, towerH * 0.7);
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, towerH * 0.5, towerW * 0.5 + 0.02);
      towerGroup.add(screenMesh);

      // Top Hazard Warning Beacon
      const beaconGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.45, 12);
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.y = towerH + 0.25;
      towerGroup.add(beaconMesh);
      this.cornerBeacons.push(beaconMesh);

      this.group.add(towerGroup);
    });
  }

  // --- 4. PERIMETER RETRO ARCADE CABINETS & SPECTATOR BARRIERS ---
  private buildPerimeterArcadeAndBarriers(): void {
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0x181c28,
      metalness: 0.8,
      roughness: 0.4,
    });

    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const marqueeMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    // Placement slots along the outer perimeter (outside walls)
    const cabinetPositions = [
      { x: -12, z: 25.2, rotY: Math.PI },
      { x: 12, z: 25.2, rotY: Math.PI },
      { x: -25.2, z: -10, rotY: Math.PI / 2 },
      { x: -25.2, z: 10, rotY: Math.PI / 2 },
      { x: 25.2, z: -10, rotY: -Math.PI / 2 },
      { x: 25.2, z: 10, rotY: -Math.PI / 2 },
    ];

    cabinetPositions.forEach((pos) => {
      const cabGroup = new THREE.Group();
      cabGroup.position.set(pos.x, 0, pos.z);
      cabGroup.rotation.y = pos.rotY;

      // Lower body
      const bodyGeo = new THREE.BoxGeometry(0.85, 1.8, 0.85);
      const bodyMesh = new THREE.Mesh(bodyGeo, cabMat);
      bodyMesh.position.y = 0.9;
      cabGroup.add(bodyMesh);

      // Angled monitor screen
      const monGeo = new THREE.PlaneGeometry(0.65, 0.55);
      const monMesh = new THREE.Mesh(monGeo, screenMat);
      monMesh.position.set(0, 1.25, 0.44);
      cabGroup.add(monMesh);

      // Top illuminated marquee
      const marqGeo = new THREE.BoxGeometry(0.8, 0.25, 0.15);
      const marqMesh = new THREE.Mesh(marqGeo, marqueeMat);
      marqMesh.position.set(0, 1.72, 0.4);
      cabGroup.add(marqMesh);

      this.group.add(cabGroup);
    });

    // Spectator Neon Glass Barriers along South Wall exterior
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x141a24,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x002233,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
    });

    const barrierSlots = [-14, -7, 0, 7, 14];
    barrierSlots.forEach((bx) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, 0, -25.4);

      const frameGeo = new THREE.BoxGeometry(5.8, 1.1, 0.12);
      const frameMesh = new THREE.Mesh(frameGeo, barrierMat);
      frameMesh.position.y = 0.55;
      bGroup.add(frameMesh);

      const glassGeo = new THREE.PlaneGeometry(5.4, 0.7);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, 0.65, 0.08);
      bGroup.add(glassMesh);

      this.group.add(bGroup);
    });
  }

  // --- TEXTURE HELPERS ---
  private createBumpTradeMarqueeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Dark cyber backdrop
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 1024, 320);

    // Grid matrix
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 320); ctx.stroke();
    }
    for (let y = 0; y <= 320; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
    }

    // Border neon frame
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 1004, 300);

    // Center Branding
    ctx.textAlign = 'center';
    ctx.font = '900 68px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('BUMP.TRADE', 512, 105);

    ctx.font = '700 24px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('● MARKET ARENA #01 // LIVE COMBAT ●', 512, 160);

    // Oscilloscope pulse line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(80, 220); ctx.lineTo(240, 220); ctx.lineTo(290, 180);
    ctx.lineTo(340, 250); ctx.lineTo(390, 160); ctx.lineTo(440, 230);
    ctx.lineTo(490, 210); ctx.lineTo(540, 220); ctx.lineTo(600, 220);
    ctx.lineTo(640, 170); ctx.lineTo(680, 260); ctx.lineTo(730, 200);
    ctx.lineTo(780, 220); ctx.lineTo(944, 220);
    ctx.stroke();

    // Bottom Status Bar
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('VOLATILITY: HIGH  |  LEVERAGE: 100X  |  LIQUIDATION: REALTIME', 512, 280);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createSideTickerTexture(
    t1: string,
    t2: string,
    c1: string,
    c2: string,
    sub: string
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 220;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, 640, 220);

    // Cyber border
    ctx.strokeStyle = c1;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 628, 208);

    // Ticker rows
    ctx.textAlign = 'left';
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = c1;
    ctx.fillText(t1, 30, 70);

    ctx.fillStyle = c2;
    ctx.fillText(t2, 30, 130);

    // Subtitle
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#8ca0c0';
    ctx.fillText(sub, 30, 185);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createVerticalTowerScreenTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 256, 512);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 504);

    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('ARENA #01', 128, 50);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('STATUS: ACTIVE', 128, 90);
    ctx.fillText('CASH RAIN: ON', 128, 125);
    ctx.fillText('PVP 0-SUM', 128, 160);

    // Volume level bars
    for (let i = 0; i < 8; i++) {
      const barY = 220 + i * 32;
      const barW = 120 + Math.sin(i * 1.5) * 60;
      ctx.fillStyle = i < 3 ? '#ff3b5f' : i < 6 ? '#ffaa00' : '#00ff88';
      ctx.fillRect(128 - barW * 0.5, barY, barW, 20);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  public update(dt: number): void {
    this.animTime += dt;
    for (const item of this.animatedTextures) {
      item.tex.offset.x = (item.tex.offset.x + dt * item.speed) % 1.0;
    }

    // Gentle beacon pulsation
    const beaconPulse = 2.0 + Math.sin(this.animTime * 6.0) * 0.8;
    for (const b of this.cornerBeacons) {
      (b.material as THREE.MeshStandardMaterial).emissiveIntensity = beaconPulse;
    }
  }
}
