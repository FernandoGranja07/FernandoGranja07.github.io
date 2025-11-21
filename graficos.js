// graficos.js

// ================== PALETAS Y ESTADO GLOBAL ==================

const COLORES_BASE = [
  '#4e79a7', // Azul
  '#f28e2b', // Naranja
  '#e15759', // Rojo
  '#76b7b2', // Verde azulado
  '#59a14f', // Verde
  '#edc948', // Amarillo
  '#b07aa1', // Morado
  '#ff9da7', // Rosa
  '#9c755f', // Marrón
  '#bab0ac'  // Gris
];

const PALETAS = {
  classic: COLORES_BASE,
  pastel: [
    '#a6cee3', '#fb9a99', '#b2df8a', '#fdbf6f', '#cab2d6',
    '#ffff99', '#1f78b4', '#33a02c', '#e31a1c', '#ff7f00'
  ],
  contrast: [
    '#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e',
    '#e6ab02', '#a6761d', '#666666', '#8dd3c7', '#fb8072'
  ]
};

const DEFAULT_TYPES = {
  AHBG: 'bar',
  AHER: 'bar',
  AVBG: 'pie',
  Razones: 'radar',
  CNTCNO: 'bar',
  EOAF: 'bar',
  EFE: 'bar',
  Dup: 'bar'
};

const graficos = {}; // id -> Chart

// ================== CARGA DE CHART.JS ==================

function cargarChartJs(callback) {
  if (typeof Chart !== 'undefined') {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  script.async = true;
  script.onload = () => callback();
  script.onerror = () => console.error('No se pudo cargar Chart.js');
  document.head.appendChild(script);
}

function configurarChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  Chart.defaults.color = '#e6eef8';
  Chart.defaults.borderColor = 'rgba(200, 200, 200, 0.2)';
}

// ================== HELPERS ==================

function parseNumber(raw) {
  if (raw === null || raw === undefined) return 0;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatoNIO(x) {
  return new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x || 0);
}

function formatoPorc(x) {
  return new Intl.NumberFormat('es-NI', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x || 0);
}

function getConfigGraficosGlobal() {
  const base = document.getElementById('grafBaseSelect')?.value || '';
  const comparado = document.getElementById('grafCompSelect')?.value || '';
  const topN = parseInt(
    document.getElementById('grafTopNSelect')?.value || '10',
    10
  );
  const ordenarPor =
    document.getElementById('grafOrdenSelect')?.value || 'deltaAbs';
  const modoValor =
    document.getElementById('grafValorSelect')?.value || 'monto';
  return { base, comparado, topN, ordenarPor, modoValor };
}

function getTipoEstilo(chartId) {
  const tipoSel = document.querySelector(`.chart-tipo[data-chart="${chartId}"]`);
  const estiloSel = document.querySelector(`.chart-estilo[data-chart="${chartId}"]`);
  const tipo = tipoSel?.value || DEFAULT_TYPES[chartId] || 'bar';
  const estilo = estiloSel?.value || 'classic';
  return { tipo, estilo };
}

function getColor(estilo, idx, alpha = 'CC') {
  const paleta = PALETAS[estilo] || PALETAS.classic;
  const base = paleta[idx % paleta.length];
  return {
    fill: base + alpha,
    stroke: base
  };
}

function aplicarTopYOrden(items, cfg) {
  const copia = [...items];
  copia.sort((a, b) => {
    if (cfg.ordenarPor === 'deltaPct') {
      return Math.abs(b.deltaPct || 0) - Math.abs(a.deltaPct || 0);
    }
    if (cfg.ordenarPor === 'valor') {
      return Math.abs(b.valor || 0) - Math.abs(a.valor || 0);
    }
    // deltaAbs por defecto
    return Math.abs(b.deltaAbs || 0) - Math.abs(a.deltaAbs || 0);
  });
  return copia.slice(0, cfg.topN);
}

