async function handleLogin(e){
    e.preventDefault();
    const email=document.getElementById('email').value.trim();
    const senha=document.getElementById('password').value;
    const errDiv=document.getElementById('loginError');
    if(errDiv)errDiv.innerHTML='';
    try{ await auth.signInWithEmailAndPassword(email,senha); }
    catch(err){
        if(errDiv)errDiv.innerHTML='<div style="color:#E74C3C;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);padding:0.7rem 1rem;border-radius:6px;font-size:0.82rem;margin-top:0.5rem;">E-mail ou senha inválidos.</div>';
    }
}
async function handleLogout(){ await auth.signOut(); }
async function startApp(userData){
    user=userData;
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    const nameEl=document.getElementById('userNameDisplay');
    const roleEl=document.getElementById('userRoleDisplay');
    const avatarEl=document.getElementById('sidebarAvatar');
    if(nameEl)nameEl.textContent=user.nome||user.email;
    if(roleEl)roleEl.innerHTML=typeof roleBadge==='function'?roleBadge(user.role):user.role;
    if(avatarEl)avatarEl.textContent=(user.nome||'?')[0].toUpperCase();
    buildTabs();
    ttCarregado=false; tarefasPessoais=[]; // reseta gestor de tarefas pessoais
    await refreshData();
}
auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
        try {
            // Força um token novo — garante que as permissões (claims) mais
            // recentes do servidor entrem nesta sessão imediatamente.
            try { await firebaseUser.getIdToken(true); } catch(e) {}
            // Busca o documento do colaborador diretamente pelo UID oficial do Authentication
            const userDoc = await db.collection('colaboradores').doc(firebaseUser.uid).get();
            
            if (userDoc.exists && userDoc.data().ativo !== false) {
                user = userDoc.data();
                user.id = userDoc.id;

                // Sincroniza claims (role/equipe) via trigger Firestore.
                // Usa onSnapshot em vez de polling: reage imediatamente quando
                // processarSync grava status='concluido', sem bater no Firestore a cada 500ms.
                try {
                    const tok = await firebaseUser.getIdTokenResult();
                    if (tok.claims.role !== user.role || (tok.claims.equipe||'') !== (user.equipe||'')) {
                        const ref = db.collection('solicitacoesSync').doc(firebaseUser.uid);
                        await ref.set({ status: 'pendente', criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
                        // Aguarda sync com timeout — se demorar, continua com permissões atuais (não desloga)
                        await new Promise((resolve) => {
                            let timer;
                            const unsub = ref.onSnapshot(snap => {
                                if (snap.data()?.status === 'concluido') {
                                    clearTimeout(timer); unsub(); resolve();
                                }
                            }, () => { clearTimeout(timer); resolve(); });
                            timer = setTimeout(() => { unsub(); resolve(); }, 10000);
                        });
                        await firebaseUser.getIdToken(true);
                    }
                } catch (err) {
                    console.warn('Não foi possível sincronizar permissões:', err.message);
                }

                await startApp(user);
            } else {
                // Se o usuário não existir no banco ou estiver inativo, desloga
                auth.signOut();
            }
        } catch (err) {
            console.error("Erro ao carregar dados do usuário:", err);
            auth.signOut();
        }
    } else {
        // Se não estiver logado, exibe a tela de login e esconde o painel
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('dashboardPage').classList.add('hidden');
        user = null;
        // Cancela TODOS os listeners em tempo real (evita erros de permissão após logout)
        if(typeof kbTeardown==='function') kbTeardown();
        if(typeof cancelarTodosListeners==='function') cancelarTodosListeners();
        // Limpa estado de módulos para o próximo login
        talentos=[]; avaliacoes=[]; equipes=[]; todosColabs=[];
        dailys=[]; dailyTarefas=[]; lancamentosVTVR=[]; vrConfigs=[];
        tarefasPessoais=[]; ttCarregado=false;
        denunciasListener=null;
    }
});
function buildTabs(){
    const tabs=document.getElementById('mainTabs');
    const defs=[
        {id:'tabHome',       icon:'home',     label:'Início',           show:true,                              group:'principal'},
        {id:'tabMeuPDI',     icon:'award',    label:'Meu PDI',          show:true,                              group:'principal'},
        {id:'tabAvaliacoes', icon:'clipboard',label:'Avaliações',       show:true,                              group:'principal'},
        {id:'tabDenuncia',   icon:'lock',     label:'Canal de Denúncia',show:true,                              group:'principal'},
        {id:'tabDaily',      icon:'calendar', label:'Daily',             show:true,                              group:'principal'},
        {id:'tabTarefas',    icon:'tasks',    label:'Minhas Tarefas',    show:true,                              group:'principal'},
        {id:'tabKanban',     icon:'kanban',   label:'Kanban',             show:true,                              group:'principal'},
        {id:'tabMeuVTVR',    icon:'bus',      label:(user?.tipoContrato==='PJ'?'Meus Reembolsos':'Meu VT/VR'), show:true,    group:'principal'},
        {id:'tabColaboradores',icon:'users',  label:'Talentos',        show:P.cadastrarColab()||P.editarColab(),group:'gestao'},
        {id:'tabEquipes',    icon:'building', label:'Equipes',           show:P.gerenciarEquipes(),              group:'gestao'},
        {id:'tabBonusConfig',icon:'money',    label:'Config. Bônus',    show:P.verBonus(),                      group:'gestao'},
        {id:'tabVTVR',       icon:'bus',      label:'VT / VR',          show:P.isRH(),                          group:'gestao'},
        {id:'tabMesas',      icon:'chair',    label:'Reserva de Mesas',   show:true,                              group:'principal'},
        {id:'tabAnalytics',  icon:'chart',    label:'Análises',          show:true,                              group:'analytics'},
        {id:'tabDenuncias',  icon:'lock',     label:'Denúncias',         show:P.isMaster()||P.isRH(),            group:'analytics'},
    ];
    const groups={principal:'Principal',gestao:'Gestão',analytics:'Analytics'};
    let html='';let lastGroup='';
    defs.filter(d=>d.show).forEach(d=>{
        if(d.group!==lastGroup){html+=`<div class="sidebar-nav-label">${groups[d.group]}</div>`;lastGroup=d.group;}
        html+=`<button class="tab-btn" onclick="switchTab('${d.id}',event)"><span class="tab-btn-icon">${ico(d.icon,{size:18})}</span>${d.label}</button>`;
    });
    tabs.innerHTML=html;
    tabs.querySelector('.tab-btn')?.classList.add('active');
}

