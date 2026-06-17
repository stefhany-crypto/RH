function resetarFiltrosRel(){['relAno','relAno2','relTri','relEquipe','relPessoa'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});renderRelatorios();}
function getAvalsRelFiltradas(){
    const ano=document.getElementById('relAno')?.value||'',tri=document.getElementById('relTri')?.value||'',equipe=document.getElementById('relEquipe')?.value||'',pessoa=document.getElementById('relPessoa')?.value||'';
    // Começa pelas avaliações visíveis para o usuário
    return avalsVisiveis().filter(a=>{
        if(ano&&a.ano!==parseInt(ano))return false;
        if(tri&&String(a.trimestre)!==tri)return false;
        const t=talentos.find(ta=>ta.id===a.colaboradorId);
        if(equipe&&(!t||t.equipe!==equipe))return false;
        if(pessoa&&a.colaboradorId!==pessoa)return false;
        return true;
    });
}
function destroyChart(key){if(charts[key]){try{charts[key].destroy();}catch(e){}charts[key]=null;}}
function mkFiltrosOpts(){
    const anos=[...new Set(avalsVisiveis().map(a=>a.ano).filter(Boolean))].sort((a,b)=>b-a);
    const anoOpts='<option value="">Todos os Anos</option>'+anos.map(a=>`<option value="${a}">${a}</option>`).join('');
    const anoOpts2='<option value="">Nenhum</option>'+anos.map(a=>`<option value="${a}">${a}</option>`).join('');
    const triOpts='<option value="">Todos</option><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>';
    const eqVis=P.isRH()?equipes:equipes.filter(e=>e.nome===user.equipe);
    const eqOpts='<option value="">Todas</option>'+eqVis.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    const psVis=P.isRH()?talentos:P.isLider()?talentos.filter(t=>t.equipe===user.equipe||t.id===user.id):[{id:user.id,nome:user.nome}];
    const pessoaOpts='<option value="">Todas</option>'+psVis.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    return{anoOpts,anoOpts2,triOpts,eqOpts,pessoaOpts};
}
function filtrarAvals(ano,tri,equipe,pessoa){
    return avalsVisiveis().filter(a=>{
        if(ano&&a.ano!==parseInt(ano))return false;
        if(tri&&String(a.trimestre)!==tri)return false;
        const t=talentos.find(ta=>ta.id===a.colaboradorId);
        if(equipe&&(!t||t.equipe!==equipe))return false;
        if(pessoa&&a.colaboradorId!==pessoa)return false;
        return true;
    });
}
function mkSel(id,opts,label,cb){return `<select id="${id}" title="${label}" onchange="${cb}" style="padding:0.2rem 0.4rem;border:1px solid #E0E4E6;border-radius:5px;font-family:'DM Sans',sans-serif;font-size:0.72rem;color:#1A2E38;background:#F5F2ED;cursor:pointer;outline:none;height:26px;max-width:115px;">${opts}</select>`;}

