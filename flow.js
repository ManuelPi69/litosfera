/* Convecção do manto, fluidos da subducção, sismos e microscópio (atrito entre placas) */
(function () {
  const T = THREE, A = APP;
  const Q = A.Q = { amp: 0, slip: 0, tsu: 0, t: 0, count: 0, last: '' };
  let conv, fluid, seis, waves = [], micro = {}, seisT = 0;
  const NC = 650, NF = 150, NS = 300;
  const cp = new Float32Array(NC * 3), cc = new Float32Array(NC * 3);
  const fp = new Float32Array(NF * 3), fc = new Float32Array(NF * 3), fh = new Float32Array(NF);
  const sp = new Float32Array(NS * 3).fill(999), sc = new Float32Array(NS * 3), sa = new Float32Array(NS).fill(-1);
  let si = 0;

  function pts(pos, col, size, add) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    const p = new T.Points(g, new T.PointsMaterial({ size, map: A.dotTex(), vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: add ? T.AdditiveBlending : T.NormalBlending }));
    p.frustumCulled = false; p.renderOrder = 5; return p;
  }
  function seedConv(i) {
    cp[i * 3] = -10 + Math.random() * 20; cp[i * 3 + 1] = -11 + Math.random() * 6; cp[i * 3 + 2] = -3.8 + Math.random() * 8.2;
  }
  function seedFluid(i, scatter) {
    const x = 0.6 + Math.random() * 4; fh[i] = scatter ? Math.random() * 2 : 0;
    fp[i * 3] = x; fp[i * 3 + 1] = A.slabY(x) + 0.08 + fh[i]; fp[i * 3 + 2] = -3.6 + Math.random() * 7.2;
  }

  A.initFlow = function () {
    const W = A.world;
    for (let i = 0; i < NC; i++) seedConv(i);
    for (let i = 0; i < NF; i++) seedFluid(i, true);
    conv = pts(cp, cc, 0.17, false); fluid = pts(fp, fc, 0.16, true); seis = pts(sp, sc, 0.3, true);
    W.add(conv, fluid, seis);
    A.convPts = conv;
    initMicro();
  };

  A.quake = function (mag, depthIdx, silent) {
    const hx = [-2.4, 2.2, 7.6][depthIdx], hy = A.slabY(hx) + 0.1, hz = (Math.random() - 0.5) * 2;
    const k = A.clamp((mag - 3) / 6, 0, 1);
    Q.amp = Math.max(Q.amp, Math.pow(k, 1.4) * 0.4); Q.slip = Math.max(Q.slip, k); Q.count++;
    if (mag >= 7 && depthIdx === 0) Q.tsu = 1;
    A.S.strain = 0;
    if (waves.length < 4) {
      [[0xffd24a, 6.5], [0xff4a3a, 3.6]].forEach(w => {
        const m = new T.Mesh(new T.SphereGeometry(1, 20, 12), new T.MeshBasicMaterial({ color: w[0], wireframe: true, transparent: true, opacity: 0.45, depthTest: false }));
        m.position.set(hx, hy, hz); m.userData = { v: w[1], r: 0.1, k }; A.world.add(m); waves.push(m);
      });
    }
    const j = si = (si + 1) % NS; sp[j * 3] = hx; sp[j * 3 + 1] = hy; sp[j * 3 + 2] = hz; sc[j * 3] = 1; sc[j * 3 + 1] = 0.2; sc[j * 3 + 2] = 0.15; sa[j] = 0;
    if (!silent) {
      A.mark('quake');
      const E = Math.pow(10, 1.5 * mag + 4.8);
      Q.last = 'Sismo M' + mag.toFixed(1) + ' — foco ' + ['raso (~10 km)', 'intermediário (~80 km)', 'profundo (~300 km)'][depthIdx] + '. Energia ≈ ' + E.toExponential(1).replace('e+', ' × 10^') + ' J' + (Q.tsu > 0.5 ? '. Deslocamento vertical do fundo → TSUNAMI!' : '.');
      A.toast && A.toast(Q.last); A.haptic && A.haptic(0.4 + k * 0.6, 200 + k * 800);
    }
  };

  function initMicro() {
    const g = micro.group = A.micro = new T.Group(); g.visible = false;
    const nx = 12, ny = 4, nz = 6, sp0 = 0.5;
    micro.rows = ny; micro.nx = nx; micro.nz = nz;
    const geo = new T.SphereGeometry(0.17, 10, 8), mk = c => new T.MeshLambertMaterial({ color: 0xffffff });
    micro.top = new T.InstancedMesh(geo, mk(), nx * ny * nz); micro.bot = new T.InstancedMesh(geo, mk(), nx * ny * nz);
    micro.top.instanceColor = new T.InstancedBufferAttribute(new Float32Array(nx * ny * nz * 3), 3);
    micro.bot.instanceColor = new T.InstancedBufferAttribute(new Float32Array(nx * ny * nz * 3), 3);
    g.add(micro.top, micro.bot);
    micro.sp0 = sp0; micro.load = 0; micro.slipPos = 0; micro.slipV = 0; micro.slips = 0; micro.stretch = 0;
    micro.sparks = pts(new Float32Array(120 * 3).fill(999), new Float32Array(120 * 3), 0.25, true);
    micro.sv = new Float32Array(120 * 3); micro.sl = new Float32Array(120); micro.si = 0;
    g.add(micro.sparks);
    g.add(A.makeLabel('Placa continental (fixa)', 0, 2.2, 0, 0.9), A.makeLabel('Placa oceânica (desliza →)', 0, -2.2, 0, 0.9), A.makeLabel('Interface: atrito + rocha', 0, 0, 3.3, 0.9));
    const light = new T.PointLight(0xffffff, 0.6, 30); light.position.set(0, 4, 5); g.add(light);
  }

  function updateMicro(dt, t) {
    const P = A.P, m = micro, nx = m.nx, ny = m.rows, nz = m.nz, sp0 = m.sp0;
    const Fmax = 0.25 + P.fric * 1.4;
    m.load += dt * 0.28 * P.conv;
    m.stretch = m.load - m.slipPos;
    if (m.stretch > Fmax && m.slipV <= 0) { m.slipV = 1; m.slips++; A.S.microSlip = m.slips; A.mark('micro'); A.haptic && A.haptic(0.5, 250);
      for (let i = 0; i < 40; i++) { const k = (m.si = (m.si + 1) % 120) * 3; m.sparks.geometry.attributes.position.array[k] = (Math.random() - 0.5) * 5; m.sparks.geometry.attributes.position.array[k + 1] = (Math.random() - 0.5) * 0.3; m.sparks.geometry.attributes.position.array[k + 2] = (Math.random() - 0.5) * 3; m.sv[k] = (Math.random() - 0.5) * 3; m.sv[k + 1] = Math.random() * 3; m.sv[k + 2] = (Math.random() - 0.5) * 3; m.sl[k / 3] = 1; m.sparks.geometry.attributes.color.array.set([1, 0.8, 0.3], k); } }
    if (m.slipV > 0) { const d = m.stretch * Math.min(1, dt * 9); m.slipPos += d; if (m.stretch < 0.05) m.slipV = 0; }
    const s = A.clamp(m.stretch / Fmax, 0, 1.2), jit = 0.015 + (P.temp - 800) / 600 * 0.05;
    const c = new T.Color(), M = new T.Matrix4(); let n = 0;
    for (let j = 0; j < ny; j++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++, n++) {
      const x0 = (ix - nx / 2) * sp0, z0 = (iz - nz / 2) * sp0;
      const wrap = v => ((v + nx * sp0 / 2) % (nx * sp0) + nx * sp0) % (nx * sp0) - nx * sp0 / 2;
      const topX = x0 + 0.15 * m.stretch * (1 - j / (ny - 1));
      const botX = wrap(x0 + m.slipPos + m.stretch * (j / (ny - 1)));
      const J = () => Math.sin(n * 12.9 + t * 9) * jit;
      M.makeTranslation(topX + J(), 0.35 + j * sp0, z0 + J()); m.top.setMatrixAt(n, M);
      M.makeTranslation(botX + J(), -0.35 - j * sp0, z0 + J()); m.bot.setMatrixAt(n, M);
      const hot = (j === 0 ? 1 : 0.35) * s;
      c.setRGB(0.55 + hot * 0.45, 0.62 - hot * 0.45, 0.78 - hot * 0.65); m.top.setColorAt(n, c);
      c.setRGB(0.25 + hot * 0.7, 0.3 - hot * 0.2, 0.42 - hot * 0.3); m.bot.setColorAt(n, c);
    }
    m.top.instanceMatrix.needsUpdate = m.bot.instanceMatrix.needsUpdate = true; m.top.instanceColor.needsUpdate = m.bot.instanceColor.needsUpdate = true;
    // faíscas
    const pp = m.sparks.geometry.attributes.position.array, cc2 = m.sparks.geometry.attributes.color.array;
    for (let i = 0; i < 120; i++) { if (m.sl[i] <= 0) { pp[i * 3 + 1] = 999; continue; } m.sl[i] -= dt * 1.2; m.sv[i * 3 + 1] -= 6 * dt; for (let a = 0; a < 3; a++) pp[i * 3 + a] += m.sv[i * 3 + a] * dt; }
    m.sparks.geometry.attributes.position.needsUpdate = m.sparks.geometry.attributes.color.needsUpdate = true;
    A.S.microStress = Math.round(100 * A.clamp(m.stretch / Fmax, 0, 1));
  }

  A.flowUpdate = function (dt, t) {
    const P = A.P, S = A.S, d = A.derive();
    conv.visible = P.convOn; fluid.visible = true; seis.visible = true;
    // convecção
    const hot = A.clamp((P.temp - 800) / 600, 0, 1), amp = 1.5 * P.conv * (0.5 + hot);
    const kx = Math.PI / 10, ky = Math.PI / 6;
    if (P.convOn && !S.micro) for (let i = 0; i < NC; i++) {
      const x = cp[i * 3], y = cp[i * 3 + 1], xp = x + 10, yp = y + 11;
      const u = ky * Math.sin(kx * xp) * Math.cos(ky * yp) * amp, v = -kx * Math.cos(kx * xp) * Math.sin(ky * yp) * amp;
      cp[i * 3] += u * dt; cp[i * 3 + 1] += v * dt;
      if (cp[i * 3] < -10 || cp[i * 3] > 10 || cp[i * 3 + 1] < -11 || cp[i * 3 + 1] > -5) seedConv(i);
      const f = A.clamp(v / (kx * amp + 1e-6) * 1.0, -1, 1) * 0.5 + 0.5;
      cc[i * 3] = 0.25 + 0.75 * f; cc[i * 3 + 1] = 0.55 + 0.1 * f - 0.3 * f * f; cc[i * 3 + 2] = 1 - 0.85 * f;
    }
    conv.geometry.attributes.position.needsUpdate = conv.geometry.attributes.color.needsUpdate = true;
    // fluidos da subducção (água → fusão → magma)
    const rise = 0.35 + (1 - d.s) * 0.45;
    for (let i = 0; i < NF; i++) {
      fh[i] += dt * rise; const x = fp[i * 3] + (3.2 - fp[i * 3]) * dt * 0.12; fp[i * 3] = x;
      fp[i * 3 + 1] = A.slabY(x) + 0.08 + fh[i];
      if (fp[i * 3 + 1] > -2.0) seedFluid(i, false);
      const m = A.clamp((fh[i] - 0.3) / 0.8, 0, 1);
      fc[i * 3] = 0.4 + 0.6 * m; fc[i * 3 + 1] = 0.75 - 0.25 * m; fc[i * 3 + 2] = 1 - 0.9 * m;
    }
    fluid.geometry.attributes.position.needsUpdate = fluid.geometry.attributes.color.needsUpdate = true;

    // sismicidade ambiente + acúmulo de deformação elástica
    S.strain = Math.min(1, S.strain + dt * 0.03 * P.fric * P.conv);
    seisT -= dt;
    if (P.seis && seisT <= 0 && !S.micro) { seisT = 0.7 + Math.random() * 1.5; const x = -3 + Math.random() * 12, j = si = (si + 1) % NS;
      sp[j * 3] = x; sp[j * 3 + 1] = A.slabY(x) + (Math.random() - 0.4) * 0.7; sp[j * 3 + 2] = (Math.random() - 0.5) * 7; sc[j * 3] = 1; sc[j * 3 + 1] = 0.85; sc[j * 3 + 2] = 0.3; sa[j] = 0; }
    if (S.strain >= 1 && P.seis && S.step <= 1 && !S.micro) A.quake(5.6 + Math.random() * 1.2, (Math.random() * 3) | 0, false);
    for (let i = 0; i < NS; i++) { if (sa[i] < 0) continue; sa[i] += dt; if (sa[i] > 25) { sa[i] = -1; sp[i * 3 + 1] = 999; } else { const f = 1 - sa[i] / 25; sc[i * 3] *= 1; seis.geometry.attributes.color.array[i * 3 + 2] = sc[i * 3 + 2] * f; } }
    seis.geometry.attributes.position.needsUpdate = seis.geometry.attributes.color.needsUpdate = true;

    // ondas sísmicas e tremor
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.userData.r += w.userData.v * dt; w.scale.setScalar(w.userData.r); w.material.opacity = 0.45 * Math.max(0, 1 - w.userData.r / 24);
      if (w.userData.r > 24) { A.world.remove(w); w.geometry.dispose(); w.material.dispose(); waves.splice(i, 1); }
    }
    Q.amp *= Math.exp(-dt * 1.6); Q.slip *= Math.exp(-dt * 0.9); Q.tsu *= Math.exp(-dt * 0.5);
    A.world.position.set((Math.random() - 0.5) * Q.amp, (Math.random() - 0.5) * Q.amp, (Math.random() - 0.5) * Q.amp);
    if (S.micro) updateMicro(dt, t);
  };
})();
