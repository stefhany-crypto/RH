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
async function backupAgora(btn){
    if(!P.isMaster()){ mostrarNotif('','Apenas MASTER','Somente o perfil MASTER pode rodar o backup.','',4000); return; }
    const txtOrig = btn? btn.textContent : '';
    if(btn){ btn.disabled=true; btn.textContent='Gerando backup...'; }
    try{
        const fn = firebase.app().functions('southamerica-east1').httpsCallable('verificarBackup');
        const res = await fn({ rodar:true });
        const d = res.data||{};
        if(d.execucao && d.execucao.status==='concluido'){
            const total = Object.values(d.execucao.resumo||{}).reduce((a,v)=>a+(typeof v==='number'?v:0),0);
            mostrarNotif('','Backup concluído no servidor!',`${total} registros salvos com segurança. Próximo backup automático: amanhã 02:00.`,'bonus',7000);
        } else if(d.execucao && d.execucao.status==='erro'){
            mostrarNotif('','Falha no backup',d.execucao.erro||'Erro desconhecido.','',7000);
        } else {
            mostrarNotif('','Backup não confirmado','O servidor respondeu sem confirmar a execução.','',6000);
        }
        verificarLembreteBackup(); // atualiza a data exibida
    }catch(err){
        console.error('backupAgora:', err);
        mostrarNotif('','Erro ao chamar o servidor',err.message||'Verifique sua conexão.','',6000);
    }finally{
        if(btn){ btn.disabled=false; btn.textContent=txtOrig; }
    }
}

async function registrarLogSenha(){
    try{await db.collection('colaboradores').doc(user.id).update({ultimaTrocaSenha:new Date().toLocaleString('pt-BR'),trocouSenhaEm:new Date()});}catch(e){}
}

// ── ES-module: expõe ao escopo global ──────────────────────────
Object.assign(window, {
    verificarLembreteBackup, exportarBackup, backupAgora, registrarLogSenha,
});
