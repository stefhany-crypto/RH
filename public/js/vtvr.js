function renderMeuVTVR(){
    // Só mostra se tiver lançamentos para este colaborador
    if(!lancamentosVTVR?.length) return;
    const meus = lancamentosVTVR.filter(l=>l.colabId===user.id);
    if(!meus.length) return;
    const isPJ = talentos.find(t=>t.id===user.id)?.tipoContrato==='PJ';
    const meses=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const totalVT=meus.reduce((s,l)=>s+l.totalVT,0);
    const totalVR=meus.reduce((s,l)=>s+l.totalVR,0);
    const totalG=meus.reduce((s,l)=>s+l.total,0);
    let html=`<div style="background:white;border:1px solid var(--border);border-radius:var(--radius-md);padding:1.5rem;box-shadow:var(--shadow-sm);margin-top:1.5rem;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:400;color:var(--dark);margin-bottom:1.2rem;">${isPJ?'Meus Reembolsos — Transporte e Refeição':'Meus Benefícios VT/VR'}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:1.5rem;">
            <div class="stat-card"><div class="stat-label">Total VT</div><div class="stat-value" style="color:var(--teal);font-size:1.3rem;">R$ ${totalVT.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
            <div class="stat-card"><div class="stat-label">Total VR</div><div class="stat-value" style="color:var(--gold);font-size:1.3rem;">R$ ${totalVR.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
            <div class="stat-card"><div class="stat-label">Total Geral</div><div class="stat-value" style="font-size:1.3rem;color:#2E7D32;">R$ ${totalG.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
        </div>`;
    html+=`<div style="overflow-x:auto;"><table><thead><tr><th>Mês/Ano</th><th>Dias</th><th>VT</th><th>VR</th><th>Total</th>${isPJ?'<th>NF</th>':''}</tr></thead><tbody>`;
    meus.sort((a,b)=>b.ano!==a.ano?b.ano-a.ano:b.mes-a.mes).forEach(l=>{
        html+=`<tr>
            <td><strong>${meses[l.mes]}/${l.ano}</strong></td>
            <td>${l.dias} dias</td>
            <td style="color:var(--teal);">R$ ${l.totalVT.toFixed(2)}</td>
            <td style="color:var(--gold);">R$ ${l.totalVR.toFixed(2)}</td>
            <td style="font-weight:700;">R$ ${l.total.toFixed(2)}</td>
            ${isPJ?`<td><button class="btn-small btn-eval" onclick="uploadNF('${l.id}','${meses[l.mes]}/${l.ano}',${l.total})">${l.nfUrl?'Substituir NF':'Enviar NF'}</button></td>`:''}
        </tr>`;
    });
    html+=`</tbody></table></div></div>`;
    // Aviso para PJ
    if(isPJ) html+=`<div style="background:rgba(201,160,90,0.1);border:1px solid rgba(201,160,90,0.3);border-radius:var(--radius-md);padding:1rem 1.5rem;margin-top:1rem;font-size:0.85rem;color:var(--dark);"><strong>Atenção PJ:</strong> Após confirmação do RH/Master, emita a NF com o valor correspondente e faça o upload acima.</div>`;
    const div=document.createElement('div');div.innerHTML=html;
    const container=document.getElementById('meuPdiContainer');
    if(container)container.appendChild(div);
}