let _refreshEmAndamento=false;
async function refreshData(){
    if(_refreshEmAndamento)return;
    _refreshEmAndamento=true;
    try{
        const eSnap=await db.collection('equipes').get();
        equipes=eSnap.docs.map(d=>({id:d.id,...d.data()}));
        const anoCorte=new Date().getFullYear()-3;
        if(P.isRH()){
            const[tSnap,aSnap]=await Promise.all([db.collection('colaboradores').where('ativo','==',true).get(),db.collection('avaliacoes').where('ano','>=',anoCorte).get()]);
            talentos=tSnap.docs.map(d=>({id:d.id,...d.data()}));
            avaliacoes=aSnap.docs.map(d=>({id:d.id,...d.data()}));
            // Carrega dados financeiros via callable (1 round-trip vs N leituras diretas)
            try{
                const res=await fns.httpsCallable('getDadosFinanceiros')();
                (res.data||[]).forEach(fin=>{const t=talentos.find(ta=>ta.id===fin.id);if(t)Object.assign(t,fin);});
            }catch(e){
                const finSnaps=await Promise.all(talentos.map(t=>db.collection('colaboradores').doc(t.id).collection('financeiro').doc('dados').get()));
                finSnaps.forEach((snap,i)=>{if(snap.exists)Object.assign(talentos[i],snap.data());});
            }
        }else if(user?.role==='LIDER'){
            const[tSnap,aSnap,mSnap]=await Promise.all([
                db.collection('colaboradores').where('ativo','==',true).where('equipe','==',user.equipe).get(),
                db.collection('avaliacoes').where('equipe','==',user.equipe).where('ano','>=',anoCorte).get(),
                db.collection('avaliacoes').where('colaboradorId','==',user.id).where('ano','>=',anoCorte).get()
            ]);
            talentos=tSnap.docs.map(d=>({id:d.id,...d.data()}));
            avaliacoes=aSnap.docs.map(d=>({id:d.id,...d.data()}));
            mSnap.docs.forEach(d=>{if(!avaliacoes.find(a=>a.id===d.id))avaliacoes.push({id:d.id,...d.data()});});
            // Líder acessa dados financeiros via callable (fallback para leitura direta)
            try{
                const res=await fns.httpsCallable('getDadosFinanceiros')();
                (res.data||[]).forEach(fin=>{const t=talentos.find(ta=>ta.id===fin.id);if(t)Object.assign(t,fin);});
            }catch(e){
                const finSnaps=await Promise.all(talentos.map(t=>db.collection('colaboradores').doc(t.id).collection('financeiro').doc('dados').get()));
                finSnaps.forEach((snap,i)=>{if(snap.exists)Object.assign(talentos[i],snap.data());});
            }
        }else{
            talentos=[{...user}];
            const aSnap=await db.collection('avaliacoes').where('colaboradorId','==',user.id).where('ano','>=',anoCorte).get();
            avaliacoes=aSnap.docs.map(d=>({id:d.id,...d.data()}));
            // Colaborador carrega apenas os próprios dados financeiros
            const myFin=await db.collection('colaboradores').doc(user.id).collection('financeiro').doc('dados').get();
            if(myFin.exists)Object.assign(talentos[0],myFin.data());
        }
        // Manutenção única do Master: preenche 'equipe' nas avaliações antigas e remove campo legado 'senha'
        if(P.isMaster()){
            const b=db.batch();let n=0;
            avaliacoes.filter(a=>!a.equipe).slice(0,200).forEach(a=>{const t=talentos.find(ta=>ta.id===a.colaboradorId);if(t?.equipe){a.equipe=t.equipe;b.update(db.collection('avaliacoes').doc(a.id),{equipe:t.equipe});n++;}});
            talentos.filter(t=>t.senha!==undefined).slice(0,200).forEach(t=>{b.update(db.collection('colaboradores').doc(t.id),{senha:firebase.firestore.FieldValue.delete()});delete t.senha;n++;});
            if(n)b.commit().catch(()=>{});
        }
        // Para RH os talentos já cobrem todos os colaboradores ativos
        if(P.isRH()){
            todosColabs=talentos.slice();
        }else{
            try{
                const todosSnap=await db.collection('colaboradores').where('ativo','==',true).get();
                todosColabs=todosSnap.docs.map(d=>({id:d.id,...d.data()}));
            }catch(e){todosColabs=talentos.slice();}
        }
    }catch(err){console.error(err);}
    finally{_refreshEmAndamento=false;}
    try{ updateUI(); }catch(err){ console.error('updateUI:', err); }
}

