import '../vendor/material.js';
import { app, db, LOJA_ID, LOCAL } from '../firebase.js';
import {
  doc, collection, query, where, orderBy, onSnapshot, getDoc, getDocs, setDoc, updateDoc, runTransaction, serverTimestamp, increment, Timestamp,
  writeBatch,
} from '../vendor/firebase/base.js';
import qrcode from '../vendor/qrcode.js';
import { comanda } from '../comanda.js';
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut, onAuthStateChanged,
} from '../vendor/firebase/auth.js';
import { conferir, whats, avisoCliente, MOTIVOS, soDigitos, mapa, agrupar } from '../pedido.js';
import { periodo, calcular, variacao, csv, VALIDOS } from '../numeros.js';
import { hoje } from '../horario.js';
import { burgersDoPedido, resumo, quando, TAGS_BOAS } from '../avaliacao.js';
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
// pedidos: hoje, ao vivo (apita). Outro dia escolhido: pedidosDia, também ao vivo, sem apito
let diaVivo = hoje(), dia = diaVivo, pedidosDia = [], pararDia = null;

// ---------- login ----------
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' }); // permite trocar de conta se entrou com a errada
$('#entrar').onclick = () => signInWithPopup(auth, google).catch(e => toast(`Não deu pra entrar (${e.code})`, true));
$('#sair').onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  pararPedidos?.();
  pararDia?.();
  pararPedidos = pararDia = null;
  const acesso = user ? await getDoc(doc(lojaRef, 'admins', user.email)).then(d => d.exists(), () => false) : false;
  $('#login').hidden = acesso;
  $('#app').hidden = $('#abas').hidden = !acesso;
  $('#sair').hidden = !user;
  $('#verSite').hidden = !acesso;
  // marca o navegador pro atalho "Painel" aparecer no site (só conveniência: quem não é admin não lê nada do painel)
  try { acesso ? localStorage.setItem('admin', 'true') : localStorage.removeItem('admin'); } catch {}
  $('#loginMsg').textContent = user && !acesso ? `${user.email} não tem acesso a este painel.` : 'Entre com a conta Google da loja.';
  if (acesso) iniciar();
});

// ---------- abas e conexão ----------
$('#abas').addEventListener('click', e => {
  const b = e.target.closest('[data-aba]');
  if (!b) return;
  document.querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x === b));
  ['pedidos', 'numeros', 'avaliacoes', 'loja'].forEach(a => { $(`#aba-${a}`).hidden = a !== b.dataset.aba; });
  if (b.dataset.aba === 'numeros') carregarNumeros();
  if (b.dataset.aba === 'avaliacoes') carregarAv();
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
    vigiarNovasAv();
  }
  diaVivo = hoje();
  verDia(dia > diaVivo ? diaVivo : dia);
  const inicioDoDia = new Date(`${diaVivo}T00:00:00-03:00`);
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
const COLUNAS = [['novo', 'Novos', ['novo']], ['preparo', 'Em preparo', ['preparo']], ['saiu', 'Saiu / pronto', ['saiu']],
  ['fim', 'Finalizados', ['entregue', 'cancelado']]];
let filtro = 'novo', chamando = false; // chamando: chegou pedido novo e a pessoa está em outra etapa
// grupos da lista misturam entrega e retirada; o título, o botão e o aviso de cada pedido usam etapa()
const ETAPAS = { novo: 'Novo', preparo: 'Em preparo', saiu: 'Saiu / pronto', entregue: 'Entregue / retirado', cancelado: 'Cancelado' };
const etapa = (st, p) => (p.local ? { saiu: 'Pronto', entregue: 'Entregue' }
  : p.entrega ? { saiu: 'Saiu pra entrega', entregue: 'Entregue' }
  : { saiu: 'Pronto pra retirar', entregue: 'Retirado' })[st] ?? ETAPAS[st];
