// Fluxo completo contra os emuladores. Rodar: npm run e2e (sobe emuladores, semeia e roda isto)
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-lacarne' }); // FIRESTORE_EMULATOR_HOST vem do emulators:exec
const db = getFirestore();
const BASE = 'http://127.0.0.1:5000/';
const espera = ms => new Promise(r => setTimeout(r, ms));
// no CI (Ubuntu 24.04) o sandbox do Chrome é bloqueado pelo AppArmor
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: process.env.CI ? ['--no-sandbox'] : [] });
const erros = [];
const pagina = async (url, ctx = b) => {
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(e.message));
  await p.setViewport({ width: 390, height: 800 });
  await p.goto(url);
  return p;
};

try {
  // 1. cliente faz pedido (Bruto, Matriz, Pix)
  const site = await pagina(BASE + '?teste');
  await site.waitForFunction(() => document.querySelector("#status").textContent && customElements.get("md-dialog")); // ao vivo + Material: o que o cliente espera pra conseguir pedir
  await site.evaluate(() => localStorage.setItem('carrinho', JSON.stringify([
    { id: 'bruto', qtd: 1, escolhas: [['Ponto da carne', 'Ao ponto']], sem: [], obs: '' }])));
  await site.reload();
  await site.waitForFunction(() => document.querySelector("#status").textContent && customElements.get("md-dialog")); // ao vivo + Material: o que o cliente espera pra conseguir pedir
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

  // 5. entregue cria o convite e manda o link; cliente avalia uma vez; loja libera; comentário aparece no burger aberto
  await db.doc('lojas/lacarne').update({ 'esgotados.bruto': null });
  // site em segundo plano não roda requestAnimationFrame: esperar por intervalo
  await site.waitForFunction(() => !document.querySelector('.card.esgotado'), { timeout: 5000, polling: 200 });
  await painel.evaluate(() => document.querySelector('[data-aba="pedidos"]').click());
  let link = '';
  for (const etapa of ['saiu', 'entregue']) {
    await painel.evaluate(i => { location.hash = i; }, id);
    await painel.waitForSelector('#pedidoDialog[open] #avancar');
    link = await painel.evaluate(async () => {
      window.__url = '';
      document.querySelector('#avancar').click();
      await new Promise(r => setTimeout(r, 1500));
      return decodeURIComponent(window.__url);
    });
    assert.equal((await db.doc(`lojas/lacarne/pedidos/${id}`).get()).data().status, etapa);
  }
  assert.ok(link.includes(`avaliar/#${id}`), link);
  assert.equal((await db.doc(`lojas/lacarne/convites/${id}`).get()).data().nome, 'Ana');

  // cliente em outro contexto (outro aparelho): o emulador fala HTTP/1.1 e o Chrome só abre 6 conexões por host;
  // site + painel + avaliar na mesma janela esgotam isso e a escrita fica na fila pra sempre
  const av = await pagina(`${BASE}avaliar/#${id}`, await b.createBrowserContext());
  await av.waitForSelector('[data-b="bruto"] [data-n="5"]');
  await av.click('[data-b="bruto"] [data-n="5"]');
  await av.click('[data-t="Saboroso"]');
  await av.evaluate(() => { document.querySelector('#avComent').value = 'Bruto absurdo'; document.querySelector('#avEnviar').click(); });
  await av.waitForFunction(() => document.body.innerText.includes('Valeu pela avaliação'), { timeout: 5000 });
  await av.reload();
  await av.waitForFunction(() => document.body.innerText.includes('já avaliou'), { timeout: 5000 });

  await painel.evaluate(() => document.querySelector('[data-aba="avaliacoes"]').click());
  await painel.waitForSelector(`[data-pub="${id}"]`);
  await painel.evaluate(i => document.querySelector(`[data-pub="${i}"]`).shadowRoot.querySelector('input').click(), id);
  await espera(1500);
  assert.equal((await db.doc(`lojas/lacarne/depoimentos/${id}`).get()).data().comentario, 'Bruto absurdo');
  assert.equal((await db.doc(`lojas/lacarne/avaliacoes/${id}`).get()).data().vista, true);

  await site.bringToFront();
  await site.reload();
  await site.waitForFunction(() => document.querySelector('#status').textContent && customElements.get('md-dialog'));
  await site.evaluate(() => document.querySelector('[data-card="bruto"] h3').click());
  await site.waitForFunction(() => document.querySelector('.opinioes')?.innerText.includes('Bruto absurdo'), { timeout: 8000 });
  assert.deepEqual(erros, []);
  console.log('e2e ok');
} finally {
  await b.close();
}
