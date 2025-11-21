// proforma.js — versión simplificada y DOM-based

// ===== Helpers numéricos y formato =====
var NF_PROF = new Intl.NumberFormat('es-NI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function toNum(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function parseMonto(text) {
  if (!text) return 0;
  var cleaned = String(text).replace(/[^0-9,\-\.]/g, '').trim();
  if (!cleaned) return 0;

  var commaPos = cleaned.lastIndexOf(',');
  var dotPos = cleaned.lastIndexOf('.');

  if (commaPos > dotPos) {
    // decimal = coma, miles = puntos
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // decimal = punto, miles = comas
    cleaned = cleaned.replace(/,/g, '');
  }

  var n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function delay(ms, cb) {
  setTimeout(cb, ms);
}

// ===== 1) Sincronizar años al selector de Pro Forma =====
function actualizarSelectorAnoBaseDesdePeriodos() {
  var origen = document.getElementById('periodoActivoSelect');
  var destino = document.getElementById('proformaBaseSelect');

  if (!origen || !destino) {
    console.warn('No encontré #periodoActivoSelect o #proformaBaseSelect');
    return;
  }

  destino.innerHTML = '';

  if (!origen.options || origen.options.length === 0) {
    var op0 = document.createElement('option');
    op0.value = '';
    op0.textContent = 'No hay periodos disponibles';
    destino.appendChild(op0);
    return;
  }

  var defaultOp = document.createElement('option');
  defaultOp.value = '';
  defaultOp.textContent = 'Seleccione un año base';
  destino.appendChild(defaultOp);

  for (var i = 0; i < origen.options.length; i++) {
    var src = origen.options[i];
    if (!src.value) continue;
    var op = document.createElement('option');
    op.value = src.value;
    op.textContent = src.textContent;
    destino.appendChild(op);
  }

  destino.value = origen.value || '';
  console.log('Selector Proforma sincronizado desde periodoActivoSelect');
}

// ===== 2) Leer BG y ER del DOM (periodo activo) =====
function leerERDesdeDOM() {
  var rows = document.querySelectorAll('#tablaER tbody tr');
  var cuentas = [];

  rows.forEach(function(row) {
    var celdas = row.querySelectorAll('td,th');
    if (celdas.length < 4) return;

    var nombre = celdas[0].textContent.trim();
    var monto = parseMonto(celdas[3].textContent);

    if (!nombre) return;
    cuentas.push({ nombre: nombre, monto: monto });
  });

  return cuentas;
}

function leerBGDesdeDOM() {
  var rows = document.querySelectorAll('#tablaBG tbody tr');
  var cuentas = [];

  rows.forEach(function(row) {
    var celdas = row.querySelectorAll('td,th');
    if (celdas.length < 4) return;

    var nombre = celdas[0].textContent.trim();
    var monto = parseMonto(celdas[3].textContent);

    if (!nombre) return;
    cuentas.push({ nombre: nombre, monto: monto });
  });

  return cuentas;
}

// ===== 3) Generar proyección Pro Forma =====
function generarProyeccionProforma() {
  var baseSelect = document.getElementById('proformaBaseSelect');
  var aniosInput = document.getElementById('proformaAniosProyeccion');
  var crecInput = document.getElementById('proformaCrecimientoVentas');
  var impInput = document.getElementById('proformaImpuestos');
  var retInput = document.getElementById('proformaUtilidadesRetenidas');

  if (!baseSelect || !baseSelect.value) {
    alert('Seleccione un periodo base para la proyección.');
    return;
  }

  var baseYear = baseSelect.value;
  var periodoActivoSelect = document.getElementById('periodoActivoSelect');
  var periodoActivo = periodoActivoSelect ? periodoActivoSelect.value : null;

  // 1) Asegurar que el periodo ACTIVO sea el mismo que el base
  if (periodoActivo !== baseYear) {
    if (typeof window.setPeriodoActivo === 'function') {
      window.setPeriodoActivo(baseYear);
      if (periodoActivoSelect) periodoActivoSelect.value = baseYear;

      // darle tiempo a app.js para recargar tablas
      return delay(300, function() {
        generarProyeccionProforma(); // reintenta ya con tablas del año correcto
      });
    } else {
      alert(
        'Antes de generar la proyección, selecciona el mismo año como "Periodo activo" en la parte superior.'
      );
      return;
    }
  }

  // 2) Leer BG y ER del DOM
  var erBase = leerERDesdeDOM();
  var bgBase = leerBGDesdeDOM();

  if (!erBase.length) {
    alert('El periodo base seleccionado no tiene datos en el Estado de Resultados.');
    return;
  }

  var g = toNum(crecInput && crecInput.value) / 100;
  var tImp = toNum(impInput && impInput.value) / 100;
  var tRet = toNum(retInput && retInput.value) / 100;
  var nAnios = Math.max(1, Math.floor(toNum(aniosInput && aniosInput.value) || 1));

  console.log('Generando Proforma (DOM) para', baseYear, {
    crecimientoVentas: g,
    tasaImpuesto: tImp,
    tasaRetencion: tRet,
    anios: nAnios
  });

  // 3) Detectar ventas y otros rubros del ER
  var ventasBase = 0;
  var ventasCuentas = [];
  var otrasCuentas = [];

  erBase.forEach(function(it) {
    var nombreLower = it.nombre.toLowerCase();

    if (nombreLower.indexOf('venta') !== -1 && nombreLower.indexOf('costo') === -1) {
      ventasBase += it.monto;
      ventasCuentas.push(it);
    } else {
      otrasCuentas.push(it);
    }
  });

  if (ventasBase <= 0) {
    alert(
      'No se encontró ninguna cuenta de ventas en el ER del periodo base.\n' +
        'Asegúrate de que tu cuenta se llame algo como "Ventas" o "Ventas netas".'
    );
    return;
  }

  var ventasProy = ventasBase * (1 + g);
  var factorVentas = ventasProy / ventasBase;

  var totalCostosProy = 0;
  var otrasProy = otrasCuentas.map(function(it) {
    var montoProy = it.monto * factorVentas;
    totalCostosProy += montoProy;
    return { nombre: it.nombre, montoProy: montoProy };
  });

  var utilidadAntesImp = ventasProy - totalCostosProy;
  var impuesto = utilidadAntesImp * tImp;
  var utilidadNeta = utilidadAntesImp - impuesto;
  var utilRetenida = utilidadNeta * tRet;

  // ===== 4) Renderizar Estado de Resultados Proforma =====
  var erBody = document.getElementById('proformaERBody');
  if (erBody) {
    erBody.innerHTML = '';

    function addRowER(nombre, monto, nota) {
      if (nota === undefined) nota = '';
      var tr = document.createElement('tr');

      var tdNombre = document.createElement('td');
      tdNombre.textContent = nombre;

      var tdMonto = document.createElement('td');
      tdMonto.className = 'text-right';
      tdMonto.textContent = NF_PROF.format(monto);

      var tdPct = document.createElement('td');
      tdPct.className = 'text-right';
      tdPct.textContent = ventasProy
        ? (monto / ventasProy * 100).toFixed(2) + '%'
        : '';

      var tdNotas = document.createElement('td');
      tdNotas.textContent = nota;

      tr.appendChild(tdNombre);
      tr.appendChild(tdMonto);
      tr.appendChild(tdPct);
      tr.appendChild(tdNotas);
      erBody.appendChild(tr);
    }

    addRowER(
      'Ventas proyectadas (' +
        baseYear +
        ' → ' +
        (parseInt(baseYear, 10) + nAnios) +
        ')',
      ventasProy,
      'Crecen ' + (g * 100).toFixed(2) + '% desde ' + NF_PROF.format(ventasBase)
    );

    otrasProy.forEach(function(it) {
      addRowER(it.nombre, it.montoProy);
    });

    addRowER('Utilidad antes de impuestos', utilidadAntesImp);
    addRowER('Impuestos proyectados', impuesto);
    addRowER(
      'Utilidad neta proyectada',
      utilidadNeta,
      'Utilidades retenidas: ' + NF_PROF.format(utilRetenida)
    );
  }

  // ===== 5) Renderizar Balance General Proforma =====
  var bgBody = document.getElementById('proformaBGBody');
  if (bgBody && bgBase.length) {
    bgBody.innerHTML = '';

    bgBase.forEach(function(it) {
      var montoProy = factorVentas > 0 ? it.monto * factorVentas : it.monto;

      var tr = document.createElement('tr');

      var tdNombre = document.createElement('td');
      tdNombre.textContent = it.nombre;

      var tdMonto = document.createElement('td');
      tdMonto.className = 'text-right';
      tdMonto.textContent = NF_PROF.format(montoProy);

      var tdPct = document.createElement('td');
      tdPct.className = 'text-right';
      tdPct.textContent = ventasProy
        ? (montoProy / ventasProy * 100).toFixed(2) + '%'
        : '';

      var tdNotas = document.createElement('td');
      tdNotas.textContent = '';

      tr.appendChild(tdNombre);
      tr.appendChild(tdMonto);
      tr.appendChild(tdPct);
      tr.appendChild(tdNotas);
      bgBody.appendChild(tr);
    });
  }

  // ===== 6) Renderizar Flujo de Efectivo Proforma (resumen) =====
  var feBody = document.getElementById('proformaFEBody');
  if (feBody) {
    feBody.innerHTML = '';

    var rowsFE = [
      ['Utilidad neta proyectada', utilidadNeta],
      ['Utilidades retenidas proyectadas', utilRetenida]
    ];

    rowsFE.forEach(function(item) {
      var nombre = item[0];
      var monto = item[1];

      var tr = document.createElement('tr');
      var tdNombre = document.createElement('td');
      var tdMonto = document.createElement('td');

      tdNombre.textContent = nombre;
      tdMonto.className = 'text-right';
      tdMonto.textContent = NF_PROF.format(monto);

      tr.appendChild(tdNombre);
      tr.appendChild(tdMonto);
      feBody.appendChild(tr);
    });
  }

  console.log('Proyección generada (DOM) para año base', baseYear, {
    ventasBase: ventasBase,
    ventasProy: ventasProy,
    utilidadAntesImp: utilidadAntesImp,
    impuesto: impuesto,
    utilidadNeta: utilidadNeta,
    utilRetenida: utilRetenida
  });
}

// ===== 4) Inicialización =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('proforma.js DOM listo (versión sencilla DOM)');

  // pequeño delay para que app.js cargue los periodos/demo
  delay(300, actualizarSelectorAnoBaseDesdePeriodos);

  var tabProformaBtn = document.querySelector('.tab-btn[data-tab="proforma"]');
  if (tabProformaBtn) {
    tabProformaBtn.addEventListener('click', function() {
      delay(150, actualizarSelectorAnoBaseDesdePeriodos);
    });
  }

  var agregarPeriodoBtn = document.getElementById('agregarPeriodoBtn');
  if (agregarPeriodoBtn) {
    agregarPeriodoBtn.addEventListener('click', function() {
      delay(300, actualizarSelectorAnoBaseDesdePeriodos);
    });
  }

  var cargarDemoBtn = document.getElementById('cargarDemoBtn');
  if (cargarDemoBtn) {
    cargarDemoBtn.addEventListener('click', function() {
      delay(500, actualizarSelectorAnoBaseDesdePeriodos);
    });
  }

  var importarJsonInput = document.getElementById('importarJsonInput');
  if (importarJsonInput) {
    importarJsonInput.addEventListener('change', function() {
      delay(500, actualizarSelectorAnoBaseDesdePeriodos);
    });
  }

  var generarBtn = document.getElementById('generarProformaBtn');
  if (generarBtn) {
    generarBtn.addEventListener('click', generarProyeccionProforma);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  var tabButtons = document.querySelectorAll('.proforma-tab-btn');
  var tabContents = {
    'estado-resultados': document.getElementById('proformaEstadoResultados'),
    'balance-general': document.getElementById('proformaBalanceGeneral'),
    'flujo-efectivo': document.getElementById('proformaFlujoEfectivo')
  };

  function activarProformaTab(nombre) {
    // activar botón
    tabButtons.forEach(function (btn) {
      if (btn.getAttribute('data-proforma-tab') === nombre) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // mostrar contenido
    for (var key in tabContents) {
      if (!tabContents[key]) continue;
      if (key === nombre) {
        tabContents[key].classList.add('active');
      } else {
        tabContents[key].classList.remove('active');
      }
    }
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nombre = btn.getAttribute('data-proforma-tab');
      activarProformaTab(nombre);
    });
  });

  // Por si acaso, aseguramos que al inicio esté encendido Estado de Resultados
  activarProformaTab('estado-resultados');
});

