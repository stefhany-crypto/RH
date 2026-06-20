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
// Renderiza o avatar da sidebar: foto (avatarUrl) ou a inicial do nome.
function atualizarAvatarSidebar(){
    const avatarEl=document.getElementById('sidebarAvatar');
    if(avatarEl&&user){
        if(user.avatarUrl){ avatarEl.innerHTML=`<img src="${user.avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
        else avatarEl.textContent=(user.nome||'?')[0].toUpperCase();
    }
    // Topbar user
    const ta=document.getElementById('topbarAvatar');
    const tn=document.getElementById('topbarUserName');
    const tr=document.getElementById('topbarUserRole');
    if(ta&&user){
        if(user.avatarUrl) ta.innerHTML=`<img src="${user.avatarUrl}" alt="">`;
        else ta.textContent=(user.nome||'?')[0].toUpperCase();
    }
    if(tn&&user) tn.textContent=user.nome||user.email;
    if(tr&&user) tr.textContent=typeof roleLabel==='function'?roleLabel(user.role):user.role;
}
async function startApp(userData){
    user=userData;
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    const splash=document.getElementById('authLoading'); if(splash)splash.style.display='none';
    const nameEl=document.getElementById('userNameDisplay');
    const roleEl=document.getElementById('userRoleDisplay');
    const avatarEl=document.getElementById('sidebarAvatar');
    if(nameEl)nameEl.textContent=user.nome||user.email;
    if(roleEl)roleEl.innerHTML=typeof roleBadge==='function'?roleBadge(user.role):user.role;
    atualizarAvatarSidebar();
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
        // Confirmado que NÃO há sessão: esconde a splash e exibe o login.
        const splash=document.getElementById('authLoading'); if(splash)splash.style.display='none';
        const lp=document.getElementById('loginPage');
        lp.classList.remove('hidden'); lp.style.display='flex';
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
        {id:'tabRemuneracao',icon:'money',    label:(user?.tipoContrato==='PJ'&&!P.isRH()&&!P.isMaster()?'Minha Remuneração':'Remuneração PJ'), show:user?.tipoContrato==='PJ'||P.isRH()||P.isMaster(), group:'gestao'},
        {id:'tabAnalytics',  icon:'chart',    label:'Análises',          show:true,                              group:'analytics'},
        {id:'tabDenuncias',  icon:'lock',     label:'Denúncias',         show:P.isMaster()||P.isRH(),            group:'analytics'},
    ];
    let html='';
    defs.filter(d=>d.show).forEach(d=>{
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
            if(myFin.exists){Object.assign(talentos[0],myFin.data());Object.assign(user,myFin.data());}
            // Reconstrói tabs para refletir tipoContrato (ex: aba Minha Remuneração para PJs)
            buildTabs();
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
    // Carrega kudos e re-renderiza mural depois
    db.collection('kudos').orderBy('criadoEm','desc').limit(10).get().then(snap=>{kudos=snap.docs.map(d=>({id:d.id,...d.data()}));renderHomeExtras();}).catch(()=>{});
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
    if(id==='tabVTVR'){renderPainelVTVR();if(typeof _carregarDriveConfig==='function')_carregarDriveConfig();}
    if(id==='tabDenuncia'){verificarDevolutivasLocais();}
    if(id==='tabMeuPDI')renderMeuPDI();
    if(id==='tabDaily')renderDaily();
    if(id==='tabTarefas'){
        if(window.ttRenderRail)try{window.ttRenderRail();}catch(e){}
        if(window.renderTarefasPessoais)window.renderTarefasPessoais();
    }
    if(id==='tabKanban')kbInit();
    if(id==='tabRemuneracao'&&window.renderRemuneracaoTab)window.renderRemuneracaoTab();
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
    // DNA Mirae — NOSSA ESSÊNCIA (Propósito + Missão/Visão + PAVAP)
    const dna=document.getElementById('homeDNA');
    if(dna) dna.innerHTML=`
        <div class="home-dna-label" style="display:flex;align-items:center;gap:8px;">${ico('compass',{size:14,color:'#DAB47E'})} NOSSA ESSÊNCIA</div>
        <div style="margin:14px 0 18px;">
            <div style="font-size:11.5px;font-weight:600;color:#DAB47E;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;">Propósito</div>
            <div style="font-family:'Newsreader',serif;font-style:italic;font-size:17px;line-height:1.5;color:#fff;">Personificar o amor de Cristo à beira do leito (João 3:16).</div>
        </div>
        <div class="home-dna-credo" style="margin-bottom:18px;">
            <div><div class="home-credo-title">Missão</div><div class="home-credo-text">Impulsionar a performance hospitalar com médicos selecionados, treinados e liderados com excelência.</div></div>
            <div><div class="home-credo-title">Visão</div><div class="home-credo-text">Impactar 200 milhões de vidas por ano até 2046.</div></div>
        </div>
        <div style="font-size:11.5px;font-weight:700;color:#DAB47E;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;position:relative;">Valores · PAVAP</div>
        <div class="home-dna-valores">
            ${(VALORES_MIRAE||[]).map(x=>`
                <div class="home-dna-valor">
                    <div class="home-dna-medalha">${x.l}</div>
                    <div><div class="home-dna-nome">${x.n}</div><div class="home-dna-desc">${x.d}</div></div>
                </div>`).join('')}
        </div>`;
    // Team label no widget daily
    const tl=document.getElementById('homeTeamLabel');
    if(tl&&user&&user.equipe) tl.textContent=`Todos os dias · ${user.equipe}`;
    // Minha mesa
    const mesaEl=document.getElementById('homeMinhaMesa');
    if(mesaEl){
        const minhasMesas=(window._reservasDia?Object.values(window._reservasDia).filter(r=>r.userId===user.id):[])
        if(minhasMesas.length){
            mesaEl.style.display='';
            mesaEl.innerHTML=`<div class="home-card-header"><div class="home-card-title">${ico('armchair',{size:14,color:'#BE8C45'})} Minha mesa</div><span class="home-card-link" onclick="switchTab('tabMesas')">Reservar →</span></div>`
                +minhasMesas.map(r=>`<div class="home-mesa-item"><span class="home-mesa-icon">${ico('map-pin',{size:16,color:'#BE8C45'})}</span><div><div class="home-mesa-nome">${esc(r.mesaNome||'Mesa '+r.mesaId)}</div><div class="home-mesa-sub">${esc(r.sala||'')}</div></div></div>`).join('')
                +`<button class="home-mesa-btn" style="margin-top:8px;width:100%;" onclick="switchTab('tabMesas')">Reservar outro dia</button>`;
        } else {
            mesaEl.style.display='';
            mesaEl.innerHTML=`<div class="home-card-header"><div class="home-card-title">${ico('armchair',{size:14,color:'#BE8C45'})} Minha mesa</div></div><div class="home-mesa-item"><span class="home-mesa-icon">${ico('map-pin',{size:16,color:'#BE8C45'})}</span><div><div class="home-mesa-nome" style="color:var(--muted);font-size:13.5px;">Nenhuma mesa reservada hoje</div></div></div><button class="home-mesa-btn" style="margin-top:8px;width:100%;" onclick="switchTab('tabMesas')">Reservar mesa</button>`;
        }
    }
    // Mural de reconhecimento
    const muralEl=document.getElementById('homeMural');
    if(muralEl){
        const cores=['#023B48','#BE8C45','#3F8A6E','#D98E6A'];
        const agora=new Date();
        const qStart=new Date(agora.getFullYear(),Math.floor(agora.getMonth()/3)*3,1);
        const kudosTri=(kudos||[]).filter(k=>{
            if(!k.criadoEm)return true;
            const d=k.criadoEm.toDate?k.criadoEm.toDate():new Date(k.criadoEm);
            return d>=qStart;
        });
        const feed=kudosTri.filter(k=>k.publico!==false).slice(0,4);
        const nomesColabs=(todosColabs.length?todosColabs:talentos).filter(cc=>cc.id!==user.id).map(cc=>cc.nome).sort();
        muralEl.innerHTML=`<div class="home-card-header"><div class="home-card-title">${ico('heart',{size:14,color:'#BE8C45'})} Mural de reconhecimento</div></div>
            <div class="home-mural-form">
                <div style="position:relative;margin-bottom:8px;">
                    <input class="home-mural-input" id="muralParaInput" placeholder="Para quem é o reconhecimento?" autocomplete="off" style="height:36px;padding:8px 12px;width:100%;box-sizing:border-box;" oninput="muralFiltrarPessoas(this.value)">
                    <div id="muralSugestoes" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.10);z-index:99;max-height:160px;overflow-y:auto;"></div>
                </div>
                <textarea class="home-mural-input" id="muralTextoInput" placeholder="Escreva um reconhecimento sincero..." rows="2" style="margin-bottom:8px;"></textarea>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer;">
                        <input type="checkbox" id="muralPublicoToggle" checked style="accent-color:var(--teal);">
                        Visível a todos
                    </label>
                    <button class="home-mural-send" onclick="enviarKudo()">${ico('send',{size:14,color:'#fff'})} Reconhecer</button>
                </div>
            </div>
            ${feed.length?`<div class="home-mural-feed">${feed.map((k,i)=>`
                <div class="home-mural-item">
                    <div class="home-mural-av" style="background:${cores[i%cores.length]};">${(k.deNome||k.de||'?')[0].toUpperCase()}</div>
                    <div><div class="home-mural-text">${esc(k.texto||k.mensagem||'')}</div>
                    <div class="home-mural-meta"><b>${esc(k.deNome||k.de||'')}</b> reconheceu <b>${esc(k.paraNome||k.para||'')}</b> · ${esc(k.quando||k.data||'')}</div></div>
                </div>`).join('')}</div>`:'<div style="color:var(--muted);font-size:13.5px;padding:4px 0;">Seja o primeiro a reconhecer alguém hoje!</div>'}`    }
    // Tarefas de hoje + atrasadas (pendente/andamento de dias anteriores)
    const hojeStr=hojeISO();
    const tfHoje=dailyTarefas.filter(t=>t.responsavelId===user.id&&t.data===hojeStr);
    const tfAtrasadas=dailyTarefas.filter(t=>t.responsavelId===user.id&&t.data<hojeStr&&['pendente','andamento'].includes(t.status));
    const th=document.getElementById('homeTarefasHoje');
    if(th)th.innerHTML=(tfAtrasadas.length||tfHoje.length)
        ?(tfAtrasadas.map(t=>linhaTarefaHTML(t,true,true)).join('')+tfHoje.map(t=>linhaTarefaHTML(t,true)).join(''))
        :'<div style="color:var(--muted);font-size:0.88rem;padding:0.5rem 0;">Nenhuma tarefa registrada para você hoje. <br><span style="font-size:0.8rem;">Aparecerão aqui quando seu líder registrar a daily.</span></div>';
    // Versículo do dia (sorteado pelo número do dia do ano — mesmo verso o dia inteiro)
    const vEl=document.getElementById('homeVersiculo');
    if(vEl&&typeof VERSICULOS_DIA!=='undefined'&&VERSICULOS_DIA.length){
        const agora=new Date();
        const inicio=new Date(agora.getFullYear(),0,0);
        const diaDoAno=Math.floor((agora-inicio)/86400000);
        const v=VERSICULOS_DIA[diaDoAno%VERSICULOS_DIA.length];
        vEl.innerHTML=`<div class="versiculo-card">
            <div class="versiculo-label">${ico('book-open',{size:12,color:'#DAB47E'})} Versículo do dia</div>
            <div class="versiculo-texto">"${esc(v.t)}"</div>
            <div class="versiculo-ref">${esc(v.r)}</div>
        </div>`;
    }
    // Calendário de aniversários
    renderCalendarioAniversarios();
    verificarAniversario();
}
// Mês exibido no calendário (0=janeiro, offset relativo ao mês atual)
let _anivMesOffset=0;
function anivMesAnterior(){ _anivMesOffset--; renderCalendarioAniversarios(); }
function anivProximoMes(){ _anivMesOffset++; renderCalendarioAniversarios(); }
function renderCalendarioAniversarios(){
    const av=document.getElementById('homeAniversarios');
    if(!av) return;
    const agora=new Date();
    const ano=agora.getFullYear();
    const mesBase=agora.getMonth()+_anivMesOffset;
    const dataRef=new Date(ano,mesBase,1);
    const mes=dataRef.getMonth();
    const anoRef=dataRef.getFullYear();
    const MESES_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DIAS_SEM=['D','S','T','Q','Q','S','S'];
    const primeiroDia=new Date(anoRef,mes,1).getDay();
    const ultimoDia=new Date(anoRef,mes+1,0).getDate();
    // Monta mapa de aniversários do mês: dia -> [{nome, equipe}]
    const anivMap={};
    const colabs=(todosColabs.length?todosColabs:talentos).filter(c=>c.dataNascimento);
    colabs.forEach(c=>{
        const[,m,d]=c.dataNascimento.split('-');
        if(parseInt(m)-1===mes){
            const dia=parseInt(d);
            if(!anivMap[dia]) anivMap[dia]=[];
            anivMap[dia].push({nome:c.nome,equipe:c.equipe||''});
        }
    });
    const hoje=agora.getDate();
    const mesAtual=agora.getMonth()===mes&&agora.getFullYear()===anoRef;
    // Grid do calendário
    let cells='';
    DIAS_SEM.forEach(d=>{ cells+=`<div class="aniv-cal-dow">${d}</div>`; });
    for(let i=0;i<primeiroDia;i++) cells+=`<div class="aniv-cal-day empty"></div>`;
    for(let d=1;d<=ultimoDia;d++){
        const temAniv=!!anivMap[d];
        const ehHoje=mesAtual&&d===hoje;
        let cls='aniv-cal-day';
        if(ehHoje) cls+=' hoje';
        if(temAniv) cls+=' aniv';
        const nomes=temAniv?anivMap[d].map(p=>p.nome).join(', '):'';
        cells+=`<div class="${cls}" title="${nomes}">${d}${temAniv?'<span class="aniv-dot"></span>':''}</div>`;
    }
    // Lista de aniversários do mês
    const anivLista=Object.keys(anivMap).map(d=>({dia:parseInt(d),pessoas:anivMap[d]})).sort((a,b)=>a.dia-b.dia);
    const listaHTML=anivLista.length?anivLista.map(x=>
        x.pessoas.map(p=>`<div class="aniv-cal-pessoa">
            <div class="aniv-cal-data">${String(x.dia).padStart(2,'0')}</div>
            <div><div class="aniv-cal-nome">${esc(p.nome)}</div><div class="aniv-cal-eq">${esc(p.equipe)}</div></div>
        </div>`).join('')
    ).join(''):'<div style="color:var(--muted);font-size:13px;padding:4px 0;">Nenhum aniversário neste mês.</div>';
    av.innerHTML=`<div class="aniv-cal-header">${MESES_FULL[mes]} ${anoRef}</div>
        <div class="aniv-cal-grid">${cells}</div>
        <div class="aniv-cal-pessoas">${listaHTML}</div>`;
}
function renderHome(){
    renderHomeExtras();
    // Saudação e data
    const hora=new Date().getHours();
    const greet=hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite';
    const tt=document.getElementById('topbarTitle');
    const hg=document.getElementById('homeGreeting');
    const hd=document.getElementById('homeDate');
    if(tt) tt.textContent='Início';
    if(hg) hg.textContent=greet+', '+user.nome.split(' ')[0]+'.';
    if(hd){
        const now=new Date();
        const dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        const meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        hd.textContent=dias[now.getDay()]+', '+now.getDate()+' de '+meses[now.getMonth()]+' de '+now.getFullYear();
    }
    // Stats cards
    const stats=document.getElementById('homeStats');
    if(stats){
        const myAvals=avaliacoes.filter(a=>a.colaboradorId===user.id).sort((a,b)=>b.data-a.data);
        const lastNota=myAvals.length?myAvals[0].notaFinal:null;
        const lastBonus=myAvals.length?myAvals[0].bonusPercent:null;
        const t=talentos.find(ta=>ta.id===user.id)||user;
        const lastValor=(t.salario&&lastBonus>0)?calcularValorBonus(getMultiplicadorVigente(t.equipe,myAvals[0]?.trimestre,myAvals[0]?.ano),t.salario,lastBonus):0;
        const defs=[
            {label:'Última nota',value:lastNota!=null?lastNota.toFixed(1):'—',bg:'#EAF3EE',fg:'#3F8A6E'},
            {label:'Avaliações',value:myAvals.length,bg:'#EEF2FB',fg:'#5272C0'},
            {label:'Último bônus',value:lastBonus!=null?lastBonus+'%':'—',bg:'rgba(218,180,126,0.15)',fg:'#BE8C45'},
            ...(P.isMaster()||P.isRH()?[
                {label:'Total talentos',value:talentos.length,bg:'rgba(2,59,72,0.08)',fg:'#023B48'},
                {label:'Média global',value:(avaliacoes.reduce((a,b)=>a+b.notaFinal,0)/(avaliacoes.length||1)).toFixed(1),bg:'rgba(2,59,72,0.08)',fg:'#023B48'}
            ]:[]),
            ...(t.salario&&lastBonus>0?[{label:'Valor bônus',value:'R$ '+lastValor.toLocaleString('pt-BR',{minimumFractionDigits:2}),bg:'rgba(63,138,110,0.10)',fg:'#2F6F58'}]:[])
        ];
        stats.innerHTML=defs.slice(0,4).map(s=>`
            <div class="home-stat-card">
                <div class="home-stat-icon" style="background:${s.bg};color:${s.fg};font-size:18px;font-weight:600;font-family:'Newsreader',serif;">${s.value[0]||'—'}</div>
                <div class="home-stat-value" style="color:${s.fg}">${s.value}</div>
                <div class="home-stat-label">${s.label}</div>
            </div>`).join('');
    }
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
    if(!ultimaAval){
        container.innerHTML=`<div class="pdi-page" style="display:block;"><div class="pdi-comp-card" style="text-align:center;padding:48px;"><div style="width:62px;height:62px;border-radius:16px;background:#F1ECE2;color:#BE8C45;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">${ico('target',{size:28,color:'#BE8C45'})}</div><h2 style="font-family:'Newsreader',serif;font-weight:500;font-size:24px;margin:0 0 8px;">Nenhuma avaliação ainda</h2><p style="color:var(--muted);font-size:15px;margin:0;max-width:360px;line-height:1.6;margin:0 auto;">Aguarde sua primeira avaliação para ver seu PDI aqui.</p></div></div>`;
        return;
    }
    // Trimestres disponíveis
    const tris=minhasAvals.map(a=>({key:a.id,label:`${a.trimestre}° tri`,ano:a.ano,tri:a.trimestre}));
    if(!window._pdiTriSel)window._pdiTriSel=ultimaAval.id;
    const selId=window._pdiTriSel;
    const aval=minhasAvals.find(a=>a.id===selId)||ultimaAval;
    // Competências com barras
    const cores={0:'#023B48',1:'#3F8A6E',2:'#DAB47E',3:'#D98E6A',4:'#023B48'};
    let compRows='';
    if(aval.scores&&aval.scores.length>0){
        let idx=0;
        PDI_GROUPS.forEach((g,gi)=>{
            const scores=aval.scores.slice(idx,idx+g.c.length);
            const media=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
            const notaEm5=(media/110*5).toFixed(1);
            const pct=Math.round(media/110*100);
            const cor=cores[gi%5];
            const nome=g.n.split('.')[1]?.trim()||g.n.substring(0,22);
            const desc=g.desc||'';
            compRows+=`<div class="pdi-comp-row">
                <div class="pdi-comp-head"><span class="pdi-comp-nome">${esc(nome)}</span><span class="pdi-comp-nota">${notaEm5}<small>/5</small></span></div>
                <div class="pdi-comp-track"><div class="pdi-comp-fill" style="width:${pct}%;background:${cor};"></div></div>
                ${desc?`<p class="pdi-comp-desc">${esc(desc)}</p>`:''}
            </div>`;
            idx+=g.c.length;
        });
    }
    // Nota em escala 5
    const mediaEm5=(aval.notaFinal/110*5).toFixed(1);
    const evolucao=minhasAvals.length>1?((aval.notaFinal-minhasAvals[1].notaFinal)/110*5).toFixed(1):null;
    // Feedback do líder
    const avaliadorNome=aval.avaliadorNome||'Seu líder';
    const avaliadorInicial=(avaliadorNome[0]||'L').toUpperCase();
    const feedbackTxt=aval.observacoes||aval.feedback||'Nenhum feedback registrado para este trimestre.';
    // Plano de ação (itens do PDI)
    const planos=aval.planos||aval.acoes||[];
    const planoHTML=planos.length?planos.map(p=>{
        const feito=p.feito||p.concluido;
        return`<div class="pdi-plano-item">
            <div class="pdi-plano-check" style="background:${feito?'#3F8A6E':'transparent'};border:2px solid ${feito?'#3F8A6E':'#cdd5d6'};">${feito?ico('check',{size:11,color:'#fff'}):''}</div>
            <span class="pdi-plano-txt" style="${feito?'color:#9aa9ad;text-decoration:line-through;':''}">${esc(p.texto||p.descricao||p)}</span>
        </div>`;}).join(''):'<div style="color:var(--muted);font-size:13.5px;">Nenhum item de plano de ação registrado.</div>';
    container.innerHTML=`
    <div class="pdi-page">
        <div class="pdi-comp-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
                <h2 class="pdi-comp-title">Avaliação por competências</h2>
                <div class="pdi-tri-bar">
                    ${tris.map(tr=>`<button class="pdi-tri-btn${tr.key===selId?' active':''}" onclick="window._pdiTriSel='${tr.key}';renderMeuPDI();">${tr.label}</button>`).join('')}
                </div>
            </div>
            <div class="pdi-comp-list">${compRows||'<div style="color:var(--muted);">Sem dados de competências nesta avaliação.</div>'}</div>
        </div>
        <div class="pdi-side">
            <div class="pdi-media-card">
                <div class="pdi-media-label">Média do Trimestre</div>
                <div class="pdi-media-num">${mediaEm5}</div>
                <div class="pdi-media-sub">de 5,0${evolucao?` · evolução de ${Number(evolucao)>=0?'+':''}${evolucao} vs. tri. anterior`:''}</div>
            </div>
            <div class="pdi-info-card">
                <div class="pdi-info-head"><span class="pdi-info-head-icon">${ico('message-square',{size:17,color:'#BE8C45'})}</span><span class="pdi-info-head-title">Feedback do líder</span></div>
                <p class="pdi-info-body">${esc(feedbackTxt)}</p>
                <div class="pdi-feedback-autor">
                    <div class="pdi-feedback-av">${avaliadorInicial}</div>
                    <div><div class="pdi-feedback-name">${esc(avaliadorNome)}</div><div class="pdi-feedback-role">${esc(aval.avaliadorCargo||'Líder')}</div></div>
                </div>
            </div>
            <div class="pdi-info-card">
                <div class="pdi-info-head"><span class="pdi-info-head-icon">${ico('route',{size:17,color:'#3F8A6E'})}</span><span class="pdi-info-head-title">Plano de ação</span></div>
                <div class="pdi-plano-list">${planoHTML}</div>
            </div>
            <div class="pdi-info-card">
                <div class="pdi-info-head"><span class="pdi-info-head-icon">${ico('chart',{size:17,color:'#023B48'})}</span><span class="pdi-info-head-title">Minha evolução</span></div>
                <div style="height:180px;"><canvas id="meuPdiChart"></canvas></div>
            </div>
        </div>
    </div>`;
    const sorted=[...minhasAvals].sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.trimestre-b.trimestre);
    setTimeout(()=>{
        const cv=document.getElementById('meuPdiChart');if(!cv)return;
        if(charts.meuPdi)charts.meuPdi.destroy();
        charts.meuPdi=new Chart(cv.getContext('2d'),{type:'line',data:{labels:sorted.map(a=>`Q${a.trimestre}/${a.ano}`),datasets:[{label:'Nota',data:sorted.map(a=>(a.notaFinal/110*5)),borderColor:'#023B48',backgroundColor:'rgba(2,59,72,0.08)',tension:0.4,fill:true,pointBackgroundColor:sorted.map(a=>a.notaFinal>=88?'#3F8A6E':a.notaFinal>=66?'#DAB47E':'#D98E6A'),pointRadius:6}]},options:{maintainAspectRatio:false,scales:{y:{min:0,max:5,grid:{color:'#F1ECE2'},ticks:{callback:v=>v.toFixed(1)}}},plugins:{tooltip:{callbacks:{afterLabel:ctx=>`Bônus: ${sorted[ctx.dataIndex]?.bonusPercent||0}%`}}}}});
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

function muralFiltrarPessoas(q){
    const box=document.getElementById('muralSugestoes');
    if(!box)return;
    const lista=(todosColabs.length?todosColabs:talentos).filter(cc=>cc.id!==user.id);
    if(!q||q.trim().length<1){box.style.display='none';return;}
    const lower=q.toLowerCase();
    const matches=lista.filter(cc=>cc.nome&&cc.nome.toLowerCase().includes(lower)).slice(0,8);
    if(!matches.length){box.style.display='none';return;}
    box.innerHTML=matches.map(cc=>`<div onclick="muralSelecionarPessoa('${esc(cc.nome)}')" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);" onmouseover="this.style.background='var(--cream)'" onmouseout="this.style.background=''">${esc(cc.nome)}</div>`).join('');
    box.style.display='block';
}
function muralSelecionarPessoa(nome){
    const inp=document.getElementById('muralParaInput');
    if(inp)inp.value=nome;
    const box=document.getElementById('muralSugestoes');
    if(box)box.style.display='none';
}

