// ── Remuneração PJ ──────────────────────────────────────────────
let remuLancs=[], remuPreview=[], remuCarregado=false;
const MESES_REMU=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function _remuDiasNoMes(mes,ano){return new Date(ano,mes,0).getDate();}

function _remuCalc(colab,mes,ano){
    const salario=parseFloat(colab.salario)||0;
    const diasMes=_remuDiasNoMes(mes,ano);
    const adm=colab.dataAdmissao?new Date(colab.dataAdmissao+'T12:00:00'):null;
    // Parcial apenas se entrou depois do dia 1 do mês de admissão
    const admMesAno=adm&&adm.getFullYear()===ano&&(adm.getMonth()+1)===mes;
    const ehPrimeiro=admMesAno&&adm.getDate()>1;
    let diasTrab=diasMes, valorBruto=salario;
    if(ehPrimeiro){
        diasTrab=diasMes-adm.getDate()+1; // do dia de entrada até o último dia do mês
        valorBruto=(diasTrab/diasMes)*salario;
    }
    return{diasMes,diasTrab,ehPrimeiro,valorBruto};
}

async function carregarRemuneracao(){
    remuLancs=[];
    try{
        let q=(P.isRH()||P.isMaster())
            ?db.collection('lancamentosRemuneracao').limit(600)
            :db.collection('lancamentosRemuneracao').where('colabId','==',user.id).limit(200);
        const snap=await q.get();
        remuLancs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.ano!==a.ano?b.ano-a.ano:b.mes-a.mes);
        remuCarregado=true;
    }catch(e){console.error('[REMU] carregarRemuneracao:',e);}
}

