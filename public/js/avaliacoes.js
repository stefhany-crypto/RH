function renderAvaliacoes(){
    const body=document.getElementById('avaliacoesBody');if(!body)return;
    const filtroAno=parseInt(document.getElementById('filtroAvalAno')?.value||0);
    const filtroTri=document.getElementById('filtroAvalTri')?.value||'';
    let filtered=avalsVisiveis();
    if(filtroAno)filtered=filtered.filter(a=>a.ano===filtroAno);
    if(filtroTri)filtered=filtered.filter(a=>String(a.trimestre)===filtroTri);
    body.innerHTML=filtered.sort((a,b)=>b.data-a.data).map(a=>{
        const t=talentos.find(ta=>ta.id===a.colaboradorId)||{nome:'Excluído',equipe:'-'};
        let dh='-';try{const d=a.data.toDate?a.data.toDate():new Date(a.data);dh=d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch(e){}
        const aud=a.avaliadorNome||'Sistema';
        const pdfBtn=`<button class="btn-small" style="background:#E3F2FD;color:#1565C0;max-width:36px;" title="PDF" onclick="baixarPDI('${a.id}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg></button>`;
        const delBtn=P.excluirAvaliacao()?`<button class="btn-small btn-delete" style="max-width:36px;" title="Excluir" onclick="excluirAvaliacao('${a.id}','${jsq(t.nome)}',${a.trimestre},${a.ano})"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg></button>`:'';
        return `<tr><td style="font-size:0.8rem;white-space:nowrap;">${dh}</td><td style="font-weight:700;">${esc(t.nome)}</td><td><span class="badge" style="background:#EEE;">${esc(t.equipe||'-')}</span></td><td style="white-space:nowrap;">Q${a.trimestre}/${a.ano}</td><td><span class="badge ${a.notaFinal>=80?'badge-success':'badge-warning'}">${a.notaFinal.toFixed(1)}</span></td><td style="font-weight:700;color:var(--mirae-teal);">${a.bonusPercent}%</td><td style="font-size:0.78rem;color:var(--text-muted);">${esc(aud)}</td><td style="display:flex;gap:0.3rem;">${pdfBtn}${delBtn}</td></tr>`;
    }).join('');
}

async function excluirAvaliacao(id,nome,tri,ano){
    if(!P.excluirAvaliacao()){mostrarNotif('','Sem permissão','Apenas o Master pode excluir avaliações.','',3000);return;}
    if(!confirm(`Excluir avaliação de ${nome} (Q${tri}/${ano})?\n\nIrreversível.`))return;
    await guardado('excluirAval_'+id, async () => {
        await db.collection('avaliacoes').doc(id).delete();
        refreshData();
        mostrarNotif('','Avaliação excluída','','',3000);
    });
}

async function baixarPDI(avalId){
    const a=avaliacoes.find(av=>av.id===avalId);if(!a){mostrarNotif('','Avaliação não encontrada','Recarregue a página e tente novamente.','',3000);return;}
    const t=talentos.find(ta=>ta.id===a.colaboradorId)||{nome:'Colaborador',equipe:'-',cargo:'-'};
    const {jsPDF}=window.jspdf;const doc=new jsPDF();
    const teal=[30,125,144],dark=[33,73,87],gold=[225,184,127];
    doc.setFillColor(...dark);doc.rect(0,0,210,28,'F');doc.setTextColor(255,255,255);doc.setFontSize(20);doc.setFont('helvetica','bold');doc.text('Mirae',14,18);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text('Sistema de Avaliações PDI 360°',14,24);doc.setFillColor(...gold);doc.circle(195,10,5,'F');
    doc.setTextColor(...dark);doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('Relatório de Avaliação PDI',14,40);
    let dStr='-';try{const d=a.data.toDate?a.data.toDate():new Date(a.data);dStr=d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}catch(e){}
    let y=50;[['Colaborador',t.nome],['Equipe',t.equipe||'-'],['Cargo',t.cargo||'-'],['Período',`Q${a.trimestre}/${a.ano}`],['Data/Hora',dStr],['Registrado por',a.avaliadorNome||'Sistema']].forEach(([k,v])=>{doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(...dark);doc.text(k+':',14,y);doc.setFont('helvetica','normal');doc.setTextColor(60,60,60);doc.text(String(v),55,y);y+=7;});
    y+=4;doc.setFillColor(...teal);doc.roundedRect(14,y,85,20,3,3,'F');doc.setFillColor(...gold);doc.roundedRect(110,y,85,20,3,3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('NOTA FINAL',21,y+8);doc.setFontSize(14);doc.text(a.notaFinal.toFixed(1),21,y+16);doc.setTextColor(...dark);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('BÔNUS ALCANÇADO',117,y+8);doc.setFontSize(14);doc.text(a.bonusPercent+'%',117,y+16);y+=28;
    if(a.desafioDesc||a.desafioNota){doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(...teal);doc.text('Super Desafio',14,y);y+=6;doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(60,60,60);if(a.desafioDesc){const lines=doc.splitTextToSize(a.desafioDesc,180);doc.text(lines,14,y);y+=lines.length*5+2;}doc.text(`Nota do Desafio: ${a.desafioNota||0}`,14,y);y+=8;}
    if(a.scores&&a.scores.length>0){doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(...teal);doc.text('Avaliação de Competências',14,y);y+=6;const vL={0:'Não Atende',25:'Atende Parcialmente',50:'Atende',100:'Supera',110:'Excepcional'};let gi=0;PDI_GROUPS.forEach(g=>{if(y>270){doc.addPage();y=15;}doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(...dark);doc.text(g.n,14,y);y+=5;g.c.forEach(c=>{if(y>275){doc.addPage();y=15;}const sc=a.scores[gi]||0;const col=sc>=100?[46,125,50]:sc>=50?[30,125,144]:sc>=25?[239,108,0]:[198,40,40];doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(60,60,60);const cl=doc.splitTextToSize(`${gi+1}. ${c}`,150);doc.text(cl,16,y);doc.setFont('helvetica','bold');doc.setTextColor(...col);doc.text(`${sc} - ${vL[sc]||sc}`,170,y);y+=cl.length*4+2;gi++;});y+=3;});}
    const pc=doc.internal.getNumberOfPages();for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(150);doc.text(`Mirae PDI 360° — ${new Date().toLocaleDateString('pt-BR')} — Pág. ${i}/${pc}`,14,290);}
    doc.save(`PDI_${t.nome.replace(/\s+/g,'_')}_Q${a.trimestre}_${a.ano}.pdf`);
}

// ========== FORM AVALIAÇÃO ==========
function sincronizarTipoFormulario(){
    const sel=document.getElementById('fEvalColab'),id=sel?sel.value:'',badge=document.getElementById('tipoAvaliacaoBadge');
    if(!id){document.getElementById('evalFormContainer').innerHTML='<p style="color:var(--text-muted);padding:1rem;text-align:center;">Selecione um talento para iniciar.</p>';if(badge){badge.textContent='';badge.className='';}return;}
    const t=talentos.find(ta=>ta.id===id);
    // Verifica permissão
    if(!P.criarAvaliacao(t?.equipe)){alert('Você não tem permissão para avaliar este colaborador.');sel.value='';return;}
    let tipo='ADM';if(t&&t.tipoAvaliacao&&t.tipoAvaliacao.trim())tipo=t.tipoAvaliacao.trim();
    else{const opt=sel.options[sel.selectedIndex];if(opt?.dataset?.tipo&&opt.dataset.tipo!=='undefined')tipo=opt.dataset.tipo;}
    document.getElementById('fEvalForcarLogica').value=tipo;
    if(badge){badge.textContent=tipo.toLowerCase()==='escalas'?'Escalas — KPI':'ADM — PDI + Desafio';badge.className=tipo.toLowerCase()==='escalas'?'escalas':'adm';}
    renderEvalForm();
}
function renderEvalForm(){
    const id=document.getElementById('fEvalColab').value,tri=document.getElementById('fEvalTri').value;
    const logica=document.getElementById('fEvalForcarLogica').value.trim().toLowerCase();
    const container=document.getElementById('evalFormContainer');container.innerHTML='';
    if(!id){container.innerHTML='<p style="color:var(--text-muted);padding:1rem;text-align:center;">Selecione um talento acima.</p>';return;}
    try{
        if(logica==='escalas'){
            let h=`<h4 style="color:var(--mirae-gold);margin-bottom:1rem;">KPI - Q${tri} <small>(70%)</small></h4>`;
            ['Aumento de Horas (50%)','Margem Líquida (30%)','NPS Instituições (10%)','NPS Médicos (10%)'].forEach((label,i)=>{const ids=['kH','kM','kNI','kNM'][i];h+=`<div class="pdi-item"><label style="font-weight:700;">${label}</label><input type="number" class="kpi" id="${ids}" value="50" style="margin-top:0.5rem;width:100%;padding:0.8rem;border:1.5px solid #E0E0E0;border-radius:10px;" oninput="calcKPI()"></div>`;});
            h+=`<h4 style="color:var(--mirae-teal);margin:1.5rem 0 1rem 0;">PDI <small>(30%)</small></h4>`;
            let idx=0;h+=PDI_GROUPS.map(g=>`<div class="pdi-grupo"><div class="pdi-grupo-title">${g.n}</div>${g.c.map(c=>{const rid=idx++;return `<div class="pdi-item"><div style="font-size:0.88rem;font-weight:600;margin-bottom:0.5rem;">${rid+1}. ${c}</div><div class="rating-group" id="rg${rid}"><button type="button" class="rating-btn" onclick="setR(${rid},0,'Não Atende')">0</button><button type="button" class="rating-btn" onclick="setR(${rid},25,'Atende Parcialmente')">25</button><button type="button" class="rating-btn selected" onclick="setR(${rid},50,'Atende')">50</button><button type="button" class="rating-btn" onclick="setR(${rid},100,'Supera')">100</button><button type="button" class="rating-btn" onclick="setR(${rid},110,'Excepcional')">110</button></div><span class="rating-legend" id="rl${rid}">Atende</span><input type="hidden" class="pdi-val" id="rv${rid}" value="50"></div>`;}).join('')}</div>`).join('');
            container.innerHTML=h;calcKPI();
        }else{
            let h=`<h4 style="color:var(--mirae-teal);margin-bottom:1rem;">Super Desafio - Q${tri} <small>(30%)</small></h4>`;
            h+=`<div class="pdi-item"><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Descrição</label><textarea rows="2" class="d-desc" style="width:100%;padding:0.8rem;border:1.5px solid #E0E0E0;border-radius:10px;margin-bottom:0.8rem;"></textarea><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Nota (0–100)</label><input type="number" class="d-nota" min="0" max="100" value="50" style="width:100%;padding:0.8rem;border:1.5px solid #E0E0E0;border-radius:10px;" oninput="calcADM()"></div>`;
            h+=`<h4 style="color:var(--mirae-teal);margin:1.5rem 0 1rem 0;">PDI <small>(70%)</small></h4>`;
            let idx=0;h+=PDI_GROUPS.map(g=>`<div class="pdi-grupo"><div class="pdi-grupo-title">${g.n}</div>${g.c.map(c=>{const rid=idx++;return `<div class="pdi-item"><div style="font-size:0.88rem;font-weight:600;margin-bottom:0.5rem;">${rid+1}. ${c}</div><div class="rating-group" id="rg${rid}"><button type="button" class="rating-btn" onclick="setR(${rid},0,'Não Atende')">0</button><button type="button" class="rating-btn" onclick="setR(${rid},25,'Atende Parcialmente')">25</button><button type="button" class="rating-btn selected" onclick="setR(${rid},50,'Atende')">50</button><button type="button" class="rating-btn" onclick="setR(${rid},100,'Supera')">100</button><button type="button" class="rating-btn" onclick="setR(${rid},110,'Excepcional')">110</button></div><span class="rating-legend" id="rl${rid}">Atende</span><input type="hidden" class="pdi-val" id="rv${rid}" value="50"></div>`;}).join('')}</div>`).join('');
            container.innerHTML=h;calcADM();
        }
    }catch(err){console.error(err);container.innerHTML='<p style="color:red;padding:1rem;">Erro ao carregar formulário.</p>';}
}
function setR(id,v,text){const h=document.getElementById(`rv${id}`),l=document.getElementById(`rl${id}`);if(h)h.value=v;if(l)l.textContent=text;const bg=document.getElementById(`rg${id}`);if(bg)bg.querySelectorAll('button').forEach(b=>{b.classList.remove('selected');if(b.textContent===String(v))b.classList.add('selected');});const logica=document.getElementById('fEvalForcarLogica').value.trim().toLowerCase();if(logica==='escalas')calcKPI();else calcADM();}
function calcADM(){const nd=parseFloat(document.querySelector('.d-nota')?.value||0);let sp=0,cp=0;document.querySelectorAll('.pdi-val').forEach(v=>{sp+=parseFloat(v.value);cp++;});showRes((nd*0.3)+((cp>0?(sp/(cp*110))*100:0)*0.7));}
function calcKPI(){const h=parseFloat(document.getElementById('kH')?.value||0),m=parseFloat(document.getElementById('kM')?.value||0),ni=parseFloat(document.getElementById('kNI')?.value||0),nm=parseFloat(document.getElementById('kNM')?.value||0);const sk=(h*0.5)+(m*0.3)+(ni*0.1)+(nm*0.1);let sp=0,cp=0;document.querySelectorAll('.pdi-val').forEach(v=>{sp+=parseFloat(v.value);cp++;});showRes((sk*0.7)+((cp>0?(sp/(cp*110))*100:0)*0.3));}
function showRes(n){const rn=document.getElementById('resNota'),rb=document.getElementById('resBonus');if(rn)rn.textContent=n.toFixed(1);let b=0;if(n>=80)b=100;else if(n>=70)b=75;else if(n>=60)b=50;if(rb)rb.textContent=b+'%';}

async function saveAvaliacao(e){
    e.preventDefault();const cid=document.getElementById('fEvalColab').value;if(!cid){alert("Selecione um talento.");return;}
    const t=talentos.find(x=>x.id===cid);
    if(!P.criarAvaliacao(t?.equipe)){alert('Você não tem permissão para avaliar este colaborador.');return;}
    const trimestre=parseInt(document.getElementById('fEvalTri').value),ano=parseInt(document.getElementById('fEvalAno').value);
    if(isNaN(ano)||ano<2020||ano>2030){alert('Ano inválido. Use um ano entre 2020 e 2030.');return;}
    const docId=`${cid}_${ano}_Q${trimestre}`;
    const existente=avaliacoes.find(a=>a.colaboradorId===cid&&parseInt(a.trimestre)===trimestre&&a.ano===ano);
    if(existente){if(!confirm(`Já existe avaliação de ${t?.nome} para Q${trimestre}/${ano}.\nSubstituir?`))return;}
    const sc=[];document.querySelectorAll('.pdi-val').forEach(i=>sc.push(parseInt(i.value||0)));
    const agora=new Date();
    await guardado('saveAvaliacao_'+docId, async () => {
        const batch=db.batch();
        // Remove doc antigo se o ID mudou (trimestre/ano foram alterados)
        if(existente&&existente.id!==docId)batch.delete(db.collection('avaliacoes').doc(existente.id));
        batch.set(db.collection('avaliacoes').doc(docId),{colaboradorId:cid,equipe:t?.equipe||'',trimestre,ano,notaFinal:parseFloat(document.getElementById('resNota').textContent),bonusPercent:parseInt(document.getElementById('resBonus').textContent),scores:sc,desafioDesc:document.querySelector('.d-desc')?.value||'',desafioNota:parseFloat(document.querySelector('.d-nota')?.value||0),data:agora,avaliadorId:user.id,avaliadorNome:user.nome,avaliadorEmail:user.email,dataHoraRegistro:agora.toLocaleString('pt-BR')});
        await batch.commit();
        closeModal('modalAvaliacao');refreshData();
        mostrarNotif('','Avaliação salva',`Q${trimestre}/${ano} de ${t?.nome||'colaborador'} registrada.`,'',3000);
    });
}

function closeModal(id){document.getElementById(id).style.display='none';}
function openModalAvaliacao(){
    if(!['MASTER','LIDER'].includes(user?.role)){alert('Sem permissão.');return;}
    document.getElementById('modalAvaliacao').style.display='block';
    document.getElementById('evalFormContainer').innerHTML='<p style="color:var(--text-muted);padding:1rem;text-align:center;">Selecione um talento acima.</p>';
    const badge=document.getElementById('tipoAvaliacaoBadge');if(badge){badge.textContent='';badge.className='';}
}
function openEvalFor(id){
    const t=talentos.find(ta=>ta.id===id);
    if(!P.criarAvaliacao(t?.equipe))return;
    openModalAvaliacao();
    setTimeout(()=>{
        const sel=document.getElementById('fEvalColab');if(!sel)return;
        sel.value=id;
        const tipo=(t&&t.tipoAvaliacao&&t.tipoAvaliacao.trim())?t.tipoAvaliacao.trim():'ADM';
        document.getElementById('fEvalForcarLogica').value=tipo;
        const badge=document.getElementById('tipoAvaliacaoBadge');
        if(badge){badge.textContent=tipo.toLowerCase()==='escalas'?'Escalas — KPI':'ADM — PDI + Desafio';badge.className=tipo.toLowerCase()==='escalas'?'escalas':'adm';}
        renderEvalForm();
    },150);
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    excluirAvaliacao, baixarPDI, sincronizarTipoFormulario,
    renderEvalForm, setR, calcADM, calcKPI, showRes,
    saveAvaliacao, closeModal, openModalAvaliacao, openEvalFor,
    renderAvaliacoes,
});
