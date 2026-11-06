/* Bloco-diagrama: placas, água, falhas, rótulos. Coordenadas: x leste, y cima, z para o observador. */
(function () {
  const T = THREE, A = APP;

  // Topo da placa oceânica (linha de subducção) em função de x
  A.slabY = x => x < -4.5 ? -0.9 : (x < -3.2 ? -0.9 - (x + 4.5) / 1.3 * 0.4 : -1.3 - 0.53 * (x + 3.2));
  A.SLAB_ANGLE = Math.atan(0.53);

  function shape(pts) {
    const s = new T.Shape();
    pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
    return s;
  }
  function layer(pts, color, idx, extra) {
    const g = new T.ExtrudeGeometry(shape(pts), { depth: 8 + idx * 0.02, bevelEnabled: false });
    g.translate(0, 0, -4);
    const m = new T.MeshLambertMaterial(Object.assign({ color }, extra || {}));
    return new T.Mesh(g, m);
  }
  function tube(pts, r, color) {
    const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2] || 4.14)));
    const m = new T.MeshBasicMaterial({ color });
    return new T.Mesh(new T.TubeGeometry(c, 40, r, 6, false), m);
  }
  A.makeLabel = function (text, x, y, z, sc) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.font = 'bold 40px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(500, g.measureText(text).width + 36);
    g.fillStyle = 'rgba(10,14,24,.78)'; g.beginPath(); g.roundRect ? g.roundRect(256 - w / 2, 8, w, 80, 24) : g.rect(256 - w / 2, 8, w, 80); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, 256, 49, 480);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(5.2 * (sc || 1), 5.2 * (sc || 1) * 96 / 512, 1); sp.position.set(x, y, z); sp.renderOrder = 20;
    return sp;
  };

  A.initWorld = function () {
    const W = A.world = new T.Group();
    const L = A.layers = {};

    // Manto (translúcido para enxergar a convecção)
    L.mantle = layer([[-10, -11], [10, -11], [10, -1], [-10, -1]], 0xd9531e, 0, { transparent: true, opacity: 0.5, depthWrite: false });
    const slabTop = [[-10, -0.9], [-4.5, -0.9], [-3.2, -1.3], [10, A.slabY(10)]];
    const off = (pts, d) => pts.map(p => [p[0], p[1] - d]);
    const slabPoly = slabTop.concat(off(slabTop, 1.1).reverse());
    const crustPoly = slabTop.concat(off(slabTop, 0.3).reverse());

    L.slab = new T.Group();
    L.slab.add(layer(slabPoly, 0x3d4f73, 1), layer(crustPoly, 0x1c2430, 2));
    const cont = [[10, 0.4], [-1, 0.4], [-2.2, -0.3], [-3.2, -1.3], [10, A.slabY(10)]];
    L.cont = layer(cont, 0x6e5b49, 3);
    L.ccrust = layer([[10, 0.4], [-1, 0.4], [-2.2, -0.3], [-2.9, -1.0], [10, -1.0]], 0xb09672, 4);
    L.water = layer([[-10, 0], [-1.6, 0], [-2.2, -0.3], [-3.2, -1.3], [-4.5, -0.9], [-10, -0.9]], 0x2a86e0, 5, { transparent: true, opacity: 0.42, depthWrite: false });
    L.waterTop = new T.Mesh(new T.BoxGeometry(8.4, 0.02, 8), new T.MeshLambertMaterial({ color: 0x57b0ff, transparent: true, opacity: 0.5 }));
    L.waterTop.position.set(-5.8, 0.01, 0);
    L.ground = new T.Mesh(new T.BoxGeometry(11, 0.06, 8), new T.MeshLambertMaterial({ color: 0x5f8f4a }));
    L.ground.position.set(4.5, 0.43, 0);
    // Andossolos (solo vulcânico fértil) — anel ao redor do vulcão
    L.soil = new T.Mesh(new T.RingGeometry(1.2, 3.9, 48), new T.MeshLambertMaterial({ color: 0x3a2a1c, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
    L.soil.rotation.x = -Math.PI / 2; L.soil.position.set(3, 0.5, 0); L.soil.visible = false;

    W.add(L.mantle, L.slab, L.cont, L.ccrust, L.water, L.waterTop, L.ground, L.soil);

    // Falhas geológicas (tubos brilhantes sobre o corte frontal)
    const F = A.faultGroup = new T.Group();
    A.faultMat = [];
    const mega = [], x0 = -3.2;
    for (let i = 0; i <= 10; i++) { const x = x0 + i * 1.3; mega.push([x, A.slabY(x) + 0.02]); }
    const fl = [tube(mega, 0.07, 0xff3b30), tube([[-2.6, -1.7], [-1.6, -0.8], [-0.7, 0.1], [-0.3, 0.4]], 0.045, 0xffb020),
      tube([[0.8, 0.4], [1.1, -0.3], [1.5, -1.0]], 0.04, 0xffb020), tube([[6.0, 0.4], [6.8, -0.5], [7.8, -1.0]], 0.04, 0xffb020),
      tube([[8.2, 0.4], [8.5, -0.4], [9.2, -1.0]], 0.04, 0xffb020)];
    fl.forEach(m => F.add(m)); A.faultMeshes = fl;
    W.add(F);

    // Rótulos
    A.labelGroup = new T.Group();
    [['Placa oceânica', -7, 1.1, 4.3], ['Placa continental', 7.4, 1.5, 4.3], ['Fossa oceânica', -3.4, -2.3, 4.3, 0.85],
      ['Manto astenosférico', -5.5, -7.5, 4.3], ['Cunha do manto (fusão parcial)', 4.2, -4.3, 4.3, 0.95],
      ['Litosfera subductada (slab)', 6.2, -7.2, 4.3, 0.95], ['Megafalha (contato entre placas)', -0.2, -3.0, 4.3, 0.9],
      ['Câmara magmática', 3, -1.9, 4.3, 0.9]].forEach(a => A.labelGroup.add(A.makeLabel(a[0], a[1], a[2], a[3], a[4])));
    W.add(A.labelGroup);
  };

  A.worldUpdate = function (dt, t) {
    const P = A.P, L = A.layers;
    A.faultGroup.visible = P.faults; A.labelGroup.visible = P.labels;
    L.water.visible = L.waterTop.visible = P.water3d; L.soil.visible = P.soil;
    // cor do manto muda com a temperatura
    const k = A.clamp((P.temp - 800) / 600, 0, 1);
    L.mantle.material.color.setRGB(0.45 + 0.55 * k, 0.17 + 0.17 * k, 0.1);
    // ondulação da água e rebote da placa (terremoto)
    const Q = A.Q || { slip: 0, tsu: 0 };
    L.waterTop.position.y = 0.01 + Math.sin(t * 1.5) * 0.015 + Q.tsu * 0.25 * Math.sin(t * 6);
    L.water.scale.y = 1 + Q.tsu * 0.1 * Math.sin(t * 6);
    const d = Q.slip * 0.35;
    L.slab.position.set(Math.cos(A.SLAB_ANGLE) * d, -Math.sin(A.SLAB_ANGLE) * d, 0);
    const pulse = 1 + (Q.amp || 0) * 2;
    A.faultMeshes.forEach(m => m.scale.set(1, 1, 1).multiplyScalar(1)); // mantém geometria
    A.faultMeshes[0].material.color.setRGB(1, 0.23 + Math.min(0.7, (A.S.strain || 0) * 0.5), 0.19);
    A.faultMeshes.forEach(m => m.material.opacity = 1);
  };
})();
