import '../vendor/material.js';
import { app, db, LOJA_ID, LOCAL } from '../firebase.js';
import {
  doc, collection, query, where, orderBy, onSnapshot, getDoc, getDocs, updateDoc, runTransaction, serverTimestamp, increment, Timestamp,
} from '../vendor/firebase/base.js';
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged,
} from '../vendor/firebase/auth.js';
import { conferir, whats, avisoCliente, MOTIVOS, soDigitos } from '../pedido.js';
import { periodo, calcular, variacao, csv, VALIDOS } from '../numeros.js';
import { hoje } from '../horario.js';
import { $, brl, esc, toast } from '../util.js';

const auth = getAuth(app);
if (LOCAL) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // só no emulador: login sem popup, usado pelo teste e2e
  window.__entrar = email => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}
const lojaRef = doc(db, 'lojas', LOJA_ID);
const pedidosRef = collection(lojaRef, 'pedidos');
let loja = null, pedidos = [], pararPedidos = null, iniciado = false;

// ---------- login ----------
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' }); // permite trocar de conta se entrou com a errada
$('#entrar').onclick = () => signInWithPopup(auth, google).catch(e => toast(`Não deu pra entrar (${e.code})`, true));
$('#sair').onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  pararPedidos?.();
  pararPedidos = null;
  const acesso = user ? await getDoc(doc(lojaRef, 'admins', user.email)).then(d => d.exists(), () => false) : false;
  $('#login').hidden = acesso;
  $('#app').hidden = $('#abas').hidden = !acesso;
  $('#sair').hidden = !user;
  $('#loginMsg').textContent = user && !acesso ? `${user.email} não tem acesso a este painel.` : 'Entre com a conta Google da loja.';
  if (acesso) iniciar();
});

// ---------- abas e conexão ----------
$('#abas').addEventListener('click', e => {
  const b = e.target.closest('[data-aba]');
  if (!b) return;
  document.querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x === b));
  ['pedidos', 'numeros', 'loja'].forEach(a => { $(`#aba-${a}`).hidden = a !== b.dataset.aba; });
  if (b.dataset.aba === 'numeros') carregarNumeros();
});
const conexao = () => { $('#offline').hidden = navigator.onLine; };
addEventListener('online', conexao);
addEventListener('offline', conexao);
conexao();
document.querySelectorAll('[data-fechar]').forEach(b => b.onclick = () => b.closest('md-dialog').close());

// ---------- dados ao vivo ----------
function iniciar() {
  if (!iniciado) {
    iniciado = true;
    onSnapshot(lojaRef, s => { loja = s.data(); renderLoja(); renderPedidos(); });
  }
  const inicioDoDia = new Date(`${hoje()}T00:00:00-03:00`);
  let primeira = true;
  pararPedidos = onSnapshot(query(pedidosRef, where('criadoEm', '>=', Timestamp.fromDate(inicioDoDia)), orderBy('criadoEm', 'desc')), s => {
    const chegou = s.docChanges().some(c => c.type === 'added' && c.doc.data().status === 'novo');
    pedidos = s.docs.map(lerPedido);
    renderPedidos();
    if (primeira) { primeira = false; abrirDoLink(); } else if (chegou) alertar();
  });
}
const data = t => t?.toDate?.() ?? null;
const lerPedido = d => {
  const p = d.data({ serverTimestamps: 'estimate' });
  return { ...p, id: d.id, criadoEm: data(p.criadoEm), aceitoEm: data(p.aceitoEm), saiuEm: data(p.saiuEm), entregueEm: data(p.entregueEm) };
};

// ---------- pedidos ----------
const ETAPAS = { novo: 'Novo', preparo: 'Em preparo', saiu: 'Saiu', entregue: 'Entregue', cancelado: 'Cancelado' };
const CAMPO = { preparo: 'aceitoEm', saiu: 'saiuEm', entregue: 'entregueEm', cancelado: 'canceladoEm' };
const PROXIMA = { novo: 'preparo', preparo: 'saiu', saiu: 'entregue' };
const hora = d => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' }) : '';
const total = p => p.subtotal + (p.taxa ?? 0);
let atualId = null;

