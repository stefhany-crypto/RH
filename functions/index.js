/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           MIRAE PDI — Cloud Functions v1.1.0                 ║
 * ║     Sistema de Avaliações 360° · Audaz Health                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

"use strict";

const functions = require("firebase-functions/v1");
const logger    = require("firebase-functions").logger;
const admin     = require("firebase-admin");

admin.initializeApp();
const db   = admin.firestore();
const auth = admin.auth();

const REGION = "southamerica-east1";

const SMTP_SECRETS = ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_FROM","ADMIN_EMAIL"];

// ── Helpers ──────────────────────────────────────────────────────
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendEmailInternal({ to, subject, html }) {
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from:    `"MIRAE PDI" <${process.env.SMTP_FROM}>`,
    to, subject, html,
    text: html.replace(/<[^>]*>/g, ""),
  });
  logger.info("E-mail enviado", { to, subject });
  return { success: true };
}

// ════════════════════════════════════════════════════════════════
// 1. colaboradorCriado
// ════════════════════════════════════════════════════════════════
exports.colaboradorCriado = functions
  .region(REGION)
  .firestore.document("colaboradores/{colabId}")
  .onCreate(async (snap, context) => {
    const data    = snap.data();
    const colabId = context.params.colabId;

    if (!isValidEmail(data.email)) return;
    if (data.authUid) return;

    // Verifica se o usuário Auth já existe (frontend cria Auth antes do Firestore doc)
    try {
      const existing = await auth.getUserByEmail(data.email);
      // CRÍTICO: aplica os claims mesmo quando a conta já existe. Sem isto, o
      // usuário criado pelo frontend loga sem role/equipe no token e todas as
      // regras do Firestore que dependem de role() o negam (LIDER/RH sem acesso).
      await auth.setCustomUserClaims(existing.uid, {
        role: data.role || "COLABORADOR", equipe: data.equipe || "",
      });
      await snap.ref.update({ authUid: existing.uid });
      logger.info("Conta Auth já existia, claims aplicados e vinculada", { colabId });
      return;
    } catch (notFoundErr) {
      // auth/user-not-found — prossegue para criar
    }

    const senhaTemporaria = `Mirae@${colabId.slice(0, 6)}`;
    try {
      const userRecord = await auth.createUser({
        uid: colabId, email: data.email,
        password: senhaTemporaria,
        displayName: data.nome || "Colaborador",
        disabled: false,
      });
      await auth.setCustomUserClaims(userRecord.uid, {
        role: data.role || "COLABORADOR", equipe: data.equipe || "",
      });
      await snap.ref.update({ authUid: userRecord.uid });
      logger.info("Conta Auth criada", { colabId });
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        const existing = await auth.getUserByEmail(data.email);
        await snap.ref.update({ authUid: existing.uid });
      } else {
        logger.error("Erro ao criar conta Auth", { colabId, err: err.message });
      }
    }
  });

// ════════════════════════════════════════════════════════════════
// 2. colaboradorStatusAlterado
// ════════════════════════════════════════════════════════════════
exports.colaboradorStatusAlterado = functions
  .region(REGION)
  .firestore.document("colaboradores/{colabId}")
  .onUpdate(async (change, context) => {
    const before  = change.before.data();
    const after   = change.after.data();
    const colabId = context.params.colabId;
    const uid     = after.authUid || colabId;

    if (before.ativo !== after.ativo) {
      try {
        await auth.updateUser(uid, { disabled: !after.ativo });
        if (!after.ativo) {
          await auth.revokeRefreshTokens(uid); // invalida sessões ativas imediatamente
        } else {
          await auth.setCustomUserClaims(uid, {
            role: after.role || "COLABORADOR", equipe: after.equipe || "",
          });
        }
      } catch (err) {
        logger.error("Erro ao alterar status Auth", { colabId, err: err.message });
      }
    }

    if (before.role !== after.role || before.equipe !== after.equipe) {
      try {
        await auth.setCustomUserClaims(uid, {
          role: after.role || "COLABORADOR", equipe: after.equipe || "",
        });
      } catch (err) {
        logger.error("Erro ao atualizar claims", { colabId, err: err.message });
      }
    }
  });

