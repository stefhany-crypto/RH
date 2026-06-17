# MIRAE PDI — Checklist de Segurança e Backup

## Após o deploy, execute estes passos UMA VEZ no terminal:

### 1. Criar bucket de backup no Google Cloud

```powershell
# Substitua PROJECT_ID pelo ID real (ex: pdimirae)
$PROJECT_ID = "pdimirae"

# Criar bucket (região us-central1 para ficar junto com o Firestore)
gcloud storage buckets create gs://$PROJECT_ID-backups `
  --location=us-central1 `
  --uniform-bucket-level-access

# Dar permissão ao Firebase/Cloud Functions para gravar no bucket
gcloud storage buckets add-iam-policy-binding gs://$PROJECT_ID-backups `
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"
```

### 2. Ativar Point-in-Time Recovery (PITR) no Firestore

O PITR permite restaurar qualquer dado deletado acidentalmente nos últimos 7 dias.

```powershell
gcloud firestore databases update --database="(default)" `
  --enable-pitr `
  --project=$PROJECT_ID
```

Ou pelo Console do Firebase:
- Acesse: console.firebase.google.com → seu projeto → Firestore
- Aba "Backups" → ative "Recuperação point-in-time"

### 3. Fazer deploy com as novas regras

```powershell
cd C:\mirae-app
firebase deploy
```

Isso fará deploy de:
- Hosting (index.html, sw.js, manifest.json, icons)
- Firestore Rules (regras de segurança corrigidas)
- Firestore Indexes
- Storage Rules
- Cloud Functions (incluindo migrarRemoverSenhas e verificarBackup)

### 4. Rodar a migração de senhas (login como MASTER no app)

Após o deploy, entre no app como MASTER e abra o Console do navegador (F12):

```javascript
// Cole no console do navegador (estando logado como MASTER)
const fn = firebase.functions();
const migrar = fn.httpsCallable('migrarRemoverSenhas');
migrar({}).then(r => console.log('Migração concluída:', r.data));
```

Ou aguarde — o campo `senha` já é removido automaticamente toda vez que o Master faz login.

### 5. Verificar status do backup (opcional)

```javascript
// Cole no console do navegador (estando logado como MASTER)
const verificar = fn.httpsCallable('verificarBackup');
verificar({}).then(r => console.log(JSON.stringify(r.data, null, 2)));
```

---

## O que foi corrigido

| Problema | Status |
|---|---|
| Firestore aberto (allow read/write: if true) | ✅ Corrigido — regras por role |
| Campo senha no Firestore | ✅ Removido via Cloud Function |
| Backup sem bucket | ✅ Instruções acima + função verificarBackup |
| PITR desativado | ✅ Comando acima |
| Storage rules | ✅ Já estava correto |
| Auth via Firebase | ✅ Já estava correto |
