// Configuração da La Carne. Mudou algo? Edita aqui e roda o seed (ver scripts/seed.mjs).
export const LOJA_ID = 'lacarne';
const PONTO = { titulo: 'Ponto da carne', itens: ['Mal passado', 'Ao ponto', 'Bem passado'] };

export const LOJA = {
  nome: 'La Carne Burger',
  whatsapp: '5581984793839',
  pix: '+5581984793839', // chave Pix (telefone com +55); vazio = sem Pix copia e cola
  cidade: 'Vitória de Santo Antão - PE',
  horario: { dias: [3, 4, 5, 6], abre: 18, fecha: 22, texto: 'Quarta a sábado · 18h às 22h' },
  // taxa de entrega por bairro (tabela da MotoJá); bairro fora da lista = "a confirmar no WhatsApp"
  taxas: {
    'Água Branca': 7, 'Alto do Cigano': 7, 'Alto José Leal (até o Mercado do Lar)': 7, 'Amparo': 6, 'Atacarejo': 9,
    'Bairro Nobre': 8, 'Bairro Novo': 7, 'Bairro Treze': 5, 'Balança': 7, 'Bela Vista': 7, 'Bela Vista 2': 8,
    'Belo Horizonte': 7, 'Borges': 6, 'Privê Borges': 7, 'Caic': 7, 'Caiçara 1': 7, 'Caiçara 2 e 3': 8, 'Cajá': 7,
    'Cajueiro': 9, 'Campinas': 8, 'Colorado': 8, 'Cond. Águas Claras': 8, 'Cond. Bela Vista 2': 8, 'Doutor Alvinho': 7,
    'Irã': 7, 'Iraque 1': 7, 'Iraque 2': 8, 'Jardim Ipiranga': 7, 'Jardim São Pedro': 7, 'José de Lemos': 7,
    'Lagoa Redonda': 7, 'Lídia Queiroz': 7, 'Livramento': 5, 'Lot. de Baú': 8, 'Lot. Paraíso': 7, 'Lot. Real': 7,
    'Lot. Tropical': 7, 'Lot. Veneza': 8, 'Mangueira': 5, 'Maranhão': 7, 'Mário Bezerra': 7, 'Matadouro': 7,
    'Matriz': 5, 'Maués': 8, 'Militina': 8, 'Natuba': 10, 'Petrobras': 7, 'Pinga Fogo': 6, 'Privê Shopping': 10,
    'Redenção': 7, 'Santana': 9, 'Shopping (fora)': 8, 'Shopping (dentro)': 10, 'Sítio do Meio': 7, 'Trajanos': 7,
  },
  cardapio: [
    { id: 'manso', nome: 'Manso', preco: 20, emoji: '🍔', escolhas: [PONTO],
      desc: 'Pão brioche, 150g de hambúrguer artesanal, queijo cheddar e maionese da casa.',
      tira: ['Queijo cheddar', 'Maionese da casa'] },
    { id: 'abusado', nome: 'Abusado', preco: 22, emoji: '🍫', escolhas: [PONTO],
      desc: 'Pão brioche, hambúrguer artesanal, queijo cheddar e Nutella.',
      tira: ['Queijo cheddar'] },
    { id: 'matuto', nome: 'Matuto', preco: 25, emoji: '🧀', escolhas: [PONTO],
      desc: 'Pão brioche, 150g de hambúrguer artesanal, queijo coalho no mel, queijo cheddar e cebola caramelizada.',
      tira: ['Queijo cheddar', 'Cebola caramelizada'] },
    { id: 'bruto', nome: 'Bruto', preco: 32, emoji: '🥓', escolhas: [PONTO],
      desc: 'Pão brioche, duplo hambúrguer artesanal (150g cada), queijo cheddar, bacon, cebola caramelizada e maionese da casa.',
      tira: ['Bacon', 'Cebola caramelizada', 'Maionese da casa'] },
  ],
};
