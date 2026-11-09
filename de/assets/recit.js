/* Standby Atlas : l'accueil en scènes plein écran.
   Chaque cran de molette, chaque glissement de doigt ou chaque touche (flèches, Page, Espace) passe à la scène suivante ;
   pendant le passage, la scène qui part s'approche et s'efface, la suivante arrive du fond. Mouvement réduit : les scènes s'empilent. */
(function () {
  'use strict';
  var r = document.querySelector('[data-recit]');
  if (!r) return;
  var scenes = Array.prototype.slice.call(r.querySelectorAll('.scene')), n = scenes.length;
  var points = Array.prototype.slice.call(r.querySelectorAll('.recit-points button'));
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var carte = r.querySelector('[data-carte3d]');

  function avecCarte(f) { (function go(k) { if (carte && carte.c3 && carte.c3.demarrer) f(carte.c3); else if (k < 100) setTimeout(function () { go(k + 1); }, 80); })(0); }
  function vu(s) {
    if (s.classList.contains('vu')) return;
    s.classList.add('vu');
    if (s.hasAttribute('data-carte3d')) avecCarte(function (c) { c.demarrer(); });
    s.querySelectorAll('[data-cible]').forEach(compter);
    var pc = s.querySelector('.parc-canvas'); if (pc) parc(pc, true);
  }

  // compteurs : de zéro à la valeur, une seule fois
  function compter(el) {
    var cible = parseFloat(el.getAttribute('data-cible')), dec = +(el.getAttribute('data-dec') || 0), loc = document.documentElement.lang || 'en';
    var f = function (v) { return v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ /g, ' '); };
    if (calme) { el.textContent = f(cible); return; }
    var t0 = performance.now(), d = 1400;
    (function pas(t) { var k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = f(cible * e); if (k < 1) requestAnimationFrame(pas); })(t0);
  }

  // champ de groupes électrogènes : un bloc pour dix groupes, qui s'allument un à un
  function parc(cv, allumer) {
    var ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
    var N = +cv.getAttribute('data-blocs') || 500, C = Math.max(18, Math.round(Math.sqrt(N * 3.2))), R = Math.ceil(N / C);
    var ordre = []; for (var i = 0; i < N; i++) ordre.push(i);
    for (var j = N - 1; j > 0; j--) { var q = Math.floor(Math.random() * (j + 1)); var tmp = ordre[j]; ordre[j] = ordre[q]; ordre[q] = tmp; }
    var rang = new Array(N); ordre.forEach(function (b, k) { rang[b] = k; });
    var t0 = performance.now(), duree = calme || !allumer ? 0 : 1800;
    function dessiner(t) {
      var rc = cv.getBoundingClientRect(), W = rc.width, H = rc.height, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var a = Math.min(W * 0.96 / (C + R), H * 0.9 / ((C + R) / 2 + 3)), b = a / 2, h = b * 1.25, s = 0.78;
      var ox = W / 2 - (C - R) * a / 2, oy = (H - ((C + R) * b + h)) / 2 + h;
      var k = duree ? Math.min(1, (t - t0) / duree) : 1, allumes = Math.floor(k * N);
      for (var y = 0; y < R; y++) {
        for (var x = 0; x < C; x++) {
          var id = y * C + x; if (id >= N) break;
          var cx = ox + (x - y) * a, cy = oy + (x + y) * b, lit = rang[id] < allumes;
          var hx = a * s, hy = b * s;
          ctx.beginPath(); ctx.moveTo(cx, cy - h - hy); ctx.lineTo(cx + hx, cy - h); ctx.lineTo(cx, cy - h + hy); ctx.lineTo(cx - hx, cy - h); ctx.closePath();
          ctx.fillStyle = lit ? '#FFC24A' : '#1A3A57'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx - hx, cy - h); ctx.lineTo(cx, cy - h + hy); ctx.lineTo(cx, cy + hy); ctx.lineTo(cx - hx, cy); ctx.closePath();
          ctx.fillStyle = lit ? '#B97A08' : '#0C2238'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + hx, cy - h); ctx.lineTo(cx, cy - h + hy); ctx.lineTo(cx, cy + hy); ctx.lineTo(cx + hx, cy); ctx.closePath();
          ctx.fillStyle = lit ? '#D9950F' : '#102C46'; ctx.fill();
        }
      }
      if (k < 1) requestAnimationFrame(dessiner);
    }
    requestAnimationFrame(dessiner);
    if (!cv.dataset.ecoute) { cv.dataset.ecoute = '1'; window.addEventListener('resize', function () { duree = 0; requestAnimationFrame(dessiner); }); }
  }

  if (calme) {
    scenes.forEach(vu);
    return;
  }
  r.classList.add('anime');
  var vue = r.querySelector('.recit-vue');
  function H() { return (vue && vue.offsetHeight) || window.innerHeight; } // une scène = 100svh, mesuré sur la page
  function debutRecit() { return r.getBoundingClientRect().top + window.scrollY; }
  var attente = false, courant = -1;
  function maj() {
    attente = false;
    var h = H(), prog = Math.max(0, Math.min(n - 1, (window.scrollY - debutRecit()) / h));
    for (var k = 0; k < n; k++) {
      var s = scenes[k], d = prog - k, a = Math.abs(d);
      if (a >= 1) {
        if (s.style.visibility !== 'hidden') { s.style.visibility = 'hidden'; s.classList.remove('active', 'transit'); }
        continue;
      }
      s.style.visibility = 'visible';
      s.style.setProperty('--d', d.toFixed(4));
      s.style.setProperty('--a', a.toFixed(4));
      s.style.setProperty('--o', Math.max(0, 1 - a * 1.3).toFixed(4));
      s.classList.toggle('active', a < 0.5);
      s.classList.toggle('transit', a > 0.002);
      if (a < 0.4) vu(s);
    }
    if (carte && carte.c3 && carte.c3.pause) carte.c3.pause(Math.abs(prog - scenes.indexOf(carte)) >= 1);
    var c = Math.round(prog);
    if (c !== courant) {
      courant = c;
      points.forEach(function (b, i) { b.setAttribute('aria-current', i === c ? 'true' : 'false'); });
      r.setAttribute('data-scene-courante', c);
    }
  }

  // ---------------------------------------------------------------- une scène par geste (molette, doigt, clavier)
  var anim = null, doigt = false, finDefil = null;
  function sceneDe(y) { return Math.max(0, Math.min(n - 1, Math.round((y - debutRecit()) / H()))); }
  function aller(k, vite) {
    k = Math.max(0, Math.min(n - 1, k));
    var de = window.scrollY, vers = Math.round(debutRecit() + k * H()), t0 = performance.now();
    var duree = vite ? 0 : Math.min(950, 520 + Math.abs(vers - de) / H() * 380);
    if (anim) cancelAnimationFrame(anim);
    if (Math.abs(vers - de) < 1) { anim = null; return; }
    (function pas(t) {
      var x = duree ? Math.min(1, (t - t0) / duree) : 1, e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      window.scrollTo({ top: de + (vers - de) * e, behavior: 'instant' });
      anim = x < 1 ? requestAnimationFrame(pas) : null;
    })(t0);
  }
  // le récit mène tant qu'on est entre la première et la dernière scène ; avant et après, défilement normal
  function dansRecit(dir) {
    var y = window.scrollY, d0 = debutRecit(), fin = d0 + (n - 1) * H();
    if (y < d0 - 2) return false;
    if (dir < 0 && y <= d0 + 2) return false;
    if (y > fin + 2) return dir < 0 && y <= fin + H() * 0.2;
    if (dir > 0 && y >= fin - 2) return false; // dernière scène : on descend librement vers le pied de page
    return true;
  }
  function pas(dir) {
    var y = window.scrollY, fin = debutRecit() + (n - 1) * H();
    aller(y > fin + 2 ? n - 1 : sceneDe(y) + dir);
  }
  // une zone qui défile elle-même (liste de la fiche carte) garde la main tant qu'elle peut défiler
  function zoneDefilante(el, dir) {
    for (; el && el !== r && el.nodeType === 1; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        if (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
    }
    return false;
  }

  // molette et pavé tactile : un geste, une scène ; l'inertie du pavé ne compte pas comme un nouveau geste
  var hist = [], dernierEvt = 0;
  function moy(t, k) { var x = t.slice(-k), s = 0; for (var i = 0; i < x.length; i++) s += x[i]; return x.length ? s / x.length : 0; }
  window.addEventListener('wheel', function (ev) {
    if (ev.ctrlKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
    var dy = ev.deltaY * (ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? H() : 1), dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    if (!dir || zoneDefilante(ev.target, dir) || !dansRecit(dir)) return;
    ev.preventDefault();
    var t = performance.now();
    if (t - dernierEvt > 220) hist = [];
    dernierEvt = t;
    hist.push(Math.abs(dy)); if (hist.length > 60) hist.shift();
    if (anim) return;
    var somme = moy(hist, 60) * hist.length;
    if (somme < 10) return;                       // effleurement du pavé
    if (hist.length > 3 && moy(hist, 4) < moy(hist, 30) * 0.98) return; // l'élan retombe : c'est l'inertie
    hist = hist.slice(-3);
    pas(dir);
  }, { passive: false });

  // doigt : un glissement vertical franc passe à la scène suivante ; à l'horizontale, la carte tourne
  var t0y = null, t0x = null, mode = null;
  window.addEventListener('touchstart', function (ev) {
    doigt = true; clearTimeout(finDefil);
    if (ev.touches.length !== 1) { t0y = null; return; }
    t0y = ev.touches[0].clientY; t0x = ev.touches[0].clientX; mode = null;
  }, { passive: true });
  window.addEventListener('touchmove', function (ev) {
    if (t0y === null) return;
    var dy = t0y - ev.touches[0].clientY, dx = t0x - ev.touches[0].clientX;
    if (mode === null) {
      var dir = dy >= 0 ? 1 : -1;
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 4) mode = 'cote';           // horizontal : carte ou rangée de filtres
      else if (zoneDefilante(ev.target, dir) || !dansRecit(dir)) mode = 'natif';
      else mode = 'recit';
    }
    if (mode === 'recit' && ev.cancelable) ev.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', function (ev) {
    doigt = ev.touches.length > 0;
    if (t0y === null) return;
    var dy = t0y - ev.changedTouches[0].clientY, dx = t0x - ev.changedTouches[0].clientX, m = mode;
    t0y = null; mode = null;
    if (m === 'recit' && Math.abs(dy) > 34 && Math.abs(dy) > Math.abs(dx)) pas(dy > 0 ? 1 : -1);
    else if (m === 'recit') aller(sceneDe(window.scrollY));
    else caleBientot();
  }, { passive: true });
  window.addEventListener('touchcancel', function () { doigt = false; t0y = null; mode = null; caleBientot(); }, { passive: true });

  window.addEventListener('keydown', function (ev) {
    var t = ev.target; if (ev.defaultPrevented || t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var dir = { ArrowDown: 1, PageDown: 1, ' ': ev.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[ev.key];
    if (ev.key === 'Home' && window.scrollY <= debutRecit() + (n - 1) * H() + H()) { ev.preventDefault(); aller(0); return; }
    if (!dir || !dansRecit(dir)) return;
    ev.preventDefault();
    if (!anim) pas(dir);
  });

  // après un défilement libre (barre de défilement, élan depuis le pied de page, lien), on se recale sur la scène la plus proche
  function caler() {
    if (anim || doigt) return;
    var y = window.scrollY, d0 = debutRecit(), fin = d0 + (n - 1) * H();
    if (y <= d0 + 1 || y >= fin - 1) return;
    var k = sceneDe(y);
    if (Math.abs(y - (d0 + k * H())) > 2) aller(k);
  }
  function caleBientot() { clearTimeout(finDefil); finDefil = setTimeout(caler, 200); }
  var boutonSouris = false;
  window.addEventListener('mousedown', function () { boutonSouris = true; });
  window.addEventListener('mouseup', function () { boutonSouris = false; caleBientot(); });
  window.addEventListener('scroll', function () {
    if (!attente) { attente = true; requestAnimationFrame(maj); }
    if (!anim && !doigt && !boutonSouris) caleBientot();
  }, { passive: true });

  var largeur = window.innerWidth;
  window.addEventListener('resize', function () {
    maj();
    // la barre d'adresse du téléphone qui bouge ne change que la hauteur : on ne saute pas pour si peu
    if (window.innerWidth !== largeur) { largeur = window.innerWidth; if (!anim) aller(sceneDe(window.scrollY), true); }
  });
  points.forEach(function (b, i) { b.addEventListener('click', function () { aller(i); }); });
  r.querySelectorAll('[data-aller]').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); aller(+a.getAttribute('data-aller')); });
  });
  maj();
})();
