// Indicadores do painel. Puro: recebe pedidos com datas já em Date (sem Firebase, sem DOM).
import { soDigitos } from './pedido.js';

// ponytail: fuso fixo UTC-3 (Recife sem horário de verão desde 2019); loja em outro fuso precisa de Intl aqui
const FUSO = -3 * 3600e3;
const local = d => new Date(d.getTime() + FUSO); // getUTC* dessa data = relógio de Recife
const deLocal = d => new Date(d.getTime() - FUSO);
const DIA = 864e5;
export const VALIDOS = ['preparo', 'saiu', 'entregue'];

// período atual e o mesmo trecho do anterior (quinta 21h × quinta passada 21h; dia 15 × dia 15)
export function periodo(tipo, agora = new Date()) {
  const l = local(agora);
  const dia0 = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  let ini, iniAnt;
  if (tipo === 'hoje') { ini = dia0; iniAnt = dia0 - 7 * DIA; }
  else if (tipo === 'semana') { ini = dia0 - ((l.getUTCDay() + 6) % 7) * DIA; iniAnt = ini - 7 * DIA; }
  else { ini = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1); iniAnt = Date.UTC(l.getUTCFullYear(), l.getUTCMonth() - 1, 1); }
  const fimAnt = Math.min(iniAnt + (l - ini), ini); // mês anterior mais curto não invade o atual
  return { ini: deLocal(new Date(ini)), fim: agora, iniAnt: deLocal(new Date(iniAnt)), fimAnt: deLocal(new Date(fimAnt)) };
}

// período livre: datas 'AAAA-MM-DD' de Recife, "até" incluso. Compara com os mesmos N dias logo antes;
// se o período chega em hoje, os dois param no mesmo ponto (como em periodo())
export function intervalo(de, ate, agora = new Date()) {
  const ini = Date.parse(de), fimDia = Date.parse(ate) + DIA, fim = Math.min(fimDia, local(agora).getTime());
  const iniAnt = ini - (fimDia - ini);
  return { ini: deLocal(new Date(ini)), fim: deLocal(new Date(fim)), iniAnt: deLocal(new Date(iniAnt)), fimAnt: deLocal(new Date(iniAnt + fim - ini)) };
}

// soma valores por chave e ordena do maior pro menor: [[chave, total], ...]
function ranking(pedidos, pares) {
  const m = {};
  pedidos.forEach(p => pares(p).forEach(([k, v]) => { m[k] = (m[k] || 0) + v; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export function calcular(pedidos, { ini, fim }, clientes = {}) {
  const dentro = pedidos.filter(p => p.criadoEm >= ini && p.criadoEm < fim);
  const ok = dentro.filter(p => VALIDOS.includes(p.status));
  const faturamento = ok.reduce((s, p) => s + p.subtotal, 0);
  const pico = {};
  ok.forEach(p => {
    const l = local(p.criadoEm);
    const k = `${String(l.getUTCHours()).padStart(2, '0')}:${l.getUTCMinutes() < 30 ? '00' : '30'}`;
    pico[k] = (pico[k] || 0) + 1;
  });
  const porFone = {}; // balcão sem telefone não vira cliente
  ok.forEach(p => { const f = soDigitos(p.cliente.fone); if (f) (porFone[f] ??= []).push(p.criadoEm); });
  const fones = Object.keys(porFone);
  // novo: o primeiro pedido da vida caiu no período. Voltou: pediu no período algo que não foi o primeiro pedido da vida
  // (comprou de novo). Quem estreou e repetiu no período conta nos dois
  const primeiro = f => Math.min(clientes[f]?.primeiro ?? Infinity, ...porFone[f]);
  const voltou = f => porFone[f].some(d => d > primeiro(f));
  // bairro digitado em "Outro bairro" pode vir com maiúscula, acento ou espaço diferente: junta e mostra a 1ª grafia
  const grafia = {};
  const bairro = p => { const b = p.cliente.bairro.trim(); return grafia[b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')] ??= b; };
  // mesmo telefone = mesmo cliente, com o nome do pedido mais recente (o cliente pode digitar o nome diferente)
  const ultimo = {};
  ok.forEach(p => { const f = soDigitos(p.cliente.fone); if (f && !(ultimo[f]?.criadoEm > p.criadoEm)) ultimo[f] = p; });
  return {
    faturamento,
    taxas: ok.reduce((s, p) => s + (p.taxa || 0), 0),
    pedidos: ok.length,
    ticket: ok.length ? faturamento / ok.length : 0,
    cancelados: dentro.filter(p => p.status === 'cancelado').length,
    maisVendidos: ranking(ok, p => p.itens.map(i => [i.nome, i.qtd])),
    pagamentos: ranking(ok, p => [[p.pag, p.subtotal]]),
    bairros: ranking(ok, p => p.entrega ? [[bairro(p), 1]] : []),
    diasSemana: ranking(ok, p => [[local(p.criadoEm).getUTCDay(), p.subtotal]]),
    pico: Object.entries(pico).sort(),
    clientes: fones.length,
    clientesNovos: fones.filter(f => primeiro(f) >= ini).length,
    clientesVoltaram: fones.filter(voltou).length,
    topClientes: ranking(ok, p => { const c = ultimo[soDigitos(p.cliente.fone)]; return c ? [[`${c.cliente.nome} · ${c.cliente.fone}`, 1]] : []; }), // todos; a tela mostra os 5 primeiros
  };
}

export const variacao = (atual, anterior) => anterior ? Math.round((atual - anterior) / anterior * 100) : null;

// CSV pro Excel brasileiro: ; separador, vírgula decimal, BOM pros acentos.
// Célula começando com = + - @ vira texto (nome de cliente malicioso não roda fórmula).
export function csv(pedidos) {
  const cel = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const num = v => (v ?? 0).toFixed(2).replace('.', ',');
  const linhas = pedidos.map(p => [
    local(p.criadoEm).toISOString().slice(0, 16).replace('T', ' '), p.cod, p.cliente.nome, p.cliente.fone,
    p.entrega ? p.cliente.bairro : p.local ? 'No local' : 'Retirada', p.itens.map(i => `${i.qtd}x ${i.nome}`).join(' + '),
    num(p.subtotal), num(p.taxa), p.pag, p.status,
  ].map(cel).join(';'));
  return '﻿' + ['Data;Pedido;Cliente;Telefone;Bairro;Itens;Subtotal;Taxa;Pagamento;Status', ...linhas].join('\r\n');
}
