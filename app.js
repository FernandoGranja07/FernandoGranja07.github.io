// FINBOT Web — Escalable: IA multi-año, razones extendidas, historia/equipo y almacenamiento local

// Utils
const NF = new Intl.NumberFormat('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});
const PF = new Intl.NumberFormat('es-NI',{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2});
const n=x=>typeof x==='number'&&isFinite(x)?x:0;
const fmt=x=>NF.format(n(x));
const pct=x=>(x===null||!isFinite(x))?'—':PF.format(x);
const safeDiv=(a,b)=>b?a/b:null;
const uid=()=>Math.random().toString(36).slice(2,9);
const sortYears=arr=>arr.slice().sort();
function download(filename,text,mime='text/plain;charset=utf-8'){const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

// State
const state={
  empresa:'',
  periodos:{},
  periodoActivo:null,
  _iaResumen:null,
  historia:{historia:'',mision:'',vision:'',objetivos:''},
  equipo:[]
};

// Clasif/labels
const CLASIF={BG:['AC','ANC','PC','PNC','PAT'],ER:['VENTA','VENTACRED','COGS','GASTO','INTERES','OTROER']};
const CLABEL={
  AC:'Activo Corriente',ANC:'Activo No Corriente',PC:'Pasivo Corriente',PNC:'Pasivo No Corriente',PAT:'Patrimonio',
  VENTA:'Ventas',VENTACRED:'Ventas al crédito',COGS:'Costo de ventas',GASTO:'Gastos',INTERES:'Gasto por intereses',OTROER:'Otros resultados'
};
const labelClasif=c=>CLABEL[c]||c;

// Periodos/CRUD
function ensurePeriodo(y){if(!state.periodos[y]) state.periodos[y]={BG:[],ER:[]};}
function setEmpresa(v){state.empresa=v||'';renderResumenReporte();}
function addPeriodo(y){y=String(y||'').trim();if(!y)return;ensurePeriodo(y);if(!state.periodoActivo)state.periodoActivo=y;renderPeriodos();}
function setPeriodoActivo(y){if(state.periodos[y]){state.periodoActivo=y;renderAll();}}
function addCuenta({tipo,nombre,monto,clasif,operativa}){const y=state.periodoActivo;if(!y)return setFormError('Debe seleccionar un periodo.');ensurePeriodo(y);state.periodos[y][tipo].push({id:uid(),nombre:String(nombre||'').trim(),clasif,monto:Number(monto)||0,operativa:!!operativa});renderTablasDatos();}
function deleteCuenta(y,tipo,id){const arr=state.periodos[y]?.[tipo];if(!arr)return;const i=arr.findIndex(r=>r.id===id);if(i>=0){arr.splice(i,1);renderTablasDatos();}}

// Extractores
function findByName(periodo,tipo,needle){needle=String(needle||'').toLowerCase();return (state.periodos[periodo]?.[tipo]||[]).filter(x=>(x.nombre||'').toLowerCase().includes(needle));}
function inventario(p){const it=findByName(p,'BG','inventario');return it.length?it.reduce((s,x)=>s+n(x.monto),0):0;}
function cxc(p){const it=findByName(p,'BG','cuentas por cobrar');return it.length?it.reduce((s,x)=>s+n(x.monto),0):0;}
function activoFijo(p){const it=findByName(p,'BG','activo fijo');if(it.length)return it.reduce((s,x)=>s+n(x.monto),0);return sumBG(p).ANC;}
function gastoIntereses(p){const er=state.periodos[p]?.ER||[];let v=er.filter(x=>x.clasif==='INTERES').reduce((s,x)=>s+n(x.monto),0);if(!v)v=er.filter(x=>(x.nombre||'').toLowerCase().includes('interes')).reduce((s,x)=>s+n(x.monto),0);return n(v);}
function ventasCredito(p){const er=state.periodos[p]?.ER||[];const vc=er.filter(x=>x.clasif==='VENTACRED').reduce((s,x)=>s+n(x.monto),0);if(vc)return vc;return er.filter(x=>x.clasif==='VENTA').reduce((s,x)=>s+n(x.monto),0);}

function sumBG(p){const items=state.periodos[p]?.BG||[];const s={AC:0,ANC:0,PC:0,PNC:0,PAT:0,opAC:0,opANC:0,opPC:0,opPNC:0};for(const x of items){if(x.clasif in s)s[x.clasif]+=n(x.monto);if(x.operativa){if(x.clasif==='AC')s.opAC+=n(x.monto);if(x.clasif==='ANC')s.opANC+=n(x.monto);if(x.clasif==='PC')s.opPC+=n(x.monto);if(x.clasif==='PNC')s.opPNC+=n(x.monto);}}const TA=s.AC+s.ANC,TPP=s.PC+s.PNC+s.PAT;return {...s,TA,TPP};}
function sumER(p){const items=state.periodos[p]?.ER||[];const s={VENTAS:0,VENTACRED:0,COGS:0,GASTOS:0,INTERES:0,OTROS:0};for(const x of items){if(x.clasif==='VENTA')s.VENTAS+=n(x.monto);if(x.clasif==='VENTACRED')s.VENTACRED+=n(x.monto);if(x.clasif==='COGS')s.COGS+=n(x.monto);if(x.clasif==='GASTO')s.GASTOS+=n(x.monto);if(x.clasif==='INTERES')s.INTERES+=n(x.monto);if(x.clasif==='OTROER')s.OTROS+=n(x.monto);}if(!s.INTERES)s.INTERES=gastoIntereses(p);const UB=s.VENTAS-s.COGS;const UO=UB-s.GASTOS;const UN=UO+s.OTROS-Math.max(0,s.INTERES);return {...s,UB,UO,UN};}

// Promedios interperiodo
function prevYear(y){const a=sortYears(Object.keys(state.periodos));const i=a.indexOf(y);return i>0?a[i-1]:null;}
const avg2=(c,p)=>p==null?n(c):(n(c)+n(p))/2;
const inventarioProm=y=>avg2(inventario(y),prevYear(y)?inventario(prevYear(y)):null);
const cxcProm=y=>avg2(cxc(y),prevYear(y)?cxc(prevYear(y)):null);
const activoFijoProm=y=>avg2(activoFijo(y),prevYear(y)?activoFijo(prevYear(y)):null);
function taProm(y){const s=sumBG(y);const py=prevYear(y);const sp=py?sumBG(py):null;return avg2(s.TA,sp?sp.TA:null);}

// Razones extendidas
function razonesExtendidas(y){
  const sBG=sumBG(y), sER=sumER(y);
  const inv=inventario(y), invP=inventarioProm(y);
  const cxcV=cxc(y), cxcP=cxcProm(y);
  const afP=activoFijoProm(y), taP=taProm(y);
  const ventas=sER.VENTAS, vcred=ventasCredito(y), interes=gastoIntereses(y);

  const RC=safeDiv(sBG.AC,sBG.PC);
  const RR=safeDiv(sBG.AC-inv,sBG.PC);

  const RotInv=safeDiv(sER.COGS,invP||0);
  const RotCxC=safeDiv(vcred,cxcP||0);
  const PPC=RotCxC?360/RotCxC:null;
  const RotAF=safeDiv(ventas,afP||0);
  const RotAT=safeDiv(ventas,taP||0);

  const Endeuda=safeDiv(sBG.PC+sBG.PNC,sBG.TA);
  const PasivoCapital=safeDiv(sBG.PC+sBG.PNC,sBG.PAT);
  const CoberturaInt=safeDiv(sER.UO,Math.abs(interes)||0);

  const MUB=safeDiv(sER.UB,ventas);
  const MUO=safeDiv(sER.UO,ventas);
  const MN=safeDiv(sER.UN,ventas);
  const ROA=safeDiv(sER.UN,sBG.TA);

  return {year:y,AC:sBG.AC,PC:sBG.PC,TA:sBG.TA,PNC:sBG.PNC,PAT:sBG.PAT,VENTAS:ventas,COGS:sER.COGS,GASTOS:sER.GASTOS,UB:sER.UB,UO:sER.UO,UN:sER.UN,
    inventario:inv,inventarioProm:invP,cxc:cxcV,cxcProm:cxcP,activoFijoProm:afP,taProm:taP,ventasCred:vcred,interesGasto:interes,
    RC,RR,RotInv,RotCxC,PPC,RotAF,RotAT,Endeuda,PasivoCapital,CoberturaInt,MUB,MUO,MN,ROA};
}

// AH/AV
function cuentasMap(p,t){const items=state.periodos[p]?.[t]||[];const m=new Map();for(const x of items){const k=x.nombre.trim();m.set(k,(m.get(k)||0)+n(x.monto));}return m;}
function analisisHorizontal(b,c,t){const mb=cuentasMap(b,t),mc=cuentasMap(c,t);const names=new Set([...mb.keys(),...mc.keys()]);const out=[];for(const nm of Array.from(names).sort()){const vb=n(mb.get(nm)),vc=n(mc.get(nm));const delta=vc-vb;const dperc=safeDiv(delta,Math.abs(vb))??null;out.push({nombre:nm,base:vb,comp:vc,delta,dperc});}return out;}
function analisisVerticalBG(p){const items=state.periodos[p]?.BG||[];const {TA,TPP}=sumBG(p);return items.map(x=>{const base=(x.clasif==='AC'||x.clasif==='ANC')?TA:TPP;return {...x,base,p:safeDiv(n(x.monto),base)};});}
function analisisVerticalER(p){const items=state.periodos[p]?.ER||[];const {VENTAS}=sumER(p);return items.map(x=>{const base=VENTAS||0;return {...x,base,p:safeDiv(n(x.monto),base)};});}

function detalleCuentasAV(y){
  const mkImpact=v=>{const a=Math.abs(v||0);return a>=0.15?'alto':(a>=0.05?'medio':'bajo')};
  const baseBG=x=>((x.clasif==='AC'||x.clasif==='ANC')?'TA':'TPP');
  const fmtLine=(tag,x,baseLbl,extra)=>`- [${tag}] ${x.nombre} (${labelClasif(x.clasif)}): ${fmt(x.monto)} => ${x.base?pct(x.monto/x.base):'—'} de ${baseLbl}${extra?` — ${extra}`:''}`;
  const bg=analisisVerticalBG(y).slice().sort((a,b)=>Math.abs((b.base?b.monto/b.base:0))-Math.abs((a.base?a.monto/a.base:0)));
  const er=analisisVerticalER(y).slice().sort((a,b)=>Math.abs((b.base?b.monto/b.base:0))-Math.abs((a.base?a.monto/a.base:0)));
  const out=[];
  out.push('Cuentas BG (AV):');
  bg.forEach((x,i)=>{const imp=mkImpact(x.base?x.monto/x.base:0);out.push(fmtLine('BG',x,baseBG(x),`impacto ${imp}`));});
  out.push('');
  out.push('Cuentas ER (AV):');
  er.forEach(x=>{const ratio=x.base?x.monto/x.base:null;const imp=mkImpact(ratio);let juicio='participación';if(x.clasif==='VENTA')juicio='ingreso';else if(x.clasif==='COGS'||x.clasif==='GASTO'||x.clasif==='INTERES')juicio='costo/gasto';else if(x.clasif==='OTROER')juicio='otros';out.push(fmtLine('ER',x,'Ventas',`${juicio}; impacto ${imp}`));});
  return out;
}

// CNT/CNO
const calcCNT=p=>{const {AC,PC}=sumBG(p);return {formula:'CNT = AC − PC',AC,PC,CNT:AC-PC};};
function calcCNO(p){const s=sumBG(p);const ao=s.opAC+s.opANC, po=s.opPC+s.opPNC;return {formula:'CNO = (Act. oper: AC+ANC con oper=Sí) − (Pas. oper: PC+PNC con oper=Sí)',activosOper:ao,pasivosOper:po,CNO:ao-po};}
function interpretCnt(v){if(v==null)return{cls:'warn',label:'Sin datos'};if(v<0)return{cls:'risk',label:'CNT negativo'};if(v===0)return{cls:'warn',label:'CNT neutro'};return{cls:'good',label:'CNT positivo'};}
function interpretCno(v){if(v==null)return{cls:'warn',label:'Sin datos'};if(v>0)return{cls:'warn',label:'Requiere financiamiento operativo'};if(v===0)return{cls:'good',label:'Equilibrado'};return{cls:'good',label:'Superávit operativo'};}

// IA (periodo)
function prepararResumenIA(p){const r=razonesExtendidas(p);state._iaResumen=r;return r;}
function interpretarHeuristico(){
  const k=state._iaResumen; if(!k) return 'Primero usa "Preparar resumen".';
  const out=[];
  if(k.RC!=null) out.push(k.RC>=1.5?'Liquidez sólida (RC≥1.5).':(k.RC<1?'Riesgo de liquidez (RC<1).':'Liquidez adecuada.'));
  if(k.RR!=null) out.push(`Razón rápida: ${pct(k.RR)}`);
  if(k.Endeuda!=null){ out.push(k.Endeuda>0.6?'Alto apalancamiento (>60% TA).':(k.Endeuda>=0.4?'Apalancamiento moderado (40–60%).':'Apalancamiento bajo (<40%).')); }
  const cat=m=>m==null?'sin dato':(m<0.05?'bajo':(m<=0.15?'medio':'alto'));
  out.push(`MUB ${k.MUB==null?'—':pct(k.MUB)} (${cat(k.MUB)}), MUO ${k.MUO==null?'—':pct(k.MUO)} (${cat(k.MUO)}), MN ${k.MN==null?'—':pct(k.MN)} (${cat(k.MN)}).`);
  out.push(`Rot. inv: ${k.RotInv==null?'—':NF.format(k.RotInv)} | Rot. CxC: ${k.RotCxC==null?'—':NF.format(k.RotCxC)} | PPC: ${k.PPC==null?'—':NF.format(k.PPC)} días.`);
  out.push(`Rot. AF: ${k.RotAF==null?'—':NF.format(k.RotAF)} | Rot. AT: ${k.RotAT==null?'—':NF.format(k.RotAT)}`);
  out.push(`Cobertura intereses: ${k.CoberturaInt==null?'—':NF.format(k.CoberturaInt)}`);
  // DuPont del periodo
  const dp=computeDuPont(k.year);
  out.push(`DuPont: PM=${dp.PM==null?'—':PF.format(dp.PM)} | AT=${dp.AT==null?'—':NF.format(dp.AT)} | EM=${dp.EM==null?'—':NF.format(dp.EM)} | ROE=${dp.ROE==null?'—':PF.format(dp.ROE)}`);
  // EFE (indirecto) entre prev y este si existe
  const py=prevYear(k.year);
  if(py){ const efe=calcEfeIndirecto(py,k.year); out.push(`EFE (indirecto ${py}→${k.year}): CFO=${fmt(efe.CFO)} | CFI=${fmt(efe.CFI)} | CFF=${fmt(efe.CFF)} | ΔEfec=${fmt(efe.deltaEfectivo)}`);} 
  const rec=[];
  if(k.RC!=null&&k.RC<1.2) rec.push('Mejorar capital de trabajo (CxC/Inventarios).');
  if(k.Endeuda!=null&&k.Endeuda>0.6) rec.push('Revisar deuda y fortalecer patrimonio.');
  if(k.MUO!=null&&k.MUO<0.1) rec.push('Control de gastos operativos y eficiencia.');
  if(k.RotCxC!=null&&k.RotCxC<6) rec.push('Acelerar cobros (políticas de crédito).');
  const detalle=detalleCuentasAV(k.year);
  return [
    `Empresa: ${state.empresa||'(sin nombre)'} | Periodo: ${k.year}`,
    `Bases: TA=${fmt(k.TA)} | AC=${fmt(k.AC)} | PC=${fmt(k.PC)} | Ventas=${fmt(k.VENTAS)} | UN=${fmt(k.UN)}`,
    '', 'Análisis:', ...out.map(x=>`- ${x}`),
    '', 'Detalle cuenta por cuenta (AV):', ...detalle,
    '', 'Recomendaciones:', ...(rec.length?rec:['- Monitoreo mensual de KPIs y flujo de caja.']).map(x=>`- ${x}`)
  ].join('\n');
}


// IA Global
function interpretarGlobal(){
  const years=sortYears(Object.keys(state.periodos));if(!years.length)return 'No hay periodos.';
  const bloques=[];
  for(const y of years){
    const r=razonesExtendidas(y), sBG=sumBG(y);
    const topBG=analisisVerticalBG(y).sort((a,b)=>Math.abs((b.base?b.monto/b.base:0))-Math.abs((a.base?a.monto/a.base:0))).slice(0,5)
      .map(x=>`• ${x.nombre} (${labelClasif(x.clasif)}): ${fmt(x.monto)} => ${x.base?pct(x.monto/x.base):'—'}`);
    const topER=analisisVerticalER(y).sort((a,b)=>Math.abs((b.base?b.monto/b.base:0))-Math.abs((a.base?a.monto/a.base:0))).slice(0,5)
      .map(x=>`• ${x.nombre} (${labelClasif(x.clasif)}): ${fmt(x.monto)} => ${x.base?pct(x.monto/x.base):'—'}`);
    const liq=r.RC!=null?(r.RC>=1.5?'Liquidez sólida.':(r.RC<1?'Riesgo de liquidez.':'Liquidez adecuada.')):'—';
    const deu=r.Endeuda!=null?(r.Endeuda>0.6?'Alto apalancamiento.':(r.Endeuda>=0.4?'Apalancamiento moderado.':'Apalancamiento bajo.')):'—';
    const rent=r.MN!=null?(`Margen neto ${pct(r.MN)}; ROA ${pct(r.ROA??0)}.`):'—';
    const dp=computeDuPont(y);
    const dupLine=`DuPont: PM=${dp.PM==null?'—':PF.format(dp.PM)} | AT=${dp.AT==null?'—':NF.format(dp.AT)} | EM=${dp.EM==null?'—':NF.format(dp.EM)} | ROE=${dp.ROE==null?'—':PF.format(dp.ROE)}`;
    bloques.push([
      `Periodo ${y}`,
      `BG grupos: AC=${fmt(sBG.AC)} | ANC=${fmt(sBG.ANC)} | PC=${fmt(sBG.PC)} | PNC=${fmt(sBG.PNC)} | PAT=${fmt(sBG.PAT)} | TA=${fmt(sBG.TA)}`,
      `ER: Ventas=${fmt(r.VENTAS)} | UO=${fmt(r.UO)} | UN=${fmt(r.UN)}`,
      `Liquidez: ${liq} | Deuda: ${deu} | Rentab.: ${rent}`,
      dupLine,
      '', 'Cuentas clave BG (AV):', ...topBG,
      '', 'Cuentas clave ER (AV):', ...topER,
      ''
    ].join('\n'));
  }
  // EFE final entre los dos últimos periodos (indirecto)
  if(years.length>=2){ const b=years[years.length-2], c=years[years.length-1]; const efe=calcEfeIndirecto(b,c);
    bloques.push([`EFE (indirecto ${b}→${c})`, `CFO=${fmt(efe.CFO)} | CFI=${fmt(efe.CFI)} | CFF=${fmt(efe.CFF)} | ΔEfectivo=${fmt(efe.deltaEfectivo)}`].join('\n'));
  }
  const last=years[years.length-1], rl=razonesExtendidas(last); const concl=[];
  if(rl.MN!=null) concl.push(rl.MN>0.15?'Rentabilidad alta.':(rl.MN<0.05?'Rentabilidad baja; foco en eficiencia y pricing.':'Rentabilidad media.'));
  if(rl.Endeuda!=null) concl.push(rl.Endeuda>0.6?'Estructura apalancada; cuidar cobertura.':'Deuda controlada.');
  if(rl.RC!=null) concl.push(rl.RC<1?'Liquidez tensa; priorizar capital de trabajo.':'Liquidez aceptable.');
  const reflexion=['Reflexión:','- ¿Qué decisiones operativas impulsaron las variaciones clave?','- ¿Cómo alinear inversión (CAPEX/Marketing) con rotación y márgenes?','- Metas trimestrales de RC, MN y Rotación CxC.'].join('\n');
  return [`Empresa: ${state.empresa||'(sin nombre)'} — Resumen Global`,'',...bloques,'Conclusión general:',`- ${concl.join(' ')||'Mantener disciplina financiera y seguimiento de KPIs.'}`,'',reflexion].join('\n');
}

// Valoración
function calcularValoracion(p,acciones,tasa,crec,pe){
  const r=razonesExtendidas(p);const UN=n(r.UN), rate=n(tasa)/100, g=n(crec)/100, peM=n(pe);
  const Vpe=(UN>0&&peM>0)?UN*peM:null;const Vdcf=(UN>0&&rate>g&&rate>0)?UN*(1+g)/(rate-g):null;
  const precioPE=(Vpe&&acciones>0)?Vpe/acciones:null;const precioDCF=(Vdcf&&acciones>0)?Vdcf/acciones:null;
  const cnt=r.AC-r.PC, ie=r.Endeuda, mo=r.MUO;let sugerido=0;
  if(cnt<0)sugerido+=Math.min(Math.abs(cnt),n(r.VENTAS)*0.1);
  if(ie!=null&&ie>0.6)sugerido+=n(r.VENTAS)*0.05;
  if(mo!=null&&mo<0.1)sugerido+=n(r.VENTAS)*0.03;
  const areas=[];if(cnt<0)areas.push('Capital de trabajo');if(mo!=null&&mo<0.1)areas.push('Eficiencia operativa');if(ie!=null&&ie>0.6)areas.push('Reforzar patrimonio (equity)');
  return [`Empresa: ${state.empresa||'(sin nombre)'} | Periodo: ${p}`,`Resultados base: UN=${fmt(UN)} | Ventas=${fmt(r.VENTAS)}`,'','Método P/E:',`  Múltiplo: ${peM||'—'} | Valor Patrimonio: ${Vpe?fmt(Vpe):'—'} | Precio/Acción: ${precioPE?fmt(precioPE):'—'}`,'','Método DCF (perpetuidad):',`  r=${rate?PF.format(rate):'—'} | g=${g?PF.format(g):'—'} | Valor Patrimonio: ${Vdcf?fmt(Vdcf):'—'} | Precio/Acción: ${precioDCF?fmt(precioDCF):'—'}`,'','Recomendación (heurístico):',`  Monto: ${sugerido?fmt(sugerido):'—'}`,`  Áreas: ${areas.length?areas.join(', '):'—'}`,'','Notas:','- Si UN≤0, P/E y DCF pueden no aplicar.','- Estimado heurístico local.'].join('\n');
}

// Reporte TXT
function generarResumenTXT(){
  const periods=sortYears(Object.keys(state.periodos)); if(!periods.length) return 'No hay datos.';
  const L=[`Empresa: ${state.empresa||'(sin nombre)'}`,`Periodos: ${periods.join(', ')}`,''];
  for(const y of periods){
    const sBG=sumBG(y), sER=sumER(y), rz=razonesExtendidas(y);
    const dp=computeDuPont(y);
    L.push(`Periodo ${y}`);
    L.push(`  BG: TA=${fmt(sBG.TA)} | ${CLABEL.AC}=${fmt(sBG.AC)} | ${CLABEL.ANC}=${fmt(sBG.ANC)} | ${CLABEL.PC}=${fmt(sBG.PC)} | ${CLABEL.PNC}=${fmt(sBG.PNC)} | ${CLABEL.PAT}=${fmt(sBG.PAT)}`);
    L.push(`  ER: ${CLABEL.VENTA}=${fmt(sER.VENTAS)} | ${CLABEL.COGS}=${fmt(sER.COGS)} | ${CLABEL.GASTO}=${fmt(sER.GASTOS)} | ${CLABEL.INTERES}=${fmt(Math.abs(sER.INTERES))} | UO=${fmt(sER.UO)} | UN=${fmt(sER.UN)}`);
    L.push(`  KPIs: RC=${rz.RC==null?'—':NF.format(rz.RC)} | RR=${rz.RR==null?'—':NF.format(rz.RR)} | Endeuda=${rz.Endeuda==null?'—':PF.format(rz.Endeuda)} | MN=${rz.MN==null?'—':PF.format(rz.MN)} | ROA=${rz.ROA==null?'—':PF.format(rz.ROA)}`);
    L.push(`  DuPont: PM=${dp.PM==null?'—':PF.format(dp.PM)} | AT=${dp.AT==null?'—':NF.format(dp.AT)} | EM=${dp.EM==null?'—':NF.format(dp.EM)} | ROE=${dp.ROE==null?'—':PF.format(dp.ROE)}`,'');
  }
  if(periods.length>=2){ const b=periods[periods.length-2], c=periods[periods.length-1]; const efe=calcEfeIndirecto(b,c);
    L.push(`EFE (indirecto ${b}→${c})`);
    L.push(`  CFO=${fmt(efe.CFO)} | CFI=${fmt(efe.CFI)} | CFF=${fmt(efe.CFF)} | ΔEfectivo=${fmt(efe.deltaEfectivo)}`,'');
  }
  L.push('Conclusión global (breve):'); L.push(interpretarGlobal().split('\n').slice(-6).join('\n'));
  return L.join('\n');
}

// Almacenamiento
const LS_IDX='finbot:proj:index';
const getIndex=()=>{try{ return JSON.parse(localStorage.getItem(LS_IDX)||'[]'); }catch{return[]}};
const setIndex=arr=>localStorage.setItem(LS_IDX,JSON.stringify(arr));
function saveProject(name){const nm=String(name||'').trim();if(!nm)return'Nombre inválido.';localStorage.setItem(`finbot:proj:${nm}`,JSON.stringify(state));const idx=new Set(getIndex());idx.add(nm);setIndex([...idx].sort());return null;}
function loadProject(name){
  const raw=localStorage.getItem(`finbot:proj:${name}`);
  if(!raw)return'Proyecto no encontrado.';
  try{
    const obj=JSON.parse(raw);
    Object.assign(state,{
      empresa:obj.empresa||'',
      periodos:obj.periodos||{},
      periodoActivo:obj.periodoActivo||Object.keys(obj.periodos||{})[0]||null,
      _iaResumen:null,
      historia:obj.historia||{historia:'',mision:'',vision:'',objetivos:''},
      equipo:Array.isArray(obj.equipo)?obj.equipo:[]
    });
    renderAll();
    // Activar pestaña Datos al cargar
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const datosBtn=document.querySelector('.tab-btn[data-tab="datos"]');
    if(datosBtn){datosBtn.classList.add('active');}
    document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));
    const datosTab=document.getElementById('tab-datos');
    if(datosTab){datosTab.classList.add('active');}
    return null;
  }catch{
    return'No se pudo cargar.'
  }
}
function deleteProject(name){localStorage.removeItem(`finbot:proj:${name}`);setIndex(getIndex().filter(x=>x!==name));}
function renderProyectos(){const tb=document.getElementById('listaProyectos');if(!tb)return;tb.innerHTML='';for(const name of getIndex()){const tr=document.createElement('tr');tr.innerHTML=`<td>${name}</td><td><button class="btn" data-load="${name}">cargar</button> <button class="btn" data-del="${name}">eliminar</button></td>`;tb.appendChild(tr);}tb.querySelectorAll('button[data-load]').forEach(b=>b.addEventListener('click',()=>{const e=loadProject(b.getAttribute('data-load'));if(e)alert(e);}));tb.querySelectorAll('button[data-del]').forEach(b=>b.addEventListener('click',()=>{deleteProject(b.getAttribute('data-del'));renderProyectos();}));}

