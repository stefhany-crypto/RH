function setTipoBonus(tipo){
    document.getElementById('bcTipo').value = tipo;
    const btnMulti = document.getElementById('btnTipoMulti');
    const btnFixo = document.getElementById('btnTipoFixo');
    const label = document.getElementById('bcValorLabel');
    const input = document.getElementById('bcMulti');
    if(tipo==='multiplicador'){
        btnMulti.style.background='var(--teal)';btnMulti.style.color='white';btnMulti.style.borderColor='var(--teal)';
        btnFixo.style.background='white';btnFixo.style.color='var(--muted)';btnFixo.style.borderColor='var(--border)';
        label.textContent='Multiplicador';
        input.step='0.1';input.value='1.0';input.placeholder='Ex: 1.5';
    } else {
        btnFixo.style.background='var(--teal)';btnFixo.style.color='white';btnFixo.style.borderColor='var(--teal)';
        btnMulti.style.background='white';btnMulti.style.color='var(--muted)';btnMulti.style.borderColor='var(--border)';
        label.textContent='Valor Fixo (R$)';
        input.step='50';input.value='500';input.placeholder='Ex: 1500';
    }
}

async function carregarBonusConfigs(){
    if(!P.verBonus())return;
    try{const snap=await db.collection('bonusConfigs').orderBy('dataCriacao','desc').get();bonusConfigs=snap.docs.map(d=>({id:d.id,...d.data()}));}catch(e){bonusConfigs=[];}
    const bcEq=document.getElementById('bcEquipe');if(bcEq)bcEq.innerHTML=equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    const selPainel=document.getElementById('painelEquipe');if(selPainel)selPainel.innerHTML='<option value="">Todas</option>'+equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    renderBonusConfigHistorico();renderPainelPremiacoes();
}
async function salvarConfigBonus(){
    if(!P.editarBonus()){mostrarNotif('','Sem permissão','Apenas o Master pode configurar bônus.','',3000);return;}
    const equipe=document.getElementById('bcEquipe').value,tri=document.getElementById('bcTri').value,ano=parseInt(document.getElementById('bcAno').value),multi=parseFloat(document.getElementById('bcMulti').value),tipo=document.getElementById('bcTipo').value||'multiplicador';
    if(!equipe||isNaN(ano)||ano<2020||isNaN(multi)||multi<=0){mostrarNotif('','Campos inválidos','Preencha todos os campos corretamente.','',3000);return;}
    await guardado('salvarConfigBonus', async () => {
        const agora=new Date();
        const payload={equipe,trimestre:tri,ano,tipo,dataCriacao:agora,dataHoraRegistro:agora.toLocaleString('pt-BR'),criadoPorNome:user.nome,criadoPorEmail:user.email};
        if(tipo==='fixo'){payload.valorFixo=multi;payload.multiplicador=null;}else{payload.multiplicador=multi;payload.valorFixo=null;}
        await db.collection('bonusConfigs').add(payload);
        const displayValor=tipo==='fixo'?'R$ '+multi.toLocaleString('pt-BR',{minimumFractionDigits:2}):multi+'x';
        mostrarNotif('','Configuração salva',`${equipe} | Q${tri}/${ano} | ${displayValor}`,'',4000);
        carregarBonusConfigs();
    });
}
function getMultiplicadorVigente(equipe,trimestre,ano){
    const c=bonusConfigs.filter(c=>c.equipe===equipe&&String(c.trimestre)===String(trimestre)&&c.ano===ano);
    return c.length?c[0]:null;
}
function calcularValorBonus(config, salario, bonusPercent){
    if(!config) return salario*(bonusPercent/100)*1.0; // padrão: multiplicador 1x
    if(config.tipo==='fixo'&&config.valorFixo) return config.valorFixo*(bonusPercent/100);
    return salario*(bonusPercent/100)*(config.multiplicador||1.0);
}
function renderBonusConfigHistorico(){
    const tbody=document.getElementById('bonusConfigHistorico');if(!tbody)return;
    if(!bonusConfigs.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma configuração salva.</td></tr>';return;}
    tbody.innerHTML=bonusConfigs.map(c=>{let dt=c.dataHoraRegistro||'-';if(dt==='-'){try{const d=c.dataCriacao.toDate?c.dataCriacao.toDate():new Date(c.dataCriacao);dt=d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch(e){}}return `<tr><td><strong>${c.equipe}</strong></td><td>Q${c.trimestre}/${c.ano}</td><td><span style="font-weight:700;color:var(--mirae-teal);">${c.tipo==='fixo'?'R$ '+(c.valorFixo||0).toLocaleString('pt-BR',{minimumFractionDigits:2}):(c.multiplicador||1)+'x'}</span></td><td style="font-size:0.82rem;">${dt}</td><td style="font-size:0.82rem;color:var(--text-muted);">${c.criadoPorNome||'-'}</td></tr>`;}).join('');
}
function renderPainelPremiacoes(){
    if(!P.verBonus())return;
    const tbody=document.getElementById('painelBody'),statsDiv=document.getElementById('painelStats');if(!tbody)return;
    const filtroTri=document.getElementById('painelTri')?.value||'',filtroAno=parseInt(document.getElementById('painelAno')?.value||new Date().getFullYear()),filtroEquipe=document.getElementById('painelEquipe')?.value||'';
    let avals=avaliacoes.filter(a=>{if(filtroTri&&String(a.trimestre)!==filtroTri)return false;if(a.ano!==filtroAno)return false;const t=talentos.find(ta=>ta.id===a.colaboradorId);if(filtroEquipe&&(!t||t.equipe!==filtroEquipe))return false;return true;});
    if(!avals.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma avaliação neste filtro.</td></tr>';if(statsDiv)statsDiv.innerHTML='';return;}
    let totalPagar=0,totalColabs=0;
    tbody.innerHTML=avals.sort((a,b)=>{const ta=talentos.find(t=>t.id===a.colaboradorId),tb=talentos.find(t=>t.id===b.colaboradorId);return(ta?.equipe||'').localeCompare(tb?.equipe||'');}).map(a=>{
        const t=talentos.find(ta=>ta.id===a.colaboradorId)||{nome:'Excluído',equipe:'-',salario:0};
        const config=getMultiplicadorVigente(t.equipe,a.trimestre,a.ano);
        const multi=config?(config.tipo==='fixo'?'R$ '+(config.valorFixo||0).toLocaleString('pt-BR'):( config.multiplicador||1)+'x'):'1x (padrão)';
        const valor=calcularValorBonus(config,t.salario||0,a.bonusPercent);
        totalPagar+=valor;if(a.bonusPercent>0)totalColabs++;
        const temConfig=bonusConfigs.some(c=>c.equipe===t.equipe&&String(c.trimestre)===String(a.trimestre)&&c.ano===a.ano);
        return `<tr><td style="font-weight:700;">${t.nome}</td><td><span class="badge" style="background:#EEE;">${t.equipe}</span></td><td>Q${a.trimestre}/${a.ano}</td><td><span class="badge ${a.notaFinal>=80?'badge-success':'badge-warning'}">${a.notaFinal.toFixed(1)}</span></td><td style="font-weight:700;">${a.bonusPercent}%</td><td>R$ ${(t.salario||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td><span style="font-weight:700;color:var(--mirae-teal);">${multi}x</span> <small style="color:var(--text-muted);">${temConfig?'':''}</small></td><td style="font-weight:800;color:${valor>0?'#2E7D32':'var(--text-muted)'};">R$ ${valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`;
    }).join('');
    if(statsDiv)statsDiv.innerHTML=`<div class="stat-card"><div class="stat-label">Total a Pagar</div><div class="stat-value" style="font-size:1.2rem;color:#2E7D32;">R$ ${totalPagar.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div><div class="stat-card"><div class="stat-label">Avaliações</div><div class="stat-value">${avals.length}</div></div><div class="stat-card"><div class="stat-label">Com Bônus</div><div class="stat-value">${totalColabs}</div></div><div class="stat-card"><div class="stat-label">Média Notas</div><div class="stat-value">${(avals.reduce((s,a)=>s+a.notaFinal,0)/avals.length).toFixed(1)}</div></div>`;
}

function setTipoPremio(tipo){
    document.getElementById('paTipo').value=tipo;
    const btnS=document.getElementById('btnPaTipoSalario');
    const btnF=document.getElementById('btnPaTipoFixo');
    const label=document.getElementById('paValorLabel');
    const input=document.getElementById('paSalarios');
    if(tipo==='salarios'){
        btnS.style.background='var(--teal)';btnS.style.color='white';btnS.style.borderColor='var(--teal)';
        btnF.style.background='white';btnF.style.color='var(--muted)';btnF.style.borderColor='var(--border)';
        label.textContent='Nº de Salários';input.step='0.5';input.value='1';input.placeholder='Ex: 2';
    }else{
        btnF.style.background='var(--teal)';btnF.style.color='white';btnF.style.borderColor='var(--teal)';
        btnS.style.background='white';btnS.style.color='var(--muted)';btnS.style.borderColor='var(--border)';
        label.textContent='Valor Fixo (R$)';input.step='100';input.value='1000';input.placeholder='Ex: 3000';
    }
}

async function carregarPremioConfigs(){
    try{
        const[pSnap,mSnap]=await Promise.all([
            db.collection('premioConfigs').orderBy('dataCriacao','desc').get(),
            db.collection('metasLucratividade').orderBy('dataCriacao','desc').get()
        ]);
        premioConfigs=pSnap.docs.map(d=>({id:d.id,...d.data()}));
        metasLucratividade=mSnap.docs.map(d=>({id:d.id,...d.data()}));
    }catch(e){premioConfigs=[];metasLucratividade=[];}
    // Popular selects
    const paEq=document.getElementById('paEquipe');
    if(paEq)paEq.innerHTML=equipes.map(e=>'<option value="'+e.nome+'">'+e.nome+'</option>').join('');
    const ppEq=document.getElementById('painelPremioEquipe');
    if(ppEq)ppEq.innerHTML='<option value="">Todas as Equipes</option>'+equipes.map(e=>'<option value="'+e.nome+'">'+e.nome+'</option>').join('');
    // Mostrar/esconder form de configuração
    const pfw=document.getElementById('premioFormWrapper');
    if(pfw)pfw.style.display=P.editarBonus()?'block':'none';
    renderPremioConfigHistorico();
    renderPainelPremio();
}

async function salvarConfigPremio(){
    if(!P.editarBonus()){mostrarNotif('','Sem permissão','Apenas o Master pode configurar o prêmio anual.','',3000);return;}
    const equipe=document.getElementById('paEquipe').value;
    const ano=parseInt(document.getElementById('paAno').value);
    const valor=parseFloat(document.getElementById('paSalarios').value);
    const tipo=document.getElementById('paTipo')?.value||'salarios';
    if(!equipe||isNaN(ano)||isNaN(valor)||valor<=0){mostrarNotif('','Campos inválidos','Preencha todos os campos corretamente.','',3000);return;}
    if(ano<2020||ano>2030){mostrarNotif('','Ano inválido','Informe um ano entre 2020 e 2030.','',3000);return;}
    await guardado('salvarConfigPremio', async () => {
        const agora=new Date();
        const doc={equipe,ano,tipo,dataCriacao:agora,dataHoraRegistro:agora.toLocaleString('pt-BR'),criadoPorNome:user.nome,criadoPorEmail:user.email};
        if(tipo==='salarios'){doc.numSalarios=valor;doc.valorFixo=null;}
        else{doc.valorFixo=valor;doc.numSalarios=null;}
        await db.collection('premioConfigs').add(doc);
        const label=tipo==='salarios'?valor+' salário(s)':'R$ '+valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        mostrarNotif('','Prêmio configurado',equipe+' | '+ano+' | '+label,'',4000);
        carregarPremioConfigs();
    });
}

async function salvarMetaLucratividade(){
    if(!P.editarBonus()){mostrarNotif('','Sem permissão','Apenas o Master pode lançar a meta.','',3000);return;}
    const ano=parseInt(document.getElementById('metaAno').value);
    const pct=parseFloat(document.getElementById('metaPct').value);
    if(isNaN(ano)||isNaN(pct)||pct<0||pct>100){mostrarNotif('','Campos inválidos','O percentual deve ser entre 0 e 100.','',3000);return;}
    if(ano<2020||ano>2030){mostrarNotif('','Ano inválido','Informe um ano entre 2020 e 2030.','',3000);return;}
    await guardado('salvarMetaLucratividade', async () => {
        const agora=new Date();
        await db.collection('metasLucratividade').add({ano,percentual:pct,dataCriacao:agora,dataHoraRegistro:agora.toLocaleString('pt-BR'),criadoPorNome:user.nome,criadoPorEmail:user.email});
        mostrarNotif('','Meta lançada',ano+': '+pct+'% de lucratividade atingido','',4000);
        carregarPremioConfigs();
    });
}

function getConfigPremio(equipe, ano){
    // Pega a config mais recente para equipe+ano
    const configs=premioConfigs.filter(c=>c.equipe===equipe&&c.ano===ano);
    return configs.length?configs[0]:null;
}

function getMetaLucratividade(ano){
    // Pega a meta mais recente para o ano
    const metas=metasLucratividade.filter(m=>m.ano===ano);
    return metas.length?metas[0].percentual:null;
}

function renderPremioConfigHistorico(){
    const tbody=document.getElementById('premioConfigHistorico');if(!tbody)return;
    if(!premioConfigs.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem;">Nenhuma configuração salva.</td></tr>';return;}
    tbody.innerHTML=premioConfigs.map(c=>{
        return '<tr><td><strong>'+c.equipe+'</strong></td><td>'+c.ano+'</td><td style="font-weight:700;color:var(--mirae-teal);">'+c.numSalarios+'x</td><td style="font-size:0.82rem;color:var(--text-muted);">'+(c.criadoPorNome||'-')+'</td><td style="font-size:0.82rem;">'+(c.dataHoraRegistro||'-')+'</td></tr>';
    }).join('');
}

function renderPainelPremio(){
    const tbody=document.getElementById('painelPremioBody');
    const statsDiv=document.getElementById('painelPremioStats');
    if(!tbody)return;
    const ano=parseInt(document.getElementById('painelPremioAno')?.value||2026);
    const filtroEquipe=document.getElementById('painelPremioEquipe')?.value||'';
    const metaPct=getMetaLucratividade(ano);

    // Agrupa avaliações do ano por colaborador
    const avalsDoAno=avaliacoes.filter(a=>a.ano===ano);
    const colabsMap={};
    avalsDoAno.forEach(a=>{
        if(!colabsMap[a.colaboradorId])colabsMap[a.colaboradorId]=[];
        colabsMap[a.colaboradorId].push(a);
    });

    const linhas=[];
    let totalElegiveis=0,totalPremio=0;

    Object.entries(colabsMap).forEach(([colabId,avals])=>{
        const t=talentos.find(ta=>ta.id===colabId);
        if(!t)return;
        if(filtroEquipe&&t.equipe!==filtroEquipe)return;

        const media=avals.reduce((s,a)=>s+a.notaFinal,0)/avals.length;
        const elegivel=media>=80;
        const quarters=avals.map(a=>'Q'+a.trimestre).sort().join(', ');
        const config=getConfigPremio(t.equipe,ano);
        const numSalarios=config?config.numSalarios:null;
        const salario=t.salario||0;

        // Cálculo: Salário × NumSalarios × 70% × %Meta
        let valorPremio=0;
        if(elegivel&&config&&metaPct!==null){
            if(config.tipo==='fixo'&&config.valorFixo){
                valorPremio=config.valorFixo*0.7*(metaPct/100);
            }else if(config.numSalarios){
                valorPremio=salario*config.numSalarios*0.7*(metaPct/100);
            }
        }
        if(elegivel)totalElegiveis++;
        totalPremio+=valorPremio;

        linhas.push({t,media,elegivel,quarters,numSalarios,salario,metaPct,valorPremio,avals:avals.length});
    });

    if(!linhas.length){
        tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma avaliação encontrada para '+ano+'.</td></tr>';
        if(statsDiv)statsDiv.innerHTML='';
        return;
    }

    // Ordena: elegíveis primeiro, depois por média
    linhas.sort((a,b)=>{if(a.elegivel!==b.elegivel)return b.elegivel-a.elegivel;return b.media-a.media;});

    tbody.innerHTML=linhas.map(l=>{
        const corMeta=l.metaPct===null?'var(--text-muted)':l.metaPct>=80?'#2E7D32':'#EF6C00';
        const badgeElegivel=l.elegivel
            ?'<span style="background:#E8F5E9;color:#2E7D32;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:700;">Elegível</span>'
            :'<span style="background:#FFEBEE;color:#C62828;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:700;">Não elegível</span>';
        return '<tr>'
            +'<td style="font-weight:700;">'+l.t.nome+'</td>'
            +'<td><span class="badge" style="background:#EEE;">'+l.t.equipe+'</span></td>'
            +'<td><span class="badge '+(l.media>=80?'badge-success':'badge-warning')+'">'+l.media.toFixed(1)+' pts</span></td>'
            +'<td style="font-size:0.82rem;color:var(--text-muted);">'+l.quarters+'</td>'
            +'<td>'+badgeElegivel+'</td>'
            +'<td>R$ '+l.salario.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td>'
            +'<td style="font-weight:700;color:var(--mirae-teal);">'+(l.numSalarios!==null?(l.t && getConfigPremio(l.t.equipe,l.avals[0]?.ano)?.tipo==='fixo'?'R$ '+(getConfigPremio(l.t.equipe,l.avals[0]?.ano)?.valorFixo||0).toLocaleString('pt-BR',{minimumFractionDigits:2}):l.numSalarios+'x sal.'):'<span style="color:#EF6C00;">Não configurado</span>')+'</td>'
            +'<td style="font-weight:700;color:'+corMeta+';">'+(l.metaPct!==null?l.metaPct+'%':'<span style="color:#EF6C00;">Não lançada</span>')+'</td>'
            +'<td style="font-weight:800;color:'+(l.valorPremio>0?'#2E7D32':'var(--text-muted)')+';">R$ '+l.valorPremio.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</td>'
            +'</tr>';
    }).join('');

    // Stats
    if(statsDiv){
        const metaLabel=metaPct!==null?metaPct+'% atingida':'Não lançada';
        statsDiv.innerHTML=
            '<div class="stat-card"><div class="stat-label">Total Prêmio Anual</div><div class="stat-value" style="font-size:1.2rem;color:#2E7D32;">R$ '+totalPremio.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</div></div>'
            +'<div class="stat-card"><div class="stat-label">Elegíveis</div><div class="stat-value" style="color:var(--mirae-teal);">'+totalElegiveis+'</div></div>'
            +'<div class="stat-card"><div class="stat-label">Total Avaliados</div><div class="stat-value">'+linhas.length+'</div></div>'
            +'<div class="stat-card"><div class="stat-label">Meta '+ano+'</div><div class="stat-value" style="font-size:1.1rem;color:'+(metaPct!==null&&metaPct>=80?'#2E7D32':'#EF6C00')+';">'+metaLabel+'</div></div>';
    }
}