// ════════════════════════════════════════════════════════════════
// 3. avaliacaoCriada
// ════════════════════════════════════════════════════════════════
exports.avaliacaoCriada = functions
  .region(REGION)
  .runWith({ secrets: SMTP_SECRETS })
  .firestore.document("avaliacoes/{avalId}")
  .onCreate(async (snap) => {
    const aval = snap.data();
    let colab;
    try {
      const s = await db.collection("colaboradores").doc(aval.colaboradorId).get();
      if (!s.exists) return;
      colab = s.data();
    } catch (err) { return; }

    if (!isValidEmail(colab.email)) return;

    const notaFinal    = Number(aval.notaFinal || 0).toFixed(1);
    const bonusPercent = aval.bonusPercent || 0;
    const trimestre    = `Q${aval.trimestre}/${aval.ano}`;

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#214957;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="color:#C9A05A;margin:0;font-size:22px;">MIRAE PDI</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;">Sistema de Avaliações 360°</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
          <p style="font-size:16px;color:#1A2E38;">Olá, <strong>${colab.nome}</strong>!</p>
          <p style="color:#5A7280;">Sua avaliação <strong>${trimestre}</strong> foi registrada.</p>
          <div style="background:#F5F2ED;border-radius:8px;padding:20px;margin:20px 0;display:flex;gap:32px;">
            <div style="text-align:center;">
              <div style="font-size:12px;color:#5A7280;text-transform:uppercase;">Nota Final</div>
              <div style="font-size:36px;font-weight:800;color:#1E7D90;">${notaFinal}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:12px;color:#5A7280;text-transform:uppercase;">Bônus</div>
              <div style="font-size:36px;font-weight:800;color:#C9A05A;">${bonusPercent}%</div>
            </div>
          </div>
          <p style="font-size:12px;color:#9CA3AF;margin-top:32px;">E-mail automático — não responda.</p>
        </div>
      </div>`;

    try {
      await sendEmailInternal({
        to: colab.email,
        subject: `[MIRAE PDI] Avaliação ${trimestre} registrada — ${colab.nome}`,
        html,
      });
    } catch (err) {
      logger.error("avaliacaoCriada: falha ao enviar e-mail", err.message);
    }
  });

// ════════════════════════════════════════════════════════════════
// 4. denunciaDevolutiva
// ════════════════════════════════════════════════════════════════
exports.denunciaDevolutiva = functions
  .region(REGION)
  .firestore.document("denuncias/{denunciaId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    if (before.devolutiva || !after.devolutiva) return;

    await db.collection("notificacoesDevolutiva").add({
      protocolo:    after.protocolo,
      denunciaId:   context.params.denunciaId,
      devolutiva:   after.devolutiva,
      devolutivaEm: after.devolutivaEm || new Date().toLocaleString("pt-BR"),
      criadoEm:     admin.firestore.FieldValue.serverTimestamp(),
      lida:         false,
      destinoId:    after.userId || null,
    });
    logger.info("Notificação de devolutiva criada", { protocolo: after.protocolo });
  });

// ════════════════════════════════════════════════════════════════
// 5. backupFirestore (diário às 02:00 BRT)
//    Lê todas as coleções via Admin SDK e grava um JSON no Storage
//    padrão do projeto (pasta backups/). Não usa a "exportação
//    gerenciada", que exige permissão IAM especial. Retém 90 dias.
// ════════════════════════════════════════════════════════════════

// Converte recursivamente Timestamps do Firestore em texto ISO
function serializaBackup(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (typeof obj.toDate === "function") return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(serializaBackup);
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = serializaBackup(v);
  return out;
}

// Remove backups com mais de 90 dias da pasta backups/
async function limparBackupsAntigos(bucket) {
  try {
    const [files] = await bucket.getFiles({ prefix: "backups/" });
    const corte = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const f of files) {
      const t = Date.parse(f.metadata?.timeCreated || 0);
      if (t && t < corte) await f.delete().catch(() => {});
    }
  } catch (e) { logger.warn("limparBackupsAntigos:", e.message); }
}

const BACKUP_COLLECTIONS = [
  "colaboradores", "avaliacoes", "equipes", "lancamentosVTVR",
  "bonusConfigs", "premioConfigs", "vrConfigs", "metasLucratividade",
  "denuncias", "denunciasStatus", "notificacoesPJ", "dailys",
  "dailyTarefas", "reservasMesas", "bonusCalculados", "configs",
  "tarefasPessoais", "kanbanBoards", "kanbanCards", "notificacoesDevolutiva",
];

exports.backupFirestore = functions
  .region(REGION)
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .pubsub.schedule("0 5 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => { await rodarBackup("agendado"); });

// ════════════════════════════════════════════════════════════════
// 5b. processarBackup — gatilho Firestore para backup sob demanda.
//     Substitui a callable verificarBackup{rodar:true}: a politica da
//     organizacao bloqueia a invocacao publica (allUsers) de Cloud
//     Functions, entao o navegador nao consegue chamar callables. O
//     app grava solicitacoesBackup/{id} e ouve o resultado no doc.
//     Gatilhos do Firestore nao exigem permissao de invocacao.
// ════════════════════════════════════════════════════════════════
exports.processarBackup = functions
  .region(REGION)
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .firestore.document("solicitacoesBackup/{id}")
  .onCreate(async (snap) => {
    const req = snap.data();
    const uid = req.solicitanteId;

    // Revalidacao server-side (defesa em profundidade): so MASTER roda backup.
    // A regra do Firestore ja restringe a criacao a MASTER; aqui confirmamos.
    try {
      const meSnap = await db.collection("colaboradores").doc(uid).get();
      if (!meSnap.exists || meSnap.data().role !== "MASTER") {
        await snap.ref.update({ status: "erro", erro: "Apenas MASTER pode rodar o backup." });
        return;
      }
    } catch (e) {
      await snap.ref.update({ status: "erro", erro: "Falha ao validar permissao: " + e.message });
      return;
    }

    await snap.ref.update({ status: "processando" });
    const resultado = await rodarBackup("manual");
    const total = Object.values(resultado.resumo || {}).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
    await snap.ref.update({
      status: resultado.status === "concluido" ? "concluido" : "erro",
      erro: resultado.erro || null,
      resumo: resultado.resumo || null,
      total,
      filePath: resultado.filePath || null,
      finalizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// Lógica compartilhada de backup (usada pelo agendado e pelo botão "agora")
async function rodarBackup(origem) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dump = {
    versao: "2.0",
    geradoEm: new Date().toISOString(),
    origem: origem || "agendado",
    projeto: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    dados: {},
  };
  const resumo = {};

  try {
    for (const col of BACKUP_COLLECTIONS) {
      try {
        const snap = await db.collection(col).get();
        dump.dados[col] = snap.docs.map((d) => ({ id: d.id, ...serializaBackup(d.data()) }));
        resumo[col] = snap.size;
      } catch (e) {
        dump.dados[col] = [];
        resumo[col] = "erro: " + e.message;
      }
    }

    // Subcoleção financeiro de cada colaborador
    if (dump.dados.colaboradores) {
      for (const doc of dump.dados.colaboradores) {
        try {
          const finSnap = await db.collection("colaboradores").doc(doc.id).collection("financeiro").doc("dados").get();
          if (finSnap.exists) doc._financeiro = serializaBackup(finSnap.data());
        } catch (e) {}
      }
    }

    const filePath = `backups/mirae-backup-${ts}.json`;
    const bucket = admin.storage().bucket();
    await bucket.file(filePath).save(JSON.stringify(dump), {
      contentType: "application/json",
      metadata: { cacheControl: "no-store" },
    });

    logger.info("Backup salvo", { filePath, origem, resumo });
    await db.collection("logsBackup").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "concluido",
      origem: origem || "agendado",
      outputUri: `gs://${bucket.name}/${filePath}`,
      resumo,
    });

    await limparBackupsAntigos(bucket);
    return { status: "concluido", filePath, resumo };
  } catch (err) {
    logger.error("backupFirestore: erro", err.message);
    await db.collection("logsBackup").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "erro", origem: origem || "agendado", erro: err.message,
    });
    return { status: "erro", erro: err.message };
  }
}