function renderPedidos() {
  if (!loja) return;
  const n = pedidos.filter(p => p.status === 'novo').length;
  $('#novos').hidden = !n;
  $('#novos').textContent = n;
  const grupos = Object.keys(ETAPAS).map(st => [st, pedidos.filter(p => p.status === st)]).filter(([, l]) => l.length);
  $('#listaPedidos').innerHTML = grupos.length ? grupos.map(([st, l]) => `
    <details class="grupo ${st}" ${['entregue', 'cancelado'].includes(st) ? '' : 'open'}>
      <summary>${ETAPAS[st]} · ${l.length}</summary>
      ${l.map(p => `<button class="pedido" data-id="${esc(p.id)}">
        <span><strong>#${esc(p.cod)} · ${esc(p.cliente.nome)}</strong>
          <small>${hora(p.criadoEm)} · ${p.entrega ? esc(p.cliente.bairro) : 'Retirada'} · ${esc(p.pag)}</small></span>
        <span class="valor">${brl(total(p))}${conferir(p, loja).ok ? '' : ' ⚠'}</span>
      </button>`).join('')}
    </details>`).join('') : '<p class="vazio">Nenhum pedido hoje ainda.</p>';
  if (atualId && $('#pedidoDialog').open) abrirPedido(atualId); // detalhe aberto acompanha a mudança
}
$('#listaPedidos').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) abrirPedido(b.dataset.id);
});
$('#pedidoDialog').addEventListener('closed', () => { atualId = null; });

function abrirPedido(id) {
  const p = pedidos.find(x => x.id === id);
  if (!p) return toast('Pedido não encontrado', true);
  atualId = id;
  const c = conferir(p, loja), cl = p.cliente;
  const mapa = `https://maps.google.com/?q=${encodeURIComponent(`${cl.rua}, ${cl.numero}, ${cl.bairro}, ${loja.cidade}`)}`;
  $('#pedTitulo').textContent = `#${p.cod} · ${ETAPAS[p.status]}`;
  $('#pedCorpo').innerHTML = `
    ${c.ok ? '' : `<p class="alerta">⚠ Valor não confere com o cardápio: deveria ser ${brl(c.subtotal)}${p.entrega
      ? ` + ${c.taxa === null ? 'entrega a confirmar' : `${brl(c.taxa)} de entrega`}` : ''}.</p>`}
    <p><strong>${esc(cl.nome)}</strong> · <a href="${whats(cl.fone, '')}" target="_blank" rel="noopener">${esc(cl.fone)}</a>
      <br><small>feito às ${hora(p.criadoEm)}</small></p>
    <p>${p.entrega ? `🛵 ${esc(cl.rua)}, ${esc(cl.numero)} · ${esc(cl.bairro)}${cl.compl ? ` · ${esc(cl.compl)}` : ''}
      ${cl.ref ? `<br><small>${esc(cl.ref)}</small>` : ''}<br><a href="${mapa}" target="_blank" rel="noopener">Abrir no mapa</a>`
      : '🏃 Retirada no local'}</p>
    <ul class="itens">${p.itens.map(i => `<li><strong>${esc(i.qtd)}x ${esc(i.nome)}</strong>
      ${Object.entries(i.escolhas || {}).map(([t, v]) => `<br><small>${esc(t)}: ${esc(v)}</small>`).join('')}
      ${i.sem?.length ? `<br><small>Sem: ${esc(i.sem.join(', '))}</small>` : ''}
      ${i.obs ? `<br><small>Obs: ${esc(i.obs)}</small>` : ''}</li>`).join('')}</ul>
    <p>Subtotal ${brl(p.subtotal)} · Entrega ${p.entrega ? (p.taxa === null ? 'a confirmar' : brl(p.taxa)) : '—'}
      <br><strong>Total ${brl(total(p))}</strong> · ${esc(p.pag)}${p.pag === 'Dinheiro' && p.troco ? ` · troco p/ ${brl(p.troco)}` : ''}</p>
    ${p.obs ? `<p>📝 ${esc(p.obs)}</p>` : ''}
    ${p.status === 'cancelado' ? `<p>Motivo: ${esc(p.motivo)}</p>` : ''}`;
  const prox = PROXIMA[p.status];
  const rotulo = { preparo: 'Aceitar', saiu: p.entrega ? 'Saiu pra entrega' : 'Pronto pra retirar', entregue: 'Entregue' }[prox];
  const fim = ['entregue', 'cancelado'].includes(p.status);
  $('#pedAcoes').innerHTML = `
    ${fim ? '' : `<md-text-button id="cancelar">${p.status === 'novo' ? 'Recusar' : 'Cancelar'}</md-text-button>`}
    ${prox ? `<md-filled-button id="avancar">${rotulo}</md-filled-button>` : ''}`;
  $('#avancar')?.addEventListener('click', () => mudar(p, prox));
  $('#cancelar')?.addEventListener('click', () => pedirMotivo(p));
  $('#pedidoDialog').show();
}

