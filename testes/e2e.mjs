// Fluxo completo contra os emuladores. Rodar: npm run e2e (sobe emuladores, semeia e roda isto)
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-lacarne' }); // FIRESTORE_EMULATOR_HOST vem do emulators:exec
const db = getFirestore();
const BASE = 'http://127.0.0.1:5000/';
const espera = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const erros = [];
const pagina = async url => {
  const p = await b.newPage();
  p.on('pageerror', e => erros.push(e.message));
  await p.setViewport({ width: 390, height: 800 });
  await p.goto(url);
  return p;
};

try {
  // 1. cliente faz pedido (Bruto, Matriz, Pix)
  const site = await pagina(BASE + '?teste');
  await site.waitForSelector('[data-id="bruto"]');
  await site.evaluate(() => localStorage.setItem('carrinho', JSON.stringify([
    { id: 'bruto', qtd: 1, escolhas: [['Ponto da carne', 'Ao ponto']], sem: [], obs: '' }])));
  await site.reload();
  await site.waitForSelector('[data-id="bruto"]');
  const msg = await site.evaluate(async () => {
    window.open = u => { window.__url = u; };
    const q = s => document.querySelector(s), set = (id, v) => { q('#' + id).value = v; };
    q('#cartBtn').click();
    await new Promise(r => setTimeout(r, 500));
    set('nome', 'Ana'); set('fone', '(81) 9 9999-9999'); set('rua', 'Rua A'); set('numero', '1'); set('bairro', 'Matriz');
    q('md-radio[name=tipo][value=Entrega]').checked = true;
    q('md-radio[name=pag][value=Pix]').checked = true;
    q('#cartDialog').dispatchEvent(new Event('change'));
    q('#enviar').click();
    return decodeURIComponent(window.__url.split('text=')[1]);
  });
  assert.match(msg, /VALOR FINAL: R\$\s37,00/);
  const id = msg.match(/painel\/#(\w+)/)[1];
  await espera(1500);
  const salvo = (await db.doc(`lojas/lacarne/pedidos/${id}`).get()).data();
  assert.equal(salvo.status, 'novo');
  assert.equal(salvo.subtotal, 32);
  assert.equal(salvo.taxa, 5);
  assert.deepEqual(salvo.itens[0].escolhas, { 'Ponto da carne': 'Ao ponto' });

  // 2. loja abre pelo link do WhatsApp, entra e aceita
  const painel = await pagina(BASE + 'painel/#' + id);
  await painel.waitForFunction(() => window.__entrar);
  await painel.evaluate(() => window.__entrar('dono@teste.com'));
  await painel.waitForSelector('#avancar');
  const aviso = await painel.evaluate(async () => {
    window.open = u => { window.__url = u; };
    document.querySelector('#avancar').click();
    await new Promise(r => setTimeout(r, 1500));
    return decodeURIComponent(window.__url);
  });
  assert.match(aviso, /aceito/);
  assert.equal((await db.doc(`lojas/lacarne/pedidos/${id}`).get()).data().status, 'preparo');
  assert.equal((await db.doc('lojas/lacarne/clientes/81999999999').get()).data().pedidos, 1);

  // 3. esgotado no painel apaga o card no site, ao vivo
  await painel.evaluate(() => document.querySelector('[data-aba="loja"]').click());
  await painel.waitForSelector('[data-esgotado="bruto"]');
  // clique sintético no host do md-switch não alterna: usar o input do shadowRoot
  await painel.evaluate(() => document.querySelector('[data-esgotado="bruto"]').shadowRoot.querySelector('input').click());
  await site.waitForSelector('.card.esgotado', { timeout: 5000 });

  // 4. números contam o pedido aceito, sem a taxa
  await painel.evaluate(() => document.querySelector('[data-aba="numeros"]').click());
  await painel.waitForFunction(() => document.querySelector('.kpi strong')?.textContent.includes('32,00'), { timeout: 5000 });
  assert.deepEqual(erros, []);
  console.log('e2e ok');
} finally {
  await b.close();
}
