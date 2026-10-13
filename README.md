# TEKKEN CLASH — 3D WebGL Iron Fist Championship

A complete, playable 3D fighting game built with WebGL and Three.js, supporting both **Local 2-Player (Shared Keyboard)** and **Cross-Computer Remote Play (WebRTC DataChannel Room Code)**.

---

## Key Features

1. **True 3D Combat Space**:
   - 3D Sidestepping along the Z-axis (<kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd>) to dodge linear attacks.
   - Dynamic camera tracking that zooms, translates, and frames both fighters in real time.
   - 3D AABB Hurtboxes and Hitboxes visible in debug mode (press <kbd>B</kbd>).

2. **Tekken 4-Limb Combat System**:
   - **LP (Left Punch)**: Fast 10-frame high jab.
   - **RP (Right Punch)**: 12-frame straight cross.
   - **LK (Left Kick)**: Mid roundhouse.
   - **RK (Right Kick)**: High launcher kick popping opponents into sky-high juggle combos.
   - **Special Launcher Move**: *Electric Wind God Fist (EWGF)* / *Dragon Uppercut* executed via <kbd>S</kbd>+<kbd>D</kbd>+<kbd>RP</kbd> or macro <kbd>LP+RP</kbd>.
   - **Rage Mode**: Below 25% health, fighters enter Rage Mode with an active glowing aura and a +35% damage boost.

3. **Multiplayer (Local & Cross-Computer)**:
   - **Local 2-Player**: Play on one keyboard simultaneously.
   - **Online 2-Player (Two Different Computers)**: Player 1 creates a private room code or copies the share link (`?room=CODE`). Player 2 opens the link or enters the code on their computer. A WebRTC DataChannel connects both machines directly for sub-30ms P2P input synchronization.

4. **Web Audio Sound Effects**:
   - Synthesized impacts (punches, kicks, electric zaps, block deflections, and ceremonial round gong).

---

## Controls

### Player 1 (Kazama Style)
- **Movement**: <kbd>A</kbd> (Left/Back), <kbd>D</kbd> (Right/Forward)
- **3D Sidestep**: <kbd>W</kbd> (Step into background -Z), <kbd>S</kbd> (Step into foreground +Z)
- **Attacks**:
  - <kbd>U</kbd>: Left Punch (LP)
  - <kbd>I</kbd>: Right Punch (RP)
  - <kbd>J</kbd>: Left Kick (LK)
  - <kbd>K</kbd>: Right Kick (RK)
- **Special / EWGF**: <kbd>S</kbd>+<kbd>D</kbd>+<kbd>I</kbd> or <kbd>U</kbd>+<kbd>I</kbd>

### Player 2 (Mishima Style — Local Mode)
- **Movement**: <kbd>←</kbd> (Left), <kbd>→</kbd> (Right)
- **3D Sidestep**: <kbd>↑</kbd> (Step into background -Z), <kbd>↓</kbd> (Step into foreground +Z)
- **Attacks**:
  - <kbd>Num 7</kbd> / <kbd>Y</kbd>: Left Punch (LP)
  - <kbd>Num 8</kbd>: Right Punch (RP)
  - <kbd>Num 4</kbd> / <kbd>H</kbd>: Left Kick (LK)
  - <kbd>Num 5</kbd>: Right Kick (RK)
- **Special Launcher**: <kbd>↓</kbd>+<kbd>→</kbd>+<kbd>Num 8</kbd> or <kbd>Num 7</kbd>+<kbd>Num 8</kbd>

*(When playing Online from a second computer, Player 2 uses their own primary keyboard controls <kbd>WASD</kbd> + <kbd>U</kbd>/<kbd>I</kbd>/<kbd>J</kbd>/<kbd>K</kbd>).*

---

## Deployment & Running

### 1. Cloud Run / Production Node Hosting
```bash
# Install dependencies
npm install

# Build static assets
npm run build

# Start production server (listens on port 3000)
npm start
```
The server handles both static file serving and the lightweight WebRTC signaling REST API (`/api/rooms/*`).

### 2. Standalone Browser Run (Zero Build Step)
Open `standalone/index.html` directly in any modern desktop web browser:
```
standalone/
├── index.html   (HTML5 structure and canvas viewport)
├── style.css    (Tekken styles and HUD styling)
└── game.js      (Complete self-contained JavaScript and Three.js logic)
```
You can also host the three `standalone/` files on any static host like GitHub Pages, Vercel, or Netlify.
