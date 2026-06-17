async function verificarDevolutivasLocais(){
    let protocolos=[];try{protocolos=JSON.parse(localStorage.getItem('mirae_protocolos')||'[]');}catch(e){protocolos=[];}
    if(!protocolos.length) return;
    for(const p of protocolos){
        const chave = 'devolutiva_vista_'+p.protocolo;
        if(localStorage.getItem(chave)) continue;
        let dSnap=null;
        try{dSnap = await db.collection('denunciasStatus').doc(p.protocolo).get();}catch(e){continue;}
        if(!dSnap.exists) continue;
        const d = dSnap.data();
        if(d.devolutiva){
            localStorage.setItem(chave,'1');
            setTimeout(()=>{
                mostrarNotif('','Devolutiva recebida',`Sua denúncia (${p.protocolo}) recebeu uma resposta. Consulte pelo código.`,'bonus',8000);
            },1500);
        }
    }
}

function mesaCancelarSelecao(){
    mesaSelecionada = null;
    document.getElementById('mesaFormReserva').style.display='none';
    document.getElementById('mesaInfoSelecionada').style.display='block';
    document.getElementById('mesaInfoSelecionada').textContent='Clique em uma mesa na planta para reservar';
    renderMesaSVG(window._reservasDia||{});
}

function setSala(n){
    mesaSalaAtiva = n;
    mesaSelecionada = null;
    ['btnSala1','btnSala2'].forEach((id,i)=>{
        const btn=document.getElementById(id);
        if(!btn)return;
        btn.style.background = (i+1)===n?'var(--teal)':'transparent';
        btn.style.color = (i+1)===n?'white':'var(--muted)';
    });
    const nomeEl=document.getElementById('mesaSalaNome');
    if(nomeEl)nomeEl.textContent=SALAS[n].nome;
    window._reservasDia={};
    mesaCancelarSelecao();
    renderMesas();
}

function _mesaDataAtiva(){
    const sel=document.getElementById('mesaDataFiltro');
    return (sel&&sel.value)?sel.value:new Date().toISOString().slice(0,10);
}

