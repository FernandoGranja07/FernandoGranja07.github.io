/* =========================================================
   FINBOT Web — Exportador FINAL (Excel + PDF + Gráficos)
   Exporta TODO lo calculado en app:
   ANALISIS, RAZONES, EOAF, EFE, DUPONT, GRAFICOS, PROFORMA
   ========================================================= */
(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const safeText = (x) => (x ?? "").toString().replace(/\s+/g," ").trim();
  const n = (x) => isNaN(Number(x)) ? 0 : Number(x);
  const safeDiv = (a,b)=> b===0 ? 0 : a/b;

  const nowStamp = () => {
    const d=new Date(), p=v=>String(v).padStart(2,"0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  };

  function getStateSafe(){
    if (typeof finbotGetState === "function") return finbotGetState();
    if (window.state) return window.state;
    throw new Error("No hay datos en state. Primero cargá/calculá periodos.");
  }

  function sortedPeriodos(S){
    return Object.keys(S.periodos||{}).sort((a,b)=>Number(a)-Number(b));
  }

  function normalizeRows(rows){
    if (!rows) return [];
    if (Array.isArray(rows)) return rows;
    if (typeof rows === "object"){
      if (Array.isArray(rows.rows)) return rows.rows;
      return Object.values(rows);
    }
    return [];
  }

  function aoaAddTitle(aoa, title){
    aoa.push([title]);
    aoa.push([]);
  }

  function aoaAddTableSmart(aoa, title, headers, rawRows){
    const rows = normalizeRows(rawRows);
    aoa.push([title]);

    // rows como array de objetos
    if (rows.length && !Array.isArray(rows[0]) && typeof rows[0] === "object"){
      aoa.push(headers);
      rows.forEach(obj=>{
        const r = headers.map(h =>
          obj[h] ??
          obj[h.replace(/\s+/g,'')] ??
          obj[h.toLowerCase()] ??
          ""
        );
        aoa.push(r);
      });
      aoa.push([]);
      return;
    }

    // rows como array de arrays
    if (headers?.length) aoa.push(headers);
    rows.forEach(r => aoa.push(Array.isArray(r) ? r : [r]));
    aoa.push([]);
  }

  function sheetFromAOA(wb, name, aoa){
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
  }

  // ======================================================
  // 1) ANALISIS (AH + AV reales)
  // ======================================================
  function makeAnalisisAOA(S){
    const aoa=[];
    aoaAddTitle(aoa,"ANALISIS");

    const ps=sortedPeriodos(S);

    // AH por pares (BG y ER)
    for (let i=1;i<ps.length;i++){
      const base=ps[i-1], comp=ps[i];

      if (typeof analisisHorizontal === "function"){
        const ahBG = normalizeRows(analisisHorizontal(base, comp, "BG"));
        aoa.push([`Análisis Horizontal BG: ${base} vs ${comp}`]);
        aoaAddTableSmart(
          aoa, "AH BG",
          ["Cuenta","Base","Comparado","Δ Abs","Δ %"],
          ahBG.map(r=>({
            "Cuenta": r.nombre,
            "Base": r.base,
            "Comparado": r.comp,
            "Δ Abs": r.delta,
            "Δ %": r.dperc
          }))
        );

        const ahER = normalizeRows(analisisHorizontal(base, comp, "ER"));
        aoa.push([`Análisis Horizontal ER: ${base} vs ${comp}`]);
        aoaAddTableSmart(
          aoa, "AH ER",
          ["Cuenta","Base","Comparado","Δ Abs","Δ %"],
          ahER.map(r=>({
            "Cuenta": r.nombre,
            "Base": r.base,
            "Comparado": r.comp,
            "Δ Abs": r.delta,
            "Δ %": r.dperc
          }))
        );
      }
    }

    // AV por periodo (BG y ER)
    ps.forEach(p=>{
      if (typeof analisisVerticalBG==="function"){
        const avBG = normalizeRows(analisisVerticalBG(p));
        aoa.push([`Análisis Vertical BG: ${p}`]);
        aoaAddTableSmart(
          aoa, "AV BG",
          ["Cuenta","Clasif.","% sobre TA/TPP"],
          avBG.map(r=>({
            "Cuenta": r.nombre,
            "Clasif.": r.clasif,
            "% sobre TA/TPP": r.p
          }))
        );
      }

      if (typeof analisisVerticalER==="function"){
        const avER = normalizeRows(analisisVerticalER(p));
        aoa.push([`Análisis Vertical ER: ${p}`]);
        aoaAddTableSmart(
          aoa, "AV ER",
          ["Cuenta","Clasif.","% sobre Ventas"],
          avER.map(r=>({
            "Cuenta": r.nombre,
            "Clasif.": r.clasif,
            "% sobre Ventas": r.p
          }))
        );
      }
    });

    return aoa;
  }

  // ======================================================
  // 2) RAZONES (ya funciona bien)
  // ======================================================
  function makeRazonesAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"RAZONES");

    let data=[];
    if (typeof getRazonesData==="function"){
      data = normalizeRows(getRazonesData(S));
    }

    aoaAddTableSmart(
      aoa,"Razones Financieras",
      ["Periodo","Razón","Fórmula","Valor","Interpretación"],
      data.map(x=>({
        "Periodo": x.Periodo ?? x.periodo,
        "Razón": x["Razón"] ?? x.razon ?? x.nombre,
        "Fórmula": x["Fórmula"] ?? x.formula ?? "",
        "Valor": x.Valor ?? x.valor,
        "Interpretación": x["Interpretación"] ?? x.interpretacion ?? ""
      }))
    );

    return aoa;
  }

  // ======================================================
  // 3) EOAF (calculado real, NO usando getEOAFData)
  // ======================================================
// ======================================================
// 3) EOAF (robusto, sin depender de helpers externos)
// ======================================================
function computeEOAFRows(base, comp){
  const S = getStateSafe();
  const mb = S.periodos?.[base]?.BG || [];
  const mc = S.periodos?.[comp]?.BG || [];

  const sumByName = (arr, nm) =>
    arr.filter(x=>x.nombre===nm).reduce((s,x)=>s + n(x.monto), 0);

  const clasifOf = (nm) =>
    mc.find(x=>x.nombre===nm)?.clasif ||
    mb.find(x=>x.nombre===nm)?.clasif || "";

  const names = new Set([...mb.map(x=>x.nombre), ...mc.map(x=>x.nombre)]);

  const rows = [];
  for(const nm of names){
    const a = n(sumByName(mb,nm));
    const b = n(sumByName(mc,nm));
    const delta = b - a;
    if(!delta) continue;

    rows.push({
      "Cuenta": nm,
      "Clasif.": clasifOf(nm),
      "Año 1": a,
      "Año 2": b,
      "Cambios": delta,
      "Origen": delta>0 ? delta : 0,
      "Aplicación": delta<0 ? -delta : 0
    });
  }

  // CNT (ΔAC-ΔPC) si existe sumBG()
  if(typeof sumBG==="function"){
    const sB = sumBG(base) || {};
    const sC = sumBG(comp) || {};
    const cntB = n(sB.AC) - n(sB.PC);
    const cntC = n(sC.AC) - n(sC.PC);
    const dCNT = cntC - cntB;

    if(dCNT){
      rows.push({
        "Cuenta":"Δ Capital Neto de Trabajo (CNT)",
        "Clasif.":"CNT",
        "Año 1": cntB,
        "Año 2": cntC,
        "Cambios": dCNT,
        "Origen": dCNT>0 ? dCNT : 0,
        "Aplicación": dCNT<0 ? -dCNT : 0
      });
    }
  }

  rows.sort((x,y)=>Math.abs(y["Cambios"])-Math.abs(x["Cambios"]));
  return rows;
  }


  function makeEOAFAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"EOAF");

    const ps=sortedPeriodos(S);
    for (let i=1;i<ps.length;i++){
      const base=ps[i-1], comp=ps[i];
      const rows = computeEOAFRows(base, comp);

      aoa.push([`Comparación: ${base} vs ${comp}`]);
      aoaAddTableSmart(
        aoa,"EOAF",
        ["Cuenta","Clasif.","Año 1","Año 2","Cambios","Origen","Aplicación"],
        rows
      );
    }
    return aoa;
  }

  // ======================================================
  // 4) EFE (summary + detalle)
  // ======================================================
  function makeEFEAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"EFE");
    const ps=sortedPeriodos(S);

    for (let i=1;i<ps.length;i++){
      const base=ps[i-1], comp=ps[i];

      if (typeof calcEfeIndirecto !== "function"){
        aoa.push([`EFE ${base} → ${comp}`],["Función calcEfeIndirecto no disponible"],[]);
        continue;
      }

      const efe = calcEfeIndirecto(base, comp);

      aoa.push([`EFE Indirecto ${base} → ${comp}`]);
      aoaAddTableSmart(
        aoa,"Resumen EFE",
        ["Concepto","Monto"],
        [
          ["CFO (Operación)", efe.CFO],
          ["CFI (Inversión)", efe.CFI],
          ["CFF (Financiamiento)", efe.CFF],
          ["Δ Efectivo", efe.deltaEfectivo]
        ]
      );

      // detalles como en pantalla
      const det = efe.detalle || {};
      if (det.cfo?.length){
        aoaAddTableSmart(aoa,"Detalle CFO",["Concepto","Monto"], det.cfo.map(x=>[x.Concepto,x.Monto]));
      }
      if (det.cfi?.length){
        aoaAddTableSmart(aoa,"Detalle CFI",["Concepto","Monto"], det.cfi.map(x=>[x.Concepto,x.Monto]));
      }
      if (det.cff?.length){
        aoaAddTableSmart(aoa,"Detalle CFF",["Concepto","Monto"], det.cff.map(x=>[x.Concepto,x.Monto]));
      }
    }

    return aoa;
  }

  // ======================================================
  // 5) DUPONT
  // ======================================================
  function makeDupontAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"DUPONT");
    const ps=sortedPeriodos(S);

    const rows = ps.map(p=>{
      if (typeof computeDuPont==="function"){
        const d = computeDuPont(p) || {};
        return [p, d.PM, d.AT, d.EM, d.ROE];
      }
      return [p,"","","",""];
    });

    aoaAddTableSmart(
      aoa,"Modelo DuPont",
      ["Periodo","PM (Margen)","AT (Rotación Activos)","EM (Multiplicador)","ROE"],
      rows
    );

    return aoa;
  }

  // ======================================================
  // 6) GRAFICOS (series base)
  // ======================================================
  function makeGraficosAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"GRAFICOS (datos base)");

    // Razones series
    if (typeof getRazonesData==="function"){
      const r=normalizeRows(getRazonesData(S));
      aoaAddTableSmart(
        aoa,"Series Razones",
        ["Periodo","Razón","Valor"],
        r.map(x=>({
          "Periodo": x.Periodo ?? x.periodo,
          "Razón": x["Razón"] ?? x.razon ?? x.nombre,
          "Valor": x.Valor ?? x.valor
        }))
      );
    }

    // DuPont series
    if (typeof computeDuPont==="function"){
      const ps=sortedPeriodos(S);
      const rows=ps.map(p=>{
        const d=computeDuPont(p)||{};
        return [p,d.PM,d.AT,d.EM,d.ROE];
      });
      aoaAddTableSmart(
        aoa,"Serie DuPont",
        ["Periodo","PM","AT","EM","ROE"],
        rows
      );
    }

    return aoa;
  }

  // ======================================================
  // 7) PROFORMA (DOM)
  // ======================================================
  function makeProformaAOA(S){
    const aoa=[]; aoaAddTitle(aoa,"PROFORMA");

    const tab=document.getElementById("tab-proforma");
    const tables=tab? $$("table",tab):[];

    if (!tables.length){
      aoa.push(["No hay proforma calculada aún."]);
      return aoa;
    }

    tables.forEach(t=>{
      const title = safeText(t.caption?.innerText) || t.id || "Tabla Proforma";
      const headers = $$("thead th",t).map(th=>safeText(th.innerText));
      const rows = $$("tbody tr",t).map(tr=>$$("td,th",tr).map(td=>safeText(td.innerText)));
      aoaAddTableSmart(aoa,title,headers,rows);
    });

    return aoa;
  }

  // ======================================================
  // EXCEL EXPORT
  // ======================================================
  function exportExcelPRO(){
    const S=getStateSafe();
    if(!window.XLSX) throw new Error("Falta XLSX (SheetJS). Revisá el CDN.");

    const wb=XLSX.utils.book_new();
    sheetFromAOA(wb,"ANALISIS", makeAnalisisAOA(S));
    sheetFromAOA(wb,"RAZONES",  makeRazonesAOA(S));
    sheetFromAOA(wb,"EOAF",     makeEOAFAOA(S));
    sheetFromAOA(wb,"EFE",      makeEFEAOA(S));
    sheetFromAOA(wb,"DUPONT",   makeDupontAOA(S));
    sheetFromAOA(wb,"GRAFICOS", makeGraficosAOA(S));
    sheetFromAOA(wb,"PROFORMA", makeProformaAOA(S));

    const empresa=(S.empresa||"Empresa").replace(/[^\w\-]+/g,"_");
    XLSX.writeFile(wb, `FINBOT_EXPORT_${empresa}_${nowStamp()}.xlsx`);
  }

  // ======================================================
  // Helpers para PDF
  // ======================================================
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  async function ensureChartsReady(){
    // fuerza abrir pestaña de gráficos (para que existan los canvas)
    const btnGraficos = document.querySelector('.tab-btn[data-tab="graficos"]');
    if(btnGraficos){
      btnGraficos.click();
      await sleep(250);
    }

    // si existe la función de tu graficos.js, dibuja/actualiza
    if(typeof actualizarGraficos === "function"){
      actualizarGraficos();
      await sleep(400);
    }

    // espera 2 frames para asegurar layout
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  }




  // ======================================================
  // PDF EXPORT (con gráficos como imágenes)
  // ======================================================
  async function exportReporteCompletoPdf(){
    const S=getStateSafe();
    if(!window.jsPDF) throw new Error("Falta jsPDF.");
    const doc = new jsPDF({orientation:"p", unit:"mm", format:"a4"});
    let y=12;

    const addTitle=(t)=>{
      doc.setFontSize(14); doc.text(t, 14, y); y+=6;
      doc.setFontSize(10);
    };

    const addTable=(head, body)=>{
      doc.autoTable({
        startY: y,
        head: [head],
        body,
        styles: { fontSize: 8 },
        theme: "grid",
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 8;
      if (y>270){ doc.addPage(); y=12; }
    };

    // Portada
    addTitle("FINBOT — Reporte Completo");
    doc.text(`Empresa: ${safeText(S.empresa||"")}`,14,y); y+=5;
    doc.text(`Periodos: ${sortedPeriodos(S).join(", ")}`,14,y); y+=8;

    // ANALISIS
    addTitle("ANÁLISIS");
    const analAOA = makeAnalisisAOA(S);
    // convertir AOA a secciones simples (títulos + tablas)
    let i=0;
    while(i<analAOA.length){
      const row=analAOA[i];
      if(row.length===1 && row[0] && String(row[0]).startsWith("Análisis")){
        doc.setFontSize(11); doc.text(String(row[0]),14,y); y+=4; doc.setFontSize(9);
        i++; continue;
      }
      if(row.length===1 && row[0] && (row[0]==="AH BG"||row[0]==="AH ER"||row[0]==="AV BG"||row[0]==="AV ER")){
        const title=row[0]; i++;
        const headers=analAOA[i]; i++;
        const body=[];
        while(i<analAOA.length && analAOA[i].length){
          body.push(analAOA[i]); i++;
        }
        i++; // salto blank
        doc.setFontSize(10); doc.text(title,14,y); y+=2; doc.setFontSize(8);
        addTable(headers, body);
        continue;
      }
      i++;
    }

    // RAZONES
    doc.addPage(); y=12;
    addTitle("RAZONES FINANCIERAS");
    const raz = normalizeRows(getRazonesData(S));
    addTable(
      ["Periodo","Razón","Fórmula","Valor","Interpretación"],
      raz.map(x=>[
        x.Periodo ?? x.periodo,
        x["Razón"] ?? x.razon ?? x.nombre,
        x["Fórmula"] ?? x.formula ?? "",
        x.Valor ?? x.valor,
        x["Interpretación"] ?? x.interpretacion ?? ""
      ])
    );

    // EOAF
    doc.addPage(); y=12;
    addTitle("EOAF");
    const ps=sortedPeriodos(S);
    for(let k=1;k<ps.length;k++){
      const base=ps[k-1], comp=ps[k];
      doc.setFontSize(10);
      doc.text(`Comparación ${base} vs ${comp}`,14,y); y+=3; doc.setFontSize(8);
      const rows=computeEOAFRows(base,comp);
      addTable(
        ["Cuenta","Clasif.","Año 1","Año 2","Cambios","Origen","Aplicación"],
        rows.map(r=>[
          r["Cuenta"],r["Clasif."],r["Año 1"],r["Año 2"],r["Cambios"],r["Origen"],r["Aplicación"]
        ])
      );
    }

    // EFE
    doc.addPage(); y=12;
    addTitle("EFE");
    for(let k=1;k<ps.length;k++){
      const base=ps[k-1], comp=ps[k];
      const efe=calcEfeIndirecto(base,comp);
      doc.setFontSize(10); doc.text(`EFE ${base} → ${comp}`,14,y); y+=3; doc.setFontSize(8);

      addTable(
        ["Concepto","Monto"],
        [
          ["CFO (Operación)", efe.CFO],
          ["CFI (Inversión)", efe.CFI],
          ["CFF (Financiamiento)", efe.CFF],
          ["Δ Efectivo", efe.deltaEfectivo]
        ]
      );
    }

    // DUPONT
    doc.addPage(); y=12;
    addTitle("DUPONT");
    addTable(
      ["Periodo","PM","AT","EM","ROE"],
      ps.map(p=>{
        const d=computeDuPont(p)||{};
        return [p,d.PM,d.AT,d.EM,d.ROE];
      })
    );

    // GRÁFICOS (como imagen)
    // GRÁFICOS (como imagen)
doc.addPage(); y=12;
addTitle("GRÁFICOS");

// ✅ asegura que los canvas estén dibujados aunque no hayas abierto la pestaña
await ensureChartsReady();

const chartIds=[
  "chartAHBG","chartAHER","chartAVBG","chartRazones",
  "chartCNTCNO","chartEOAF","chartEFE","chartDup"
];

for(const id of chartIds){
  const el = document.getElementById(id);
  if(!el) continue;

  let img=null;
  let w=180, h=90;

  // Si hay instancia Chart.js, usá toBase64Image() (más seguro)
  if(typeof graficos!=="undefined" && graficos[id] && typeof graficos[id].toBase64Image==="function"){
    try{
      graficos[id].update("none");
      img = graficos[id].toBase64Image();
      const cw = el.width || el.clientWidth || 800;
      const ch = el.height || el.clientHeight || 400;
      h = (ch/cw)*w;
    }catch(e){}
  }

  // Fallback a canvas puro
  if(!img && el.tagName==="CANVAS"){
    if(el.width===0 || el.height===0){
      el.width = el.clientWidth || 800;
      el.height = el.clientHeight || 400;
      if(typeof graficos!=="undefined" && graficos[id]) graficos[id].resize();
    }
    img = el.toDataURL("image/png",1.0);
    h = (el.height/el.width)*w;
  }

  if(!img) continue;

  if(y+h>270){ doc.addPage(); y=12; }
  doc.text(id,14,y); y+=2;
  doc.addImage(img,"PNG",14,y,w,h);
  y+=h+8;
  }


  // PROFORMA (completa)
  doc.addPage(); y=12;
  addTitle("PROFORMA");

  const proAOA = makeProformaAOA(S);
  let j=0;

  while(j<proAOA.length){
    const row = proAOA[j];

    // títulos sueltos
    if(row.length===1){
      const title = String(row[0]||"").trim();
      if(title && title!=="PROFORMA"){
        doc.setFontSize(10); doc.text(title,14,y); y+=4; doc.setFontSize(8);
      }
      j++; 
      continue;
    }

    // tabla
    const headers = row; j++;
    const body=[];
    while(j<proAOA.length && proAOA[j].length){
      body.push(proAOA[j]); j++;
    }
    j++; // saltar línea en blanco

    if(headers.length) addTable(headers, body);
  }


    const empresa=(S.empresa||"Empresa").replace(/[^\w\-]+/g,"_");
    doc.save(`FINBOT_REPORTE_${empresa}_${nowStamp()}.pdf`);
  }

  // ======================================================
  // ALIASES (para que tu app vieja no choque)
  // ======================================================
  window.exportExcelPRO = exportExcelPRO;
  window.exportToExcel  = exportExcelPRO;
  window.finbotExportEmpresaExcel = exportExcelPRO;
  window.exportReporteCompletoExcel = exportExcelPRO;

  window.exportReporteCompletoPdf = exportReporteCompletoPdf;

  // Evita error si HTML preview llama algo viejo
  window.finbotBuildFullReportHtmlProfesional = function(){
    let html="<h1>FINBOT Reporte</h1>";
    const S=getStateSafe();
    html += `<p>Empresa: ${safeText(S.empresa||"")}</p>`;
    html += `<p>Periodos: ${sortedPeriodos(S).join(", ")}</p>`;
    return `<html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  };

  // ======================================================
  // BINDS botones
  // ======================================================
  document.addEventListener("DOMContentLoaded",()=>{
    $("#exportExcelBtn")?.addEventListener("click", ()=>{
      try{ exportExcelPRO(); }
      catch(e){ console.error(e); alert("Error exportando Excel: "+e.message); }
    });

    $("#exportPdfBtn")?.addEventListener("click", async ()=>{
      try{ await exportReporteCompletoPdf(); }
      catch(e){ console.error(e); alert("Error exportando PDF: "+e.message); }
    });
  });
})();