function updateUI(){
    // Selects de equipe
    ['fColEquipe','filterEquipe'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=(id==='filterEquipe'?'<option value="">Todas</option>':'<option value="">Selecione...</option>')+equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');});
    // Select de roles no cadastro (baseado em permissão)
    const roleSel=document.getElementById('fColRole');
    if(roleSel)roleSel.innerHTML=P.rolesAtribuiveis().map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join('');
    // Select talentos para avaliação (apenas quem pode ser avaliado)
    const tSel=document.getElementById('fEvalColab');
    if(tSel)tSel.innerHTML='<option value="">Selecione...</option>'+talentosParaAvaliar().map(t=>`<option value="${t.id}" data-tipo="${t.tipoAvaliacao||'ADM'}">${esc(t.nome)} (${esc(t.equipe||'?')})</option>`).join('');
    // Anos para filtros
    const anos=[...new Set(avaliacoes.map(a=>a.ano).filter(Boolean))].sort((a,b)=>b-a);
    ['filtroAvalAno','relAno','relAno2'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const base=id==='relAno2'?'<option value="">Nenhum</option>':'<option value="">Todos</option>';el.innerHTML=base+anos.map(a=>`<option value="${a}">${a}</option>`).join('');});
    // Selects de relatório (equipe/pessoa) — filtrados por role
    const relEq=document.getElementById('relEquipe');if(relEq)relEq.innerHTML='<option value="">Todas</option>'+(P.isRH()?equipes:[equipes.find(e=>e.nome===user.equipe)].filter(Boolean)).map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    const relPs=document.getElementById('relPessoa');
    const psVis=P.isRH()?talentos:P.isLider()?talentos.filter(t=>t.equipe===user.equipe||t.id===user.id):[{id:user.id,nome:user.nome}];
    if(relPs)relPs.innerHTML='<option value="">Todas</option>'+psVis.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    // Painel bônus equipe
    const selPainel=document.getElementById('painelEquipe');if(selPainel)selPainel.innerHTML='<option value="">Todas</option>'+equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    const bcEq=document.getElementById('bcEquipe');if(bcEq)bcEq.innerHTML=equipes.map(e=>`<option value="${esc(e.nome)}">${esc(e.nome)}</option>`).join('');
    // Esconder form de edição de bônus se não for MASTER
    const bfw=document.getElementById('bonusConfigFormWrapper');if(bfw)bfw.style.display=P.editarBonus()?'block':'none';
    // Botão nova avaliação
    const btnAv=document.getElementById('btnNovaAvaliacao');if(btnAv)btnAv.style.display=['MASTER','LIDER'].includes(user?.role)?'':'none';
    // Botão novo talento
    const btnNT=document.getElementById('btnNovoTalento');if(btnNT)btnNT.style.display=P.cadastrarColab()?'':'none';
    renderHome();renderMeuPDI();renderColaboradores();renderEquipes();renderAvaliacoes();
    if(P.verRelatorios())renderAnalytics();
    if(P.verBonus()){carregarBonusConfigs();carregarPremioConfigs();}
    if(P.isMaster()||P.isRH())carregarDenuncias();
    carregarVTVRColab(); // todos veem os próprios
    carregarDaily(); // dailys e tarefas (todos)
    iniciarListenerNotificacoes(); // sino de tarefas delegadas (Firestore, multi-device)
    if(P.isRH())carregarVTVR();
    verificarDevolutivasLocais();
    // Mostrar botão de backup para Master/RH
    const bw=document.getElementById('backupBtnWrapper');
    if(bw)bw.style.display=P.isMaster()?'block':'none';
    // Verificar lembrete de backup
    verificarLembreteBackup();
    verificarNovasAvaliacoes();
}