// Render helpers
function setFormError(msg){const el=document.getElementById('formError');el.textContent=msg||'';el.style.color=msg?'#f4c95d':'inherit';}
function renderPeriodos(){
  const sel=document.getElementById('periodoActivoSelect'),
        ahb=document.getElementById('ahBaseSelect'),
        ahc=document.getElementById('ahCompSelect'),
        eob=document.getElementById('eoafBaseSelect'),
        eoc=document.getElementById('eoafCompSelect'),
        rzSel=document.getElementById('razonesPeriodoSelect'),
        ccSel=document.getElementById('cntcnoPeriodoSelect'),
        valSel=document.getElementById('valPeriodoSelect'),
        efeb=document.getElementById('efeBaseSelect'),
        efec=document.getElementById('efeCompSelect'),
        dupSel=document.getElementById('dupPeriodoSelect'),
        grafPer=document.getElementById('grafPeriodoSelect'),
        grafB=document.getElementById('grafBaseSelect'),
        grafC=document.getElementById('grafCompSelect');
  const periods=sortYears(Object.keys(state.periodos));
  const opts=periods.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(sel)sel.innerHTML=opts;if(ahb)ahb.innerHTML=opts;if(ahc)ahc.innerHTML=opts;if(eob)eob.innerHTML=opts;if(eoc)eoc.innerHTML=opts;if(rzSel)rzSel.innerHTML=opts;if(ccSel)ccSel.innerHTML=opts;if(valSel)valSel.innerHTML=opts;if(efeb)efeb.innerHTML=opts;if(efec)efec.innerHTML=opts;if(dupSel)dupSel.innerHTML=opts;if(grafPer)grafPer.innerHTML=opts;if(grafB)grafB.innerHTML=opts;if(grafC)grafC.innerHTML=opts;
  if(state.periodoActivo&&periods.includes(state.periodoActivo)){
    if(sel)sel.value=state.periodoActivo;if(ahb)ahb.value=periods[0];if(ahc)ahc.value=periods[periods.length-1];if(eob)eob.value=periods[0];if(eoc)eoc.value=periods[periods.length-1];if(rzSel)rzSel.value=state.periodoActivo;if(ccSel)ccSel.value=state.periodoActivo;if(valSel)valSel.value=state.periodoActivo;if(efeb)efeb.value=periods[0];if(efec)efec.value=periods[periods.length-1];if(dupSel)dupSel.value=state.periodoActivo;if(grafPer)grafPer.value=state.periodoActivo;if(grafB)grafB.value=periods[0];if(grafC)grafC.value=periods[periods.length-1];
  }
}
function renderTablasDatos(){
  const y=state.periodoActivo;const bgTb=document.querySelector('#tablaBG tbody');const erTb=document.querySelector('#tablaER tbody');const bgTf=document.querySelector('#tablaBG tfoot');const erTf=document.querySelector('#tablaER tfoot');
  if(!y){if(bgTb)bgTb.innerHTML='';if(erTb)erTb.innerHTML='';return;}
  bgTb.innerHTML='';erTb.innerHTML='';
  for(const r of (state.periodos[y]?.BG||[])){const tr=document.createElement('tr');tr.innerHTML=`<td>${r.nombre}</td><td>${labelClasif(r.clasif)}</td><td>${r.operativa?'sí':'no'}</td><td class="num">${fmt(r.monto)}</td><td><button class="btn" data-delbg="${r.id}">eliminar</button></td>`;bgTb.appendChild(tr);}
  for(const r of (state.periodos[y]?.ER||[])){const tr=document.createElement('tr');tr.innerHTML=`<td>${r.nombre}</td><td>${labelClasif(r.clasif)}</td><td>${r.operativa?'sí':'no'}</td><td class="num">${fmt(r.monto)}</td><td><button class="btn" data-deler="${r.id}">eliminar</button></td>`;erTb.appendChild(tr);}
  const sBG=sumBG(y),sER=sumER(y);
  bgTf.innerHTML=`
    <tr><th colspan="3">${CLABEL.AC}</th><th class="num">${fmt(sBG.AC)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.ANC}</th><th class="num">${fmt(sBG.ANC)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.PC}</th><th class="num">${fmt(sBG.PC)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.PNC}</th><th class="num">${fmt(sBG.PNC)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.PAT}</th><th class="num">${fmt(sBG.PAT)}</th><th></th></tr>
    <tr><th colspan="3">TA = ${CLABEL.AC} + ${CLABEL.ANC}</th><th class="num">${fmt(sBG.TA)}</th><th></th></tr>
    <tr><th colspan="3">TPP = ${CLABEL.PC} + ${CLABEL.PNC} + ${CLABEL.PAT}</th><th class="num">${fmt(sBG.TPP)}</th><th></th></tr>`;
  erTf.innerHTML=`
    <tr><th colspan="3">${CLABEL.VENTA}</th><th class="num">${fmt(sER.VENTAS)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.COGS}</th><th class="num">${fmt(sER.COGS)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.GASTO}</th><th class="num">${fmt(sER.GASTOS)}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.INTERES}</th><th class="num">${fmt(Math.abs(sER.INTERES))}</th><th></th></tr>
    <tr><th colspan="3">${CLABEL.OTROER}</th><th class="num">${fmt(sER.OTROS)}</th><th></th></tr>
    <tr><th colspan="3">UB = ${CLABEL.VENTA} − ${CLABEL.COGS}</th><th class="num">${fmt(sER.UB)}</th><th></th></tr>
    <tr><th colspan="3">UO = UB − ${CLABEL.GASTO}</th><th class="num">${fmt(sER.UO)}</th><th></th></tr>
    <tr><th colspan="3">UN = UO + ${CLABEL.OTROER} − ${CLABEL.INTERES}</th><th class="num">${fmt(sER.UN)}</th><th></th></tr>`;
  bgTb.querySelectorAll('button[data-delbg]').forEach(b=>b.addEventListener('click',()=>deleteCuenta(y,'BG',b.getAttribute('data-delbg'))));
  erTb.querySelectorAll('button[data-deler]').forEach(b=>b.addEventListener('click',()=>deleteCuenta(y,'ER',b.getAttribute('data-deler'))));
}
function renderAH(){const b=document.getElementById('ahBaseSelect').value,c=document.getElementById('ahCompSelect').value,tbg=document.querySelector('#tablaAHBG tbody'),ter=document.querySelector('#tablaAHER tbody');tbg.innerHTML='';ter.innerHTML='';if(!state.periodos[b]||!state.periodos[c])return;for(const r of analisisHorizontal(b,c,'BG')){const tr=document.createElement('tr');tr.innerHTML=`<td>${r.nombre}</td><td class="num">${fmt(r.base)}</td><td class="num">${fmt(r.comp)}</td><td class="num">${fmt(r.delta)}</td><td class="num">${r.dperc==null?'—':pct(r.dperc)}</td>`;tbg.appendChild(tr);}for(const r of analisisHorizontal(b,c,'ER')){const tr=document.createElement('tr');tr.innerHTML=`<td>${r.nombre}</td><td class="num">${fmt(r.base)}</td><td class="num">${fmt(r.comp)}</td><td class="num">${fmt(r.delta)}</td><td class="num">${r.dperc==null?'—':pct(r.dperc)}</td>`;ter.appendChild(tr);}}
function renderAV(){const y=state.periodoActivo,tbg=document.querySelector('#tablaAVBG tbody'),ter=document.querySelector('#tablaAVER tbody');tbg.innerHTML='';ter.innerHTML='';if(!y)return;for(const x of analisisVerticalBG(y)){const tr=document.createElement('tr');tr.innerHTML=`<td>${x.nombre}</td><td>${labelClasif(x.clasif)}</td><td class="num">${x.base?pct(x.monto/x.base):'—'}</td>`;tbg.appendChild(tr);}for(const x of analisisVerticalER(y)){const tr=document.createElement('tr');tr.innerHTML=`<td>${x.nombre}</td><td>${labelClasif(x.clasif)}</td><td class="num">${x.base?pct(x.monto/x.base):'—'}</td>`;ter.appendChild(tr);}}
 function razonesListado(y){const r=razonesExtendidas(y);return [
    {grupo:'Liquidez', id:'RC', nombre:'Razón corriente (AC/PC)', valor:(r.PC?NF.format(r.RC):'—')},
    {grupo:'Liquidez', id:'RR', nombre:'Razón rápida ((AC-Inv)/PC)', valor:(r.PC?NF.format(r.RR??0):'—')},
    {grupo:'Actividad', id:'RotInv', nombre:'Rotación de inventarios (COGS/Inv prom)', valor:(r.inventarioProm?NF.format(r.RotInv??0):'—')},
    {grupo:'Actividad', id:'RotCxC', nombre:'Rotación de CxC (Ventas créd/CxC prom)', valor:(r.cxcProm?NF.format(r.RotCxC??0):'—')},
    {grupo:'Actividad', id:'PPC', nombre:'Período de cobro (días)', valor:(r.PPC==null?'—':NF.format(r.PPC))},
    {grupo:'Actividad', id:'RotAF', nombre:'Rotación de activo fijo (Ventas/AF prom)', valor:(r.activoFijoProm?NF.format(r.RotAF??0):'—')},
    {grupo:'Actividad', id:'RotAT', nombre:'Rotación de activo total (Ventas/TA prom)', valor:(r.taProm?NF.format(r.RotAT??0):'—')},
    {grupo:'Endeudamiento', id:'Endeuda', nombre:'(PC+PNC)/TA', valor:(r.TA?PF.format(r.Endeuda??0):'—')},
    {grupo:'Endeudamiento', id:'PasivoCapital', nombre:'Pasivo/Capital (Pasivo/Patrimonio)', valor:(r.PAT?NF.format(r.PasivoCapital??0):'—')},
    {grupo:'Endeudamiento', id:'CoberturaInt', nombre:'Cobertura de intereses (UO/Int)', valor:(r.CoberturaInt==null?'—':NF.format(r.CoberturaInt))},
    {grupo:'Rentabilidad', id:'MUB', nombre:'Margen bruto (UB/Ventas)', valor:(r.VENTAS?PF.format(r.MUB??0):'—')},
    {grupo:'Rentabilidad', id:'MUO', nombre:'Margen operativo (UO/Ventas)', valor:(r.VENTAS?PF.format(r.MUO??0):'—')},
    {grupo:'Rentabilidad', id:'MN', nombre:'Margen neto (UN/Ventas)', valor:(r.VENTAS?PF.format(r.MN??0):'—')},
    {grupo:'Rentabilidad', id:'ROA', nombre:'ROA (UN/TA)', valor:(r.TA?PF.format(r.ROA??0):'—')},
  ];}
 function breveInterpretacionPorId(r,id){
  const ok=(label,text)=>({cls:'good',label,text});
  const warn=(label,text)=>({cls:'warn',label,text});
  const risk=(label,text)=>({cls:'risk',label,text});
  switch(id){
    case 'RC': {
      if(r.RC==null) return warn('Sin datos','No hay suficientes datos para calcular AC/PC.');
      if(r.RC<1) return risk('Riesgo de liquidez','AC no cubre las obligaciones de corto plazo (PC<AC).');
      if(r.RC<1.5) return warn('Liquidez adecuada','Cobertura de pasivos corrientes razonable, mejorar capital de trabajo.');
      return ok('Liquidez sólida','AC cubre cómodamente los pasivos corrientes (RC≥1.5).');
    }
    case 'RR': {
      if(r.RR==null) return warn('Sin datos','Falta inventario o PC para calcular la razón rápida.');
      if(r.RR<1) return risk('Liquidez inmediata baja','Activos líquidos (sin inventarios) no alcanzan para PC.');
      return ok('Liquidez inmediata','Activos más líquidos cubren las deudas de corto plazo.');
    }
    case 'RotInv': {
      if(r.RotInv==null) return warn('Sin inventario prom.','No hay base de inventario promedio para rotación.');
      return warn(`Rotación ${NF.format(r.RotInv)}x`,`El inventario gira ${NF.format(r.RotInv)} veces al año. Ideal: mayor es mejor, sin afectar disponibilidad.`);
    }
    case 'RotCxC': {
      if(r.RotCxC==null) return warn('Sin CxC prom.','Falta CxC promedio para evaluar la rotación.');
      const p=r.PPC; if(p==null) return warn(`Cobros ${NF.format(r.RotCxC)}x/año`,`Rotación de CxC sin periodo medio de cobro calculado.`);
      if(p>60) return risk('Cobros lentos',`Periodo de cobro alto (${NF.format(p)} días). Mejorar políticas de crédito/cobro.`);
      if(p>45) return warn('Cobros moderados',`Periodo de cobro moderado (${NF.format(p)} días). Hay margen de mejora.`);
      return ok('Cobros ágiles',`Periodo de cobro eficiente (${NF.format(p)} días).`);
    }
    case 'PPC': {
      if(r.PPC==null) return warn('Sin PPC','No se pudo calcular el periodo promedio de cobro.');
      if(r.PPC>60) return risk('Cobro lento','Plazos de cobro largos; impacta flujo de caja.');
      if(r.PPC>45) return warn('Cobro moderado','Atender procesos de cobranza y condiciones de crédito.');
      return ok('Cobro ágil','Ciclo de cobro corto; favorece liquidez.');
    }
    case 'RotAF': {
      if(r.RotAF==null) return warn('Sin AF prom.','No hay base de AF promedio para rotación.');
      return warn(`Uso de AF ${NF.format(r.RotAF)}x`,`Ventas por unidad de AF promedio: ${NF.format(r.RotAF)}x.`);
    }
    case 'RotAT': {
      if(r.RotAT==null) return warn('Sin TA prom.','No hay activo total promedio para rotación.');
      return warn(`Eficiencia AT ${NF.format(r.RotAT)}x`,`Ventas por activo total promedio: ${NF.format(r.RotAT)}x.`);
    }
    case 'Endeuda': {
      if(r.Endeuda==null) return warn('Sin TA','No hay TA para calcular (PC+PNC)/TA.');
      if(r.Endeuda>0.6) return risk('Apalancamiento alto','Más del 60% del activo financiado con deuda. Riesgo financiero elevado.');
      if(r.Endeuda>=0.4) return warn('Apalancamiento moderado','Deuda en rango 40–60% del activo. Vigilar cobertura.');
      return ok('Apalancamiento bajo','Estructura de capital conservadora.');
    }
    case 'PasivoCapital': {
      if(r.PasivoCapital==null) return warn('Sin patrimonio','Sin base de patrimonio para la razón.');
      if(r.PasivoCapital>1.5) return risk('Pasivo/Capital alto','Dependencia fuerte de deuda frente a capital.');
      if(r.PasivoCapital>0.8) return warn('Pasivo/Capital moderado','Relación deuda/capital en niveles intermedios.');
      return ok('Pasivo/Capital bajo','Mayor respaldo patrimonial frente a deuda.');
    }
    case 'CoberturaInt': {
      if(r.CoberturaInt==null) return warn('Sin intereses','No hay datos de intereses o UO.');
      if(r.CoberturaInt<1) return risk('Cobertura insuficiente','La utilidad operativa no cubre los intereses.');
      if(r.CoberturaInt<3) return warn('Cobertura moderada','Cobertura entre 1x y 3x; mejorar eficiencia o reducir deuda.');
      return ok('Buena cobertura','Intereses cubiertos holgadamente por la UO.');
    }
    case 'MUB': {
      if(r.MUB==null) return warn('Sin ventas','No hay ventas para calcular el margen.');
      if(r.MUB<0) return risk('Margen bruto negativo','Costo de ventas excede las ventas. Revisar pricing y costos.');
      if(r.MUB<0.2) return warn('Margen bruto bajo','Espacio para optimizar costos o precios.');
      return ok('Margen bruto sano','Estructura de costos directos saludable.');
    }
    case 'MUO': {
      if(r.MUO==null) return warn('Sin ventas','No hay ventas para calcular el margen.');
      if(r.MUO<0) return risk('Margen operativo negativo','Gastos operativos exceden el margen bruto.');
      if(r.MUO<0.1) return warn('Margen operativo bajo','Revisar eficiencia operativa y estructura de gastos.');
      return ok('Margen operativo sano','Operación rentable antes de intereses e impuestos.');
    }
    case 'MN': {
      if(r.MN==null) return warn('Sin ventas','No hay ventas para calcular el margen.');
      if(r.MN<0) return risk('Margen neto negativo','Utilidad neta por debajo de cero.');
      if(r.MN<0.05) return warn('Margen neto bajo','Rentabilidad ajustada; optimizar costos y mix de ingresos.');
      return ok('Margen neto sano','Buena conversión de ventas en utilidad.');
    }
    case 'ROA': {
      if(r.ROA==null) return warn('Sin TA','Falta activo total para el indicador.');
      if(r.ROA<0) return risk('ROA negativo','El activo no está generando retornos positivos.');
      if(r.ROA<0.05) return warn('ROA bajo','Retorno sobre activos discreto; mejorar eficiencia/rotaciones.');
      return ok('ROA sano','Uso efectivo del activo para generar utilidad.');
    }
    default: return warn('—','');
  }
}
function renderRazones(){
  const y=document.getElementById('razonesPeriodoSelect').value; if(!y){return;}
  const r=razonesExtendidas(y);
  const grid=document.getElementById('razonesGrid'); grid.innerHTML='';
  const items=razonesListado(y);
  const gruposMap=new Map();
  for(const it of items){ if(!gruposMap.has(it.grupo)) gruposMap.set(it.grupo,[]); gruposMap.get(it.grupo).push(it); }
  gruposMap.forEach((arr,grupo)=>{
    const wrap=document.createElement('div'); wrap.className='reasons-group';
    wrap.innerHTML=`<div class="group-title">${grupo}</div><div class="group-block"><div class="reasons-grid"></div></div>`;
    const sub=wrap.querySelector('.reasons-grid');
    arr.forEach(it=>{
      const card=document.createElement('div'); card.className='reason-card'; card.tabIndex=0; card.setAttribute('role','button'); card.setAttribute('aria-label',`${it.nombre}. Click para ver interpretación`);
      const ai=breveInterpretacionPorId(r,it.id);
      card.innerHTML=`
        <div class="reason-inner">
          <div class="reason-front">
            <div class="badge">${grupo}</div>
            <div class="title">${it.nombre}</div>
            <div class="value">${it.valor}</div>
            <div class="hint">Click para ver detalle</div>
          </div>
          <div class="reason-back">
            <div class="badge">${grupo}</div>
            <div class="title">${it.nombre}</div>
            <span class="verdict ${ai.cls}">${ai.label}</span>
            <div class="interp">${ai.text||ai.label}</div>
          </div>
        </div>`;
      sub.appendChild(card);
    });
    grid.appendChild(wrap);
  });
  // Interacción: click o Enter para voltear, y desvoltear otras
  const onToggle=(el)=>{
    document.querySelectorAll('#razonesGrid .reason-card.flipped').forEach(x=>{ if(x!==el) x.classList.remove('flipped'); });
    el.classList.toggle('flipped');
  };
  grid.addEventListener('click',ev=>{
    const card=ev.target.closest('.reason-card'); if(card) onToggle(card);
  });
}
function renderCNTCNO(){
  const y=document.getElementById('cntcnoPeriodoSelect').value; if(!y){return;}
  const c1=calcCNT(y),c2=calcCNO(y);
  const grid=document.getElementById('cntcnoGrid');
  if(!grid) return; grid.innerHTML='';
  const cnt=document.createElement('div'); cnt.className='kpi-card';
  const aiCnt=interpretCnt(c1.CNT);
  cnt.innerHTML=`<div class=\"kpi-title\">Capital Neto de Trabajo (CNT)</div>
    <div class=\"kpi-value\">${fmt(c1.CNT)}</div>
    <span class=\"verdict ${aiCnt.cls}\">${aiCnt.label}</span>
    <div class=\"kpi-sub\">${c1.formula} | AC=${fmt(c1.AC)}; PC=${fmt(c1.PC)}</div>`;
  const cno=document.createElement('div'); cno.className='kpi-card';
  const aiCno=interpretCno(c2.CNO);
  cno.innerHTML=`<div class=\"kpi-title\">Capital de Necesidad Operativa (CNO)</div>
    <div class=\"kpi-value\">${fmt(c2.CNO)}</div>
    <span class=\"verdict ${aiCno.cls}\">${aiCno.label}</span>
    <div class=\"kpi-sub\">${c2.formula}<br/>Act. oper=${fmt(c2.activosOper)}; Pas. oper=${fmt(c2.pasivosOper)}</div>`;
  grid.appendChild(cnt); grid.appendChild(cno);
  // Click para ver detalle por cuenta con IA
  grid.addEventListener('click',ev=>{
    const card=ev.target.closest('.kpi-card'); if(!card) return;
    const isCNT=card===cnt; renderCntCnoDetail(isCNT?'CNT':'CNO',y);
  });
}
function renderEOAF(){
  const b=document.getElementById('eoafBaseSelect').value,
        c=document.getElementById('eoafCompSelect').value,
        tb=document.querySelector('#tablaEOAF tbody'),
        tf=document.querySelector('#tablaEOAF tfoot');
  if(!tb||!tf) return; tb.innerHTML=''; tf.innerHTML='';
  if(!state.periodos[b]||!state.periodos[c]) return;
  const mb=state.periodos[b]?.BG||[], mc=state.periodos[c]?.BG||[];
  const names=new Set([...mb.map(x=>x.nombre), ...mc.map(x=>x.nombre)]);
  const byName=(arr,nm)=>n(arr.filter(x=>x.nombre===nm).reduce((s,x)=>s+n(x.monto),0));
  const clasifOf=(nm)=>{
    const cmc=mc.find(x=>x.nombre===nm)?.clasif;
    if(cmc) return cmc;
    const cmb=mb.find(x=>x.nombre===nm)?.clasif;
    return cmb||'';
  };
  let totOrigen=0, totAplic=0;
  for(const nm of Array.from(names).sort()){
    const vb=byName(mb,nm), vc=byName(mc,nm), delta=vc-vb;
    const cls=clasifOf(nm);
    let origen=0, aplic=0;
    const isActivo = (cls==='AC'||cls==='ANC');
    const isPasPat = (cls==='PC'||cls==='PNC'||cls==='PAT');
    if(delta>0){
      if(isActivo) aplic=delta; else if(isPasPat) origen=delta; else aplic=delta; // default: aplica en aumento
    }else if(delta<0){
      const ab = Math.abs(delta);
      if(isActivo) origen=ab; else if(isPasPat) aplic=ab; else origen=ab; // default: origen en disminución
    }
    totOrigen+=origen; totAplic+=aplic;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${nm}</td>
      <td>${labelClasif(cls)}</td>
      <td class="num">${fmt(vb)}</td>
      <td class="num">${fmt(vc)}</td>
      <td class="num">${fmt(delta)}</td>
      <td class="num">${origen?fmt(origen):''}</td>
      <td class="num">${aplic?fmt(aplic):''}</td>`;
    tb.appendChild(tr);
  }
  tf.innerHTML=`<tr>
    <th colspan="5" class="num">Totales</th>
    <th class="num">${fmt(totOrigen)}</th>
    <th class="num">${fmt(totAplic)}</th>
  </tr>`;
}
const renderIASalida=t=>{document.getElementById('iaSalida').textContent=t||'';}
const renderGlobalSalida=t=>{document.getElementById('globalSalida').textContent=t||'';}
function renderResumenReporte(){const p=sortYears(Object.keys(state.periodos));document.getElementById('reportResumen').textContent=[`Empresa: ${state.empresa||'(sin nombre)'}`,`Periodos: ${p.join(', ')||'—'}`].join('\n');}

// Historia/Equipo
function defaultEquipo(){return new Array(4).fill(0).map((_,i)=>({id:uid(),nombre:`Miembro ${i+1}`,rol:'Rol',frase:'Frase',desc:'Descripción breve',fotoDataUrl:''}));}
function renderHistoriaEquipo(){
  document.getElementById('historiaTxt').value=state.historia.historia||'';
  document.getElementById('misionTxt').value=state.historia.mision||'';
  document.getElementById('visionTxt').value=state.historia.vision||'';
  document.getElementById('objetivosTxt').value=state.historia.objetivos||'';
  const grid=document.getElementById('equipoGrid');grid.innerHTML='';
  if(!state.equipo.length) state.equipo=defaultEquipo();
  state.equipo.slice(0,4).forEach((m,idx)=>{
    const card=document.createElement('div');card.className='team-card';
    const imgSrc=m.fotoDataUrl||'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="100%" height="100%" fill="%230b0f14"/><text x="50%" y="55%" fill="%238b98a5" font-size="20" text-anchor="middle">👤</text></svg>';
    card.innerHTML=`
      <img id="eqImg${idx}" src="${imgSrc}" alt="foto">
      <div>
        <div class="name"><input id="eqName${idx}" value="${m.nombre||''}" /></div>
        <div class="role"><input id="eqRole${idx}" value="${m.rol||''}" /></div>
        <div class="phrase"><input id="eqPhrase${idx}" value="${m.frase||''}" /></div>
        <div><textarea id="eqDesc${idx}" rows="3" placeholder="Descripción">${m.desc||''}</textarea></div>
        <div class="row actions">
          <label class="btn">Subir foto<input id="eqFile${idx}" type="file" accept="image/*" /></label>
          <input id="eqUrl${idx}" placeholder="o pega URL de imagen" />
        </div>
      </div>`;
    grid.appendChild(card);
    const file=document.getElementById(`eqFile${idx}`),url=document.getElementById(`eqUrl${idx}`);
    file.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{m.fotoDataUrl=r.result;document.getElementById(`eqImg${idx}`).src=r.result;};r.readAsDataURL(f);});
    url.addEventListener('change',e=>{const v=e.target.value||'';m.fotoDataUrl=v;document.getElementById(`eqImg${idx}`).src=v;});
    ['eqName','eqRole','eqPhrase','eqDesc'].forEach(id=>{
      document.getElementById(`${id}${idx}`).addEventListener('input',ev=>{
        const v=ev.target.value; if(id==='eqName')m.nombre=v; if(id==='eqRole')m.rol=v; if(id==='eqPhrase')m.frase=v; if(id==='eqDesc')m.desc=v;
      });
    });
  });
}
function guardarHistoriaEquipo(){
  state.historia.historia=document.getElementById('historiaTxt').value||'';
  state.historia.mision=document.getElementById('misionTxt').value||'';
  state.historia.vision=document.getElementById('visionTxt').value||'';
  state.historia.objetivos=document.getElementById('objetivosTxt').value||'';
  alert('Historia y equipo guardados en el estado actual. Use "Guardar/Actualizar" en Almacenamiento para persistir como proyecto.');
}

// Export/Import
function exportarJSON(){download('finbot_datos.json',JSON.stringify(state,null,2),'application/json');}
function descargarDatosJSON(){download(`FINBOT_${state.empresa||'empresa'}.json`,JSON.stringify(state,null,2),'application/json');}
function importarJSON(file){const r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);if(!obj||typeof obj!=='object')throw new Error('JSON inválido');Object.assign(state,{empresa:obj.empresa||'',periodos:obj.periodos||{},periodoActivo:obj.periodoActivo||Object.keys(obj.periodos||{})[0]||null,historia:obj.historia||{historia:'',mision:'',vision:'',objetivos:''},equipo:Array.isArray(obj.equipo)?obj.equipo:[]});renderAll();if(document.getElementById('historiaTxt')) renderHistoriaEquipo();}catch(e){setFormError('Error al importar JSON: '+e.message);}};r.readAsText(file);}

// Valoración UI
function renderValoracion(){const y=document.getElementById('valPeriodoSelect').value,acciones=Number(document.getElementById('valAcciones').value)||0,tasa=Number(document.getElementById('valTasa').value)||0,crec=Number(document.getElementById('valCrec').value)||0,pe=Number(document.getElementById('valPE').value)||0;if(!y){document.getElementById('valResultado').textContent='Seleccione un periodo.';return;}document.getElementById('valResultado').textContent=calcularValoracion(y,acciones,tasa,crec,pe);}

// Clasif options
function renderClasifOptions(){const tipo=document.getElementById('tipoEstado').value;const sel=document.getElementById('clasificacionCuenta');sel.innerHTML=CLASIF[tipo].map(c=>`<option value="${c}">${c}</option>`).join('');}

// All render
function renderAll(){document.getElementById('empresaInput').value=state.empresa||'';renderPeriodos();renderTablasDatos();renderAV();renderResumenReporte();}

// Demo
function cargarDemo(){
  state.empresa='Empresa Demo';state.periodos={'2024':{BG:[],ER:[]},'2025':{BG:[],ER:[]}};
  const push=(y,t,nombre,clasif,monto,oper)=>state.periodos[y][t].push({id:uid(),nombre,clasif,monto,operativa:oper==='sí'});
  // 2024 BG
  push('2024','BG','Efectivo','AC',120000,'sí');push('2024','BG','Cuentas por cobrar','AC',80000,'sí');push('2024','BG','Inventario','AC',100000,'sí');push('2024','BG','Activo fijo (neto)','ANC',200000,'sí');push('2024','BG','Cuentas por pagar','PC',90000,'sí');push('2024','BG','Deudas a largo plazo','PNC',110000,'no');push('2024','BG','Capital contable','PAT',300000,'no');
  // 2024 ER
  push('2024','ER','Ventas netas','VENTA',900000,'sí');push('2024','ER','Ventas al crédito','VENTACRED',650000,'sí');push('2024','ER','Costo de ventas','COGS',540000,'sí');push('2024','ER','Gastos operativos','GASTO',230000,'sí');push('2024','ER','Gasto por intereses','INTERES',20000,'no');push('2024','ER','Otros (financieros)','OTROER',-20000,'no');
  // 2025 BG
  push('2025','BG','Efectivo','AC',150000,'sí');push('2025','BG','Cuentas por cobrar','AC',90000,'sí');push('2025','BG','Inventario','AC',110000,'sí');push('2025','BG','Activo fijo (neto)','ANC',210000,'sí');push('2025','BG','Cuentas por pagar','PC',95000,'sí');push('2025','BG','Deudas a largo plazo','PNC',100000,'no');push('2025','BG','Capital contable','PAT',365000,'no');
  // 2025 ER
  push('2025','ER','Ventas netas','VENTA',980000,'sí');push('2025','ER','Ventas al crédito','VENTACRED',720000,'sí');push('2025','ER','Costo de ventas','COGS',578000,'sí');push('2025','ER','Gastos operativos','GASTO',245000,'sí');push('2025','ER','Gasto por intereses','INTERES',15000,'no');push('2025','ER','Otros (financieros)','OTROER',-15000,'no');
  state.periodoActivo='2025';
  renderAll();
  if(document.getElementById('historiaTxt')) renderHistoriaEquipo();
}

/* 
-----
*/

// =============================
//  HELPERS REPORTE COMPLETO
// =============================

// Clona el HTML de un contenedor de tu SPA
function buildSectionFromDom(id, titulo, anchorId){
  const el = document.getElementById(id);
  if (!el) return '';  // si no existe, no rompemos el reporte

  return `
    <section id="${anchorId}" style="page-break-inside: avoid; margin-bottom: 24px;">
      <h2 style="margin-bottom: 8px;">${titulo}</h2>
      ${el.innerHTML}
    </section>
  `;
}

// Exportar todos los <canvas> visibles como imágenes
function buildGraficosSection(){
  const canvases = document.querySelectorAll('canvas');
  if (!canvases.length){
    return '<p>No hay gráficos generados en esta sesión.</p>';
  }

  let html = '';
  let i = 1;
  canvases.forEach(c => {
    try{
      const dataUrl = c.toDataURL('image/png');
      html += `
        <figure style="margin-bottom:16px; text-align:center;">
          <img src="${dataUrl}" alt="Gráfico ${i}" style="max-width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;padding:4px;" />
          <figcaption style="font-size:12px;color:#6b7280;margin-top:4px;">Gráfico ${i}</figcaption>
        </figure>
      `;
      i++;
    }catch(e){
      // algunos navegadores pueden bloquear toDataURL si hay imágenes remotas
    }
  });

  return html || '<p>No fue posible exportar los gráficos.</p>';
}


/*

-bd

*/



// Events
function bindEvents(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
      const tab=btn.getAttribute('data-tab');document.querySelectorAll('.tab-content').forEach(s=>s.classList.remove('active'));document.getElementById(`tab-${tab}`).classList.add('active');
      if(tab==='analisis'){renderAH();renderAV();}
      if(tab==='razones'){renderRazones();renderCNTCNO();}
      if(tab==='eoaf'){renderEOAF();}
      if(tab==='efe'){renderEFE();}
      if(tab==='dupont'){renderDuPont();}
      if(tab==='valoracion'){renderValoracion();}
      if(tab==='almacen'){renderProyectos();}
      if(tab==='historia'){/* en mantenimiento: no-op */}
      if(tab==='global'){renderGlobalSalida(interpretarGlobal());}
      if(tab==='graficos'){renderChartsAll();}
    });
  });
  document.getElementById('empresaInput').addEventListener('input',e=>setEmpresa(e.target.value));
  document.getElementById('agregarPeriodoBtn').addEventListener('click',()=>{const y=document.getElementById('nuevoPeriodoInput').value;if(!y)return setFormError('Ingrese un año válido.');setFormError('');addPeriodo(y);document.getElementById('nuevoPeriodoInput').value='';});
  document.getElementById('periodoActivoSelect').addEventListener('change',e=>setPeriodoActivo(e.target.value));
  document.getElementById('tipoEstado').addEventListener('change',renderClasifOptions);renderClasifOptions();
  document.getElementById('agregarCuentaBtn').addEventListener('click',()=>{const tipo=document.getElementById('tipoEstado').value;const nombre=document.getElementById('nombreCuenta').value;const monto=Number(document.getElementById('montoCuenta').value);const clasif=document.getElementById('clasificacionCuenta').value;const operativa=document.getElementById('operativaCuenta').value==='si';if(!nombre)return setFormError('El nombre de cuenta es requerido.');if(!isFinite(monto))return setFormError('Monto inválido.');setFormError('');addCuenta({tipo,nombre,monto,clasif,operativa});document.getElementById('nombreCuenta').value='';document.getElementById('montoCuenta').value='';});
  document.getElementById('exportarJsonBtn').addEventListener('click',exportarJSON);
  document.getElementById('importarJsonInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importarJSON(f);e.target.value='';});
  document.querySelector('label.btn').addEventListener('click',()=>document.getElementById('importarJsonInput').click());
  document.getElementById('cargarDemoBtn').addEventListener('click',cargarDemo);
  document.getElementById('calcAhBtn').addEventListener('click',renderAH);
  document.getElementById('razonesPeriodoSelect').addEventListener('change',()=>{document.getElementById('razonDetalle').classList.add('hidden');renderRazones();});
  document.getElementById('cntcnoPeriodoSelect').addEventListener('change',renderCNTCNO);
  document.getElementById('calcEoafBtn').addEventListener('click',renderEOAF);
  document.getElementById('calcEfeBtn').addEventListener('click',renderEFE);
  document.getElementById('dupPeriodoSelect').addEventListener('change',renderDuPont);
  document.getElementById('prepararResumenBtn').addEventListener('click',()=>{const y=state.periodoActivo;if(!y){renderIASalida('No hay periodo activo.');return;}const r=prepararResumenIA(y);renderIASalida(['Resumen preparado:',JSON.stringify(r,null,2)].join('\n'));});
  document.getElementById('generarIABtn').addEventListener('click',()=>renderIASalida(interpretarHeuristico()));
  document.getElementById('generarGlobalBtn').addEventListener('click',()=>renderGlobalSalida(interpretarGlobal()));
  document.getElementById('calcValBtn').addEventListener('click',renderValoracion);
  document.getElementById('guardarProyectoBtn').addEventListener('click',()=>{const name=document.getElementById('projNameInput').value;const err=saveProject(name);if(err){alert(err);return;}renderProyectos();});
  document.getElementById('refrescarListaBtn').addEventListener('click',renderProyectos);
  document.getElementById('descargarTxtBtn').addEventListener('click',()=>download('FINBOT_resumen.txt',generarResumenTXT()));
  document.getElementById('descargarJsonBtn').addEventListener('click',descargarDatosJSON);
  const gp=document.getElementById('grafPeriodoSelect');
  const gb=document.getElementById('grafBaseSelect');
  const gc=document.getElementById('grafCompSelect');
  const gbtn=document.getElementById('grafRenderAllBtn');
  const gTop=document.getElementById('grafTopNSelect');
  const gOrd=document.getElementById('grafOrdenSelect');
  const gVal=document.getElementById('grafValorSelect');
  const gSty=document.getElementById('grafEstiloSelect');
  if(gp) gp.addEventListener('change',renderChartsAll);
  if(gb) gb.addEventListener('change',renderChartsAll);
  if(gc) gc.addEventListener('change',renderChartsAll);
  if(gbtn) gbtn.addEventListener('click',renderChartsAll);
  if(gTop) gTop.addEventListener('change',renderChartsAll);
  if(gOrd) gOrd.addEventListener('change',renderChartsAll);
  if(gVal) gVal.addEventListener('change',renderChartsAll);
  if(gSty) gSty.addEventListener('change',renderChartsAll);
  // Redibujar al cambiar el tamaño de ventana cuando la pestaña de gráficos está activa
  const onResize=debounce(()=>{
    const tab=document.getElementById('tab-graficos');
    if(tab && tab.classList.contains('active')) renderChartsAll();
  },150);
  window.addEventListener('resize',onResize);
  /* Sección historia/equipo en mantenimiento: sin listeners */


  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnExportPdf   = document.getElementById('btnExportPdf');

  if (btnExportExcel){
    btnExportExcel.addEventListener('click', exportEmpresaExcel);
  }

  if (btnExportPdf){
    btnExportPdf.addEventListener('click', exportReporteCompletoPdf);
  }
}



// Init
window.addEventListener('DOMContentLoaded',()=>{setEmpresa('');renderAll();bindEvents();/* historia en mantenimiento */});

function efectivo(p){const it=findByName(p,'BG','efectivo');return it.length?it.reduce((s,x)=>s+n(x.monto),0):0;}
function cxp(p){const items=state.periodos[p]?.BG||[];return items.filter(x=>x.clasif==='PC'&&((x.nombre||'').toLowerCase().includes('pagar'))).reduce((s,x)=>s+n(x.monto),0);}
function calcEfeIndirecto(base,comp){
  const sB=sumBG(base), sC=sumBG(comp), erC=sumER(comp);
  const intereses=Math.max(0,gastoIntereses(comp));
  const otros=n(erC.OTROS);
  const dCxC=n(cxc(comp))-n(cxc(base));
  const dInv=n(inventario(comp))-n(inventario(base));
  const dCxP=n(cxp(comp))-n(cxp(base));
  // FEO_indirecto = UN + intereses + otros - dCxC - dInv + dCxP
  const CFO=n(erC.UN)+n(intereses)+n(otros)-n(dCxC)-n(dInv)+n(dCxP);
  // Inversión: -ΔANC (aprox. Activo fijo neto)
  const CFI=-(n(sC.ANC)-n(sB.ANC));
  // Financiamiento detallado
  const pagoDeudaLP=Math.max(n(sB.PNC)-n(sC.PNC),0);
  const dPAT=n(sC.PAT)-n(sB.PAT);
  const dividendos=n(erC.UN)-n(dPAT);
  const CFF= -pagoDeudaLP - n(intereses) - n(otros) - n(dividendos);
  const dCash=n(efectivo(comp))-n(efectivo(base));
  return {
    base,comp,metodo:'indirecto',
    CFO,CFI,CFF,deltaEfectivo:dCash,
    detalle:[
      {k:'UN (comp)',v:erC.UN},
      {k:'+ Intereses (ajuste no operativo)',v:intereses},
      {k:'+ Otros financieros (ajuste no operativo)',v:otros},
      {k:'- Δ CxC (comp−base)',v:-dCxC},
      {k:'- Δ Inventario (comp−base)',v:-dInv},
      {k:'+ Δ CxP (comp−base)',v:dCxP}
    ],
    cffDetalle:[
      {k:'Pago deuda LP',v:-pagoDeudaLP},
      {k:'Intereses',v:-intereses},
      {k:'Otros financieros',v:-otros},
      {k:'Dividendos',v:-dividendos}
    ]
  };
}
function calcEfeDirecto(base,comp){
  const erC=sumER(comp);
  const invB=inventario(base), invC=inventario(comp);
  const cxcB=cxc(base), cxcC=cxc(comp);
  const cxpB=cxp(base), cxpC=cxp(comp);
  const cobrosClientes=n(erC.VENTAS)-(n(cxcC)-n(cxcB));
  const compras=n(erC.COGS)+(n(invC)-n(invB));
  const pagosProveedores=n(compras)-(n(cxpC)-n(cxpB));
  const gastosOper=n(erC.GASTOS);
  // CFO (directo) sin intereses ni otros financieros
  const CFO=cobrosClientes-pagosProveedores-gastosOper;
  // Inversión: -ΔANC
  const sB=sumBG(base), sC=sumBG(comp);
  const CFI=-(n(sC.ANC)-n(sB.ANC));
  // Financiamiento detallado
  const intereses=Math.max(0,gastoIntereses(comp));
  const otros=n(erC.OTROS);
  const pagoDeudaLP=Math.max(n(sB.PNC)-n(sC.PNC),0);
  const dPAT=n(sC.PAT)-n(sB.PAT);
  const dividendos=n(erC.UN)-n(dPAT);
  const CFF= -pagoDeudaLP - n(intereses) - n(otros) - n(dividendos);
  const dCash=n(efectivo(comp))-n(efectivo(base));
  return {
    base,comp,metodo:'directo',
    CFO,CFI,CFF,deltaEfectivo:dCash,
    detalle:[
      {k:'Cobros de clientes',v:cobrosClientes},
      {k:'Pagos a proveedores',v:-pagosProveedores},
      {k:'Gastos operativos',v:-gastosOper}
    ],
    cffDetalle:[
      {k:'Pago deuda LP',v:-pagoDeudaLP},
      {k:'Intereses',v:-intereses},
      {k:'Otros financieros',v:-otros},
      {k:'Dividendos',v:-dividendos}
    ]
  };
}
function renderEFE(){
  const bEl=document.getElementById('efeBaseSelect');
  const cEl=document.getElementById('efeCompSelect');
  const mEl=document.getElementById('efeMetodoSelect');
  const tb=document.querySelector('#tablaEFE tbody');
  const tf=document.querySelector('#tablaEFE tfoot');
  if(!bEl||!cEl||!mEl||!tb||!tf)return;
  tb.innerHTML=''; tf.innerHTML='';
  const b=bEl.value, c=cEl.value, metodo=(mEl.value||'indirecto');
  if(!state.periodos[b]||!state.periodos[c])return;
  const res = metodo==='directo'?calcEfeDirecto(b,c):calcEfeIndirecto(b,c);
  const headerRow=document.createElement('tr');
  headerRow.innerHTML=`<td><strong>Periodo base:</strong> ${b} &nbsp; <strong>Comparado:</strong> ${c} &nbsp; <span class="badge">${metodo}</span></td><td></td>`;
  tb.appendChild(headerRow);
  const invItem={k:'Δ Activo no corriente',v:-(sumBG(c).ANC-sumBG(b).ANC)};
  const cffItems=(res.cffDetalle&&res.cffDetalle.length)?res.cffDetalle:[{k:'Balanceo',v:res.CFF}];
  const secc=[
    {title:'Flujos de operación (CFO)',items:res.detalle,total:res.CFO},
    {title:'Flujos de inversión (CFI)',items:[invItem],total:res.CFI},
    {title:'Flujos de financiamiento (CFF)',items:cffItems,total:res.CFF}
  ];
  for(const s of secc){
    const trow=document.createElement('tr');
    trow.innerHTML=`<td><strong>${s.title}</strong></td><td></td>`;tb.appendChild(trow);
    for(const it of s.items){const tr=document.createElement('tr');tr.innerHTML=`<td>${it.k}</td><td class="num">${fmt(it.v)}</td>`;tb.appendChild(tr);} 
    const trTot=document.createElement('tr');
    trTot.innerHTML=`<td><strong>Total ${s.title.split(' ')[2]}</strong></td><td class="num"><strong>${fmt(s.total)}</strong></td>`;tb.appendChild(trTot);
  }
  tf.innerHTML=`<tr><th>Δ Efectivo (comp−base)</th><th class="num">${fmt(res.deltaEfectivo)}</th></tr>`;
}
function computeDuPont(y){
  const sBG=sumBG(y), sER=sumER(y);
  const PM=sER.VENTAS?safeDiv(sER.UN,sER.VENTAS):null;
  const AT=taProm(y)?safeDiv(sER.VENTAS,taProm(y)):null;
  const EM=sBG.PAT?safeDiv(sBG.TA,sBG.PAT):null;
  const ROE=(PM!=null&&AT!=null&&EM!=null)?PM*AT*EM:null;
  return {PM,AT,EM,ROE};
}
function renderDuPont(){
  const sel=document.getElementById('dupPeriodoSelect');
  const tb=document.querySelector('#tablaDuPont tbody');
  const tf=document.querySelector('#tablaDuPont tfoot');
  if(!sel||!tb||!tf)return;tb.innerHTML='';tf.innerHTML='';
  const y=sel.value; if(!y||!state.periodos[y])return;
  const {PM,AT,EM,ROE}=computeDuPont(y);
  const rows=[
    ['Margen neto (UN/Ventas)',PM==null?'—':PF.format(PM)],
    ['Rotación de activos (Ventas/TA prom)',AT==null?'—':NF.format(AT)],
    ['Multiplicador de capital (TA/Patrimonio)',EM==null?'—':NF.format(EM)],
    ['ROE (PM×AT×EM)',ROE==null?'—':PF.format(ROE)]
  ];
  for(const [k,v] of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${k}</td><td class="num">${v}</td>`;tb.appendChild(tr);} 
}
// ===== Gráficos (canvas 3D ligero) =====
function drawBar3D(ctx, x, baseY, w, h, color){
  const depth=8; const shade=(hex, f)=>{const n=parseInt(hex.replace('#',''),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255; r=Math.max(0,Math.min(255,Math.floor(r*f))); g=Math.max(0,Math.min(255,Math.floor(g*f))); b=Math.max(0,Math.min(255,Math.floor(b*f))); return `rgb(${r},${g},${b})`;};
  const topH=Math.min(Math.abs(h), depth);
  const sgn=h>=0?1:-1;
  // Front
  ctx.fillStyle=color; ctx.fillRect(x, baseY - (h>0?h:0), w, Math.abs(h));
  // Top
  ctx.fillStyle=shade(color,1.15);
  ctx.beginPath();
  ctx.moveTo(x, baseY - (h>0?h:0));
  ctx.lineTo(x+depth, baseY - (h>0?h:0)-topH);
  ctx.lineTo(x+w+depth, baseY - (h>0?h:0)-topH);
  ctx.lineTo(x+w, baseY - (h>0?h:0));
  ctx.closePath(); ctx.fill();
}
function sortAH(arr,order){if(order==='deltaPct')return arr.slice().sort((a,b)=>Math.abs((b.dperc||0))-Math.abs((a.dperc||0)));if(order==='valor')return arr.slice().sort((a,b)=>Math.abs(b.comp)-Math.abs(a.comp));return arr.slice().sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));}
function getAH(base,comp,tipo,topN,order){const rows=analisisHorizontal(base,comp,tipo);const s=sortAH(rows,order).slice(0,topN);const cats=s.map(r=>r.nombre);const sBase=s.map(r=>r.base);const sComp=s.map(r=>r.comp);return {cats,sBase,sComp};}
function getRazonesComparadas(b,c){const rb=razonesExtendidas(b),rc=razonesExtendidas(c);return [
  {id:'RC',nombre:'RC (AC/PC)',isPct:false,b:rb.RC,c:rc.RC},
  {id:'RR',nombre:'RR ((AC-Inv)/PC)',isPct:false,b:rb.RR,c:rc.RR},
  {id:'RotInv',nombre:'Rotación Inv',isPct:false,b:rb.RotInv,c:rc.RotInv},
  {id:'RotCxC',nombre:'Rotación CxC',isPct:false,b:rb.RotCxC,c:rc.RotCxC},
  {id:'PPC',nombre:'PPC (días)',isPct:false,b:rb.PPC,c:rc.PPC},
  {id:'RotAF',nombre:'Rotación AF',isPct:false,b:rb.RotAF,c:rc.RotAF},
  {id:'RotAT',nombre:'Rotación AT',isPct:false,b:rb.RotAT,c:rc.RotAT},
  {id:'Endeuda',nombre:'Endeuda (Pasivo/TA)',isPct:true,b:rb.Endeuda,c:rc.Endeuda},
  {id:'PasivoCapital',nombre:'Pasivo/Capital',isPct:false,b:rb.PasivoCapital,c:rc.PasivoCapital},
  {id:'CoberturaInt',nombre:'Cobertura intereses',isPct:false,b:rb.CoberturaInt,c:rc.CoberturaInt},
  {id:'MUB',nombre:'MUB',isPct:true,b:rb.MUB,c:rc.MUB},
  {id:'MUO',nombre:'MUO',isPct:true,b:rb.MUO,c:rc.MUO},
  {id:'MN',nombre:'MN',isPct:true,b:rb.MN,c:rc.MN},
  {id:'ROA',nombre:'ROA',isPct:true,b:rb.ROA,c:rc.ROA}
];}
function renderChartsAll(){
  resizeGrafCanvases();
  const b=document.getElementById('grafBaseSelect')?.value;
  const c=document.getElementById('grafCompSelect')?.value;
  const topN=parseInt(document.getElementById('grafTopNSelect')?.value||'10',10);
  const order=document.getElementById('grafOrdenSelect')?.value||'deltaAbs';
  const valMode=(document.getElementById('grafValorSelect')?.value||'monto');
  if(!(b && c && state.periodos[b] && state.periodos[c])) return;

  // 1) Análisis horizontal (BG/ER) y vertical (BG)
  renderChartAHBG(b,c,topN,order,valMode);
  renderChartAHER(b,c,topN,order,valMode);
  renderChartAVBG(b,c,valMode);

  // 2) Razones financieras
  renderChartRazones(b,c);

  // 3) CNT y CNO
  renderChartCNTCNO(b,c);

  // 4) EOAF
  renderChartEOAF(b,c,topN);

  // 5) Estado de flujo de efectivo
  renderChartEFE(b,c);

  // 6) Modelo DuPont
  renderChartDup(b,c);
}

