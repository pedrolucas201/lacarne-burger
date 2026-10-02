import { noHorario, lojaAberta, proximaAbertura, hoje } from './horario.js';
import { pix } from './pix.js';
import { taxaDe, mapa, ponto, bairroDaTabela, precoItem, agrupar, locBoa, metros } from './pedido.js';
import { $, brl, esc, toast } from './util.js';
import { LOJA_ID, LOJA } from './lojas/lacarne.mjs';

// Material e Firebase (~650 KB) carregam em segundo plano: o cardápio aparece antes, a partir de lojas/lacarne.mjs
import('./vendor/material.js');
const fb = Promise.all([import('./firebase.js'), import('./vendor/firebase/base.js')])
  .then(([{ db }, f]) => ({ db, ...f }));

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const radio = name => [...document.querySelectorAll(`md-radio[name="${name}"]`)].find(r => r.checked)?.value;
// ?teste no link libera pedidos fora do horário (pra demonstrar o site)
const TESTE = new URLSearchParams(location.search).has('teste');

// ---------- loja: começa com o arquivo publicado; o banco, ao vivo, corrige e traz os botões do dia ----------
// ao vivo = já veio do banco. Antes disso não dá pra saber esgotado/fechar hoje: o selo de aberto espera e o envio também.
let loja = LOJA, aoVivo = false, banco = null; // banco = módulos do Firebase, guardados pro envio ficar síncrono (iPhone bloqueia o WhatsApp depois de await)
// plano B: se o banco recusar (App Check, bloqueador, VPN) ou não responder em 10 s, o pedido vai só pelo WhatsApp
let semBanco = false;
const semConexao = () => {
  if (aoVivo || semBanco) return;
  semBanco = true;
  toast('Não conectamos com a loja agora, mas você pode pedir normalmente pelo WhatsApp.', true);
};
const demorou = setTimeout(semConexao, 10000); // sem internet o onSnapshot só espera
fb.then(m => m.onSnapshot(m.doc(m.db, 'lojas', LOJA_ID), s => {
  if (!s.exists()) return semConexao();
  clearTimeout(demorou);
  loja = s.data();
  banco = m;
  aoVivo = true;
  carrinho = validar(carrinho); // preço do banco vence o do arquivo
  renderLoja();
}, semConexao)).catch(semConexao);

const esgotado = id => loja.esgotados?.[id] === hoje();
const itemDe = id => loja.cardapio.find(x => x.id === id);
const MAX_EXTRA = 5; // por adicional, por burger

// preço sempre vem do cardápio: o que está salvo no navegador pode ter sido alterado
const validar = lista => lista.flatMap(i => {
  const m = itemDe(i?.id);
  const qtd = Math.min(99, Math.max(1, parseInt(i.qtd) || 1));
  const extras = (Array.isArray(i.extras) ? i.extras : []).filter(x => loja.adicionais?.some(a => a.id === x));
  return m && Array.isArray(i.escolhas) && Array.isArray(i.sem)
    ? [{ ...i, nome: m.nome, extras, unit: precoItem(loja, { id: i.id, extras }), qtd, obs: String(i.obs || '').slice(0, 200) }] : [];
});
let carrinho = validar(store.get('carrinho', []));
let atual = null;

// ---------- horário ----------
const podePedir = () => TESTE || lojaAberta(loja);
const abre = () => proximaAbertura(loja.horario, undefined, loja.fechadaHoje === hoje());
const fechadoMsg = () => `Estamos fechados agora 🌙 Abrimos ${abre()}.`;
function status() {
  if (!aoVivo) return; // sem os botões do dia, "Fechado" poderia virar "Aberto" um segundo depois
  const on = lojaAberta(loja), h = loja.horario;
  $('#status').className = `status ${on ? 'on' : 'off'}`;
  $('#status').textContent = (on ? `Aberto agora${noHorario(h) ? ` · até ${h.fecha}h` : ''}` : `Fechado · abre ${abre()}`)
    + (TESTE ? ' · modo teste' : '');
}
setInterval(status, 30000);

