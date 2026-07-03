// BACKUP_KEY declarado em globals.js

async function verificarLembreteBackup(){
    if(!P.isMaster()&&!P.isRH()) return;
    const info = document.getElementById('ultimoBackupInfo');
    if(!info) return;
    // O backup é AUTOMÁTICO no servidor (função backupFirestore, diária às 02:00).
    // Mostra a data do último backup automático real, sem pedir nada ao usuário.
    info.style.color = '#aaa';
    info.textContent = 'Backup automático ativo';
    if(P.isMaster()){
        try {
            const snap = await db.collection('logsBackup').orderBy('timestamp','desc').limit(1).get();
            if(!snap.empty){
                const d = snap.docs[0].data();
                const dt = d.timestamp?.toDate?.();
                if(dt){
                    const hoje = new Date().toDateString()===dt.toDateString();
                    info.textContent = 'Backup automático: '+(hoje?'hoje':dt.toLocaleDateString('pt-BR'))+' às '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
                }
            }
        } catch(e){ /* sem permissão/rede: mantém texto padrão */ }
    }
}

async function exportarBackup(){
    mostrarNotif('','Gerando backup...','Coletando todos os dados. Aguarde.','',4000);
    try {
        const agora = new Date();
        const backup = {
            versao: '1.0',
            geradoEm: agora.toLocaleString('pt-BR'),
            geradoPor: user.nome,
            projeto: 'pdimirae',
            dados: {}
        };

        // Buscar todas as collections
        const collections = [
            'colaboradores','avaliacoes','equipes',
            'lancamentosVTVR','bonusConfigs','premioConfigs',
            'vrConfigs','metasLucratividade','denuncias','denunciasStatus','notificacoesPJ',
            'tarefasPessoais','kanbanBoards','kanbanCards','notificacoesDevolutiva'
        ];

        for(const col of collections){
            try {
                const snap = await db.collection(col).get();
                backup.dados[col] = snap.docs.map(d=>({id:d.id,...d.data(),
                    // Converter Timestamps para string legível
                    ...Object.fromEntries(
                        Object.entries(d.data()).map(([k,v])=>[k,
                            v&&v.toDate?v.toDate().toLocaleString('pt-BR'):v
                        ])
                    )
                }));
            } catch(e){ backup.dados[col]=[]; }
        }

        // Subcoleção financeiro de cada colaborador (salário, VT, CNPJ, dataAdmissao)
        if(backup.dados.colaboradores){
            for(const c of backup.dados.colaboradores){
                try{
                    const finSnap=await db.collection('colaboradores').doc(c.id).collection('financeiro').doc('dados').get();
                    if(finSnap.exists)c._financeiro=Object.fromEntries(
                        Object.entries(finSnap.data()).map(([k,v])=>[k,v&&v.toDate?v.toDate().toLocaleString('pt-BR'):v])
                    );
                }catch(e){}
            }
        }

        // Gerar resumo
        backup.resumo = {
            colaboradores: backup.dados.colaboradores?.length||0,
            avaliacoes: backup.dados.avaliacoes?.length||0,
            lancamentosVTVR: backup.dados.lancamentosVTVR?.length||0,
            denuncias: backup.dados.denuncias?.length||0,
        };

        // Download do JSON
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dataStr = agora.toISOString().slice(0,10);
        a.href = url;
        a.download = `mirae-backup-${dataStr}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Salvar timestamp do último backup
        localStorage.setItem(BACKUP_KEY, Date.now().toString());
        const info = document.getElementById('ultimoBackupInfo');
        if(info){ info.textContent='Último: hoje'; info.style.color='#aaa'; }

        mostrarNotif('','Backup concluído!',
            `${backup.resumo.colaboradores} colaboradores · ${backup.resumo.avaliacoes} avaliações · ${backup.resumo.lancamentosVTVR} lançamentos VT/VR`,
            'bonus', 6000);
    } catch(err){
        console.error(err);
        mostrarNotif('','Erro no backup','Tente novamente ou verifique sua conexão.','',5000);
    }
}

// Roda um backup AGORA no servidor (mesma rotina do backup automático diário).
// Os dados são salvos em Storage (pasta backups/), retidos por 90 dias.
// Roda um backup AGORA no servidor via padrão de gatilho do Firestore.
// A política da organização bloqueia a invocação pública de Cloud
// Functions (allUsers), então não dá para chamar uma callable direto do
// navegador. Em vez disso, gravamos um pedido em solicitacoesBackup/ e
// ouvimos o resultado no mesmo doc — a função processarBackup (disparada
// por gatilho) roda o backup e escreve o status de volta.
async function backupAgora(btn){
    if(!P.isMaster()){ mostrarNotif('','Apenas MASTER','Somente o perfil MASTER pode rodar o backup.','',4000); return; }
    const txtOrig = btn? btn.textContent : '';
    if(btn){ btn.disabled=true; btn.textContent='Gerando backup...'; }
    let unsub=null, finalizado=false, timeout=null;
    const encerrar = () => {
        if(unsub){ try{ unsub(); }catch(e){} }
        if(timeout) clearTimeout(timeout);
        if(btn){ btn.disabled=false; btn.textContent=txtOrig; }
    };
    try{
        const ref = await db.collection('solicitacoesBackup').add({
            solicitanteId: user.id,
            solicitanteNome: user.nome,
            status: 'pendente',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Timeout de segurança: se em 2 min não confirmar, libera o botão.
        timeout = setTimeout(()=>{
            if(finalizado) return;
            finalizado=true; encerrar();
            mostrarNotif('','Backup em andamento','O pedido foi enviado, mas ainda não confirmou. Recarregue em instantes para ver o status.','',7000);
        }, 120000);
        unsub = ref.onSnapshot(doc=>{
            const d = doc.data(); if(!d || finalizado) return;
            if(d.status==='concluido'){
                finalizado=true; encerrar();
                mostrarNotif('','Backup concluído no servidor!',`${d.total||0} registros salvos com segurança. Próximo backup automático: amanhã 05:00.`,'bonus',7000);
                verificarLembreteBackup();
            } else if(d.status==='erro'){
                finalizado=true; encerrar();
                mostrarNotif('','Falha no backup', d.erro||'Erro desconhecido.','',7000);
            }
        }, err=>{
            if(finalizado) return;
            finalizado=true; encerrar();
            console.error('backupAgora onSnapshot:', err);
            mostrarNotif('','Erro ao acompanhar o backup', err.message||'Verifique sua conexão.','',6000);
        });
    }catch(err){
        console.error('backupAgora:', err);
        encerrar();
        mostrarNotif('','Erro ao solicitar backup', err.message||'Verifique sua conexão.','',6000);
    }
}

async function registrarLogSenha(){
    try{await db.collection('colaboradores').doc(user.id).update({ultimaTrocaSenha:new Date().toLocaleString('pt-BR'),trocouSenhaEm:new Date()});}catch(e){}
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    verificarLembreteBackup, exportarBackup, backupAgora, registrarLogSenha,
});
