import { test } from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pilha } from '../camadas.js';
import { LOJA } from '../lojas/lacarne.mjs';

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

const burgers = LOJA.cardapio.filter(i => !i.tipo);
const m = LOJA.monta;
const naOrdem = id => m.ordem.includes(id) || (id === 'carne' || m.queijos.includes(id)) && m.ordem.includes('proteina');

test('toda camada de receita e todo adicional têm calibragem e lugar na ordem', () => {
  const usadas = [...burgers.flatMap(b => b.camadas), ...LOJA.adicionais.map(a => a.id)];
  for (const id of usadas) {
    assert.ok(m.camadas[id], `sem calibragem: ${id}`);
    assert.ok(naOrdem(id), `fora da ordem: ${id}`);
  }
});

test('tiraCamada só usa textos do "tira" e aponta pra camada da receita', () => {
  for (const b of burgers)
    for (const [t, c] of Object.entries(b.tiraCamada)) {
      assert.ok(b.tira.includes(t), `${b.nome}: "${t}" não está no tira`);
      assert.ok(b.camadas.includes(c), `${b.nome}: ${c} não está na receita`);
    }
});

// o adicional entra na pilha pela camada de mesmo id: sem camada ou sem arte, some da montagem sem erro
test('todo adicional e toda camada de receita têm config e arte na montagem', () => {
  const usadas = new Set([...LOJA.adicionais.map(a => a.id), ...LOJA.cardapio.flatMap(i => i.camadas || [])]);
  for (const id of usadas) {
    assert.ok(LOJA.monta.camadas[id], `${id}: falta em monta.camadas`);
    assert.ok(LOJA.monta.ordem.includes(id) || id === 'carne' || LOJA.monta.queijos.includes(id), `${id}: falta em monta.ordem`);
    assert.ok(existsSync(new URL(`../img/monta/${id}.webp`, import.meta.url)), `${id}: falta img/monta/${id}.webp`);
  }
});