// ════════════════════════════════════════════════════════════════
// 6. lembrarBackup (toda segunda às 09:00 BRT)
// ════════════════════════════════════════════════════════════════
exports.lembrarBackup = functions
  .region(REGION)
  .runWith({ secrets: SMTP_SECRETS })
  .pubsub.schedule("0 12 * * 1")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const snap = await db.collection("logsBackup").orderBy("timestamp", "desc").limit(1).get();
    let ultimoBackup = "Nenhum backup registrado";
    if (!snap.empty) {
      const d = snap.docs[0].data();
      ultimoBackup = d.timestamp?.toDate?.()?.toLocaleString("pt-BR") || "—";
    }
    const html = `<div style="font-family:sans-serif;max-width:480px;">
      <h2 style="color:#214957;">Lembrete de Backup — MIRAE PDI</h2>
      <p>Último backup: <strong>${ultimoBackup}</strong></p>
      <p>Verifique o painel do Firebase para confirmar que os backups automáticos estão funcionando.</p>
    </div>`;
    try {
      await sendEmailInternal({ to: process.env.ADMIN_EMAIL, subject: "[MIRAE PDI] Lembrete semanal de backup", html });
    } catch (err) { logger.error("lembrarBackup: erro", err.message); }
  });

// ════════════════════════════════════════════════════════════════
// 7. limparDadosAntigos (todo domingo à meia-noite BRT)
// ════════════════════════════════════════════════════════════════
exports.limparDadosAntigos = functions
  .region(REGION)
  .runWith({ memory: "256MB", timeoutSeconds: 540 })
  .pubsub.schedule("0 3 * * 0")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const corte   = new Date();
    corte.setDate(corte.getDate() - 90);
    const corteTs = admin.firestore.Timestamp.fromDate(corte);

    const tasks = [
      db.collection("notificacoesPJ").where("lida", "==", true).where("dataEnvio", "<", corteTs),
      db.collection("notificacoesDevolutiva").where("lida", "==", true).where("criadoEm", "<", corteTs),
      db.collection("logsBackup").where("timestamp", "<", corteTs),
      db.collection("solicitacoesSync").where("criadoEm", "<", corteTs),
    ];

    let totalRemovidos = 0;
    for (const query of tasks) {
      const s = await query.get();
      const batch = db.batch();
      s.docs.forEach((doc) => batch.delete(doc.ref));
      if (!s.empty) { await batch.commit(); totalRemovidos += s.size; }
    }
    logger.info("limparDadosAntigos: concluído", { totalRemovidos });
  });