function getChartOptions(title, type = 'bar') {
  const isDark = true;
  const textColor = isDark ? '#e6eef8' : '#333';
  const gridColor = isDark ? 'rgba(200,200,200,0.1)' : 'rgba(0,0,0,0.1)';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: textColor,
          font: { size: 14, weight: '500' },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8
        }
      },
      title: {
        display: !!title,
        text: title,
        color: textColor,
        font: { size: 16, weight: '600' },
        padding: { top: 10, bottom: 10 }
      },
      tooltip: {
        backgroundColor: 'rgba(30,41,59,0.95)',
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true
      }
    },
    elements: {
      bar: {
        borderRadius: 4,
        borderSkipped: false
      }
    }
  };

  if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
    options.plugins.legend.position = 'right';
  }

  if (type === 'radar') {
    options.scales = {
      r: {
        angleLines: { color: gridColor },
        grid: { color: gridColor },
        pointLabels: { color: textColor, font: { size: 12 } },
        ticks: { color: textColor, backdropColor: 'transparent' }
      }
    };
  } else if (type !== 'pie' && type !== 'doughnut' && type !== 'polarArea') {
    options.scales = {
      y: {
        beginAtZero: true,
        grid: { color: gridColor, drawBorder: false },
        ticks: {
          color: textColor,
          font: { size: 12 }
        }
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: textColor,
          font: { size: 12 },
          maxRotation: 45,
          minRotation: 0,
          autoSkip: false
        }
      }
    };
  }

  return options;
}

function getChartInstance(id, tipo, titulo) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById('chart' + id);
  if (!canvas) return null;

  const existente = graficos[id];
  if (existente && existente.config.type !== tipo) {
    existente.destroy();
    delete graficos[id];
  }
  if (!graficos[id]) {
    graficos[id] = new Chart(canvas, {
      type: tipo,
      data: { labels: [], datasets: [] },
      options: getChartOptions(titulo, tipo)
    });
  } else {
    graficos[id].options = getChartOptions(titulo, tipo);
  }
  return graficos[id];
}

// ================== EVENTOS ==================

function configurarEventosGraficos() {
  const btnActualizar = document.getElementById('grafRenderAllBtn');
  if (btnActualizar) {
    btnActualizar.addEventListener('click', actualizarGraficos);
  }
  const globalSelects = [
    'grafBaseSelect',
    'grafCompSelect',
    'grafTopNSelect',
    'grafOrdenSelect',
    'grafValorSelect'
  ];
  globalSelects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', actualizarGraficos);
  });

  document
    .querySelectorAll('.chart-tipo, .chart-estilo')
    .forEach(sel => sel.addEventListener('change', actualizarGraficos));

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.dataset.tab === 'graficos') {
        setTimeout(actualizarGraficos, 120);
      }
    });
  });
}

// ================== ACTUALIZACIÓN GENERAL ==================

function actualizarGraficos() {
  const { base, comparado } = getConfigGraficosGlobal();
  if (!base || !comparado) return;

  actualizarGraficoAHBG(base, comparado);
  actualizarGraficoAHER(base, comparado);
  actualizarGraficoAVBG(base);
  actualizarGraficoRazones(base, comparado);
  actualizarGraficoCNTCNO(base, comparado);
  actualizarGraficoEOAF(base, comparado);
  actualizarGraficoEFE(base, comparado);
  actualizarGraficoDuPont(base, comparado);
}

// ================== GRÁFICOS ESPECÍFICOS ==================

