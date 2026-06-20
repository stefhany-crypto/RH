// ================================================================
// MIRAE — Trabalhe Conosco — Painel RH/Master
// ================================================================

// Cole aqui a URL gerada ao implantar o Apps Script
const TC_SCRIPT_URL  = 'COLE_AQUI_A_URL_DO_APPS_SCRIPT';
const TC_TOKEN       = 'MIRAE_VAGAS_2026';

let _tcVagas     = [];
let _tcCandidatos= [];
let _tcAbaAtiva  = 'candidatos'; // 'vagas' | 'candidatos'

// ── ENTRY POINT ─────────────────────────────────────────────
async function renderTrabalheConosco() {
    const el = document.getElementById('tabTrabalheConosco');
    if (!el) return;
    el.innerHTML = `
    <div style="margin-bottom:1.5rem;">
      <div style="font-size:1.05rem;font-weight:700;color:var(--dark);margin-bottom:.3rem;">Trabalhe Conosco</div>
      <div style="color:var(--muted);font-size:.85rem;">Gerencie vagas e acompanhe candidatos.</div>
    </div>
    <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;border-bottom:1.5px solid var(--border);padding-bottom:.8rem;">
      <button onclick="tcAba('candidatos')" id="tcBtnCand" style="${_tcTabStyle(true)}">Candidatos</button>
      <button onclick="tcAba('vagas')" id="tcBtnVagas" style="${_tcTabStyle(false)}">Vagas</button>
      <div style="margin-left:auto;">
        <span style="display:inline-block;background:rgba(2,59,72,.06);padding:.35rem .8rem;border-radius:6px;font-size:.78rem;color:var(--muted);">
          Link público:
          <a href="/vagas.html" target="_blank" style="color:var(--teal);font-weight:600;text-decoration:none;">/vagas</a>
        </span>
      </div>
    </div>
    <div id="tcConteudo"><div class="tc-loading">Carregando...</div></div>`;

    tcAba(_tcAbaAtiva);
}

function _tcTabStyle(ativo) {
    return ativo
        ? 'background:var(--dark);color:#fff;border:none;padding:.45rem 1.1rem;border-radius:8px;font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;'
        : 'background:transparent;color:var(--muted);border:1.5px solid var(--border);padding:.45rem 1.1rem;border-radius:8px;font-family:inherit;font-size:.88rem;cursor:pointer;';
}

function tcAba(aba) {
    _tcAbaAtiva = aba;
    const bCand = document.getElementById('tcBtnCand');
    const bVaga = document.getElementById('tcBtnVagas');
    if (bCand) bCand.style.cssText = _tcTabStyle(aba === 'candidatos');
    if (bVaga) bVaga.style.cssText = _tcTabStyle(aba === 'vagas');
    if (aba === 'candidatos') tcCarregarCandidatos();
    else tcCarregarVagas();
}

// ── ABA CANDIDATOS ───────────────────────────────────────────
async function tcCarregarCandidatos() {
    const el = document.getElementById('tcConteudo');
    el.innerHTML = '<div class="tc-loading">Buscando candidatos...</div>';
    try {
        const r = await fetch(`${TC_SCRIPT_URL}?action=candidatos&token=${TC_TOKEN}`);
        _tcCandidatos = await r.json();
        if (_tcCandidatos.erro) throw new Error(_tcCandidatos.erro);
        tcRenderCandidatos();
    } catch (e) {
        el.innerHTML = `<div class="card" style="color:#c62828;">Erro ao carregar candidatos: ${e.message}</div>`;
    }
}

