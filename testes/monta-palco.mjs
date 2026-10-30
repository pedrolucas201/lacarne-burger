// Montagem: em todo burger, de 0 a 3 carnes e com todos os adicionais, o pão de cima fica dentro do palco e abaixo das abas.
// Rodar com os emuladores ligados e semeados (npm run dev + npm run seed:local): node testes/monta-palco.mjs
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { LOJA } from '../lojas/lacarne.mjs';

const espera = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: process.env.CI ? ['--no-sandbox'] : [] });
const falhas = [];
try {
  for (const [w, h] of [[360, 740], [390, 844], [1280, 800]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); // sem voo: a pilha vai direto pro lugar
    await p.goto('http://127.0.0.1:5000/?teste');
    await p.evaluate(() => localStorage.setItem('montar', 'true'));
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#status').textContent && customElements.get('md-dialog'));
    for (const burger of LOJA.cardapio.filter(i => i.camadas)) {
      for (let carnes = 0; carnes <= 3; carnes++) {
        await p.$eval(`[data-card="${burger.id}"] h3`, e => e.click());
        await p.waitForSelector('.monta-pilha', { visible: true });
        for (const a of LOJA.adicionais) {
          const n = a.id === 'carne' ? carnes : 1;
          for (let i = 0; i < n; i++) await p.$eval(`[data-x="${a.id}"][data-d="1"]`, e => e.click());
        }
        await espera(500);
        const r = await p.evaluate(() => {
          const caixa = s => document.querySelector(s).getBoundingClientRect();
          const camadas = [...document.querySelectorAll('.monta-pilha .camada img')].map(i => i.getBoundingClientRect());
          return { topo: Math.min(...camadas.map(c => c.top)), base: Math.max(...camadas.map(c => c.bottom)),
            abas: caixa('.monta-abas').bottom, foto: caixa('.item-foto').top, fim: caixa('.item-foto').bottom };
        });
        const onde = `${w}px ${burger.nome} +${carnes} carne(s)`;
        if (r.topo < r.abas - 2) falhas.push(`${onde}: pão de cima ${Math.round(r.abas - r.topo)} px atrás das abas`);
        if (r.base > r.fim + 1) falhas.push(`${onde}: pão de baixo ${Math.round(r.base - r.fim)} px pra fora do palco`);
        await p.$eval('#itemDialog', d => d.close());
        await espera(300);
      }
    }
    await p.close();
  }
} finally { await b.close(); }
assert.deepEqual(falhas, [], falhas.join('\n'));
console.log('montagem cabe no palco em todos os burgers, de 0 a 3 carnes');
