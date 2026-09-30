import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noHorario, lojaAberta, proximaAbertura, hoje } from '../horario.js';

const H = { dias: [3, 4, 5, 6], abre: 18, fecha: 22, texto: 'Quarta a sábado · 18h às 22h' };
const t = (dia, hh, mm = 0) => ({ dia, min: hh * 60 + mm });
const loja = (extra = {}) => ({ horario: H, ...extra });

test('horário normal', () => {
  assert.ok(noHorario(H, t(3, 18)));
  assert.ok(noHorario(H, t(6, 21, 59)));
  assert.ok(!noHorario(H, t(6, 22)));
  assert.ok(!noHorario(H, t(2, 19)));
});
test('fechar hoje vence o horário e só vale no dia', () => {
  assert.ok(!lojaAberta(loja({ fechadaHoje: '2026-10-01' }), t(4, 19), '2026-10-01'));
  assert.ok(lojaAberta(loja({ fechadaHoje: '2026-09-30' }), t(4, 19), '2026-10-01'));
});
test('abrir hoje vale fora do horário e só no dia', () => {
  assert.ok(lojaAberta(loja({ abertaHoje: '2026-10-06' }), t(2, 15), '2026-10-06'));
  assert.ok(!lojaAberta(loja({ abertaHoje: '2026-10-05' }), t(2, 15), '2026-10-06'));
});
test('próxima abertura', () => {
  assert.equal(proximaAbertura(H, t(6, 23)), 'quarta às 18h');
  assert.equal(proximaAbertura(H, t(3, 10)), 'hoje às 18h');
  assert.equal(proximaAbertura(H, t(3, 10), true), 'amanhã às 18h');
});
test('hoje no fuso de Recife', () => {
  assert.equal(hoje(new Date('2026-10-01T02:00:00Z')), '2026-09-30'); // 23h em Recife
});
