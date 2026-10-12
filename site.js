(function () {
  var page = document.body.getAttribute('data-page') || '';

  /* Split headings into letters so each one can react to the cursor. */
  var lines = document.querySelectorAll('[data-split] .line');
  var counter = 0;
  lines.forEach(function (line) {
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

  /* Title lists with a detail pane (Projects, Experience). */
  var desktop = window.matchMedia('(min-width: 801px)');
  document.querySelectorAll('[data-pane-group]').forEach(function (group) {
    var pane = group.querySelector('.pane');
    var items = group.querySelectorAll('.item');
    items.forEach(function (btn) {
      var detail = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', function () {
        var wasOpen = btn.getAttribute('aria-expanded') === 'true';
        items.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          b.closest('li').classList.remove('open');
        });
        if (wasOpen && !desktop.matches) return; /* tap again to close on mobile */
        btn.setAttribute('aria-expanded', 'true');
        btn.closest('li').classList.add('open');
        pane.innerHTML = detail.innerHTML;
        pane.classList.remove('swap');
        void pane.offsetWidth;
        pane.classList.add('swap');
      });
    });
  });

  /* Cursor effects: only with a real pointer, and not for reduced motion. */
  (function cursor() {
    var ok = window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
             !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* Easter eggs: only on the main page. */
  if (page === 'home') {
    /* 1. Type "nudge" anywhere. */
    var buf = '';
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === 'nudge') window.location.href = 'personal.html';
    });

    /* 2. Click the B in the name three times. */
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

  /* 3. Hint for anyone who opens the console. */
  console.log(
    '%cLooking around?',
    'font: 600 15px Georgia, serif; color: #2F45E0;',
    '\nThere is a page that is not on the CV. Try typing the word "nudge" anywhere on the site.'
  );
})();
