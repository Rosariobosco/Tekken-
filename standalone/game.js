/* ==========================================================================
   TEKKEN CLASH - 3D Browser Fighting Game
   Stand-alone JavaScript Engine (Runs in modern browsers with no build step)
   ==========================================================================
   
   HOW THE FIGHTER STATE MACHINE WORKS:
   ------------------------------------
   Each fighter is driven by a deterministic finite state machine (FSM):
   - IDLE: Neutral stance, slight rhythmic breathing bobbing.
   - WALK_FWD / WALK_BACK: Positional adjustment on the fighting plane.
   - SIDESTEP: 3D Z-axis movement (-Z for background, +Z for foreground) dodging linear attacks.
   - JUMP: Parabolic gravity trajectory with airborne attack eligibility.
   - ATTACK: Limb active window with startup frames, active hitbox window, and recovery frames.
     Supports input buffering for multi-hit strings (e.g. LP -> RP -> RK Demon String).
   - BLOCK: Defensive guard reducing incoming strike damage by 85% and preventing launch.
   - HIT_STUN: Interruption window following an unblocked strike.
   - KNOCKED_DOWN: Sky-high juggle trajectory triggered by launcher moves (EWGF or High RK).
   
   HOW 3D HIT DETECTION WORKS:
   ---------------------------
   Combat collisions occur in 3D space using Axis-Aligned Bounding Boxes (AABB).
   - Each fighter maintains a Hurtbox (green wireframe volume spanning their body).
   - Each attack defines a temporal Hitbox (red wireframe volume positioned at the striking limb).
   - An impact registers if and only if both volumes overlap along all 3 axes:
     (minA.x <= maxB.x && maxA.x >= minB.x) &&
     (minA.y <= maxB.y && maxA.y >= minB.y) &&
     (minA.z <= maxB.z && maxA.z >= minB.z)
   This allows players to sidestep along the Z axis to cause straight punches to whiff!
   ========================================================================== */

// ==========================================================================
// SECTION 1: SETUP (Renderer, Scene, Camera, Lights)
// ==========================================================================

const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0c16, 0.016);

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.5, 120);
camera.position.set(0, 3.2, 11);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting Rig
const ambientLight = new THREE.AmbientLight(0x556080, 1.4);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffeedd, 2.4);
keyLight.position.set(6, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff2222, 1.8);
rimLight.position.set(-8, 9, -7);
scene.add(rimLight);

const stageGlowLight = new THREE.PointLight(0xffaa22, 2.2, 24);
stageGlowLight.position.set(0, 1.2, 0);
scene.add(stageGlowLight);

// 3D Arenas
const stageGroup = new THREE.Group();
scene.add(stageGroup);

function buildArena(stageName) {
  while (stageGroup.children.length > 0) {
    stageGroup.remove(stageGroup.children[0]);
  }

  if (stageName === 'dojo') {
    scene.fog.color.setHex(0x0a0c16);
    scene.background = new THREE.Color(0x060810);
    stageGlowLight.color.setHex(0xffaa22);

    // Tatami Wood Floor Platform
    const floorGeo = new THREE.BoxGeometry(28, 1.2, 12);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 0.45, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    floor.receiveShadow = true;
    stageGroup.add(floor);

    // Inner Tatami Ring
    const tatami = new THREE.Mesh(new THREE.BoxGeometry(25, 0.04, 9), new THREE.MeshStandardMaterial({ color: 0x48321d, roughness: 0.7 }));
    tatami.position.y = 0.01;
    stageGroup.add(tatami);

    // Crimson Shrine Pillars & Lanterns
    for (let i = -4; i <= 4; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 10, 16), new THREE.MeshStandardMaterial({ color: 0x771111, roughness: 0.5 }));
      col.position.set(i * 3.4, 4.4, -5.2);
      stageGroup.add(col);

      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8811 }));
      lantern.position.set(i * 3.4, 3.8, -4.8);
      stageGroup.add(lantern);
    }

    const bg = new THREE.Mesh(new THREE.PlaneGeometry(42, 18), new THREE.MeshStandardMaterial({ color: 0x090c1a, roughness: 0.9 }));
    bg.position.set(0, 8, -7.5);
    stageGroup.add(bg);
  } else {
    // Volcano Caldera
    scene.fog.color.setHex(0x180404);
    scene.background = new THREE.Color(0x0c0202);
    stageGlowLight.color.setHex(0xff3300);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.85 }));
    floor.position.y = -0.6;
    stageGroup.add(floor);

    // Magma Seam
    const seam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
    seam.position.set(0, 0.02, 3.0);
    stageGroup.add(seam);
    const seam2 = seam.clone();
    seam2.position.z = -3.0;
    stageGroup.add(seam2);

    for (let i = -3; i <= 3; i++) {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0f0b0c, roughness: 0.95 }));
      spire.position.set(i * 4.2, 3.5, -5.5);
      stageGroup.add(spire);
    }

    const bg = new THREE.Mesh(new THREE.PlaneGeometry(42, 18), new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.9 }));
    bg.position.set(0, 8, -7.5);
    stageGroup.add(bg);
  }
}
buildArena('dojo');

