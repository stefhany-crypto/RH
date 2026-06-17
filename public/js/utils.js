function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function jsq(s){return esc(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));}
// ========== PERMISSÕES ==========
const P={
    isMaster:  ()=>user?.role==='MASTER',
    isRH:      ()=>['RH','MASTER'].includes(user?.role),
    isLider:   ()=>['LIDER','RH','MASTER'].includes(user?.role),
    // Ações
    cadastrarColab:   ()=>['RH','MASTER'].includes(user?.role),
    editarColab:      ()=>['RH','MASTER'].includes(user?.role),
    excluirColab:     ()=>user?.role==='MASTER',
    criarAvaliacao:   (eqAlvo)=>{ if(user?.role==='MASTER')return true; if(user?.role==='LIDER')return eqAlvo===user.equipe; return false; }, // RH não avalia — só LIDER e MASTER
    excluirAvaliacao: ()=>user?.role==='MASTER',
    verBonus:         ()=>['RH','MASTER'].includes(user?.role),
    editarBonus:      ()=>user?.role==='MASTER',
    verRelatorios:    ()=>['LIDER','RH','MASTER'].includes(user?.role),
    gerenciarEquipes: ()=>user?.role==='MASTER',
    rolesAtribuiveis: ()=>{ if(user?.role==='MASTER')return['COLABORADOR','LIDER','RH','MASTER']; if(user?.role==='RH')return['COLABORADOR','LIDER']; return[]; }
};

// Avaliações visíveis para o usuário
function avalsVisiveis(){
    if(['MASTER','RH'].includes(user?.role))return avaliacoes;
    if(user?.role==='LIDER')return avaliacoes.filter(a=>{ const t=talentos.find(ta=>ta.id===a.colaboradorId); return a.colaboradorId===user.id||t?.equipe===user.equipe; }); // Líder vê a própria + equipe
    return avaliacoes.filter(a=>a.colaboradorId===user.id);
}
// Talentos visíveis para select de avaliação
function talentosParaAvaliar(){
    if(user?.role==='MASTER')return talentos;
    if(user?.role==='LIDER')return talentos.filter(t=>t.equipe===user.equipe&&t.id!==user.id);
    return []; // RH e COLABORADOR não avaliam
}

// Role label
function roleLabel(r){return{MASTER:'Master',RH:'RH',LIDER:'Líder',COLABORADOR:'Colaborador'}[r]||r;}
function roleBadge(r){return `<span class="role-badge role-${r}">${roleLabel(r)}</span>`;}

const _opEmAndamento = new Set();

// ── ListenerManager ──────────────────────────────────────────────
// Centraliza todos os listeners onSnapshot do app.
// Garante que nunca haja dois listeners ativos para a mesma chave
// e que todos sejam cancelados num único ponto (ex: logout).
const _listeners = {};
function registrarListener(chave, unsub) {
    if (_listeners[chave]) { try { _listeners[chave](); } catch(e) {} }
    _listeners[chave] = unsub;
}
function cancelarListener(chave) {
    if (_listeners[chave]) { try { _listeners[chave](); } catch(e) {} delete _listeners[chave]; }
}
function cancelarTodosListeners() {
    Object.keys(_listeners).forEach(k => { try { _listeners[k](); } catch(e) {} });
    Object.keys(_listeners).forEach(k => delete _listeners[k]);
}

async function guardado(chave, fn) {
    if (_opEmAndamento.has(chave)) return;
    _opEmAndamento.add(chave);
    try {
        await fn();
    } catch(e) {
        console.error('[MIRAE] Erro em operação:', chave, e);
        const cod = e?.code || '';
        const mensagem = cod === 'permission-denied'
            ? 'Sem permissão para esta ação. Recarregue a página e tente novamente.'
            : (cod === 'unavailable' || cod === 'network-request-failed' || cod.includes('network'))
            ? 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
            : cod === 'not-found'
            ? 'Registro não encontrado. Pode ter sido excluído por outro usuário.'
            : (e?.message || 'Erro inesperado. Tente novamente ou recarregue a página.');
        mostrarNotif('', 'Erro', mensagem, '', 7000);
    } finally {
        _opEmAndamento.delete(chave);
    }
}

// Captura qualquer Promise rejeitada sem try/catch (safety net global)
window.addEventListener('unhandledrejection', function(ev) {
    const e = ev.reason;
    if (!e) return;
    const cod = e?.code || '';
    // Ignora erros esperados de navegação e conexão Firebase que já se recuperam
    if (cod === 'cancelled' || cod === 'aborted') return;
    console.error('[MIRAE] Erro não capturado:', e);
    const mensagem = cod === 'permission-denied'
        ? 'Sem permissão para esta ação.'
        : cod === 'unavailable'
        ? 'Servidor temporariamente indisponível. Aguarde e tente novamente.'
        : (e?.message || String(e));
    if (mensagem && mensagem.length < 300) {
        mostrarNotif('', 'Erro inesperado', mensagem, '', 6000);
    }
});

