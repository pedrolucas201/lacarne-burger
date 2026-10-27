import { noHorario, lojaAberta, proximaAbertura, hoje } from './horario.js';
import { pix } from './pix.js';
import { taxaDe, mapa, ponto, bairroDaTabela, precoItem, agrupar, extrasTxt, locBoa, metros, soDigitos, foneOk, whats, avisoAlteracao } from './pedido.js';
import { VALIDOS } from './numeros.js';
import { burgersDoPedido } from './avaliacao.js';
import { $, brl, esc, toast } from './util.js';
import { LOJA_ID, LOJA } from './lojas/lacarne.mjs';
import { montar } from './monta.js';

// Material e Firebase (~650 KB) carregam em segundo plano: o cardápio aparece antes, a partir de lojas/lacarne.mjs
import('./vendor/material.js');
const fb = Promise.all([import('./firebase.js'), import('./vendor/firebase/base.js')])
  .then(([{ db }, f]) => ({ db, ...f }));

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const radio = name => [...document.querySelectorAll(`md-radio[name="${name}"]`)].find(r => r.checked)?.value;
const centavos = v => Math.round(v * 100) / 100;
// ?teste no link libera pedidos fora do horário (pra demonstrar o site)
const TESTE = new URLSearchParams(location.search).has('teste');
// ?balcao: a loja lança o pedido (o painel abre isto por cima dele). Usa o login do painel, ignora o horário,
// grava já aceito e não abre WhatsApp nem Pix. Sacola separada da de cliente
const BALCAO = new URLSearchParams(location.search).has('balcao');
// ?balcao&editar=<id>: o painel abre o pedido pra alterar itens, pagamento, troco e observação (cliente e endereço ficam)
const EDITAR = BALCAO && new URLSearchParams(location.search).get('editar');
const SACOLA = EDITAR ? 'carrinhoEditar' : BALCAO ? 'carrinhoBalcao' : 'carrinho';
let orig = null; // pedido como estava no banco, na edição
const logado = BALCAO && Promise.all([import('./firebase.js'), import('./vendor/firebase/auth.js')]).then(async ([{ app, LOCAL }, a]) => {
  const auth = a.getAuth(app);
  if (LOCAL) a.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await auth.authStateReady();
  return auth.currentUser;
}).catch(() => null);

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
const adicional = x => loja.adicionais?.find(a => a.id === x);
// `max` do adicional = total no burger, contando o que já vem na receita (o Bruto já tem 2 carnes, então só cabe mais 1)
const maxDe = (x, id) => {
  const a = adicional(x);
  if (!a?.max) return MAX_EXTRA;
  const receita = LOJA.cardapio.find(i => i.id === id)?.camadas ?? [];
  return Math.max(0, a.max - receita.filter(c => c === x).length);
};

// preço sempre vem do cardápio: o que está salvo no navegador pode ter sido alterado
// edição: linha que já estava no pedido (fixo) mantém o preço da época; o que entra agora vale o cardápio.
// ponytail: mais unidades na mesma linha (ou burger igual somado a ela) saem pelo preço antigo
const validar = lista => lista.flatMap(i => {
  const m = itemDe(i?.id);
  const qtd = Math.min(99, Math.max(1, parseInt(i.qtd) || 1));
  const n = {}; // sacola antiga ou mexida não passa do teto de cada adicional
  const extras = (Array.isArray(i.extras) ? i.extras : []).filter(x => adicional(x) && (n[x] = (n[x] || 0) + 1) <= maxDe(x, i.id));
  return m && Array.isArray(i.escolhas) && Array.isArray(i.sem)
    ? [{ ...i, nome: m.nome, extras, unit: EDITAR && i.fixo ? i.unit : precoItem(loja, { id: i.id, extras }), qtd, obs: String(i.obs || '').slice(0, 200) }] : [];
});
let carrinho = EDITAR ? [] : validar(store.get(SACOLA, []));
let atual = null;