// Debug 3D Bounding Wireframes
let debugHitboxes = false;
const debugGroup = new THREE.Group();
scene.add(debugGroup);

function createBoxHelperMesh(size, colorHex) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = debugHitboxes;
  debugGroup.add(mesh);
  return mesh;
}

// ==========================================================================
// SECTION 2: INPUT HANDLING (Local Keyboard & WebRTC Remote Channel)
// ==========================================================================

const keysDown = {};
const justPressed = {};

window.addEventListener('keydown', (e) => {
  if (!keysDown[e.code]) justPressed[e.code] = true;
  keysDown[e.code] = true;
  audioSys.init();

  if (e.code === 'KeyB') toggleDebugHitboxes();
  if (e.code === 'Escape' && gameState === 'FIGHT') togglePauseMatch();
});

window.addEventListener('keyup', (e) => {
  keysDown[e.code] = false;
  justPressed[e.code] = false;
});

// Remote Multiplayer Peer Connection State
let mpRole = null; // 'host' or 'guest'
let peerConn = null;
let dataChan = null;
let remoteP2Inputs = { left: false, right: false, up: false, down: false, lp: false, rp: false, lk: false, rk: false };

// ==========================================================================
// SECTION 3: FIGHTER STATE MACHINE (4-Limb Attacks, Juggle, Rage Mode)
// ==========================================================================

const FIGHTERS = {
  jin: {
    name: 'Jin K.',
    colorHex: 0xdc143c,
    accentHex: 0xffaa00,
    speed: 5.0,
    specialName: 'Electric Wind God Fist (EWGF)',
    style: 'Kazama Karate'
  },
  kazuya: {
    name: 'Kazuya M.',
    colorHex: 0x114499,
    accentHex: 0x00e1ff,
    speed: 4.6,
    specialName: 'Dragon Uppercut Launcher',
    style: 'Mishima Karate'
  }
};

class Fighter3D {
  constructor(playerId, type, startX) {
    this.playerId = playerId;
    this.config = FIGHTERS[type] || FIGHTERS.jin;
    this.x = startX;
    this.y = 0;
    this.z = 0;
    this.targetZ = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = playerId === 1 ? 1 : -1;

    this.maxHealth = 100;
    this.health = 100;
    this.roundsWon = 0;
    this.comboCount = 0;
    this.comboResetTimer = 0;
    this.isRageMode = false;

    this.state = 'IDLE';
    this.stateTimer = 0;
    this.currentAttack = null;
    this.queuedAttack = null;
    this.attackHitRegistered = false;

    this.group = new THREE.Group();
    this.buildMesh();
    scene.add(this.group);

    this.hurtbox = { offset: new THREE.Vector3(0, 1.1, 0), size: new THREE.Vector3(0.85, 2.1, 1.1) };
    this.hitbox = {
      active: false,
      offset: new THREE.Vector3(0.5, 1.4, 0),
      size: new THREE.Vector3(0.65, 0.55, 0.9),
      damage: 10,
      hitstun: 0.28,
      blockstun: 0.14,
      knockback: 2.5,
      isLauncher: false,
      isHeavy: false
    };

    this.hurtboxMesh = createBoxHelperMesh(this.hurtbox.size, 0x00ff88);
    this.hitboxMesh = createBoxHelperMesh(this.hitbox.size, 0xff1133);
  }