function switchTab(id,event){
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const t=document.getElementById(id);if(t)t.classList.add('active');
    if(event?.currentTarget)event.currentTarget.classList.add('active');
    // Reseta scroll para o topo ao trocar de aba
    window.scrollTo(0,0);
    if(id==='tabAnalytics'){renderAnalytics();}
        if(id==='tabMeuVTVR'){renderMeuVTVRTab();}
    if(id==='tabBonusConfig'){renderPainelPremiacoes();renderPainelPremio();}
    if(id==='tabDenuncias'){renderDenuncias();renderDenunciasStats();}
    if(id==='tabVTVR'){renderPainelVTVR();}
    if(id==='tabDenuncia'){verificarDevolutivasLocais();}
    if(id==='tabMeuPDI')renderMeuPDI();
    if(id==='tabDaily')renderDaily();
    if(id==='tabTarefas')renderTarefasPessoais();
    if(id==='tabKanban')kbInit();
    if(id==='tabMesas'){renderMesaSVG(window._reservasDia||{});renderMesas();}
    // dash de dailys vive dentro do Analytics — esconde ao trocar de aba
    const _dd=document.getElementById('tabDailyDash');
    if(_dd&&id!=='tabAnalytics')_dd.style.display='none';
}

// ========== ALTERAR SENHA ==========
function openModalSenha(){document.getElementById('senhaAtual').value='';document.getElementById('senhaNova').value='';document.getElementById('senhaConfirm').value='';document.getElementById('senhaMsg').innerHTML='';document.getElementById('modalSenha').style.display='block';}
async function alterarSenha(){
    const atual=document.getElementById('senhaAtual').value;
    const nova=document.getElementById('senhaNova').value;
    const confirm=document.getElementById('senhaConfirm').value;
    const msg=document.getElementById('senhaMsg');
    if(!atual||!nova||!confirm){msg.innerHTML='<div class="badge badge-danger">Preencha todos os campos.</div>';return;}
    if(nova.length<6){msg.innerHTML='<div class="badge badge-danger">Nova senha precisa ter pelo menos 6 caracteres.</div>';return;}
    if(nova!==confirm){msg.innerHTML='<div class="badge badge-danger">As senhas não coincidem.</div>';return;}
    try{
        const cred=firebase.auth.EmailAuthProvider.credential(user.email,atual);
        await auth.currentUser.reauthenticateWithCredential(cred);
        await auth.currentUser.updatePassword(nova);
        try{ await registrarLogSenha(); }catch(e){}
        msg.innerHTML='<div class="badge badge-success">Senha alterada com sucesso!</div>';
        setTimeout(()=>closeModal('modalSenha'),1500);
    }catch(err){
        const m=(err.code==='auth/wrong-password'||err.code==='auth/invalid-credential')?'Senha atual incorreta.':'Erro: '+err.message;
        msg.innerHTML='<div class="badge badge-danger">'+esc(m)+'</div>';
    }
}

// ========== HOME ==========
// ===== MODO NOTURNO =====
function aplicarTema(t){
    document.body.classList.toggle('dark',t==='dark');
    const btn=document.getElementById('themeToggle');
    if(btn)btn.innerHTML=ico(t==='dark'?'sun':'moon',{size:18});
    // re-renderiza gráficos abertos para pegarem as cores novas
    try{if(typeof renderHome==='function'&&document.getElementById('tabHome')?.classList.contains('active'))renderHome();}catch(e){}
}
function toggleTheme(){
    const novo=document.body.classList.contains('dark')?'claro':'dark';
    localStorage.setItem('mirae_tema',novo);
    aplicarTema(novo);
}
// aplica o tema salvo assim que possível
(function(){try{aplicarTema(localStorage.getItem('mirae_tema')||'claro');}catch(e){}})();

function soltarBaloes(){
    const ov=document.getElementById('birthdayOverlay');if(!ov)return;
    const cores=['#C9A05A','#E1B87F','#1E7D90','#446974','#E74C3C','#2E7D32','#EF6C00','#9B59B6'];
    function um(){
        const b=document.createElement('div');b.className='balao';
        b.style.left=Math.random()*100+'%';
        b.style.background=cores[Math.floor(Math.random()*cores.length)];
        b.style.animationDuration=(5+Math.random()*4)+'s';
        b.style.transform='scale('+(0.6+Math.random()*0.8)+')';
        ov.appendChild(b);
        setTimeout(()=>b.remove(),9000);
    }
    for(let i=0;i<14;i++)setTimeout(um,i*120);
    clearInterval(_balaoTimer);
    _balaoTimer=setInterval(()=>{for(let i=0;i<3;i++)um();},700);
}
function fecharAniversario(){
    const ov=document.getElementById('birthdayOverlay');if(ov)ov.classList.remove('show');
    clearInterval(_balaoTimer);_balaoTimer=null;
}
function verificarAniversario(){
    const t=(todosColabs.find(c=>c.id===user.id))||user;
    if(!t.dataNascimento)return;
    const[,m,d]=t.dataNascimento.split('-');
    const [hAno,hM,hD]=hojeISO().split('-');
    if(parseInt(m)!==parseInt(hM)||parseInt(d)!==parseInt(hD))return;
    const chave='aniv_visto_'+user.id+'_'+hAno;
    if(localStorage.getItem(chave))return; // só uma vez por dia
    localStorage.setItem(chave,'1');
    const v=VERSICULOS_ANIVERSARIO[Math.floor(Math.random()*VERSICULOS_ANIVERSARIO.length)];
    const nome=(user.nome||'').split(' ')[0];
    document.getElementById('bdTitle').textContent='Feliz Aniversário, '+nome+'!';
    document.getElementById('bdSub').textContent='Toda a família Mirae celebra a sua vida hoje.';
    document.getElementById('bdVerse').innerHTML='“'+v.t+'”<span>— '+v.r+'</span>';
    const ov=document.getElementById('birthdayOverlay');ov.classList.add('show');
    soltarBaloes();
    try{dispararConfete&&dispararConfete();}catch(e){}
}

