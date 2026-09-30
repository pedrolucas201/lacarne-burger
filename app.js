import './vendor/material.js';
import { noHorario, lojaAberta, proximaAbertura, hoje } from './horario.js';
import { pix } from './pix.js';
import { taxaDe } from './pedido.js';
import { $, brl, esc, toast } from './util.js';
import { db, LOJA_ID } from './firebase.js';
import { doc, collection, onSnapshot, setDoc, serverTimestamp } from './vendor/firebase/base.js';

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const radio = name => [...document.querySelectorAll(`md-radio[name="${name}"]`)].find(r => r.checked)?.value;
// ?teste no link libera pedidos fora do horário (pra demonstrar o site)
const TESTE = new URLSearchParams(location.search).has('teste');

// ---------- loja: cardápio, taxas, horário e botões do painel vêm do banco, ao vivo ----------
let loja = null;
function falhou() {
  $('#menu').innerHTML = `<div class="erro-carga"><p>Não foi possível carregar o cardápio.</p>
    <md-filled-tonal-button id="recarregar"><md-icon slot="icon">refresh</md-icon>Tentar de novo</md-filled-tonal-button></div>`;
  $('#recarregar').onclick = () => location.reload();
}
const demorou = setTimeout(falhou, 10000); // sem internet o onSnapshot só espera; melhor avisar que mostrar cardápio velho
await new Promise(pronto => onSnapshot(doc(db, 'lojas', LOJA_ID), s => {
  if (!s.exists()) return falhou();
  clearTimeout(demorou);
  const primeira = !loja;
  loja = s.data();
  primeira ? pronto() : renderLoja();
}, falhou));

const esgotado = id => loja.esgotados?.[id] === hoje();
const itemDe = id => loja.cardapio.find(x => x.id === id);

// preço sempre vem do cardápio: o que está salvo no navegador pode ter sido alterado
let carrinho = store.get('carrinho', []).flatMap(i => {
  const m = itemDe(i?.id);
  const qtd = Math.min(99, Math.max(1, parseInt(i.qtd) || 1));
  return m && Array.isArray(i.escolhas) && Array.isArray(i.sem)
    ? [{ ...i, nome: m.nome, unit: m.preco, qtd, obs: String(i.obs || '').slice(0, 200) }] : [];
});
let atual = null;

// ---------- horário ----------
const podePedir = () => TESTE || lojaAberta(loja);
const abre = () => proximaAbertura(loja.horario, undefined, loja.fechadaHoje === hoje());
const fechadoMsg = () => `Estamos fechados agora 🌙 Abrimos ${abre()}.`;
function status() {
  const on = lojaAberta(loja), h = loja.horario;
  $('#status').className = `status ${on ? 'on' : 'off'}`;
  $('#status').textContent = (on ? `Aberto agora${noHorario(h) ? ` · até ${h.fecha}h` : ''}` : `Fechado · abre ${abre()}`)
    + (TESTE ? ' · modo teste' : '');
}
setInterval(status, 30000);

// ---------- cardápio, bairros e horário (roda de novo a cada mudança no banco) ----------
function renderLoja() {
  document.querySelectorAll('.horario').forEach(el => el.textContent = loja.horario.texto);
  status();
  $('#menu').innerHTML = loja.cardapio.map((i, n) => `
    <article class="card${esgotado(i.id) ? ' esgotado' : ''}" style="--d:${n * 80}ms">
      <div class="emoji"><img src="img/burger.webp" alt=""><span>${esc(i.emoji)}</span></div>
      <h3>${esc(i.nome)}</h3>
      <p>${esc(i.desc)}</p>
      <div class="rodape">
        <strong>${brl(i.preco)}</strong>
        ${esgotado(i.id) ? '<span class="selo">Esgotado</span>'
          : `<md-filled-tonal-button data-id="${esc(i.id)}"><md-icon slot="icon">add</md-icon>Adicionar</md-filled-tonal-button>`}
      </div>
    </article>`).join('');
  const b = $('#bairro'), escolhido = b.value;
  b.innerHTML = '<option value="">Bairro</option>'
    + Object.entries(loja.taxas).sort(([x], [y]) => x.localeCompare(y, 'pt-BR'))
      .map(([nome, t]) => `<option value="${esc(nome)}">${esc(nome)} · ${brl(t)}</option>`).join('')
    + '<option value="outro">Outro bairro (taxa a confirmar)</option>';
  b.value = escolhido;
  salvar();
}
$('#menu').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) abrirItem(itemDe(b.dataset.id));
});