  buildMesh() {
    const matMain = new THREE.MeshStandardMaterial({ color: this.config.colorHex, roughness: 0.35 });
    const matAccent = new THREE.MeshStandardMaterial({ color: this.config.accentHex, roughness: 0.2, metalness: 0.7 });
    const matGi = new THREE.MeshStandardMaterial({ color: 0x161824, roughness: 0.8 });
    const matFlesh = new THREE.MeshStandardMaterial({ color: 0xd9a47f, roughness: 0.6 });

    this.hipNode = new THREE.Group();
    this.hipNode.position.y = 1.05;

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.44), matAccent);
    this.hipNode.add(belt);

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.82, 0.46), matGi);
    this.torso.position.y = 0.48;
    this.torso.castShadow = true;
    this.hipNode.add(this.torso);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.02, 0);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), matFlesh);
    this.head.add(face);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.44), matAccent);
    hair.position.set(0, 0.2, -0.02);
    this.head.add(hair);
    this.hipNode.add(this.head);

    this.armL = this.createArm(matGi, matAccent, matFlesh);
    this.armL.position.set(-0.5, 0.8, 0);
    this.hipNode.add(this.armL);

    this.armR = this.createArm(matGi, matAccent, matFlesh);
    this.armR.position.set(0.5, 0.8, 0);
    this.hipNode.add(this.armR);

    this.legL = this.createLeg(matGi, matAccent);
    this.legL.position.set(-0.25, 0, 0);
    this.hipNode.add(this.legL);

    this.legR = this.createLeg(matGi, matAccent);
    this.legR.position.set(0.25, 0, 0);
    this.hipNode.add(this.legR);

    this.group.add(this.hipNode);
  }

  createArm(matGi, matAccent, matFlesh) {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), matGi));
    const bicep = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), matFlesh);
    bicep.position.y = -0.22;
    root.add(bicep);
    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.28), matAccent);
    gauntlet.position.y = -0.58;
    root.add(gauntlet);
    return root;
  }

  createLeg(matGi, matAccent) {
    const root = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.28), matGi);
    thigh.position.y = -0.32;
    root.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.58, 0.32), matAccent);
    shin.position.y = -0.8;
    root.add(shin);
    return root;
  }

  resetPosition(x) {
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

  update(dt, opponent) {
    this.stateTimer += dt;
    this.isRageMode = this.health <= 25;

    // Smooth 3D Z Sidestep interpolation
    this.z += (this.targetZ - this.z) * 12 * dt;

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
        if (this.state === 'JUMP') this.state = 'IDLE';
      }
    }

    if (this.state === 'ATTACK') {
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
        }
      }
    } else if (this.state === 'HIT_STUN' && this.stateTimer >= this.stunDuration) {
      this.state = 'IDLE';
    } else if (this.state === 'BLOCK' && this.stateTimer >= this.blockDuration) {
      this.state = 'IDLE';
    } else if (this.state === 'KNOCKED_DOWN' && this.stateTimer >= 0.75) {
      this.state = 'IDLE';
    }

    this.x += this.vx * dt;
    this.x = Math.max(-11.5, Math.min(11.5, this.x));
    if (this.y === 0 && this.state !== 'WALK_FWD' && this.state !== 'WALK_BACK') {
      this.vx *= 0.82;
    }

    this.updatePose();
    this.updateVolumes();
  }

  handleActions(actions) {
    if (this.state === 'HIT_STUN' || this.state === 'KNOCKED_DOWN' || this.state === 'BLOCK') return;

    // Special EWGF
    if ((actions.lp && actions.rp) || (actions.down && actions.rp)) {
      this.triggerAttack('ewgf');
      return;
    }
    if (actions.lp) { this.triggerAttack('lp'); return; }
    if (actions.rp) { this.triggerAttack('rp'); return; }
    if (actions.lk) { this.triggerAttack('lk'); return; }
    if (actions.rk) { this.triggerAttack('rk'); return; }

    // 3D Sidestepping
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

  triggerAttack(type) {
    if (this.state === 'ATTACK') {
      this.queuedAttack = type;
      return;
    }
    this.state = 'ATTACK';
    this.stateTimer = 0;
    this.currentAttack = type;
    this.attackHitRegistered = false;
    const rageMult = this.isRageMode ? 1.35 : 1.0;

    switch (type) {
      case 'lp':
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
        audioSys.playWhiff();
        break;
      case 'rp':
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
        audioSys.playWhiff();
        break;
      case 'lk':
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
        audioSys.playWhiff();
        break;
      case 'rk':
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
        audioSys.playWhiff();
        break;
      case 'ewgf':
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
        audioSys.playElectric();
        spawnElectricFlash(this.x + 0.6 * this.facing, this.y + 1.4, this.z, 0xffe600);
        break;
    }
  }

  takeHit(attackerHitbox, isBlocked) {
    if (isBlocked) {
      this.state = 'BLOCK';
      this.stateTimer = 0;
      this.blockDuration = attackerHitbox.blockstun;
      this.health -= Math.floor(attackerHitbox.damage * 0.15);
      this.vx = (this.facing === 1 ? -1 : 1) * (attackerHitbox.knockback * 0.35);
      audioSys.playBlock();
      spawnBlockSparks(this.x + 0.3 * this.facing, this.y + 1.3, this.z);
    } else {
      this.state = attackerHitbox.isLauncher ? 'KNOCKED_DOWN' : 'HIT_STUN';
      this.stateTimer = 0;
      this.stunDuration = attackerHitbox.hitstun;
      this.health -= attackerHitbox.damage;
      this.vx = (this.facing === 1 ? -1 : 1) * attackerHitbox.knockback;
      if (attackerHitbox.isLauncher) this.vy = 6.4;

      if (attackerHitbox.damage >= 20) {
        audioSys.playElectric();
        spawnElectricFlash(this.x, this.y + 1.3, this.z, 0xff2222);
      } else {
        audioSys.playPunch(attackerHitbox.isHeavy);
        spawnHitSparks(this.x, this.y + 1.3, this.z, attackerHitbox.isHeavy);
      }
    }
    if (this.health < 0) this.health = 0;
  }

  updateVolumes() {
    this.hurtbox.offset.set(this.x, this.y + 1.1, this.z);
    this.hurtboxMesh.position.copy(this.hurtbox.offset);
    this.hurtboxMesh.scale.copy(this.hurtbox.size);
    this.hurtboxMesh.visible = debugHitboxes;

    if (this.hitbox.active) {
      this.hitbox.offset.set(this.x + 0.85 * this.facing, this.y + 1.3, this.z);
      this.hitboxMesh.position.copy(this.hitbox.offset);
      this.hitboxMesh.scale.copy(this.hitbox.size);
      this.hitboxMesh.visible = debugHitboxes;
    } else {
      this.hitboxMesh.visible = false;
    }
  }

  updatePose() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.facing === 1 ? 0 : Math.PI;
    const t = this.stateTimer * 14;

    this.armR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.group.rotation.z = 0;
    this.hipNode.position.y = 1.05;

    switch (this.state) {
      case 'IDLE':
        this.hipNode.position.y = 1.05 + Math.sin(t * 0.4) * 0.04;
        this.armR.rotation.set(0.45, 0, 0.25);
        this.armL.rotation.set(-0.45, 0, -0.25);
        break;
      case 'WALK_FWD':
      case 'WALK_BACK':
        const cycle = Math.sin(t * 0.85);
        this.legR.rotation.x = cycle * 0.7;
        this.legL.rotation.x = -cycle * 0.7;
        this.armR.rotation.x = -cycle * 0.55;
        this.armL.rotation.x = cycle * 0.55;
        break;
      case 'ATTACK':
        if (this.currentAttack === 'lp') this.armL.rotation.set(-Math.PI / 2, 0, -0.2);
        else if (this.currentAttack === 'rp') this.armR.rotation.set(-Math.PI / 2, 0, 0.2);
        else if (this.currentAttack === 'lk') this.legL.rotation.x = -Math.PI / 2.3;
        else if (this.currentAttack === 'rk') this.legR.rotation.x = -Math.PI / 2.1;
        else if (this.currentAttack === 'ewgf') {
          this.armR.rotation.x = -Math.PI * 0.9;
          this.legL.rotation.x = 0.6;
        }
        break;
      case 'BLOCK':
        this.armR.rotation.set(-1.1, 0.4, 0.4);
        this.armL.rotation.set(-1.1, -0.4, -0.4);
        break;
      case 'HIT_STUN':
        this.torso.rotation.x = -0.5;
        this.armR.rotation.x = 0.9;
        this.armL.rotation.x = 0.9;
        break;
      case 'KNOCKED_DOWN':
        this.group.rotation.z = this.facing === 1 ? -Math.PI / 2.1 : Math.PI / 2.1;
        this.hipNode.position.y = 0.25;
        break;
    }
  }
}

