// Regras de pedido compartilhadas entre site e painel (sem DOM, sem Firebase)
export const soDigitos = s => String(s ?? '').replace(/\D/g, '');

// 0 na retirada; null = bairro fora da tabela (taxa a confirmar no WhatsApp)
export const taxaDe = (loja, entrega, bairro) => !entrega ? 0 : loja.taxas[bairro] ?? null;

// preço de 1 unidade pelo cardápio + adicionais (por id); item ou adicional que não existe vira NaN
export const precoItem = (loja, i) => (loja.cardapio.find(m => m.id === i.id)?.preco ?? NaN)
  + (i.extras || []).reduce((s, x) => s + (loja.adicionais?.find(a => a.id === x)?.preco ?? NaN), 0);

// recalcula pelo cardápio atual: pega preço adulterado no navegador
export function conferir(p, loja) {
  const subtotal = p.itens.reduce((s, i) => s + precoItem(loja, i) * i.qtd, 0);
  const taxa = taxaDe(loja, p.entrega, p.cliente.bairro);
  return { subtotal, taxa, ok: subtotal === p.subtotal && taxa === p.taxa };
}

// api.whatsapp.com direto: o redirect do wa.me corrompe emojis
export const whats = (fone, texto) =>
  `https://api.whatsapp.com/send?phone=55${soDigitos(fone)}&text=${encodeURIComponent(texto)}`;

// sem cidade = coordenada (ponto) ou endereço completo
export const mapa = (endereco, cidade) => `https://maps.google.com/?q=${encodeURIComponent([endereco, cidade].filter(Boolean).join(', '))}`;

// localização do celular → "lat,lng" com 6 casas (~10 cm, mais que o GPS entrega)
export const ponto = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

// bairro que o CEP devolve → nome igual na tabela de taxas (sem acento/maiúscula); null se não houver
const chave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const bairroDaTabela = (taxas, nome) => chave(nome) && Object.keys(taxas).find(b => chave(b) === chave(nome)) || null;

export const MOTIVOS = ['Acabou o item', 'Fora da área de entrega', 'Cliente desistiu', 'Loja fechando'];

// tempoEntrega e endereco são opcionais na loja: sem eles, o aviso fica só com a frase base
export function avisoCliente(etapa, p, motivo, loja = {}) {
  const tempo = p.entrega && loja.tempoEntrega ? ` Tempo médio de entrega: ${loja.tempoEntrega} min.` : '';
  const ondeRetirar = loja.endereco ? `\n📍 ${loja.endereco}\n${mapa(loja.endereco, loja.cidade)}` : '';
  return {
    preparo: `Pedido #${p.cod} aceito! 🍔 Já estamos preparando.${tempo}`,
    saiu: p.entrega ? `Pedido #${p.cod} saiu pra entrega! 🛵` : `Pedido #${p.cod} pronto pra retirar! 🏃${ondeRetirar}`,
    cancelado: `Pedido #${p.cod} cancelado: ${motivo}. Qualquer dúvida, é só chamar.`,
  }[etapa];
}