// ---------- personalizar item ----------
const dItem = $('#itemDialog');
function abrirItem(item) {
  if (!podePedir()) return toast(fechadoMsg(), true);
  if (esgotado(item.id)) return toast(`${item.nome} esgotou 😕`, true);
  atual = { item, qtd: 1 };
  $('#itemTitulo').textContent = item.nome;
  $('#itemCorpo').innerHTML = `
    <p class="desc">${esc(item.desc)}</p>
    ${item.escolhas.map((e, i) => `
      <fieldset><legend>${esc(e.titulo)} <span class="obrig">obrigatório</span></legend>
        ${e.itens.map(op => `<label class="opt"><md-radio name="e${i}" value="${esc(op)}"></md-radio>${esc(op)}</label>`).join('')}
      </fieldset>`).join('')}
    <fieldset><legend>Quer tirar algo?</legend>
      <md-chip-set>${item.tira.map(t => `<md-filter-chip label="Sem ${esc(t.toLowerCase())}" data-v="${esc(t)}"></md-filter-chip>`).join('')}</md-chip-set>
    </fieldset>
    <md-outlined-text-field id="itemObs" maxlength="200" label="Observação (opcional)" type="textarea" rows="2"
      placeholder="Ex.: cortar ao meio, molho à parte…"></md-outlined-text-field>`;
  atualizarItem();
  dItem.show();
}
function lerItem() {
  const c = $('#itemCorpo'), { item, qtd } = atual;
  return {
    id: item.id, nome: item.nome, unit: item.preco, qtd,
    escolhas: item.escolhas.map((e, i) => [e.titulo, radio(`e${i}`)]),
    sem: [...c.querySelectorAll('md-filter-chip')].filter(x => x.selected).map(x => x.dataset.v),
    obs: $('#itemObs').value.trim(),
  };
}
function atualizarItem() {
  $('#itemQtd').textContent = atual.qtd;
  $('#itemTotal').textContent = brl(atual.item.preco * atual.qtd);
}
$('#menos').onclick = () => { atual.qtd = Math.max(1, atual.qtd - 1); atualizarItem(); };
$('#mais').onclick = () => { atual.qtd = Math.min(99, atual.qtd + 1); atualizarItem(); };
$('#itemAdd').onclick = () => {
  const novo = lerItem();
  const falta = novo.escolhas.find(([, v]) => !v);
  if (falta) {
    $('#itemCorpo fieldset').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' },
      { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300 });
    return toast(`Escolha o ${falta[0].toLowerCase()} 🥩`, true);
  }
  const chave = JSON.stringify([novo.id, novo.escolhas, novo.sem, novo.obs]);
  const igual = carrinho.find(i => JSON.stringify([i.id, i.escolhas, i.sem, i.obs]) === chave);
  igual ? igual.qtd = Math.min(99, igual.qtd + novo.qtd) : carrinho.push(novo);
  salvar();
  dItem.close();
  $('#badge').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 400 });
  toast(`${novo.qtd}x ${novo.nome} na sacola 🍔`);
};

// ---------- sacola ----------
const dCart = $('#cartDialog');
const subtotal = () => carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
// 0 na retirada, null se o bairro não foi escolhido ou está fora da tabela
const taxa = () => taxaDe(loja, radio('tipo') === 'Entrega', $('#bairro').value);
const detalhes = i => [
  ...i.escolhas.map(([t, v]) => `${t}: ${v}`),
  i.sem.length ? `Sem: ${i.sem.join(', ').toLowerCase()}` : null,
  i.obs ? `Obs: ${i.obs}` : null,
].filter(Boolean);