function renderHomeExtras(){
    const primeiroNome=(user?.nome||'').split(' ')[0];
    // Versículo do dia (determinístico por data)
    const diaDoAno=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/86400000);
    const v=VERSICULOS[diaDoAno%VERSICULOS.length];
    const hero=document.getElementById('homeHero');
    if(hero)hero.innerHTML=`
        <div class="hero-purpose">PROPÓSITO MIRAE</div>
        <div class="hero-title">Personificar o amor de Cristo à beira do leito.</div>
        <div class="hero-verse">“${v.t}” <span>— ${v.r}</span></div>`;
    // DNA Mirae — PAVAP em fita dourada + credo
    const dna=document.getElementById('homeDNA');
    if(dna)dna.innerHTML=`
        <div class="dna-card">
            <div class="dna-head"><span class="dna-icon"></span><div><div class="dna-title">Nosso DNA</div><div class="dna-sub">O credo que nos move</div></div></div>
            <div class="dna-grid">
                <div class="dna-strand">
                    ${VALORES_MIRAE.map(x=>`
                        <div class="dna-valor">
                            <div class="dna-medalha">${x.l}</div>
                            <div><div class="valor-nome">${x.n}</div><div class="valor-desc">${x.d}</div></div>
                        </div>`).join('')}
                </div>
                <div class="dna-credo">
                    <div class="credo-item"><span>Missão</span>Impulsionar a performance hospitalar com médicos selecionados, treinados e liderados com excelência.</div>
                    <div class="credo-item"><span>Visão</span>Impactar 200 milhões de vidas por ano até 2046.</div>
                </div>
            </div>
        </div>`;

    // Tarefas de hoje (minhas)
    const hojeStr=hojeISO();
    const minhas=dailyTarefas.filter(t=>t.responsavelId===user.id&&t.data===hojeStr);
    const th=document.getElementById('homeTarefasHoje');
    if(th)th.innerHTML=minhas.length?minhas.map(t=>linhaTarefaHTML(t,true)).join(''):
        '<div style="color:var(--muted);font-size:0.88rem;padding:0.5rem 0;">Nenhuma tarefa registrada para você hoje. <br><span style="font-size:0.8rem;">Aparecerão aqui quando seu líder registrar a daily.</span></div>';

    // Aniversários (próximos 30 dias)
    const av=document.getElementById('homeAniversarios');
    if(av){
        const hoje=new Date();const ano=hoje.getFullYear();
        const lista=(todosColabs.length?todosColabs:talentos).filter(c=>c.dataNascimento).map(c=>{
            const[,m,d]=c.dataNascimento.split('-');
            let prox=new Date(ano,parseInt(m)-1,parseInt(d));
            prox.setHours(0,0,0,0);const h0=new Date();h0.setHours(0,0,0,0);
            if(prox<h0)prox=new Date(ano+1,parseInt(m)-1,parseInt(d));
            const dias=Math.round((prox-h0)/86400000);
            return{nome:c.nome,equipe:c.equipe,dia:parseInt(d),mes:parseInt(m),dias};
        }).filter(x=>x.dias<=45).sort((a,b)=>a.dias-b.dias);
        const MES3=['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        av.innerHTML=lista.length?lista.map(x=>{
            const tag=x.dias===0?'<span class="aniv-hoje">HOJE!</span>':x.dias===1?'<span class="aniv-prox">amanhã</span>':`<span class="aniv-dias">em ${x.dias} dias</span>`;
            return`<div class="aniv-item">
                <div class="aniv-data">${String(x.dia).padStart(2,'0')}<small>${MES3[x.mes]}</small></div>
                <div style="flex:1;"><div class="aniv-nome">${esc(x.nome)}</div><div class="aniv-eq">${esc(x.equipe||'')}</div></div>
                ${tag}
            </div>`;}).join(''):'<div style="color:var(--muted);font-size:0.88rem;">Nenhum aniversário cadastrado nos próximos dias.<br><span style="font-size:0.8rem;">Cadastre as datas de nascimento em Talentos.</span></div>';
    }

    // Surpresa de aniversário (uma vez no dia)
    verificarAniversario();
}

