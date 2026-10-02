import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodo, calcular, variacao, csv } from '../numeros.js';

const R = s => new Date(s + '-03:00'); // horário de Recife
const ped = (criado, extra = {}) => ({
  cod: 'X', criadoEm: R(criado), status: 'entregue', entrega: true, pag: 'Pix',
  cliente: { nome: 'Ana', fone: '(81) 9 9999-9999', bairro: 'Matriz' },
  itens: [{ nome: 'Bruto', qtd: 1 }], subtotal: 32, taxa: 5, ...extra,
});
const DIA = { ini: R('2026-10-01T00:00'), fim: R('2026-10-02T00:00') };

test('semana começa na segunda e compara até o mesmo ponto', () => {
  const p = periodo('semana', R('2026-10-01T21:00')); // quinta 21h
  assert.deepEqual([p.ini, p.iniAnt, p.fimAnt], [R('2026-09-28T00:00'), R('2026-09-21T00:00'), R('2026-09-24T21:00')]);
});
test('hoje compara com o mesmo dia da semana passada', () => {
  const p = periodo('hoje', R('2026-10-01T21:00'));
  assert.deepEqual([p.ini, p.iniAnt, p.fimAnt], [R('2026-10-01T00:00'), R('2026-09-24T00:00'), R('2026-09-24T21:00')]);
});
test('mês compara com o anterior sem invadir o atual', () => {
  const p = periodo('mes', R('2026-03-31T20:00'));
  assert.deepEqual([p.ini, p.iniAnt, p.fimAnt], [R('2026-03-01T00:00'), R('2026-02-01T00:00'), R('2026-03-01T00:00')]);
});
test('faturamento sem taxa, só aceitos, cancelados à parte', () => {
  const r = calcular([ped('2026-10-01T19:10'), ped('2026-10-01T19:40', { status: 'cancelado' }),
    ped('2026-10-01T19:50', { status: 'novo' })], DIA);
  assert.equal(r.faturamento, 32);
  assert.equal(r.taxas, 5);
  assert.equal(r.pedidos, 1);
  assert.equal(r.ticket, 32);
  assert.equal(r.cancelados, 1);
});
test('pico em faixas de 30 min e dia da semana', () => {
  const r = calcular([ped('2026-10-01T19:10'), ped('2026-10-01T19:29'), ped('2026-10-01T19:31')], DIA);
  assert.deepEqual(r.pico, [['19:00', 2], ['19:30', 1]]);
  assert.deepEqual(r.diasSemana, [['4', 96]]);
});
test('mais vendidos, pagamentos e bairros', () => {
  const r = calcular([ped('2026-10-01T19:10', { itens: [{ nome: 'Manso', qtd: 3 }], subtotal: 60 }),
    ped('2026-10-01T19:20', { pag: 'Dinheiro', entrega: false, taxa: 0 })], DIA);
  assert.deepEqual(r.maisVendidos, [['Manso', 3], ['Bruto', 1]]);
  assert.deepEqual(r.pagamentos, [['Pix', 60], ['Dinheiro', 32]]);
  assert.deepEqual(r.bairros, [['Matriz', 1]]);
});
test('clientes novos x que voltaram', () => {
  const clientes = { '81999999999': { primeiro: R('2026-09-01T19:00') } };
  const r = calcular([ped('2026-10-01T19:10'),
    ped('2026-10-01T19:20', { cliente: { nome: 'Bia', fone: '81988887777', bairro: 'Amparo' } })], DIA, clientes);
  assert.equal(r.clientesVoltaram, 1);
  assert.equal(r.clientesNovos, 1);
});
test('variação', () => {
  assert.equal(variacao(118, 100), 18);
  assert.equal(variacao(5, 0), null);
});
test('planilha com ; , vírgula decimal e proteção contra fórmula', () => {
  const s = csv([ped('2026-10-01T19:10', { cliente: { nome: '=HACK()', fone: '81999999999', bairro: 'Matriz' } })]);
  assert.ok(s.startsWith('﻿Data;Pedido'));
  assert.match(s, /"2026-10-01 19:10";"X";"'=HACK\(\)"/);
  assert.match(s, /"32,00";"5,00";"Pix";"entregue"/);
});
test('pedido sem telefone (balcão) entra no faturamento mas não vira cliente', () => {
  const r = calcular([ped('2026-10-01T19:10'),
    ped('2026-10-01T19:20', { entrega: false, local: true, taxa: 0, cliente: { nome: 'Mesa 3', fone: '', bairro: '' } })], DIA, {});
  assert.equal(r.faturamento, 64);
  assert.equal(r.clientesNovos, 1);
  assert.deepEqual(r.topClientes.map(([k]) => k), ['Ana · (81) 9 9999-9999']);
  assert.deepEqual(r.bairros, [['Matriz', 1]]);
});
test('planilha marca consumo no local', () =>
  assert.match(csv([ped('2026-10-01T19:10', { entrega: false, local: true, cliente: { nome: 'Mesa 3', fone: '' } })]), /"Mesa 3";"";"No local"/));
