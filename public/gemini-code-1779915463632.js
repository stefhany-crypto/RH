// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBKqS4xPX_CrqYYrZKT8QLxxqXXMZBqGqI",
    authDomain: "pdimirae.firebaseapp.com",
    projectId: "pdimirae",
    storageBucket: "pdimirae.firebasestorage.app",
    messagingSenderId: "653387815858",
    appId: "1:653387815858:web:ac7a3e3f9b1e8c5f7e8d9a"
};

// Inicialização segura
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Ativa o Auth seguro

let user = null;
let equipes = [], talentos = [], avaliacoes = [], bonusConfigs = [], charts = {};

// CONTROLE DE PERMISSÕES SEGURO
const P = {
    isMaster:  () => user?.role === 'MASTER',
    isRH:      () => ['RH', 'MASTER'].includes(user?.role),
    isLider:   () => ['LIDER', 'RH', 'MASTER'].includes(user?.role),
    cadastrarColab:   () => ['RH', 'MASTER'].includes(user?.role),
    editarColab:      () => ['RH', 'MASTER'].includes(user?.role),
    excluirColab:     () => user?.role === 'MASTER',
    criarAvaliacao:   (eqAlvo) => { 
        if (user?.role === 'MASTER') return true; 
        if (user?.role === 'LIDER') return eqAlvo === user.equipe; 
        return false; 
    },
    excluirAvaliacao: () => user?.role === 'MASTER',
    verBonus:         () => ['RH', 'MASTER'].includes(user?.role),
    editarBonus:      () => user?.role === 'MASTER',
    verRelatorios:    () => ['LIDER', 'RH', 'MASTER'].includes(user?.role),
    gerenciarEquipes: () => user?.role === 'MASTER',
    rolesAtribuiveis: () => { 
        if (user?.role === 'MASTER') return ['COLABORADOR', 'LIDER', 'RH', 'MASTER']; 
        if (user?.role === 'RH') return ['COLABORADOR', 'LIDER']; 
        return []; 
    }
};

// Observador de Login do Firebase Auth
auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
        try {
            const userDoc = await db.collection('colaboradores').doc(firebaseUser.uid).get();
            if (userDoc.exists && userDoc.data().ativo !== false) {
                user = userDoc.data();
                user.id = userDoc.id;
                
                // Garante a conta Master da Stefhany
                const emailsMaster = ['stefhanymoreira@audazhealth.com', 'stefhany@audazhealth.com'];
                if (emailsMaster.includes(user.email) && user.role !== 'MASTER') {
                    user.role = 'MASTER';
                    await db.collection('colaboradores').doc(user.id).update({ role: 'MASTER' });
                }
                
                startApp();
            } else {
                document.getElementById('loginError').innerHTML = '<div class="badge badge-danger">❌ Conta inativa ou não localizada.</div>';
                auth.signOut();
            }
        } catch (err) {
            console.error(err);
            auth.signOut();
        }
    } else {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('dashboardPage').classList.add('hidden');
        user = null;
    }
});

// LOGIN SEGURO
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const btn = e.target.querySelector('button');
    
    btn.disabled = true;
    btn.textContent = 'Autenticando...';
    document.getElementById('loginError').innerHTML = '';

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
        let msgErro = "E-mail ou senha inválidos.";
        if (err.code === "auth/user-disabled") msgErro = "Esta conta foi desativada.";
        if (err.code === "auth/too-many-requests") msgErro = "Muitas tentativas. Conta bloqueada temporariamente.";
        
        document.getElementById('loginError').innerHTML = `<div class="badge badge-danger">❌ ${msgErro}</div>`;
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
}

async function handleLogout() {
    await auth.signOut();
    location.reload();
}

async function hashSenha(senha) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(senha));
    return 'hash:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function startApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    document.getElementById('userNameDisplay').textContent = user.nome;
    document.getElementById('userRoleDisplay').innerHTML = roleBadge(user.role);
    
    const av = document.getElementById('sidebarAvatar');
    if (av) av.textContent = (user.nome || '?')[0].toUpperCase();
    
    buildTabs();
    await refreshData();
    switchTab('tabHome');
}