// 1. AH BG
function actualizarGraficoAHBG(base, comparado) {
  const cfgGlobal = getConfigGraficosGlobal();
  const { tipo, estilo } = getTipoEstilo('AHBG');
  const grafico = getChartInstance(
    'AHBG',
    tipo,
    'Análisis Horizontal - Balance General'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaAHBG tbody tr'));
  let datos;
  if (filas.length) {
    datos = filas.map(row => {
      const c = row.querySelectorAll('td');
      const nombre = c[0]?.textContent.trim() || '';
      const baseVal = parseNumber(c[1]?.textContent);
      const compVal = parseNumber(c[2]?.textContent);
      let deltaAbs = parseNumber(c[3]?.textContent);
      let deltaPct = parseNumber(c[4]?.textContent) / 100;
      if (!isFinite(deltaAbs)) deltaAbs = compVal - baseVal;
      if (!isFinite(deltaPct) && baseVal !== 0) {
        deltaPct = (compVal - baseVal) / baseVal;
      }
      return {
        label: nombre,
        base: baseVal,
        comparado: compVal,
        deltaAbs,
        deltaPct,
        valor: compVal
      };
    });
  } else {
    datos = [
      { label: 'Activo Corriente', base: 50000, comparado: 60000 },
      { label: 'Activo No Corriente', base: 150000, comparado: 180000 },
      { label: 'Pasivo Corriente', base: 40000, comparado: 50000 },
      { label: 'Pasivo No Corriente', base: 80000, comparado: 90000 },
      { label: 'Patrimonio', base: 80000, comparado: 100000 }
    ].map(d => ({
      ...d,
      deltaAbs: d.comparado - d.base,
      deltaPct: d.base ? (d.comparado - d.base) / d.base : 0,
      valor: d.comparado
    }));
  }

  const procesados = aplicarTopYOrden(datos, cfgGlobal);
  const labels = procesados.map(d => d.label);
  const baseVals = procesados.map(d => d.base);
  const compVals = procesados.map(d => d.comparado);

  const c0 = getColor(estilo, 0);
  const c1 = getColor(estilo, 1);

  grafico.data = {
    labels,
    datasets: [
      {
        label: base,
        data: baseVals,
        backgroundColor: c0.fill,
        borderColor: c0.stroke,
        borderWidth: 1
      },
      {
        label: comparado,
        data: compVals,
        backgroundColor: c1.fill,
        borderColor: c1.stroke,
        borderWidth: 1
      }
    ]
  };

  // Tooltips con delta
  grafico._metaDatos = procesados;
  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const d = grafico._metaDatos?.[ctx.dataIndex];
      const serie = ctx.dataset.label;
      const valor = ctx.parsed.y;
      let line = `${serie}: C$ ${formatoNIO(valor)}`;
      return line;
    },
    afterBody: function (items) {
      const idx = items[0].dataIndex;
      const d = grafico._metaDatos?.[idx];
      if (!d) return [];
      return [
        `Δ abs: C$ ${formatoNIO(d.deltaAbs)}`,
        `Δ %: ${formatoPorc(d.deltaPct)}`
      ];
    }
  };

  grafico.update();
}

