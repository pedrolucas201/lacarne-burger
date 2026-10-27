import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilha } from '../camadas.js';

const ordem = ['maionese', 'nutella', 'geleia', 'proteina', 'bacon', 'cebola', 'abacaxi'];
const queijos = ['cheddar', 'mucarela', 'coalho'];
const ids = l => l.map(c => c.id);
const bruto = ['maionese', 'carne', 'cheddar', 'carne', 'bacon', 'cebola'];

test('receita sai na ordem fixa: molho no pão, carne e queijo intercalados, complementos em cima', () => {
  assert.deepEqual(ids(pilha({ receita: ['cebola', 'bacon', 'carne', 'cheddar', 'carne', 'maionese'], ordem, queijos })), bruto);
});

test('tirar remove todas as camadas daquele tipo da receita', () => {
  assert.deepEqual(ids(pilha({ receita: bruto, tirar: ['bacon', 'maionese'], ordem, queijos })), ['carne', 'cheddar', 'carne', 'cebola']);
});

test('adicional entra no lugar dele, não no topo', () => {
  assert.deepEqual(ids(pilha({ receita: bruto, extras: ['cheddar', 'carne'], ordem, queijos })),
    ['maionese', 'carne', 'cheddar', 'carne', 'cheddar', 'carne', 'bacon', 'cebola']);
});

test('queijo sobrando vai em cima do último queijo', () => {
  assert.deepEqual(ids(pilha({ receita: ['carne', 'cheddar'], extras: ['mucarela', 'coalho'], ordem, queijos })),
    ['carne', 'cheddar', 'mucarela', 'coalho']);
});

test('cada camada tem chave estável id#n', () => {
  assert.deepEqual(pilha({ receita: bruto, ordem, queijos }).map(c => c.k),
    ['maionese#0', 'carne#0', 'cheddar#0', 'carne#1', 'bacon#0', 'cebola#0']);
});

test('tirar um adicional repetido remove a última chave daquele tipo', () => {
  const antes = pilha({ receita: ['carne'], extras: ['carne', 'carne'], ordem, queijos }).map(c => c.k);
  const depois = pilha({ receita: ['carne'], extras: ['carne'], ordem, queijos }).map(c => c.k);
  assert.deepEqual(antes.filter(k => !depois.includes(k)), ['carne#2']);
});