// ════════════════════════════════════════════════════════════════
// 8. calcularBonusMes (dia 1 de cada mês às 06:00 BRT)
// ════════════════════════════════════════════════════════════════
exports.calcularBonusMes = functions
  .region(REGION)
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .pubsub.schedule("0 9 1 * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const agora     = new Date();
    const ano       = agora.getFullYear();
    const trimestre = Math.ceil((agora.getMonth() + 1) / 3);

    const [avalSnap, colabSnap, configSnap] = await Promise.all([
      db.collection("avaliacoes").where("ano", "==", ano).where("trimestre", "==", trimestre).get(),
      db.collection("colaboradores").where("ativo", "==", true).get(),
      db.collection("bonusConfigs").where("ano", "==", ano).where("trimestre", "==", trimestre).get(),
    ]);

    const avaliacoes    = avalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const colaboradores = colabSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const configs       = configSnap.docs.map((d) => d.data());
    const batch         = db.batch();
    let processados     = 0;

    for (const colab of colaboradores) {
      const avals = avaliacoes.filter((a) => a.colaboradorId === colab.id);
      if (!avals.length) continue;

      const mediaNotas    = avals.reduce((s, a) => s + (a.notaFinal || 0), 0) / avals.length;
      const config        = configs.find((c) => c.equipe === colab.equipe);
      const multiplicador = config ? (config.tipo === "fixo" ? 1 : (config.multiplicador || 1)) : 1;
      const valorFixo     = config?.tipo === "fixo" ? config.valorFixo : null;
      let bonusBase = 0;
      if (mediaNotas >= 80) bonusBase = 100;
      else if (mediaNotas >= 70) bonusBase = 75;
      else if (mediaNotas >= 60) bonusBase = 50;
      const ref = db.collection("bonusCalculados").doc(`${colab.id}_${ano}_Q${trimestre}`);
      batch.set(ref, {
        colaboradorId: colab.id, nome: colab.nome, equipe: colab.equipe,
        ano, trimestre,
        mediaNotas:    parseFloat(mediaNotas.toFixed(2)),
        multiplicador,
        valorFixo,
        bonusPercent:  bonusBase,
        calculadoEm:   admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      processados++;
    }

    await batch.commit();
    logger.info("calcularBonusMes: concluído", { ano, trimestre, processados });
  });

// ════════════════════════════════════════════════════════════════
// 9. sendEmail (callable — MASTER/RH apenas)
// ════════════════════════════════════════════════════════════════
exports.sendEmail = functions
  .region(REGION)
  .runWith({ secrets: SMTP_SECRETS })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticação necessária.");
    const role = context.auth.token?.role || "";
    if (!["MASTER", "RH"].includes(role)) throw new functions.https.HttpsError("permission-denied", "Apenas MASTER ou RH.");

    const { to, subject, html } = data;
    if (!isValidEmail(to))                              throw new functions.https.HttpsError("invalid-argument", "E-mail inválido.");
    if (!subject || subject.length > 200)               throw new functions.https.HttpsError("invalid-argument", "Assunto inválido.");
    if (!html    || html.length > 50_000)               throw new functions.https.HttpsError("invalid-argument", "Corpo inválido.");

    try { return await sendEmailInternal({ to, subject, html }); }
    catch (err) { throw new functions.https.HttpsError("internal", "Falha ao enviar e-mail."); }
  });

// ════════════════════════════════════════════════════════════════
// 10. healthCheck
// ════════════════════════════════════════════════════════════════
exports.healthCheck = functions
  .region(REGION)
  .https.onRequest((req, res) => {
    if (req.method !== "GET") { res.status(405).json({ error: "Método não permitido." }); return; }
    res.status(200).json({ status: "ok", sistema: "MIRAE PDI", versao: "1.1.0", timestamp: new Date().toISOString() });
  });

// ════════════════════════════════════════════════════════════════
// 11. migrarRemoverSenhas (callable — MASTER apenas, roda uma vez)
// ════════════════════════════════════════════════════════════════
exports.migrarRemoverSenhas = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticação necessária.");
    if ((context.auth.token?.role || "") !== "MASTER") throw new functions.https.HttpsError("permission-denied", "Apenas MASTER.");

    let total = 0, lastDoc = null;
    while (true) {
      let query = db.collection("colaboradores").select("senha").limit(400);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;

      const batch = db.batch(); let count = 0;
      snap.docs.forEach((doc) => {
        if (doc.data().senha !== undefined) {
          batch.update(doc.ref, { senha: admin.firestore.FieldValue.delete() });
          count++;
        }
      });
      if (count > 0) await batch.commit();
      total += count;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 400) break;
    }
    logger.info("migrarRemoverSenhas: concluído", { totalLimpos: total });
    return { sucesso: true, totalLimpos: total };
  });

// ════════════════════════════════════════════════════════════════
// 12. migrarFinanceiro (callable — MASTER apenas, roda uma vez)
//     Move salario/valorVT/cnpj/razaoSocial/dataAdmissao do doc
//     principal para a subcoleção financeiro/dados e apaga do doc.
// ════════════════════════════════════════════════════════════════
exports.migrarFinanceiro = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (_data, context) => {
    if (context.auth?.token?.role !== "MASTER")
      throw new functions.https.HttpsError("permission-denied", "Apenas MASTER");

    const CAMPOS = ["salario", "valorVT", "cnpj", "razaoSocial", "dataAdmissao"];
    const DELETE = admin.firestore.FieldValue.delete();
    let total = 0;
    let cursor = null;

    while (true) {
      let q = db.collection("colaboradores").orderBy("__name__").limit(400);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach(doc => {
        const data = doc.data();
        const fin = {};
        const remove = {};
        CAMPOS.forEach(c => {
          if (data[c] !== undefined) { fin[c] = data[c]; remove[c] = DELETE; }
        });
        if (Object.keys(fin).length === 0) return;
        batch.set(doc.ref.collection("financeiro").doc("dados"), fin, { merge: true });
        batch.update(doc.ref, remove);
        total++;
      });
      await batch.commit();

      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < 400) break;
    }

    logger.info("migrarFinanceiro: concluído", { totalMigrados: total });
    return { sucesso: true, totalMigrados: total };
  });

