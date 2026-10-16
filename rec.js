// Recurring-event helpers, shared by the browser (global REC) and the API (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.REC = factory();
})(this, function () {
  const pad = n => String(n).padStart(2, '0');
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
  const str = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const LABEL = { d: 'כל יום', w: 'כל שבוע', '2w': 'כל שבועיים', m: 'כל חודש', y: 'כל שנה', dow: 'ימים בשבוע' };
  const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const dowOf = d => { const a = parse(d); return new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay(); };
  // the time of the occurrence on date d (a "days of the week" event can have a different time per day, e.g. later on Saturday)
  const timeOn = (e, d) => (e.rep === 'dow' && e.dtimes && e.dtimes[dowOf(d)]) || e.time;

  // does event e (possibly recurring) occur on calendar day d (YYYY-MM-DD)?
  function occursOn(e, d) {
    if (!e.rep) return e.date === d;
    if (d < e.date || (e.until && d > e.until)) return false;
    if (e.rep === 'dow') return (e.days || []).includes(dowOf(d));
    const a = parse(e.date), b = parse(d);
    const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 864e5);
    switch (e.rep) {
      case 'd': return true;
      case 'w': return days % 7 === 0;
      case '2w': return days % 14 === 0;
      case 'm': return b.d === Math.min(a.d, dim(b.y, b.m));
      case 'y': return b.m === a.m && b.d === Math.min(a.d, dim(b.y, b.m));
    }
    return false;
  }

  // all occurrence dates of e up to (and including) toDate
  function occDates(e, toDate) {
    const out = [], a = parse(e.date);
    const last = e.until && e.until < toDate ? e.until : toDate;
    if (e.date > last) return out;
    if (e.rep === 'dow') { // chosen days of the week
      const days = e.days || [];
      for (let i = 0; i < 5000; i++) {
        const s = new Date(Date.UTC(a.y, a.m - 1, a.d + i)).toISOString().slice(0, 10);
        if (s > last) break;
        if (days.includes(dowOf(s))) out.push(s);
      }
      return out;
    }
    out.push(e.date);
    if (!e.rep) return out;
    for (let i = 1; i < 5000; i++) {
      let s;
      if (e.rep === 'd' || e.rep === 'w' || e.rep === '2w') {
        const step = e.rep === 'd' ? 1 : e.rep === 'w' ? 7 : 14;
        s = new Date(Date.UTC(a.y, a.m - 1, a.d + step * i)).toISOString().slice(0, 10);
      } else if (e.rep === 'm') {
        const mm = a.m - 1 + i, y = a.y + Math.floor(mm / 12), m = (mm % 12) + 1;
        s = str(y, m, Math.min(a.d, dim(y, m)));
      } else { const y = a.y + i; s = str(y, a.m, Math.min(a.d, dim(y, a.m))); }
      if (s > last) break;
      out.push(s);
    }
    return out;
  }

  // Israel local date+time -> epoch ms (handles DST)
  const fmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }) : null;
  function offsetMin(ms) {
    const p = {}; for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = +x.value;
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60000) * 60000) / 60000;
  }
  function ilToMs(date, time) {
    const a = parse(date), [h, mi] = (time || '00:00').split(':').map(Number);
    const guess = Date.UTC(a.y, a.m - 1, a.d, h, mi);
    let t = guess - offsetMin(guess) * 60000; t = guess - offsetMin(t) * 60000; return t;
  }
  return { occursOn, occDates, ilToMs, LABEL, DOW, dowOf, timeOn };
});
