// Burger se montando no diálogo: a foto vira pilha no 1º toque num adicional ou num "Sem…".
// Medidas em px do desenho (pão com 302 px num palco de 360×340); o palco inteiro escala pra caber no .item-foto.
import { pilha } from './camadas.js';

const ESCALA = 0.58, W = 360, H = 340; // imagens recortadas com 520 px de largura → pão de 302 px
const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const curva = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
const suave = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const vibra = p => navigator.vibrate?.(p);
// onde cada ferramenta fica em relação ao que leva (w, h = ingrediente; tw, th = ferramenta)
const FERR = {
  espatula: { k: 1.75, pos: (w, h, tw, th) => [-0.04 * w, h - 0.78 * th] }, // lâmina por baixo
  mao: { k: 0.75, pos: (w, h, tw, th) => [0.8 * w - 0.22 * tw, 0.25 * h - 0.75 * th] }, // pinça a borda de cima
  bisnaga: { k: 0.45, pos: (w, h, tw, th) => [-0.02 * tw, -0.97 * th] }, // bico no canto de cima
};
const ferrImg = {};
const ferramenta = f => ferrImg[f] ??= Object.assign(new Image(), { src: `img/monta/ferr-${f}.webp` });

export function montar(foto, item, loja) {
  const m = loja.monta, pao = item.pao ? `pao-${item.pao}` : 'pao';
  const original = { cls: foto.className, html: foto.innerHTML }; // pra voltar pra foto real
  let palco, monte, topo, olho, estado = [], fila = Promise.resolve();
  Object.keys(FERR).forEach(ferramenta); // já baixa as ferramentas

  function camada(id) {
    const d = document.createElement('div');
    d.className = 'camada';
    const img = new Image();
    img.alt = '';
    img.src = `img/monta/${id}.webp`;
    img.onload = () => Object.assign(img.style, {
      width: img.naturalWidth * ESCALA * (m.camadas[id]?.largura ?? 1) + 'px', height: img.naturalHeight * ESCALA + 'px' });
    img.onerror = () => { d.dataset.sem = 1; d.remove(); if (topo) arruma(); }; // sem arte: a camada não aparece nem ocupa espaço
    d.append(img);
    return d;
  }

  function arruma() {
    const cal = m.pao[pao];
    let y = 10 + cal.base;
    let antes = null;
    const fatia = id => m.camadas[id]?.passo === 0; // fatia de queijo: não cresce a pilha
    estado.filter(c => c.entregue && !c.el.dataset.sem).forEach((c, i) => {
      const cfg = m.camadas[c.id];
      if (fatia(c.id) && fatia(antes)) y += 12; // fatia sobre fatia: degrau pra aparecer as duas
      antes = c.id;
      c.el.style.bottom = y + (cfg.desloca ?? 0) + 'px';
      c.el.style.zIndex = 1 + i;
      y += cfg.passo;
    });
    const yTopo = y + cal.topo;
    topo.style.bottom = yTopo + 'px';
    topo.style.zIndex = 99;
    monte.style.scale = Math.min(1, (H - 10) / (yTopo + 130)); // pilha alta encolhe (130 ≈ altura do pão de cima)
  }

  const cabe = () => palco.style.scale = Math.min(foto.clientWidth / W, foto.clientHeight / H);

  function abrir() {
    foto.classList.remove('com-foto', 'com-boi'); // .com-boi mexe no img da foto
    foto.classList.add('com-pilha');
    foto.innerHTML = '<div class="monta-palco"><div class="monta-pilha"></div></div>';
    palco = foto.firstChild; monte = palco.firstChild;
    const base = camada(`${pao}-base`); topo = camada(`${pao}-topo`);
    base.style.bottom = '10px';
    monte.append(base, topo);
    // a receita aparece inteira de uma vez; só o que mudar depois anima
    estado = pilha({ receita: item.camadas, ordem: m.ordem, queijos: m.queijos })
      .map(c => ({ ...c, el: camada(c.id), entregue: true }));
    monte.append(...estado.map(c => c.el));
    (olho = new ResizeObserver(cabe)).observe(foto);
    cabe();
  }

  // o voo vai dentro do conteúdo do diálogo: fora dele fica atrás do modal, e solto no md-dialog não aparece (não tem slot padrão)
  const dialogo = () => foto.closest('[slot]') ?? document.body;
  const amassa = els => calmo() || els.forEach(el =>
    el.animate([{ scale: '1 1' }, { scale: '1.02 0.94' }, { scale: '1 1' }], { duration: 220, easing: 'ease-out' }));

  // sai voando em arco pra dentro do botão tocado, encolhendo; as de cima descem (transition do bottom)
  function sai(c, origem) {
    if (!c.entregue || c.el.dataset.sem || calmo() || !origem) return c.el.remove();
    const r = c.el.getBoundingClientRect(), o = origem.getBoundingClientRect();
    const v = Object.assign(c.el.querySelector('img').cloneNode(), { className: 'monta-voo' });
    Object.assign(v.style, { width: r.width + 'px', height: r.height + 'px' });
    dialogo().append(v);
    c.el.remove();
    const T = (x, y, k, g) => `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${g}deg) scale(${k})`;
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = o.left + o.width / 2, y1 = o.top + o.height / 2;
    v.animate([{ transform: T(x0, y0, 1, 0) }, { transform: T((x0 + x1) / 2, Math.min(y0, y1) - 50, 0.7, -12), offset: 0.4 },
      { transform: T(x1, y1, 0.18, -20), opacity: 0.3 }], { duration: 420, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' })
      .finished.then(() => v.remove());
    vibra(10);
  }

  // a ferramenta sai do botão e voa em arco, crescendo, até o lugar da camada; tudo acima sobe junto (tampa)
  function entra(c, origem) {
    if (!estado.includes(c)) { c.el.remove(); return; } // tirou antes de chegar
    c.entregue = true;
    arruma(); // abre o espaço; a camada invisível é o alvo do voo
    if (calmo() || !origem || c.el.dataset.sem) { c.el.style.opacity = 1; return; }
    return new Promise(pronto => {
      const tipo = m.camadas[c.id].ferramenta, f = FERR[tipo], molho = tipo === 'bisnaga', fi = ferramenta(tipo);
      const voo = document.createElement('div'); voo.className = 'monta-voo';
      const leva = molho ? null : c.el.querySelector('img').cloneNode();
      const ferr = fi.cloneNode();
      if (leva) voo.append(leva);
      voo.append(ferr);
      dialogo().append(voo);
      const o = origem.getBoundingClientRect(), x0 = o.left + o.width / 2, y0 = o.top + o.height / 2, t0 = performance.now(), D = 560;
      const vis = estado.filter(q => q.entregue && !q.el.dataset.sem), i = vis.indexOf(c);
      const acima = [...vis.slice(i + 1).map(q => q.el), topo], vao = molho ? 95 : 45, dur = D + (molho ? 900 : 300);
      acima.forEach(el => el.animate([{ translate: '-50% 0' }, { translate: `-50% -${vao}px`, offset: 0.25 }, { translate: `-50% -${vao}px`, offset: 0.85 },
        { translate: '-50% 0', offset: 0.95 }, { translate: '-50% -4px' }, { translate: '-50% 0' }], { duration: dur, easing: 'ease-in-out' }));
      setTimeout(() => { vibra(8); amassa(vis.slice(0, i + 1).map(q => q.el)); }, dur * 0.95);
      let w, h;
      const quadro = () => {
        if (!c.el.isConnected) { voo.remove(); return pronto(); }
        const t = Math.min(1, (performance.now() - t0) / D), e = suave(t), r = c.el.getBoundingClientRect();
        w = 46 + (r.width - 46) * e; h = w * r.height / r.width;
        const x1 = molho ? r.left : r.left + r.width / 2, y1 = molho ? r.top : r.top + r.height / 2;
        const x = curva(x0, (x0 + x1) / 2, x1, e), y = curva(y0, Math.min(y0, y1) - 120, y1, e);
        voo.style.transform = `translate(${molho ? x : x - w / 2}px, ${molho ? y : y - h / 2}px) rotate(${(1 - e) * -10}deg)`;
        if (leva) Object.assign(leva.style, { width: w + 'px', height: h + 'px', left: 0, top: 0 });
        const tw = f.k * w, th = tw * fi.naturalHeight / fi.naturalWidth, [fx, fy] = f.pos(w, h, tw, th);
        Object.assign(ferr.style, { width: tw + 'px', left: fx + 'px', top: fy + 'px' });
        if (t < 1) return requestAnimationFrame(quadro);
        chegou(voo.style.transform);
      };
      const chegou = tr => {
        leva?.remove();
        c.el.style.opacity = 1;
        vibra(12);
        const vai = de => voo.animate([{ transform: de, opacity: 1 }, { transform: de + ' translate(80px, -140px) rotate(14deg)', opacity: 0 }],
          { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished.then(() => voo.remove());
        if (molho) { // a bisnaga passa da esquerda pra direita e o molho aparece atrás dela
          const fim = tr + ` translate(${w * 0.92}px, 0)`;
          c.el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 750, easing: 'linear' });
          voo.animate([{ transform: tr }, { transform: fim }], { duration: 750, easing: 'linear', fill: 'forwards' })
            .finished.then(() => { vai(fim); pronto(); });
        } else {
          c.el.animate([{ translate: '-50% -18px' }, { translate: '-50% 0' }], { duration: 160, easing: 'ease-in' });
          vai(tr);
          setTimeout(pronto, 150);
        }
      };
      requestAnimationFrame(quadro);
    });
  }

  return {
    // volta pra foto real; ligar de novo remonta do zero
    desligar() {
      foto.className = original.cls;
      foto.innerHTML = original.html;
      olho?.disconnect();
      palco = topo = null; estado = []; fila = Promise.resolve();
    },
    // sem = textos marcados em "Quer tirar algo?"; extras = ids dos adicionais (repetidos); origem = botão tocado
    atualizar(sem, extras, origem) {
      if (!palco) abrir();
      const tirar = sem.map(t => item.tiraCamada?.[t]).filter(Boolean);
      const nova = pilha({ receita: item.camadas, tirar, extras, ordem: m.ordem, queijos: m.queijos });
      const chaves = new Set(nova.map(c => c.k)), antigo = new Map(estado.map(c => [c.k, c]));
      estado.filter(c => !chaves.has(c.k)).forEach(c => sai(c, origem));
      estado = nova.map(c => antigo.get(c.k) ?? { ...c, el: camada(c.id), entregue: false, nova: true });
      for (const c of estado.filter(c => c.nova)) {
        delete c.nova;
        c.el.style.opacity = 0;
        monte.append(c.el);
        fila = fila.then(() => entra(c, origem)); // uma entrega por vez
      }
      arruma(); // só posiciona as entregues: a nova abre espaço quando chega a vez dela
    },
  };
}