// ==========================================================================
// SECTION 4: COLLISION DETECTION & PHYSICS
// ==========================================================================

function check3DCollision(boxA, boxB) {
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
    aMinX <= bMaxX && aMaxX >= bMinX &&
    aMinY <= bMaxY && aMaxY >= bMinY &&
    aMinZ <= bMaxZ && aMaxZ >= bMinZ
  );
}

function processCollisions(p1, p2, p1Actions, p2Actions) {
  // P1 Hitbox vs P2 Hurtbox
  if (p1.hitbox.active && !p1.attackHitRegistered) {
    if (check3DCollision(p1.hitbox, p2.hurtbox)) {
      p1.attackHitRegistered = true;
      const isGuarding = (p2.facing === 1 && p2Actions.left) || (p2.facing === -1 && p2Actions.right);
      p2.takeHit(p1.hitbox, isGuarding);
      if (!isGuarding) {
        p1.comboCount++;
        showComboUI(1, p1.comboCount);
      }
    }
  }

  // P2 Hitbox vs P1 Hurtbox
  if (p2.hitbox.active && !p2.attackHitRegistered) {
    if (check3DCollision(p2.hitbox, p1.hurtbox)) {
      p2.attackHitRegistered = true;
      const isGuarding = (p1.facing === 1 && p1Actions.left) || (p1.facing === -1 && p1Actions.right);
      p1.takeHit(p2.hitbox, isGuarding);
      if (!isGuarding) {
        p2.comboCount++;
        showComboUI(2, p2.comboCount);
      }
    }
  }

  // Separation
  const distX = Math.abs(p1.x - p2.x);
  const distZ = Math.abs(p1.z - p2.z);
  if (distX < 0.9 && distZ < 0.8) {
    const overlap = (0.9 - distX) / 2;
    if (p1.x < p2.x) {
      p1.x -= overlap;
      p2.x += overlap;
    } else {
      p1.x += overlap;
      p2.x -= overlap;
    }
  }
}

