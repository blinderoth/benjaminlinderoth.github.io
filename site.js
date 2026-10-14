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

  /* ---------- Timelines with duration lines (Projects, Experience) ----------
     Titles sit under the year they ended. Each title carries
       data-start="YYYY-MM"  data-end="YYYY-MM" or "present".
     Selecting a title reveals any years its duration needs, then draws
     a slim line from the end date down to the start date. */
  function monthOf(str, nowM) {
    if (str === 'present') return nowM;
    var p = str.split('-');
    return (+p[0]) * 12 + (+p[1]) - 1;
  }

  var REVEAL_MS = reduceMotion ? 0 : 520;

  function Timeline(wrap) {
    var tl = wrap.querySelector('.tl');
    var now = new Date();
    var nowM = now.getFullYear() * 12 + now.getMonth();
    var info = {};
    var minY = Infinity, maxY = -Infinity;

    tl.querySelectorAll('.item[data-start]').forEach(function (b) {
      var s = monthOf(b.getAttribute('data-start'), nowM);
      var e = monthOf(b.getAttribute('data-end'), nowM) + 1;
      info[b.getAttribute('aria-controls')] = { s: s, e: e };
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
        var inner = document.createElement('div');
        inner.className = 'tl-inner';
        var label = document.createElement('p');
        label.className = 'tl-label';
        label.textContent = Y;
        var spacer = document.createElement('div');
        spacer.className = 'tl-spacer';
        inner.appendChild(label);
        inner.appendChild(spacer);
        li.appendChild(inner);
      }
      tl.appendChild(li); /* keeps rows in order, newest first */
      rows.push({ y: Y, li: li, extra: li.classList.contains('extra') });
    }

    var line = document.createElement('div');
    line.className = 'dur';
    line.setAttribute('aria-hidden', 'true');
    line.innerHTML = '<i class="cap top"></i><i class="cap bottom"></i>';
    wrap.appendChild(line);

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

    /* Page position of any month, based on the visible year rows. */
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

    function place(it, animate) {
      var top = yAt(it.e), bottom = yAt(it.s);
      line.classList.remove('grow');
      line.style.transition = 'none';
      line.style.top = top + 'px';
      line.style.height = Math.max(6, bottom - top) + 'px';
      void line.offsetWidth;
      if (animate) line.style.transition = '';
      line.classList.add('grow');
      if (!animate) { void line.offsetWidth; line.style.transition = ''; }
    }

    this.select = function (id) {
      if (id && id === current) return;
      var my = ++token;
      var hadLine = line.classList.contains('grow');
      line.classList.remove('grow');
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

  /* ---------- Detail pane: shows the text of whatever title was clicked ---------- */
  function openDetail(group, id, trigger) {
    var pane = group.querySelector('.pane');
    var detail = document.getElementById(id);
    if (!pane || !detail) return;

    group.querySelectorAll('.item').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      var li = b.closest('li');
      if (li) li.classList.remove('open');
    });
    trigger.setAttribute('aria-expanded', 'true');
    var li = trigger.closest('li');
    if (li) li.classList.add('open');

    pane.innerHTML = detail.innerHTML;
    pane.classList.remove('swap');
    void pane.offsetWidth;
    pane.classList.add('swap');
  }

  /* Title lists: details open on the right, or under the title on phones. */
  document.querySelectorAll('[data-pane-group]').forEach(function (group) {
    group.querySelectorAll('.item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('aria-controls');
        var closing = btn.getAttribute('aria-expanded') === 'true' && !desktop.matches;
        if (closing) {
          btn.setAttribute('aria-expanded', 'false');
          btn.closest('li').classList.remove('open');
        } else {
          openDetail(group, id, btn);
        }
        var myWrap = btn.closest('.tl-wrap');
        timelines.forEach(function (t) {
          if (!group.contains(t.wrap)) return;
          t.select(t.wrap === myWrap && !closing ? id : null);
        });
      });
    });
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
      ring.classList.toggle('link', !!e.target.closest('a, button'));
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
