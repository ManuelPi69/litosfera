/* Descrição declarativa dos controles de cada etapa — usada tanto pelo painel HTML quanto pelo painel VR */
(function () {
  const A = APP, P = A.P, S = A.S;
  const PRESETS = { mafic: [48, 1200, 0.5, 0.5], inter: [58, 1100, 3, 1.2], felsic: [70, 900, 5.5, 2] };
  A.preset = k => { const p = PRESETS[k]; P.silica = p[0]; P.temp = p[1]; P.water = p[2]; P.press = p[3]; A.dirty = A.mapDirty = true; };
  A.setStep = n => {
    S.step = n; if (n !== 1) { S.dive = false; S.micro = false; } A.dirty = true; A.applyView && A.applyView();
    if (n === 3) A.mapDirty = true;
  };
  A.toast = (text, ms) => { S.toast = { text, until: performance.now() + (ms || 7000) }; A.dirty = true; };

  const sl = (k, l, min, max, step, u, f) => ({ t: 'slider', k, l, min, max, step, u: u || '', f });
  const tg = (k, l) => ({ t: 'toggle', k, l });
  const bt = (l, fn, kind) => ({ t: 'btn', l, fn, kind });
  const nextBtn = n => bt(n < 4 ? 'Avançar → ' + A.steps[n + 1].title + ': ' + A.steps[n + 1].sub : 'Reiniciar trilha', () => { if (n < 4) A.setStep(n + 1); else { A.tasks = {}; S.ans = {}; try { localStorage.removeItem('litos_tasks'); } catch (e) {} A.setStep(0); } }, 'next');
  const ro = fn => ({ t: 'ro', fn });
  const tasks = n => ({ t: 'tasks', list: A.tasksByStep[n] });

  A.items = function () {
    const n = S.step, d = new Proxy({}, { get: (_, k) => A.derive()[k] }), it = [{ t: 'p', l: A.steps[n].text }];
    if (n === 0) {
      it.push({ t: 'h', l: 'Camadas e rótulos' }, tg('labels', 'Rótulos'), tg('faults', 'Falhas geológicas'), tg('convOn', 'Correntes de convecção'), tg('water3d', 'Oceano'), tg('xray', 'Raios-X da crosta (ver câmara magmática)'));
      it.push({ t: 'h', l: 'Como navegar' }, { t: 'p', l: 'Computador: arraste = girar, roda = zoom, botão direito = mover. Tablet: um dedo gira, dois dedos aproximam. Óculos VR: botão "Entrar em VR"; gatilho aponta e clica nos painéis, direcional/analógico gira e movimenta, botão "Maquete ⇄ Imersão" muda a escala.' });
    }
    if (n === 1) {
      it.push(tasks(1), { t: 'h', l: 'Explorar' },
        bt(() => S.dive ? '⬆ Voltar à superfície' : '⬇ Mergulhar no manto', () => { S.dive = !S.dive; S.micro = false; if (S.dive) A.mark('dive'); A.applyView(); A.dirty = true; }),
        bt(() => S.micro ? '⬅ Sair do microscópio' : '🔬 Microscópio: atrito na falha', () => { S.micro = !S.micro; S.dive = false; A.applyView(); A.dirty = true; }),
        { t: 'h', l: 'Parâmetros' },
        sl('temp', 'Temperatura do manto', 800, 1400, 10, ' °C'), sl('conv', 'Velocidade de convecção', 0.2, 3, 0.1, '×'), sl('fric', 'Atrito / acoplamento das placas', 0.1, 1, 0.05, ''),
        { t: 'h', l: 'Eventos sísmicos' },
        { t: 'seg', k: 'depth', l: 'Profundidade do foco', o: ['Rasa', 'Intermediária', 'Profunda'] },
        sl('mag', 'Magnitude', 3, 9, 0.1, ' Mw'), bt('💥 Ativar sismo', () => A.quake(P.mag, P.depth)), tg('seis', 'Sismicidade ambiente (zona de Benioff)'),
        ro(() => 'Deformação elástica acumulada: ' + Math.round(S.strain * 100) + '%' + (S.micro ? ' · Tensão na falha: ' + (S.microStress || 0) + '%' : '')),
        ro(() => A.Q.last || 'Dica: a sismicidade se alinha ao plano de Benioff — o contorno da placa que mergulha.'), nextBtn(1));
    }
    if (n === 2) {
      it.push(tasks(2), { t: 'h', l: 'Composição do magma' },
        { t: 'segf', l: 'Preset', o: [['Máfico', () => A.preset('mafic')], ['Intermediário', () => A.preset('inter')], ['Félsico', () => A.preset('felsic')]] },
        sl('silica', 'Sílica (SiO₂)', 45, 75, 1, ' %'), sl('temp', 'Temperatura do magma', 800, 1300, 10, ' °C'), sl('water', 'Gases dissolvidos (H₂O)', 0, 7, 0.1, ' %'), sl('press', 'Pressão na câmara', 0.1, 3, 0.1, ' kbar'),
        tg('rain', 'Chuva intensa / neve derretida (lahar)'), tg('auto', 'Erupção automática ao atingir a pressão crítica'),
        bt('🌋 Provocar erupção', () => A.erupt(), 'hot'),
        { t: 'bar', l: 'Sobrepressão da câmara', fn: () => S.overp },
        ro(() => d.name + ' · η ≈ 10^' + d.le.toFixed(1) + ' Pa·s'), ro(() => 'Cone: ' + d.cone), ro(() => 'Erupção ' + d.style + ' · VEI ' + d.vei), nextBtn(2));
    }
    if (n === 3) {
      const h = new Proxy({}, { get: (_, k) => A.mapHazard()[k] });
      it.push(tasks(3), { t: 'h', l: 'Cenário' },
        { t: 'segf', l: 'Magma', o: [['Efusivo', () => A.preset('mafic')], ['Moderado', () => A.preset('inter')], ['Explosivo', () => A.preset('felsic')]] },
        tg('rain', 'Chuva intensa (lahares maiores)'), bt('⚠ Simular PDC e lahares', () => A.map.simulate(), 'hot'), bt(() => A.M.soil ? 'Ocultar andossolos' : 'Mostrar andossolos (solos férteis)', () => A.map.toggleSoil()),
        ro(() => 'VEI ' + h.vei + ' · alcance PDC ≈ ' + h.Rp.toFixed(1) + '–' + (h.Rp * 1.25).toFixed(1) + ' km · lahar até ' + h.Lr.toFixed(1) + ' km'),
        { t: 'h', l: 'Plano de evacuação' },
        { t: 'segf', l: 'Origem', sel: () => A.M.origin, o: A.TOWNS.map((t, i) => [t.n, () => A.map.origin(i)]) },
        { t: 'segf', l: 'Transporte', sel: () => A.M.mode === 'foot' ? 0 : 1, o: [['A pé (4 km/h)', () => { A.M.mode = 'foot'; A.map.clear(); }], ['Ônibus (25 km/h)', () => { A.M.mode = 'bus'; A.map.clear(); }]] },
        { t: 'slider', k: 'alert', l: 'Tempo de alerta antes da erupção', min: 20, max: 180, step: 5, u: ' min', obj: A.M },
        { t: 'p', l: 'Clique no mapa para adicionar pontos até um abrigo (círculo verde). PDC atinge instantaneamente a zona vermelha; lahares percorrem os vales marrons depois.' },
        bt('↶ Desfazer ponto', () => A.map.undo()), bt('✖ Limpar rota', () => A.map.clear()), bt('▶ Evacuar (animar)', () => A.map.evacuate(), 'hot'),
        ro(() => (A.M.report || []).join('\n')), nextBtn(3));
    }
    if (n === 4) {
      A.quiz.forEach((q, qi) => {
        it.push({ t: 'h', l: 'Questão ' + (qi + 1) }, { t: 'p', l: q.q });
        q.o.forEach((o, oi) => it.push({ t: 'choice', l: 'ABCD'[oi] + ') ' + o, st: S.ans[qi] === undefined ? '' : (oi === q.c ? 'ok' : (S.ans[qi] === oi ? 'bad' : '')), fn: () => { if (S.ans[qi] === undefined) { S.ans[qi] = oi; A.dirty = true; } } }));
        if (S.ans[qi] !== undefined) it.push({ t: 'p', cls: S.ans[qi] === q.c ? 'ok' : 'bad', l: (S.ans[qi] === q.c ? '✔ Correto! ' : '✖ Resposta correta: ' + 'ABCD'[q.c] + '. ') + 'Gabarito comentado: ' + q.fb });
      });
      if (Object.keys(S.ans).length === A.quiz.length) {
        const ok = A.quiz.filter((q, i) => S.ans[i] === q.c).length, done = Object.keys(A.tasks).length;
        it.push({ t: 'h', l: 'Resultado' }, { t: 'p', l: 'Você acertou ' + ok + ' de ' + A.quiz.length + ' questões e concluiu ' + done + ' missões da trilha.' });
      }
      it.push(nextBtn(4));
    }
    return it;
  };
})();
