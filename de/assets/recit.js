/* Standby Atlas : l'accueil en scènes plein écran.
   Chaque cran de molette, chaque glissement de doigt ou chaque touche (flèches, Page, Espace) passe à la scène suivante ;
   pendant le passage, la scène qui part s'approche et s'efface, la suivante arrive du fond. Mouvement réduit : les scènes s'empilent. */
(function () {
  'use strict';
  var r = document.querySelector('[data-recit]');
  if (!r) return;
  var scenes = Array.prototype.slice.call(r.querySelectorAll('.scene'));
  // une scène peut compter plusieurs pages (la carte : Europe, région, site) ; n = nombre de pages
  var etapes = scenes.map(function (s) { return Math.max(1, +s.getAttribute('data-etapes') || 1); });
  var debuts = [], n = 0;
  etapes.forEach(function (m) { debuts.push(n); n += m; });
  r.style.setProperty('--n', n);
  var points = Array.prototype.slice.call(r.querySelectorAll('.recit-points button'));
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var carte = r.querySelector('[data-carte3d]');

  // hauteur réelle de l'en-tête (elle varie : encoche, taille du texte du téléphone) : chaque page commence juste dessous
  var tete = document.querySelector('.tete');
  function mesurerTete() {
    if (!tete) return;
    var h = Math.ceil(tete.getBoundingClientRect().height);
    if (h > 20 && h < 240) document.documentElement.style.setProperty('--tete', h + 'px');
  }
  mesurerTete();
  window.addEventListener('resize', mesurerTete);
  if (window.ResizeObserver && tete) new ResizeObserver(mesurerTete).observe(tete);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mesurerTete);

  // rangées de filtres qui défilent de côté : un fondu signale ce qui dépasse, à droite comme à gauche
  Array.prototype.slice.call(r.querySelectorAll('.c3-rangee')).forEach(function (rg) {
    function bords() {
      var reste = rg.scrollWidth - rg.clientWidth - rg.scrollLeft;
      rg.classList.toggle('g', rg.scrollLeft > 2);
      rg.classList.toggle('d', reste > 2);
    }
    rg.addEventListener('scroll', bords, { passive: true });
    window.addEventListener('resize', bords);
    bords(); setTimeout(bords, 600);
  });

  function avecCarte(f) { (function go(k) { if (carte && carte.c3 && carte.c3.demarrer) f(carte.c3); else if (k < 100) setTimeout(function () { go(k + 1); }, 80); })(0); }
  function vu(s) {
    if (s.classList.contains('vu')) return;
    s.classList.add('vu');
    if (s.hasAttribute('data-carte3d')) avecCarte(function (c) { c.demarrer(); });
    if (calme) s.querySelectorAll('[data-cible]').forEach(compter); // sinon : rejoués à chaque arrivée (jouer)
    if (s === sParc) parcAllumer();
  }

  // compteur rejouable : de zéro à la valeur, après un délai, sur une durée donnée
  function compte(el, delai, duree) {
    var cible = parseFloat(el.getAttribute('data-compte')), loc = document.documentElement.lang || 'en';
    var f = function (v) { return Math.round(v).toLocaleString(loc).replace(/ /g, ' '); };
    if (calme) { el.textContent = f(cible); return; }
    var jeton = (el._jeton || 0) + 1; el._jeton = jeton; el.textContent = f(0);
    var t0 = performance.now() + delai;
    (function pas(t) {
      if (el._jeton !== jeton) return;
      var k = Math.max(0, Math.min(1, (t - t0) / duree)), e = 1 - Math.pow(1 - k, 2);
      el.textContent = f(cible * e); if (k < 1) requestAnimationFrame(pas);
    })(performance.now());
  }
  // titres : chaque mot entre à son tour quand la page arrive
  function decouper(h) {
    if (h.getAttribute('data-mots')) return; h.setAttribute('data-mots', '1');
    var k = 0;
    Array.prototype.slice.call(h.childNodes).forEach(function (nd) {
      if (nd.nodeType === 3) {
        var frag = document.createDocumentFragment();
        nd.textContent.split(/(\s+)/).forEach(function (m) {
          if (!m) return;
          if (/^\s+$/.test(m)) { frag.appendChild(document.createTextNode(m)); return; }
          var sp = document.createElement('span'); sp.className = 'mot'; sp.style.setProperty('--w', k++); sp.textContent = m; frag.appendChild(sp);
        });
        h.replaceChild(frag, nd);
      } else if (nd.nodeType === 1) {
        var sp2 = document.createElement('span'); sp2.className = 'mot'; sp2.style.setProperty('--w', k++); h.replaceChild(sp2, nd); sp2.appendChild(nd);
      }
    });
  }
  // arrivée sur une page : titres, compteurs, parc du site, mur des documents se rejouent
  function jouer(el) {
    if (!el || calme) return;
    el.classList.remove('joue'); void el.offsetWidth; el.classList.add('joue');
    el.querySelectorAll('[data-cible]').forEach(compter);
    var fl = el.querySelector('.flotte');
    if (fl) { fl.classList.remove('allume'); void fl.offsetWidth; fl.classList.add('allume'); }
    el.querySelectorAll('[data-compte]').forEach(function (c) {
      if (c.closest('.fuite-stat')) compte(c, 1100, 70 * (+c.getAttribute('data-compte') || 1));
      else compte(c, 150, 1500);
    });
  }

  // compteurs : de zéro à la valeur, une seule fois
  function compter(el) {
    var cible = parseFloat(el.getAttribute('data-cible')), dec = +(el.getAttribute('data-dec') || 0), loc = document.documentElement.lang || 'en';
    var f = function (v) { return v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ /g, ' '); };
    if (calme) { el.textContent = f(cible); return; }
    var t0 = performance.now(), d = 1400;
    (function pas(t) { var k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = f(cible * e); if (k < 1) requestAnimationFrame(pas); })(t0);
  }

  // ---------------------------------------------------------------- parc de secours : un bloc pour dix groupes électrogènes.
  // Les blocs s'allument dans un ordre aléatoire ; à la page « moteurs », ceux dont la marque est citée volent se ranger
  // dans la barre de leur marque, les autres s'éteignent. Une seule couche (canvas) partagée par les deux scènes.
  var cvParc = r.querySelector('.parc-canvas'), sParc = r.querySelector('.s-parc'), sMot = r.querySelector('.s-moteurs');
  var PK = null, vue = r.querySelector('.recit-vue');
  function parcPreparer() {
    var ctx = cvParc && cvParc.getContext && cvParc.getContext('2d'); if (!ctx) return null;
    var N = +cvParc.getAttribute('data-blocs') || 500, M = [];
    try { M = JSON.parse(cvParc.getAttribute('data-marques') || '[]'); } catch (x) { M = []; }
    var g = 11; function alea() { g = (g * 16807) % 2147483647; return (g - 1) / 2147483646; }
    function melange() { var o = []; for (var i = 0; i < N; i++) o.push(i); for (var j = N - 1; j > 0; j--) { var q = Math.floor(alea() * (j + 1)), t = o[j]; o[j] = o[q]; o[q] = t; } return o; }
    var ordre = melange(), rang = new Array(N); ordre.forEach(function (b, k) { rang[b] = k; });
    var pioche = melange(), dest = new Array(N), place = new Array(N), retard = new Array(N), k = 0;
    for (var i = 0; i < N; i++) { dest[i] = -1; place[i] = 0; retard[i] = alea() * 0.38; }
    M.forEach(function (m, mi) { for (var x = 0; x < m[1] && k < N; x++, k++) { dest[pioche[k]] = mi; place[pioche[k]] = x; } });
    return { ctx: ctx, N: N, M: M, rang: rang, dest: dest, place: place, retard: retard, t0: -1, m: 0, W: 0, H: 0, barres: null };
  }
  function relatif(el) { var x = 0, y = 0, e = el; while (e && e !== vue) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return [x, y, el.offsetWidth, el.offsetHeight]; }
  function parcMesurer() {
    if (!PK) return;
    var W = PK.plein ? cvParc.clientWidth : vue.clientWidth, H = PK.plein ? cvParc.clientHeight : vue.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    PK.W = W; PK.H = H; cvParc.width = Math.round(W * dpr); cvParc.height = Math.round(H * dpr); PK.dpr = dpr;
    PK.barres = sMot ? Array.prototype.map.call(sMot.querySelectorAll('.m-barre'), relatif) : [];
  }
  function lisse(x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  var parcAttente = false;
  function parcDemander() { if (PK && !parcAttente) { parcAttente = true; requestAnimationFrame(parcDessiner); } }
  function parcDessiner(t) {
    parcAttente = false;
    if (!PK || cvParc.style.visibility === 'hidden') return;
    t = t || performance.now();
    var c = PK.ctx, W = PK.W, H = PK.H, N = PK.N;
    if (!W) return;
    c.setTransform(PK.dpr, 0, 0, PK.dpr, 0, 0); c.clearRect(0, 0, W, H);
    // champ isométrique : à droite sur grand écran, en haut sur téléphone
    var large = W >= 1000, fx = PK.plein ? 0 : large ? W * 0.36 : W * 0.02, fw = PK.plein ? W : large ? W * 0.63 : W * 0.96;
    var fy = PK.plein ? 0 : large ? H * 0.12 : 64, fh = PK.plein ? H : large ? H * 0.78 : H * 0.4;
    var C = Math.max(18, Math.round(Math.sqrt(N * 3.2))), R = Math.ceil(N / C);
    var a = Math.min(fw * 0.96 / (C + R), fh * 0.9 / ((C + R) / 2 + 3)), b = a / 2, h = b * 1.25, s = 0.78, hx = a * s, hy = b * s;
    var ox = fx + fw / 2 - (C - R) * a / 2, oy = fy + (fh - ((C + R) * b + h)) / 2 + h;
    var tombe = function (id) { if (calme) return 1; if (PK.t0 < 0) return 0; return Math.max(0, Math.min(1, (t - PK.t0 - PK.rang[id] / N * 1500) / 420)); };
    var m = PK.m, B = PK.barres || [], cols = 1;
    PK.M.forEach(function (x) { cols = Math.max(cols, Math.ceil(x[1] / 2)); });
    // lueur sous le champ
    var gl = c.createRadialGradient(fx + fw * 0.55, fy + fh * 0.5, 4, fx + fw * 0.55, fy + fh * 0.5, Math.max(fw, fh) * 0.62);
    gl.addColorStop(0, 'rgba(255,182,37,' + (0.08 * (1 - m)).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(255,182,37,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    for (var y = 0; y < R; y++) {
      for (var x = 0; x < C; x++) {
        var id = y * C + x; if (id >= N) break;
        var cx = ox + (x - y) * a, cy = oy + (x + y) * b, kf = m > 0.001 ? 1 : tombe(id), lit = kf > 0, d = PK.dest[id];
        if (kf < 1) {
          // emplacement vide (socle sombre), le bloc tombe dedans
          c.globalAlpha = 1; c.beginPath(); c.moveTo(cx, cy - b * s); c.lineTo(cx + a * s, cy); c.lineTo(cx, cy + b * s); c.lineTo(cx - a * s, cy); c.closePath();
          c.fillStyle = '#0E2740'; c.fill();
          if (!lit) continue;
          cy -= (1 - (1 - Math.pow(1 - kf, 3))) * 170;
        }
        var e = lisse((m - PK.retard[id]) / 0.62), alpha = 1, tx = cx, ty = cy, q = 0;
        var tb = d >= 0 ? B[d] : null;
        if (tb && tb[2] > 0) {
          var p = Math.min(tb[3] / 2, tb[2] / cols), col = Math.floor(PK.place[id] / 2), row = PK.place[id] % 2;
          tx = tb[0] + p * col + p / 2; ty = tb[1] + tb[3] / 2 + (row - 0.5) * p; q = p * 0.8;
        } else { alpha = 1 - e; tx = cx; ty = cy + 30; }
        if (alpha <= 0.01) continue;
        var px = cx + (tx - cx) * e, py = cy + (ty - cy) * e - Math.sin(Math.PI * e) * (tb ? 60 : 0);
        var hh = h * (1 - e);
        // sommet : losange isométrique qui devient un carré
        var c1 = [px + (0 - 0) * 1 + (-q / 2 - 0) * e, py - hh - hy * (1 - e) + (-q / 2) * e];
        var c2 = [px + hx * (1 - e) + (q / 2) * e, py - hh + (-q / 2) * e];
        var c3 = [px + (q / 2) * e, py - hh + hy * (1 - e) + (q / 2) * e];
        var c4 = [px - hx * (1 - e) + (-q / 2) * e, py - hh + (q / 2) * e];
        c.globalAlpha = alpha * (kf < 1 ? Math.min(1, kf * 1.8) : 1);
        if (hh > 0.3) {
          c.beginPath(); c.moveTo(c4[0], c4[1]); c.lineTo(c3[0], c3[1]); c.lineTo(c3[0], c3[1] + hh); c.lineTo(c4[0], c4[1] + hh); c.closePath();
          c.fillStyle = lit ? '#B97A08' : '#0C2238'; c.fill();
          c.beginPath(); c.moveTo(c2[0], c2[1]); c.lineTo(c3[0], c3[1]); c.lineTo(c3[0], c3[1] + hh); c.lineTo(c2[0], c2[1] + hh); c.closePath();
          c.fillStyle = lit ? '#D9950F' : '#102C46'; c.fill();
        }
        c.beginPath(); c.moveTo(c1[0], c1[1]); c.lineTo(c2[0], c2[1]); c.lineTo(c3[0], c3[1]); c.lineTo(c4[0], c4[1]); c.closePath();
        c.fillStyle = lit ? (tb && e > 0.5 ? '#FFB625' : '#FFC24A') : '#1A3A57'; c.fill();
      }
    }
    c.globalAlpha = 1;
    if (PK.t0 >= 0 && t - PK.t0 < 2050) parcDemander();
  }
  function parcAllumer() { if (PK && PK.t0 < 0) { PK.t0 = performance.now(); parcDemander(); } }

  PK = parcPreparer();
  if (calme) {
    if (PK && sParc) {
      sParc.insertBefore(cvParc, sParc.firstChild); PK.plein = true; cvParc.style.visibility = 'visible';
      var fixe = function () { parcMesurer(); PK.barres = []; parcDessiner(); };
      fixe(); window.addEventListener('resize', fixe);
    }
    scenes.forEach(vu);
    r.querySelectorAll('.flotte').forEach(function (f) { f.classList.add('allume'); });
    return;
  }
  r.classList.add('anime');
  var vue = r.querySelector('.recit-vue');
  function H() { return (vue && vue.offsetHeight) || window.innerHeight; } // une scène = 100svh, mesuré sur la page
  function debutRecit() { return r.getBoundingClientRect().top + window.scrollY; }
  var attente = false, courant = -1;
  // pages intérieures d'une scène : chaque bloc [data-etape] apparaît autour de sa page ; la carte suit la position
  function etapesScene(s, u) {
    s.style.setProperty('--u', u.toFixed(4));
    s.querySelectorAll('[data-etape]').forEach(function (b) {
      var j = +b.getAttribute('data-etape'), o = Math.max(0, Math.min(1, 1 - Math.abs(u - j) * 2.4));
      b.style.opacity = o.toFixed(3);
      b.style.visibility = o > 0.01 ? '' : 'hidden'; // jamais « visible » : un bloc ne doit pas rester apparent quand sa scène est cachée
      b.classList.toggle('etape-active', o > 0.5);
      if (o > 0.6) { var f = b.querySelector('.flotte'); if (f) f.classList.add('allume'); }
    });
    if (s === carte && carte.c3 && carte.c3.etape) carte.c3.etape(u);
  }
  function maj() {
    attente = false;
    var h = H(), prog = Math.max(0, Math.min(n - 1, (window.scrollY - debutRecit()) / h));
    for (var k = 0; k < scenes.length; k++) {
      var s0 = debuts[k], s1 = s0 + etapes[k] - 1;
      var s = scenes[k], d = prog < s0 ? prog - s0 : prog > s1 ? prog - s1 : 0, a = Math.abs(d);
      if (etapes[k] > 1 && a < 1) etapesScene(s, Math.max(0, Math.min(etapes[k] - 1, prog - s0)));
      if (a >= 1) {
        if (s.style.visibility !== 'hidden') { s.style.visibility = 'hidden'; s.style.setProperty('--o', '0'); s.classList.remove('active', 'transit'); }
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
    if (PK && sParc) {
      var kp = scenes.indexOf(sParc), km = sMot ? scenes.indexOf(sMot) : kp, p0 = debuts[kp], p1 = debuts[km];
      var hors = prog < p0 ? p0 - prog : prog > p1 ? prog - p1 : 0, mo = Math.max(0, Math.min(1, 1 - hors * 1.7));
      cvParc.style.opacity = mo.toFixed(3); cvParc.style.visibility = mo > 0.005 ? 'visible' : 'hidden';
      PK.m = p1 > p0 ? Math.max(0, Math.min(1, (prog - p0) / (p1 - p0))) : 0;
      if (mo > 0.005) parcDemander();
    }
    if (carte && carte.c3 && carte.c3.pause) {
      var kc = scenes.indexOf(carte), c0 = debuts[kc], c1 = c0 + etapes[kc] - 1;
      carte.c3.pause(prog <= c0 - 1 || prog >= c1 + 1);
    }
    var c = Math.round(prog);
    if (c !== courant) {
      courant = c;
      arrivee(c);
      points.forEach(function (b, i) { b.setAttribute('aria-current', i === c ? 'true' : 'false'); });
      r.setAttribute('data-scene-courante', c);
    }
  }

  // page c : scène k et, pour la carte, étape j ; l'élément qui « joue » est la scène ou le bloc de l'étape
  var suites = []; try { suites = JSON.parse(r.getAttribute('data-suites') || '[]'); } catch (x) { suites = []; }
  var suite = r.querySelector('.recit-suite'), suiteT = suite && suite.querySelector('.rs-t');
  function pageVers(c) {
    for (var k = scenes.length - 1; k >= 0; k--) if (c >= debuts[k]) return [k, c - debuts[k]];
    return [0, 0];
  }
  function arrivee(c) {
    var kj = pageVers(c), sc = scenes[kj[0]];
    jouer(etapes[kj[0]] > 1 ? sc.querySelector('[data-etape="' + kj[1] + '"]') : sc);
    if (suite) {
      var t = suites[c];
      if (t) { suiteT.textContent = t; suite.hidden = false; suite.classList.remove('neuf'); void suite.offsetWidth; suite.classList.add('neuf'); }
      else suite.hidden = true;
    }
  }
  if (suite) suite.addEventListener('click', function () { aller(courant + 1); });
  r.querySelectorAll('.scene h1, .scene h2, .scene .v7-geant').forEach(decouper);

  // ---------------------------------------------------------------- une scène par geste (molette, doigt, clavier)
  var anim = null, doigt = false, finDefil = null;
  function sceneDe(y) { return Math.max(0, Math.min(n - 1, Math.round((y - debutRecit()) / H()))); }
  function aller(k, vite) {
    k = Math.max(0, Math.min(n - 1, k));
    var de = window.scrollY, vers = Math.round(debutRecit() + k * H()), t0 = performance.now();
    var duree = vite ? 0 : Math.min(950, 520 + Math.abs(vers - de) / H() * 380);
    if (anim) cancelAnimationFrame(anim);
    if (Math.abs(vers - de) < 1) { anim = null; return; }
    var pose = de;
    (function pas(t) {
      // quelqu'un d'autre a fait défiler (barre de défilement, lien, autre geste) : on lui laisse la main
      if (Math.abs(window.scrollY - pose) > 3) { anim = null; caleBientot(); return; }
      var x = duree ? Math.min(1, (t - t0) / duree) : 1, e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      pose = Math.round(de + (vers - de) * e);
      window.scrollTo({ top: pose, behavior: 'instant' });
      pose = window.scrollY;
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
  if (PK) { r.classList.add('morph'); parcMesurer(); window.addEventListener('resize', function () { parcMesurer(); parcDemander(); }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { parcMesurer(); parcDemander(); }); }
  points.forEach(function (b, i) { b.addEventListener('click', function () { aller(i); }); });
  r.querySelectorAll('[data-aller]').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); aller(+a.getAttribute('data-aller')); });
  });
  maj();
})();
