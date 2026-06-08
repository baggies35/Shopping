(() => {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTHS = { jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11 };
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

  const parseLabelDates = (label) => {
    const text = String(label || '').replace(/[–—]/g, '-');
    const parts = text.split('-').map(x => x.trim());
    if (parts.length < 2) return null;

    const currentYear = new Date().getFullYear();
    const parsePart = (part, fallbackMonth = null) => {
      const tokens = part.toLowerCase().replace(/,/g, '').split(/\s+/).filter(Boolean);
      const dayToken = tokens.find(t => /^\d{1,2}$/.test(t));
      const monthToken = tokens.find(t => MONTHS[t.slice(0,3)] !== undefined || MONTHS[t] !== undefined);
      if (!dayToken) return null;
      const month = monthToken ? (MONTHS[monthToken] ?? MONTHS[monthToken.slice(0,3)]) : fallbackMonth;
      if (month === null || month === undefined) return null;
      return new Date(currentYear, month, Number(dayToken));
    };

    const start = parsePart(parts[0]);
    if (!start) return null;
    let end = parsePart(parts[1], start.getMonth());
    if (!end) return null;
    if (end < start) end = new Date(start.getFullYear() + 1, end.getMonth(), end.getDate());
    return { start, end };
  };

  const modalHtml = () => `
    <div id="periodPicker" class="modal">
      <div class="sheet">
        <div class="between">
          <h2>Next shop dates</h2>
          <button class="btn alt small" id="periodCancel">Close</button>
        </div>
        <div class="card" id="currentEndWrap">
          <b>Current period end date</b>
          <div class="muted">This is needed once so future start dates can be suggested correctly.</div>
          <input id="currentEndDate" type="date">
        </div>
        <div class="card">
          <b>Next period</b>
          <div class="fieldLabel">Start date</div>
          <input id="nextStartDate" type="date">
          <div class="fieldLabel">End date</div>
          <input id="nextEndDate" type="date">
          <button class="btn" style="width:100%;margin-top:12px" id="periodCreate">Create period</button>
        </div>
      </div>
    </div>`;

  const ensureModal = () => {
    if (!document.getElementById('periodPicker')) document.body.insertAdjacentHTML('beforeend', modalHtml());
  };

  const inferDates = (period) => {
    if (period && period.startDate && period.endDate) {
      const s = parseIso(period.startDate);
      const e = parseIso(period.endDate);
      if (s && e) return { start: s, end: e };
    }
    const fromLabel = parseLabelDates(period && period.label);
    if (fromLabel && period) {
      period.startDate = iso(fromLabel.start);
      period.endDate = iso(fromLabel.end);
      period.label = labelFromDates(fromLabel.start, fromLabel.end);
      if (typeof save === 'function') save();
      return fromLabel;
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
      inferDates(p);
    });
    if (typeof pi !== 'number' || pi < 0 || pi >= S.periods.length) pi = 0;
  };

  const openCreatePeriodPicker = () => {
    normalisePeriods();
    ensureModal();

    const modal = document.getElementById('periodPicker');
    const currentEndWrap = document.getElementById('currentEndWrap');
    const currentEndInput = document.getElementById('currentEndDate');
    const startInput = document.getElementById('nextStartDate');
    const endInput = document.getElementById('nextEndDate');
    const cancel = document.getElementById('periodCancel');
    const create = document.getElementById('periodCreate');

    const current = S.periods[pi];
    const dates = inferDates(current);
    let suggestedStart;

    if (dates) {
      currentEndWrap.style.display = 'none';
      suggestedStart = addDays(dates.end, 1);
    } else {
      currentEndWrap.style.display = 'block';
      const fallbackEnd = new Date();
      currentEndInput.value = current.endDate || iso(fallbackEnd);
      suggestedStart = addDays(parseIso(currentEndInput.value) || fallbackEnd, 1);
    }

    startInput.value = iso(suggestedStart);
    endInput.value = iso(addDays(suggestedStart, 6));

    currentEndInput.onchange = () => {
      const end = parseIso(currentEndInput.value);
      if (end) {
        const nextStart = addDays(end, 1);
        startInput.value = iso(nextStart);
        endInput.value = iso(addDays(nextStart, 6));
      }
    };

    startInput.onchange = () => {
      const start = parseIso(startInput.value);
      if (start) endInput.value = iso(addDays(start, 6));
    };

    cancel.onclick = () => modal.classList.remove('on');
    create.onclick = () => {
      if (!dates) {
        const currentEnd = parseIso(currentEndInput.value);
        if (!currentEnd) return alert('Please pick the current period end date.');
        current.endDate = iso(currentEnd);
        if (!current.startDate) {
          const guessedStart = addDays(currentEnd, -6);
          current.startDate = iso(guessedStart);
        }
        current.label = labelFromDates(parseIso(current.startDate), currentEnd);
      }

      const start = parseIso(startInput.value);
      const end = parseIso(endInput.value);
      if (!start || !end) return alert('Please pick a start and end date.');
      if (end < start) return alert('End date cannot be before start date.');

      S.periods.push({
        label: labelFromDates(start, end),
        startDate: iso(start),
        endDate: iso(end),
        createdAt: Date.now(),
        days: blankDays()
      });
      pi = S.periods.length - 1;
      S.currentPeriod = pi;
      S.finalItems = [];
      modal.classList.remove('on');
      if (typeof save === 'function') save();
      if (typeof render === 'function') render();
    };

    modal.classList.add('on');
  };

  window.move = function movePeriod(direction) {
    normalisePeriods();

    if (direction > 0) {
      if (pi < S.periods.length - 1) {
        pi += 1;
      } else {
        openCreatePeriodPicker();
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
