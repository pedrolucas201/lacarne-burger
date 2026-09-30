import './vendor/material.js';
import { HORARIO, aberto, proximaAbertura } from './horario.js?v=11';
import { pix } from './pix.js?v=11';

// ===== Configuração da loja (edite aqui) =====
const LOJA = { nome: 'La Carne Burger', whatsapp: '5581984793839', cidade: 'Vitória de Santo Antão - PE',
  pix: '+5581984793839' }; // chave Pix (telefone com +55); vazio = sem Pix copia e cola
// taxa de entrega por bairro (tabela da MotoJá); bairro fora da lista = "a confirmar no WhatsApp"
const TAXAS = {
  'Água Branca': 7, 'Alto do Cigano': 7, 'Alto José Leal (até o Mercado do Lar)': 7, 'Amparo': 6, 'Atacarejo': 9,
  'Bairro Nobre': 8, 'Bairro Novo': 7, 'Bairro Treze': 5, 'Balança': 7, 'Bela Vista': 7, 'Bela Vista 2': 8,
  'Belo Horizonte': 7, 'Borges': 6, 'Privê Borges': 7, 'Caic': 7, 'Caiçara 1': 7, 'Caiçara 2 e 3': 8, 'Cajá': 7,
  'Cajueiro': 9, 'Campinas': 8, 'Colorado': 8, 'Cond. Águas Claras': 8, 'Cond. Bela Vista 2': 8, 'Doutor Alvinho': 7,
  'Irã': 7, 'Iraque 1': 7, 'Iraque 2': 8, 'Jardim Ipiranga': 7, 'Jardim São Pedro': 7, 'José de Lemos': 7,
  'Lagoa Redonda': 7, 'Lídia Queiroz': 7, 'Livramento': 5, 'Lot. de Baú': 8, 'Lot. Paraíso': 7, 'Lot. Real': 7,
  'Lot. Tropical': 7, 'Lot. Veneza': 8, 'Mangueira': 5, 'Maranhão': 7, 'Mário Bezerra': 7, 'Matadouro': 7,
  'Matriz': 5, 'Maués': 8, 'Militina': 8, 'Natuba': 10, 'Petrobras': 7, 'Pinga Fogo': 6, 'Privê Shopping': 10,
  'Redenção': 7, 'Santana': 9, 'Shopping (fora)': 8, 'Shopping (dentro)': 10, 'Sítio do Meio': 7, 'Trajanos': 7,
};
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

// ---------- horário ----------
// ?teste no link libera pedidos fora do horário (pra demonstrar o site)
const TESTE = new URLSearchParams(location.search).has('teste');
const podePedir = () => TESTE || aberto();
const fechadoMsg = () => `Estamos fechados agora 🌙 Abrimos ${proximaAbertura()}.`;
function status() {
  const on = aberto();
  $('#status').className = `status ${on ? 'on' : 'off'}`;
  $('#status').textContent = (on ? `Aberto agora · até ${HORARIO.fecha}h` : `Fechado · abre ${proximaAbertura()}`) + (TESTE ? ' · modo teste' : '');
}
document.querySelectorAll('.horario').forEach(el => el.textContent = HORARIO.texto);
status();
setInterval(status, 30000);