function renderRelatorios(){
    if(!P.verRelatorios())return;
    const avals=getAvalsRelFiltradas();
    const{anoOpts,anoOpts2,triOpts,eqOpts,pessoaOpts}=mkFiltrosOpts();
    const statsDiv=document.getElementById('relStats');
    if(statsDiv){const media=avals.length?avals.reduce((s,a)=>s+a.notaFinal,0)/avals.length:0;const acima80=avals.filter(a=>a.notaFinal>=80).length;const tb=avals.reduce((acc,a)=>{const t=talentos.find(ta=>ta.id===a.colaboradorId);if(!t)return acc;return acc+calcularValorBonus(getMultiplicadorVigente(t.equipe,a.trimestre,a.ano),t.salario||0,a.bonusPercent);},0);const eq=new Set(avals.map(a=>talentos.find(ta=>ta.id===a.colaboradorId)?.equipe).filter(Boolean)).size;statsDiv.innerHTML=`<div class="stat-card"><div class="stat-label">Avaliações</div><div class="stat-value">${avals.length}</div></div><div class="stat-card"><div class="stat-label">Nota Média</div><div class="stat-value" style="color:var(--mirae-teal);">${media.toFixed(1)}</div></div><div class="stat-card"><div class="stat-label">Acima de 80</div><div class="stat-value" style="color:#2E7D32;">${acima80} <small style="font-size:0.8rem;">(${avals.length?Math.round(acima80/avals.length*100):0}%)</small></div></div>${P.verBonus()?`<div class="stat-card"><div class="stat-label">Total Bônus</div><div class="stat-value" style="font-size:1.1rem;color:#2E7D32;">R$ ${tb.toLocaleString('pt-BR',{maximumFractionDigits:0})}</div></div>`:''}<div class="stat-card"><div class="stat-label">Equipes</div><div class="stat-value">${eq}</div></div>`;}
    const container=document.getElementById('chartsContainer');if(!container)return;container.innerHTML='';

    const c1=document.createElement('div');c1.className='chart-card';c1.innerHTML=`<h4>Performance por Equipe</h4><div class="chart-filters">${mkSel('cf1Ano',anoOpts,'Ano','renderChart1()')}${mkSel('cf1Tri',triOpts,'Trimestre','renderChart1()')}${mkSel('cf1Eq',eqOpts,'Equipe','renderChart1()')}</div><div style="height:260px;"><canvas id="chartEquipe"></canvas></div>`;container.appendChild(c1);
    const c2=document.createElement('div');c2.className='chart-card';c2.innerHTML=`<h4>Evolução por Trimestre</h4><div class="chart-filters">${mkSel('cf2Ano',anoOpts,'Ano','renderChart2()')}${mkSel('cf2Ano2',anoOpts2,'Comparar','renderChart2()')}${mkSel('cf2Eq',eqOpts,'Equipe','renderChart2()')}${mkSel('cf2Pessoa',pessoaOpts,'Pessoa','renderChart2()')}</div><div style="height:260px;"><canvas id="chartEvolucao"></canvas></div>`;container.appendChild(c2);
    const c3=document.createElement('div');c3.className='chart-card';c3.innerHTML=`<h4>Distribuição das Notas</h4><div class="chart-filters">${mkSel('cf3Ano',anoOpts,'Ano','renderChart3()')}${mkSel('cf3Tri',triOpts,'Trimestre','renderChart3()')}${mkSel('cf3Eq',eqOpts,'Equipe','renderChart3()')}</div><div style="height:260px;"><canvas id="chartDist"></canvas></div>`;container.appendChild(c3);
    const c4=document.createElement('div');c4.className='chart-card';c4.innerHTML=`<h4>Radar de Competências</h4><div class="chart-filters">${mkSel('cf4Ano',anoOpts,'Ano','renderChart4()')}${mkSel('cf4Tri',triOpts,'Trimestre','renderChart4()')}${mkSel('cf4Eq',eqOpts,'Equipe','renderChart4()')}${mkSel('cf4Pessoa',pessoaOpts,'Pessoa','renderChart4()')}</div><div style="height:260px;"><canvas id="chartRadar"></canvas></div>`;container.appendChild(c4);
    const c5=document.createElement('div');c5.className='chart-card full';c5.innerHTML=`<h4>Comparativo de Anos</h4><div class="chart-filters">${mkSel('cf5Ano',anoOpts,'Ano','renderChart5()')}${mkSel('cf5Ano2',anoOpts2,'Comparar','renderChart5()')}${mkSel('cf5Eq',eqOpts,'Equipe','renderChart5()')}</div><div style="height:280px;"><canvas id="chartComp"></canvas></div>`;container.appendChild(c5);

    setTimeout(()=>{renderChart1();renderChart2();renderChart3();renderChart4();renderChart5();},80);
    renderRanking(avals);

    const pessoa=document.getElementById('relPessoa')?.value||'';
    const evC=document.getElementById('evolucaoIndividualContainer'),evT=document.getElementById('evolucaoTitulo');
    if(pessoa&&evC){evC.style.display='block';const t=talentos.find(ta=>ta.id===pessoa);if(evT)evT.textContent=`Evolução de ${t?.nome||'Colaborador'}`;const pAvs=[...avals].sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.trimestre-b.trimestre);destroyChart('evInd');setTimeout(()=>{const cv=document.getElementById('evolucaoChart');if(!cv)return;charts.evInd=new Chart(cv.getContext('2d'),{type:'line',data:{labels:pAvs.map(a=>`Q${a.trimestre}/${a.ano}`),datasets:[{label:'Nota',data:pAvs.map(a=>a.notaFinal),borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.1)',tension:0.4,fill:true,pointBackgroundColor:pAvs.map(a=>a.notaFinal>=80?'#2E7D32':a.notaFinal>=70?'#E1B87F':'#C62828'),pointRadius:7}]},options:{maintainAspectRatio:false,scales:{y:{min:0,max:110}},plugins:{tooltip:{callbacks:{afterLabel:ctx=>`Bônus: ${pAvs[ctx.dataIndex]?.bonusPercent||0}%`}}}}});},100);}else if(evC)evC.style.display='none';
}

function renderChart1(){const ano=document.getElementById('cf1Ano')?.value||'',tri=document.getElementById('cf1Tri')?.value||'',eq=document.getElementById('cf1Eq')?.value||'';const av=filtrarAvals(ano,tri,eq,'');const eqMap={};av.forEach(a=>{const t=talentos.find(ta=>ta.id===a.colaboradorId);if(!t)return;if(!eqMap[t.equipe])eqMap[t.equipe]=[];eqMap[t.equipe].push(a.notaFinal);});const eqL=Object.keys(eqMap),eqD=eqL.map(e=>eqMap[e].reduce((s,v)=>s+v,0)/eqMap[e].length);destroyChart('eq');const cv=document.getElementById('chartEquipe');if(!cv)return;charts.eq=new Chart(cv.getContext('2d'),{type:'bar',data:{labels:eqL.length?eqL:['Sem dados'],datasets:[{label:'Média',data:eqD.length?eqD:[0],backgroundColor:eqL.map((_,i)=>['#1E7D90','#E1B87F','#446974','#214957','#5BA4AF'][i%5]),borderRadius:6}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:110,grid:{color:'#f0f0f0'}}}}});}
function renderChart2(){const ano=document.getElementById('cf2Ano')?.value||'',ano2=document.getElementById('cf2Ano2')?.value||'',eq=document.getElementById('cf2Eq')?.value||'',pessoa=document.getElementById('cf2Pessoa')?.value||'';const anoBase=ano||[...new Set(avalsVisiveis().map(a=>a.ano))].sort().slice(-1)[0]||new Date().getFullYear();const avs1=filtrarAvals(ano,'',eq,pessoa);const getData=(anoF,avs)=>[1,2,3,4].map(q=>{const f=avs.filter(a=>a.trimestre==q&&(anoF?a.ano===parseInt(anoF):true));return f.length?f.reduce((s,a)=>s+a.notaFinal,0)/f.length:null;});const datasets=[{label:`${anoBase}`,data:getData(anoBase,avs1),borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.1)',tension:0.4,fill:true,pointBackgroundColor:'#1E7D90'}];if(ano2){const avs2=filtrarAvals(ano2,'',eq,pessoa);datasets.push({label:`${ano2}`,data:getData(ano2,avs2),borderColor:'#E1B87F',backgroundColor:'rgba(225,184,127,0.1)',tension:0.4,fill:true,pointBackgroundColor:'#E1B87F',borderDash:[5,3]});}destroyChart('ev');const cv=document.getElementById('chartEvolucao');if(!cv)return;charts.ev=new Chart(cv.getContext('2d'),{type:'line',data:{labels:['Q1','Q2','Q3','Q4'],datasets},options:{maintainAspectRatio:false,scales:{y:{min:0,max:110,grid:{color:'#f0f0f0'}}}}});}
function renderChart3(){const ano=document.getElementById('cf3Ano')?.value||'',tri=document.getElementById('cf3Tri')?.value||'',eq=document.getElementById('cf3Eq')?.value||'';const av=filtrarAvals(ano,tri,eq,'');const f={ex:0,hi:0,mi:0,lo:0,cr:0};av.forEach(a=>{if(a.notaFinal>=90)f.ex++;else if(a.notaFinal>=80)f.hi++;else if(a.notaFinal>=70)f.mi++;else if(a.notaFinal>=60)f.lo++;else f.cr++;});destroyChart('dist');const cv=document.getElementById('chartDist');if(!cv)return;charts.dist=new Chart(cv.getContext('2d'),{type:'doughnut',data:{labels:['≥90 Excepcional','80–89 Alto','70–79 Médio','60–69 Baixo','<60 Crítico'],datasets:[{data:Object.values(f),backgroundColor:['#2E7D32','#1E7D90','#E1B87F','#EF6C00','#C62828']}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});}
function renderChart4(){const ano=document.getElementById('cf4Ano')?.value||'',tri=document.getElementById('cf4Tri')?.value||'',eq=document.getElementById('cf4Eq')?.value||'',pessoa=document.getElementById('cf4Pessoa')?.value||'';const av=filtrarAvals(ano,tri,eq,pessoa).filter(a=>a.scores&&a.scores.length>0);destroyChart('rad');const cv=document.getElementById('chartRadar');if(!cv)return;if(!av.length){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.fillStyle='#B7C2C3';ctx.font='13px Open Sans';ctx.textAlign='center';ctx.fillText('Sem dados de competências neste filtro',cv.width/2,cv.height/2);return;}const gScores=PDI_GROUPS.map((g,gi)=>{let start=PDI_GROUPS.slice(0,gi).reduce((s,x)=>s+x.c.length,0);const scores=av.flatMap(a=>(a.scores||[]).slice(start,start+g.c.length));return scores.length?scores.reduce((s,v)=>s+v,0)/scores.length/110*100:0;});charts.rad=new Chart(cv.getContext('2d'),{type:'radar',data:{labels:PDI_GROUPS.map(g=>g.n.split('.')[1]?.trim().split(' ').slice(0,2).join(' ')||g.n.substring(0,12)),datasets:[{label:'Média %',data:gScores,borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.2)',pointBackgroundColor:'#1E7D90'}]},options:{maintainAspectRatio:false,scales:{r:{min:0,max:100,ticks:{display:false}}}}});}
function renderChart5(){const ano=document.getElementById('cf5Ano')?.value||'',ano2=document.getElementById('cf5Ano2')?.value||'',eq=document.getElementById('cf5Eq')?.value||'';destroyChart('comp');const cv=document.getElementById('chartComp');if(!cv)return;if(!ano||!ano2){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.fillStyle='#B7C2C3';ctx.font='14px Open Sans';ctx.textAlign='center';ctx.fillText('Selecione dois anos para comparar',cv.width/2,cv.height/2);return;}const eqVis=eq?[eq]:(P.isRH()?equipes:equipes.filter(e=>e.nome===user.equipe)).map(e=>e.nome);const gm=(eqN,anoF)=>{const f=filtrarAvals(anoF,'',eqN,'');return f.length?f.reduce((s,a)=>s+a.notaFinal,0)/f.length:0;};charts.comp=new Chart(cv.getContext('2d'),{type:'bar',data:{labels:eqVis,datasets:[{label:ano,data:eqVis.map(e=>gm(e,ano)),backgroundColor:'rgba(30,125,144,0.85)',borderRadius:4},{label:ano2,data:eqVis.map(e=>gm(e,ano2)),backgroundColor:'rgba(225,184,127,0.85)',borderRadius:4}]},options:{maintainAspectRatio:false,scales:{y:{min:0,max:110,grid:{color:'#f0f0f0'}}}}});}
function renderRanking(avals){const rankBody=document.getElementById('rankingBody');if(!rankBody)return;const pm={};avals.forEach(a=>{if(!pm[a.colaboradorId])pm[a.colaboradorId]=[];pm[a.colaboradorId].push(a);});const ranking=Object.entries(pm).map(([id,avs])=>{const t=talentos.find(ta=>ta.id===id)||{nome:'Excluído',equipe:'-'};const sorted=[...avs].sort((a,b)=>b.data-a.data);const media=avs.reduce((s,a)=>s+a.notaFinal,0)/avs.length;const melhor=Math.max(...avs.map(a=>a.notaFinal));const ultima=sorted[0].notaFinal;const penultima=sorted[1]?.notaFinal;const trend=penultima===undefined?'—':ultima>penultima?'+':ultima<penultima?'-':'=';return{id,nome:t.nome,equipe:t.equipe,count:avs.length,media,melhor,ultima,trend};}).sort((a,b)=>b.media-a.media);rankBody.innerHTML=ranking.map((r,i)=>`<tr><td><strong style="color:${i===0?'#E1B87F':i===1?'#999':i===2?'#CD7F32':'var(--text-muted)'}">${i===0?'':i===1?'':i===2?'':'#'+(i+1)}</strong></td><td style="font-weight:700;">${esc(r.nome)}</td><td><span class="badge" style="background:#EEE;">${esc(r.equipe)}</span></td><td>${r.count}</td><td><span class="badge ${r.media>=80?'badge-success':'badge-warning'}">${r.media.toFixed(1)}</span></td><td>${r.melhor.toFixed(1)}</td><td>${r.ultima.toFixed(1)}</td><td style="font-size:1.1rem;">${r.trend}</td></tr>`).join('');}

function setAnalyticsMenu(menu){
    analyticsMenu = menu;
    // Atualizar botões
    const btns = {PDI:'menuPDI', VTVR:'menuVTVR', DAILY:'menuDaily'};
    Object.entries(btns).forEach(([k,id])=>{
        const btn = document.getElementById(id);
        if(!btn) return;
        if(k===menu){
            btn.style.background = 'var(--teal)';
            btn.style.borderColor = 'var(--teal)';
            btn.style.color = 'white';
            btn.querySelectorAll('div').forEach(d=>d.style.color='');
        } else {
            btn.style.background = 'white';
            btn.style.borderColor = 'var(--border)';
            btn.style.color = 'var(--muted)';
        }
    });
    // Mostrar conteúdo
    document.getElementById('analyticsContentPDI').style.display = menu==='PDI'?'block':'none';
    document.getElementById('analyticsContentVTVR').style.display = menu==='VTVR'?'block':'none';
    const ddiv=document.getElementById('tabDailyDash');
    if(ddiv)ddiv.style.display = menu==='DAILY'?'block':'none';
    if(menu==='DAILY'){
        setTimeout(()=>renderDailyDash(), 150); // canvas precisa estar visível
    }
    if(menu==='PDI'){
        Object.keys(charts).forEach(k=>{if(charts[k]){try{charts[k].destroy();}catch(e){}}charts[k]=null;});
        // CRÍTICO: mostrar div ANTES de renderizar (canvas precisa ter dimensões)
        const pdiv=document.getElementById('analyticsContentPDI');
        const vdiv=document.getElementById('analyticsContentVTVR');
        if(pdiv){pdiv.style.display='block';}
        if(vdiv){vdiv.style.display='none';}
        setTimeout(()=>renderRelatorios(), 200);
    }
    if(menu==='VTVR'){
        Object.keys(charts).forEach(k=>{if(charts[k]){try{charts[k].destroy();}catch(e){}}charts[k]=null;});
        const pdiv=document.getElementById('analyticsContentPDI');
        const vdiv=document.getElementById('analyticsContentVTVR');
        if(pdiv){pdiv.style.display='none';}
        if(vdiv){vdiv.style.display='block';}
        setTimeout(()=>renderAnalyticsVTVR(), 100);
    }
}

async function excluirLancVTVR(id, nome){
    if(!P.isMaster()){mostrarNotif('','Sem permissão','Apenas o Master pode excluir lançamentos.','',4000);return;}
    if(!confirm(`Excluir lançamento de ${nome}? Esta ação não pode ser desfeita.`))return;
    await guardado('excluirLanc_'+id, async () => {
        await db.collection('lancamentosVTVR').doc(id).delete();
        mostrarNotif('','Lançamento excluído',`O lançamento de ${nome} foi removido.`,'',4000);
        await carregarVTVR();
    });
}
async function verificarNotifPJ(){
    const isPJ=talentos.find(t=>t.id===user.id)?.tipoContrato==='PJ';
    const bell=document.getElementById('pjNotifBell');
    const badge=document.getElementById('pjNotifBadge');
    if(!bell)return;
    if(isPJ&&lancamentosVTVR){
        const pend=lancamentosVTVR.filter(l=>l.colabId===user.id&&!l.nfNome);
        if(pend.length>0){bell.style.display='block';badge.textContent=pend.length;}
        else{bell.style.display='none';}
    }else{bell.style.display='none';}
}
async function carregarVTVRColab(){
    try{
        const snap=await db.collection('lancamentosVTVR').where('colabId','==',user.id).get();
        const meus=snap.docs.map(d=>({id:d.id,...d.data()}));
        // Merge com os já carregados (evita duplicatas)
        meus.forEach(m=>{if(!lancamentosVTVR.find(l=>l.id===m.id))lancamentosVTVR.push(m);});
    }catch(e){}
}

function renderAnalytics(){
    // Destroi charts antigos para evitar conflito
    ['eq','ev','dist','rad','comp','evInd'].forEach(k=>destroyChart(k));
    setAnalyticsMenu(analyticsMenu);
}

// ========== ANALYTICS VT/VR ==========
function renderAnalyticsVTVR(){
    const container = document.getElementById('analyticsContentVTVR');
    if(!container) return;
    if(!lancamentosVTVR || !lancamentosVTVR.length){
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);background:white;border-radius:var(--radius-md);border:1px solid var(--border);">Nenhum lançamento de VT/VR encontrado. Gere os lançamentos na aba VT/VR.</div>';
        return;
    }
    // Filtros
    const anos = [...new Set(lancamentosVTVR.map(l=>l.ano))].sort((a,b)=>b-a);
    const anoOpts = '<option value="">Todos</option>'+anos.map(a=>`<option value="${a}">${a}</option>`).join('');
    const tipoOpts = '<option value="todos">PJ + CLT</option><option value="PJ">PJ</option><option value="CLT">CLT</option>';

    container.innerHTML = `
        <!-- Filtros VT/VR Analytics -->
        <div class="rel-filters" style="margin-bottom:1.5rem;">
            <div class="form-group" style="margin:0;min-width:100px;"><label>Ano</label><select id="avAno" onchange="renderChartsVTVR()" style="padding:0.7rem;border:1.5px solid #E0E0E0;border-radius:10px;width:100%;font-family:inherit;">${anoOpts}</select></div>
            <div class="form-group" style="margin:0;min-width:120px;"><label>Tipo</label><select id="avTipo" onchange="renderChartsVTVR()" style="padding:0.7rem;border:1.5px solid #E0E0E0;border-radius:10px;width:100%;font-family:inherit;">${tipoOpts}</select></div>
            <div class="form-group" style="margin:0;min-width:150px;"><label>Equipe</label><select id="avEquipe" onchange="renderChartsVTVR()" style="padding:0.7rem;border:1.5px solid #E0E0E0;border-radius:10px;width:100%;font-family:inherit;"><option value="">Todas</option>${equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('')}</select></div>
        </div>
        <!-- Stats -->
        <div class="stats-grid" id="avStats" style="margin-bottom:1.5rem;"></div>
        <!-- Gráficos -->
        <div class="chart-grid" id="chartsVTVR"></div>
        <!-- Ranking por pessoa -->
        <div style="background:white;border:1px solid var(--border);border-radius:var(--radius-md);padding:1.5rem;box-shadow:var(--shadow-sm);margin-top:1.5rem;">
            <h4 style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;color:var(--dark);margin-bottom:1rem;">Detalhes por Pessoa</h4>
            <div style="overflow-x:auto;"><table><thead><tr><th>Colaborador</th><th>Tipo</th><th>Equipe</th><th>Meses</th><th>Total VT</th><th>Total VR</th><th>Total Geral</th></tr></thead><tbody id="avRanking"></tbody></table></div>
        </div>`;

    setTimeout(()=>renderChartsVTVR(), 80);
}

function filtrarLancVTVR(){
    const ano = parseInt(document.getElementById('avAno')?.value||0);
    const tipo = document.getElementById('avTipo')?.value||'todos';
    const equipe = document.getElementById('avEquipe')?.value||'';
    return lancamentosVTVR.filter(l=>{
        if(ano && l.ano!==ano) return false;
        if(tipo!=='todos' && l.tipoContrato!==tipo) return false;
        if(equipe && l.equipe!==equipe) return false;
        return true;
    });
}

function renderChartsVTVR(){
    const data = filtrarLancVTVR();
    const meses=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    // Stats
    const stats = document.getElementById('avStats');
    if(stats){
        const tVT=data.reduce((s,l)=>s+l.totalVT,0);
        const tVR=data.reduce((s,l)=>s+l.totalVR,0);
        const tG=data.reduce((s,l)=>s+l.total,0);
        const pessoas=new Set(data.map(l=>l.colabId)).size;
        stats.innerHTML=`
            <div class="stat-card"><div class="stat-label">Total VT</div><div class="stat-value" style="color:var(--teal);font-size:1.3rem;">R$ ${tVT.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
            <div class="stat-card"><div class="stat-label">Total VR</div><div class="stat-value" style="color:var(--gold);font-size:1.3rem;">R$ ${tVR.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
            <div class="stat-card"><div class="stat-label">Total Geral</div><div class="stat-value" style="font-size:1.3rem;color:#2E7D32;">R$ ${tG.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
            <div class="stat-card"><div class="stat-label">Pessoas</div><div class="stat-value">${pessoas}</div></div>`;
    }

    const container = document.getElementById('chartsVTVR');
    if(!container) return;
    container.innerHTML='';

    // Gráfico 1 — Evolução mensal
    const c1=document.createElement('div');c1.className='chart-card';
    c1.innerHTML='<h4>Evolução Mensal</h4><div style="height:260px;"><canvas id="chartVTEvolucao"></canvas></div>';
    container.appendChild(c1);

    // Gráfico 2 — Por equipe
    const c2=document.createElement('div');c2.className='chart-card';
    c2.innerHTML='<h4>Total por Equipe</h4><div style="height:260px;"><canvas id="chartVTEquipe"></canvas></div>';
    container.appendChild(c2);

    // Gráfico 3 — VT vs VR
    const c3=document.createElement('div');c3.className='chart-card';
    c3.innerHTML='<h4>VT vs VR</h4><div style="height:260px;"><canvas id="chartVTDonut"></canvas></div>';
    container.appendChild(c3);

    // Gráfico 4 — Por tipo PJ vs CLT
    const c4=document.createElement('div');c4.className='chart-card';
    c4.innerHTML='<h4>PJ vs CLT</h4><div style="height:260px;"><canvas id="chartVTTipo"></canvas></div>';
    container.appendChild(c4);

    setTimeout(()=>{
        // Evolução mensal
        const porMes={};
        data.forEach(l=>{const k=l.ano+'-'+String(l.mes).padStart(2,'0');if(!porMes[k])porMes[k]={vt:0,vr:0};porMes[k].vt+=l.totalVT;porMes[k].vr+=l.totalVR;});
        const mesesKeys=Object.keys(porMes).sort();
        const cv1=document.getElementById('chartVTEvolucao');
        if(cv1){if(charts.vtEv){try{charts.vtEv.destroy();}catch(e){}}charts.vtEv=null;charts.vtEv=new Chart(cv1.getContext('2d'),{type:'line',data:{labels:mesesKeys.map(k=>{const[a,m]=k.split('-');return meses[parseInt(m)]+'/'+a;}),datasets:[{label:'VT',data:mesesKeys.map(k=>porMes[k].vt),borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.1)',tension:0.4,fill:true},{label:'VR',data:mesesKeys.map(k=>porMes[k].vr),borderColor:'#C9A05A',backgroundColor:'rgba(201,160,90,0.1)',tension:0.4,fill:true}]},options:{maintainAspectRatio:false,scales:{y:{grid:{color:'#f0f0f0'}}}}});}

        // Por equipe
        const porEq={};data.forEach(l=>{if(!porEq[l.equipe])porEq[l.equipe]=0;porEq[l.equipe]+=l.total;});
        const cv2=document.getElementById('chartVTEquipe');
        if(cv2){if(charts.vtEq){try{charts.vtEq.destroy();}catch(e){}}charts.vtEq=null;charts.vtEq=new Chart(cv2.getContext('2d'),{type:'bar',data:{labels:Object.keys(porEq),datasets:[{label:'Total',data:Object.values(porEq),backgroundColor:['#1E7D90','#C9A05A','#446974','#214957','#5BA4AF'],borderRadius:6}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{grid:{color:'#f0f0f0'}}}}});}

        // VT vs VR donut
        const totVT=data.reduce((s,l)=>s+l.totalVT,0);
        const totVR=data.reduce((s,l)=>s+l.totalVR,0);
        const cv3=document.getElementById('chartVTDonut');
        if(cv3){if(charts.vtDonut){try{charts.vtDonut.destroy();}catch(e){}}charts.vtDonut=null;charts.vtDonut=new Chart(cv3.getContext('2d'),{type:'doughnut',data:{labels:['VT','VR'],datasets:[{data:[totVT,totVR],backgroundColor:['#1E7D90','#C9A05A']}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});}

        // PJ vs CLT
        const totPJ=data.filter(l=>l.tipoContrato==='PJ').reduce((s,l)=>s+l.total,0);
        const totCLT=data.filter(l=>l.tipoContrato==='CLT').reduce((s,l)=>s+l.total,0);
        const cv4=document.getElementById('chartVTTipo');
        if(cv4){if(charts.vtTipo){try{charts.vtTipo.destroy();}catch(e){}}charts.vtTipo=null;charts.vtTipo=new Chart(cv4.getContext('2d'),{type:'doughnut',data:{labels:['PJ','CLT'],datasets:[{data:[totPJ,totCLT],backgroundColor:['#214957','#1E7D90']}]},options:{maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});}
    },100);

    // Ranking por pessoa
    const ranking=document.getElementById('avRanking');
    if(ranking){
        const pm={};
        data.forEach(l=>{if(!pm[l.colabId])pm[l.colabId]={nome:l.nome,tipo:l.tipoContrato,equipe:l.equipe,meses:0,vt:0,vr:0,total:0};pm[l.colabId].meses++;pm[l.colabId].vt+=l.totalVT;pm[l.colabId].vr+=l.totalVR;pm[l.colabId].total+=l.total;});
        const sorted=Object.values(pm).sort((a,b)=>b.total-a.total);
        ranking.innerHTML=sorted.map(p=>`<tr>
            <td style="font-weight:600;">${esc(p.nome)}</td>
            <td><span class="role-badge ${p.tipo==='PJ'?'role-LIDER':'role-COLABORADOR'}">${p.tipo}</span></td>
            <td>${esc(p.equipe)}</td>
            <td>${p.meses}</td>
            <td style="color:var(--teal);">R$ ${p.vt.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color:var(--gold);">R$ ${p.vr.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="font-weight:800;">R$ ${p.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        </tr>`).join('');
    }
}

function toggleAnonimoForm(){
    // Sem necessidade de mostrar/ocultar campos — o anonimato é só uma flag
}

function gerarProtocolo(){
    const ano = new Date().getFullYear();
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let cod='';crypto.getRandomValues(new Uint8Array(10)).forEach(b=>cod+=chars[b%32]);
    return `MIR-${ano}-${cod}`;
}

async function enviarDenuncia(){
    const anonimo = document.getElementById('dAnonimo').checked;
    const tema = document.getElementById('dTema').value;
    const denunciado = document.getElementById('dDenunciado').value.trim();
    const texto = document.getElementById('dTexto').value.trim();
    const data = document.getElementById('dData').value;

    if(!tema){ mostrarNotif('','Campo obrigatório','Selecione o tema da denúncia.','',4000); return; }
    if(!texto||texto.length<20){ mostrarNotif('','Descrição muito curta','Descreva o ocorrido com pelo menos 20 caracteres.','',4000); return; }

    const protocolo = gerarProtocolo();
    const agora = new Date();

    const doc = {
        protocolo,
        tema,
        denunciado: denunciado||'Não informado',
        texto,
        dataOcorrido: data||null,
        dataEnvio: agora,
        dataHoraEnvio: agora.toLocaleString('pt-BR'),
        status: 'nova',
        devolutiva: null,
        devolutivaEm: null,
        devolutivaPor: null,
        anonimo,
        // Anonimato real: quando anônimo, NENHUM dado do remetente é gravado
        ...(anonimo?{}:{remetente:(user?user.nome:'Não identificado'),remetenteEmail:(user?user.email:null)}),
    };

    await db.collection('denuncias').add(doc);
    // Espelho público mínimo p/ consulta por protocolo (sem texto, sem envolvidos, sem remetente)
    await db.collection('denunciasStatus').doc(protocolo).set({tema,status:'nova',devolutiva:null,devolutivaEm:null,dataHoraEnvio:agora.toLocaleString('pt-BR')});

    // Salva protocolo no localStorage do dispositivo
    const protocolos = JSON.parse(localStorage.getItem('mirae_protocolos')||'[]');
    protocolos.push({protocolo, dataEnvio: agora.toISOString()});
    localStorage.setItem('mirae_protocolos', JSON.stringify(protocolos));

    // Limpar form
    document.getElementById('dAnonimo').checked = false;
    document.getElementById('dTema').value = '';
    document.getElementById('dDenunciado').value = '';
    document.getElementById('dTexto').value = '';
    document.getElementById('dData').value = '';

    // Mostrar protocolo
    const bloco = document.getElementById('denunciaFormBlock');
    if(bloco){
        bloco.innerHTML = `
            <div style="text-align:center;padding:2rem;">
                <div style="font-size:3rem;margin-bottom:1rem;"></div>
                <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--dark);margin-bottom:0.5rem;">Denúncia Registrada</div>
                <p style="color:var(--muted);font-size:0.88rem;margin-bottom:1.5rem;">Sua denúncia foi enviada com segurança. Guarde o código abaixo — você precisará dele para acompanhar o andamento.</p>
                <div class="protocolo-badge">${protocolo}</div>
                <p style="font-size:0.78rem;color:var(--muted);margin-top:1rem;">Anote este código. Use-o na seção "Consultar Protocolo" abaixo para acompanhar a devolutiva.</p>
                <button class="btn-primary" style="margin-top:1.5rem;" onclick="resetarFormDenuncia()">+ Registrar outra denúncia</button>
            </div>`;
    }
}

function resetarFormDenuncia(){
    location.reload(); // Recarrega a aba de denúncia
}

async function consultarProtocolo(){
    const cod = document.getElementById('consultaProtocolo').value.trim().toUpperCase();
    const resultado = document.getElementById('consultaResultado');
    if(!cod){ resultado.innerHTML='<p style="color:#C62828;font-size:0.85rem;">Digite um código de protocolo.</p>'; return; }

    resultado.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;">Consultando...</p>';

    let docSnap=null;
    try{docSnap = await db.collection('denunciasStatus').doc(cod).get();}catch(e){}
    if(!docSnap||!docSnap.exists){
        resultado.innerHTML = '<p style="color:#C62828;font-size:0.85rem;">Código não encontrado. Verifique e tente novamente.</p>';
        return;
    }

    const d = docSnap.data();
    const statusLabel = {nova:'Nova — aguardando análise', analise:'Em Análise — sendo investigada', encerrada:'Encerrada'}[d.status]||d.status;

    let devolutivaHtml = '';
    if(d.devolutiva){
        devolutivaHtml = `
            <div class="devolutiva-box">
                <div class="devolutiva-box-title">Devolutiva da Empresa</div>
                <p style="font-size:0.88rem;color:var(--text);line-height:1.7;">${esc(d.devolutiva)}</p>
                <p style="font-size:0.75rem;color:var(--muted);margin-top:0.5rem;">Respondido em ${d.devolutivaEm||''}</p>
            </div>`;
    } else {
        devolutivaHtml = '<p style="font-size:0.82rem;color:var(--muted);margin-top:1rem;font-style:italic;">Ainda não há devolutiva. Acompanhe pelo código.</p>';
    }

    resultado.innerHTML = `
        <div class="consulta-card" style="margin-top:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;color:var(--dark);">Protocolo ${esc(cod)}</div>
                    <div style="font-size:0.78rem;color:var(--muted);">Enviado em ${d.dataHoraEnvio||'-'}</div>
                </div>
                <span class="status-${d.status}">${statusLabel}</span>
            </div>
            <div style="margin-top:1rem;padding:0.8rem 1rem;background:var(--cream);border-radius:var(--radius-sm);">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.3rem;">Tema</div>
                <div style="font-size:0.88rem;font-weight:500;">${esc(d.tema)}</div>
            </div>
            ${devolutivaHtml}
        </div>`;
}

async function carregarDenuncias(){
    if(!P.isMaster()&&!P.isRH()) return;
    const snap = await db.collection('denuncias').orderBy('dataEnvio','desc').get();
    denuncias = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderDenuncias();
    renderDenunciasStats();
    // Inicia listener em tempo real
    iniciarListenerDenuncias();
}

function iniciarListenerDenuncias(){
    if(!P.isMaster()&&!P.isRH()) return;
    registrarListener('denuncias', db.collection('denuncias')
        .where('status','==','nova')
        .onSnapshot(snap=>{
            snap.docChanges().forEach(change=>{
                if(change.type==='added'){
                    const d = change.doc.data();
                    // Só notifica se for nova (não a inicial do carregamento)
                    const chave = 'notif_denuncia_'+change.doc.id;
                    if(!localStorage.getItem(chave)){
                        localStorage.setItem(chave,'1');
                        mostrarPopupDenuncia(d, change.doc.id);
                    }
                }
            });
            // Atualiza lista
            db.collection('denuncias').orderBy('dataEnvio','desc').get().then(s=>{
                denuncias=s.docs.map(d=>({id:d.id,...d.data()}));
                renderDenuncias();
                renderDenunciasStats();
            });
        }));
}

function renderDailyDash(){
    const statsDiv=document.getElementById('ddStats');if(!statsDiv)return;
    window._ddCharts=window._ddCharts||{};
    ddPopulaSelects();
    // Injeta os ícones de linha próprios nos cabeçalhos (uma vez)
    document.querySelectorAll('#tabDailyDash [data-ico]').forEach(el=>{
        if(el.dataset.icoDone)return;
        el.insertAdjacentHTML('afterbegin', ico(el.dataset.ico,{size:18,color:'#1E7D90'})+'&nbsp;');
        el.style.display='flex';el.style.alignItems='center';el.style.gap='0.45rem';
        el.dataset.icoDone='1';
    });

    // ===== Cartões de resumo (acompanham o filtro do gráfico por equipe) =====
    const {ts}=ddTarefas('ddEqPeriodo','ddEqEquipe','ddEqPessoa');
    const total=ts.length;
    const conc=ts.filter(t=>t.status==='concluida').length;
    const and=ts.filter(t=>t.status==='andamento').length;
    const nao=ts.filter(t=>t.status==='nao_realizada').length;
    const pend=ts.filter(t=>t.status==='pendente').length;
    const semJust=ts.filter(t=>t.status==='nao_realizada'&&!temJustificativaValida(t)).length;
    const pct=total?Math.round(conc/total*100):0;
    const lbl=(icoName,cor,txt)=>`<div class="stat-label" style="display:flex;align-items:center;gap:0.35rem;">${ico(icoName,{size:14,color:cor})}${txt}</div>`;
    statsDiv.innerHTML=`
        <div class="stat-card"><div class="stat-label">Total de Tarefas</div><div class="stat-value">${total}</div></div>
        <div class="stat-card" style="border-left:3px solid #2E7D32;">${lbl('check','#2E7D32','Concluídas')}<div class="stat-value" style="color:#2E7D32;">${conc} <span style="font-size:0.9rem;">(${pct}%)</span></div></div>
        <div class="stat-card" style="border-left:3px solid #EF6C00;">${lbl('loop','#EF6C00','Em Andamento')}<div class="stat-value" style="color:#EF6C00;">${and}</div></div>
        <div class="stat-card" style="border-left:3px solid #9CA3AF;">${lbl('clock','#9CA3AF','Pendentes')}<div class="stat-value" style="color:#9CA3AF;">${pend}</div></div>
        <div class="stat-card" style="border-left:3px solid #C62828;">${lbl('x','#C62828','Não Realizadas')}<div class="stat-value" style="color:#C62828;">${nao}</div></div>
        <div class="stat-card" style="border-left:3px solid #B71C1C;">${lbl('alert','#B71C1C','Sem Justificativa')}<div class="stat-value" style="color:#B71C1C;">${semJust}</div></div>`;

    // ===== Execução por Equipe =====
    const porEq={};
    ts.forEach(t=>{const k=t.equipe||'?';if(!porEq[k])porEq[k]={c:0,a:0,n:0,p:0};
        if(t.status==='concluida')porEq[k].c++;else if(t.status==='andamento')porEq[k].a++;
        else if(t.status==='nao_realizada')porEq[k].n++;else porEq[k].p++;});
    const eqNomes=Object.keys(porEq);
    const cv1=document.getElementById('ddChartEquipe');
    if(cv1){
        if(window._ddCharts.eq){try{window._ddCharts.eq.destroy();}catch(e){}}
        window._ddCharts.eq=new Chart(cv1.getContext('2d'),{type:'bar',
            data:{labels:eqNomes,datasets:[
                {label:'Concluídas',data:eqNomes.map(e=>porEq[e].c),backgroundColor:'#2E7D32'},
                {label:'Em Andamento',data:eqNomes.map(e=>porEq[e].a),backgroundColor:'#EF6C00'},
                {label:'Pendentes',data:eqNomes.map(e=>porEq[e].p),backgroundColor:'#9CA3AF'},
                {label:'Não Realizadas',data:eqNomes.map(e=>porEq[e].n),backgroundColor:'#C62828'}]},
            options:{maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}}}}});
    }

    // ===== Execução por Dia (período + equipe + pessoa próprios) =====
    const {ts:tsDia}=ddTarefas('ddDiaPeriodo','ddDiaEquipe','ddDiaPessoa');
    const dias2=[...new Set(tsDia.map(t=>t.data))].sort();
    const porDia=dias2.map(dt=>{
        const dd=tsDia.filter(t=>t.data===dt);
        return{dia:fmtDataBR(dt).slice(0,5),total:dd.length,conc:dd.filter(t=>t.status==='concluida').length,
               nao:dd.filter(t=>t.status==='nao_realizada').length};
    });
    const cv2=document.getElementById('ddChartDia');
    if(cv2){
        if(window._ddCharts.dia){try{window._ddCharts.dia.destroy();}catch(e){}}
        window._ddCharts.dia=new Chart(cv2.getContext('2d'),{type:'bar',
            data:{labels:porDia.map(d=>d.dia),datasets:[
                {label:'Tarefas',data:porDia.map(d=>d.total),backgroundColor:'#1E7D9055',order:2},
                {label:'Concluídas',data:porDia.map(d=>d.conc),backgroundColor:'#2E7D32',order:1},
                {label:'Não Realizadas',data:porDia.map(d=>d.nao),backgroundColor:'#C62828',order:0}]},
            options:{maintainAspectRatio:false,scales:{y:{ticks:{precision:0}}},plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}}}}});
    }

    // ===== Execução por Colaborador (período + equipe + pessoa próprios) =====
    const {ts:tsColab}=ddTarefas('ddColabPeriodo','ddColabEquipe','ddColabPessoa');
    const porColab={};
    tsColab.forEach(t=>{
        const k=t.responsavelId;
        if(!porColab[k])porColab[k]={nome:t.responsavelNome,total:0,conc:0,and:0,nao:0};
        const c=porColab[k];c.total++;
        if(t.status==='concluida')c.conc++;else if(t.status==='andamento')c.and++;else if(t.status==='nao_realizada')c.nao++;
    });
    const rows=Object.values(porColab).sort((a,b)=>(a.conc/a.total)-(b.conc/b.total));
    const cv3=document.getElementById('ddChartColab');
    if(cv3){
        if(window._ddCharts.colab){try{window._ddCharts.colab.destroy();}catch(e){}}
        window._ddCharts.colab=new Chart(cv3.getContext('2d'),{type:'bar',
            data:{labels:rows.map(c=>c.nome),datasets:[
                {label:'Concluídas',data:rows.map(c=>c.conc),backgroundColor:'#2E7D32'},
                {label:'Em Andamento',data:rows.map(c=>c.and),backgroundColor:'#EF6C00'},
                {label:'Pendentes',data:rows.map(c=>c.total-c.conc-c.and-c.nao),backgroundColor:'#9CA3AF'},
                {label:'Não Realizadas',data:rows.map(c=>c.nao),backgroundColor:'#C62828'}]},
            options:{indexAxis:'y',maintainAspectRatio:false,
                scales:{x:{stacked:true,ticks:{precision:0}},y:{stacked:true}},
                plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}}}}});
    }
    // alertas (acompanham o gráfico por colaborador)
    const alertas=tsColab.filter(t=>t.status==='nao_realizada'&&!temJustificativaValida(t)).sort((a,b)=>b.data.localeCompare(a.data));
    const alDiv=document.getElementById('ddAlertas');
    if(alDiv)alDiv.innerHTML=alertas.length?alertas.map(t=>
        `<div style="display:flex;justify-content:space-between;gap:0.8rem;padding:0.5rem 0.8rem;border-left:3px solid #C62828;background:#FFEBEE;border-radius:var(--radius-sm);margin-bottom:0.4rem;font-size:0.82rem;">
            <span><strong>${esc(t.responsavelNome)}</strong> (${esc(t.equipeResponsavel||t.equipe)}) — ${esc(t.descricao)}</span>
            <span style="white-space:nowrap;color:var(--text-muted);">${fmtDataBR(t.data)}</span>
        </div>`).join(''):'<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma tarefa não realizada sem justificativa no período.</div>';

    // ===== Participação e Faltas (período + equipe próprios) =====
    const periodoPart=document.getElementById('ddPartPeriodo')?.value||'mes';
    const limPart=ddLimiteISO(periodoPart);
    let eqPart=document.getElementById('ddPartEquipe')?.value||'';
    if(!P.isRH())eqPart=user?.equipe||'';
    const pPessoaPart=document.getElementById('ddPartPessoa')?.value||'';
    const dailysPart=dailys.filter(d=>d.data>=limPart&&(!eqPart||d.equipe===eqPart));
    let listaColabs=(dailyColabs.length?dailyColabs:talentos).filter(c=>!eqPart||c.equipe===eqPart);
    if(pPessoaPart)listaColabs=listaColabs.filter(c=>c.id===pPessoaPart);
    const partDados=listaColabs.map(c=>{
        const dEq=dailysPart.filter(d=>d.equipe===c.equipe);
        if(!dEq.length)return null;
        const pres=dEq.filter(d=>(d.presentes||[]).some(p=>p.id===c.id)).length;
        return{nome:c.nome,pres,faltas:dEq.length-pres};
    }).filter(Boolean).sort((a,b)=>b.faltas-a.faltas);
    const cv5=document.getElementById('ddChartPart');
    if(cv5){
        if(window._ddCharts.part){try{window._ddCharts.part.destroy();}catch(e){}}
        window._ddCharts.part=new Chart(cv5.getContext('2d'),{type:'bar',
            data:{labels:partDados.map(p=>p.nome),datasets:[
                {label:'Presenças',data:partDados.map(p=>p.pres),backgroundColor:'#2E7D32'},
                {label:'Faltas',data:partDados.map(p=>p.faltas),backgroundColor:'#C62828'}]},
            options:{indexAxis:'y',maintainAspectRatio:false,
                scales:{x:{stacked:true,ticks:{precision:0}},y:{stacked:true}},
                plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}}}}});
    }

    // ===== Adesão às Dailys (período próprio) =====
    const periodoAd=document.getElementById('ddAdesaoPeriodo')?.value||'mes';
    const limAd=ddLimiteISO(periodoAd);
    const diasUteis=[];
    for(let dt=new Date(limAd+'T12:00:00');dt<=new Date();dt.setDate(dt.getDate()+1)){
        const dow=dt.getDay();if(dow!==0&&dow!==6)diasUteis.push(1);
    }
    let eqAd=document.getElementById('ddAdesaoEquipe')?.value||'';
    if(!P.isRH())eqAd=user?.equipe||'';
    const pAd=document.getElementById('ddAdesaoPessoa')?.value||'';
    let eqsAna=P.isRH()?equipes:equipes.filter(e=>e.nome===user.equipe);
    if(eqAd)eqsAna=eqsAna.filter(e=>e.nome===eqAd);
    if(pAd){const pessoaAd=(dailyColabs.length?dailyColabs:talentos).find(c=>c.id===pAd);if(pessoaAd)eqsAna=eqsAna.filter(e=>e.nome===pessoaAd.equipe);}
    const dailysAd=dailys.filter(d=>d.data>=limAd);
    const adesaoDados=eqsAna.map(e=>{
        const feitas=dailysAd.filter(d=>d.equipe===e.nome).length;
        const p=diasUteis.length?Math.round(feitas/diasUteis.length*100):0;
        return{nome:e.nome,p:Math.min(p,100)};
    });
    const cv4=document.getElementById('ddChartAdesao');
    if(cv4){
        if(window._ddCharts.adesao){try{window._ddCharts.adesao.destroy();}catch(e){}}
        window._ddCharts.adesao=new Chart(cv4.getContext('2d'),{type:'bar',
            data:{labels:adesaoDados.map(a=>a.nome),datasets:[{label:'% de adesão',
                data:adesaoDados.map(a=>a.p),
                backgroundColor:adesaoDados.map(a=>a.p>=80?'#2E7D32':a.p>=50?'#EF6C00':'#C62828')}]},
            options:{maintainAspectRatio:false,
                scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'}}},
                plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y+'% dos dias úteis com daily'}}}}});
    }

    // ===== Tarefas Adiadas (quem mais transfere de dia) =====
    const {ts:tsAdia}=ddTarefas('ddAdiaPeriodo','ddAdiaEquipe','ddAdiaPessoa');
    const adiadas=tsAdia.filter(foiAdiada);
    const porPessoaAdia={};
    adiadas.forEach(t=>{const k=t.responsavelId;if(!porPessoaAdia[k])porPessoaAdia[k]={nome:t.responsavelNome,eq:t.equipeResponsavel||t.equipe,tarefas:0,soma:0,max:0};
        const o=porPessoaAdia[k];o.tarefas++;o.soma+=(t.adiamentos||0);o.max=Math.max(o.max,t.adiamentos||0);});
    const rankAdia=Object.values(porPessoaAdia).sort((a,b)=>b.soma-a.soma);
    const adDiv=document.getElementById('ddAdiamentos');
    if(adDiv){
        adDiv.innerHTML=!rankAdia.length
            ?'<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma tarefa adiada no período.</div>'
            :`<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead><tr style="text-align:left;color:var(--text-muted);border-bottom:1.5px solid var(--border);">
                    <th style="padding:0.45rem 0.5rem;">Colaborador</th><th>Equipe</th>
                    <th style="text-align:center;">Tarefas adiadas</th><th style="text-align:center;">Total de adiamentos</th><th style="text-align:center;">Pior caso</th></tr></thead>
                <tbody>${rankAdia.map((r,i)=>`<tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.45rem 0.5rem;font-weight:600;">${i<3?rankBadge(i):''}${esc(r.nome)}</td>
                    <td style="color:var(--text-muted);">${esc(r.eq)}</td>
                    <td style="text-align:center;">${r.tarefas}</td>
                    <td style="text-align:center;font-weight:700;color:${r.soma>=5?'#C62828':r.soma>=3?'#EF6C00':'#9CA3AF'};">${r.soma}x</td>
                    <td style="text-align:center;">${r.max}x</td></tr>`).join('')}</tbody></table>`;
    }

    // ===== Interdependência entre Equipes (cross-team) =====
    const {ts:tsInter}=ddTarefas('ddInterPeriodo','ddInterEquipe','ddInterPessoa');
    const cross=tsInter.filter(t=>t.crossTeam);
    const porReq={};
    cross.forEach(t=>{const k=t.responsavelId;if(!porReq[k])porReq[k]={nome:t.responsavelNome,eq:t.equipeResponsavel||'?',total:0,mesmoDia:0,emAberto:0,solicitantes:new Set()};
        const o=porReq[k];o.total++;if(atendidaMesmoDia(t))o.mesmoDia++;if(t.status==='pendente'||t.status==='andamento')o.emAberto++;if(t.equipe)o.solicitantes.add(t.equipe);});
    const rankInter=Object.values(porReq).sort((a,b)=>b.total-a.total);
    const itDiv=document.getElementById('ddInterdep');
    if(itDiv){
        itDiv.innerHTML=!rankInter.length
            ?'<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma requisição entre equipes no período.</div>'
            :`<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                <thead><tr style="text-align:left;color:var(--text-muted);border-bottom:1.5px solid var(--border);">
                    <th style="padding:0.45rem 0.5rem;">Mais requisitado(a)</th><th>Equipe</th><th>Solicitado por</th>
                    <th style="text-align:center;">Requisições</th><th style="text-align:center;">Atendidas no mesmo dia</th><th style="text-align:center;">% no dia</th><th style="text-align:center;">Em aberto</th></tr></thead>
                <tbody>${rankInter.map((r,i)=>{const pct=r.total?Math.round(r.mesmoDia/r.total*100):0;
                    return`<tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.45rem 0.5rem;font-weight:600;">${i<3?rankBadge(i):''}${esc(r.nome)}</td>
                    <td style="color:var(--text-muted);">${esc(r.eq)}</td>
                    <td style="color:var(--text-muted);">${esc([...r.solicitantes].join(', '))}</td>
                    <td style="text-align:center;font-weight:700;">${r.total}</td>
                    <td style="text-align:center;color:#2E7D32;">${r.mesmoDia}</td>
                    <td style="text-align:center;font-weight:700;color:${pct>=70?'#2E7D32':pct>=40?'#EF6C00':'#C62828'};">${pct}%</td>
                    <td style="text-align:center;color:${r.emAberto?'#C62828':'#9CA3AF'};">${r.emAberto}</td></tr>`;}).join('')}</tbody></table>`;
    }

    // ===== Justificativas por Colaborador (consultar + aceitar/recusar) =====
    const {ts:tsJust}=ddTarefas('ddJustPeriodo','ddJustEquipe','ddJustPessoa');
    const naoFeitas=tsJust.filter(t=>t.status==='nao_realizada').sort((a,b)=>b.data.localeCompare(a.data));
    const podeAvaliar=P.isMaster()||P.isRH()||user?.role==='LIDER';
    const juDiv=document.getElementById('ddJustificativas');
    if(juDiv){
        juDiv.innerHTML=!naoFeitas.length
            ?'<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma tarefa não realizada no período.</div>'
            :naoFeitas.map(t=>{
                const semTexto=!(t.justificativa&&t.justificativa.trim());
                const recusada=t.justificativaAceita===false;
                const aceita=t.justificativaAceita===true;
                const corBarra=(semTexto||recusada)?'#C62828':aceita?'#2E7D32':'#EF6C00';
                const ss='font-size:0.7rem;font-weight:700;padding:0.12rem 0.5rem;border-radius:10px;display:inline-flex;align-items:center;gap:0.3rem;';
                const selo=semTexto?`<span style="${ss}color:#B71C1C;background:#FFEBEE;">${ico('alert',{size:12,color:'#B71C1C'})} sem justificativa</span>`
                    :recusada?`<span style="${ss}color:#B71C1C;background:#FFEBEE;">${ico('ban',{size:12,color:'#B71C1C'})} recusada (conta como sem justificativa)</span>`
                    :aceita?`<span style="${ss}color:#2E7D32;background:#E8F5E9;">${ico('check',{size:12,color:'#2E7D32'})} aceita</span>`
                    :`<span style="${ss}color:#EF6C00;background:#FFF3E0;">${ico('clock',{size:12,color:'#EF6C00'})} aguardando avaliação</span>`;
                const bs='font-size:0.72rem;padding:0.2rem 0.6rem;display:inline-flex;align-items:center;gap:0.3rem;';
                const botoes=(podeAvaliar&&!semTexto)?`<div style="display:flex;gap:0.4rem;margin-top:0.4rem;">
                    <button class="btn btn-ghost" style="${bs}color:#2E7D32;border:1px solid #2E7D32;" onclick="avaliarJustificativa('${t.id}',true)">${ico('check',{size:13,color:'#2E7D32'})} Aceitar</button>
                    <button class="btn btn-ghost" style="${bs}color:#C62828;border:1px solid #C62828;" onclick="avaliarJustificativa('${t.id}',false)">${ico('ban',{size:13,color:'#C62828'})} Não aceitar</button>
                    ${(aceita||recusada)?`<button class="btn btn-ghost" style="${bs}color:var(--text-muted);" onclick="avaliarJustificativa('${t.id}',null)">${ico('rotate',{size:13})} limpar</button>`:''}
                </div>`:'';
                return`<div style="border-left:3px solid ${corBarra};background:var(--cream,#FAF7F2);border-radius:var(--radius-sm);padding:0.6rem 0.8rem;margin-bottom:0.5rem;">
                    <div style="display:flex;justify-content:space-between;gap:0.8rem;flex-wrap:wrap;">
                        <span style="font-size:0.84rem;"><strong>${esc(t.responsavelNome)}</strong> <span style="color:var(--text-muted);">(${esc(t.equipeResponsavel||t.equipe)})</span> — ${esc(t.descricao)}</span>
                        <span style="white-space:nowrap;color:var(--text-muted);font-size:0.78rem;">${fmtDataBR(t.data)}</span>
                    </div>
                    <div style="margin-top:0.35rem;font-size:0.82rem;font-style:italic;color:${semTexto?'#B71C1C':'var(--dark)'};">${semTexto?'— não informou justificativa —':'“'+esc(t.justificativa)+'”'}</div>
                    <div style="margin-top:0.35rem;">${selo}</div>
                    ${botoes}
                </div>`;
            }).join('');
    }
}

// Gestor aceita (true) / recusa (false) / limpa (null) a justificativa.
// Recusada conta como SEM justificativa nas métricas.
async function avaliarJustificativa(id,aceita){
    if(!(P.isMaster()||P.isRH()||user?.role==='LIDER')){alert('Sem permissão para avaliar justificativas.');return;}
    try{
        await db.collection('dailyTarefas').doc(id).update({justificativaAceita:aceita,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        const t=dailyTarefas.find(x=>x.id===id);if(t)t.justificativaAceita=aceita;
        renderDailyDash();
    }catch(e){alert('Erro ao avaliar: '+e.message);}
    setTimeout(reemplazarEmojisEnDOM,100); // Reemplaza emojis após renderizar
}

function mostrarPopupDenuncia(d, id){
    // Remove popup anterior se existir
    document.getElementById('denunciaPopup')?.remove();
    const popup = document.createElement('div');
    popup.id = 'denunciaPopup';
    popup.className = 'denuncia-popup';
    popup.innerHTML = `
        <div class="denuncia-popup-card">
            <span class="denuncia-popup-icon"></span>
            <div class="denuncia-popup-title">Nova Denúncia Recebida</div>
            <div class="denuncia-popup-sub">Uma nova denúncia foi registrada no Canal Seguro e precisa da sua atenção.</div>
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                    <span style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--muted);">Tema</span>
                    <span style="font-size:0.82rem;font-weight:600;color:var(--dark);">${esc(d.tema)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                    <span style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--muted);">Protocolo</span>
                    <span style="font-size:0.82rem;font-weight:600;color:var(--gold);">${esc(d.protocolo)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:0.72rem;font-weight:600;text-transform:uppercase;color:var(--muted);">Remetente</span>
                    <span style="font-size:0.82rem;color:var(--muted);">${d.anonimo?'Anônimo':'Identificado'}</span>
                </div>
            </div>
            <div style="display:flex;gap:0.8rem;">
                <button class="btn-primary" style="background:#C62828;flex:1;" onclick="verDenunciaDoPopup('${id}')">Ver Denúncia</button>
                <button class="btn-ghost" style="flex:1;" onclick="document.getElementById('denunciaPopup').remove()">Fechar</button>
            </div>
        </div>`;
    document.body.appendChild(popup);
}

function verDenunciaDoPopup(id){
    document.getElementById('denunciaPopup')?.remove();
    // Navega para a aba de denúncias
    switchTab('tabDenuncias');
    document.querySelector('.tab-btn[onclick*="tabDenuncias"]')?.click();
}

function renderDenunciasStats(){
    const statsDiv = document.getElementById('denunciasStats');
    if(!statsDiv) return;
    const total = denuncias.length;
    const novas = denuncias.filter(d=>d.status==='nova').length;
    const analise = denuncias.filter(d=>d.status==='analise').length;
    const encerradas = denuncias.filter(d=>d.status==='encerrada').length;
    statsDiv.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${total}</div></div>
        <div class="stat-card" style="border-left:3px solid #C62828;"><div class="stat-label">Novas</div><div class="stat-value" style="color:#C62828;">${novas}</div></div>
        <div class="stat-card" style="border-left:3px solid #EF6C00;"><div class="stat-label">Em Análise</div><div class="stat-value" style="color:#EF6C00;">${analise}</div></div>
        <div class="stat-card" style="border-left:3px solid #2E7D32;"><div class="stat-label">Encerradas</div><div class="stat-value" style="color:#2E7D32;">${encerradas}</div></div>`;
}

function renderDenuncias(){
    const list = document.getElementById('denunciasList');
    if(!list) return;
    const filtroStatus = document.getElementById('filtroStatusDen')?.value||'';
    const filtroTema = document.getElementById('filtroTemaDen')?.value||'';
    let filtered = denuncias.filter(d=>{
        if(filtroStatus && d.status!==filtroStatus) return false;
        if(filtroTema && d.tema!==filtroTema) return false;
        return true;
    });
    if(!filtered.length){
        list.innerHTML='<div style="text-align:center;padding:3rem;color:var(--muted);background:white;border-radius:var(--radius-md);border:1px solid var(--border);">Nenhuma denúncia encontrada.</div>';
        return;
    }
    list.innerHTML = filtered.map(d=>`
        <div style="background:white;border:1px solid var(--border);border-radius:var(--radius-md);padding:1.5rem;margin-bottom:1rem;box-shadow:var(--shadow-sm);${d.status==='nova'?'border-left:3px solid #C62828;':''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
                <div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600;color:var(--dark);">${esc(d.tema)}</div>
                    <div style="font-size:0.78rem;color:var(--muted);margin-top:0.2rem;">
                        Protocolo: <strong style="color:var(--gold);">${d.protocolo}</strong> · 
                        ${d.dataHoraEnvio||'-'} · 
                        ${d.anonimo?'Anônimo':'Identificado'}
                    </div>
                </div>
                <span class="status-${d.status}">${{nova:'Nova',analise:'Em Análise',encerrada:'Encerrada'}[d.status]||d.status}</span>
            </div>
            ${d.denunciado&&d.denunciado!=='Não informado'?`<div style="font-size:0.82rem;margin-bottom:0.8rem;"><strong>Pessoa envolvida:</strong> ${esc(d.denunciado)}</div>`:''}
            <div style="background:var(--cream);border-radius:var(--radius-sm);padding:1rem;font-size:0.85rem;line-height:1.7;color:var(--text);margin-bottom:1rem;">${esc(d.texto)}</div>
            ${d.devolutiva?`<div class="devolutiva-box"><div class="devolutiva-box-title">Devolutiva enviada em ${d.devolutivaEm||''}</div><p style="font-size:0.85rem;">${esc(d.devolutiva)}</p></div>`:''}
            <div style="display:flex;gap:0.8rem;margin-top:1rem;flex-wrap:wrap;">
                <select onchange="atualizarStatusDenuncia('${d.id}',this.value)" style="padding:0.4rem 0.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:0.78rem;">
                    <option value="nova" ${d.status==='nova'?'selected':''}>Nova</option>
                    <option value="analise" ${d.status==='analise'?'selected':''}>Em Análise</option>
                    <option value="encerrada" ${d.status==='encerrada'?'selected':''}>Encerrada</option>
                </select>
                <button class="btn-ghost" onclick="abrirDevolutiva('${d.id}','${jsq(d.devolutiva||'')}')">${d.devolutiva?'Editar':'Escrever'} Devolutiva</button>
            </div>
        </div>`).join('');
}

async function atualizarStatusDenuncia(id, status){
    await db.collection('denuncias').doc(id).update({status, atualizadoEm: new Date().toLocaleString('pt-BR'), atualizadoPor: user.nome});
    const den=denuncias.find(d=>d.id===id);
    if(den?.protocolo)db.collection('denunciasStatus').doc(den.protocolo).set({status},{merge:true}).catch(()=>{});
    const idx = denuncias.findIndex(d=>d.id===id);
    if(idx>-1) denuncias[idx].status = status;
    renderDenuncias();
    renderDenunciasStats();
    mostrarNotif('','Status atualizado','Denúncia atualizada com sucesso.','',3000);
}

function abrirDevolutiva(id, textoAtual){
    // Remove modal anterior
    document.getElementById('modalDevolutiva')?.remove();
    const modal = document.createElement('div');
    modal.id = 'modalDevolutiva';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <span class="close-btn" onclick="document.getElementById('modalDevolutiva').remove()">&times;</span>
            <h2>Escrever Devolutiva</h2>
            <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.5rem;">A devolutiva será exibida para quem registrou a denúncia ao consultar o código de protocolo. Não revele informações que possam identificar o denunciante.</p>
            <div class="form-group">
                <label>Devolutiva</label>
                <textarea id="textoDevolutiva" rows="5" style="font-size:0.88rem;">${esc(textoAtual)}</textarea>
            </div>
            <button class="btn-primary" onclick="salvarDevolutiva('${id}')">Salvar Devolutiva</button>
        </div>`;
    document.body.appendChild(modal);
}

async function salvarDevolutiva(id){
    const texto = document.getElementById('textoDevolutiva').value.trim();
    if(!texto){ mostrarNotif('','Campo vazio','Escreva a devolutiva antes de salvar.','',3000); return; }
    const agora = new Date().toLocaleString('pt-BR');
    await db.collection('denuncias').doc(id).update({
        devolutiva: texto,
        devolutivaEm: agora,
        devolutivaPor: user.nome,
        status: 'analise'
    });
    const denEsp=denuncias.find(d=>d.id===id);
    if(denEsp?.protocolo)await db.collection('denunciasStatus').doc(denEsp.protocolo).set({tema:denEsp.tema||null,status:'analise',devolutiva:texto,devolutivaEm:agora,dataHoraEnvio:denEsp.dataHoraEnvio||null},{merge:true}).catch(()=>{});
    document.getElementById('modalDevolutiva')?.remove();
    // Atualiza local
    const idx = denuncias.findIndex(d=>d.id===id);
    if(idx>-1){ denuncias[idx].devolutiva=texto; denuncias[idx].devolutivaEm=agora; denuncias[idx].status='analise'; }
    renderDenuncias();
    renderDenunciasStats();
    mostrarNotif('','Devolutiva salva','A pessoa poderá ver a devolutiva ao consultar o protocolo.','',4000);
    // Verifica se tem listener para notificar no dispositivo
    verificarDevolutivasLocais();
    // Mostrar botão de backup para Master/RH
    const bw=document.getElementById('backupBtnWrapper');
    if(bw)bw.style.display=P.isMaster()?'block':'none';
    // Verificar lembrete de backup
    verificarLembreteBackup();
}
