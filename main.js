/* Renderizador, câmera orbital (PC/tablet), WebXR (Pico Neo 3 e outros) e laço principal */
(function () {
  const T = THREE, A = APP, S = A.S;
  let renderer, scene, camera, stage, canvas, ray, lastDraw = 0;
  const cam = { tx: 0.5, ty: -4, tz: 0, az: 0.35, el: 0.28, dist: 27 }, des = Object.assign({}, cam);
  const VIEWS = {
    macro: { tx: 0.5, ty: -4, tz: 0, az: 0.35, el: 0.28, dist: 27 }, dive: { tx: -1, ty: -8, tz: -1.5, az: 0.35, el: 0.05, dist: 3.2 },
    micro: { tx: 0, ty: 0, tz: 0, az: 0.3, el: 0.15, dist: 7.5 }, map: { tx: 0, ty: 0, tz: 0, az: 0, el: 1.2, dist: 24 }
  };
  // poses VR: c = ponto do modelo ancorado; s = escala; a = âncora no espaço real
  const VRP = {
    macro: { c: [0, -4, 0], s: 0.075, a: [0.3, 1.05, -1.6] }, macroI: { c: [3, 0.4, 4], s: 0.5, a: [0, 0, -2.8] },
    dive: { c: [0, -7.5, 0], s: 0.5, a: [0, 1.3, 0] }, micro: { c: [0, 0, 0], s: 0.25, a: [0, 1.3, -1.1] }, map: { c: [0, 0, 0], s: 0.1, a: [0, 0.85, -0.9] }
  };
  const vr = { s: 0.075, c: new T.Vector3(0, -4, 0), a: new T.Vector3(0.3, 1.05, -1.6), yaw: 0, ctrls: [], panelOn: true };

  A.view = () => S.step === 3 ? 'map' : (S.micro ? 'micro' : (S.dive ? 'dive' : 'macro'));
  A.applyView = function () {
    const v = A.view(); S.view = v; Object.assign(des, VIEWS[v]);
    A.world.visible = v === 'macro' || v === 'dive'; A.micro.visible = v === 'micro'; A.mapG.visible = v === 'map';
    const k = v === 'macro' && S.vrScale ? VRP.macroI : VRP[v], keepA = vr.a.clone();
    vr.s = k.s; vr.c.set(...k.c); vr.a.set(...k.a); vr.yaw = v === 'map' ? 0 : vr.yaw; vr.sT = k.s;
  };
  A.resetCam = () => A.applyView();
  A.vrToggleScale = () => { S.vrScale = !S.vrScale; A.applyView(); };

  function init() {
    canvas = document.getElementById('c');
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.xr.enabled = true;
    scene = new T.Scene(); scene.background = new T.Color(0x0a1020); scene.fog = new T.Fog(0x0a1020, 60, 140);
    camera = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.03, 300); scene.add(camera);
    scene.add(new T.HemisphereLight(0xcfe2ff, 0x40303a, 0.95)); const dl = new T.DirectionalLight(0xffffff, 0.8); dl.position.set(10, 20, 16); scene.add(dl);
    stage = new T.Group(); scene.add(stage);
    A.initWorld(); A.initVolcano(); A.initFlow(); A.initMap(); A.initUI(); A.initVRPanel();
    stage.add(A.world, A.micro, A.mapG);
    const floor = new T.GridHelper(12, 24, 0x3a4a70, 0x1b2540); floor.visible = false; scene.add(floor); vr.floor = floor;
    scene.add(A.vrp.mesh); ray = new T.Raycaster();
    A.applyView(); Object.assign(cam, des);
    bindPointer(); initXR();
    addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
    renderer.setAnimationLoop(frame);
  }

  /* ---------- órbita com mouse / toque ---------- */
  function bindPointer() {
    const ps = new Map(); let down = null, pinch = 0;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ps.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = { x: e.clientX, y: e.clientY, t: performance.now(), n: ps.size }; if (ps.size === 2) { const [a, b] = [...ps.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    canvas.addEventListener('pointermove', e => {
      const p = ps.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ps.size === 1 && !(e.buttons & 2) && !e.shiftKey) { des.az -= dx * 0.006; des.el = A.clamp(des.el + dy * 0.006, -1.4, 1.5); }
      else if (ps.size === 1) pan(dx, dy);
      else if (ps.size === 2) { const [a, b] = [...ps.values()], d = Math.hypot(a.x - b.x, a.y - b.y); des.dist = A.clamp(des.dist * pinch / Math.max(d, 1), 1.5, 70); pinch = d; pan(dx / 2, dy / 2); }
    });
    const up = e => {
      const m = ps.has(e.pointerId); ps.delete(e.pointerId);
      if (m && down && down.n === 1 && performance.now() - down.t < 450 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && A.view() === 'map') mapPick(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); des.dist = A.clamp(des.dist * (1 + Math.sign(e.deltaY) * 0.09), 1.5, 70); }, { passive: false });
  }
  function pan(dx, dy) {
    const k = cam.dist * 0.0015, r = new T.Vector3().setFromMatrixColumn(camera.matrix, 0), u = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
    des.tx += (-r.x * dx + u.x * dy) * k; des.ty += (-r.y * dx + u.y * dy) * k; des.tz += (-r.z * dx + u.z * dy) * k;
  }
  function mapPick(x, y) {
    ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera);
    const h = ray.intersectObject(A.mapMesh)[0]; if (h) { const p = A.mapG.worldToLocal(h.point.clone()); A.map.click(p.x, p.z); }
  }

  /* ---------- WebXR (Pico Neo 3: navegador Pico, HTTPS) ---------- */
  const lerpV = (a, b, k) => a + (b - a) * k;
  function initXR() {
    const btn = document.getElementById('vrBtn'), msg = document.getElementById('vrMsg');
    if (!navigator.xr) { btn.disabled = true; btn.textContent = 'VR indisponível'; msg.textContent = 'WebXR não encontrado: abra por HTTPS no Navegador Pico (ou Chrome/Edge com WebXR).'; return; }
    navigator.xr.isSessionSupported('immersive-vr').then(ok => {
      btn.textContent = ok ? '🥽 Entrar em VR' : 'VR indisponível neste dispositivo'; btn.disabled = !ok;
      if (!ok) msg.textContent = 'Este navegador não oferece sessões immersive-vr. No Pico Neo 3 use o Navegador Pico via HTTPS.';
    }).catch(() => { btn.disabled = true; });
    btn.onclick = async () => {
      try {
        if (renderer.xr.isPresenting) { A.exitVR(); return; }
        const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
        renderer.xr.setReferenceSpaceType('local-floor'); await renderer.xr.setSession(s); onStart(s);
      } catch (e) { msg.textContent = 'Falha ao iniciar VR: ' + (e.message || e); }
    };
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i); c.userData = { i, pressed: false };
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -3)]), new T.LineBasicMaterial({ color: 0xffd37a })); l.name = 'ray'; c.add(l);
      const dot = new T.Mesh(new T.SphereGeometry(0.012), new T.MeshBasicMaterial({ color: 0xffffff })); dot.position.z = -0.05; c.add(dot);
      c.addEventListener('connected', e => { c.userData.src = e.data; });
      c.addEventListener('selectstart', () => { c.userData.pressed = true; onSelect(c); });
      c.addEventListener('selectend', () => { c.userData.pressed = false; A.vrRelease(); });
      scene.add(c); vr.ctrls.push(c);
    }
  }
  function onStart(session) {
    S.vr = true; vr.floor.visible = true; A.vrp.mesh.visible = true; A.applyView(); A.vrRecenter(); A.vrp.dirty = true;
    session.addEventListener('end', () => { S.vr = false; vr.floor.visible = false; A.vrp.mesh.visible = false; stage.position.set(0, 0, 0); stage.scale.setScalar(1); stage.rotation.set(0, 0, 0); document.getElementById('vrBtn').textContent = '🥽 Entrar em VR'; });
    document.getElementById('vrBtn').textContent = '⏏ Sair do VR';
  }
  A.exitVR = () => { const s = renderer.xr.getSession(); s && s.end(); };
  A.vrRecenter = function () {
    const xc = renderer.xr.getCamera(camera), p = new T.Vector3(), d = new T.Vector3(0, 0, -1);
    p.setFromMatrixPosition(xc.matrixWorld); d.applyQuaternion(xc.quaternion || camera.quaternion); d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, -1); d.normalize();
    const yaw = Math.atan2(-d.x, -d.z), m = A.vrp.mesh;
    m.position.set(p.x + Math.sin(-yaw - 0.55) * 0.0 + (-Math.sin(yaw + 0.55)) * 0.95, Math.max(1.1, p.y - 0.05), p.z + (-Math.cos(yaw + 0.55)) * 0.95); m.rotation.set(0, yaw + 0.55, 0);
  };
  A.haptic = function (s, ms) { vr.ctrls.forEach(c => { try { const g = c.userData.src && c.userData.src.gamepad; const a = g && (g.hapticActuators && g.hapticActuators[0]); if (a && a.pulse) a.pulse(s, ms); else if (g && g.vibrationActuator) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: s }); } catch (e) {} }); };

  function hitPanel(c) {
    const o = new T.Vector3(), d = new T.Vector3(0, 0, -1), m = new T.Matrix4().extractRotation(c.matrixWorld);
    o.setFromMatrixPosition(c.matrixWorld); d.applyMatrix4(m); ray.set(o, d); ray.far = 6; ray.camera = camera;
    return { o, d, hp: A.vrp.mesh.visible ? ray.intersectObject(A.vrp.mesh)[0] : null };
  }
  function onSelect(c) {
    const r = hitPanel(c);
    if (r.hp) { A.vrHover(r.hp.uv); A.vrPress(); A.vrp.dirty = true; return; }
    if (A.view() === 'map') { const h = ray.intersectObject(A.mapMesh)[0]; if (h) { const p = A.mapG.worldToLocal(h.point.clone()); A.map.click(p.x, p.z); } }
  }
  let prevB = {};
  function xrInput(dt) {
    let hover = null, lenAll = 3;
    vr.ctrls.forEach(c => {
      const r = hitPanel(c), line = c.getObjectByName('ray');
      if (r.hp && (!hover || c.userData.pressed)) hover = r.hp.uv; line.scale.z = r.hp ? r.hp.distance / 3 : 1;
      const src = c.userData.src, g = src && src.gamepad; if (!g) return;
      const ax = g.axes.length >= 4 ? [g.axes[2], g.axes[3]] : [g.axes[0] || 0, g.axes[1] || 0], dz = v => Math.abs(v) > 0.18 ? v : 0, X = dz(ax[0]), Y = dz(ax[1]), left = src.handedness === 'left';
      const pb = prevB[c.userData.i] || (prevB[c.userData.i] = {}), btn = i => g.buttons[i] && g.buttons[i].pressed, edge = (i, fn) => { const n = btn(i); if (n && !pb[i]) fn(); pb[i] = n; };
      edge(4, () => A.vrToggleScale()); edge(5, () => { A.vrp.mesh.visible = !A.vrp.mesh.visible; }); edge(1, () => A.vrRecenter());
      if (r.hp && Y) A.vrScrollBy(Y * 900 * dt);
      else if (S.view === 'macro' && S.vrScale || S.view === 'dive') { // voo livre
        if (left) { const f = new T.Vector3(); renderer.xr.getCamera(camera).getWorldDirection(f); const sp = 2.2 * dt; vr.a.x -= f.x * -Y * sp * -1 * -1; vr.a.y -= f.y * -Y * sp * -1 * -1; vr.a.z -= f.z * -Y * sp * -1 * -1; vr.a.x -= 0; }
        else vr.yaw += X * dt * 1.2;
      } else { if (!left) vr.yaw += X * dt * 1.2; else { vr.a.y = A.clamp(vr.a.y - Y * dt * 0.5, 0.4, 2); } }
    });
    A.vrHover(hover); A.vrDragUpdate();
    // aplica pose do palco (suavizada)
    const k = Math.min(1, dt * 4), sc = lerpV(stage.scale.x, vr.s, k), off = vr.c.clone().multiplyScalar(sc).applyAxisAngle(new T.Vector3(0, 1, 0), vr.yaw);
    stage.scale.setScalar(sc); stage.rotation.y = vr.yaw; stage.position.lerp(vr.a.clone().sub(off), k);
  }

  /* ---------- laço principal ---------- */
  let last = performance.now(), t0 = last;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000, v = A.view();
    const pres = renderer.xr.isPresenting;
    if (v === 'macro' || v === 'dive') { A.worldUpdate(dt, t); A.volcanoUpdate(dt, t); A.flowUpdate(dt, t); }
    else if (v === 'micro') A.flowUpdate(dt, t);
    else if (v === 'map') { A.mapUpdate(dt); A.volcanoUpdate(dt, t); }
    A.uiUpdate(dt);
    if (pres) { xrInput(dt); if (A.dirty || A.vrp.dirty || now - lastDraw > 300) { A.drawVRPanel(); lastDraw = now; A.dirty = false; } }
    else {
      A.dirty = false; const k = Math.min(1, dt * 5);
      for (const key of ['tx', 'ty', 'tz', 'az', 'el', 'dist']) cam[key] += (des[key] - cam[key]) * k;
      const ce = Math.cos(cam.el); camera.position.set(cam.tx + cam.dist * Math.sin(cam.az) * ce, cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.az) * ce);
      camera.lookAt(cam.tx, cam.ty, cam.tz);
    }
    renderer.render(scene, camera);
  }
  window.addEventListener('error', e => { const m = document.getElementById('vrMsg'); if (m) m.textContent = 'Erro: ' + e.message; });
  document.readyState === 'complete' ? init() : addEventListener('load', init);
})();
