// Camadas do burger montado, de baixo pra cima: receita − tirados + adicionais, na ordem fixa da loja.
// "proteina" na ordem = carne e queijo intercalados (carne, queijo, carne, queijo…); o que sobrar de queijo vai em cima.
// Cada camada ganha uma chave id#n: a animação compara as chaves pra saber o que entrou e o que saiu.
export function pilha({ receita = [], tirar = [], extras = [], ordem = [], queijos = [] }) {
  const todas = [...receita.filter(c => !tirar.includes(c)), ...extras];
  const de = id => todas.filter(c => c === id);
  const seq = [];
  for (const etapa of ordem) {
    if (etapa !== 'proteina') { seq.push(...de(etapa)); continue; }
    const carnes = de('carne'), qs = queijos.flatMap(de);
    for (let i = 0; i < Math.max(carnes.length, qs.length); i++) seq.push(...[carnes[i], qs[i]].filter(Boolean));
  }
  const n = {};
  return seq.map(id => ({ id, k: `${id}#${n[id] = (n[id] ?? -1) + 1}` }));
}
