//APRENDE DIFE JS

// =========================
// Utilidades comunes
// =========================
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

// Sonido global (persistente)
let MUTE = (localStorage.getItem('finbot:sound')||'on') === 'off';

function setMute(v){
  MUTE = !!v;
  localStorage.setItem('finbot:sound', v ? 'off' : 'on');
}

const SFX = (function(){
  let ac;
  function ctx(){ return ac||(ac=new (window.AudioContext||window.webkitAudioContext)()); }
  function beep(f=880,d=.1,t='sine',g=.08){
    if(MUTE) return;
    const a=ctx(),o=a.createOscillator(),gn=a.createGain();
    o.type=t; o.frequency.value=f;
    gn.gain.value=g;
    o.connect(gn); gn.connect(a.destination);
    o.start(); o.stop(a.currentTime+d);
  }
  return {
    ok:  ()=>beep(920,.12,'triangle',.08),
    bad: ()=>beep(220,.16,'sawtooth',.06),
    tick:()=>beep(660,.06,'square',.04)
  };
})();

// =========================
// UI comunes
// =========================
function updateToggleButton(el){
  if(!el) return;
  const label = el.querySelector('.label') || el;
  label.textContent = 'Sonido: ' + (MUTE ? 'OFF' : 'ON');
  el.setAttribute('aria-pressed', String(!MUTE));
}

function bindSoundToggle(sel){
  const b=$(sel);
  if(!b) return;
  updateToggleButton(b);
  b.addEventListener('click',()=>{
    setMute(!MUTE);
    updateToggleButton(b);
  });
}

function setBar(sel, pct){
  const el=$(sel);
  if(el){
    el.style.width = Math.max(0,Math.min(100,pct||0))+'%';
  }
}

function rankGet(key){
  try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch{ return []; }
}
function rankSet(key, arr){
  try{ localStorage.setItem(key, JSON.stringify(arr.slice(0,5))); }catch{}
}

// Progresión entre juegos (gating desactivado)
function gateUpdate(){
  const btnV=$('#vocab_start');
  const btnE=$('#eoaf_start');
  const stV=$('#vocab_status');
  const stE=$('#eoaf_status');

  if(btnV){ btnV.disabled=false; btnV.title=''; }
  if(stV){ stV.textContent='Presiona "Iniciar" para comenzar.'; }

  if(btnE){ btnE.disabled=false; btnE.title=''; }
  if(stE){ stE.textContent='Clasifica cada ítem como Origen o Aplicación. Presiona "Iniciar".'; }
}
window.addEventListener('load', gateUpdate);

// =========================
// Fondo animado: partículas
// =========================
(function(){
  const cv=document.getElementById('bg_fin_particles'); if(!cv) return;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LS_BG='finbot:bg:particles';
  const ov = (localStorage.getItem(LS_BG)||'').toLowerCase();
  if(prefersReduced && ov!=='on') return;

  const ctx=cv.getContext('2d');
  let W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
  const glyphs=['💵','📈','📊','🪙','💹'];
  let particles=[]; let running=true; let lastT=0; let targetCount=0; let req;

  function resize(){
    W=window.innerWidth;
    H=window.innerHeight;
    DPR=Math.min(2,window.devicePixelRatio||1);
    cv.width=W*DPR; cv.height=H*DPR;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    targetCount = Math.max(14, Math.min(48, Math.floor(W/40)));
  }

  function rand(a,b){ return a+Math.random()*(b-a); }

  function spawn(){
    const g=glyphs[(Math.random()*glyphs.length)|0];
    const base=rand(16,28);
    return {
      g,
      x:rand(-20,W+20),
      y:rand(-H*0.25,-20),
      vy:rand(30,70),
      vx:rand(-12,12),
      rot:rand(-10,10),
      a:rand(.5,.95),
      size:base,
      sway:rand(.6,1.8),
      phase:rand(0,Math.PI*2)
    };
  }

  function ensure(){
    while(particles.length<targetCount) particles.push(spawn());
    if(particles.length>targetCount) particles.length=targetCount;
  }

  function step(ts){
    if(!running) return;
    const dt=Math.min(0.05,(ts-lastT)/1000||0.016);
    lastT=ts;
    ensure();
    ctx.clearRect(0,0,W,H);

    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      p.phase+=dt*p.sway;
      const wind=Math.sin(p.phase)*8;
      p.x += (p.vx*dt) + wind*dt;
      p.y += p.vy*dt;
      p.rot += 8*dt;

      if(p.y-40>H){
        particles[i]=spawn();
        particles[i].y=-rand(20,120);
        particles[i].x=rand(-20,W+20);
        continue;
      }
      ctx.save();
      ctx.globalAlpha=p.a;
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.font=`${p.size}px "Segoe UI Emoji","Apple Color Emoji",system-ui,sans-serif`;
      ctx.fillText(p.g,0,0);
      ctx.restore();
    }
    req=requestAnimationFrame(step);
  }

  resize();
  window.addEventListener('resize',resize);

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      running=false; cancelAnimationFrame(req);
    }else{
      running=true; lastT=0; req=requestAnimationFrame(step);
    }
  });
  window.addEventListener('blur',()=>{
    running=false; cancelAnimationFrame(req);
  });
  window.addEventListener('focus',()=>{
    if(!running){
      running=true; lastT=0; req=requestAnimationFrame(step);
    }
  });

  req=requestAnimationFrame(step);
})();