const tipo = p => p.entrega ? esc(p.cliente.bairro) : p.local ? 'No local' : 'Retirada';
const CAMPO = { preparo: 'aceitoEm', saiu: 'saiuEm', entregue: 'entregueEm', cancelado: 'canceladoEm' };
const PROXIMA = { novo: 'preparo', preparo: 'saiu', saiu: 'entregue' };
const hora = d => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' }) : '';
const total = p => p.subtotal + (p.taxa ?? 0);
let atualId = null;

const ehHoje = () => dia === diaVivo;
const naTela = () => ehHoje() ? pedidos : pedidosDia;

function renderPedidos() {
  if (!loja) return;
  const n = pedidos.filter(p => p.status === 'novo').length;
  $('#novos').hidden = !n;
  $('#novos').textContent = n;
  $('#diaHoje').classList.toggle('chamando', chamando && !ehHoje());
  // uma etapa por vez, escolhida nas pílulas (celular e computador)
  const lista = naTela(), grupos = COLUNAS.map(([st, nome, sts]) => [st, nome, lista.filter(p => sts.includes(p.status))]);
  $('#filtroPedidos').innerHTML = grupos.map(([st, nome, l]) =>
    `<button type="button" role="tab" data-filtro="${st}" class="${st}${st === filtro ? ' on' : ''}${st === 'novo' && chamando && filtro !== 'novo' && ehHoje() ? ' chamando' : ''}">${nome} <b>${l.length}</b></button>`).join('');
  $('#listaPedidos').innerHTML = lista.length ? grupos.map(([st, nome, l]) => `
    <section class="grupo ${st}${st === filtro ? ' ativa' : ''}">
      <h3>${nome} · ${l.length}</h3>
      ${l.map(p => `<button class="pedido" data-id="${esc(p.id)}">
        <span><strong>#${esc(p.cod)} · ${esc(p.cliente.nome)}</strong>
          <small>${hora(p.criadoEm)} · ${tipo(p)} · ${esc(p.pag)}${st === 'fim' ? ` · ${etapa(p.status, p)}` : ''}</small></span>
        <span class="valor">${brl(total(p))}${p.taxa === null ? ' + entrega' : ''}${conferir(p, loja).ok ? '' : ' ⚠'}</span>
      </button>`).join('') || '<p class="vazio">Nenhum</p>'}
    </section>`).join('') : `<p class="vazio">${ehHoje() ? 'Nenhum pedido hoje ainda.' : 'Nenhum pedido neste dia.'}</p>`;
  if (atualId && $('#pedidoDialog').open) abrirPedido(atualId); // detalhe aberto acompanha a mudança
}
$('#filtroPedidos').addEventListener('click', e => {
  const b = e.target.closest('[data-filtro]');
  if (b) { filtro = b.dataset.filtro; if (filtro === 'novo') chamando = false; renderPedidos(); }
});
$('#listaPedidos').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) abrirPedido(b.dataset.id);
});
$('#pedidoDialog').addEventListener('closed', () => { atualId = null; });

// ---------- outros dias: setas, calendário e "Hoje" ----------
const somaDias = (d, n) => hoje(new Date(new Date(`${d}T12:00:00-03:00`).getTime() + n * 864e5));
function verDia(d) {
  dia = d > diaVivo ? diaVivo : d;
  pararDia?.();
  pararDia = null;
  pedidosDia = [];
  $('#diaData').value = dia;
  $('#diaData').max = diaVivo;
  $('#diaDepois').disabled = ehHoje();
  $('#diaHoje').classList.toggle('on', ehHoje());
  if (ehHoje()) { filtro = 'novo'; chamando = false; return renderPedidos(); }
  const ini = new Date(`${dia}T00:00:00-03:00`);
  let primeira = true;
  $('#listaPedidos').innerHTML = '<p class="vazio">Carregando…</p>';
  pararDia = onSnapshot(query(pedidosRef, where('criadoEm', '>=', Timestamp.fromDate(ini)),
    where('criadoEm', '<', Timestamp.fromDate(new Date(ini.getTime() + 864e5))), orderBy('criadoEm', 'desc')), s => {
    pedidosDia = s.docs.map(lerPedido);
    // abre na primeira etapa com pedido: o que ficou parado aparece antes dos finalizados
    if (primeira) { primeira = false; filtro = COLUNAS.find(([, , sts]) => pedidosDia.some(p => sts.includes(p.status)))?.[0] ?? 'fim'; }
    renderPedidos();
  }, e => { console.error(e); $('#listaPedidos').innerHTML = '<p class="vazio">Não deu pra carregar esse dia. Confere a internet.</p>'; });
}
$('#diaAntes').onclick = () => verDia(somaDias(dia, -1));
$('#diaDepois').onclick = () => verDia(somaDias(dia, 1));
$('#diaHoje').onclick = () => verDia(diaVivo);
$('#diaData').addEventListener('change', e => { if (e.target.value) verDia(e.target.value); });