// ── Init filtros ──────────────────────────────────────────────
function remuInitFiltros(){
    const agora=new Date();
    const mes=agora.getMonth()+1, ano=agora.getFullYear();
    const isPJ=user?.tipoContrato==='PJ';
    // Filtros painel RH
    const mSel=document.getElementById('remuFiltroMes');
    if(mSel&&!mSel.options.length)mSel.innerHTML=MESES_REMU.map((n,i)=>i?`<option value="${i}"${i===mes?' selected':''}>${n}</option>`:'').join('');
    const aSel=document.getElementById('remuFiltroAno');
    if(aSel&&!aSel.options.length){const anos=[ano,ano-1,ano-2];aSel.innerHTML=anos.map(a=>`<option value="${a}"${a===ano?' selected':''}>${a}</option>`).join('');}
    const eqSel=document.getElementById('remuFiltroEq');
    if(eqSel&&!eqSel.options.length)eqSel.innerHTML='<option value="">Todas as equipes</option>'+(equipes||[]).map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    const cSel=document.getElementById('remuFiltroColab');
    if(cSel&&!cSel.options.length){const pjs=(todosColabs.length?todosColabs:talentos).filter(c=>c.tipoContrato==='PJ'&&c.ativo!==false);cSel.innerHTML='<option value="">Todos</option>'+pjs.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');}
    // Filtros PJ
    const mPJ=document.getElementById('remuFiltroMesPJ');
    if(mPJ&&!mPJ.options.length)mPJ.innerHTML='<option value="">Todos</option>'+MESES_REMU.map((n,i)=>i?`<option value="${i}"${i===mes?' selected':''}>${n}</option>`:'').join('');
    const aPJ=document.getElementById('remuFiltroAnoPJ');
    if(aPJ&&!aPJ.options.length){const anos=[ano,ano-1,ano-2];aPJ.innerHTML='<option value="">Todos</option>'+anos.map(a=>`<option value="${a}"${a===ano?' selected':''}>${a}</option>`).join('');}
    // Gerar mês/ano
    const gmSel=document.getElementById('remuGerarMes');
    if(gmSel&&!gmSel.options.length)gmSel.innerHTML=MESES_REMU.map((n,i)=>i?`<option value="${i}"${i===mes?' selected':''}>${n}</option>`:'').join('');
    const gaSel=document.getElementById('remuGerarAno');
    if(gaSel&&!gaSel.options.length)gaSel.innerHTML=[ano,ano-1].map(a=>`<option value="${a}"${a===ano?' selected':''}>${a}</option>`).join('');
    // Filtros da seção pessoal de admin-PJ (IDs distintos para não conflitar com filtrosPJ)
    const isAdminPJ=(P.isRH()||P.isMaster())&&user?.tipoContrato==='PJ';
    const mMeu=document.getElementById('remuFiltroMesMeu');
    if(mMeu&&!mMeu.options.length)mMeu.innerHTML='<option value="">Todos</option>'+MESES_REMU.map((n,i)=>i?`<option value="${i}"${i===mes?' selected':''}>${n}</option>`:'').join('');
    const aMeu=document.getElementById('remuFiltroAnoMeu');
    if(aMeu&&!aMeu.options.length){const anos=[ano,ano-1,ano-2];aMeu.innerHTML='<option value="">Todos</option>'+anos.map(a=>`<option value="${a}"${a===ano?' selected':''}>${a}</option>`).join('');}
    // Mostrar blocos corretos
    const gerarBlock=document.getElementById('remuGerarBlock');
    const filtrosRH=document.getElementById('remuFiltrosRH');
    const filtrosPJ=document.getElementById('remuFiltrosPJ');
    const minhaSecao=document.getElementById('remuMinhaSecao');
    if(gerarBlock)gerarBlock.style.display=(P.isRH()||P.isMaster())?'':'none';
    if(filtrosRH)filtrosRH.style.display=(P.isRH()||P.isMaster())?'':'none';
    if(filtrosPJ)filtrosPJ.style.display=isPJ&&!P.isRH()&&!P.isMaster()?'':'none';
    if(minhaSecao)minhaSecao.style.display=isAdminPJ?'':'none';
}

// ── Render principal da aba ───────────────────────────────────
async function renderRemuneracaoTab(){
    remuInitFiltros();
    if(!remuCarregado)await carregarRemuneracao();
    const isPJ=user?.tipoContrato==='PJ'&&!P.isRH()&&!P.isMaster();
    if(isPJ){
        renderMinhasRemuneracoes();
    }else{
        renderPainelRemuneracao();
        renderDashRemuneracao();
        // Admin que também é PJ: mostra seção pessoal acima do painel
        if((P.isRH()||P.isMaster())&&user?.tipoContrato==='PJ')renderMinhaRemuAdmin();
    }
}

// ── Seção pessoal para admin que também é PJ ─────────────────
function renderMinhaRemuAdmin(){
    const cont=document.getElementById('remuMinhaConteudo'); if(!cont)return;
    const fMes=parseInt(document.getElementById('remuFiltroMesMeu')?.value||0);
    const fAno=parseInt(document.getElementById('remuFiltroAnoMeu')?.value||0);
    let lista=remuLancs.filter(l=>l.colabId===user.id);
    if(fMes)lista=lista.filter(l=>l.mes===fMes);
    if(fAno)lista=lista.filter(l=>l.ano===fAno);
    const totalPago=remuLancs.filter(l=>l.colabId===user.id&&l.nfNome).reduce((a,b)=>a+(b.valorFinal||0),0);
    cont.innerHTML=lista.length?`
    <div class="remu-cards" style="margin-bottom:0.8rem;">
        <div class="remu-card"><div class="remu-card-val">${remuLancs.filter(l=>l.colabId===user.id).length}</div><div class="remu-card-lbl">Competências</div></div>
        <div class="remu-card"><div class="remu-card-val">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="remu-card-lbl">Total recebido (NF emitida)</div></div>
    </div>
    <div style="overflow-x:auto;">
    <table class="remu-table">
        <thead><tr><th>Período</th><th>Tipo</th><th>Salário Base</th><th>Desconto</th><th>Valor Final</th><th>Status</th><th>NF</th></tr></thead>
        <tbody>${lista.map(l=>{
            const st=_stMap[l.status]||_stMap.pendente;
            return`<tr>
                <td><b>${MESES_REMU[l.mes]||l.mes}/${l.ano}</b></td>
                <td>${l.ehPrimeiro?`<span style="font-size:0.78rem;color:#E65100;">Proporcional (${l.diasTrabalhados}/${l.diasNoMes} dias)</span>`:'<span style="font-size:0.78rem;color:#2E7D32;">Integral</span>'}</td>
                <td>R$ ${(l.salarioBase||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="color:${l.valorDesconto?'#C62828':'var(--muted)'};">${l.valorDesconto?`- R$ ${l.valorDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—'}</td>
                <td><b>R$ ${(l.valorFinal||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></td>
                <td><span class="badge" style="background:${st.cor}22;color:${st.cor};font-size:0.72rem;">${st.lbl}</span></td>
                <td>${l.nfNome
                    ?`<a href="${l.nfUrl||'#'}" target="_blank" style="font-size:0.78rem;color:var(--teal);">${ico('external-link',{size:12})} Ver NF</a>`
                    :(l.status==='aguardando_nf'?`<button class="btn-small btn-eval" onclick="uploadNFRem('${l.id}','${MESES_REMU[l.mes]}/${l.ano}',${l.valorFinal||0})">Enviar NF</button>`:'—')}</td>
            </tr>`;
        }).join('')}</tbody>
    </table></div>`
    :`<div style="color:var(--muted);font-size:0.85rem;">Nenhuma remuneração encontrada para o período selecionado.</div>`;
}

// ── Painel RH/Master ─────────────────────────────────────────
function renderPainelRemuneracao(){
    const cont=document.getElementById('remuConteudo'); if(!cont)return;
    const agora=new Date();
    const mes=parseInt(document.getElementById('remuFiltroMes')?.value||agora.getMonth()+1);
    const ano=parseInt(document.getElementById('remuFiltroAno')?.value||agora.getFullYear());
    const fColab=document.getElementById('remuFiltroColab')?.value||'';
    const fEq=document.getElementById('remuFiltroEq')?.value||'';
    let lista=remuLancs.filter(l=>l.mes===mes&&l.ano===ano);
    if(fColab)lista=lista.filter(l=>l.colabId===fColab);
    if(fEq)lista=lista.filter(l=>l.equipe===fEq);
    const totalVal=lista.reduce((a,b)=>a+(b.valorFinal||0),0);
    const comNF=lista.filter(l=>l.nfNome).length;
    const semNF=lista.filter(l=>!l.nfNome&&['confirmado','aguardando_nf'].includes(l.status)).length;
    cont.innerHTML=`
    <div class="remu-cards">
        <div class="remu-card"><div class="remu-card-val">R$ ${totalVal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="remu-card-lbl">Folha ${MESES_REMU[mes]||mes}/${ano}</div></div>
        <div class="remu-card"><div class="remu-card-val">${lista.length}</div><div class="remu-card-lbl">PJs no período</div></div>
        <div class="remu-card"><div class="remu-card-val" style="color:#2E7D32;">${comNF}</div><div class="remu-card-lbl">NFs recebidas</div></div>
        <div class="remu-card"><div class="remu-card-val" style="color:#C62828;">${semNF}</div><div class="remu-card-lbl">Aguardando NF</div></div>
    </div>
    ${lista.length?`
    <div style="display:flex;gap:0.7rem;flex-wrap:wrap;margin:0.8rem 0;">
        <button class="btn-primary" style="width:auto;padding:0.55rem 1rem;font-size:0.84rem;" onclick="exportarExcelRemuneracao()">${ico('download',{size:14})} Excel</button>
        <button class="btn-primary" style="width:auto;padding:0.55rem 1rem;font-size:0.84rem;" onclick="exportarOmieRemuneracao()">${ico('file-spreadsheet',{size:14})} OMIE</button>
        <button class="btn-primary" style="width:auto;padding:0.55rem 1rem;font-size:0.84rem;" onclick="exportarPDFRemuneracao()">${ico('file-text',{size:14})} PDF</button>
    </div>
    <div style="overflow-x:auto;">
    <table class="remu-table">
        <thead><tr><th>Colaborador</th><th>Equipe</th><th>Tipo</th><th>Salário Base</th><th>Desconto</th><th>Valor Final</th><th>Status</th><th>NF</th><th>Ações</th></tr></thead>
        <tbody>${lista.map(l=>_remuLinhaHTML(l)).join('')}</tbody>
    </table></div>`
    :`<div style="text-align:center;padding:2.5rem;color:var(--muted);border:1.5px dashed var(--border);border-radius:var(--radius-lg);margin-top:0.8rem;">Nenhum lançamento para ${MESES_REMU[mes]||mes}/${ano}.<br><small>Use "Gerar Remunerações" acima para criar os lançamentos do mês.</small></div>`}`;
}

const _stMap={pendente:{lbl:'Pendente',cor:'#9E9E9E'},confirmado:{lbl:'Confirmado',cor:'#1565C0'},aguardando_nf:{lbl:'Aguard. NF',cor:'#E65100'},nf_recebida:{lbl:'NF Recebida',cor:'#2E7D32'},cancelado:{lbl:'Cancelado',cor:'#B71C1C'}};

function _remuLinhaHTML(l){
    const st=_stMap[l.status]||_stMap.pendente;
    const nfCell=l.nfNome
        ?`<a href="${l.nfUrl||'#'}" target="_blank" style="font-size:0.75rem;color:#2E7D32;">${ico('external-link',{size:11,color:'#2E7D32'})} ${esc(l.nfNome.slice(0,28)+(l.nfNome.length>28?'…':''))}</a>`
        :(l.status==='aguardando_nf'?`<span style="font-size:0.75rem;color:#E65100;">${ico('clock',{size:11,color:'#E65100'})} Aguardando</span>`:'—');
    const acoes=[];
    if(l.status==='pendente'&&(P.isRH()||P.isMaster()))acoes.push(`<button class="btn-small btn-eval" onclick="remuConfirmar('${l.id}')">Confirmar</button>`);
    if((P.isRH()||P.isMaster())&&!['cancelado','nf_recebida'].includes(l.status))acoes.push(`<button class="btn-small" onclick="remuDesconto('${l.id}')">Desconto</button>`);
    if(P.isMaster()&&l.status==='pendente')acoes.push(`<button class="btn-small" style="color:var(--danger,#C62828);" onclick="remuCancelar('${l.id}')">Cancelar</button>`);
    return`<tr>
        <td><b>${esc(l.nome)}</b>${l.ehPrimeiro?` <span class="badge" style="background:#FFF3E020;color:#E65100;font-size:0.65rem;border:1px solid #E65100;">1º mês</span>`:''}${l.descontoDias?` <span class="badge" style="background:#FCE4EC20;color:#C62828;font-size:0.65rem;border:1px solid #C62828;">${l.descontoDias}d desc.</span>`:''}</td>
        <td>${esc(l.equipe||'—')}</td>
        <td>${l.ehPrimeiro?`<span style="font-size:0.78rem;color:#E65100;">Proporcional (${l.diasTrabalhados||'?'}/${l.diasNoMes||'?'}d)</span>`:'<span style="font-size:0.78rem;color:#2E7D32;">Integral</span>'}</td>
        <td>R$ ${(l.salarioBase||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="color:${l.valorDesconto?'#C62828':'var(--muted)'};">${l.valorDesconto?`- R$ ${l.valorDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—'}</td>
        <td><b>R$ ${(l.valorFinal||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></td>
        <td><span class="badge" style="background:${st.cor}22;color:${st.cor};font-size:0.72rem;">${st.lbl}</span></td>
        <td>${nfCell}</td>
        <td style="white-space:nowrap;">${acoes.join(' ')}</td>
    </tr>`;
}

// ── PJ: minhas remunerações ───────────────────────────────────
function renderMinhasRemuneracoes(){
    const cont=document.getElementById('remuConteudo'); if(!cont)return;
    const fMes=parseInt(document.getElementById('remuFiltroMesPJ')?.value||0);
    const fAno=parseInt(document.getElementById('remuFiltroAnoPJ')?.value||0);
    let lista=remuLancs.filter(l=>l.colabId===user.id);
    if(fMes)lista=lista.filter(l=>l.mes===fMes);
    if(fAno)lista=lista.filter(l=>l.ano===fAno);
    const totalPago=remuLancs.filter(l=>l.colabId===user.id&&l.nfNome).reduce((a,b)=>a+(b.valorFinal||0),0);
    cont.innerHTML=`
    <div class="remu-cards">
        <div class="remu-card"><div class="remu-card-val">${remuLancs.filter(l=>l.colabId===user.id).length}</div><div class="remu-card-lbl">Competências</div></div>
        <div class="remu-card"><div class="remu-card-val">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="remu-card-lbl">Total recebido (NF emitida)</div></div>
    </div>
    ${lista.length?`
    <div style="overflow-x:auto;margin-top:0.8rem;">
    <table class="remu-table">
        <thead><tr><th>Período</th><th>Tipo</th><th>Salário Base</th><th>Desconto</th><th>Valor Final</th><th>Status</th><th>NF</th></tr></thead>
        <tbody>${lista.map(l=>{
            const st=_stMap[l.status]||_stMap.pendente;
            return`<tr>
                <td><b>${MESES_REMU[l.mes]||l.mes}/${l.ano}</b></td>
                <td>${l.ehPrimeiro?`<span style="font-size:0.78rem;color:#E65100;">Proporcional (${l.diasTrabalhados}/${l.diasNoMes} dias)</span>`:'<span style="font-size:0.78rem;color:#2E7D32;">Integral</span>'}</td>
                <td>R$ ${(l.salarioBase||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                <td style="color:${l.valorDesconto?'#C62828':'var(--muted)'};">${l.valorDesconto?`- R$ ${l.valorDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—'}</td>
                <td><b>R$ ${(l.valorFinal||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></td>
                <td><span class="badge" style="background:${st.cor}22;color:${st.cor};font-size:0.72rem;">${st.lbl}</span></td>
                <td>${l.nfNome
                    ?`<a href="${l.nfUrl||'#'}" target="_blank" style="font-size:0.78rem;color:var(--teal);">${ico('external-link',{size:12})} Ver NF</a>`
                    :(l.status==='aguardando_nf'?`<button class="btn-small btn-eval" onclick="uploadNFRem('${l.id}','${MESES_REMU[l.mes]}/${l.ano}',${l.valorFinal||0})">Enviar NF</button>`:'—')}</td>
            </tr>`;
        }).join('')}</tbody>
    </table></div>`
    :`<div style="text-align:center;padding:2.5rem;color:var(--muted);border:1.5px dashed var(--border);border-radius:var(--radius-lg);margin-top:0.8rem;">Nenhuma remuneração encontrada para o período selecionado.</div>`}`;
}

// ── Geração de preview ────────────────────────────────────────
async function gerarPreviewRemuneracao(){
    const mes=parseInt(document.getElementById('remuGerarMes')?.value||0);
    const ano=parseInt(document.getElementById('remuGerarAno')?.value||0);
    if(!mes||!ano){mostrarNotif('','Selecione mês e ano','','',3000);return;}
    const btn=document.getElementById('remuBtnGerar');
    if(btn){btn.disabled=true;btn.textContent='Carregando...';}
    try{
        const pjs=(todosColabs.length?todosColabs:talentos).filter(c=>c.tipoContrato==='PJ'&&c.ativo!==false);
        if(!pjs.length){mostrarNotif('','Nenhum PJ ativo encontrado','Cadastre colaboradores com tipo de contrato PJ.','',5000);return;}
        const existentes=remuLancs.filter(l=>l.mes===mes&&l.ano===ano).map(l=>l.colabId);
        const novos=pjs.filter(c=>!existentes.includes(c.id));
        if(!novos.length){mostrarNotif('','Todos os PJs já têm lançamento',`Já existem lançamentos para ${MESES_REMU[mes]}/${ano}.`,'',4000);document.getElementById('remuPreviewArea').innerHTML='<p style="color:var(--muted);font-size:0.88rem;">Todos os PJs já têm lançamento neste mês.</p>';return;}
        remuPreview=novos.map(c=>{
            const{diasMes,diasTrab,ehPrimeiro,valorBruto}=_remuCalc(c,mes,ano);
            return{colabId:c.id,nome:c.nome,equipe:c.equipe||'',cnpj:c.cnpj||'',razaoSocial:c.razaoSocial||'',dataAdmissao:c.dataAdmissao||'',salarioBase:parseFloat(c.salario)||0,diasNoMes:diasMes,diasTrabalhados:diasTrab,descontoDias:0,ehPrimeiro,valorBruto,valorDesconto:0,valorFinal:Math.round(valorBruto*100)/100,mes,ano};
        });
        _renderPreviewRemu();
    }catch(e){mostrarNotif('','Erro ao gerar preview',e?.message||'','',6000);}
    finally{if(btn){btn.disabled=false;btn.textContent='Gerar';}}
}

function _renderPreviewRemu(){
    const cont=document.getElementById('remuPreviewArea'); if(!cont)return;
    if(!remuPreview.length){cont.innerHTML='';return;}
    const total=remuPreview.reduce((a,b)=>a+(b.valorFinal||0),0);
    cont.innerHTML=`
    <div style="padding:0.8rem 0 0.4rem;border-top:1px solid var(--border);margin-top:0.8rem;">
        <b style="font-size:0.9rem;">${remuPreview.length} colaborador(es) · Total: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b>
    </div>
    <div style="overflow-x:auto;">
    <table class="remu-table">
        <thead><tr><th>Colaborador</th><th>Equipe</th><th>Tipo</th><th>Dias</th><th>Salário Base</th><th>Valor Final</th></tr></thead>
        <tbody>${remuPreview.map(r=>`<tr>
            <td>${esc(r.nome)}</td>
            <td>${esc(r.equipe)}</td>
            <td>${r.ehPrimeiro?`<span style="font-size:0.78rem;color:#E65100;">Proporcional (${r.diasTrabalhados}/${r.diasNoMes}d)</span>`:'<span style="font-size:0.78rem;color:#2E7D32;">Integral</span>'}</td>
            <td>${r.diasTrabalhados}/${r.diasNoMes}</td>
            <td>R$ ${r.salarioBase.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td><b>R$ ${r.valorFinal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b></td>
        </tr>`).join('')}</tbody>
    </table></div>
    <button class="btn-primary" style="margin-top:0.8rem;width:auto;" onclick="confirmarGeracaoRemuneracao()">${ico('check',{size:14})} Confirmar e criar lançamentos</button>`;
}

async function confirmarGeracaoRemuneracao(){
    if(!remuPreview.length)return;
    const btn=event?.target; if(btn){btn.disabled=true;btn.textContent='Salvando...';}
    try{
        const batch=db.batch();
        remuPreview.forEach(r=>{
            const ref=db.collection('lancamentosRemuneracao').doc();
            batch.set(ref,{...r,status:'pendente',statusNF:'pendente',geradoEm:firebase.firestore.FieldValue.serverTimestamp(),geradoPor:user.id,geradoPorNome:user.nome,nfNome:null,nfUrl:null,nfDriveId:null,nfUploadEm:null,confirmadoEm:null,confirmadoPor:null,nfHistorico:[]});
        });
        await batch.commit();
        mostrarNotif('','Lançamentos criados!',`${remuPreview.length} lançamentos de remuneração gerados.`,'bonus',5000);
        remuPreview=[];
        document.getElementById('remuPreviewArea').innerHTML='';
        await carregarRemuneracao();
        renderPainelRemuneracao();
        renderDashRemuneracao();
    }catch(e){mostrarNotif('','Erro ao salvar',e?.message||'Tente novamente.','',7000);}
    finally{if(btn){btn.disabled=false;btn.textContent='Confirmar e criar lançamentos';}}
}

async function remuConfirmar(id){
    try{
        await db.collection('lancamentosRemuneracao').doc(id).update({status:'aguardando_nf',confirmadoEm:firebase.firestore.FieldValue.serverTimestamp(),confirmadoPor:user.id,confirmadoPorNome:user.nome});
        const l=remuLancs.find(x=>x.id===id);
        if(l){
            l.status='aguardando_nf';
            db.collection('notificacoesRemuneracao').add({colabId:l.colabId,nome:l.nome,mes:l.mes,ano:l.ano,valor:l.valorFinal,lida:false,mensagem:`Sua remuneração de ${MESES_REMU[l.mes]}/${l.ano} foi confirmada. Emita a NF no valor R$ ${(l.valorFinal||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} e faça o upload.`,criadoEm:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
        }
        mostrarNotif('','Confirmado!','PJ será notificado para emitir a NF.','bonus',4000);
        renderPainelRemuneracao();
    }catch(e){mostrarNotif('','Erro',e?.message||'Tente novamente.','',6000);}
}

async function remuCancelar(id){
    if(!confirm('Cancelar este lançamento de remuneração?'))return;
    try{
        await db.collection('lancamentosRemuneracao').doc(id).update({status:'cancelado'});
        const l=remuLancs.find(x=>x.id===id); if(l)l.status='cancelado';
        renderPainelRemuneracao();
    }catch(e){mostrarNotif('','Erro',e?.message||'','',5000);}
}

function remuDesconto(id){
    const l=remuLancs.find(x=>x.id===id); if(!l)return;
    document.getElementById('remuDescontoId').value=id;
    document.getElementById('remuDescontoDias').value=l.descontoDias||0;
    document.getElementById('remuDescontoNome').textContent=l.nome+' — '+MESES_REMU[l.mes]+'/'+l.ano;
    document.getElementById('remuDescontoBase').textContent='Salário: R$ '+l.salarioBase.toLocaleString('pt-BR',{minimumFractionDigits:2})+' / '+l.diasNoMes+' dias';
    document.getElementById('modalRemuDesconto').style.display='block';
    remuAtualizarDesconto();
}

function remuAtualizarDesconto(){
    const id=document.getElementById('remuDescontoId').value;
    const l=remuLancs.find(x=>x.id===id); if(!l)return;
    const dias=parseInt(document.getElementById('remuDescontoDias').value)||0;
    const valorBruto=l.valorBruto||(l.ehPrimeiro?(l.diasTrabalhados/l.diasNoMes)*l.salarioBase:l.salarioBase);
    const desconto=Math.round((dias/l.diasNoMes)*l.salarioBase*100)/100;
    const final=Math.max(0,Math.round((valorBruto-desconto)*100)/100);
    document.getElementById('remuDescontoPreview').textContent=`Desconto: R$ ${desconto.toLocaleString('pt-BR',{minimumFractionDigits:2})} → Valor final: R$ ${final.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
}

async function remuSalvarDesconto(){
    const id=document.getElementById('remuDescontoId').value;
    const l=remuLancs.find(x=>x.id===id); if(!l)return;
    const dias=parseInt(document.getElementById('remuDescontoDias').value)||0;
    const valorBruto=l.valorBruto||(l.ehPrimeiro?(l.diasTrabalhados/l.diasNoMes)*l.salarioBase:l.salarioBase);
    const valorDesconto=Math.round((dias/l.diasNoMes)*l.salarioBase*100)/100;
    const valorFinal=Math.max(0,Math.round((valorBruto-valorDesconto)*100)/100);
    try{
        await db.collection('lancamentosRemuneracao').doc(id).update({descontoDias:dias,valorDesconto,valorFinal,valorBruto});
        Object.assign(l,{descontoDias:dias,valorDesconto,valorFinal,valorBruto});
        document.getElementById('modalRemuDesconto').style.display='none';
        mostrarNotif('','Desconto salvo!','','bonus',3000);
        renderPainelRemuneracao();
    }catch(e){mostrarNotif('','Erro',e?.message||'','',5000);}
}

// ── NF Upload ─────────────────────────────────────────────────
function uploadNFRem(lancId,periodo,valor){
    const input=document.createElement('input');input.type='file';input.accept='application/pdf';
    input.onchange=async(e)=>{
        const file=e.target.files[0]; if(!file)return;
        await _uploadNFRemuneracao(lancId,file,periodo,valor);
    };
    input.click();
}

async function _nfToBase64Remu(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});}

async function _uploadNFRemuneracao(lancId,file,periodo,valor){
    if(file.size>10*1024*1024){mostrarNotif('','Arquivo muito grande','A NF deve ter no máximo 10 MB.','',4000);return;}
    if(file.type!=='application/pdf'){mostrarNotif('','Formato inválido','A NF precisa ser um PDF.','',4000);return;}
    mostrarNotif('','Enviando NF...','Aguarde — o arquivo está sendo registrado no Drive.','',5000);
    // Envia ao Storage; o gatilho processarNFStorage sobe para o Drive.
    const antes=(remuLancs.find(l=>l.id===lancId)||{}).nfDriveId||null;
    const atualizarTela=async()=>{
        await carregarRemuneracao();
        const isPJ=user?.tipoContrato==='PJ'&&!P.isRH()&&!P.isMaster();
        if(isPJ)renderMinhasRemuneracoes(); else{renderPainelRemuneracao();renderDashRemuneracao();}
    };
    try{
        const nome=(file.name||'nf.pdf').replace(/[^\w.\-]+/g,'_');
        const ref=firebase.storage().ref(`nf-pendentes/remuneracao/${lancId}/${Date.now()}_${nome}`);
        await ref.put(file,{contentType:'application/pdf',customMetadata:{autorNome:user?.nome||user?.email||''}});
        _aguardarNF('lancamentosRemuneracao',lancId,antes,atualizarTela);
    }catch(err){mostrarNotif('','Falha no envio',err.message||'Erro desconhecido','',7000);}
}

// ── Exports ───────────────────────────────────────────────────
function _remuListaFiltrada(){
    const mes=parseInt(document.getElementById('remuFiltroMes')?.value||0);
    const ano=parseInt(document.getElementById('remuFiltroAno')?.value||0);
    let lista=remuLancs;
    if(mes)lista=lista.filter(l=>l.mes===mes);
    if(ano)lista=lista.filter(l=>l.ano===ano);
    return lista;
}

function exportarExcelRemuneracao(){
    const lista=_remuListaFiltrada();
    if(!lista.length){mostrarNotif('','Nenhum dado para exportar','','',3000);return;}
    const wb=XLSX.utils.book_new();
    const rows=[['Colaborador','CNPJ','Razão Social','Equipe','Mês','Ano','Tipo','Dias Trabalhados','Dias no Mês','Salário Base','Dias Desconto','Valor Desconto','Valor Final','Status','NF'],...lista.map(l=>[l.nome,l.cnpj||'',l.razaoSocial||'',l.equipe||'',MESES_REMU[l.mes]||l.mes,l.ano,l.ehPrimeiro?'Proporcional':'Integral',l.diasTrabalhados||l.diasNoMes||'',l.diasNoMes||'',l.salarioBase||0,l.descontoDias||0,l.valorDesconto||0,l.valorFinal||0,(_stMap[l.status]||_stMap.pendente).lbl,l.nfNome||''])];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    const mes=parseInt(document.getElementById('remuFiltroMes')?.value||0);
    const ano=document.getElementById('remuFiltroAno')?.value||'';
    XLSX.utils.book_append_sheet(wb,ws,'Remuneração');
    XLSX.writeFile(wb,`Remuneracao_${MESES_REMU[mes]||'Todos'}_${ano||'Todos'}.xlsx`);
    mostrarNotif('','Excel gerado!',`${lista.length} registro(s).`,'bonus',4000);
}

function exportarOmieRemuneracao(){
    const lista=_remuListaFiltrada().filter(l=>['confirmado','aguardando_nf','nf_recebida'].includes(l.status));
    if(!lista.length){mostrarNotif('','Nenhum lançamento confirmado','Apenas lançamentos confirmados são exportados para o OMIE.','',4000);return;}
    const wb=XLSX.utils.book_new();
    const hoje=new Date();
    const dtEmissao=`${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
    const header=[
        ['Importação de Contas a Pagar — Remuneração PJ — Gerado por Mirae PDI em '+new Date().toLocaleString('pt-BR')],
        ['Preencha os campos obrigatórios (*) Categoria e Conta Corrente antes de importar no OMIE.'],
        [],
        ['Fornecedor (CNPJ)','Nome / Razão Social','Data de Emissão','Data de Vencimento','Número do Documento','Parcela','Valor','Categoria *','Conta Corrente *','Observação'],
    ];
    lista.forEach(l=>{
        const venc=new Date(l.ano,l.mes,5);
        const dtVenc=`${String(venc.getDate()).padStart(2,'0')}/${String(venc.getMonth()+1).padStart(2,'0')}/${venc.getFullYear()}`;
        header.push([l.cnpj||'',l.razaoSocial||l.nome,dtEmissao,dtVenc,`REM-${l.mes}-${l.ano}-${l.colabId.slice(-4)}`.toUpperCase(),'001',l.valorFinal||0,'','',`Remuneração PJ ${MESES_REMU[l.mes]}/${l.ano} — ${l.nome}`]);
    });
    const ws=XLSX.utils.aoa_to_sheet(header);
    const mes=parseInt(document.getElementById('remuFiltroMes')?.value||0);
    const ano=document.getElementById('remuFiltroAno')?.value||'';
    XLSX.utils.book_append_sheet(wb,ws,'ContasPagar');
    XLSX.writeFile(wb,`OMIE_Remuneracao_${MESES_REMU[mes]||'Todos'}${ano||''}.xlsx`);
    mostrarNotif('','Planilha OMIE gerada!',`${lista.length} registro(s). Preencha Categoria e Conta Corrente antes de importar.`,'bonus',6000);
}

function exportarPDFRemuneracao(){
    const lista=_remuListaFiltrada();
    if(!lista.length){mostrarNotif('','Nenhum dado','','',3000);return;}
    const{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const W=doc.internal.pageSize.getWidth();
    const mes=parseInt(document.getElementById('remuFiltroMes')?.value||0);
    const ano=document.getElementById('remuFiltroAno')?.value||'';
    doc.setFontSize(15);doc.setTextColor(2,59,72);
    doc.text(`Remuneração PJ — ${MESES_REMU[mes]||'Todos'} ${ano}`,14,16);
    doc.setFontSize(9);doc.setTextColor(100);
    doc.text('Gerado em '+new Date().toLocaleString('pt-BR'),14,22);
    const total=lista.reduce((a,b)=>a+(b.valorFinal||0),0);
    doc.text(`Total: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})} — ${lista.length} colaborador(es)`,14,28);
    let y=36;
    const cols=['Colaborador','Equipe','Tipo','Sal. Base','Desconto','Valor Final','Status','NF'];
    const cw=[52,32,32,28,24,28,26,30];
    doc.setFontSize(8);doc.setTextColor(2,59,72);doc.setFont(undefined,'bold');
    let x=14;cols.forEach((c,i)=>{doc.text(c,x,y);x+=cw[i];});
    y+=2;doc.setDrawColor(218,180,126);doc.line(14,y,W-14,y);y+=5;
    doc.setFont(undefined,'normal');doc.setTextColor(40);
    lista.forEach(l=>{
        if(y>190){doc.addPage();y=20;}
        x=14;
        const row=[l.nome,l.equipe||'',l.ehPrimeiro?'Proporcional':'Integral','R$ '+(l.salarioBase||0).toLocaleString('pt-BR',{minimumFractionDigits:2}),l.valorDesconto?'R$ '+l.valorDesconto.toLocaleString('pt-BR',{minimumFractionDigits:2}):'—','R$ '+(l.valorFinal||0).toLocaleString('pt-BR',{minimumFractionDigits:2}),(_stMap[l.status]||_stMap.pendente).lbl,l.nfNome?'Emitida':'Pendente'];
        row.forEach((v,i)=>{doc.text(String(v).slice(0,26),x,y);x+=cw[i];});
        y+=6;
    });
    doc.save(`Remuneracao_${MESES_REMU[mes]||'Todos'}${ano||''}.pdf`);
    mostrarNotif('','PDF gerado!',`${lista.length} registro(s).`,'bonus',4000);
}

// ── Dashboards com filtros por gráfico ───────────────────────
let _dashF={folha:{eq:'',colab:''},equipe:{mes:'',ano:''},status:{mes:'',ano:''},colabs:{mes:'',ano:'',eq:''},ticket:{eq:'',colab:''},qtd:{eq:'',ano:''}};
let _dashCharts={};

function remuDashFiltrar(chartId,key,val){
    if(!_dashF[chartId])return;
    _dashF[chartId][key]=val;
    _dashDraw(chartId);
}

function _dashDraw(chartId){
    const C=window.Chart; if(!C)return;
    if(_dashCharts[chartId]){_dashCharts[chartId].destroy();delete _dashCharts[chartId];}
    C.defaults.font.family="'Hanken Grotesk','Segoe UI',sans-serif";
    C.defaults.font.size=11;
    const teal='#1E7D90',gold='#DAB47E',dark='#023B48',green='#3F8A6E',red='#D98E6A';
    const fmtR=v=>'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0});
    const agora=new Date();
    const m12=[];for(let i=11;i>=0;i--){const d=new Date(agora.getFullYear(),agora.getMonth()-i,1);m12.push({mes:d.getMonth()+1,ano:d.getFullYear(),label:MESES_REMU[d.getMonth()+1].slice(0,3)+'/'+String(d.getFullYear()).slice(2)});}

    const _applyF=(data,f)=>{
        let d=[...data];
        if(f.eq)d=d.filter(l=>(l.equipe||'')===(f.eq));
        if(f.colab)d=d.filter(l=>l.colabId===f.colab);
        if(f.mes)d=d.filter(l=>l.mes===parseInt(f.mes));
        if(f.ano)d=d.filter(l=>l.ano===parseInt(f.ano));
        return d;
    };
    const _emptyMsg=(canvasId,msg)=>{const cv=document.getElementById(canvasId);if(cv){const p=document.createElement('p');p.style.cssText='color:var(--muted);font-size:0.84rem;text-align:center;margin:1rem 0;';p.textContent=msg;cv.replaceWith(p);}};

    if(chartId==='folha'){
        const data=_applyF(remuLancs,_dashF.folha);
        const vals=m12.map(m=>data.filter(l=>l.mes===m.mes&&l.ano===m.ano).reduce((a,b)=>a+(b.valorFinal||0),0));
        const cv=document.getElementById('remuChartFolha');if(!cv)return;
        _dashCharts.folha=new C(cv,{type:'bar',data:{labels:m12.map(m=>m.label),datasets:[{label:'Total (R$)',data:vals,backgroundColor:teal+'55',borderColor:teal,borderWidth:2,borderRadius:5}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:fmtR}}}}});
    }
    if(chartId==='equipe'){
        const data=_applyF(remuLancs,_dashF.equipe);
        const eqMap={};data.forEach(l=>{const eq=l.equipe||'Sem equipe';eqMap[eq]=(eqMap[eq]||0)+(l.valorFinal||0);});
        const eqN=Object.keys(eqMap).sort(),eqV=eqN.map(e=>eqMap[e]);
        const cv=document.getElementById('remuChartEq');if(!cv)return;
        if(eqN.length)_dashCharts.equipe=new C(cv,{type:'bar',data:{labels:eqN,datasets:[{data:eqV,backgroundColor:[teal+'88',gold+'88',dark+'66',green+'88',red+'88'],borderRadius:5}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:fmtR}}}}});
        else _emptyMsg('remuChartEq','Nenhum dado no período.');
    }
    if(chartId==='status'){
        const data=_applyF(remuLancs,_dashF.status);
        const stC={pendente:0,confirmado:0,aguardando_nf:0,nf_recebida:0,cancelado:0};
        data.forEach(l=>{if(stC[l.status]!==undefined)stC[l.status]++;});
        const cv=document.getElementById('remuChartStatus');if(!cv)return;
        _dashCharts.status=new C(cv,{type:'doughnut',data:{labels:['Pendente','Confirmado','Aguard. NF','NF Recebida','Cancelado'],datasets:[{data:[stC.pendente,stC.confirmado,stC.aguardando_nf,stC.nf_recebida,stC.cancelado],backgroundColor:['#9E9E9E44','#1565C044','#E6510044','#2E7D3244','#B71C1C44'],borderColor:['#9E9E9E','#1565C0','#E65100','#2E7D32','#B71C1C'],borderWidth:2}]},options:{plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}}}}});
    }
    if(chartId==='colabs'){
        const data=_applyF(remuLancs,_dashF.colabs).sort((a,b)=>(b.valorFinal||0)-(a.valorFinal||0)).slice(0,8);
        const cv=document.getElementById('remuChartColabs');if(!cv)return;
        if(data.length)_dashCharts.colabs=new C(cv,{type:'bar',data:{labels:data.map(l=>{const p=l.nome.split(' ');return p[0]+(p.length>1?' '+p[p.length-1]:'');}),datasets:[{data:data.map(l=>l.valorFinal||0),backgroundColor:gold+'88',borderColor:gold,borderWidth:2,borderRadius:5}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:fmtR}}}}});
        else _emptyMsg('remuChartColabs','Nenhum dado no período.');
    }
    if(chartId==='ticket'){
        const f=_dashF.ticket;
        const ticks=m12.map(m=>{let d=remuLancs.filter(l=>l.mes===m.mes&&l.ano===m.ano);if(f.eq)d=d.filter(l=>(l.equipe||'')===f.eq);if(f.colab)d=d.filter(l=>l.colabId===f.colab);return d.length?Math.round(d.reduce((a,b)=>a+(b.valorFinal||0),0)/d.length*100)/100:0;});
        const cv=document.getElementById('remuChartTicket');if(!cv)return;
        _dashCharts.ticket=new C(cv,{type:'line',data:{labels:m12.map(m=>m.label),datasets:[{data:ticks,borderColor:gold,backgroundColor:gold+'22',fill:true,tension:0.4,pointRadius:3}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:fmtR}}}}});
    }
    if(chartId==='qtd'){
        const f=_dashF.qtd;
        const qtds=m12.map(m=>{let d=remuLancs.filter(l=>l.mes===m.mes&&l.ano===m.ano);if(f.eq)d=d.filter(l=>(l.equipe||'')===f.eq);if(f.ano)d=d.filter(l=>l.ano===parseInt(f.ano));return d.length;});
        const cv=document.getElementById('remuChartQtd');if(!cv)return;
        _dashCharts.qtd=new C(cv,{type:'line',data:{labels:m12.map(m=>m.label),datasets:[{data:qtds,borderColor:teal,backgroundColor:teal+'22',fill:true,tension:0.4,pointRadius:3}]},options:{plugins:{legend:{display:false}}}});
    }
}

function renderDashRemuneracao(){
    const cont=document.getElementById('remuDashConteudo'); if(!cont||!remuLancs.length)return;
    const agora=new Date();
    const mesAtual=agora.getMonth()+1, anoAtual=agora.getFullYear();
    // Reseta estado dos filtros
    _dashF={folha:{eq:'',colab:''},equipe:{mes:String(mesAtual),ano:String(anoAtual)},status:{mes:String(mesAtual),ano:String(anoAtual)},colabs:{mes:String(mesAtual),ano:String(anoAtual),eq:''},ticket:{eq:'',colab:''},qtd:{eq:'',ano:''}};
    _dashCharts={};
    // Opções derivadas dos dados existentes
    const anos=[...new Set(remuLancs.map(l=>l.ano))].sort((a,b)=>b-a);
    const eqs=[...new Set(remuLancs.map(l=>l.equipe||'').filter(Boolean))].sort();
    const colabs=[...new Map(remuLancs.map(l=>[l.colabId,l.nome])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
    const mesesDisp=[...new Set(remuLancs.map(l=>l.mes))].sort((a,b)=>a-b);
    const _anoOpts=anos.map(a=>`<option value="${a}"${String(a)===String(anoAtual)?' selected':''}>${a}</option>`).join('');
    const _eqOpts=eqs.map(e=>`<option value="${esc(e)}">${esc(e)}</option>`).join('');
    const _colabOpts=colabs.map(([id,nome])=>`<option value="${id}">${esc(nome)}</option>`).join('');
    const _mesOpts=mesesDisp.map(m=>`<option value="${m}"${m===mesAtual?' selected':''}>${MESES_REMU[m]||m}</option>`).join('');
    const sel=(cid,key,opts,ph,extra='')=>`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('${cid}','${key}',this.value)">${extra?`<option value="">${ph}</option>`:`<option value="">${ph}</option>`}${opts}</select>`;
    const filtBar=(...items)=>`<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin:0.3rem 0 0.5rem;">${items.join('')}</div>`;
    // Cards de topo (mês atual, sem filtro)
    const doMes=remuLancs.filter(l=>l.mes===mesAtual&&l.ano===anoAtual);
    const totalMesAtual=doMes.reduce((a,b)=>a+(b.valorFinal||0),0);
    const mesAnt=mesAtual===1?12:mesAtual-1,anoAnt=mesAtual===1?anoAtual-1:anoAtual;
    const totalAnt=remuLancs.filter(l=>l.mes===mesAnt&&l.ano===anoAnt).reduce((a,b)=>a+(b.valorFinal||0),0);
    const varPct=totalAnt?Math.round((totalMesAtual-totalAnt)/totalAnt*100):null;
    const ticketAtual=doMes.length?Math.round(totalMesAtual/doMes.length*100)/100:0;

    cont.innerHTML=`
    <div style="margin:1.2rem 0 0.5rem;"><h3 style="font-family:'Newsreader',serif;font-weight:400;font-size:1.2rem;color:var(--dark);margin:0;">Análises de Remuneração</h3></div>
    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1rem;">
        <div class="remu-card" style="flex:1;min-width:160px;"><div class="remu-card-val">R$ ${totalMesAtual.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="remu-card-lbl">Folha ${MESES_REMU[mesAtual]}</div></div>
        <div class="remu-card" style="flex:1;min-width:160px;"><div class="remu-card-val" style="color:${varPct===null?'var(--muted)':varPct>=0?'#2E7D32':'#C62828'};">${varPct===null?'—':(varPct>=0?'+':'')+varPct+'%'}</div><div class="remu-card-lbl">vs. mês anterior</div></div>
        <div class="remu-card" style="flex:1;min-width:160px;"><div class="remu-card-val">R$ ${ticketAtual.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="remu-card-lbl">Ticket médio ${MESES_REMU[mesAtual]}</div></div>
        <div class="remu-card" style="flex:1;min-width:160px;"><div class="remu-card-val">${doMes.length}</div><div class="remu-card-lbl">PJs em ${MESES_REMU[mesAtual]}</div></div>
    </div>
    <div class="remu-dash-grid">
        <div class="card remu-dash-card" style="grid-column:span 2;">
            <div class="remu-dash-title">${ico('chart',{size:14})} Evolução da folha — últimos 12 meses</div>
            ${filtBar(sel('folha','eq',_eqOpts,'Todas as equipes'),sel('folha','colab',_colabOpts,'Todos os colaboradores'))}
            <canvas id="remuChartFolha" height="80"></canvas>
        </div>
        <div class="card remu-dash-card">
            <div class="remu-dash-title">${ico('building',{size:14})} Por departamento</div>
            ${filtBar(`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('equipe','mes',this.value)"><option value="">Todos os meses</option>${_mesOpts}</select>`,`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('equipe','ano',this.value)"><option value="">Todos os anos</option>${_anoOpts}</select>`)}
            <canvas id="remuChartEq" height="160"></canvas>
        </div>
        <div class="card remu-dash-card">
            <div class="remu-dash-title">${ico('target',{size:14})} Status NFs</div>
            ${filtBar(`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('status','mes',this.value)"><option value="">Todos os meses</option>${_mesOpts}</select>`,`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('status','ano',this.value)"><option value="">Todos os anos</option>${_anoOpts}</select>`)}
            <canvas id="remuChartStatus" height="160"></canvas>
        </div>
        <div class="card remu-dash-card" style="grid-column:span 2;">
            <div class="remu-dash-title">${ico('users',{size:14})} Maiores remunerações</div>
            ${filtBar(`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('colabs','mes',this.value)"><option value="">Todos os meses</option>${_mesOpts}</select>`,`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('colabs','ano',this.value)"><option value="">Todos os anos</option>${_anoOpts}</select>`,sel('colabs','eq',_eqOpts,'Todas as equipes'))}
            <canvas id="remuChartColabs" height="75"></canvas>
        </div>
        <div class="card remu-dash-card">
            <div class="remu-dash-title">${ico('money',{size:14})} Ticket médio por mês</div>
            ${filtBar(sel('ticket','eq',_eqOpts,'Todas as equipes'),sel('ticket','colab',_colabOpts,'Todos os colaboradores'))}
            <canvas id="remuChartTicket" height="130"></canvas>
        </div>
        <div class="card remu-dash-card">
            <div class="remu-dash-title">${ico('users',{size:14})} Qtd. de PJs por mês</div>
            ${filtBar(sel('qtd','eq',_eqOpts,'Todas as equipes'),`<select style="border:1px solid var(--border);border-radius:6px;padding:0.22rem 0.5rem;font-size:0.71rem;font-family:inherit;background:var(--surface);color:var(--text);" onchange="remuDashFiltrar('qtd','ano',this.value)"><option value="">Todos os anos</option>${_anoOpts}</select>`)}
            <canvas id="remuChartQtd" height="130"></canvas>
        </div>
    </div>`;
    setTimeout(()=>['folha','equipe','status','colabs','ticket','qtd'].forEach(id=>_dashDraw(id)),80);
}

// ── Notificações ──────────────────────────────────────────────
async function verificarNotifRemuneracao(){
    if(!user?.tipoContrato||user.tipoContrato!=='PJ')return;
    try{
        const snap=await db.collection('notificacoesRemuneracao').where('colabId','==',user.id).where('lida','==',false).limit(5).get();
        snap.docs.forEach(doc=>{
            const d=doc.data();
            mostrarNotif('','Remuneração confirmada',d.mensagem||'','bonus',8000);
            doc.ref.update({lida:true}).catch(()=>{});
        });
    }catch(e){}
}

Object.assign(window,{
    renderRemuneracaoTab, renderPainelRemuneracao, renderMinhasRemuneracoes, renderMinhaRemuAdmin,
    gerarPreviewRemuneracao, confirmarGeracaoRemuneracao,
    remuConfirmar, remuCancelar, remuDesconto, remuAtualizarDesconto, remuSalvarDesconto,
    uploadNFRem, renderDashRemuneracao, remuDashFiltrar, remuInitFiltros, carregarRemuneracao,
    exportarExcelRemuneracao, exportarOmieRemuneracao, exportarPDFRemuneracao,
    verificarNotifRemuneracao,
});
