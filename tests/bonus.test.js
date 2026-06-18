/**
 * Testes unitários para calcularValorBonus e getMultiplicadorVigente (bonus.js)
 * Funções puras extraídas sem dependência do DOM ou Firebase.
 */

// ── Funções extraídas de bonus.js ─────────────────────────────

function calcularValorBonus(config, salario, bonusPercent) {
  if (!config) return salario * (bonusPercent / 100) * 1.0;
  if (config.tipo === 'fixo' && config.valorFixo) return config.valorFixo * (bonusPercent / 100);
  return salario * (bonusPercent / 100) * (config.multiplicador || 1.0);
}

function getMultiplicadorVigente(bonusConfigs, equipe, trimestre, ano) {
  const c = bonusConfigs.filter(
    c => c.equipe === equipe && String(c.trimestre) === String(trimestre) && c.ano === ano
  );
  return c.length ? c[0] : null;
}

// ── calcularValorBonus ────────────────────────────────────────

describe('calcularValorBonus', () => {
  test('sem config: usa multiplicador 1x padrão', () => {
    expect(calcularValorBonus(null, 5000, 100)).toBe(5000);
    expect(calcularValorBonus(null, 5000, 50)).toBe(2500);
    expect(calcularValorBonus(null, 4000, 75)).toBe(3000);
  });

  test('config tipo multiplicador aplica corretamente', () => {
    const config = { tipo: 'multiplicador', multiplicador: 1.5 };
    expect(calcularValorBonus(config, 4000, 100)).toBe(6000);
    expect(calcularValorBonus(config, 4000, 50)).toBe(3000);
  });

  test('config tipo multiplicador com 0.5x', () => {
    const config = { tipo: 'multiplicador', multiplicador: 0.5 };
    expect(calcularValorBonus(config, 4000, 100)).toBe(2000);
  });

  test('config tipo fixo ignora salário base', () => {
    const config = { tipo: 'fixo', valorFixo: 1500 };
    expect(calcularValorBonus(config, 10000, 100)).toBe(1500);
    expect(calcularValorBonus(config, 10000, 50)).toBe(750);
  });

  test('config tipo fixo com bonusPercent 0 retorna 0', () => {
    const config = { tipo: 'fixo', valorFixo: 1500 };
    expect(calcularValorBonus(config, 5000, 0)).toBe(0);
  });

  test('config multiplicador sem campo multiplicador cai no padrão 1x', () => {
    const config = { tipo: 'multiplicador' }; // multiplicador ausente
    expect(calcularValorBonus(config, 5000, 100)).toBe(5000);
  });

  test('config fixo sem valorFixo: não entra na branch fixo (valorFixo falsy)', () => {
    const config = { tipo: 'fixo', valorFixo: 0 };
    // valorFixo é 0 (falsy), cai no branch multiplicador
    expect(calcularValorBonus(config, 5000, 100)).toBeCloseTo(5000);
  });
});

// ── getMultiplicadorVigente ───────────────────────────────────

describe('getMultiplicadorVigente', () => {
  const configs = [
    { equipe: 'Vendas', trimestre: 1, ano: 2024, multiplicador: 1.5, tipo: 'multiplicador' },
    { equipe: 'Vendas', trimestre: 2, ano: 2024, multiplicador: 2.0, tipo: 'multiplicador' },
    { equipe: 'Suporte', trimestre: 1, ano: 2024, valorFixo: 800, tipo: 'fixo' },
  ];

  test('retorna o config correto para equipe/trimestre/ano', () => {
    const result = getMultiplicadorVigente(configs, 'Vendas', 1, 2024);
    expect(result).not.toBeNull();
    expect(result.multiplicador).toBe(1.5);
  });

  test('retorna null quando não há config para o trimestre', () => {
    expect(getMultiplicadorVigente(configs, 'Vendas', 3, 2024)).toBeNull();
  });

  test('retorna null quando equipe não existe', () => {
    expect(getMultiplicadorVigente(configs, 'TI', 1, 2024)).toBeNull();
  });

  test('retorna null quando ano não bate', () => {
    expect(getMultiplicadorVigente(configs, 'Vendas', 1, 2023)).toBeNull();
  });

  test('tolera trimestre como string ou número (String coercion)', () => {
    expect(getMultiplicadorVigente(configs, 'Vendas', '1', 2024)).not.toBeNull();
    expect(getMultiplicadorVigente(configs, 'Vendas', 1, 2024)).not.toBeNull();
  });

  test('retorna config de tipo fixo corretamente', () => {
    const result = getMultiplicadorVigente(configs, 'Suporte', 1, 2024);
    expect(result).not.toBeNull();
    expect(result.tipo).toBe('fixo');
    expect(result.valorFixo).toBe(800);
  });

  test('retorna null para lista vazia', () => {
    expect(getMultiplicadorVigente([], 'Vendas', 1, 2024)).toBeNull();
  });
});
