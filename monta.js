// Burger se montando no diálogo: a foto vira pilha no 1º toque num adicional ou num "Sem…".
// Medidas em px do desenho (pão com 302 px num palco de 360×340); o palco inteiro escala pra caber no .item-foto.
import { pilha } from './camadas.js';

const ESCALA = 0.58, W = 360, H = 340; // imagens recortadas com 520 px de largura → pão de 302 px

export function montar(foto, item, loja) {
  const m = loja.monta, pao = item.pao ? `pao-${item.pao}` : 'pao';
  let palco, monte, topo, estado = [];

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
    let y = 10 + m.pao.base;
    estado.filter(c => c.entregue && !c.el.dataset.sem).forEach((c, i) => {
      const cfg = m.camadas[c.id];
      c.el.style.bottom = y + (cfg.desloca ?? 0) + 'px';
      c.el.style.zIndex = 1 + i;
      y += cfg.passo;
    });
    const yTopo = y + m.pao.topo;
    topo.style.bottom = yTopo + 'px';
    topo.style.zIndex = 99;
    monte.style.scale = Math.min(1, (H - 10) / (yTopo + 130)); // pilha alta encolhe (130 ≈ altura do pão de cima)
  }

  const cabe = () => palco.style.scale = Math.min(foto.clientWidth / W, foto.clientHeight / H);

  function abrir() {
    foto.className = 'item-foto com-pilha';
    foto.innerHTML = '<div class="monta-palco"><div class="monta-pilha"></div></div>';
    palco = foto.firstChild; monte = palco.firstChild;
    const base = camada(`${pao}-base`); topo = camada(`${pao}-topo`);
    base.style.bottom = '10px';
    monte.append(base, topo);
    // a receita aparece inteira de uma vez; só o que mudar depois anima
    estado = pilha({ receita: item.camadas, ordem: m.ordem, queijos: m.queijos })
      .map(c => ({ ...c, el: camada(c.id), entregue: true }));
    monte.append(...estado.map(c => c.el));
    new ResizeObserver(cabe).observe(foto);
    cabe();
  }

  return {
    // sem = textos marcados em "Quer tirar algo?"; extras = ids dos adicionais (repetidos); origem = botão tocado
    atualizar(sem, extras, origem) {
      if (!palco) abrir();
      const tirar = sem.map(t => item.tiraCamada?.[t]).filter(Boolean);
      const nova = pilha({ receita: item.camadas, tirar, extras, ordem: m.ordem, queijos: m.queijos });
      const chaves = new Set(nova.map(c => c.k)), antigo = new Map(estado.map(c => [c.k, c]));
      estado.filter(c => !chaves.has(c.k)).forEach(c => c.el.remove());
      estado = nova.map(c => antigo.get(c.k) ?? { ...c, el: camada(c.id), entregue: true, nova: true });
      for (const c of estado.filter(c => c.nova)) { delete c.nova; monte.append(c.el); }
      arruma();
    },
  };
}
