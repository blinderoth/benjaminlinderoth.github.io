(function () {
  var page = document.body.getAttribute('data-page') || '';
  var desktop = window.matchMedia('(min-width: 801px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Split headings into letters so each one can react to the cursor ---------- */
  var counter = 0;
  document.querySelectorAll('[data-split] .line').forEach(function (line) {
    var text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    Array.from(text).forEach(function (c) {
      if (c === ' ') { line.appendChild(document.createTextNode(' ')); return; }
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', counter++);
      s.textContent = c;
      line.appendChild(s);
    });
  });

  /* ---------- Detail pane: shows the text of whatever title was clicked ---------- */
  function openDetail(group, id, trigger) {
    var pane = group.querySelector('.pane');
    var detail = document.getElementById(id);
    if (!pane || !detail) return;

    group.querySelectorAll('.item, .clabel').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      var li = b.closest('li');
      if (li) li.classList.remove('open');
    });
    group.querySelectorAll('.bar').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-id') === id);
    });
    trigger.setAttribute('aria-expanded', 'true');
    var li = trigger.closest('li');
    if (li) li.classList.add('open');
    group.setAttribute('data-active', id);

    pane.innerHTML = detail.innerHTML;
    pane.classList.remove('swap');
    void pane.offsetWidth;
    pane.classList.add('swap');

    if (group.classList.contains('has-chart') && !desktop.matches) {
      pane.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  /* Plain title lists (Personal page): details open on the right, or under the title on phones. */
  document.querySelectorAll('[data-pane-group]:not([data-chart])').forEach(function (group) {
    group.querySelectorAll('.item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-expanded') === 'true' && !desktop.matches) {
          btn.setAttribute('aria-expanded', 'false');
          btn.closest('li').classList.remove('open');
          return;
        }
        openDetail(group, btn.getAttribute('aria-controls'), btn);
      });
    });
  });

  /* ---------- Duration charts (Projects, Experience) ----------
     Each title in the hidden source list carries:
       data-start="YYYY-MM"  data-end="YYYY-MM" or "present"  data-kind="work|study|student|professional"
     Bars are drawn to scale, overlapping items go in parallel columns,
     and quiet stretches longer than six months are compressed (dashed line). */
  var NS = 'http://www.w3.org/2000/svg';
  var LANE = 12, LANE_GAP = 7, AXIS_W = 44, GAP = 46, PAD = 6;

  function monthOf(str, nowM) {
    if (str === 'present') return nowM;
    var p = str.split('-');
    return (+p[0]) * 12 + (+p[1]) - 1;
  }

  function buildChart(group) {
    var host = group.querySelector('.chart-host');
    var src = group.querySelector('.chart-src');
    var PX = +(group.getAttribute('data-px') || 10);
    var now = new Date();
    var nowM = now.getFullYear() * 12 + now.getMonth();

    var items = Array.from(src.querySelectorAll('.item[data-start]')).map(function (b) {
      return {
        id: b.getAttribute('aria-controls'),
        title: b.textContent.trim(),
        s: monthOf(b.getAttribute('data-start'), nowM),
        e: monthOf(b.getAttribute('data-end'), nowM) + 1,
        kind: b.getAttribute('data-kind') || 'work'
      };
    });

    /* Columns: put each item in the first column that is free when it starts. */
    var sorted = items.slice().sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var laneEnds = [];
    sorted.forEach(function (it) {
      var l = 0;
      while (l < laneEnds.length && laneEnds[l] > it.s) l++;
      it.lane = l;
      laneEnds[l] = it.e;
    });
    var nLanes = laneEnds.length;

    /* Active stretches of time; gaps over six months get compressed. */
    var segs = [];
    sorted.forEach(function (it) {
      var last = segs[segs.length - 1];
      if (last && it.s - last.e <= 6) last.e = Math.max(last.e, it.e);
      else segs.push({ s: it.s, e: it.e });
    });
    segs.reverse(); /* newest at the top */
    var y = PAD;
    segs.forEach(function (sg) { sg.top = y; sg.h = (sg.e - sg.s) * PX; y += sg.h + GAP; });
    var chartH = y - GAP + PAD;
    function yAt(t) {
      for (var i = 0; i < segs.length; i++) {
        if (t >= segs[i].s && t <= segs[i].e) return segs[i].top + (segs[i].e - t) * PX;
      }
      return 0;
    }

    host.innerHTML = '';

    var legendSpec = group.getAttribute('data-legend');
    if (legendSpec) {
      var legend = document.createElement('ul');
      legend.className = 'legend';
      legendSpec.split('|').forEach(function (pair) {
        var kv = pair.split(':');
        var li = document.createElement('li');
        var sw = document.createElement('i');
        sw.className = 'k-' + kv[0];
        li.appendChild(sw);
        li.appendChild(document.createTextNode(kv[1]));
        legend.appendChild(li);
      });
      host.appendChild(legend);
    }

    var chart = document.createElement('div');
    chart.className = 'chart';
    host.appendChild(chart);

    var width = chart.clientWidth;
    var lanesX = AXIS_W + 10;
    var lanesEnd = lanesX + nLanes * (LANE + LANE_GAP) - LANE_GAP;
    var labelX = lanesEnd + 24;
    var labelW = Math.max(120, width - labelX);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    chart.appendChild(svg);
    function line(x1, y1, x2, y2, cls) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('class', cls);
      svg.appendChild(l);
      return l;
    }

    /* Time axis, compressed gaps and year marks. */
    segs.forEach(function (sg, i) {
      line(AXIS_W, sg.top, AXIS_W, sg.top + sg.h, 'axis');
      if (i < segs.length - 1) line(AXIS_W, sg.top + sg.h, AXIS_W, segs[i + 1].top, 'axis gap');
    });
    var lastYearY = -100;
    segs.forEach(function (sg) {
      for (var Y = Math.floor((sg.e - 1) / 12); Y >= Math.floor(sg.s / 12); Y--) {
        if (Y * 12 > sg.s) line(AXIS_W - 4, yAt(Y * 12), lanesEnd, yAt(Y * 12), 'grid');
        var spanTop = yAt(Math.min(sg.e, (Y + 1) * 12));
        if (spanTop - lastYearY < 16) continue;
        var yr = document.createElement('div');
        yr.className = 'yr';
        yr.textContent = Y;
        yr.style.top = (spanTop + 2) + 'px';
        chart.appendChild(yr);
        lastYearY = spanTop;
      }
    });

    /* Bars and their titles. */
    var byId = {};
    items.forEach(function (it) {
      byId[it.id] = it;
      it.top = yAt(it.e);
      var bottom = yAt(it.s);

      var bar = document.createElement('div');
      bar.className = 'bar k-' + it.kind;
      bar.setAttribute('data-id', it.id);
      bar.style.left = (lanesX + it.lane * (LANE + LANE_GAP)) + 'px';
      bar.style.top = it.top + 'px';
      bar.style.height = Math.max(4, bottom - it.top - 1) + 'px';
      chart.appendChild(bar);
      it.bar = bar;

      var lab = document.createElement('button');
      lab.type = 'button';
      lab.className = 'clabel';
      lab.setAttribute('data-id', it.id);
      lab.setAttribute('aria-expanded', 'false');
      lab.textContent = it.title;
      lab.style.left = labelX + 'px';
      lab.style.width = labelW + 'px';
      chart.appendChild(lab);
      it.label = lab;
    });

    /* Place titles next to the top of their bar. Where titles would overlap,
       they are grouped and the group is centred on where its titles want to be. */
    var clusters = items.slice()
      .sort(function (a, b) { return a.top - b.top || a.lane - b.lane; })
      .map(function (it) {
        var n = { it: it, want: it.top - 3, h: it.label.offsetHeight + 6 };
        return { nodes: [n], top: n.want, h: n.h };
      });
    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < clusters.length - 1; i++) {
        var a = clusters[i], b = clusters[i + 1];
        if (a.top + a.h > b.top) {
          var all = a.nodes.concat(b.nodes), off = 0, sum = 0;
          all.forEach(function (n) { sum += n.want - off; off += n.h; });
          clusters.splice(i, 2, { nodes: all, top: Math.max(0, sum / all.length), h: a.h + b.h });
          merged = true;
          break;
        }
      }
    }
    var next = 0;
    clusters.forEach(function (c) {
      var yy = c.top;
      c.nodes.forEach(function (n) {
        n.it.label.style.top = yy + 'px';
        n.it.labelTop = yy;
        yy += n.h;
      });
      next = yy;
    });
    chartH = Math.max(chartH, next);
    chart.style.height = chartH + 'px';
    svg.style.height = chartH + 'px';

    /* Thin lines linking each bar to its title. */
    items.forEach(function (it) {
      var x1 = lanesX + it.lane * (LANE + LANE_GAP) + LANE + 3;
      it.lead = line(x1, it.top + 5, labelX - 6, it.labelTop + 11, 'lead');
    });

    /* Hover and click. */
    function hl(it, on) {
      it.label.classList.toggle('hl', on);
      it.bar.classList.toggle('hl', on);
      it.lead.classList.toggle('hl', on);
    }
    items.forEach(function (it) {
      [it.label, it.bar].forEach(function (el) {
        el.addEventListener('mouseenter', function () { hl(it, true); });
        el.addEventListener('mouseleave', function () { hl(it, false); });
      });
      it.bar.addEventListener('click', function () { it.label.click(); });
      it.label.addEventListener('click', function () { openDetail(group, it.id, it.label); });
    });

    /* Keep the selection after a redraw. */
    var active = group.getAttribute('data-active');
    if (active && byId[active]) {
      byId[active].label.setAttribute('aria-expanded', 'true');
      byId[active].bar.classList.add('active');
    }
  }

  var charts = Array.from(document.querySelectorAll('[data-pane-group][data-chart]'));
  charts.forEach(function (group) {
    group.querySelector('.chart-src').hidden = true;
    group.classList.add('has-chart');
    buildChart(group);
  });
  function rebuildAll() { charts.forEach(buildChart); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuildAll);
  var lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildAll, 150);
  });

  /* ---------- Cursor effects: only with a real pointer, and not for reduced motion ---------- */
  (function cursor() {
    var ok = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion;
    if (!ok) return;

    var ring = document.querySelector('.ring');
    var letters = Array.from(document.querySelectorAll('.name .ch'));
    var x = -100, y = -100, rx = -100, ry = -100, started = false;

    window.addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!started) { rx = x; ry = y; started = true; ring.classList.add('on'); }
      letters.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        el.style.setProperty('--t', Math.max(0, 1 - d / 170).toFixed(3));
      });
    });
    document.addEventListener('pointerleave', function () {
      ring.classList.remove('on');
      started = false;
      letters.forEach(function (el) { el.style.setProperty('--t', 0); });
    });
    document.addEventListener('pointerover', function (e) {
      ring.classList.toggle('link', !!e.target.closest('a, button, .bar'));
    });
    document.addEventListener('pointerdown', function () { ring.classList.add('down'); });
    document.addEventListener('pointerup', function () { ring.classList.remove('down'); });

    (function loop() {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      requestAnimationFrame(loop);
    })();
  })();

  /* ---------- Easter eggs: only on the main page ---------- */
  if (page === 'home') {
    /* Type "nudge" anywhere. */
    var buf = '';
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === 'nudge') window.location.href = 'personal.html';
    });

    /* Click the B in the name three times. */
    var firstLetter = document.querySelector('[data-split] .ch');
    if (firstLetter) {
      var clicks = 0, timer;
      firstLetter.addEventListener('click', function () {
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(function () { clicks = 0; }, 1500);
        if (clicks >= 3) window.location.href = 'personal.html';
      });
    }
  }

  /* Hint for anyone who opens the console. */
  console.log(
    '%cLooking around?',
    'font: 600 15px Georgia, serif; color: #2F45E0;',
    '\nThere is a page that is not on the CV. Try typing the word "nudge" anywhere on the site.'
  );
})();