function salvar() {
  store.set('carrinho', carrinho);
  const n = carrinho.reduce((s, i) => s + i.qtd, 0);
  $('#badge').textContent = n;
  $('#badge').hidden = !n;
  $('#cartBar').classList.toggle('on', n > 0);
  $('#cartBarTxt').textContent = `Ver sacola · ${n} ${n > 1 ? 'itens' : 'item'} · ${brl(subtotal())}`;
  $('#cartItens').innerHTML = carrinho.length ? carrinho.map((i, k) => `
    <li class="linha">
      <div class="det"><strong>${esc(i.nome)}</strong><small>${detalhes(i).map(esc).join('<br>')}</small></div>
      <div class="stepper">
        <md-icon-button data-a="-1" data-k="${k}" aria-label="Diminuir"><md-icon>${i.qtd > 1 ? 'remove' : 'delete'}</md-icon></md-icon-button>
        <span>${i.qtd}</span>
        <md-icon-button data-a="1" data-k="${k}" aria-label="Aumentar"><md-icon>add</md-icon></md-icon-button>
      </div>
      <span class="preco">${brl(i.unit * i.qtd)}</span>
    </li>`).join('') : '<li class="vazio">Sua sacola está vazia 🍟</li>';
  const tx = taxa(), aConfirmar = $('#bairro').value === 'outro' ? 'a confirmar no WhatsApp' : 'escolha o bairro';
  $('#totais').innerHTML = `
    <div><span>Subtotal</span><span>${brl(subtotal())}</span></div>
    ${radio('tipo') === 'Entrega' ? `<div class="nota"><span>Taxa de entrega</span><span>${tx === null ? aConfirmar : brl(tx)}</span></div>` : ''}
    <div class="total"><span>Total</span><span>${brl(subtotal() + (tx ?? 0))}${tx === null ? ' + entrega' : ''}</span></div>`;
}
$('#cartItens').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const item = carrinho[b.dataset.k];
  item.qtd = Math.min(99, item.qtd + +b.dataset.a);
  if (!item.qtd) { carrinho.splice(b.dataset.k, 1); toast(`${item.nome} removido`); }
  salvar();
});
dCart.addEventListener('change', () => {
  $('#endereco').hidden = radio('tipo') !== 'Entrega';
  $('#troco').hidden = radio('pag') !== 'Dinheiro';
  $('#bairroOutro').hidden = $('#bairro').value !== 'outro';
  salvar();
});
const abrirSacola = () => carrinho.length ? dCart.show() : toast('Sua sacola está vazia. Escolha um burger! 🍔', true);
$('#cartBtn').onclick = abrirSacola;
$('#cartBarBtn').onclick = abrirSacola;
document.querySelectorAll('[data-fechar]').forEach(b => b.onclick = () => b.closest('md-dialog').close());

// (81) 9 8479-3839 para celular, (81) 3333-4444 para fixo
function mascaraFone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d && `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `, r = d.slice(2);
  if (d.length === 11) return `${ddd}${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`;
  return ddd + (r.length > 4 ? `${r.slice(0, 4)}-${r.slice(4)}` : r);
}
$('#fone').addEventListener('input', e => { e.target.value = mascaraFone(e.target.value); });

// ---------- enviar: grava no banco e abre o WhatsApp ----------
const CAMPOS = ['nome', 'fone', 'rua', 'numero', 'bairro', 'bairroOutro', 'compl', 'ref'];
$('#enviar').onclick = () => {
  if (!carrinho.length) return toast('Sua sacola está vazia', true);
  if (!podePedir()) return toast(fechadoMsg(), true);
  const acabou = carrinho.find(i => esgotado(i.id));
  if (acabou) return toast(`${acabou.nome} esgotou, tira da sacola 😕`, true);
  const f = id => $('#' + id).value.trim();
  const entrega = radio('tipo') === 'Entrega';
  const pag = radio('pag');
  const vazio = ['nome', 'fone', ...(entrega ? ['rua', 'numero', 'bairro'] : []),
    ...(entrega && f('bairro') === 'outro' ? ['bairroOutro'] : [])].find(id => !f(id));
  if (vazio) { $('#' + vazio).reportValidity(); $('#' + vazio).focus(); return toast(`Preencha: ${$('#' + vazio).label || $('#' + vazio).ariaLabel}`, true); }
  if (f('fone').replace(/\D/g, '').length < 10) { $('#fone').focus(); return toast('Telefone inválido (inclua o DDD)', true); }
  if (!pag) return toast('Escolha a forma de pagamento', true);
  const sub = subtotal(), tx = taxa(), total = sub + (tx ?? 0), troco = +f('troco') || 0;
  if (pag === 'Dinheiro' && troco && troco < total) return toast(`O troco precisa ser maior que ${brl(total)}`, true);
  if (troco > 1000) return toast('Troco até R$ 1.000', true);

  const c = Object.fromEntries(CAMPOS.map(k => [k, f(k)]));
  store.set('cliente', c);
  const bairro = c.bairro === 'outro' ? c.bairroOutro : c.bairro;
  const cod = Date.now().toString(36).slice(-5).toUpperCase();
  const comPix = pag === 'Pix' && loja.pix;
  // grava sem esperar: o WhatsApp abre de qualquer jeito (o pedido nunca se perde) e o pop-up não é bloqueado
  const ref = doc(collection(db, 'lojas', LOJA_ID, 'pedidos'));
  setDoc(ref, {
    cod, criadoEm: serverTimestamp(), status: 'novo', entrega, pag, obs: f('obsGeral'),
    troco: pag === 'Dinheiro' ? troco : 0, subtotal: sub, taxa: tx,
    cliente: { nome: c.nome, fone: c.fone, rua: entrega ? c.rua : '', numero: entrega ? c.numero : '',
      bairro: entrega ? bairro : '', compl: entrega ? c.compl : '', ref: entrega ? c.ref : '' },
    // Firestore não aceita lista dentro de lista: escolhas vira { 'Ponto da carne': 'Ao ponto' }
    itens: carrinho.map(i => ({ id: i.id, nome: i.nome, unit: i.unit, qtd: i.qtd,
      escolhas: Object.fromEntries(i.escolhas), sem: i.sem, obs: i.obs })),
  }).catch(e => console.error('pedido não foi pro painel', e));
  const painel = `${new URL('painel/', location.href).href}#${ref.id}`;
  const url = `https://api.whatsapp.com/send?phone=${loja.whatsapp}&text=${encodeURIComponent(
    mensagem(c, entrega, bairro, pag, troco, sub, tx, f('obsGeral'), cod, comPix, painel))}`;
  window.open(url, '_blank', 'noopener');
  carrinho = [];
  salvar();
  dCart.close();
  toast('Pedido pronto! É só enviar no WhatsApp ✅');
  if (comPix) abrirPix(tx === null ? null : total, cod);
};

