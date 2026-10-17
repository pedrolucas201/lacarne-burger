// Lastro das ações da loja, só no banco (sem tela): lojas/<loja>/registro, uma linha por ação, ninguém edita nem apaga.
// A regra confere quem (e-mail logado) e quando (hora do servidor). Pedido, loja e avaliação só mudam com a linha
// gravada junto: o documento alterado aponta pra ela em `reg`.
import { app, db, LOJA_ID } from './firebase.js';
import { doc, collection, serverTimestamp, writeBatch } from './vendor/firebase/base.js';
import { getAuth } from './vendor/firebase/auth.js';

// a conta da loja é dividida por várias pessoas: o aparelho ajuda a separar quem fez
const aparelho = navigator.userAgent.slice(0, 150);

// t: lote ou transação da própria mudança. Devolve o id, que vai em `reg`
export function registrar(t, acao, alvo, dados = {}) {
  const ref = doc(collection(db, 'lojas', LOJA_ID, 'registro'));
  t.set(ref, { em: serverTimestamp(), quem: getAuth(app).currentUser?.email ?? '', acao, alvo, dados, aparelho });
  return ref.id;
}

// melhor esforço (comanda impressa, erro): nunca trava nem derruba a ação
export function anotar(acao, alvo, dados = {}) {
  const b = writeBatch(db);
  registrar(b, acao, alvo, dados);
  b.commit().catch(() => {});
}
// erro vira texto curto (o banco não grava objeto de erro)
export const erro = (onde, e) => anotar('erro', onde, { msg: String(e?.code ?? e?.message ?? e).slice(0, 300) });