function abrirPedido(id) {
  const p = pedidos.find(x => x.id === id) ?? pedidosDia.find(x => x.id === id);
  if (!p) return toast('Pedido não encontrado', true);
  atualId = id;
  const c = conferir(p, loja), cl = p.cliente;
  const noMapa = mapa(`${cl.rua}, ${cl.numero}, ${cl.bairro}`, loja.cidade);
  $('#pedTitulo').textContent = `#${p.cod} · ${etapa(p.status, p)}`;
  $('#pedCorpo').innerHTML = `
    ${c.ok ? '' : `<p class="alerta">⚠ Valor não confere com o cardápio: deveria ser ${brl(c.subtotal)}${p.entrega
      ? ` + ${c.taxa === null ? 'entrega a confirmar' : `${brl(c.taxa)} de entrega`}` : ''}.</p>`}
    <p><strong>${esc(cl.nome)}</strong>${cl.fone ? ` · <a href="${whats(cl.fone, '')}" target="_blank" rel="noopener">${esc(cl.fone)}</a>` : ''}
      <br><small>feito às ${hora(p.criadoEm)}</small></p>
    <p>${p.entrega ? `🛵 ${esc(cl.rua)}, ${esc(cl.numero)} · ${esc(cl.bairro)}${cl.compl ? ` · ${esc(cl.compl)}` : ''}
      ${cl.ref ? `<br><small>${esc(cl.ref)}</small>` : ''}<br><a href="${noMapa}" target="_blank" rel="noopener">Abrir no mapa</a>${cl.loc
        ? ` · <a href="${mapa(cl.loc)}" target="_blank" rel="noopener">📍 Localização exata (GPS)</a>` : ''}`
      : p.local ? '🍽️ Consumo no local' : '🏃 Retirada no local'}</p>
    <ul class="itens">${p.itens.map(i => `<li><strong>${esc(i.qtd)}x ${esc(i.nome)}</strong>
      ${Object.entries(i.escolhas || {}).map(([t, v]) => `<br><small>${esc(t)}: ${esc(v)}</small>`).join('')}
      ${i.sem?.length ? `<br><small>Sem: ${esc(i.sem.join(', '))}</small>` : ''}
      ${i.extras?.length ? `<br><small>+ ${esc(agrupar(i.extras, loja.adicionais).join(', '))}</small>` : ''}
      ${i.obs ? `<br><small>Obs: ${esc(i.obs)}</small>` : ''}</li>`).join('')}</ul>
    <p>${p.entrega ? `Subtotal ${brl(p.subtotal)} · Entrega ${p.taxa === null ? 'a confirmar' : brl(p.taxa)}<br>` : ''}<strong>Total ${brl(total(p))}${p.taxa === null ? ' + entrega' : ''}</strong> · ${esc(p.pag)}${p.pag === 'Dinheiro' && p.troco ? ` · troco p/ ${brl(p.troco)}` : ''}</p>
    ${p.obs ? `<p>📝 ${esc(p.obs)}</p>` : ''}
    ${p.status === 'cancelado' ? `<p>Motivo: ${esc(p.motivo)}</p>` : ''}`;
  const prox = PROXIMA[p.status];
  const rotulo = prox === 'preparo' ? 'Aceitar' : etapa(prox, p);
  const fim = ['entregue', 'cancelado'].includes(p.status);
  $('#pedAcoes').innerHTML = `
    ${p.status === 'cancelado' ? '' : '<md-text-button id="imprimir"><md-icon slot="icon">print</md-icon>Imprimir</md-text-button>'}
    ${fim ? '' : `<md-text-button id="cancelar">${p.status === 'novo' ? 'Recusar' : 'Cancelar'}</md-text-button>`}
    ${prox ? `<md-filled-button id="avancar">${rotulo}</md-filled-button>` : ''}`;
  $('#imprimir')?.addEventListener('click', () => imprimir(p));
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
// entregue com burger: cria o convite de avaliação junto com o status e manda o link na mensagem.
// Sem telefone (lançado no balcão): sem mensagem, sem convite e sem ficha de cliente.
// Pedido de outro dia: sem mensagem nem convite ("pedido pronto" no dia seguinte só confunde); a ficha conta igual
// Convite que já existe (comanda impressa antes): só manda o link, sem recriar (a regra nega e derrubaria o status junto)
const nomeConvite = p => soDigitos(p.cliente.fone) ? p.cliente.nome.trim().split(/\s+/)[0] : p.cliente.nome.trim(); // balcão: "Mesa 4" inteiro
async function mudar(p, status, motivo = null) {
  const fone = soDigitos(p.cliente.fone), doDia = hoje(p.criadoEm ?? new Date()) === hoje();
  const burgers = status === 'entregue' && fone && doDia ? burgersDoPedido(p.itens, loja.cardapio) : [];
  const avaliar = burgers.length ? `${new URL('../avaliar/', location.href).href}#${p.id}` : '';
  const texto = avisoCliente(status, p, motivo, loja, avaliar);
  if (texto && fone && doDia) window.open(whats(p.cliente.fone, texto), '_blank', 'noopener'); // antes de qualquer await, senão o navegador bloqueia
  const ref = doc(pedidosRef, p.id);
  const mudanca = { status, [CAMPO[status]]: serverTimestamp(), ...(motivo ? { motivo } : {}) };
  const conta = !fone ? 0 : status === 'preparo' ? 1 : status === 'cancelado' && VALIDOS.includes(p.status) ? -1 : 0;
  $('#pedidoDialog').close();
  toast(`#${p.cod}: ${etapa(status, p)}`);
  try {
    if (!conta && !avaliar) return await updateDoc(ref, mudanca);
    if (!conta) {
      const convRef = doc(lojaRef, 'convites', p.id);
      if (await getDoc(convRef).then(d => d.exists(), () => false)) return await updateDoc(ref, mudanca);
      const b = writeBatch(db);
      b.update(ref, mudanca);
      b.set(convRef, { nome: nomeConvite(p), ids: burgers.map(x => x.id), burgers, entregueEm: serverTimestamp() });
      return await b.commit();
    }
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

// comanda: o QR leva pra avaliação (?qr = rastreio "pelo QR"). O convite nasce aqui, porque o papel vai junto com o
// lanche: quem tem a comanda na mão já recebeu, e avalia sem depender de a loja marcar Entregue
async function imprimir(p) {
  const burgers = burgersDoPedido(p.itens, loja.cardapio);
  let qr = '';
  if (burgers.length) {
    // já existe (impressa de novo, ou já entregue com telefone): a regra nega sobrescrever e o QR continua valendo
    setDoc(doc(lojaRef, 'convites', p.id), { nome: nomeConvite(p), ids: burgers.map(x => x.id), burgers, entregueEm: serverTimestamp() })
      .catch(() => {});
    const q = qrcode(0, 'M');
    q.addData(`${new URL('../avaliar/', location.href).href}?qr#${p.id}`);
    q.make();
    qr = q.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
  }
  const c = $('#comanda');
  c.innerHTML = comanda(p, loja, qr);
  await c.querySelector('img').decode().catch(() => {}); // logo carregado antes de medir e imprimir
  // página = tamanho da comanda (mede fora da tela; 96 px = 1 polegada), senão o PDF sai em A4
  c.classList.add('medindo');
  const mm = Math.ceil(c.offsetHeight * 25.4 / 96) + 2;
  c.classList.remove('medindo');
  ($('#pagina') ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pagina' })))
    .textContent = `@page { size: 80mm ${mm}mm; margin: 0; }`;
  print();
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

// ---------- balcão: o site em modo balcão abre por cima; o painel segue vivo (som e pedidos chegando) ----------
const balcao = $('#balcao'), quadro = balcao.querySelector('iframe');
$('#lancar').onclick = () => {
  if (!quadro.getAttribute('src')) quadro.src = '../?balcao'; // carrega na primeira vez e fica pronto pros próximos
  balcao.hidden = false;
};
$('#fecharBalcao').onclick = () => { balcao.hidden = true; }; // fechar no meio guarda a sacola pra quando voltar
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data?.lancado) return;
  balcao.hidden = true;
  quadro.contentWindow.location.reload(); // zera o formulário pro próximo, em segundo plano
  filtro = 'preparo';
  renderPedidos();
  location.hash = e.data.lancado;
  toast('Pedido lançado ✅');
});

// ---------- som e tela acesa ----------
// o navegador só libera áudio depois de um toque, e isso zera a cada abertura da página (regra do Chrome/Safari).
// Quem já ativou uma vez não vê mais o botão: o primeiro toque em qualquer lugar religa, sem bip.
let audio = null;
const manterAcesa = () => navigator.wakeLock?.request('screen').catch(() => {});
const lembrarSom = () => { try { return localStorage.getItem('som') === '1'; } catch { return false; } };
function ligarSom() {
  audio ??= new AudioContext();
  audio.resume?.();
  manterAcesa();
  $('#som').hidden = $('#somAviso').hidden = true;
  try { localStorage.setItem('som', '1'); } catch {}
}
$('#som').onclick = () => { ligarSom(); bip(); toast('Som ativado 🔔'); };
if (lembrarSom()) {
  $('#som').hidden = true;
  audio = new AudioContext(); // nasce suspenso; alguns navegadores já liberam pra site muito usado
  if (audio.state !== 'running') {
    $('#somAviso').hidden = false;
    const religar = () => { ligarSom(); ['pointerdown', 'keydown'].forEach(t => removeEventListener(t, religar, true)); };
    ['pointerdown', 'keydown'].forEach(t => addEventListener(t, religar, true));
  }
}
// pedido chegou sem som liberado (ou com a aba em segundo plano): avisa no título da aba até alguém olhar
const titulo = document.title;
const tirarAvisoDoTitulo = () => { if (document.visibilityState === 'visible') document.title = titulo; };
addEventListener('pointerdown', tirarAvisoDoTitulo);
document.addEventListener('visibilitychange', () => {
  if (audio && document.visibilityState === 'visible') manterAcesa();
  if (audio?.state === 'running') tirarAvisoDoTitulo();
});
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
  if (filtro !== 'novo' || !ehHoje()) { chamando = true; renderPedidos(); }
  if (audio?.state !== 'running' || document.hidden) document.title = `🔔 Pedido novo! · ${titulo}`;
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
// computador: todas as seções abertas; celular: só a primeira (as outras abrem com um toque)
const aberto = titulo => matchMedia('(min-width: 1000px)').matches || titulo === 'Burgers mais vendidos' ? 'open' : '';
const ehBebida = nome => loja.cardapio.some(i => i.nome === nome && i.tipo === 'bebida');
// listas longas (clientes, bairros): 5 na tela + "Ver todos" numa janela com busca e rolagem só lá dentro
let listas = {};
const TITULOS = { bairros: 'Todos os bairros', clientes: 'Todos os clientes' };
const verTodos = (qual, l) => l.length > 5 ? `<md-text-button class="ver-todos" data-lista="${qual}">Ver todos (${l.length})</md-text-button>` : '';
const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function filtrarLista() {
  const q = semAcento($('#listaBusca').value.trim()), soDig = q.replace(/\D/g, '');
  const l = (listas[$('#listaDialog').dataset.qual] || [])
    .filter(([k]) => !q || semAcento(k).includes(q) || (soDig && k.replace(/\D/g, '').includes(soDig)));
  const qual = $('#listaDialog').dataset.qual;
  $('#listaItens').innerHTML = l.length ? l.map(([k, v]) => {
    const [nome, fone] = k.split(' · ');
    return `<div class="linha-lista"><span>${esc(nome)}${fone ? `<small>${esc(fone)}</small>` : ''}</span>
      <b>${v} ${v > 1 ? 'pedidos' : 'pedido'}</b></div>`;
  }).join('') : '<p class="vazio">Nada encontrado</p>';
}
$('#numeros').addEventListener('click', e => {
  const b = e.target.closest('[data-lista]');
  if (!b) return;
  $('#listaDialog').dataset.qual = b.dataset.lista;
  $('#listaTitulo').textContent = TITULOS[b.dataset.lista];
  $('#listaBusca').value = '';
  $('#listaBusca').placeholder = b.dataset.lista === 'clientes' ? 'Buscar por nome ou telefone…' : 'Buscar bairro…';
  filtrarLista();
  $('#listaDialog').show();
});
$('#listaBusca').addEventListener('input', filtrarLista);
function barras(lista, fmt = String, max = Math.max(1, ...lista.map(([, v]) => v))) {
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
    <div class="blocos">
      <details class="bloco" ${aberto('Burgers mais vendidos')}><summary>Burgers mais vendidos</summary>${barras(a.maisVendidos.filter(([n]) => !ehBebida(n)))}</details>
      <details class="bloco" ${aberto('Bebidas mais vendidas')}><summary>Bebidas mais vendidas</summary>${barras(a.maisVendidos.filter(([n]) => ehBebida(n)))}</details>
      <details class="bloco" ${aberto('Bairros que mais pedem')}><summary>Bairros que mais pedem</summary>${barras(a.bairros.slice(0, 5))}${verTodos('bairros', a.bairros)}</details>
      <details class="bloco" ${aberto('Clientes')}><summary>Clientes</summary><p class="nota">${a.clientesNovos} novo(s) · ${a.clientesVoltaram} voltaram</p>
        ${barras(a.topClientes.slice(0, 5))}${verTodos('clientes', a.topClientes)}</details>
      <details class="bloco" ${aberto('Formas de pagamento')}><summary>Formas de pagamento</summary>${barras(a.pagamentos, brl)}</details>
      <details class="bloco" ${aberto('Dia da semana mais forte')}><summary>Dia da semana mais forte</summary>${barras(a.diasSemana.map(([d, v]) => [DIAS[d], v]), brl)}</details>

      <details class="bloco largo" ${aberto('Horário de pico')}><summary>Horário de pico</summary>${barras(faixas.map(f => [f, pico[f] || 0]))}</details>
    </div>`;
  listas = { bairros: a.bairros, clientes: a.topClientes };
}

$('#planilha').onclick = () => {
  if (!doPeriodo.length) return toast('Nenhum pedido no período', true);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv(doPeriodo)], { type: 'text/csv;charset=utf-8' }));
  a.download = `pedidos-${periodoAtual}-${hoje()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- avaliações ----------
// ponytail: lê todas as avaliações do período a cada abertura; com milhares por mês, paginar
const avRef = collection(lojaRef, 'avaliacoes');
let avPeriodo = 'mes', avFiltro = 'novas', avLista = [], convites = [];
const estrelas = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const virgula = n => n.toFixed(1).replace('.', ',');

// contador das não vistas na barra de baixo, ao vivo
function vigiarNovasAv() {
  onSnapshot(query(avRef, where('vista', '==', false)), s => {
    $('#novasAv').hidden = !s.size;
    $('#novasAv').textContent = s.size;
  }, console.error);
}

async function carregarAv() {
  $('#listaAv').innerHTML = '<p class="vazio">Carregando…</p>';
  try {
    const ini = Timestamp.fromDate(periodo(avPeriodo).ini);
    const [s, cs] = await Promise.all([
      getDocs(query(avRef, where('criadoEm', '>=', ini), orderBy('criadoEm', 'desc'))),
      getDocs(query(collection(lojaRef, 'convites'), where('entregueEm', '>=', ini), orderBy('entregueEm', 'desc'))),
    ]);
    avLista = s.docs.map(d => ({ id: d.id, ...d.data(), criadoEm: data(d.data().criadoEm) ?? new Date() }));
    convites = cs.docs.map(d => ({ id: d.id, ...d.data(), entregueEm: data(d.data().entregueEm), abertoEm: data(d.data().abertoEm) }));
  } catch (e) {
    console.error(e);
    $('#listaAv').innerHTML = '<p class="vazio">Não deu pra carregar. Confere a internet e toca no período de novo.</p>';
    return;
  }
  // as novas aparecem destacadas nesta abertura e já ficam marcadas como vistas
  const novas = avLista.filter(a => !a.vista);
  avFiltro = novas.length ? 'novas' : 'todas';
  renderAv();
  if (novas.length) {
    const b = writeBatch(db);
    novas.forEach(a => b.update(doc(avRef, a.id), { vista: true }));
    b.commit().catch(console.error);
  }
}

const nomeDo = id => loja.cardapio.find(c => c.id === id)?.nome ?? id;
function renderAv() {
  const r = resumo(avLista, loja.cardapio), maior = Math.max(1, ...Object.values(r.dist));
  $('#avResumo').innerHTML = !r.total ? '' : `
    <div class="av-resumo">
      <div class="av-media"><strong>${virgula(r.media)}</strong><span class="estr">${estrelas(Math.round(r.media))}</span>
        <small>${r.total} ${r.total > 1 ? 'avaliações' : 'avaliação'}</small></div>
      <div class="av-dist">${[5, 4, 3, 2, 1].map(n => `<div>${n}<i style="--w:${r.dist[n] / maior * 100}%"></i>${r.dist[n]}</div>`).join('')}</div>
    </div>
    <div class="blocos">
      <details class="bloco" open><summary>Nota de cada burger</summary>
        ${barras(r.porBurger.sort((a, b) => b[1] - a[1]).map(([n, m, q]) => [`${n} (${q})`, m]), virgula, 5)}</details>
      <details class="bloco" open><summary>O que mais falam</summary>
        <div class="av-chips">${r.tags.map(([t, n, boa]) => `<span class="${boa ? 'bom' : 'ruim'}">${esc(t)} · ${n}</span>`).join('') || '<p class="vazio">Nenhuma etiqueta marcada</p>'}</div></details>
    </div>`;
  // rastreio: convite criado → link aberto (WhatsApp ou QR) → avaliado. Ninguém abre nada = a loja não está enviando
  // ponytail: "avaliou" olha só as avaliações do período; convite do fim do mês avaliado no mês seguinte aparece como "abriu"
  const avaliou = new Set(avLista.map(a => a.id)), POR = { link: 'pelo WhatsApp', qr: 'pelo QR' };
  const abertos = convites.filter(c => c.abertoEm || avaliou.has(c.id)).length, avaliados = convites.filter(c => avaliou.has(c.id)).length;
  $('#avConvites').innerHTML = !convites.length ? '' : `<details class="bloco"><summary>Convites: ${convites.length} · ${abertos} ${
    abertos === 1 ? 'aberto' : 'abertos'} · ${avaliados} ${avaliados === 1 ? 'avaliado' : 'avaliados'}</summary>
    <p class="nota">Se ninguém abre o link, o mais provável é que a mensagem não está saindo pelo WhatsApp.</p>
    ${convites.map(c => `<div class="linha-lista"><span>${esc(c.nome)}<small>${c.entregueEm ? `${quando(c.entregueEm)} ${hora(c.entregueEm)} · ` : ''}${esc(c.burgers.map(b => b.nome).join(' + '))}</small></span>
      <b>${avaliou.has(c.id) ? 'Avaliou' : c.abertoEm ? `Abriu ${POR[c.abertoPor] ?? ''} ${hora(c.abertoEm)}` : 'Não abriu'}</b></div>`).join('')}</details>`;
  const grupos = { novas: avLista.filter(a => !a.vista), todas: avLista, site: avLista.filter(a => a.publicas?.length) };
  $('#filtroAv').innerHTML = [['novas', 'Novas'], ['todas', 'Todas'], ['site', 'No site']]
    .map(([k, n]) => `<button type="button" data-fav="${k}" class="${k === avFiltro ? 'on' : ''}">${n} <b>${grupos[k].length}</b></button>`).join('');
  // cada burger com a sua nota e o seu comentário; "Mostrar no site" é por comentário
  const burger = (a, bid, n) => {
    const txt = a.comentarios?.[bid];
    return `<div class="av-b"><div class="av-lin"><span>${esc(nomeDo(bid))}</span><span class="estr">${estrelas(n)}</span></div>
      ${txt ? `<p>"${esc(txt)}"</p><label class="av-sw"><md-switch data-pub="${esc(a.id)}" data-b="${esc(bid)}"
        ${a.publicas?.includes(bid) ? 'selected' : ''}></md-switch>Mostrar no site</label>` : ''}</div>`;
  };
  $('#listaAv').innerHTML = grupos[avFiltro].map(a => `<article class="av-card${a.vista ? '' : ' nova'}">
      <div class="av-lin av-topo"><b>${esc(a.nome)}</b><small>${quando(a.criadoEm)} ${hora(a.criadoEm)}</small>
        <md-text-button class="av-ver" data-ver="${esc(a.id)}">Ver pedido</md-text-button></div>
      ${Object.entries(a.notas).map(([bid, n]) => burger(a, bid, n)).join('')}
      ${a.tags?.length ? `<div class="av-chips">${a.tags.map(t => `<span class="${TAGS_BOAS.includes(t) ? 'bom' : 'ruim'}">${esc(t)}</span>`).join('')}</div>` : ''}
    </article>`).join('') || `<p class="vazio">${avLista.length ? 'Nada aqui' : 'Nenhuma avaliação no período'}</p>`;
}

$('#periodosAv').addEventListener('click', e => {
  const c = e.target.closest('[data-p]');
  if (!c) return;
  document.querySelectorAll('#periodosAv [data-p]').forEach(x => { x.selected = x === c; });
  avPeriodo = c.dataset.p;
  carregarAv();
});
$('#filtroAv').addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (b) { avFiltro = b.dataset.fav; renderAv(); }
});
// "Mostrar no site": cria/apaga o depoimento público daquele burger junto com a marca na avaliação
$('#listaAv').addEventListener('change', async e => {
  const sw = e.target.closest('[data-pub]');
  if (!sw) return;
  const a = avLista.find(x => x.id === sw.dataset.pub), bid = sw.dataset.b, liga = sw.selected, b = writeBatch(db);
  const publicas = [...(a.publicas || []).filter(x => x !== bid), ...(liga ? [bid] : [])];
  const dep = doc(lojaRef, 'depoimentos', `${a.id}_${bid}`);
  b.update(doc(avRef, a.id), { publicas });
  if (liga) b.set(dep, { nome: a.nome, burger: bid, nota: a.notas[bid], comentario: a.comentarios[bid], criadoEm: Timestamp.fromDate(a.criadoEm) });
  else b.delete(dep);
  try {
    await b.commit();
    a.publicas = publicas;
    toast(liga ? 'Vai aparecer no site ✅' : 'Saiu do site');
    renderAv();
  } catch (err) { console.error(err); sw.selected = !liga; toast('Não salvou, tenta de novo', true); }
});
$('#listaAv').addEventListener('click', e => {
  const v = e.target.closest('[data-ver]');
  if (!v) return;
  document.querySelector('[data-aba="pedidos"]').click();
  location.hash = v.dataset.ver;
});
