import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, addDoc, collection, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

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
    await setDoc(doc(db, P, 'convites', 'p1'), { nome: 'Ana', ids: ['bruto', 'manso'],
      burgers: [{ id: 'bruto', nome: 'Bruto' }, { id: 'manso', nome: 'Manso' }], entregueEm: new Date() });
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

// ---------- balcão: a loja lança o pedido já aceito ----------
const balcao = (extra = {}) => pedido({ status: 'preparo', aceitoEm: serverTimestamp(), local: true, entrega: false, taxa: 0,
  cliente: { nome: 'Mesa 3', fone: '', rua: '', numero: '', bairro: '', compl: '', ref: '', loc: '' }, ...extra });
test('admin lança pedido no local, sem telefone', () => assertSucceeds(addDoc(pedidos(logado('dono@x.com')), balcao())));
test('admin lança entrega pelo balcão', () =>
  assertSucceeds(addDoc(pedidos(logado('dono@x.com')), balcao({ local: false, entrega: true, taxa: 5, cliente: pedido().cliente }))));
test('cliente não lança pedido já aceito', () => assertFails(addDoc(pedidos(anon()), balcao())));
test('cliente não marca consumo no local', () => assertFails(addDoc(pedidos(anon()), pedido({ local: true, entrega: false, taxa: 0 }))));
test('logado fora da lista não lança', () => assertFails(addDoc(pedidos(logado('outro@x.com')), balcao())));
test('no local com entrega é negado', () => assertFails(addDoc(pedidos(logado('dono@x.com')), balcao({ entrega: true }))));
test('balcão com hora do aparelho é negado', () => assertFails(addDoc(pedidos(logado('dono@x.com')), balcao({ aceitoEm: new Date(0) }))));
test('balcão sem nome é negado', () =>
  assertFails(addDoc(pedidos(logado('dono@x.com')), balcao({ cliente: { ...balcao().cliente, nome: '' } }))));

// ---------- avaliações ----------
const avaliar = (db, id, notas, extra = {}) => {
  const b = writeBatch(db);
  b.set(doc(db, P, 'notas', id), { notas, criadoEm: serverTimestamp() });
  b.set(doc(db, P, 'avaliacoes', id), { notas, tags: ['Saboroso'], comentarios: { bruto: 'Top' }, nome: 'Ana',
    criadoEm: serverTimestamp(), vista: false, publicas: [], ...extra });
  return b.commit();
};
const ok = { bruto: 5, manso: 4 };
test('avalia com convite', () => assertSucceeds(avaliar(anon(), 'p1', ok)));
test('avaliar sem convite é negado', () => assertFails(avaliar(anon(), 'p9', { bruto: 5 })));
test('segunda avaliação é negada', async () => {
  await assertSucceeds(avaliar(anon(), 'p1', ok));
  await assertFails(avaliar(anon(), 'p1', { bruto: 1, manso: 1 }));
});
test('nota fora de 1..5 é negada', async () => {
  await assertFails(avaliar(anon(), 'p1', { bruto: 6, manso: 4 }));
  await assertFails(avaliar(anon(), 'p1', { bruto: 0, manso: 4 }));
});
test('faltar burger ou burger de fora é negado', async () => {
  await assertFails(avaliar(anon(), 'p1', { bruto: 5 }));
  await assertFails(avaliar(anon(), 'p1', { ...ok, matuto: 5 }));
});
test('etiqueta inventada é negada', () => assertFails(avaliar(anon(), 'p1', ok, { tags: ['Péssimo'] })));
test('comentário gigante, de burger fora do pedido ou que não é texto é negado', async () => {
  await assertFails(avaliar(anon(), 'p1', ok, { comentarios: { manso: 'x'.repeat(301) } }));
  await assertFails(avaliar(anon(), 'p1', ok, { comentarios: { matuto: 'Top' } }));
  await assertFails(avaliar(anon(), 'p1', ok, { comentarios: { bruto: 5 } }));
});
test('comentário nos dois burgers ou em nenhum passa', async () => {
  await assertSucceeds(avaliar(anon(), 'p1', ok, { comentarios: { bruto: 'Top', manso: 'x'.repeat(300) } }));
});
test('sem comentário passa', () => assertSucceeds(avaliar(anon(), 'p1', ok, { comentarios: {} })));
test('avaliação já publicada ou com outro nome é negada', async () => {
  await assertFails(avaliar(anon(), 'p1', ok, { publicas: ['bruto'] }));
  await assertFails(avaliar(anon(), 'p1', ok, { nome: 'Outro' }));
});
test('notas sem avaliação no mesmo lote é negado', () =>
  assertFails(setDoc(doc(anon(), P, 'notas', 'p1'), { notas: ok, criadoEm: serverTimestamp() })));
