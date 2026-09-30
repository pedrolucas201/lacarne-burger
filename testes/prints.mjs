// Prints das telas do painel pra conferência visual (não é teste). Rodar dentro do emulators:exec, igual ao e2e.
import puppeteer from 'puppeteer-core';
const OUT = process.env.PRINTS || '.';
const BASE = 'http://127.0.0.1:5000/';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const espera = ms => new Promise(r => setTimeout(r, ms));
const site = await b.newPage();
await site.goto(BASE + '?teste');
await site.waitForSelector('[data-id="bruto"]');
// três pedidos: entrega Pix, retirada dinheiro, bairro fora da tabela
for (const [nome, fone, tipo, pag, bairro, itens] of [
  ['Ana', '(81) 9 9999-9999', 'Entrega', 'Pix', 'Matriz', [['bruto', 2], ['manso', 1]]],
  ['Bia', '(81) 9 8888-7777', 'Retirada', 'Dinheiro', '', [['matuto', 1]]],
  ['Caio', '(81) 9 7777-6666', 'Entrega', 'Cartão de crédito', 'outro', [['abusado', 1]]],
]) {
  await site.evaluate(its => localStorage.setItem('carrinho', JSON.stringify(its.map(([id, qtd]) =>
    ({ id, qtd, escolhas: [['Ponto da carne', 'Ao ponto']], sem: id === 'bruto' ? ['Bacon'] : [], obs: '' })))), itens);
  await site.reload();
  await site.waitForSelector('[data-id="bruto"]');
  await site.evaluate(async (nome, fone, tipo, pag, bairro) => {
    window.open = () => {};
    const q = s => document.querySelector(s), set = (id, v) => { q('#' + id).value = v; };
    q('#cartBtn').click();
    await new Promise(r => setTimeout(r, 400));
    set('nome', nome); set('fone', fone); set('rua', 'Rua do Sol'); set('numero', '12'); set('bairro', bairro); set('bairroOutro', 'Vila Nova');
    q(`md-radio[name=tipo][value=${tipo}]`).checked = true;
    q(`md-radio[name=pag][value="${pag}"]`).checked = true;
    q('#cartDialog').dispatchEvent(new Event('change'));
    q('#enviar').click();
  }, nome, fone, tipo, pag, bairro);
  await espera(800);
}
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844 });
await p.goto(BASE + 'painel/');
await p.screenshot({ path: `${OUT}/p0-login.png` });
await p.evaluate(() => window.__entrar('dono@teste.com'));
await p.waitForSelector('.pedido');
await espera(500);
await p.screenshot({ path: `${OUT}/p1-pedidos.png` });
await p.click('.pedido');
await espera(600);
await p.screenshot({ path: `${OUT}/p2-detalhe.png` });
await p.evaluate(() => { window.open = () => {}; document.querySelector('#avancar').click(); });
await espera(1500);
await p.evaluate(() => document.querySelector('[data-aba="numeros"]').click());
await espera(1500);
await p.screenshot({ path: `${OUT}/p3-numeros.png`, fullPage: true });
await p.evaluate(() => document.querySelector('[data-aba="loja"]').click());
await espera(500);
await p.screenshot({ path: `${OUT}/p4-loja.png` });
await b.close();
console.log('prints ok');
