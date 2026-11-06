/* Painel HTML (computador / tablet) gerado a partir de APP.items() */
(function () {
  const A = APP, S = A.S, P = A.P;
  let body, tabs, toast, sig = '', nodes = [];
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.textContent = h; return e; };
  const val = it => (it.obj || P)[it.k];
  const fmt = (it, v) => (it.f ? it.f(v) : (Math.abs(it.step) < 1 ? v.toFixed(it.step < 0.1 ? 2 : 1) : Math.round(v))) + (it.u || '');
  A.setVal = function (it, v) {
    const o = it.obj || P; v = A.clamp(Math.round(v / it.step) * it.step, it.min, it.max); o[it.k] = +v.toFixed(3);
    A.dirty = true; if (it.k === 'temp' && S.step === 1) A.mark('conv'); if (it.obj === A.M || ['silica', 'temp', 'water', 'press', 'rain'].includes(it.k)) A.mapDirty = true;
  };
  A.setToggle = function (k) { P[k] = !P[k]; if (k === 'xray') A.setXray(P.xray); A.dirty = true; if (k === 'rain') A.mapDirty = true; };

  function build() {
    body.innerHTML = ''; nodes = [];
    A.items().forEach(it => {
      let e, r = () => {};
      if (it.t === 'h') e = $('h3', '', it.l);
      else if (it.t === 'p') e = $('p', it.cls || '', it.l);
      else if (it.t === 'slider') {
        e = $('div', 'row'); const lab = $('label'), b = $('b'); lab.append(it.l + ': ', b);
        const inp = $('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step;
        inp.oninput = () => { A.setVal(it, +inp.value); r(); }; e.append(lab, inp);
        r = () => { const v = val(it); b.textContent = fmt(it, v); if (document.activeElement !== inp) inp.value = v; };
      } else if (it.t === 'toggle') {
        e = $('label', 'tog'); const c = $('input'); c.type = 'checkbox'; c.onchange = () => { A.setToggle(it.k); }; e.append(c, ' ' + it.l); r = () => { c.checked = !!P[it.k]; };
      } else if (it.t === 'btn') {
        e = $('button', 'btn ' + (it.kind || '')); e.onclick = it.fn; r = () => { const l = typeof it.l === 'function' ? it.l() : it.l; if (e.textContent !== l) e.textContent = l; };
      } else if (it.t === 'seg' || it.t === 'segf') {
        e = $('div', 'row'); e.append($('label', '', it.l)); const g = $('div', 'seg'), bs = [];
        it.o.forEach((o, i) => { const b = $('button', '', it.t === 'seg' ? o : o[0]); b.onclick = () => { if (it.t === 'seg') { P[it.k] = i; A.dirty = true; } else o[1](); A.dirty = true; }; bs.push(b); g.append(b); });
        e.append(g); r = () => { const cur = it.t === 'seg' ? P[it.k] : (it.sel ? it.sel() : -1); bs.forEach((b, i) => b.classList.toggle('on', i === cur)); };
      } else if (it.t === 'bar') {
        e = $('div', 'row'); const lab = $('label', '', it.l), bar = $('div', 'bar'), f = $('i'); bar.append(f); e.append(lab, bar); r = () => { const v = it.fn(); f.style.width = (v * 100) + '%'; f.style.background = v > 0.8 ? '#ff4a3a' : '#ffa020'; };
      } else if (it.t === 'tasks') {
        e = $('ul', 'tasks'); const li = it.list.map(t => { const l = $('li'); e.append(l); return l; });
        r = () => it.list.forEach((t, i) => { li[i].textContent = (A.tasks[t[0]] ? '✅ ' : '⬜ ') + t[1]; li[i].className = A.tasks[t[0]] ? 'done' : ''; });
      } else if (it.t === 'ro') { e = $('div', 'ro'); r = () => { const s = it.fn(); if (e.textContent !== s) e.textContent = s; }; }
      else if (it.t === 'choice') { e = $('button', 'choice ' + it.st, it.l); e.onclick = it.fn; }
      if (e) { body.append(e); r(); nodes.push(r); }
    });
  }

  A.initUI = function () {
    body = document.getElementById('body'); tabs = document.getElementById('tabs'); toast = document.getElementById('toast');
    A.steps.forEach((s, i) => { const b = $('button', 'tab'); b.innerHTML = '<span>' + s.title + '</span><small>' + s.sub + '</small>'; b.onclick = () => A.setStep(i); tabs.append(b); });
    document.getElementById('toggle').onclick = () => document.getElementById('panel').classList.toggle('closed');
    const hv = document.getElementById('btnView'); hv && (hv.onclick = () => { A.resetCam && A.resetCam(); });
  };
  let acc = 0;
  A.uiUpdate = function (dt) {
    acc += dt;
    const s2 = S.step + '|' + JSON.stringify(S.ans) + '|' + (S.dive ? 1 : 0) + (S.micro ? 1 : 0);
    if (s2 !== sig) { sig = s2; build(); [...tabs.children].forEach((t, i) => t.classList.toggle('on', i === S.step)); document.getElementById('body').scrollTop = 0; }
    if (acc > 0.2) { acc = 0; nodes.forEach(f => f()); }
    const t = S.toast; if (t) { const on = performance.now() < t.until; toast.textContent = on ? t.text : ''; toast.classList.toggle('show', on); }
  };
})();
