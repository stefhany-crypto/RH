// ================================================================
// MIRAE — Trabalhe Conosco — Google Apps Script Backend
// 1. Abra a planilha no Google Sheets
// 2. Extensões → Apps Script → cole este código → salvar
// 3. Implantar → Nova implantação → Web App
//    Executar como: Eu / Quem tem acesso: Qualquer pessoa
// 4. Copie a URL da implantação e cole em trabalheConosco.js e vagas-publico.js
// ================================================================

const SS_ID       = '1iIMMgdgDf6uCE35_VumhbE00PUBwnWqPrDLTo4V0V4g';
const ADMIN_TOKEN = 'MIRAE_VAGAS_2026'; // altere depois se quiser

// ── Criar abas na primeira execução ──────────────────────────
function setup() {
  const ss = SpreadsheetApp.openById(SS_ID);
  _criarAba(ss, 'Vagas', [
    'id','titulo','area','descricao','perfilDesejado',
    'competenciasObrigatorias','competenciasDesejaveis',
    'discD','discI','discS','discC','eneagramas',
    'ativo','criadoEm','criadoPor'
  ]);
  _criarAba(ss, 'Candidatos', [
    'id','vagaId','vagaTitulo','nome','telefone',
    'conheceCultura','comoSoube','comunidade','experiencia','linkedin',
    'respostasBloco1','respostasBloco2','respostasBloco3',
    'discD','discI','discS','discC','discPerfil',
    'eneagramaPrincipal','eneagramaAsa','eneagramaSegunda','eneagramaConfianca',
    'fitCultural','fitVaga','notaCompetencias','confiabilidade','notaFinal',
    'competencias','alertas','sugestao','status','analisadoPorIA','analiseGemini','submissaoEm'
  ]);
  _criarAba(ss, 'Config', ['chave','valor']);
  const cfg = ss.getSheetByName('Config');
  if (cfg.getLastRow() < 2) {
    cfg.getRange('A2:B3').setValues([
      ['culturaEmpresa', 'Inovação, responsabilidade, colaboração e excelência — honramos vidas com precisão.'],
      ['geminiApiKey',   '']  // cole sua chave da Gemini API aqui para usar o botão "Analisar com IA"
    ]);
  }
  return _json({ ok: true, msg: 'Setup concluído! Abas Vagas, Candidatos e Config criadas.' });
}

// ── Helpers de planilha ──────────────────────────────────────
function _criarAba(ss, nome, headers) {
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    const r = sh.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    r.setFontWeight('bold').setBackground('#023B48').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _sheet(nome) {
  return SpreadsheetApp.openById(SS_ID).getSheetByName(nome);
}

function _toArray(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  return vals.slice(1).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i]]))
  );
}

function _findRow(sh, col, val) {
  const data = sh.getDataRange().getValues();
  const idx  = data[0].indexOf(col);
  if (idx < 0) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(val)) return i + 1;
  }
  return -1;
}

function _setCell(sh, row, col, val) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(col);
  if (idx >= 0) sh.getRange(row, idx + 1).setValue(val);
}

function _appendRow(sh, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h => (obj.hasOwnProperty(h) ? obj[h] : '')));
}

function _updateRow(sh, row, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (obj.hasOwnProperty(h)) sh.getRange(row, i + 1).setValue(obj[h]);
  });
}

function _getConfig(chave) {
  const rows = _toArray(_sheet('Config'));
  const r = rows.find(x => x.chave === chave);
  return r ? r.valor : '';
}

function _auth(token) {
  return String(token) === String(ADMIN_TOKEN);
}

// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  const p = e.parameter || {};
  try {
    switch (p.action) {
      case 'setup':       return setup();
      case 'vagas':       return getVagas(p);
      case 'candidatos':  return getCandidatos(p);
      case 'candidato':   return getCandidato(p);
      case 'status':      return atualizarStatus(p);
      case 'gemini':      return analisarGemini(p);
      case 'toggleVaga':  return toggleVaga(p);
      default:            return _json({ erro: 'Ação inválida' });
    }
  } catch (err) {
    return _json({ erro: err.message });
  }
}