// ---------- horário ----------
const podePedir = () => TESTE || BALCAO || lojaAberta(loja);
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
  // "Quarta a sábado · 18h às 23h": dia normal, hora em destaque
  const [dias, horas = ''] = loja.horario.texto.split(' · ');
  document.querySelectorAll('.horario').forEach(el => el.innerHTML = `${esc(dias)}<strong>${esc(horas)}</strong>`);
  $('#onde').hidden = !loja.endereco;
  // "Rua do Borges, 489 - Bela Vista": rua numa linha, bairro na outra
  if (loja.endereco) $('#onde').innerHTML = `<h3>Onde fica</h3><address>${loja.endereco.split(' - ').map(esc).join('<br>')}</address>
    <a href="${mapa(loja.endereco, loja.cidade)}" target="_blank" rel="noopener">Ver no mapa →</a>`;
  status();
  const ehBebida = i => i.tipo === 'bebida';
  $('#bebidas').innerHTML = loja.cardapio.filter(ehBebida).map(i => `
    <article class="bebida${esgotado(i.id) ? ' esgotado' : ''}" data-card="${esc(i.id)}">
      <img src="${esc(i.foto)}" alt="" loading="lazy">
      <h3>${esc(i.nome)}</h3><small>${esc(i.desc)}</small>
      <div class="pe"><strong>${brl(i.preco)}</strong><div class="ctrl" data-ctrl="${esc(i.id)}"></div></div>
    </article>`).join('');
  $('#menu').innerHTML = loja.cardapio.filter(i => !ehBebida(i) && (BALCAO || !i.soBalcao)).map((i, n) => `
    <article class="card${esgotado(i.id) ? ' esgotado' : ''}" data-card="${esc(i.id)}" style="--d:${n * 80}ms">
      <div class="emoji ${i.foto ? 'com-foto' : i.boi ? 'com-boi' : 'sem-foto'}">${i.foto || i.boi
        ? `<img src="${esc(i.foto || i.boi)}" alt="" loading="lazy">` : ''}<span>${i.boi
          ? `<img class="mini-boi" src="${esc(i.boi)}" alt="">` : esc(i.emoji)}</span></div>
      <h3>${esc(i.nome)}${selo(i.id)}</h3>
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
// bebida (e carne crua) não tem ponto, nem tirar, nem adicional: um toque e já vai pra sacola
function pegarBebida(item) {
  const igual = carrinho.find(i => i.id === item.id && !i.obs);
  igual ? igual.qtd = Math.min(99, igual.qtd + 1)
    : carrinho.push({ id: item.id, nome: item.nome, unit: item.preco, qtd: 1, escolhas: [], sem: [], extras: [], obs: '' });
  salvar();
  $('#badge').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 400 });
  if (!igual) toast(`${item.nome} na sacola ${item.emoji || '🥤'}`); // depois da primeira, o contador no card já mostra
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
// ---------- avaliações: nota no card e "O que acharam" no burger aberto ----------
// Tudo de uma vez, em segundo plano, assim que o Firebase chega (sem esperar o "ao vivo"): o cardápio aparece na hora
// e, quando o cliente toca num burger, os comentários já estão na memória. Sem banco, sem selo nem comentários.
// Selo só com 5+ notas (uma nota ruim sozinha não marca o burger); comentários já passaram pelo filtro da loja.
const MIN_NOTAS = 5;
let medias = {}, depoimentos = {}; // depoimentos: { burgerId: [mais recentes primeiro] }
const virgula = n => n.toFixed(1).replace('.', ',');
const selo = id => medias[id] ? `<span class="selo-nota"><b>★ ${virgula(medias[id].media)}</b> (${medias[id].n})</span>` : '';
// selo e comentários carregam separados: um não espera o outro
fb.then(async ({ db, collection, query, where, getAggregateFromServer, count, average }) => {
  const notas = collection(db, 'lojas', LOJA_ID, 'notas');
  const burgers = LOJA.cardapio.filter(i => !i.tipo);
  const ag = await Promise.all(burgers.map(b => getAggregateFromServer(query(notas, where(`notas.${b.id}`, '>=', 1)),
    { n: count(), media: average(`notas.${b.id}`) }).catch(() => null)));
  burgers.forEach((b, k) => { const d = ag[k]?.data(); if (d?.n >= MIN_NOTAS) medias[b.id] = d; });
  // encaixa o selo nos cards já na tela (redesenhar o cardápio faria os cards piscarem); os próximos desenhos já vêm com ele
  Object.keys(medias).forEach(id => document.querySelector(`[data-card="${id}"] h3:not(:has(.selo-nota))`)?.insertAdjacentHTML('beforeend', selo(id)));
}).catch(() => {});
// ponytail: traz todos os depoimentos de uma vez (a loja libera poucos); com centenas, paginar por burger
const comentariosProntos = fb.then(async ({ db, collection, getDocs }) => {
  const s = await getDocs(collection(db, 'lojas', LOJA_ID, 'depoimentos'));
  s.docs.map(d => d.data()).sort((a, b) => b.criadoEm.toMillis() - a.criadoEm.toMillis())
    .forEach(d => (depoimentos[d.burger] ??= []).push(d));
}).catch(console.error);

// já carregado: aparece junto com o burger; se o cliente foi rápido demais, entra assim que chegar
async function opinioes(item) {
  await comentariosProntos;
  const deps = depoimentos[item.id] ?? [];
  // sem checar se a janela já abriu: com tudo na memória, isto roda antes do show() terminar
  if (!deps.length || atual?.item.id !== item.id || $('#itemCorpo .opinioes')) return;
  const mostrar = matchMedia('(min-width: 800px)').matches ? 2 : 3;
  const estrelas = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const card = d => `<div class="opiniao"><span class="estr">${estrelas(d.nota)}</span> <small>${esc(d.nome)}</small>
    <p>"${esc(d.comentario)}"</p></div>`;
  const m = medias[item.id], resto = deps.length - mostrar;
  const el = document.createElement('section');
  el.className = 'opinioes';
  el.innerHTML = `<h4>O que acharam ${m ? `<span class="selo-nota"><b>★ ${virgula(m.media)}</b> · ${m.n} notas</span>` : ''}</h4>
    ${deps.slice(0, mostrar).map(card).join('')}
    ${resto > 0 ? `<button type="button" class="mais-op">Ver mais ${resto} comentário${resto > 1 ? 's' : ''}</button>` : ''}`;
  // expandiu: só a coluna dos comentários cresce; a foto fica do tamanho que estava e a Observação volta ao normal
  el.querySelector('.mais-op')?.addEventListener('click', e => {
    const foto = $('#itemCorpo > .item-foto');
    if (foto) foto.style.minHeight = `${foto.offsetHeight}px`;
    el.classList.add('expandida');
    e.target.insertAdjacentHTML('beforebegin', deps.slice(mostrar).map(card).join(''));
    e.target.remove();
  });
  $('#itemCorpo').append(el);
}

function abrirItem(item) {
  if (!podePedir()) return toast(fechadoMsg(), true);
  if (esgotado(item.id)) return toast(`${item.nome} esgotou 😕`, true);
  if (item.tipo) return pegarBebida(item); // bebida e carne crua: sem diálogo
  // um burger por vez: com quantidade aqui, "2 bacons" era lido como o total (Nicolas, 25/10); repetir é no + da sacola
  atual = { item, qtd: 1, extras: {} }; // extras: { cheddar: 2 }
  $('#itemTitulo').textContent = item.nome;
  const imagem = item.foto || item.boi;
  $('#itemCorpo').innerHTML = `
    ${imagem ? `<div class="item-foto ${item.foto ? 'com-foto' : 'com-boi'}"><picture>
      ${item.fotoAlta ? `<source media="(min-width: 800px)" srcset="${esc(item.fotoAlta)}">` : ''}
      <img src="${esc(imagem)}" alt="${esc(item.nome)}"></picture></div>` : ''}
    <div class="item-dir">
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
      placeholder="Ex.: cortar ao meio, molho à parte…"></md-outlined-text-field>
    </div>`;
  opinioes(item);
  // receita e calibragem vêm do arquivo (o item do banco não tem as camadas)
  const receita = LOJA.cardapio.find(x => x.id === item.id);
  const foto = $('#itemCorpo .item-foto');
  const monta = receita?.camadas && foto ? montar(foto, receita, LOJA) : null;
  // abas Foto | Monte o seu: o cliente escolhe ver o lanche se montando; a escolha vale pros próximos burgers
  let montando = false, convite = null;
  const abas = monta && Object.assign(document.createElement('div'), { className: 'monta-abas', role: 'tablist',
    innerHTML: '<button type="button" role="tab" data-m="0">📷 Foto</button><button type="button" role="tab" data-m="1">🍔 Monte o seu</button>' });
  const alterna = liga => {
    montando = liga;
    store.set('montar', liga);
    liga ? monta.atualizar(marcados('v'), extrasDe(), null) : monta.desligar(); // ligar mostra o que já foi escolhido, sem voo
    abas.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.m === +liga)));
    foto.prepend(abas);
  };
  // 1ª vez que mexe com a foto na tela: convida a ver montando (uma vez por navegador)
  const convidar = () => {
    if (convite || store.get('montarConvite', false)) return;
    store.set('montarConvite', true);
    convite = Object.assign(document.createElement('button'), { type: 'button', className: 'monta-convite',
      innerHTML: 'Quer ver seu lanche sendo montado? <b>Ver ▶</b>' });
    convite.onclick = () => { convite.remove(); alterna(true); };
    // celular: a foto já rolou pra fora da tela, então o convite flutua acima do "Adicionar"
    matchMedia('(min-width: 800px)').matches ? foto.append(convite) : foto.closest('[slot]').append(convite);
    setTimeout(() => convite?.remove(), 7000);
  };
  const mexeu = origem => monta && (montando ? monta.atualizar(marcados('v'), extrasDe(), origem) : convidar());
  if (monta) {
    abas.onclick = e => { const b = e.target.closest('[data-m]'); if (b && +b.dataset.m !== +montando) alterna(!!+b.dataset.m); };
    alterna(store.get('montar', false));
  }
  $('#itemCorpo md-chip-set')?.addEventListener('click', e => {
    const c = e.target.closest('md-filter-chip');
    if (c) requestAnimationFrame(() => mexeu(c)); // o chip troca o "selected" depois do clique
  });
  // ponto escolhido fica destacado igual aos adicionais (o md-radio não expõe o "marcado" pro CSS)
  $('#itemCorpo').addEventListener('change', () =>
    $('#itemCorpo').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.querySelector('md-radio').checked)));
  $('#extras')?.addEventListener('click', e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const x = b.dataset.x, antes = atual.extras[x] || 0;
    const teto = maxDe(x, atual.item.id);
    if (+b.dataset.d > 0 && antes >= teto && adicional(x)?.maxMsg) return toast(adicional(x).maxMsg, true);
    const n = Math.min(teto, Math.max(0, antes + +b.dataset.d));
    if (n === antes) return;
    atual.extras[x] = n;
    const contador = $('#itemCorpo').querySelector(`[data-n="${x}"]`);
    contador.textContent = n;
    contador.closest('.extra').classList.toggle('on', n > 0);
    atualizarItem();
    mexeu(b);
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
  $('#itemTotal').textContent = brl(precoItem(loja, { id: atual.item.id, extras: extrasDe() }) * atual.qtd);
}
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
  toast(`${novo.nome} na sacola 🍔 Outro igual? Toque no + da sacola`);
};

// ---------- sacola ----------
const dCart = $('#cartDialog');
const subtotal = () => carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
// 0 na retirada, null se o bairro não foi escolhido ou está fora da tabela
const taxa = () => EDITAR ? orig?.taxa ?? null : taxaDe(loja, radio('tipo') === 'Entrega', $('#bairro').value); // edição: endereço não muda, taxa também não
const detalhes = i => [
  ...i.escolhas.map(([t, v]) => `${t}: ${v}`),
  i.sem.length ? `Sem: ${i.sem.join(', ').toLowerCase()}` : null,
  i.extras.length ? extrasTxt(i, loja.adicionais) : null,
  i.obs ? `Obs: ${i.obs}` : null,
].filter(Boolean);

function salvar() {
  atualizarBebidas();
  store.set(SACOLA, carrinho);
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
    : loja.endereco && !BALCAO ? `<p class="onde">📍 Retire em ${esc(loja.endereco)}<br>
      <a href="${mapa(loja.endereco, loja.cidade)}" target="_blank" rel="noopener">ver no mapa</a></p>` : ''}
    <div class="total"><span>Total</span><span>${brl(subtotal() + (tx ?? 0))}${tx === null ? ' + entrega' : ''}</span></div>`;
  atualizarPag();
}
// balcão e edição: uma forma (tocar em outra troca). Com "Dividir forma de pagamento" ligado, marca 2 ou 3.
// digita os valores em qualquer campo; o que foi mexido há mais tempo (ou nunca) completa o total
const chips = () => [...document.querySelectorAll('#pagChips md-filter-chip')];
const formas = () => BALCAO ? chips().filter(c => c.selected).map(c => c.dataset.pag) : [radio('pag')].filter(Boolean);
const totalAgora = () => subtotal() + (taxa() ?? 0);
const valores = () => formas().map((_, i) => $('#valor' + (i + 1)));
const somar = l => centavos(l.reduce((s, v) => s + v, 0));
let mexidos = [], formasAntes = ''; // mexidos: campos na ordem em que foram digitados (o último é o mais recente)
function completar() {
  const cs = valores(), recentes = mexidos.filter(c => cs.includes(c)).slice(-(cs.length - 1));
  const alvo = cs.findLast(c => !recentes.includes(c)), outros = cs.filter(c => c !== alvo).map(c => +c.value);
  alvo.value = outros.every(v => v > 0) ? String(centavos(totalAgora() - somar(outros))) : '';
  cs.forEach(c => c.closest('.parte').classList.toggle('auto', c === alvo && !!alvo.value));
  mostrarResto();
}
function mostrarResto() {
  const vs = valores().map(c => +c.value || 0), falta = centavos(totalAgora() - somar(vs)), r = $('#resto');
  r.className = taxa() === null || falta ? 'erro' : 'ok';
  r.innerHTML = taxa() === null ? '<span>Com a entrega a confirmar não dá pra dividir</span>'
    : falta > 0 ? `<span>Falta</span><b>${brl(falta)}</b>`
    : falta < 0 ? `<span>Passou do total</span><b>${brl(-falta)}</b>`
    : `<span>Fechou ✓</span><b>${brl(totalAgora())}</b>`;
}
function atualizarPag() {
  const fs = formas(), dividindo = BALCAO && $('#dividir').selected;
  $('#divisao').hidden = fs.length < 2;
  $('#pagChips').classList.toggle('grandes', dividindo);
  $('#passo1').hidden = !dividindo;
  $('#pagConta').textContent = fs.length < 2 ? 'marque 2 ou 3' : `${fs.length} de 3`;
  [1, 2, 3].forEach(i => { $('#valor' + i).closest('.parte').hidden = i > fs.length; });
  if (fs.join() !== formasAntes) { // trocou as formas: começa a divisão do zero
    if (formasAntes) [1, 2, 3].forEach(i => { $('#valor' + i).value = ''; });
    formasAntes = fs.join(); mexidos = [];
  }
  if (fs.length > 1) {
    valores().forEach((c, i) => { c.closest('.parte').querySelector('span').textContent = chips().find(x => x.dataset.pag === fs[i]).label; });
    completar(); // a sacola mudou: o que completa acompanha
  }
  $('#troco').hidden = !fs.includes('Dinheiro');
}
[1, 2, 3].forEach(i => $('#valor' + i).addEventListener('input', () => {
  const c = $('#valor' + i);
  mexidos = [...mexidos.filter(x => x !== c), c];
  completar();
}));
$('#pagChips').addEventListener('click', e => {
  const c = e.target.closest('md-filter-chip');
  if (c) setTimeout(() => { // o chip troca o selected depois do clique
    const outros = chips().filter(x => x.selected && x !== c);
    if (c.selected && !$('#dividir').selected) outros.forEach(x => { x.selected = false; });
    else if (c.selected && outros.length > 2) { c.selected = false; toast('No máximo 3 formas', true); }
    atualizarPag();
  });
});
// desligou: fica só a primeira forma marcada
$('#dividir').addEventListener('change', () => {
  if (!$('#dividir').selected) chips().filter(c => c.selected).slice(1).forEach(c => { c.selected = false; });
  atualizarPag();
});
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
  if (!aoVivo && (BALCAO || !semBanco)) return toast('Ainda conectando com a loja, tenta de novo em instantes', true);
  if (!podePedir()) return toast(fechadoMsg(), true);
  const acabou = carrinho.find(i => esgotado(i.id) && !orig?.itens.some(o => o.id === i.id)); // o que já estava no pedido pode ter esgotado depois
  if (acabou) return toast(`${acabou.nome} esgotou, tira da sacola 😕`, true);
  const f = id => $('#' + id).value.trim();
  const entrega = radio('tipo') === 'Entrega', local = radio('tipo') === 'Local';
  const fs = formas(), [pag] = fs, dividido = fs.length > 1;
  const vazio = !EDITAR && ['nome', ...(BALCAO ? [] : ['fone']), ...(entrega ? ['rua', 'numero', 'bairro'] : []),
    ...(entrega && f('bairro') === 'outro' ? ['bairroOutro'] : [])].find(id => !f(id));
  if (vazio) { $('#' + vazio).reportValidity(); $('#' + vazio).focus(); return toast(`Preencha: ${$('#' + vazio).label || $('#' + vazio).ariaLabel}`, true); }
  // edição: pode trocar o telefone ou pôr um no pedido que não tinha, mas não apagar
  const pedeFone = EDITAR ? f('fone') || soDigitos(orig?.cliente.fone) : !BALCAO || f('fone');
  if (pedeFone && !foneOk(f('fone'))) { $('#fone').focus(); return toast('Telefone inválido: DDD + celular com o 9 (ex.: 81 9 9999-9999)', true); }
  if (!pag) return toast('Escolha a forma de pagamento', true);
  if (BALCAO && $('#dividir').selected && !dividido) return toast('Marque a 2ª forma ou desligue Dividir forma de pagamento', true);
  const sub = subtotal(), tx = taxa(), total = sub + (tx ?? 0), troco = +f('troco') || 0;
  const partes = valores().map(c => centavos(+c.value || 0));
  if (dividido) {
    if (tx === null) return toast('Com a entrega a confirmar não dá pra dividir', true);
    if (!partes.every(v => v > 0) || somar(partes) !== centavos(total))
      return toast(`${fs.join(', ')} precisam somar ${brl(total)}, cada um mais que zero`, true);
  }
  const divisao = dividido ? fs.map((pag, i) => ({ pag, valor: partes[i] })) : null;
  const emDinheiro = divisao ? divisao.find(d => d.pag === 'Dinheiro')?.valor : pag === 'Dinheiro' ? total : 0;
  if (emDinheiro && troco && troco < emDinheiro) return toast(`O troco precisa ser maior que ${brl(emDinheiro)}`, true);
  if (troco > 1000) return toast('Troco até R$ 1.000', true);
  const forma = fs.join(' + '), comTroco = emDinheiro ? troco : 0;
  // voltou pra uma forma só: divisao null apaga a antiga
  if (EDITAR) return alterar({ itens: paraBanco(), subtotal: sub, pag: forma, ...(divisao || orig.divisao ? { divisao } : {}),
    troco: comTroco, obs: f('obsGeral') }, f('fone'));

  const c = Object.fromEntries(CAMPOS.map(k => [k, f(k)]));
  if (!BALCAO) store.set('cliente', c);
  const bairro = c.bairro === 'outro' ? c.bairroOutro : c.bairro;
  const cod = Date.now().toString(36).slice(-5).toUpperCase();
  const comPix = pag === 'Pix' && loja.pix;
  // grava sem esperar: o pedido já está feito ao tocar aqui, o WhatsApp vira um aviso a mais na comanda.
  // sem banco (plano B) não grava: aí o pedido só chega pela mensagem, e a comanda diz que precisa enviar
  let painel = null;
  if (aoVivo) {
    const { db, doc, collection, setDoc, serverTimestamp } = banco;
    const ref = doc(collection(db, 'lojas', LOJA_ID, 'pedidos'));
    const pedido = {
      cod, criadoEm: serverTimestamp(), status: 'novo', entrega, pag: forma, ...(divisao ? { divisao } : {}), obs: f('obsGeral'),
      troco: comTroco, subtotal: sub, taxa: tx,
      cliente: { nome: c.nome, fone: c.fone, rua: entrega ? c.rua : '', numero: entrega ? c.numero : '',
        bairro: entrega ? bairro : '', compl: entrega ? c.compl : '', ref: entrega ? c.ref : '', loc: entrega ? loc : '' },
      itens: paraBanco(),
    };
    if (BALCAO) return lancar(ref, { ...pedido, status: 'preparo', aceitoEm: serverTimestamp(), local });
    // não gravou: a loja só fica sabendo pela mensagem, então a comanda passa a pedir o envio
    setDoc(ref, pedido).catch(e => { console.error('pedido não foi pro painel', e); precisaWhats(true); });
    painel = `${new URL('painel/', location.href).href}#${ref.id}`;
  }
  const url = `https://api.whatsapp.com/send?phone=${loja.whatsapp}&text=${encodeURIComponent(
    mensagem(c, entrega, bairro, pag, troco, sub, tx, f('obsGeral'), cod, comPix, painel))}`;
  comanda({ cod, total, tx, forma, entrega, url, feito: !!painel }); // desenha com a sacola antes de esvaziar
  carrinho = [];
  salvar();
  dCart.close();
  pixDepois = comPix ? () => abrirPix(tx === null ? null : total, cod) : null;
};

