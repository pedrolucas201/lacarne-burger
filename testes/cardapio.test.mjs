import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOJA } from '../lojas/lacarne.mjs';

const sem = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
test('cada "tirar" existe na descrição do burger', () => {
  for (const b of LOJA.cardapio.filter(i => i.tipo !== 'bebida'))
    for (const t of b.tira) assert.ok(sem(b.desc).includes(sem(t).replace(/^queijo /, '')), `${b.nome}: "${t}" não está na descrição`);
});