// Particle FX
const particles = [];
function spawnHitSparks(x, y, z, heavy) {
  const count = heavy ? 20 : 12;
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(heavy ? 0.09 : 0.06, 6, 6), new THREE.MeshBasicMaterial({ color: heavy ? 0xffcc00 : 0xff2244 }));
    p.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2;
    const s = (Math.random() * 7 + 4) * (heavy ? 1.3 : 1.0);
    const vel = new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 5);
    scene.add(p);
    particles.push({ mesh: p, vel, life: 0.28 });
  }
}

function spawnElectricFlash(x, y, z, col) {
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), new THREE.MeshBasicMaterial({ color: col }));
    p.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3);
    scene.add(p);
    particles.push({ mesh: p, vel, life: 0.35 });
  }
}

function spawnBlockSparks(x, y, z) {
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    p.position.set(x, y, z);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 2);
    scene.add(p);
    particles.push({ mesh: p, vel, life: 0.18 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

// ==========================================================================
// SECTION 5: GAME LOOP & STATE MANAGEMENT
// ==========================================================================

let p1 = null;
let p2 = null;
let gameState = 'TITLE'; // TITLE, ONLINE_LOBBY, SELECT, VS_SPLASH, FIGHT, RESULTS
let matchMode = 'local'; // 'local' or 'online'
let roundLimit = 60;
let roundTimer = 60;
let roundNum = 1;
let roundActive = false;
let p1Selected = 'jin';
let p2Selected = 'kazuya';
let activeStage = 'dojo';

function startRoundSeq() {
  roundActive = false;
  p1.resetPosition(-3.6);
  p2.resetPosition(3.6);
  roundTimer = roundLimit;
  document.getElementById('p1-bar-wrap').classList.remove('rage-active');
  document.getElementById('p2-bar-wrap').classList.remove('rage-active');
  updateHUD();

  showBanner(`ROUND ${roundNum}`, 1100, () => {
    audioSys.playGong();
    showBanner('FIGHT!', 750, () => {
      roundActive = true;
    });
  });
}

function checkRoundEnd() {
  if (!roundActive) return;
  const p1Dead = p1.health <= 0;
  const p2Dead = p2.health <= 0;
  const timeout = roundTimer <= 0;

  if (p1Dead || p2Dead || timeout) {
    roundActive = false;
    if (p1Dead && p2Dead) {
      showBanner('DOUBLE K.O. - DRAW', 1800, () => nextRound(0));
    } else if (p2Dead || (timeout && p1.health > p2.health)) {
      p1.roundsWon++;
      document.getElementById(`p1-pip-${p1.roundsWon}`).classList.add('won');
      showBanner(`K.O. - ${p1.config.name} WINS!`, 1800, () => nextRound(1));
    } else {
      p2.roundsWon++;
      document.getElementById(`p2-pip-${p2.roundsWon}`).classList.add('won');
      showBanner(`K.O. - ${p2.config.name} WINS!`, 1800, () => nextRound(2));
    }
  }
}

function nextRound(winner) {
  if (p1.roundsWon >= 2 || p2.roundsWon >= 2) {
    setTimeout(() => {
      showResults(p1.roundsWon >= 2 ? 1 : 2);
    }, 600);
  } else {
    roundNum++;
    setTimeout(startRoundSeq, 1000);
  }
}

// ==========================================================================
// SECTION 6: RENDERING & CAMERA TRACKING
// ==========================================================================

function updateCamera() {
  if (!p1 || !p2) return;
  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;
  const dist = Math.abs(p1.x - p2.x);

  const targetX = midX * 0.85;
  const targetZ = Math.max(9.0, 7.0 + dist * 0.75);
  const targetY = 2.6 + Math.max(p1.y, p2.y) * 0.25;

  camera.position.x += (targetX - camera.position.x) * 0.08;
  camera.position.z += (targetZ - camera.position.z) * 0.08;
  camera.position.y += (targetY - camera.position.y) * 0.08;
  camera.lookAt(midX, 1.4, midZ * 0.5);
}

let lastStamp = performance.now();
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((now - lastStamp) / 1000, 0.1);
  lastStamp = now;

  if (gameState === 'FIGHT') {
    if (roundActive) {
      roundTimer -= dt;
      if (roundTimer <= 0) roundTimer = 0;
    }

    // P1 Local actions
    const p1Actions = {
      left: !!keysDown['KeyA'],
      right: !!keysDown['KeyD'],
      up: !!keysDown['KeyW'],
      down: !!keysDown['KeyS'],
      lp: !!justPressed['KeyU'],
      rp: !!justPressed['KeyI'],
      lk: !!justPressed['KeyJ'],
      rk: !!justPressed['KeyK']
    };
    justPressed['KeyU'] = false;
    justPressed['KeyI'] = false;
    justPressed['KeyJ'] = false;
    justPressed['KeyK'] = false;

    p1.handleActions(p1Actions);

    // P2 actions (either local arrow keys or WebRTC inputs)
    let p2Actions;
    if (matchMode === 'online') {
      if (mpRole === 'host') {
        p2Actions = remoteP2Inputs;
      } else {
        // Guest sends actions to host
        p2Actions = {
          left: !!keysDown['KeyA'] || !!keysDown['ArrowLeft'],
          right: !!keysDown['KeyD'] || !!keysDown['ArrowRight'],
          up: !!keysDown['KeyW'] || !!keysDown['ArrowUp'],
          down: !!keysDown['KeyS'] || !!keysDown['ArrowDown'],
          lp: !!justPressed['KeyU'] || !!justPressed['Numpad7'] || !!justPressed['KeyY'],
          rp: !!justPressed['KeyI'] || !!justPressed['Numpad8'],
          lk: !!justPressed['KeyJ'] || !!justPressed['Numpad4'] || !!justPressed['KeyH'],
          rk: !!justPressed['KeyK'] || !!justPressed['Numpad5']
        };
        if (dataChan && dataChan.readyState === 'open') {
          dataChan.send(JSON.stringify({ type: 'input', data: p2Actions }));
        }
      }
    } else {
      p2Actions = {
        left: !!keysDown['ArrowLeft'],
        right: !!keysDown['ArrowRight'],
        up: !!keysDown['ArrowUp'],
        down: !!keysDown['ArrowDown'],
        lp: !!justPressed['Numpad7'] || !!justPressed['KeyY'],
        rp: !!justPressed['Numpad8'],
        lk: !!justPressed['Numpad4'] || !!justPressed['KeyH'],
        rk: !!justPressed['Numpad5']
      };
      justPressed['Numpad7'] = false;
      justPressed['KeyY'] = false;
      justPressed['Numpad8'] = false;
      justPressed['Numpad4'] = false;
      justPressed['KeyH'] = false;
      justPressed['Numpad5'] = false;
    }

    p2.handleActions(p2Actions);

    p1.update(dt, p2);
    p2.update(dt, p1);

    processCollisions(p1, p2, p1Actions, p2Actions);
    checkRoundEnd();
    updateHUD();
    updateCamera();
  }

  updateParticles(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(gameLoop);

// ==========================================================================
// SECTION 7: UI SCREENS & MATCH FLOW
// ==========================================================================

function hideAllOverlays() {
  document.querySelectorAll('.screen-overlay').forEach(el => el.classList.add('hidden'));
}

function updateHUD() {
  if (!p1 || !p2) return;
  const p1Pct = (p1.health / p1.maxHealth) * 100;
  const p2Pct = (p2.health / p2.maxHealth) * 100;
  document.getElementById('p1-health-bar').style.width = p1Pct + '%';
  document.getElementById('p2-health-bar').style.width = p2Pct + '%';
  setTimeout(() => {
    document.getElementById('p1-health-red').style.width = p1Pct + '%';
    document.getElementById('p2-health-red').style.width = p2Pct + '%';
  }, 160);
  document.getElementById('timer-val').innerText = Math.ceil(roundTimer);

  if (p1.health <= 25) document.getElementById('p1-bar-wrap').classList.add('rage-active');
  if (p2.health <= 25) document.getElementById('p2-bar-wrap').classList.add('rage-active');
}

function showBanner(text, dur = 1200, cb = null) {
  const b = document.getElementById('fight-announcement');
  b.innerText = text;
  b.classList.add('show');
  setTimeout(() => {
    b.classList.remove('show');
    if (cb) cb();
  }, dur);
}

function showComboUI(pNum, count) {
  const el = document.getElementById(pNum === 1 ? 'p1-combo-box' : 'p2-combo-box');
  const num = document.getElementById(pNum === 1 ? 'p1-combo-num' : 'p2-combo-num');
  num.innerText = count;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1200);
}

function toggleDebugHitboxes() {
  debugHitboxes = !debugHitboxes;
  if (p1) p1.updateVolumes();
  if (p2) p2.updateVolumes();
  document.getElementById('btn-settings-hitboxes').innerText = `Hitboxes: ${debugHitboxes ? 'ON' : 'OFF'}`;
}

function togglePauseMatch() {
  const pauseEl = document.getElementById('pause-screen');
  if (gameState === 'FIGHT') {
    gameState = 'PAUSE';
    pauseEl.classList.remove('hidden');
  } else if (gameState === 'PAUSE') {
    gameState = 'FIGHT';
    pauseEl.classList.add('hidden');
  }
}

function startVersusSequence() {
  hideAllOverlays();
  const vs = document.getElementById('vs-splash-screen');
  document.getElementById('vs-p1-name').innerText = FIGHTERS[p1Selected].name.toUpperCase();
  document.getElementById('vs-p2-name').innerText = FIGHTERS[p2Selected].name.toUpperCase();
  vs.classList.remove('hidden');
  audioSys.playGong();

  setTimeout(() => {
    vs.classList.add('hidden');
    initMatchCombat();
  }, 2200);
}

function initMatchCombat() {
  if (p1) scene.remove(p1.group);
  if (p2) scene.remove(p2.group);

  buildArena(activeStage);
  p1 = new Fighter3D(1, p1Selected, -3.6);
  p2 = new Fighter3D(2, p2Selected, 3.6);

  document.getElementById('p1-name').innerText = p1.config.name;
  document.getElementById('p2-name').innerText = p2.config.name;
  document.getElementById('p1-pip-1').classList.remove('won');
  document.getElementById('p1-pip-2').classList.remove('won');
  document.getElementById('p2-pip-1').classList.remove('won');
  document.getElementById('p2-pip-2').classList.remove('won');

  roundNum = 1;
  gameState = 'FIGHT';
  document.getElementById('fight-hud').classList.remove('hidden');
  hideAllOverlays();
  startRoundSeq();
}

function showResults(winnerId) {
  gameState = 'RESULTS';
  document.getElementById('fight-hud').classList.add('hidden');
  document.getElementById('results-screen').classList.remove('hidden');
  const name = winnerId === 1 ? p1.config.name : p2.config.name;
  document.getElementById('results-winner').innerText = `${name.toUpperCase()} WINS!`;
  document.getElementById('results-subtext').innerText = `CHAMPIONSHIP VICTORY (${p1.roundsWon} - ${p2.roundsWon})`;

  const key = winnerId === 1 ? 'tekken_p1_wins' : 'tekken_p2_wins';
  const wins = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, wins);
  loadRecords();
}

function loadRecords() {
  document.getElementById('rec-p1').innerText = localStorage.getItem('tekken_p1_wins') || '0';
  document.getElementById('rec-p2').innerText = localStorage.getItem('tekken_p2_wins') || '0';
}
loadRecords();

// UI Event Listeners
document.getElementById('btn-start-local').addEventListener('click', () => {
  matchMode = 'local';
  hideAllOverlays();
  document.getElementById('select-screen').classList.remove('hidden');
  gameState = 'SELECT';
});

document.getElementById('btn-start-online').addEventListener('click', () => {
  matchMode = 'online';
  hideAllOverlays();
  document.getElementById('online-lobby-screen').classList.remove('hidden');
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('title-screen').classList.remove('hidden');
});

document.getElementById('btn-open-settings').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('settings-screen').classList.remove('hidden');
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('title-screen').classList.remove('hidden');
});