function renderMesaSVG(reservasDia){
    const wrapper=document.getElementById('mesaSVGWrapper');
    if(!wrapper)return;
    const sala=SALAS[mesaSalaAtiva];
    const vw=sala.vw||280, vh=sala.vh||300;

    let s='';
    // Fundo da sala
    s+=`<rect x="8" y="8" width="${vw-16}" height="${vh-16}" rx="6" fill="#E8EDEA" stroke="#8A9EA8" stroke-width="2.5"/>`;
    // Janela/parede direita topo (só salas com janela)
    if(!sala.semJanela) s+=`<rect x="${vw-50}" y="8" width="42" height="7" fill="#7EC8E3" opacity="0.7"/>`;
    // Mesa de reunião central (Sala de Reunião)
    if(sala.mesaCentral){
        const mc=sala.mesaCentral;
        s+=`<rect x="${mc.x}" y="${mc.y}" width="${mc.w}" height="${mc.h}" rx="10" fill="#DCE3E0" stroke="#9DADB5" stroke-width="1.5"/>`;
        s+=`<text x="${mc.x+mc.w/2}" y="${mc.y+mc.h/2}" text-anchor="middle" font-size="9" fill="#8A9EA8" font-family="DM Sans,sans-serif" font-weight="600">Mesa de</text>`;
        s+=`<text x="${mc.x+mc.w/2}" y="${mc.y+mc.h/2+12}" text-anchor="middle" font-size="9" fill="#8A9EA8" font-family="DM Sans,sans-serif" font-weight="600">Reunião</text>`;
    }
    // Label da entrada (decorativo)
    s+=`<text x="${vw/2}" y="${vh-4}" text-anchor="middle" font-size="8" fill="#8A9EA8" font-family="DM Sans,sans-serif">ENTRADA</text>`;
    s+=`<line x1="${vw/2-25}" y1="${vh-10}" x2="${vw/2+25}" y2="${vh-10}" stroke="#8A9EA8" stroke-width="1"/>`;

    // Cadeiras decorativas (pequenos retângulos cinza antes das mesas)
    sala.chairs.forEach(c=>{
        s+=`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="#B8C4CA" stroke="#9DADB5" stroke-width="1"/>`;
    });

    // Mesas clicáveis
    sala.mesas.forEach(m=>{
        const res=reservasDia[m.id];
        const isOwn=res&&res.userId===(user&&user.id);
        const isOcup=!!res;
        const isSel=mesaSelecionada===m.id;
        const canClick=!isOcup||isOwn;

        // Cores bem distintas e visíveis
        const fill  = isOwn?'#C9A05A':isOcup?'#E74C3C':isSel?'#1E7D90':'#214957';
        const sfill = isOwn?'rgba(201,160,90,0.15)':isOcup?'rgba(231,76,60,0.1)':isSel?'rgba(30,125,144,0.15)':'rgba(33,73,87,0.08)';
        const stroke= isSel?'#1E7D90':isOwn?'#A07E3A':isOcup?'#C0392B':'#2d6070';
        const sw    = isSel?'3':'2';
        const tFill = '#fff';
        const tip   = isOwn?'Sua reserva — clique para ver':isOcup?(res.userNome||'Ocupada'):'Disponível — clique para reservar';
        const cursor= canClick?'pointer':'not-allowed';

        // Sombra da mesa
        s+=`<rect x="${m.x+3}" y="${m.y+3}" width="${m.w}" height="${m.h}" rx="4" fill="rgba(0,0,0,0.08)"/>`;
        // Fundo claro (superfície da mesa)
        s+=`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="4" fill="${sfill}" stroke="${stroke}" stroke-width="${sw}"/>`;
        // X arquitetônico
        s+=`<line x1="${m.x+6}" y1="${m.y+6}" x2="${m.x+m.w-6}" y2="${m.y+m.h-6}" stroke="${stroke}" stroke-width="1.2" opacity="0.5"/>`;
        s+=`<line x1="${m.x+m.w-6}" y1="${m.y+6}" x2="${m.x+6}" y2="${m.y+m.h-6}" stroke="${stroke}" stroke-width="1.2" opacity="0.5"/>`;
        // Badge colorido com nome
        const bx=m.x+m.w/2, by=m.y+m.h/2;
        s+=`<rect x="${bx-22}" y="${by-11}" width="44" height="22" rx="11" fill="${fill}"/>`;
        s+=`<text x="${bx}" y="${by+4}" text-anchor="middle" font-size="9" font-weight="700" fill="${tFill}" font-family="DM Sans,sans-serif">${esc(m.label)}</text>`;
        // Área clicável transparente sobre toda a mesa
        if(canClick){
            s+=`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="4" fill="transparent" style="cursor:${cursor}" onclick="selecionarMesa('${m.id}','${m.label}')"><title>${tip}</title></rect>`;
        } else {
            s+=`<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="4" fill="transparent" style="cursor:${cursor}"><title>${tip}</title></rect>`;
        }
        // Nome do ocupante (se houver)
        if(isOcup&&res.userNome){
            const nome=res.userNome.split(' ')[0];
            s+=`<text x="${bx}" y="${by+20}" text-anchor="middle" font-size="7.5" fill="${stroke}" font-family="DM Sans,sans-serif" opacity="0.85">${esc(nome)}</text>`;
        }
    });

    wrapper.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:220px;max-width:100%;height:auto;display:block;border-radius:8px;">${s}</svg>`;
}

