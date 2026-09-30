import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxaDe, conferir, whats, avisoCliente, soDigitos } from '../pedido.js';

const loja = { taxas: { Matriz: 5 }, cardapio: [{ id: 'bruto', preco: 32 }, { id: 'manso', preco: 20 }] };
const p = (extra = {}) => ({
  cod: 'AB12C', entrega: true, cliente: { fone: '(81) 9 9999-9999', bairro: 'Matriz' },
  itens: [{ id: 'bruto', qtd: 2 }, { id: 'manso', qtd: 1 }], subtotal: 84, taxa: 5, ...extra,
});

test('taxa: retirada 0, bairro da tabela, fora da tabela null', () => {
  assert.equal(taxaDe(loja, false, 'Matriz'), 0);
  assert.equal(taxaDe(loja, true, 'Matriz'), 5);
  assert.equal(taxaDe(loja, true, 'Vila X'), null);
  assert.equal(taxaDe(loja, true, ''), null);
});
test('conferir aceita pedido certo', () => assert.deepEqual(conferir(p(), loja), { subtotal: 84, taxa: 5, ok: true }));
test('conferir pega preço adulterado', () => assert.equal(conferir(p({ subtotal: 10 }), loja).ok, false));
test('conferir pega taxa adulterada', () => assert.equal(conferir(p({ taxa: 0 }), loja).ok, false));
test('conferir pega item que não existe', () => assert.equal(conferir(p({ itens: [{ id: 'x', qtd: 1 }] }), loja).ok, false));
test('só dígitos', () => assert.equal(soDigitos('(81) 9 9999-9999'), '81999999999'));
test('link do WhatsApp com 55 e texto', () =>
  assert.equal(whats('(81) 9 9999-9999', 'oi 🍔'), 'https://api.whatsapp.com/send?phone=5581999999999&text=oi%20%F0%9F%8D%94'));
test('avisos pro cliente', () => {
  assert.match(avisoCliente('preparo', p()), /#AB12C aceito/);
  assert.match(avisoCliente('saiu', p()), /saiu pra entrega/);
  assert.match(avisoCliente('saiu', p({ entrega: false })), /pronto pra retirar/);
  assert.match(avisoCliente('cancelado', p(), 'Cliente desistiu'), /cancelado: Cliente desistiu/);
  assert.equal(avisoCliente('entregue', p()), undefined);
});
