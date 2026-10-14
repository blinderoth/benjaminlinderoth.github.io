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

    group.querySelectorAll('.item').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      var li = b.closest('li');
      if (li) li.classList.remove('open');
    });
    group.querySelectorAll('.dur').forEach(function (d) {
      d.classList.toggle('active', d.getAttribute('data-id') === id);
    });
    trigger.setAttribute('aria-expanded', 'true');
    var li = trigger.closest('li');
    if (li) li.classList.add('open');
    group.setAttribute('data-active', id);

    pane.innerHTML = detail.innerHTML;
    pane.classList.remove('swap');
    void pane.offsetWidth;
    pane.classList.add('swap');
  }

  /* Title lists: details open on the right, or under the title on phones. */
  document.querySelectorAll('[data-pane-group]').forEach(function (group) {
    group.querySelectorAll('.item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-expanded') === 'true' && !desktop.matches) {
          btn.setAttribute('aria-expanded', 'false');
          btn.closest('li').classList.remove('open');
          group.querySelectorAll('.dur').forEach(function (d) { d.classList.remove('active'); });
        } else {
          openDetail(group, btn.getAttribute('aria-controls'), btn);
        }
        /* On phones the text opens under the title, so the lines need redrawing. */
        if (typeof redrawDurations === 'function') requestAnimationFrame(redrawDurations);
      });
    });
  });

  /* ---------- Duration lines beside the Projects and Experience timelines ----------
     Each title carries data-start="YYYY-MM" and data-end="YYYY-MM" (or "present").
     A slim line to the left of the timeline runs from the start month to the end month,
     and overlapping items get their own line side by side. */
  var LINE_STEP = 8;

  function monthOf(str, nowM) {
    if (str === 'present') return nowM;
    var p = str.split('-');
    return (+p[0]) * 12 + (+p[1]) - 1;
  }

  function drawDurations(wrap) {
    var tl = wrap.querySelector('.tl');
    var buttons = Array.from(tl.querySelectorAll('.item[data-start]'));
    var now = new Date();
    var nowM = now.getFullYear() * 12 + now.getMonth();

    var items = buttons.map(function (b) {
      return {
        id: b.getAttribute('aria-controls'),
        btn: b,
        s: monthOf(b.getAttribute('data-start'), nowM),
        e: monthOf(b.getAttribute('data-end'), nowM) + 1
      };
    });

    /* Side-by-side lines: each item takes the first free lane. */
    var laneEnds = [];
    items.slice().sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); })
      .forEach(function (it) {
        var l = 0;
        while (l < laneEnds.length && laneEnds[l] > it.s) l++;
        it.lane = l;
        laneEnds[l] = it.e;
      });
    var nLanes = Math.max(1, laneEnds.length);
    var padLeft = nLanes * LINE_STEP + 18;
    wrap.style.paddingLeft = padLeft + 'px';

    /* Where each year starts and ends on the page.
       Years without a row (inside a dashed gap) are spread across the gap. */
    var base = wrap.getBoundingClientRect().top;
    var rows = Array.from(tl.children).map(function (li) {
      var r = li.getBoundingClientRect();
      return { y: +li.getAttribute('data-year'), top: r.top - base, bottom: r.bottom - base };
    });
    var B = {};
    rows.forEach(function (r, i) {
      var nx = rows[i + 1];
      if (B[r.y + 1] === undefined) B[r.y + 1] = r.top;
      var bot = (nx && nx.y === r.y - 1) ? nx.top : r.bottom;
      B[r.y] = bot;
      if (nx && nx.y < r.y - 1) {
        for (var k = r.y - 1; k > nx.y; k--) {
          B[k] = bot + (nx.top - bot) * (r.y - k) / (r.y - (nx.y + 1));
        }
      }
    });
    var maxY = rows[0].y, minY = rows[rows.length - 1].y;
    function yAt(t) {
      var Y = Math.floor(t / 12);
      if (Y > maxY) return B[maxY + 1];
      if (Y < minY) return B[minY];
      var frac = (t - Y * 12) / 12;
      return B[Y] + (B[Y + 1] - B[Y]) * frac;
    }

    var layer = wrap.querySelector('.dur-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'dur-layer';
      layer.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(layer, wrap.firstChild);
    }
    layer.innerHTML = '';

    items.forEach(function (it) {
      var top = yAt(it.e), bottom = yAt(it.s);
      var line = document.createElement('div');
      line.className = 'dur';
      line.setAttribute('data-id', it.id);
      line.style.left = (padLeft - 18 - it.lane * LINE_STEP) + 'px';
      line.style.top = top + 'px';
      line.style.height = Math.max(3, bottom - top - 2) + 'px';
      if (it.btn.getAttribute('aria-expanded') === 'true') line.classList.add('active');
      layer.appendChild(line);

      if (!it.btn.hasAttribute('data-dur-wired')) {
        it.btn.setAttribute('data-dur-wired', '');
        it.btn.addEventListener('mouseenter', function () { toggleHl(wrap, it.id, true); });
        it.btn.addEventListener('mouseleave', function () { toggleHl(wrap, it.id, false); });
      }
    });
  }

  function toggleHl(wrap, id, on) {
    wrap.querySelectorAll('.dur').forEach(function (d) {
      if (d.getAttribute('data-id') === id) d.classList.toggle('hl', on);
    });
  }

  var durWraps = Array.from(document.querySelectorAll('.tl-wrap'));
  function redrawDurations() { durWraps.forEach(drawDurations); }
  redrawDurations();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawDurations);
  var lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawDurations, 150);
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