function renderHome(){
    if(!document.getElementById('homeHero'))return;
    renderHomeExtras();
    // Saudação no topbar
    const hora=new Date().getHours();
    const tt=document.getElementById('topbarTitle');
    if(tt)tt.textContent=hora<12?'Bom dia, '+user.nome.split(' ')[0]:hora<18?'Boa tarde, '+user.nome.split(' ')[0]:'Boa noite, '+user.nome.split(' ')[0];
    // PDI (notas/bônus) movido para a aba PDI — só roda se os elementos existirem
    const stats=document.getElementById('homeStats');
    if(!stats)return;
    const myAvals=avaliacoes.filter(a=>a.colaboradorId===user.id).sort((a,b)=>b.data-a.data);
    const lastNota=myAvals.length?myAvals[0].notaFinal:0;
    const lastBonus=myAvals.length?myAvals[0].bonusPercent:0;
    const t=talentos.find(ta=>ta.id===user.id)||user;
    const lastValor=t.salario?calcularValorBonus(getMultiplicadorVigente(t.equipe,myAvals[0]?.trimestre,myAvals[0]?.ano),t.salario,lastBonus):0;
    let html=`<div class="stat-card"><div class="stat-label">Minha Última Nota</div><div class="stat-value" style="color:${lastNota>=80?'#2E7D32':lastNota>=60?'#EF6C00':'#C62828'}">${lastNota.toFixed(1)}</div></div>`;
    html+=`<div class="stat-card"><div class="stat-label">Minhas Avaliações</div><div class="stat-value">${myAvals.length}</div></div>`;
    html+=`<div class="stat-card"><div class="stat-label">Último Bônus</div><div class="stat-value">${lastBonus}%</div></div>`;
    if(t.salario&&lastBonus>0)html+=`<div class="stat-card"><div class="stat-label">Valor do Bônus</div><div class="stat-value" style="font-size:1.2rem;color:#2E7D32;">R$ ${lastValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>`;
    if(P.isMaster()||P.isRH()){html+=`<div class="stat-card"><div class="stat-label">Total Talentos</div><div class="stat-value">${talentos.length}</div></div>`;html+=`<div class="stat-card"><div class="stat-label">Média Global</div><div class="stat-value" style="color:var(--mirae-teal);">${(avaliacoes.reduce((a,b)=>a+b.notaFinal,0)/(avaliacoes.length||1)).toFixed(1)}</div></div>`;}
    stats.innerHTML=html;
    // Ranking card — só para quem pode ver
    const rc=document.getElementById('homeRankCard');
    if(rc){
        if(P.verRelatorios()){
            const visAvals=avalsVisiveis();
            const sorted=[...visAvals].sort((a,b)=>b.notaFinal-a.notaFinal).slice(0,5);
            document.getElementById('homeRank').innerHTML=sorted.length===0?'<p style="color:var(--text-muted);font-size:0.9rem;">Nenhuma avaliação ainda.</p>':sorted.map((a,i)=>{const t=talentos.find(ta=>ta.id===a.colaboradorId)||{nome:'?'};return `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #EEE;"><span><strong>#${i+1}</strong> ${esc(t.nome)}</span><span class="badge badge-success">${a.notaFinal.toFixed(1)}</span></div>`;}).join('');
        }else{rc.style.display='none';}
    }
    const canvas=document.getElementById('homeChart');if(!canvas)return;
    if(charts.home)charts.home.destroy();
    const chartAvals=P.isMaster()||P.isRH()?avaliacoes:myAvals;
    charts.home=new Chart(canvas.getContext('2d'),{type:'line',data:{labels:['Q1','Q2','Q3','Q4'],datasets:[{label:'Performance',data:[1,2,3,4].map(q=>{const f=chartAvals.filter(av=>av.trimestre==q);return f.length?f.reduce((a,c)=>a+c.notaFinal,0)/f.length:null;}),borderColor:'#1E7D90',tension:0.4,fill:true,backgroundColor:'rgba(30,125,144,0.1)',pointBackgroundColor:'#1E7D90'}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}}}});
}

function verificarNovasAvaliacoes(){
    const minhasAvals=avaliacoes.filter(a=>a.colaboradorId===user.id).sort((a,b)=>b.data-a.data);
    if(!minhasAvals.length)return;
    const ultima=minhasAvals[0];
    const chave='notif_visto_'+user.id+'_'+ultima.id;
    if(localStorage.getItem(chave))return;
    localStorage.setItem(chave,'1');
    if(ultima.bonusPercent>=100){
        setTimeout(()=>{dispararConfete();mostrarNotif('','Meta Batida! Parabéns!','Você atingiu '+ultima.notaFinal.toFixed(1)+' pts e conquistou 100% do bônus no Q'+ultima.trimestre+'/'+ultima.ano+'!','bonus',8000);},1200);
    }else if(ultima.bonusPercent>=75){
        setTimeout(()=>{mostrarNotif('','Ótima Performance!','Você atingiu '+ultima.notaFinal.toFixed(1)+' pts e garantiu '+ultima.bonusPercent+'% do bônus no Q'+ultima.trimestre+'/'+ultima.ano+'!','bonus',6000);},1000);
    }else if(ultima.bonusPercent>0){
        setTimeout(()=>{mostrarNotif('','Nova Avaliação','Sua nota no Q'+ultima.trimestre+'/'+ultima.ano+' foi '+ultima.notaFinal.toFixed(1)+' pts — bônus de '+ultima.bonusPercent+'%.','',5000);},800);
    }else{
        setTimeout(()=>{mostrarNotif('','Nova Avaliação Registrada','Sua nota no Q'+ultima.trimestre+'/'+ultima.ano+' foi '+ultima.notaFinal.toFixed(1)+' pts. Continue evoluindo!','',5000);},800);
    }
}