// ---------- cardápio, bairros e horário (roda de novo a cada mudança no banco) ----------
function renderLoja() {
  document.querySelectorAll('.horario').forEach(el => el.textContent = loja.horario.texto);
  $('#onde').hidden = !loja.endereco;
  if (loja.endereco) $('#onde').innerHTML = `📍 <a href="${mapa(loja.endereco, loja.cidade)}" target="_blank" rel="noopener">${esc(loja.endereco)}</a>`;
  status();
  const ehBebida = i => i.tipo === 'bebida';
  $('#bebidas').innerHTML = loja.cardapio.filter(ehBebida).map(i => `
    <article class="bebida${esgotado(i.id) ? ' esgotado' : ''}" data-card="${esc(i.id)}">
      <img src="${esc(i.foto)}" alt="" loading="lazy">
      <h3>${esc(i.nome)}</h3><small>${esc(i.desc)}</small>
      <div class="pe"><strong>${brl(i.preco)}</strong><div class="ctrl" data-ctrl="${esc(i.id)}"></div></div>
    </article>`).join('');
  $('#menu').innerHTML = loja.cardapio.filter(i => !ehBebida(i)).map((i, n) => `
    <article class="card${esgotado(i.id) ? ' esgotado' : ''}" data-card="${esc(i.id)}" style="--d:${n * 80}ms">
      <div class="emoji ${i.foto ? 'com-foto' : i.boi ? 'com-boi' : 'sem-foto'}">${i.foto || i.boi
        ? `<img src="${esc(i.foto || i.boi)}" alt="" loading="lazy">` : ''}<span>${i.boi
          ? `<img class="mini-boi" src="${esc(i.boi)}" alt="">` : esc(i.emoji)}</span></div>
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
// + e − dos cards de bebida e da sugestão na sacola
const tocarBebida = e => {
  const b = e.target.closest('[data-beb]');
  if (!b) return;
  const item = itemDe(b.dataset.beb);
  if (+b.dataset.d > 0) return abrirItem(item);
  const linha = carrinho.find(i => i.id === item.id && !i.obs);
  if (linha && !--linha.qtd) carrinho.splice(carrinho.indexOf(linha), 1);
  salvar();
};
$('#bebidas').addEventListener('click', tocarBebida);
$('#sugestao').addEventListener('click', tocarBebida);
// o card inteiro abre o burger (não só o botão Adicionar)
$('#menu').addEventListener('click', e => {
  const card = e.target.closest('[data-card]');
  if (card) abrirItem(itemDe(card.dataset.card));
});

// ---------- personalizar item ----------
const dItem = $('#itemDialog');
// bebida não tem ponto, nem tirar, nem adicional: um toque e já vai pra sacola
function pegarBebida(item) {
  const igual = carrinho.find(i => i.id === item.id && !i.obs);
  igual ? igual.qtd = Math.min(99, igual.qtd + 1)
    : carrinho.push({ id: item.id, nome: item.nome, unit: item.preco, qtd: 1, escolhas: [], sem: [], extras: [], obs: '' });
  salvar();
  $('#badge').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 400 });
  if (!igual) toast(`${item.nome} na sacola 🥤`); // depois da primeira, o contador no card já mostra
}
const qtdBebida = id => carrinho.filter(i => i.id === id && !i.obs).reduce((s, i) => s + i.qtd, 0);
// card mostra + (zerado) ou − n + (já na sacola); sacola sugere bebida quando não tem nenhuma
function atualizarBebidas() {
  document.querySelectorAll('[data-ctrl]').forEach(c => {
    const id = c.dataset.ctrl, n = qtdBebida(id), nome = esc(itemDe(id)?.nome);
    c.innerHTML = esgotado(id) ? '<span class="selo">Esgotado</span>' : n
      ? `<md-icon-button data-beb="${esc(id)}" data-d="-1" aria-label="Menos ${nome}"><md-icon>${n > 1 ? 'remove' : 'delete'}</md-icon></md-icon-button>
         <span>${n}</span>
         <md-icon-button class="mais" data-beb="${esc(id)}" data-d="1" aria-label="Mais ${nome}"><md-icon>add</md-icon></md-icon-button>`
      : `<md-icon-button class="mais" data-beb="${esc(id)}" data-d="1" aria-label="Adicionar ${nome}"><md-icon>add</md-icon></md-icon-button>`;
  });
  const bebidas = loja.cardapio.filter(i => i.tipo === 'bebida' && !esgotado(i.id));
  const semBebida = carrinho.length && !carrinho.some(i => itemDe(i.id)?.tipo === 'bebida');
  $('#sugestao').hidden = !(semBebida && bebidas.length);
  if (!$('#sugestao').hidden) $('#sugestao').innerHTML = `<p>Que tal uma bebida? 🥤</p>
    <div class="trilho">${bebidas.map(i => `<button type="button" data-beb="${esc(i.id)}" data-d="1">
      <img src="${esc(i.foto)}" alt=""><span>${esc(i.nome)}</span><strong>+ ${brl(i.preco)}</strong></button>`).join('')}</div>`;
}
function abrirItem(item) {
  if (!podePedir()) return toast(fechadoMsg(), true);
  if (esgotado(item.id)) return toast(`${item.nome} esgotou 😕`, true);
  if (item.tipo === 'bebida') return pegarBebida(item);
  atual = { item, qtd: 1, extras: {} }; // extras: { cheddar: 2 }
  $('#itemTitulo').textContent = item.nome;
  const imagem = item.foto || item.boi;
  $('#itemCorpo').innerHTML = `
    ${imagem ? `<div class="item-foto ${item.foto ? 'com-foto' : 'com-boi'}"><picture>
      ${item.fotoAlta ? `<source media="(min-width: 800px)" srcset="${esc(item.fotoAlta)}">` : ''}
      <img src="${esc(imagem)}" alt="${esc(item.nome)}"></picture></div>` : ''}
    <p class="desc">${esc(item.desc)}</p>
    ${item.escolhas.map((e, i) => `
      <fieldset><legend>${esc(e.titulo)} <span class="obrig">obrigatório</span></legend>
        ${e.itens.map(op => `<label class="opt"><md-radio name="e${i}" value="${esc(op)}"></md-radio>${esc(op)}</label>`).join('')}
      </fieldset>`).join('')}
    <fieldset><legend>Quer tirar algo?</legend>
      <md-chip-set>${item.tira.map(t => `<md-filter-chip label="Sem ${esc(t.toLowerCase())}" data-v="${esc(t)}"></md-filter-chip>`).join('')}</md-chip-set>
    </fieldset>
    ${loja.adicionais?.length ? `<fieldset id="extras"><legend>Adicionais</legend>
      ${loja.adicionais.map(a => `<div class="extra"><span>${esc(a.nome)} <small>+ ${brl(a.preco)}</small></span>
        <div class="stepper">
          <md-icon-button data-x="${esc(a.id)}" data-d="-1" aria-label="Menos ${esc(a.nome)}"><md-icon>remove</md-icon></md-icon-button>
          <span data-n="${esc(a.id)}">0</span>
          <md-icon-button data-x="${esc(a.id)}" data-d="1" aria-label="Mais ${esc(a.nome)}"><md-icon>add</md-icon></md-icon-button>
        </div></div>`).join('')}
    </fieldset>` : ''}
    <md-outlined-text-field id="itemObs" maxlength="200" label="Observação (opcional)" type="textarea" rows="${matchMedia('(min-width: 800px)').matches ? 1 : 2}"
      placeholder="Ex.: cortar ao meio, molho à parte…"></md-outlined-text-field>`;
  $('#extras')?.addEventListener('click', e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x, n = Math.min(MAX_EXTRA, Math.max(0, (atual.extras[x] || 0) + +b.dataset.d));
    atual.extras[x] = n;
    $('#itemCorpo').querySelector(`[data-n="${x}"]`).textContent = n;
    atualizarItem();
  });
  atualizarItem();
  dItem.show();
}
const marcados = attr => [...$('#itemCorpo').querySelectorAll(`md-filter-chip[data-${attr}]`)].filter(x => x.selected).map(x => x.dataset[attr]);
// { cheddar: 2, bacon: 1 } → ['cheddar', 'cheddar', 'bacon'] na ordem do cardápio (mesma escolha = mesma lista)
const extrasDe = () => loja.adicionais?.flatMap(a => Array(atual.extras[a.id] || 0).fill(a.id)) ?? [];
function lerItem() {
  const { item, qtd } = atual, extras = extrasDe();
  return {
    id: item.id, nome: item.nome, unit: precoItem(loja, { id: item.id, extras }), qtd,
    escolhas: item.escolhas.map((e, i) => [e.titulo, radio(`e${i}`)]),
    sem: marcados('v'), extras,
    obs: $('#itemObs').value.trim(),
  };
}
function atualizarItem() {
  $('#itemQtd').textContent = atual.qtd;
  $('#itemTotal').textContent = brl(precoItem(loja, { id: atual.item.id, extras: extrasDe() }) * atual.qtd);
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
  const chave = JSON.stringify([novo.id, novo.escolhas, novo.sem, novo.extras, novo.obs]);
  const igual = carrinho.find(i => JSON.stringify([i.id, i.escolhas, i.sem, i.extras, i.obs]) === chave);
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
  i.extras.length ? `+ ${agrupar(i.extras, loja.adicionais).join(', ')}` : null,
  i.obs ? `Obs: ${i.obs}` : null,
].filter(Boolean);

function salvar() {
  atualizarBebidas();
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
    ${radio('tipo') === 'Entrega' ? `<div class="nota"><span>Taxa de entrega</span><span>${tx === null ? aConfirmar : brl(tx)}</span></div>
      ${loja.tempoEntrega ? `<div class="nota"><span>Tempo médio de entrega</span><span>${loja.tempoEntrega} min</span></div>` : ''}`
    : loja.endereco ? `<p class="onde">📍 Retire em ${esc(loja.endereco)}<br>
      <a href="${mapa(loja.endereco, loja.cidade)}" target="_blank" rel="noopener">ver no mapa</a></p>` : ''}
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

// ---------- CEP (opcional): preenche rua e, se o nome bater com a tabela, o bairro (e a taxa) ----------
let ultimoCep = '';
$('#cep').addEventListener('input', async e => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 8);
  e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  if (d.length < 8 || d === ultimoCep) return;
  ultimoCep = d;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) }).then(x => x.json());
    if (r.erro) return toast('CEP não encontrado. Preencha o endereço à mão.', true);
    const cidade = loja.cidade.split(' - ')[0];
    if (bairroDaTabela({ [cidade]: 0 }, r.localidade) !== cidade) return toast(`Esse CEP é de ${r.localidade}, fora da nossa área.`, true);
    if (r.logradouro) $('#rua').value = r.logradouro;
    const b = bairroDaTabela(loja.taxas, r.bairro);
    if (b) { $('#bairro').value = b; dCart.dispatchEvent(new Event('change')); }
    else if (r.bairro) toast(`Escolha o bairro na lista (o CEP diz "${r.bairro}").`, true);
    $('#numero').focus();
  } catch { toast('Não deu pra buscar o CEP agora. Preencha à mão.', true); }
});

// ---------- localização (opcional): link exato pro motoboy, além do endereço digitado ----------
let loc = '';
$('#usarLoc').onclick = () => {
  if (!navigator.geolocation) return toast('Seu celular não deixou pegar a localização.', true);
  $('#locInfo').hidden = false;
  $('#locInfo').textContent = 'Pegando sua localização…';
  loc = '';
  // o GPS começa impreciso e vai melhorando: acompanha até 10 s, fica com a melhor leitura e para antes se chegar a 30 m
  let melhor = null;
  const fim = () => {
    navigator.geolocation.clearWatch(vigia);
    clearTimeout(limite);
    if (melhor && locBoa(melhor.accuracy)) {
      loc = ponto(melhor.latitude, melhor.longitude);
      $('#locInfo').innerHTML = `📍 Localização adicionada (precisão de uns ${metros(melhor.accuracy)}) ·
        <a href="${mapa(loc)}" target="_blank" rel="noopener">conferir no mapa</a>`;
    } else {
      $('#locInfo').textContent = melhor
        ? `Não deu pra pegar sua localização exata (precisão de ${metros(melhor.accuracy)}). `
          + 'No celular com o GPS ligado funciona melhor. O endereço digitado já serve.'
        : 'Não deu pra pegar a localização agora. O endereço digitado já serve.';
    }
  };
  const vigia = navigator.geolocation.watchPosition(p => {
    if (!melhor || p.coords.accuracy < melhor.accuracy) melhor = p.coords;
    if (melhor.accuracy <= 30) fim();
  }, err => {
    if (melhor) return fim();
    navigator.geolocation.clearWatch(vigia);
    clearTimeout(limite);
    $('#locInfo').textContent = err.code === 1
      ? 'Você não permitiu a localização. Tudo bem, o endereço digitado já serve.'
      : 'Não deu pra pegar a localização agora. O endereço digitado já serve.';
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  const limite = setTimeout(fim, 10000);
};

// atalho só pra quem entrou no painel neste navegador (o painel marca/desmarca); o painel em si é protegido pelas regras
$('#painelBtn').hidden = !store.get('admin', false);

// ---------- capa: os bois dos burgers se revezam dentro do selo; tocar leva pro burger ----------
const bois = LOJA.cardapio.filter(i => i.boi); // do arquivo: não espera o banco
if (bois.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  $('#bois').innerHTML = bois.map(i =>
    `<button type="button" data-ir="${esc(i.id)}" aria-label="Ver o ${esc(i.nome)}"><img src="${esc(i.boi)}" alt=""></button>`).join('');
  $('#bois').classList.add('on');
  const botoes = [...$('#bois').children];
  let n = 0;
  const proximo = () => {
    botoes.forEach((b, k) => b.classList.toggle('atual', k === n));
    $('#boiNome').textContent = bois[n].nome;
    n = (n + 1) % botoes.length;
  };
  proximo();
  setInterval(proximo, 2500);
  $('#bois').addEventListener('click', e => {
    const card = $(`[data-card="${e.target.closest('[data-ir]')?.dataset.ir}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.animate([{ boxShadow: '0 0 0 0 rgb(179 55 42 / .6)' }, { boxShadow: '0 0 0 14px rgb(179 55 42 / 0)' }], { duration: 900, iterations: 2 });
  });
}

