// Regras de pedido compartilhadas entre site e painel (sem DOM, sem Firebase)
import { pix } from './pix.js';
import { brl } from './util.js';

export const soDigitos = s => String(s ?? '').replace(/\D/g, '');
// celular com DDD e o 9: 11 dígitos. Barra o número sem o 9 (viraria outro cliente) e o +55 digitado (a máscara corta e o DDD vira 55)
export const foneOk = s => /^[1-9]{2}9\d{8}$/.test(soDigitos(s));

// 0 na retirada; null = bairro fora da tabela (taxa a confirmar no WhatsApp)
export const taxaDe = (loja, entrega, bairro) => !entrega ? 0 : loja.taxas[bairro] ?? null;

// preço de 1 unidade pelo cardápio + adicionais (por id); item ou adicional que não existe vira NaN
export const precoItem = (loja, i) => (loja.cardapio.find(m => m.id === i.id)?.preco ?? NaN)
  + (i.extras || []).reduce((s, x) => s + (loja.adicionais?.find(a => a.id === x)?.preco ?? NaN), 0);

// ['cheddar','bacon','cheddar'] → ['2x Cheddar (1 fatia)', 'Bacon'] (ordem da primeira aparição; sumiu do cardápio = id)
export function agrupar(extras = [], adicionais = []) {
  const n = new Map();
  for (const x of extras) n.set(x, (n.get(x) || 0) + 1);
  return [...n].map(([x, q]) => `${q > 1 ? `${q}x ` : ''}${adicionais.find(a => a.id === x)?.nome ?? x}`);
}
// "+ 2x Bacon em cada": o adicional é por burger, e com 2 ou mais a loja lia "2 bacons" como o total (Nicolas, 25/10)
export const extrasTxt = (i, adicionais) => `+ ${agrupar(i.extras, adicionais).join(', ')}${i.qtd > 1 ? ' em cada' : ''}`;

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

// GPS de celular acerta em poucos metros; computador estima pela internet e erra por km: acima de 100 m não ajuda o motoboy
export const locBoa = precisao => precisao <= 100;
export const metros = m => m < 1000 ? `${Math.round(m)} m`
  : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`;

// bairro que o CEP devolve → nome igual na tabela de taxas (sem acento/maiúscula); null se não houver
const chave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const bairroDaTabela = (taxas, nome) => chave(nome) && Object.keys(taxas).find(b => chave(b) === chave(nome)) || null;

// pagamento dividido (só a loja): divisao = 2 ou 3 [{ pag, valor }] somando o total, e pag = 'Pix + Dinheiro'
export const pagTexto = p => p.divisao ? p.divisao.map(d => `${d.pag} ${brl(d.valor)}`).join(' + ') : p.pag;
// quanto do total é Pix (taxa à parte: na alteração ela não muda)
const noPix = (p, taxa) => p.divisao ? p.divisao.find(d => d.pag === 'Pix')?.valor ?? 0 : p.pag === 'Pix' ? p.subtotal + (taxa ?? 0) : 0;

export const MOTIVOS =['Acabou o item', 'Fora da área de entrega', 'Cliente desistiu', 'Loja fechando'];

// tempoEntrega e endereco são opcionais na loja: sem eles, o aviso fica só com a frase base.
// avaliar: link da avaliação (só no entregue, só se o pedido tem burger); sem link, entregue não manda nada
// consumo no local: o cliente está na loja, só o link da avaliação vai pelo WhatsApp
export function avisoCliente(etapa, p, motivo, loja = {}, avaliar = '') {
  if (p.local && etapa !== 'entregue') return undefined;
  const tempo = p.entrega && loja.tempoEntrega ? ` Tempo médio de entrega: ${loja.tempoEntrega} min.` : '';
  const ondeRetirar = loja.endereco ? `\n📍 ${loja.endereco}\n${mapa(loja.endereco, loja.cidade)}` : '';
  return {
    preparo: `Pedido #${p.cod} aceito! 🍔 Já estamos preparando.${tempo}`,
    saiu: p.entrega ? `Pedido #${p.cod} saiu pra entrega! 🛵` : `Pedido #${p.cod} pronto pra retirar! 🏃${ondeRetirar}`,
    cancelado: `Pedido #${p.cod} cancelado: ${motivo}. Qualquer dúvida, é só chamar.`,
    entregue: avaliar ? `Valeu pelo pedido! 🍔 Conta pra gente como foi: ${avaliar}` : undefined,
  }[etapa];
}

// pedido alterado pela loja: itens, total e pagamento de novo. antes = o pedido como estava (mesma taxa).
// Tinha Pix e continua: o cliente pode já ter pago, então o código é só da diferença do Pix (ou a loja devolve)
export function avisoAlteracao(p, loja, antes) {
  const total = p.subtotal + (p.taxa ?? 0), dif = p.subtotal - antes.subtotal;
  const pixNovo = noPix(p, p.taxa), pixAntes = noPix(antes, p.taxa), jaPix = pixNovo > 0 && pixAntes > 0;
  const valorPix = jaPix ? pixNovo - pixAntes : pixNovo, difPix = jaPix ? valorPix : 0;
  const comPix = pixNovo > 0 && loja.pix && p.taxa !== null && valorPix > 0;
  return [
    `Pedido #${p.cod} alterado ✏️`, '',
    ...p.itens.map(i => `${i.qtd}x ${i.nome}${i.extras?.length ? ` ${extrasTxt(i, loja.adicionais)}` : ''}`), '',
    `Total: ${brl(total)}${p.taxa === null ? ' + entrega' : ''}${dif ? ` (antes ${brl(total - dif)})` : ''}`,
    `Pagamento: ${pagTexto(p)}${p.troco && p.pag.includes('Dinheiro') ? ` (troco para ${brl(p.troco)})` : ''}`,
    ...(difPix > 0 ? ['', `Se já pagou o Pix, falta ${brl(difPix)}.`] : []),
    ...(difPix < 0 ? ['', `Se já pagou o Pix, a loja devolve ${brl(-difPix)}.`] : []),
    ...(comPix ? ['', 'Pix copia e cola:', pix({ chave: loja.pix, nome: loja.nome, cidade: loja.cidade.split(' - ')[0], valor: valorPix, txid: p.cod })] : []),
  ].join('\n');
}
