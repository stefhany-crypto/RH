async function carregarDaily(){
    try{
        // dailys: 400 dias — usado por relatórios de participação anual
        const desde400=new Date();desde400.setDate(desde400.getDate()-400);
        const desde400ISO=new Date(desde400.getTime()-desde400.getTimezoneOffset()*60000).toISOString().slice(0,10);
        // dailyTarefas: 90 dias — só necessário para o painel operacional
        const desde90=new Date();desde90.setDate(desde90.getDate()-90);
        const desde90ISO=new Date(desde90.getTime()-desde90.getTimezoneOffset()*60000).toISOString().slice(0,10);
        const[dSnap,tSnap]=await Promise.all([
            db.collection('dailys').where('data','>=',desde400ISO).get(),
            db.collection('dailyTarefas').where('data','>=',desde90ISO).get()
        ]);
        dailys=dSnap.docs.map(d=>({id:d.id,...d.data()}));
        dailyTarefas=tSnap.docs.map(d=>({id:d.id,...d.data()}));
        if(P.isLider()&&user.equipe){
            const cSnap=await db.collection('colaboradores').where('ativo','==',true).where('equipe','==',user.equipe).get();
            dailyColabs=cSnap.docs.map(d=>({id:d.id,nome:d.data().nome,equipe:d.data().equipe||''}));
        }
    }catch(e){console.error('Erro ao carregar dailys:',e);}
    renderDaily();
    verificarTarefasDelegadas();
    // Atualiza home depois que os dados chegam
    if(typeof renderHomeExtras==='function') renderHomeExtras();
}

// ========== MINHAS TAREFAS — gestor pessoal estilo TickTick ==========
// tarefasPessoais, ttCarregado, TT_SMART, TT_PRIO e demais vars declarados em globals.js

async function carregarTarefasPessoais(){
    if(!user)return;
    try{
        const snap=await db.collection('tarefasPessoais').where('userId','==',user.id).orderBy('ordem','desc').limit(400).get();
        tarefasPessoais=snap.docs.map(d=>({id:d.id,...d.data()}));
        ttCarregado=true;
    }catch(e){console.error('Erro ao carregar tarefas pessoais:',e);}
}

async function renderTarefasPessoais(){
    if(!ttCarregado)await carregarTarefasPessoais();
    if(!dailyTarefas||!dailyTarefas.length){try{await carregarDaily();}catch(e){}}
    ttRenderRail(); ttRenderLista();
    const qa=document.querySelector('#tabTarefas .tt-qa-ico'); if(qa)qa.innerHTML=ico('plus',{size:18});
    const bc=document.getElementById('ttBtnConcl'); if(bc){bc.innerHTML=ico('check',{size:16});bc.classList.toggle('on',ttMostrarConcluidas);}
    const bp=document.getElementById('ttBtnPdf'); if(bp)bp.innerHTML=ico('download',{size:16});
    const so=document.getElementById('ttSort'); if(so)so.value=ttSortBy;
}

// Lista unificada: tarefas próprias + tarefas da daily (com "sombra" para estado pessoal)
function ttUnificadas(){
    const proprias=tarefasPessoais.filter(t=>t.origem!=='daily');
    const shadows={}; tarefasPessoais.filter(t=>t.origem==='daily').forEach(t=>{shadows[t.origemTarefaId]=t;});
    // evita duplicar: tarefas da daily criadas a partir de uma tarefa pessoal (enviadas) já aparecem como a própria
    const enviadasIds=new Set(proprias.map(t=>t.dailyTarefaCriadaId).filter(Boolean));
    const daily=(dailyTarefas||[]).filter(t=>t.responsavelId===user.id&&!enviadasIds.has(t.id)&&(['pendente','andamento'].includes(t.status)||shadows[t.id])).map(dt=>{
        const s=shadows[dt.id];
        if(s)return {...s,titulo:dt.descricao,equipe:dt.equipe,_daily:true};
        return {_virtual:true,_daily:true,origem:'daily',origemTarefaId:dt.id,titulo:dt.descricao,equipe:dt.equipe,concluida:false,prioridade:null,prazo:dt.data||null,lista:'Daily',subtarefas:[],notas:''};
    });
    return [...proprias,...daily];
}
function ttKey(t){return t.id?t.id:'daily:'+t.origemTarefaId;}
function ttFindByKey(key){
    if(key&&key.startsWith('daily:')){const oid=key.slice(6);return tarefasPessoais.find(t=>t.origem==='daily'&&t.origemTarefaId===oid)||null;}
    return tarefasPessoais.find(t=>t.id===key)||null;
}
function ttListasCustom(){const set={};ttUnificadas().forEach(t=>{const l=t.lista||'Entrada';set[l]=(set[l]||0)+(t.concluida?0:1);});return set;}

function ttFiltrar(){
    const hoje=hojeISO(); let lista=ttUnificadas(); const k=ttListaAtiva;
    if(k==='concluidas')lista=lista.filter(t=>t.concluida);
    else if(k==='hoje')lista=lista.filter(t=>!t.concluida&&t.prazo===hoje);
    else if(k==='atrasadas')lista=lista.filter(t=>!t.concluida&&t.prazo&&t.prazo<hoje);
    else if(k==='proximas')lista=lista.filter(t=>!t.concluida&&t.prazo&&t.prazo>hoje);
    else if(k==='todas')lista=lista.filter(t=>ttMostrarConcluidas?true:!t.concluida);
    else if(k.startsWith('lista:')){const n=k.slice(6);lista=lista.filter(t=>(t.lista||'Entrada')===n&&(ttMostrarConcluidas||!t.concluida));}
    const prioVal={alta:0,media:1,baixa:2};
    lista.sort((a,b)=>{
        if(ttSortBy==='prazo')return (a.prazo||'9999-99').localeCompare(b.prazo||'9999-99');
        if(ttSortBy==='prioridade')return (prioVal[a.prioridade]??3)-(prioVal[b.prioridade]??3);
        if(ttSortBy==='alfabetica')return (a.titulo||'').localeCompare(b.titulo||'');
        return (a.ordem||0)-(b.ordem||0);
    });
    return lista;
}

function ttRenderRail(){
    const r=document.getElementById('ttRail'); if(!r)return;
    const uni=ttUnificadas(), hoje=hojeISO();
    const counts={
        hoje:uni.filter(t=>!t.concluida&&t.prazo===hoje).length,
        atrasadas:uni.filter(t=>!t.concluida&&t.prazo&&t.prazo<hoje).length,
        proximas:uni.filter(t=>!t.concluida&&t.prazo&&t.prazo>hoje).length,
        todas:uni.filter(t=>!t.concluida).length,
        concluidas:uni.filter(t=>t.concluida).length
    };
    let html='<div class="tt-rail-group">Visões</div>';
    TT_SMART.forEach(s=>{const c=counts[s.key]||0;
        html+=`<div class="tt-rail-item ${ttListaAtiva===s.key?'active':''}" onclick="ttAbrirLista('${s.key}')"><span class="tt-ri-ico">${ico(s.ico,{size:16})}</span>${s.label}${c?`<span class="tt-rail-count">${c}</span>`:''}</div>`;});
    const custom=ttListasCustom();
    const nomes=Object.keys(custom).sort((a,b)=>a==='Daily'?-1:b==='Daily'?1:a.localeCompare(b));
    html+='<div class="tt-rail-group">Listas</div>';
    nomes.forEach(n=>{const key='lista:'+n;
        html+=`<div class="tt-rail-item ${ttListaAtiva===key?'active':''}" onclick="ttAbrirLista('${jsq(key)}')"><span class="tt-ri-ico">${ico(n==='Daily'?'calendar':'layers',{size:16})}</span>${esc(n)}${custom[n]?`<span class="tt-rail-count">${custom[n]}</span>`:''}</div>`;});
    html+=`<div class="tt-rail-novalista" onclick="ttNovaLista()">${ico('plus',{size:15})} Nova lista</div>`;
    r.innerHTML=html;
}

function ttFmtPrazo(iso){const hoje=hojeISO();if(iso===hoje)return'Hoje';const am=new Date(Date.now()+86400000);const amISO=new Date(am.getTime()-am.getTimezoneOffset()*60000).toISOString().slice(0,10);if(iso===amISO)return'Amanhã';return fmtDataBR(iso).slice(0,5);}

function ttTarefaHTML(t){
    const key=ttKey(t), hoje=hojeISO();
    const pcls=t.prioridade?('p-'+t.prioridade):'';
    const chips=[];
    if(t._daily)chips.push(`<span class="tt-chip daily">${ico('calendar',{size:11})} ${esc(t.equipe||'Daily')}</span>`);
    if(t.enviadaDaily===hoje&&!t._daily)chips.push(`<span class="tt-chip nadaily">${ico('check',{size:11})} Na Daily de hoje</span>`);
    if(t.prazo){const cls=t.concluida?'':(t.prazo<hoje?'atrasada':t.prazo===hoje?'hoje':'');chips.push(`<span class="tt-chip ${cls}">${ico('calendar',{size:11})} ${ttFmtPrazo(t.prazo)}</span>`);}
    if(t.prioridade)chips.push(`<span class="tt-chip flag-${t.prioridade}">${ico('flag',{size:11})} ${TT_PRIO[t.prioridade].label}</span>`);
    if(t.lista&&t.lista!=='Entrada'&&!t._daily)chips.push(`<span class="tt-chip">${ico('layers',{size:11})} ${esc(t.lista)}</span>`);
    const subs=(t.subtarefas||[]);
    if(subs.length)chips.push(`<span class="tt-chip">${ico('tasks',{size:11})} ${subs.filter(s=>s.feita).length}/${subs.length}</span>`);
    if(t.recorrencia)chips.push(`<span class="tt-chip">${ico('repeat',{size:11})}</span>`);
    const body=`<div class="tt-t-body"><div class="tt-t-titulo">${esc(t.titulo||'(sem título)')}</div>${chips.length?`<div class="tt-t-meta">${chips.join('')}</div>`:''}</div>`;
    if(ttSelMode){
        const podeEnviar=!t._daily&&!t.concluida;
        const sel=ttSelecionadas.has(key);
        return `<div class="tt-tarefa ${t.concluida?'concl':''} ${sel?'sel':''}" style="${podeEnviar?'':'opacity:0.5;cursor:not-allowed;'}" onclick="${podeEnviar?`ttToggleSelecao('${jsq(key)}')`:''}">
            <div class="tt-selbox ${sel?'on':''}">${sel?ico('check',{size:13,color:'#fff'}):''}</div>${body}</div>`;
    }
    return `<div class="tt-tarefa ${t.concluida?'concl':''}" onclick="ttAbrirDetalhe('${jsq(key)}')">
        <div class="tt-check ${pcls} ${t.concluida?'feita':''}" onclick="event.stopPropagation();ttToggleConcluir('${jsq(key)}')">${t.concluida?ico('check',{size:13,color:'#fff'}):''}</div>
        ${body}
    </div>`;
}