async function enviarKudo(){
    const paraEl=document.getElementById('muralParaInput');
    const textoEl=document.getElementById('muralTextoInput');
    const pubEl=document.getElementById('muralPublicoToggle');
    const para=(paraEl?.value||'').trim();
    const texto=(textoEl?.value||'').trim();
    if(!para){mostrarNotif('','Campo obrigatório','Informe para quem é o reconhecimento.','',4000);return;}
    if(!texto){mostrarNotif('','Campo obrigatório','Escreva a mensagem de reconhecimento.','',4000);return;}
    const publico=pubEl?pubEl.checked:true;
    try{
        const agora=new Date();
        const ref=await db.collection('kudos').add({
            de:user.id,deNome:user.nome,para,paraNome:para,
            texto,publico,
            quando:agora.toLocaleDateString('pt-BR'),
            criadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        if(paraEl)paraEl.value='';
        if(textoEl)textoEl.value='';
        kudos=[{id:ref.id,de:user.id,deNome:user.nome,para,paraNome:para,texto,publico,
            quando:agora.toLocaleDateString('pt-BR'),criadoEm:{toDate:()=>agora}},...kudos];
        renderHomeExtras();
        mostrarNotif('','Reconhecimento enviado!',`${para} foi reconhecido(a).`,'bonus',4000);
    }catch(e){
        console.error('[KUDO]',e);
        mostrarNotif('','Erro ao enviar reconhecimento',e?.message||e?.code||'Tente novamente.','',8000);
    }
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    handleLogin, handleLogout, startApp, buildTabs, refreshData, updateUI,
    atualizarAvatarSidebar,
    switchTab, openModalSenha, alterarSenha, aplicarTema, toggleTheme,
    soltarBaloes, fecharAniversario, verificarAniversario,
    renderHomeExtras, renderHome, verificarNovasAvaliacoes, renderMeuPDI,
    anivMesAnterior, anivProximoMes, renderCalendarioAniversarios,
    muralFiltrarPessoas, muralSelecionarPessoa,
    enviarKudo,
});
