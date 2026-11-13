/* Bureau of Small Tasks — desk, stamping, daily cycle and calendar */
(() => {
  'use strict';

  const STORE_KEY = 'bureau-of-small-tasks:v1';
  const MAX_DESK = 5;
  const SLOT_ORDER = [2, 1, 3, 0, 4]; // fill the middle of the desk first
  const STAMPS = {
    done: { label: 'DONE', key: 'd' },
    delayed: { label: 'DELAYED', key: 'l' },
    denied: { label: 'DENIED', key: 'x' },
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // gentle curve: three DONE stamps earn the first promotion
  const RANKS = [
    { name: 'Junior Clerk', xp: 0 },
    { name: 'Clerk', xp: 30 },
    { name: 'Senior Clerk', xp: 100 },
    { name: 'Inspector', xp: 250 },
    { name: 'Chief Inspector', xp: 500 },
    { name: 'Deputy Director', xp: 900 },
    { name: 'Director of the Bureau', xp: 1500 },
  ];
  // every rank (including the first) lets the clerk requisition one of these for the desk
  const ITEMS = {
    plant: ['Potted plant', 'A bit of green that sways when nobody is looking.'],
    mug: ['Mug of tea', 'Always warm, never empty.'],
    cat: ['Sleeping cat', 'Supervises the paperwork with its eyes closed.'],
    radio: ['Vintage radio', 'Click it for soft, generated ambience.'],
    ink: ['Bureau-blue ink', 'Click the bottle to stamp DONE in blue.'],
    lamp: ['Brass desk lamp', 'A warmer pool of light over the blotter.'],
    cert: ['Framed certificate', 'Proof, in a gold frame, that you work here.'],
  };
  const ACHIEVEMENTS = {
    'first-stamp': ['First Stamp', 'Bringing a stamp down on your very first paper. Every career starts with one thunk.'],
    'quota-met': ['Quota Met', 'Meeting your daily quota. The Bureau noticed, and quietly approved.'],
    'inbox-zero': ['Inbox Zero', 'Clearing the desk and the In-tray completely. A rare and peaceful sight.'],
    'streak-7': ['7-Day Streak', 'Meeting your quota seven days running. Remarkable steadiness.'],
    'papers-100': ['100 Papers Processed', 'Deciding the fate of one hundred papers. The filing cabinets salute you.'],
    'firm-hand': ['A Firm Hand', 'Denying ten papers. Knowing what not to do is half the work.'],
    'on-the-dot': ['On the Dot', 'Finishing five dated papers on time. Punctuality is its own reward, but here is a letter anyway.'],
    'closing-time': ['Closing Time', 'Properly closing the office five times. Rest is part of the job.'],
  };
  // departments the Clerk files into; `words` drive the instant keyword fallback
  const DEPTS = {
    correspondence: { head: 'Dept. of Correspondence', code: 'COR.',
      words: /\b(e-?mails?|reply|respond|call|phone|text|message|letter|write to|inbox|follow up|rsvp|dm)\b/gi },
    errands: { head: 'Errands Desk', code: 'ERR.',
      words: /\b(buy|shop(ping)?|groceries|pick up|clean|laundry|dishes|tidy|post office|return|fix|repair|wash|vacuum|trash|errands?)\b/gi },
    study: { head: 'Office of Study Orders', code: 'STU.',
      words: /\b(study|read|learn|course|lecture|chapter|homework|assignment|revise|exam|notes|tutorial|practi[cs]e|research)\b/gi },
    treasury: { head: 'The Treasury', code: 'TRE.',
      words: /\b(pay|bills?|rent|invoice|tax(es)?|bank|budget|refund|salary|insurance|subscription|money|transfer|expenses?)\b/gi },
    wellbeing: { head: 'Wellbeing Division', code: 'WEL.',
      words: /\b(gym|run|walk|yoga|stretch|meditate|sleep|doctor|dentist|workout|exercise|water|rest|therapy|vitamins|nap)\b/gi },
    meetings: { head: 'Bureau of Meetings', code: 'MTG.',
      words: /\b(meetings?|stand-?up|interview|1:1|sync|zoom|appointment|catch up|presentation|demo|conference|call)\b/gi },
    creative: { head: 'Creative Commissions', code: 'CRE.',
      words: /\b(write|draw|sketch|design|build|code|blog|side project|portfolio|paint|compose|prototype|record|photograph)\b/gi },
  };
  const URGENT_RE = /\b(urgent(ly)?|asap|deadline|immediately|overdue|right now)\b/i;
  const DUPLICATE_AT = 0.88;
  const CHRONO_URL = 'https://cdn.jsdelivr.net/npm/chrono-node@2.7.7/+esm';

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const formNo = (p) => 'No. ' + pad(p.no, 4);
  const tf = (x, y, rot, scale) => `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const dueDay = (p) => (p.due ? dayKey(new Date(p.due)) : null);
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dueSortKey = (p) => {
    const d = new Date(p.due);
    return dayKey(d) + (p.allDay ? ' 00:00' : ` ${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };
  const byDue = (a, b) => (dueSortKey(a) < dueSortKey(b) ? -1 : 1);

  const desk = $('#desk');
  const inTray = $('#in-tray');
  const outTray = $('#out-tray');
  const bin = $('#bin');
  const shredder = $('#shredder');
  const laterEl = $('#later');
  const calendarEl = $('#calendar');
  const agendaEl = $('#agenda');
  const intake = $('#intake');
  const intakeInput = $('#intake-input');

  // ---------- state + storage ----------
  function freshState() {
    return {
      v: 1, profile: null, nextNo: 1, papers: [], muted: false,
      xp: 0, xpDay: { day: '', xp: 0 }, ink: 'classic',
      stats: { stamps: 0, processed: 0, denied: 0, onTime: 0, closes: 0 },
      streak: { count: 0, lastDay: '' }, quotaDays: [], achievements: {}, items: [],
    };
  }

  function normalise(raw) {
    const s = Object.assign(freshState(), raw && typeof raw === 'object' ? raw : {});
    s.papers = (Array.isArray(s.papers) ? s.papers : []).filter(
      (p) => p && typeof p.text === 'string' && typeof p.status === 'string'
    );
    let onDesk = 0;
    const usedSlots = new Set();
    s.papers.forEach((p, i) => {
      if (!p.id) p.id = uid() + i;
      if (!Number.isFinite(p.no)) p.no = s.nextNo++;
      if (!p.filed) p.filed = new Date().toISOString();
      if (p.status === 'desk') {
        const ok = Number.isFinite(p.fx) && Number.isFinite(p.fy) && !usedSlots.has(p.slot);
        if (onDesk >= MAX_DESK || !ok) { p.status = 'tray'; return; }
        onDesk++;
        usedSlots.add(p.slot);
      }
    });
    s.nextNo = Math.max(s.nextNo || 1, ...s.papers.map((p) => p.no + 1), 1);
    if (s.profile && typeof s.profile.name !== 'string') s.profile = null;
    const f = freshState();
    s.xp = Number.isFinite(s.xp) ? s.xp : 0;
    s.xpDay = Object.assign(f.xpDay, s.xpDay);
    s.stats = Object.assign(f.stats, s.stats);
    s.streak = Object.assign(f.streak, s.streak);
    if (!Array.isArray(s.quotaDays)) s.quotaDays = [];
    s.items = (Array.isArray(s.items) ? s.items : []).filter((it, i, a) => ITEMS[it] && a.indexOf(it) === i);
    if (!s.achievements || typeof s.achievements !== 'object') s.achievements = {};
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return normalise(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return freshState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable or full: the desk still works for this visit */ }
    renderAgenda(); // every change to the papers passes through here
  }

  let state = load();
  const els = new Map();      // paper id -> element on the desk
  const busy = new Set();     // paper ids mid-animation
  const dragging = new Set(); // paper ids being dragged
  let selectedId = null;
  let zTop = 10;

  const byId = (id) => state.papers.find((p) => p.id === id);
  const deskPapers = () => state.papers.filter((p) => p.status === 'desk');
  const trayPapers = () => state.papers.filter((p) => p.status === 'tray');

  // ---------- sound (Web Audio, all synthesized) ----------
  const sfx = (() => {
    let ctx = null;
    function ac() {
      if (state.muted) return null;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (e) { return null; }
    }
    function noise(c, dur) {
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      return src;
    }
    function envelope(c, peak, attack, dur) {
      const g = c.createGain();
      const t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(c.destination);
      return g;
    }
    return {
      ctx: ac,
      noise,
      fanfare() {
        const c = ac(); if (!c) return;
        [784, 987.8, 1174.7, 1568].forEach((freq, i) => {
          const t = c.currentTime + i * 0.13;
          const o = c.createOscillator();
          o.type = 'triangle'; o.frequency.value = freq;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.85);
        });
      },
      thunk() {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
        o.connect(envelope(c, 0.55, 0.005, 0.24));
        o.start(t); o.stop(t + 0.26);
        const n = noise(c, 0.1);
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        n.connect(f); f.connect(envelope(c, 0.3, 0.003, 0.09));
        n.start(t);
      },
      slide(level = 0.07) {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const n = noise(c, 0.4);
        const f = c.createBiquadFilter();
        f.type = 'bandpass'; f.Q.value = 0.7;
        f.frequency.setValueAtTime(1700, t);
        f.frequency.exponentialRampToValueAtTime(3600, t + 0.32);
        n.connect(f); f.connect(envelope(c, level, 0.09, 0.36));
        n.start(t);
      },
      shred() {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const dur = 1.1;
        const out = envelope(c, 0.09, 0.08, dur);
        const trem = c.createGain();
        trem.gain.value = 0.7;
        const lfo = c.createOscillator();
        lfo.type = 'square'; lfo.frequency.value = 34;
        const lfoGain = c.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain); lfoGain.connect(trem.gain);
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = 82;
        const of = c.createBiquadFilter();
        of.type = 'lowpass'; of.frequency.value = 500;
        o.connect(of); of.connect(trem);
        const n = noise(c, dur);
        const nf = c.createBiquadFilter();
        nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 0.6;
        n.connect(nf); nf.connect(trem);
        trem.connect(out);
        o.start(t); lfo.start(t); n.start(t);
        o.stop(t + dur); lfo.stop(t + dur);
      },
      bell() {
        const c = ac(); if (!c) return;
        [1760, 2637, 3520].forEach((freq, i) => {
          const t = c.currentTime;
          const o = c.createOscillator();
          o.type = 'sine'; o.frequency.value = freq;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 1.6);
        });
      },
      print() {
        const c = ac(); if (!c) return;
        for (let i = 0; i < 12; i++) {
          const t = c.currentTime + 0.1 + i * 0.1;
          const n = noise(c, 0.05);
          const f = c.createBiquadFilter();
          f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.05, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          n.connect(f); f.connect(g); g.connect(c.destination);
          n.start(t);
        }
      },
      chime() {
        const c = ac(); if (!c) return;
        [1046.5, 1568].forEach((freq, i) => {
          const t = c.currentTime + i * 0.09;
          const o = c.createOscillator();
          o.type = 'sine'; o.frequency.value = freq;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.95);
        });
      },
    };
  })();

  // ---------- geometry ----------
  // The desk is laid out at a logical size and scaled by S to fit the screen (see fit()).
  // Everything positioned inside the desk works in logical pixels.
  let S = 1;
  let layout = '';
  function deskRect(el) {
    const r = el.getBoundingClientRect();
    const d = desk.getBoundingClientRect();
    return { left: (r.left - d.left) / S, top: (r.top - d.top) / S, width: r.width / S, height: r.height / S };
  }
  function centerOf(el) {
    const r = deskRect(el);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  // where each of the five desk slots sits, as fractions of the desk
  const PHONE_SLOTS = [[0.28, 0.41], [0.72, 0.42], [0.5, 0.51], [0.28, 0.61], [0.72, 0.615]];
  function slotPos(slot) {
    const [fx, fy] = layout === 'phone' ? PHONE_SLOTS[slot]
      : [0.25 + slot * 0.125, slot % 2 ? 0.57 : 0.41];
    return { fx: fx + rand(-0.01, 0.01), fy: fy + rand(-0.012, 0.012) };
  }

  // choose a layout from the screen's shape, then scale the desk so that layout always has room
  const LAYOUTS = {
    wide: { w: 1100, h: 640, max: 1 },
    square: { w: 700, h: 700, max: 1 },
    phone: { w: 400, h: 780, max: 1.4 },
  };
  let lastFit = { w: 0, h: 0 };
  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    // an on-screen keyboard only shortens the window: keep the desk as it is while typing
    const typing = document.activeElement && document.activeElement.matches('input, textarea');
    if (typing && w === lastFit.w && h < lastFit.h) return;
    lastFit = { w, h };
    const ratio = w / h;
    const name = ratio >= 1.25 ? 'wide' : ratio >= 0.8 ? 'square' : 'phone';
    const L = LAYOUTS[name];
    S = Math.min(w / L.w, h / L.h, L.max);
    desk.style.width = w / S + 'px';
    desk.style.height = h / S + 'px';
    desk.style.transform = `scale(${S})`;
    if (name !== layout) {
      if (layout) desk.classList.remove('layout-' + layout);
      desk.classList.add('layout-' + name);
      layout = name;
    }
    if (state.layout !== name) {
      // the desk changed shape: lay the papers out afresh
      deskPapers().forEach((p) => Object.assign(p, slotPos(p.slot)));
      state.layout = name;
      save();
    }
    deskPapers().forEach(place);
  }
  // transform that puts a paper element's centre at (cx, cy)
  function tfCentered(el, cx, cy, rot, scale) {
    return tf(cx - el.offsetWidth / 2, cy - el.offsetHeight / 2, rot, scale);
  }
  function deskXY(p) {
    const el = els.get(p.id);
    return {
      x: p.fx * desk.clientWidth - el.offsetWidth / 2,
      y: p.fy * desk.clientHeight - el.offsetHeight / 2,
    };
  }
  function place(p) {
    const el = els.get(p.id);
    if (!el) return;
    const { x, y } = deskXY(p);
    const sel = selectedId === p.id;
    el.classList.toggle('selected', sel);
    el.style.transform = tf(x, y - (sel ? 8 : 0), sel ? p.rot * 0.35 : p.rot, sel ? 1.07 : 1);
  }
  function isOver(target, ev) {
    const r = target.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  }

  // ---------- paper elements ----------
  function fmtDate(iso) {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function addInk(el, stamp) {
    const ink = document.createElement('div');
    ink.className = 'ink';
    ink.dataset.type = stamp.type;
    ink.textContent = STAMPS[stamp.type].label;
    ink.style.left = stamp.ix * 100 + '%';
    ink.style.top = stamp.iy * 100 + '%';
    ink.style.translate = '-50% -50%';
    ink.style.rotate = stamp.angle + 'deg';
    el.appendChild(ink);
  }

  function makePaperEl(p) {
    const el = document.createElement('article');
    el.className = 'paper';
    el.dataset.id = p.id;

    const head = document.createElement('header');
    head.className = 'paper-head';
    const no = document.createElement('span');
    no.textContent = 'Form ' + formNo(p);
    const dept = document.createElement('span');
    dept.className = 'p-dept';
    head.append(no, dept);

    const letterhead = document.createElement('div');
    letterhead.className = 'paper-letterhead';
    letterhead.textContent = 'Bureau of Small Tasks';

    const text = document.createElement('p');
    text.className = 'paper-text';
    text.textContent = p.text;

    const foot = document.createElement('footer');
    foot.className = 'paper-foot';
    foot.append(h('div', '', 'Filed ' + fmtDate(p.filed)), h('div', 'paper-tag'));

    el.appendChild(h('div', 'urgent-stripe', 'Urgent'));
    if (p.due) {
      // dated papers are small appointment slips
      el.classList.add('slip');
      el.append(head, h('div', 'slip-when', whenLabel(p)), text, foot);
    } else {
      el.append(head, letterhead, text, foot);
    }
    els.set(p.id, el);
    decorate(p);
    if (p.stamp) addInk(el, p.stamp);
    el.style.zIndex = ++zTop;
    el.addEventListener('pointerdown', (e) => paperPointerDown(e, p));
    desk.appendChild(el);
    els.set(p.id, el);
    return el;
  }

  // urgent: says so in words, or falls due within 24 hours
  function isUrgent(p) {
    if (p.urgentWord) return true;
    if (!p.due) return false;
    return p.allDay ? dueDay(p) <= dayKey() : new Date(p.due) - Date.now() < 24 * 3600 * 1000;
  }

  // department tint + letterhead, the Clerk's tag, the urgent stripe and the pencilled note
  function decorate(p) {
    const el = els.get(p.id);
    if (!el) return;
    const d = DEPTS[p.dept];
    el.dataset.dept = d ? p.dept : '';
    el.querySelector('.p-dept').textContent = p.due ? 'APPT.' : (d ? d.code : 'B.S.T.');
    const lh = el.querySelector('.paper-letterhead');
    if (lh) lh.textContent = d ? d.head : 'Bureau of Small Tasks';
    el.querySelector('.paper-tag').textContent = !d ? ''
      : p.deptBy === 'clerk' ? `filed by the Clerk · ${Number(p.deptScore).toFixed(2)}`
        : 'filed by keyword';
    el.classList.toggle('urgent', isUrgent(p));
    let note = el.querySelector('.paper-note');
    if (p.similarTo) {
      if (!note) {
        note = h('button', 'paper-note');
        note.type = 'button';
        note.addEventListener('pointerdown', (e) => e.stopPropagation());
        note.addEventListener('click', (e) => { e.stopPropagation(); pointToSimilar(p); });
        el.appendChild(note);
      }
      note.textContent = `similar to No. ${pad(p.similarTo, 4)}?`;
    } else if (note) {
      note.remove();
    }
  }

  // clicking the pencilled note briefly shows where the look-alike is
  function pointToSimilar(p) {
    const other = state.papers.find((q) => q.no === p.similarTo);
    const el = other && els.get(other.id);
    if (el && other.status === 'desk') {
      el.style.zIndex = ++zTop;
      el.classList.remove('glow');
      void el.offsetWidth;
      el.classList.add('glow');
      setTimeout(() => el.classList.remove('glow'), 1700);
    } else if (other && other.status === 'tray') nudge(inTray);
    else if (other && other.status === 'delayed') nudge(laterEl);
    else if (other && (other.status === 'scheduled' || other.status === 'post')) nudge(calendarEl);
    else if (other) nudge(outTray);
    else { delete p.similarTo; save(); decorate(p); }
  }

  function removePaperEl(p) {
    const el = els.get(p.id);
    if (el) el.remove();
    els.delete(p.id);
    busy.delete(p.id);
    dragging.delete(p.id);
  }

  // a blank sheet that flies between two desk objects
  async function flySheet(fromEl, toEl, slip) {
    const el = document.createElement('div');
    el.className = 'paper ghost no-anim' + (slip ? ' slip' : '');
    el.style.zIndex = ++zTop;
    desk.appendChild(el);
    const a = centerOf(fromEl), b = centerOf(toEl);
    el.style.opacity = '0';
    el.style.transform = tfCentered(el, a.x, a.y, 0, 0.35);
    void el.offsetWidth;
    el.classList.remove('no-anim');
    el.style.opacity = '1';
    el.style.transform = tfCentered(el, b.x, b.y, rand(-5, 5), 0.6);
    await wait(560);
    el.remove();
  }

  // ---------- trays ----------
  const SHEET_ROT = [-3, 2.5, -1, 4];
  function renderStack(stackEl, countEl, n) {
    const want = Math.min(n, SHEET_ROT.length);
    while (stackEl.children.length > want) stackEl.lastChild.remove();
    while (stackEl.children.length < want) {
      const s = document.createElement('div');
      s.className = 'sheet';
      const i = stackEl.children.length;
      s.style.transform = `translate(${i * 1.5}px, ${-i * 2}px) rotate(${SHEET_ROT[i]}deg)`;
      stackEl.appendChild(s);
    }
    countEl.textContent = n ? String(n) : '';
  }
  function renderTrays() {
    const today = dayKey();
    renderStack($('#in-stack'), $('#in-count'), trayPapers().length);
    renderStack($('#out-stack'), $('#out-count'),
      state.papers.filter((p) => p.status === 'done' && p.stampedOn === today).length);
    renderStack($('#later-stack'), $('#later-count'),
      state.papers.filter((p) => p.status === 'delayed').length);
  }

  // ---------- desk flow ----------
  function freeSlot() {
    const used = new Set(deskPapers().map((p) => p.slot));
    return SLOT_ORDER.find((s) => !used.has(s));
  }

  // move a waiting paper onto the desk, sliding in from `originEl`
  function toDesk(p, originEl) {
    const slot = freeSlot();
    if (slot === undefined) return false;
    p.status = 'desk';
    p.slot = slot;
    Object.assign(p, slotPos(slot));
    p.rot = rand(-5, 5);
    p.stamp = null;
    const el = makePaperEl(p);
    const o = centerOf(originEl);
    el.classList.add('no-anim');
    el.style.opacity = '0';
    el.style.transform = tfCentered(el, o.x, o.y, 0, 0.35);
    void el.offsetWidth;
    el.classList.remove('no-anim');
    el.style.opacity = '1';
    place(p);
    sfx.slide();
    return true;
  }

  function nudge(el) {
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
  }

  // clicking the In-tray takes the next waiting paper onto the desk
  inTray.addEventListener('click', () => {
    const next = trayPapers()[0];
    if (!next || !toDesk(next, inTray)) { nudge(inTray); return; }
    renderTrays();
    save();
  });

  // ---------- dates (chrono-node, loaded from a CDN; the desk works without it) ----------
  let chrono = null;
  import(CHRONO_URL)
    .then((m) => { chrono = m.parse ? m : m.default; })
    .catch(() => { /* offline: tasks are simply filed undated */ });

  // lone words that are far more often ordinary English than a date
  const AMBIGUOUS = /^(sun|sat|wed|mar|march|may|jan|dec|now|second|seconds)$/;

  function parseWhen(raw) {
    if (!chrono) return null;
    let res;
    try { res = chrono.parse(raw, new Date(), { forwardDate: true }); } catch (e) { return null; }
    const r = res && res[0];
    if (!r || AMBIGUOUS.test(r.text.trim())) return null;
    const due = r.start.date();
    const allDay = !r.start.isCertain('hour');
    if (dayKey(due) < dayKey()) return null; // dates in the past are just part of the wording
    let text = (raw.slice(0, r.index) + ' ' + raw.slice(r.index + r.text.length))
      .replace(/\s+/g, ' ').trim()
      .replace(/\s*\b(on|at|by|due|for|this|next|before|until|@)$/i, '')
      .replace(/^(on|at|by)\s+/i, '')
      .replace(/[\s,:;–-]+$/, '').trim();
    if (!text) text = raw;
    return { text, due, allDay };
  }

  function whenLabel(p) {
    const d = new Date(p.due);
    const day = `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return p.allDay ? day : `${day} · ${fmtTime(d)}`;
  }

  // new paperwork lands in the In-tray; papers dated for a later day wait in the calendar
  function fileTask(raw) {
    const when = parseWhen(raw);
    const p = {
      id: uid(), no: state.nextNo++, text: when ? when.text : raw,
      filed: new Date().toISOString(), status: 'tray', stamp: null,
    };
    if (when) {
      p.due = when.due.toISOString();
      p.allDay = when.allDay;
      if (dayKey(when.due) > dayKey()) p.status = 'scheduled';
    }
    if (URGENT_RE.test(raw)) p.urgentWord = true;
    state.papers.push(p);
    clerk.file(p, true);
    save();
    sfx.slide();
    if (p.status === 'scheduled') {
      flySheet(intake, calendarEl, true).then(() => nudge(calendarEl));
    } else {
      flySheet(intake, inTray, !!when).then(renderTrays);
    }
  }

  // ---------- today's appointments, clipped to the top edge ----------
  let agendaSig = '';
  function renderAgenda() {
    const today = dayKey();
    // urgent papers are pinned up first, then today's appointments in time order
    const rank = (p) => (isUrgent(p) ? '0' : '1') + (p.due ? dueSortKey(p) : '');
    const items = state.papers
      .filter((p) => (p.status === 'tray' || p.status === 'desk') &&
        ((p.due && dueDay(p) <= today) || isUrgent(p)))
      .sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
    const sig = items.map((p) => p.id + (isUrgent(p) ? '!' : '')).join(',');
    if (sig === agendaSig) return;
    agendaSig = sig;
    agendaEl.textContent = '';
    items.slice(0, 3).forEach((p, i) => {
      const b = h('button', 'clip-slip' + (isUrgent(p) ? ' pinned' : ''));
      b.type = 'button';
      b.title = 'Bring this to the desk';
      b.style.setProperty('--r', [-2, 1.5, -1][i] + 'deg');
      const d = p.due ? new Date(p.due) : null;
      const label = !d ? 'Urgent'
        : dueDay(p) < today ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : (p.allDay ? 'Today' : fmtTime(d));
      b.append(h('b', '', label), h('span', '', p.text));
      b.addEventListener('click', () => fetchPaper(p));
      agendaEl.appendChild(b);
    });
    if (items.length > 3) agendaEl.appendChild(h('div', 'clip-more', '+' + (items.length - 3)));
  }

  // bring a specific paper onto the desk and pick it up
  function fetchPaper(p) {
    if (p.status === 'tray') {
      if (!toDesk(p, inTray)) { nudge(inTray); return; }
      renderTrays();
      save();
    }
    if (p.status === 'desk') select(p.id);
  }

  // ---------- selecting + dragging papers ----------
  function select(id) {
    const prev = selectedId;
    selectedId = id;
    if (prev && prev !== id) { const q = byId(prev); if (q) place(q); }
    if (id) {
      const p = byId(id);
      els.get(id).style.zIndex = ++zTop;
      place(p);
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      sfx.slide(0.03);
    }
  }

  function paperPointerDown(e, p) {
    if (e.button !== 0 || p.status !== 'desk' || busy.has(p.id)) return;
    const el = els.get(p.id);
    const start = { x: e.clientX, y: e.clientY };
    const origin = deskXY(p);
    let dx = 0, dy = 0, moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    const move = (ev) => {
      dx = (ev.clientX - start.x) / S;
      dy = (ev.clientY - start.y) / S;
      if (!moved && Math.hypot(dx, dy) > 6) {
        if (busy.has(p.id)) return;
        moved = true;
        dragging.add(p.id);
        el.classList.add('dragging');
        el.style.zIndex = ++zTop;
      }
      if (moved) {
        el.style.transform = tf(origin.x + dx, origin.y + dy, p.rot * 0.35, 1.07);
        bin.classList.toggle('hot', isOver(bin, ev));
      }
    };
    const up = (ev) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      bin.classList.remove('hot');
      if (!moved) {
        if (ev.type === 'pointerup' && !busy.has(p.id)) select(selectedId === p.id ? null : p.id);
        return;
      }
      dragging.delete(p.id);
      el.classList.remove('dragging');
      if (ev.type === 'pointerup' && isOver(bin, ev)) { binPaper(p); return; }
      p.fx = clamp((origin.x + dx + el.offsetWidth / 2) / desk.clientWidth, 0.07, 0.93);
      p.fy = clamp((origin.y + dy + el.offsetHeight / 2) / desk.clientHeight, 0.14, 0.86);
      place(p);
      save();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ---------- bin + undo ----------
  let undo = null; // { paper, index, timer }

  function binPaper(p) {
    if (selectedId === p.id) selectedId = null;
    const el = els.get(p.id);
    busy.add(p.id);
    const c = centerOf(bin);
    el.classList.remove('selected');
    el.style.transform = tfCentered(el, c.x, c.y, rand(-50, 50), 0.1);
    el.style.opacity = '0';
    sfx.slide();
    const index = state.papers.indexOf(p);
    state.papers.splice(index, 1);
    save();
    setTimeout(() => removePaperEl(p), 480);
    showUndo(p, index);
  }

  function showUndo(p, index) {
    hideUndo();
    const note = $('#undo-note');
    $('#undo-text').textContent = `${formNo(p)} binned.`;
    note.hidden = false;
    undo = { paper: p, index, timer: setTimeout(hideUndo, 5000) };
  }
  function hideUndo() {
    if (undo) clearTimeout(undo.timer);
    undo = null;
    $('#undo-note').hidden = true;
  }
  $('#undo-btn').addEventListener('click', () => {
    if (!undo) return;
    const { paper, index } = undo;
    hideUndo();
    paper.status = 'tray';
    state.papers.splice(Math.min(index, state.papers.length), 0, paper);
    if (!toDesk(paper, bin)) {
      flySheet(bin, inTray).then(renderTrays);
    }
    save();
  });

  // ---------- stamping ----------
  function makeStampHead(type) {
    const head = document.createElement('div');
    head.className = 'stamp-head';
    head.dataset.type = type;
    const knob = document.createElement('span');
    knob.className = 'stamp-knob';
    head.appendChild(knob);
    return head;
  }

  function shake() {
    desk.classList.remove('shake');
    void desk.offsetWidth;
    desk.classList.add('shake');
  }

  async function stamp(p, type, at) {
    if (!p || p.status !== 'desk' || busy.has(p.id) || dragging.has(p.id)) return;
    busy.add(p.id);
    const el = els.get(p.id);

    // the decision is recorded straight away, so a reload mid-animation loses nothing
    p.stamp = {
      type,
      angle: rand(-13, 13),
      ix: at ? at.ix : rand(0.42, 0.6),
      iy: at ? at.iy : rand(0.56, 0.7),
      at: Date.now(),
    };
    p.status = type;
    p.stampedOn = dayKey();
    const earned = award(p);
    save();

    // slam
    const r = deskRect(el);
    const head = makeStampHead(type);
    head.classList.add('slam');
    head.style.left = r.left + r.width * p.stamp.ix + 'px';
    head.style.top = r.top + r.height * p.stamp.iy + 'px';
    desk.appendChild(head);
    await wait(165);
    addInk(el, p.stamp);
    sfx.thunk();
    shake();
    if (earned.xp) {
      const pop = h('div', 'xp-pop', `+${earned.xp} XP`);
      pop.style.left = head.style.left;
      pop.style.top = parseFloat(head.style.top) - 30 + 'px';
      desk.appendChild(pop);
      setTimeout(() => pop.remove(), 1300);
    }
    renderRank();
    renderCalendar();
    if (earned.rankUp >= 0) setTimeout(() => promote(earned.rankUp), 900);
    if (selectedId === p.id) { selectedId = null; place(p); }
    await wait(560);
    head.remove();

    // send the paper on its way
    el.style.zIndex = ++zTop;
    if (type === 'done') {
      const c = centerOf(outTray);
      el.style.transform = tfCentered(el, c.x, c.y, rand(-6, 6), 0.6);
      sfx.slide();
      await wait(560);
      removePaperEl(p);
      renderTrays();
      sfx.chime();
    } else if (type === 'delayed') {
      const c = centerOf(laterEl);
      el.style.transform = tfCentered(el, c.x, c.y, rand(-4, 8), 0.42);
      sfx.slide();
      await wait(560);
      removePaperEl(p);
      renderTrays();
    } else {
      await shred(p, el);
    }
  }

  async function shred(p, el) {
    const slot = $('.shred-slot');
    const sr = deskRect(slot);
    const w = el.offsetWidth, h = el.offsetHeight;
    const s = Math.min(0.5, (sr.width * 0.9) / w); // narrow enough to go through the slot
    const x = sr.left + sr.width / 2 - w / 2;
    // bottom edge of the scaled paper rests on the slot
    const y = sr.top + sr.height / 2 - h * s - (h * (1 - s)) / 2;
    el.style.transform = tf(x, y, 0, s);
    sfx.slide();
    await wait(600);

    shredder.classList.add('on');
    sfx.shred();
    const strips = $('#shred-strips');
    for (let i = 0; i < 10; i++) {
      const st = document.createElement('i');
      st.className = 'strip';
      st.style.animationDelay = rand(0.05, 0.3) + 's';
      strips.appendChild(st);
      setTimeout(() => st.remove(), 2100);
    }
    const anim = el.animate(
      [
        { transform: tf(x, y, 0, s), clipPath: 'inset(0 0 0 0)' },
        { transform: tf(x, y + h * s, 0, s), clipPath: 'inset(0 0 100% 0)' },
      ],
      { duration: 1050, easing: 'linear', fill: 'forwards' }
    );
    try { await anim.finished; } catch (e) { /* cancelled */ }
    removePaperEl(p);
    shredder.classList.remove('on');
  }

  // dragging a stamp off the rack (a plain click stamps the picked-up paper)
  document.querySelectorAll('#stamp-rack .stamp').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const type = btn.dataset.type;
      const start = { x: e.clientX, y: e.clientY };
      let head = null;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

      const move = (ev) => {
        if (!head && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) {
          head = makeStampHead(type);
          head.classList.add('dragged');
          desk.appendChild(head);
          btn.classList.add('away');
        }
        if (head) {
          const d = desk.getBoundingClientRect();
          head.style.left = (ev.clientX - d.left) / S + 'px';
          head.style.top = (ev.clientY - d.top) / S + 'px';
        }
      };
      const up = (ev) => {
        btn.removeEventListener('pointermove', move);
        btn.removeEventListener('pointerup', up);
        btn.removeEventListener('pointercancel', up);
        btn.classList.remove('away');
        if (!head) {
          if (ev.type === 'pointerup' && selectedId) stamp(byId(selectedId), type);
          return;
        }
        head.remove();
        if (ev.type !== 'pointerup') return;
        const hit = document.elementsFromPoint(ev.clientX, ev.clientY)
          .find((n) => n.classList && n.classList.contains('paper') && n.dataset.id);
        const p = hit && byId(hit.dataset.id);
        if (!p) return;
        const r = hit.getBoundingClientRect();
        stamp(p, type, {
          ix: clamp((ev.clientX - r.left) / r.width, 0.3, 0.7),
          iy: clamp((ev.clientY - r.top) / r.height, 0.3, 0.8),
        });
      };
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    });
  });

  // ---------- keyboard + desk clicks ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      select(null); closeSettings(); closeLedger(); closePlanner(); closeReport(); closeChoice(); closeParcel();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof Element && e.target.matches('input, textarea')) return;
    const k = e.key.toLowerCase();
    const type = Object.keys(STAMPS).find((t) => STAMPS[t].key === k);
    if (type && selectedId) {
      e.preventDefault();
      stamp(byId(selectedId), type);
    }
  });

  desk.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest('.paper, .stamp')) select(null);
    if (!t.closest('#settings, #gear')) closeSettings();
  });

  // ---------- intake ----------
  intake.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = intakeInput.value.trim().replace(/\s+/g, ' ');
    if (!text || !state.profile) return;
    intakeInput.value = '';
    fileTask(text);
  });

  // ---------- settings ----------
  const settings = $('#settings');
  const gear = $('#gear');
  const muteBtn = $('#mute-btn');
  const resetBtn = $('#reset-btn');
  let resetArmed = null;

  function closeSettings() {
    settings.hidden = true;
    gear.setAttribute('aria-expanded', 'false');
    disarmReset();
  }
  function disarmReset() {
    clearTimeout(resetArmed);
    resetArmed = null;
    resetBtn.textContent = 'Reset desk';
  }
  function renderMute() {
    muteBtn.textContent = 'Sound: ' + (state.muted ? 'off' : 'on');
  }

  gear.addEventListener('click', () => {
    const open = settings.hidden;
    settings.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
    if (!open) disarmReset();
  });

  settings.addEventListener('click', (e) => {
    const btn = e.target instanceof Element && e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'export') {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bureau-backup-${dayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (act === 'import') {
      $('#import-file').click();
    } else if (act === 'send') {
      closeSettings();
      openSend();
    } else if (act === 'mute') {
      state.muted = !state.muted;
      save();
      renderMute();
      if (state.muted) radio.stop(); else sfx.chime();
    } else if (act === 'reset') {
      if (!resetArmed) {
        resetBtn.textContent = 'Clear everything? Click again';
        resetArmed = setTimeout(disarmReset, 4000);
        return;
      }
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      state = freshState();
      closeSettings();
      rebuild();
    }
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.papers)) throw new Error('not a Bureau backup');
      state = normalise(data);
      save();
      closeSettings();
      rebuild();
      sfx.chime();
    } catch (err) {
      const prev = btnText('import');
      setBtnText('import', 'Not a valid backup');
      setTimeout(() => setBtnText('import', prev), 2500);
    }
  });
  const actBtn = (act) => settings.querySelector(`button[data-act="${act}"]`);
  const btnText = (act) => actBtn(act).textContent;
  const setBtnText = (act, t) => { actBtn(act).textContent = t; };

  // ---------- welcome letter ----------
  const welcome = $('#welcome');
  $('#welcome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#w-name').value.trim();
    if (!name) return;
    const quota = clamp(parseInt($('#w-quota').value, 10) || 5, 1, 20);
    state.profile = { name, quota };
    state.lastPost = dayKey(); // no post on the very first morning
    save();
    renderNameplate();
    renderRank();
    sfx.chime();
    welcome.classList.add('leaving');
    setTimeout(() => {
      welcome.hidden = true;
      welcome.classList.remove('leaving');
      intakeInput.focus();
      if (pendingParcel) openReceive(); else openChoice(); // a waiting parcel, or the first requisition
    }, 500);
  });

  // ---------- render ----------
  function renderNameplate() {
    $('#np-name').textContent = state.profile ? state.profile.name : ' ';
  }
  function renderCalendar() {
    const d = new Date();
    $('#cal-month').textContent = MONTHS[d.getMonth()];
    $('#cal-day').textContent = d.getDate();
    $('#cal-weekday').textContent = WEEKDAYS[d.getDay()];
    renderTally();
  }

  // ---------- ledger: records (Out-tray) and the Later pile ----------
  const ledger = $('#ledger');
  const LEDGERS = {
    records: {
      title: 'Register of Decisions',
      sub: 'Everything stamped done or denied. Changed your mind? Reopen it.',
      empty: 'Nothing on record yet. Stamp something.',
      action: 'Reopen',
      match: (p) => p.status === 'done' || p.status === 'denied',
    },
    later: {
      title: 'Set Aside for Later',
      sub: 'Delayed papers wait here until you want them back.',
      empty: 'Nothing is waiting. A tidy conscience.',
      action: 'Bring back',
      match: (p) => p.status === 'delayed',
    },
  };
  let ledgerKind = null;

  function renderLedger() {
    const cfg = LEDGERS[ledgerKind];
    $('#ledger-title').textContent = cfg.title;
    $('#ledger-sub').textContent = cfg.sub;
    const list = $('#ledger-list');
    list.textContent = '';
    const rows = state.papers.filter(cfg.match)
      .sort((a, b) => ((b.stamp && b.stamp.at) || 0) - ((a.stamp && a.stamp.at) || 0));
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = cfg.empty;
      list.appendChild(li);
      return;
    }
    rows.forEach((p) => {
      const li = document.createElement('li');
      const no = document.createElement('span');
      no.className = 'l-no';
      no.textContent = pad(p.no, 4);
      const text = document.createElement('span');
      text.className = 'l-text';
      text.textContent = p.text;
      const when = document.createElement('small');
      when.textContent = p.stamp && p.stamp.at ? 'stamped ' + fmtDate(p.stamp.at) : '';
      text.appendChild(when);
      const mark = document.createElement('span');
      mark.className = 'l-mark ' + p.status;
      mark.textContent = STAMPS[p.status].label;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = cfg.action;
      btn.addEventListener('click', () => reopen(p));
      li.append(no, text, mark, btn);
      list.appendChild(li);
    });
  }

  // send a stamped paper back to the In-tray, unstamped
  function reopen(p) {
    p.status = 'tray';
    p.stamp = null;
    delete p.stampedOn;
    delete p.returnOn;
    save();
    sfx.slide();
    renderTrays();
    renderLedger();
  }

  function openLedger(kind) {
    ledgerKind = kind;
    renderLedger();
    ledger.hidden = false;
    select(null);
  }
  function closeLedger() {
    ledger.hidden = true;
    ledgerKind = null;
  }
  outTray.addEventListener('click', () => openLedger('records'));
  laterEl.addEventListener('click', () => openLedger('later'));
  $('#ledger-close').addEventListener('click', closeLedger);
  ledger.addEventListener('pointerdown', (e) => { if (e.target === ledger) closeLedger(); });

  // ---------- the Clerk: in-browser filing (clerk-worker.js) with a keyword stand-in ----------
  const UNFINISHED = ['desk', 'tray', 'delayed', 'scheduled', 'post'];
  const wordCount = (t) => t.trim().split(/\s+/).length;

  function keywordFile(p) {
    let best = 'errands', top = 0;
    Object.keys(DEPTS).forEach((key) => {
      const n = (p.text.match(DEPTS[key].words) || []).length;
      if (n > top) { top = n; best = key; }
    });
    p.dept = best;
    p.deptBy = 'keywords';
    delete p.deptScore;
  }

  const clerk = (() => {
    const statusEl = $('#np-clerk');
    const vecs = new Map();   // paper id -> embedding (kept in memory only)
    const fresh = new Set();  // papers filed this visit, still owed a duplicate check
    let worker = null;
    let ready = false;
    let hideTimer = null;

    function say(text, lingerMs) {
      clearTimeout(hideTimer);
      statusEl.textContent = text;
      statusEl.hidden = false;
      if (lingerMs) hideTimer = setTimeout(() => { statusEl.hidden = true; }, lingerMs);
    }
    function send(papers) {
      if (ready && papers.length) {
        worker.postMessage({ type: 'file', items: papers.map((p) => ({ id: p.id, text: p.text })) });
      }
    }
    function away() {
      if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } }
      worker = null;
      ready = false;
      say('the Clerk is away · filing by keyword', 6000);
    }

    // similar open paper? pencil a note. Only for tasks of three words or more.
    function duplicateCheck(p) {
      const mine = vecs.get(p.id);
      if (!mine || wordCount(p.text) < 3) return;
      let best = null, top = DUPLICATE_AT;
      state.papers.forEach((q) => {
        const theirs = vecs.get(q.id);
        if (q === p || !theirs || !UNFINISHED.includes(q.status) || wordCount(q.text) < 3) return;
        let s = 0;
        for (let i = 0; i < mine.length; i++) s += mine[i] * theirs[i];
        if (s > top) { top = s; best = q; }
      });
      if (best) p.similarTo = best.no;
    }

    function onMessage(e) {
      const msg = e.data || {};
      if (msg.type === 'ready') {
        ready = true;
        say('the Clerk is in', 4000);
        send(state.papers.filter((p) => UNFINISHED.includes(p.status)));
      } else if (msg.type === 'filed') {
        const p = byId(msg.id);
        if (!p) return;
        vecs.set(p.id, Float32Array.from(msg.vec));
        p.dept = msg.dept;
        p.deptScore = Math.round(msg.score * 100) / 100;
        p.deptBy = 'clerk';
        if (fresh.delete(p.id)) duplicateCheck(p);
        save();
        decorate(p);
      } else if (msg.type === 'error') {
        away();
      }
    }

    return {
      start() {
        say('the Clerk is arriving…');
        try {
          worker = new Worker('clerk-worker.js', { type: 'module' });
          worker.onmessage = onMessage;
          worker.onerror = away;
        } catch (e) { away(); }
      },
      // file one paper: keywords at once, the model's verdict when it is in
      file(p, isNew) {
        if (!p.dept) keywordFile(p);
        if (isNew) fresh.add(p.id);
        send([p]);
      },
      // after a reset or an imported backup: start the filing over
      refile() {
        vecs.clear();
        fresh.clear();
        send(state.papers.filter((p) => UNFINISHED.includes(p.status)));
      },
    };
  })();

  // ---------- XP, ranks, streak, achievements ----------
  const rankIndex = (xp) => RANKS.reduce((best, r, i) => (xp >= r.xp ? i : best), 0);
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }
  // the streak only counts while it is unbroken
  function streakNow() {
    const s = state.streak;
    return s.lastDay === dayKey() || s.lastDay === yesterdayKey() ? s.count : 0;
  }
  function earn(id) {
    if (!state.achievements[id]) state.achievements[id] = { on: dayKey(), delivered: false };
  }

  // called once a paper has just been stamped; no penalties, and no double pay for re-stamping
  function award(p) {
    const before = rankIndex(state.xp);
    const today = dayKey();
    const gain = xpFor(p);
    const delta = Math.max(0, gain - (p.xp || 0));
    p.xp = Math.max(p.xp || 0, gain);
    state.xp += delta;
    if (state.xpDay.day !== today) state.xpDay = { day: today, xp: 0 };
    state.xpDay.xp += delta;

    const st = state.stats;
    st.stamps++;
    if (!p.counted && (p.status === 'done' || p.status === 'denied')) {
      p.counted = true;
      st.processed++;
      if (p.status === 'denied') st.denied++;
      if (gain === 15) st.onTime++;
    }
    const day = dayStats();
    if (day.processed >= state.profile.quota && state.streak.lastDay !== today) {
      state.streak.count = state.streak.lastDay === yesterdayKey() ? state.streak.count + 1 : 1;
      state.streak.lastDay = today;
      if (!state.quotaDays.includes(today)) state.quotaDays.push(today);
      earn('quota-met');
    }
    earn('first-stamp');
    if (state.streak.count >= 7) earn('streak-7');
    if (st.processed >= 100) earn('papers-100');
    if (st.denied >= 10) earn('firm-hand');
    if (st.onTime >= 5) earn('on-the-dot');
    if (day.processed >= 3 && !openPapers().length) earn('inbox-zero');

    const after = rankIndex(state.xp);
    return { xp: delta, rankUp: after > before ? after : -1 };
  }

  // one requisition per rank reached, until everything has been chosen
  const pendingPicks = () => (state.profile
    ? Math.max(0, Math.min(rankIndex(state.xp) + 1, Object.keys(ITEMS).length) - state.items.length) : 0);
  function renderRank() {
    const idx = rankIndex(state.xp);
    const rank = RANKS[idx], next = RANKS[idx + 1];
    $('#np-rank').textContent = rank.name;
    $('#np-xp-bar').style.width = next
      ? clamp(((state.xp - rank.xp) / (next.xp - rank.xp)) * 100, 0, 100) + '%' : '100%';
    $('#nameplate').title = next
      ? `${state.xp} XP · ${next.xp - state.xp} more to ${next.name}`
      : `${state.xp} XP · the top of the Bureau`;
    const has = (item) => !!state.profile && state.items.includes(item);
    Object.keys(ITEMS).forEach((item) => { $('#item-' + item).hidden = !has(item); });
    const waiting = pendingPicks();
    const pend = $('#np-pending');
    pend.hidden = !waiting;
    pend.textContent = waiting ? `${plural(waiting, 'requisition')} waiting · choose` : '';
    desk.classList.toggle('has-lamp', has('lamp'));
    desk.classList.toggle('has-cert', has('cert'));
    const blue = has('ink') && state.ink === 'blue';
    desk.classList.toggle('ink-blue', blue);
    $('#item-ink').setAttribute('aria-pressed', String(blue));
    if (!has('radio')) radio.stop();
  }

  let promoTimer = null;
  function promote(idx) {
    const rank = RANKS[idx];
    renderRank();
    const plate = $('#nameplate');
    plate.classList.remove('promoted');
    void plate.offsetWidth;
    plate.classList.add('promoted');
    sfx.fanfare();
    const promo = $('#promo');
    promo.textContent = '';
    promo.append(h('b', '', `Promoted to ${rank.name}`),
      document.createTextNode(pendingPicks() ? 'You may choose something for your desk.' : 'The Bureau is proud of you.'));
    promo.hidden = false;
    clearTimeout(promoTimer);
    promoTimer = setTimeout(() => { promo.hidden = true; }, 6000);
    if (pendingPicks()) setTimeout(openChoice, 1600);
  }

  // requisition form: choose which desk item this rank brings
  const choice = $('#choice');
  function openChoice() {
    if (!pendingPicks()) return;
    const first = !state.items.length;
    $('#choice-text').textContent = first
      ? 'Every new clerk may requisition one item to make the desk their own. More follow with each promotion.'
      : `As ${RANKS[rankIndex(state.xp)].name}, you may requisition one more item for your desk.`;
    const list = $('#choice-list');
    list.textContent = '';
    Object.keys(ITEMS).filter((item) => !state.items.includes(item)).forEach((item) => {
      const b = h('button', 'choice-item');
      b.type = 'button';
      b.append(h('b', '', ITEMS[item][0]), h('span', '', ITEMS[item][1]));
      b.addEventListener('click', () => chooseItem(item));
      list.appendChild(b);
    });
    choice.hidden = false;
    select(null);
  }
  function closeChoice() { choice.hidden = true; }
  function chooseItem(item) {
    if (state.items.includes(item) || !pendingPicks()) return;
    state.items.push(item);
    save();
    closeChoice();
    renderRank();
    const el = $('#item-' + item);
    el.classList.remove('arrive');
    void el.offsetWidth;
    el.classList.add('arrive');
    setTimeout(() => el.classList.remove('arrive'), 1100);
    sfx.chime();
    if (pendingPicks()) setTimeout(openChoice, 1400);
  }
  $('#choice-later').addEventListener('click', closeChoice);
  choice.addEventListener('pointerdown', (e) => { if (e.target === choice) closeChoice(); });
  $('#nameplate').addEventListener('click', () => { if (pendingPicks()) openChoice(); });

  // tally marks under the date: one stroke per day of the current streak
  function tallySvg(n) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '17');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 17 12');
    const line = (x1, y1, x2, y2) => {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', '#b33a3a'); l.setAttribute('stroke-width', '1.4'); l.setAttribute('stroke-linecap', 'round');
      svg.appendChild(l);
    };
    for (let i = 0; i < Math.min(n, 4); i++) line(3 + i * 3.6, 1.5, 2.4 + i * 3.6, 10.5);
    if (n >= 5) line(0.8, 9, 16.2, 3);
    return svg;
  }
  function renderTally() {
    const box = $('#cal-tally');
    const n = streakNow();
    box.textContent = '';
    box.title = n ? `${n}-day streak` : '';
    if (!n) return;
    if (n > 15) {
      box.append(tallySvg(5), h('small', '', `× ${n} days`));
      return;
    }
    for (let left = n; left > 0; left -= 5) box.appendChild(tallySvg(Math.min(left, 5)));
  }

  // the radio: a soft generated pad with a little hiss, only while switched on
  const radio = (() => {
    const btn = $('#item-radio');
    const CHORDS = [
      [174.61, 220, 261.63, 329.63],
      [146.83, 174.61, 220, 261.63],
      [116.54, 174.61, 220, 293.66],
    ];
    let live = null;
    function stop() {
      btn.classList.remove('on');
      btn.setAttribute('aria-pressed', 'false');
      if (!live) return;
      const { c, master, sources, timer } = live;
      live = null;
      clearInterval(timer);
      try {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setTargetAtTime(0.0001, c.currentTime, 0.25);
        setTimeout(() => sources.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } }), 1200);
      } catch (e) { /* ignore */ }
    }
    function start() {
      const c = sfx.ctx();
      if (!c) return;
      const master = c.createGain();
      master.gain.setValueAtTime(0.0001, c.currentTime);
      master.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2.5);
      const tone = c.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 850;
      tone.connect(master); master.connect(c.destination);
      const sources = [];
      const oscs = CHORDS[0].map((freq, i) => {
        const o = c.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = freq;
        o.detune.value = (i - 1.5) * 4;
        const g = c.createGain();
        g.gain.value = 0.22;
        o.connect(g); g.connect(tone);
        o.start();
        sources.push(o);
        return o;
      });
      const hiss = sfx.noise(c, 2);
      hiss.loop = true;
      const hf = c.createBiquadFilter();
      hf.type = 'lowpass'; hf.frequency.value = 500;
      const hg = c.createGain();
      hg.gain.value = 0.05;
      hiss.connect(hf); hf.connect(hg); hg.connect(master);
      hiss.start();
      sources.push(hiss);
      let step = 0;
      const timer = setInterval(() => {
        step = (step + 1) % CHORDS.length;
        oscs.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[step][i], c.currentTime, 1.4));
      }, 9000);
      live = { c, master, sources, timer };
      btn.classList.add('on');
      btn.setAttribute('aria-pressed', 'true');
    }
    btn.addEventListener('click', () => (live ? stop() : start()));
    return { stop };
  })();

  $('#item-ink').addEventListener('click', () => {
    state.ink = state.ink === 'blue' ? 'classic' : 'blue';
    save();
    renderRank();
    sfx.slide(0.04);
  });

  // commendation letters, read one at a time
  const commend = $('#commend');
  let commendQueue = [];
  function showNextCommendation() {
    const id = commendQueue.shift();
    if (!id) { commend.hidden = true; return; }
    const [title, text] = ACHIEVEMENTS[id];
    $('#commend-dear').textContent = `Dear ${state.profile.name},`;
    $('#commend-title').textContent = title;
    $('#commend-text').textContent = text;
    state.achievements[id].delivered = true;
    save();
    commend.hidden = false;
    const letter = commend.querySelector('.letter');
    letter.style.animation = 'none';
    void letter.offsetWidth;
    letter.style.animation = '';
    sfx.chime();
  }
  $('#commend-ok').addEventListener('click', showNextCommendation);

  // ---------- morning post ----------
  // On the first open of each day an envelope delivers yesterday's unfinished papers
  // and the appointments that fall due. Papers in the Later pile stay where they are.
  async function morningPost() {
    const today = dayKey();
    if (!state.profile || state.lastPost === today) return;
    state.lastPost = today;
    const items = state.papers.filter(
      (p) => p.status === 'post' || (p.status === 'scheduled' && dueDay(p) <= today)
    );
    items.forEach((p) => { p.status = 'tray'; delete p.postDay; });
    const letters = Object.keys(state.achievements)
      .filter((id) => ACHIEVEMENTS[id] && !state.achievements[id].delivered);
    save();
    renderTally();
    if (!items.length && !letters.length) { renderTrays(); return; }
    const total = items.length + letters.length;

    const env = h('div', 'envelope no-anim');
    const label = h('div', 'env-label');
    const d = new Date();
    label.append(h('b', '', 'Morning Post'),
      document.createTextNode(`${d.getDate()} ${MONTHS[d.getMonth()]} · ${total} ${total === 1 ? 'item' : 'items'}`));
    env.appendChild(label);
    desk.appendChild(env);
    const w = env.offsetWidth, eh = env.offsetHeight;
    const x = desk.clientWidth / 2 - w / 2;
    const y = desk.clientHeight * 0.44 - eh / 2;
    env.style.transform = tf(x, -eh * 1.6, -9, 1);
    void env.offsetWidth;
    env.classList.remove('no-anim');
    env.style.transform = tf(x, y, -3, 1);
    sfx.slide(0.1);
    await wait(1000);
    env.classList.add('open');
    await wait(500);
    const sheets = items.slice(0, 5);
    for (const p of sheets) {
      sfx.slide();
      flySheet(env, inTray, !!p.due);
      await wait(210);
    }
    await wait(520);
    renderTrays();
    sfx.chime();
    await wait(350);
    env.style.transform = tf(-w * 1.5, y, -16, 1);
    env.style.opacity = '0';
    await wait(900);
    env.remove();
    if (letters.length) {
      commendQueue = letters;
      showNextCommendation();
    }
  }

  // the day can change while the desk is open
  let currentDay = dayKey();
  function checkDay() {
    if (dayKey() === currentDay) return;
    currentDay = dayKey();
    deskPapers().forEach(decorate); // urgency can change with the date
    renderCalendar();
    renderTrays();
    morningPost();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 60000);

  // ---------- closing the office: shift report ----------
  const report = $('#report');
  const receipt = $('#receipt');
  const receiptWrap = receipt.parentElement;

  function xpFor(p) {
    if (p.status === 'denied') return 3;
    if (p.status !== 'done') return 0;
    // on time: a dated paper by its day, or an urgent one on the day it was filed
    const stamped = p.stamp ? dayKey(new Date(p.stamp.at)) : dayKey();
    const onTime = (p.due && stamped <= dueDay(p)) ||
      (p.urgentWord && stamped === dayKey(new Date(p.filed)));
    return onTime ? 15 : 10;
  }
  function dayStats() {
    const today = dayKey();
    const s = { done: 0, denied: 0, delayed: 0 };
    state.papers.forEach((p) => {
      if (p.stampedOn !== today || s[p.status] === undefined) return;
      s[p.status]++;
    });
    s.processed = s.done + s.denied;
    s.xp = state.xpDay.day === today ? state.xpDay.xp : 0;
    return s;
  }
  const openPapers = () => state.papers.filter((p) => p.status === 'desk' || p.status === 'tray');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  function rRow(label, value) {
    const r = h('div', 'r-row');
    r.append(h('span', '', label), h('i'), h('span', '', String(value)));
    return r;
  }

  function openReport() {
    const s = dayStats();
    const quota = state.profile.quota;
    const left = openPapers().length;
    const d = new Date();
    receipt.textContent = '';
    const quotaLine = h('div', 'r-quota' + (s.processed >= quota ? ' met' : ''),
      s.processed >= quota ? 'Quota met' : 'Quota not met');
    const note = h('div', 'r-note', left
      ? `${plural(left, 'unfinished paper')} will go to tomorrow's post.`
      : 'The desk is clear.');
    const actions = h('div', 'r-actions');
    const closeBtn = h('button', 'primary', 'Close the office');
    const keepBtn = h('button', '', 'Keep working');
    closeBtn.type = keepBtn.type = 'button';
    actions.append(closeBtn, keepBtn);
    receipt.append(
      h('div', 'r-title', 'Bureau of Small Tasks'),
      h('div', 'r-sub', 'Shift Report'),
      h('div', 'r-meta', `${WEEKDAYS[d.getDay()]} ${fmtDate(d)} · Clerk ${state.profile.name}`),
      h('div', 'r-rule'),
      rRow('Done', s.done), rRow('Denied', s.denied), rRow('Delayed', s.delayed),
      h('div', 'r-rule'),
      rRow('Processed', `${s.processed} / ${quota}`),
      quotaLine,
      ...(s.processed >= quota ? [h('div', 'r-seal', 'B')] : []),
      rRow('XP earned', s.xp),
      rRow('Streak', plural(streakNow(), 'day')),
      h('div', 'r-rule'),
      note, actions
    );
    keepBtn.addEventListener('click', closeReport);
    closeBtn.addEventListener('click', () => {
      const carried = closeOffice();
      receipt.appendChild(h('div', 'r-closed', 'CLOSED'));
      sfx.thunk();
      note.textContent = carried
        ? `${plural(carried, 'paper')} carried to tomorrow's post.`
        : 'Nothing left behind. Rest well.';
      actions.textContent = '';
      const bye = h('button', '', 'Good night');
      bye.type = 'button';
      bye.addEventListener('click', closeReport);
      actions.appendChild(bye);
    });
    report.hidden = false;
    receiptWrap.classList.remove('printing');
    void receiptWrap.offsetWidth;
    receiptWrap.classList.add('printing');
    sfx.print();
    select(null);
  }
  receiptWrap.addEventListener('animationend', (e) => {
    if (e.target === receiptWrap) receiptWrap.classList.remove('printing');
  });
  function closeReport() { report.hidden = true; }
  report.addEventListener('pointerdown', (e) => { if (e.target === report) closeReport(); });

  // unfinished papers leave for tomorrow's post
  function closeOffice() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tomorrow = dayKey(t);
    const left = openPapers();
    left.forEach((p, i) => {
      const el = els.get(p.id);
      if (el) {
        busy.add(p.id);
        const { x } = deskXY(p);
        setTimeout(() => {
          el.style.transform = tf(x, -el.offsetHeight * 1.4, p.rot || 0, 0.9);
          el.style.opacity = '0';
        }, i * 90);
        setTimeout(() => removePaperEl(p), 700 + i * 90);
      }
      p.status = 'post';
      p.postDay = tomorrow;
    });
    selectedId = null;
    if (state.closedOn !== dayKey()) {
      state.closedOn = dayKey();
      state.stats.closes++;
      if (state.stats.closes >= 5) earn('closing-time');
    }
    save();
    renderTrays();
    if (left.length) sfx.slide();
    return left.length;
  }

  const bell = $('#bell');
  bell.addEventListener('click', () => {
    if (!state.profile) return;
    bell.classList.remove('ring');
    void bell.offsetWidth;
    bell.classList.add('ring');
    sfx.bell();
    setTimeout(openReport, 350);
  });

  // ---------- planner (month view) ----------
  const planner = $('#planner');
  let plMonth = null; // first day of the month on show
  let plSel = null;   // selected day key

  // what belongs to a given day: dated papers, plus the post due to arrive
  function dayItems(day) {
    return state.papers.filter((p) =>
      (p.due && dueDay(p) === day && p.status !== 'denied') ||
      (!p.due && p.status === 'post' && p.postDay === day));
  }

  function renderPlanner() {
    const y = plMonth.getFullYear(), m = plMonth.getMonth();
    const today = dayKey();
    $('#pl-title').textContent = `${MONTHS_FULL[m]} ${y}`;
    const grid = $('#pl-grid');
    grid.textContent = '';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((w) => grid.appendChild(h('div', 'pl-wd', w)));
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < lead; i++) grid.appendChild(h('div', 'pl-cell blank'));
    for (let dnum = 1; dnum <= days; dnum++) {
      const key = dayKey(new Date(y, m, dnum));
      const cell = h('button', 'pl-cell' + (key === today ? ' today' : '') + (key === plSel ? ' sel' : '')
        + (state.quotaDays.includes(key) ? ' met' : ''));
      if (state.quotaDays.includes(key)) cell.title = 'Quota met';
      cell.type = 'button';
      cell.appendChild(h('span', 'pl-num', String(dnum)));
      const items = dayItems(key);
      if (items.length) {
        const dots = h('span', 'pl-dots');
        items.slice(0, 4).forEach((p) => dots.appendChild(
          h('i', p.status === 'done' ? 'done' : (p.due ? '' : 'post'))));
        cell.appendChild(dots);
      }
      cell.addEventListener('click', () => { plSel = key; renderPlanner(); });
      grid.appendChild(cell);
    }
    const trail = (7 - ((lead + days) % 7)) % 7;
    for (let i = 0; i < trail; i++) grid.appendChild(h('div', 'pl-cell blank'));

    // the selected day's entries
    const box = $('#pl-day');
    box.textContent = '';
    const [sy, sm, sd] = plSel.split('-').map(Number);
    const sel = new Date(sy, sm - 1, sd);
    box.appendChild(h('h4', '', `${WEEKDAYS[sel.getDay()]} ${sd} ${MONTHS_FULL[sm - 1]}`));
    const items = dayItems(plSel);
    if (!items.length) { box.appendChild(h('div', 'none', 'Nothing entered.')); return; }
    const dated = items.filter((p) => p.due).sort(byDue);
    const posted = items.filter((p) => !p.due);
    const ul = h('ul');
    dated.forEach((p) => {
      const li = h('li', p.status === 'done' ? 'done' : '');
      li.append(h('b', '', p.allDay ? 'all day' : fmtTime(new Date(p.due))), h('span', '', p.text));
      ul.appendChild(li);
    });
    posted.forEach((p) => {
      const li = h('li');
      li.append(h('b', '', 'post'), h('span', '', p.text));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function openPlanner() {
    const d = new Date();
    plMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    plSel = dayKey(d);
    renderPlanner();
    planner.hidden = false;
    select(null);
    sfx.slide(0.04);
  }
  function closePlanner() { planner.hidden = true; }
  function shiftMonth(by) {
    plMonth = new Date(plMonth.getFullYear(), plMonth.getMonth() + by, 1);
    renderPlanner();
  }
  calendarEl.addEventListener('click', openPlanner);
  calendarEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlanner(); }
  });
  $('#pl-prev').addEventListener('click', () => shiftMonth(-1));
  $('#pl-next').addEventListener('click', () => shiftMonth(1));
  $('#pl-close').addEventListener('click', closePlanner);
  planner.addEventListener('pointerdown', (e) => { if (e.target === planner) closePlanner(); });

  // ---------- parcels: hand papers to another device through a link ----------
  // There is no server, so a parcel is just the papers themselves packed into the part of
  // a link after the "#", which browsers never send anywhere. Opening the link on another
  // device offers to drop them into that desk's In-tray.
  const parcel = $('#parcel');
  const parcelBody = $('#parcel-body');
  let pendingParcel = null;

  function packParcel(items) {
    const bytes = new TextEncoder().encode(JSON.stringify(items));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unpackParcel(str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!Array.isArray(data)) throw new Error('not a parcel');
    return data.slice(0, 60).map((it) => ({
      t: String((it && it.t) || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      d: it && typeof it.d === 'string' && !Number.isNaN(Date.parse(it.d)) ? it.d : null,
      a: !!(it && it.a),
      u: !!(it && it.u),
    })).filter((it) => it.t);
  }

  function parcelFrame(title, sub) {
    $('#parcel-title').textContent = title;
    $('#parcel-sub').textContent = sub;
    parcelBody.textContent = '';
    parcel.hidden = false;
    select(null);
  }
  function parcelList(texts) {
    const ul = h('ul', 'parcel-list');
    texts.slice(0, 6).forEach((t) => ul.appendChild(h('li', '', t)));
    if (texts.length > 6) ul.appendChild(h('li', 'more', `and ${texts.length - 6} more`));
    return ul;
  }
  function parcelButton(label, cls, onClick) {
    const b = h('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function closeParcel() { parcel.hidden = true; }
  parcel.addEventListener('pointerdown', (e) => { if (e.target === parcel) closeParcel(); });

  function openSend() {
    if (!state.profile) return;
    const papers = state.papers.filter((p) => ['desk', 'tray', 'scheduled'].includes(p.status));
    parcelFrame('Parcel for Another Desk', 'Outgoing Post');
    if (!papers.length) {
      parcelBody.append(
        h('p', '', 'There are no open papers to send. File a few first, then come back.'),
        parcelButton('Close', 'link-btn', closeParcel));
      return;
    }
    const link = location.origin + location.pathname + '#post=' + packParcel(
      papers.map((p) => ({ t: p.text, d: p.due || undefined, a: p.allDay || undefined, u: p.urgentWord || undefined })));
    const field = h('input', 'parcel-link');
    field.readOnly = true;
    field.value = link;
    field.addEventListener('focus', () => field.select());
    const status = h('p', 'parcel-status');
    const actions = h('div', 'parcel-actions');

    const sent = (how) => {
      status.textContent = `${how} Open it on your other device and the papers drop into its In-tray.`;
      actions.textContent = '';
      actions.append(
        parcelButton('Clear them from this desk', 'letter-btn', () => {
          papers.forEach((p) => removePaperEl(p));
          state.papers = state.papers.filter((p) => !papers.includes(p));
          if (papers.some((p) => p.id === selectedId)) selectedId = null;
          save();
          renderTrays();
          closeParcel();
          sfx.slide();
        }),
        parcelButton('Keep them here too', 'link-btn', closeParcel));
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link);
        sent('Link copied.');
      } catch (e) {
        field.focus();
        field.select();
        status.textContent = 'Copy the link above by hand, then open it on your other device.';
      }
    };
    if (navigator.share) {
      actions.appendChild(parcelButton('Share the link', 'letter-btn', async () => {
        try {
          await navigator.share({ title: 'Papers for my Bureau desk', url: link });
          sent('Link shared.');
        } catch (e) { /* share sheet dismissed */ }
      }));
      actions.appendChild(parcelButton('Copy it instead', 'link-btn', copy));
    } else {
      actions.appendChild(parcelButton('Copy the link', 'letter-btn', copy));
    }
    actions.appendChild(parcelButton('Cancel', 'link-btn', closeParcel));
    parcelBody.append(
      h('p', '', `${plural(papers.length, 'open paper')} will be wrapped into a link. Send the link to yourself and open it on your other device.`),
      parcelList(papers.map((p) => p.text)), field, status, actions);
  }

  // a link carrying a parcel was opened on this device
  function checkParcel() {
    const m = /^#post=([\w-]+)$/.exec(location.hash);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    try {
      const items = unpackParcel(m[1]);
      if (items.length) pendingParcel = items;
    } catch (e) { pendingParcel = null; }
    if (pendingParcel && state.profile) openReceive();
  }

  function openReceive() {
    const items = pendingParcel;
    if (!items) return;
    parcelFrame('A Parcel Has Arrived', 'Incoming Post');
    parcelBody.append(
      h('p', '', `${plural(items.length, 'paper')} sent from another desk:`),
      parcelList(items.map((it) => it.t)));
    const actions = h('div', 'parcel-actions');
    actions.append(
      parcelButton('Accept into the In-tray', 'letter-btn', () => {
        const today = dayKey();
        const have = new Set(state.papers.filter((p) => UNFINISHED.includes(p.status)).map((p) => p.text.toLowerCase()));
        let added = 0;
        items.forEach((it) => {
          if (have.has(it.t.toLowerCase())) return; // already on this desk
          have.add(it.t.toLowerCase());
          const p = {
            id: uid(), no: state.nextNo++, text: it.t,
            filed: new Date().toISOString(), status: 'tray', stamp: null,
          };
          if (it.d) {
            p.due = it.d;
            p.allDay = it.a;
            if (dueDay(p) > today) p.status = 'scheduled';
          }
          if (it.u) p.urgentWord = true;
          state.papers.push(p);
          clerk.file(p, true);
          added++;
        });
        pendingParcel = null;
        save();
        renderTrays();
        closeParcel();
        if (added) { sfx.slide(); sfx.chime(); nudge(inTray); }
        if (pendingPicks()) setTimeout(openChoice, 600);
      }),
      parcelButton('Discard the parcel', 'link-btn', () => {
        pendingParcel = null;
        closeParcel();
        if (pendingPicks() && !state.items.length) openChoice();
      }));
    parcelBody.appendChild(actions);
  }

  function rebuild() {
    lastFit = { w: 0, h: 0 };
    fit();
    [...els.keys()].forEach((id) => { const el = els.get(id); if (el) el.remove(); });
    els.clear(); busy.clear(); dragging.clear();
    selectedId = null;
    hideUndo();
    closeLedger();
    closePlanner();
    closeReport();
    commend.hidden = true;
    $('#promo').hidden = true;
    closeChoice();
    closeParcel();
    renderNameplate();
    renderRank();
    renderCalendar();
    renderMute();
    state.papers.forEach((p) => { if (UNFINISHED.includes(p.status) && !p.dept) keywordFile(p); });
    clerk.refile();
    deskPapers().forEach((p) => {
      const el = makePaperEl(p);
      el.classList.add('no-anim');
      place(p);
      void el.offsetWidth;
      el.classList.remove('no-anim');
    });
    renderTrays();
    renderAgenda();
    if (state.profile) {
      welcome.hidden = true;
      morningPost();
    } else {
      $('#w-name').value = '';
      $('#w-quota').value = 5;
      welcome.hidden = false;
      setTimeout(() => $('#w-name').focus(), 50);
    }
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => { lastFit = { w: 0, h: 0 }; setTimeout(fit, 150); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => deskPapers().forEach(place));
  }

  window.addEventListener('hashchange', checkParcel);

  rebuild();
  checkParcel();
  clerk.start();
})();