function pedirMotivo(p) {
  $('#pedAcoes').innerHTML = `<div class="motivos">${MOTIVOS.map(m => `<md-filter-chip label="${m}" data-m="${m}"></md-filter-chip>`).join('')}</div>
    <md-text-button id="voltar">Voltar</md-text-button>`;
  $('#pedAcoes .motivos').addEventListener('click', e => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (m) mudar(p, 'cancelado', m);
  });
  $('#voltar').onclick = () => abrirPedido(p.id);
}

// aceitar conta o cliente; cancelar um pedido já aceito desconta. Os dois numa transação junto com o status.
async function mudar(p, status, motivo = null) {
  const texto = avisoCliente(status, p, motivo);
  if (texto) window.open(whats(p.cliente.fone, texto), '_blank', 'noopener'); // antes de qualquer await, senão o navegador bloqueia
  const ref = doc(pedidosRef, p.id);
  const mudanca = { status, [CAMPO[status]]: serverTimestamp(), ...(motivo ? { motivo } : {}) };
  const conta = status === 'preparo' ? 1 : status === 'cancelado' && VALIDOS.includes(p.status) ? -1 : 0;
  $('#pedidoDialog').close();
  toast(`#${p.cod}: ${ETAPAS[status]}`);
  try {
    if (!conta) return await updateDoc(ref, mudanca);
    await runTransaction(db, async t => {
      const cRef = doc(lojaRef, 'clientes', soDigitos(p.cliente.fone));
      const cli = await t.get(cRef);
      t.update(ref, mudanca);
      t.set(cRef, {
        nome: p.cliente.nome, pedidos: increment(conta), gasto: increment(conta * p.subtotal),
        ...(conta > 0 ? { ultimo: p.criadoEm } : {}), ...(cli.exists() ? {} : { primeiro: p.criadoEm }),
      }, { merge: true });
    });
  } catch (e) { console.error(e); toast(`#${p.cod} não salvou, tenta de novo`, true); }
}

// link "Abrir no painel" do WhatsApp: /painel/#<id>
async function abrirDoLink() {
  const id = location.hash.slice(1);
  if (!id) return;
  if (!loja) return setTimeout(abrirDoLink, 200); // pedidos podem chegar antes da loja (o detalhe usa loja.cidade)
  history.replaceState(null, '', location.pathname);
  if (!pedidos.some(p => p.id === id)) {
    const d = await getDoc(doc(pedidosRef, id)).catch(() => null);
    if (!d?.exists()) return toast('Pedido não encontrado', true);
    pedidos.push(lerPedido(d));
  }
  abrirPedido(id);
}
addEventListener('hashchange', () => { if (iniciado) abrirDoLink(); });

// ---------- som e tela acesa ----------
// o navegador só libera áudio depois de um toque; o mesmo toque pede pra tela não apagar
let audio = null;
const manterAcesa = () => navigator.wakeLock?.request('screen').catch(() => {});
$('#som').onclick = () => {
  audio = new AudioContext();
  bip();
  manterAcesa();
  $('#som').hidden = true;
  toast('Som ativado 🔔');
};
document.addEventListener('visibilitychange', () => { if (audio && document.visibilityState === 'visible') manterAcesa(); });
function bip() {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.frequency.value = 880;
  o.connect(g).connect(audio.destination);
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.start(t);
  o.stop(t + 0.6);
}
function alertar() {
  bip();
  setTimeout(bip, 700);
  navigator.vibrate?.([200, 100, 200]);
  toast('Pedido novo! 🍔');
}

// ---------- botões do dia a dia: gravam a data de hoje, então resetam sozinhos amanhã ----------
function renderLoja() {
  const d = hoje(), esg = loja.esgotados || {};
  $('#controles').innerHTML = `
    <label class="controle"><span><strong>Fechar hoje</strong><small>Ninguém consegue pedir até amanhã</small></span>
      <md-switch data-campo="fechadaHoje" ${loja.fechadaHoje === d ? 'selected' : ''}></md-switch></label>
    <label class="controle"><span><strong>Abrir hoje fora do horário</strong><small>Normal: ${esc(loja.horario.texto)}</small></span>
      <md-switch data-campo="abertaHoje" ${loja.abertaHoje === d ? 'selected' : ''}></md-switch></label>
    <h3>Esgotou hoje</h3>
    ${loja.cardapio.map(i => `<label class="controle"><span>${esc(i.nome)}</span>
      <md-switch data-esgotado="${esc(i.id)}" ${esg[i.id] === d ? 'selected' : ''}></md-switch></label>`).join('')}`;
}
$('#controles').addEventListener('change', e => {
  const s = e.target, valor = s.selected ? hoje() : null;
  const mudanca = s.dataset.campo ? { [s.dataset.campo]: valor } : { [`esgotados.${s.dataset.esgotado}`]: valor };
  updateDoc(lojaRef, mudanca).catch(() => toast('Não salvou, tenta de novo', true));
});

