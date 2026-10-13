import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { TekkenFighter, FIGHTER_CONFIGS } from './game/fighter';
import { sound } from './game/audio';
import { mp, ConnectionStatus, RemoteInputData } from './game/multiplayer';
import { Wifi, Volume2, VolumeX, Eye, RotateCcw, Link2, Copy, Check, Users, Monitor, ArrowLeft } from 'lucide-react';

type GameScreen = 'TITLE' | 'ONLINE_LOBBY' | 'SELECT' | 'VS_SPLASH' | 'FIGHT' | 'RESULTS';
type MatchMode = 'local' | 'online';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const p1Ref = useRef<TekkenFighter | null>(null);
  const p2Ref = useRef<TekkenFighter | null>(null);

  // Screen & Mode States
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('TITLE');
  const [matchMode, setMatchMode] = useState<MatchMode>('local');
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Audio & Debug States
  const [isMuted, setIsMuted] = useState(sound.muted);
  const [hitboxesVisible, setHitboxesVisible] = useState(false);

  // Match Configuration
  const [p1Char, setP1Char] = useState<string>('jin');
  const [p2Char, setP2Char] = useState<string>('kazuya');
  const [selectedStage, setSelectedStage] = useState<string>('dojo');
  const [roundTimeLimit, setRoundTimeLimit] = useState<number>(60);
  const [currentTimer, setCurrentTimer] = useState<number>(60);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [p1RoundsWon, setP1RoundsWon] = useState<number>(0);
  const [p2RoundsWon, setP2RoundsWon] = useState<number>(0);
  const [roundActive, setRoundActive] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>('ROUND 1');
  const [showAnnouncement, setShowAnnouncement] = useState<boolean>(false);

  // Health and Combos
  const [p1Health, setP1Health] = useState<number>(100);
  const [p2Health, setP2Health] = useState<number>(100);
  const [p1RedHealth, setP1RedHealth] = useState<number>(100);
  const [p2RedHealth, setP2RedHealth] = useState<number>(100);
  const [p1Combo, setP1Combo] = useState<number>(0);
  const [p2Combo, setP2Combo] = useState<number>(0);
  const [winnerName, setWinnerName] = useState<string>('');

  // Career Records
  const [p1LifetimeWins, setP1LifetimeWins] = useState<number>(0);
  const [p2LifetimeWins, setP2LifetimeWins] = useState<number>(0);

  // Online Multiplayer State
  const [onlineStatus, setOnlineStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string>('');
  const [onlineRoomCode, setOnlineRoomCode] = useState<string>('');
  const [joinInputCode, setJoinInputCode] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [livePing, setLivePing] = useState<number>(0);

  // Keyboard tracking
  const keysDownRef = useRef<Record<string, boolean>>({});
  const justPressedRef = useRef<Record<string, boolean>>({});
  const remoteP2InputRef = useRef<RemoteInputData>({
    left: false, right: false, up: false, down: false,
    lp: false, rp: false, lk: false, rk: false, timestamp: 0,
  });

  // Load Lifetime Records
  const loadRecords = useCallback(() => {
    const w1 = parseInt(localStorage.getItem('tekken_p1_wins') || '0', 10);
    const w2 = parseInt(localStorage.getItem('tekken_p2_wins') || '0', 10);
    setP1LifetimeWins(w1);
    setP2LifetimeWins(w2);
  }, []);

  const recordWin = useCallback((winnerId: number) => {
    const key = winnerId === 1 ? 'tekken_p1_wins' : 'tekken_p2_wins';
    const wins = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(wins));
    loadRecords();
  }, [loadRecords]);

  // Initialize Three.js Engine on Canvas mount
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    loadRecords();

    // Check URL parameters for ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setJoinInputCode(roomParam.toUpperCase());
      setCurrentScreen('ONLINE_LOBBY');
      setMatchMode('online');
    }

    return () => {
      engine.destroy();
    };
  }, [loadRecords]);

  // Bind Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      sound.init();
      if (!keysDownRef.current[e.code]) {
        justPressedRef.current[e.code] = true;
      }
      keysDownRef.current[e.code] = true;

      if (e.code === 'KeyB') {
        toggleHitboxes();
      }
      if (e.code === 'Escape' && currentScreen === 'FIGHT') {
        setIsPaused((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = false;
      justPressedRef.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [currentScreen]);

  // Wire Multiplayer Callbacks
  useEffect(() => {
    mp.onStatusChange = (status, msg) => {
      setOnlineStatus(status);
      setOnlineStatusMsg(msg || '');
      if (status === 'connected') {
        // Automatically proceed to character selection once peers connect!
        setCurrentScreen('SELECT');
      }
    };

    mp.onPeerInput = (remoteInput) => {
      remoteP2InputRef.current = remoteInput;
    };

    mp.onCharacterSelect = (role, char) => {
      if (role === 'host') setP1Char(char);
      else setP2Char(char);
    };

    mp.onStageSelect = (stage) => {
      setSelectedStage(stage);
      if (engineRef.current) {
        engineRef.current.setStage(stage);
      }
    };

    mp.onGameStart = () => {
      triggerVersusSequence();
    };

    mp.onRematch = () => {
      triggerVersusSequence();
    };

    const pingTimer = setInterval(() => {
      if (mp.status === 'connected') {
        setLivePing(mp.pingMs);
      }
    }, 1000);

    return () => {
      clearInterval(pingTimer);
    };
  }, []);

  const toggleHitboxes = () => {
    setHitboxesVisible((prev) => {
      const next = !prev;
      if (engineRef.current) {
        engineRef.current.debugHitboxesEnabled = next;
      }
      return next;
    });
  };

  const toggleAudio = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Online Room Handlers
  const handleHostRoom = async () => {
    try {
      sound.init();
      const code = await mp.createRoom();
      setOnlineRoomCode(code);
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinInputCode.trim()) return;
    try {
      sound.init();
      await mp.joinRoom(joinInputCode);
    } catch (err) {
      console.error(err);
    }
  };

  const copyShareLink = () => {
    if (!onlineRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${onlineRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Banner announcement helper
  const triggerAnnouncement = useCallback((text: string, duration: number = 1100, cb?: () => void) => {
    setAnnouncement(text);
    setShowAnnouncement(true);
    setTimeout(() => {
      setShowAnnouncement(false);
      if (cb) cb();
    }, duration);
  }, []);

  // Start round logic
  const startRound = useCallback(() => {
    if (!p1Ref.current || !p2Ref.current) return;
    setRoundActive(false);
    p1Ref.current.resetPosition(-3.6);
    p2Ref.current.resetPosition(3.6);
    setP1Health(100);
    setP2Health(100);
    setP1RedHealth(100);
    setP2RedHealth(100);
    setCurrentTimer(roundTimeLimit);

    triggerAnnouncement(`ROUND ${currentRound}`, 1100, () => {
      sound.playGong();
      triggerAnnouncement('FIGHT!', 750, () => {
        setRoundActive(true);
      });
    });
  }, [currentRound, roundTimeLimit, triggerAnnouncement]);

  // Initialize Fighters & Three.js Arena
  const initMatch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Clean up existing fighters
    if (p1Ref.current) p1Ref.current.dispose(engine.scene, engine.debugGroup);
    if (p2Ref.current) p2Ref.current.dispose(engine.scene, engine.debugGroup);

    engine.setStage(selectedStage);

    const f1 = new TekkenFighter(1, p1Char, -3.6, engine.scene, engine.debugGroup, hitboxesVisible);
    const f2 = new TekkenFighter(2, p2Char, 3.6, engine.scene, engine.debugGroup, hitboxesVisible);

    f1.onHitParticle = (x, y, z, heavy) => engine.spawnHitSparks(x, y, z, heavy);
    f1.onElectricParticle = (x, y, z, col) => engine.spawnElectricFlash(x, y, z, col);
    f1.onBlockParticle = (x, y, z) => engine.spawnBlockSparks(x, y, z);

    f2.onHitParticle = (x, y, z, heavy) => engine.spawnHitSparks(x, y, z, heavy);
    f2.onElectricParticle = (x, y, z, col) => engine.spawnElectricFlash(x, y, z, col);
    f2.onBlockParticle = (x, y, z) => engine.spawnBlockSparks(x, y, z);

    p1Ref.current = f1;
    p2Ref.current = f2;

    setP1RoundsWon(0);
    setP2RoundsWon(0);
    setCurrentRound(1);
    setCurrentScreen('FIGHT');
    startRound();
  }, [p1Char, p2Char, selectedStage, hitboxesVisible, startRound]);

  const triggerVersusSequence = useCallback(() => {
    setCurrentScreen('VS_SPLASH');
    sound.playGong();
    setTimeout(() => {
      initMatch();
    }, 2200);
  }, [initMatch]);

  // Round resolution
  const handleRoundEnd = useCallback((winnerId: number) => {
    setRoundActive(false);
    if (winnerId === 1) {
      const newWins = p1RoundsWon + 1;
      setP1RoundsWon(newWins);
      if (newWins >= 2) {
        sound.playKO();
        setWinnerName(p1Ref.current?.config.name || 'PLAYER 1');
        recordWin(1);
        setTimeout(() => setCurrentScreen('RESULTS'), 1500);
      } else {
        setCurrentRound((r) => r + 1);
        setTimeout(startRound, 1200);
      }
    } else if (winnerId === 2) {
      const newWins = p2RoundsWon + 1;
      setP2RoundsWon(newWins);
      if (newWins >= 2) {
        sound.playKO();
        setWinnerName(p2Ref.current?.config.name || 'PLAYER 2');
        recordWin(2);
        setTimeout(() => setCurrentScreen('RESULTS'), 1500);
      } else {
        setCurrentRound((r) => r + 1);
        setTimeout(startRound, 1200);
      }
    } else {
      // Draw
      setTimeout(startRound, 1200);
    }
  }, [p1RoundsWon, p2RoundsWon, recordWin, startRound]);

  // Main 60FPS Game Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      animationFrameId = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const engine = engineRef.current;
      const p1 = p1Ref.current;
      const p2 = p2Ref.current;

      if (!engine) return;

      if (currentScreen === 'FIGHT' && !isPaused && p1 && p2) {
        // Timer countdown
        if (roundActive) {
          setCurrentTimer((prev) => {
            const next = prev - dt;
            if (next <= 0) {
              // Time Out!
              if (p1.health > p2.health) {
                triggerAnnouncement('TIME UP! - P1 WINS', 1600, () => handleRoundEnd(1));
              } else if (p2.health > p1.health) {
                triggerAnnouncement('TIME UP! - P2 WINS', 1600, () => handleRoundEnd(2));
              } else {
                triggerAnnouncement('TIME UP! - DRAW', 1600, () => handleRoundEnd(0));
              }
              return 0;
            }
            return next;
          });
        }

        // Input gathering
        const keys = keysDownRef.current;
        const just = justPressedRef.current;

        // Player 1 Local controls (WASD + U/I/J/K)
        const p1Actions = {
          left: !!keys['KeyA'],
          right: !!keys['KeyD'],
          up: !!keys['KeyW'],
          down: !!keys['KeyS'],
          lp: !!just['KeyU'],
          rp: !!just['KeyI'],
          lk: !!just['KeyJ'],
          rk: !!just['KeyK'],
        };
        // consume triggers
        just['KeyU'] = false;
        just['KeyI'] = false;
        just['KeyJ'] = false;
        just['KeyK'] = false;

        p1.handleInput(p1Actions);

        // Player 2 Controls: Either remote WebRTC inputs OR local 2nd keyboard controls
        let p2Actions;
        if (matchMode === 'online') {
          if (mp.role === 'host') {
            // Host is P1: P2 comes from remote WebRTC channel
            p2Actions = remoteP2InputRef.current;
            // Send periodic state sync to guest
            mp.sendStateSync({
              p1: { x: p1.x, y: p1.y, z: p1.z, vx: p1.vx, vy: p1.vy, health: p1.health, state: p1.state, facing: p1.facing, isRageMode: p1.isRageMode },
              p2: { x: p2.x, y: p2.y, z: p2.z, vx: p2.vx, vy: p2.vy, health: p2.health, state: p2.state, facing: p2.facing, isRageMode: p2.isRageMode },
              roundTime: currentTimer,
              roundNumber: currentRound,
              stageName: selectedStage,
            });
          } else {
            // Guest is P2: Send local inputs to host via WebRTC!
            const guestLocalActions = {
              left: !!keys['KeyA'] || !!keys['ArrowLeft'],
              right: !!keys['KeyD'] || !!keys['ArrowRight'],
              up: !!keys['KeyW'] || !!keys['ArrowUp'],
              down: !!keys['KeyS'] || !!keys['ArrowDown'],
              lp: !!just['KeyU'] || !!just['Numpad7'] || !!just['KeyY'],
              rp: !!just['KeyI'] || !!just['Numpad8'],
              lk: !!just['KeyJ'] || !!just['Numpad4'] || !!just['KeyH'],
              rk: !!just['KeyK'] || !!just['Numpad5'],
              timestamp: performance.now(),
            };
            mp.sendInput(guestLocalActions);
            p2Actions = guestLocalActions;
          }
        } else {
          // Local 2-Player mode on one keyboard
          p2Actions = {
            left: !!keys['ArrowLeft'],
            right: !!keys['ArrowRight'],
            up: !!keys['ArrowUp'],
            down: !!keys['ArrowDown'],
            lp: !!just['Numpad7'] || !!just['KeyY'],
            rp: !!just['Numpad8'] || !!just['Digit7'],
            lk: !!just['Numpad4'] || !!just['KeyH'],
            rk: !!just['Numpad5'] || !!just['KeyG'],
          };
          just['Numpad7'] = false;
          just['KeyY'] = false;
          just['Numpad8'] = false;
          just['Digit7'] = false;
          just['Numpad4'] = false;
          just['KeyH'] = false;
          just['Numpad5'] = false;
          just['KeyG'] = false;
        }

        p2.handleInput(p2Actions);

        // Update physics & animations
        p1.update(dt, p2, hitboxesVisible);
        p2.update(dt, p1, hitboxesVisible);

        // Process 3D Collisions
        // P1 Hitbox vs P2 Hurtbox
        if (p1.hitbox.active && !p1.attackHitRegistered) {
          if (engine.check3DCollision(p1.hitbox, p2.hurtbox)) {
            p1.attackHitRegistered = true;
            const isGuarding =
              (p2.facing === 1 && p2Actions.left) ||
              (p2.facing === -1 && p2Actions.right);
            p2.takeHit(p1.hitbox, isGuarding);

            if (!isGuarding) {
              p1.comboCount++;
              p1.comboResetTimer = 1.3;
              setP1Combo(p1.comboCount);
            }
          }
        }

        // P2 Hitbox vs P1 Hurtbox
        if (p2.hitbox.active && !p2.attackHitRegistered) {
          if (engine.check3DCollision(p2.hitbox, p1.hurtbox)) {
            p2.attackHitRegistered = true;
            const isGuarding =
              (p1.facing === 1 && p1Actions.left) ||
              (p1.facing === -1 && p1Actions.right);
            p1.takeHit(p2.hitbox, isGuarding);

            if (!isGuarding) {
              p2.comboCount++;
              p2.comboResetTimer = 1.3;
              setP2Combo(p2.comboCount);
            }
          }
        }

        // 3D Push Separation
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

        // Health updates
        setP1Health(p1.health);
        setP2Health(p2.health);

        // Delayed red health bar
        setTimeout(() => {
          setP1RedHealth(p1.health);
          setP2RedHealth(p2.health);
        }, 180);

        // Check Round End KO
        if (roundActive) {
          if (p1.health <= 0 && p2.health <= 0) {
            triggerAnnouncement('DOUBLE K.O. - DRAW', 1800, () => handleRoundEnd(0));
          } else if (p2.health <= 0) {
            triggerAnnouncement(`K.O. - ${p1.config.name} WINS!`, 1800, () => handleRoundEnd(1));
          } else if (p1.health <= 0) {
            triggerAnnouncement(`K.O. - ${p2.config.name} WINS!`, 1800, () => handleRoundEnd(2));
          }
        }

        engine.updateCamera(p1, p2);
      }

      engine.updateParticles(dt);
      engine.render();
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentScreen, isPaused, matchMode, roundActive, hitboxesVisible, currentRound, selectedStage, handleRoundEnd, triggerAnnouncement]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020206] select-none font-['Rajdhani'] text-white">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-1 block" />
      <div className="screen-vignette" />

      {/* TOP STATUS BAR (Quick actions & Online ping) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
        {matchMode === 'online' && onlineStatus === 'connected' && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 border border-cyan-500/40 rounded-full text-xs text-cyan-300 backdrop-blur-sm">
            <Wifi className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>P2P {mp.role?.toUpperCase()} · {livePing}ms</span>
          </div>
        )}
        <button
          onClick={toggleAudio}
          className="p-2 bg-[#121626]/80 hover:bg-[#1f2640] border border-[#2e3756] rounded-md text-slate-300 transition-colors"
          title="Toggle Sound"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
        <button
          onClick={toggleHitboxes}
          className={`p-2 border rounded-md transition-colors ${
            hitboxesVisible
              ? 'bg-red-950/80 border-red-500 text-red-300'
              : 'bg-[#121626]/80 hover:bg-[#1f2640] border-[#2e3756] text-slate-300'
          }`}
          title="Toggle 3D Hitbox Visualizer (Hot: B)"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* =========================================================================
          SCREEN 1: TITLE SCREEN (Matches Uploaded Screenshot)
         ========================================================================= */}
      {currentScreen === 'TITLE' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#06060c]/85 backdrop-blur-md">
          <h1 className="game-logo-tekken">TEKKEN CLASH</h1>
          <p className="subtitle-ironfist mb-8">THE KING OF IRON FIST CHAMPIONSHIP</p>

          {/* Career Record Badge */}
          <div className="flex items-center gap-6 px-6 py-2 bg-[#0e1220]/90 border border-red-500/60 rounded-full text-sm font-semibold tracking-wider mb-8 shadow-lg shadow-red-900/20">
            <span>
              PLAYER 1 VICTORIES: <strong className="text-red-400 text-base">{p1LifetimeWins}</strong>
            </span>
            <span className="text-slate-500">·</span>
            <span>
              PLAYER 2 VICTORIES: <strong className="text-cyan-400 text-base">{p2LifetimeWins}</strong>
            </span>
          </div>

          {/* Main Menu Buttons */}
          <div className="flex flex-col gap-3.5 min-w-[320px]">
            <button
              onClick={() => {
                setMatchMode('local');
                setCurrentScreen('SELECT');
                sound.init();
              }}
              className="tekken-btn"
            >
              <Users className="w-5 h-5 text-red-300" />
              BATTLE MODE (2-PLAYER)
            </button>

            <button
              onClick={() => {
                setMatchMode('online');
                setCurrentScreen('ONLINE_LOBBY');
                sound.init();
              }}
              className="tekken-btn online"
            >
              <Monitor className="w-5 h-5 text-cyan-300" />
              ONLINE BATTLE (2 COMPUTERS)
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="tekken-btn secondary"
            >
              OPTIONS & CONTROLS
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 2: ONLINE MULTIPLAYER LOBBY (Host Room / Join Room)
         ========================================================================= */}
      {currentScreen === 'ONLINE_LOBBY' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05060e]/90 backdrop-blur-lg px-4">
          <div className="w-full max-w-xl bg-[#0e1322] border-2 border-cyan-500/40 rounded-xl p-8 shadow-2xl shadow-cyan-950/50">
            <div className="flex items-center justify-between border-b border-[#222d48] pb-4 mb-6">
              <div>
                <h2 className="font-['Orbitron'] text-2xl font-black text-cyan-400 tracking-wider">
                  ONLINE MATCHMAKING
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Cross-Computer WebRTC Peer-to-Peer Fighting Room
                </p>
              </div>
              <button
                onClick={() => setCurrentScreen('TITLE')}
                className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Room Creation (Player 1 Host) */}
            <div className="bg-[#141b30] border border-[#2b375a] rounded-lg p-5 mb-5">
              <h3 className="font-['Teko'] text-xl font-bold text-yellow-400 tracking-wide mb-1">
                HOST A ROOM (PLAYER 1)
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                Create a private room, copy your room code or direct link, and send it to Player 2.
              </p>

              {!onlineRoomCode ? (
                <button
                  onClick={handleHostRoom}
                  disabled={onlineStatus === 'creating'}
                  className="tekken-btn w-full"
                >
                  {onlineStatus === 'creating' ? 'CREATING ROOM...' : 'CREATE ROOM CODE'}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-[#080b15] border border-red-500/50 rounded-lg p-3">
                    <span className="text-xs text-slate-400">ROOM CODE:</span>
                    <span className="font-['Orbitron'] text-2xl font-black text-yellow-400 tracking-widest">
                      {onlineRoomCode}
                    </span>
                  </div>

                  <button
                    onClick={copyShareLink}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/60 rounded text-cyan-300 text-sm font-bold tracking-wider transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? 'LINK COPIED TO CLIPBOARD!' : 'COPY DIRECT INVITE LINK'}
                  </button>

                  <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded">
                    <Wifi className="w-4 h-4 animate-pulse shrink-0" />
                    <span>Waiting for Player 2 to join with this code...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Room Join (Player 2 Guest) */}
            <div className="bg-[#141b30] border border-[#2b375a] rounded-lg p-5">
              <h3 className="font-['Teko'] text-xl font-bold text-cyan-400 tracking-wide mb-1">
                JOIN A ROOM (PLAYER 2)
              </h3>
              <p className="text-xs text-slate-300 mb-3">
                Enter the 6-character room code from Player 1's screen to connect directly.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TK48A2"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="flex-1 bg-[#080b15] border border-[#344066] focus:border-cyan-400 rounded px-4 py-2.5 font-['Orbitron'] text-base tracking-widest uppercase outline-none"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!joinInputCode.trim() || onlineStatus === 'joining'}
                  className="tekken-btn online text-base py-2.5 px-6"
                >
                  {onlineStatus === 'joining' ? 'CONNECTING...' : 'JOIN BATTLE'}
                </button>
              </div>
            </div>

            {/* Status message */}
            {onlineStatusMsg && (
              <p className="mt-4 text-center text-xs text-slate-400">
                {onlineStatusMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: CHARACTER & STAGE SELECT
         ========================================================================= */}
      {currentScreen === 'SELECT' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05060e]/90 backdrop-blur-md px-6">
          <h2 className="font-['Orbitron'] text-3xl font-black tracking-widest text-white mb-1">
            CHARACTER & STAGE SELECT
          </h2>
          <p className="font-['Teko'] text-lg text-amber-400 tracking-widest mb-6 font-bold">
            CHOOSE YOUR COMBATANT AND ARENA
          </p>

          <div className="flex flex-wrap gap-8 items-start justify-center max-w-5xl w-full mb-8">
            {/* Fighter Roster */}
            <div className="flex-1 min-w-[340px] bg-[#0f1424]/90 border border-[#2b3554] rounded-lg p-5">
              <div className="font-['Teko'] text-xl font-bold text-amber-400 tracking-wider pb-2 border-b border-[#252f4c] text-center mb-4">
                FIGHTER ROSTER
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Jin Kazama */}
                <div
                  onClick={() => {
                    setP1Char('jin');
                    if (matchMode === 'online') mp.sendCharacterSelect('jin');
                    sound.playWhiff();
                  }}
                  className={`flex flex-col items-center p-4 rounded-md cursor-pointer transition-all border-2 ${
                    p1Char === 'jin'
                      ? 'border-red-500 bg-red-950/40 shadow-lg shadow-red-900/40 translate-y-[-2px]'
                      : 'border-[#26304d] bg-[#12172b] hover:border-red-400'
                  }`}
                >
                  <div className="w-full h-24 bg-gradient-to-b from-[#3a0810] to-[#120306] rounded flex items-center justify-center text-4xl mb-2">
                    ⚡
                  </div>
                  <h3 className="font-['Teko'] text-2xl font-bold text-red-400 leading-none">JIN K.</h3>
                  <p className="text-[11px] text-red-200 text-center mb-2">Traditional Karate & Devil Gene</p>
                  <div className="text-[10px] text-slate-300 w-full bg-black/40 p-2 rounded leading-relaxed">
                    <div>• <strong>Speed:</strong> 9.5 / 10</div>
                    <div>• <strong>Move:</strong> Electric Wind God Fist (EWGF)</div>
                  </div>
                </div>

                {/* Kazuya Mishima */}
                <div
                  onClick={() => {
                    setP2Char('kazuya');
                    if (matchMode === 'online') mp.sendCharacterSelect('kazuya');
                    sound.playWhiff();
                  }}
                  className={`flex flex-col items-center p-4 rounded-md cursor-pointer transition-all border-2 ${
                    p2Char === 'kazuya'
                      ? 'border-cyan-500 bg-cyan-950/40 shadow-lg shadow-cyan-900/40 translate-y-[-2px]'
                      : 'border-[#26304d] bg-[#12172b] hover:border-cyan-400'
                  }`}
                >
                  <div className="w-full h-24 bg-gradient-to-b from-[#08203f] to-[#030c18] rounded flex items-center justify-center text-4xl mb-2">
                    👿
                  </div>
                  <h3 className="font-['Teko'] text-2xl font-bold text-cyan-400 leading-none">KAZUYA M.</h3>
                  <p className="text-[11px] text-cyan-200 text-center mb-2">Mishima Style Powerhouse</p>
                  <div className="text-[10px] text-slate-300 w-full bg-black/40 p-2 rounded leading-relaxed">
                    <div>• <strong>Power:</strong> 9.9 / 10</div>
                    <div>• <strong>Move:</strong> Dragon Uppercut Launcher</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Select */}
            <div className="w-[320px] bg-[#0f1424]/90 border border-[#2b3554] rounded-lg p-5">
              <div className="font-['Teko'] text-xl font-bold text-amber-400 tracking-wider pb-2 border-b border-[#252f4c] text-center mb-4">
                ARENA SELECT
              </div>

              <div className="flex flex-col gap-3">
                <div
                  onClick={() => {
                    setSelectedStage('dojo');
                    if (engineRef.current) engineRef.current.setStage('dojo');
                    if (matchMode === 'online') mp.sendStageSelect('dojo');
                  }}
                  className={`p-3 rounded border-2 cursor-pointer transition-all ${
                    selectedStage === 'dojo'
                      ? 'border-amber-400 bg-amber-950/30 shadow-lg shadow-amber-900/30'
                      : 'border-[#26304d] bg-[#12172b] hover:border-amber-300'
                  }`}
                >
                  <div className="font-bold text-sm text-amber-300">⛩️ Mishima Dojo</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ancient tatami floor, red pillars, hanging lanterns
                  </p>
                </div>

                <div
                  onClick={() => {
                    setSelectedStage('caldera');
                    if (engineRef.current) engineRef.current.setStage('caldera');
                    if (matchMode === 'online') mp.sendStageSelect('caldera');
                  }}
                  className={`p-3 rounded border-2 cursor-pointer transition-all ${
                    selectedStage === 'caldera'
                      ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-900/30'
                      : 'border-[#26304d] bg-[#12172b] hover:border-red-400'
                  }`}
                >
                  <div className="font-bold text-sm text-red-400">🌋 Volcano Caldera</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dark basalt crags with bubbling lava seams
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#222b46] text-center text-xs text-slate-400">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white border border-slate-700">W</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white border border-slate-700">S</kbd> to 3D Sidestep incoming linear strikes!
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (matchMode === 'online') mp.sendGameStart();
                triggerVersusSequence();
              }}
              className="tekken-btn min-w-[240px]"
            >
              PROCEED TO BATTLE
            </button>
            <button
              onClick={() => setCurrentScreen('TITLE')}
              className="tekken-btn secondary min-w-[140px]"
            >
              BACK
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: VERSUS SPLASH SCREEN ("GET READY FOR THE NEXT BATTLE")
         ========================================================================= */}
      {currentScreen === 'VS_SPLASH' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020205] overflow-hidden">
          {/* Split diagonal background */}
          <div className="absolute inset-0 flex pointer-events-none">
            <div className="flex-1 bg-gradient-to-br from-[#3b000a] to-[#120003] border-r-4 border-red-500 skew-x-[-12deg] scale-110" />
            <div className="flex-1 bg-gradient-to-br from-[#001736] to-[#000814] skew-x-[-12deg] scale-110" />
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-8">
            <div className="font-['Orbitron'] text-3xl font-black tracking-[8px] text-amber-300 drop-shadow-[0_0_20px_rgba(255,190,0,0.8)] mb-8 text-center uppercase animate-pulse">
              GET READY FOR THE NEXT BATTLE
            </div>

            <div className="flex items-center justify-between w-full">
              {/* Player 1 Card */}
              <div className="flex flex-col items-center w-[360px] bg-[#0c0f1c]/80 border-2 border-red-500 p-6 rounded-lg shadow-2xl shadow-red-950/60">
                <span className="font-['Teko'] text-lg text-red-400 tracking-widest font-bold">PLAYER 1</span>
                <div className="text-6xl my-3">⚡</div>
                <h2 className="font-['Teko'] text-4xl font-black text-white">
                  {FIGHTER_CONFIGS[p1Char]?.name.toUpperCase()}
                </h2>
                <p className="text-xs text-red-200 tracking-widest mt-1">THE LIGHTNING AVANGER</p>
              </div>

              {/* VS Logo */}
              <div className="font-['Orbitron'] text-7xl font-black italic text-white drop-shadow-[0_0_35px_#ff0033] animate-pulse-vs mx-4">
                VS
              </div>

              {/* Player 2 Card */}
              <div className="flex flex-col items-center w-[360px] bg-[#0c0f1c]/80 border-2 border-cyan-500 p-6 rounded-lg shadow-2xl shadow-cyan-950/60">
                <span className="font-['Teko'] text-lg text-cyan-400 tracking-widest font-bold">PLAYER 2</span>
                <div className="text-6xl my-3">👿</div>
                <h2 className="font-['Teko'] text-4xl font-black text-white">
                  {FIGHTER_CONFIGS[p2Char]?.name.toUpperCase()}
                </h2>
                <p className="text-xs text-cyan-200 tracking-widest mt-1">HEIR OF THE MISHIMA EMPIRE</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 5: FIGHT HUD OVERLAY
         ========================================================================= */}
      {currentScreen === 'FIGHT' && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 pointer-events-none">
          {/* Top HUD Bars & Timer */}
          <div className="grid grid-cols-[1fr_130px_1fr] items-center gap-4 w-full">
            {/* Player 1 HUD */}
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-3">
                <span className="font-['Teko'] text-3xl font-extrabold text-red-400 leading-none">
                  {p1Ref.current?.config.name || 'JIN K.'}
                </span>
                <div className="flex gap-2">
                  <div
                    className={`w-4 h-4 rotate-45 border-2 border-red-500 transition-all ${
                      p1RoundsWon >= 1 ? 'bg-amber-400 border-white shadow-[0_0_12px_#ffcc00]' : 'bg-[#0e1220]'
                    }`}
                  />
                  <div
                    className={`w-4 h-4 rotate-45 border-2 border-red-500 transition-all ${
                      p1RoundsWon >= 2 ? 'bg-amber-400 border-white shadow-[0_0_12px_#ffcc00]' : 'bg-[#0e1220]'
                    }`}
                  />
                </div>
              </div>

              {/* P1 Health Bar Container */}
              <div
                className={`w-full h-8 bg-[#090b12] border-2 border-[#363d59] overflow-hidden relative shadow-inner ${
                  p1Health <= 25 ? 'rage-active' : ''
                }`}
                style={{ clipPath: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)' }}
              >
                {/* Delayed Red Damage Bar */}
                <div
                  className="absolute top-0 left-0 h-full bg-[#6e0c0c] transition-all duration-700"
                  style={{ width: `${p1RedHealth}%` }}
                />
                {/* Active Health Fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 via-amber-500 to-white transition-all duration-150"
                  style={{ width: `${p1Health}%` }}
                />
              </div>
            </div>

            {/* Central Timer Box */}
            <div
              className="flex items-center justify-center bg-gradient-to-b from-[#260505] to-[#0a0d18] border-2 border-red-500 px-3 py-1 shadow-[0_0_25px_rgba(255,0,0,0.5)]"
              style={{ clipPath: 'polygon(15% 0, 85% 0, 100% 50%, 85% 100%, 15% 100%, 0 50%)' }}
            >
              <span className="font-['Orbitron'] text-4xl font-black text-amber-300 drop-shadow-[0_0_15px_rgba(255,200,0,0.8)] leading-none">
                {Math.ceil(currentTimer)}
              </span>
            </div>

            {/* Player 2 HUD */}
            <div className="flex flex-col gap-1 items-end">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div
                    className={`w-4 h-4 rotate-45 border-2 border-cyan-500 transition-all ${
                      p2RoundsWon >= 1 ? 'bg-amber-400 border-white shadow-[0_0_12px_#ffcc00]' : 'bg-[#0e1220]'
                    }`}
                  />
                  <div
                    className={`w-4 h-4 rotate-45 border-2 border-cyan-500 transition-all ${
                      p2RoundsWon >= 2 ? 'bg-amber-400 border-white shadow-[0_0_12px_#ffcc00]' : 'bg-[#0e1220]'
                    }`}
                  />
                </div>
                <span className="font-['Teko'] text-3xl font-extrabold text-cyan-400 leading-none">
                  {p2Ref.current?.config.name || 'KAZUYA M.'}
                </span>
              </div>

              {/* P2 Health Bar Container */}
              <div
                className={`w-full h-8 bg-[#090b12] border-2 border-[#363d59] overflow-hidden relative shadow-inner ${
                  p2Health <= 25 ? 'rage-active' : ''
                }`}
                style={{ clipPath: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)' }}
              >
                <div
                  className="absolute top-0 right-0 h-full bg-[#6e0c0c] transition-all duration-700"
                  style={{ width: `${p2RedHealth}%` }}
                />
                <div
                  className="absolute top-0 right-0 h-full bg-gradient-to-l from-cyan-600 via-blue-400 to-white transition-all duration-150"
                  style={{ width: `${p2Health}%` }}
                />
              </div>
            </div>
          </div>

          {/* Combo Streaks Floating Badges */}
          {p1Combo > 1 && (
            <div className="absolute top-28 left-10 flex flex-col items-start font-['Orbitron'] font-black italic text-red-400 drop-shadow-[0_0_20px_#000]">
              <span className="text-6xl leading-none">{p1Combo}</span>
              <span className="text-lg text-amber-300 tracking-widest">HITS COMBO</span>
            </div>
          )}

          {p2Combo > 1 && (
            <div className="absolute top-28 right-10 flex flex-col items-end font-['Orbitron'] font-black italic text-cyan-400 drop-shadow-[0_0_20px_#000]">
              <span className="text-6xl leading-none">{p2Combo}</span>
              <span className="text-lg text-amber-300 tracking-widest">HITS COMBO</span>
            </div>
          )}

          {/* Center Announcements ("ROUND 1", "FIGHT!", "K.O.") */}
          {showAnnouncement && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 skew-x-[-8deg] font-['Orbitron'] text-7xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_50px_rgba(255,20,20,0.9)] text-center whitespace-nowrap animate-pulse">
              {announcement}
            </div>
          )}

          {/* Bottom 4-Limb Control Legend */}
          <div className="grid grid-cols-2 gap-4 bg-[#0a0d16]/90 border border-[#2b3552] border-t-2 border-t-red-500 px-6 py-2.5 rounded backdrop-blur-md text-xs text-slate-300 pointer-events-auto">
            <div>
              <div className="font-['Teko'] text-base font-bold text-amber-400 tracking-wider flex justify-between">
                <span>PLAYER 1 ({p1Ref.current?.config.style})</span>
                <span className="text-slate-400 font-normal">3D SIDESTEP: <kbd className="px-1 bg-slate-800 rounded">W</kbd> / <kbd className="px-1 bg-slate-800 rounded">S</kbd></span>
              </div>
              <div className="leading-relaxed">
                <span className="mr-3"><strong className="text-amber-300">LP:</strong> <kbd className="px-1 bg-slate-800 rounded">U</kbd></span>
                <span className="mr-3"><strong className="text-amber-300">RP:</strong> <kbd className="px-1 bg-slate-800 rounded">I</kbd></span>
                <span className="mr-3"><strong className="text-amber-300">LK:</strong> <kbd className="px-1 bg-slate-800 rounded">J</kbd></span>
                <span className="mr-3"><strong className="text-amber-300">RK:</strong> <kbd className="px-1 bg-slate-800 rounded">K</kbd></span>
                <span className="text-red-400 font-semibold ml-2">EWGF God Fist: <kbd className="px-1 bg-slate-800 rounded">S+D+I</kbd> or <kbd className="px-1 bg-slate-800 rounded">U+I</kbd></span>
              </div>
            </div>

            <div>
              <div className="font-['Teko'] text-base font-bold text-cyan-400 tracking-wider flex justify-between">
                <span>PLAYER 2 ({p2Ref.current?.config.style})</span>
                <span className="text-slate-400 font-normal">
                  {matchMode === 'online' ? 'Playing from Remote Device' : '3D SIDESTEP: ↑ / ↓'}
                </span>
              </div>
              <div className="leading-relaxed">
                {matchMode === 'online' ? (
                  <span className="text-cyan-300">Synchronized via WebRTC DataChannel (Sub-30ms)</span>
                ) : (
                  <>
                    <span className="mr-3"><strong className="text-cyan-300">LP:</strong> <kbd className="px-1 bg-slate-800 rounded">Num 7 / Y</kbd></span>
                    <span className="mr-3"><strong className="text-cyan-300">RP:</strong> <kbd className="px-1 bg-slate-800 rounded">Num 8</kbd></span>
                    <span className="mr-3"><strong className="text-cyan-300">LK:</strong> <kbd className="px-1 bg-slate-800 rounded">Num 4 / H</kbd></span>
                    <span className="mr-3"><strong className="text-cyan-300">RK:</strong> <kbd className="px-1 bg-slate-800 rounded">Num 5</kbd></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 6: RESULTS SCREEN
         ========================================================================= */}
      {currentScreen === 'RESULTS' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#05060e]/95 backdrop-blur-lg">
          <h1 className="game-logo-tekken text-6xl mb-2">{winnerName} WINS!</h1>
          <p className="subtitle-ironfist text-xl mb-8">
            CHAMPIONSHIP VICTORY ({p1RoundsWon} - {p2RoundsWon})
          </p>

          <div className="flex flex-col gap-3 min-w-[280px]">
            <button
              onClick={() => {
                if (matchMode === 'online') mp.sendRematch();
                triggerVersusSequence();
              }}
              className="tekken-btn"
            >
              <RotateCcw className="w-5 h-5 text-amber-300" />
              REMATCH
            </button>
            <button
              onClick={() => setCurrentScreen('SELECT')}
              className="tekken-btn secondary"
            >
              FIGHTER SELECT
            </button>
            <button
              onClick={() => setCurrentScreen('TITLE')}
              className="tekken-btn secondary"
            >
              TITLE SCREEN
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAUSE MENU OVERLAY
         ========================================================================= */}
      {isPaused && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
          <h2 className="font-['Orbitron'] text-5xl font-black tracking-widest text-red-500 mb-8">
            MATCH PAUSED
          </h2>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <button
              onClick={() => setIsPaused(false)}
              className="tekken-btn"
            >
              RESUME BATTLE
            </button>
            <button
              onClick={toggleAudio}
              className="tekken-btn secondary"
            >
              {isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}
            </button>
            <button
              onClick={() => {
                setIsPaused(false);
                setCurrentScreen('TITLE');
              }}
              className="tekken-btn secondary"
            >
              RETURN TO TITLE
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          OPTIONS & CONTROLS MODAL
         ========================================================================= */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-[#0e1220] border border-[#2a3454] rounded-xl p-6 shadow-2xl">
            <h2 className="font-['Orbitron'] text-2xl font-black text-amber-400 mb-6">
              GAME CONFIGURATION
            </h2>

            <div className="flex flex-col gap-4 text-sm mb-6">
              {/* Round Timer Setting */}
              <div className="flex items-center justify-between py-2 border-b border-[#202842]">
                <span className="font-bold">Round Time Limit</span>
                <div className="flex gap-2">
                  {[30, 60, 99].map((t) => (
                    <button
                      key={t}
                      onClick={() => setRoundTimeLimit(t)}
                      className={`px-3 py-1 font-['Teko'] text-lg font-bold rounded ${
                        roundTimeLimit === t
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Synthesizer */}
              <div className="flex items-center justify-between py-2 border-b border-[#202842]">
                <span className="font-bold">Web Audio Impact FX</span>
                <button
                  onClick={toggleAudio}
                  className="px-4 py-1.5 font-['Teko'] text-lg rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {isMuted ? 'Audio: MUTED' : 'Audio: ACTIVE'}
                </button>
              </div>

              {/* Hitbox Visualizer */}
              <div className="flex items-center justify-between py-2 border-b border-[#202842]">
                <span className="font-bold">3D Hitboxes Wireframe (Hot: B)</span>
                <button
                  onClick={toggleHitboxes}
                  className={`px-4 py-1.5 font-['Teko'] text-lg rounded ${
                    hitboxesVisible ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {hitboxesVisible ? 'Hitboxes: ON' : 'Hitboxes: OFF'}
                </button>
              </div>

              {/* Reset stats */}
              <div className="flex items-center justify-between py-2">
                <span className="font-bold">Career Victory Records</span>
                <button
                  onClick={() => {
                    localStorage.removeItem('tekken_p1_wins');
                    localStorage.removeItem('tekken_p2_wins');
                    loadRecords();
                  }}
                  className="px-3 py-1 text-xs text-red-400 hover:text-red-300 border border-red-900/60 rounded"
                >
                  Reset Records
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="tekken-btn w-full"
            >
              SAVE & RETURN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
