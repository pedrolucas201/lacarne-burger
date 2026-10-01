// Regras de pedido compartilhadas entre site e painel (sem DOM, sem Firebase)
export const soDigitos = s => String(s ?? '').replace(/\D/g, '');

// 0 na retirada; null = bairro fora da tabela (taxa a confirmar no WhatsApp)
export const taxaDe = (loja, entrega, bairro) => !entrega ? 0 : loja.taxas[bairro] ?? null;

// recalcula pelo cardápio atual: pega preço adulterado no navegador (e item que não existe vira NaN)
export function conferir(p, loja) {
  const subtotal = p.itens.reduce((s, i) => s + (loja.cardapio.find(m => m.id === i.id)?.preco ?? NaN) * i.qtd, 0);
  const taxa = taxaDe(loja, p.entrega, p.cliente.bairro);
  return { subtotal, taxa, ok: subtotal === p.subtotal && taxa === p.taxa };
}

// api.whatsapp.com direto: o redirect do wa.me corrompe emojis
export const whats = (fone, texto) =>
  `https://api.whatsapp.com/send?phone=55${soDigitos(fone)}&text=${encodeURIComponent(texto)}`;

export const mapa = (endereco, cidade) => `https://maps.google.com/?q=${encodeURIComponent(`${endereco}, ${cidade}`)}`;

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
