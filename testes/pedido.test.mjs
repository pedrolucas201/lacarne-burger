import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxaDe, conferir, whats, avisoCliente, soDigitos, mapa, bairroDaTabela, ponto } from '../pedido.js';

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
test('link do mapa', () =>
  assert.equal(mapa('Rua A, 1 - Centro', 'Recife - PE'), 'https://maps.google.com/?q=Rua%20A%2C%201%20-%20Centro%2C%20Recife%20-%20PE'));
test('avisos com tempo de entrega e endereço da loja', () => {
  const l = { endereco: 'Rua dos Borges, 489 - Bela Vista', cidade: 'Vitória de Santo Antão - PE', tempoEntrega: 30 };
  assert.match(avisoCliente('preparo', p(), null, l), /Tempo médio de entrega: 30 min/);
  assert.doesNotMatch(avisoCliente('preparo', p({ entrega: false }), null, l), /30 min/);
  const pronto = avisoCliente('saiu', p({ entrega: false }), null, l);
  assert.match(pronto, /Rua dos Borges, 489 - Bela Vista/);
  assert.match(pronto, /maps\.google\.com/);
  assert.doesNotMatch(avisoCliente('saiu', p(), null, l), /Borges/);
  // loja sem os campos (white label): aviso como antes
  assert.equal(avisoCliente('preparo', p(), null, {}), 'Pedido #AB12C aceito! 🍔 Já estamos preparando.');
  assert.equal(avisoCliente('saiu', p({ entrega: false }), null, {}), 'Pedido #AB12C pronto pra retirar! 🏃');
});
test('bairro do CEP casa com a tabela sem ligar pra acento e maiúscula', () => {
  const taxas = { 'Bela Vista': 7, 'Água Branca': 7, Matriz: 5 };
  assert.equal(bairroDaTabela(taxas, 'bela vista'), 'Bela Vista');
  assert.equal(bairroDaTabela(taxas, 'AGUA BRANCA'), 'Água Branca');
  assert.equal(bairroDaTabela(taxas, ' Matriz '), 'Matriz');
  assert.equal(bairroDaTabela(taxas, 'Vila Nova'), null);
  assert.equal(bairroDaTabela(taxas, ''), null);
});
test('localização vira texto curto e link de mapa exato', () => {
  assert.equal(ponto(-8.1180123456, -35.2914), '-8.118012,-35.291400');
  assert.equal(mapa('-8.118012,-35.291400'), 'https://maps.google.com/?q=-8.118012%2C-35.291400');
});
