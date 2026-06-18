/**
 * Testes unitários para funções puras de utils.js
 * As funções são copiadas aqui sem dependência do DOM ou Firebase.
 */

// ── Funções extraídas de utils.js ──────────────────────────────

function temJustificativaValida(t) {
  return !!(t.justificativa && t.justificativa.trim()) && t.justificativaAceita !== false;
}

function foiAdiada(t) {
  return (t.adiamentos || 0) > 0;
}

function atendidaMesmoDia(t) {
  if (t.status !== 'concluida') return false;
  if (t.concluidaEmData) return t.concluidaEmData === t.data;
  return (t.adiamentos || 0) === 0;
}

function diaAnterior(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function fmtDataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ── temJustificativaValida ────────────────────────────────────

describe('temJustificativaValida', () => {
  test('retorna true quando justificativa está preenchida e aceita é undefined', () => {
    expect(temJustificativaValida({ justificativa: 'motivo válido' })).toBe(true);
  });

  test('retorna false quando justificativa é string vazia', () => {
    expect(temJustificativaValida({ justificativa: '' })).toBe(false);
  });

  test('retorna false quando justificativa é apenas espaços', () => {
    expect(temJustificativaValida({ justificativa: '   ' })).toBe(false);
  });

  test('retorna false quando justificativaAceita é false', () => {
    expect(temJustificativaValida({ justificativa: 'motivo', justificativaAceita: false })).toBe(false);
  });

  test('retorna true quando justificativaAceita é true explícito', () => {
    expect(temJustificativaValida({ justificativa: 'motivo', justificativaAceita: true })).toBe(true);
  });

  test('retorna false quando objeto não tem justificativa', () => {
    expect(temJustificativaValida({})).toBe(false);
  });
});

// ── foiAdiada ─────────────────────────────────────────────────

describe('foiAdiada', () => {
  test('retorna true quando adiamentos > 0', () => {
    expect(foiAdiada({ adiamentos: 1 })).toBe(true);
    expect(foiAdiada({ adiamentos: 5 })).toBe(true);
  });

  test('retorna false quando adiamentos é 0', () => {
    expect(foiAdiada({ adiamentos: 0 })).toBe(false);
  });

  test('retorna false quando adiamentos está ausente', () => {
    expect(foiAdiada({})).toBe(false);
  });
});

// ── atendidaMesmoDia ──────────────────────────────────────────

describe('atendidaMesmoDia', () => {
  test('retorna false se status não é concluida', () => {
    expect(atendidaMesmoDia({ status: 'pendente', data: '2024-01-15' })).toBe(false);
    expect(atendidaMesmoDia({ status: 'em_andamento', data: '2024-01-15' })).toBe(false);
  });

  test('retorna true quando concluidaEmData === data', () => {
    expect(atendidaMesmoDia({ status: 'concluida', data: '2024-01-15', concluidaEmData: '2024-01-15' })).toBe(true);
  });

  test('retorna false quando concluidaEmData !== data', () => {
    expect(atendidaMesmoDia({ status: 'concluida', data: '2024-01-15', concluidaEmData: '2024-01-16' })).toBe(false);
  });

  test('fallback: retorna true quando concluida sem concluidaEmData e sem adiamentos', () => {
    expect(atendidaMesmoDia({ status: 'concluida', data: '2024-01-15' })).toBe(true);
  });

  test('fallback: retorna false quando concluida sem concluidaEmData mas com adiamentos', () => {
    expect(atendidaMesmoDia({ status: 'concluida', data: '2024-01-15', adiamentos: 2 })).toBe(false);
  });
});

// ── diaAnterior ───────────────────────────────────────────────

describe('diaAnterior', () => {
  test('retorna o dia anterior ao ISO fornecido', () => {
    expect(diaAnterior('2024-01-15')).toBe('2024-01-14');
  });

  test('cruza corretamente para o mês anterior', () => {
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29'); // 2024 é bissexto
  });

  test('cruza corretamente para o ano anterior', () => {
    expect(diaAnterior('2024-01-01')).toBe('2023-12-31');
  });
});

// ── fmtDataBR ─────────────────────────────────────────────────

describe('fmtDataBR', () => {
  test('formata ISO para dd/mm/aaaa', () => {
    expect(fmtDataBR('2024-03-15')).toBe('15/03/2024');
  });

  test('retorna string vazia para valor falsy', () => {
    expect(fmtDataBR('')).toBe('');
    expect(fmtDataBR(null)).toBe('');
    expect(fmtDataBR(undefined)).toBe('');
  });

  test('formata datas de início de mês corretamente', () => {
    expect(fmtDataBR('2024-01-01')).toBe('01/01/2024');
  });
});