// ===== 7) Utilidades para leer Proforma desde el DOM =====
function leerTablaProformaGenerica(tbodyId) {
  var body = document.getElementById(tbodyId);
  var filas = [];
  if (!body) return filas;

  body.querySelectorAll('tr').forEach(function (tr) {
    var celdas = tr.querySelectorAll('td');
    if (!celdas.length) return;
    filas.push({
      c1: (celdas[0] && celdas[0].textContent.trim()) || '',
      c2: (celdas[1] && celdas[1].textContent.trim()) || '',
      c3: (celdas[2] && celdas[2].textContent.trim()) || '',
      c4: (celdas[3] && celdas[3].textContent.trim()) || ''
    });
  });

  return filas;
}

function obtenerParametrosProforma() {
  var baseSelect = document.getElementById('proformaBaseSelect');
  var aniosInput = document.getElementById('proformaAniosProyeccion');
  var crecInput = document.getElementById('proformaCrecimientoVentas');
  var impInput = document.getElementById('proformaImpuestos');
  var retInput = document.getElementById('proformaUtilidadesRetenidas');

  return {
    baseYear: baseSelect ? baseSelect.value : '',
    anios: toNum(aniosInput && aniosInput.value),
    crecVentas: toNum(crecInput && crecInput.value),
    impuestos: toNum(impInput && impInput.value),
    utilRetenidas: toNum(retInput && retInput.value)
  };
}