document.getElementById('card-jin').addEventListener('click', () => {
  p1Selected = 'jin';
  document.getElementById('card-jin').className = 'char-card selected-p1';
  document.getElementById('card-kazuya').className = 'char-card selected-p2';
  audioSys.playWhiff();
});
document.getElementById('card-kazuya').addEventListener('click', () => {
  p1Selected = 'kazuya';
  document.getElementById('card-kazuya').className = 'char-card selected-p1';
  document.getElementById('card-jin').className = 'char-card selected-p2';
  audioSys.playWhiff();
});

document.getElementById('stage-dojo').addEventListener('click', () => {
  activeStage = 'dojo';
  document.getElementById('stage-dojo').className = 'stage-card active-stage';
  document.getElementById('stage-caldera').className = 'stage-card';
  buildArena('dojo');
});
document.getElementById('stage-caldera').addEventListener('click', () => {
  activeStage = 'caldera';
  document.getElementById('stage-caldera').className = 'stage-card active-stage';
  document.getElementById('stage-dojo').className = 'stage-card';
  buildArena('caldera');
});

document.getElementById('btn-proceed-battle').addEventListener('click', startVersusSequence);
document.getElementById('btn-select-back').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('title-screen').classList.remove('hidden');
});

document.getElementById('btn-rematch').addEventListener('click', startVersusSequence);
document.getElementById('btn-results-select').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('select-screen').classList.remove('hidden');
});
document.getElementById('btn-results-title').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('title-screen').classList.remove('hidden');
});