// ========== MEU PDI ==========
function renderMeuPDI(){
    const container=document.getElementById('meuPdiContainer');if(!container)return;
    const minhasAvals=avaliacoes.filter(a=>a.colaboradorId===user.id).sort((a,b)=>{if(a.ano!==b.ano)return b.ano-a.ano;return b.trimestre-a.trimestre;});
    const ultimaAval=minhasAvals[0];
    const t=talentos.find(ta=>ta.id===user.id)||{nome:user.nome,equipe:user.equipe,salario:0};
    const valorBonus=ultimaAval&&t.salario?calcularValorBonus(getMultiplicadorVigente(t.equipe,ultimaAval.trimestre,ultimaAval.ano),t.salario,ultimaAval.bonusPercent):0;
    if(!ultimaAval){container.innerHTML='<div style="text-align:center;padding:4rem;color:var(--text-muted);"><div style="font-size:3rem;margin-bottom:1rem;"></div><h3>Nenhuma avaliação registrada ainda</h3><p style="margin-top:0.5rem;">Aguarde sua primeira avaliação para ver seu PDI aqui.</p></div>';return;}
    const corNota=ultimaAval.notaFinal>=80?'#2E7D32':ultimaAval.notaFinal>=60?'#E1B87F':'#E74C3C';
    let html='<div class="meu-pdi-hero">'
        +'<div><p style="opacity:0.8;font-size:0.85rem;margin-bottom:0.3rem;">Última Avaliação — Q'+ultimaAval.trimestre+'/'+ultimaAval.ano+'</p>'
        +'<h2 style="font-size:1.5rem;margin-bottom:0.5rem;">'+user.nome+'</h2>'
        +'<p style="opacity:0.7;font-size:0.9rem;">'+(t.equipe||user.equipe||'-')+' &nbsp;|&nbsp; '+(user.cargo||'-')+'</p></div>'
        +'<div style="text-align:center;"><div style="font-size:0.8rem;opacity:0.8;margin-bottom:0.3rem;">NOTA FINAL</div>'
        +'<div class="meu-pdi-nota" style="color:'+corNota+';">'+ultimaAval.notaFinal.toFixed(1)+'</div>'
        +'<div style="margin-top:0.5rem;font-size:1rem;font-weight:700;">'+ultimaAval.bonusPercent+'% de Bônus</div>'
        +(valorBonus>0?'<div style="font-size:0.9rem;opacity:0.9;margin-top:0.2rem;">R$ '+valorBonus.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</div>':'')
        +'</div>'
        +'<div style="text-align:center;"><div style="font-size:0.8rem;opacity:0.8;margin-bottom:0.5rem;">META DE BÔNUS</div>'
        +'<div style="width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-direction:column;border:4px solid '+(ultimaAval.notaFinal>=80?'#2E7D32':'rgba(255,255,255,0.4)')+';">'
        +'<span style="display:flex;align-items:center;justify-content:center;">'+(ultimaAval.notaFinal>=80?ico('award',{size:32,color:'#2E7D32'}):ultimaAval.notaFinal>=70?ico('target',{size:32,color:'#E1B87F'}):ultimaAval.notaFinal>=60?ico('chart',{size:32,color:'#EF6C00'}):ico('alert',{size:32,color:'rgba(255,255,255,0.6)'}))+'</span>'
        +'<span style="font-size:0.75rem;opacity:0.9;margin-top:0.2rem;">'+(ultimaAval.notaFinal>=80?'Meta!':ultimaAval.notaFinal>=70?'Quase!':ultimaAval.notaFinal>=60?'Caminho':'')+'</span>'
        +'</div></div></div>';
    // Competências
    if(ultimaAval.scores&&ultimaAval.scores.length>0){
        html+='<div style="background:white;border-radius:15px;padding:1.5rem;box-shadow:var(--shadow);margin-bottom:1.5rem;"><h3 style="margin-bottom:1.5rem;color:var(--mirae-dark);">Desempenho por Competência</h3>';
        let idx=0;
        PDI_GROUPS.forEach(g=>{
            const scores=ultimaAval.scores.slice(idx,idx+g.c.length);
            const media=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
            const pct=Math.round(media/110*100);
            const cor=pct>=80?'#2E7D32':pct>=60?'#1E7D90':pct>=40?'#E1B87F':'#E74C3C';
            html+='<div class="competencia-bar"><span class="competencia-label">'+(g.n.split('.')[1]?.trim()||g.n.substring(0,20))+'</span>'
                +'<div class="competencia-track"><div class="competencia-fill" style="width:'+pct+'%;background:'+cor+';"></div></div>'
                +'<span style="font-size:0.8rem;font-weight:700;color:'+cor+';min-width:35px;text-align:right;">'+pct+'%</span></div>';
            idx+=g.c.length;
        });
        html+='</div>';
    }
    // Histórico
    html+='<div style="background:white;border-radius:15px;padding:1.5rem;box-shadow:var(--shadow);margin-bottom:1.5rem;"><h3 style="margin-bottom:1.2rem;color:var(--mirae-dark);">Histórico de Avaliações</h3>';
    minhasAvals.forEach(a=>{
        const cor=a.notaFinal>=80?'#2E7D32':a.notaFinal>=60?'#EF6C00':'#E74C3C';
        const bg=a.notaFinal>=80?'#E8F5E9':a.notaFinal>=60?'#FFF3E0':'#FFEBEE';
        html+='<div class="historico-item"><div><strong>Q'+a.trimestre+'/'+a.ano+'</strong></div>'
            +'<div style="font-size:0.85rem;color:var(--text-muted);">Registrado por '+(a.avaliadorNome||'Sistema')+'</div>'
            +'<div style="display:flex;gap:0.8rem;align-items:center;">'
            +'<span style="font-weight:800;color:'+cor+';font-size:1.1rem;">'+a.notaFinal.toFixed(1)+'</span>'
            +'<span style="background:'+bg+';color:'+cor+';padding:0.2rem 0.6rem;border-radius:20px;font-size:0.78rem;font-weight:700;">'+a.bonusPercent+'% bônus</span>'
            +'<button class="btn-small" style="background:#E3F2FD;color:#1565C0;max-width:36px;flex:none;" onclick="baixarPDI(\"'+a.id+'\")"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg></button>'
            +'</div></div>';
    });
    html+='</div>';
    // Gráfico
    html+='<div style="background:white;border-radius:15px;padding:1.5rem;box-shadow:var(--shadow);"><h3 style="margin-bottom:1.2rem;color:var(--mirae-dark);">Minha Evolução</h3><div style="height:280px;"><canvas id="meuPdiChart"></canvas></div></div>';
    container.innerHTML=html;
    renderMeuVTVR();
    const sorted=[...minhasAvals].sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.trimestre-b.trimestre);
    setTimeout(()=>{
        const cv=document.getElementById('meuPdiChart');if(!cv)return;
        if(charts.meuPdi)charts.meuPdi.destroy();
        charts.meuPdi=new Chart(cv.getContext('2d'),{type:'line',data:{labels:sorted.map(a=>'Q'+a.trimestre+'/'+a.ano),datasets:[{label:'Nota',data:sorted.map(a=>a.notaFinal),borderColor:'#1E7D90',backgroundColor:'rgba(30,125,144,0.1)',tension:0.4,fill:true,pointBackgroundColor:sorted.map(a=>a.notaFinal>=80?'#2E7D32':a.notaFinal>=60?'#E1B87F':'#E74C3C'),pointRadius:8}]},options:{maintainAspectRatio:false,scales:{y:{min:0,max:110,grid:{color:'#f0f0f0'}}},plugins:{tooltip:{callbacks:{afterLabel:ctx=>'Bônus: '+(sorted[ctx.dataIndex]?.bonusPercent||0)+'%'}}}}});
    },100);
}