// comanda "na brasa": confirma o pedido feito; a comanda sai da impressora, o 1º burger pousa na grelha, a barra enche
// e aparece o botão do WhatsApp (opcional quando o pedido já está no painel; o iPhone só abre o WhatsApp direto num toque)
const dComanda = $('#comanda');
let urlComanda = null, pixDepois = null;
const precisaWhats = sim => {
  $('.comanda-passo').textContent = sim ? 'Pra loja receber, envie no WhatsApp 👇' : 'Pedido feito! A loja já recebeu ✅';
  $('#comandaEnviar').textContent = sim ? 'Enviar no WhatsApp 🔥' : 'Mandar também no WhatsApp';
};
function comanda({ cod, total, tx, forma, entrega, url, feito }) {
  urlComanda = url;
  precisaWhats(!feito);
  $('.comanda-loja').textContent = loja.nome;
  $('.comanda-num').textContent = `Pedido #${cod}`;
  const linha = (a, b = '', cls = '') => `<div class="cl ${cls}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  $('.comanda-itens').innerHTML = carrinho.map(i => linha(`${i.qtd}x ${i.nome}`, brl(i.unit * i.qtd))
    + (i.extras.length ? linha(extrasTxt(i, loja.adicionais), '', 'sub') : '')
    + (i.sem.length ? linha(`sem ${i.sem.join(', ').toLowerCase()}`, '', 'sub') : '')).join('')
    + linha(entrega ? 'Entrega' : 'Retirada', entrega ? (tx === null ? 'a confirmar' : brl(tx)) : '', 'tracejado')
    + linha(`Total · ${forma}`, brl(total), 'total');
  // o burger da grelha é a pilha do 1º lanche, com as escolhas do cliente (receita e calibragem vêm do arquivo)
  const par = carrinho.map(i => [i, LOJA.cardapio.find(x => x.id === i.id)]).find(([, r]) => r?.camadas);
  const lugar = $('.comanda-burger');
  lugar.innerHTML = '';
  $('.comanda-grelha').hidden = !par;
  dComanda.classList.remove('rodando');
  dComanda.showModal();
  if (par) montar(lugar, par[1], LOJA).atualizar(par[0].sem, par[0].extras, null);
  void dComanda.offsetWidth; // recomeça as animações a cada pedido
  dComanda.classList.add('rodando');
}
$('#comandaEnviar').onclick = () => { window.open(urlComanda, '_blank', 'noopener'); dComanda.close(); };
$('.comanda-fechar').onclick = () => dComanda.close();
dComanda.addEventListener('close', () => { pixDepois?.(); pixDepois = null; }); // Pix depois da comanda, como antes do WhatsApp

// Firestore não aceita lista dentro de lista: escolhas vira { 'Ponto da carne': 'Ao ponto' }
const paraBanco = () => carrinho.map(i => ({ id: i.id, nome: i.nome, unit: i.unit, qtd: i.qtd,
  escolhas: Object.fromEntries(i.escolhas), sem: i.sem, extras: i.extras, obs: i.obs }));

// edição: o cliente recebe o pedido novo no WhatsApp, no número novo se trocou (antes de qualquer await).
// Já entregue ou no local, não: é acerto da loja.
// Pedido já contado na ficha: o gasto muda pela diferença (cancelar depois desconta o valor novo). Trocou o telefone:
// o pedido sai da ficha antiga (apagada se era o único) e entra na nova, sem mudar o nome de quem já tinha ficha.
// Convite sem avaliação troca os burgers. ponytail: entregue sem convite que ganhou burger fica sem avaliação
async function alterar(m, fone) {
  const para = soDigitos(fone), novo = { ...orig, ...m, cliente: { ...orig.cliente, fone } };
  if (para && !orig.local && orig.status !== 'entregue') window.open(whats(fone, avisoAlteracao(novo, loja, orig)), '_blank', 'noopener');
  const { db, doc, runTransaction, increment, serverTimestamp } = banco, { registrar, erro } = await import('./registro.js');
  const loj = doc(db, 'lojas', LOJA_ID), ref = doc(loj, 'pedidos', EDITAR), convRef = doc(loj, 'convites', EDITAR);
  const burgers = burgersDoPedido(m.itens, loja.cardapio);
  $('#enviar').disabled = true;
  try {
    await runTransaction(db, async t => {
      const atual = (await t.get(ref)).data(), conv = await t.get(convRef);
      const avaliado = conv.exists() && (await t.get(doc(loj, 'avaliacoes', EDITAR))).exists();
      const de = soDigitos(atual.cliente.fone), contado = VALIDOS.includes(atual.status), trocou = contado && de !== para;
      const fichaDe = de ? doc(loj, 'clientes', de) : null, fichaPara = para ? doc(loj, 'clientes', para) : null;
      const [velha, nova] = trocou ? await Promise.all([fichaDe && t.get(fichaDe), fichaPara && t.get(fichaPara)]) : [];
      // antes: o pedido como chegou, gravado na primeira alteração e nunca mais (a regra confere)
      const como = x => ({ itens: x.itens, subtotal: x.subtotal, pag: x.pag, divisao: x.divisao ?? null, troco: x.troco, obs: x.obs, fone: x.cliente.fone });
      const reg = registrar(t, 'alterou', EDITAR, { cod: atual.cod, antes: como(atual), depois: como(novo) });
      t.update(ref, { ...m, ...(fone !== atual.cliente.fone ? { 'cliente.fone': fone } : {}), alteradoEm: serverTimestamp(), reg,
        antes: atual.antes ?? { itens: atual.itens, subtotal: atual.subtotal, pag: atual.pag, fone: atual.cliente.fone } });
      if (contado && !trocou && de && m.subtotal !== atual.subtotal) t.set(fichaDe, { gasto: increment(m.subtotal - atual.subtotal) }, { merge: true });
      if (trocou && velha?.exists()) velha.data().pedidos > 1
        ? t.update(fichaDe, { pedidos: increment(-1), gasto: increment(-atual.subtotal) }) : t.delete(fichaDe);
      if (trocou && fichaPara) {
        const n = nova.data(), quando = atual.criadoEm;
        t.set(fichaPara, { ...(n ? {} : { nome: atual.cliente.nome }), pedidos: increment(1), gasto: increment(m.subtotal),
          ...(!n?.primeiro || n.primeiro.toMillis() > quando.toMillis() ? { primeiro: quando } : {}),
          ...(!n?.ultimo || n.ultimo.toMillis() < quando.toMillis() ? { ultimo: quando } : {}) }, { merge: true });
      }
      const ids = burgers.map(x => x.id);
      if (conv.exists() && !avaliado && ids.length && ids.join() !== conv.data().ids.join()) t.update(convRef, { ids, burgers });
    });
  } catch (e) {
    console.error(e);
    erro(`alterar ${EDITAR}`, e);
    return toast('Não salvou. Confere a internet e tenta de novo', true);
  } finally { $('#enviar').disabled = false; }
  carrinho = [];
  salvar();
  if (parent !== window) parent.postMessage({ editado: EDITAR }, location.origin);
  else location.href = `painel/#${EDITAR}`;
}