function renderChartDup(b,c){
  const cv=document.getElementById('chartDup'); if(!cv) return; const ctx=clearCanvas(cv);
  const pb=getStyle();
  const db=computeDuPont(b), dc=computeDuPont(c);
  const cats=['PM','AT','EM','ROE'];
  const sBase=[db.PM||0,db.AT||0,db.EM||0,db.ROE||0];
  const sComp=[dc.PM||0,dc.AT||0,dc.EM||0,dc.ROE||0];
  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pb[0],pb[1]]);
  const isPctIdx=new Set([0,3]);
  drawGroupedBars(cv,cats,[{data:sBase},{data:sComp}],[pb[0],pb[1]],{isPercentIdx:isPctIdx,showValues:true});
  // override label formatting for PM/ROE
  // simple overlay values
  ctx.fillStyle='#cfd9e3'; ctx.fillText('DuPont comparado',16,cv.height-6);
}
function renderChartAVBG(b,c,mode){
  const cv=document.getElementById('chartAVBG'); if(!cv) return; const ctx=clearCanvas(cv);
  const pal=getStyle();
  const sB=sumBG(b), sC=sumBG(c);
  const cats=['AC','ANC','PC','PNC','PAT'];
  const baseVals = cats.map(k=>k==='AC'||k==='ANC' ? (mode==='porc'?safeDiv(sB[k],sB.TA)||0:sB[k]) : (mode==='porc'?safeDiv(sB[k],sB.TPP)||0:sB[k]));
  const compVals = cats.map(k=>k==='AC'||k==='ANC' ? (mode==='porc'?safeDiv(sC[k],sC.TA)||0:sC[k]) : (mode==='porc'?safeDiv(sC[k],sC.TPP)||0:sC[k]));
  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pal[0],pal[1]]);
  drawGroupedBars(cv,cats,[{data:baseVals},{data:compVals}],[pal[0],pal[1]],{isPercent:(mode==='porc')});
}
function renderChartEFE(b,c){
  const cv=document.getElementById('chartEFE'); if(!cv) return; const ctx=clearCanvas(cv);
  const res=calcEfeIndirecto(b,c);
  const steps=[{k:'CFO',v:res.CFO},{k:'CFI',v:res.CFI},{k:'CFF',v:res.CFF}];
  const total=res.deltaEfectivo;
  const W=cv.width,H=cv.height; const margin=60; const base=H-50; const colW=Math.floor((W-margin*2)/ (steps.length+1));
  let acc=0; const pal=getStyle();
  ctx.font='12px system-ui'; ctx.fillStyle='#cfd9e3'; ctx.fillText(`Waterfall ${b}→${c}`,16,18);
  ctx.strokeStyle='#2a3545'; ctx.beginPath(); ctx.moveTo(margin-10, base); ctx.lineTo(W-margin+10, base); ctx.stroke();
  for(let i=0;i<steps.length;i++){
    const v=steps[i].v; const y0=base - Math.max(0,acc); const y1=base - Math.max(0,acc+v);
    const top=Math.min(y0,y1); const h=Math.abs(y0-y1);
    const x=margin + i*colW;
    ctx.fillStyle= v>=0 ? '#3FB27F' : '#F26D6D';
    ctx.fillRect(x, top, colW*0.6, h);
    ctx.fillStyle='#e6eef8'; ctx.fillText(`${steps[i].k}: ${fmt(v)}`, x, top-4);
    acc+=v;
    // connector
    ctx.strokeStyle='#5b6778'; ctx.beginPath(); ctx.moveTo(x+colW*0.6, base-acc); ctx.lineTo(x+colW, base-acc); ctx.stroke();
  }
  // total bar
  const xT=margin + steps.length*colW; const yT=base - Math.max(0,acc);
  const hT=Math.abs(acc);
  ctx.fillStyle='#F5A35D'; ctx.fillRect(xT, yT, colW*0.6, hT);
  ctx.fillStyle='#e6eef8'; ctx.fillText(`ΔEfec: ${fmt(total)}`, xT, yT-4);
}

