/* Standby Atlas : carte 3D des projets (canvas 2D, sans bibliothèque).
   Chaque projet est une colonne de lumière posée sur l'Europe ; sa hauteur suit le nombre de groupes électrogènes.
   Tout le continent tient toujours dans le cadre : l'échelle est recalculée à chaque taille d'écran et pour tout l'angle de rotation.
   Si le canvas n'existe pas, la carte plate en SVG reste affichée. */
(function () {
  'use strict';
  var racine = document.querySelector('[data-carte3d]');
  var source = document.getElementById('carte3d-donnees');
  if (!racine || !source) return;
  var canvas = racine.querySelector('canvas.c3-canvas');
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  var D;
  try { D = JSON.parse(source.textContent); } catch (x) { return; }
  racine.classList.add('c3-vivante');
  racine.c3 = { projets: null }; // accès pour les tests automatiques

  var T = D.txt, P = D.projets, N = P.length;
  racine.c3.projets = P;
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CX = D.L / 2, CZ = D.H / 2;
  var AZ0 = -0.14, AZMIN = -0.55, AZMAX = 0.28, EL0 = 0.88, ELMIN = 0.6, ELMAX = 1.25, DIST = 1900;
  var vue = { az: AZ0, el: EL0 }, cible = { az: AZ0, el: EL0 };
  var W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0, cam = null;
  var KH = 14, LARG = 7.4; // hauteur par racine de groupes, largeur d'une colonne (unités de carte)
  var maxG = 0;
  P.forEach(function (p, i) {
    p.i = i; p.h = p.g ? KH * Math.sqrt(p.g) : 5; p.a = 1; p.v = 1; p.monte = calme ? 1 : 0;
    if (p.g > maxG) maxG = p.g;
  });
  // ordre de montée : dates de dépôt croissantes (le pipeline s'allume dans l'ordre où il est apparu)
  var parDate = P.slice().sort(function (a, b) { return (a.d || '0') < (b.d || '0') ? -1 : 1; });
  parDate.forEach(function (p, k) { p.t0 = 300 + k / N * 2600; });
  var attendre = racine.hasAttribute('data-attendre'), demarre = !attendre;
  var debut = attendre ? 1e15 : 0, choisi = -1, survol = -1, filtreM = 'tous', filtreE = 'tous', dernierRendu = 0, enVue = true;

  // ------------------------------------------------------------------ sprites (dégradés précalculés)
  function sprite(w, h, dessin) { var c = document.createElement('canvas'); c.width = w; c.height = h; dessin(c.getContext('2d'), w, h); return c; }
  var halo = sprite(64, 64, function (g, w) {
    var r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,182,37,0.9)'); r.addColorStop(0.25, 'rgba(255,170,30,0.35)'); r.addColorStop(1, 'rgba(255,150,20,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  var haloBlanc = sprite(64, 64, function (g, w) {
    var r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.3, 'rgba(255,220,150,0.45)'); r.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  function fut(c1, c2, c3) {
    return sprite(16, 256, function (g, w, h) {
      var l = g.createLinearGradient(0, 0, 0, h);
      l.addColorStop(0, c1); l.addColorStop(0.12, c2); l.addColorStop(1, c3);
      g.fillStyle = l; g.fillRect(0, 0, w, h);
      var s = g.createLinearGradient(0, 0, w, 0); // arrondi : bords plus sombres
      s.addColorStop(0, 'rgba(0,0,0,0.35)'); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = s; g.fillRect(0, 0, w, h);
    });
  }
  var futAmbre = fut('rgba(255,236,180,1)', 'rgba(255,190,60,0.95)', 'rgba(255,150,20,0.18)');
  var futBlanc = fut('rgba(255,255,255,1)', 'rgba(255,240,205,0.98)', 'rgba(255,200,110,0.35)');
  var futBleu = fut('rgba(220,238,250,0.9)', 'rgba(143,198,234,0.7)', 'rgba(143,198,234,0.1)');

  // ------------------------------------------------------------------ caméra et projection
  function faireCam(az, el) {
    var ce = Math.cos(el), se = Math.sin(el), ca = Math.cos(az), sa = Math.sin(az);
    var c = [DIST * ce * sa, DIST * se, DIST * ce * ca];
    var n = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
    var f = [-c[0] / n, -c[1] / n, -c[2] / n];
    var r = [-f[2], 0, f[0]], rn = Math.sqrt(r[0] * r[0] + r[2] * r[2]); r = [r[0] / rn, 0, r[2] / rn];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { c: c, f: f, r: r, u: u };
  }
  // renvoie [x, y, z] : coordonnées écran avant ajustement, z = profondeur
  function pr(k, x, y, z) {
    var vx = x - CX - k.c[0], vy = y - k.c[1], vz = z - CZ - k.c[2];
    var zc = vx * k.f[0] + vy * k.f[1] + vz * k.f[2];
    return [(vx * k.r[0] + vy * k.r[1] + vz * k.r[2]) / zc * 1000, -(vx * k.u[0] + vy * k.u[1] + vz * k.u[2]) / zc * 1000, zc];
  }
  // échantillon des contours pour le cadrage (une fois)
  var ech = [];
  if (D.ech) { for (var e0 = 0; e0 < D.ech.length; e0 += 2) ech.push([D.ech[e0], 0, D.ech[e0 + 1]]); }
  else D.terres.forEach(function (a) { for (var i = 0; i < a.length; i += 16) ech.push([a[i], 0, a[i + 1]]); });
  P.forEach(function (p) { if (p.g) ech.push([p.x, p.h, p.y]); }); // le haut des colonnes doit rester dans le cadre
  function zoneUtile() {
    if (W >= 1000 && racine.hasAttribute('data-decale')) {
      var rc = canvas.getBoundingClientRect(), droite = 0;
      racine.querySelectorAll('[data-c3-gauche]').forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.width) droite = Math.max(droite, r.right - rc.left);
      });
      var x0 = Math.min(W * 0.5, Math.max(W * 0.3, droite + 28));
      return { x0: x0, x1: W - 16, y0: H * 0.08, y1: H * 0.97 };
    }
    var rc2 = canvas.getBoundingClientRect(), haut = H * 0.1, bas = H * 0.98;
    racine.querySelectorAll('[data-c3-haut]').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.height && r.bottom - rc2.top < H * 0.5) haut = Math.max(haut, r.bottom - rc2.top + 10); });
    racine.querySelectorAll('[data-c3-bas]').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.height && r.top - rc2.top > H * 0.5) bas = Math.min(bas, r.top - rc2.top - 6); });
    return { x0: W * 0.02, x1: W * 0.98, y0: haut, y1: Math.max(haut + 160, bas) };
  }
  function bornes(k) {
    var b = [1e9, 1e9, -1e9, -1e9];
    for (var i = 0; i < ech.length; i++) {
      var q = pr(k, ech[i][0], ech[i][1], ech[i][2]);
      if (q[0] < b[0]) b[0] = q[0]; if (q[0] > b[2]) b[2] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[1] > b[3]) b[3] = q[1];
    }
    return b;
  }
  var bornesRef = null, Sv = 0;
  function cadrer() { bornesRef = zoneUtile(); Sv = 0; }
  function centrer(k) {
    var b = bornes(k), z = bornesRef;
    var s = Math.min((z.x1 - z.x0) / (b[2] - b[0]), (z.y1 - z.y0) / (b[3] - b[1]));
    S = Sv ? Sv + (s - Sv) * 0.2 : s; Sv = S;
    OX = (z.x0 + z.x1) / 2 - (b[0] + b[2]) / 2 * S;
    OY = (z.y0 + z.y1) / 2 - (b[1] + b[3]) / 2 * S;
  }
  function ecran(k, x, y, z) { var q = pr(k, x, y, z); return [q[0] * S + OX, q[1] * S + OY, q[2]]; }

  // ------------------------------------------------------------------ taille
  function taille() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(280, r.width); H = Math.max(220, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    racine.classList.toggle('c3-large', W >= 1000);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    cadrer();
    demander();
  }

  // ------------------------------------------------------------------ dessin
  function dessiner(t) {
    var k = faireCam(vue.az, vue.el); cam = k; centrer(k);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    // graticule
    ctx.strokeStyle = 'rgba(143,198,234,0.09)'; ctx.lineWidth = 1; ctx.beginPath();
    D.grille.forEach(function (l) {
      for (var i = 0; i < l.length; i += 2) { var q = ecran(k, l[i], 0, l[i + 1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    });
    ctx.stroke();
    // terres : une plaque épaisse (tranche sombre décalée vers le bas), puis le dessus et les côtes
    var ep = Math.max(2, 9 * S * 1000 / DIST);
    var chemin = new Path2D();
    D.terres.forEach(function (a) {
      for (var i = 0; i < a.length; i += 2) { var q = ecran(k, a[i], 0, a[i + 1]); if (i) chemin.lineTo(q[0], q[1]); else chemin.moveTo(q[0], q[1]); }
      chemin.closePath();
    });
    ctx.save(); ctx.translate(0, ep); ctx.fillStyle = '#030D17'; ctx.fill(chemin); ctx.restore();
    var gr = ctx.createRadialGradient(W * 0.6, H * 0.45, 10, W * 0.6, H * 0.45, Math.max(W, H) * 0.75);
    gr.addColorStop(0, '#13385A'); gr.addColorStop(1, '#0A2440');
    ctx.fillStyle = gr; ctx.fill(chemin);
    ctx.strokeStyle = 'rgba(143,198,234,0.42)'; ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; ctx.stroke(chemin);
    // villes repères (sous le point, avec un contour sombre pour rester lisibles au-dessus des terres)
    var petites = W < 640;
    ctx.font = '600 ' + (petites ? 10 : 11.5) + 'px Archivo, Arial, sans-serif'; ctx.textBaseline = 'top';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,26,44,0.85)';
    D.villes.forEach(function (v) {
      if (!v.p || (petites && !v.pp)) return;
      var q = ecran(k, v.x, 0, v.y);
      ctx.fillStyle = 'rgba(231,238,245,0.6)'; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3);
      ctx.strokeText(v.n, q[0] + 5, q[1] + 4); ctx.fillStyle = 'rgba(231,238,245,0.7)'; ctx.fillText(v.n, q[0] + 5, q[1] + 4);
    });
    // colonnes, de la plus lointaine à la plus proche
    var liste = [];
    for (var i = 0; i < N; i++) {
      var p = P[i];
      var m = calme ? 1 : !demarre ? 0 : Math.max(0, Math.min(1, (t - debut - p.t0) / 750));
      p.monte = m;
      if (m <= 0) continue;
      var e = 1 - Math.pow(1 - m, 3);
      var b = ecran(k, p.x, 0, p.y);
      var hh = p.h * e * (0.14 + 0.86 * p.a);
      var s2 = ecran(k, p.x, hh, p.y);
      p.sb = b; p.st = s2;
      liste.push(p);
    }
    liste.sort(function (a, b) { return b.sb[2] - a.sb[2]; });
    ctx.globalCompositeOperation = 'lighter';
    for (var j = 0; j < liste.length; j++) {
      var p2 = liste[j], b2 = p2.sb, t2 = p2.st, ech2 = S * 1000 / b2[2];
      var lw = Math.max(1.6, LARG * ech2), alpha = 0.1 + 0.9 * p2.a;
      var vif = p2.i === choisi || p2.i === survol;
      ctx.globalAlpha = alpha * (p2.g ? 0.55 : 0.35);
      var rh = (p2.g ? 10 + 3.2 * Math.sqrt(p2.g) : 6) * ech2;
      ctx.drawImage(vif ? haloBlanc : halo, b2[0] - rh, b2[1] - rh * 0.55, rh * 2, rh * 1.1);
      var y0 = Math.min(t2[1], b2[1] - 1);
      ctx.globalAlpha = alpha;
      ctx.drawImage(vif ? futBlanc : p2.g ? futAmbre : futBleu, (b2[0] + t2[0]) / 2 - lw / 2, y0, lw, b2[1] - y0);
      ctx.globalAlpha = alpha * (vif ? 1 : 0.8);
      var rc = lw * (vif ? 2.6 : 1.7);
      ctx.drawImage(vif ? haloBlanc : halo, t2[0] - rc, t2[1] - rc, rc * 2, rc * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // repère du projet choisi : anneau au sol
    if (choisi >= 0 && P[choisi].sb) {
      var c = P[choisi], ec = S * 1000 / c.sb[2], rr = (14 + 2.5 * Math.sqrt(c.g || 4)) * ec;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(c.sb[0], c.sb[1], rr, rr * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // grand écran : la fiche suit la colonne choisie, sans sortir du cadre
    if (fiche && W >= 1000 && choisi >= 0 && P[choisi].st) {
      var fw = fiche.offsetWidth, fh = fiche.offsetHeight, top0 = P[choisi].st;
      var fx = top0[0] + 22, fy = top0[1] - fh * 0.35;
      if (fx + fw > W - 12) fx = top0[0] - fw - 22;
      fx = Math.max(12, Math.min(W - fw - 12, fx)); fy = Math.max(64, Math.min(H - fh - 12, fy));
      fiche.style.transform = 'translate(' + Math.round(fx) + 'px,' + Math.round(fy) + 'px)';
    } else if (fiche) { fiche.style.transform = ''; }
    // date de la montée
    if (!calme && lecture) {
      var dern = null;
      for (var z2 = parDate.length - 1; z2 >= 0; z2--) { if (parDate[z2].monte > 0) { dern = parDate[z2]; break; } }
      var texte = dern && dern.d ? dern.d.slice(0, 7) : '';
      if (texte !== lecture.dataset.v) { lecture.dataset.v = texte; lecture.textContent = texte ? T.jusqua.replace('{d}', moisAn(dern.d)) : ''; }
    }
  }
  function moisAn(d) { var m = T.mois[+d.slice(5, 7) - 1]; return m + ' ' + d.slice(0, 4); }

  // ------------------------------------------------------------------ boucle
  var anime = false, interaction = 0;
  function enCours(t) {
    if (calme || !demarre) return false;
    if (t - debut < 3800) return true;
    for (var i = 0; i < N; i++) if (Math.abs(P[i].a - P[i].v) > 0.004) return true;
    if (Math.abs(vue.az - cible.az) > 0.0005 || Math.abs(vue.el - cible.el) > 0.0005) return true;
    return t - interaction > 2600; // balancement lent quand personne ne touche la carte
  }
  function image(t) {
    anime = false;
    if (!enVue || pauseExt) return;
    // transitions
    for (var i = 0; i < N; i++) { var p = P[i]; p.a += (p.v - p.a) * 0.14; }
    if (!calme && t - interaction > 2600 && !glisse) {
      cible.az = AZ0 + Math.sin((t - interaction) / 9000) * 0.2;
    }
    vue.az += (cible.az - vue.az) * 0.12; vue.el += (cible.el - vue.el) * 0.12;
    var presse = t - debut < 3800 || glisse || Math.abs(vue.az - cible.az) > 0.002;
    if (presse || t - dernierRendu > 33) { dessiner(t); dernierRendu = t; }
    if (enCours(t)) demander();
  }
  function demander() { if (!anime) { anime = true; requestAnimationFrame(image); } }

  // ------------------------------------------------------------------ fiche et filtres
  var fiche = racine.querySelector('.c3-fiche'), lecture = racine.querySelector('.c3-date'), totaux = racine.querySelector('.c3-totaux');
  function fmt(n) { return Number(n).toLocaleString(D.loc).replace(/ /g, ' '); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function visibles() { return P.filter(function (p) { return p.v > 0.5; }).sort(function (a, b) { return (b.g || 0) - (a.g || 0) || (a.d < b.d ? 1 : -1); }); }
  function montrer(i, groupe) {
    choisi = i; demander();
    if (!fiche) return;
    fiche.classList.toggle('vide', i < 0);
    if (i < 0) { fiche.innerHTML = '<p class="c3-invite">' + esc(T.invite) + '</p>'; return; }
    var p = P[i], v = visibles(), rang = v.indexOf(p);
    var h = '<button type="button" class="c3-fermer" data-fermer aria-label="' + esc(T.fermer) + '">×</button>';
    h += '<p class="c3-lieu">' + esc(p.l) + '</p><h3 class="c3-nom">' + esc(p.t) + '</h3>';
    // seuls les chiffres écrits dans le dossier s'affichent ; aucun tiret à la place d'un chiffre absent
    var cases = (p.g ? '<div class="ambre"><dt>' + esc(T.groupes) + '</dt><dd>' + fmt(p.g) + '</dd></div>' : '') + (p.th ? '<div><dt>' + esc(T.thermique) + '</dt><dd>' + esc(p.th) + '</dd></div>' : '');
    h += cases ? '<dl class="c3-chiffres">' + cases + '</dl>' : '<p class="c3-nd">' + esc(T.non_dit) + '</p>';
    h += '<p class="c3-etat"><span class="c3-pastille ' + p.q + '"></span>' + esc(p.e) + (p.dl ? ', ' + esc(p.dl) : '') + '</p>';
    h += '<p class="c3-moteurs"><span>' + esc(T.moteurs) + '</span> ' + esc(p.m.length ? p.m.join(', ') : T.non_cite) + '</p>';
    if (groupe && groupe.length > 1) {
      h += '<div class="c3-groupe"><p>' + esc(T.ici.replace('{n}', groupe.length)) + '</p><ul>' + groupe.slice(0, 8).map(function (q) {
        return '<li><button type="button" data-i="' + q.i + '"' + (q.i === i ? ' aria-current="true"' : '') + '>' + esc(q.t) + (q.g ? '<span>' + fmt(q.g) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul></div>';
    }
    h += '<div class="c3-pied"><a class="c3-ouvrir" href="' + esc(D.racine + 'projects/' + p.s + '/') + '">' + esc(T.ouvrir) + '</a>';
    h += '<div class="c3-nav"><button type="button" data-pas="-1" aria-label="' + esc(T.prec) + '">‹</button><span>' + (rang + 1) + ' / ' + v.length + '</span><button type="button" data-pas="1" aria-label="' + esc(T.suiv) + '">›</button></div></div>';
    fiche.innerHTML = h;
  }
  if (fiche) fiche.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-fermer')) { montrer(-1); return; }
    if (b.dataset.i) { montrer(+b.dataset.i, null); return; }
    var v = visibles(); if (!v.length) return;
    var r = choisi >= 0 ? v.indexOf(P[choisi]) : -1;
    var n = (r + (+b.dataset.pas) + v.length) % v.length;
    montrer(v[n].i, null); interaction = performance.now();
  });
  function appliquer() {
    var n = 0, g = 0;
    P.forEach(function (p) {
      var okM = filtreM === 'tous' || (filtreM === 'aucune' ? !p.m.length : filtreM === 'autres' ? p.m.some(function (m) { return D.autres.indexOf(m) >= 0; }) : p.m.indexOf(filtreM) >= 0);
      var okE = filtreE === 'tous' || p.q === filtreE;
      p.v = okM && okE ? 1 : 0;
      if (p.v) { n++; g += p.g || 0; }
    });
    if (totaux) totaux.textContent = T.totaux.replace('{n}', fmt(n)).replace('{g}', fmt(g));
    if (choisi >= 0) montrer(P[choisi].v < 0.5 ? -1 : choisi, null);
    demander();
  }
  racine.querySelectorAll('[data-filtre]').forEach(function (b) {
    b.addEventListener('click', function () {
      var type = b.dataset.filtre;
      racine.querySelectorAll('[data-filtre="' + type + '"]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (type === 'm') filtreM = b.dataset.v; else filtreE = b.dataset.v;
      appliquer(); interaction = performance.now();
    });
  });

  // ------------------------------------------------------------------ pointeur : glisser pour tourner, toucher pour choisir
  var glisse = false, depart = null;
  function proches(x, y, rayon) {
    var out = [];
    for (var i = 0; i < N; i++) {
      var p = P[i]; if (!p.sb || p.v < 0.5) continue;
      var bx = p.sb[0], by = p.sb[1], tx = p.st[0], ty = p.st[1];
      var dx = bx - tx, dy = by - ty, l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((x - tx) * dx + (y - ty) * dy) / l2)) : 0;
      var d = Math.hypot(x - (tx + u * dx), y - (ty + u * dy));
      if (d <= rayon) out.push({ p: p, d: d });
    }
    out.sort(function (a, b) { return a.d - b.d; });
    return out;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    depart = { x: ev.clientX, y: ev.clientY, az: cible.az, el: cible.el, type: ev.pointerType };
    glisse = false; interaction = performance.now();
  });
  canvas.addEventListener('pointermove', function (ev) {
    var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (depart) {
      var dx = ev.clientX - depart.x, dy = ev.clientY - depart.y;
      if (!glisse && Math.hypot(dx, dy) > 6) glisse = true;
      if (glisse) {
        cible.az = Math.max(AZMIN, Math.min(AZMAX, depart.az - dx * 0.0042));
        if (depart.type === 'mouse') cible.el = Math.max(ELMIN, Math.min(ELMAX, depart.el + dy * 0.003));
        interaction = performance.now(); demander();
      }
      return;
    }
    if (ev.pointerType === 'mouse') {
      var c = proches(x, y, 12), s = c.length ? c[0].p.i : -1;
      if (s !== survol) { survol = s; canvas.style.cursor = s >= 0 ? 'pointer' : 'grab'; demander(); }
    }
  });
  function fin(ev) {
    if (!depart) return;
    var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (!glisse && ev.type === 'pointerup') {
      var c = proches(x, y, depart.type === 'mouse' ? 14 : 24);
      if (c.length) {
        var groupe = proches(c[0].p.st[0], (c[0].p.sb[1] + c[0].p.st[1]) / 2, 22).map(function (o) { return o.p; });
        montrer(c[0].p.i, groupe.length > 1 ? groupe : null);
      } else if (choisi >= 0) montrer(-1);
    }
    depart = null; glisse = false; interaction = performance.now(); demander();
  }
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', function () { depart = null; glisse = false; });
  canvas.addEventListener('pointerleave', function () { if (survol >= 0) { survol = -1; demander(); } });

  // ------------------------------------------------------------------ démarrage
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (x) { enVue = x.isIntersecting; if (enVue) demander(); }); }, { threshold: 0.05 }).observe(racine);
  }
  window.addEventListener('resize', function () { clearTimeout(taille.t); taille.t = setTimeout(taille, 120); });
  function demarrer() { if (demarre) return; demarre = true; debut = performance.now(); interaction = debut; demander(); }
  racine.c3.demarrer = demarrer;
  var pauseExt = false;
  racine.c3.pause = function (b) { if (b === pauseExt) return; pauseExt = b; if (!b) demander(); };
  function lancer() { taille(); if (!attendre) { debut = performance.now(); } interaction = performance.now(); appliquer(); montrer(-1); demander(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lancer); else lancer();
})();
