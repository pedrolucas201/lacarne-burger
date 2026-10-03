// Comanda do pedido (papel de 58/80 mm ou PDF). Sem DOM: o painel põe o HTML em #comanda e chama print().
// qr: SVG do link da avaliação (vazio = pedido sem burger, sem QR)
import { agrupar } from './pedido.js';
import { brl, esc } from './util.js';

const quando = d => d.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const linha = (a, b, cls = '') => `<p class="c-l ${cls}"><span>${a}</span><span>${b}</span></p>`;

export function comanda(p, loja, qr = '') {
  const c = p.cliente, total = p.subtotal + (p.taxa ?? 0);
  return `<div class="c-topo"><img src="../logo.png" alt=""><h1>${esc(loja.nome.toUpperCase())}</h1>
      <p>${p.criadoEm ? quando(p.criadoEm) : ''}</p><p class="c-cod">#${esc(p.cod)}</p></div>
    <p class="c-tipo">${p.entrega ? 'ENTREGA' : p.local ? 'CONSUMO NO LOCAL' : 'RETIRADA'}</p>
    <p><b>${esc(c.nome)}</b></p>${c.fone ? `<p>${esc(c.fone)}</p>` : ''}
    ${p.entrega ? `<p>${esc(c.rua)}, ${esc(c.numero)} · ${esc(c.bairro)}</p>${c.compl ? `<p>${esc(c.compl)}</p>` : ''}${c.ref ? `<p>${esc(c.ref)}</p>` : ''}` : ''}
    <hr>
    ${p.itens.map(i => `<div class="c-item"><b>${esc(i.qtd)}x ${esc(i.nome)}</b>
      ${Object.entries(i.escolhas || {}).map(([t, v]) => `<small>${esc(t)}: ${esc(v)}</small>`).join('')}
      ${i.sem?.length ? `<small>Sem: ${esc(i.sem.join(', '))}</small>` : ''}
      ${i.extras?.length ? `<small>+ ${esc(agrupar(i.extras, loja.adicionais).join(', '))}</small>` : ''}
      ${i.obs ? `<small>Obs: ${esc(i.obs)}</small>` : ''}</div>`).join('')}
    <hr>
    ${p.entrega ? linha('Subtotal', brl(p.subtotal)) + linha('Entrega', p.taxa === null ? 'a confirmar' : brl(p.taxa)) : ''}
    ${linha('TOTAL', `${brl(total)}${p.taxa === null ? ' + entrega' : ''}`, 'c-total')}
    ${linha('Pagamento', esc(p.pag))}
    ${p.pag === 'Dinheiro' && p.troco ? linha('Troco para', brl(p.troco)) : ''}
    ${p.obs ? `<p>Obs: ${esc(p.obs)}</p>` : ''}
    ${qr ? `<hr><div class="c-qr"><p><b>Gostou? Avalie seu lanche</b></p>${qr}<p>Aponte a câmera do celular</p></div>` : ''}`;
}