// ---------- números ----------
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ANTERIOR = { hoje: 'o mesmo dia da semana passada', semana: 'a semana passada', mes: 'o mês passado' };
let periodoAtual = 'hoje', doPeriodo = [];

$('#periodos').addEventListener('click', e => {
  const c = e.target.closest('[data-p]');
  if (!c) return;
  document.querySelectorAll('#periodos [data-p]').forEach(x => { x.selected = x === c; });
  periodoAtual = c.dataset.p;
  carregarNumeros();
});

// ponytail: lê o período atual + anterior e a coleção de clientes inteira a cada abertura; com milhares de clientes, agregar no aceite
async function carregarNumeros() {
  const per = periodo(periodoAtual);
  $('#numeros').innerHTML = '<p class="vazio">Carregando…</p>';
  try {
    const [ps, cs] = await Promise.all([
      getDocs(query(pedidosRef, where('criadoEm', '>=', Timestamp.fromDate(per.iniAnt)))),
      getDocs(collection(lojaRef, 'clientes')),
    ]);
    const lista = ps.docs.map(lerPedido);
    const clientes = Object.fromEntries(cs.docs.map(d => [d.id, { ...d.data(), primeiro: data(d.data().primeiro) }]));
    doPeriodo = lista.filter(p => p.criadoEm >= per.ini).sort((a, b) => a.criadoEm - b.criadoEm);
    renderNumeros(calcular(lista, per, clientes), calcular(lista, { ini: per.iniAnt, fim: per.fimAnt }, clientes));
  } catch (e) {
    console.error(e);
    $('#numeros').innerHTML = '<p class="vazio">Não deu pra carregar. Confere a internet e toca no período de novo.</p>';
  }
}

function seta(atual, anterior) {
  const v = variacao(atual, anterior);
  return v === null ? '' : `<small class="${v >= 0 ? 'sobe' : 'desce'}">${v >= 0 ? '↑' : '↓'} ${Math.abs(v)}%</small>`;
}
function barras(lista, fmt = String) {
  const max = Math.max(1, ...lista.map(([, v]) => v));
  return lista.map(([k, v]) => `<div class="barra"><span>${esc(k)}</span><i style="--w:${v / max * 100}%"></i><b>${fmt(v)}</b></div>`).join('')
    || '<p class="vazio">Sem dados ainda</p>';
}
function renderNumeros(a, b) {
  const h = loja.horario, pico = Object.fromEntries(a.pico), faixas = [];
  for (let m = h.abre * 60; m < h.fecha * 60; m += 30) faixas.push(`${String(m / 60 | 0).padStart(2, '0')}:${m % 60 ? '30' : '00'}`);
  $('#numeros').innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>Faturamento (burgers)</small><strong>${brl(a.faturamento)}</strong>${seta(a.faturamento, b.faturamento)}</div>
      <div class="kpi"><small>Pedidos</small><strong>${a.pedidos}</strong>${seta(a.pedidos, b.pedidos)}</div>
      <div class="kpi"><small>Ticket médio</small><strong>${brl(a.ticket)}</strong>${seta(a.ticket, b.ticket)}</div>
      <div class="kpi"><small>Entregas (repasse do motoboy)</small><strong>${brl(a.taxas)}</strong></div>
    </div>
    <p class="nota">Setas comparam com ${ANTERIOR[periodoAtual]}, até o mesmo horário.${a.cancelados ? ` ${a.cancelados} cancelado(s) fora da conta.` : ''}</p>
    <h3>Mais vendidos</h3>${barras(a.maisVendidos)}
    <h3>Formas de pagamento</h3>${barras(a.pagamentos, brl)}
    <h3>Horário de pico</h3>${barras(faixas.map(f => [f, pico[f] || 0]))}
    <h3>Dia da semana mais forte</h3>${barras(a.diasSemana.map(([d, v]) => [DIAS[d], v]), brl)}
    <h3>Bairros que mais pedem</h3>${barras(a.bairros.slice(0, 8))}
    <h3>Clientes</h3>
    <p>${a.clientesNovos} novo(s) · ${a.clientesVoltaram} voltaram</p>
    ${barras(a.topClientes)}`;
}

$('#planilha').onclick = () => {
  if (!doPeriodo.length) return toast('Nenhum pedido no período', true);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv(doPeriodo)], { type: 'text/csv;charset=utf-8' }));
  a.download = `pedidos-${periodoAtual}-${hoje()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