// ---------- Pix copia e cola ----------
// bairro fora da tabela: código sem valor, o cliente digita depois de confirmar a taxa
function abrirPix(valor, cod) {
  $('#pixCodigo').value = pix({ chave: loja.pix, nome: loja.nome, cidade: loja.cidade.split(' - ')[0], valor, txid: cod });
  $('#pixInfo').textContent = valor
    ? `Valor: ${brl(valor)}. Copie o código e cole na opção "Pix copia e cola" do app do seu banco.`
    : 'Confirme o valor com a taxa de entrega no WhatsApp, depois copie o código, cole na opção "Pix copia e cola" do app do seu banco e digite o valor.';
  $('#pixDialog').show();
}
$('#pixCopiar').onclick = async () => {
  try { await navigator.clipboard.writeText($('#pixCodigo').value); toast('Código Pix copiado ✅'); }
  catch { $('#pixCodigo').select(); toast('Selecione o código e copie', true); }
};

function mensagem(c, entrega, bairro, pag, troco, sub, tx, obs, cod, comPix, painel) {
  const endereco = `${c.rua}, ${c.numero}, ${bairro}, ${loja.cidade}`;
  const linha = '-------------------------------';
  return [
    '#### NOVO PEDIDO ####',
    '',
    `#️⃣   Nº pedido: ${cod}`,
    `feito em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')}`,
    '',
    `👤   ${c.nome}`,
    `📞   ${c.fone}`,
    '',
    ...(entrega ? [
      '🛵   Endereço de entrega',
      `${c.rua}, ${c.numero}`,
      `Bairro: ${bairro}`,
      c.compl ? `Complemento: ${c.compl}` : null,
      c.ref ? `(${c.ref})` : null,
      '',
      'Link do endereço:',
      `https://maps.google.com/?q=${encodeURIComponent(endereco)}`,
    ] : ['🏃   Retirada no local']),
    '',
    '------- ITENS DO PEDIDO -------',
    ...carrinho.flatMap(i => [
      '',
      `*${i.qtd} x ${i.nome.toUpperCase()}*`,
      ...i.escolhas.flatMap(([t, v]) => [`  ${t.toUpperCase()}`, `    - ${v}`]),
      ...(i.sem.length ? ['  RETIRAR', ...i.sem.map(x => `    - ${x.toLowerCase()}`)] : []),
      i.obs ? `  OBS: ${i.obs}` : null,
      `💵 ${i.qtd} x ${brl(i.unit)} = ${brl(i.unit * i.qtd)}`,
    ]),
    '',
    linha,
    '',
    `SUBTOTAL: ${brl(sub)}`,
    entrega ? `ENTREGA: ${tx === null ? 'a confirmar' : brl(tx)}` : null,
    `*VALOR FINAL: ${brl(sub + (tx ?? 0))}${tx === null ? ' + entrega' : ''}*`,
    '',
    'PAGAMENTO',
    `*${pag}*`,
    pag === 'Dinheiro' ? (troco ? `Troco para ${brl(troco)}` : 'Não precisa de troco') : null,
    comPix ? 'Vou mandar o comprovante aqui' : null,
    ...(obs ? ['', '📝   Observações', obs] : []),
    '',
    `👉 Abrir no painel: ${painel}`,
  ].filter(x => x !== null).join('\n');
}

// ---------- início ----------
renderLoja(); // antes de restaurar o cliente: o bairro salvo precisa das opções já no select
const cliente = store.get('cliente', {});
CAMPOS.forEach(k => { if (cliente[k]) $('#' + k).value = cliente[k]; });
$('#bairroOutro').hidden = $('#bairro').value !== 'outro';
$('#fone').value = mascaraFone($('#fone').value);
salvar();