function tcRenderCandidatos(filtroVaga = '', filtroStatus = '') {
    const el = document.getElementById('tcConteudo');
    const vagasOpts = [...new Set(_tcCandidatos.map(c => c.vagaTitulo).filter(Boolean))];
    const statusOpts = ['Novo','Banco de talentos','Inadequado','Entrevista','Aprovado','Reprovado'];

    let lista = _tcCandidatos;
    if (filtroVaga)   lista = lista.filter(c => c.vagaTitulo === filtroVaga);
    if (filtroStatus) lista = lista.filter(c => c.status === filtroStatus);
    lista = [...lista].sort((a,b) => new Date(b.submissaoEm) - new Date(a.submissaoEm));

    const _cor = n => n >= 80 ? '#2e7d32' : n >= 65 ? '#e65100' : '#c62828';
    const _sugestaoStyle = s => {
        if(s==='Entrevista') return 'background:#e8f5e9;color:#2e7d32;';
        if(s==='Inadequado') return 'background:#ffebee;color:#c62828;';
        if(s==='Avaliar com cautela') return 'background:#fff8e1;color:#f57f17;';
        return 'background:#e3f2fd;color:#1565c0;';
    };

    el.innerHTML = `
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.2rem;align-items:center;">
      <select onchange="tcRenderCandidatos(this.value,document.getElementById('tcFiltroStatus').value)" style="${_tcSelectStyle()}">
        <option value="">Todas as vagas</option>
        ${vagasOpts.map(v=>`<option ${filtroVaga===v?'selected':''}>${v}</option>`).join('')}
      </select>
      <select id="tcFiltroStatus" onchange="tcRenderCandidatos(document.querySelector('[onchange*=tcFiltroStatus]').value,this.value)" style="${_tcSelectStyle()}">
        <option value="">Todos os status</option>
        ${statusOpts.map(s=>`<option ${filtroStatus===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <span style="margin-left:auto;font-size:.8rem;color:var(--muted);">${lista.length} candidato${lista.length!==1?'s':''}</span>
    </div>
    ${!lista.length ? '<div style="text-align:center;padding:2rem;color:var(--muted);">Nenhum candidato encontrado.</div>' :
    lista.map(c => {
        const nota = parseFloat(c.notaFinal)||0;
        const alertas = (() => { try { return JSON.parse(c.alertas||'[]'); } catch{ return []; } })();
        return `
        <div class="card" style="margin-bottom:.8rem;cursor:pointer;" onclick="tcVerCandidato('${c.id}')">
          <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <div style="font-weight:700;color:var(--dark);margin-bottom:.2rem;">${c.nome||'—'}</div>
              <div style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem;">${c.vagaTitulo||'Sem vaga'} · ${c.telefone||''}</div>
              <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
                <span style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;font-weight:600;${_sugestaoStyle(c.sugestao)}">${c.sugestao||'—'}</span>
                <span style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;background:rgba(2,59,72,.07);color:var(--dark);">${c.status||'Novo'}</span>
                ${c.analisadoPorIA==='sim'?'<span style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;background:#f3e5f5;color:#6a1b9a;">IA</span>':''}
                ${alertas.length?`<span style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;background:#fff3e0;color:#e65100;">${alertas.length} alerta${alertas.length>1?'s':''}</span>`:''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:1.6rem;font-weight:800;color:${_cor(nota)};">${Math.round(nota)}%</div>
              <div style="font-size:.7rem;color:var(--muted);">nota final</div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem;">${c.discPerfil||''}</div>
            </div>
          </div>
        </div>`; }).join('')}`;
}

// ── DETALHE CANDIDATO ────────────────────────────────────────
async function tcVerCandidato(id) {
    const el = document.getElementById('tcConteudo');
    el.innerHTML = '<div class="tc-loading">Carregando candidato...</div>';

    let c = _tcCandidatos.find(x => x.id === id);
    if (!c) {
        try {
            const r = await fetch(`${TC_SCRIPT_URL}?action=candidato&id=${id}&token=${TC_TOKEN}`);
            c = await r.json();
        } catch (e) { el.innerHTML = '<div class="card">Erro ao carregar candidato.</div>'; return; }
    }

    const comp = (() => { try { return JSON.parse(c.competencias||'{}'); } catch { return {}; } })();
    const alertas = (() => { try { return JSON.parse(c.alertas||'[]'); } catch { return []; } })();
    const analise = c.analiseGemini || '';
    const statusOpts = ['Novo','Banco de talentos','Inadequado','Entrevista','Aprovado','Reprovado'];

    const _bar = (v,cor='var(--teal)') => `
      <div style="display:flex;align-items:center;gap:.6rem;">
        <div style="flex:1;background:var(--border);border-radius:4px;height:6px;">
          <div style="width:${Math.min(100,v||0)}%;background:${cor};border-radius:4px;height:6px;"></div>
        </div>
        <span style="font-size:.78rem;font-weight:700;min-width:32px;color:var(--text);">${Math.round(v||0)}%</span>
      </div>`;

    const _disc = (label, val, cor) => `
      <div style="margin-bottom:.5rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:.8rem;color:var(--muted);">${label}</span>
        </div>
        ${_bar(val, cor)}
      </div>`;

    const _nota = n => n >= 80 ? '#2e7d32' : n >= 65 ? '#e65100' : '#c62828';

    el.innerHTML = `
    <button onclick="tcAba('candidatos')" style="background:transparent;border:none;color:var(--teal);font-family:inherit;font-size:.85rem;cursor:pointer;margin-bottom:1.2rem;display:flex;align-items:center;gap:.3rem;">
      ${ico('arrow-left',{size:14})} Voltar à lista
    </button>

    <!-- cabeçalho -->
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1rem;">
        <div style="flex:1;">
          <div style="font-size:1.1rem;font-weight:700;color:var(--dark);margin-bottom:.2rem;">${c.nome}</div>
          <div style="font-size:.83rem;color:var(--muted);">${c.vagaTitulo||'Sem vaga'} · ${c.telefone} · ${c.submissaoEm?new Date(c.submissaoEm).toLocaleDateString('pt-BR'):''}</div>
          ${c.linkedin?`<a href="${c.linkedin}" target="_blank" style="font-size:.8rem;color:var(--teal);">${c.linkedin}</a>`:''}
        </div>
        <div style="text-align:center;background:var(--cream);padding:.8rem 1.2rem;border-radius:12px;">
          <div style="font-size:2rem;font-weight:800;color:${_nota(c.notaFinal)};">${Math.round(c.notaFinal||0)}%</div>
          <div style="font-size:.7rem;color:var(--muted);">nota final</div>
        </div>
      </div>

      <!-- status manual -->
      <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;">
        <span style="font-size:.8rem;font-weight:600;color:var(--dark);">Status:</span>
        <select id="tcStatusSel" onchange="tcAtualizarStatus('${c.id}',this.value)" style="${_tcSelectStyle()}">
          ${statusOpts.map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        ${c.analisadoPorIA==='sim'
            ? '<span style="font-size:.75rem;padding:.3rem .7rem;border-radius:6px;background:#f3e5f5;color:#6a1b9a;font-weight:600;">Analisado pela IA</span>'
            : `<button onclick="tcAnalisarGemini('${c.id}')" id="btnGemini${c.id}" style="background:var(--dark);color:#fff;border:none;padding:.45rem 1rem;border-radius:8px;font-family:inherit;font-size:.83rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:.4rem;">${ico('star',{size:14})} Analisar com IA</button>`}
      </div>
    </div>

    <!-- linha de scores -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-bottom:1rem;">
      ${[['Fit Cultural',c.fitCultural],['Fit Vaga',c.fitVaga],['Competências',c.notaCompetencias],['Confiabilidade',c.confiabilidade]].map(([l,v])=>`
      <div class="card" style="text-align:center;padding:.9rem;">
        <div style="font-size:1.4rem;font-weight:800;color:${_nota(v)};">${Math.round(v||0)}%</div>
        <div style="font-size:.72rem;color:var(--muted);">${l}</div>
      </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <!-- DISC -->
      <div class="card">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.8rem;">DISC — ${c.discPerfil||'—'}</div>
        ${_disc('Executor (D)',c.discD,'#023B48')}
        ${_disc('Comunicador (I)',c.discI,'#3F8A6E')}
        ${_disc('Planejador (S)',c.discS,'#DAB47E')}
        ${_disc('Analista (C)',c.discC,'#61757B')}
      </div>
      <!-- Eneagrama -->
      <div class="card">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.8rem;">Eneagrama</div>
        <div style="margin-bottom:.5rem;"><span style="font-size:2rem;font-weight:300;font-family:'Newsreader',serif;color:var(--dark);">${c.eneagramaPrincipal||'—'}</span><span style="color:var(--muted);font-size:.85rem;"> tipo</span></div>
        <div style="font-size:.85rem;color:var(--dark);font-weight:600;margin-bottom:.3rem;">Asa: ${c.eneagramaAsa||'—'}</div>
        <div style="font-size:.8rem;color:var(--muted);">Segunda hipótese: ${c.eneagramaSegunda||'—'}</div>
        <div style="font-size:.8rem;color:var(--muted);">Confiança: ${c.eneagramaConfianca||'—'}</div>
      </div>
    </div>

    <!-- Competências -->
    <div class="card" style="margin-bottom:1rem;">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.8rem;">Competências</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1.5rem;">
        ${Object.entries(comp).sort(([,a],[,b])=>b-a).map(([k,v])=>`
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-size:.78rem;color:var(--muted);">${k}</span></div>
          ${_bar(v, v>=80?'var(--teal)':v>=60?'var(--gold2)':'#e57373')}
        </div>`).join('')}
      </div>
    </div>

    <!-- Alertas -->
    ${alertas.length ? `
    <div class="card" style="margin-bottom:1rem;border-color:#ffcc80;">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#e65100;margin-bottom:.7rem;">Alertas</div>
      ${alertas.map(a=>`<div style="font-size:.85rem;color:#e65100;margin-bottom:.3rem;">• ${a}</div>`).join('')}
    </div>` : ''}

    <!-- Respostas pessoais -->
    <div class="card" style="margin-bottom:1rem;">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.8rem;">Dados do candidato</div>
      ${[
        ['Conhece a cultura', c.conheceCultura],
        ['Como soube da vaga', c.comoSoube],
        ['Comunidade / Igreja / Associação', c.comunidade||'Não informado'],
      ].map(([l,v])=>`<div style="margin-bottom:.6rem;"><span style="font-size:.78rem;color:var(--muted);">${l}:</span><br><span style="font-size:.88rem;color:var(--text);">${v}</span></div>`).join('')}
      <div style="margin-bottom:.6rem;"><span style="font-size:.78rem;color:var(--muted);">Experiência profissional:</span><br><span style="font-size:.88rem;color:var(--text);white-space:pre-wrap;">${c.experiencia||'—'}</span></div>
    </div>

    <!-- Análise IA -->
    ${analise ? `
    <div class="card" style="margin-bottom:1rem;border-color:#ce93d8;" id="tcAnaliseIA">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6a1b9a;margin-bottom:.8rem;">Análise — Gemini IA</div>
      <div style="font-size:.88rem;line-height:1.7;white-space:pre-wrap;">${analise}</div>
    </div>` : ''}
    <div id="tcGeminiResult"></div>`;
}

// ── AÇÕES ────────────────────────────────────────────────────
async function tcAtualizarStatus(id, status) {
    try {
        await fetch(`${TC_SCRIPT_URL}?action=status&id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}&token=${TC_TOKEN}`);
        const c = _tcCandidatos.find(x => x.id === id);
        if (c) c.status = status;
    } catch (e) { alert('Erro ao atualizar status.'); }
}

async function tcAnalisarGemini(id) {
    const btn = document.getElementById(`btnGemini${id}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Analisando... pode levar alguns segundos'; }
    const res = document.getElementById('tcGeminiResult');
    try {
        const r = await fetch(`${TC_SCRIPT_URL}?action=gemini&id=${encodeURIComponent(id)}&token=${TC_TOKEN}`);
        const data = await r.json();
        if (data.erro) throw new Error(data.erro);
        const c = _tcCandidatos.find(x => x.id === id);
        if (c) { c.analisadoPorIA = 'sim'; c.analiseGemini = data.analise; }
        if (res) res.innerHTML = `
          <div class="card" style="border-color:#ce93d8;">
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6a1b9a;margin-bottom:.8rem;">Análise — Gemini IA</div>
            <div style="font-size:.88rem;line-height:1.7;white-space:pre-wrap;">${data.analise}</div>
          </div>`;
        if (btn) btn.style.display = 'none';
    } catch (e) {
        if (res) res.innerHTML = `<div class="card" style="color:#c62828;">Erro: ${e.message}</div>`;
        if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    }
}

// ── ABA VAGAS ────────────────────────────────────────────────
async function tcCarregarVagas() {
    const el = document.getElementById('tcConteudo');
    el.innerHTML = '<div class="tc-loading">Carregando vagas...</div>';
    try {
        const r = await fetch(`${TC_SCRIPT_URL}?action=vagas&todas=1&token=${TC_TOKEN}`);
        _tcVagas = await r.json();
        if (_tcVagas.erro) throw new Error(_tcVagas.erro);
        tcRenderVagas();
    } catch (e) {
        el.innerHTML = `<div class="card" style="color:#c62828;">Erro: ${e.message}</div>`;
    }
}

function tcRenderVagas() {
    const el = document.getElementById('tcConteudo');
    el.innerHTML = `
    <button onclick="tcNovaVaga()" style="background:var(--dark);color:#fff;border:none;padding:.55rem 1.2rem;border-radius:8px;font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;margin-bottom:1.2rem;display:flex;align-items:center;gap:.4rem;">
      ${ico('plus',{size:14})} Nova vaga
    </button>
    <div id="tcVagasForm" class="hidden"></div>
    ${!_tcVagas.length ? '<div style="text-align:center;padding:2rem;color:var(--muted);">Nenhuma vaga cadastrada ainda.</div>' :
    _tcVagas.map(v => `
      <div class="card" style="margin-bottom:.8rem;opacity:${v.ativo=='true'||v.ativo===true?1:.55};">
        <div style="display:flex;gap:1rem;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--teal);margin-bottom:.2rem;">${v.area||'—'}</div>
            <div style="font-weight:700;color:var(--dark);margin-bottom:.3rem;">${v.titulo}</div>
            <div style="font-size:.83rem;color:var(--muted);margin-bottom:.5rem;">${(v.descricao||'').substring(0,120)}${v.descricao?.length>120?'…':''}</div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
              <span style="font-size:.72rem;padding:.2rem .55rem;border-radius:5px;background:${v.ativo=='true'||v.ativo===true?'#e8f5e9':'#ffebee'};color:${v.ativo=='true'||v.ativo===true?'#2e7d32':'#c62828'};">${v.ativo=='true'||v.ativo===true?'Ativa':'Inativa'}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.4rem;">
            <button onclick="tcEditarVaga('${v.id}')" style="${_tcBtnStyle()}">Editar</button>
            <button onclick="tcToggleVaga('${v.id}',${!(v.ativo=='true'||v.ativo===true)})" style="${_tcBtnStyle(v.ativo=='true'||v.ativo===true?'#e65100':'#2e7d32')}">${v.ativo=='true'||v.ativo===true?'Desativar':'Ativar'}</button>
          </div>
        </div>
      </div>`).join('')}`;
}

function _tcBtnStyle(cor='var(--dark)') {
    return `background:${cor};color:#fff;border:none;padding:.35rem .8rem;border-radius:6px;font-family:inherit;font-size:.78rem;cursor:pointer;white-space:nowrap;`;
}

function tcNovaVaga() { tcMostrarFormVaga(null); }
function tcEditarVaga(id) { tcMostrarFormVaga(_tcVagas.find(v=>v.id===id)||null); }

function tcMostrarFormVaga(v) {
    const el = document.getElementById('tcVagasForm');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = `
    <div class="card" style="margin-bottom:1rem;border-color:var(--gold);">
      <div style="font-size:.8rem;font-weight:700;color:var(--dark);margin-bottom:1rem;">${v?'Editar vaga':'Nova vaga'}</div>
      <input type="hidden" id="vfId" value="${v?.id||''}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem;">
        <div><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Título *</label><input id="vfTitulo" value="${v?.titulo||''}" style="${_tcInputStyle()}" placeholder="Ex: Analista Financeiro PJ"></div>
        <div><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Área *</label><input id="vfArea" value="${v?.area||''}" style="${_tcInputStyle()}" placeholder="Ex: Financeiro"></div>
      </div>
      <div style="margin-bottom:.8rem;"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Descrição da vaga</label><textarea id="vfDesc" style="${_tcInputStyle()}min-height:80px;resize:vertical;">${v?.descricao||''}</textarea></div>
      <div style="margin-bottom:.8rem;"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Perfil desejado</label><textarea id="vfPerfil" style="${_tcInputStyle()}min-height:60px;resize:vertical;">${v?.perfilDesejado||''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem;">
        <div><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Competências obrigatórias</label><input id="vfCompObr" value="${v?.competenciasObrigatorias||''}" style="${_tcInputStyle()}" placeholder="Análise, Organização, Planejamento"></div>
        <div><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Competências desejáveis</label><input id="vfCompDes" value="${v?.competenciasDesejaveis||''}" style="${_tcInputStyle()}" placeholder="Comunicação, Liderança"></div>
      </div>
      <div style="font-size:.75rem;font-weight:600;color:var(--muted);margin-bottom:.5rem;">Perfil DISC desejado (% por fator, soma = 100)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem;">
        ${['D','I','S','C'].map(l=>`<div><label style="font-size:.72rem;display:block;margin-bottom:.25rem;">Executor (${l})</label><input id="vfDisc${l}" type="number" min="0" max="100" value="${v?.['disc'+l]||''}" style="${_tcInputStyle()}" placeholder="—"></div>`).join('')}
      </div>
      <div style="margin-bottom:1rem;"><label style="font-size:.75rem;font-weight:600;display:block;margin-bottom:.3rem;">Eneagramas favoráveis (números separados por vírgula)</label><input id="vfEnea" value="${v?.eneagramas||''}" style="${_tcInputStyle()}" placeholder="Ex: 1, 5, 6"></div>
      <div style="display:flex;gap:.6rem;">
        <button onclick="tcSalvarVaga()" style="${_tcBtnStyle()}">Salvar vaga</button>
        <button onclick="document.getElementById('tcVagasForm').classList.add('hidden')" style="background:transparent;border:1.5px solid var(--border);color:var(--muted);padding:.45rem 1rem;border-radius:8px;font-family:inherit;cursor:pointer;">Cancelar</button>
      </div>
    </div>`;
    el.scrollIntoView({ behavior: 'smooth' });
}

function _tcInputStyle() {
    return 'width:100%;padding:.55rem .8rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.88rem;background:var(--cream);';
}
function _tcSelectStyle() {
    return 'padding:.45rem .8rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.83rem;background:var(--cream);';
}

async function tcSalvarVaga() {
    const titulo = document.getElementById('vfTitulo').value.trim();
    const area   = document.getElementById('vfArea').value.trim();
    if (!titulo || !area) { alert('Preencha título e área.'); return; }
    const payload = {
        action: 'vaga', token: TC_TOKEN,
        id:    document.getElementById('vfId').value.trim()||undefined,
        titulo, area,
        descricao:               document.getElementById('vfDesc').value.trim(),
        perfilDesejado:          document.getElementById('vfPerfil').value.trim(),
        competenciasObrigatorias:document.getElementById('vfCompObr').value.trim(),
        competenciasDesejaveis:  document.getElementById('vfCompDes').value.trim(),
        discD: document.getElementById('vfDiscD').value||'',
        discI: document.getElementById('vfDiscI').value||'',
        discS: document.getElementById('vfDiscS').value||'',
        discC: document.getElementById('vfDiscC').value||'',
        eneagramas: document.getElementById('vfEnea').value.trim(),
        criadoPor: user?.nome||user?.email||'',
    };
    try {
        await fetch(TC_SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
        await new Promise(r=>setTimeout(r,1500));
        tcCarregarVagas();
    } catch (e) { alert('Erro ao salvar vaga.'); }
}

async function tcToggleVaga(id, ativo) {
    try {
        await fetch(`${TC_SCRIPT_URL}?action=toggleVaga&id=${encodeURIComponent(id)}&ativo=${ativo}&token=${TC_TOKEN}`);
        const v = _tcVagas.find(x=>x.id===id);
        if(v) v.ativo = ativo;
        tcRenderVagas();
    } catch (e) { alert('Erro ao alterar vaga.'); }
}

Object.assign(window, {
    renderTrabalheConosco, tcAba, tcVerCandidato,
    tcAtualizarStatus, tcAnalisarGemini,
    tcRenderCandidatos, tcCarregarCandidatos, tcCarregarVagas, tcRenderVagas,
    tcNovaVaga, tcEditarVaga, tcSalvarVaga, tcToggleVaga, tcMostrarFormVaga,
});