document.getElementById('btn-resume-match').addEventListener('click', togglePauseMatch);
document.getElementById('btn-quit-match').addEventListener('click', () => {
  hideAllOverlays();
  document.getElementById('fight-hud').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  gameState = 'TITLE';
});

// Settings Handlers
document.querySelectorAll('.timer-opt').forEach(btn => {
  btn.addEventListener('click', (e) => {
    roundLimit = parseInt(e.target.dataset.time, 10);
    document.querySelectorAll('.timer-opt').forEach(b => b.className = 'tekken-btn secondary timer-opt');
    e.target.className = 'tekken-btn timer-opt';
  });
});
document.getElementById('btn-settings-audio').addEventListener('click', () => audioSys.toggleMute());
document.getElementById('btn-settings-hitboxes').addEventListener('click', toggleDebugHitboxes);
document.getElementById('btn-reset-career').addEventListener('click', () => {
  localStorage.removeItem('tekken_p1_wins');
  localStorage.removeItem('tekken_p2_wins');
  loadRecords();
});
document.getElementById('btn-quick-sound').addEventListener('click', () => audioSys.toggleMute());
document.getElementById('btn-quick-hitboxes').addEventListener('click', toggleDebugHitboxes);

// ==========================================================================
// SECTION 8: WEB AUDIO SYNTHESIS & WEBRTC ROOM NETWORKING
// ==========================================================================

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggleMute() {
    this.muted = !this.muted;
    const btn = document.getElementById('btn-settings-audio');
    if (btn) btn.innerText = `Audio: ${this.muted ? 'MUTED' : 'ON'}`;
    return this.muted;
  }
  playPunch(heavy) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(heavy ? 180 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 35 : 60, now + (heavy ? 0.16 : 0.11));
    g.gain.setValueAtTime(heavy ? 0.5 : 0.35, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + (heavy ? 0.16 : 0.11));
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
  playBlock() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
  playElectric() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.32);
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }
  playWhiff() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }
  playGong() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [130, 196, 260].forEach(f => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    });
  }
}
const audioSys = new AudioSynth();

