/** WebSocket link to the farm's Durable Object, with automatic reconnect. */
export class Net {
  /** @param on handlers keyed by message type, plus `status(online)`. */
  constructor(on) {
    this.on = on;
    this.ws = null;
    this.open = false;
    this.retry = 1000;
    setInterval(() => {
      if (this.open) this.ws.send('ping');
    }, 25000);
  }

  /** @param hello function returning the hello message; called again on every reconnect. */
  connect(hello) {
    this.hello = hello;
    const room = new URLSearchParams(location.search).get('room');
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${room ? '?room=' + encodeURIComponent(room) : ''}`;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      this.again();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      this.retry = 1000;
      ws.send(JSON.stringify(hello()));
      this.on.status?.(true);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m && typeof m.t === 'string' && m.t !== 'status') this.on[m.t]?.(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.open = false;
      this.on.status?.(false);
      this.again();
    };
  }

  again() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(this.hello), this.retry);
    this.retry = Math.min(this.retry * 1.8, 15000);
  }

  send(obj) {
    if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
}