function renderMeuVTVRTab(){
    const container = document.getElementById('meuVTVRContainer');
    if(!container) return;
    if(!lancamentosVTVR){ container.innerHTML='<p style="color:var(--muted);padding:2rem;">Carregando...</p>'; return; }
    const meses=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const meus = lancamentosVTVR.filter(l=>l.colabId===user.id).sort((a,b)=>b.ano!==a.ano?b.ano-a.ano:b.mes-a.mes);
    const isPJ = talentos.find(t=>t.id===user.id)?.tipoContrato==='PJ';
    if(!meus.length){
        container.innerHTML=`<div style="text-align:center;padding:3rem;color:var(--muted);"><div style="margin-bottom:1rem;">${ico('bus',{size:40,color:'var(--muted)'})}</div><div style="font-size:1.1rem;">Nenhum lançamento de VT/VR encontrado.</div><div style="font-size:0.85rem;margin-top:0.5rem;">Seus benefícios aparecerão aqui quando o RH processar o mês.</div></div>`;
        return;
    }
    const totalVT=meus.reduce((s,l)=>s+l.totalVT,0);
    const totalVR=meus.reduce((s,l)=>s+l.totalVR,0);
    const totalG=meus.reduce((s,l)=>s+l.total,0);
    const ultimoMes=meus[0];
    let alertaPJ='';
    if(isPJ){
        const semNF=meus.filter(l=>!l.nfNome);
        if(semNF.length>0){
            alertaPJ=`<div style="background:rgba(201,160,90,0.15);border:1.5px solid rgba(201,160,90,0.5);border-radius:var(--radius-md);padding:1rem 1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1rem;">${ico('alert',{size:24,color:'#C9A05A'})}<div><div style="font-weight:700;color:var(--dark);margin-bottom:0.2rem;">NF pendente: ${semNF.length} mês(es)</div><div style="font-size:0.82rem;color:var(--muted);">Você tem lançamentos confirmados aguardando envio de Nota Fiscal.</div></div></div>`;
        }
    }
    let html=`<div style="margin-bottom:1.5rem;"><div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:400;color:var(--dark);margin-bottom:1.2rem;">${isPJ?'Meus Reembolsos — Transporte e Refeição':'Meus Benefícios VT/VR'}</div>${alertaPJ}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem;"><div class="stat-card"><div class="stat-label">Total VT Acumulado</div><div class="stat-value" style="color:var(--teal);font-size:1.2rem;">R$ ${totalVT.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div><div class="stat-card"><div class="stat-label">Total VR Acumulado</div><div class="stat-value" style="color:var(--gold);font-size:1.2rem;">R$ ${totalVR.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div><div class="stat-card"><div class="stat-label">Total Geral</div><div class="stat-value" style="color:#2E7D32;font-size:1.2rem;">R$ ${totalG.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div><div class="stat-card"><div class="stat-label">Último Mês</div><div class="stat-value" style="font-size:1rem;">${meses[ultimoMes.mes]}/${ultimoMes.ano} — R$ ${ultimoMes.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div></div></div>`;
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;margin-bottom:2rem;"><div class="card" style="border-top-color:var(--teal);padding:1.5rem;"><div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:1rem;">Evolução Mensal</div><div style="height:220px;"><canvas id="chartMeuVTEvolucao"></canvas></div></div><div class="card" style="border-top-color:var(--gold);padding:1.5rem;"><div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:1rem;">VT vs VR</div><div style="height:220px;"><canvas id="chartMeuVTComparativo"></canvas></div></div></div>`;
    html+=`<div class="card" style="padding:1.5rem;"><div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-bottom:1rem;">Histórico de Lançamentos</div><div style="overflow-x:auto;"><table><thead><tr><th>Mês/Ano</th><th>Dias</th><th>VT</th><th>VR</th><th>Total</th>${isPJ?'<th>Nota Fiscal</th>':''}</tr></thead><tbody>`;
    meus.forEach(l=>{
        const nfHistHtml = l.nfHistorico&&l.nfHistorico.length>0
            ? `<details style="margin-top:4px;"><summary style="font-size:0.7rem;color:var(--muted);cursor:pointer;">${l.nfHistorico.length} versão(ões) anterior(es)</summary><div style="font-size:0.7rem;color:var(--muted);margin-top:4px;">${l.nfHistorico.map(h=>`<div>• ${esc(h.nfNome)} — ${esc(h.enviadoEm)}</div>`).join('')}</div></details>`
            : '';
        const nfStatus=l.nfNome
            ?`<div><span style="color:#2E7D32;font-size:0.8rem;">${esc(l.nfNome)}</span><br><span style="font-size:0.7rem;color:var(--muted);">${l.nfUploadEm||''}</span><br><button class="btn-small" style="margin-top:4px;font-size:0.72rem;" onclick="uploadNFTab('${l.id}','${meses[l.mes]}/${l.ano}',${l.total})">Substituir</button>${nfHistHtml}</div>`
            :`<button class="btn-small btn-eval" onclick="uploadNFTab('${l.id}','${meses[l.mes]}/${l.ano}',${l.total})">Enviar NF</button>`;
        html+=`<tr><td><strong>${meses[l.mes]}/${l.ano}</strong></td><td>${l.dias} dias</td><td style="color:var(--teal);">R$ ${l.totalVT.toFixed(2)}</td><td style="color:var(--gold);">R$ ${l.totalVR.toFixed(2)}</td><td style="font-weight:700;">R$ ${l.total.toFixed(2)}</td>${isPJ?`<td>${nfStatus}</td>`:''}</tr>`;
    });
    html+=`</tbody></table></div>${isPJ?`<div style="background:rgba(201,160,90,0.1);border:1px solid rgba(201,160,90,0.3);border-radius:var(--radius-md);padding:1rem 1.5rem;margin-top:1rem;font-size:0.85rem;color:var(--dark);"><strong>Atenção PJ:</strong> Após o RH confirmar, emita a NF com o valor exato e faça o upload acima.</div>`:''}</div>`;
    container.innerHTML=html;
    setTimeout(()=>{
        const meusOrd=[...meus].sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.mes-b.mes);
        const labels=meusOrd.map(l=>meses[l.mes]+'/'+l.ano);
        const cv1=document.getElementById('chartMeuVTEvolucao');
        if(cv1){if(charts.meuVTEv){try{charts.meuVTEv.destroy();}catch(e){}}charts.meuVTEv=new Chart(cv1.getContext('2d'),{type:'line',data:{labels,datasets:[{label:'VT',data:meusOrd.map(l=>l.totalVT),borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.1)',tension:0.4,fill:true},{label:'VR',data:meusOrd.map(l=>l.totalVR),borderColor:'#C9A05A',backgroundColor:'rgba(201,160,90,0.1)',tension:0.4,fill:true},{label:'Total',data:meusOrd.map(l=>l.total),borderColor:'#2E7D32',backgroundColor:'rgba(46,125,50,0.05)',tension:0.4,fill:false,borderDash:[4,4]}]},options:{maintainAspectRatio:false,scales:{y:{grid:{color:'#f0f0f0'}}},plugins:{legend:{position:'bottom'}}}});}
        const cv2=document.getElementById('chartMeuVTComparativo');
        if(cv2){if(charts.meuVTComp){try{charts.meuVTComp.destroy();}catch(e){}}charts.meuVTComp=new Chart(cv2.getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'VT',data:meusOrd.map(l=>l.totalVT),backgroundColor:'rgba(30,125,144,0.8)',borderRadius:4},{label:'VR',data:meusOrd.map(l=>l.totalVR),backgroundColor:'rgba(201,160,90,0.8)',borderRadius:4}]},options:{maintainAspectRatio:false,scales:{y:{grid:{color:'#f0f0f0'}}},plugins:{legend:{position:'bottom'}}}});}
    },150);
}
function uploadNFTab(lancId,periodo,valor){
    const input=document.createElement('input');input.type='file';input.accept='application/pdf';
    input.onchange=async(e)=>{
        const file=e.target.files[0];if(!file)return;
        if(file.size>5*1024*1024){mostrarNotif('','Arquivo muito grande','A NF deve ter no máximo 5MB.','',4000);return;}
        mostrarNotif('','Enviando NF...','Aguarde o upload do arquivo.','',3000);
        try{
            const nomeSeguro=file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
            const ref=storage.ref(`nf/${lancId}/${Date.now()}_${nomeSeguro}`);
            await ref.put(file);
            const nfUrl=await ref.getDownloadURL();
            const docAtual=await db.collection('lancamentosVTVR').doc(lancId).get();
            const dadosAtuais=docAtual.exists?docAtual.data():{};
            const histAnterior=dadosAtuais.nfHistorico||[];
            if(dadosAtuais.nfNome) histAnterior.push({nfNome:dadosAtuais.nfNome,nfUrl:dadosAtuais.nfUrl||'',enviadoEm:dadosAtuais.nfUploadEm||''});
            await db.collection('lancamentosVTVR').doc(lancId).update({nfNome:file.name,nfUrl,nfUploadEm:new Date().toLocaleString('pt-BR'),nfUploadPor:user.nome,statusNF:'emitida',nfHistorico:histAnterior});
        }catch(err){mostrarNotif('','Falha no upload','Não foi possível enviar a NF: '+err.message,'',6000);return;}
        mostrarNotif('','NF enviada!',`NF para ${periodo} (R$ ${valor.toFixed(2)}) registrada com sucesso.`,'bonus',5000);
        await carregarVTVRColab();renderMeuVTVRTab();
    };
    input.click();
}
function uploadNF(lancId, periodo, valor){
    // Cria input de arquivo temporário
    const input=document.createElement('input');input.type='file';input.accept='application/pdf';
    input.onchange=async(e)=>{
        const file=e.target.files[0];if(!file)return;
        if(file.size>5*1024*1024){mostrarNotif('','Arquivo muito grande','A NF deve ter no máximo 5MB.','',4000);return;}
        mostrarNotif('','Enviando NF...','Aguarde o upload do arquivo.','',3000);
        try{
            const nomeSeguro=file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
            const ref=storage.ref(`nf/${lancId}/${Date.now()}_${nomeSeguro}`);
            await ref.put(file);
            const nfUrl=await ref.getDownloadURL();
            const docAtual=await db.collection('lancamentosVTVR').doc(lancId).get();
            const dadosAtuais=docAtual.exists?docAtual.data():{};
            const histAnterior=dadosAtuais.nfHistorico||[];
            if(dadosAtuais.nfNome) histAnterior.push({nfNome:dadosAtuais.nfNome,nfUrl:dadosAtuais.nfUrl||'',enviadoEm:dadosAtuais.nfUploadEm||''});
            await db.collection('lancamentosVTVR').doc(lancId).update({
                nfNome:file.name, nfUrl, nfUploadEm:new Date().toLocaleString('pt-BR'),
                nfUploadPor:user.nome, statusNF:'emitida', nfHistorico:histAnterior
            });
        }catch(err){mostrarNotif('','Falha no upload','Não foi possível enviar a NF: '+err.message,'',6000);return;}
        mostrarNotif('','NF registrada!',`NF para ${periodo} (R$ ${valor.toFixed(2)}) enviada com sucesso.`,'bonus',5000);
        carregarVTVR();renderMeuPDI();
    };
    input.click();
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
        meus.forEach(m=>{const idx=lancamentosVTVR.findIndex(l=>l.id===m.id);if(idx>=0)lancamentosVTVR[idx]=m;else lancamentosVTVR.push(m);});
    }catch(e){}
}


