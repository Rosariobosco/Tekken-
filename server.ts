import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// In-memory room store for WebRTC signaling
interface RoomSignal {
  seq: number;
  sender: 'host' | 'guest';
  type: string;
  data: any;
  timestamp: number;
}

interface Room {
  id: string;
  createdAt: number;
  hostJoined: boolean;
  guestJoined: boolean;
  signals: RoomSignal[];
  lastActive: number;
}

const rooms = new Map<string, Room>();

// Auto clean rooms inactive for > 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActive > 30 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}, 60000);

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), activeRooms: rooms.size });
});

// Create Room
app.post('/api/rooms/create', (req, res) => {
  const customId = req.body?.customId;
  const id = (customId || Math.random().toString(36).substring(2, 8)).toUpperCase();
  const room: Room = {
    id,
    createdAt: Date.now(),
    hostJoined: true,
    guestJoined: false,
    signals: [],
    lastActive: Date.now(),
  };
  rooms.set(id, room);
  res.json({ success: true, roomId: id, role: 'host' });
});

// Join Room
app.post('/api/rooms/:roomId/join', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found. Check code.' });
  }
  room.guestJoined = true;
  room.lastActive = Date.now();
  res.json({ success: true, roomId, role: 'guest' });
});

// Post Signal (Offer, Answer, ICE Candidate)
app.post('/api/rooms/:roomId/signal', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  const { sender, type, data } = req.body;
  if (!sender || !type) {
    return res.status(400).json({ success: false, error: 'Invalid payload' });
  }

  const signal: RoomSignal = {
    seq: room.signals.length + 1,
    sender,
    type,
    data,
    timestamp: Date.now(),
  };

  room.signals.push(signal);
  room.lastActive = Date.now();
  res.json({ success: true, seq: signal.seq });
});

// Poll Signals
app.get('/api/rooms/:roomId/poll', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  const role = req.query.role as 'host' | 'guest';
  const lastSeq = parseInt(req.query.lastSeq as string, 10) || 0;

  // Find signals destined for this role (sent by the opposing role)
  const opposing = role === 'host' ? 'guest' : 'host';
  const newSignals = room.signals.filter(
    (s) => s.seq > lastSeq && s.sender === opposing
  );

  room.lastActive = Date.now();
  res.json({
    success: true,
    guestJoined: room.guestJoined,
    signals: newSignals,
    latestSeq: room.signals.length,
  });
});

// Mounting static assets or Vite middleware
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Tekken Clash Server] Listening on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Tekken Clash Server] Failed to start:', err);
  process.exit(1);
});