// ════════════════════════════════════════════════════════════════
// 13. verificarBackup (callable — MASTER apenas)
// ════════════════════════════════════════════════════════════════
exports.verificarBackup = functions
  .region(REGION)
  .runWith({ memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticação necessária.");
    if ((context.auth.token?.role || "") !== "MASTER") throw new functions.https.HttpsError("permission-denied", "Apenas MASTER.");

    // Se data.rodar === true, executa um backup imediato antes de relatar o status
    let execucao = null;
    if (data && data.rodar === true) {
      execucao = await rodarBackup("manual");
    }

    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const snap = await db.collection("logsBackup").orderBy("timestamp", "desc").limit(5).get();
    const logs = snap.docs.map((d) => {
      const data = d.data();
      return { status: data.status, outputUri: data.outputUri || null, erro: data.erro || null,
               timestamp: data.timestamp?.toDate?.()?.toISOString() || null };
    });

    let bucketAcessivel = false, bucketErro = null, arquivos = [];
    try {
      const bucket = admin.storage().bucket();
      const [files] = await bucket.getFiles({ prefix: "backups/" });
      bucketAcessivel = true;
      arquivos = files
        .map((f) => ({ nome: f.name, criadoEm: f.metadata?.timeCreated || null, tamanho: f.metadata?.size || null }))
        .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))
        .slice(0, 5);
    } catch (err) { bucketErro = err.message; }

    return { projectId, bucketAcessivel, bucketErro, ultimosBackups: logs, arquivos, execucao };
  });

// ================================================================
// 14. tarefaDelegada — notifica por e-mail quem foi citado em
//     daily de outra equipe (cross-team)
// ================================================================
exports.tarefaDelegada = functions
  .region(REGION)
  .runWith({ secrets: SMTP_SECRETS })
  .firestore.document("dailyTarefas/{tarefaId}")
  .onCreate(async (snap) => {
    const t = snap.data();
    if (!t.responsavelId) return;
    const ehDependencia = t.tipo === "dependencia" && t.criadoPorId !== t.responsavelId;
    if (!t.crossTeam && !ehDependencia) return;

    try {
      // Valida que quem criou tem permissão para delegar (LIDER ou MASTER)
      if (t.criadoPorId) {
        const criadorSnap = await db.collection("colaboradores").doc(t.criadoPorId).get();
        const criador = criadorSnap.data();
        if (!criador || !["LIDER", "MASTER", "RH"].includes(criador.role)) return;
      }

      const colabSnap = await db.collection("colaboradores").doc(t.responsavelId).get();
      const colab = colabSnap.data();
      if (!colab || !isValidEmail(colab.email)) return;

      const assunto = ehDependencia
        ? `Voce foi mencionado(a) em uma dependencia — Daily ${t.data} (${t.equipe})`
        : `Nova tarefa delegada pela equipe ${t.equipe} — Daily ${t.data}`;
      await sendEmailInternal({
        to: colab.email,
        subject: assunto,
        html: `
          <h2>Voce foi citado(a) na daily da equipe ${t.equipe}</h2>
          <p>Ola, <strong>${colab.nome || ""}</strong>!</p>
          <p>A equipe <strong>${t.equipe}</strong> ${ehDependencia ? "registrou uma <strong>dependencia</strong> que precisa de voce" : "registrou uma tarefa para voce"} na daily de <strong>${t.data}</strong>:</p>
          <blockquote style="border-left:4px solid #4f8cff;padding:8px 16px;background:#f5f7fb;">
            ${t.descricao || ""}
          </blockquote>
          <p>Delegada por: ${t.criadoPorNome || "Lider da equipe"}</p>
          <p>Acesse o MIRAE PDI e atualize o status da tarefa na aba <strong>Daily</strong>.</p>
        `,
      });
      logger.info("Notificacao de tarefa cross-team enviada", { tarefaId: snap.id, to: colab.email });
    } catch (err) {
      logger.error("Erro ao notificar tarefa delegada", { tarefaId: snap.id, err: err.message });
    }
  });

// ================================================================
// 14. sincronizarPermissoes (callable) — grava as claims (role/
//     equipe) no token de login. Corrige usuarios criados antes
//     das regras de seguranca. MASTER pode sincronizar todos.
// ================================================================
exports.sincronizarPermissoes = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticacao necessaria.");

    const meSnap = await db.collection("colaboradores").doc(context.auth.uid).get();
    if (!meSnap.exists) throw new functions.https.HttpsError("not-found", "Colaborador nao encontrado.");
    const me = meSnap.data();

    const aplicar = async (docId, d) => {
      const uid = d.authUid || docId;
      try {
        await auth.setCustomUserClaims(uid, {
          role: d.role || "COLABORADOR",
          equipe: d.equipe || "",
        });
        return true;
      } catch (err) {
        logger.warn("Falha ao sincronizar claims", { docId, err: err.message });
        return false;
      }
    };

    if (me.role === "MASTER" && data && data.todos) {
      const all = await db.collection("colaboradores").get();
      let n = 0;
      for (const doc of all.docs) { if (await aplicar(doc.id, doc.data())) n++; }
      logger.info("Claims sincronizadas em massa", { total: n, por: context.auth.uid });
      return { sincronizados: n };
    }

    await aplicar(meSnap.id, me);
    return { sincronizados: 1 };
  });