function contarDias(mes, ano, diaSemana){
    // diaSemana: 0=Dom, 1=Seg, 4=Qui
    let count=0;
    const dias=new Date(ano,mes,0).getDate();
    for(let d=1;d<=dias;d++){
        if(new Date(ano,mes-1,d).getDay()===diaSemana)count++;
    }
    return count;
}

function diasObrigatorios(mes, ano, tipoContrato){
    const quintas=contarDias(mes,ano,4); // quinta=4
    const segundas=contarDias(mes,ano,1); // segunda=1
    if(tipoContrato==='CLT')return quintas+segundas;
    return quintas; // PJ só quintas
}

function getVRVigente(mes,ano){
    const configs=vrConfigs.filter(c=>c.mes===parseInt(mes)&&c.ano===parseInt(ano));
    return configs.length?configs[0].valor:null;
}

async function salvarVRGlobal(){
    await guardado('salvarVR', async () => {
        const mes=parseInt(document.getElementById('vrMes').value);
        const ano=parseInt(document.getElementById('vrAno').value);
        const valor=parseFloat(document.getElementById('vrValor').value);
        if(!valor||valor<=0){mostrarNotif('','Valor inválido','Informe o valor do VR.','',3000);return;}
        if(valor>1000){mostrarNotif('','Valor suspeito','O valor informado parece muito alto. Verifique.','',4000);return;}
        const agora=new Date();
        await db.collection('vrConfigs').add({mes,ano,valor,dataCriacao:agora,dataHoraRegistro:agora.toLocaleString('pt-BR'),criadoPorNome:user.nome,criadoPorEmail:user.email});
        mostrarNotif('','VR salvo',`VR de R$ ${valor.toFixed(2)} configurado para ${mes}/${ano}.`,'',4000);
        carregarVTVR();
    });
}

// _vtvrUltimoDoc, _vtvrTemMais, VTVR_LIMITE declarados em globals.js

async function carregarVTVR(modo='inicio'){
    if(!P.isRH())return;
    try{
        let lancQuery=db.collection('lancamentosVTVR').orderBy('dataCriacao','desc').limit(VTVR_LIMITE);
        if(modo==='mais'&&_vtvrUltimoDoc){
            lancQuery=lancQuery.startAfter(_vtvrUltimoDoc);
        }
        const[vrSnap,lancSnap]=await Promise.all([
            db.collection('vrConfigs').orderBy('dataCriacao','desc').get(),
            lancQuery.get()
        ]);
        vrConfigs=vrSnap.docs.map(d=>({id:d.id,...d.data()}));
        const novos=lancSnap.docs.map(d=>({id:d.id,...d.data()}));
        if(modo==='mais'){
            lancamentosVTVR=[...lancamentosVTVR,...novos];
        }else{
            lancamentosVTVR=novos;
        }
        _vtvrUltimoDoc=lancSnap.docs[lancSnap.docs.length-1]||null;
        _vtvrTemMais=lancSnap.docs.length===VTVR_LIMITE;
    }catch(e){
        console.error('[MIRAE] carregarVTVR',e);
        if(modo==='inicio'){vrConfigs=[];lancamentosVTVR=[];}
        mostrarNotif('','Erro ao carregar VT/VR',e?.message||'Tente recarregar a página.','',5000);
    }
    renderVRHistorico();
    renderPainelVTVR();
}

async function carregarMaisLancamentos(){
    if(!_vtvrTemMais)return;
    await carregarVTVR('mais');
}

function renderVRHistorico(){
    const tbody=document.getElementById('vrHistorico');if(!tbody)return;
    const isMaster=P.isMaster();
    const th=document.getElementById('vrThAcao');
    if(th)th.style.display=isMaster?'':'none';
    const cols=isMaster?5:4;
    if(!vrConfigs.length){tbody.innerHTML=`<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:1rem;">Nenhum VR configurado.</td></tr>`;return;}
    const meses=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    tbody.innerHTML=vrConfigs.map(c=>`<tr>
        <td><strong>${meses[c.mes]}/${c.ano}</strong></td>
        <td style="font-weight:700;color:var(--teal);">R$ ${c.valor.toFixed(2)}</td>
        <td style="font-size:0.82rem;">${esc(c.criadoPorNome||'-')}</td>
        <td style="font-size:0.82rem;">${c.dataHoraRegistro||'-'}</td>
        ${isMaster?`<td style="text-align:center;"><button onclick="excluirVRConfig('${c.id}')" title="Excluir" style="border:none;background:none;cursor:pointer;color:#C62828;padding:0.2rem;display:inline-flex;border-radius:6px;" onmouseover="this.style.background='#FFEBEE'" onmouseout="this.style.background='none'">${ico('trash',{size:15})}</button></td>`:''}
    </tr>`).join('');
}