function renderChartAHBG(b,c,topN,order,mode){
  const cv=document.getElementById('chartAHBG'); if(!cv) return; const ctx=clearCanvas(cv); const pal=getStyle();
  const {cats,sBase,sComp}=getAH(b,c,'BG',topN,order);
  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pal[0],pal[1]]);
  drawGroupedBars(cv,cats,[{data:sBase},{data:sComp}],[pal[0],pal[1]],{isPercent:false});
}
function renderChartAHER(b,c,topN,order,mode){
  const cv=document.getElementById('chartAHER'); if(!cv) return; const ctx=clearCanvas(cv); const pal=getStyle();
  const {cats,sBase,sComp}=getAH(b,c,'ER',topN,order);
  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pal[0],pal[1]]);
  drawGroupedBars(cv,cats,[{data:sBase},{data:sComp}],[pal[0],pal[1]],{isPercent:false});
}
function renderChartRazones(b,c){
  const cv=document.getElementById('chartRazones'); if(!cv) return; const ctx=clearCanvas(cv); const pal=getStyle();
  const items=getRazonesComparadas(b,c);
  const cats=items.map(i=>i.nombre);
  const sBase=items.map(i=>n(i.b));
  const sComp=items.map(i=>n(i.c));
  const isPct=items.every(i=>i.isPct) ? true : false; // mezcla: mostramos como número, y las etiquetas ya indican % si aplica
  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pal[0],pal[1]]);
  drawGroupedBars(cv,cats,[{data:sBase},{data:sComp}],[pal[0],pal[1]],{isPercent:false});
}
function renderChartCNTCNO(b,c){
  const cv=document.getElementById('chartCNTCNO');
  if(!cv) return;
  const ctx=clearCanvas(cv);
  if(!(state.periodos[b] && state.periodos[c])) return;

  const pal=getStyle();
  const cntB=calcCNT(b);
  const cntC=calcCNT(c);
  const cnoB=calcCNO(b);
  const cnoC=calcCNO(c);

  const cats=['CNT','CNO'];
  const dataBase=[n(cntB.CNT), n(cnoB.CNO)];
  const dataComp=[n(cntC.CNT), n(cnoC.CNO)];

  drawLegend(ctx,[`Base ${b}`,`Comp ${c}`],[pal[0],pal[1]]);
  drawGroupedBars(
    cv,
    cats,
    [{data:dataBase},{data:dataComp}],
    [pal[0],pal[1]],
    {isPercent:false}
  );
}

