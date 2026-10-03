import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comanda } from '../comanda.js';

const loja = { nome: 'La Carne Burger', adicionais: [{ id: 'bacon', nome: 'Bacon' }] };
const p = (extra = {}) => ({
  cod: 'AB12C', criadoEm: new Date('2026-10-02T21:43:00-03:00'), entrega: true, pag: 'Dinheiro', troco: 100, obs: 'tocar a campainha',
  cliente: { nome: 'Ana <b>', fone: '(81) 9 9999-9999', rua: 'Rua A', numero: '1', bairro: 'Matriz', compl: 'casa 2', ref: '' },
  itens: [{ id: 'bruto', nome: 'Bruto', qtd: 1, escolhas: { 'Ponto da carne': 'Ao ponto' }, sem: ['Bacon'], extras: ['bacon', 'bacon'], obs: 'bem quente' }],
  subtotal: 40, taxa: 5, ...extra,
});
const texto = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('entrega: endereço, itens com escolhas/sem/adicionais, subtotal, taxa, troco e QR', () => {
  const t = texto(comanda(p(), loja, '<svg>QR</svg>'));
  for (const s of ['LA CARNE BURGER', '02/10/2026 21:43', '#AB12C', 'ENTREGA', '(81) 9 9999-9999', 'Rua A, 1 · Matriz', 'casa 2',
    '1x Bruto', 'Ponto da carne: Ao ponto', 'Sem: Bacon', '+ 2x Bacon', 'Obs: bem quente', 'Subtotal R$ 40,00', 'Entrega R$ 5,00',
    'TOTAL R$ 45,00', 'Pagamento Dinheiro', 'Troco para R$ 100,00', 'Obs: tocar a campainha', 'Avalie seu lanche'])
    assert.ok(t.replace(/ /g, ' ').includes(s), `faltou "${s}" em: ${t}`);
  assert.ok(comanda(p(), loja).includes('Ana &#60;b&#62;'), 'nome escapado');
});

test('balcão no local sem telefone e sem burger: sem endereço, sem subtotal, sem QR', () => {
  const t = texto(comanda(p({ entrega: false, local: true, taxa: 0, pag: 'Pix', obs: '', cliente: { nome: 'Mesa 4', fone: '' } }), loja));
  assert.ok(t.includes('CONSUMO NO LOCAL') && t.includes('Mesa 4'));
  for (const s of ['Subtotal', 'Entrega', 'Troco', 'Avalie', 'Rua']) assert.ok(!t.includes(s), `não devia ter "${s}"`);
});

test('retirada e taxa a confirmar', () => {
  assert.ok(texto(comanda(p({ entrega: false, taxa: 0 }), loja)).includes('RETIRADA'));
  assert.ok(texto(comanda(p({ taxa: null }), loja)).replace(/ /g, ' ').includes('TOTAL R$ 40,00 + entrega'));
});
