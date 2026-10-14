/* Opportunity costs made simple
   Compares investing money with spending it, over a chosen number of years. */
(function () {
  var CURRENCIES = {
    SEK: { label: 'SEK', symbol: 'kr', prefix: false, rate: 1,   maxUpfront: 500000, stepUpfront: 1000, maxMonthly: 10000, stepMonthly: 100 },
    EUR: { label: 'EUR', symbol: '€',  prefix: true,  rate: 0.1, maxUpfront: 50000,  stepUpfront: 100,  maxMonthly: 1000,  stepMonthly: 10 },
    USD: { label: 'USD', symbol: '$',  prefix: true,  rate: 0.1, maxUpfront: 50000,  stepUpfront: 100,  maxMonthly: 1000,  stepMonthly: 10 }
  };

  var ITEM_TYPES = [
    { id: 'consumable', label: 'None',          note: 'Nothing left to sell',   dep: 100 },
    { id: 'tech',       label: 'Tech and gear', note: 'Loses about 35% a year', dep: 35 },
    { id: 'vehicle',    label: 'Vehicle',       note: 'Loses about 18% a year', dep: 18 }
  ];

  /* Base amounts in SEK. */
  var PRESETS = [
    { id: 'habit',    name: 'Daily habit',      sub: 'Coffee and lunch out',             upfront: 0,      monthly: 1200, type: 'consumable' },
    { id: 'tech',     name: 'Flagship tech',    sub: 'Upgrade cycle and subscriptions',  upfront: 16000,  monthly: 300,  type: 'tech' },
    { id: 'commuter', name: 'Commuter upgrade', sub: 'E-bike and upkeep',                upfront: 25000,  monthly: 400,  type: 'tech' },
    { id: 'car',      name: 'Car ownership',    sub: 'Buying and running a car',         upfront: 220000, monthly: 3500, type: 'vehicle' }
  ];

  var BENCHMARKS = [
    { label: 'Cautious, 5%', value: 5 },
    { label: 'Global index, 8%', value: 8 },
    { label: 'S&P 500 average, 10%', value: 10 }
  ];

  var INFLATION = 2;

  var state = { currency: 'SEK', preset: 'tech', upfront: 16000, monthly: 300, ret: 8, years: 10, type: 'tech', real: false };

  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Formatting ---------- */
  function groupDigits(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function money(amount, compact) {
    var c = CURRENCIES[state.currency];
    var r = Math.round(amount), abs = Math.abs(r), s;
    if (compact && abs >= 1000000) s = (r / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (compact && abs >= 10000) s = Math.round(r / 1000) + 'k';
    else s = groupDigits(r);
    return c.prefix ? c.symbol + s : s + '\u00a0' + c.symbol;
  }
  function typeOf(id) { return ITEM_TYPES.filter(function (t) { return t.id === id; })[0] || ITEM_TYPES[0]; }

  /* ---------- The model ---------- */
  function simulate() {
    var eff = state.real ? ((1 + state.ret / 100) / (1 + INFLATION / 100) - 1) * 100 : state.ret;
    var mr = eff / 100 / 12;
    var dep = typeOf(state.type).dep;
    var rows = [];
    var pv = state.upfront, cash = state.upfront, cross = null;
    var resale0 = dep >= 100 ? 0 : state.upfront;

    rows.push({ year: 0, cash: cash, earned: 0, invested: pv, resale: resale0, opp: pv - resale0, cross: false });

    for (var y = 1; y <= state.years; y++) {
      var start = pv, add = state.monthly * 12;
      for (var m = 0; m < 12; m++) pv = (pv + state.monthly) * (1 + mr);
      cash += add;
      var earned = pv - start - add;
      var resale = 0;
      if (dep < 100 && state.upfront > 0) {
        resale = state.upfront * Math.pow(1 - dep / 100, y);
        if (state.real) resale /= Math.pow(1 + INFLATION / 100, y);
      }
      /* The tipping point only means something when money keeps going in. */
      var isCross = cross === null && state.monthly > 0 && earned > add;
      if (isCross) cross = y;
      rows.push({ year: y, cash: cash, earned: earned, invested: pv, resale: resale, opp: pv - resale, cross: isCross });
    }

    var last = rows[rows.length - 1];
    return {
      rows: rows,
      last: last,
      eff: eff,
      cross: cross,
      growth: last.invested - last.cash,
      monthlyAt4: last.invested * 0.04 / 12,
      mult: last.cash > 0 ? last.invested / last.cash : 1
    };
  }

  /* ---------- Controls ---------- */
  function segButtons(container, items, isActive, onPick) {
    container.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      b.setAttribute('aria-pressed', isActive(it) ? 'true' : 'false');
      b.addEventListener('click', function () { onPick(it); });
      container.appendChild(b);
    });
  }

  function renderPresets() {
    var box = $('oc-presets');
    var rate = CURRENCIES[state.currency].rate;
    box.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'oc-preset';
      b.setAttribute('aria-pressed', state.preset === p.id ? 'true' : 'false');
      var up = Math.round(p.upfront * rate), mo = Math.round(p.monthly * rate);
      b.innerHTML = '<span class="oc-preset-name"></span><span class="oc-preset-sub"></span><span class="oc-preset-cost"></span>';
      b.children[0].textContent = p.name;
      b.children[1].textContent = p.sub;
      b.children[2].textContent = up > 0 ? money(up, true) + ' + ' + money(mo, true) + '/mo' : money(mo) + '/mo';
      b.addEventListener('click', function () {
        state.preset = p.id;
        state.upfront = up;
        state.monthly = mo;
        state.type = p.type;
        state.ret = 8;
        update();
      });
      box.appendChild(b);
    });
    $('oc-custom').hidden = state.preset !== 'custom';
  }

  function tweak() { state.preset = 'custom'; }

  function syncInputs() {
    var c = CURRENCIES[state.currency];
    document.querySelectorAll('[data-sym-pre]').forEach(function (el) { el.textContent = c.prefix ? c.symbol : ''; });
    document.querySelectorAll('[data-sym-post]').forEach(function (el) { el.textContent = c.prefix ? '' : c.symbol; });

    var up = $('oc-upfront'), upR = $('oc-upfront-range');
    up.step = c.stepUpfront; upR.max = c.maxUpfront; upR.step = c.stepUpfront;
    if (document.activeElement !== up) up.value = state.upfront;
    upR.value = Math.min(state.upfront, c.maxUpfront);

    var mo = $('oc-monthly'), moR = $('oc-monthly-range');
    mo.step = c.stepMonthly; moR.max = c.maxMonthly; moR.step = c.stepMonthly;
    if (document.activeElement !== mo) mo.value = state.monthly;
    moR.value = Math.min(state.monthly, c.maxMonthly);

    $('oc-return').value = state.ret;
    $('oc-return-value').textContent = state.ret.toFixed(1) + '%';
    $('oc-years').value = state.years;
    $('oc-years-value').textContent = state.years + ' years';
    $('oc-real').setAttribute('aria-checked', state.real ? 'true' : 'false');
    $('oc-type-note').textContent = typeOf(state.type).note;

    segButtons($('oc-currency'), Object.keys(CURRENCIES).map(function (k) { return { key: k, label: CURRENCIES[k].label }; }),
      function (it) { return it.key === state.currency; },
      function (it) {
        if (it.key === state.currency) return;
        var ratio = CURRENCIES[it.key].rate / CURRENCIES[state.currency].rate;
        state.currency = it.key;
        state.upfront = Math.round(state.upfront * ratio);
        state.monthly = Math.round(state.monthly * ratio);
        update();
      });

    segButtons($('oc-type'), ITEM_TYPES,
      function (it) { return it.id === state.type; },
      function (it) { tweak(); state.type = it.id; update(); });

    segButtons($('oc-bench'), BENCHMARKS,
      function (it) { return Math.abs(it.value - state.ret) < 0.01; },
      function (it) { tweak(); state.ret = it.value; update(); });
  }

  function bindInputs() {
    function num(el, key) {
      el.addEventListener('input', function () {
        var v = Math.max(0, Number(el.value) || 0);
        tweak(); state[key] = v; update();
      });
      el.addEventListener('blur', function () { el.value = state[key]; });
    }
    num($('oc-upfront'), 'upfront');
    num($('oc-monthly'), 'monthly');
    $('oc-upfront-range').addEventListener('input', function (e) { tweak(); state.upfront = Number(e.target.value); update(); });
    $('oc-monthly-range').addEventListener('input', function (e) { tweak(); state.monthly = Number(e.target.value); update(); });
    $('oc-return').addEventListener('input', function (e) { tweak(); state.ret = Number(e.target.value); update(); });
    $('oc-years').addEventListener('input', function (e) { state.years = Number(e.target.value); update(); });
    $('oc-real').addEventListener('click', function () { state.real = !state.real; update(); });
  }

  /* ---------- Result ---------- */
  function renderResult(sim) {
    var last = sim.last;
    $('oc-result-title').textContent = 'Opportunity cost after ' + state.years + ' years';
    $('oc-mult').textContent = last.cash > 0 ? sim.mult.toFixed(2) + '× the cash you put in' : '';
    $('oc-big').textContent = money(last.opp);
    $('oc-big-note').textContent = 'What the money could have grown into, minus what the item could still be sold for.';

    $('oc-invested').textContent = money(last.invested);
    var cashShare = last.invested > 0 ? Math.min(100, Math.round(last.cash / last.invested * 100)) : 0;
    $('oc-bar-cash').style.width = cashShare + '%';
    $('oc-bar-growth').style.width = (100 - cashShare) + '%';
    $('oc-cash-share').textContent = 'Your cash ' + money(last.cash);
    $('oc-growth-share').textContent = 'Growth ' + money(Math.max(0, sim.growth));

    $('oc-resale').textContent = money(last.resale);
    var resaleShare = last.invested > 0 ? Math.min(100, last.resale / last.invested * 100) : 0;
    $('oc-bar-resale').style.width = (last.resale > 0 ? Math.max(1.5, resaleShare) : 0) + '%';
    $('oc-resale-note').textContent = money(last.cash) + ' spent, ' +
      (last.resale > 0 ? money(last.resale) + ' left in resale value' : 'nothing left to sell');

    var more = state.upfront > 0 && sim.growth > state.upfront ? ', more than the item cost in the first place' : '';
    $('oc-note-growth').textContent = 'Over ' + state.years + ' years, compounding adds ' + money(Math.max(0, sim.growth)) +
      ' on top of what you put in' + more + '.';
    $('oc-note-rule').textContent = 'Under the common 4% rule, a portfolio of that size could pay out about ' +
      money(sim.monthlyAt4) + ' a month. The rule comes from studies of 30-year retirements, so treat it as a rough guide, not a promise.';

    $('oc-return-note').textContent = state.real
      ? 'About ' + sim.eff.toFixed(1) + '% after inflation'
      : 'Before inflation';

    var touch = window.matchMedia('(hover: none)').matches;
    $('oc-chart-caption').textContent = sim.cross
      ? 'From year ' + sim.cross + ', the yearly growth is larger than what you put in that year.'
      : (touch ? 'Tap the chart to compare years.' : 'Move over the chart to compare years.');
  }

  function renderTable(sim) {
    var tb = $('oc-tbody');
    tb.innerHTML = '';
    sim.rows.slice(1).forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.cross) tr.className = 'oc-cross';
      [
        'Year ' + r.year + (r.cross ? ' (tipping point)' : ''),
        money(r.cash), '+' + money(r.earned), money(r.invested), money(r.resale), money(r.opp)
      ].forEach(function (text, i) {
        var td = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) td.scope = 'row';
        td.textContent = text;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  /* ---------- Chart (plain SVG) ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= raw) return steps[i] * p;
    return 10 * p;
  }

  var chartSim = null;
  function renderChart(sim) {
    chartSim = sim;
    var box = $('oc-chart');
    box.innerHTML = '';
    var W = box.clientWidth || 600;
    var H = W < 520 ? 240 : 300;
    var padL = 58, padR = 14, padT = 12, padB = 30;
    var rows = sim.rows, n = rows.length - 1;

    var maxV = 0;
    rows.forEach(function (r) { maxV = Math.max(maxV, r.invested, r.cash, r.resale); });
    var step = maxV > 0 ? niceStep(maxV / 4) : 1;
    var top = maxV > 0 ? step * Math.ceil(maxV / step) : 4;

    function x(i) { return padL + (W - padL - padR) * i / n; }
    function y(v) { return padT + (H - padT - padB) * (1 - v / top); }

    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }, box);

    for (var v = 0; v <= top + 0.5; v += step) {
      el('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'oc-grid' }, svg);
      var t = el('text', { x: padL - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'oc-axis' }, svg);
      t.textContent = money(v, true);
    }
    var every = n <= 10 ? 1 : n <= 20 ? 2 : 5;
    for (var i = 0; i <= n; i += every) {
      var xt = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'oc-axis' }, svg);
      xt.textContent = i === 0 ? 'Now' : i;
    }

    function path(key) {
      return rows.map(function (r, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[key]).toFixed(1); }).join(' ');
    }
    el('path', { d: path('invested') + ' L' + x(n) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z', class: 'oc-area' }, svg);
    el('path', { d: path('cash'), class: 'oc-line-cash' }, svg);
    el('path', { d: path('resale'), class: 'oc-line-resale' }, svg);
    el('path', { d: path('invested'), class: 'oc-line-invest' }, svg);

    if (sim.cross) {
      el('circle', { cx: x(sim.cross), cy: y(rows[sim.cross].invested), r: 5, class: 'oc-cross-dot' }, svg);
    }

    /* Hover / tap read-out */
    var guide = el('line', { y1: padT, y2: H - padB, class: 'oc-guide' }, svg);
    var dots = ['invested', 'cash', 'resale'].map(function (k) {
      return { key: k, c: el('circle', { r: 4, class: 'oc-hdot oc-hdot-' + k }, svg) };
    });
    var tip = document.createElement('div');
    tip.className = 'oc-tip';
    box.appendChild(tip);
    var hit = el('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, fill: 'transparent' }, svg);

    function show(clientX) {
      var r = box.getBoundingClientRect();
      var rel = clientX - r.left;
      var i = Math.round((rel - padL) / ((W - padL - padR) / n));
      i = Math.max(0, Math.min(n, i));
      var row = rows[i];
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
      dots.forEach(function (d) { d.c.setAttribute('cx', x(i)); d.c.setAttribute('cy', y(row[d.key])); });
      box.classList.add('hover');
      tip.innerHTML = '';
      var head = document.createElement('strong');
      head.textContent = i === 0 ? 'Now' : 'Year ' + i + (row.cross ? ', tipping point' : '');
      tip.appendChild(head);
      [['If invested', row.invested], ['Cash put in', row.cash], ['Resale value', row.resale], ['Opportunity cost', row.opp]].forEach(function (p, k) {
        var line = document.createElement('span');
        if (k === 3) line.className = 'oc-tip-total';
        line.textContent = p[0] + ': ' + money(p[1]);
        tip.appendChild(line);
      });
      var tx = x(i) + 14;
      if (tx + 210 > W) tx = x(i) - 14 - 210;
      tip.style.left = Math.max(0, tx) + 'px';
      tip.style.top = padT + 'px';
    }
    function hide() { box.classList.remove('hover'); }

    hit.addEventListener('pointermove', function (e) { show(e.clientX); });
    hit.addEventListener('pointerdown', function (e) { show(e.clientX); });
    hit.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
  }

  /* ---------- Update everything ---------- */
  function update() {
    var sim = simulate();
    renderPresets();
    syncInputs();
    renderResult(sim);
    renderTable(sim);
    renderChart(sim);
  }

  bindInputs();
  update();

  var lastW = window.innerWidth, t;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(function () { if (chartSim) renderChart(chartSim); }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (chartSim) renderChart(chartSim); });
})();