function getEOAFData(b,c,topN){
  const mb=state.periodos[b]?.BG||[];
  const mc=state.periodos[c]?.BG||[];
  const names=new Set([...mb.map(x=>x.nombre), ...mc.map(x=>x.nombre)]);
  const byName=(arr,nm)=>n(arr.filter(x=>x.nombre===nm).reduce((s,x)=>s+n(x.monto),0));
  const clasifOf=(nm)=>{
    const cmc=mc.find(x=>x.nombre===nm)?.clasif;
    if(cmc) return cmc;
    const cmb=mb.find(x=>x.nombre===nm)?.clasif;
    return cmb||'';
  };

  const rows=[];
  for(const nm of Array.from(names)){
    const vb=byName(mb,nm), vc=byName(mc,nm), delta=vc-vb;
    const cls=clasifOf(nm);
    let origen=0, aplic=0;
    const isActivo = (cls==='AC'||cls==='ANC');
    const isPasPat = (cls==='PC'||cls==='PNC'||cls==='PAT');
    if(delta>0){
      if(isActivo) aplic=delta; else if(isPasPat) origen=delta; else aplic=delta;
    }else if(delta<0){
      const ab=Math.abs(delta);
      if(isActivo) origen=ab; else if(isPasPat) aplic=ab; else origen=ab;
    }
    if(origen!==0 || aplic!==0){
      rows.push({nombre:nm, origen, aplic});
    }
  }

  const sorted=rows.sort((a,b)=>{
    const ma=Math.max(Math.abs(a.origen),Math.abs(a.aplic));
    const mb=Math.max(Math.abs(b.origen),Math.abs(b.aplic));
    return mb-ma;
  });

  const sel=sorted.slice(0,topN||10);
  return {
    cats: sel.map(r=>r.nombre),
    origen: sel.map(r=>r.origen),
    aplic: sel.map(r=>r.aplic)
  };
}

function renderChartEOAF(b,c,topN){
  const cv=document.getElementById('chartEOAF');
  if(!cv) return;
  const ctx=clearCanvas(cv);
  if(!(state.periodos[b] && state.periodos[c])) return;

  const pal=getStyle();
  const {cats,origen,aplic}=getEOAFData(b,c,topN);

  drawLegend(ctx,[`Origen ${b}→${c}`,`Aplicación ${b}→${c}`],[pal[2]||pal[0],pal[3]||pal[1]]);
  drawGroupedBars(
    cv,
    cats,
    [{data:origen},{data:aplic}],
    [pal[2]||pal[0],pal[3]||pal[1]],
    {isPercent:false}
  );
}

// ======================================================
//  BLOQUE DE GRÁFICOS — REDEFINIDO Y AUTOCONTENIDO
//  PÉGALO AL FINAL DE app.js
// ======================================================

// Utilidades mínimas para canvas (por si no existen)
function ensureCanvasUtils(){
  // Limpia y prepara el canvas
  if (typeof clearCanvas !== 'function') {
    window.clearCanvas = function(cv){
      const ctx = cv.getContext('2d');
      const w = cv.clientWidth || cv.width || 600;
      const h = cv.clientHeight || cv.height || 320;
      cv.width = w;
      cv.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#cfd9e3';
      return ctx;
    };
  }

  // Paleta según estilo seleccionado
  if (typeof getStyle !== 'function') {
    window.getStyle = function(){
      const style = document.getElementById('grafEstiloSelect')?.value || 'classic';
      if (style === 'pastel')
        return ['#67b7dc','#fdd400','#84b761','#cc4748','#cd82ad'];
      if (style === 'contrast')
        return ['#00d8ff','#ff006e','#ffd60a','#80ffdb','#ff9f1c'];
      // clásico FINBOT
      return ['#3FB27F','#4B8BEB','#F5A35D','#F26D6D','#9B6EF3'];
    };
  }

  // Leyenda simple arriba a la izquierda
  if (typeof drawLegend !== 'function') {
    window.drawLegend = function(ctx, labels, colors){
      if (!ctx) return;
      ctx.save();
      ctx.font = '12px system-ui';
      let x = 16, y = 18;
      for (let i = 0; i < labels.length; i++){
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y - 10, 10, 10);
        ctx.fillStyle = '#cfd9e3';
        ctx.fillText(labels[i], x + 16, y);
        x += 140;
      }
      ctx.restore();
    };
  }

  // Barras agrupadas horizontales simples
  if (typeof drawGroupedBars !== 'function') {
    window.drawGroupedBars = function(cv, cats, datasets, colors, opts){
      const ctx = cv.getContext('2d');
      const W = cv.width;
      const H = cv.height;
      const marginLeft = 40;
      const marginBottom = 40;
      const marginTop = 25;
      const innerW = W - marginLeft - 20;
      const innerH = H - marginTop - marginBottom;

      ctx.save();
      ctx.translate(marginLeft, marginTop);

      // Determinar máximo absoluto
      const vals = [];
      datasets.forEach(ds => ds.data.forEach(v => vals.push(Math.abs(v||0))));
      const maxVal = (vals.length ? Math.max(...vals) : 1) || 1;

      const nCats = cats.length || 1;
      const nSeries = datasets.length || 1;
      const groupW = innerW / nCats;
      const barW = groupW / (nSeries + 1);

      // Eje X (base)
      ctx.strokeStyle = '#2a3545';
      ctx.beginPath();
      ctx.moveTo(0, innerH);
      ctx.lineTo(innerW, innerH);
      ctx.stroke();

      ctx.font = '11px system-ui';
      ctx.fillStyle = '#cfd9e3';

      for (let i = 0; i < nCats; i++){
        const x0 = i * groupW;

        // Etiqueta de categoría (rotada)
        ctx.save();
        ctx.translate(x0 + groupW / 2, innerH + 14);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(cats[i], 0, 0);
        ctx.restore();

        for (let j = 0; j < nSeries; j++){
          const v = datasets[j].data[i] || 0;
          const h = (Math.abs(v) / maxVal) * (innerH - 20);
          const x = x0 + barW * (j + 0.5);
          const y = innerH - h;

          ctx.fillStyle = colors[j] || '#4B8BEB';
          ctx.fillRect(x, y, barW, h);

          if (opts && opts.showValues){
            ctx.save();
            ctx.fillStyle = '#e6eef8';
            ctx.font = '10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(
              NF.format(v),
              x + barW / 2,
              y - 4
            );
            ctx.restore();
          }
        }
      }

      ctx.restore();
    };
  }

  // Redimensiona todos los canvas de la pestaña
  if (typeof resizeGrafCanvases !== 'function') {
    window.resizeGrafCanvases = function(){
      document.querySelectorAll('#tab-graficos canvas').forEach(cv=>{
        const wrap = cv.parentElement;
        const w = wrap.clientWidth || 600;
        const h = wrap.clientHeight || 320;
        cv.width = w;
        cv.height = h;
      });
    };
  }
}

