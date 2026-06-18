function openModalEquipe(id=null){if(!P.gerenciarEquipes())return;const modal=document.getElementById('modalEquipe');modal.querySelector('form').reset();document.getElementById('editEquipeId').value=id||'';if(id){const e=equipes.find(eq=>eq.id===id);if(e){document.getElementById('fEquipeNome').value=e.nome;document.getElementById('fEquipeDesc').value=e.descricao||'';}}modal.style.display='block';}
async function saveEquipe(e){e.preventDefault();if(!P.gerenciarEquipes())return;const id=document.getElementById('editEquipeId').value;const data={nome:document.getElementById('fEquipeNome').value,descricao:document.getElementById('fEquipeDesc').value,dataCriacao:new Date()};await guardado('saveEquipe_'+(id||'novo'),async()=>{if(id)await db.collection('equipes').doc(id).update(data);else await db.collection('equipes').add(data);closeModal('modalEquipe');refreshData();});}
function renderEquipes(){const list=document.getElementById('equipesList');if(!list)return;if(!P.gerenciarEquipes()){list.innerHTML='<p style="color:var(--text-muted);">Acesso restrito.</p>';return;}list.innerHTML=equipes.map(e=>{const count=talentos.filter(t=>t.equipe===e.nome).length;return `<div class="card"><div class="card-title">${esc(e.nome)}</div><div class="card-info">${esc(e.descricao||'Sem descrição')}<br><strong>${count} integrantes</strong></div><div class="card-actions"><button class="btn-small btn-edit" onclick="openModalEquipe('${e.id}')">Editar</button><button class="btn-small btn-delete" onclick="deleteEquipe('${e.id}')">Excluir</button></div></div>`;}).join('');}
async function deleteEquipe(id){if(!P.gerenciarEquipes())return;if(confirm('Excluir esta equipe?')){await guardado('deleteEquipe_'+id,async()=>{await db.collection('equipes').doc(id).delete();refreshData();});}}

function toggleCamposPJ(tipo){
    const show=tipo==='PJ';
    const g1=document.getElementById('grpCNPJ');const g2=document.getElementById('grpRazao');
    if(g1)g1.style.display=show?'':'none';
    if(g2)g2.style.display=show?'':'none';
}

