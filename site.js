(function () {
  var page = document.body.getAttribute('data-page') || '';
  var desktop = window.matchMedia('(min-width: 801px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  /* ---------- Dates ---------- */
  var now = new Date();
  var nowM = now.getFullYear() * 12 + now.getMonth();
  function monthOf(str) {
    if (str === 'present') return nowM;
    var p = str.split('-');
    return (+p[0]) * 12 + (+p[1]) - 1;
  }
  function monthLabel(m) { return MONTHS[m % 12] + ' ' + Math.floor(m / 12); }
  function durationText(months) {
    var y = Math.floor(months / 12), m = months % 12, out = [];
    if (y) out.push(y + (y === 1 ? ' year' : ' years'));
    if (m) out.push(m + (m === 1 ? ' month' : ' months'));
    return out.join(', ');
  }
  function slugify(text) {
    return text.toLowerCase().replace(/&/g, 'and').replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* ---------- Timelines with duration lines (Projects, Experience) ----------
     Titles sit under the year they ended. Each title carries
       data-start="YYYY-MM"  data-end="YYYY-MM" or "present".
     Selecting a title reveals any years its duration needs, then draws
     a slim line from the end date down to the start date. */
  var REVEAL_MS = reduceMotion ? 0 : 520;

  function Timeline(wrap) {
    var tl = wrap.querySelector('.tl');
    var info = {};
    var minY = Infinity, maxY = -Infinity;

    tl.querySelectorAll('.item[data-start]').forEach(function (b) {
      var endRaw = b.getAttribute('data-end');
      var s = monthOf(b.getAttribute('data-start'));
      var e = monthOf(endRaw) + 1;
      info[b.getAttribute('aria-controls')] = {
        s: s, e: e,
        startText: monthLabel(s),
        endText: endRaw === 'present' ? 'Now' : monthLabel(e - 1)
      };
      minY = Math.min(minY, Math.floor(s / 12));
      maxY = Math.max(maxY, Math.floor((e - 1) / 12));
    });

    /* Add a hidden row for every year that has no titles of its own. */
    var have = {};
    Array.from(tl.children).forEach(function (li) { have[+li.getAttribute('data-year')] = li; });
    var rows = [];
    for (var Y = maxY; Y >= minY; Y--) {
      var li = have[Y];
      if (!li) {
        li = document.createElement('li');
        li.className = 'tl-year extra';
        li.setAttribute('data-year', Y);
        li.setAttribute('aria-hidden', 'true');
        li.innerHTML = '<div class="tl-inner"><p class="tl-label">' + Y + '</p><div class="tl-spacer"></div></div>';
      }
      tl.appendChild(li); /* keeps rows in order, newest first */
      rows.push({ y: Y, li: li, extra: li.classList.contains('extra') });
    }

    var line = document.createElement('div');
    line.className = 'dur';
    line.setAttribute('aria-hidden', 'true');
    line.innerHTML = '<i class="cap top"></i><i class="cap bottom"></i>';
    wrap.appendChild(line);

    var dateTop = document.createElement('span');
    dateTop.className = 'dur-date top';
    dateTop.setAttribute('aria-hidden', 'true');
    var dateBottom = document.createElement('span');
    dateBottom.className = 'dur-date bottom';
    dateBottom.setAttribute('aria-hidden', 'true');
    wrap.appendChild(dateTop);
    wrap.appendChild(dateBottom);

    var current = null, token = 0;

    function visibleRows() {
      return rows.filter(function (r) { return !r.extra || r.li.classList.contains('shown'); });
    }

    /* Dashed line wherever years are skipped; no line below the last visible year. */
    function updateJumps() {
      var vis = visibleRows();
      rows.forEach(function (r) { r.li.classList.remove('jump', 'end'); });
      vis.forEach(function (r, i) {
        var nx = vis[i + 1];
        if (nx && nx.y < r.y - 1) r.li.classList.add('jump');
        if (!nx) r.li.classList.add('end');
      });
    }

    /* Position of any month, based on the visible year rows. */
    function yAt(t) {
      var base = wrap.getBoundingClientRect().top;
      var vis = visibleRows().map(function (r) {
        var b = r.li.getBoundingClientRect();
        return { y: r.y, top: b.top - base, bottom: b.bottom - base };
      });
      var B = {};
      vis.forEach(function (r, i) {
        var nx = vis[i + 1];
        if (B[r.y + 1] === undefined) B[r.y + 1] = r.top;
        var bot = (nx && nx.y === r.y - 1) ? nx.top : r.bottom;
        B[r.y] = bot;
        if (nx && nx.y < r.y - 1) {
          for (var k = r.y - 1; k > nx.y; k--) {
            B[k] = bot + (nx.top - bot) * (r.y - k) / (r.y - (nx.y + 1));
          }
        }
      });
      var hi = vis[0].y, lo = vis[vis.length - 1].y;
      var Yr = Math.floor(t / 12);
      if (Yr > hi) return B[hi + 1];
      if (Yr < lo) return B[lo];
      return B[Yr] + (B[Yr + 1] - B[Yr]) * ((t - Yr * 12) / 12);
    }

    function hideLine() {
      [line, dateTop, dateBottom].forEach(function (el) { el.classList.remove('grow', 'on'); });
    }

    function place(it, animate) {
      var top = yAt(it.e), bottom = yAt(it.s);
      var height = Math.max(6, bottom - top);
      [line, dateTop, dateBottom].forEach(function (el) {
        el.classList.remove('grow', 'on');
        el.style.transition = 'none';
      });
      line.style.top = top + 'px';
      line.style.height = height + 'px';
      dateTop.textContent = it.endText;
      dateBottom.textContent = it.startText;
      dateTop.style.top = (top + 3) + 'px';
      dateBottom.style.top = (top + height - 3) + 'px';
      void line.offsetWidth;
      if (animate) [line, dateTop, dateBottom].forEach(function (el) { el.style.transition = ''; });
      line.classList.add('grow');
      dateTop.classList.add('on');
      dateBottom.classList.add('on');
      if (!animate) {
        void line.offsetWidth;
        [line, dateTop, dateBottom].forEach(function (el) { el.style.transition = ''; });
      }
    }

    this.has = function (id) { return !!info[id]; };

    this.select = function (id) {
      if (id && id === current) return;
      var my = ++token;
      var hadLine = line.classList.contains('grow');
      hideLine();
      current = id || null;

      var it = id ? info[id] : null;
      var need = {};
      if (it) {
        for (var y = Math.floor(it.s / 12); y <= Math.floor((it.e - 1) / 12); y++) need[y] = true;
      }
      var changed = false;
      rows.forEach(function (r) {
        if (!r.extra) return;
        var on = !!need[r.y];
        if (r.li.classList.contains('shown') !== on) {
          r.li.classList.toggle('shown', on);
          changed = true;
        }
      });
      updateJumps();
      if (!it) return;

      var delay = changed ? REVEAL_MS : (hadLine && !reduceMotion ? 200 : 30);
      setTimeout(function () {
        if (my !== token) return;
        place(it, !reduceMotion);
      }, delay);
    };

    this.refresh = function () {
      if (current && info[current]) place(info[current], false);
    };

    updateJumps();
  }

  var timelines = [];
  document.querySelectorAll('.tl-wrap').forEach(function (wrap) {
    var t = new Timeline(wrap);
    t.wrap = wrap;
    timelines.push(t);
  });
  function refreshAll() { timelines.forEach(function (t) { t.refresh(); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshAll);
  var lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 150);
  });

  /* Durations under the date line of each Projects/Experience entry, and a link name for each. */
  var usedSlugs = { overview: 1, projects: 1, experience: 1, interests: 1, top: 1 };
  var slugToBtn = {};
  document.querySelectorAll('.tl-wrap .item[data-start]').forEach(function (b) {
    var detail = document.getElementById(b.getAttribute('aria-controls'));
    var months = monthOf(b.getAttribute('data-end')) + 1 - monthOf(b.getAttribute('data-start'));
    if (detail && months > 0) {
      var span = document.createElement('p');
      span.className = 'span';
      span.textContent = durationText(months);
      var where = detail.querySelector('.where');
      if (where) where.insertAdjacentElement('afterend', span);
      else detail.insertBefore(span, detail.querySelector('h3') ? detail.querySelector('h3').nextSibling : detail.firstChild);
    }
    var slug = slugify(b.textContent), n = 2, base = slug;
    while (usedSlugs[slug]) slug = base + '-' + (n++);
    usedSlugs[slug] = 1;
    b.setAttribute('data-slug', slug);
    slugToBtn[slug] = b;
  });

  /* ---------- Interactive Flowchart Simulator ---------- */
  var fcTimers = [];
  function clearFlowTimers() {
    fcTimers.forEach(clearTimeout);
    fcTimers = [];
  }

  function clearFlowHighlights(widget) {
    clearFlowTimers();
    widget.classList.remove('running');
    var label = widget.querySelector('.fc-run-label');
    if (label) label.textContent = 'Run trace';
    widget.querySelectorAll('.trace-active, .trace-done, .sub-active').forEach(function (el) {
      el.classList.remove('trace-active', 'trace-done', 'sub-active');
    });
  }

  function runFlowTrace(widget) {
    if (widget.classList.contains('running')) {
      clearFlowHighlights(widget);
      return;
    }
    clearFlowHighlights(widget);
    widget.classList.add('running');
    var label = widget.querySelector('.fc-run-label');
    if (label) label.textContent = 'Tracing...';

    var activeTrack = widget.querySelector('.fc-track.active');
    if (!activeTrack) return;

    var nodes = Array.from(activeTrack.querySelectorAll('.fc-node'));
    var arrows = Array.from(activeTrack.querySelectorAll('.fc-arrow'));
    var isAuto = activeTrack.getAttribute('data-fc-panel') === 'auto';
    var stepTime = isAuto ? 450 : 380;
    var elapsed = 0;

    nodes.forEach(function (node, idx) {
      fcTimers.push(setTimeout(function () {
        nodes.forEach(function (n) { n.classList.remove('trace-active'); });
        node.classList.add('trace-active', 'trace-done');
        if (arrows[idx - 1]) arrows[idx - 1].classList.add('trace-done');

        /* If subroutine node has internal steps, rapid-fire highlight them */
        var subSteps = Array.from(node.querySelectorAll('.fc-sub-pipeline span'));
        if (subSteps.length) {
          subSteps.forEach(function (s, sIdx) {
            fcTimers.push(setTimeout(function () {
              subSteps.forEach(function (item) { item.classList.remove('sub-active'); });
              s.classList.add('sub-active');
            }, (sIdx + 1) * 160));
          });
        }
      }, elapsed));

      var subCount = node.querySelectorAll('.fc-sub-pipeline span').length;
      elapsed += stepTime + (subCount ? subCount * 170 : 0);
    });

    fcTimers.push(setTimeout(function () {
      nodes.forEach(function (n) { n.classList.remove('trace-active'); });
      node.classList && nodes[nodes.length - 1].querySelectorAll('.sub-active').forEach(function (s) { s.classList.remove('sub-active'); });
      widget.querySelectorAll('.sub-active').forEach(function (s) { s.classList.remove('sub-active'); });
      widget.classList.remove('running');
      if (label) label.textContent = 'Replay trace';
    },