// 1. AH ER
function actualizarGraficoAHER(base, comparado) {
  const cfgGlobal = getConfigGraficosGlobal();
  const { tipo, estilo } = getTipoEstilo('AHBG'); // mismo selector que BG
  const grafico = getChartInstance(
    'AHER',
    tipo,
    'Análisis Horizontal - Estado de Resultados'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaAHER tbody tr'));
  let datos;
  if (filas.length) {
    datos = filas.map(row => {
      const c = row.querySelectorAll('td');
      const nombre = c[0]?.textContent.trim() || '';
      const baseVal = parseNumber(c[1]?.textContent);
      const compVal = parseNumber(c[2]?.textContent);
      let deltaAbs = parseNumber(c[3]?.textContent);
      let deltaPct = parseNumber(c[4]?.textContent) / 100;
      if (!isFinite(deltaAbs)) deltaAbs = compVal - baseVal;
      if (!isFinite(deltaPct) && baseVal !== 0) {
        deltaPct = (compVal - baseVal) / baseVal;
      }
      return {
        label: nombre,
        base: baseVal,
        comparado: compVal,
        deltaAbs,
        deltaPct,
        valor: compVal
      };
    });
  } else {
    datos = [
      { label: 'Ventas', base: 200000, comparado: 250000 },
      { label: 'Costo de Ventas', base: 120000, comparado: 150000 },
      { label: 'Utilidad Bruta', base: 80000, comparado: 100000 },
      { label: 'Gastos Operativos', base: 40000, comparado: 45000 },
      { label: 'Utilidad Operativa', base: 40000, comparado: 55000 }
    ].map(d => ({
      ...d,
      deltaAbs: d.comparado - d.base,
      deltaPct: d.base ? (d.comparado - d.base) / d.base : 0,
      valor: d.comparado
    }));
  }

  const procesados = aplicarTopYOrden(datos, cfgGlobal);
  const labels = procesados.map(d => d.label);
  const baseVals = procesados.map(d => d.base);
  const compVals = procesados.map(d => d.comparado);

  const c0 = getColor(estilo, 2);
  const c1 = getColor(estilo, 3);

  grafico.data = {
    labels,
    datasets: [
      {
        label: base,
        data: baseVals,
        backgroundColor: c0.fill,
        borderColor: c0.stroke,
        borderWidth: 1
      },
      {
        label: comparado,
        data: compVals,
        backgroundColor: c1.fill,
        borderColor: c1.stroke,
        borderWidth: 1
      }
    ]
  };

  grafico._metaDatos = procesados;
  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const d = grafico._metaDatos?.[ctx.dataIndex];
      const serie = ctx.dataset.label;
      const valor = ctx.parsed.y;
      let line = `${serie}: C$ ${formatoNIO(valor)}`;
      return line;
    },
    afterBody: function (items) {
      const idx = items[0].dataIndex;
      const d = grafico._metaDatos?.[idx];
      if (!d) return [];
      return [
        `Δ abs: C$ ${formatoNIO(d.deltaAbs)}`,
        `Δ %: ${formatoPorc(d.deltaPct)}`
      ];
    }
  };

  grafico.update();
}

// 1. AV BG (pie) – siempre en pastel
function actualizarGraficoAVBG(periodo) {
  const { estilo } = getTipoEstilo('AHBG');
  const grafico = getChartInstance(
    'AVBG',
    'pie',
    'Análisis Vertical - Balance General'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaAVBG tbody tr'));
  let labels = [];
  let valores = [];

  if (filas.length) {
    filas.forEach(row => {
      const c = row.querySelectorAll('td');
      const nombre = c[0]?.textContent.trim() || '';
      const pct = parseNumber(c[2]?.textContent); // % sobre TA/TPP
      if (nombre) {
        labels.push(nombre);
        valores.push(pct);
      }
    });
  } else {
    labels = [
      'Activo Corriente',
      'Activo No Corriente',
      'Pasivo Corriente',
      'Pasivo No Corriente',
      'Patrimonio'
    ];
    valores = [25, 75, 20, 30, 50];
  }

  const paleta = PALETAS[estilo] || PALETAS.classic;

  grafico.data = {
    labels,
    datasets: [
      {
        data: valores,
        backgroundColor: labels.map((_, i) => (paleta[i % paleta.length] + 'CC')),
        borderColor: labels.map((_, i) => paleta[i % paleta.length]),
        borderWidth: 1
      }
    ]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const label = ctx.label || '';
      const v = ctx.parsed;
      return `${label}: ${formatoNIO(v)} %`;
    }
  };

  grafico.update();
}

