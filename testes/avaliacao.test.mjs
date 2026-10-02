import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TAGS_BOAS, TAGS_RUINS, etiquetas, burgersDoPedido, quando, resumo } from '../avaliacao.js';

const cardapio = [{ id: 'bruto', nome: 'Bruto' }, { id: 'matuto', nome: 'Matuto' }, { id: 'coca', nome: 'Coca-Cola', tipo: 'bebida' }];

test('etiquetas mudam pela menor nota', () => {
  assert.deepEqual(etiquetas({ bruto: 5, matuto: 4 }), TAGS_BOAS);
  assert.deepEqual(etiquetas({ bruto: 5, matuto: 3 }), TAGS_RUINS);
  assert.deepEqual(etiquetas({}), []);
});
test('toda etiqueta está na lista das regras do banco', () => {
  const regras = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const t of [...TAGS_BOAS, ...TAGS_RUINS]) assert.ok(regras.includes(`'${t}'`), t);
});
test('burgers do pedido: sem bebida, sem repetir, na ordem', () => {
  const itens = [{ id: 'coca' }, { id: 'bruto' }, { id: 'matuto' }, { id: 'bruto' }];
  assert.deepEqual(burgersDoPedido(itens, cardapio), [{ id: 'bruto', nome: 'Bruto' }, { id: 'matuto', nome: 'Matuto' }]);
  assert.deepEqual(burgersDoPedido([{ id: 'coca' }], cardapio), []);
});
test('quando: hoje, ontem, data', () => {
  const agora = new Date('2026-10-02T15:00:00-03:00');
  assert.equal(quando(new Date('2026-10-02T10:00:00-03:00'), agora), 'hoje');
  assert.equal(quando(new Date('2026-10-01T22:00:00-03:00'), agora), 'ontem');
  assert.equal(quando(new Date('2026-09-28T20:00:00-03:00'), agora), '28/09');
});
test('resumo: média geral, distribuição, por burger e etiquetas', () => {
  const av = [
    { notas: { bruto: 5, matuto: 4 }, tags: ['Saboroso', 'Chegou quente'] },
    { notas: { bruto: 2 }, tags: ['Demorou'] },
  ];
  const r = resumo(av, cardapio);
  assert.equal(r.total, 2);
  assert.equal(r.media, 11 / 3);
  assert.deepEqual(r.dist, { 5: 1, 4: 1, 3: 0, 2: 1, 1: 0 });
  assert.deepEqual(r.porBurger, [['Bruto', 3.5, 2], ['Matuto', 4, 1]]);
  assert.deepEqual(r.tags, [['Saboroso', 1, true], ['Chegou quente', 1, true], ['Demorou', 1, false]]);
});
