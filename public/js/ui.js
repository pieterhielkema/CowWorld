const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// Quest text is written for keyboards; these swaps make it read right on touch screens.
const TOUCH_TEXT = [
  ['(press E next to one)', '(tap USE next to one)'],
  ['MOO at them (Space)', 'MOO at them (the MOO button)'],
  ['Hold Shift to run.', 'Push the stick all the way to run.'],
  ['hold Shift!', 'run flat out!'],
];

export const ui = {
  dialogOpen: false,
  touch: false,

  _fix(text) {
    if (!this.touch || typeof text !== 'string') return text;
    for (const [a, b] of TOUCH_TEXT) text = text.replace(a, b);
    return text;
  },

  toast(text, ms = 3800) {
    const t = $('toast');
    t.textContent = this._fix(text);
    t.classList.add('show');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('show'), ms);
  },

  /** Shows the "E — do thing" prompt, or hides it with null. */
  hint(text) {
    if (text === this._hint) return;
    this._hint = text;
    $('hint').hidden = !text;
    $('btn-act').classList.toggle('ready', !!text);
    if (text) $('hint-text').textContent = text;
  },

  timer(sec) {
    $('timer').hidden = sec == null;
    if (sec != null) $('timer').textContent = '⏱ ' + sec.toFixed(1);
  },

  dialog(name, lines, done) {
    this.dialogOpen = true;
    this._lines = lines;
    this._i = 0;
    this._done = done;
    $('dialog-name').textContent = name;
    $('dialog-text').textContent = this._fix(lines[0]);
    $('dialog').hidden = false;
  },

  advance() {
    if (!this.dialogOpen) return;
    if (++this._i < this._lines.length) {
      $('dialog-text').textContent = this._fix(this._lines[this._i]);
      return;
    }
    this.dialogOpen = false;
    $('dialog').hidden = true;
    const done = this._done;
    this._done = null;
    done?.();
  },

  renderQuests(stars, total, rows) {
    const box = $('quests');
    box.replaceChildren(el('div', 'head', `★ ${stars}/${total} quests`));
    if (!rows.length) {
      box.append(el('div', 'empty', stars === total ? 'Champion Cow! Nothing left to do but moo.' : 'Find someone with a ! over their head.'));
    }
    for (const r of rows) {
      const q = el('div', 'quest' + (r.ready ? ' ready' : ''));
      q.append(el('div', 'title', r.title), el('div', 'task', `${r.task}${r.ready ? '' : ` · ${r.n}/${r.need}`}`));
      box.append(q);
    }
  },

  renderPlayers(online, rows) {
    const box = $('players');
    box.replaceChildren(el('div', 'head', online ? `Herd · ${rows.length} online` : 'Offline · playing solo'));
    for (const r of rows.slice(0, 10)) {
      const p = el('div', 'player' + (r.me ? ' me' : ''));
      const dot = el('span', 'dot');
      dot.style.background = r.css;
      p.append(dot, el('span', 'pname', r.name), el('span', 'stars', `${r.bell ? '🔔 ' : ''}★${r.q}`));
      box.append(p);
    }
  },

  chat(name, text, cls) {
    const log = $('chatlog');
    const line = el('div', 'line ' + (cls || ''));
    if (name) line.append(el('b', null, name + ': '));
    line.append(text);
    log.append(line);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 15000);
  },

  /** A name tag that follows a world position; `say` shows a speech bubble. */
  label(text, cls) {
    const root = el('div', 'label ' + (cls || ''));
    const bubble = el('div', 'bubble');
    const mark = el('span', 'mark');
    const name = el('span', 'lname', text);
    const tag = el('div', 'tag');
    tag.append(mark, name);
    root.append(bubble, tag);
    $('labels').append(root);
    let timer;
    return {
      place(x, y, visible) {
        root.style.display = visible ? '' : 'none';
        if (visible) root.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
      },
      setText(t) {
        if (name.textContent !== t) name.textContent = t;
      },
      setMark(m) {
        if (mark.textContent === m) return;
        mark.textContent = m;
        mark.dataset.m = m;
      },
      say(t, ms = 4000) {
        bubble.textContent = t;
        bubble.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => bubble.classList.remove('show'), ms);
      },
      remove() {
        clearTimeout(timer);
        root.remove();
      },
    };
  },
};