// 2. Razones
function actualizarGraficoRazones(base, comparado) {
  const { tipo, estilo } = getTipoEstilo('Razones');
  const grafico = getChartInstance('Razones', tipo, 'Razones financieras');
  if (!grafico) return;

  let labels = [];
  let baseVals = [];
  let compVals = [];

  if (typeof window.razonesListado === 'function') {
    const listaBase = window.razonesListado(base) || [];
    const listaComp = window.razonesListado(comparado) || [];

    const mapBase = new Map();
    listaBase.forEach(r => mapBase.set(r.nombre, parseNumber(r.valor)));

    const mapComp = new Map();
    listaComp.forEach(r => mapComp.set(r.nombre, parseNumber(r.valor)));

    const nombres = new Set([
      ...listaBase.map(r => r.nombre),
      ...listaComp.map(r => r.nombre)
    ]);

    nombres.forEach(nombre => {
      labels.push(nombre);
      baseVals.push(mapBase.get(nombre) ?? 0);
      compVals.push(mapComp.get(nombre) ?? 0);
    });
  } else {
    labels = [
      'Liquidez Corriente',
      'Prueba Ácida',
      'Endeudamiento',
      'Rentabilidad',
      'Rotación de Inventario'
    ];
    baseVals = [1.5, 1.0, 0.6, 0.15, 6];
    compVals = [1.8, 1.2, 0.55, 0.18, 6.5];
  }

  const c0 = getColor(estilo, 4);
  const c1 = getColor(estilo, 5);

  grafico.data = {
    labels,
    datasets: [
      {
        label: base,
        data: baseVals,
        backgroundColor: tipo === 'radar' ? c0.fill : c0.fill,
        borderColor: c0.stroke,
        borderWidth: 2,
        pointBackgroundColor: c0.stroke
      },
      {
        label: comparado,
        data: compVals,
        backgroundColor: tipo === 'radar' ? c1.fill : c1.fill,
        borderColor: c1.stroke,
        borderWidth: 2,
        pointBackgroundColor: c1.stroke
      }
    ]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const label = ctx.label || '';
      const serie = ctx.dataset.label || '';
      const v = ctx.parsed.r ?? ctx.parsed.y ?? ctx.raw;
      return `${label} (${serie}): ${formatoNIO(v)}`;
    }
  };

  grafico.update();
}

// 3. CNT / CNO  (por ahora demo; se puede enlazar a tus KPIs reales)
function actualizarGraficoCNTCNO(base, comparado) {
  const { tipo, estilo } = getTipoEstilo('CNTCNO');
  const grafico = getChartInstance(
    'CNTCNO',
    tipo,
    'Capital Neto de Trabajo y CNO'
  );
  if (!grafico) return;

  // TODO: enlazar a tus datos de CNT/CNO si los renderizas en el DOM.
  const datos = {
    CNT: { base: 50000, comparado: 60000 },
    CNO: { base: 30000, comparado: 35000 }
  };

  const labels = [base, comparado];
  const CNTs = [datos.CNT.base, datos.CNT.comparado];
  const CNOs = [datos.CNO.base, datos.CNO.comparado];

  const c0 = getColor(estilo, 6);
  const c1 = getColor(estilo, 7);

  grafico.data = {
    labels,
    datasets: [
      {
        label: 'CNT',
        data: CNTs,
        backgroundColor: c0.fill,
        borderColor: c0.stroke,
        borderWidth: 1
      },
      {
        label: 'CNO',
        data: CNOs,
        backgroundColor: c1.fill,
        borderColor: c1.stroke,
        borderWidth: 1
      }
    ]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const serie = ctx.dataset.label || '';
      const v = ctx.parsed.y ?? ctx.parsed;
      return `${serie} (${ctx.label}): C$ ${formatoNIO(v)}`;
    }
  };

  grafico.update();
}

// 4. EOAF – usa la tabla EOAF real
function actualizarGraficoEOAF(base, comparado) {
  const { tipo, estilo } = getTipoEstilo('EOAF');
  const grafico = getChartInstance(
    'EOAF',
    tipo,
    'EOAF - Origen y Aplicación de Fondos'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaEOAF tbody tr'));
  let totalOrigen = 0;
  let totalAplic = 0;

  if (filas.length) {
    filas.forEach(row => {
      const c = row.querySelectorAll('td');
      const origen = parseNumber(c[5]?.textContent);
      const aplic = parseNumber(c[6]?.textContent);
      totalOrigen += origen;
      totalAplic += aplic;
    });
  } else {
    totalOrigen = 150000;
    totalAplic = 130000;
  }

  const labels = ['Origen de fondos', 'Aplicación de fondos'];
  const valores = [totalOrigen, totalAplic];
  const paleta = PALETAS[estilo] || PALETAS.classic;
  const c0 = getColor(estilo, 0);
  const c1 = getColor(estilo, 1);

  let dataset;
  if (tipo === 'pie' || tipo === 'doughnut' || tipo === 'polarArea') {
    dataset = {
      label: `${base} vs ${comparado}`,
      data: valores,
      backgroundColor: [c0.fill, c1.fill],
      borderColor: [c0.stroke, c1.stroke],
      borderWidth: 1
    };
  } else {
    dataset = {
      label: `${base} vs ${comparado}`,
      data: valores,
      backgroundColor: [c0.fill, c1.fill],
      borderColor: [c0.stroke, c1.stroke],
      borderWidth: 1
    };
  }

  grafico.data = {
    labels,
    datasets: [dataset]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const label = ctx.label || '';
      const v = ctx.parsed ?? ctx.raw;
      return `${label}: C$ ${formatoNIO(v)}`;
    }
  };

  grafico.update();
}

