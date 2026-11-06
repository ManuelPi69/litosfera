/* Litosfera Viva — estado global, conteúdo pedagógico e cálculos geofísicos simplificados */
window.APP = {
  P: { // parâmetros controlados pelo estudante
    temp: 1000, press: 1.5, silica: 63, water: 5,
    conv: 1, mag: 6.5, depth: 1, rain: false, fric: 0.6,
    auto: true, xray: true, faults: true, convOn: true, labels: true, water3d: true, soil: false, seis: true
  },
  S: { step: 0, view: 'macro', overp: 0, strain: 0, vr: false, ans: {}, micro: false, dive: false },
  tasks: {},
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  mark(id) { if (!this.tasks[id]) { this.tasks[id] = true; this.dirty = true; try { localStorage.setItem('litos_tasks', JSON.stringify(this.tasks)); } catch (e) {} } },
  dirty: true,

  // Viscosidade (log10 Pa·s) e índice de explosividade — modelo didático, não preditivo
  derive() {
    const p = this.P, c = this.clamp;
    const le = c(2 + 0.22 * (p.silica - 48) + (1200 - p.temp) * 0.0055 * (1 + (p.silica - 48) / 20) - 0.35 * p.water, 1, 12);
    const s = c((le - 2) / 7, 0, 1);
    const E = c((le - 2) / 8 * 0.5 + p.water / 8 * 0.4 + (p.press - 0.1) / 3 * 0.15, 0, 1);
    return {
      le, s, E, eta: Math.pow(10, le),
      vei: c(Math.round(1 + E * 6), 1, 7),
      style: E < 0.3 ? 'efusiva' : (E < 0.5 ? 'mista (vulcaniana)' : 'explosiva (pliniana)'),
      name: p.silica < 52 ? 'Máfico (basalto)' : (p.silica < 63 ? 'Intermediário (andesito)' : 'Félsico (dacito/riolito)'),
      cone: s < 0.25 ? 'vulcão em escudo (suave)' : (s < 0.6 ? 'estratovulcão' : 'estratovulcão íngreme / domo')
    };
  },

  steps: [
    { id: 0, title: 'Início', sub: 'Visão geral',
      text: 'Este é um bloco-diagrama vivo de uma zona de subducção: a placa oceânica mergulha sob a placa continental, a água liberada pela placa funde o manto e alimenta um estratovulcão. Gire, aproxime e explore. Siga a trilha nas etapas 1 → 2 → 3 → Quiz.' },
    { id: 1, title: 'Etapa 1', sub: 'Imersão no subsolo',
      text: 'Observe as correntes de convecção do manto (partículas quentes sobem, frias descem) e a fricção entre as placas. Mergulhe no manto, use o microscópio no contato entre as placas e provoque terremotos.' },
    { id: 2, title: 'Etapa 2', sub: 'Laboratório vulcânico',
      text: 'Manipule a composição do magma (sílica), temperatura, pressão e gases. Veja como a viscosidade muda a forma do cone e o tipo de erupção: efusiva (lava fluida) ou explosiva (coluna de cinzas e correntes piroclásticas).' },
    { id: 3, title: 'Etapa 3', sub: 'Geoprocessamento de risco',
      text: 'Mapa do entorno do vulcão. Rode a simulação de correntes piroclásticas e lahares, identifique as áreas de perigo e trace rotas de evacuação seguras da vila até um abrigo.' },
    { id: 4, title: 'Quiz', sub: 'Avaliação formativa',
      text: 'Responda às duas questões e leia o gabarito comentado.' }
  ],

  tasksByStep: {
    1: [['dive', 'Mergulhar no manto'], ['micro', 'Usar o microscópio na falha'], ['quake', 'Ativar um evento sísmico'], ['conv', 'Alterar a temperatura e observar a convecção']],
    2: [['mafic', 'Erupção efusiva com magma máfico'], ['felsic', 'Erupção explosiva com magma félsico'], ['rain', 'Ativar chuva intensa (lahar)']],
    3: [['sim', 'Rodar a simulação de perigo'], ['route', 'Traçar uma rota até um abrigo'], ['safe', 'Evacuar com sucesso']]
  },

  quiz: [
    { q: 'Por que vulcões formados em zonas de subducção tendem a apresentar erupções predominantemente explosivas?',
      o: ['O magma é extremamente fluido, permitindo a saída rápida dos gases.',
          'A fusão parcial da crosta subductada gera magma rico em sílica e gases pressurizados, aumentando a viscosidade e a pressão.',
          'A presença de água do oceano resfria totalmente o manto, impedindo o acúmulo de energia.',
          'As placas se afastam, abrindo fissuras por onde o magma escorre suavemente.'],
      c: 1,
      fb: 'A crosta continental absorvida enriquece o magma em sílica, tornando-o viscoso e retendo gases sob alta pressão até que a explosão ocorra.' },
    { q: 'O que justifica a alta densidade demográfica em encostas de vulcões ativos, a despeito dos riscos geotécnicos?',
      o: ['A ausência de leis de zoneamento ambiental em áreas tectônicas.',
          'A fertilidade dos solos vulcânicos (andossolos), ricos em minerais essenciais para a agricultura.',
          'O clima mais frio do topo dos vulcões atrai a especulação imobiliária.',
          'A facilidade de extração de gás natural diretamente da cratera.'],
      c: 1,
      fb: 'O intemperismo das cinzas vulcânicas produz solos altamente férteis, atraindo populações agrícolas historicamente.' }
  ]
};
try { const t = JSON.parse(localStorage.getItem('litos_tasks') || '{}'); APP.tasks = t; } catch (e) {}