function openModalColab(id=null){
    if(!P.cadastrarColab()&&!P.editarColab())return;
    const modal=document.getElementById('modalColab');modal.querySelector('form').reset();
    toggleCamposPJ('CLT');
    document.getElementById('editColabId').value=id||'';
    document.getElementById('modalColabTitle').textContent=id?'Editar Talento':'Cadastrar Talento';
    // Reseta o estado da foto a cada abertura
    const fb=document.getElementById('fColFotoBase64'); if(fb) fb.value='';
    window._removerFotoFlag=false;
    _setFotoPreview('');
    // Popula roles atribuíveis
    const roleSel=document.getElementById('fColRole');
    roleSel.innerHTML=P.rolesAtribuiveis().map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join('');
    if(id){
        const t=talentos.find(ta=>ta.id===id);
        if(t){
            document.getElementById('fColNome').value=t.nome;
            document.getElementById('fColEmail').value=t.email;
            document.getElementById('fColEquipe').value=t.equipe;
            document.getElementById('fColCargo').value=t.cargo;
            if(document.getElementById('fColNascimento'))document.getElementById('fColNascimento').value=t.dataNascimento||'';
            if(document.getElementById('fColAdmissao'))document.getElementById('fColAdmissao').value=t.dataAdmissao||'';
            document.getElementById('fColSalario').value=t.salario;
            document.getElementById('fColLogica').value=t.tipoAvaliacao||'ADM';
            if(document.getElementById('fColContrato')){document.getElementById('fColContrato').value=t.tipoContrato||'CLT';toggleCamposPJ(t.tipoContrato||'CLT');}
            if(document.getElementById('fColVT'))document.getElementById('fColVT').value=t.valorVT||0;
            if(document.getElementById('fColCNPJ'))document.getElementById('fColCNPJ').value=t.cnpj||'';
            if(document.getElementById('fColRazaoSocial'))document.getElementById('fColRazaoSocial').value=t.razaoSocial||'';
            // Carrega a foto existente, se houver
            if(t.avatarUrl){ if(fb) fb.value=t.avatarUrl; _setFotoPreview(t.avatarUrl); }
            // Só mostra role atual se está nas opções atribuíveis
            if(P.rolesAtribuiveis().includes(t.role))roleSel.value=t.role;
        }
    }
    // Abre com 'block' (e sem flex-direction inline): a regra CSS
    // #modalColab[style*="flex"]{display:block!important} faria a substring
    // "flex" persistir no atributo style e impediria closeModal de ocultar.
    modal.style.display='block';
}
async function saveColab(e){
    e.preventDefault();
    const id=document.getElementById('editColabId').value;
    if(id&&!P.editarColab()){mostrarNotif('','Sem permissão','Você não tem permissão para editar colaboradores.','',3000);return;}
    if(!id&&!P.cadastrarColab()){mostrarNotif('','Sem permissão','Você não tem permissão para cadastrar colaboradores.','',3000);return;}
    const novoRole=document.getElementById('fColRole').value;
    if(!P.rolesAtribuiveis().includes(novoRole)){mostrarNotif('','Sem permissão','Você não tem permissão para atribuir esse nível de acesso.','',3000);return;}
    // Brecha RH: se editando alguém que já é RH ou MASTER, só MASTER pode
    if(id){const tAtual=talentos.find(ta=>ta.id===id);if(tAtual&&['RH','MASTER'].includes(tAtual.role)&&!P.isMaster()){mostrarNotif('','Sem permissão','Apenas o Master pode editar usuários com nível RH ou Master.','',3000);return;}}
    // Valida equipe obrigatória para LIDER e RH
    const equipeVal=document.getElementById('fColEquipe').value;
    if(['LIDER','RH'].includes(novoRole)&&!equipeVal){mostrarNotif('','Campo obrigatório','Líderes e RH precisam ter uma equipe definida.','',3000);return;}
    const tipoContratoVal=document.getElementById('fColContrato')?.value||'CLT';
    // Dados públicos: visíveis para todos os autenticados
    // Foto (avatar): data URL compacto já redimensionado em previewFoto.
    const avatarUrl=document.getElementById('fColFotoBase64')?.value||'';
    const data={nome:document.getElementById('fColNome').value,email:document.getElementById('fColEmail').value,equipe:document.getElementById('fColEquipe').value,cargo:document.getElementById('fColCargo').value,dataNascimento:document.getElementById('fColNascimento')?.value||'',tipoAvaliacao:document.getElementById('fColLogica').value,tipoContrato:tipoContratoVal,role:novoRole,ativo:true,avatarUrl:avatarUrl,dataAtualizacao:new Date()};
    // Dados financeiros: subcoleção protegida — só RH/Master e o próprio colaborador leem
    const dadosFinanceiros={salario:parseFloat(document.getElementById('fColSalario').value)||0,valorVT:parseFloat(document.getElementById('fColVT')?.value||0),cnpj:tipoContratoVal==='PJ'?(document.getElementById('fColCNPJ')?.value||''):'',razaoSocial:tipoContratoVal==='PJ'?(document.getElementById('fColRazaoSocial')?.value||''):'',dataAdmissao:document.getElementById('fColAdmissao')?.value||''};
    await guardado('saveColab_'+(id||'novo'), async () => {
        if(id){
            const batch=db.batch();
            batch.update(db.collection('colaboradores').doc(id), data);
            batch.set(db.collection('colaboradores').doc(id).collection('financeiro').doc('dados'), dadosFinanceiros, {merge:true});
            await batch.commit();
            // Se editou o próprio perfil, reflete nome/foto na sidebar na hora
            // (sem precisar deslogar e logar de novo).
            if(user && id===user.id){
                user.nome=data.nome; user.avatarUrl=data.avatarUrl;
                if(typeof atualizarAvatarSidebar==='function') atualizarAvatarSidebar();
                const nameEl=document.getElementById('userNameDisplay'); if(nameEl) nameEl.textContent=user.nome||user.email;
            }
            closeModal('modalColab'); refreshData();
            mostrarNotif('','Colaborador atualizado','Dados salvos com sucesso.','',3000);
        }else{
            const passRaw=document.getElementById('fColSenha').value;
            if(!passRaw||passRaw.length<6){mostrarNotif('','Senha obrigatória','Defina uma senha inicial de pelo menos 6 caracteres.','',4000);return;}
            data.dataCriacao=new Date();
            // Cria a conta no Firebase Auth via app secundário (não desloga quem está usando)
            const secApp=firebase.apps.find(a=>a.name==='secundario')||firebase.initializeApp(firebaseConfig,'secundario');
            let cred;
            try{
                cred=await secApp.auth().createUserWithEmailAndPassword(data.email,passRaw);
            }finally{
                await secApp.auth().signOut().catch(()=>{});
            }
            const batch=db.batch();
            batch.set(db.collection('colaboradores').doc(cred.user.uid), data);
            batch.set(db.collection('colaboradores').doc(cred.user.uid).collection('financeiro').doc('dados'), dadosFinanceiros);
            await batch.commit();
            closeModal('modalColab'); refreshData();
            mostrarNotif('','Colaborador cadastrado',data.nome+' foi adicionado ao sistema.','',4000);
        }
    });
}
async function renderColaboradores(){
    const list=document.getElementById('colaboradoresList');if(!list)return;
    if(!P.cadastrarColab()&&!P.editarColab()){list.innerHTML='<p style="color:var(--text-muted);">Acesso restrito.</p>';return;}
    const search=document.getElementById('searchColab').value.toLowerCase();
    const filter=document.getElementById('filterEquipe').value;
    const status=document.getElementById('filterStatus')?.value||'ativo';
    // Se "todos", busca também inativos do Firestore
    let base=talentos; // ativos já carregados
    if(status==='todos'){
        try{
            const snap=await db.collection('colaboradores').get();
            base=snap.docs.map(d=>({id:d.id,...d.data()}));
        }catch(e){base=talentos;}
    }
    const filtered=base.filter(t=>(t.nome?.toLowerCase().includes(search)||t.email?.toLowerCase().includes(search))&&(!filter||t.equipe===filter));
    list.innerHTML=filtered.map(t=>{
        const tipo=t.tipoAvaliacao||'ADM';
        const cor=tipo==='ADM'?'color:#1565C0;background:#E3F2FD':'color:#E65100;background:#FFF8E1';
        const myAvals=avaliacoes.filter(a=>a.colaboradorId===t.id);
        const lastNota=myAvals.length?[...myAvals].sort((a,b)=>b.data-a.data)[0].notaFinal:null;
        const canEdit=P.editarColab();
        const canDel=P.excluirColab();
        const isInativo=t.ativo===false;
        const canReativar=['RH','MASTER'].includes(user?.role);
        return `<div class="card ${tipo.toLowerCase()}" style="${isInativo?'opacity:0.6;filter:grayscale(0.4);':''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
                <div class="card-tag">${esc(t.equipe||'Sem equipe')}</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    ${isInativo?'<span style="background:#FFEBEE;color:#C62828;font-size:0.7rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:4px;">Inativo</span>':''}
                    ${roleBadge(t.role||'COLABORADOR')}
                    <span style="font-size:0.7rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:4px;${cor}">${tipo}</span>
                </div>
            </div>
            <div class="card-title" style="display:flex;align-items:center;gap:0.5rem;">${t.avatarUrl?`<img src="${esc(t.avatarUrl)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">`:''}<span>${esc(t.nome)}</span></div>
            <div class="card-info">${esc(t.cargo)}<br>${esc(t.email)}${lastNota!==null?`<br>Última: <strong>${lastNota.toFixed(1)}</strong>`:''}</div>
            <div class="card-actions">
                ${!isInativo?`<button class="btn-small btn-eval" onclick="openEvalFor('${t.id}')">Avaliar</button>`:''}
                ${canEdit&&!isInativo?`<button class="btn-small btn-edit" onclick="openModalColab('${t.id}')">Editar</button>`:''}
                ${!isInativo&&canDel?`<button class="btn-small btn-delete" onclick="deleteColab('${t.id}')">Desativar</button>`:''}
                ${isInativo&&canReativar?`<button class="btn-small" style="background:#E8F5E9;color:#2E7D32;" onclick="reativarColab('${t.id}','${jsq(t.nome)}')">Reativar</button>`:''}
            </div>
        </div>`;
    }).join('');
}
function filtrarColaboradores(){renderColaboradores();}
async function deleteColab(id){
    if(!['RH','MASTER'].includes(user?.role)){mostrarNotif('','Sem permissão','Apenas RH ou Master podem desativar colaboradores.','',3000);return;}
    const t=talentos.find(ta=>ta.id===id);
    if(!confirm('Desativar '+( t?.nome||'este colaborador')+'?\n\nEle não conseguirá mais acessar o sistema.'))return;
    await guardado('deleteColab_'+id, async () => {
        await db.collection('colaboradores').doc(id).update({ativo:false,desativadoPor:user.nome,desativadoEm:new Date().toLocaleString('pt-BR')});
        refreshData();
        mostrarNotif('','Colaborador desativado',(t?.nome||'Colaborador')+' foi desativado com sucesso.','',4000);
    });
}
async function reativarColab(id, nome){
    if(!['RH','MASTER'].includes(user?.role)){mostrarNotif('','Sem permissão','Apenas RH ou Master podem reativar colaboradores.','',3000);return;}
    if(!confirm('Reativar '+nome+'?\n\nEle voltará a ter acesso ao sistema.'))return;
    await guardado('reativarColab_'+id, async () => {
        await db.collection('colaboradores').doc(id).update({ativo:true,reativadoPor:user.nome,reativadoEm:new Date().toLocaleString('pt-BR')});
        refreshData();
        mostrarNotif('','Colaborador reativado',nome+' foi reativado com sucesso!','',4000);
    });
}