// =========================
// FLASHCARDS
// =========================
(function(){
  const startBtn = $('#flash_start'); if(!startBtn) return;
  const retryBtn = $('#flash_retry');
  const board   = $('#flash_board');
  const status  = $('#flash_status');
  const flashRoot = board ? board.closest('.card') : null;

  bindSoundToggle('#sound_toggle');

  const hudS=$('#hud_score'), hudC=$('#hud_combo'),
        hudT=$('#hud_time'),  hudP=$('#hud_prog'),
        hudRank=$('#hud_rank');

  const LSKEY='finbot:rank:flash:v1';

  const pool=[
    {q:'Razón Corriente', a:'Activo Corriente / Pasivo Corriente', opts:[
      'Activo Corriente / Pasivo Corriente',
      'Activo Corriente menos Inventarios / Pasivo Corriente',
      'Utilidad Neta / Ventas'
    ]},
    {q:'Prueba Ácida (Razón Rápida)', a:'Activo Corriente menos Inventarios / Pasivo Corriente', opts:[
      'Activo Corriente menos Inventarios / Pasivo Corriente',
      'Activo Corriente / Pasivo Corriente',
      'Ventas / Activo Total promedio'
    ]},
    {q:'Margen Bruto', a:'Utilidad Bruta / Ventas', opts:[
      'Utilidad Bruta / Ventas',
      'Utilidad Operativa / Ventas',
      'Utilidad Neta / Ventas'
    ]},
    {q:'Margen Operativo', a:'Utilidad Operativa / Ventas', opts:[
      'Utilidad Operativa / Ventas',
      'Utilidad Bruta / Ventas',
      'Utilidad Neta / Ventas'
    ]},
    {q:'Margen Neto', a:'Utilidad Neta / Ventas', opts:[
      'Utilidad Neta / Ventas',
      'Utilidad Operativa / Ventas',
      'Utilidad Bruta / Ventas'
    ]},
    {q:'Rotación del Activo Total', a:'Ventas / Activo Total promedio', opts:[
      'Ventas / Activo Total promedio',
      'Costo de Ventas / Inventario promedio',
      'Utilidad Neta / Activo Total'
    ]},
    {q:'ROA (Rendimiento sobre Activos)', a:'Utilidad Neta / Activo Total', opts:[
      'Utilidad Neta / Activo Total',
      'Utilidad Operativa / Gastos por Intereses',
      '(Pasivo Corriente + Pasivo No Corriente) / Activo Total'
    ]},
    {q:'Cobertura de Intereses', a:'Utilidad Operativa / Gastos por Intereses', opts:[
      'Utilidad Operativa / Gastos por Intereses',
      'Costo de Ventas / Inventario promedio',
      'Ventas / Activo Total promedio'
    ]},
    {q:'Índice de Endeudamiento', a:'(Pasivo Corriente + Pasivo No Corriente) / Activo Total', opts:[
      '(Pasivo Corriente + Pasivo No Corriente) / Activo Total',
      'Activo Corriente / Pasivo Corriente',
      'Activo Corriente menos Inventarios / Pasivo Corriente'
    ]},
    {q:'Periodo Promedio de Cobro (PPC)', a:'360 / Rotación de Cuentas por Cobrar', opts:[
      '360 / Rotación de Cuentas por Cobrar',
      'Ventas / Activo Total promedio',
      'Costo de Ventas / Inventario promedio'
    ]}
  ];

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function renderRank(){
    const r=rankGet(LSKEY);
    if(!hudRank) return;
    hudRank.innerHTML='';
    r.forEach((it,i)=>{
      const li=document.createElement('li');
      li.textContent=`${i+1}. ${it.name} — ${it.score}`;
      hudRank.appendChild(li);
    });
  }

  let qs=[], idx=0, score=0, combo=0, timer=null, tLeft=0, locked=false;

  function setHUD(){
    if(hudS) hudS.textContent=String(score||0);
    if(hudC) hudC.textContent=combo+'x';
    if(hudT) hudT.textContent=(tLeft||0)+'s';
    if(hudP) hudP.textContent=(idx)+'/'+(qs.length||10);
    setBar('#flash_bar',(idx/Math.max(1,qs.length))*100);
  }

  function tick(){
    tLeft--;
    if(hudT) hudT.textContent=(tLeft||0)+'s';
    if(tLeft<=0){
      choose(null);
    }else if(tLeft<=3){
      SFX.tick();
    }
  }

  function start(){
    score=0; combo=0; idx=0;
    qs = shuffle(pool.slice()).slice(0,10).map((x,i)=>({
      ...x,
      id:i+1,
      opts:shuffle(x.opts.slice())
    }));
    locked=false;
    board.innerHTML='';
    status.textContent='';
    startBtn.style.display='none';
    retryBtn.style.display='none';
    setBar('#flash_bar',0);
    next();
  }

  function end(){
    clearInterval(timer);
    status.innerHTML=`Fin del juego. Puntaje: <strong>${score}</strong>`;
    retryBtn.style.display='inline-block';
    setBar('#flash_bar',100);

    if(score<=0) return; // no guarda ranking si no hay puntos

    const raw = prompt('Guardar en ranking (alias):','Yo');
    const name = raw && raw.trim();
    if(name){
      const r=rankGet(LSKEY);
      r.push({name,score,ts:Date.now()});
      r.sort((a,b)=>b.score-a.score);
      rankSet(LSKEY,r);
      renderRank();
    }
  }

  function next(){
    if(idx>=qs.length) return end();
    const q=qs[idx];
    if(hudP) hudP.textContent=idx+'/'+qs.length;
    setBar('#flash_bar',(idx/qs.length)*100);

    board.innerHTML=`<div class="q"><strong>${q.q}</strong></div>`;
    const opts=document.createElement('div');
    opts.className='opts';

    q.opts.forEach((opt,i)=>{
      const b=document.createElement('button');
      b.className='btn';
      b.textContent=opt;
      b.setAttribute('data-k',String(i+1));
      b.addEventListener('click',()=>choose(opt));
      opts.appendChild(b);
    });

    board.appendChild(opts);
    tLeft=10;
    setHUD();
    clearInterval(timer);
    timer=setInterval(tick,1000);
  }

  function choose(opt){
    if(locked) return;
    locked=true;
    clearInterval(timer);

    const q=qs[idx];
    const ok = q ? (opt===q.a) : false;

    const delta = ok
      ? 10 + (tLeft>=6?2:0) + Math.max(0,combo)
      : -3;

    score += delta;
    combo = ok ? combo+1 : 0;
    setHUD();

    status.innerHTML = ok
      ? `¡Correcto! <span class="pill">+${delta}</span>`
      : `Incorrecto. Respuesta: <span class="pill">${q ? q.a : ''}</span>`;

    (ok?SFX.ok:SFX.bad)();

    if(flashRoot){
      flashRoot.classList.remove('ok','bad');
      void flashRoot.offsetWidth;
      flashRoot.classList.add(ok?'ok':'bad');
    }

    idx++;
    setTimeout(()=>{ locked=false; next(); },520);
  }

  document.addEventListener('keydown',(e)=>{
    if(e.key>='1'&&e.key<='3'){
      const btn=board.querySelector(`[data-k="${e.key}"]`);
      if(btn) btn.click();
    }
    if(e.key==='r'||e.key==='R'){
      if(retryBtn.style.display!=='none') retryBtn.click();
    }
  });

  renderRank();
  startBtn.addEventListener('click', start);
  retryBtn.addEventListener('click', start);
})();