async function renderMesas(){
    const sel=document.getElementById('mesaDataFiltro');
    if(sel&&sel.options.length===0){
        const hoje=new Date();
        for(let i=0;i<8;i++){
            const d=new Date(hoje);d.setDate(hoje.getDate()+i);
            const iso=d.toISOString().slice(0,10);
            const opt=document.createElement('option');
            opt.value=iso;
            opt.textContent=i===0?`Hoje — ${iso}`:iso;
            sel.appendChild(opt);
        }
    }
    const dataAlvo=_mesaDataAtiva();
    let reservasDia={};
    try{
        const snap=await db.collection('reservasMesas')
            .where('data','==',dataAlvo)
            .where('sala','==',mesaSalaAtiva)
            .get();
        snap.forEach(doc=>{reservasDia[doc.data().mesaId]=doc.data();});
    }catch(e){console.warn('reservasMesas:',e.message);}
    window._reservasDia=reservasDia;
    renderMesaSVG(reservasDia);
    // Lista
    const lista=document.getElementById('mesaListaReservas');
    if(!lista)return;
    const reservas=Object.values(reservasDia).sort((a,b)=>a.mesaId.localeCompare(b.mesaId));
    if(!reservas.length){
        lista.innerHTML='<div style="color:var(--muted);font-size:0.82rem;">Nenhuma reserva para este dia.</div>';
    }else{
        lista.innerHTML=reservas.map(r=>{
            const isOwn=r.userId===user.id;
            const canCancel=isOwn||P.isMaster();
            const mesaDef=(SALAS[r.sala]?.mesas||[]).find(mm=>mm.id===r.mesaId);
            const mesaLabel=mesaDef?mesaDef.label:r.mesaId;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.7rem;border-radius:8px;background:${isOwn?'rgba(201,160,90,0.12)':'rgba(23,46,56,0.04)'};margin-bottom:0.3rem;">
                <div><span style="font-weight:600;">${esc(mesaLabel)}</span><span style="color:var(--muted);margin-left:0.5rem;">${esc(r.userNome||'')} · 09h–18h</span></div>
                ${canCancel?`<button class="btn btn-ghost" style="font-size:0.75rem;color:#E74C3C;padding:0.25rem 0.5rem;" onclick="cancelarReservaMesa('${r.sala}__${r.mesaId}__${r.data}')"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;display:inline-block;"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`:''}
            </div>`;
        }).join('');
    }
}

function selecionarMesa(id, label){
    mesaSelecionada=id;
    document.getElementById('mesaNomeSelecionada').textContent=label;
    document.getElementById('mesaInfoSelecionada').style.display='none';
    document.getElementById('mesaFormReserva').style.display='block';
    document.getElementById('mesaMsgReserva').innerHTML='';
    const inp=document.getElementById('mesaDataReserva');
    const hoje=new Date().toISOString().slice(0,10);
    const max7=new Date();max7.setDate(max7.getDate()+7);
    inp.min=hoje;inp.max=max7.toISOString().slice(0,10);
    inp.value=_mesaDataAtiva();
    renderMesaSVG(window._reservasDia||{});
}

async function confirmarReservaMesa(){
    const data=document.getElementById('mesaDataReserva').value;
    const msg=document.getElementById('mesaMsgReserva');
    if(!mesaSelecionada||!data){msg.innerHTML='<div style="color:#E74C3C;font-size:0.8rem;">Selecione uma mesa e data.</div>';return;}
    const hoje=new Date().toISOString().slice(0,10);
    const max7=new Date();max7.setDate(max7.getDate()+7);
    if(data<hoje||data>max7.toISOString().slice(0,10)){msg.innerHTML='<div style="color:#E74C3C;font-size:0.8rem;">Data inválida (máx. 7 dias).</div>';return;}
    const docId=`${mesaSalaAtiva}__${mesaSelecionada}__${data}`;
    try{
        await db.collection('reservasMesas').doc(docId).set({
            sala:mesaSalaAtiva,mesaId:mesaSelecionada,data,
            userId:user.id,userNome:user.nome||user.email,
            criadoEm:firebase.firestore.FieldValue.serverTimestamp()
        });
        msg.innerHTML='<div style="color:#1E7D90;font-size:0.8rem;">Reserva confirmada!</div>';
        setTimeout(()=>{
            mesaSelecionada=null;
            document.getElementById('mesaFormReserva').style.display='none';
            document.getElementById('mesaInfoSelecionada').style.display='block';
            document.getElementById('mesaInfoSelecionada').textContent='Clique em uma mesa na planta para reservar';
            const s=document.getElementById('mesaDataFiltro');if(s)s.value=data;
            renderMesas();
        },1200);
    }catch(e){
        if(e.code==='permission-denied'||String(e.message).includes('exists')){
            msg.innerHTML='<div style="color:#E74C3C;font-size:0.8rem;">Mesa já reservada nesse dia.</div>';
        }else{
            msg.innerHTML=`<div style="color:#E74C3C;font-size:0.8rem;">Erro: ${esc(e.message)}</div>`;
        }
    }
}

async function cancelarReservaMesa(docId){
    if(!confirm('Cancelar esta reserva?'))return;
    try{await db.collection('reservasMesas').doc(docId).delete();renderMesas();}
    catch(e){alert('Erro: '+e.message);}
}