// Renderiza a foto no círculo de preview (div #fotoPreview, não é <img>)
function _setFotoPreview(dataUrl){
    const div=document.getElementById('fotoPreview');
    if(!div) return;
    if(dataUrl){
        div.style.backgroundImage=`url('${dataUrl}')`;
        div.style.backgroundSize='cover';
        div.style.backgroundPosition='center';
        div.textContent='';
    }else{
        div.style.backgroundImage='';
        div.textContent='';
    }
}
function previewFoto(input){
    if(!input.files||!input.files[0]) return;
    const file=input.files[0];
    // Limite generoso só contra arquivos absurdos: a imagem é reduzida para
    // 256px (JPEG) abaixo, então o tamanho do original não afeta o que é salvo.
    if(file.size>20*1024*1024){ mostrarNotif('','Imagem muito grande','Escolha uma imagem de até 20MB.','',3000); input.value=''; return; }
    const reader=new FileReader();
    reader.onload=e=>{
        const img=new Image();
        img.onload=()=>{
            // Redimensiona para no máx 256px (mantém proporção) e comprime em
            // JPEG — evita estourar o limite de 1MB por documento do Firestore.
            const max=256; let w=img.width, h=img.height;
            if(w>h){ if(w>max){ h=Math.round(h*max/w); w=max; } }
            else   { if(h>max){ w=Math.round(w*max/h); h=max; } }
            const canvas=document.createElement('canvas');
            canvas.width=w; canvas.height=h;
            canvas.getContext('2d').drawImage(img,0,0,w,h);
            const dataUrl=canvas.toDataURL('image/jpeg',0.85);
            const hidden=document.getElementById('fColFotoBase64'); if(hidden) hidden.value=dataUrl;
            _setFotoPreview(dataUrl);
            window._removerFotoFlag=false;
        };
        img.onerror=()=>{ mostrarNotif('','Imagem inválida','Não foi possível ler o arquivo.','',3000); };
        img.src=e.target.result;
    };
    reader.readAsDataURL(file);
}

function removerFoto(){
    const input=document.getElementById('fColFoto');
    if(input) input.value='';
    const hidden=document.getElementById('fColFotoBase64'); if(hidden) hidden.value='';
    _setFotoPreview('');
    window._removerFotoFlag=true;
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    openModalEquipe, saveEquipe, renderEquipes, deleteEquipe,
    toggleCamposPJ, openModalColab, saveColab,
    renderColaboradores, filtrarColaboradores, deleteColab, reativarColab,
    previewFoto, removerFoto,
});