// balcão: espera o banco responder (não tem WhatsApp pra abrir) e já conta o cliente, como o Aceitar do painel faz
async function lancar(ref, p) {
  if (!await logado) return toast('Entre no painel antes de lançar pedido', true);
  const { db, doc, runTransaction, increment, serverTimestamp } = banco, { registrar, erro } = await import('./registro.js');
  const fone = soDigitos(p.cliente.fone);
  $('#enviar').disabled = true;
  try {
    await runTransaction(db, async t => {
      const cRef = fone && doc(db, 'lojas', LOJA_ID, 'clientes', fone);
      const cli = cRef && await t.get(cRef);
      t.set(ref, { ...p, reg: registrar(t, 'lancou', ref.id, { cod: p.cod, subtotal: p.subtotal }) });
      if (cRef) t.set(cRef, { nome: p.cliente.nome, pedidos: increment(1), gasto: increment(p.subtotal), ultimo: serverTimestamp(),
        ...(cli.exists() ? {} : { primeiro: serverTimestamp() }) }, { merge: true });
    });
  } catch (e) {
    console.error(e);
    erro('lancar', e);
    return toast('Não salvou. Confere a internet e tenta de novo', true);
  } finally { $('#enviar').disabled = false; }
  carrinho = [];
  salvar();
  // o painel fecha esta tela, mostra o pedido e recarrega o balcão zerado pro próximo
  if (parent !== window) parent.postMessage({ lancado: ref.id }, location.origin);
  else location.href = `painel/#${ref.id}`;
}

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
      ...(i.extras.length ? [`  ADICIONAIS${i.qtd > 1 ? ' EM CADA' : ''}`, ...agrupar(i.extras, loja.adicionais).map(t => `    + ${t}`)] : []),
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
const cliente = BALCAO ? {} : store.get('cliente', {});
if (BALCAO) {
  document.body.classList.add('balcao');
  const tipo = v => $(`md-radio[name="tipo"][value="${v}"]`);
  $('#tipoLocal').hidden = false;
  $('#pagRadios').hidden = true;
  $('#pagChips').hidden = false;
  $('#dividirLinha').hidden = false;
  tipo('Entrega').removeAttribute('checked');
  tipo('Local').setAttribute('checked', '');
  $('#endereco').hidden = true;
  $('#cartDialog .headline span').textContent = 'Pedido';
  $('#dadosTit').textContent = 'Cliente';
  $('#tipoTit').textContent = 'Tipo do pedido';
  $('#nome').setAttribute('label', 'Nome ou mesa');
  $('#fone').removeAttribute('required');
  $('#fone').setAttribute('label', 'Telefone (opcional)');
  $('#fone').setAttribute('supporting-text', 'Com ele, o cliente recebe o link da avaliação');
  $('#enviar').innerHTML = '<md-icon slot="icon">check</md-icon>Lançar pedido';
}
// edição: carrega o pedido, esconde cliente/tipo/endereço e abre a sacola com o que foi pedido
if (EDITAR) {
  document.body.classList.add('editando');
  $('#enviar').innerHTML = '<md-icon slot="icon">check</md-icon>Salvar alteração';
  Promise.all([logado, fb]).then(async ([u, { db, doc, getDoc }]) => {
    if (!u) return toast('Entre no painel antes de alterar pedido', true);
    const d = await getDoc(doc(db, 'lojas', LOJA_ID, 'pedidos', EDITAR));
    if (!d.exists()) return toast('Pedido não encontrado', true);
    orig = d.data();
    carrinho = validar(orig.itens.map(i => ({ ...i, escolhas: Object.entries(i.escolhas || {}), fixo: true })));
    if (carrinho.length < orig.itens.length) toast('Algum item saiu do cardápio e ficou fora da sacola', true);
    const tipo = orig.entrega ? 'Entrega' : orig.local ? 'Local' : 'Retirada';
    document.querySelectorAll('md-radio[name="tipo"]').forEach(r => { r.checked = r.value === tipo; });
    const ps = orig.divisao ?? [{ pag: orig.pag }];
    document.querySelectorAll('md-radio[name="pag"]').forEach(r => { r.checked = r.value === ps[0].pag; });
    chips().forEach(c => { c.selected = ps.some(d => d.pag === c.dataset.pag); });
    $('#dividir').selected = ps.length > 1;
    [1, 2, 3].forEach(i => { $('#valor' + i).value = String(ps[i - 1]?.valor ?? ''); });
    $('#troco').value = orig.troco || '';
    $('#obsGeral').value = orig.obs;
    $('#fone').value = mascaraFone(orig.cliente.fone);
    if (orig.cliente.fone) $('#fone').setAttribute('label', 'Telefone'); // trocar pode, apagar não
    salvar();
    dCart.show();
  }).catch(e => { console.error(e); toast('Não deu pra abrir o pedido. Confere a internet', true); });
}
CAMPOS.forEach(k => { if (cliente[k]) $('#' + k).value = cliente[k]; });
$('#bairroOutro').hidden = $('#bairro').value !== 'outro';
if (cliente.fone) $('#fone').value = mascaraFone(cliente.fone); // campo do Material pode não ter carregado ainda: não ler .value dele aqui
salvar();