// 5. EFE – lee conceptos reales del EFE
function actualizarGraficoEFE(base, comparado) {
  const { tipo, estilo } = getTipoEstilo('EFE');
  const grafico = getChartInstance(
    'EFE',
    tipo,
    'Estado de Flujo de Efectivo'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaEFE tbody tr'));
  let labels = [];
  let valores = [];

  if (filas.length) {
    filas.forEach(row => {
      const c = row.querySelectorAll('td');
      const concepto = c[0]?.textContent.trim() || '';
      const monto = parseNumber(c[1]?.textContent);
      if (concepto) {
        labels.push(concepto);
        valores.push(monto);
      }
    });
  } else {
    labels = ['Operación', 'Inversión', 'Financiamiento'];
    valores = [50000, -30000, -15000];
  }

  const c0 = getColor(estilo, 2);

  grafico.data = {
    labels,
    datasets: [
      {
        label: `${base} vs ${comparado}`,
        data: valores,
        backgroundColor: labels.map((_, i) =>
          getColor(estilo, 2 + i).fill
        ),
        borderColor: labels.map((_, i) =>
          getColor(estilo, 2 + i).stroke
        ),
        borderWidth: 1
      }
    ]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const label = ctx.label || '';
      const v = ctx.parsed.y ?? ctx.parsed ?? ctx.raw;
      return `${label}: C$ ${formatoNIO(v)}`;
    }
  };

  grafico.update();
}

// 6. DuPont – lee tabla real
function actualizarGraficoDuPont(base, comparado) {
  const { tipo, estilo } = getTipoEstilo('Dup');
  const grafico = getChartInstance(
    'Dup',
    tipo,
    'Modelo DuPont (3 pasos)'
  );
  if (!grafico) return;

  let filas = Array.from(document.querySelectorAll('#tablaDuPont tbody tr'));
  let labels = [];
  let valores = [];

  if (filas.length) {
    filas.forEach(row => {
      const c = row.querySelectorAll('td');
      const comp = c[0]?.textContent.trim() || '';
      const val = parseNumber(c[1]?.textContent);
      if (comp) {
        labels.push(comp);
        valores.push(val);
      }
    });
  } else {
    labels = ['Margen Neto', 'Rotación de Activos', 'Apalancamiento', 'ROE'];
    valores = [0.12, 0.8, 2.0, 0.192];
  }

  grafico.data = {
    labels,
    datasets: [
      {
        label: `${base} vs ${comparado}`,
        data: valores,
        backgroundColor: labels.map((_, i) =>
          getColor(estilo, i).fill
        ),
        borderColor: labels.map((_, i) =>
          getColor(estilo, i).stroke
        ),
        borderWidth: 1
      }
    ]
  };

  grafico.options.plugins.tooltip.callbacks = {
    label: function (ctx) {
      const label = ctx.label || '';
      const v = ctx.parsed.y ?? ctx.parsed ?? ctx.raw;
      return `${label}: ${formatoNIO(v)}`;
    }
  };

  grafico.update();
}

// ================== ARRANQUE ==================

document.addEventListener('DOMContentLoaded', () => {
  cargarChartJs(() => {
    configurarChartDefaults();
    configurarEventosGraficos();
    setTimeout(actualizarGraficos, 600);
  });
});