// =========================
// VOCABULARIO
// =========================
(function(){
  const root=$('#game_vocab'); if(!root) return;

  const start=$('#vocab_start'), retry=$('#vocab_retry'),
        submit=$('#vocab_submit'), hintBtn=$('#vocab_hint');
  const status=$('#vocab_status'), defEl=$('#vocab_def'),
        ans=$('#vocab_answer'), prog=$('#vocab_prog'),
        comboEl=$('#vocab_combo'), scoreEl=$('#vocab_score');

  bindSoundToggle('#sound_toggle_2');

  const barSel='#vocab_bar';
  const LSKEY='finbot:rank:vocab:v1';

  const POOL=[
    {t:'Activo Corriente', d:'Bienes y derechos que se convierten en efectivo en menos de un año.', alt:['Activos Corrientes']},
    {t:'Pasivo Corriente', d:'Obligaciones exigibles en menos de un año.'},
    {t:'Capital Contable', d:'Aportaciones de socios y utilidades retenidas.'},
    {t:'Margen Bruto', d:'Relación entre la utilidad bruta y las ventas.'},
    {t:'Margen Operativo', d:'Relación entre la utilidad operativa y las ventas.'},
    {t:'Margen Neto', d:'Relación entre la utilidad neta y las ventas.'},
    {t:'Razón Corriente', d:'Índice de liquidez que compara activo corriente con pasivo corriente.', alt:['Ratio Corriente']},
    {t:'Prueba Ácida', d:'Índice de liquidez estricta que excluye inventarios.', alt:['Razón Rápida','Prueba Acida']},
    {t:'Ciclo de Efectivo', d:'Tiempo entre el desembolso de efectivo para inventarios y su recuperación por ventas.'},
    {t:'Rotación de Inventarios', d:'Veces que el inventario se vende y repone en un periodo.'},
    {t:'ROA', d:'Rentabilidad sobre activos (UN/AT).'},
    {t:'ROE', d:'Rentabilidad del capital (UN/CC).'}
  ];

  function norm(s){
    return (s||'').toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function eq(a,b){ return norm(a)===norm(b); }

  function okAns(inp,it){
    if(eq(inp,it.t)) return true;
    if(it.alt) return it.alt.some(x=>eq(inp,x));
    return false;
  }

  let list=[], idx=0, score=0, combo=0, hintIdx=0;

  function setHUD(){
    prog.textContent=`${idx}/${list.length||12}`;
    comboEl.textContent=combo+'x';
    scoreEl.textContent=(score||0)+' pts';
    setBar(barSel,(idx/Math.max(1,list.length))*100);
  }

  function show(){
    const it=list[idx];
    defEl.textContent=it?it.d:'—';
    ans.value='';
    ans.focus();
    submit.disabled=true;
    hintIdx=0;
    if(hintBtn) hintBtn.disabled=false;
  }

  function startGame(){
    list = POOL.slice().sort(()=>Math.random()-0.5).slice(0,12);
    idx=0; score=0; combo=0;
    status.textContent='';
    start.style.display='none';
    retry.style.display='none';
    setBar(barSel,0);
    show();
    setHUD();
  }

  function renderRank(){
    const el=$('#vocab_rank'); if(!el) return;
    const r=rankGet(LSKEY);
    el.innerHTML='';
    r.forEach((it,i)=>{
      const li=document.createElement('li');
      li.textContent=`${i+1}. ${it.name} — ${it.score}`;
      el.appendChild(li);
    });
  }

  function endGame(){
    status.innerHTML=`Fin. Puntaje: <strong>${score}</strong>`;
    retry.style.display='inline-block';
    setBar(barSel,100);

    if(score<=0) return;
    const raw = prompt('Guardar en ranking (alias):','Yo');
    const name = raw && raw.trim();
    if(name){
      const r=rankGet(LSKEY);
      r.push({name,score,ts:Date.now()});
      r.sort((a,b)=>b.score-a.score);
      rankSet(LSKEY,r);
      renderRank();
    }
  }

  function submitAns(){
    const it=list[idx];
    const val=ans.value;
    const ok=okAns(val,it);
    const base=ok?10:-4;
    const bonus=ok?Math.min(5,Math.floor((it.t.length-hintIdx)/3)):0;

    score += base + (ok?combo:0) + bonus;
    combo = ok ? combo+1 : 0;

    (ok?SFX.ok:SFX.bad)();

    if(root){
      root.classList.remove('ok','bad');
      void root.offsetWidth;
      root.classList.add(ok?'ok':'bad');
    }

    status.innerHTML = ok
      ? `¡Correcto! <span class="pill">+${base+(ok?combo:0)+bonus}</span> — ${it.t}`
      : `Incorrecto. Era: <strong>${it.t}</strong>`;

    idx++;
    if(idx>=list.length){
      endGame();
    }else{
      setHUD();
      setTimeout(show,520);
    }
  }

  function hint(){
    const it=list[idx];
    if(!it) return;
    hintIdx=Math.min(it.t.length,hintIdx+2);
    const prefix=it.t.slice(0,hintIdx);
    status.innerHTML=`Pista: <strong>${prefix}</strong>`;
    ans.value=prefix;
    submit.disabled=!ans.value.trim();
    SFX.tick();
    ans.focus();
    try{ ans.setSelectionRange(ans.value.length, ans.value.length); }catch{}
  }

  ans.addEventListener('input',()=>{ submit.disabled=!ans.value.trim(); });
  ans.addEventListener('keydown',(e)=>{
    if(e.key==='Enter' && !submit.disabled){
      e.preventDefault();
      submitAns();
    }
  });

  submit.addEventListener('click', submitAns);
  if(hintBtn) hintBtn.addEventListener('click', hint);
  start.addEventListener('click', startGame);
  retry.addEventListener('click', startGame);

  renderRank();
})();

// =========================
// EOAF Sorter
// =========================
(function(){
  const start=$('#eoaf_start'); if(!start) return;
  const retry=$('#eoaf_retry'), status=$('#eoaf_status');
  const itemEl=$('#eoaf_item');
  const bO=$('#eoaf_btn_origen'), bA=$('#eoaf_btn_aplicacion');
  const root=$('#game_eoaf');

  bindSoundToggle('#sound_toggle_3');

  const barSel='#eoaf_bar';
  const LSKEY='finbot:rank:eoaf:v1';

  const items=[
    {t:'Aumento de Cuentas por Cobrar por venta a crédito', bin:'Origen'},
    {t:'Disminución de Efectivo por pago de deuda', bin:'Aplicación'},
    {t:'Aumento de Propiedad, Planta y Equipo por compra', bin:'Aplicación'},
    {t:'Disminución de Pasivo Corriente por pago a proveedores', bin:'Aplicación'},
    {t:'Aumento de Pasivo No Corriente por nuevo préstamo', bin:'Origen'},
    {t:'Aumento de Inventarios por compra', bin:'Aplicación'},
    {t:'Disminución de Cuentas por Cobrar por cobro', bin:'Origen'},
    {t:'Aumento de Capital por aporte de socios', bin:'Origen'}
  ];

  let list=[], idx=0, score=0;

  function setHUD(){
    setBar(barSel,(idx/Math.max(1,list.length))*100);
  }

  function show(){
    const it=list[idx];
    itemEl.textContent=it?it.t:'—';
  }

  function renderRank(){
    const el=$('#eoaf_rank'); if(!el) return;
    const r=rankGet(LSKEY);
    el.innerHTML='';
    r.forEach((it,i)=>{
      const li=document.createElement('li');
      li.textContent=`${i+1}. ${it.name} — ${it.score}`;
      el.appendChild(li);
    });
  }

  function startGame(){
    list=items.slice().sort(()=>Math.random()-0.5);
    idx=0; score=0;
    status.textContent='';
    start.style.display='none';
    retry.style.display='none';
    setBar(barSel,0);
    show();
    setHUD();
  }

  function endGame(){
    status.innerHTML=`Fin del juego. Puntaje: <strong>${score}</strong>`;
    retry.style.display='inline-block';
    setBar(barSel,100);

    if(score<=0) return;
    const raw = prompt('Guardar en ranking (alias):','Yo');
    const name = raw && raw.trim();
    if(name){
      const r=rankGet(LSKEY);
      r.push({name,score,ts:Date.now()});
      r.sort((a,b)=>b.score-a.score);
      rankSet(LSKEY,r);
      renderRank();
    }
  }

  function choose(bin){
    const it=list[idx];
    const ok = (bin===it.bin);
    score += ok ? 10 : -5;

    (ok?SFX.ok:SFX.bad)();

    if(root){
      root.classList.remove('ok','bad');
      void root.offsetWidth;
      root.classList.add(ok?'ok':'bad');
    }

    status.innerHTML = ok
      ? `¡Correcto! <span class="pill">+10</span>`
      : `Incorrecto. Era: <strong>${it.bin}</strong>`;

    idx++;
    if(idx>=list.length){
      endGame();
    }else{
      setHUD();
      show();
    }
  }

  bO.addEventListener('click', ()=>choose('Origen'));
  bA.addEventListener('click', ()=>choose('Aplicación'));

  start.addEventListener('click', startGame);
  retry.addEventListener('click', startGame);
  renderRank();
})();
