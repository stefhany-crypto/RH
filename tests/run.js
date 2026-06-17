/**
 * Testes unitários — lógica de negócio VT/VR
 * Execute com: node tests/run.js
 *
 * Zero dependências externas. As funções puras são copiadas aqui isoladas
 * do DOM e do Firebase para que os testes rodem em qualquer ambiente.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// Funções puras extraídas de vtvr.js
// ─────────────────────────────────────────────────────────────

/** Conta ocorrências de um dia da semana (0=Dom…6=Sáb) num mês. */
function contarDias(mes, ano, diaSemana) {
    let count = 0;
    const totalDias = new Date(ano, mes, 0).getDate(); // último dia do mês
    for (let d = 1; d <= totalDias; d++) {
        if (new Date(ano, mes - 1, d).getDay() === diaSemana) count++;
    }
    return count;
}

/**
 * Dias obrigatórios de presença para cálculo de VT.
 * CLT → segundas (1) + quintas (4)
 * PJ  → só quintas (4)
 */
function diasObrigatorios(mes, ano, tipoContrato) {
    const quintas  = contarDias(mes, ano, 4);
    const segundas = contarDias(mes, ano, 1);
    return tipoContrato === 'CLT' ? quintas + segundas : quintas;
}

/**
 * Mês/ano de referência para PJ (mês ANTERIOR ao selecionado).
 * Cuida da virada de ano: janeiro → dezembro do ano anterior.
 */
function mesRefPJ(mes, ano) {
    return { mes: mes === 1 ? 12 : mes - 1, ano: mes === 1 ? ano - 1 : ano };
}

/**
 * Mês/ano de referência para CLT (mês SEGUINTE ao selecionado).
 * Cuida da virada de ano: dezembro → janeiro do ano seguinte.
 */
function mesRefCLT(mes, ano) {
    return { mes: mes === 12 ? 1 : mes + 1, ano: mes === 12 ? ano + 1 : ano };
}

/**
 * 5º dia útil do mês seguinte ao mês informado.
 * Usado como data de vencimento no export Omie (exportarOmieVTVR).
 * Cuida da virada de ano: dezembro → janeiro do ano seguinte.
 */
function quintoDiaUtil(mes, ano) {
    const proxMes = mes === 12 ? 1  : mes + 1;
    const proxAno = mes === 12 ? ano + 1 : ano;
    let countUtil = 0;
    let dUtil = new Date(proxAno, proxMes - 1, 1);
    while (countUtil < 5) {
        const dow = dUtil.getDay();
        if (dow !== 0 && dow !== 6) countUtil++;
        if (countUtil < 5) dUtil.setDate(dUtil.getDate() + 1);
    }
    return dUtil;
}

// ─────────────────────────────────────────────────────────────
// Runner mínimo — sem dependência de framework
// ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const VERDE = '\x1b[32m✓\x1b[0m';
const VERM  = '\x1b[31m✗\x1b[0m';

function ok(desc, cond) {
    if (cond) { console.log(`  ${VERDE}  ${desc}`); passed++; }
    else       { console.error(`  ${VERM}  ${desc}`);  failed++; }
}
function eq(desc, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    if (!pass) console.error(`     ← recebeu ${JSON.stringify(actual)}, esperava ${JSON.stringify(expected)}`);
    ok(desc, pass);
}

// ─────────────────────────────────────────────────────────────
// Suite 1 — contarDias
// ─────────────────────────────────────────────────────────────
console.log('\ncontarDias');

// Janeiro 2025 começa quarta-feira
eq('jan/2025: 4 segundas', contarDias(1, 2025, 1), 4);
eq('jan/2025: 5 quintas',  contarDias(1, 2025, 4), 5);

// Fevereiro 2025 começa sábado (ano não bissexto)
eq('fev/2025: 4 segundas', contarDias(2, 2025, 1), 4);
eq('fev/2025: 4 quintas',  contarDias(2, 2025, 4), 4);

// Fevereiro 2024 começa quinta-feira (ano bissexto, 29 dias)
eq('fev/2024 (bissexto): 4 segundas', contarDias(2, 2024, 1), 4);
eq('fev/2024 (bissexto): 5 quintas',  contarDias(2, 2024, 4), 5);

// Dezembro 2024 começa domingo
eq('dez/2024: 5 segundas', contarDias(12, 2024, 1), 5);
eq('dez/2024: 4 quintas',  contarDias(12, 2024, 4), 4);

// ─────────────────────────────────────────────────────────────
// Suite 2 — diasObrigatorios
// ─────────────────────────────────────────────────────────────
console.log('\ndias obrigatórios (presença VT)');

eq('jan/2025 CLT: 9 dias (4 seg + 5 qui)', diasObrigatorios(1,  2025, 'CLT'), 9);
eq('jan/2025 PJ:  5 dias (só qui)',         diasObrigatorios(1,  2025, 'PJ'),  5);
eq('fev/2025 CLT: 8 dias (4+4)',            diasObrigatorios(2,  2025, 'CLT'), 8);
eq('fev/2025 PJ:  4 dias',                  diasObrigatorios(2,  2025, 'PJ'),  4);
eq('fev/2024 CLT: 9 dias (4+5, bissexto)',  diasObrigatorios(2,  2024, 'CLT'), 9);
eq('fev/2024 PJ:  5 dias (bissexto)',       diasObrigatorios(2,  2024, 'PJ'),  5);
eq('dez/2024 CLT: 9 dias (5+4)',            diasObrigatorios(12, 2024, 'CLT'), 9);
eq('dez/2024 PJ:  4 dias',                  diasObrigatorios(12, 2024, 'PJ'),  4);