async function excluirVRConfig(id){
    if(!P.isMaster())return;
    if(!confirm('Excluir este registro de VR? Esta ação não pode ser desfeita.'))return;
    await guardado('excluirVR_'+id, async () => {
        await db.collection('vrConfigs').doc(id).delete();
        vrConfigs=vrConfigs.filter(c=>c.id!==id);
        renderVRHistorico();
        mostrarNotif('','Registro excluído','O valor de VR foi removido do histórico.','',3000);
    });
}

function gerarLancamentos(){
    const mes=parseInt(document.getElementById('gerarMes').value);
    const ano=parseInt(document.getElementById('gerarAno').value);
    const tipo=document.getElementById('gerarTipo').value;
    const benef=document.getElementById('gerarBenef').value;
    const vrValor=getVRVigente(mes,ano);
    if(!vrValor&&(benef==='VR'||benef==='ambos')){
        mostrarNotif('','VR não configurado',`Configure o VR para ${mes}/${ano} antes de gerar.`,'',5000);
        return;
    }
    // Verifica se já existe lançamento para esse mês/ano
    const jaExiste=lancamentosVTVR.some(l=>l.mes===mes&&l.ano===ano);
    if(jaExiste){if(!confirm(`Já existem lançamentos para ${mes}/${ano}. Deseja gerar um novo lote?`))return;}

    const colaborsFiltrados=talentos.filter(t=>{
        if(tipo==='PJ')return t.tipoContrato==='PJ';
        if(tipo==='CLT')return t.tipoContrato==='CLT';
        return true;
    });

    // PJ: reembolso do mês ANTERIOR (quintas do mês passado)
    const mesPJ  = mes===1  ? 12 : mes-1;
    const anoPJ  = mes===1  ? ano-1 : ano;
    // CLT: VT/VR para o mês SEGUINTE (segundas+quintas do próximo mês)
    const mesCLT = mes===12 ? 1  : mes+1;
    const anoCLT = mes===12 ? ano+1 : ano;

    previewData=colaborsFiltrados.map(t=>{
        const isPJ=t.tipoContrato==='PJ';
        const mRef=isPJ?mesPJ:mesCLT;
        const aRef=isPJ?anoPJ:anoCLT;
        const dias=diasObrigatorios(mRef,aRef,t.tipoContrato||'CLT');
        const vt=benef==='VR'?0:(t.valorVT||0);
        const vr=benef==='VT'?0:(vrValor||0);
        return {
            colabId:t.id, nome:t.nome, equipe:t.equipe||'-',
            tipoContrato:t.tipoContrato||'CLT',
            dias, vtDia:vt, vrDia:vr,
            totalVT:dias*vt, totalVR:dias*vr,
            total:dias*(vt+vr),
            mes, ano,           // mês de referência do lançamento (o selecionado)
            mesCalculo:mRef, anoCalculo:aRef,  // mês usado no cálculo dos dias
            benef,
            statusNF: isPJ?'pendente':'N/A'
        };
    });

    renderPreview();
    document.getElementById('previewLancamentos').style.display='block';
    document.getElementById('previewLancamentos').scrollIntoView({behavior:'smooth'});
}

function renderPreview(){
    const tbody=document.getElementById('previewBody');if(!tbody)return;
    let totalVT=0,totalVR=0,totalGeral=0;
    tbody.innerHTML=previewData.map((p,i)=>{
        totalVT+=p.totalVT;totalVR+=p.totalVR;totalGeral+=p.total;
        const mesesAbrev=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const periodoLabel=p.mesCalculo?`${mesesAbrev[p.mesCalculo]}/${p.anoCalculo}`:'';
        const periodoTip=p.tipoContrato==='PJ'?`Quintas de ${periodoLabel}`:`Seg+Qui de ${periodoLabel}`;
        return `<tr>
            <td style="font-weight:600;">${esc(p.nome)}</td>
            <td><span class="role-badge ${p.tipoContrato==='PJ'?'role-LIDER':'role-COLABORADOR'}">${p.tipoContrato}</span></td>
            <td>${esc(p.equipe)}</td>
            <td title="${periodoTip}">
                <input type="number" value="${p.dias}" min="0" max="31" onchange="previewData[${i}].dias=parseInt(this.value);recalcPreview(${i})" style="width:50px;padding:0.3rem;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:'DM Sans',sans-serif;font-size:0.82rem;">
                <div style="font-size:0.68rem;color:var(--muted);margin-top:2px;">${periodoLabel}</div>
            </td>
            <td>R$ ${p.vtDia.toFixed(2)}</td>
            <td>R$ ${p.vrDia.toFixed(2)}</td>
            <td id="pvVT${i}" style="font-weight:600;color:var(--teal);">R$ ${p.totalVT.toFixed(2)}</td>
            <td id="pvVR${i}" style="font-weight:600;color:var(--gold);">R$ ${p.totalVR.toFixed(2)}</td>
            <td id="pvTot${i}" style="font-weight:800;">R$ ${p.total.toFixed(2)}</td>
        </tr>`;
    }).join('');
    const stats=document.getElementById('previewStats');
    if(stats)stats.innerHTML=`
        <div class="stat-card"><div class="stat-label">Colaboradores</div><div class="stat-value">${previewData.length}</div></div>
        <div class="stat-card"><div class="stat-label">Total VT</div><div class="stat-value" style="color:var(--teal);font-size:1.3rem;">R$ ${totalVT.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Total VR</div><div class="stat-value" style="color:var(--gold);font-size:1.3rem;">R$ ${totalVR.toFixed(2)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Geral</div><div class="stat-value" style="font-size:1.3rem;color:#2E7D32;">R$ ${totalGeral.toFixed(2)}</div></div>`;
}

function recalcPreview(i){
    const p=previewData[i];
    p.totalVT=p.dias*p.vtDia;p.totalVR=p.dias*p.vrDia;p.total=p.dias*(p.vtDia+p.vrDia);
    document.getElementById('pvVT'+i).textContent='R$ '+p.totalVT.toFixed(2);
    document.getElementById('pvVR'+i).textContent='R$ '+p.totalVR.toFixed(2);
    document.getElementById('pvTot'+i).textContent='R$ '+p.total.toFixed(2);
    renderPreview();
}