// ===== 8) Guardar Proyección en localStorage =====
function guardarProyeccionActual() {
  var erFilas = leerTablaProformaGenerica('proformaERBody');
  if (!erFilas.length) {
    alert('Primero genere la proyección antes de guardar.');
    return;
  }

  var bgFilas = leerTablaProformaGenerica('proformaBGBody');
  var feFilas = leerTablaProformaGenerica('proformaFEBody');
  var params = obtenerParametrosProforma();

  var empresaInput = document.getElementById('empresaInput');
  var empresa = empresaInput && empresaInput.value.trim()
    ? empresaInput.value.trim()
    : 'Sin nombre';

  if (!params.baseYear) {
    alert('Seleccione un periodo base antes de guardar la proyección.');
    return;
  }

  var proyeccion = {
    id: Date.now(),
    empresa: empresa,
    baseYear: params.baseYear,
    parametros: params,
    fechaGuardado: new Date().toISOString(),
    estadoResultados: erFilas,
    balanceGeneral: bgFilas,
    flujoEfectivo: feFilas
  };

  var KEY = 'finbot_proformas_v1';
  var store = {};
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) store = JSON.parse(raw) || {};
  } catch (e) {
    console.warn('No se pudo leer finbot_proformas_v1:', e);
  }

  if (!store[empresa]) store[empresa] = {};
  if (!store[empresa][params.baseYear]) store[empresa][params.baseYear] = [];

  store[empresa][params.baseYear].push(proyeccion);

  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    alert('Proyección guardada correctamente para ' + empresa + ' (' + params.baseYear + ').');
    console.log('Proyección guardada:', proyeccion);
  } catch (e) {
    console.error('Error al guardar la proyección:', e);
    alert('Ocurrió un error al guardar la proyección en el navegador.');
  }
}


