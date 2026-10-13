# TEKKEN CLASH — 3D WebGL Fighting Game with Cross-Device Multiplayer

TEKKEN CLASH is a complete browser-based 3D fighting game inspired by the legendary Iron Fist tournament aesthetic. It features responsive 4-limb combat, 3D Z-axis sidestepping, multiple stages, Web Audio impact synthesis, local two-player shared keyboard battle, and real-time cross-computer multiplayer powered by WebRTC P2P with Express room signaling—engineered for direct deployment on Google Cloud Run.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction and multiplayer model have been calibrated based on your requirements:
> - **Cross-Computer Remote Play**: P2P WebRTC data channels with lightweight room signaling hosted directly on the Cloud Run Express backend. Player 1 hosts a match to get a 6-character room code or one-click shareable URL; Player 2 opens the link on their computer and connects instantly with sub-30ms input latency.
> - **Dual Input Modes**: Supports both **Online 2-Player (Cross-Computer)** and **Local 2-Player (Shared Keyboard: WASD + U/I/J/K vs Arrow Keys + Numpad)**.
> - **Production Cloud Run Packaging**: Express server listening on port 3000 that serves the client application, static assets, and handles real-time signaling with graceful health checks.

- **Confirmed Decision 1**: Cross-computer matchmaking uses WebRTC DataChannels for frame-synchronized input delivery with room codes and direct links.
- **Confirmed Decision 2**: Packaged with a production-ready Express server (`server.ts` / port 3000) for seamless deployment to Cloud Run.
- **Confirmed Decision 3**: Full adherence to the Tekken-style presentation from the reference screenshot (crimson neon branding, career records, character selection, and 4-limb control HUD).

---

## 1. Overview & Core Concept

- **What It Does**: Delivers an arcade-caliber 3D fighting experience right in the browser with no build step required for standalone consumption, while fully integrated with a production Node/Express server for Cloud Run hosting and remote room coordination.
- **Target Audience**: Fighting game fans, casual competitors, and friends wanting an instant zero-install 3D duel across two separate laptops or computers.
- **Key Value**: Low-latency browser 3D fighting with authentic mechanics—directional blocking, frame data timings, hitstun/blockstun, juggle launchers, Rage Mode triggers, and 3D Z-axis sidesteps.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Title Screen**: Dramatic red-neon "TEKKEN CLASH" typography, lifetime win tracking (P1 vs P2), and main menu buttons (*Battle Mode (2-Player)*, *Online Room (2 Computers)*, *Options & Controls*).
2. **Online Room Lobby**:
   - Host generates a unique room code (e.g. `MISHIMA-7`) or copies a direct invite link (`?room=XYZ`).
   - Guest pastes code or opens the URL to establish a WebRTC P2P DataChannel.
   - Status indicators confirm low-latency peer connection before proceeding to fighter selection.
3. **Fighter & Arena Select**:
   - Fighters: **Jin Kazama** (speed/combo specialist with Electric Wind God Fist) and **Kazuya Mishima** (heavy juggler with Dragon Uppercut Launcher).
   - Stages: **Mishima Dojo** (traditional tatami floor, glowing red lanterns, night backdrop) and **Volcano Caldera** (molten rock, magma fissures, smoldering spires).
4. **"GET READY FOR THE NEXT BATTLE" Versus Splash**: Iconic split-diagonal screen introducing both combatants with signature poses and audio gong.
5. **Fight HUD & Combat**:
   - Angular health bars with secondary red damage gauges and pulsing **Rage Mode** aura below 25% health.
   - Central countdown timer (30s, 60s, or 99s).
   - Round win diamonds/pips (best of 3 rounds).
   - Combo counter banners displaying hit streaks and damage.
   - Bottom 4-Limb Legend: Left Punch (LP), Right Punch (RP), Left Kick (LK), Right Kick (RK), and 3D sidestep guidance.
6. **Results & Rematch**: Post-match victory screen with stats breakdown, rematch trigger, and character re-selection.