if('serviceWorker' in navigator && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'){
    window.addEventListener('load', ()=>{
        // Havia um SW controlando esta página ao carregar? Se SIM, um
        // controllerchange futuro é uma ATUALIZAÇÃO real (nova versão assumiu)
        // e vale recarregar. Se NÃO (primeira instalação), o clients.claim
        // inicial do SW dispararia controllerchange logo após o login e
        // recarregaria a página à toa — causando o "entra, desloga e loga
        // de novo em segundos". Por isso só registramos o reload quando já
        // havia controlador.
        const tinhaControlador = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('/sw.js')
            .then(r=>{
                console.log('Mirae PWA instalado');
                r.update(); // verifica nova versão a cada abertura
            })
            .catch(e=>console.warn('SW erro:', e));
        if(tinhaControlador){
            let recarregou=false;
            navigator.serviceWorker.addEventListener('controllerchange', ()=>{
                if(recarregou)return;recarregou=true;
                console.log('Nova versão — recarregando');
                location.reload();
            });
        }
    });
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    handleLogin, handleLogout, startApp, buildTabs, refreshData, updateUI,
    switchTab, openModalSenha, alterarSenha, aplicarTema, toggleTheme,
    soltarBaloes, fecharAniversario, verificarAniversario,
    renderHomeExtras, renderHome, verificarNovasAvaliacoes, renderMeuPDI,
});