function mostrarNotif(icon, title, msg, tipo='', duracao=5000){
    const banner=document.getElementById('notifBanner');if(!banner)return;
    const el=document.createElement('div');
    el.className=`notif ${tipo}`;
    el.innerHTML=`<div class="notif-icon">${icon}</div><div class="notif-body"><div class="notif-title">${esc(title)}</div><div class="notif-msg">${esc(msg)}</div></div>`;
    el.onclick=()=>el.remove();
    banner.appendChild(el);
    setTimeout(()=>{el.style.animation='slideOut 0.4s ease forwards';setTimeout(()=>el.remove(),400);},duracao);
}
function dispararConfete(){
    const wrapper=document.getElementById('confeteWrapper');if(!wrapper)return;
    wrapper.classList.remove('hidden');
    const cores=['#E1B87F','#1E7D90','#214957','#2E7D32','#E74C3C','#9B59B6','#F39C12'];
    for(let i=0;i<120;i++){
        const p=document.createElement('div');p.className='confete-piece';
        p.style.left=Math.random()*100+'%';
        p.style.background=cores[Math.floor(Math.random()*cores.length)];
        p.style.width=(Math.random()*10+6)+'px';p.style.height=(Math.random()*10+6)+'px';
        p.style.borderRadius=Math.random()>0.5?'50%':'2px';
        p.style.animationDuration=(Math.random()*2+2)+'s';
        p.style.animationDelay=(Math.random()*1.5)+'s';
        wrapper.appendChild(p);
    }
    setTimeout(()=>{wrapper.innerHTML='';wrapper.classList.add('hidden');},5000);
}

const IC={
    check:'<path d="M20 6 9 17l-5-5"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    loop:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    alert:'<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
    clipboard:'<rect x="4" y="4" width="16" height="18" rx="2"/><path d="M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 11h8M8 15h8"/>',
    chart:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M9 16h6v5"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6M21 21v-1a6 6 0 0 0-3-5.2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    nodes:'<circle cx="18" cy="6" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 13.4 6.8 3.2M15.4 7.4 8.6 10.6"/>',
    ban:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6 18.4 18.4"/>',
    rotate:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    award:'<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    money:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
    bus:'<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 4v7M16 4v7"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/>',
    trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 18h6M10 18l.5-3M14 18l-.5-3"/>',
    save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    moon:'<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    sun:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    cone:'<path d="M10.5 4h3l4 16H6.5l4-16z"/><path d="M8.7 11h6.6M7.5 16h9"/>',
    chat:'<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z"/>',
    trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    tasks:'<path d="M4 6.5 6 8.5 9 5"/><path d="M4 13.5 6 15.5 9 12"/><path d="M13 7h7M13 14h7"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 6h14l2 7v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    sun2:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    link:'<path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1M15 12a3 3 0 0 1-3 3H9a3 3 0 0 1 0-6h1"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chair:'<path d="M6 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M5 10h14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3zM7 15v6M17 15v6"/>',
    heart:'<path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z"/>',
    star:'<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3z"/>',
    arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    download:'<path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/>',
    kanban:'<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>',
    share:'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'
};
function ico(name,opts){opts=opts||{};const s=opts.size||16,c=opts.color||'currentColor',w=opts.stroke||1.8;
    return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;flex-shrink:0;display:inline-block;">'+(IC[name]||'')+'</svg>';}
// Selo de ranking discreto (substitui medalhas) — dourado, prata, bronze da marca
function rankBadge(i){const cores=['#C9A05A','#9FB0B5','#B08D57'];const c=cores[i]||'#9CA3AF';
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:'+c+'22;color:'+c+';font-size:0.66rem;font-weight:700;border:1.2px solid '+c+';margin-right:0.25rem;">'+(i+1)+'</span>';}
function reemplazarEmojisEnDOM(){/* removido: emojis agora são limpos direto no código-fonte */}

function temJustificativaValida(t){return !!(t.justificativa&&t.justificativa.trim())&&t.justificativaAceita!==false;}
// Tarefa adiada = transportada de um dia anterior (contador de adiamentos)
function foiAdiada(t){return (t.adiamentos||0)>0;}
// Requisição entre equipes atendida no mesmo dia em que foi pedida
function atendidaMesmoDia(t){
    if(t.status!=='concluida')return false;
    if(t.concluidaEmData)return t.concluidaEmData===t.data;
    return (t.adiamentos||0)===0; // fallback p/ dados antigos sem concluidaEmData
}
function hojeISO(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function diaAnterior(iso){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function fmtDataBR(iso){if(!iso)return'';const[a,m,d]=iso.split('-');return`${d}/${m}/${a}`;}

window.onclick=function(e){
    // Só fecha se clicar diretamente no overlay escuro, não em filhos
    if(e.target.classList.contains('modal') && e.target.id){
        // Não fechar modais de colaborador/avaliação por clique acidental
        const naoFechar = ['modalColab','modalAvaliacao','modalEquipe'];
        if(!naoFechar.includes(e.target.id)) closeModal(e.target.id);
    }
}
