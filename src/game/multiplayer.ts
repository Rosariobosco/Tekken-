/**
 * WebRTC Peer-to-Peer Multiplayer Manager for Tekken Clash
 * Connects 2 players across separate computers with room codes & shareable URLs.
 */

export interface RemoteInputData {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  lp: boolean;
  rp: boolean;
  lk: boolean;
  rk: boolean;
  timestamp: number;
}

export interface FighterSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  health: number;
  state: string;
  facing: number;
  isRageMode: boolean;
}

export interface MatchSyncData {
  p1: FighterSnapshot;
  p2: FighterSnapshot;
  roundTime: number;
  roundNumber: number;
  stageName: string;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'creating'
  | 'waiting_for_peer'
  | 'joining'
  | 'connecting'
  | 'connected'
  | 'failed';

export class MultiplayerManager {
  public role: 'host' | 'guest' | null = null;
  public roomId: string | null = null;
  public status: ConnectionStatus = 'disconnected';
  public pingMs: number = 0;

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pollIntervalId: any = null;
  private lastSignalSeq: number = 0;
  private pingIntervalId: any = null;

  // Event callbacks
  public onStatusChange?: (status: ConnectionStatus, message?: string) => void;
  public onPeerInput?: (input: RemoteInputData) => void;
  public onStateSync?: (sync: MatchSyncData) => void;
  public onCharacterSelect?: (role: 'host' | 'guest', character: string) => void;
  public onStageSelect?: (stage: string) => void;
  public onGameStart?: () => void;
  public onRematch?: () => void;

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor() {}

  private setStatus(newStatus: ConnectionStatus, msg?: string) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus, msg);
    }
  }

  // 1. Host Creates Room
  public async createRoom(customCode?: string): Promise<string> {
    this.cleanup();
    this.role = 'host';
    this.setStatus('creating', 'Creating online room...');

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customId: customCode }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create room');

      this.roomId = data.roomId;
      this.setupPeerConnection();

      // Create WebRTC DataChannel (Host creates)
      if (this.peerConnection) {
        this.dataChannel = this.peerConnection.createDataChannel('tekken_combat', {
          ordered: false,
          maxRetransmits: 0, // Unreliable low latency for fighting inputs
        });
        this.setupDataChannel(this.dataChannel);

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Send offer to signaling server
        await this.sendSignal('offer', offer);
      }

      this.setStatus('waiting_for_peer', `Room Code: ${this.roomId}. Share code or link.`);
      this.startSignalingPolling();
      return this.roomId!;
    } catch (err: any) {
      this.setStatus('failed', err.message || 'Error creating room');
      throw err;
    }
  }

  // 2. Guest Joins Room
  public async joinRoom(roomId: string): Promise<void> {
    this.cleanup();
    this.role = 'guest';
    this.roomId = roomId.toUpperCase().trim();
    this.setStatus('joining', `Joining room ${this.roomId}...`);

    try {
      const res = await fetch(`/api/rooms/${this.roomId}/join`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Room does not exist');

      this.setupPeerConnection();

      // Listen for incoming DataChannel
      if (this.peerConnection) {
        this.peerConnection.ondatachannel = (e) => {
          this.dataChannel = e.channel;
          this.setupDataChannel(this.dataChannel);
        };
      }

      this.startSignalingPolling();
    } catch (err: any) {
      this.setStatus('failed', err.message || 'Error joining room');
      throw err;
    }
  }

  private setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.roomId) {
        this.sendSignal('candidate', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.connectionState;
      if (state === 'connected') {
        this.setStatus('connected', 'P2P Connected! Ready to Fight.');
        this.startPingTracking();
      } else if (state === 'failed' || state === 'disconnected') {
        this.setStatus('disconnected', 'Peer disconnected.');
        this.stopPingTracking();
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.setStatus('connected', 'Direct DataChannel opened.');
      this.startPingTracking();
    };

    channel.onclose = () => {
      this.setStatus('disconnected', 'DataChannel closed.');
      this.stopPingTracking();
    };

    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleDataMessage(msg);
      } catch (err) {
        // ignore parse errors
      }
    };
  }

  private handleDataMessage(msg: any) {
    switch (msg.type) {
      case 'input':
        if (this.onPeerInput) this.onPeerInput(msg.data);
        break;
      case 'sync':
        if (this.onStateSync) this.onStateSync(msg.data);
        break;
      case 'char_select':
        if (this.onCharacterSelect) this.onCharacterSelect(msg.role, msg.character);
        break;
      case 'stage_select':
        if (this.onStageSelect) this.onStageSelect(msg.stage);
        break;
      case 'game_start':
        if (this.onGameStart) this.onGameStart();
        break;
      case 'rematch':
        if (this.onRematch) this.onRematch();
        break;
      case 'ping':
        this.sendRaw({ type: 'pong', sent: msg.sent });
        break;
      case 'pong':
        this.pingMs = Math.max(1, Math.round(performance.now() - msg.sent));
        break;
    }
  }

  private async sendSignal(type: string, data: any) {
    if (!this.roomId || !this.role) return;
    try {
      await fetch(`/api/rooms/${this.roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: this.role,
          type,
          data,
        }),
      });
    } catch (err) {
      console.warn('Failed to send signal:', err);
    }
  }

  private startSignalingPolling() {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);

    this.pollIntervalId = setInterval(async () => {
      if (!this.roomId || !this.role || this.status === 'connected') {
        if (this.status === 'connected') {
          clearInterval(this.pollIntervalId);
          this.pollIntervalId = null;
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/rooms/${this.roomId}/poll?role=${this.role}&lastSeq=${this.lastSignalSeq}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.latestSeq) this.lastSignalSeq = data.latestSeq;

        if (data.signals && data.signals.length > 0) {
          for (const s of data.signals) {
            await this.handleReceivedSignal(s.type, s.data);
          }
        }
      } catch (err) {
        // network polling retry
      }
    }, 600);
  }

  private async handleReceivedSignal(type: string, data: any) {
    if (!this.peerConnection) return;

    if (type === 'offer' && this.role === 'guest') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal('answer', answer);
    } else if (type === 'answer' && this.role === 'host') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    } else if (type === 'candidate') {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
      } catch (e) {
        // candidate error
      }
    }
  }

  // Direct DataChannel Send
  public sendRaw(payload: any) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
    }
  }

  public sendInput(inputData: RemoteInputData) {
    this.sendRaw({ type: 'input', data: inputData });
  }

  public sendStateSync(syncData: MatchSyncData) {
    this.sendRaw({ type: 'sync', data: syncData });
  }

  public sendCharacterSelect(character: string) {
    this.sendRaw({ type: 'char_select', role: this.role, character });
  }

  public sendStageSelect(stage: string) {
    this.sendRaw({ type: 'stage_select', stage });
  }

  public sendGameStart() {
    this.sendRaw({ type: 'game_start' });
  }

  public sendRematch() {
    this.sendRaw({ type: 'rematch' });
  }

  private startPingTracking() {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = setInterval(() => {
      this.sendRaw({ type: 'ping', sent: performance.now() });
    }, 1500);
  }

  private stopPingTracking() {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = null;
  }

  public cleanup() {
    this.stopPingTracking();
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = null;
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.role = null;
    this.roomId = null;
    this.status = 'disconnected';
    this.pingMs = 0;
    this.lastSignalSeq = 0;
  }
}

export const mp = new MultiplayerManager();