test('avaliação sem notas no mesmo lote é negada', () =>
  assertFails(setDoc(doc(anon(), P, 'avaliacoes', 'p1'), { notas: ok, tags: [], comentarios: {}, nome: 'Ana',
    criadoEm: serverTimestamp(), vista: false, publicas: [] })));
test('notas diferentes nos dois documentos é negado', async () => {
  const db = anon(), b = writeBatch(db);
  b.set(doc(db, P, 'notas', 'p1'), { notas: { bruto: 5, manso: 5 }, criadoEm: serverTimestamp() });
  b.set(doc(db, P, 'avaliacoes', 'p1'), { notas: { bruto: 1, manso: 1 }, tags: [], comentarios: {}, nome: 'Ana',
    criadoEm: serverTimestamp(), vista: false, publicas: [] });
  await assertFails(b.commit());
});
test('qualquer um lê convite e notas; só admin lê avaliação', async () => {
  await assertSucceeds(avaliar(anon(), 'p1', ok));
  await assertSucceeds(getDoc(doc(anon(), P, 'convites', 'p1')));
  await assertSucceeds(getDoc(doc(anon(), P, 'notas', 'p1')));
  await assertFails(getDoc(doc(anon(), P, 'avaliacoes', 'p1')));
  await assertSucceeds(getDoc(doc(logado('dono@x.com'), P, 'avaliacoes', 'p1')));
});
test('só admin cria convite e depoimento; admin só muda vista/publica', async () => {
  await assertSucceeds(avaliar(anon(), 'p1', ok));
  await assertFails(setDoc(doc(anon(), P, 'convites', 'p2'), { nome: 'X', ids: ['bruto'], burgers: [], entregueEm: new Date() }));
  await assertFails(setDoc(doc(anon(), P, 'depoimentos', 'p1_bruto'), { nome: 'Ana' }));
  const adm = logado('dono@x.com');
  await assertSucceeds(setDoc(doc(adm, P, 'convites', 'p2'), { nome: 'X', ids: ['bruto'], burgers: [], entregueEm: new Date() }));
  await assertSucceeds(updateDoc(doc(adm, P, 'avaliacoes', 'p1'), { vista: true, publicas: ['bruto'] }));
  await assertFails(updateDoc(doc(adm, P, 'avaliacoes', 'p1'), { notas: { bruto: 1, manso: 1 } }));
  await assertSucceeds(setDoc(doc(adm, P, 'depoimentos', 'p1_bruto'), { nome: 'Ana', burger: 'bruto', nota: 5, comentario: 'Top', criadoEm: new Date() }));
  await assertSucceeds(getDoc(doc(anon(), P, 'depoimentos', 'p1_bruto')));
  await assertFails(deleteDoc(doc(anon(), P, 'depoimentos', 'p1_bruto')));
  await assertSucceeds(deleteDoc(doc(adm, P, 'depoimentos', 'p1_bruto')));
});
test('cliente marca a abertura do convite uma vez só, com a hora do servidor', async () => {
  const c = doc(anon(), P, 'convites', 'p1');
  await assertFails(updateDoc(c, { abertoEm: new Date(0), abertoPor: 'link' }));
  await assertFails(updateDoc(c, { abertoEm: serverTimestamp(), abertoPor: 'email' }));
  await assertFails(updateDoc(c, { abertoEm: serverTimestamp(), abertoPor: 'link', nome: 'X' }));
  await assertSucceeds(updateDoc(c, { abertoEm: serverTimestamp(), abertoPor: 'qr' }));
  await assertFails(updateDoc(c, { abertoEm: serverTimestamp(), abertoPor: 'link' }));
  await assertFails(setDoc(doc(logado('dono@x.com'), P, 'convites', 'p1'), { nome: 'Ana', ids: ['bruto'], burgers: [], entregueEm: new Date() }));
});
