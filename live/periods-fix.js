(() => {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const blankDays = () => DAY_NAMES.map(day => ({ day, meal: null, status: null }));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => {
    const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  };
  const addDays = (d, n) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  };
  const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const labelFromDates = (start, end) => `${shortDate(start)} - ${shortDate(end)}`;

  const inferStartEnd = (period) => {
    if (period && period.startDate && period.endDate) {
      const s = parseIso(period.startDate);
      const e = parseIso(period.endDate);
      if (s && e) return { start: s, end: e };
    }
    return null;
  };

  const normalisePeriods = () => {
    if (!S.periods || !S.periods.length) {
      const today = new Date();
      const end = addDays(today, 6);
      S.periods = [{ label: labelFromDates(today, end), startDate: iso(today), endDate: iso(end), createdAt: Date.now(), days: blankDays() }];
    }
    S.periods.forEach((p, i) => {
      if (!Array.isArray(p.days) || !p.days.length) p.days = blankDays();
      if (!p.createdAt) p.createdAt = Date.now() + i;
      if (!p.label) p.label = i === 0 ? 'This shop' : `Shop ${i + 1}`;
    });
    if (typeof pi !== 'number' || pi < 0 || pi >= S.periods.length) pi = 0;
  };

  const createNextPeriod = () => {
    const current = S.periods[pi];
    const dates = inferStartEnd(current);
    const suggestedStart = dates ? addDays(dates.end, 1) : addDays(new Date(), 1);
    const startText = prompt('Start date for next shopping period?\nUse YYYY-MM-DD', iso(suggestedStart));
    const start = parseIso(startText);
    if (!start) {
      alert('Please enter the start date as YYYY-MM-DD.');
      return false;
    }

    const suggestedEnd = addDays(start, 6);
    const endText = prompt('End date for this shopping period?\nUse YYYY-MM-DD', iso(suggestedEnd));
    const end = parseIso(endText);
    if (!end) {
      alert('Please enter the end date as YYYY-MM-DD.');
      return false;
    }
    if (end < start) {
      alert('End date cannot be before start date.');
      return false;
    }

    S.periods.push({
      label: labelFromDates(start, end),
      startDate: iso(start),
      endDate: iso(end),
      createdAt: Date.now(),
      days: blankDays()
    });
    pi = S.periods.length - 1;
    return true;
  };

  window.move = function movePeriod(direction) {
    normalisePeriods();

    if (direction > 0) {
      if (pi < S.periods.length - 1) {
        pi += 1;
      } else if (!createNextPeriod()) {
        return;
      }
    } else if (direction < 0) {
      if (pi > 0) pi -= 1;
      else {
        alert('No previous shopping period yet.');
        return;
      }
    }

    S.currentPeriod = pi;
    S.finalItems = [];
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
  };
})();