async function confirmarLancamentos(){
    if(!previewData.length){mostrarNotif('','Nada para confirmar','Gere os lançamentos primeiro.','',3000);return;}
    if(!confirm(`Confirmar lançamento de ${previewData.length} colaboradores? Esta ação não pode ser desfeita.`))return;
    await guardado('confirmarLancamentos', async () => {
        // Batch: Firestore suporta até 500 operações por batch
        const BATCH_MAX=490;
        const grupos=[];
        for(let i=0;i<previewData.length;i+=BATCH_MAX) grupos.push(previewData.slice(i,i+BATCH_MAX));
        const agora=new Date();
        for(const grupo of grupos){
            const batch=db.batch();
            grupo.forEach(p=>{
                const ref=db.collection('lancamentosVTVR').doc();
                batch.set(ref,{...p,dataCriacao:agora,dataHoraRegistro:agora.toLocaleString('pt-BR'),criadoPorNome:user.nome,criadoPorEmail:user.email});
            });
            await batch.commit();
        }
        // Notificar PJs
        previewData.filter(p=>p.tipoContrato==='PJ').forEach(p=>{
            const t=talentos.find(ta=>ta.id===p.colabId);
            if(t)db.collection('notificacoesPJ').add({colabId:p.colabId,nome:t.nome,email:t.email,mes:p.mes,ano:p.ano,valor:p.total,tipo:'vtvr',dataEnvio:agora,lida:false,mensagem:`Seu reembolso de VT/VR referente a ${p.mes}/${p.ano} foi processado. Valor: R$ ${p.total.toFixed(2)}. Por favor, emita a NF com este valor.`});
        });
        document.getElementById('previewLancamentos').style.display='none';
        previewData=[];
        mostrarNotif('','Lançamentos confirmados!','PJs foram notificados para emitir NF.','bonus',5000);
        carregarVTVR();
    });
}