// ================================================================
// 15. processarSync — trigger Firestore que sincroniza as claims
//     (role/equipe) sem precisar de funcao HTTP publica (a org
//     policy da Audaz bloqueia invoker allUsers).
//     O app grava solicitacoesSync/{uid} e aguarda status.
// ================================================================
exports.processarSync = functions
  .region(REGION)
  .firestore.document("solicitacoesSync/{uid}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const req = change.after.data();
    if (req.status !== "pendente") return;

    const uid = context.params.uid;
    const meSnap = await db.collection("colaboradores").doc(uid).get();
    if (!meSnap.exists) {
      await change.after.ref.update({ status: "erro", erro: "Colaborador nao encontrado." });
      return;
    }
    const me = meSnap.data();

    const aplicar = async (docId, d) => {
      const alvo = d.authUid || docId;
      try {
        await auth.setCustomUserClaims(alvo, {
          role: d.role || "COLABORADOR",
          equipe: d.equipe || "",
        });
        return true;
      } catch (err) {
        logger.warn("Falha ao sincronizar claims", { docId, err: err.message });
        return false;
      }
    };

    let n = 0;
    if (me.role === "MASTER") {
      const all = await db.collection("colaboradores").get();
      for (const doc of all.docs) { if (await aplicar(doc.id, doc.data())) n++; }
    } else {
      if (await aplicar(meSnap.id, me)) n = 1;
    }
    await change.after.ref.update({
      status: "concluido", sincronizados: n,
      processadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info("Claims sincronizadas via solicitacao", { uid, n });
  });

// ════════════════════════════════════════════════════════════════
// 16. notificarTarefaFirestore — grava notificação no Firestore
//     para qualquer tarefa delegada a outra pessoa (multi-device)
// ════════════════════════════════════════════════════════════════
exports.notificarTarefaFirestore = functions
  .region(REGION)
  .firestore.document("dailyTarefas/{tarefaId}")
  .onCreate(async (snap, context) => {
    const t = snap.data();
    if (!t.responsavelId || t.criadoPorId === t.responsavelId) return;
    try {
      await db.collection("notificacoes").doc(t.responsavelId)
        .collection("items").doc(context.params.tarefaId).set({
          tipo: t.tipo || "tarefa",
          tarefaId: context.params.tarefaId,
          descricao: t.descricao || "",
          equipe: t.equipe || "",
          data: t.data || "",
          criadoPorNome: t.criadoPorNome || "",
          lida: false,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      logger.error("notificarTarefaFirestore: erro", { tarefaId: snap.id, err: err.message });
    }
  });

// ════════════════════════════════════════════════════════════════
// 17. getDadosFinanceiros (callable) — retorna dados financeiros
//     de forma segura: todos (MASTER/RH), equipe (LIDER), próprio
// ════════════════════════════════════════════════════════════════
exports.getDadosFinanceiros = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Autenticacao necessaria.");
    const role   = context.auth.token?.role || "COLABORADOR";
    const uid    = context.auth.uid;
    const equipe = context.auth.token?.equipe || "";

    let ids = [];
    if (role === "MASTER" || role === "RH") {
      const snap = await db.collection("colaboradores").where("ativo", "==", true).get();
      ids = snap.docs.map((d) => d.id);
    } else if (role === "LIDER") {
      const snap = await db.collection("colaboradores")
        .where("ativo", "==", true).where("equipe", "==", equipe).get();
      ids = snap.docs.map((d) => d.id);
    } else {
      ids = [uid];
    }

    const results = await Promise.all(ids.map(async (id) => {
      const finSnap = await db.collection("colaboradores").doc(id)
        .collection("financeiro").doc("dados").get();
      return { id, ...(finSnap.exists ? finSnap.data() : {}) };
    }));
    return results;
  });

// ════════════════════════════════════════════════════════════════
// 18. authUserCriado — detecta usuário Auth sem doc Firestore
//     (órfão de cadastro) e cria registro mínimo + alerta MASTER
// ════════════════════════════════════════════════════════════════
exports.authUserCriado = functions
  .region(REGION)
  .auth.user().onCreate(async (userRecord) => {
    const email = userRecord.email;
    if (!email) return;

    // Verifica se já existe doc com este email (cadastro normal)
    const snap = await db.collection("colaboradores").where("email", "==", email).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      if (!doc.data().authUid) {
        await doc.ref.update({ authUid: userRecord.uid });
        logger.info("authUserCriado: authUid vinculado a doc existente", { uid: userRecord.uid, email });
      }
      return;
    }

    // Nenhum doc — cria registro mínimo marcado como órfão
    await db.collection("colaboradores").doc(userRecord.uid).set({
      email,
      nome: userRecord.displayName || email.split("@")[0],
      authUid: userRecord.uid,
      ativo: false,
      role: "COLABORADOR",
      equipe: "",
      _orfao: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notifica todos os MASTERs via Firestore (aparece no sino)
    const masterSnap = await db.collection("colaboradores")
      .where("role", "==", "MASTER").where("ativo", "==", true).get();
    if (!masterSnap.empty) {
      const batch = db.batch();
      masterSnap.docs.forEach((masterDoc) => {
        const notifRef = db.collection("notificacoes").doc(masterDoc.id).collection("items").doc();
        batch.set(notifRef, {
          tipo: "orfao_detectado",
          email,
          authUid: userRecord.uid,
          descricao: `Usuario sem perfil cadastrado: ${email}`,
          lida: false,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
    logger.warn("authUserCriado: usuario orfao detectado", { uid: userRecord.uid, email });
  });

// ════════════════════════════════════════════════════════════════
// 20. registrarAuditoria (helper interno — não é export HTTP)
// ════════════════════════════════════════════════════════════════
async function registrarAuditoria({ acao, entidade, entidadeId, antes, depois, autorId, autorNome, autorEmail }) {
  try {
    await db.collection("logsAuditoria").add({
      acao,
      entidade,
      entidadeId: entidadeId || null,
      antes: antes || null,
      depois: depois || null,
      autorId: autorId || null,
      autorNome: autorNome || null,
      autorEmail: autorEmail || null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.error("registrarAuditoria: falha ao gravar log", e.message);
  }
}

// ════════════════════════════════════════════════════════════════
// 21. auditarColaborador — loga alterações críticas no doc do colaborador
//     (role, equipe, ativo, salário via subcoleção financeiro)
// ════════════════════════════════════════════════════════════════
exports.auditarColaborador = functions
  .region(REGION)
  .firestore.document("colaboradores/{colabId}")
  .onWrite(async (change, context) => {
    const colabId = context.params.colabId;
    const before  = change.before.exists ? change.before.data() : null;
    const after   = change.after.exists  ? change.after.data()  : null;

    // Exclusão (ativo=false é desativação, delete real não ocorre pela rule)
    if (!after) {
      await registrarAuditoria({
        acao: "colaborador_excluido",
        entidade: "colaboradores",
        entidadeId: colabId,
        antes: { nome: before?.nome, email: before?.email, role: before?.role },
        autorId: null, autorNome: "sistema",
      });
      return;
    }

    const campos = [];
    if (before && before.role !== after.role)
      campos.push({ campo: "role", de: before.role, para: after.role });
    if (before && before.equipe !== after.equipe)
      campos.push({ campo: "equipe", de: before.equipe, para: after.equipe });
    if (before && before.ativo !== after.ativo)
      campos.push({ campo: "ativo", de: before.ativo, para: after.ativo });

    if (!campos.length) return;

    await registrarAuditoria({
      acao: "colaborador_alterado",
      entidade: "colaboradores",
      entidadeId: colabId,
      antes: Object.fromEntries(campos.map(c => [c.campo, c.de])),
      depois: Object.fromEntries(campos.map(c => [c.campo, c.para])),
      autorNome: after.atualizadoPorNome || null,
      autorEmail: after.atualizadoPorEmail || null,
    });
  });

// ════════════════════════════════════════════════════════════════
// 22. auditarFinanceiro — loga alterações de salário/VT/CNPJ
// ════════════════════════════════════════════════════════════════
exports.auditarFinanceiro = functions
  .region(REGION)
  .firestore.document("colaboradores/{colabId}/financeiro/dados")
  .onWrite(async (change, context) => {
    const colabId = context.params.colabId;
    const before  = change.before.exists ? change.before.data() : null;
    const after   = change.after.exists  ? change.after.data()  : null;

    const camposSalario = ["salario", "valorVT", "cnpj", "razaoSocial", "tipoContrato", "dataAdmissao"];
    const alteracoes = {};
    const anteriores = {};

    camposSalario.forEach(campo => {
      const vAntes = before ? (before[campo] ?? null) : null;
      const vDepois = after ? (after[campo] ?? null) : null;
      if (vAntes !== vDepois) {
        anteriores[campo] = vAntes;
        alteracoes[campo] = vDepois;
      }
    });

    if (!Object.keys(alteracoes).length) return;

    // Busca nome do colaborador para o log
    let nomeColab = colabId;
    try {
      const snap = await db.collection("colaboradores").doc(colabId).get();
      if (snap.exists) nomeColab = snap.data().nome || colabId;
    } catch (e) {}

    await registrarAuditoria({
      acao: "financeiro_alterado",
      entidade: "colaboradores/financeiro",
      entidadeId: colabId,
      antes: anteriores,
      depois: alteracoes,
      autorNome: after?._alteradoPorNome || null,
      autorEmail: after?._alteradoPorEmail || null,
    });
  });

// ════════════════════════════════════════════════════════════════
// 23. auditarAvaliacao — loga criação e exclusão de avaliações
// ════════════════════════════════════════════════════════════════
exports.auditarAvaliacao = functions
  .region(REGION)
  .firestore.document("avaliacoes/{avalId}")
  .onWrite(async (change, context) => {
    const avalId = context.params.avalId;
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;

    if (!before && after) {
      await registrarAuditoria({
        acao: "avaliacao_criada",
        entidade: "avaliacoes",
        entidadeId: avalId,
        depois: { colaboradorId: after.colaboradorId, equipe: after.equipe, trimestre: after.trimestre, ano: after.ano, notaFinal: after.notaFinal, bonusPercent: after.bonusPercent },
        autorNome: after.criadoPorNome || null,
      });
    } else if (before && !after) {
      await registrarAuditoria({
        acao: "avaliacao_excluida",
        entidade: "avaliacoes",
        entidadeId: avalId,
        antes: { colaboradorId: before.colaboradorId, equipe: before.equipe, trimestre: before.trimestre, ano: before.ano, notaFinal: before.notaFinal },
        autorNome: null,
      });
    }
  });

// ════════════════════════════════════════════════════════════════
// 24. uploadNFDrive — upload de NF para Google Drive
// ════════════════════════════════════════════════════════════════
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function driveFindOrCreateFolder(token, name, parentId) {
  const q = `name='${name.replace(/'/g,"\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const createData = await createRes.json();
  if (!createData.id) throw new Error('Falha ao criar pasta: ' + JSON.stringify(createData));
  return createData.id;
}

exports.uploadNFDrive = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login obrigatório.');

    const { lancId, fileBase64, mimeType } = data;
    if (!lancId || !fileBase64) throw new functions.https.HttpsError('invalid-argument', 'Campos obrigatórios ausentes.');

    const lancDoc = await db.collection('lancamentosVTVR').doc(lancId).get();
    if (!lancDoc.exists) throw new functions.https.HttpsError('not-found', 'Lançamento não encontrado.');
    const lanc = lancDoc.data();

    const configDoc = await db.collection('configs').doc('drive').get();
    const rootFolderId = configDoc.exists ? configDoc.data().nfFolderId : null;
    if (!rootFolderId) throw new functions.https.HttpsError('failed-precondition', 'Pasta do Drive não configurada. Acesse Configurações > Drive e informe o ID da pasta raiz.');

    const ano = lanc.anoCalculo || lanc.ano || new Date().getFullYear();
    const mes = lanc.mesCalculo || lanc.mes || new Date().getMonth() + 1;
    const mesNome = MESES_PT[mes - 1] || String(mes);
    const valorFmt = (lanc.total || 0).toFixed(2).replace('.', ',');
    const fileName = `${lanc.nome} - R$ ${valorFmt} - ${mesNome}.${ano}.pdf`;

    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = tokenRes.token;

    const yearFolderId  = await driveFindOrCreateFolder(token, String(lanc.ano || ano), rootFolderId);
    const monthFolderId = await driveFindOrCreateFolder(token, mesNome, yearFolderId);

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const boundary = 'MiraeNFUpload';
    const metaJson = JSON.stringify({ name: fileName, parents: [monthFolderId] });
    const pre  = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/pdf'}\r\n\r\n`, 'utf-8');
    const post = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
    const body = Buffer.concat([pre, fileBuffer, post]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.id) throw new functions.https.HttpsError('internal', 'Falha no upload para o Drive: ' + JSON.stringify(uploadData));

    const driveUrl = uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
    const dadosAtuais = lanc;
    const hist = dadosAtuais.nfHistorico || [];
    if (dadosAtuais.nfNome) hist.push({ nfNome: dadosAtuais.nfNome, nfUrl: dadosAtuais.nfUrl || '', enviadoEm: dadosAtuais.nfUploadEm || '' });

    await db.collection('lancamentosVTVR').doc(lancId).update({
      nfNome: fileName,
      nfUrl: driveUrl,
      nfDriveId: uploadData.id,
      nfUploadEm: new Date().toLocaleString('pt-BR'),
      nfUploadPor: context.auth.token.name || context.auth.uid,
      statusNF: 'emitida',
      nfHistorico: hist,
    });

    return { driveUrl, fileName };
  });

// 25. uploadNFRemuneracao — NF de remuneração PJ para o Drive
// ════════════════════════════════════════════════════════════════
exports.uploadNFRemuneracao = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login obrigatório.');

    const { lancId, fileBase64, mimeType } = data;
    if (!lancId || !fileBase64) throw new functions.https.HttpsError('invalid-argument', 'Campos obrigatórios ausentes.');

    const lancDoc = await db.collection('lancamentosRemuneracao').doc(lancId).get();
    if (!lancDoc.exists) throw new functions.https.HttpsError('not-found', 'Lançamento não encontrado.');
    const lanc = lancDoc.data();

    // Usa a mesma pasta raiz de NFs, com subpasta "Remuneração"
    const configDoc = await db.collection('configs').doc('drive').get();
    const rootFolderId = configDoc.exists ? configDoc.data().nfFolderId : null;
    if (!rootFolderId) throw new functions.https.HttpsError('failed-precondition', 'Pasta do Drive não configurada. Acesse VT/VR > Configurações > Drive.');

    const mes = lanc.mes || new Date().getMonth() + 1;
    const ano = lanc.ano || new Date().getFullYear();
    const mesNome = MESES_PT[mes - 1] || String(mes);
    const valorFmt = (lanc.valorFinal || 0).toFixed(2).replace('.', ',');
    const fileName = `${lanc.nome} - R$ ${valorFmt} - ${mesNome}.${ano}.pdf`;

    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive'] });
    const client = await auth.getClient();
    const token = (await client.getAccessToken()).token;

    // Estrutura: raiz / Remuneração / Ano / Mês
    const remuFolderId  = await driveFindOrCreateFolder(token, 'Remuneração', rootFolderId);
    const yearFolderId  = await driveFindOrCreateFolder(token, String(ano), remuFolderId);
    const monthFolderId = await driveFindOrCreateFolder(token, mesNome, yearFolderId);

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const boundary = 'MiraeRemuUpload';
    const metaJson = JSON.stringify({ name: fileName, parents: [monthFolderId] });
    const pre  = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/pdf'}\r\n\r\n`, 'utf-8');
    const post = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
    const body = Buffer.concat([pre, fileBuffer, post]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.length) },
      body,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.id) throw new functions.https.HttpsError('internal', 'Falha no upload: ' + JSON.stringify(uploadData));

    const driveUrl = uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
    const hist = (lanc.nfHistorico || []);
    if (lanc.nfNome) hist.push({ nfNome: lanc.nfNome, nfUrl: lanc.nfUrl || '', enviadoEm: lanc.nfUploadEm || '' });

    await db.collection('lancamentosRemuneracao').doc(lancId).update({
      nfNome: fileName, nfUrl: driveUrl, nfDriveId: uploadData.id,
      nfUploadEm: new Date().toLocaleString('pt-BR'),
      nfUploadPor: context.auth.token.name || context.auth.uid,
      statusNF: 'emitida', status: 'nf_recebida', nfHistorico: hist,
    });

    return { driveUrl, fileName };
  });
