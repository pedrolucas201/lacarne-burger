import './vendor/material.js';

// ===== Configuração da loja (edite aqui) =====
const LOJA = { nome: 'La Carne Burger', whatsapp: '5581984793839' };
const PONTO = { titulo: 'Ponto da carne', itens: ['Mal passado', 'Ao ponto', 'Bem passado'] };
const MENU = [
  { id: 'manso', nome: 'Manso', preco: 20, emoji: '🍔', escolhas: [PONTO],
    desc: 'Pão brioche, 150g de hambúrguer artesanal, queijo cheddar e maionese da casa.',
    tira: ['Queijo cheddar', 'Maionese da casa'] },
  { id: 'abusado', nome: 'Abusado', preco: 22, emoji: '🍫', escolhas: [PONTO],
    desc: 'Pão brioche, hambúrguer artesanal, queijo cheddar e Nutella.',
    tira: ['Queijo cheddar'] },
  { id: 'matuto', nome: 'Matuto', preco: 25, emoji: '🧀', escolhas: [PONTO],
    desc: 'Pão brioche, 150g de hambúrguer artesanal, queijo coalho no mel, queijo cheddar e cebola caramelizada.',
    tira: ['Queijo cheddar', 'Cebola caramelizada'] },
  { id: 'bruto', nome: 'Bruto', preco: 32, emoji: '🥓', escolhas: [PONTO],
    desc: 'Pão brioche, duplo hambúrguer artesanal (150g cada), queijo cheddar, bacon, cebola caramelizada e maionese da casa.',
    tira: ['Bacon', 'Cebola caramelizada', 'Maionese da casa'] },
];
// =============================================

const $ = s => document.querySelector(s);
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const toast = (text, erro = false) => Toastify({
  text, duration: 2800, gravity: 'top', position: 'center', stopOnFocus: true,
  className: erro ? 'toast erro' : 'toast',
}).showToast();
const radio = name => [...document.querySelectorAll(`md-radio[name="${name}"]`)].find(r => r.checked)?.value;

// preço sempre vem do MENU: o que está salvo no navegador pode ter sido alterado
let carrinho = store.get('carrinho', []).flatMap(i => {
  const m = MENU.find(x => x.id === i?.id);
  const qtd = Math.min(99, Math.max(1, parseInt(i.qtd) || 1));
  return m && Array.isArray(i.escolhas) && Array.isArray(i.sem)
    ? [{ ...i, nome: m.nome, unit: m.preco, qtd, obs: String(i.obs || '').slice(0, 200) }] : [];
});
let atual = null;

// ---------- cardápio ----------
$('#menu').innerHTML = MENU.map((i, n) => `
  <article class="card" style="--d:${n * 80}ms">
    <div class="emoji"><img src="img/burger.webp" alt="" loading="lazy"><span>${i.emoji}</span></div>
    <h3>${i.nome}</h3>
    <p>${i.desc}</p>
    <div class="rodape">
      <strong>${brl(i.preco)}</strong>
      <md-filled-tonal-button data-id="${i.id}"><md-icon slot="icon">add</md-icon>Adicionar</md-filled-tonal-button>
    </div>
  </article>`).join('');
$('#menu').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) abrirItem(MENU.find(i => i.id === b.dataset.id));
});