function buildTabs() {
    const tabs = document.getElementById('mainTabs');
    const defs = [
        { id: 'tabHome',           icon: '🏠', label: 'Início',           show: true,                   group: 'principal' },
        { id: 'tabMeuPDI',         icon: '🏅', label: 'Meu PDI',          show: true,                   group: 'principal' },
        { id: 'tabAvaliacoes',     icon: '📋', label: 'Avaliações',       show: true,                   group: 'principal' },
        { id: 'tabDenuncia',       icon: '🔒', label: 'Canal de Denúncia',show: true,                   group: 'principal' },
        { id: 'tabMeuVTVR',        icon: '🚌', label: 'Meu VT/VR',        show: true,                   group: 'principal' },
        { id: 'tabColaboradores',  icon: '👥', label: 'Talentos',         show: P.cadastrarColab(),     group: 'gestao' },
        { id: 'tabEquipes',        icon: '🏢', label: 'Equipes',          show: P.gerenciarEquipes(),   group: 'gestao' },
        { id: 'tabBonusConfig',    icon: '💰', label: 'Config. Bônus',    show: P.verBonus(),           group: 'gestao' },
        { id: 'tabVTVR',           icon: '🚌', label: 'VT / VR',          show: P.isRH(),               group: 'gestao' },
        { id: 'tabAnalytics',      icon: '📊', label: 'Analytics',        show: P.verRelatorios(),      group: 'analytics' },
        { id: 'tabDenuncias',      icon: '🔒', label: 'Denúncias',        show: P.isMaster() || P.isRH(), group: 'analytics' },
    ];
    const groups = { principal: 'Principal', gestao: 'Gestão', analytics: 'Analytics' };
    let html = ''; let lastGroup = '';
    defs.filter(d => d.show).forEach(d => {
        if (d.group !== lastGroup) { html += `<div class="sidebar-nav-label">${groups[d.group]}</div>`; lastGroup = d.group; }
        html += `<button class="tab-btn" onclick="switchTab('${d.id}',event)"><span class="tab-btn-icon">${d.icon}</span>${d.label}</button>`;
    });
    tabs.innerHTML = html;
    tabs.querySelector('.tab-btn')?.classList.add('active');
}

async function alterarSenha() {
    const nova = document.getElementById('senhaNova').value;
    const confirm = document.getElementById('senhaConfirm').value;
    const msg = document.getElementById('senhaMsg');
    if (!nova || !confirm) { msg.innerHTML = '<div class="badge badge-danger">Preencha os campos.</div>'; return; }
    if (nova.length < 6) { msg.innerHTML = '<div class="badge badge-danger">A senha precisa ter pelo menos 6 caracteres.</div>'; return; }
    if (nova !== confirm) { msg.innerHTML = '<div class="badge badge-danger">As senhas não coincidem.</div>'; return; }
    try {
        await auth.currentUser.updatePassword(nova);
        await db.collection('colaboradores').doc(user.id).update({
            ultimaTrocaSenha: new Date().toLocaleString('pt-BR'),
            trocouSenhaEm: new Date()
        });
        msg.innerHTML = '<div class="badge badge-success">✅ Senha alterada!</div>';
        setTimeout(() => closeModal('modalSenha'), 1500);
    } catch (err) {
        if (err.code === "auth/requires-recent-login") {
            msg.innerHTML = '<div class="badge badge-danger">⚠️ Faça logout e login novamente para alterar a senha.</div>';
        } else { msg.innerHTML = `<div class="badge badge-danger">Erro: ${err.message}</div>`; }
    }
}

// CADASTRO SEGURO DE COLABORADORES
async function saveColab(e) {
    e.preventDefault();
    const id = document.getElementById('editColabId').value;
    if (id && !P.editarColab()) { alert('Sem permissão.'); return; }
    if (!id && !P.cadastrarColab()) { alert('Sem permissão.'); return; }
    const novoRole = document.getElementById('fColRole').value;
    if (!P.rolesAtribuiveis().includes(novoRole)) { alert('Nível de acesso inválido.'); return; }
    
    const email = document.getElementById('fColEmail').value.trim();
    const passRaw = document.getElementById('fColSenha').value;
    const equipeVal = document.getElementById('fColEquipe').value;

    const data = {
        nome: document.getElementById('fColNome').value,
        email: email,
        equipe: equipeVal,
        cargo: document.getElementById('fColCargo').value,
        salario: parseFloat(document.getElementById('fColSalario').value),
        tipoAvaliacao: document.getElementById('fColLogica').value,
        tipoContrato: document.getElementById('fColContrato')?.value || 'CLT',
        valorVT: parseFloat(document.getElementById('fColVT')?.value || 0),
        role: novoRole,
        ativo: true,
        dataAtualizacao: new Date()
    };

    try {
        if (id) {
            await db.collection('colaboradores').doc(id).update(data);
            alert('✅ Perfil atualizado!');
        } else {
            if (!passRaw || passRaw.length < 6) { alert('Senha inicial de no mínimo 6 dígitos obrigatória.'); return; }
            const tempApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
            const tempAuth = tempApp.auth();
            const credential = await tempAuth.createUserWithEmailAndPassword(email, passRaw);
            data.dataCriacao = new Date();
            await db.collection('colaboradores').doc(credential.user.uid).set(data);
            await tempAuth.signOut();
            await tempApp.delete();
            alert('✅ Novo talento cadastrado!');
        }
        closeModal('modalColab');
        refreshData();
    } catch (err) { alert('❌ Erro ao salvar: ' + err.message); }
}