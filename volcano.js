/* Estratovulcão: cone (forma depende da viscosidade), câmara magmática, erupção (efusiva/explosiva), PDC e lahar */
(function () {
  const T = THREE, A = APP;
  const VX = 3, GY = 0.46; // posição do vulcão e topo do solo
  let cone, chamber, dike, glow, light, lastKey = '';
  const V = A.V = { t: -1, dur: 0, mode: 'efusiva', act: 0, H: 2, R: 3.4, k: 1, cr: 0.35, lahar: 0, acc: { a: 0, f: 0, p: 0, l: 0, v: 0 } };

  A.coneY = r => r >= V.R ? 0 : V.H * Math.pow(1 - r / V.R, V.k);
  A.craterPos = new T.Vector3(VX, GY + 2, 0);

  function dotTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  A.dotTex = dotTex;

  // Pool de partículas simples
  class Pool {
    constructor(n, size, additive, tex) {
      this.n = n; this.i = 0;
      this.pos = new Float32Array(n * 3).fill(999); this.col = new Float32Array(n * 3);
      this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.age = new Float32Array(n);
      this.kind = new Uint8Array(n); this.az = new Float32Array(n); this.rr = new Float32Array(n); this.sp = new Float32Array(n);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
      this.mat = new T.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: additive ? T.AdditiveBlending : T.NormalBlending });
      this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.g = g;
    }
    spawn(x, y, z, vx, vy, vz, life, r, g, b, kind) {
      const i = this.i = (this.i + 1) % this.n, j = i * 3;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
      this.col[j] = r; this.col[j + 1] = g; this.col[j + 2] = b; this.life[i] = life; this.age[i] = 0; this.kind[i] = kind || 0;
      return i;
    }
  }

  function rebuildCone() {
    const d = A.derive(), s = d.s;
    V.H = 0.9 + s * 2.1; V.R = 3.9 - s * 0.9; V.k = 0.9 + 1.1 * s; V.cr = 0.28 + 0.2 * s;
    const pts = [new T.Vector2(0.001, GY + V.H - 0.18)];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const r = V.cr + (V.R - V.cr) * i / n;
      pts.push(new T.Vector2(r, GY + A.coneY(r) + (i === 0 ? 0.02 : 0)));
    }
    pts[1].y += 0.0;
    const g = new T.LatheGeometry(pts, 48);
    if (cone) { cone.geometry.dispose(); cone.geometry = g; }
    else {
      cone = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x6a5648, side: T.DoubleSide }));
      cone.position.x = VX; A.world.add(cone);
    }
    cone.material.color.setRGB(0.42 - 0.12 * s, 0.34 - 0.1 * s, 0.28 - 0.08 * s);
    A.craterPos.set(VX, GY + V.H - 0.1, 0);
    if (glow) glow.position.copy(A.craterPos);
    A.mapDirty = true;
  }

  A.initVolcano = function () {
    const W = A.world, tex = dotTex();
    const hot = new T.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.92 });
    chamber = new T.Mesh(new T.SphereGeometry(0.9, 24, 16), hot); chamber.scale.set(1.35, 0.8, 1.35); chamber.position.set(VX, -2.2, 0);
    const curve = new T.CatmullRomCurve3([new T.Vector3(VX + 0.5, -4.5, 0), new T.Vector3(VX + 0.2, -3.5, 0), new T.Vector3(VX, -2.6, 0)]);
    dike = new T.Mesh(new T.TubeGeometry(curve, 16, 0.07, 6), hot);
    const cond = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 2.7, 10), hot); cond.position.set(VX, -0.85, 0);
    A.magmaMat = hot; A.magmaParts = [chamber, dike, cond];
    W.add(chamber, dike, cond);
    glow = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xff6a20, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.scale.set(2.4, 2.4, 1); W.add(glow);
    light = new T.PointLight(0xff7a30, 0, 14); W.add(light);
    A.ash = new Pool(1500, 0.34, false, tex); A.fire = new Pool(500, 0.22, true, tex); A.flow = new Pool(1000, 0.3, false, tex);
    W.add(A.ash.pts, A.fire.pts, A.flow.pts);
    rebuildCone(); light.position.copy(A.craterPos).y += 0.5;
    // raios-X: crosta translúcida para ver o sistema magmático em 3D
    A.setXray = on => { [A.layers.cont, A.layers.ccrust].forEach(m => { m.material.transparent = on; m.material.opacity = on ? 0.3 : 1; m.material.depthWrite = !on; }); };
    A.setXray(true);
  };

  A.erupt = function () {
    if (V.t >= 0) return;
    const d = A.derive(); V.t = 0; V.mode = d.E < 0.3 ? 'efusiva' : (d.E < 0.5 ? 'mista' : 'explosiva');
    V.dur = V.mode === 'efusiva' ? 14 : (V.mode === 'mista' ? 10 : 12); V.E = d.E; V.s = d.s;
    A.S.overp = 0.1; V.acc = { a: 0, f: 0, p: 0, l: 0, v: 0 };
    if (V.mode === 'efusiva' && A.P.silica < 52) A.mark('mafic');
    if (V.mode === 'explosiva' && A.P.silica >= 63) A.mark('felsic');
    if (A.onErupt) A.onErupt(V.mode);
  };

  function surf(az, r) { return [VX + Math.cos(az) * r, GY + 0.06 + A.coneY(r), Math.sin(az) * r]; }

  A.volcanoUpdate = function (dt, t) {
    const P = A.P, S = A.S, d = A.derive();
    const key = [P.silica, P.temp, P.water, P.press].join();
    if (key !== lastKey) { lastKey = key; rebuildCone(); }
    // pressão da câmara: gases + viscosidade elevam a sobrepressão
    if (V.t < 0) {
      S.overp = Math.min(1, S.overp + dt * (0.012 + P.water * 0.006 + (d.le - 2) * 0.004) * (0.5 + P.press / 2));
      if (S.overp >= 1 && S.step === 2 && P.auto) A.erupt();
    }
    // magma: cor pela temperatura, câmara incha com a pressão
    const k = A.clamp((P.temp - 800) / 600, 0, 1);
    A.magmaMat.color.setRGB(1, 0.2 + 0.6 * k, 0.05 + 0.2 * k);
    const inf = 1 + 0.22 * S.overp + 0.03 * Math.sin(t * 3);
    chamber.scale.set(1.35 * inf, 0.8 * inf, 1.35 * inf);
    let act = 0;
    if (V.t >= 0) {
      V.t += dt; const u = V.t / V.dur; act = u < 0.15 ? u / 0.15 : (u < 0.8 ? 1 : Math.max(0, (1 - u) / 0.2));
      const ex = V.mode, c = A.craterPos, ac = V.acc;
      const rate = (n, key) => { ac[key] += dt * n * act; const m = Math.floor(ac[key]); ac[key] -= m; return m; };
      if (ex !== 'efusiva') {
        const sc = ex === 'explosiva' ? 1 : 0.55;
        for (let i = rate(160 * sc, 'a'); i > 0; i--) {
          const a = Math.random() * 6.28, sp = Math.random() * 0.7;
          A.ash.spawn(c.x, c.y, c.z, Math.cos(a) * sp, (5 + Math.random() * 3 + V.E * 3) * sc, Math.sin(a) * sp, 7 + Math.random() * 3, 0.32, 0.3, 0.3, 1);
        }
        for (let i = rate(40 * sc, 'f'); i > 0; i--) {
          const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.2;
          A.fire.spawn(c.x, c.y, c.z, Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp, 3, 1, 0.45, 0.1, 2);
        }
        if (V.t > V.dur * 0.2) for (let i = rate(ex === 'explosiva' ? 130 : 30, 'p'); i > 0; i--) {
          const az = Math.random() * 6.28, i2 = A.flow.spawn(0, 0, 0, 0, 0, 0, 9, 0.55, 0.5, 0.48, 1);
          A.flow.az[i2] = az; A.flow.rr[i2] = V.cr; A.flow.sp[i2] = 2.2 + Math.random() * 1.6;
        }
      } else {
        for (let i = rate(14, 'f'); i > 0; i--)
          A.fire.spawn(c.x, c.y, c.z, (Math.random() - 0.5) * 0.8, 2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8, 1.6, 1, 0.5, 0.1, 2);
        for (let i = rate(22, 'v'); i > 0; i--) {
          const dirs = [0.4, 2.9, 4.6], az = dirs[(Math.random() * 3) | 0] + (Math.random() - 0.5) * 0.18;
          const i2 = A.flow.spawn(0, 0, 0, 0, 0, 0, 16, 1, 0.38, 0.05, 0);
          A.flow.az[i2] = az; A.flow.rr[i2] = V.cr; A.flow.sp[i2] = 0.45 + (1 - V.s) * 0.5 + Math.random() * 0.2;
        }
      }
      if (P.rain) for (let i = rate(40, 'l'); i > 0; i--) {
        const dirs = [1.3, 3.8, 5.4], az = dirs[(Math.random() * 3) | 0] + (Math.random() - 0.5) * 0.12;
        const i2 = A.flow.spawn(0, 0, 0, 0, 0, 0, 12, 0.45, 0.32, 0.22, 3);
        A.flow.az[i2] = az; A.flow.rr[i2] = V.cr + 0.3; A.flow.sp[i2] = 1.6 + Math.random() * 0.8; A.mark('rain');
      }
      if (V.t >= V.dur) V.t = -1;
    }
    V.act += (act - V.act) * Math.min(1, dt * 4);
    glow.material.opacity = A.clamp(0.25 + V.act * 0.75 + (S.overp > 0.85 ? 0.2 : 0), 0, 1); glow.scale.setScalar(1.2 + V.act * 3.2);
    light.intensity = 0.1 + V.act * 2.2;

    // física das partículas
    const wind = 0.7;
    for (const pool of [A.ash, A.fire]) {
      const p = pool.pos, v = pool.vel, g = pool === A.ash ? 2.0 : 6.5;
      for (let i = 0; i < pool.n; i++) {
        if (pool.life[i] <= 0) continue;
        pool.age[i] += dt; if (pool.age[i] > pool.life[i]) { pool.life[i] = 0; p[i * 3 + 1] = 999; continue; }
        const j = i * 3; v[j + 1] -= g * dt; if (pool === A.ash) { v[j] += (wind - v[j]) * dt * 0.6; v[j + 1] *= 1 - dt * 0.15; }
        p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
        if (pool === A.fire && p[j + 1] < GY + A.coneY(Math.hypot(p[j] - VX, p[j + 2]))) pool.life[i] = 0;
        const f = pool.age[i] / pool.life[i];
        if (pool === A.ash) { const c = 0.32 + f * 0.25; pool.col[j] = c; pool.col[j + 1] = c * 0.97; pool.col[j + 2] = c * 0.95; }
        else { pool.col[j + 1] = 0.45 - 0.35 * f; pool.col[j + 2] = 0.1 * (1 - f); }
      }
      pool.g.attributes.position.needsUpdate = pool.g.attributes.color.needsUpdate = true;
    }
    const F = A.flow;
    for (let i = 0; i < F.n; i++) {
      if (F.life[i] <= 0) continue;
      F.age[i] += dt; if (F.age[i] > F.life[i]) { F.life[i] = 0; F.pos[i * 3 + 1] = 999; continue; }
      const k2 = F.kind[i], j = i * 3, f = F.age[i] / F.life[i];
      F.rr[i] += F.sp[i] * dt * (k2 === 1 ? (1 - f * 0.6) : 1);
      const q = surf(F.az[i], F.rr[i]);
      F.pos[j] = q[0]; F.pos[j + 1] = q[1] + (k2 === 1 ? 0.08 + Math.sin(i) * 0.05 : 0); F.pos[j + 2] = q[2];
      if (q[0] < -1 || q[0] > 10 || Math.abs(q[2]) > 4) { F.life[i] = 0; F.pos[j + 1] = 999; continue; }
      if (k2 === 0) { F.col[j] = 1 - f * 0.6; F.col[j + 1] = 0.38 - f * 0.3; F.col[j + 2] = 0.05; }
    }
    F.g.attributes.position.needsUpdate = F.g.attributes.color.needsUpdate = true;
  };
})();
