import * as THREE from 'three';
import { sound } from './audio';

export interface FighterConfig {
  name: string;
  colorHex: number;
  accentHex: number;
  giColorHex: number;
  speed: number;
  jumpPower: number;
  specialName: string;
  style: string;
}

export const FIGHTER_CONFIGS: Record<string, FighterConfig> = {
  jin: {
    name: 'Jin K.',
    colorHex: 0xdc143c,
    accentHex: 0xffaa00,
    giColorHex: 0x181a24,
    speed: 5.0,
    jumpPower: 8.8,
    specialName: 'Electric Wind God Fist (EWGF)',
    style: 'Kazama Karate',
  },
  kazuya: {
    name: 'Kazuya M.',
    colorHex: 0x114499,
    accentHex: 0x00e1ff,
    giColorHex: 0x11131c,
    speed: 4.6,
    jumpPower: 8.2,
    specialName: 'Dragon Uppercut Launcher',
    style: 'Mishima Karate',
  },
};

export interface HitboxData {
  active: boolean;
  offset: THREE.Vector3;
  size: THREE.Vector3;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  isLauncher: boolean;
  isHeavy: boolean;
}

export interface HurtboxData {
  offset: THREE.Vector3;
  size: THREE.Vector3;
}

export class TekkenFighter {
  public playerId: number;
  public fighterType: string;
  public config: FighterConfig;

  // 3D Coordinates along the fighting plane & sidestep axis
  public x: number;
  public y: number;
  public z: number;
  public targetZ: number;
  public vx: number = 0;
  public vy: number = 0;
  public facing: number; // 1 = facing right, -1 = facing left

  // Combat State
  public maxHealth: number = 100;
  public health: number = 100;
  public roundsWon: number = 0;
  public comboCount: number = 0;
  public comboResetTimer: number = 0;
  public isRageMode: boolean = false;

  // State Machine
  // 'IDLE' | 'WALK_FWD' | 'WALK_BACK' | 'SIDESTEP' | 'JUMP' | 'CROUCH' | 'ATTACK' | 'BLOCK' | 'HIT_STUN' | 'KNOCKED_DOWN'
  public state: string = 'IDLE';
  public stateTimer: number = 0;
  public currentAttack: string | null = null;
  public attackHitRegistered: boolean = false;
  public queuedAttack: string | null = null;
  public attackDuration: number = 0;
  public hitboxActiveStart: number = 0;
  public hitboxActiveEnd: number = 0;
  public stunDuration: number = 0;
  public blockDuration: number = 0;

  // 3D Scene Graph
  public group: THREE.Group;
  private hipNode!: THREE.Group;
  private torsoMesh!: THREE.Mesh;
  private headGroup!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;

  // Collision Volumes (3D AABB)
  public hurtbox: HurtboxData;
  public hitbox: HitboxData;
  public hurtboxMesh: THREE.Mesh;
  public hitboxMesh: THREE.Mesh;

  // Visual FX emitter hooks
  public onHitParticle?: (x: number, y: number, z: number, heavy: boolean) => void;
  public onElectricParticle?: (x: number, y: number, z: number, color: number) => void;
  public onBlockParticle?: (x: number, y: number, z: number) => void;

  constructor(
    playerId: number,
    fighterType: string,
    startX: number,
    scene: THREE.Scene,
    debugGroup: THREE.Group,
    debugEnabled: boolean
  ) {
    this.playerId = playerId;
    this.fighterType = fighterType;
    this.config = FIGHTER_CONFIGS[fighterType] || FIGHTER_CONFIGS.jin;
    this.x = startX;
    this.y = 0;
    this.z = 0;
    this.targetZ = 0;
    this.facing = playerId === 1 ? 1 : -1;

    this.group = new THREE.Group();
    this.buildFighterMesh();
    scene.add(this.group);

    // Collision volumes
    this.hurtbox = {
      offset: new THREE.Vector3(0, 1.1, 0),
      size: new THREE.Vector3(0.85, 2.1, 1.1),
    };

    this.hitbox = {
      active: false,
      offset: new THREE.Vector3(0.5, 1.4, 0),
      size: new THREE.Vector3(0.65, 0.55, 0.9),
      damage: 10,
      hitstun: 0.28,
      blockstun: 0.14,
      knockback: 2.5,
      isLauncher: false,
      isHeavy: false,
    };

    this.hurtboxMesh = this.createBoxHelper(this.hurtbox.size, 0x00ff88, debugGroup, debugEnabled);
    this.hitboxMesh = this.createBoxHelper(this.hitbox.size, 0xff1133, debugGroup, debugEnabled);
  }