// ── doPost ───────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case 'candidato': return salvarCandidato(data);
      case 'vaga':      return salvarVaga(data);
      default:          return _json({ erro: 'Ação inválida' });
    }
  } catch (err) {
    return _json({ erro: err.message });
  }
}

// ── Vagas ────────────────────────────────────────────────────
function getVagas(p) {
  const vagas = _toArray(_sheet('Vagas'));
  const lista = (p.todas && _auth(p.token))
    ? vagas
    : vagas.filter(v => String(v.ativo) === 'true');
  return _json(lista);
}

function salvarVaga(data) {
  if (!_auth(data.token)) return _json({ erro: 'Não autorizado' });
  const sh = _sheet('Vagas');
  if (data.id) {
    const row = _findRow(sh, 'id', data.id);
    if (row > 0) { _updateRow(sh, row, data); return _json({ ok: true, id: data.id }); }
  }
  const id = 'v_' + Date.now();
  _appendRow(sh, { ...data, id, criadoEm: new Date().toISOString(), ativo: true });
  return _json({ ok: true, id });
}

function toggleVaga(p) {
  if (!_auth(p.token)) return _json({ erro: 'Não autorizado' });
  const sh  = _sheet('Vagas');
  const row = _findRow(sh, 'id', p.id);
  if (row < 0) return _json({ erro: 'Vaga não encontrada' });
  _setCell(sh, row, 'ativo', String(p.ativo) === 'true' ? true : false);
  return _json({ ok: true });
}

// ── Candidatos ───────────────────────────────────────────────
function getCandidatos(p) {
  if (!_auth(p.token)) return _json({ erro: 'Não autorizado' });
  const all = _toArray(_sheet('Candidatos'));
  return _json(p.vagaId ? all.filter(c => String(c.vagaId) === String(p.vagaId)) : all);
}

function getCandidato(p) {
  if (!_auth(p.token)) return _json({ erro: 'Não autorizado' });
  const c = _toArray(_sheet('Candidatos')).find(r => r.id === p.id);
  return _json(c || { erro: 'Não encontrado' });
}

function salvarCandidato(data) {
  const sh = _sheet('Candidatos');
  const id = 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  _appendRow(sh, {
    id,
    vagaId:             data.vagaId          || '',
    vagaTitulo:         data.vagaTitulo       || '',
    nome:               data.nome             || '',
    telefone:           data.telefone         || '',
    conheceCultura:     data.conheceCultura   ? 'sim' : 'não',
    comoSoube:          data.comoSoube        || '',
    comunidade:         data.comunidade       || '',
    experiencia:        data.experiencia      || '',
    linkedin:           data.linkedin         || '',
    respostasBloco1:    JSON.stringify(data.respostasBloco1  || []),
    respostasBloco2:    JSON.stringify(data.respostasBloco2  || []),
    respostasBloco3:    JSON.stringify(data.respostasBloco3  || []),
    discD:              data.disc?.D          || 0,
    discI:              data.disc?.I          || 0,
    discS:              data.disc?.S          || 0,
    discC:              data.disc?.C          || 0,
    discPerfil:         data.discPerfil       || '',
    eneagramaPrincipal: data.eneagrama?.principal || '',
    eneagramaAsa:       data.eneagrama?.asa       || '',
    eneagramaSegunda:   data.eneagrama?.segunda   || '',
    eneagramaConfianca: data.eneagrama?.confianca || '',
    fitCultural:        data.fitCultural      || 0,
    fitVaga:            data.fitVaga          || 0,
    notaCompetencias:   data.notaCompetencias || 0,
    confiabilidade:     data.confiabilidade   || 0,
    notaFinal:          data.notaFinal        || 0,
    competencias:       JSON.stringify(data.competencias || {}),
    alertas:            JSON.stringify(data.alertas      || []),
    sugestao:           data.sugestao         || '',
    status:             'Novo',
    analisadoPorIA:     'não',
    analiseGemini:      '',
    submissaoEm:        new Date().toISOString(),
  });
  return _json({ ok: true, id });
}