function renderPainelVTVR(){
    const mes=document.getElementById('painelVTMes')?.value||'';
    const ano=parseInt(document.getElementById('painelVTAno')?.value||new Date().getFullYear());
    const tipo=document.getElementById('painelVTTipo')?.value||'todos';
    let filtered=lancamentosVTVR.filter(l=>{
        if(mes&&l.mes!==parseInt(mes))return false;
        if(l.ano!==ano)return false;
        if(tipo!=='todos'&&l.tipoContrato!==tipo)return false;
        return true;
    });
    const pjs=filtered.filter(l=>l.tipoContrato==='PJ');
    const clts=filtered.filter(l=>l.tipoContrato==='CLT');
    // Stats
    const stats=document.getElementById('painelVTStats');
    if(stats){
        const tVT=filtered.reduce((s,l)=>s+l.totalVT,0);
        const tVR=filtered.reduce((s,l)=>s+l.totalVR,0);
        const tGeral=filtered.reduce((s,l)=>s+l.total,0);
        stats.innerHTML=`
            <div class="stat-card"><div class="stat-label">Total VT</div><div class="stat-value" style="color:var(--teal);font-size:1.3rem;">R$ ${tVT.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">Total VR</div><div class="stat-value" style="color:var(--gold);font-size:1.3rem;">R$ ${tVR.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">Total Geral</div><div class="stat-value" style="font-size:1.3rem;color:#2E7D32;">R$ ${tGeral.toFixed(2)}</div></div>
            <div class="stat-card"><div class="stat-label">Colaboradores</div><div class="stat-value">${filtered.length}</div></div>`;
    }
    const meses=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    // PJ
    const tPJ=document.getElementById('tabelaPJ');
    if(tPJ){
        if(!pjs.length){tPJ.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:1.5rem;">Nenhum lançamento PJ.</td></tr>';}
        else tPJ.innerHTML=pjs.map(l=>`<tr>
            <td style="font-weight:600;">${esc(l.nome)}</td>
            <td><span class="badge" style="background:#EEE;">${esc(l.equipe)}</span></td>
            <td>${meses[l.mes]}/${l.ano}</td>
            <td>${l.dias} dias</td>
            <td style="color:var(--teal);">R$ ${l.totalVT.toFixed(2)}</td>
            <td style="color:var(--gold);">R$ ${l.totalVR.toFixed(2)}</td>
            <td style="font-weight:800;">R$ ${l.total.toFixed(2)}</td>
            <td>
                <span class="${(l.statusNF==='emitida'||l.nfNome)?'badge-success':'badge-warning'} badge">
                    ${(l.statusNF==='emitida'||l.nfNome)?'Emitida':'Pendente'}
                </span>
                ${l.nfNome?`<div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">${esc(l.nfNome)}</div>`:''}
                ${l.nfHistorico&&l.nfHistorico.length>1?`<div style="font-size:0.68rem;color:var(--muted);">${l.nfHistorico.length} envios</div>`:''}
            </td>
            <td>${P.isMaster()?`<button class="btn-small" style="background:#FFEBEE;color:#C62828;border:none;cursor:pointer;padding:0.3rem 0.7rem;border-radius:4px;" onclick="excluirLancVTVR('${l.id}','${jsq(l.nome)}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>`:''}</td>
        </tr>`).join('');
    }
    // CLT
    const tCLT=document.getElementById('tabelaCLT');
    if(tCLT){
        if(!clts.length){tCLT.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1.5rem;">Nenhum lançamento CLT.</td></tr>';}
        else tCLT.innerHTML=clts.map(l=>`<tr>
            <td style="font-weight:600;">${esc(l.nome)}</td>
            <td><span class="badge" style="background:#EEE;">${esc(l.equipe)}</span></td>
            <td>${meses[l.mes]}/${l.ano}</td>
            <td>${l.dias} dias</td>
            <td style="color:var(--teal);">R$ ${l.totalVT.toFixed(2)}</td>
            <td style="color:var(--gold);">R$ ${l.totalVR.toFixed(2)}</td>
            <td style="font-weight:800;">R$ ${l.total.toFixed(2)}</td>
            <td>${P.isMaster()?`<button class="btn-small" style="background:#FFEBEE;color:#C62828;border:none;cursor:pointer;padding:0.3rem 0.7rem;border-radius:4px;" onclick="excluirLancVTVR('${l.id}','${jsq(l.nome)}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>`:''}</td>
        </tr>`).join('');
    }
    // Mostrar/ocultar seções
    const secPJ=document.getElementById('secaoPJ');
    const secCLT=document.getElementById('secaoCLT');
    if(secPJ)secPJ.style.display=tipo==='CLT'?'none':'block';
    if(secCLT)secCLT.style.display=tipo==='PJ'?'none':'block';
    // Botão carregar mais (paginação)
    let btnMais=document.getElementById('vtvrBtnMais');
    if(!btnMais){
        btnMais=document.createElement('div');
        btnMais.id='vtvrBtnMais';
        btnMais.style.cssText='text-align:center;padding:1.2rem 0;';
        const container=document.getElementById('secaoCLT')?.parentElement||document.querySelector('#tabVTVR');
        if(container)container.appendChild(btnMais);
    }
    if(_vtvrTemMais){
        btnMais.innerHTML=`<button onclick="carregarMaisLancamentos()" style="padding:0.6rem 1.5rem;background:var(--cream);border:1.5px solid var(--border);border-radius:20px;cursor:pointer;font-size:0.84rem;color:var(--dark);font-family:'DM Sans',sans-serif;">Carregar mais lançamentos (${VTVR_LIMITE} por vez)</button>`;
    }else{
        btnMais.innerHTML=lancamentosVTVR.length>0?`<span style="font-size:0.78rem;color:var(--muted);">Todos os ${lancamentosVTVR.length} lançamentos carregados.</span>`:'';
    }
}

function _vtvr_filtrar(){
    const mes=document.getElementById('painelVTMes')?.value||'';
    const ano=parseInt(document.getElementById('painelVTAno')?.value||new Date().getFullYear());
    const tipo=document.getElementById('painelVTTipo')?.value||'todos';
    return lancamentosVTVR.filter(l=>{
        if(mes&&l.mes!==parseInt(mes))return false;
        if(l.ano!==ano)return false;
        if(tipo!=='todos'&&l.tipoContrato!==tipo)return false;
        return true;
    });
}

function exportarExcelVTVR(){
    if(!window.XLSX){mostrarNotif('','Biblioteca não carregada','Recarregue a página.','',3000);return;}
    const mesesNome=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const filtered=_vtvr_filtrar();
    if(!filtered.length){mostrarNotif('','Nenhum dado','Não há lançamentos para exportar.','',3000);return;}
    const mes=document.getElementById('painelVTMes')?.value||'';
    const ano=document.getElementById('painelVTAno')?.value||new Date().getFullYear();
    const tipo=document.getElementById('painelVTTipo')?.value||'todos';
    // Separar PJ e CLT em abas distintas
    const wb=XLSX.utils.book_new();
    const toRow=l=>({
        'Colaborador':l.nome,'Tipo':l.tipoContrato,'Equipe':l.equipe,
        'Mês':mesesNome[l.mes],'Ano':l.ano,'Dias Úteis':l.dias,
        'VT/dia':l.vtDia,'VR/dia':l.vrDia,
        'Total VT':l.totalVT,'Total VR':l.totalVR,'Total Geral':l.total,
        'Status NF':l.tipoContrato==='PJ'?(l.nfNome?'Emitida':'Pendente'):'-',
        'Arquivo NF':l.nfNome||''
    });
    const pjs=filtered.filter(l=>l.tipoContrato==='PJ');
    const clts=filtered.filter(l=>l.tipoContrato==='CLT');
    if(pjs.length){
        const ws=XLSX.utils.json_to_sheet(pjs.map(toRow));
        // largura das colunas
        ws['!cols']=[{wch:22},{wch:6},{wch:16},{wch:10},{wch:6},{wch:10},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10},{wch:28}];
        XLSX.utils.book_append_sheet(wb,ws,'PJ');
    }
    if(clts.length){
        const ws=XLSX.utils.json_to_sheet(clts.map(toRow));
        ws['!cols']=[{wch:22},{wch:6},{wch:16},{wch:10},{wch:6},{wch:10},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12}];
        XLSX.utils.book_append_sheet(wb,ws,'CLT');
    }
    // Aba resumo
    const totVT=filtered.reduce((s,l)=>s+l.totalVT,0);
    const totVR=filtered.reduce((s,l)=>s+l.totalVR,0);
    const resumo=[
        {'Descrição':'Período','Valor':`${mes?mesesNome[parseInt(mes)]:'Todos os meses'}/${ano}`},
        {'Descrição':'Filtro Tipo','Valor':tipo},
        {'Descrição':'Colaboradores','Valor':filtered.length},
        {'Descrição':'Total VT','Valor':totVT},
        {'Descrição':'Total VR','Valor':totVR},
        {'Descrição':'Total Geral','Valor':totVT+totVR},
        {'Descrição':'PJs com NF Emitida','Valor':pjs.filter(l=>l.nfNome).length+' / '+pjs.length},
        {'Descrição':'Gerado em','Valor':new Date().toLocaleString('pt-BR')},
    ];
    const wsR=XLSX.utils.json_to_sheet(resumo);wsR['!cols']=[{wch:22},{wch:28}];
    XLSX.utils.book_append_sheet(wb,wsR,'Resumo');
    XLSX.writeFile(wb,`Mirae_VTVR_${tipo}_${mes||'todos'}${ano}.xlsx`);
    mostrarNotif('','Excel exportado!','Planilha .xlsx gerada com sucesso.','bonus',3000);
}

function exportarPDFVTVR(){
    if(!window.jspdf){mostrarNotif('','Biblioteca não carregada','Recarregue a página.','',3000);return;}
    const mesesNome=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const filtered=_vtvr_filtrar();
    if(!filtered.length){mostrarNotif('','Nenhum dado','Não há lançamentos para exportar.','',3000);return;}
    const mes=document.getElementById('painelVTMes')?.value||'';
    const ano=document.getElementById('painelVTAno')?.value||new Date().getFullYear();
    const tipo=document.getElementById('painelVTTipo')?.value||'todos';
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape'});
    const teal=[30,125,144],dark=[33,73,87],gold=[201,160,90],muted=[100,116,139];
    // cabeçalho
    doc.setFillColor(...dark);doc.rect(0,0,297,22,'F');
    doc.setTextColor(255,255,255);doc.setFontSize(16);doc.setFont('helvetica','bold');doc.text('Mirae',10,14);
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Relatório de Benefícios VT / VR',10,20);
    doc.setFillColor(...gold);doc.circle(285,8,4,'F');
    // subtítulo
    const labelMes=mes?mesesNome[parseInt(mes)]:'Todos os meses';
    doc.setTextColor(...dark);doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.text(`${labelMes} / ${ano} — ${tipo==='todos'?'PJ + CLT':tipo}`,10,32);
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(...muted);
    doc.text(`Gerado por ${user?.nome||''} em ${new Date().toLocaleString('pt-BR')}`,10,38);
    doc.setDrawColor(...teal);doc.setLineWidth(0.4);doc.line(10,41,287,41);
    // totais
    const tVT=filtered.reduce((s,l)=>s+l.totalVT,0);
    const tVR=filtered.reduce((s,l)=>s+l.totalVR,0);
    const tGeral=tVT+tVR;
    const cards=[['Total VT',`R$ ${tVT.toFixed(2)}`,teal],['Total VR',`R$ ${tVR.toFixed(2)}`,gold],['Total Geral',`R$ ${tGeral.toFixed(2)}`,[46,125,50]],['Colaboradores',filtered.length+'',dark]];
    cards.forEach(([label,val,cor],i)=>{
        const x=10+i*70;
        doc.setFillColor(...cor.map(c=>Math.min(255,c+170)));doc.roundedRect(x,44,65,14,2,2,'F');
        doc.setTextColor(...cor);doc.setFontSize(7);doc.setFont('helvetica','bold');doc.text(label,x+3,51);
        doc.setFontSize(10);doc.text(val,x+3,59);
    });
    let y=68;
    // tabelas PJ e CLT
    const grupos=[['PJ',filtered.filter(l=>l.tipoContrato==='PJ'),teal],['CLT',filtered.filter(l=>l.tipoContrato==='CLT'),gold]];
    grupos.forEach(([grupo,rows,cor])=>{
        if(!rows.length)return;
        if(y>170){doc.addPage();y=15;}
        doc.setFillColor(...cor);doc.roundedRect(10,y-4,277,7,1.5,1.5,'F');
        doc.setTextColor(255,255,255);doc.setFontSize(8);doc.setFont('helvetica','bold');
        doc.text(grupo,13,y);y+=8;
        // header da tabela
        const cols=['Colaborador','Equipe','Mês/Ano','Dias','VT/dia','VR/dia','Total VT','Total VR','Total Geral'].concat(grupo==='PJ'?['NF']:[]);
        const ws=[75,35,22,12,16,16,20,20,22].concat(grupo==='PJ'?[22]:[]);
        let x=10;
        doc.setFillColor(240,242,245);doc.rect(10,y-3,277,7,'F');
        doc.setTextColor(...dark);doc.setFontSize(7.5);doc.setFont('helvetica','bold');
        cols.forEach((c,i)=>{doc.text(c,x+1,y+1);x+=ws[i];});y+=8;
        rows.forEach((l,ri)=>{
            if(y>195){doc.addPage();y=15;}
            if(ri%2===0){doc.setFillColor(249,250,251);doc.rect(10,y-3.5,277,6.5,'F');}
            doc.setFont('helvetica','normal');doc.setTextColor(...dark);doc.setFontSize(7.5);
            const vals=[l.nome,l.equipe||'-',`${mesesNome[l.mes].slice(0,3)}/${l.ano}`,String(l.dias),
                `R$${l.vtDia.toFixed(2)}`,`R$${l.vrDia.toFixed(2)}`,`R$${l.totalVT.toFixed(2)}`,
                `R$${l.totalVR.toFixed(2)}`,`R$${l.total.toFixed(2)}`].concat(grupo==='PJ'?[l.nfNome?'Emitida':'Pendente']:[]);
            x=10;
            vals.forEach((v,i)=>{
                if(i===9&&grupo==='PJ'){if(l.nfNome)doc.setTextColor(46,125,50);else doc.setTextColor(198,40,40);}
                const txt=doc.splitTextToSize(v,ws[i]-2);doc.text(txt[0],x+1,y);
                doc.setTextColor(...dark);x+=ws[i];
            });
            y+=7;
        });
        y+=5;
    });
    // rodapé
    const np=doc.internal.getNumberOfPages();
    for(let i=1;i<=np;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(...muted);doc.text(`Mirae · Benefícios VT/VR · Pág. ${i}/${np}`,10,208);}
    doc.save(`Mirae_VTVR_${tipo}_${mes||'todos'}${ano}.pdf`);
    mostrarNotif('','PDF exportado!','Relatório gerado com sucesso.','bonus',3000);
}

function exportarOmieVTVR(){
    if(!window.XLSX){mostrarNotif('','Biblioteca não carregada','Recarregue a página.','',3000);return;}
    // Apenas PJs com o filtro atual
    const filtered=_vtvr_filtrar().filter(l=>l.tipoContrato==='PJ');
    if(!filtered.length){mostrarNotif('','Nenhum PJ','Não há lançamentos PJ no período selecionado.','',3500);return;}
    const mes=document.getElementById('painelVTMes')?.value||'';
    const ano=parseInt(document.getElementById('painelVTAno')?.value||new Date().getFullYear());
    const mesesNome=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    // Data de vencimento = 5º dia útil do mês seguinte ao período
    const mesRef=mes?parseInt(mes):new Date().getMonth()+1;
    const proxMes=mesRef===12?1:mesRef+1;
    const proxAno=mesRef===12?ano+1:ano;
    let countUtil=0,dUtil=new Date(proxAno,proxMes-1,1);
    while(countUtil<5){const dow=dUtil.getDay();if(dow!==0&&dow!==6)countUtil++;if(countUtil<5)dUtil.setDate(dUtil.getDate()+1);}
    const dtVenc=dUtil.toLocaleDateString('pt-BR');
    const dtRegistro=new Date().toLocaleDateString('pt-BR');
    const dtEmissao=mes?`01/${String(parseInt(mes)).padStart(2,'0')}/${ano}`:dtRegistro;

    // Colunas exatas do template OMIE v1.1.5 (linha 4 do template)
    const HEADER=[
        'Código de Integração',
        '(Razão Social, Nome Fantasia, CNPJ ou CPF)',
        'Categoria *',
        'Conta Corrente *',
        'Valor da Conta *',
        'Vendedor',
        'Projeto',
        'Data de Emissão',
        'Data de Registro *',
        'Data de Vencimento *',
        'Data de Previsão',
        'Data do Pagamento',
        'Valor do Pagamento',
        'Juros','Multa','Desconto',
        'Data de Conciliação',
        'Observações',
        'Tipo de Documento',
        'Número do Documento',
        'Parcela','Total de Parcelas','Número do Pedido','Nota Fiscal','Chave da NF-e',
        'Forma de Pagamento',
        'Código de Barras do Boleto','% de Juros ao Mês do Boleto','% de Multa por Atraso do Boleto',
        'Banco da Transferência','Agência da Transferência','Conta Corrente da Transferência',
        'CNPJ ou CPF do Titular','Nome do Titular da Conta','Finalidade da Transferência','Chave Pix',
        'Valor PIS','Reter PIS','Valor COFINS','Reter COFINS',
        'Valor CSLL','Reter CSLL','Valor IR','Reter IR','Valor ISS','Reter ISS','Valor INSS','Reter INSS',
        'Departamento (100%)',
        'Número da NF (serviço tomado)','Série','Código do Serviço (LC116)','Valor total da NF',
        'CST do PIS','Base de Cálculo - PIS','Alíquota do PIS (%)','Valor do PIS',
        'CST do COFINS','Base de cálculo - COFINS','Alíquota  do COFINS (%)','Valor do COFINS'
    ];

    // 3 linhas de instruções antes do header (como no template original)
    const instrucoes=[
        ['OMIE — Importação de Contas a Pagar — Gerado por Mirae PDI em '+new Date().toLocaleString('pt-BR')],
        ['Preencha os campos obrigatórios (*) antes de importar: Categoria e Conta Corrente devem corresponder aos cadastrados no OMIE.'],
        ['Não altere a linha de cabeçalho abaixo. Os dados começam na linha 5.']
    ];

    const dataRows=filtered.map(l=>{
        // Buscar CNPJ e razão social do talento
        const talento=talentos.find(t=>t.id===l.colabId)||{};
        const fornecedor=talento.cnpj||(talento.razaoSocial||l.nome);
        const mesLabel=mes?`${mesesNome[parseInt(mes)]}/${ano}`:`${ano}`;
        const obs=`VT/VR ${mesLabel} — ${l.nome}`;
        const row=new Array(HEADER.length).fill('');
        row[0]=l.id;                          // Código de Integração
        row[1]=fornecedor;                     // Fornecedor
        row[2]='';                             // Categoria * — preencher no OMIE
        row[3]='';                             // Conta Corrente * — preencher no OMIE
        row[4]=l.total;                        // Valor da Conta *
        row[7]=dtEmissao;                      // Data de Emissão
        row[8]=dtRegistro;                     // Data de Registro *
        row[9]=dtVenc;                         // Data de Vencimento *
        row[17]=obs;                           // Observações
        row[18]=l.nfNome?'NF-e':'Recibo';     // Tipo de Documento
        row[19]=l.nfNome||'';                  // Número do Documento
        row[49]=l.nfNome||'';                  // Número da NF (serviço tomado)
        row[52]=l.nfNome?l.total:'';           // Valor total da NF
        return row;
    });

    const wb=XLSX.utils.book_new();
    const wsData=[...instrucoes, HEADER, ...dataRows];
    const ws=XLSX.utils.aoa_to_sheet(wsData);
    // Larguras mínimas para as principais colunas
    ws['!cols']=[{wch:20},{wch:30},{wch:25},{wch:20},{wch:14},{wch:10},{wch:10},
                 {wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:8},{wch:8},{wch:8},
                 {wch:14},{wch:40},{wch:14},{wch:20}];
    XLSX.utils.book_append_sheet(wb,ws,'Contas a Pagar');
    const nomeMes=mes?mesesNome[parseInt(mes)]:'todos';
    XLSX.writeFile(wb,`OMIE_ContasPagar_${nomeMes}${ano}.xlsx`);
    mostrarNotif('','Planilha OMIE gerada!',
        `${filtered.length} registro(s) exportado(s). Preencha Categoria e Conta Corrente antes de importar no OMIE.`,
        'bonus',6000);
}

async function baixarNFsEmLote(){
    if(!window.JSZip){mostrarNotif('','Biblioteca não carregada','Recarregue a página.','',3000);return;}
    const filtered=_vtvr_filtrar().filter(l=>l.tipoContrato==='PJ'&&l.nfUrl&&l.nfNome);
    if(!filtered.length){mostrarNotif('','Nenhuma NF encontrada','Não há NFs emitidas no período selecionado.','',4000);return;}
    const btn=document.getElementById('btnBaixarNFs');
    if(btn)btn.textContent='Preparando ZIP...';
    try{
        const zip=new JSZip();
        const mesesNome=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        await Promise.all(filtered.map(async l=>{
            try{
                const resp=await fetch(l.nfUrl);
                if(!resp.ok)throw new Error('Falha ao baixar');
                const blob=await resp.blob();
                const ext=l.nfNome.split('.').pop()||'pdf';
                const nomeSafe=`${mesesNome[l.mes]}${l.ano}_${l.nome.replace(/[^a-zA-ZÀ-ú0-9 ]/g,'_').trim()}.${ext}`;
                zip.file(nomeSafe,blob);
            }catch(e){console.warn('NF não baixada:',l.nome,e);}
        }));
        const content=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
        const mes=document.getElementById('painelVTMes')?.value||'';
        const ano=document.getElementById('painelVTAno')?.value||new Date().getFullYear();
        const url=URL.createObjectURL(content);
        const a=document.createElement('a');a.href=url;
        a.download=`NFs_PJ_${mes||'todos'}${ano}.zip`;a.click();
        URL.revokeObjectURL(url);
        mostrarNotif('','NFs baixadas!',`${filtered.length} arquivo(s) compactado(s) com sucesso.`,'bonus',5000);
    }catch(e){mostrarNotif('','Erro ao compactar','Não foi possível gerar o ZIP: '+e.message,'',5000);}
    if(btn)btn.textContent='Baixar NFs (.zip)';
}


// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    renderMeuVTVRTab, uploadNFTab, uploadNF,
    excluirLancVTVR, verificarNotifPJ, carregarVTVRColab,
    contarDias, diasObrigatorios, getVRVigente, salvarVRGlobal,
    carregarVTVR, carregarMaisLancamentos, renderVRHistorico, excluirVRConfig,
    gerarLancamentos, renderPreview, recalcPreview, confirmarLancamentos,
    renderPainelVTVR, _vtvr_filtrar,
    exportarExcelVTVR, exportarPDFVTVR, exportarOmieVTVR, baixarNFsEmLote,
    toggleCamposPJ,
});