// Caso extremo: mês com 31 dias começando segunda
// Março 2025 começa sábado; 5 segundas? Seg=3,10,17,24,31 → 5; Qui=6,13,20,27 → 4
eq('mar/2025 CLT: 9 dias (5+4)',            diasObrigatorios(3,  2025, 'CLT'), 9);
eq('mar/2025 PJ:  4 dias',                  diasObrigatorios(3,  2025, 'PJ'),  4);

// ─────────────────────────────────────────────────────────────
// Suite 3 — mês de referência PJ (mês ANTERIOR)
// ─────────────────────────────────────────────────────────────
console.log('\nmês de referência PJ (reembolso do mês anterior)');

eq('jan/2025 PJ → dez/2024',  mesRefPJ(1,  2025), { mes: 12, ano: 2024 });
eq('fev/2025 PJ → jan/2025',  mesRefPJ(2,  2025), { mes: 1,  ano: 2025 });
eq('dez/2025 PJ → nov/2025',  mesRefPJ(12, 2025), { mes: 11, ano: 2025 });
eq('mar/2024 PJ → fev/2024',  mesRefPJ(3,  2024), { mes: 2,  ano: 2024 });

// ─────────────────────────────────────────────────────────────
// Suite 4 — mês de referência CLT (mês SEGUINTE)
// ─────────────────────────────────────────────────────────────
console.log('\nmês de referência CLT (adiantamento do mês seguinte)');

eq('dez/2025 CLT → jan/2026',  mesRefCLT(12, 2025), { mes: 1,  ano: 2026 });
eq('nov/2025 CLT → dez/2025',  mesRefCLT(11, 2025), { mes: 12, ano: 2025 });
eq('jan/2025 CLT → fev/2025',  mesRefCLT(1,  2025), { mes: 2,  ano: 2025 });
eq('mar/2024 CLT → abr/2024',  mesRefCLT(3,  2024), { mes: 4,  ano: 2024 });

// ─────────────────────────────────────────────────────────────
// Suite 5 — 5º dia útil (vencimento Omie)
// ─────────────────────────────────────────────────────────────
console.log('\n5º dia útil do mês seguinte (vencimento Omie)');

function fmtData(d) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

// Período dez/2024 → 5º dia útil de jan/2025
// Jan/2025 começa qua: qua(1),qui(2),sex(3),sáb-dom pulados,seg(6),ter(7) → 07/01/2025
eq('dez/2024 → 5º útil jan/2025 = 07/01/2025', fmtData(quintoDiaUtil(12, 2024)), '07/01/2025');

// Período nov/2024 → 5º dia útil de dez/2024
// Dez/2024 começa dom: dom pulado, seg(2),ter(3),qua(4),qui(5),sex(6) → 06/12/2024
eq('nov/2024 → 5º útil dez/2024 = 06/12/2024', fmtData(quintoDiaUtil(11, 2024)), '06/12/2024');

// Período jan/2025 → 5º dia útil de fev/2025
// Fev/2025 começa sáb: sáb-dom pulados, seg(3),ter(4),qua(5),qui(6),sex(7) → 07/02/2025
eq('jan/2025 → 5º útil fev/2025 = 07/02/2025', fmtData(quintoDiaUtil(1, 2025)), '07/02/2025');

// Período out/2024 → 5º dia útil de nov/2024
// Nov/2024 começa sex: sex(1),sáb-dom pulados,seg(4),ter(5),qua(6),qui(7) → 07/11/2024
eq('out/2024 → 5º útil nov/2024 = 07/11/2024', fmtData(quintoDiaUtil(10, 2024)), '07/11/2024');

// Período mar/2025 → 5º dia útil de abr/2025
// Abr/2025 começa ter: ter(1),qua(2),qui(3),sex(4),sáb-dom pulados,seg(7) → wait
// Abr/2025: ter(1)=1, qua(2), qui(3), sex(4) = 4 dias úteis; sáb(5),dom(6) skip; seg(7) = 5th
eq('mar/2025 → 5º útil abr/2025 = 07/04/2025', fmtData(quintoDiaUtil(3, 2025)), '07/04/2025');

// Virada de ano: dez/2023 → jan/2024
// Jan/2024 começa seg: seg(1),ter(2),qua(3),qui(4),sex(5) → 05/01/2024
eq('dez/2023 → 5º útil jan/2024 = 05/01/2024', fmtData(quintoDiaUtil(12, 2023)), '05/01/2024');

// ─────────────────────────────────────────────────────────────
// Resumo
// ─────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${passed}/${total} testes passaram` + (failed ? ` — \x1b[31m${failed} FALHOU\x1b[0m` : ' \x1b[32m✓ tudo ok\x1b[0m'));
if (failed > 0) process.exit(1);
