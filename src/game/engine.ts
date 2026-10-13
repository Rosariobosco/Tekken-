import * as THREE from 'three';
import { TekkenFighter, HitboxData, HurtboxData } from './fighter';

export interface VisualParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public debugGroup: THREE.Group;
  public debugHitboxesEnabled: boolean = false;

  private currentStageGroup: THREE.Group;
  private stageGlowLight: THREE.PointLight;
  private particles: VisualParticle[] = [];
  public activeStageName: string = 'dojo';

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0c16, 0.016);

    this.camera = new THREE.PerspectiveCamera(
      43,
      window.innerWidth / window.innerHeight,
      0.5,
      120
    );
    this.camera.position.set(0, 3.2, 11);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x556080, 1.4);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.4);
    keyLight.position.set(6, 14, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff2222, 1.8);
    rimLight.position.set(-8, 9, -7);
    this.scene.add(rimLight);

    this.stageGlowLight = new THREE.PointLight(0xffaa22, 2.2, 24);
    this.stageGlowLight.position.set(0, 1.2, 0);
    this.scene.add(this.stageGlowLight);

    this.currentStageGroup = new THREE.Group();
    this.scene.add(this.currentStageGroup);

    this.debugGroup = new THREE.Group();
    this.scene.add(this.debugGroup);

    this.buildStage('dojo');

    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  public setStage(stageName: string) {
    this.activeStageName = stageName;
    this.buildStage(stageName);
  }

  public buildStage(stageName: string) {
    while (this.currentStageGroup.children.length > 0) {
      const child = this.currentStageGroup.children[0];
      this.currentStageGroup.remove(child);
    }

    if (stageName === 'dojo') {
      this.buildMishimaDojo();
    } else {
      this.buildVolcanoCaldera();
    }
  }

  private buildMishimaDojo() {
    this.scene.fog!.color.setHex(0x0a0c16);
    this.scene.background = new THREE.Color(0x060810);
    this.stageGlowLight.color.setHex(0xffaa22);

    // Floor Platform
    const floorGeo = new THREE.BoxGeometry(28, 1.2, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x22170f,
      roughness: 0.45,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    floor.receiveShadow = true;
    this.currentStageGroup.add(floor);

    // Tatami Ring
    const tatamiGeo = new THREE.BoxGeometry(25, 0.04, 9);
    const tatamiMat = new THREE.MeshStandardMaterial({ color: 0x422d1b, roughness: 0.7 });
    const tatami = new THREE.Mesh(tatamiGeo, tatamiMat);
    tatami.position.y = 0.01;
    tatami.receiveShadow = true;
    this.currentStageGroup.add(tatami);

    // Crimson Temple Pillars with Lantern Glow
    for (let i = -4; i <= 4; i++) {
      const colGeo = new THREE.CylinderGeometry(0.42, 0.48, 10, 16);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x771111, roughness: 0.5 });
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(i * 3.4, 4.4, -5.2);
      this.currentStageGroup.add(col);

      const lanternGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff8811 });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(i * 3.4, 3.8, -4.8);
      this.currentStageGroup.add(lantern);
    }

    // Backdrop
    const bgGeo = new THREE.PlaneGeometry(42, 18);
    const bgMat = new THREE.MeshStandardMaterial({ color: 0x090c1a, roughness: 0.9 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 8, -7.5);
    this.currentStageGroup.add(bg);
  }

  private buildVolcanoCaldera() {
    this.scene.fog!.color.setHex(0x180404);
    this.scene.background = new THREE.Color(0x0c0202);
    this.stageGlowLight.color.setHex(0xff3300);

    const floorGeo = new THREE.BoxGeometry(26, 1.2, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141214,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    floor.receiveShadow = true;
    this.currentStageGroup.add(floor);

    // Lava cracks
    const lavaGeo = new THREE.BoxGeometry(24, 0.05, 0.4);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const seam1 = new THREE.Mesh(lavaGeo, lavaMat);
    seam1.position.set(0, 0.02, 3.0);
    this.currentStageGroup.add(seam1);

    const seam2 = seam1.clone();
    seam2.position.z = -3.0;
    this.currentStageGroup.add(seam2);

    for (let i = -3; i <= 3; i++) {
      const spireGeo = new THREE.ConeGeometry(0.8, 8, 6);
      const spireMat = new THREE.MeshStandardMaterial({ color: 0x0f0b0c, roughness: 0.95 });
      const spire = new THREE.Mesh(spireGeo, spireMat);
      spire.position.set(i * 4.2 + Math.sin(i) * 0.8, 3.5, -5.5);
      this.currentStageGroup.add(spire);
    }

    const bgGeo = new THREE.PlaneGeometry(42, 18);
    const bgMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.9 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 8, -7.5);
    this.currentStageGroup.add(bg);
  }

  public spawnHitSparks(x: number, y: number, z: number, heavy: boolean = false) {
    const count = heavy ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(heavy ? 0.09 : 0.06, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: heavy ? 0xffcc00 : 0xff2244 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);

      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 7 + 4) * (heavy ? 1.3 : 1.0);
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * 5
      );

      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 0.28, maxLife: 0.28 });
    }
  }

  public spawnElectricFlash(x: number, y: number, z: number, colorHex: number) {
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z);
      p.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 3
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 0.35, maxLife: 0.35 });
    }
  }

  public spawnBlockSparks(x: number, y: number, z: number) {
    for (let i = 0; i < 9; i++) {
      const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4,
        (Math.random() - 0.5) * 2
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 0.18, maxLife: 0.18 });
    }
  }

  public updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  public updateCamera(p1: TekkenFighter, p2: TekkenFighter) {
    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const dist = Math.abs(p1.x - p2.x);

    const targetX = midX * 0.85;
    const targetZ = Math.max(9.0, 7.0 + dist * 0.75);
    const targetY = 2.6 + Math.max(p1.y, p2.y) * 0.25;

    this.camera.position.x += (targetX - this.camera.position.x) * 0.08;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.08;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.08;
    this.camera.lookAt(midX, 1.4, midZ * 0.5);
  }

  public check3DCollision(boxA: HitboxData | HurtboxData, boxB: HurtboxData): boolean {
    const aMinX = boxA.offset.x - boxA.size.x / 2;
    const aMaxX = boxA.offset.x + boxA.size.x / 2;
    const aMinY = boxA.offset.y - boxA.size.y / 2;
    const aMaxY = boxA.offset.y + boxA.size.y / 2;
    const aMinZ = boxA.offset.z - boxA.size.z / 2;
    const aMaxZ = boxA.offset.z + boxA.size.z / 2;

    const bMinX = boxB.offset.x - boxB.size.x / 2;
    const bMaxX = boxB.offset.x + boxB.size.x / 2;
    const bMinY = boxB.offset.y - boxB.size.y / 2;
    const bMaxY = boxB.offset.y + boxB.size.y / 2;
    const bMinZ = boxB.offset.z - boxB.size.z / 2;
    const bMaxZ = boxB.offset.z + boxB.size.z / 2;

    return (
      aMinX <= bMaxX &&
      aMaxX >= bMinX &&
      aMinY <= bMaxY &&
      aMaxY >= bMinY &&
      aMinZ <= bMaxZ &&
      aMinZ <= bMaxZ &&
      aMaxZ >= bMinZ
    );
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