// ---------- cardápio ----------
$('#menu').innerHTML = MENU.map((i, n) => `
  <article class="card" style="--d:${n * 80}ms">
    <div class="emoji"><img src="img/burger.webp" alt=""><span>${i.emoji}</span></div>
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
  if (!podePedir()) return toast(fechadoMsg(), true);
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
// 0 na retirada, null se o bairro não foi escolhido ou está fora da tabela
const taxa = () => radio('tipo') !== 'Entrega' ? 0 : TAXAS[$('#bairro').value] ?? null;
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

$('#bairro').insertAdjacentHTML('beforeend', Object.entries(TAXAS)
  .map(([b, t]) => `<option value="${esc(b)}">${esc(b)} · ${brl(t)}</option>`).join('')
  + '<option value="outro">Outro bairro (taxa a confirmar)</option>');

// lembra os dados do cliente para o próximo pedido
const CAMPOS = ['nome', 'fone', 'rua', 'numero', 'bairro', 'bairroOutro', 'compl', 'ref'];
const cliente = store.get('cliente', {});
CAMPOS.forEach(k => { if (cliente[k]) $('#' + k).value = cliente[k]; });
$('#bairroOutro').hidden = $('#bairro').value !== 'outro';

// (81) 9 8479-3839 para celular, (81) 3333-4444 para fixo
function mascaraFone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d && `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `, r = d.slice(2);
  if (d.length === 11) return `${ddd}${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`;
  return ddd + (r.length > 4 ? `${r.slice(0, 4)}-${r.slice(4)}` : r);
}
$('#fone').value = mascaraFone($('#fone').value);
$('#fone').addEventListener('input', e => { e.target.value = mascaraFone(e.target.value); });

// ---------- enviar para o WhatsApp ----------
$('#enviar').onclick = () => {
  if (!carrinho.length) return toast('Sua sacola está vazia', true);
  if (!podePedir()) return toast(fechadoMsg(), true);
  const f = id => $('#' + id).value.trim();
  const entrega = radio('tipo') === 'Entrega';
  const pag = radio('pag');
  const vazio = ['nome', 'fone', ...(entrega ? ['rua', 'numero', 'bairro'] : []), ...(entrega && f('bairro') === 'outro' ? ['bairroOutro'] : [])].find(id => !f(id));
  if (vazio) { $('#' + vazio).reportValidity(); $('#' + vazio).focus(); return toast(`Preencha: ${$('#' + vazio).label || $('#' + vazio).ariaLabel}`, true); }
  if (f('fone').replace(/\D/g, '').length < 10) { $('#fone').focus(); return toast('Telefone inválido (inclua o DDD)', true); }
  if (!pag) return toast('Escolha a forma de pagamento', true);
  const sub = subtotal(), tx = taxa(), total = sub + (tx ?? 0), troco = +f('troco') || 0;
  if (pag === 'Dinheiro' && troco && troco < total) return toast(`O troco precisa ser maior que ${brl(total)}`, true);

  const c = Object.fromEntries(CAMPOS.map(k => [k, f(k)]));
  store.set('cliente', c);
  const cod = Date.now().toString(36).slice(-5).toUpperCase();
  const comPix = pag === 'Pix' && LOJA.pix;
  // api.whatsapp.com direto: o redirect do wa.me corrompe emojis
  const url = `https://api.whatsapp.com/send?phone=${LOJA.whatsapp}&text=${encodeURIComponent(mensagem(c, entrega, pag, troco, sub, tx, f('obsGeral'), cod, comPix))}`;
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
  $('#pixCodigo').value = pix({ chave: LOJA.pix, nome: LOJA.nome, cidade: LOJA.cidade.split(' - ')[0], valor, txid: cod });
  $('#pixInfo').textContent = valor
    ? `Valor: ${brl(valor)}. Copie o código e cole na opção "Pix copia e cola" do app do seu banco.`
    : 'Confirme o valor com a taxa de entrega no WhatsApp, depois copie o código, cole na opção "Pix copia e cola" do app do seu banco e digite o valor.';
  $('#pixDialog').show();
}
$('#pixCopiar').onclick = async () => {
  try { await navigator.clipboard.writeText($('#pixCodigo').value); toast('Código Pix copiado ✅'); }
  catch { $('#pixCodigo').select(); toast('Selecione o código e copie', true); }
};

function mensagem(c, entrega, pag, troco, sub, tx, obs, cod, comPix) {
  const bairro = c.bairro === 'outro' ? c.bairroOutro : c.bairro;
  const endereco = `${c.rua}, ${c.numero}, ${bairro}, ${LOJA.cidade}`;
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
  ].filter(x => x !== null).join('\n');
}

salvar();