// ---------- personalizar item ----------
const dItem = $('#itemDialog');
function abrirItem(item) {
  atual = { item, qtd: 1 };
  $('#itemTitulo').textContent = item.nome;
  $('#itemCorpo').innerHTML = `
    <p class="desc">${item.desc}</p>
    ${item.escolhas.map((e, i) => `
      <fieldset><legend>${e.titulo} <span class="obrig">obrigatório</span></legend>
        ${e.itens.map(op => `<label class="opt"><md-radio name="e${i}" value="${op}"></md-radio>${op}</label>`).join('')}
      </fieldset>`).join('')}
    <fieldset><legend>Quer tirar algo?</legend>
      <md-chip-set>${item.tira.map(t => `<md-filter-chip label="Sem ${t.toLowerCase()}" data-v="${t}"></md-filter-chip>`).join('')}</md-chip-set>
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
  $('#totais').innerHTML = `
    <div><span>Subtotal</span><span>${brl(subtotal())}</span></div>
    ${radio('tipo') === 'Entrega' ? '<div class="nota"><span>Taxa de entrega</span><span>a confirmar no WhatsApp</span></div>' : ''}
    <div class="total"><span>Total</span><span>${brl(subtotal())}</span></div>`;
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
  salvar();
});
const abrirSacola = () => carrinho.length ? dCart.show() : toast('Sua sacola está vazia. Escolha um burger! 🍔', true);
$('#cartBtn').onclick = abrirSacola;
$('#cartBarBtn').onclick = abrirSacola;
document.querySelectorAll('[data-fechar]').forEach(b => b.onclick = () => b.closest('md-dialog').close());

// lembra os dados do cliente para o próximo pedido
const CAMPOS = ['nome', 'fone', 'rua', 'numero', 'bairro', 'compl', 'ref'];
const cliente = store.get('cliente', {});
CAMPOS.forEach(k => { if (cliente[k]) $('#' + k).value = cliente[k]; });

// ---------- enviar para o WhatsApp ----------
$('#enviar').onclick = () => {
  if (!carrinho.length) return toast('Sua sacola está vazia', true);
  const f = id => $('#' + id).value.trim();
  const entrega = radio('tipo') === 'Entrega';
  const pag = radio('pag');
  const vazio = ['nome', 'fone', ...(entrega ? ['rua', 'numero', 'bairro'] : [])].find(id => !f(id));
  if (vazio) { $('#' + vazio).reportValidity(); $('#' + vazio).focus(); return toast(`Preencha: ${$('#' + vazio).label}`, true); }
  if (f('fone').replace(/\D/g, '').length < 10) { $('#fone').focus(); return toast('Telefone inválido (inclua o DDD)', true); }
  if (!pag) return toast('Escolha a forma de pagamento', true);
  const total = subtotal(), troco = +f('troco') || 0;
  if (pag === 'Dinheiro' && troco && troco < total) return toast(`O troco precisa ser maior que ${brl(total)}`, true);

  const c = Object.fromEntries(CAMPOS.map(k => [k, f(k)]));
  store.set('cliente', c);
  const url = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(mensagem(c, entrega, pag, troco, total, f('obsGeral')))}`;
  window.open(url, '_blank', 'noopener');
  carrinho = [];
  salvar();
  dCart.close();
  toast('Pedido pronto! É só enviar no WhatsApp ✅');
};

function mensagem(c, entrega, pag, troco, total, obs) {
  const cod = Date.now().toString(36).slice(-5).toUpperCase();
  return [
    `🍔 *NOVO PEDIDO — ${LOJA.nome}*`,
    `Pedido #${cod} · ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    '',
    '*🧾 ITENS*',
    ...carrinho.flatMap(i => [`*${i.qtd}x ${i.nome}* — ${brl(i.unit * i.qtd)}`, ...detalhes(i).map(d => `   ▪ ${d}`)]),
    '',
    `*Total dos itens: ${brl(total)}*`,
    entrega ? '_(+ taxa de entrega a confirmar)_' : null,
    '',
    '*👤 CLIENTE*',
    `Nome: ${c.nome}`,
    `Telefone: ${c.fone}`,
    '',
    entrega ? '*🛵 ENTREGA*' : '*🏃 RETIRADA NO LOCAL*',
    ...(entrega ? [`${c.rua}, ${c.numero} — ${c.bairro}`,
      c.compl ? `Complemento: ${c.compl}` : null,
      c.ref ? `Referência: ${c.ref}` : null] : []),
    '',
    '*💳 PAGAMENTO*',
    pag + (pag === 'Dinheiro' ? (troco ? ` — troco para ${brl(troco)}` : ' — não precisa de troco') : ''),
    obs ? `\n*📝 OBSERVAÇÕES*\n${obs}` : null,
  ].filter(x => x !== null).join('\n');
}

salvar();
