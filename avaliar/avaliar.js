// Tela do cliente: /avaliar/#<pedidoId>. O convite (criado pelo painel ao marcar entregue) diz quem e quais burgers;
// existir `notas/<id>` = já avaliou. As regras do banco garantem uma avaliação só e notas 1–5.
import '../vendor/material.js';
import { db, LOJA_ID } from '../firebase.js';
import { doc, getDoc, writeBatch, serverTimestamp } from '../vendor/firebase/base.js';
import { LOJA } from '../lojas/lacarne.mjs';
import { etiquetas, quando } from '../avaliacao.js';
import { $, esc, toast } from '../util.js';

const id = location.hash.slice(1);
const loja = doc(db, 'lojas', LOJA_ID);
const boi = bid => `../${LOJA.cardapio.find(c => c.id === bid)?.boi ?? 'img/selo.webp'}`;

function fim(titulo, sub = '', apagado = false) {
  $('#avaliar').innerHTML = `<div class="av-fim">
    <img src="../img/selo.webp" alt=""${apagado ? ' class="apagado"' : ''}>
    <p class="grande">${titulo}</p>${sub ? `<p class="nota">${sub}</p>` : ''}
    <md-filled-button href="../">Ver o cardápio</md-filled-button></div>`;
}

try {
  const [conv, nt] = id ? await Promise.all([getDoc(doc(loja, 'convites', id)), getDoc(doc(loja, 'notas', id))]) : [];
  if (!conv?.exists()) fim('Não encontramos esse pedido.', 'Confere se o link está completo.', true);
  else if (nt.exists()) fim('Você já avaliou esse pedido, valeu! 🙌');
  else montar(conv.data());
} catch (e) {
  console.error(e);
  fim('Não deu pra abrir agora.', 'Confere a internet e tenta de novo.');
}

function montar(c) {
  const notas = {}, tags = new Set();
  const plural = c.burgers.length > 1;
  $('#avaliar').innerHTML = `<div class="av-caixa">
    <p class="grande">Como foi seu pedido, ${esc(c.nome)}?</p>
    <p class="nota">${esc(c.burgers.map(b => b.nome).join(' + '))} · ${quando(c.entregueEm?.toDate?.() ?? new Date())}</p>
    <p class="nota">${plural ? 'Dê uma nota pra cada burger' : 'Dê uma nota pro seu burger'}</p>
    ${c.burgers.map(b => `<div class="av-linha" data-b="${esc(b.id)}"><img src="${esc(boi(b.id))}" alt=""><b>${esc(b.nome)}</b>
      <span class="av-estrelas">${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''} pro ${esc(b.nome)}">★</button>`).join('')}</span></div>`).join('')}
    <div id="avTags"></div>
    <md-outlined-text-field id="avComent" type="textarea" rows="2" maxlength="300" label="Quer contar mais? (opcional)"></md-outlined-text-field>
    <md-filled-button id="avEnviar" disabled>Enviar avaliação</md-filled-button>
  </div>`;

  // etiquetas mudam pela menor nota; as marcadas que somem da lista são desmarcadas
  const desenharTags = () => {
    const l = etiquetas(notas);
    [...tags].forEach(t => { if (!l.includes(t)) tags.delete(t); });
    $('#avTags').innerHTML = !l.length ? '' : `<p class="nota">${Math.min(...Object.values(notas)) >= 4 ? 'O que você curtiu?' : 'O que deu errado?'} (opcional)</p>
      <div class="av-tags">${l.map(t => `<button type="button" class="av-tag${tags.has(t) ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  };
  $('#avaliar').addEventListener('click', e => {
    const s = e.target.closest('[data-n]'), t = e.target.closest('[data-t]');
    if (s) {
      const linha = s.closest('[data-b]'), n = +s.dataset.n;
      notas[linha.dataset.b] = n;
      linha.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', +x.dataset.n <= n));
      $('#avEnviar').disabled = Object.keys(notas).length < c.burgers.length;
      desenharTags();
    } else if (t) {
      tags.has(t.dataset.t) ? tags.delete(t.dataset.t) : tags.add(t.dataset.t);
      t.classList.toggle('on');
    }
  });
  $('#avEnviar').addEventListener('click', async () => {
    $('#avEnviar').disabled = true;
    try {
      const b = writeBatch(db);
      b.set(doc(loja, 'notas', id), { notas, criadoEm: serverTimestamp() });
      b.set(doc(loja, 'avaliacoes', id), {
        notas, tags: [...tags], comentario: $('#avComent').value.trim().slice(0, 300),
        nome: c.nome, criadoEm: serverTimestamp(), vista: false, publica: false,
      });
      await b.commit();
      scrollTo(0, 0);
      fim('Valeu pela avaliação! 🙌', 'Ela ajuda a gente a melhorar cada pedido.');
    } catch (e) {
      console.error(e);
      $('#avEnviar').disabled = false;
      toast('Não deu pra enviar agora, tenta de novo.', true);
    }
  });
}
