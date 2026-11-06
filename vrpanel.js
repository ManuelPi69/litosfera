/* Painel flutuante para VR: desenha APP.items() em um canvas e trata cliques por raio do controle */
(function () {
  const T = THREE, A = APP, S = A.S, P = A.P;
  const W = 1024, H = 1400, HEAD = 170, FOOT = 120, PAD = 36;
  const V = A.vrp = { regions: [], scroll: 0, max: 0, hover: null, drag: null, dirty: true, t: 0 };

  A.initVRPanel = function () {
    V.cv = document.createElement('canvas'); V.cv.width = W; V.cv.height = H; V.g = V.cv.getContext('2d');
    V.tex = new T.CanvasTexture(V.cv); V.tex.anisotropy = 4;
    V.mesh = new T.Mesh(new T.PlaneGeometry(0.9, 0.9 * H / W), new T.MeshBasicMaterial({ map: V.tex, transparent: true }));
    V.mesh.visible = false; V.mesh.name = 'vrpanel'; V.mesh.renderOrder = 30;
  };

  function wrap(g, text, w) {
    const out = [];
    String(text).split('\n').forEach(par => {
      let line = '';
      par.split(' ').forEach(wd => { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w && line) { out.push(line); line = wd; } else line = t; });
      out.push(line);
    });
    return out;
  }
  function rr(g, x, y, w, h, r, fill, stroke) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
  }
  const val = it => (it.obj || P)[it.k];

  function reg(x, y, w, h, fn, kind) { V.regions.push({ x, y, w, h, fn, kind }); }
  function isHover(x, y, w, h) { const p = V.hover; return p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h; }

  function button(g, x, y, w, h, label, fn, on, color) {
    const hv = isHover(x, y, w, h);
    rr(g, x, y, w, h, 16, on ? '#ff8a24' : (color || (hv ? '#3b5a8f' : '#27344f')), hv ? '#fff' : 'rgba(255,255,255,.2)');
    g.fillStyle = '#fff'; g.font = 'bold 28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2 + 1, w - 16);
    fn && reg(x, y, w, h, fn);
  }

  function drawItems(g, items, y0) {
    let y = y0; const x0 = PAD, w = W - 2 * PAD - 70;
    g.textBaseline = 'top'; g.textAlign = 'left';
    items.forEach(it => {
      if (it.t === 'h') { g.font = 'bold 34px system-ui'; g.fillStyle = '#ffb454'; g.fillText(it.l, x0, y + 8); y += 58; }
      else if (it.t === 'p' || it.t === 'ro') {
        g.font = '27px system-ui'; g.fillStyle = it.cls === 'ok' ? '#7be495' : (it.cls === 'bad' ? '#ff8a80' : (it.t === 'ro' ? '#cfe3ff' : '#e8eefc'));
        const txt = it.t === 'ro' ? it.fn() : it.l, ls = wrap(g, txt, w); ls.forEach((l, i) => g.fillText(l, x0, y + i * 37)); y += ls.length * 37 + 16;
      } else if (it.t === 'slider') {
        const v = val(it), step = Math.max(1, Math.round((it.max - it.min) / it.step / 20)) * it.step;
        g.font = '27px system-ui'; g.fillStyle = '#e8eefc'; g.textAlign = 'left'; g.fillText(it.l, x0, y);
        g.textAlign = 'right'; g.font = 'bold 28px system-ui'; g.fillStyle = '#ffd37a'; g.fillText((it.f ? it.f(v) : (it.step < 1 ? v.toFixed(1) : Math.round(v))) + (it.u || ''), x0 + w, y); g.textAlign = 'left';
        const ty = y + 46, tx = x0 + 80, tw = w - 160;
        button(g, x0, ty - 8, 64, 56, '−', () => { A.setVal(it, v - step); V.dirty = true; });
        button(g, x0 + w - 64, ty - 8, 64, 56, '+', () => { A.setVal(it, v + step); V.dirty = true; });
        rr(g, tx, ty + 12, tw, 14, 7, '#3a4766'); const f = (v - it.min) / (it.max - it.min);
        rr(g, tx, ty + 12, Math.max(14, tw * f), 14, 7, '#ff8a24'); g.beginPath(); g.arc(tx + tw * f, ty + 19, 17, 0, 7); g.fillStyle = '#fff'; g.fill();
        reg(tx - 10, ty - 8, tw + 20, 56, fr => { A.setVal(it, it.min + (it.max - it.min) * fr); V.dirty = true; }, 'slider'); V.regions[V.regions.length - 1].fr = [tx - 10, tw + 20];
        y += 112;
      } else if (it.t === 'toggle') {
        const on = P[it.k]; rr(g, x0, y, 56, 56, 12, on ? '#ff8a24' : '#27344f', '#fff');
        if (on) { g.fillStyle = '#fff'; g.font = 'bold 38px system-ui'; g.textAlign = 'center'; g.fillText('✓', x0 + 28, y + 8); g.textAlign = 'left'; }
        g.font = '27px system-ui'; g.fillStyle = '#e8eefc'; wrap(g, it.l, w - 80).forEach((l, i) => g.fillText(l, x0 + 76, y + 10 + i * 34)); reg(x0, y - 4, w, 64, () => { A.setToggle(it.k); V.dirty = true; }); y += 72;
      } else if (it.t === 'btn') {
        button(g, x0, y, w, 76, typeof it.l === 'function' ? it.l() : it.l, it.fn, false, it.kind === 'hot' ? '#b4381a' : (it.kind === 'next' ? '#1b6b47' : null)); y += 90;
      } else if (it.t === 'seg' || it.t === 'segf') {
        g.font = '26px system-ui'; g.fillStyle = '#c8d4ee'; g.fillText(it.l, x0, y); y += 36;
        const cur = it.t === 'seg' ? P[it.k] : (it.sel ? it.sel() : -1), n = it.o.length, bw = w / n;
        it.o.forEach((o, i) => button(g, x0 + i * bw + 3, y, bw - 6, 66, it.t === 'seg' ? o : o[0], () => { if (it.t === 'seg') P[it.k] = i; else o[1](); A.dirty = V.dirty = true; }, i === cur));
        y += 84;
      } else if (it.t === 'bar') {
        const v = it.fn(); g.font = '26px system-ui'; g.fillStyle = '#c8d4ee'; g.fillText(it.l + ' ' + Math.round(v * 100) + '%', x0, y); rr(g, x0, y + 38, w, 22, 11, '#3a4766'); rr(g, x0, y + 38, Math.max(22, w * v), 22, 11, v > 0.8 ? '#ff4a3a' : '#ffa020'); y += 80;
      } else if (it.t === 'tasks') {
        g.font = '27px system-ui'; it.list.forEach(t => { g.fillStyle = A.tasks[t[0]] ? '#7be495' : '#e8eefc'; g.fillText((A.tasks[t[0]] ? '✅ ' : '⬜ ') + t[1], x0, y); y += 40; }); y += 12;
      } else if (it.t === 'choice') {
        g.font = '27px system-ui'; const ls = wrap(g, it.l, w - 40), h = ls.length * 36 + 28;
        rr(g, x0, y, w, h, 16, it.st === 'ok' ? '#1d6b43' : (it.st === 'bad' ? '#7a2a2a' : (isHover(x0, y, w, h) ? '#3b5a8f' : '#27344f')), 'rgba(255,255,255,.25)');
        g.fillStyle = '#fff'; ls.forEach((l, i) => g.fillText(l, x0 + 20, y + 14 + i * 36)); reg(x0, y, w, h, () => { it.fn(); V.dirty = true; }); y += h + 14;
      }
    });
    return y;
  }

  A.drawVRPanel = function () {
    const g = V.g; V.regions = [];
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#101a30'); bg.addColorStop(1, '#0a1020');
    rr(g, 0, 0, W, H, 40, bg, 'rgba(255,255,255,.35)');
    // cabeçalho com abas
    g.textBaseline = 'top'; g.textAlign = 'left'; g.font = 'bold 38px system-ui'; g.fillStyle = '#fff'; g.fillText('🌋 ' + A.steps[S.step].title + ' — ' + A.steps[S.step].sub, PAD, 26);
    const tw = (W - 2 * PAD) / A.steps.length;
    A.steps.forEach((s, i) => button(g, PAD + i * tw + 2, 88, tw - 4, 62, i === 0 ? 'Início' : (i === 4 ? 'Quiz' : 'Etapa ' + i), () => { A.setStep(i); V.scroll = 0; V.dirty = true; }, i === S.step));
    // corpo com rolagem
    g.save(); g.beginPath(); g.rect(0, HEAD, W, H - HEAD - FOOT); g.clip();
    const regStart = V.regions.length, end = drawItems(g, A.items(), HEAD + 10 - V.scroll);
    V.max = Math.max(0, end + V.scroll - (H - FOOT) + 20); g.restore();
    V.regions = V.regions.filter((r, i) => i < regStart || (r.y + r.h > HEAD && r.y < H - FOOT));
    // rodapé
    const t = S.toast; if (t && performance.now() < t.until) { g.font = '25px system-ui'; const ls = wrap(g, t.text, W - 2 * PAD - 20); const hh = ls.length * 32 + 20; rr(g, PAD, H - FOOT - hh - 6, W - 2 * PAD, hh, 14, 'rgba(255,138,36,.95)'); g.fillStyle = '#111'; ls.forEach((l, i) => g.fillText(l, PAD + 14, H - FOOT - hh + 6 + i * 32)); }
    const bw = (W - 2 * PAD - 12 * 4) / 5, by = H - FOOT + 20;
    button(g, PAD, by, bw, 76, S.vrScale ? '🔬 Maquete' : '🌍 Imersão', () => { A.vrToggleScale && A.vrToggleScale(); V.dirty = true; });
    button(g, PAD + (bw + 12), by, bw, 76, '🎯 Recentrar', () => A.vrRecenter && A.vrRecenter());
    button(g, PAD + 2 * (bw + 12), by, bw, 76, '▲', () => { V.scroll = Math.max(0, V.scroll - 260); V.dirty = true; });
    button(g, PAD + 3 * (bw + 12), by, bw, 76, '▼', () => { V.scroll = Math.min(V.max, V.scroll + 260); V.dirty = true; });
    button(g, PAD + 4 * (bw + 12), by, bw, 76, '⏏ Sair VR', () => A.exitVR && A.exitVR(), false, '#7a2a2a');
    if (V.hover) { g.fillStyle = '#fff'; g.beginPath(); g.arc(V.hover.x, V.hover.y, 7, 0, 7); g.fill(); }
    V.tex.needsUpdate = true; V.dirty = false;
  };

  // uv → pixel; testa região sob o ponteiro
  const at = (px, py) => V.regions.slice().reverse().find(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  A.vrHover = function (uv) { const old = V.hover; V.hover = uv ? { x: uv.x * W, y: (1 - uv.y) * H } : null; if (!!old !== !!V.hover || (old && V.hover && (Math.abs(old.x - V.hover.x) > 4 || Math.abs(old.y - V.hover.y) > 4))) V.dirty = true; };
  A.vrPress = function () { const p = V.hover; if (!p) return false; const r = at(p.x, p.y); if (!r) return true; if (r.kind === 'slider') { V.drag = r; r.fn((p.x - r.fr[0]) / r.fr[1] * 0 + A.clamp((p.x - r.x) / r.w, 0, 1)); } else r.fn(); return true; };
  A.vrDragUpdate = function () { const p = V.hover; if (V.drag && p) { V.drag.fn(A.clamp((p.x - V.drag.x) / V.drag.w, 0, 1)); } };
  A.vrRelease = function () { V.drag = null; };
  A.vrScrollBy = dy => { V.scroll = A.clamp(V.scroll + dy, 0, V.max); V.dirty = true; };
})();