/**/  

// ===== 9) Exportar Proforma a "Excel" (.xls con HTML) =====
function exportarProformaAExcel() {
  var erTabla = document.querySelector('#proformaEstadoResultados table');
  var bgTabla = document.querySelector('#proformaBalanceGeneral table');
  var feTabla = document.querySelector('#proformaFlujoEfectivo table');

  if (!erTabla || !erTabla.tBodies[0] || !erTabla.tBodies[0].rows.length) {
    alert('Primero genere la proyección antes de exportar.');
    return;
  }

  var empresaInput = document.getElementById('empresaInput');
  var empresa = empresaInput && empresaInput.value.trim()
    ? empresaInput.value.trim()
    : 'Empresa';

  var params = obtenerParametrosProforma();
  var baseYear = params.baseYear || '';
  var titulo = 'Proyección Proforma FINBOT';

  var resumenHTML =
    '<p><b>Empresa:</b> ' + empresa + '<br/>' +
    '<b>Periodo base:</b> ' + (baseYear || '-') + '<br/>' +
    '<b>Años a proyectar:</b> ' + (params.anios || 1) + '<br/>' +
    '<b>% Crecimiento ventas:</b> ' + (params.crecVentas || 0).toFixed(2) + '%<br/>' +
    '<b>% Impuestos:</b> ' + (params.impuestos || 0).toFixed(2) + '%<br/>' +
    '<b>% Utilidades retenidas:</b> ' + (params.utilRetenidas || 0).toFixed(2) + '%</p>';

  var html =
    '<html><head><meta charset="utf-8" /></head><body>' +
    '<h2>' + titulo + '</h2>' +
    resumenHTML +
    '<h3>Estado de Resultados Proforma</h3>' +
    erTabla.outerHTML +
    '<h3>Balance General Proforma</h3>' +
    (bgTabla ? bgTabla.outerHTML : '') +
    '<h3>Flujo de Efectivo Proforma</h3>' +
    (feTabla ? feTabla.outerHTML : '') +
    '</body></html>';

  var blob = new Blob([html], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  });

  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');

  var safeEmpresa = empresa.replace(/[^\w\-]+/g, '_');
  var nombreArchivo = 'Proforma_' + safeEmpresa + '_' + (baseYear || 'N').toString() + '.xls';

  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



/* */ 
document.addEventListener('DOMContentLoaded', function () {
  var guardarBtn = document.getElementById('guardarProyeccionBtn');
  var exportarBtn = document.getElementById('exportarProformaBtn');

  if (guardarBtn) {
    guardarBtn.addEventListener('click', function () {
      guardarProyeccionActual();
    });
  }

  if (exportarBtn) {
    exportarBtn.addEventListener('click', function () {
      exportarProformaAExcel();
    });
  }
});
