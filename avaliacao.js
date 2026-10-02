// Regras de avaliação compartilhadas (sem DOM, sem Firebase). As etiquetas se repetem no firestore.rules
// (o banco valida); o teste confere que as duas listas batem.
export const TAGS_BOAS = ['Saboroso', 'Chegou quente', 'Bem embalado', 'Entrega rápida', 'Bom atendimento'];
export const TAGS_RUINS = ['Chegou frio', 'Demorou', 'Faltou item', 'Veio errado', 'Embalagem ruim', 'Sabor deixou a desejar'];

// a menor nota decide: 4–5 = elogios, 1–3 = o que deu errado; sem nota = nada
export function etiquetas(notas) {
  const v = Object.values(notas);
  return !v.length ? [] : Math.min(...v) >= 4 ? TAGS_BOAS : TAGS_RUINS;
}

// burgers (não bebidas) do pedido, sem repetir, na ordem em que aparecem
export function burgersDoPedido(itens, cardapio) {
  const vistos = new Set();
  return itens.flatMap(i => {
    const m = cardapio.find(c => c.id === i.id);
    if (!m || m.tipo === 'bebida' || vistos.has(m.id)) return [];
    vistos.add(m.id);
    return [{ id: m.id, nome: m.nome }];
  });
}

const dia = d => d.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
export function quando(d, agora = new Date()) {
  if (dia(d) === dia(agora)) return 'hoje';
  if (dia(d) === dia(new Date(agora - 864e5))) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Recife' });
}

const somaMedia = l => l.reduce((s, n) => s + n, 0) / l.length;

// números da aba Avaliações (todas as notas contam, inclusive as ruins)
export function resumo(avaliacoes, cardapio) {
  const notas = avaliacoes.flatMap(a => Object.values(a.notas));
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  notas.forEach(n => dist[n]++);
  const por = {};
  avaliacoes.forEach(a => Object.entries(a.notas).forEach(([id, n]) => (por[id] ??= []).push(n)));
  const porBurger = Object.entries(por).map(([id, l]) => [cardapio.find(c => c.id === id)?.nome ?? id, somaMedia(l), l.length]);
  const conta = {};
  avaliacoes.forEach(a => (a.tags || []).forEach(t => { conta[t] = (conta[t] || 0) + 1; }));
  const tags = Object.entries(conta).sort((x, y) => y[1] - x[1]).map(([t, n]) => [t, n, TAGS_BOAS.includes(t)]);
  return { total: avaliacoes.length, media: notas.length ? somaMedia(notas) : 0, dist, porBurger, tags };
}
