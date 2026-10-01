import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, addDoc, collection, updateDoc, serverTimestamp } from 'firebase/firestore';

const P = 'lojas/lacarne';
let env;
const pedido = (extra = {}) => ({
  cod: 'AB12C', criadoEm: serverTimestamp(), status: 'novo', entrega: true, pag: 'Pix', troco: 0, obs: '',
  cliente: { nome: 'Ana', fone: '(81) 9 9999-9999', rua: 'Rua A', numero: '1', bairro: 'Matriz', compl: '', ref: '' },
  itens: [{ id: 'bruto', nome: 'Bruto', unit: 32, qtd: 1, escolhas: { 'Ponto da carne': 'Ao ponto' }, sem: [], obs: '' }],
  subtotal: 32, taxa: 5, ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lacarne',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, P), { nome: 'La Carne' });
    await setDoc(doc(db, P, 'admins', 'dono@x.com'), {});
    await setDoc(doc(db, P, 'pedidos', 'p1'), { ...pedido(), criadoEm: new Date() });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const logado = (email, verificado = true) => env.authenticatedContext(email, { email, email_verified: verificado }).firestore();
const pedidos = db => collection(db, P, 'pedidos');

test('qualquer um lê a loja', () => assertSucceeds(getDoc(doc(anon(), P))));
test('estranho não altera a loja', () => assertFails(setDoc(doc(anon(), P), { fechadaHoje: '2026-10-01' }, { merge: true })));
test('admin altera a loja', () => assertSucceeds(updateDoc(doc(logado('dono@x.com'), P), { 'esgotados.bruto': '2026-10-01' })));
test('cliente cria pedido válido', () => assertSucceeds(addDoc(pedidos(anon()), pedido())));
test('retirada com taxa 0 e bairro fora da tabela com taxa null', async () => {
  await assertSucceeds(addDoc(pedidos(anon()), pedido({ entrega: false, taxa: 0 })));
  await assertSucceeds(addDoc(pedidos(anon()), pedido({ taxa: null })));
});
test('pedido já aceito é negado', () => assertFails(addDoc(pedidos(anon()), pedido({ status: 'preparo' }))));
test('campo extra é negado', () => assertFails(addDoc(pedidos(anon()), pedido({ pago: true }))));
test('subtotal fora da faixa é negado', () => assertFails(addDoc(pedidos(anon()), pedido({ subtotal: 99999 }))));
test('hora do cliente é negada', () => assertFails(addDoc(pedidos(anon()), pedido({ criadoEm: new Date(0) }))));
test('nome gigante é negado', () => assertFails(addDoc(pedidos(anon()), pedido({ cliente: { ...pedido().cliente, nome: 'x'.repeat(61) } }))));
test('sacola vazia é negada', () => assertFails(addDoc(pedidos(anon()), pedido({ itens: [] }))));
test('estranho não lê pedido', () => assertFails(getDoc(doc(anon(), P, 'pedidos', 'p1'))));
test('logado fora da lista não lê pedido', () => assertFails(getDoc(doc(logado('outro@x.com'), P, 'pedidos', 'p1'))));
test('e-mail não verificado não vale', () => assertFails(getDoc(doc(logado('dono@x.com', false), P, 'pedidos', 'p1'))));
test('admin lê pedido', () => assertSucceeds(getDoc(doc(logado('dono@x.com'), P, 'pedidos', 'p1'))));
test('admin muda status', () =>
  assertSucceeds(updateDoc(doc(logado('dono@x.com'), P, 'pedidos', 'p1'), { status: 'preparo', aceitoEm: serverTimestamp() })));
test('admin não muda valor', () => assertFails(updateDoc(doc(logado('dono@x.com'), P, 'pedidos', 'p1'), { subtotal: 1 })));
test('status inventado é negado', () => assertFails(updateDoc(doc(logado('dono@x.com'), P, 'pedidos', 'p1'), { status: 'pago' })));
test('cada um só vê o próprio acesso', async () => {
  await assertSucceeds(getDoc(doc(logado('dono@x.com'), P, 'admins', 'dono@x.com')));
  await assertSucceeds(getDoc(doc(logado('outro@x.com'), P, 'admins', 'outro@x.com')));
  await assertFails(getDoc(doc(logado('outro@x.com'), P, 'admins', 'dono@x.com')));
});
test('ninguém se promove a admin', () => assertFails(setDoc(doc(logado('outro@x.com'), P, 'admins', 'outro@x.com'), {})));
test('clientes só pro admin', async () => {
  await assertFails(getDoc(doc(anon(), P, 'clientes', '81999999999')));
  await assertSucceeds(setDoc(doc(logado('dono@x.com'), P, 'clientes', '81999999999'), { pedidos: 1 }));
});
test('pedido com localização do cliente', () =>
  assertSucceeds(addDoc(pedidos(anon()), pedido({ cliente: { ...pedido().cliente, loc: '-8.118012,-35.291400' } }))));
test('localização gigante é negada', () =>
  assertFails(addDoc(pedidos(anon()), pedido({ cliente: { ...pedido().cliente, loc: 'x'.repeat(41) } }))));