// ---------- enviar: grava no banco e abre o WhatsApp ----------
const CAMPOS = ['nome', 'fone', 'cep', 'rua', 'numero', 'bairro', 'bairroOutro', 'compl', 'ref'];
$('#enviar').onclick = () => {
  if (!carrinho.length) return toast('Sua sacola está vazia', true);
  if (!aoVivo && !semBanco) return toast('Ainda conectando com a loja, tenta de novo em instantes', true);
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
  // grava sem esperar: o WhatsApp abre de qualquer jeito (o pedido nunca se perde) e o pop-up não é bloqueado.
  // sem banco (plano B) não grava: a mensagem avisa a loja que o pedido não está no painel
  let painel = null;
  if (aoVivo) {
    const { db, doc, collection, setDoc, serverTimestamp } = banco;
    const ref = doc(collection(db, 'lojas', LOJA_ID, 'pedidos'));
    setDoc(ref, {
      cod, criadoEm: serverTimestamp(), status: 'novo', entrega, pag, obs: f('obsGeral'),
      troco: pag === 'Dinheiro' ? troco : 0, subtotal: sub, taxa: tx,
      cliente: { nome: c.nome, fone: c.fone, rua: entrega ? c.rua : '', numero: entrega ? c.numero : '',
        bairro: entrega ? bairro : '', compl: entrega ? c.compl : '', ref: entrega ? c.ref : '', loc: entrega ? loc : '' },
      // Firestore não aceita lista dentro de lista: escolhas vira { 'Ponto da carne': 'Ao ponto' }
      itens: carrinho.map(i => ({ id: i.id, nome: i.nome, unit: i.unit, qtd: i.qtd,
        escolhas: Object.fromEntries(i.escolhas), sem: i.sem, extras: i.extras, obs: i.obs })),
    }).catch(e => console.error('pedido não foi pro painel', e));
    painel = `${new URL('painel/', location.href).href}#${ref.id}`;
  }
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
      mapa(`${c.rua}, ${c.numero}, ${bairro}`, loja.cidade),
      ...(loc ? ['', 'Localização exata (GPS):', mapa(loc)] : []),
    ] : ['🏃   Retirada no local']),
    '',
    '------- ITENS DO PEDIDO -------',
    ...carrinho.flatMap(i => [
      '',
      `*${i.qtd} x ${i.nome.toUpperCase()}*`,
      ...i.escolhas.flatMap(([t, v]) => [`  ${t.toUpperCase()}`, `    - ${v}`]),
      ...(i.sem.length ? ['  RETIRAR', ...i.sem.map(x => `    - ${x.toLowerCase()}`)] : []),
      ...(i.extras.length ? ['  ADICIONAIS', ...agrupar(i.extras, loja.adicionais).map(t => `    + ${t}`)] : []),
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
    painel ? `👉 Abrir no painel: ${painel}` : '⚠️ Este pedido não entrou no painel (o site não conectou com a loja)',
  ].filter(x => x !== null).join('\n');
}

// ---------- início ----------
renderLoja(); // antes de restaurar o cliente: o bairro salvo precisa das opções já no select
const cliente = store.get('cliente', {});
CAMPOS.forEach(k => { if (cliente[k]) $('#' + k).value = cliente[k]; });
$('#bairroOutro').hidden = $('#bairro').value !== 'outro';
if (cliente.fone) $('#fone').value = mascaraFone(cliente.fone); // campo do Material pode não ter carregado ainda: não ler .value dele aqui
salvar();
