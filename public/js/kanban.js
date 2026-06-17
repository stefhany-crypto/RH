// ========== KANBAN ==========
// KB_COLUNAS_DEFAULT, kanbanBoards, kbCards, kbBoardAtivo, kbCardAberto,
// kbListenerBoards, kbListenerCards, kbDragCardId, kbIniciado, kbTalentos,
// _kbNPrioSel declarados em globals.js

async function kbInit(){
    if(!user)return;
    if(!kbIniciado){
        kbIniciado=true;
        if(!talentos.length && user.equipe){
            const snap=await db.collection('colaboradores').where('ativo','==',true).where('equipe','==',user.equipe).get();
            kbTalentos=snap.docs.map(d=>({id:d.id,...d.data()}));
        } else { kbTalentos=talentos; }

        // Garante que os boards obrigatórios existam ANTES de ativar o listener
        await kbGarantirBoardPessoal();
        if(user.equipe) await kbGarantirBoardEquipe(user.equipe);

        registrarListener('kbBoards', db.collection('kanbanBoards').onSnapshot(snap=>{
            kanbanBoards=snap.docs.map(d=>({id:d.id,...d.data()}));
            // Mantém kbBoardAtivo sincronizado com o objeto mais recente do array
            if(kbBoardAtivo) kbBoardAtivo=kanbanBoards.find(b=>b.id===kbBoardAtivo.id)||kbBoardAtivo;
            kbRenderTopBar();
            if(!kbBoardAtivo){
                const meu=kanbanBoards.find(b=>b.tipo==='individual'&&b.donoId===user.id);
                if(meu)kbSetBoard(meu.id);
            }
        }));
    } else {
        kbRenderTopBar();
    }
}