// ======================================================
//  ORDEN GENERAL DE GRÁFICOS
// ======================================================
function renderChartsAll(){
  ensureCanvasUtils();
  resizeGrafCanvases();

  const b = document.getElementById('grafBaseSelect')?.value;
  const c = document.getElementById('grafCompSelect')?.value;
  const topN = parseInt(document.getElementById('grafTopNSelect')?.value || '10', 10);
  const order = document.getElementById('grafOrdenSelect')?.value || 'deltaAbs';
  const valMode = (document.getElementById('grafValorSelect')?.value || 'monto');

  if (!(b && c && state.periodos[b] && state.periodos[c])) return;

  // 1) Análisis horizontal (BG/ER) + vertical (BG)
  renderChartAHBG(b, c, topN, order, valMode);
  renderChartAHER(b, c, topN, order, valMode);
  renderChartAVBG(b, c, valMode);

  // 2) Razones financieras
  renderChartRazones(b, c);

  // 3) CNT y CNO
  renderChartCNTCNO(b, c);

  // 4) EOAF
  renderChartEOAF(b, c, topN);

  // 5) Estado de flujo de efectivo
  renderChartEFE(b, c);

  // 6) Modelo DuPont
  renderChartDup(b, c);
}

// ======================================================
//  1. AH + AV
// ======================================================
function renderChartDup(b, c){
  const cv = document.getElementById('chartDup');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const db = computeDuPont(b);
  const dc = computeDuPont(c);

  const cats = ['PM','AT','EM','ROE'];
  const sBase = [db.PM||0, db.AT||0, db.EM||0, db.ROE||0];
  const sComp = [dc.PM||0, dc.AT||0, dc.EM||0, dc.ROE||0];

  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:sBase},{data:sComp}], [pal[0], pal[1]], {showValues:true});

  ctx.fillStyle = '#cfd9e3';
  ctx.fillText('DuPont comparado', 16, cv.height - 10);
}

function renderChartAVBG(b, c, mode){
  const cv = document.getElementById('chartAVBG');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const sB = sumBG(b), sC = sumBG(c);
  const cats = ['AC','ANC','PC','PNC','PAT'];

  const baseVals = cats.map(k => {
    if (k === 'AC' || k === 'ANC') {
      return (mode === 'porc' ? safeDiv(sB[k], sB.TA) || 0 : sB[k]);
    }
    return (mode === 'porc' ? safeDiv(sB[k], sB.TPP) || 0 : sB[k]);
  });

  const compVals = cats.map(k => {
    if (k === 'AC' || k === 'ANC') {
      return (mode === 'porc' ? safeDiv(sC[k], sC.TA) || 0 : sC[k]);
    }
    return (mode === 'porc' ? safeDiv(sC[k], sC.TPP) || 0 : sC[k]);
  });

  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:baseVals},{data:compVals}], [pal[0], pal[1]], {});
}

function renderChartAHBG(b, c, topN, order, mode){
  const cv = document.getElementById('chartAHBG');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const {cats,sBase,sComp} = getAH(b, c, 'BG', topN, order);
  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:sBase},{data:sComp}], [pal[0], pal[1]], {});
}

function renderChartAHER(b, c, topN, order, mode){
  const cv = document.getElementById('chartAHER');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const {cats,sBase,sComp} = getAH(b, c, 'ER', topN, order);
  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:sBase},{data:sComp}], [pal[0], pal[1]], {});
}

// ======================================================
//  2. Razones financieras
// ======================================================
function renderChartRazones(b, c){
  const cv = document.getElementById('chartRazones');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const items = getRazonesComparadas(b, c);
  const cats = items.map(i => i.nombre);
  const sBase = items.map(i => n(i.b));
  const sComp = items.map(i => n(i.c));

  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:sBase},{data:sComp}], [pal[0], pal[1]], {});
}

// ======================================================
//  3. CNT y CNO
// ======================================================
function renderChartCNTCNO(b, c){
  const cv = document.getElementById('chartCNTCNO');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const cntB = calcCNT(b);
  const cntC = calcCNT(c);
  const cnoB = calcCNO(b);
  const cnoC = calcCNO(c);

  const cats = ['CNT', 'CNO'];
  const dataBase = [n(cntB.CNT), n(cnoB.CNO)];
  const dataComp = [n(cntC.CNT), n(cnoC.CNO)];

  drawLegend(ctx, [`Base ${b}`, `Comp ${c}`], [pal[0], pal[1]]);
  drawGroupedBars(cv, cats, [{data:dataBase},{data:dataComp}], [pal[0], pal[1]], {showValues:true});
}

// ======================================================
//  4. EOAF (Origen y aplicación de fondos)
// ======================================================
function getEOAFData(b, c, topN){
  const mb = state.periodos[b]?.BG || [];
  const mc = state.periodos[c]?.BG || [];

  const names = new Set([...mb.map(x=>x.nombre), ...mc.map(x=>x.nombre)]);
  const byName = (arr,nm) => n(arr.filter(x=>x.nombre===nm).reduce((s,x)=>s+n(x.monto),0));

  const clasifOf = (nm)=>{
    const cmc = mc.find(x=>x.nombre===nm)?.clasif;
    if (cmc) return cmc;
    const cmb = mb.find(x=>x.nombre===nm)?.clasif;
    return cmb || '';
  };

  const rows = [];
  for (const nm of Array.from(names)){
    const vb = byName(mb, nm);
    const vc = byName(mc, nm);
    const delta = vc - vb;
    const cls = clasifOf(nm);

    let origen = 0, aplic = 0;
    const isActivo = (cls==='AC' || cls==='ANC');
    const isPasPat = (cls==='PC' || cls==='PNC' || cls==='PAT');

    if (delta > 0){
      if (isActivo) aplic = delta;
      else if (isPasPat) origen = delta;
      else aplic = delta;
    } else if (delta < 0){
      const ab = Math.abs(delta);
      if (isActivo) origen = ab;
      else if (isPasPat) aplic = ab;
      else origen = ab;
    }

    if (origen !== 0 || aplic !== 0){
      rows.push({nombre:nm, origen, aplic});
    }
  }

  const sorted = rows.sort((a,b)=>{
    const ma = Math.max(Math.abs(a.origen), Math.abs(a.aplic));
    const mb2 = Math.max(Math.abs(b.origen), Math.abs(b.aplic));
    return mb2 - ma;
  });

  const sel = sorted.slice(0, topN || 10);
  return {
    cats: sel.map(r=>r.nombre),
    origen: sel.map(r=>r.origen),
    aplic: sel.map(r=>r.aplic)
  };
}

function renderChartEOAF(b, c, topN){
  const cv = document.getElementById('chartEOAF');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const {cats, origen, aplic} = getEOAFData(b, c, topN);

  drawLegend(ctx, [`Origen ${b}→${c}`, `Aplicación ${b}→${c}`], [pal[2]||pal[0], pal[3]||pal[1]]);
  drawGroupedBars(
    cv,
    cats,
    [{data:origen},{data:aplic}],
    [pal[2]||pal[0], pal[3]||pal[1]],
    {showValues:true}
  );
}

// ======================================================
//  5. EFE — gráfico tipo waterfall simplificado
// ======================================================
function renderChartEFE(b, c){
  const cv = document.getElementById('chartEFE');
  if (!cv) return;
  ensureCanvasUtils();
  const ctx = clearCanvas(cv);
  const pal = getStyle();

  const res = calcEfeIndirecto(b, c);
  const steps = [
    {k:'CFO', v:res.CFO},
    {k:'CFI', v:res.CFI},
    {k:'CFF', v:res.CFF}
  ];
  const total = res.deltaEfectivo;

  const W = cv.width;
  const H = cv.height;
  const margin = 60;
  const base = H - 50;
  const colW = Math.floor((W - margin*2) / (steps.length + 1));

  ctx.font = '12px system-ui';
  ctx.fillStyle = '#cfd9e3';
  ctx.fillText(`Waterfall EFE ${b}→${c}`, 16, 20);

  ctx.strokeStyle = '#2a3545';
  ctx.beginPath();
  ctx.moveTo(margin - 10, base);
  ctx.lineTo(W - margin + 10, base);
  ctx.stroke();

  let acc = 0;
  for (let i = 0; i < steps.length; i++){
    const v = steps[i].v || 0;
    const prevAcc = acc;
    acc += v;

    const h = Math.abs(v) *  (base - 100) / (Math.max(Math.abs(res.CFO),Math.abs(res.CFI),Math.abs(res.CFF),1));
    const x = margin + i * colW;
    const y = v >= 0 ? base - h : base;

    ctx.fillStyle = v >= 0 ? pal[0] : pal[3] || '#F26D6D';
    ctx.fillRect(x, y, colW*0.6, h);

    ctx.fillStyle = '#e6eef8';
    ctx.fillText(`${steps[i].k}: ${fmt(v)}`, x, y - 4);
  }

  // barra total
  const xT = margin + steps.length * colW;
  const hT = Math.abs(total) *  (base - 100) / (Math.max(Math.abs(res.CFO),Math.abs(res.CFI),Math.abs(res.CFF),1));
  const yT = total >= 0 ? base - hT : base;

  ctx.fillStyle = pal[2] || '#F5A35D';
  ctx.fillRect(xT, yT, colW*0.6, hT);
  ctx.fillStyle = '#e6eef8';
  ctx.fillText(`ΔEfec: ${fmt(total)}`, xT, yT - 4);
}

// ===== Helpers base =====

// Devuelve el objeto de estado de FINBOT sin importar cómo esté expuesto
function finbotGetState() {
  try {
    if (typeof state !== 'undefined' && state) return state;
  } catch (e) {}
  if (window.state) return window.state;
  if (window.global && window.global.state) return window.global.state;
  return null;
}