// WebRTC Signaling & Room Networking for 2nd Computer
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let currentRoomId = null;

document.getElementById('btn-host-create').addEventListener('click', async () => {
  audioSys.init();
  mpRole = 'host';
  try {
    const res = await fetch('/api/rooms/create', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    currentRoomId = data.roomId;
    document.getElementById('room-code-val').innerText = currentRoomId;
    document.getElementById('host-idle-box').classList.add('hidden');
    document.getElementById('host-active-box').classList.remove('hidden');

    initHostWebRTC();
  } catch (err) {
    document.getElementById('online-status-footer').innerText = 'Signaling offline (Testing in local mode)';
  }
});

async function initHostWebRTC() {
  peerConn = new RTCPeerConnection(rtcConfig);
  dataChan = peerConn.createDataChannel('tekken_battle', { ordered: false, maxRetransmits: 0 });
  setupDataChannel(dataChan);

  peerConn.onicecandidate = (e) => {
    if (e.candidate && currentRoomId) {
      sendSignal('candidate', e.candidate);
    }
  };

  const offer = await peerConn.createOffer();
  await peerConn.setLocalDescription(offer);
  sendSignal('offer', offer);
  startPollingSignals();
}

document.getElementById('btn-join-room').addEventListener('click', async () => {
  audioSys.init();
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (!code) return;
  mpRole = 'guest';
  currentRoomId = code;

  try {
    const res = await fetch(`/api/rooms/${code}/join`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Room not found');
      return;
    }
    peerConn = new RTCPeerConnection(rtcConfig);
    peerConn.ondatachannel = (e) => {
      dataChan = e.channel;
      setupDataChannel(dataChan);
    };
    peerConn.onicecandidate = (e) => {
      if (e.candidate) sendSignal('candidate', e.candidate);
    };
    startPollingSignals();
  } catch (err) {
    document.getElementById('online-status-footer').innerText = 'Connection error';
  }
});

function setupDataChannel(ch) {
  ch.onopen = () => {
    document.getElementById('p2p-status-badge').classList.remove('hidden');
    hideAllOverlays();
    document.getElementById('select-screen').classList.remove('hidden');
    gameState = 'SELECT';
  };
  ch.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'input') remoteP2Inputs = msg.data;
    } catch (err) {}
  };
}

let lastSeq = 0;
function startPollingSignals() {
  setInterval(async () => {
    if (!currentRoomId || !mpRole) return;
    try {
      const res = await fetch(`/api/rooms/${currentRoomId}/poll?role=${mpRole}&lastSeq=${lastSeq}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.latestSeq) lastSeq = data.latestSeq;
      if (data.signals) {
        for (const s of data.signals) {
          if (s.type === 'offer' && mpRole === 'guest') {
            await peerConn.setRemoteDescription(new RTCSessionDescription(s.data));
            const ans = await peerConn.createAnswer();
            await peerConn.setLocalDescription(ans);
            sendSignal('answer', ans);
          } else if (s.type === 'answer' && mpRole === 'host') {
            await peerConn.setRemoteDescription(new RTCSessionDescription(s.data));
          } else if (s.type === 'candidate') {
            try { await peerConn.addIceCandidate(new RTCIceCandidate(s.data)); } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }, 600);
}

async function sendSignal(type, data) {
  if (!currentRoomId || !mpRole) return;
  try {
    await fetch(`/api/rooms/${currentRoomId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: mpRole, type, data })
    });
  } catch (e) {}
}

document.getElementById('btn-copy-link').addEventListener('click', () => {
  const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
  navigator.clipboard.writeText(url);
  document.getElementById('btn-copy-link').innerText = '✅ LINK COPIED!';
  setTimeout(() => {
    document.getElementById('btn-copy-link').innerText = '📋 COPY DIRECT INVITE LINK';
  }, 2000);
});

// Auto join if ?room=XYZ in URL
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  document.getElementById('join-code-input').value = roomParam.toUpperCase();
  document.getElementById('btn-start-online').click();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
