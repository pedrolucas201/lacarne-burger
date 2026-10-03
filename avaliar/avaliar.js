// Tela do cliente: /avaliar/#<pedidoId>. O convite (criado pelo painel ao marcar entregue) diz quem e quais burgers;
// existir `notas/<id>` = já avaliou. As regras do banco garantem uma avaliação só e notas 1–5.
import '../vendor/material.js';
import { db, LOJA_ID } from '../firebase.js';
import { doc, getDoc, updateDoc, writeBatch, serverTimestamp } from '../vendor/firebase/base.js';
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
  else if (nt.exists()) fim('Você já avaliou esse pedido, valeu!&nbsp;🙌');
  else montar(conv.data());
  // rastreio: primeira abertura (?qr = veio da comanda; sem = link do WhatsApp). Falhar aqui não atrapalha o cliente
  if (conv?.exists() && !conv.data().abertoEm) updateDoc(conv.ref, {
    abertoEm: serverTimestamp(), abertoPor: new URLSearchParams(location.search).has('qr') ? 'qr' : 'link',
  }).catch(console.error);
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
    ${c.burgers.map(b => `<div class="av-burger" data-b="${esc(b.id)}">
      <div class="av-linha"><img src="${esc(boi(b.id))}" alt=""><b>${esc(b.nome)}</b>
        <span class="av-estrelas">${[1, 2, 3, 4, 5].map(n =>
          `<button type="button" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''} pro ${esc(b.nome)}">★</button>`).join('')}</span></div>
      <md-outlined-text-field class="av-coment" type="textarea" rows="2" maxlength="300" hidden
        label="Quer comentar o ${esc(b.nome)}?"></md-outlined-text-field>
    </div>`).join('')}
    <div id="avTags"></div>
    <md-filled-button id="avEnviar" disabled>Enviar avaliação</md-filled-button>
  </div>`;

  // etiquetas mudam pela menor nota; as marcadas que somem da lista são desmarcadas
  const desenharTags = () => {
    const l = etiquetas(notas);
    [...tags].forEach(t => { if (!l.includes(t)) tags.delete(t); });
    $('#avTags').innerHTML = !l.length ? '' : `<p class="nota">${Math.min(...Object.values(notas)) >= 4 ? 'E o pedido em geral, o que você curtiu?' : 'E o pedido em geral, o que deu errado?'} (opcional)</p>
      <div class="av-tags">${l.map(t => `<button type="button" class="av-tag${tags.has(t) ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  };
  $('#avaliar').addEventListener('click', e => {
    const s = e.target.closest('[data-n]'), t = e.target.closest('[data-t]');
    if (s) {
      const linha = s.closest('[data-b]'), n = +s.dataset.n;
      notas[linha.dataset.b] = n;
      linha.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', +x.dataset.n <= n));
      linha.querySelector('.av-coment').hidden = false; // comentário do burger aparece depois da nota
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
      // um comentário por burger (só os preenchidos): cada um aparece no site só no burger dele
      const comentarios = Object.fromEntries([...document.querySelectorAll('[data-b]')]
        .map(x => [x.dataset.b, x.querySelector('.av-coment').value.trim().slice(0, 300)]).filter(([, t]) => t));
      b.set(doc(loja, 'avaliacoes', id), {
        notas, tags: [...tags], comentarios, nome: c.nome, criadoEm: serverTimestamp(), vista: false, publicas: [],
      });
      await b.commit();
      scrollTo(0, 0);
      fim('Valeu pela avaliação!&nbsp;🙌', 'Ela ajuda a gente a melhorar cada pedido.');
    } catch (e) {
      console.error(e);
      $('#avEnviar').disabled = false;
      toast('Não deu pra enviar agora, tenta de novo.', true);
    }
  });
}