// Descarga archivo genérico
function finbotDescargarArchivo(nombre, tipoMime, contenido) {
  var blob = new Blob([contenido], { type: tipoMime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Devuelve outerHTML de una tabla si tiene filas en el tbody
function finbotTableHtml(id) {
  var t = document.getElementById(id);
  if (!t || !t.tBodies || !t.tBodies[0]) return '';
  if (!t.tBodies[0].rows.length) return '';
  return t.outerHTML;
}

// Convierte un canvas en <img> embebida
function finbotCanvasImgHtml(id, titulo) {
  var c = document.getElementById(id);
  if (!c) return '';
  try {
    var data = c.toDataURL('image/png');
    return '<h4>' + titulo + '</h4>' +
           '<img src="' + data + '" style="max-width:100%;height:auto;margin-bottom:12px;"/>';
  } catch(e) {
    return '';
  }
}



// ===== Utilidad genérica para descargar archivos =====
function finbotDescargarArchivo(nombre, tipoMime, contenido) {
  var blob = new Blob([contenido], { type: tipoMime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/*
function finbotExportEmpresaJson() {
  var S = finbotGetState();
  if (!S) {
    alert('No hay datos cargados para exportar.');
    return;
  }

  var empresaInput = document.getElementById('empresaInput');
  var empresa = empresaInput && empresaInput.value.trim()
    ? empresaInput.value.trim()
    : 'Empresa';

  var payload = {
    empresa: empresa,
    exportadoEn: new Date().toISOString(),
    state: S
  };

  var json = JSON.stringify(payload, null, 2);
  var safe = empresa.replace(/[^\w\-]+/g, '_');
  finbotDescargarArchivo(
    'FINBOT_' + safe + '.json',
    'application/json;charset=utf-8;',
    json
  );
}*/


/*function finbotExportEmpresaJson() {
  try {
    const S = finbotGetState();
    if (!S) {
      throw new Error('No hay datos cargados para exportar.');
    }

    // Obtener los datos en el orden solicitado
    const exportData = {
      // 1. DATOS
      empresa: S.empresa,
      periodos: S.periodos,
      periodoActivo: S.periodoActivo,
      
      // 2. ANÁLISIS
      analisis: {},
      
      // 3. RAZONES
      razones: {},
      
      // 4. EOAF
      eoaf: {},
      
      // 5. EFE
      efe: {},
      
      // 6. DuPont
      dupont: {},
      
      // 7. GRÁFICOS (solo referencias)
      graficos: {
        nota: "Los gráficos no se incluyen en la exportación JSON. Use la exportación a PDF o HTML para ver los gráficos."
      },
      
      // 8. PROFORMA
      proforma: {},
      
      // Metadatos
      _exportado: new Date().toISOString(),
      _version: "1.0"
    };

    // Llenar los datos de análisis, razones, etc. para cada período
    Object.keys(S.periodos || {}).sort().forEach(periodo => {
      // Análisis Horizontal y Vertical
      exportData.analisis[periodo] = {
        horizontal: analisisHorizontal(periodo, S.periodoActivo, 'BG'), // Asumiendo que existe esta función
        vertical: analisisVerticalBG(periodo) // Asumiendo que existe esta función
      };

      // Razones financieras
      exportData.razones[periodo] = razonesListado(periodo); // Asumiendo que existe esta función

      // EOAF
      const eoafData = getEOAFData(periodo, S.periodoActivo); // Asumiendo que existe esta función
      if (eoafData) {
        exportData.eoaf[periodo] = eoafData;
      }

      // EFE
      exportData.efe[periodo] = {
        directo: calcEfeDirecto(periodo, S.periodoActivo), // Asumiendo que existe esta función
        indirecto: calcEfeIndirecto(periodo, S.periodoActivo) // Asumiendo que existe esta función
      };

      // DuPont
      exportData.dupont[periodo] = computeDuPont(periodo); // Asumiendo que existe esta función

      // Proforma (si existe)
      if (S.proforma && S.proforma[periodo]) {
        exportData.proforma[periodo] = S.proforma[periodo];
      }
    });

    // Generar el nombre del archivo
    const nombreArchivo = `finbot_export_${S.empresa || 'empresa'}_${new Date().toISOString().split('T')[0]}.json`;
    
    // Crear y descargar el archivo
    const contenido = JSON.stringify(exportData, null, 2);
    const blob = new Blob([contenido], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error en finbotExportEmpresaJson:', error);
    throw error;
  }
}*/

function finbotExportEmpresaExcel() {
  try {
    const S = finbotGetState();
    if (!S || !S.periodos) {
      throw new Error('No hay datos cargados para exportar.');
    }

    // Crear un nuevo libro de trabajo
    const wb = XLSX.utils.book_new();
    const periodos = Object.keys(S.periodos).sort();
    
    // 1. DATOS: Exportar datos básicos
    const datosWS = XLSX.utils.json_to_sheet([{
      'Empresa': S.empresa,
      'Periodo Activo': S.periodoActivo,
      'Total Periodos': periodos.length,
      'Fecha Exportación': new Date().toLocaleString()
    }]);
    XLSX.utils.book_append_sheet(wb, datosWS, 'Datos Generales');

    // 2. DATOS: Exportar Balance General
    const bgData = [];
    periodos.forEach(p => {
      (S.periodos[p].BG || []).forEach(item => {
        bgData.push({
          'Periodo': p,
          'Cuenta': item.nombre,
          'Clasificación': item.clasif,
          'Monto': item.monto,
          'Operativa': item.operativa ? 'Sí' : 'No'
        });
      });
    });
    if (bgData.length > 0) {
      const bgWS = XLSX.utils.json_to_sheet(bgData);
      XLSX.utils.book_append_sheet(wb, bgWS, 'Balance General');
    }

    // 3. DATOS: Exportar Estado de Resultados
    const erData = [];
    periodos.forEach(p => {
      (S.periodos[p].ER || []).forEach(item => {
        erData.push({
          'Periodo': p,
          'Cuenta': item.nombre,
          'Clasificación': item.clasif,
          'Monto': item.monto
        });
      });
    });
    if (erData.length > 0) {
      const erWS = XLSX.utils.json_to_sheet(erData);
      XLSX.utils.book_append_sheet(wb, erWS, 'Estado Resultados');
    }

    // 4. ANÁLISIS: Exportar Análisis Horizontal
    const ahData = [];
    periodos.forEach(p => {
      const ah = analisisHorizontal(p, S.periodoActivo, 'BG');
      if (ah) {
        Object.entries(ah).forEach(([cuenta, valor]) => {
          ahData.push({
            'Periodo': p,
            'Cuenta': cuenta,
            'Variación': valor
          });
        });
      }
    });
    if (ahData.length > 0) {
      const ahWS = XLSX.utils.json_to_sheet(ahData);
      XLSX.utils.book_append_sheet(wb, ahWS, 'Análisis Horizontal');
    }

    // 5. ANÁLISIS: Exportar Análisis Vertical
    const avData = [];
    periodos.forEach(p => {
      const av = analisisVerticalBG(p);
      if (av) {
        Object.entries(av).forEach(([cuenta, valor]) => {
          avData.push({
            'Periodo': p,
            'Cuenta': cuenta,
            'Porcentaje': valor
          });
        });
      }
    });
    if (avData.length > 0) {
      const avWS = XLSX.utils.json_to_sheet(avData);
      XLSX.utils.book_append_sheet(wb, avWS, 'Análisis Vertical');
    }

    // 6. RAZONES: Exportar Razones Financieras
    const razonesData = [];
    periodos.forEach(p => {
      const razones = razonesListado(p);
      if (razones) {
        razones.forEach(r => {
          razonesData.push({
            'Periodo': p,
            'Razón': r.nombre,
            'Fórmula': r.formula,
            'Valor': r.valor,
            'Interpretación': r.interpretacion
          });
        });
      }
    });
    if (razonesData.length > 0) {
      const razonesWS = XLSX.utils.json_to_sheet(razonesData);
      XLSX.utils.book_append_sheet(wb, razonesWS, 'Razones Financieras');
    }

    // 7. EOAF: Exportar Origen y Aplicación de Fondos
    const eoafData = [];
    periodos.forEach((p, i) => {
      if (i > 0) {
        const eoaf = getEOAFData(periodos[i-1], p);
        if (eoaf) {
          // Agregar orígenes
          (eoaf.origenes || []).forEach(item => {
            eoafData.push({
              'Periodo': `${periodos[i-1]} → ${p}`,
              'Tipo': 'Origen',
              'Concepto': item.concepto,
              'Monto': item.monto
            });
          });
          // Agregar aplicaciones
          (eoaf.aplicaciones || []).forEach(item => {
            eoafData.push({
              'Periodo': `${periodos[i-1]} → ${p}`,
              'Tipo': 'Aplicación',
              'Concepto': item.concepto,
              'Monto': item.monto
            });
          });
        }
      }
    });
    if (eoafData.length > 0) {
      const eoafWS = XLSX.utils.json_to_sheet(eoafData);
      XLSX.utils.book_append_sheet(wb, eoafWS, 'EOAF');
    }

    // 8. EFE: Exportar Estado de Flujo de Efectivo
    const efeData = [];
    periodos.forEach((p, i) => {
      if (i > 0) {
        const efe = {
          directo: calcEfeDirecto(periodos[i-1], p),
          indirecto: calcEfeIndirecto(periodos[i-1], p)
        };
        
        if (efe.directo) {
          Object.entries(efe.directo).forEach(([key, value]) => {
            efeData.push({
              'Periodo': `${periodos[i-1]} → ${p}`,
              'Método': 'Directo',
              'Concepto': key,
              'Monto': value
            });
          });
        }
        
        if (efe.indirecto) {
          Object.entries(efe.indirecto).forEach(([key, value]) => {
            efeData.push({
              'Periodo': `${periodos[i-1]} → ${p}`,
              'Método': 'Indirecto',
              'Concepto': key,
              'Monto': value
            });
          });
        }
      }
    });
    if (efeData.length > 0) {
      const efeWS = XLSX.utils.json_to_sheet(efeData);
      XLSX.utils.book_append_sheet(wb, efeWS, 'EFE');
    }

    // 9. DUPONT: Exportar Análisis DuPont
    const dupontData = [];
    periodos.forEach(p => {
      const dupont = computeDuPont(p);
      if (dupont) {
        dupontData.push({
          'Periodo': p,
          'ROA': dupont.roa,
          'Margen Neto': dupont.margenNeto,
          'Rotación Activos': dupont.rotacionActivos,
          'Multiplicador Capital': dupont.multiplicadorCapital,
          'ROE': dupont.roe
        });
      }
    });
    if (dupontData.length > 0) {
      const dupontWS = XLSX.utils.json_to_sheet(dupontData);
      XLSX.utils.book_append_sheet(wb, dupontWS, 'DuPont');
    }

    // 10. PROFORMA: Exportar datos de proyección (si existen)
    if (S.proforma) {
      const proformaData = [];
      Object.entries(S.proforma).forEach(([periodo, datos]) => {
        if (datos.BG) {
          datos.BG.forEach(item => {
            proformaData.push({
              'Tipo': 'Balance General',
              'Periodo': periodo,
              'Cuenta': item.nombre,
              'Clasificación': item.clasif,
              'Monto': item.monto
            });
          });
        }
        if (datos.ER) {
          datos.ER.forEach(item => {
            proformaData.push({
              'Tipo': 'Estado Resultados',
              'Periodo': periodo,
              'Cuenta': item.nombre,
              'Clasificación': item.clasif,
              'Monto': item.monto
            });
          });
        }
      });
      if (proformaData.length > 0) {
        const proformaWS = XLSX.utils.json_to_sheet(proformaData);
        XLSX.utils.book_append_sheet(wb, proformaWS, 'Proyecciones');
      }
    }

    // Generar el archivo Excel
    const nombreArchivo = `finbot_export_${S.empresa || 'empresa'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
    
    return true;
  } catch (error) {
    console.error('Error en finbotExportEmpresaExcel:', error);
    throw error;
  }
}




function finbotExportEmpresaExcel() {
  var S = finbotGetState();
  if (!S || !S.periodos) {
    alert('No hay datos cargados para exportar.');
    return;
  }

  finbotPrepararAnalisisParaExportar();

  var empresaInput = document.getElementById('empresaInput');
  var empresa = (empresaInput && empresaInput.value.trim()) || 'Empresa';

  var bodyHtml = finbotBuildFullReportHtmlProfesional();
  var html = '<html><head><meta charset="utf-8" /></head><body>' +
             bodyHtml + '</body></html>';

  var safe = empresa.replace(/[^\w\-]+/g, '_');
  finbotDescargarArchivo(
    'FINBOT_' + safe + '_INFORME_COMPLETO.xls',
    'application/vnd.ms-excel;charset=utf-8;',
    html
  );
}


// =============================
//  REPORTE FINANCIERO COMPLETO (PDF)
// =============================


/*
function exportReporteCompletoPdf(){
  const periods = sortYears(Object.keys(state.periodos || {}));
  if (!periods.length){
    alert('No hay datos para generar el reporte.');
    return;
  }

  const nombre = state.empresa || 'Empresa';
  const win = window.open('', '_blank');
  if (!win){
    alert('El navegador bloqueó la ventana emergente. Permita popups para usar esta función.');
    return;
  }

  // ÍNDICE – ajusta los nombres según tus secciones reales
  const indiceHtml = `
    <h2>Índice</h2>
    <ol>
      <li><a href="#sec-estados">1. Estados financieros base (BG y ER)</a></li>
      <li><a href="#sec-analisis">2. Análisis horizontal y vertical</a></li>
      <li><a href="#sec-razones">3. Razones financieras</a></li>
      <li><a href="#sec-cno-cnt">4. CNO y CNT</a></li>
      <li><a href="#sec-eoaf">5. EOAF</a></li>
      <li><a href="#sec-efe">6. Estado de flujo de efectivo</a></li>
      <li><a href="#sec-dupont">7. DuPont</a></li>
      <li><a href="#sec-proforma">8. Estados proforma</a></li>
      <li><a href="#sec-graficos">9. Gráficos</a></li>
    </ol>
  `;

  // Portada + resumen general en texto (si ya tienes generarResumenTXT)
  const resumen = (typeof generarResumenTXT === 'function')
    ? generarResumenTXT()
    : 'Resumen no disponible (falta implementar generarResumenTXT()).';

  let bodyHtml = `
    <h1 style="margin-bottom:4px;">FINBOT Web – Reporte Financiero Completo</h1>
    <p style="color:#6b7280;margin-top:0;margin-bottom:16px;">
      Empresa: <strong>${nombre}</strong><br/>
      Periodos analizados: ${periods.join(', ')}
    </p>

    ${indiceHtml}

    <section id="sec-resumen" style="margin-top:24px; margin-bottom:24px;">
      <h2>Resumen ejecutivo</h2>
      <pre style="
        white-space: pre-wrap;
        font-size: 12px;
        line-height: 1.4;
        border: 1px solid #e5e7eb;
        padding: 12px;
        border-radius: 6px;
        background: #f9fafb;
      ">${resumen.replace(/</g,'&lt;')}</pre>
    </section>
  `;

  // 🔹 1. Estados base (BG + ER)
  //   → usa el mismo contenedor donde muestras BG/ER comparativos en tu página
  bodyHtml += buildSectionFromDom('panel-estados-base', '1. Estados financieros base (Balance General y Estado de Resultados)', 'sec-estados');

  // 🔹 2. Análisis horizontal y vertical
  bodyHtml += buildSectionFromDom('panel-analisis-hv', '2. Análisis horizontal y vertical', 'sec-analisis');

  // 🔹 3. Razones financieras
  bodyHtml += buildSectionFromDom('panel-razones', '3. Razones financieras', 'sec-razones');

  // 🔹 4. CNO y CNT
  bodyHtml += buildSectionFromDom('panel-cno-cnt', '4. Capital de trabajo: CNO y CNT', 'sec-cno-cnt');

  // 🔹 5. EOAF
  bodyHtml += buildSectionFromDom('panel-eoaf', '5. Efecto del Apalancamiento Financiero (EOAF)', 'sec-eoaf');

  // 🔹 6. Estado de flujo de efectivo
  bodyHtml += buildSectionFromDom('panel-efe', '6. Estado de Flujo de Efectivo', 'sec-efe');

  // 🔹 7. DuPont
  bodyHtml += buildSectionFromDom('panel-dupont', '7. Análisis DuPont', 'sec-dupont');

  // 🔹 8. Proforma
  bodyHtml += buildSectionFromDom('panel-proforma', '8. Estados financieros proforma', 'sec-proforma');

  // 🔹 9. Gráficos (usamos los canvas → imágenes)
  bodyHtml += `
    <section id="sec-graficos" style="page-break-before:always; margin-top:24px;">
      <h2>9. Gráficos</h2>
      ${buildGraficosSection()}
    </section>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>FINBOT – Reporte completo ${nombre}</title>
      <style>
        body{
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin: 24px;
          background: #ffffff;
          color: #111827;
        }
        h1,h2,h3{
          font-weight: 600;
          color: #111827;
        }
        h1{ font-size: 24px; }
        h2{ font-size: 18px; margin-top: 20px; }
        h3{ font-size: 16px; margin-top: 14px; }
        table{
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 12px;
        }
        th, td{
          border: 1px solid #e5e7eb;
          padding: 4px 6px;
          text-align: right;
        }
        th:first-child, td:first-child{
          text-align: left;
        }
        thead tr{
          background: #f3f4f6;
        }
        tfoot tr{
          background: #f9fafb;
          font-weight: 600;
        }
        ol{
          padding-left: 20px;
        }
        a{
          color: #2563eb;
          text-decoration: none;
        }
        a:hover{
          text-decoration: underline;
        }
        @media print{
          a{
            text-decoration: none;
            color: inherit;
          }
          body{
            margin: 10mm;
          }
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
      <script>
        window.onload = function(){
          // Abre el cuadro de impresión para exportar a PDF
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}*/

async function exportReporteCompletoPdf() {
  try {
    const { jsPDF } = window.jspdf;
    const S = finbotGetState();
    
    if (!S || !S.periodos) {
      throw new Error('No hay datos cargados para exportar.');
    }

    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;
    
    // Add title
    doc.setFontSize(20);
    doc.text(`Informe Financiero - ${S.empresa || 'Empresa'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;
    
    // Add sections
    const sections = [
      { title: '1. DATOS GENERALES', data: getDatosGenerales(S) },
      { title: '2. ANÁLISIS HORIZONTAL', data: getAnalisisHorizontalData(S) },
      { title: '3. ANÁLISIS VERTICAL', data: getAnalisisVerticalData(S) },
      { title: '4. RAZONES FINANCIERAS', data: getRazonesData(S) }
      // Add more sections as needed
    ];
    
    // Generate PDF content
    for (const section of sections) {
      // Add section header
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(16);
      doc.text(section.title, margin, yPos);
      yPos += 10;
      
      // Add section content
      if (section.data && section.data.length > 0) {
        // Convert data to array of arrays for autotable
        const headers = Object.keys(section.data[0]);
        const data = section.data.map(item => 
          headers.map(header => item[header])
        );
        
        doc.autoTable({
          startY: yPos,
          head: [headers],
          body: data,
          margin: { top: yPos },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [41, 128, 185] }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(12);
        doc.text('No hay datos disponibles', margin + 5, yPos);
        yPos += 10;
      }
      
      // Add some space between sections
      yPos += 10;
    }
    
    // Save the PDF
    doc.save(`finbot_${S.empresa || 'reporte'}_${new Date().toISOString().split('T')[0]}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar el PDF: ' + error.message);
    return false;
  }
}

// Helper functions for PDF generation
function getDatosGenerales(S) {
  return [{
    'Empresa': S.empresa || 'No especificada',
    'Periodo Activo': S.periodoActivo || 'No especificado',
    'Total Periodos': Object.keys(S.periodos || {}).length,
    'Moneda': 'USD' // Ajustar según corresponda
  }];
}

function getAnalisisHorizontalData(S) {
  const data = [];
  Object.keys(S.periodos || {}).sort().forEach(periodo => {
    const ah = analisisHorizontal(periodo, S.periodoActivo, 'BG');
    if (ah) {
      Object.entries(ah).forEach(([cuenta, valor]) => {
        data.push({
          'Periodo': periodo,
          'Cuenta': cuenta,
          'Variación': valor
        });
      });
    }
  });
  return data;
}

function getAnalisisVerticalData(S) {
  const data = [];
  Object.keys(S.periodos || {}).sort().forEach(periodo => {
    const av = analisisVerticalBG(periodo);
    if (av) {
      Object.entries(av).forEach(([cuenta, valor]) => {
        data.push({
          'Periodo': periodo,
          'Cuenta': cuenta,
          'Porcentaje': valor
        });
      });
    }
  });
  return data;
}

function getRazonesData(S) {
  const data = [];
  Object.keys(S.periodos || {}).sort().forEach(periodo => {
    const razones = razonesListado(periodo);
    if (razones) {
      razones.forEach(r => {
        data.push({
          'Periodo': periodo,
          'Razón': r.nombre,
          'Fórmula': r.formula,
          'Valor': r.valor,
          'Interpretación': r.interpretacion
        });
      });
    }
  });
  return data;
}

/*
document.addEventListener('DOMContentLoaded', function () {
  var btnJson  = document.getElementById('exportEmpresaJsonBtn');
  var btnExcel = document.getElementById('exportEmpresaExcelBtn');
  var btnPdf   = document.getElementById('exportEmpresaPdfBtn');

  if (btnJson) {
    btnJson.addEventListener('click', finbotExportEmpresaJson);
  }
  if (btnExcel) {
    btnExcel.addEventListener('click', finbotExportEmpresaExcel);
  }
  if (btnExpPdf)  btnExpPdf.addEventListener('click', exportReporteCompletoPdf);

});*/
// Add these at the end of your app.js
document.addEventListener('DOMContentLoaded', function() {
  // ... other event listeners ...
  
  // Export buttons
  document.getElementById('exportJsonBtn')?.addEventListener('click', finbotExportEmpresaJson);
  document.getElementById('exportExcelBtn')?.addEventListener('click', finbotExportEmpresaExcel);
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportReporteCompletoPdf);
  document.getElementById('exportHtmlBtn')?.addEventListener('click', verReporteHtml);
});






function finbotBuildFullReportHtml() {
  var S = finbotGetState();
  if (!S || !S.periodos) return '<p>No hay datos.</p>';

  var empresaInput = document.getElementById('empresaInput');
  var empresa = empresaInput && empresaInput.value.trim()
    ? empresaInput.value.trim()
    : 'Empresa';

  var years = Object.keys(S.periodos).sort();

  var html = '';

  // 0. Encabezado
  html += '<h2>FINBOT — Reporte financiero completo</h2>';
  html += '<p><b>Empresa:</b> ' + empresa + '<br/>';
  html += '<b>Fecha de exportación:</b> ' + new Date().toLocaleString() + '</p>';

  // 1. Datos base (BG y ER por periodo)
  html += '<h3>1. Datos base por periodo (Balance General y Estado de Resultados)</h3>';
  years.forEach(function (year) {
    var p = S.periodos[year] || {};
    html += '<h4>Periodo ' + year + '</h4>';

    if (p.bg && p.bg.length) {
      html += '<h5>Balance General</h5>';
      html += '<table><thead><tr><th>Cuenta</th><th>Clasificación</th><th>Operativa</th><th>Monto</th></tr></thead><tbody>';
      p.bg.forEach(function (c) {
        html += '<tr>' +
          '<td>' + (c.nombre || '') + '</td>' +
          '<td>' + (c.clasif || '') + '</td>' +
          '<td>' + (c.operativa ? 'Sí' : 'No') + '</td>' +
          '<td>' + (c.monto != null ? c.monto : '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }

    if (p.er && p.er.length) {
      html += '<h5>Estado de Resultados</h5>';
      html += '<table><thead><tr><th>Cuenta</th><th>Clasificación</th><th>Operativa</th><th>Monto</th></tr></thead><tbody>';
      p.er.forEach(function (c) {
        html += '<tr>' +
          '<td>' + (c.nombre || '') + '</td>' +
          '<td>' + (c.clasif || '') + '</td>' +
          '<td>' + (c.operativa ? 'Sí' : 'No') + '</td>' +
          '<td>' + (c.monto != null ? c.monto : '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }
  });

  // 2. Análisis horizontal y vertical (tablas ya calculadas)
  html += '<h3>2. Análisis horizontal y vertical</h3>';
  var ahbg = finbotTableHtml('tablaAHBG');
  var aher = finbotTableHtml('tablaAHER');
  var avbg = finbotTableHtml('tablaAVBG');
  var aver = finbotTableHtml('tablaAVER');

  if (ahbg || aher) {
    html += '<h4>2.1 Análisis horizontal</h4>';
    if (ahbg) html += '<h5>Balance General</h5>' + ahbg;
    if (aher) html += '<h5>Estado de Resultados</h5>' + aher;
  }

  if (avbg || aver) {
    html += '<h4>2.2 Análisis vertical</h4>';
    if (avbg) html += '<h5>Balance General</h5>' + avbg;
    if (aver) html += '<h5>Estado de Resultados</h5>' + aver;
  }

  // 3. Razones y CNT/CNO (usamos el HTML de las tarjetas)
  html += '<h3>3. Razones financieras y capital de trabajo</h3>';
  var rz = document.getElementById('razonesGrid');
  if (rz && rz.children.length) {
    html += '<h4>3.1 Razones financieras (último cálculo)</h4>';
    html += '<div>' + rz.innerHTML + '</div>';
  }
  var cntcno = document.getElementById('cntcnoGrid');
  if (cntcno && cntcno.children.length) {
    html += '<h4>3.2 CNT y CNO</h4>';
    html += '<div>' + cntcno.innerHTML + '</div>';
  }

  // 4. EOAF
  html += '<h3>4. Estado de Origen y Aplicación de Fondos (EOAF)</h3>';
  var eoafTable = finbotTableHtml('tablaEOAF');
  if (eoafTable) html += eoafTable;
  else html += '<p class="muted">No se ha calculado el EOAF.</p>';

  // 5. Estado de Flujo de Efectivo
  html += '<h3>5. Estado de Flujo de Efectivo</h3>';
  var efeTable = finbotTableHtml('tablaEFE');
  if (efeTable) html += efeTable;
  else html += '<p class="muted">No se ha calculado el EFE.</p>';

  // 6. Modelo DuPont
  html += '<h3>6. Modelo DuPont</h3>';
  var dupTable = finbotTableHtml('tablaDuPont');
  if (dupTable) html += dupTable;
  else html += '<p class="muted">No se ha calculado DuPont.</p>';

  // 7. Proforma
  html += '<h3>7. Estados financieros Proforma</h3>';

  var erPro = document.querySelector('#proformaEstadoResultados table');
  var bgPro = document.querySelector('#proformaBalanceGeneral table');
  var fePro = document.querySelector('#proformaFlujoEfectivo table');

  if (erPro && erPro.tBodies[0].rows.length) {
    html += '<h4>7.1 Estado de Resultados Proforma</h4>' + erPro.outerHTML;
  }
  if (bgPro && bgPro.tBodies[0].rows.length) {
    html += '<h4>7.2 Balance General Proforma</h4>' + bgPro.outerHTML;
  }
  if (fePro && fePro.tBodies[0].rows.length) {
    html += '<h4>7.3 Flujo de Efectivo Proforma</h4>' + fePro.outerHTML;
  }

  // 8. Gráficos (como imágenes de los canvas, si existen)
  html += '<h3>8. Gráficos principales</h3>';
  html += finbotCanvasImgHtml('chartAHBG', 'Análisis horizontal / vertical BG-ER');
  html += finbotCanvasImgHtml('chartRazones', 'Razones financieras');
  html += finbotCanvasImgHtml('chartCNTCNO', 'CNT y CNO');
  html += finbotCanvasImgHtml('chartEOAF', 'EOAF');
  html += finbotCanvasImgHtml('chartEFE', 'Estado de Flujo de Efectivo');
  html += finbotCanvasImgHtml('chartDup', 'Modelo DuPont');

  return html;

/*function finbotBuildFullReportHtmlProfesional() {
  var S = finbotGetState();
  if (!S || !S.periodos) return '<p>No hay datos.</p>';

  var empresaInput = document.getElementById('empresaInput');
  var empresa = (empresaInput && empresaInput.value.trim()) || 'Empresa';

  var years = Object.keys(S.periodos).sort();

  var html = '';

  // ========= PORTADA =========
  html += '<h1 style="text-align:center;margin-bottom:0;">FINBOT — Informe financiero completo</h1>';
  html += '<h3 style="text-align:center;margin-top:4px;margin-bottom:24px;">Empresa: ' +
          empresa + '</h3>';
  html += '<p><b>Fecha de generación:</b> ' + new Date().toLocaleString() + '</p>';
  html += '<p><b>Periodos evaluados:</b> ' + years.join(', ') + '</p>';
  html += '<hr/>';

  // ========= 1. SECCIÓN POR PERIODO =========
  years.forEach(function (year) {
    var p = S.periodos[year] || {};

    html += '<h2 style="margin-top:24px;border-bottom:2px solid #333;padding-bottom:4px;">Periodo ' + year + '</h2>';

    // 1.1 Balance General (usando los datos "crudos" del state)
    if (p.bg && p.bg.length) {
      html += '<h3>1.1 Balance General</h3>';
      html += '<table><thead><tr>' +
        '<th>Cuenta</th><th>Clasificación</th><th>Operativa</th><th>Monto</th>' +
        '</tr></thead><tbody>';
      p.bg.forEach(function (c) {
        html += '<tr>' +
          '<td>' + (c.nombre || '') + '</td>' +
          '<td>' + (c.clasif || '') + '</td>' +
          '<td>' + (c.operativa ? 'Sí' : 'No') + '</td>' +
          '<td>' + (c.monto != null ? c.monto : '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }

    // 1.2 Estado de Resultados
    if (p.er && p.er.length) {
      html += '<h3>1.2 Estado de Resultados</h3>';
      html += '<table><thead><tr>' +
        '<th>Cuenta</th><th>Clasificación</th><th>Operativa</th><th>Monto</th>' +
        '</tr></thead><tbody>';
      p.er.forEach(function (c) {
        html += '<tr>' +
          '<td>' + (c.nombre || '') + '</td>' +
          '<td>' + (c.clasif || '') + '</td>' +
          '<td>' + (c.operativa ? 'Sí' : 'No') + '</td>' +
          '<td>' + (c.monto != null ? c.monto : '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }

    // 1.3 Razones financieras (usando razonesListado si existe)
    if (typeof window.razonesListado === 'function') {
      try {
        var razones = window.razonesListado(year) || [];
        if (razones.length) {
          html += '<h3>1.3 Razones financieras</h3>';
          html += '<table><thead><tr>' +
                  '<th>Grupo</th><th>Razón</th><th>Valor</th><th>Interpretación breve</th>' +
                  '</tr></thead><tbody>';
          razones.forEach(function (r) {
            html += '<tr>' +
              '<td>' + (r.grupo || '') + '</td>' +
              '<td>' + (r.nombre || '') + '</td>' +
              '<td>' + (r.valor != null ? r.valor : '') + '</td>' +
              '<td>' + (r.interpretacionCorta || r.interpretacion || '') + '</td>' +
            '</tr>';
          });
          html += '</tbody></table>';
        }
      } catch(e) {
        // si algo falla, simplemente no mostramos razones
      }
    }

    // 1.4 CNT / CNO: aprovechamos el HTML ya renderizado en la pestaña Razones
    var cntcnoGrid = document.getElementById('cntcnoGrid');
    if (cntcnoGrid && cntcnoGrid.children.length) {
      html += '<h3>1.4 Capital Neto de Trabajo y CNO (vista del periodo ' + year + ')</h3>';
      html += '<div>' + cntcnoGrid.innerHTML + '</div>';
    }

    // 1.5 DuPont (tabla específica por periodo)
    var dupTable = finbotTableHtml('tablaDuPont');
    if (dupTable) {
      html += '<h3>1.5 Modelo DuPont (periodo ' + year + ')</h3>';
      html += dupTable;
    }

    html += '<div style="page-break-after:always;"></div>';
  });

  // ========= 2. ANÁLISIS GLOBAL ENTRE PERIODOS =========
  html += '<h2 style="border-bottom:2px solid #333;padding-bottom:4px;">Comparaciones entre periodos</h2>';

  var ahbg = finbotTableHtml('tablaAHBG');
  var aher = finbotTableHtml('tablaAHER');
  if (ahbg || aher) {
    html += '<h3>2.1 Análisis horizontal</h3>';
    if (ahbg) {
      html += '<h4>Balance General</h4>' + ahbg;
    }
    if (aher) {
      html += '<h4>Estado de Resultados</h4>' + aher;
    }
  }

  var avbg = finbotTableHtml('tablaAVBG');
  var aver = finbotTableHtml('tablaAVER');
  if (avbg || aver) {
    html += '<h3>2.2 Análisis vertical</h3>';
    if (avbg) {
      html += '<h4>Balance General</h4>' + avbg;
    }
    if (aver) {
      html += '<h4>Estado de Resultados</h4>' + aver;
    }
  }

  var eoafTable = finbotTableHtml('tablaEOAF');
  if (eoafTable) {
    html += '<h3>2.3 Estado de Origen y Aplicación de Fondos (EOAF)</h3>';
    html += eoafTable;
  }

  var efeTable = finbotTableHtml('tablaEFE');
  if (efeTable) {
    html += '<h3>2.4 Estado de Flujo de Efectivo (EFE)</h3>';
    html += efeTable;
  }

  // ========= 3. PROFORMA =========
  html += '<h2 style="border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px;">Estados financieros Proforma</h2>';

  var erPro = document.querySelector('#proformaEstadoResultados table');
  var bgPro = document.querySelector('#proformaBalanceGeneral table');
  var fePro = document.querySelector('#proformaFlujoEfectivo table');

  if (erPro && erPro.tBodies[0].rows.length) {
    html += '<h3>3.1 Estado de Resultados Proforma</h3>' + erPro.outerHTML;
  }
  if (bgPro && bgPro.tBodies[0].rows.length) {
    html += '<h3>3.2 Balance General Proforma</h3>' + bgPro.outerHTML;
  }
  if (fePro && fePro.tBodies[0].rows.length) {
    html += '<h3>3.3 Flujo de Efectivo Proforma</h3>' + fePro.outerHTML;
  }

  // ========= 4. GRÁFICOS =========
  html += '<h2 style="border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px;">Gráficos principales</h2>';
  html += finbotCanvasImgHtml('chartAHBG', 'Análisis horizontal/vertical (BG / ER)');
  html += finbotCanvasImgHtml('chartAHER', 'Análisis horizontal ER (detalle)');
  html += finbotCanvasImgHtml('chartAVBG', 'Análisis vertical BG');
  html += finbotCanvasImgHtml('chartRazones', 'Razones financieras comparadas');
  html += finbotCanvasImgHtml('chartCNTCNO', 'CNT y CNO');
  html += finbotCanvasImgHtml('chartEOAF', 'EOAF');
  html += finbotCanvasImgHtml('chartEFE', 'Estado de Flujo de Efectivo');
  html += finbotCanvasImgHtml('chartDup', 'Modelo DuPont');

  return html;
}*/



// Add this function to your app.js
function verReporteHtml() {
  try {
    const S = finbotGetState();
    if (!S || !S.periodos) {
      throw new Error('No hay datos cargados para mostrar.');
    }

    // Create a new window for the report
    const win = window.open('', '_blank');
    if (!win) {
      throw new Error('No se pudo abrir la ventana de vista previa. Asegúrese de permitir ventanas emergentes para este sitio.');
    }

    // Generate HTML content
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe Financiero - ${S.empresa || 'Empresa'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: #2c3e50; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .section { margin-bottom: 30px; }
          .header { 
            text-align: center; 
            padding: 20px; 
            background-color: #f8f9fa; 
            margin-bottom: 20px; 
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Informe Financiero</h1>
          <h2>${S.empresa || 'Empresa no especificada'}</h2>
          <p>Generado el ${new Date().toLocaleDateString()}</p>
        </div>

        <!-- Datos Generales -->
        <div class="section">
          <h2>1. Datos Generales</h2>
          <table>
            <tr><th>Empresa</th><td>${S.empresa || 'No especificada'}</td></tr>
            <tr><th>Periodo Activo</th><td>${S.periodoActivo || 'No especificado'}</td></tr>
            <tr><th>Total Periodos</th><td>${Object.keys(S.periodos || {}).length}</td></tr>
          </table>
        </div>

        <!-- Aquí puedes agregar más secciones según sea necesario -->
        
        <script>
          // Código JavaScript adicional si es necesario
          console.log('Vista previa del informe generada correctamente');
        </script>
      </body>
      </html>
    `;

    // Write the HTML to the new window
    win.document.open();
    win.document.write(html);
    win.document.close();
    
  } catch (error) {
    console.error('Error al generar la vista previa HTML:', error);
    alert('Error al generar la vista previa: ' + error.message);
  }
}

//AQUI INICIA
// Add this at the top of your app.js
window.addEventListener('error', function(event) {
  console.error('Error global detectado:', event.error);
  alert('Se produjo un error: ' + event.message);
  return false;
});

// Add proper error handling to your export functions
function finbotExportEmpresaJson() {
  try {
    // Your existing JSON export code
    const S = finbotGetState();
    if (!S) {
      throw new Error('No hay datos cargados para exportar.');
    }
    // ... rest of your JSON export code
  } catch (error) {
    console.error('Error en finbotExportEmpresaJson:', error);
    alert('Error al exportar a JSON: ' + error.message);
  }
}

function finbotExportEmpresaExcel() {
  try {
    // Your existing Excel export code
    if (typeof XLSX === 'undefined') {
      throw new Error('La biblioteca de Excel no se cargó correctamente. Por favor, recargue la página.');
    }
    // ... rest of your Excel export code
  } catch (error) {
    console.error('Error en finbotExportEmpresaExcel:', error);
    alert('Error al exportar a Excel: ' + error.message);
  }
} //AQUI FINALIZA

//INICIA
// Check if required libraries are loaded
function checkLibraries() {
  const errors = [];
  if (typeof XLSX === 'undefined') {
    errors.push('La biblioteca de Excel (XLSX) no está cargada correctamente.');
  }
  if (typeof jspdf === 'undefined') {
    errors.push('La biblioteca de PDF (jsPDF) no está cargada correctamente.');
  }
  return errors;
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
  // Check libraries
  const libErrors = checkLibraries();
  if (libErrors.length > 0) {
    console.error('Error de carga de bibliotecas:', libErrors.join('\n'));
    alert('Error: ' + libErrors.join('\n') + '\n\nPor favor, recargue la página.');
  }

  // Your existing event listeners
  document.getElementById('exportJsonBtn')?.addEventListener('click', finbotExportEmpresaJson);
  document.getElementById('exportExcelBtn')?.addEventListener('click', finbotExportEmpresaExcel);
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportReporteCompletoPdf);
  document.getElementById('exportHtmlBtn')?.addEventListener('click', verReporteHtml);
}); //2DA PARTE - 3ERA

  
}

// Prepara AH, EOAF, EFE, razones, DuPont, gráficos, etc. para usar en el reporte
function finbotPrepararAnalisisParaExportar() {
  var S = finbotGetState();
  if (!S || !S.periodos) return;

  var years = Object.keys(S.periodos).sort();
  if (!years.length) return;

  var base = years[0];
  var comp = years[years.length - 1];

  // 1) Periodo activo en la UI
  var periodoActivoSelect = document.getElementById('periodoActivoSelect');
  if (periodoActivoSelect) {
    periodoActivoSelect.value = comp;
    periodoActivoSelect.dispatchEvent(new Event('change'));
  }

  // 2) Análisis Horizontal
  var ahBaseSelect = document.getElementById('ahBaseSelect');
  var ahCompSelect = document.getElementById('ahCompSelect');
  if (ahBaseSelect && ahCompSelect) {
    ahBaseSelect.value = base;
    ahCompSelect.value = comp;
  }
  var ahBtn = document.getElementById('calcAhBtn');
  if (ahBtn) ahBtn.click();

  // 3) EOAF
  var eoafBaseSelect = document.getElementById('eoafBaseSelect');
  var eoafCompSelect = document.getElementById('eoafCompSelect');
  if (eoafBaseSelect && eoafCompSelect) {
    eoafBaseSelect.value = base;
    eoafCompSelect.value = comp;
  }
  var eoafBtn = document.getElementById('calcEoafBtn');
  if (eoafBtn) eoafBtn.click();

  // 4) EFE
  var efeBaseSelect = document.getElementById('efeBaseSelect');
  var efeCompSelect = document.getElementById('efeCompSelect');
  if (efeBaseSelect && efeCompSelect) {
    efeBaseSelect.value = base;
    efeCompSelect.value = comp;
  }
  var efeBtn = document.getElementById('calcEfeBtn');
  if (efeBtn) efeBtn.click();

  // 5) Razones, CNT/CNO y DuPont para TODOS los periodos
  var razonesSel = document.getElementById('razonesPeriodoSelect');
  var cntSel = document.getElementById('cntcnoPeriodoSelect');
  var dupSel = document.getElementById('dupPeriodoSelect');

  years.forEach(function (y) {
    if (razonesSel) {
      razonesSel.value = y;
      razonesSel.dispatchEvent(new Event('change'));
    }
    if (cntSel) {
      cntSel.value = y;
      cntSel.dispatchEvent(new Event('change'));
    }
    if (dupSel) {
      dupSel.value = y;
      dupSel.dispatchEvent(new Event('change'));
    }
  });

  // 6) Gráficos
  var grafBtn = document.getElementById('grafRenderAllBtn');
  if (grafBtn) grafBtn.click();
}