async function kbGarantirBoardPessoal(){
    try{
        const snap=await db.collection('kanbanBoards')
            .where('tipo','==','individual').where('donoId','==',user.id).limit(1).get();
        if(snap.empty){
            await db.collection('kanbanBoards').add({
                tipo:'individual',donoId:user.id,donoNome:user.nome,
                nome:'Meu Kanban',colunas:KB_COLUNAS_DEFAULT,
                criadoEm:firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }catch(e){console.error('[MIRAE] kbGarantirBoardPessoal:',e);}
}

async function kbGarantirBoardEquipe(equipe){
    try{
        const idFixo='kbeq_'+equipe.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
        const snap=await db.collection('kanbanBoards').doc(idFixo).get();
        if(!snap.exists){
            await db.collection('kanbanBoards').doc(idFixo).set({
                tipo:'equipe',donoId:user.id,nome:'Kanban — '+equipe,
                equipe,colunas:KB_COLUNAS_DEFAULT,
                criadoEm:firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }catch(e){console.error('[MIRAE] kbGarantirBoardEquipe:',e);}
}

function kbTeardown(){
    cancelarListener('kbBoards');
    cancelarListener('kbCards');
    kanbanBoards=[];kbCards=[];
    kbBoardAtivo=null;kbCardAberto=null;
    kbIniciado=false;
}

function kbRenderTopBar(){
    const bar=document.getElementById('kbTopBar');
    if(!bar)return;
    const isAdm=P.isRH()||P.isMaster();
    const meu=kanbanBoards.find(b=>b.tipo==='individual'&&b.donoId===user.id);
    const meuTeamBoard=kanbanBoards.find(b=>b.tipo==='equipe'&&b.equipe===user.equipe);

    // "Outros" boards — equipes diferentes da minha + individuais alheios (só para Master/RH)
    const outrasEquipes=isAdm
        ?kanbanBoards.filter(b=>b.tipo==='equipe'&&b.equipe!==user.equipe)
            .sort((a,b)=>(a.equipe||'').localeCompare(b.equipe||''))
        :[];
    const outrosIndividuais=isAdm
        ?kanbanBoards.filter(b=>b.tipo==='individual'&&b.donoId!==user.id)
            .sort((a,b)=>(a.donoNome||'').localeCompare(b.donoNome||''))
        :[];
    const temOutros=outrasEquipes.length||outrosIndividuais.length;

    // Verifica se o board ativo é um dos "outros" (para manter o select visualmente correto)
    const ativoEOutro=kbBoardAtivo&&(outrasEquipes.some(b=>b.id===kbBoardAtivo.id)||outrosIndividuais.some(b=>b.id===kbBoardAtivo.id));

    let html='';
    if(meu) html+=`<button class="kb-top-btn${kbBoardAtivo?.id===meu.id?' active':''}" onclick="kbSetBoard('${meu.id}')">${ico('kanban',{size:15})} Meu Kanban</button>`;
    if(meuTeamBoard){
        html+=`<div class="kb-top-sep"></div>`;
        html+=`<button class="kb-top-btn${kbBoardAtivo?.id===meuTeamBoard.id?' active':''}" onclick="kbSetBoard('${meuTeamBoard.id}')">${ico('building',{size:15})} ${esc(meuTeamBoard.equipe||meuTeamBoard.nome)}</button>`;
    }

    // Seletor unificado para outros (Master/RH)
    if(temOutros){
        html+=`<div class="kb-top-sep"></div>`;
        let opts='<option value="">Ver outros...</option>';
        if(outrasEquipes.length) opts+=`<optgroup label="Equipes">${outrasEquipes.map(b=>`<option value="${b.id}" ${kbBoardAtivo?.id===b.id?'selected':''}>${esc(b.equipe||b.nome)}</option>`).join('')}</optgroup>`;
        if(outrosIndividuais.length) opts+=`<optgroup label="Individuais">${outrosIndividuais.map(b=>`<option value="${b.id}" ${kbBoardAtivo?.id===b.id?'selected':''}>${esc(b.donoNome||'Colaborador')}</option>`).join('')}</optgroup>`;
        html+=`<select class="kb-top-select${ativoEOutro?' kb-top-select-active':''}" onchange="if(this.value)kbSetBoard(this.value)">${opts}</select>`;
    }

    if(isAdm||P.isLider()){
        html+=`<div class="kb-top-sep"></div>`;
        html+=`<button class="kb-top-new" onclick="kbNovoQuadroEquipe()">${ico('plus',{size:14})} Novo quadro</button>`;
    }
    bar.innerHTML=html;
}

function kbSetBoard(boardId){
    const board=kanbanBoards.find(b=>b.id===boardId);
    if(!board)return;
    kbBoardAtivo=board;
    let q;
    if(board.tipo==='individual'){
        // Visão pessoal: todos os cards onde o dono é responsável (mirror unificado)
        q=db.collection('kanbanCards').where('responsavelId','==',board.donoId);
    } else {
        q=db.collection('kanbanCards').where('boardId','==',boardId);
    }
    registrarListener('kbCards', q.onSnapshot(snap=>{
        kbCards=snap.docs.map(d=>({id:d.id,...d.data()}));
        kbRenderBoard();
    }));
    kbRenderTopBar();
}

function kbRenderBoard(){
    const board=kbBoardAtivo; if(!board)return;
    const head=document.getElementById('kbBoardHead');
    const boardEl=document.getElementById('kbBoard');
    if(!head||!boardEl)return;
    const colunas=[...(board.colunas||KB_COLUNAS_DEFAULT)].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const podeEditar=board.donoId===user.id||P.isRH()||P.isMaster()||(P.isLider()&&board.equipe===user.equipe);
    head.innerHTML=`<div><h2 style="font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:600;color:var(--dark);margin:0;">${esc(board.nome)}</h2><div style="font-size:0.78rem;color:var(--muted);margin-top:0.1rem;">${kbCards.length} card${kbCards.length!==1?'s':''}</div></div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
            ${podeEditar?`<button onclick="kbEditarColunas()" style="padding:0.45rem 0.9rem;border:1.5px solid var(--border);border-radius:10px;background:white;font-size:0.82rem;cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:0.4rem;">${ico('gear',{size:15})} Colunas</button>`:''}
            ${podeEditar?`<button onclick="kbNovoCard(null)" style="padding:0.45rem 0.9rem;background:var(--teal);color:white;border:none;border-radius:10px;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;font-weight:500;">${ico('plus',{size:15})} Novo card</button>`:''}
        </div>`;
    boardEl.innerHTML=colunas.map(col=>{
        const cards=kbCards.filter(c=>(c.coluna||'backlog')===col.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
        return kbHtmlCol(col,cards,podeEditar);
    }).join('');
}

function kbHtmlCol(col,cards,podeEditar){
    return `<div style="display:flex;flex-direction:column;flex:1;min-width:240px;max-width:380px;">
        <div class="kb-col-stripe" style="background:${col.cor||'#9CA3AF'};"></div>
        <div class="kb-col" style="max-width:none;min-width:0;flex:1;">
            <div class="kb-col-head"><span class="kb-col-nome">${esc(col.nome)}</span><span class="kb-col-count">${cards.length}</span></div>
            <div class="kb-col-body" id="kbCol-${col.id}" ondragover="kbDragOver(event,'${col.id}')" ondrop="kbDrop(event,'${col.id}')" ondragleave="kbDragLeave(event)">
                ${cards.length?cards.map(c=>kbHtmlCard(c)).join(''):`<div class="kb-empty-col">Nenhum card</div>`}
            </div>
            ${podeEditar?`<div class="kb-col-add"><button class="kb-col-add-btn" onclick="kbNovoCard('${col.id}')">${ico('plus',{size:14})} Adicionar card</button></div>`:''}
        </div>
    </div>`;
}

function kbHtmlCard(card){
    const prio=card.prioridade;
    const prioHtml=prio?`<span class="kb-card-chip kb-chip-${prio}">${prio.charAt(0).toUpperCase()+prio.slice(1)}</span>`:'';
    const delegado=card.criadoPorId&&card.criadoPorId!==user.id;
    const delegadoHtml=delegado?`<div class="kb-mirror-badge">${ico('share',{size:11})} De: ${esc(card.criadoPorNome||'')}</div>`:'';
    let prazoHtml='';
    if(card.prazo){const vencido=card.prazo<hojeISO()&&card.coluna!=='concluido';prazoHtml=`<span class="kb-card-chip ${vencido?'kb-chip-vencido':'kb-chip-prazo'}">${card.prazo.split('-').reverse().join('/')}</span>`;}
    return `<div class="kb-card" draggable="true" ondragstart="kbDragStart(event,'${card.id}')" ondragend="kbDragEnd(event)" onclick="kbAbrirCard('${card.id}')">
        ${delegadoHtml}
        <div class="kb-card-titulo">${esc(card.titulo||'')}</div>
        ${card.descricao?`<div class="kb-card-desc">${esc(card.descricao)}</div>`:''}
        <div class="kb-card-meta">${prioHtml}${prazoHtml}</div>
        <div class="kb-card-resp"><div class="kb-resp-avatar">${(card.responsavelNome||'?')[0].toUpperCase()}</div><span>${esc(card.responsavelNome||'')}</span></div>
    </div>`;
}

// Drag & drop
function kbDragStart(e,cardId){kbDragCardId=cardId;e.dataTransfer.effectAllowed='move';setTimeout(()=>{document.querySelector(`.kb-card[ondragstart*="${cardId}"]`)?.classList.add('dragging');},0);}
function kbDragEnd(e){document.querySelectorAll('.kb-card.dragging').forEach(el=>el.classList.remove('dragging'));document.querySelectorAll('.kb-col-body.dragover').forEach(el=>el.classList.remove('dragover'));}
function kbDragOver(e,colId){e.preventDefault();e.dataTransfer.dropEffect='move';const el=document.getElementById('kbCol-'+colId);if(el)el.classList.add('dragover');}
function kbDragLeave(e){if(e.currentTarget?.classList.contains('kb-col-body'))e.currentTarget.classList.remove('dragover');}
async function kbDrop(e,colId){
    e.preventDefault();
    document.querySelectorAll('.kb-col-body.dragover').forEach(el=>el.classList.remove('dragover'));
    if(!kbDragCardId)return;
    const card=kbCards.find(c=>c.id===kbDragCardId); kbDragCardId=null;
    if(!card||card.coluna===colId)return;
    const chave='kbDrop_'+card.id;
    if(_opEmAndamento.has(chave))return;
    _opEmAndamento.add(chave);
    // Atualização otimista: UI responde imediatamente, reverte se falhar
    const colunaAnterior=card.coluna;
    card.coluna=colId; kbRenderBoard();
    try{
        await db.collection('kanbanCards').doc(card.id).update({coluna:colId,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(err){
        card.coluna=colunaAnterior; kbRenderBoard();
        mostrarNotif('','Erro ao mover card',err?.message||'Tente novamente.','',4000);
    }finally{
        _opEmAndamento.delete(chave);
    }
}

// Card detail
function kbAbrirCard(cardId){
    const card=kbCards.find(c=>c.id===cardId); if(!card)return;
    kbCardAberto=card; kbRenderDetalheCard();
    document.getElementById('kbCardOverlay').classList.add('aberto');
}
function kbFecharCard(){document.getElementById('kbCardOverlay')?.classList.remove('aberto');kbCardAberto=null;}

function kbRenderDetalheCard(){
    const card=kbCardAberto; if(!card)return;
    const el=document.getElementById('kbCardDetalhe'); if(!el)return;
    const board=kbBoardAtivo;
    const colunas=board?.colunas||KB_COLUNAS_DEFAULT;
    const podeEditar=card.criadoPorId===user.id||P.isRH()||P.isMaster()||(P.isLider()&&board?.equipe===user.equipe)||board?.donoId===user.id;
    const podeMover=podeEditar||card.responsavelId===user.id;
    const colSelect=colunas.map(c=>`<option value="${c.id}" ${card.coluna===c.id?'selected':''}>${esc(c.nome)}</option>`).join('');
    const todosColabs=kbTalentos.length?kbTalentos:talentos;
    const colabOpts=todosColabs.filter(t=>t.id!==user.id).map(t=>`<option value="${t.id}" ${card.responsavelId===t.id?'selected':''}>${esc(t.nome)}</option>`).join('');
    el.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);">${esc(board?.nome||'Kanban')}</div>
            <button onclick="kbFecharCard()" style="border:none;background:none;cursor:pointer;color:var(--muted);padding:0;display:flex;">${ico('x',{size:18})}</button>
        </div>
        ${card.criadoPorId&&card.criadoPorId!==user.id?`<div class="kb-mirror-badge" style="margin-bottom:0.8rem;">${ico('share',{size:11})} Delegado por ${esc(card.criadoPorNome||'')}</div>`:''}
        <textarea id="kbDTitulo" class="tt-d-titulo" rows="2" placeholder="Título do card" ${!podeEditar?'readonly':''}>${esc(card.titulo||'')}</textarea>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Coluna</div>
            <select id="kbDColuna" class="tt-d-input" ${!podeMover?'disabled':''}>${colSelect}</select></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Responsável</div>
            <select id="kbDResp" class="tt-d-input" ${!podeEditar?'disabled':''}>
                <option value="${user.id}" ${card.responsavelId===user.id?'selected':''}>${esc(user.nome)}</option>
                ${colabOpts}
            </select></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prioridade</div>
            <div class="tt-d-row">${['alta','media','baixa'].map(p=>`<button class="tt-prio-btn${card.prioridade===p?' sel '+p:''}" onclick="kbSalvarCampoCard('prioridade','${p}')" ${!podeEditar?'disabled':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</button>`).join('')}
                ${card.prioridade&&podeEditar?`<button class="tt-prio-btn" onclick="kbSalvarCampoCard('prioridade',null)" style="font-size:0.7rem;">Limpar</button>`:''}</div></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prazo</div>
            <input type="date" id="kbDPrazo" class="tt-d-input" value="${card.prazo||''}" ${!podeEditar?'readonly':''}></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Descrição</div>
            <textarea id="kbDDesc" class="tt-d-input" rows="4" placeholder="Descreva o card..." ${!podeEditar?'readonly':''}>${esc(card.descricao||'')}</textarea></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Tags (separadas por vírgula)</div>
            <input type="text" id="kbDTags" class="tt-d-input" value="${(card.tags||[]).join(', ')}" placeholder="ex: marketing, urgente" ${!podeEditar?'readonly':''}></div>
        <div style="margin-top:1.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${podeEditar?`<button onclick="kbSalvarDetalheCard()" style="flex:1;padding:0.6rem;background:var(--teal);color:white;border:none;border-radius:10px;font-size:0.85rem;cursor:pointer;font-weight:500;">Salvar</button>`:''}
            <button onclick="kbConverterParaTarefa('${card.id}')" style="padding:0.6rem 0.8rem;background:var(--teal-dim);color:var(--teal);border:none;border-radius:10px;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;gap:0.35rem;">${ico('tasks',{size:14})} Minhas Tarefas</button>
            ${(card.criadoPorId===user.id||P.isMaster())?`<button onclick="kbExcluirCard('${card.id}')" style="padding:0.6rem 0.8rem;background:#FFEBEE;color:#C62828;border:none;border-radius:10px;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;gap:0.35rem;">${ico('trash',{size:14})}</button>`:''}</div>
        <div style="margin-top:0.6rem;">
            ${card.enviadaDaily===hojeISO()
                ?`<div style="font-size:0.78rem;color:var(--teal);display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0;">${ico('check',{size:13})} Já enviado para a Daily de hoje</div>`
                :`<button onclick="kbEnviarParaDaily('${card.id}')" style="width:100%;padding:0.55rem;background:rgba(201,160,90,0.12);color:#8a6820;border:none;border-radius:10px;font-size:0.83rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;font-weight:500;">${ico('arrowRight',{size:15})} Enviar para a Daily de hoje</button>`}
        </div>
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--hairline);font-size:0.72rem;color:var(--muted);">
            Criado por ${esc(card.criadoPorNome||'-')} ${card.criadoEm?.toDate?.()?'em '+card.criadoEm.toDate().toLocaleDateString('pt-BR'):''}</div>`;
}

async function kbSalvarCampoCard(campo,valor){
    if(!kbCardAberto)return;
    await guardado('kbCampo_'+kbCardAberto.id+'_'+campo, async () => {
        await db.collection('kanbanCards').doc(kbCardAberto.id).update({[campo]:valor,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        if(kbCardAberto)kbCardAberto[campo]=valor;
        kbRenderDetalheCard();
    });
}

async function kbSalvarDetalheCard(){
    if(!kbCardAberto)return;
    const titulo=document.getElementById('kbDTitulo')?.value?.trim();
    if(!titulo){mostrarNotif('','Campo obrigatório','O título é obrigatório.','',2500);return;}
    await guardado('kbSalvarCard_'+kbCardAberto.id, async () => {
        const sel=document.getElementById('kbDResp');
        const op=sel?.options[sel.selectedIndex];
        const data={
            titulo,
            descricao:document.getElementById('kbDDesc')?.value?.trim()||'',
            coluna:document.getElementById('kbDColuna')?.value||kbCardAberto.coluna,
            prazo:document.getElementById('kbDPrazo')?.value||null,
            tags:(document.getElementById('kbDTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean),
            responsavelId:op?.value||kbCardAberto.responsavelId,
            responsavelNome:op?.text||kbCardAberto.responsavelNome,
            atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('kanbanCards').doc(kbCardAberto.id).update(data);
        mostrarNotif('','Card salvo','','',2000); kbFecharCard();
    });
}

async function kbExcluirCard(cardId){
    if(!confirm('Excluir este card?'))return;
    await guardado('kbExcluirCard_'+cardId, async () => {
        await db.collection('kanbanCards').doc(cardId).delete();
        kbFecharCard(); mostrarNotif('','Card excluído','','',2000);
    });
}

// Novo card
function kbNovoCard(colunaId){
    kbCardAberto=null; _kbNPrioSel=null;
    const board=kbBoardAtivo; if(!board)return;
    const colunas=board.colunas||KB_COLUNAS_DEFAULT;
    const colSelect=colunas.map(c=>`<option value="${c.id}" ${(colunaId||'backlog')===c.id?'selected':''}>${esc(c.nome)}</option>`).join('');
    const todosColabs=kbTalentos.length?kbTalentos:talentos;
    const colabOpts=`<option value="${user.id}" selected>${esc(user.nome)}</option>`+todosColabs.filter(t=>t.id!==user.id).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    const el=document.getElementById('kbCardDetalhe');
    if(!el)return;
    el.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);">Novo Card</div>
            <button onclick="kbFecharCard()" style="border:none;background:none;cursor:pointer;color:var(--muted);padding:0;display:flex;">${ico('x',{size:18})}</button>
        </div>
        <textarea id="kbNTitulo" class="tt-d-titulo" rows="2" placeholder="Título do card"></textarea>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Coluna</div><select id="kbNColuna" class="tt-d-input">${colSelect}</select></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Responsável</div><select id="kbNResp" class="tt-d-input">${colabOpts}</select></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prioridade</div>
            <div class="tt-d-row" id="kbNPrioRow">${['alta','media','baixa'].map(p=>`<button class="tt-prio-btn" onclick="kbNTogglePrio('${p}',this)">${p.charAt(0).toUpperCase()+p.slice(1)}</button>`).join('')}</div></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Prazo</div><input type="date" id="kbNPrazo" class="tt-d-input"></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Descrição</div><textarea id="kbNDesc" class="tt-d-input" rows="3" placeholder="Descreva o card..."></textarea></div>
        <div class="tt-d-sec"><div class="tt-d-sec-label">Tags (vírgula)</div><input type="text" id="kbNTags" class="tt-d-input" placeholder="ex: marketing, urgente"></div>
        <div style="margin-top:1.5rem;"><button onclick="kbCriarCard()" style="width:100%;padding:0.7rem;background:var(--teal);color:white;border:none;border-radius:10px;font-size:0.88rem;cursor:pointer;font-weight:500;">Criar Card</button></div>`;
    document.getElementById('kbCardOverlay').classList.add('aberto');
    setTimeout(()=>document.getElementById('kbNTitulo')?.focus(),50);
}

function kbNTogglePrio(prio,btn){
    document.querySelectorAll('#kbNPrioRow .tt-prio-btn').forEach(b=>b.classList.remove('sel','alta','media','baixa'));
    if(_kbNPrioSel===prio){_kbNPrioSel=null;return;}
    _kbNPrioSel=prio; btn.classList.add('sel',prio);
}

async function kbCriarCard(){
    const titulo=document.getElementById('kbNTitulo')?.value?.trim();
    if(!titulo){mostrarNotif('','Campo obrigatório','O título é obrigatório.','',2500);return;}
    const board=kbBoardAtivo; if(!board)return;
    await guardado('kbCriarCard', async () => {
        const sel=document.getElementById('kbNResp');
        const op=sel?.options[sel.selectedIndex];
        await db.collection('kanbanCards').add({
            boardId:board.id, boardTipo:board.tipo, equipe:board.equipe||user.equipe||null,
            titulo, descricao:document.getElementById('kbNDesc')?.value?.trim()||'',
            responsavelId:op?.value||user.id, responsavelNome:op?.text||user.nome,
            criadoPorId:user.id, criadoPorNome:user.nome,
            coluna:document.getElementById('kbNColuna')?.value||'backlog',
            prioridade:_kbNPrioSel||null,
            prazo:document.getElementById('kbNPrazo')?.value||null,
            tags:(document.getElementById('kbNTags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean),
            origemTarefaId:null,
            ordem:kbCards.filter(c=>(c.coluna||'backlog')===(document.getElementById('kbNColuna')?.value||'backlog')).length,
            criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
            atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        _kbNPrioSel=null; kbFecharCard();
        mostrarNotif('','Card criado','Adicionado ao Kanban com sucesso.','',2500);
    });
}

// Converter card → Minhas Tarefas
async function kbEnviarParaDaily(cardId){
    const card=kbCards.find(c=>c.id===cardId); if(!card)return;
    if(!user.equipe){mostrarNotif('','Sem equipe','Você não está vinculada a uma equipe.','',3000);return;}
    await guardado('kbEnviarDaily_'+cardId, async () => {
        const hoje=hojeISO();
        const dailyId=`${user.equipe.replace(/[\/\s]+/g,'_')}_${hoje}`;
        const ref=db.collection('dailyTarefas').doc();
        await ref.set({
            dailyId, equipe:user.equipe, data:hoje, tipo:'tarefa',
            responsavelId:card.responsavelId, responsavelNome:card.responsavelNome,
            equipeResponsavel:card.equipe||user.equipe,
            descricao:card.titulo,
            status:'pendente', justificativa:'', justificativaAceita:null,
            crossTeam:false, adiamentos:0, adiadaDe:null,
            origemKanbanCardId:cardId,
            criadoPorId:user.id, criadoPorNome:user.nome,
            criadoEm:firebase.firestore.FieldValue.serverTimestamp(),
            atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('kanbanCards').doc(cardId).update({enviadaDaily:hoje, atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        card.enviadaDaily=hoje;
        try{await carregarDaily();}catch(e){}
        mostrarNotif('','Enviado para Daily','Card adicionado nas tarefas de hoje da sua equipe.','bonus',4000);
        kbRenderDetalheCard();
    });
}

async function kbConverterParaTarefa(cardId){
    const card=kbCards.find(c=>c.id===cardId); if(!card)return;
    await guardado('kbConverterTarefa_'+cardId, async () => {
        await db.collection('tarefasPessoais').add({
            userId:user.id, titulo:card.titulo, descricao:card.descricao||'',
            prioridade:card.prioridade||null, prazo:card.prazo||null, tags:card.tags||[],
            concluida:false, kanbanCardId:cardId, lista:'Entrada',
            criadoEm:firebase.firestore.FieldValue.serverTimestamp(), atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarNotif('','Tarefa criada','Card adicionado em Minhas Tarefas.','',3000); kbFecharCard();
    });
}

// Minhas Tarefas → Kanban
async function ttEnviarParaKanban(tarefaKey){
    const t=ttFindByKey(tarefaKey); if(!t)return;
    await guardado('ttEnviarKanban_'+tarefaKey, async () => {
        let meu=kanbanBoards.find(b=>b.tipo==='individual'&&b.donoId===user.id);
        if(!meu){
            const ref=db.collection('kanbanBoards').doc();
            await ref.set({tipo:'individual',donoId:user.id,nome:'Meu Kanban',colunas:KB_COLUNAS_DEFAULT,criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
            meu={id:ref.id,tipo:'individual',donoId:user.id,nome:'Meu Kanban',colunas:KB_COLUNAS_DEFAULT};
        }
        await db.collection('kanbanCards').add({
            boardId:meu.id, boardTipo:'individual', equipe:user.equipe||null,
            titulo:t.titulo, descricao:t.descricao||'',
            responsavelId:user.id, responsavelNome:user.nome,
            criadoPorId:user.id, criadoPorNome:user.nome,
            coluna:'backlog', prioridade:t.prioridade||null, prazo:t.prazo||null, tags:t.tags||[],
            origemTarefaId:t.id||null, ordem:0,
            criadoEm:firebase.firestore.FieldValue.serverTimestamp(), atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarNotif('','Enviado para o Kanban','Tarefa adicionada ao seu Kanban pessoal.','',3000);
    });
}

// Novo quadro equipe
function kbNovoQuadroEquipe(){
    document.getElementById('kbModalNovoQuadro')?.remove();
    const eqOpts=equipes.map(e=>`<option value="${esc(e.nome||e.id)}">${esc(e.nome||e.id)}</option>`).join('');
    const modal=document.createElement('div'); modal.id='kbModalNovoQuadro'; modal.className='modal'; modal.style.display='flex';
    modal.innerHTML=`<div class="modal-content" style="max-width:460px;">
        <span class="close-btn" onclick="document.getElementById('kbModalNovoQuadro').remove()">&times;</span>
        <h2 style="font-family:'Cormorant Garamond',serif;margin-bottom:1.2rem;">Novo Quadro Kanban</h2>
        <div class="form-group"><label>Nome do Quadro</label><input type="text" id="kbNQNome" class="tt-d-input" placeholder="ex: Kanban de Marketing"></div>
        <div class="form-group"><label>Equipe (opcional)</label>
            <select id="kbNQEquipe" class="tt-d-input"><option value="">Sem equipe específica</option>${eqOpts}</select></div>
        <button onclick="kbCriarQuadroEquipe()" style="width:100%;padding:0.7rem;margin-top:1rem;background:var(--teal);color:white;border:none;border-radius:10px;font-size:0.88rem;cursor:pointer;font-weight:500;">Criar Quadro</button>
    </div>`;
    document.body.appendChild(modal);
}

async function kbCriarQuadroEquipe(){
    const nome=document.getElementById('kbNQNome')?.value?.trim();
    if(!nome){mostrarNotif('','Campo obrigatório','Informe o nome do quadro.','',2500);return;}
    await guardado('kbCriarQuadro', async () => {
        const equipe=document.getElementById('kbNQEquipe')?.value||null;
        await db.collection('kanbanBoards').add({tipo:'equipe',donoId:user.id,nome,equipe:equipe||null,colunas:KB_COLUNAS_DEFAULT,criadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        document.getElementById('kbModalNovoQuadro')?.remove();
        mostrarNotif('','Quadro criado','Novo quadro Kanban criado.','',2500);
    });
}

// Editar colunas
function kbEditarColunas(){
    const board=kbBoardAtivo; if(!board)return;
    document.getElementById('kbModalColunas')?.remove();
    window._kbEditColunas=JSON.parse(JSON.stringify(board.colunas||KB_COLUNAS_DEFAULT));
    const modal=document.createElement('div'); modal.id='kbModalColunas'; modal.className='modal'; modal.style.display='flex';
    modal.innerHTML=`<div class="modal-content" style="max-width:460px;">
        <span class="close-btn" onclick="document.getElementById('kbModalColunas').remove()">&times;</span>
        <h2 style="font-family:'Cormorant Garamond',serif;margin-bottom:1.2rem;">Editar Colunas</h2>
        <div id="kbColList"></div>
        <button onclick="kbColAdicionar()" style="width:100%;padding:0.5rem;margin-top:0.5rem;background:var(--cream);color:var(--dark);border:1.5px dashed var(--border);border-radius:10px;font-size:0.82rem;cursor:pointer;">${ico('plus',{size:14})} Adicionar coluna</button>
        <button onclick="kbSalvarColunas()" style="width:100%;padding:0.7rem;margin-top:1rem;background:var(--teal);color:white;border:none;border-radius:10px;font-size:0.88rem;cursor:pointer;font-weight:500;">Salvar</button>
    </div>`;
    document.body.appendChild(modal); kbRenderColList();
}

function kbRenderColList(){
    const list=document.getElementById('kbColList'); if(!list||!window._kbEditColunas)return;
    list.innerHTML=window._kbEditColunas.map((c,i)=>`
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
            <input type="color" value="${c.cor||'#9CA3AF'}" oninput="window._kbEditColunas[${i}].cor=this.value" style="width:32px;height:32px;border:none;cursor:pointer;border-radius:6px;padding:2px;">
            <input type="text" value="${esc(c.nome)}" oninput="window._kbEditColunas[${i}].nome=this.value" class="tt-d-input" style="flex:1;">
            ${window._kbEditColunas.length>1?`<button onclick="window._kbEditColunas.splice(${i},1);kbRenderColList()" style="border:none;background:#FFEBEE;color:#C62828;border-radius:8px;padding:0.35rem 0.5rem;cursor:pointer;display:flex;">${ico('trash',{size:14})}</button>`:''}
        </div>`).join('');
}
function kbColAdicionar(){if(!window._kbEditColunas)return;window._kbEditColunas.push({id:'col_'+Date.now(),nome:'Nova Coluna',cor:'#9CA3AF',ordem:window._kbEditColunas.length});kbRenderColList();}
async function kbSalvarColunas(){
    if(!kbBoardAtivo||!window._kbEditColunas)return;
    await guardado('kbSalvarColunas_'+kbBoardAtivo.id, async () => {
        const colunas=window._kbEditColunas.map((c,i)=>({...c,ordem:i}));
        await db.collection('kanbanBoards').doc(kbBoardAtivo.id).update({colunas,atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()});
        kbBoardAtivo.colunas=colunas; document.getElementById('kbModalColunas')?.remove();
        kbRenderBoard(); mostrarNotif('','Colunas salvas','Layout do quadro atualizado.','',2000);
    });
}