  private createBoxHelper(
    size: THREE.Vector3,
    color: number,
    group: THREE.Group,
    visible: boolean
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = visible;
    group.add(mesh);
    return mesh;
  }

  private buildFighterMesh() {
    const matMain = new THREE.MeshStandardMaterial({
      color: this.config.colorHex,
      roughness: 0.35,
      metalness: 0.35,
    });
    const matAccent = new THREE.MeshStandardMaterial({
      color: this.config.accentHex,
      roughness: 0.2,
      metalness: 0.7,
    });
    const matKarateGi = new THREE.MeshStandardMaterial({
      color: this.config.giColorHex,
      roughness: 0.8,
    });
    const matFlesh = new THREE.MeshStandardMaterial({
      color: 0xd9a47f,
      roughness: 0.6,
    });

    // Root Hip
    this.hipNode = new THREE.Group();
    this.hipNode.position.y = 1.05;

    // Belt & Gi Torso
    const giBelt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.44), matAccent);
    this.hipNode.add(giBelt);

    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.82, 0.46), matKarateGi);
    this.torsoMesh.position.y = 0.48;
    this.torsoMesh.castShadow = true;
    this.hipNode.add(this.torsoMesh);

    // Spiked Martial Arts Head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.02, 0);

    const face = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), matFlesh);
    this.headGroup.add(face);

    // Headband / Spiky Hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.44), matAccent);
    hair.position.set(0, 0.2, -0.02);
    this.headGroup.add(hair);

    this.hipNode.add(this.headGroup);

    // Limbs
    this.armL = this.createArm(matKarateGi, matAccent, matFlesh);
    this.armL.position.set(-0.5, 0.8, 0);
    this.hipNode.add(this.armL);

    this.armR = this.createArm(matKarateGi, matAccent, matFlesh);
    this.armR.position.set(0.5, 0.8, 0);
    this.hipNode.add(this.armR);

    this.legL = this.createLeg(matKarateGi, matAccent);
    this.legL.position.set(-0.25, 0, 0);
    this.hipNode.add(this.legL);

    this.legR = this.createLeg(matKarateGi, matAccent);
    this.legR.position.set(0.25, 0, 0);
    this.hipNode.add(this.legR);

    this.group.add(this.hipNode);
  }

  private createArm(matGi: THREE.Material, matAccent: THREE.Material, matFlesh: THREE.Material): THREE.Group {
    const root = new THREE.Group();
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), matGi);
    root.add(shoulder);

    const bicep = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), matFlesh);
    bicep.position.y = -0.22;
    bicep.castShadow = true;
    root.add(bicep);

    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.28), matAccent);
    gauntlet.position.y = -0.58;
    gauntlet.castShadow = true;
    root.add(gauntlet);

    return root;
  }

  private createLeg(matGi: THREE.Material, matAccent: THREE.Material): THREE.Group {
    const root = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.28), matGi);
    thigh.position.y = -0.32;
    thigh.castShadow = true;
    root.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.58, 0.32), matAccent);
    shin.position.y = -0.8;
    shin.castShadow = true;
    root.add(shin);

    return root;
  }

  public resetPosition(x: number) {
    this.x = x;
    this.y = 0;
    this.z = 0;
    this.targetZ = 0;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.state = 'IDLE';
    this.stateTimer = 0;
    this.currentAttack = null;
    this.queuedAttack = null;
    this.hitbox.active = false;
    this.comboCount = 0;
    this.comboResetTimer = 0;
  }

  public update(dt: number, opponent: TekkenFighter, debugEnabled: boolean) {
    this.stateTimer += dt;

    // Rage Mode below 25% health
    const wasRage = this.isRageMode;
    this.isRageMode = this.health <= 25;
    if (!wasRage && this.isRageMode && this.onElectricParticle) {
      this.onElectricParticle(this.x, this.y + 1.2, this.z, 0xff1100);
    }

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboCount = 0;
      }
    }

    // Smooth 3D Sidestep Z-axis interpolation
    this.z += (this.targetZ - this.z) * 12 * dt;

    // Face opponent unless locked in animation
    if (this.state !== 'ATTACK' && this.state !== 'HIT_STUN' && this.state !== 'KNOCKED_DOWN') {
      this.facing = this.x < opponent.x ? 1 : -1;
    }

    // Gravity
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        if (this.state === 'JUMP') {
          this.state = 'IDLE';
          this.stateTimer = 0;
        }
      }
    }

    // State Processing
    switch (this.state) {
      case 'ATTACK':
        this.updateAttackState();
        break;
      case 'HIT_STUN':
        if (this.stateTimer >= this.stunDuration) {
          this.state = 'IDLE';
          this.stateTimer = 0;
        }
        break;
      case 'BLOCK':
        if (this.stateTimer >= this.blockDuration) {
          this.state = 'IDLE';
          this.stateTimer = 0;
        }
        break;
      case 'KNOCKED_DOWN':
        if (this.stateTimer >= 0.75) {
          this.state = 'IDLE';
          this.stateTimer = 0;
        }
        break;
    }

    // Apply movement physics
    this.x += this.vx * dt;
    this.x = Math.max(-11.5, Math.min(11.5, this.x));

    if (this.y === 0 && this.state !== 'WALK_FWD' && this.state !== 'WALK_BACK') {
      this.vx *= 0.82;
    }

    this.updateAnimationPose();
    this.updateBoundingVolumes(debugEnabled);
  }

  public handleInput(
    actions: {
      left: boolean;
      right: boolean;
      up: boolean;
      down: boolean;
      lp: boolean;
      rp: boolean;
      lk: boolean;
      rk: boolean;
    }
  ) {
    if (this.state === 'HIT_STUN' || this.state === 'KNOCKED_DOWN' || this.state === 'BLOCK') {
      return;
    }

    // Special EWGF (Electric Wind God Fist) motion: Down + RP or LP+RP macro
    const isEwgfMacro = (actions.lp && actions.rp) || (actions.lk && actions.rk);
    if (isEwgfMacro || (actions.down && actions.rp)) {
      this.triggerAttack('ewgf');
      return;
    }

    // 4-Limb single strikes
    if (actions.lp) { this.triggerAttack('lp'); return; }
    if (actions.rp) { this.triggerAttack('rp'); return; }
    if (actions.lk) { this.triggerAttack('lk'); return; }
    if (actions.rk) { this.triggerAttack('rk'); return; }

    // 3D Sidestepping (Z axis)
    if (actions.up) {
      this.state = 'SIDESTEP';
      this.targetZ = Math.max(-1.8, this.targetZ - 0.12);
      return;
    }
    if (actions.down) {
      this.state = 'SIDESTEP';
      this.targetZ = Math.min(1.8, this.targetZ + 0.12);
      return;
    }

    // Walking forward / backward
    const movingForward = (this.facing === 1 && actions.right) || (this.facing === -1 && actions.left);
    const movingBackward = (this.facing === 1 && actions.left) || (this.facing === -1 && actions.right);

    if (movingForward) {
      this.state = 'WALK_FWD';
      this.vx = this.facing * this.config.speed;
    } else if (movingBackward) {
      this.state = 'WALK_BACK';
      this.vx = -this.facing * (this.config.speed * 0.72);
    } else {
      if (this.state !== 'ATTACK') {
        this.state = 'IDLE';
        this.vx = 0;
        this.targetZ *= 0.95;
      }
    }
  }

  public triggerAttack(attackType: string) {
    if (this.state === 'ATTACK') {
      // Buffer attack for combo string
      this.queuedAttack = attackType;
      return;
    }

    this.state = 'ATTACK';
    this.stateTimer = 0;
    this.currentAttack = attackType;
    this.attackHitRegistered = false;
    const rageMult = this.isRageMode ? 1.35 : 1.0;

    switch (attackType) {
      case 'lp': // Left Punch (10f Jab)
        this.attackDuration = 0.24;
        this.hitboxActiveStart = 0.06;
        this.hitboxActiveEnd = 0.16;
        this.hitbox.damage = Math.floor(7 * rageMult);
        this.hitbox.hitstun = 0.24;
        this.hitbox.blockstun = 0.11;
        this.hitbox.knockback = 1.4;
        this.hitbox.isLauncher = false;
        this.hitbox.isHeavy = false;
        this.hitbox.size.set(0.65, 0.45, 0.9);
        this.hitbox.offset.set(0.65 * this.facing, 1.45, this.z);
        sound.playWhiff();
        break;

      case 'rp': // Right Punch (Straight cross)
        this.attackDuration = 0.30;
        this.hitboxActiveStart = 0.08;
        this.hitboxActiveEnd = 0.20;
        this.hitbox.damage = Math.floor(10 * rageMult);
        this.hitbox.hitstun = 0.28;
        this.hitbox.blockstun = 0.14;
        this.hitbox.knockback = 2.4;
        this.hitbox.isLauncher = false;
        this.hitbox.isHeavy = false;
        this.hitbox.size.set(0.75, 0.48, 0.9);
        this.hitbox.offset.set(0.75 * this.facing, 1.4, this.z);
        sound.playWhiff();
        break;

      case 'lk': // Left Kick (Mid roundhouse)
        this.attackDuration = 0.36;
        this.hitboxActiveStart = 0.10;
        this.hitboxActiveEnd = 0.24;
        this.hitbox.damage = Math.floor(13 * rageMult);
        this.hitbox.hitstun = 0.34;
        this.hitbox.blockstun = 0.16;
        this.hitbox.knockback = 3.6;
        this.hitbox.isLauncher = false;
        this.hitbox.isHeavy = true;
        this.hitbox.size.set(0.85, 0.55, 0.95);
        this.hitbox.offset.set(0.85 * this.facing, 1.1, this.z);
        sound.playWhiff();
        break;

      case 'rk': // Right Kick (High spin roundhouse launcher)
        this.attackDuration = 0.44;
        this.hitboxActiveStart = 0.13;
        this.hitboxActiveEnd = 0.28;
        this.hitbox.damage = Math.floor(16 * rageMult);
        this.hitbox.hitstun = 0.45;
        this.hitbox.blockstun = 0.18;
        this.hitbox.knockback = 4.2;
        this.hitbox.isLauncher = true;
        this.hitbox.isHeavy = true;
        this.hitbox.size.set(0.9, 0.6, 1.0);
        this.hitbox.offset.set(0.9 * this.facing, 1.35, this.z);
        sound.playWhiff();
        break;

      case 'ewgf': // Electric Wind God Fist
        this.attackDuration = 0.56;
        this.hitboxActiveStart = 0.12;
        this.hitboxActiveEnd = 0.36;
        this.hitbox.damage = Math.floor(25 * rageMult);
        this.hitbox.hitstun = 0.55;
        this.hitbox.blockstun = 0.24;
        this.hitbox.knockback = 5.2;
        this.hitbox.isLauncher = true;
        this.hitbox.isHeavy = true;
        this.hitbox.size.set(1.2, 0.9, 1.2);
        this.hitbox.offset.set(0.95 * this.facing, 1.45, this.z);
        this.vy = 7.2;
        this.vx = this.facing * 3.8;
        sound.playElectricShock();
        if (this.onElectricParticle) {
          this.onElectricParticle(this.x + 0.6 * this.facing, this.y + 1.4, this.z, 0xffe600);
        }
        break;
    }
  }

  private updateAttackState() {
    if (this.stateTimer >= this.hitboxActiveStart && this.stateTimer <= this.hitboxActiveEnd) {
      this.hitbox.active = true;
    } else {
      this.hitbox.active = false;
    }

    if (this.stateTimer >= this.attackDuration) {
      if (this.queuedAttack) {
        const next = this.queuedAttack;
        this.queuedAttack = null;
        this.triggerAttack(next);
      } else {
        this.state = 'IDLE';
        this.currentAttack = null;
        this.hitbox.active = false;
        this.stateTimer = 0;
      }
    }
  }

  public takeHit(attackerHitbox: HitboxData, isBlocked: boolean = false) {
    if (isBlocked) {
      this.state = 'BLOCK';
      this.stateTimer = 0;
      this.blockDuration = attackerHitbox.blockstun;
      this.health -= Math.floor(attackerHitbox.damage * 0.15);
      this.vx = (this.facing === 1 ? -1 : 1) * (attackerHitbox.knockback * 0.35);
      sound.playBlock();
      if (this.onBlockParticle) {
        this.onBlockParticle(this.x + 0.3 * this.facing, this.y + 1.3, this.z);
      }
    } else {
      this.state = attackerHitbox.isLauncher ? 'KNOCKED_DOWN' : 'HIT_STUN';
      this.stateTimer = 0;
      this.stunDuration = attackerHitbox.hitstun;
      this.health -= attackerHitbox.damage;
      this.vx = (this.facing === 1 ? -1 : 1) * attackerHitbox.knockback;

      if (attackerHitbox.isLauncher) {
        this.vy = 6.4; // Juggle launch
      }

      if (attackerHitbox.damage >= 20) {
        sound.playElectricShock();
        if (this.onElectricParticle) {
          this.onElectricParticle(this.x, this.y + 1.3, this.z, 0xff2222);
        }
      } else {
        sound.playPunch(attackerHitbox.isHeavy);
        if (this.onHitParticle) {
          this.onHitParticle(this.x, this.y + 1.3, this.z, attackerHitbox.isHeavy);
        }
      }
    }

    if (this.health <= 0) {
      this.health = 0;
    }
  }

  private updateBoundingVolumes(debugEnabled: boolean) {
    this.hurtbox.offset.set(this.x, this.y + 1.1, this.z);
    this.hurtboxMesh.position.copy(this.hurtbox.offset);
    this.hurtboxMesh.scale.copy(this.hurtbox.size);
    this.hurtboxMesh.visible = debugEnabled;

    if (this.hitbox.active) {
      this.hitbox.offset.set(this.x + 0.85 * this.facing, this.y + 1.3, this.z);
      this.hitboxMesh.position.copy(this.hitbox.offset);
      this.hitboxMesh.scale.copy(this.hitbox.size);
      this.hitboxMesh.visible = debugEnabled;
    } else {
      this.hitboxMesh.visible = false;
    }
  }

  private updateAnimationPose() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.facing === 1 ? 0 : Math.PI;

    const t = this.stateTimer * 14;
    this.armR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.torsoMesh.rotation.set(0, 0, 0);
    this.group.rotation.z = 0;
    this.hipNode.position.y = 1.05;

    switch (this.state) {
      case 'IDLE':
        const bounce = Math.sin(t * 0.4) * 0.04;
        this.hipNode.position.y = 1.05 + bounce;
        this.armR.rotation.x = 0.45;
        this.armL.rotation.x = -0.45;
        this.armR.rotation.z = 0.25;
        this.armL.rotation.z = -0.25;
        break;

      case 'WALK_FWD':
      case 'WALK_BACK':
        const cycle = Math.sin(t * 0.85);
        this.legR.rotation.x = cycle * 0.7;
        this.legL.rotation.x = -cycle * 0.7;
        this.armR.rotation.x = -cycle * 0.55;
        this.armL.rotation.x = cycle * 0.55;
        break;

      case 'SIDESTEP':
        this.hipNode.position.y = 0.98;
        this.torsoMesh.rotation.z = 0.15 * this.facing;
        break;

      case 'ATTACK':
        if (this.currentAttack === 'lp') {
          this.armL.rotation.x = -Math.PI / 2;
          this.armL.rotation.z = -0.2;
          this.torsoMesh.rotation.y = 0.25;
        } else if (this.currentAttack === 'rp') {
          this.armR.rotation.x = -Math.PI / 2;
          this.armR.rotation.z = 0.2;
          this.torsoMesh.rotation.y = -0.3;
        } else if (this.currentAttack === 'lk') {
          this.legL.rotation.x = -Math.PI / 2.3;
          this.torsoMesh.rotation.x = -0.2;
        } else if (this.currentAttack === 'rk') {
          this.legR.rotation.x = -Math.PI / 2.1;
          this.torsoMesh.rotation.y = -0.4;
        } else if (this.currentAttack === 'ewgf') {
          this.armR.rotation.x = -Math.PI * 0.9;
          this.legL.rotation.x = 0.6;
          this.torsoMesh.rotation.y = -0.5;
        }
        break;

      case 'BLOCK':
        this.armR.rotation.set(-1.1, 0.4, 0.4);
        this.armL.rotation.set(-1.1, -0.4, -0.4);
        break;

      case 'HIT_STUN':
        this.torsoMesh.rotation.x = -0.5;
        this.armR.rotation.x = 0.9;
        this.armL.rotation.x = 0.9;
        break;

      case 'KNOCKED_DOWN':
        this.group.rotation.z = this.facing === 1 ? -Math.PI / 2.1 : Math.PI / 2.1;
        this.hipNode.position.y = 0.25;
        break;
    }
  }

  public dispose(scene: THREE.Scene, debugGroup: THREE.Group) {
    scene.remove(this.group);
    debugGroup.remove(this.hurtboxMesh);
    debugGroup.remove(this.hitboxMesh);
  }
}