// ── Eisenhower helpers ──
function _eiLabel(urg,imp){
    if(urg&&imp)  return 'Q1 — Fazer agora';
    if(!urg&&imp) return 'Q2 — Agendar';
    if(urg&&!imp) return 'Q3 — Delegar';
    if(urg===false&&imp===false) return 'Q4 — Eliminar';
    return 'Não classificada — marque Urgente e/ou Importante';
}
async function ttSetEisenhower(campo,valor){
    const t=ttFindByKey(ttDetalheKey)||ttUnificadas().find(x=>ttKey(x)===ttDetalheKey);
    if(!t||!t.id)return;
    await guardado('ttEisenhower_'+t.id+'_'+campo, async () => {
        await db.collection('tarefasPessoais').doc(t.id).update({[campo]:valor,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        t[campo]=valor;
        ttRenderDetalhe();
    });
    if(ttListaAtiva==='eisenhower')ttRenderLista();
}

function ttRenderEisenhower(){
    const cont=document.getElementById('ttLista'); if(!cont)return;
    const tit=document.getElementById('ttTitulo'); if(tit)tit.textContent='Eisenhower';
    const todas=ttUnificadas().filter(t=>!t.concluida);
    const sub=document.getElementById('ttSubtitulo'); if(sub)sub.textContent=`${todas.length} tarefa(s) ativa(s)`;
    const q1=todas.filter(t=>t.urgente&&t.importante);
    const q2=todas.filter(t=>!t.urgente&&t.importante);
    const q3=todas.filter(t=>t.urgente&&!t.importante);
    const q4=todas.filter(t=>t.urgente===false&&t.importante===false);
    const nc=todas.filter(t=>t.urgente==null&&t.importante==null);
    const mesesAbrev=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    function cardHTML(t){
        const key=ttKey(t);
        const prazoStr=t.prazo?` · ${fmtDataBR(t.prazo)}`:'';
        const prioStr=t.prioridade?` · ${TT_PRIO[t.prioridade]?.label||''}` :'';
        return `<div class="ei-card" draggable="true" ondragstart="ttDragStart(event,'${jsq(key)}')" ondragend="ttDragEnd(event)" onclick="ttAbrirDetalhe('${jsq(key)}')">
            <div style="flex:1;min-width:0;">
                <div class="ei-card-title">${esc(t.titulo||'(sem título)')}</div>
                ${(prazoStr||prioStr)?`<div class="ei-card-meta">${esc((prazoStr+prioStr).slice(3))}</div>`:''}
            </div>
            ${t._daily?`<span style="font-size:0.65rem;color:var(--teal);font-weight:600;white-space:nowrap;">Daily</span>`:''}
        </div>`;
    }
    function quadrante(cls,n,badge,hint,items,urg,imp){
        return `<div class="ei-q ${cls}" ondragover="ttDragOver(event)" ondragleave="ttDragLeave(event)" ondrop="ttDropEisenhower(event,${urg},${imp})">
            <div class="ei-q-header">
                <span class="ei-q-badge">${badge}</span>
                <span class="ei-q-title">${n}</span>
                <span style="margin-left:auto;font-size:0.78rem;color:var(--muted);font-weight:600;">${items.length}</span>
            </div>
            <div class="ei-q-hint">${hint}</div>
            ${items.map(cardHTML).join('')}
            ${!items.length?`<div style="font-size:0.78rem;color:var(--muted);text-align:center;padding:0.5rem 0;">Nenhuma tarefa aqui</div>`:''}
        </div>`;
    }
    cont.innerHTML=`
        <div class="ei-grid">
            ${quadrante('ei-q1','Fazer Agora','Urgente + Importante','Execute imediatamente — não delegue.',q1,true,true)}
            ${quadrante('ei-q2','Agendar','Importante · Não urgente','Planeje com antecedência — é o que mais gera resultado.',q2,false,true)}
            ${quadrante('ei-q3','Delegar','Urgente · Não importante','Alguém pode fazer por você.',q3,true,false)}
            ${quadrante('ei-q4','Eliminar','Não urgente · Não importante','Avalie se realmente precisa ser feito.',q4,false,false)}
        </div>
        ${nc.length?`<div class="ei-unclass">
            <div class="ei-unclass-title">${ico('alert',{size:13,color:'var(--muted)'})} Não classificadas — ${nc.length} tarefa(s)</div>
            <div style="font-size:0.77rem;color:var(--muted);margin-bottom:0.7rem;">Clique em cada tarefa e marque Urgente / Importante para posicioná-la na matriz.</div>
            ${nc.map(cardHTML).join('')}
        </div>`:''}`;
}

// ── Drag-and-drop entre quadrantes da matriz de Eisenhower ──
let _ttDragKey=null;
function ttDragStart(e,key){
    _ttDragKey=key;
    if(e.dataTransfer){ e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain',key);}catch(_){} }
    if(e.target&&e.target.classList) e.target.classList.add('ei-dragging');
}
function ttDragEnd(e){
    if(e.target&&e.target.classList) e.target.classList.remove('ei-dragging');
    document.querySelectorAll('.ei-q.ei-drop').forEach(q=>q.classList.remove('ei-drop'));
}
function ttDragOver(e){
    e.preventDefault();
    if(e.dataTransfer) e.dataTransfer.dropEffect='move';
    e.currentTarget.classList.add('ei-drop');
}
function ttDragLeave(e){
    // só remove se o ponteiro saiu de fato do quadrante (não para um filho)
    if(!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ei-drop');
}
async function ttDropEisenhower(e,urg,imp){
    e.preventDefault();
    e.currentTarget.classList.remove('ei-drop');
    let key=_ttDragKey;
    if(!key&&e.dataTransfer){ try{key=e.dataTransfer.getData('text/plain');}catch(_){} }
    _ttDragKey=null;
    if(!key)return;
    // Garante que a tarefa existe no Firestore (materializa virtuais)
    const t=await ttGarantirShadow(key);
    if(!t)return;
    if(t.urgente===urg&&t.importante===imp)return;
    await db.collection('tarefasPessoais').doc(t.id).update({urgente:urg,importante:imp,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    t.urgente=urg; t.importante=imp;
    ttRenderLista();
}

function ttRenderLista(){
    const cont=document.getElementById('ttLista'); if(!cont)return;
    const k=ttListaAtiva;
    if(k==='eisenhower'){ttRenderEisenhower();ttRenderSelBar();return;}
    const nomeView=k.startsWith('lista:')?k.slice(6):(TT_SMART.find(s=>s.key===k)?.label||'Tarefas');
    const tit=document.getElementById('ttTitulo'); if(tit)tit.textContent=nomeView;
    const lista=ttFiltrar();
    const sub=document.getElementById('ttSubtitulo'); if(sub)sub.textContent=lista.length?`${lista.filter(t=>!t.concluida).length} pendente(s)`:'';
    cont.innerHTML=lista.length?lista.map(ttTarefaHTML).join(''):'<div class="tt-vazio">Nada por aqui ainda. Adicione uma tarefa no campo acima.</div>';
    ttRenderSelBar();
}
function ttRenderSelBar(){
    const bar=document.getElementById('ttSelBar'); if(!bar)return;
    if(!ttSelMode){bar.style.display='none';return;}
    const n=ttSelecionadas.size;
    bar.style.display='flex';
    bar.innerHTML=`<span class="tt-selbar-count">${n} selecionada(s)</span>
        <div style="margin-left:auto;display:flex;gap:0.6rem;">
            <button class="btn-cancelar" onclick="ttToggleSelMode()">Cancelar</button>
            <button class="btn-enviar" ${n?'':'disabled style=\"opacity:0.5;\"'} onclick="ttEnviarSelecionadas()">${ico('arrowRight',{size:14,color:'currentColor'})} Enviar para a Daily de hoje</button>
        </div>`;
}
function ttToggleSelMode(){
    ttSelMode=!ttSelMode; ttSelecionadas.clear();
    const btn=document.getElementById('ttBtnSel'); if(btn)btn.textContent=ttSelMode?'Cancelar seleção':'Enviar p/ Daily';
    ttRenderLista();
}
function ttToggleSelecao(key){
    if(ttSelecionadas.has(key))ttSelecionadas.delete(key); else ttSelecionadas.add(key);
    ttRenderLista();
}
function ttEnviarSelecionadas(){ if(ttSelecionadas.size)ttEnviarParaDaily([...ttSelecionadas]); }

async function ttEnviarParaDaily(keys){
    if(!user.equipe){alert('Você não está vinculada a uma equipe — não é possível enviar para a Daily.');return;}
    const hoje=hojeISO();
    const dailyId=`${user.equipe.replace(/[\/\s]+/g,'_')}_${hoje}`;
    const uni=ttUnificadas();
    const alvos=keys.map(k=>ttFindByKey(k)||uni.find(x=>ttKey(x)===k)).filter(Boolean).filter(t=>!t._daily&&!t.concluida&&t.enviadaDaily!==hoje&&t.id);
    if(!alvos.length){alert('Selecione tarefas pessoais ainda não enviadas (as da Daily já estão lá).');return;}
    try{
        const batch=db.batch();
        alvos.forEach(t=>{
            const ref=db.collection('dailyTarefas').doc();
            batch.set(ref,{dailyId,equipe:user.equipe,data:hoje,tipo:'tarefa',responsavelId:user.id,responsavelNome:user.nome,equipeResponsavel:user.equipe,descricao:t.titulo,status:'pendente',justificativa:'',justificativaAceita:null,crossTeam:false,adiamentos:0,adiadaDe:null,origemTarefaId:null,criadoPorId:user.id,criadoPorNome:user.nome,criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
            batch.update(db.collection('tarefasPessoais').doc(t.id),{enviadaDaily:hoje,dailyTarefaCriadaId:ref.id,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
            t._novoDailyId=ref.id;
        });
        await batch.commit();
        alvos.forEach(t=>{t.enviadaDaily=hoje;t.dailyTarefaCriadaId=t._novoDailyId;});
        try{await carregarDaily();}catch(e){}
        mostrarNotif('',alvos.length+' tarefa(s) enviada(s) para a Daily de hoje','Aparecem agora nas tarefas do dia da sua equipe.','bonus',4500);
    }catch(e){mostrarNotif('','Erro ao enviar para a Daily',e?.message||'Erro inesperado. Tente novamente.','',6000);return;}
    ttSelMode=false; ttSelecionadas.clear();
    const btn=document.getElementById('ttBtnSel'); if(btn)btn.textContent='Enviar p/ Daily';
    renderTarefasPessoais();
}

// ── Exportar PDF de tarefas ──
function ttExportarPDF(periodo){
    if(!window.jspdf){alert('Biblioteca de PDF não carregada. Recarregue a página.');return;}
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF();
    const teal=[30,125,144],dark=[33,73,87],gold=[201,160,90],muted=[100,116,139];
    const hoje=hojeISO();
    // calcular range de datas
    let de=hoje,ate=hoje,labelPeriodo='Hoje';
    if(periodo==='semana'){
        const d=new Date(hoje+'T12:00:00');
        const dow=d.getDay();
        const seg=new Date(d);seg.setDate(d.getDate()-(dow===0?6:dow-1));
        const sex=new Date(seg);sex.setDate(seg.getDate()+6);
        de=seg.toISOString().slice(0,10);ate=sex.toISOString().slice(0,10);
        labelPeriodo=`Semana: ${fmtDataBR(de)} a ${fmtDataBR(ate)}`;
    }else if(periodo==='mes'){
        de=hoje.slice(0,7)+'-01';
        const fim=new Date(parseInt(hoje.slice(0,4)),parseInt(hoje.slice(5,7)),0);
        ate=fim.toISOString().slice(0,10);
        labelPeriodo=`${MESES_NOME[parseInt(hoje.slice(5,7))]} ${hoje.slice(0,4)}`;
    }else if(periodo==='todas'){
        de='2000-01-01';ate='2099-12-31';labelPeriodo='Todas as tarefas';
    }
    // filtrar tarefas
    const todas=ttUnificadas();
    let tarefas;
    if(periodo==='todas'){
        tarefas=ttMostrarConcluidas?todas:todas.filter(t=>!t.concluida);
    }else{
        tarefas=todas.filter(t=>{
            const p=t.prazo||t.criadoEm?.toDate?.()?.toISOString?.()?.slice(0,10)||hoje;
            return p>=de&&p<=ate;
        });
    }
    if(!tarefas.length){alert('Nenhuma tarefa encontrada para o período selecionado.');return;}
    // cabeçalho
    doc.setFillColor(...dark);doc.rect(0,0,210,26,'F');
    doc.setTextColor(255,255,255);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.text('Mirae',14,17);
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Gestor de Tarefas Pessoais',14,23);
    doc.setFillColor(...gold);doc.circle(195,9,4,'F');
    // título
    doc.setTextColor(...dark);doc.setFontSize(13);doc.setFont('helvetica','bold');doc.text('Minhas Tarefas — '+labelPeriodo,14,37);
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(...muted);
    doc.text(`${user?.nome||''} · Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`,14,43);
    // linha separadora
    doc.setDrawColor(...teal);doc.setLineWidth(0.5);doc.line(14,46,196,46);
    let y=52;
    // agrupar por lista
    const porLista={};
    tarefas.forEach(t=>{
        const l=t.lista||'Entrada';
        if(!porLista[l])porLista[l]=[];
        porLista[l].push(t);
    });
    const PRIO_COR={alta:[198,40,40],media:[239,108,0],baixa:[46,125,50]};
    Object.entries(porLista).forEach(([lista,ts])=>{
        if(y>260){doc.addPage();y=15;}
        // título da lista
        doc.setFillColor(...teal);doc.roundedRect(14,y-4,182,8,2,2,'F');
        doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont('helvetica','bold');
        doc.text(lista,16,y+1);y+=10;
        ts.forEach(t=>{
            if(y>272){doc.addPage();y=15;}
            const s=STATUS_TAREFA[t.status||'pendente']||STATUS_TAREFA.pendente;
            // checkbox visual
            doc.setDrawColor(...muted);doc.setLineWidth(0.3);
            doc.roundedRect(16,y-3,4,4,0.5,0.5,'S');
            if(t.concluida){doc.setDrawColor(...teal);doc.line(16.5,y-1,17.5,y);doc.line(17.5,y,19.5,y-3);}
            // título
            doc.setFontSize(9);
            if(t.concluida)doc.setTextColor(...muted);else doc.setTextColor(...dark);
            const linhas=doc.splitTextToSize(t.titulo||'(sem título)',120);
            doc.text(linhas,23,y);
            // prazo
            if(t.prazo){
                doc.setFontSize(7.5);doc.setTextColor(...muted);
                doc.text(fmtDataBR(t.prazo),145,y);
            }
            // prioridade
            if(t.prioridade&&PRIO_COR[t.prioridade]){
                const cor=PRIO_COR[t.prioridade];
                doc.setFillColor(...cor.map(c=>Math.min(255,c+180)));
                doc.roundedRect(162,y-3.5,20,5,1,1,'F');
                doc.setTextColor(...cor);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
                doc.text({alta:'Alta',media:'Média',baixa:'Baixa'}[t.prioridade],163,y);
            }
            // status badge
            doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(...muted);
            doc.text(s.label,185,y,{align:'right'});
            y+=linhas.length*4.5+1;
            // subtarefas
            if(t.subtarefas&&t.subtarefas.length){
                t.subtarefas.forEach(st=>{
                    if(y>272){doc.addPage();y=15;}
                    doc.setFontSize(7.5);doc.setTextColor(...muted);
                    doc.setDrawColor(...muted);doc.setLineWidth(0.2);
                    doc.roundedRect(26,y-2.5,3,3,0.4,0.4,'S');
                    if(st.feita){doc.line(26.3,y-1,27,y-0.3);doc.line(27,y-0.3,28.5,y-2.3);}
                    const stL=doc.splitTextToSize(st.texto||'',155);
                    doc.text(stL,31,y);
                    y+=stL.length*3.8+0.5;
                });
            }
            if(t.notas){
                if(y>272){doc.addPage();y=15;}
                doc.setFontSize(7.5);doc.setTextColor(...muted);doc.setFont('helvetica','italic');
                const notaL=doc.splitTextToSize(t.notas,165);
                doc.text(notaL,23,y);doc.setFont('helvetica','normal');
                y+=notaL.length*3.8+1;
            }
            y+=1.5;
        });
        y+=4;
    });
    // rodapé em todas as páginas
    const np=doc.internal.getNumberOfPages();
    for(let i=1;i<=np;i++){
        doc.setPage(i);doc.setFontSize(7);doc.setTextColor(...muted);
        doc.text(`Mirae · Minhas Tarefas · Pág. ${i}/${np}`,14,290);
    }
    const nomePeriodo={hoje:'Hoje',semana:'Semana',mes:'Mes',todas:'Todas'}[periodo]||periodo;
    doc.save(`Tarefas_${(user?.nome||'').replace(/\s+/g,'_')}_${nomePeriodo}_${hoje}.pdf`);
}

// ── Ações ──
function ttAbrirLista(k){ttListaAtiva=k;renderTarefasPessoais();}
function ttSetSort(v){ttSortBy=v;ttRenderLista();}
function ttToggleConcluidas(){ttMostrarConcluidas=!ttMostrarConcluidas;renderTarefasPessoais();}
function ttNovaLista(){const nome=prompt('Nome da nova lista:');if(!nome||!nome.trim())return;ttListaAtiva='lista:'+nome.trim();renderTarefasPessoais();}

function ttQuickAddKey(ev){if(ev.key!=='Enter')return;const v=ev.target.value.trim();if(!v)return;ev.target.value='';ttAdicionar(v);}
async function ttAdicionar(titulo){
    let lista='Entrada', prazo=null;
    if(ttListaAtiva.startsWith('lista:')){const n=ttListaAtiva.slice(6);if(n!=='Daily')lista=n;}
    if(ttListaAtiva==='hoje')prazo=hojeISO();
    const doc={userId:user.id,origem:'propria',origemTarefaId:null,titulo,equipe:null,notas:'',concluida:false,concluidaEm:null,prazo,prioridade:null,lista,subtarefas:[],recorrencia:null,ordem:Date.now(),criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
    await guardado('ttAdicionar_'+Date.now(), async () => {
        const ref=await db.collection('tarefasPessoais').add(doc);tarefasPessoais.push({id:ref.id,...doc});renderTarefasPessoais();
    });
}

async function ttGarantirShadow(key){
    let t=ttFindByKey(key); if(t)return t;
    if(!key||!key.startsWith('daily:'))return null;
    const oid=key.slice(6); const dt=(dailyTarefas||[]).find(x=>x.id===oid); if(!dt)return null;
    const doc={userId:user.id,origem:'daily',origemTarefaId:oid,titulo:dt.descricao,equipe:dt.equipe||'',notas:'',concluida:false,concluidaEm:null,prazo:dt.data||null,prioridade:null,lista:'Daily',subtarefas:[],recorrencia:null,ordem:Date.now(),criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
    const ref=await db.collection('tarefasPessoais').add(doc); const novo={id:ref.id,...doc}; tarefasPessoais.push(novo); return novo;
}

async function ttToggleConcluir(key){
    const t=await ttGarantirShadow(key); if(!t)return;
    const novo=!t.concluida;
    try{
        await db.collection('tarefasPessoais').doc(t.id).update({concluida:novo,concluidaEm:novo?firebase.firestore.FieldValue.serverTimestamp():null,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        t.concluida=novo; t.concluidaEm=novo?new Date():null;
        if(novo&&t.recorrencia)await ttCriarProximaRecorrencia(t);
    }catch(e){mostrarNotif('','Erro ao atualizar tarefa',e?.message||'Erro inesperado. Tente novamente.','',6000);}
    if(ttDetalheKey&&document.getElementById('ttDetalheOverlay').classList.contains('aberto'))ttRenderDetalhe();
    renderTarefasPessoais();
}

// ── Detalhe ──
function ttAbrirDetalhe(key){ttDetalheKey=key;ttRenderDetalhe();document.getElementById('ttDetalheOverlay').classList.add('aberto');}
function ttFecharDetalhe(){document.getElementById('ttDetalheOverlay').classList.remove('aberto');ttDetalheKey=null;renderTarefasPessoais();}
function ttRenderDetalhe(){
    const box=document.getElementById('ttDetalhe'); if(!box||!ttDetalheKey)return;
    const t=ttFindByKey(ttDetalheKey)||ttUnificadas().find(x=>ttKey(x)===ttDetalheKey);
    if(!t){ttFecharDetalhe();return;}
    const isDaily=!!t._daily;
    const listas=Object.keys(ttListasCustom()); if(!listas.includes('Entrada'))listas.unshift('Entrada');
    box.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
            <div class="tt-d-sec-label" style="margin:0;">${isDaily?'Tarefa da daily':'Tarefa pessoal'}</div>
            <button class="tt-icon-btn" onclick="ttFecharDetalhe()">${ico('x',{size:16})}</button>
        </div>
        <textarea class="tt-d-titulo" rows="2" ${isDaily?'readonly':''} onchange="ttEditarCampo('titulo',this.value)">${esc(t.titulo||'')}</textarea>
        ${isDaily?`<div style="font-size:0.73rem;color:var(--muted);margin-top:0.25rem;">Vinculada à daily de ${esc(t.equipe||'')} — concluir aqui não altera o status oficial da daily.</div>`:''}
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prioridade</div><div class="tt-d-row">
            ${['alta','media','baixa'].map(p=>`<button class="tt-prio-btn ${p} ${t.prioridade===p?'sel':''}" onclick="ttSetPrioridade('${p}')">${ico('flag',{size:13})} ${TT_PRIO[p].label}</button>`).join('')}
            ${t.prioridade?`<button class="tt-prio-btn" onclick="ttSetPrioridade(null)">Limpar</button>`:''}</div></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Matriz de Eisenhower</div>
            <div class="ei-axis">
                <button class="ei-toggle urgente ${t.urgente?'on':''}" onclick="ttSetEisenhower('urgente',${!t.urgente})">${ico(t.urgente?'check':'clock',{size:13})} Urgente</button>
                <button class="ei-toggle importante ${t.importante?'on':''}" onclick="ttSetEisenhower('importante',${!t.importante})">${ico(t.importante?'check':'star',{size:13})} Importante</button>
            </div>
            <div style="font-size:0.71rem;color:var(--muted);margin-top:0.3rem;">${_eiLabel(t.urgente,t.importante)}</div>
        </div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prazo</div><input type="date" class="tt-d-input" value="${t.prazo||''}" onchange="ttEditarCampo('prazo',this.value||null)"></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Lista</div>
            <input list="ttListasDatalist" class="tt-d-input" value="${esc(t.lista||'Entrada')}" ${isDaily?'readonly':''} onchange="ttEditarCampo('lista',this.value||'Entrada')">
            <datalist id="ttListasDatalist">${listas.map(l=>`<option value="${esc(l)}">`).join('')}</datalist></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Repetir</div>
            <select class="tt-d-input" onchange="ttEditarCampo('recorrencia',this.value||null)">
                ${[['','Não repete'],['diaria','Diariamente'],['dias_uteis','Dias úteis (seg–sex)'],['semanal','Semanalmente'],['mensal','Mensalmente']].map(([v,l])=>`<option value="${v}" ${(t.recorrencia||'')===v?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Subtarefas</div>
            <div id="ttSubLista">${(t.subtarefas||[]).map((s,i)=>`<div class="tt-sub-row"><div class="tt-sub-check ${s.feita?'feita':''}" onclick="ttToggleSub(${i})">${s.feita?ico('check',{size:11,color:'#fff'}):''}</div><input value="${esc(s.texto)}" class="${s.feita?'feita':''}" onchange="ttEditarSub(${i},this.value)"><span class="tt-sub-del" onclick="ttRemoverSub(${i})">${ico('x',{size:14})}</span></div>`).join('')}</div>
            <div class="tt-sub-row"><span style="color:var(--teal);display:flex;">${ico('plus',{size:15})}</span><input id="ttNovaSub" placeholder="Adicionar subtarefa..." onkeydown="ttSubKey(event)"></div></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Notas</div><textarea class="tt-d-input" rows="3" placeholder="Detalhes, links, contexto..." onchange="ttEditarCampo('notas',this.value)">${esc(t.notas||'')}</textarea></div>
        ${(!isDaily&&!t.concluida)?`<div class="tt-d-sec">${t.enviadaDaily===hojeISO()
            ?`<div class="tt-chip nadaily" style="font-size:0.76rem;padding:0.3rem 0.7rem;">${ico('check',{size:13})} Já enviada para a Daily de hoje</div>`
            :`<button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="ttEnviarParaDaily(['${jsq(ttDetalheKey)}'])">${ico('arrowRight',{size:15})} Enviar para a Daily de hoje</button>`}</div>`:''}
        ${!isDaily?`<div class="tt-d-sec"><button onclick="ttEnviarParaKanban('${jsq(ttDetalheKey)}')" style="width:100%;padding:0.55rem;background:var(--teal-dim);color:var(--teal);border:none;border-radius:10px;font-size:0.83rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;font-weight:500;">${ico('kanban',{size:15})} Enviar para o Kanban</button></div>`:''}
        <div class="tt-d-sec" style="display:flex;gap:0.6rem;">
            <button class="btn btn-ghost" style="flex:1;" onclick="ttToggleConcluir('${jsq(ttDetalheKey)}')">${t.concluida?'Reabrir tarefa':'Marcar concluída'}</button>
            ${!isDaily?`<button class="btn btn-ghost" style="color:#C62828;border-color:#C62828;" onclick="ttExcluir()" title="Excluir">${ico('trash',{size:15})}</button>`:''}</div>`;
}
async function ttEditarCampo(campo,valor){
    const t=await ttGarantirShadow(ttDetalheKey); if(!t)return;
    try{await db.collection('tarefasPessoais').doc(t.id).update({[campo]:valor,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});}catch(e){mostrarNotif('','Erro ao salvar campo',e?.message||'Erro inesperado.','',6000);return;}
    t[campo]=valor;
    if(ttDetalheKey&&ttDetalheKey.startsWith('daily:'))ttDetalheKey=t.id;
    ttRenderDetalhe(); ttRenderRail(); ttRenderLista();
}
function ttSetPrioridade(p){ttEditarCampo('prioridade',p);}
function ttSubKey(ev){if(ev.key==='Enter'){const v=ev.target.value;ev.target.value='';ttAddSub(v);}}
async function ttAddSub(texto){texto=(texto||'').trim();if(!texto)return;const t=await ttGarantirShadow(ttDetalheKey);if(!t)return;t.subtarefas=t.subtarefas||[];t.subtarefas.push({texto,feita:false});await ttSalvarSubs(t);ttRenderDetalhe();ttRenderLista();}
async function ttToggleSub(i){const t=ttFindByKey(ttDetalheKey);if(!t)return;t.subtarefas[i].feita=!t.subtarefas[i].feita;await ttSalvarSubs(t);ttRenderDetalhe();ttRenderLista();}
async function ttEditarSub(i,v){const t=ttFindByKey(ttDetalheKey);if(!t)return;t.subtarefas[i].texto=v;await ttSalvarSubs(t);}
async function ttRemoverSub(i){const t=ttFindByKey(ttDetalheKey);if(!t)return;t.subtarefas.splice(i,1);await ttSalvarSubs(t);ttRenderDetalhe();ttRenderLista();}
async function ttSalvarSubs(t){try{await db.collection('tarefasPessoais').doc(t.id).update({subtarefas:t.subtarefas,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});}catch(e){mostrarNotif('','Erro ao salvar subtarefas',e?.message||'Erro inesperado.','',6000);}}
async function ttExcluir(){const t=ttFindByKey(ttDetalheKey);if(!t)return;if(!confirm('Excluir esta tarefa?'))return;await guardado('ttExcluir_'+t.id, async () => {await db.collection('tarefasPessoais').doc(t.id).delete();tarefasPessoais=tarefasPessoais.filter(x=>x.id!==t.id);ttFecharDetalhe();});}

function ttProximaData(iso,rec){
    const d=new Date(iso+'T12:00:00');
    if(rec==='diaria')d.setDate(d.getDate()+1);
    else if(rec==='semanal')d.setDate(d.getDate()+7);
    else if(rec==='mensal')d.setMonth(d.getMonth()+1);
    else if(rec==='dias_uteis'){do{d.setDate(d.getDate()+1);}while(d.getDay()===0||d.getDay()===6);}
    else return null;
    return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
async function ttCriarProximaRecorrencia(t){
    const prox=ttProximaData(t.prazo||hojeISO(),t.recorrencia); if(!prox)return;
    const doc={userId:user.id,origem:'propria',origemTarefaId:null,titulo:t.titulo,equipe:null,notas:t.notas||'',concluida:false,concluidaEm:null,prazo:prox,prioridade:t.prioridade||null,lista:(t._daily?'Entrada':(t.lista||'Entrada')),subtarefas:(t.subtarefas||[]).map(s=>({texto:s.texto,feita:false})),recorrencia:t.recorrencia,ordem:Date.now(),criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
    try{const ref=await db.collection('tarefasPessoais').add(doc);tarefasPessoais.push({id:ref.id,...doc});}catch(e){}
}

// dailyView declarado em globals.js
function setDailyView(v){
    dailyView=v;
    const a=document.getElementById('dvDailys'),b=document.getElementById('dvMinhas');
    if(a&&b){
        const on='var(--teal,#1E7D90)';
        a.style.background=v==='dailys'?on:'white';a.style.color=v==='dailys'?'white':'var(--muted)';a.style.fontWeight=v==='dailys'?'600':'400';
        b.style.background=v==='minhas'?on:'white';b.style.color=v==='minhas'?'white':'var(--muted)';b.style.fontWeight=v==='minhas'?'600':'400';
    }
    if(v==='minhas') marcarNotifLidas();
    renderDaily();
}

// MESES_NOME declarado em globals.js
function renderDaily(){
    const cont=document.getElementById('dailyConteudo');if(!cont)return;
    // Atualiza header com squad info
    const squadLbl=document.getElementById('dailySquadLabel');
    if(squadLbl) squadLbl.textContent=user&&user.equipe?user.equipe:'';
    const tabIcon=document.getElementById('dailyTabIcon');
    if(tabIcon) tabIcon.innerHTML=ico('pencil-line',{size:20,color:'#023B48'});
    // Squad card lateral
    const squadCard=document.getElementById('dailySquadCard');
    const squadTitle=document.getElementById('dailySquadTitle');
    const squadProg=document.getElementById('dailySquadProgress');
    const quemCard=document.getElementById('dailyQuemCard');
    const quemList=document.getElementById('dailyQuemList');
    if(user&&user.equipe){
        const equipeColabs=(todosColabs.length?todosColabs:talentos).filter(function(c){return c.equipe===user.equipe&&c.ativo!==false;});
        const hojeStr=hojeISO();
        const dailyHoje=dailys.filter(function(d){return d.data===hojeStr&&d.equipe===user.equipe;});
        const registrados=dailyHoje.length?(dailyHoje[0].presentes||[]):[];
        const total=equipeColabs.length||registrados.length;
        if(squadCard){squadCard.style.display='';if(squadTitle)squadTitle.innerHTML=ico('users',{size:14,color:'#DAB47E'})+' Squad '+esc(user.equipe);if(squadProg)squadProg.textContent=registrados.length+' de '+(total)+' ja registraram a daily de hoje.';}
        const cores=['#023B48','#BE8C45','#3F8A6E','#D98E6A'];
        if(quemCard&&quemList){
            quemCard.style.display='';
            if(equipeColabs.length){
                quemList.innerHTML=equipeColabs.map(function(c,i){
                    const reg=registrados.some(function(r){return r.id===c.id||r.nome===c.nome;});
                    const badgeBg=reg?'#E6F0EB':'#FEF3C7';const badgeFg=reg?'#2F6F58':'#92400E';
                    return '<div class="daily-quem-item"><div class="daily-quem-av" style="background:'+cores[i%4]+';">'+((c.nome||'?')[0].toUpperCase())+'</div><span class="daily-quem-nome">'+esc(c.nome)+'</span><span class="daily-quem-badge" style="background:'+badgeBg+';color:'+badgeFg+';">'+(reg?'Registrou':'Pendente')+'</span></div>';
                }).join('');
            } else if(registrados.length){
                quemList.innerHTML=registrados.map(function(r,i){return '<div class="daily-quem-item"><div class="daily-quem-av" style="background:'+cores[i%4]+';">'+((r.nome||'?')[0].toUpperCase())+'</div><span class="daily-quem-nome">'+esc(r.nome)+'</span><span class="daily-quem-badge" style="background:#E6F0EB;color:#2F6F58;">Registrou</span></div>';}).join('');
            } else {
                quemList.innerHTML='<div style="color:var(--muted);font-size:13.5px;">Nenhum registro hoje ainda.</div>';
            }
        }
    }
    const hoje=new Date();
    // filtros mês/ano
    const mSel=document.getElementById('dailyMes'),aSel=document.getElementById('dailyAno');
    if(mSel&&!mSel.options.length)mSel.innerHTML=MESES_NOME.map((n,i)=>i?`<option value="${String(i).padStart(2,'0')}"${i===hoje.getMonth()+1?' selected':''}>${n}</option>`:'').join('');
    if(aSel&&!aSel.options.length){
        const anos=[...new Set([hoje.getFullYear(),...dailys.map(d=>parseInt(d.data?.slice(0,4)))].filter(Boolean))].sort((a,b)=>b-a);
        aSel.innerHTML=anos.map(a=>`<option value="${a}">${a}</option>`).join('');
    }
    const mes=mSel?.value||String(hoje.getMonth()+1).padStart(2,'0');
    const ano=aSel?.value||String(hoje.getFullYear());
    const prefixo=`${ano}-${mes}`;
    // filtro de equipes — COLABORADOR/LIDER só veem a própria equipe
    const eqSel=document.getElementById('dailyEquipeFiltro');
    let eqFiltro;
    if(P.isRH()){
        if(eqSel&&!eqSel.options.length)eqSel.innerHTML='<option value="">Todas as equipes</option>'+equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
        eqFiltro=eqSel?.value||'';
    }else{
        if(eqSel)eqSel.style.display='none';
        eqFiltro=user?.equipe||'';
    }
    // botão registrar — líder/RH/master
    const btn=document.getElementById('btnNovaDaily');
    if(btn)btn.style.display=(user?.role==='LIDER'||P.isRH())?'':'none';

    // Visão: Minhas Tarefas (do mês, agrupadas por dia) 
    if(dailyView==='minhas'){
        const minhas=dailyTarefas.filter(t=>t.responsavelId===user.id&&t.data?.startsWith(prefixo)).sort((a,b)=>b.data.localeCompare(a.data));
        if(!minhas.length){cont.innerHTML=`<div class="card" style="padding:2rem;text-align:center;color:var(--text-muted);">Nenhuma tarefa sua em ${MESES_NOME[parseInt(mes)]} de ${ano}.</div>`;return;}
        const porDia={};minhas.forEach(t=>{(porDia[t.data]=porDia[t.data]||[]).push(t);});
        cont.innerHTML=Object.entries(porDia).map(([dt,ts])=>`
            <div class="card" style="padding:1.2rem;margin-bottom:1rem;border-left:4px solid var(--teal,#1E7D90);">
                <h3 style="margin:0 0 0.8rem;">Minhas tarefas — ${fmtDataBR(dt)}</h3>
                ${ts.map(t=>linhaTarefaHTML(t,true)).join('')}
            </div>`).join('');
        return;
    }

    // Visão: Dailys do mês (mais recentes primeiro) 
    const doMes=dailys.filter(d=>d.data?.startsWith(prefixo)&&(!eqFiltro||d.equipe===eqFiltro)).sort((a,b)=>b.data.localeCompare(a.data)||a.equipe.localeCompare(b.equipe));
    if(!doMes.length){cont.innerHTML=`<div class="card" style="padding:2rem;text-align:center;color:var(--text-muted);">Nenhuma daily registrada em ${MESES_NOME[parseInt(mes)]} de ${ano}${eqFiltro?' para a equipe '+esc(eqFiltro):''}.</div>`;return;}
    cont.innerHTML=doMes.map(d=>{
        const todas=dailyTarefas.filter(t=>t.dailyId===d.id);
        const tarefas=todas.filter(t=>t.tipo!=='dependencia');
        const deps=todas.filter(t=>t.tipo==='dependencia');
        const porResp={};tarefas.forEach(t=>{(porResp[t.responsavelNome]=porResp[t.responsavelNome]||[]).push(t);});
        const podeEditar=P.isRH()||(user?.role==='LIDER'&&user?.equipe===d.equipe);
        return`<div class="card" style="padding:1.2rem;margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <h3 style="margin:0;">Daily — ${esc(d.equipe)} — ${fmtDataBR(d.data)}</h3>
                <div style="display:flex;align-items:center;gap:0.6rem;">
                    <span style="font-size:0.78rem;color:var(--text-muted);">Conduzida por ${esc(d.liderNome||'')}</span>
                    ${P.isMaster()?`<button class="btn btn-ghost" title="Excluir daily (apenas Master)" style="padding:0.2rem 0.5rem;font-size:0.8rem;color:#C62828;" onclick="excluirDaily('${d.id}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>`:''}
                </div>
            </div>
            <div style="margin:0.8rem 0;font-size:0.85rem;"><strong>Presentes:</strong> ${(d.presentes||[]).map(p=>esc(p.nome)).join(', ')||'—'}</div>
            ${Object.entries(porResp).map(([nome,ts])=>`
                <div style="margin-bottom:0.8rem;">
                    <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.3rem;">${esc(nome)}${ts[0].crossTeam?' <span class="badge" style="background:#FFF3E0;color:#EF6C00;font-size:0.7rem;">outra equipe</span>':''}</div>
                    ${ts.map(t=>linhaTarefaHTML(t,podeEditar||t.responsavelId===user.id)).join('')}
                </div>`).join('')}
            ${deps.length?`<div style="margin-top:0.8rem;padding:0.8rem;background:#FFF8E1;border-radius:var(--radius-sm);">
                <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.4rem;">Dependências</div>
                ${deps.map(t=>`<div style="margin-bottom:0.3rem;">${linhaTarefaHTML(t,podeEditar||t.responsavelId===user.id)}</div>`).join('')}
            </div>`:''}
            ${d.bloqueios?`<div style="margin-top:0.5rem;padding:0.8rem;background:#FFF8E1;border-radius:var(--radius-sm);font-size:0.85rem;"><strong>Bloqueios gerais:</strong> ${esc(d.bloqueios)}</div>`:''}
            ${d.ajuda?`<div style="margin-top:0.5rem;padding:0.8rem;background:#E3F2FD;border-radius:var(--radius-sm);font-size:0.85rem;"><strong>Ajuda:</strong> ${esc(d.ajuda)}</div>`:''}
        </div>`;
    }).join('');
    setTimeout(reemplazarEmojisEnDOM,100); // Reemplaza emojis após renderizar
}

function linhaTarefaHTML(t,podeAtualizar){
    const s=STATUS_TAREFA[t.status]||STATUS_TAREFA.pendente;
    const podeReatribuir=podeAtualizar&&(P.isLider()||P.isRH()||P.isMaster());
    const colabs=(dailyColabs.length?dailyColabs:talentos).filter(c=>c.ativo!==false);
    const optsResp=colabs.map(c=>`<option value="${c.id}" data-nome="${esc(c.nome)}" data-eq="${esc(c.equipe||'')}" ${c.id===t.responsavelId?'selected':''}>${esc(c.nome)}</option>`).join('');
    return`<div style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;padding:0.5rem 0.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.4rem;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
            <span style="font-size:0.85rem;">${esc(t.descricao)}</span>
            ${t.justificativa?`<div style="font-size:0.75rem;color:#C62828;margin-top:0.2rem;">${esc(t.justificativa)}</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            ${podeReatribuir?`<select title="Reatribuir responsável" onchange="reatribuirTarefa('${t.id}',this)" style="padding:0.25rem 0.4rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.75rem;max-width:140px;">${optsResp}</select>`
            :`<span style="font-size:0.78rem;color:var(--muted);">${esc(t.responsavelNome||'')}</span>`}
            <span class="badge" style="background:${s.cor}22;color:${s.cor};font-size:0.72rem;white-space:nowrap;">${s.label}</span>
            ${podeAtualizar?`<select onchange="setStatusTarefa('${t.id}',this.value)" style="padding:0.25rem 0.4rem;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.75rem;">
                <option value="">Alterar status...</option>
                <option value="andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="nao_realizada">Não Realizada</option>
            </select>`:''}
        </div>
    </div>`;
}

async function reatribuirTarefa(id,sel){
    const op=sel.options[sel.selectedIndex];
    const novoResp=sel.value, novoNome=op?.dataset?.nome||'', novoEq=op?.dataset?.eq||'';
    if(!novoResp)return;
    try{
        await db.collection('dailyTarefas').doc(id).update({responsavelId:novoResp,responsavelNome:novoNome,equipeResponsavel:novoEq,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        const t=dailyTarefas.find(x=>x.id===id);
        if(t){t.responsavelId=novoResp;t.responsavelNome=novoNome;t.equipeResponsavel=novoEq;}
        renderDaily();
    }catch(e){mostrarNotif('','Erro ao reatribuir tarefa',e?.message||'Erro inesperado. Tente novamente.','',6000);}
}

async function setStatusTarefa(id,status){
    if(!status)return;
    if(status==='nao_realizada'){
        document.getElementById('mjTarefaId').value=id;
        document.getElementById('mjTexto').value='';
        document.getElementById('modalJustificativa').style.display='block';
        return;
    }
    try{
        const upd={status,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
        if(status==='concluida')upd.concluidaEmData=hojeISO();
        await db.collection('dailyTarefas').doc(id).update(upd);
        const t=dailyTarefas.find(x=>x.id===id);if(t){t.status=status;if(status==='concluida')t.concluidaEmData=upd.concluidaEmData;}
        renderDaily();
    }catch(e){mostrarNotif('','Erro ao atualizar tarefa',e?.message||'Erro inesperado. Tente novamente.','',6000);}
}

async function excluirDaily(id){
    if(!P.isMaster())return;
    const d=dailys.find(x=>x.id===id);if(!d)return;
    if(!confirm(`Excluir a daily da equipe ${d.equipe} de ${fmtDataBR(d.data)}?\nTodas as tarefas e dependências dela serão removidas. Esta ação não pode ser desfeita.`))return;
    try{
        const batch=db.batch();
        dailyTarefas.filter(t=>t.dailyId===id).forEach(t=>batch.delete(db.collection('dailyTarefas').doc(t.id)));
        batch.delete(db.collection('dailys').doc(id));
        await batch.commit();
        dailys=dailys.filter(x=>x.id!==id);
        dailyTarefas=dailyTarefas.filter(t=>t.dailyId!==id);
        renderDaily();
    }catch(e){mostrarNotif('','Erro ao excluir daily',e?.message||'Erro inesperado. Tente novamente.','',6000);}
}

async function confirmarJustificativa(){
    const id=document.getElementById('mjTarefaId').value;
    const just=document.getElementById('mjTexto').value.trim();
    if(!just){alert('A justificativa é obrigatória para cancelar/não realizar a tarefa.');return;}
    await guardado('confirmarJust_'+id, async () => {
        await db.collection('dailyTarefas').doc(id).update({status:'nao_realizada',justificativa:just,justificativaAceita:null,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        const t=dailyTarefas.find(x=>x.id===id);if(t){t.status='nao_realizada';t.justificativa=just;t.justificativaAceita=null;}
        closeModal('modalJustificativa');
        renderDaily();
    });
}

// Modal de registro 
function openModalDaily(){
    if(!(user?.role==='LIDER'||P.isRH()))return;
    const eq=user?.role==='LIDER'?user.equipe:(document.getElementById('dailyEquipeFiltro')?.value||user.equipe);
    if(!eq){alert('Selecione uma equipe no filtro antes de registrar a daily.');return;}
    document.getElementById('mdEquipeNome').textContent=eq;
    document.getElementById('modalDaily').dataset.equipe=eq;
    document.getElementById('mdData').value=hojeISO();
    document.getElementById('mdBloqueios').value='';
    document.getElementById('mdAjuda').value='';
    document.getElementById('mdMsg').innerHTML='';
    // presentes: membros da equipe
    const membros=(dailyColabs.length?dailyColabs:talentos).filter(c=>c.equipe===eq);
    document.getElementById('mdPresentes').innerHTML=membros.map(m=>
        `<label style="display:flex;align-items:center;gap:0.3rem;padding:0.3rem 0.7rem;border:1.5px solid var(--border);border-radius:20px;font-size:0.8rem;cursor:pointer;">
            <input type="checkbox" value="${m.id}" data-nome="${esc(m.nome)}" checked> ${esc(m.nome)}
        </label>`).join('')||'<span style="color:var(--text-muted);font-size:0.8rem;">Nenhum membro encontrado.</span>';
    // última daily como checklist de revisão (status + mover para hoje)
    renderOntemModal(eq);
    document.getElementById('mdTarefas').innerHTML='';
    document.getElementById('mdDeps').innerHTML='';
    // limpa aviso de sessão anterior
    const avisoAnterior=document.getElementById('mdAvisoExistentes');
    if(avisoAnterior)avisoAnterior.remove();
    // pré-carrega tarefas já enviadas para a daily de hoje (ex: via Minhas Tarefas)
    const hoje=hojeISO();
    const jaSubmitidas=(dailyTarefas||[]).filter(t=>t.equipe===eq&&t.data===hoje&&t.tipo==='tarefa');
    if(jaSubmitidas.length){
        jaSubmitidas.forEach(t=>addLinhaTarefa(t.descricao,t.responsavelId,{existingId:t.id,adiamentos:t.adiamentos||0,adiadaDe:t.adiadaDe||null}));
        const aviso=document.createElement('div');
        aviso.style.cssText='font-size:0.75rem;color:var(--teal,#1E7D90);margin-bottom:0.5rem;padding:0.3rem 0.6rem;background:rgba(30,125,144,0.07);border-radius:var(--radius-sm);';
        aviso.textContent=jaSubmitidas.length+' tarefa(s) já registrada(s) para hoje aparecem acima — você pode editar o responsável antes de confirmar.';
        document.getElementById('mdTarefas').insertAdjacentElement('beforebegin',aviso);
        aviso.id='mdAvisoExistentes';
    }
    addLinhaTarefa(); // linha em branco para novas entregas
    document.getElementById('modalDaily').style.display='block';
}

// Data da última daily registrada antes da data selecionada (cobre fim de semana/feriado)
function ultimaDataDaily(eq,antesDe){
    const datas=dailyTarefas.filter(t=>t.equipe===eq&&t.data<antesDe).map(t=>t.data);
    return datas.length?datas.sort().pop():null;
}

function renderOntemModal(eq){
    const dataSel=document.getElementById('mdData').value||hojeISO();
    const ultima=ultimaDataDaily(eq,dataSel);
    const w=document.getElementById('mdOntemWrapper');
    const pend=ultima?dailyTarefas.filter(t=>t.equipe===eq&&t.data===ultima):[];
    if(!pend.length){
        document.getElementById('mdOntem').innerHTML='<div style="font-size:0.8rem;color:var(--text-muted);padding:0.4rem 0;">Nenhuma daily anterior encontrada para esta equipe. Use o botão "Importar" após registrar a primeira.</div>';
        return;
    }
    w.querySelector('label').innerHTML=`Tarefas de Ontem (${fmtDataBR(ultima)})`;
    document.getElementById('mdOntem').innerHTML=pend.map(t=>linhaOntemHTML(t)).join('');
}

function importarTarefasOntem(){
    const eq=document.getElementById('modalDaily').dataset.equipe;
    renderOntemModal(eq);
    const z=document.getElementById('mdOntem');
    z.style.outline='2px solid var(--gold,#C9A05A)';setTimeout(()=>z.style.outline='',1200);
}

function linhaOntemHTML(t){
    return`<div data-revisao="${t.id}" data-status="${t.status}" data-just="${esc(t.justificativa||'')}" draggable="true" ondragstart="dragTarefaOntem(event,'${t.id}')"
        style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.8rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.35rem;cursor:grab;background:var(--cream,#FAF7F2);">
        <input type="checkbox" ${t.status==='concluida'?'checked':''} onchange="marcarOntem('${t.id}',this.checked?'concluida':'pendente')" title="Concluída" style="width:1.1rem;height:1.1rem;cursor:pointer;accent-color:#2E7D32;">
        <span class="ontem-desc" style="font-size:0.82rem;flex:1;${t.status==='concluida'?'text-decoration:line-through;opacity:0.6;':''}">
            <strong>${esc(t.responsavelNome)}</strong>: ${esc(t.descricao)}
            <span class="ontem-badge" style="margin-left:0.4rem;font-size:0.7rem;color:${(STATUS_TAREFA[t.status]||{}).cor||'#9CA3AF'};">${(STATUS_TAREFA[t.status]||STATUS_TAREFA.pendente).label}</span>
        </span>
        <button class="btn btn-ghost" title="Em andamento" style="padding:0.15rem 0.45rem;font-size:0.8rem;" onclick="marcarOntem('${t.id}','andamento')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
        <button class="btn btn-ghost" title="Não realizada (com justificativa)" style="padding:0.15rem 0.45rem;font-size:0.8rem;" onclick="marcarOntem('${t.id}','nao_realizada')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        <button class="btn btn-ghost" title="Transportar para as Tarefas de Hoje (pode delegar a outra pessoa)" style="padding:0.15rem 0.45rem;font-size:0.78rem;" onclick="levarParaHoje('${t.id}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <button class="btn btn-ghost" title="Transportar para Dependências (mencione quem precisa resolver)" style="padding:0.15rem 0.45rem;font-size:0.78rem;" onclick="levarParaDependencia('${t.id}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1M15 12a3 3 0 0 1-3 3H9a3 3 0 0 1 0-6h1"/></svg></button>
        <button class="btn btn-ghost" title="Transportar para Bloqueios gerais" style="padding:0.15rem 0.45rem;font-size:0.78rem;" onclick="levarParaBloqueio('${t.id}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg></button>
    </div>`;
}

function marcarOntem(id,status){
    const row=document.querySelector(`#mdOntem [data-revisao="${id}"]`);if(!row)return;
    if(status==='nao_realizada'){
        const just=prompt('Por que a tarefa não foi realizada? (justificativa OBRIGATÓRIA — fica registrada no dashboard)','');
        if(!just||!just.trim()){alert('A justificativa é obrigatória. A tarefa não foi marcada como não realizada.');return;}
        row.dataset.just=just.trim();
    }
    row.dataset.status=status;
    const t=dailyTarefas.find(x=>x.id===id);
    const s=STATUS_TAREFA[status]||STATUS_TAREFA.pendente;
    row.querySelector('input[type=checkbox]').checked=status==='concluida';
    const desc=row.querySelector('.ontem-desc');
    desc.style.textDecoration=status==='concluida'?'line-through':'';
    desc.style.opacity=status==='concluida'?'0.6':'1';
    row.querySelector('.ontem-badge').textContent=s.label;
    row.querySelector('.ontem-badge').style.color=s.cor;
}

function dragTarefaOntem(ev,id){ev.dataTransfer.setData('text/tarefa-id',id);}
function levarParaHoje(id){
    const t=dailyTarefas.find(x=>x.id===id);if(!t)return;
    // evita duplicar se já moveu
    const jaTem=[...document.querySelectorAll('#mdTarefas .md-desc')].some(i=>i.value.trim()===t.descricao);
    if(!jaTem)addLinhaTarefa(t.descricao,t.responsavelId,{origemId:t.id,adiamentos:(t.adiamentos||0)+1,adiadaDe:t.data}); // responsável editável = pode re-delegar
    const row=document.querySelector(`#mdOntem [data-revisao="${id}"]`);
    if(row){row.style.opacity='0.45';row.querySelector('.ontem-badge').textContent='movida para hoje';}
    const linha=document.querySelector('#mdTarefas > div:last-child');
    if(linha){linha.style.outline='2px solid var(--gold,#C9A05A)';setTimeout(()=>linha.style.outline='',1200);}
}
function addLinhaDependencia(texto='',pessoaId=''){
    const eq=document.getElementById('modalDaily').dataset.equipe;
    const div=document.createElement('div');
    div.style.cssText='display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;';
    div.innerHTML=`
        <select class="md-dep-resp" style="padding:0.45rem 0.6rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.8rem;max-width:220px;">${selectResponsavelHTML(eq)}</select>
        <input class="md-dep-desc" type="text" placeholder="Dependemos de quê? Descreva..." value="${esc(texto)}" style="flex:1;padding:0.45rem 0.6rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.8rem;">
        <button class="btn btn-ghost" onclick="this.parentElement.remove()" style="padding:0.3rem 0.6rem;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    document.getElementById('mdDeps').appendChild(div);
    if(pessoaId)div.querySelector('.md-dep-resp').value=pessoaId;
}
function levarParaDependencia(id){
    const t=dailyTarefas.find(x=>x.id===id);if(!t)return;
    addLinhaDependencia(t.descricao,t.responsavelId);
    const z=document.getElementById('mdDeps');
    z.style.outline='2px solid var(--gold,#C9A05A)';setTimeout(()=>z.style.outline='',1200);
}
function levarParaBloqueio(id){
    const t=dailyTarefas.find(x=>x.id===id);if(!t)return;
    const ta=document.getElementById('mdBloqueios');
    ta.value=(ta.value?ta.value+'\n':'')+`${t.descricao} (pendente de ${t.responsavelNome})`;
    ta.style.outline='2px solid var(--gold,#C9A05A)';setTimeout(()=>ta.style.outline='',1200);
}
function dropEmHoje(ev){ev.preventDefault();const id=ev.dataTransfer.getData('text/tarefa-id');if(id)levarParaHoje(id);}
function dropEmDependencia(ev){ev.preventDefault();const id=ev.dataTransfer.getData('text/tarefa-id');if(id)levarParaDependencia(id);}

function selectResponsavelHTML(eq){
    const lista=dailyColabs.length?dailyColabs:talentos;
    const daEquipe=lista.filter(c=>c.equipe===eq);
    const outras={};lista.filter(c=>c.equipe!==eq).forEach(c=>{(outras[c.equipe]=outras[c.equipe]||[]).push(c);});
    return`<option value="">Responsável...</option>
        <optgroup label="${esc(eq)}">${daEquipe.map(c=>`<option value="${c.id}" data-nome="${esc(c.nome)}" data-eq="${esc(c.equipe)}">${esc(c.nome)}</option>`).join('')}</optgroup>
        ${Object.entries(outras).map(([e,cs])=>`<optgroup label="${esc(e)} (outra equipe)">${cs.map(c=>`<option value="${c.id}" data-nome="${esc(c.nome)}" data-eq="${esc(c.equipe)}">${esc(c.nome)}</option>`).join('')}</optgroup>`).join('')}`;
}

function addLinhaTarefa(desc='',respId='',meta={}){
    const eq=document.getElementById('modalDaily').dataset.equipe;
    const div=document.createElement('div');
    div.style.cssText='display:flex;gap:0.5rem;margin-bottom:0.4rem;align-items:center;';
    // metadados de adiamento (quando a tarefa veio de um dia anterior)
    if(meta.origemId)div.dataset.origemId=meta.origemId;
    if(meta.adiamentos)div.dataset.adiamentos=meta.adiamentos;
    if(meta.adiadaDe)div.dataset.adiadaDe=meta.adiadaDe;
    // tarefa já existente no Firestore (enviada via Minhas Tarefas)
    if(meta.existingId)div.dataset.existingId=meta.existingId;
    const selo=meta.adiamentos?`<span title="Tarefa adiada ${meta.adiamentos}x" style="font-size:0.68rem;font-weight:700;color:#C62828;background:#FFEBEE;border-radius:10px;padding:0.1rem 0.45rem;white-space:nowrap;">${meta.adiamentos}x</span>`:'';
    div.innerHTML=`
        <select class="md-resp" style="padding:0.45rem 0.6rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.8rem;max-width:220px;">${selectResponsavelHTML(eq)}</select>
        <input class="md-desc" type="text" placeholder="Descrição da entrega..." value="${esc(desc)}" style="flex:1;padding:0.45rem 0.6rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.8rem;">
        ${selo}
        <button class="btn btn-ghost" onclick="this.parentElement.remove()" style="padding:0.3rem 0.6rem;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    document.getElementById('mdTarefas').appendChild(div);
    if(respId)div.querySelector('.md-resp').value=respId;
}

function importarPendenciasOntem(silencioso){
    const eq=document.getElementById('modalDaily').dataset.equipe;
    const ultima=ultimaDataDaily(eq,document.getElementById('mdData').value||hojeISO());
    const pend=ultima?dailyTarefas.filter(t=>t.equipe===eq&&t.data===ultima&&['pendente','andamento'].includes(t.status)):[];
    if(!pend.length){if(!silencioso)alert('Nenhuma pendência da última daily para importar.');return;}
    // remove linhas vazias e evita duplicar descrições já importadas
    document.querySelectorAll('#mdTarefas .md-desc').forEach(i=>{if(!i.value.trim())i.closest('div').remove();});
    const jaTem=[...document.querySelectorAll('#mdTarefas .md-desc')].map(i=>i.value.trim());
    pend.filter(t=>!jaTem.includes(t.descricao)).forEach(t=>addLinhaTarefa(t.descricao,t.responsavelId));
}

async function salvarDaily(){
    const eq=document.getElementById('modalDaily').dataset.equipe;
    const data=document.getElementById('mdData').value;
    const msg=document.getElementById('mdMsg');
    if(!data){msg.innerHTML='<div class="badge badge-danger">Informe a data.</div>';return;}
    const presentes=[...document.querySelectorAll('#mdPresentes input:checked')].map(i=>({id:i.value,nome:i.dataset.nome}));
    const todasLinhas=[...document.querySelectorAll('#mdTarefas > div')].map(d=>{
        const sel=d.querySelector('.md-resp');const op=sel.options[sel.selectedIndex];
        return{respId:sel.value,respNome:op?.dataset?.nome||'',respEq:op?.dataset?.eq||'',desc:d.querySelector('.md-desc').value.trim(),
               adiamentos:parseInt(d.dataset.adiamentos||'0',10),adiadaDe:d.dataset.adiadaDe||null,origemId:d.dataset.origemId||null,
               existingId:d.dataset.existingId||null};
    });
    // menção obrigatória: tarefa com texto mas sem pessoa não passa
    if(todasLinhas.some(l=>l.desc&&!l.respId)){msg.innerHTML='<div class="badge badge-danger">Toda tarefa precisa mencionar um responsável. Selecione a pessoa.</div>';return;}
    const depsSemPessoa=[...document.querySelectorAll('#mdDeps > div')].some(d=>d.querySelector('.md-dep-desc').value.trim()&&!d.querySelector('.md-dep-resp').value);
    if(depsSemPessoa){msg.innerHTML='<div class="badge badge-danger">Toda dependência precisa mencionar quem vai resolver. Selecione a pessoa.</div>';return;}
    const linhas=todasLinhas.filter(l=>l.respId&&l.desc);
    if(!linhas.length){msg.innerHTML='<div class="badge badge-danger">Adicione pelo menos uma tarefa com responsável e descrição.</div>';return;}
    if(_opEmAndamento.has('salvarDaily')){return;}
    try{
        const dailyId=`${eq.replace(/[\/\s]+/g,'_')}_${data}`;
        _opEmAndamento.add('salvarDaily');
        const batch=db.batch();
        batch.set(db.collection('dailys').doc(dailyId),{
            equipe:eq,data,liderId:user.id,liderNome:user.nome,presentes,
            bloqueios:document.getElementById('mdBloqueios').value.trim(),
            ajuda:document.getElementById('mdAjuda').value.trim(),
            criadoEm:firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
        // revisão de ontem (checklist)
        document.querySelectorAll('#mdOntem [data-revisao]').forEach(row=>{
            const t=dailyTarefas.find(x=>x.id===row.dataset.revisao);
            const novo=row.dataset.status, just=row.dataset.just||'';
            if(t&&(t.status!==novo||(t.justificativa||'')!==just)){
                const upd={status:novo,justificativa:just,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
                if(novo==='concluida'&&!t.concluidaEmData){upd.concluidaEmData=hojeISO();t.concluidaEmData=upd.concluidaEmData;}
                batch.update(db.collection('dailyTarefas').doc(t.id),upd);
                t.status=novo;t.justificativa=just;
            }
        });
        // dependências com menção (a pessoa mencionada é notificada)
        [...document.querySelectorAll('#mdDeps > div')].forEach(d=>{
            const sel=d.querySelector('.md-dep-resp');const op=sel.options[sel.selectedIndex];
            const desc=d.querySelector('.md-dep-desc').value.trim();
            if(!sel.value||!desc)return;
            const ref=db.collection('dailyTarefas').doc();
            batch.set(ref,{
                dailyId,equipe:eq,data,tipo:'dependencia',
                responsavelId:sel.value,responsavelNome:op?.dataset?.nome||'',equipeResponsavel:op?.dataset?.eq||'',
                descricao:desc,status:'pendente',justificativa:'',justificativaAceita:null,
                crossTeam:(op?.dataset?.eq||'')!==eq,
                criadoPorId:user.id,criadoPorNome:user.nome,
                criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
                atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        // novas tarefas (ou atualização de tarefas já existentes)
        linhas.forEach(l=>{
            if(l.existingId){
                // tarefa já existe (enviada via Minhas Tarefas) — só atualiza responsável e dailyId
                batch.update(db.collection('dailyTarefas').doc(l.existingId),{
                    dailyId,responsavelId:l.respId,responsavelNome:l.respNome,equipeResponsavel:l.respEq,
                    crossTeam:l.respEq!==eq,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
                });
                return;
            }
            // evita criar duplicata se a tarefa já existe no Firestore para este daily
            if(dailyTarefas.some(t=>t.dailyId===dailyId&&t.tipo==='tarefa'&&t.descricao===l.desc&&t.responsavelId===l.respId))return;
            const ref=db.collection('dailyTarefas').doc();
            batch.set(ref,{
                dailyId,equipe:eq,data,tipo:'tarefa',
                responsavelId:l.respId,responsavelNome:l.respNome,equipeResponsavel:l.respEq,
                descricao:l.desc,status:'pendente',justificativa:'',justificativaAceita:null,
                crossTeam:l.respEq!==eq,
                adiamentos:l.adiamentos||0,adiadaDe:l.adiadaDe||null,origemTarefaId:l.origemId||null,
                criadoPorId:user.id,criadoPorNome:user.nome,
                criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
                atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        _opEmAndamento.delete('salvarDaily');
        msg.innerHTML='<div class="badge badge-success">Daily registrada!</div>';
        setTimeout(()=>{closeModal('modalDaily');carregarDaily();},900);
    }catch(e){
        _opEmAndamento.delete('salvarDaily');
        const codErr=e?.code||'';
        const textoErr=codErr==='permission-denied'
            ?'Sem permissão. Verifique seu acesso.'
            :(e.message||'Erro inesperado');
        msg.innerHTML='<div class="badge badge-danger">Erro: '+esc(textoErr)+'</div>';
    }
}

// notificação in-app de tarefas delegadas por outras equipes
function verificarTarefasDelegadas(){
    const minhas=dailyTarefas.filter(t=>t.responsavelId===user.id&&t.status==='pendente'
        &&(t.crossTeam||t.tipo==='dependencia')&&t.criadoPorId!==user.id);
    minhas.forEach(t=>{
        const chave='notif_tarefa_'+user.id+'_'+t.id;
        if(localStorage.getItem(chave))return;
        localStorage.setItem(chave,'1');
        const titulo=t.tipo==='dependencia'?'Você foi mencionado(a) em uma dependência!':'Tarefa delegada para você!';
        setTimeout(()=>mostrarNotif('',titulo,'A equipe '+t.equipe+' citou você na daily de '+fmtDataBR(t.data)+': "'+t.descricao+'"','',8000),600);
    });
}

// Dashboard de execução 
// Helpers do dashboard de dailys 
const DD_PERIODO_OPTS=`<option value="semana">Semana</option><option value="mes" selected>Mês</option><option value="ano">Ano</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="tudo">Tudo</option>`;

function ddLimiteISO(periodo){
    if(periodo==='tudo')return '2000-01-01';
    const h=new Date();let l;
    if(periodo==='semana'){l=new Date(h);const dow=(h.getDay()+6)%7;l.setDate(h.getDate()-dow);}
    else if(periodo==='mes'){l=new Date(h.getFullYear(),h.getMonth(),1);}
    else if(periodo==='ano'){l=new Date(h.getFullYear(),0,1);}
    else{l=new Date(h);l.setDate(h.getDate()-parseInt(periodo,10));}
    return new Date(l.getTime()-l.getTimezoneOffset()*60000).toISOString().slice(0,10);
}

function ddFillEquipe(id){
    const s=document.getElementById(id);if(!s)return;
    if(!P.isRH()){s.style.display='none';return;} // COLABORADOR/LIDER: travado na própria
    if(!s.options.length)s.innerHTML='<option value="">Todas equipes</option>'+equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
}
function ddFillPessoa(id){
    const s=document.getElementById(id);if(!s||s.options.length)return;
    const fonte=P.isRH()?dailyTarefas:dailyTarefas.filter(t=>t.equipe===user.equipe||t.equipeResponsavel===user.equipe);
    const pessoas=[...new Map(fonte.map(t=>[t.responsavelId,t.responsavelNome])).entries()];
    s.innerHTML='<option value="">Todas pessoas</option>'+pessoas.map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join('');
}

function ddPopulaSelects(){
    ['ddEqPeriodo','ddDiaPeriodo','ddColabPeriodo','ddPartPeriodo','ddAdesaoPeriodo','ddAdiaPeriodo','ddInterPeriodo','ddJustPeriodo'].forEach(id=>{
        const s=document.getElementById(id);if(s&&!s.options.length)s.innerHTML=DD_PERIODO_OPTS;
    });
    ['ddEqEquipe','ddDiaEquipe','ddColabEquipe','ddPartEquipe','ddAdesaoEquipe','ddAdiaEquipe','ddInterEquipe','ddJustEquipe'].forEach(ddFillEquipe);
    ['ddEqPessoa','ddDiaPessoa','ddColabPessoa','ddPartPessoa','ddAdesaoPessoa','ddAdiaPessoa','ddInterPessoa','ddJustPessoa'].forEach(ddFillPessoa);
}

// Filtra as tarefas conforme os seletores de UM gráfico (respeitando acesso)
function ddTarefas(periodoId,equipeId,pessoaId){
    const periodo=document.getElementById(periodoId)?.value||'mes';
    const limiteISO=ddLimiteISO(periodo);
    let eqF=equipeId?(document.getElementById(equipeId)?.value||''):'';
    if(!P.isRH())eqF=user?.equipe||'';
    let ts=dailyTarefas.filter(t=>t.data>=limiteISO);
    if(eqF)ts=ts.filter(t=>t.equipe===eqF||t.equipeResponsavel===eqF);
    // Colaborador comum: vê apenas as próprias tarefas (auto-análise)
    if(user?.role==='COLABORADOR')ts=ts.filter(t=>t.responsavelId===user.id);
    if(pessoaId){const p=document.getElementById(pessoaId)?.value||'';if(p)ts=ts.filter(t=>t.responsavelId===p);}
    return{ts,limiteISO,eqF};
}

function iniciarListenerNotificacoes(){
    if(!user?.id) return;
    registrarListener('notificacoes_daily', db.collection('notificacoes').doc(user.id).collection('items')
        .where('lida','==',false)
        .onSnapshot(snap=>{
            const count=snap.size;
            const bell=document.getElementById('dailyNotifBell');
            const badge=document.getElementById('dailyNotifBadge');
            if(!bell||!badge) return;
            if(count>0){
                bell.style.display='flex';
                badge.textContent=count>9?'9+':String(count);
            }else{
                bell.style.display='none';
                badge.textContent='';
            }
        },()=>{})
    );
}

async function marcarNotifLidas(){
    if(!user?.id) return;
    try{
        const snap=await db.collection('notificacoes').doc(user.id).collection('items')
            .where('lida','==',false).get();
        if(snap.empty) return;
        const batch=db.batch();
        snap.docs.forEach(d=>batch.update(d.ref,{lida:true}));
        await batch.commit();
    }catch(e){}
}

// ── Materializa tarefa virtual (daily sem shadow) em tarefasPessoais ──
async function ttGarantirShadow(key){
    let t=ttFindByKey(key)||ttUnificadas().find(x=>ttKey(x)===key);
    if(!t)return null;
    if(t.id)return t; // já tem doc real
    // é virtual: cria shadow
    const doc={userId:user.id,origem:'daily',origemTarefaId:t.origemTarefaId,titulo:t.titulo,equipe:t.equipe||null,notas:'',concluida:false,concluidaEm:null,prazo:t.prazo||null,prioridade:null,lista:'Daily',subtarefas:[],recorrencia:null,urgente:null,importante:null,ordem:Date.now(),criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()};
    const ref=await db.collection('tarefasPessoais').add(doc);
    const shadow={id:ref.id,...doc,_daily:true};
    tarefasPessoais.push(shadow);
    return shadow;
}

// ── Enviar tarefa para o Kanban ──
async function ttEnviarParaKanban(key){
    const boards=kanbanBoards||[];
    if(!boards.length){mostrarNotif('','Nenhum quadro Kanban encontrado','Crie um quadro no Kanban antes de enviar.','',5000);return;}
    const t=ttFindByKey(key)||ttUnificadas().find(x=>ttKey(x)===key);
    if(!t)return;
    // Seleciona quadro e coluna
    const boardOpts=boards.map((b,i)=>`${i}: ${b.nome||b.titulo||'Quadro '+(i+1)}`).join('\n');
    const bIdx=parseInt(prompt(`Escolha o quadro (número):\n${boardOpts}`));
    if(isNaN(bIdx)||!boards[bIdx])return;
    const board=boards[bIdx];
    const cols=board.colunas||board.cols||[];
    if(!cols.length){mostrarNotif('','Quadro sem colunas','Adicione colunas ao quadro antes de enviar.','',5000);return;}
    const colOpts=cols.map((c,i)=>`${i}: ${c.nome||c.titulo||'Coluna '+(i+1)}`).join('\n');
    const cIdx=parseInt(prompt(`Escolha a coluna:\n${colOpts}`));
    if(isNaN(cIdx)||!cols[cIdx])return;
    const col=cols[cIdx];
    try{
        await db.collection('kbCards').add({boardId:board.id,colId:col.id,titulo:t.titulo,descricao:t.notas||'',responsavelId:user.id,responsavelNome:user.nome,prioridade:t.prioridade||null,prazo:t.prazo||null,tags:[],checklist:[],criadoPorId:user.id,criadoPorNome:user.nome,criadoEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        mostrarNotif('','Tarefa enviada para o Kanban!',`"${t.titulo}" foi adicionada à coluna "${col.nome||col.titulo||'Coluna'}" no quadro "${board.nome||board.titulo||'Quadro'}".`,'bonus',4000);
    }catch(e){mostrarNotif('','Erro ao enviar','Tente novamente.','',5000);}
}

// ── Mural de reconhecimento: enviar kudo ──
async function enviarKudo(){
    const paraEl=document.getElementById('muralParaInput');
    const textoEl=document.getElementById('muralTextoInput');
    const pubEl=document.getElementById('muralPublicoToggle');
    const para=(paraEl?.value||'').trim();
    const texto=(textoEl?.value||'').trim();
    if(!para){paraEl?.focus();return;}
    if(!texto){textoEl?.focus();return;}
    const publico=pubEl?pubEl.checked:true;
    try{
        await db.collection('kudos').add({
            de:user.id,deNome:user.nome,para,paraNome:para,
            texto,publico,
            quando:new Date().toLocaleDateString('pt-BR'),
            criadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        if(paraEl)paraEl.value='';
        if(textoEl)textoEl.value='';
        mostrarNotif('','Reconhecimento enviado!',`"${para}" foi reconhecido(a).`,'bonus',4000);
        // Recarrega feed
        const snap=await db.collection('kudos').orderBy('criadoEm','desc').limit(10).get();
        kudos=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(typeof renderHomeExtras==='function')renderHomeExtras();
    }catch(e){console.error('[KUDO]',e);mostrarNotif('','Erro ao enviar reconhecimento',e?.message||e?.code||'Tente novamente.','',8000);}
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    carregarTarefasPessoais, renderTarefasPessoais,
    ttUnificadas, ttKey, ttFindByKey, ttListasCustom, ttFiltrar,
    ttRenderRail, ttFmtPrazo, ttTarefaHTML, _eiLabel,
    ttSetEisenhower, ttRenderEisenhower, ttRenderLista, ttRenderSelBar,
    ttDragStart, ttDragEnd, ttDragOver, ttDragLeave, ttDropEisenhower,
    ttToggleSelMode, ttToggleSelecao, ttEnviarSelecionadas, ttEnviarParaDaily,
    ttExportarPDF, ttAbrirLista, ttSetSort, ttToggleConcluidas,
    ttNovaLista, ttQuickAddKey, ttAdicionar, ttGarantirShadow, ttEnviarParaKanban, enviarKudo,
    ttToggleConcluir, ttAbrirDetalhe, ttFecharDetalhe, ttRenderDetalhe,
    ttEditarCampo, ttSetPrioridade, ttSubKey, ttAddSub, ttToggleSub,
    ttEditarSub, ttRemoverSub, ttSalvarSubs, ttExcluir,
    ttProximaData, ttCriarProximaRecorrencia,
    setDailyView, renderDaily, linhaTarefaHTML,
    reatribuirTarefa, setStatusTarefa, excluirDaily, confirmarJustificativa,
    openModalDaily, ultimaDataDaily, renderOntemModal, importarTarefasOntem,
    linhaOntemHTML, marcarOntem, dragTarefaOntem,
    levarParaHoje, addLinhaDependencia, levarParaDependencia, levarParaBloqueio,
    dropEmHoje, dropEmDependencia, selectResponsavelHTML, addLinhaTarefa,
    importarPendenciasOntem, salvarDaily, verificarTarefasDelegadas,
    ddLimiteISO, ddFillEquipe, ddFillPessoa, ddPopulaSelects, ddTarefas,
    iniciarListenerNotificacoes, marcarNotifLidas,
    carregarDaily,
});
