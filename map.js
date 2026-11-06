/* Etapa 3 — Geoprocessamento de risco: mapa 20×20 km, PDC, lahares, andossolos e rotas de evacuação */
(function () {
  const T = THREE, A = APP, N = 1024, KM = N / 20;
  const VAL = [0.45, 2.55, 4.4];
  const TOWNS = [
    { n: 'Vila Fértil', r: 3.8, a: 1.25, pop: 4200 }, { n: 'Rio Bravo', r: 5.4, a: 0.5, pop: 2600 },
    { n: 'São Bento', r: 6.6, a: 2.6, pop: 3100 }, { n: 'Porto Seco', r: 7.6, a: 4.5, pop: 1800 }];
  const SHEL = [{ n: 'Abrigo A', r: 8.8, a: 1.6 }, { n: 'Abrigo B', r: 8.6, a: 3.5 }, { n: 'Abrigo C', r: 8.7, a: 5.5 }];
  const xy = o => [Math.cos(o.a) * o.r, Math.sin(o.a) * o.r];
  TOWNS.forEach(t => { [t.x, t.z] = xy(t); }); SHEL.forEach(s => { [s.x, s.z] = xy(s); });
  const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const vth = (i, r) => VAL[i] + 0.12 * Math.sin(r * 0.7 + i);
  const M = A.M = { origin: 1, pts: [], mode: 'bus', alert: 90, p: 0, walker: -1, result: null, sim: false, soil: false, hz: {}, clock: 0, report: [] };
  A.TOWNS = TOWNS; A.SHEL = SHEL;

  function height(x, z) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    let cut = 0; for (let i = 0; i < 3; i++) { const d = r * Math.abs(wrap(th - vth(i, r))); cut = Math.max(cut, Math.exp(-(d / 0.5) * (d / 0.5))); }
    return (2.2 * Math.pow(Math.max(0, 1 - r / 8.5), 1.5) + 0.12 * Math.sin(x * 1.3) * Math.cos(z * 1.1)) - cut * 0.3 * Math.min(1, r / 2);
  }
  function hazard() {
    const d = A.derive(), v = d.style.startsWith('efusiva') ? 1 : d.vei;
    const Rp = v <= 2 ? 0.7 : 1.6 + 0.65 * (v - 1);
    const Lr = Math.min(14, (2.5 + v) * (A.P.rain ? 1.5 : 1));
    return { v, Rp, Lr, w0: 0.35 + (A.P.rain ? 0.25 : 0), vei: d.vei, style: d.style };
  }
  const Rpdc = (th, h) => { let f = 0; VAL.forEach(a => { const d = wrap(th - a); f = Math.max(f, Math.exp(-(d / 0.3) * (d / 0.3))); }); return h.Rp * (0.5 + 0.75 * f); };
  function inPDC(x, z, h) { return Math.hypot(x, z) < Rpdc(Math.atan2(z, x), h); }
  function inLahar(x, z, h) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x); if (r < 0.5 || r > h.Lr) return 0;
    for (let i = 0; i < 3; i++) if (r * Math.abs(wrap(th - vth(i, r))) < h.w0 + 0.03 * r) return r; return 0;
  }

  A.initMap = function () {
    const g = A.mapG = new T.Group(); g.visible = false;
    const geo = new T.PlaneGeometry(20, 20, 100, 100); geo.rotateX(-Math.PI / 2);
    const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, height(pa.getX(i), pa.getZ(i)) * 0.55);
    geo.computeVertexNormals();
    M.cv = document.createElement('canvas'); M.cv.width = M.cv.height = N; M.ctx = M.cv.getContext('2d'); M.tex = new T.CanvasTexture(M.cv); M.tex.anisotropy = 4;
    A.mapMesh = new T.Mesh(geo, new T.MeshLambertMaterial({ map: M.tex })); g.add(A.mapMesh);
    const base = document.createElement('canvas'); base.width = base.height = 256; const b = base.getContext('2d'), im = b.createImageData(256, 256);
    for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
      const x = px / 12.8 - 10, z = py / 12.8 - 10, h = height(x, z), sh = height(x - 0.3, z - 0.3) - h, k = A.clamp(0.6 + sh * 2.2, 0.3, 1.2), i = (py * 256 + px) * 4;
      const t = A.clamp(h / 2.2, 0, 1); im.data[i] = (70 + 110 * t) * k; im.data[i + 1] = (130 + 40 * t - 30 * t * t) * k; im.data[i + 2] = (70 + 70 * t) * k; im.data[i + 3] = 255;
    }
    b.putImageData(im, 0, 0); M.base = base;
    const mk = (c) => new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.35, 8), new T.MeshBasicMaterial({ color: c }));
    M.walkerMesh = new T.Mesh(new T.SphereGeometry(0.18, 12, 10), new T.MeshBasicMaterial({ color: 0xffe14a })); M.walkerMesh.visible = false; g.add(M.walkerMesh);
    M.mapMask = [1];
    A.mapDirty = true;
  };

  const P2 = (x, z) => [(x + 10) * KM, (z + 10) * KM];
  function draw() {
    const c = M.ctx, h = hazard(); M.hz = h; c.clearRect(0, 0, N, N); c.imageSmoothingEnabled = true; c.drawImage(M.base, 0, 0, N, N);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (M.soil || A.P.soil) { c.fillStyle = 'rgba(70,40,20,.5)'; c.beginPath(); const o = P2(0, 0); c.arc(o[0], o[1], 6.4 * KM, 0, 7); c.arc(o[0], o[1], 1.4 * KM, 0, 7, true); c.fill('evenodd'); c.fillStyle = '#fff'; c.font = 'bold 26px system-ui'; c.fillText('Andossolos (solo vulcânico fértil)', P2(-4.8, -5.6)[0], P2(0, -5.6)[1]); }
    const p = M.p;
    if (p > 0) {
      const wd = h.Lr * p; // lahares
      c.strokeStyle = 'rgba(120,80,40,.8)'; c.fillStyle = c.strokeStyle;
      for (let i = 0; i < 3; i++) { c.beginPath(); for (let r = 0.6; r <= wd; r += 0.2) { const q = P2(Math.cos(vth(i, r)) * r, Math.sin(vth(i, r)) * r); r < 0.7 ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1]); } c.lineWidth = 2 * (h.w0 + 0.03 * wd * 0.5) * KM; c.stroke(); }
      c.fillStyle = 'rgba(214,40,40,.55)'; c.strokeStyle = '#ff6b6b'; c.lineWidth = 3; c.beginPath();
      for (let k = 0; k <= 180; k++) { const th = k / 180 * 6.2832, R = Rpdc(th, h) * Math.min(1, p * 1.6), q = P2(Math.cos(th) * R, Math.sin(th) * R); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,220,80,.22)'; c.beginPath(); // queda de cinzas a sotavento (vento p/ leste)
      for (let k = 0; k <= 40; k++) { const th = k / 40 * 6.2832, q = P2(2 + (2 + h.v) * p * (1 + Math.cos(th)) + 0 * th, Math.sin(th) * (1.1 + 0.4 * h.v) * p * 0.9); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.fill();
    }
    // grade, norte e escala
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; for (let k = -10; k <= 10; k += 2) { c.beginPath(); c.moveTo(P2(k, -10)[0], 0); c.lineTo(P2(k, 10)[0], N); c.moveTo(0, P2(0, k)[1]); c.lineTo(N, P2(0, k)[1]); c.stroke(); }
    // vulcão
    const v0 = P2(0, 0); c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(v0[0], v0[1] - 24); c.lineTo(v0[0] + 22, v0[1] + 16); c.lineTo(v0[0] - 22, v0[1] + 16); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
    // abrigos e vilas
    c.font = 'bold 26px system-ui'; c.textAlign = 'center';
    SHEL.forEach(s => { const q = P2(s.x, s.z); c.fillStyle = '#18a558'; c.fillRect(q[0] - 18, q[1] - 18, 36, 36); c.fillStyle = '#fff'; c.fillText('+', q[0], q[1] + 9); c.strokeStyle = 'rgba(24,165,88,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(q[0], q[1], 0.8 * KM, 0, 7); c.stroke(); c.fillText(s.n, q[0], q[1] + 50); });
    TOWNS.forEach((t, i) => { const q = P2(t.x, t.z); c.fillStyle = i === M.origin ? '#ffe14a' : '#fff'; c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.arc(q[0], q[1], i === M.origin ? 17 : 12, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText(t.n + ' (' + t.pop + ' hab.)', q[0], q[1] - 26); c.fillText(t.n + ' (' + t.pop + ' hab.)', q[0], q[1] - 26); });
    // rota
    const rt = route();
    if (rt.length > 1) { c.strokeStyle = '#ffe14a'; c.lineWidth = 8; c.setLineDash([22, 12]); c.beginPath(); rt.forEach((q, i) => { const w = P2(q[0], q[1]); i ? c.lineTo(w[0], w[1]) : c.moveTo(w[0], w[1]); }); c.stroke(); c.setLineDash([]); }
    M.pts.forEach(q => { const w = P2(q[0], q[1]); c.fillStyle = '#ffe14a'; c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(w[0], w[1], 9, 0, 7); c.fill(); c.stroke(); });
    c.fillStyle = '#fff'; c.font = 'bold 30px system-ui'; c.textAlign = 'left'; c.fillText('N ↑', 20, 44); c.fillRect(20, N - 50, 2 * KM, 6); c.fillText('2 km', 20, N - 58);
    M.tex.needsUpdate = true;
  }
  const route = () => { const t = TOWNS[M.origin]; return [[t.x, t.z]].concat(M.pts); };
  function samples() {
    const rt = route(), out = []; let s = 0;
    for (let i = 1; i < rt.length; i++) { const dx = rt[i][0] - rt[i - 1][0], dz = rt[i][1] - rt[i - 1][1], L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 0.15)); for (let k = 0; k < n; k++) out.push([rt[i - 1][0] + dx * k / n, rt[i - 1][1] + dz * k / n, s + L * k / n]); s += L; }
    const e = rt[rt.length - 1]; out.push([e[0], e[1], s]); return { out, len: s, end: e };
  }
  const SPD = { foot: 4 / 60, bus: 25 / 60 };
  A.mapEval = function () {
    const h = hazard(), sm = samples(), spd = SPD[M.mode], rep = [], res = { ok: false, score: 0 };
    if (M.pts.length < 1) { M.report = ['Clique no mapa para criar pontos da rota. A rota começa na vila de origem.']; return M.report; }
    let pdcKm = 0, lahKm = 0;
    sm.out.forEach(q => {
      const t = q[2] / spd, tau = t - M.alert; // minutos após a erupção
      if (tau >= 0 && inPDC(q[0], q[1], h)) pdcKm += 0.15;
      const lr = inLahar(q[0], q[1], h); if (lr && tau >= lr / 0.33) lahKm += 0.15;
    });
    const sh = SHEL.find(s => Math.hypot(sm.end[0] - s.x, sm.end[1] - s.z) < 0.8), tmin = sm.len / spd;
    rep.push('Distância: ' + sm.len.toFixed(1) + ' km · tempo ' + Math.round(tmin) + ' min (alerta: ' + M.alert + ' min antes da erupção).');
    rep.push(sh ? 'Chegada: ' + sh.n + ' ✔' : 'A rota ainda não termina em um abrigo ✖ (termine dentro do círculo verde).');
    rep.push(pdcKm > 0.1 ? 'Exposição a corrente piroclástica: ' + pdcKm.toFixed(1) + ' km ✖' : 'Sem exposição a corrente piroclástica ✔');
    rep.push(lahKm > 0.1 ? 'Exposição a lahar: ' + lahKm.toFixed(1) + ' km ✖ (evite os vales)' : 'Sem exposição a lahar ✔');
    res.ok = !!sh && pdcKm <= 0.1 && lahKm <= 0.1;
    res.score = (sh ? 40 : 0) + (pdcKm <= 0.1 ? 30 : 0) + (lahKm <= 0.1 ? 30 : 0);
    rep.push(res.ok ? 'Evacuação bem-sucedida! Pontuação ' + res.score + '/100.' : 'Pontuação ' + res.score + '/100. Ajuste a rota, o meio de transporte ou use zonas de perigo da simulação.');
    if (sh) A.mark('route'); if (res.ok && M.sim) A.mark('safe');
    M.result = res; M.report = rep; return rep;
  };
  A.map = {
    click(x, z) {
      if (Math.abs(x) > 10 || Math.abs(z) > 10) return;
      const s = SHEL.find(s => Math.hypot(x - s.x, z - s.z) < 0.8); M.pts.push(s ? [s.x, s.z] : [x, z]); M.walker = -1; A.mapEval(); A.mapDirty = A.dirty = true;
    },
    undo() { M.pts.pop(); M.walker = -1; A.mapEval(); A.mapDirty = A.dirty = true; },
    clear() { M.pts = []; M.walker = -1; M.report = []; M.result = null; A.mapDirty = A.dirty = true; },
    origin(i) { M.origin = i; A.map.clear(); },
    simulate() { M.p = 0.001; M.sim = true; A.mark('sim'); },
    evacuate() { if (M.pts.length) { M.walker = 0; M.clock = 0; A.mapEval(); } },
    toggleSoil() { M.soil = !M.soil; A.mapDirty = A.dirty = true; }
  };
  A.mapUpdate = function (dt) {
    if (M.p > 0 && M.p < 1) { M.p = Math.min(1, M.p + dt / 7); A.mapDirty = true; }
    if (M.walker >= 0) {
      const sm = samples(), spd = SPD[M.mode]; M.clock += dt * 25; // 1 s real = 25 min
      const d = Math.min(sm.len, M.clock * spd); let i = 0; while (i < sm.out.length - 1 && sm.out[i][2] < d) i++;
      const q = sm.out[i]; M.walkerMesh.visible = true; M.walkerMesh.position.set(q[0], height(q[0], q[1]) * 0.55 + 0.25, q[1]);
      if (M.clock > M.alert && M.p === 0) { M.p = 0.001; M.sim = true; }
      if (d >= sm.len && M.clock > M.alert + 30) M.walker = -2;
    } else if (M.walker === -1) M.walkerMesh.visible = false;
    if (A.mapDirty) { draw(); A.mapDirty = false; }
  };
  A.mapHazard = hazard;
})();