### Visual Identity & Theme
- **Color Palette**: 60% Obsidian Black (`#05060a`), 30% Metallic Navy & Slate (`#121626`), 10% Intense Crimson (`#ff1a38`) and Lightning Gold (`#ffcc00`).
- **Typography**: Display headings in `Orbitron` & `Teko` (condensed athletic martial arts display); metadata in `Rajdhani` and `JetBrains Mono` for frame timings.
- **Visual FX**: 3D mesh particle sparks on hit confirms, electric arcs for Mishima specials, defensive block shields, and camera shake on heavy impacts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: WebRTC DataChannel for Cross-Computer Play**
  - *Chosen Approach*: WebRTC DataChannels with unreliable/ordered mode for inputs, backed by an in-app Express signaling endpoint (`/api/rooms`).
  - *Why*: Direct peer-to-peer data channels offer sub-30ms input transmission without intermediate server lag, vital for fighting game responsiveness.
  - *Alternatives Considered*: Standard WebSockets relaying all frames through the server was passed over to avoid server CPU load and extra network hops.
- **Decision 2: 3D Movement with Z-Axis Sidestepping**
  - *Chosen Approach*: 2.5D fighting plane with full 3D sidestep depth ($Z \in [-1.8, +1.8]$) allowing players to step around linear attacks.
  - *Why*: Faithful to the Tekken formula and distinguishes the game from flat 2D brawlers.
- **Decision 3: Cloud Run Deployment Architecture**
  - *Chosen Approach*: Unified Express HTTP server that serves the compiled client, provides WebRTC signaling endpoints, and exposes health check routes on port 3000.
  - *Why*: Satisfies Cloud Run container requirements with zero configuration friction.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google Cloud Run Service                        │
│                   Express Server (Port 3000 / server.ts)                │
│                                                                        │
│   ┌────────────────────────┐         ┌─────────────────────────────┐   │
│   │  Static Asset Serving  │         │  WebRTC Signaling API       │   │
│   │  (HTML, CSS, JS, 3D)   │         │  POST /api/room/create      │   │
│   │                        │         │  POST /api/room/join        │   │
│   │                        │         │  GET/POST /api/room/signal  │   │
│   └───────────┬────────────┘         └──────────────┬──────────────┘   │
└───────────────┼─────────────────────────────────────┼──────────────────┘
                │ HTTP GET                            │ Signaling Exchange
                ▼                                     ▼
┌─────────────────────────────────┐   WebRTC P2P   ┌─────────────────────────────────┐
│     Computer A (Player 1)       │◄══════════════►│      Computer B (Player 2)      │
│  - Three.js 3D WebGL Engine     │  DataChannel   │  - Three.js 3D WebGL Engine     │
│  - Host Input & Combat Loop     │  (Frame Input  │  - Remote Client Input Reader   │
│  - Web Audio Synthesizer        │    & State)    │  - Web Audio Synthesizer        │
│  - 3D AABB Hitbox Detection     │                │  - Interpolated State Sync      │
└─────────────────────────────────┘                └─────────────────────────────────┘
```

### Combat State Machine & Data Model

```
                    ┌──────────────┐
                    │     IDLE     │
                    └───┬───┬───┬──┘
         Walk/Fwd/Back  │   │   │  Sidestep (W / S)
       ┌────────────────┘   │   └────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  WALK / RUN  │     │     JUMP     │     │ 3D SIDESTEP  │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │ Attack             │ Aerial strike
       ▼                    ▼
┌────────────────────────────────────────────────────────┐
│                    ATTACK STATES                       │
│  LP (10f Jab) | RP (12f Straight) | LK (Mid Kick)      │
│  RK (Launcher) | EWGF (Electric Wind God Fist)         │
└───────────────────────────┬────────────────────────────┘
                            │ On Hit / Block
              ┌─────────────┴─────────────┐
              ▼                           ▼
       ┌──────────────┐            ┌──────────────┐
       │   HITSTUN    │            │  BLOCKSTUN   │
       │ (or Juggle)  │            │  (Chip Dmg)  │
       └──────────────┘            └──────────────┘
```

### File & Deliverable Structure
1. `index.html` — Clean DOM structure with canvas viewport, Tekken title screen, character selector, online lobby modal, and HUD.
2. `src/game/engine.ts` — Three.js scene, lighting rig, 3D arena builders (Dojo & Caldera), and particle systems.
3. `src/game/fighter.ts` — 3D articulated fighter meshes, 4-limb attack strings, bounding volume hitboxes, and Rage state.
4. `src/game/multiplayer.ts` — WebRTC peer connection manager, room creation/joining, input state serialization, and latency monitoring.
5. `src/game/audio.ts` — Procedural Web Audio API sound generator (impact punches, heavy kicks, electric shocks, gong).
6. `server.ts` — Express production server hosting static bundle and room signaling for Cloud Run deployment.
