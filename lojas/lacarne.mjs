// Configuração da La Carne. Mudou algo? Edita aqui, roda o seed (scripts/seed.mjs) e faz deploy: o site mostra este arquivo na hora e o banco corrige ao vivo.
export const LOJA_ID = 'lacarne';
const PONTO = { titulo: 'Ponto da carne', itens: ['Mal passado', 'Ao ponto', 'Bem passado'] };

export const LOJA = {
  nome: 'La Carne Burger',
  whatsapp: '5581984793839',
  pix: '+5581984793839', // chave Pix (telefone com +55); vazio = sem Pix copia e cola
  cidade: 'Vitória de Santo Antão - PE',
  endereco: 'Rua do Borges, 489 - Bela Vista', // onde retira; vazio = não mostra
  tempoEntrega: 30, // minutos, média informada pelo Nicolas; 0 = não mostra
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
  // adicionais (Brenda, 01/10): valem pra qualquer burger, até 5 de cada (app.js MAX_EXTRA); preço por unidade do burger
  adicionais: [
    { id: 'cheddar', nome: 'Cheddar (1 fatia)', preco: 2 },
    { id: 'mucarela', nome: 'Muçarela (1 fatia)', preco: 2 },
    { id: 'coalho', nome: 'Queijo coalho (1 fatia)', preco: 5 },
    { id: 'cebola', nome: 'Cebola caramelizada', preco: 3 },
    { id: 'bacon', nome: 'Bacon', preco: 4 },
  ],
  // tira: todo ingrediente pode sair, menos pão e carne (Brenda, 01/10)
  // fotoAlta: versão vertical (das originais em alta) pra tela larga do computador
  // boi: desenho de cada burger (PDF da Brenda); aparece quando ainda não tem foto
  cardapio: [
    { id: 'manso', nome: 'Manso', preco: 20, emoji: '🍔', foto: 'img/manso.webp', fotoAlta: 'img/manso-alta.webp', boi: 'img/boi-manso.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo cheddar e maionese da casa.',
      tira: ['Queijo cheddar', 'Maionese da casa'] },
    { id: 'abusado', nome: 'Abusado', preco: 22, emoji: '🍫', boi: 'img/boi-abusado.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo cheddar e Nutella.',
      tira: ['Queijo cheddar', 'Nutella'] },
    { id: 'matuto', nome: 'Matuto', preco: 25, emoji: '🧀', foto: 'img/matuto.webp', fotoAlta: 'img/matuto-alta.webp', boi: 'img/boi-matuto.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo coalho no mel, queijo cheddar e cebola caramelizada.',
      tira: ['Queijo coalho', 'Mel', 'Queijo cheddar', 'Cebola caramelizada'] },
    // Praiêro e Amostradinho (01/10): descrição e preço da Brenda; "tira" sugerido pelo Pedro, confirmar com a loja
    { id: 'praiero', nome: 'Praiêro', preco: 26, emoji: '🍍', foto: 'img/praiero.webp', fotoAlta: 'img/praiero-alta.webp', boi: 'img/boi-praiero.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), abacaxi grelhado com mel e queijo muçarela.',
      tira: ['Abacaxi', 'Mel', 'Queijo muçarela'] },
    { id: 'amostradinho', nome: 'Amostradinho', preco: 27, emoji: '😎', foto: 'img/amostradinho.webp', fotoAlta: 'img/amostradinho-alta.webp', boi: 'img/boi-amostradinho.webp', escolhas: [PONTO],
      desc: 'Pão brioche amanteigado, blend de fraldinha (150g), maionese, queijo cheddar e geleia de bacon.',
      tira: ['Maionese', 'Queijo cheddar', 'Geleia de bacon'] },
    { id: 'bruto', nome: 'Bruto', preco: 32, emoji: '🥓', foto: 'img/bruto.webp', fotoAlta: 'img/bruto-alta.webp', boi: 'img/boi-bruto.webp', escolhas: [PONTO],
      desc: 'Pão brioche, dois blends de fraldinha (150g cada), queijo cheddar, bacon, cebola caramelizada e maionese da casa.',
      tira: ['Queijo cheddar', 'Bacon', 'Cebola caramelizada', 'Maionese da casa'] },
    // bebidas (cardápio da Brenda, 01/10): vão direto pra sacola, sem diálogo
    { id: 'guarana', tipo: 'bebida', nome: 'Guaraná Antarctica', preco: 6, foto: 'img/bebida-guarana.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca', tipo: 'bebida', nome: 'Coca-Cola', preco: 6, foto: 'img/bebida-coca.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'fanta', tipo: 'bebida', nome: 'Fanta Laranja', preco: 6, foto: 'img/bebida-fanta.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca-zero', tipo: 'bebida', nome: 'Coca-Cola Zero', preco: 6, foto: 'img/bebida-coca-zero.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca-zero-ks', tipo: 'bebida', nome: 'Coca-Cola Zero KS', preco: 6, foto: 'img/bebida-coca-zero-ks.webp', desc: 'Garrafa de vidro 290 ml', escolhas: [], tira: [] },
    { id: 'coca-1l', tipo: 'bebida', nome: 'Coca-Cola 1 L', preco: 12, foto: 'img/bebida-coca-1l.webp', desc: 'Garrafa de vidro 1 litro', escolhas: [], tira: [] },
    { id: 'limoneto', tipo: 'bebida', nome: 'H2OH! Limoneto', preco: 7, foto: 'img/bebida-limoneto.webp', desc: 'Garrafa 500 ml', escolhas: [], tira: [] },
    { id: 'agua', tipo: 'bebida', nome: 'Água mineral', preco: 2, foto: 'img/bebida-agua.webp', desc: 'Garrafa 500 ml', escolhas: [], tira: [] },
  ],
};
