import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 40;
const LIMIT = 130;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const room = (url.searchParams.get('room') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'farm';
      return env.WORLD.get(env.WORLD.idFromName(room)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const num = (v) => (Number.isFinite(v) ? Math.round(Math.max(-LIMIT, Math.min(LIMIT, v)) * 100) / 100 : 0);
const int = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const pub = (p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, r: p.r, q: p.q, bell: p.bell });

/**
 * One farm. Relays cow positions, moos and chat between connected players.
 * Uses the WebSocket hibernation API: all per-player state lives in the socket attachment,
 * so the object can be evicted from memory between messages without losing anyone.
 */
export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
      return new Response('Farm is full', { status: 503 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id: crypto.randomUUID().slice(0, 8), joined: false });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 600) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const me = ws.deserializeAttachment();
    if (!me || !m || typeof m !== 'object') return;

    if (m.t === 'hello') {
      if (me.joined) return;
      Object.assign(me, {
        joined: true,
        name: text(m.name, 16) || 'Cow',
        color: int(m.color, 5),
        x: num(m.x),
        z: num(m.z),
        r: 0,
        q: int(m.q, 8),
        bell: !!m.bell,
        last: 0,
      });
      ws.serializeAttachment(me);
      const players = [];
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const p = other.deserializeAttachment();
        if (p?.joined) players.push(pub(p));
      }
      this.send(ws, { t: 'welcome', id: me.id, players });
      this.broadcast({ t: 'join', p: pub(me) }, ws);
      return;
    }
    if (!me.joined) return;

    switch (m.t) {
      case 'pos':
        me.x = num(m.x);
        me.z = num(m.z);
        me.r = num(m.r);
        ws.serializeAttachment(me);
        this.broadcast({ t: 'pos', id: me.id, x: me.x, z: me.z, r: me.r, m: m.m ? 1 : 0 }, ws);
        break;
      case 'moo':
      case 'chat': {
        const now = Date.now();
        const key = m.t === 'moo' ? 'lastMoo' : 'lastChat';
        if (now - (me[key] || 0) < 400) return;
        me[key] = now;
        ws.serializeAttachment(me);
        if (m.t === 'moo') {
          this.broadcast({ t: 'moo', id: me.id }, ws);
        } else {
          const msg = text(m.text, 120);
          if (msg) this.broadcast({ t: 'chat', id: me.id, text: msg }, ws);
        }
        break;
      }
      case 'stat':
        me.q = int(m.q, 8);
        me.bell = !!m.bell;
        ws.serializeAttachment(me);
        this.broadcast({ t: 'stat', id: me.id, q: me.q, bell: me.bell }, ws);
        break;
    }
  }

  webSocketClose(ws) {
    this.drop(ws);
    try {
      ws.close(1000, 'bye');
    } catch {}
  }

  webSocketError(ws) {
    this.drop(ws);
  }

  drop(ws) {
    const me = ws.deserializeAttachment();
    if (!me?.joined) return;
    me.joined = false;
    try {
      ws.serializeAttachment(me);
    } catch {}
    this.broadcast({ t: 'leave', id: me.id }, ws);
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }

  broadcast(obj, except) {
    const data = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const p = ws.deserializeAttachment();
      if (!p?.joined) continue;
      try {
        ws.send(data);
      } catch {}
    }
  }
}