function atualizarStatus(p) {
  if (!_auth(p.token)) return _json({ erro: 'Não autorizado' });
  const sh  = _sheet('Candidatos');
  const row = _findRow(sh, 'id', p.id);
  if (row < 0) return _json({ erro: 'Candidato não encontrado' });
  _setCell(sh, row, 'status', p.status);
  return _json({ ok: true });
}

// ── Gemini ───────────────────────────────────────────────────
function analisarGemini(p) {
  if (!_auth(p.token)) return _json({ erro: 'Não autorizado' });

  const apiKey = _getConfig('geminiApiKey');
  if (!apiKey) return _json({ erro: 'Chave Gemini não configurada. Adicione na aba Config da planilha (chave: geminiApiKey).' });

  const sh  = _sheet('Candidatos');
  const row = _findRow(sh, 'id', p.id);
  if (row < 0) return _json({ erro: 'Candidato não encontrado' });

  const cand = _toArray(sh).find(c => c.id === p.id);
  if (!cand) return _json({ erro: 'Candidato não encontrado' });

  const cultura = _getConfig('culturaEmpresa');

  const prompt = `Você é um especialista em comportamento humano e recrutamento e seleção.
Analise o candidato com base nos dados calculados pelo sistema de assessment MIRAE:

CANDIDATO: ${cand.nome}
VAGA: ${cand.vagaTitulo}

DISC (perfil: ${cand.discPerfil}):
- Executor (D): ${cand.discD}%  | Comunicador (I): ${cand.discI}%
- Planejador (S): ${cand.discS}% | Analista (C): ${cand.discC}%

ENEAGRAMA:
- Tipo principal: ${cand.eneagramaPrincipal} | Asa: ${cand.eneagramaAsa}
- Segunda hipótese: ${cand.eneagramaSegunda} | Confiança: ${cand.eneagramaConfianca}

SCORES:
- Fit Cultural: ${cand.fitCultural}% | Fit com a Vaga: ${cand.fitVaga}%
- Competências: ${cand.notaCompetencias}% | Confiabilidade: ${cand.confiabilidade}%
- NOTA FINAL: ${cand.notaFinal}%
- Sugestão do sistema: ${cand.sugestao}

COMPETÊNCIAS: ${cand.competencias}
ALERTAS: ${cand.alertas}
CULTURA DA EMPRESA: ${cultura}

Respostas Bloco 1 (comportamental): ${cand.respostasBloco1}
Respostas Bloco 2 (fit cultural, escala 1-5): ${cand.respostasBloco2}
Respostas Bloco 3 (confiabilidade, escala 1-5): ${cand.respostasBloco3}

Gere uma análise qualitativa profissional em português brasileiro com exatamente estas seções:

## Perfil Comportamental
(3-4 parágrafos: estilo de trabalho, motivadores, pontos fortes, pontos de atenção)

## Fit Cultural
(1-2 parágrafos: aderência aos valores e cultura da empresa)

## Fit com a Vaga
(1-2 parágrafos: compatibilidade com rotina e requisitos)

## Confiabilidade do Teste
(1 parágrafo: autenticidade das respostas e possíveis vieses)

## 5 Perguntas para Entrevista
(específicas para este candidato, focadas nos pontos de atenção)
1.
2.
3.
4.
5.

## Parecer Final
(1 parágrafo executivo, linguagem profissional — sem diagnósticos clínicos — lembrando que a decisão final é humana)

Use linguagem objetiva e humanizada. Evite termos clínicos ou julgamentos definitivos.`;

  try {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    });
    const resp   = UrlFetchApp.fetch(url, { method: 'POST', contentType: 'application/json', payload: body });
    const result = JSON.parse(resp.getContentText());
    const analise = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do Gemini.';

    _setCell(sh, row, 'analisadoPorIA',  'sim');
    _setCell(sh, row, 'analiseGemini',   analise);
    return _json({ ok: true, analise });
  } catch (err) {
    return _json({ erro: 'Erro Gemini: ' + err.message });
  }
}
