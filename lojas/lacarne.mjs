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
  horario: { dias: [0, 3, 4, 5, 6], abre: 18, fecha: 23, texto: 'Quarta a domingo · 18h às 23h' },
  // taxa de entrega por bairro: anéis de 1/2/3/4,5 km da loja a R$ 5/6/7/8 (Nicolas, 23/10); Caiçara e Campinas a R$ 10 por serem mais pra dentro; Natuba, Shopping (dentro) e Privê Shopping a R$ 10.
  // bairro fora da lista = "a confirmar no WhatsApp"
  taxas: {
    'Água Branca': 7, 'Alto do Cigano': 7, 'Alto José Leal (até o Mercado do Lar)': 5, 'Amparo': 6, 'Atacarejo': 8,
    'Bairro Nobre': 7, 'Bairro Novo': 5, 'Bairro Treze': 5, 'Balança': 6, 'Bela Vista': 5, 'Bela Vista 2': 5,
    'Belo Horizonte': 7, 'Borges': 5, 'Privê Borges': 5, 'Caic': 7, 'Caiçara 1': 10, 'Caiçara 2 e 3': 10, 'Cajá': 7,
    'Cajueiro': 8, 'Campinas': 10, 'Colorado': 8, 'Cond. Águas Claras': 8, 'Cond. Bela Vista 2': 6, 'Doutor Alvinho': 6,
    'Irã': 7, 'Iraque 1': 7, 'Iraque 2': 7, 'Jardim Ipiranga': 6, 'Jardim São Pedro': 6, 'José de Lemos': 6,
    'Lagoa Redonda': 6, 'Lídia Queiroz': 7, 'Livramento': 5, 'Lot. de Baú': 7, 'Lot. Paraíso': 7, 'Lot. Real': 6,
    'Lot. Tropical': 7, 'Lot. Veneza': 7, 'Mangueira': 5, 'Maranhão': 6, 'Mário Bezerra': 6, 'Matadouro': 7,
    'Matriz': 5, 'Maués': 6, 'Militina': 7, 'Natuba': 10, 'Petrobras': 7, 'Pinga Fogo': 5, 'Privê Shopping': 10,
    'Redenção': 6, 'Santana': 8, 'Shopping (fora)': 7, 'Shopping (dentro)': 10, 'Sítio do Meio': 6, 'Trajanos': 6,
  },
  // adicionais (Brenda, 01/10): valem pra qualquer burger, até 5 de cada (app.js MAX_EXTRA) ou `max`; preço por unidade do burger
  adicionais: [
    { id: 'cheddar', nome: 'Cheddar (1 fatia)', preco: 2 },
    { id: 'mucarela', nome: 'Muçarela (1 fatia)', preco: 2 },
    { id: 'coalho', nome: 'Queijo coalho (1 fatia)', preco: 5 },
    { id: 'cebola', nome: 'Cebola caramelizada', preco: 3 },
    { id: 'bacon', nome: 'Bacon', preco: 4 },
    { id: 'carne', nome: 'Carne (blend 150g)', preco: 7, max: 3, maxMsg: 'Até 3 carnes por burger. Quer mais? Chama a loja no WhatsApp 📲' }, // Brenda, 02/10; max = total no burger, contando a receita (estimativa do Pedro, 27/10: confirmar com o Nicolas)
    { id: 'abacaxi', nome: 'Abacaxi (porção extra)', preco: 4 }, // Nicolas, 15/10
  ],
  // burger se montando no diálogo (monta.js). Adicional usa a camada de mesmo id.
  // passo = quanto a pilha cresce; desloca = quanto a camada desce sobre a de baixo; px com o pão a 302 px (teste de arte, 27/10)
  monta: {
    ordem: ['maionese', 'nutella', 'proteina', 'geleia', 'bacon', 'cebola', 'abacaxi'],
    queijos: ['cheddar', 'mucarela', 'coalho'],
    pao: { pao: { base: 80, topo: -18 }, 'pao-amanteigado': { base: 108, topo: -6 } }, // por arte de pão
    camadas: {
      carne: { ferramenta: 'espatula', passo: 72 },
      cheddar: { ferramenta: 'mao', passo: 0, desloca: -60, largura: 0.92 },
      mucarela: { ferramenta: 'mao', passo: 0, desloca: -60, largura: 0.92 },
      coalho: { ferramenta: 'espatula', passo: 37, desloca: -10 },
      bacon: { ferramenta: 'mao', passo: 30, desloca: -8 },
      cebola: { ferramenta: 'espatula', passo: 46, desloca: -56 },
      abacaxi: { ferramenta: 'espatula', passo: 60, desloca: -6 },
      maionese: { ferramenta: 'bisnaga', passo: 8, desloca: -45 },
      nutella: { ferramenta: 'bisnaga', passo: 8, desloca: -81 },
      geleia: { ferramenta: 'bisnaga', passo: 20, desloca: -100 },
    },
  },
  // tira: todo ingrediente pode sair, menos pão e carne (Brenda, 01/10)
  // fotoAlta: versão vertical (das originais em alta) pra tela larga do computador
  // boi: desenho de cada burger (PDF da Brenda); aparece quando ainda não tem foto
  cardapio: [
    { id: 'manso', nome: 'Manso', preco: 20, emoji: '🍔', foto: 'img/manso.webp', fotoAlta: 'img/manso-alta.webp', boi: 'img/boi-manso.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo cheddar e maionese da casa.',
      tira: ['Queijo cheddar', 'Maionese da casa'],
      camadas: ['maionese', 'carne', 'cheddar'], tiraCamada: { 'Queijo cheddar': 'cheddar', 'Maionese da casa': 'maionese' } },
    { id: 'abusado', nome: 'Abusado', preco: 24, emoji: '🍫', foto: 'img/abusado.webp', fotoAlta: 'img/abusado-alta.webp', boi: 'img/boi-abusado.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo cheddar e Nutella.',
      tira: ['Queijo cheddar', 'Nutella'],
      camadas: ['nutella', 'carne', 'cheddar'], tiraCamada: { 'Queijo cheddar': 'cheddar', 'Nutella': 'nutella' } },
    { id: 'matuto', nome: 'Matuto', preco: 28, emoji: '🧀', foto: 'img/matuto.webp', fotoAlta: 'img/matuto-alta.webp', boi: 'img/boi-matuto.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), queijo coalho no mel, queijo cheddar, cebola caramelizada e maionese da casa.',
      tira: ['Queijo coalho', 'Mel', 'Queijo cheddar', 'Cebola caramelizada', 'Maionese da casa'],
      // o mel vem dentro da arte do coalho e do abacaxi: tirar o mel não muda a pilha
      camadas: ['maionese', 'carne', 'coalho', 'cheddar', 'cebola'], tiraCamada: { 'Queijo coalho': 'coalho', 'Queijo cheddar': 'cheddar', 'Cebola caramelizada': 'cebola', 'Maionese da casa': 'maionese' } },
    // Praiêro e Amostradinho (01/10): descrição e preço da Brenda; "tira" confirmado pela loja (02/10)
    { id: 'praiero', nome: 'Praiêro', preco: 26, emoji: '🍍', foto: 'img/praiero.webp', fotoAlta: 'img/praiero-alta.webp', boi: 'img/boi-praiero.webp', escolhas: [PONTO],
      desc: 'Pão brioche, blend de fraldinha (150g), abacaxi grelhado com mel, queijo muçarela e maionese da casa.',
      tira: ['Abacaxi', 'Mel', 'Queijo muçarela', 'Maionese da casa'],
      camadas: ['maionese', 'carne', 'mucarela', 'abacaxi'], tiraCamada: { 'Abacaxi': 'abacaxi', 'Queijo muçarela': 'mucarela', 'Maionese da casa': 'maionese' } },
    { id: 'amostradinho', nome: 'Amostradinho', preco: 27, emoji: '😎', foto: 'img/amostradinho.webp', fotoAlta: 'img/amostradinho-alta.webp', boi: 'img/boi-amostradinho.webp', escolhas: [PONTO],
      desc: 'Pão brioche amanteigado, blend de fraldinha (150g), maionese da casa, queijo cheddar e geleia de bacon.',
      tira: ['Maionese da casa', 'Queijo cheddar', 'Geleia de bacon'],
      pao: 'amanteigado', camadas: ['maionese', 'carne', 'cheddar', 'geleia'], tiraCamada: { 'Maionese da casa': 'maionese', 'Queijo cheddar': 'cheddar', 'Geleia de bacon': 'geleia' } },
    { id: 'bruto', nome: 'Bruto', preco: 35, emoji: '🥓', foto: 'img/bruto.webp', fotoAlta: 'img/bruto-alta.webp', boi: 'img/boi-bruto.webp', escolhas: [PONTO],
      desc: 'Pão brioche, dois blends de fraldinha (150g cada), queijo cheddar, bacon, cebola caramelizada e maionese da casa.',
      tira: ['Queijo cheddar', 'Bacon', 'Cebola caramelizada', 'Maionese da casa'],
      camadas: ['maionese', 'carne', 'cheddar', 'carne', 'bacon', 'cebola'], tiraCamada: { 'Queijo cheddar': 'cheddar', 'Bacon': 'bacon', 'Cebola caramelizada': 'cebola', 'Maionese da casa': 'maionese' } },
    // carne crua pra fazer em casa: só no balcão, pra contar a saída de carne nos Números (Nicolas, 25/10)
    { id: 'carne-crua', tipo: 'carne', soBalcao: true, nome: 'Carne crua (blend 150g)', preco: 7.5, emoji: '🥩', desc: 'Blend de fraldinha cru, pra fazer em casa.', escolhas: [], tira: [] },
    // bebidas (cardápio da Brenda, 01/10): vão direto pra sacola, sem diálogo
    { id: 'guarana', tipo: 'bebida', nome: 'Guaraná Antarctica', preco: 6, foto: 'img/bebida-guarana.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca', tipo: 'bebida', nome: 'Coca-Cola', preco: 6, foto: 'img/bebida-coca.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'fanta', tipo: 'bebida', nome: 'Fanta Laranja', preco: 6, foto: 'img/bebida-fanta.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca-zero', tipo: 'bebida', nome: 'Coca-Cola Zero', preco: 6, foto: 'img/bebida-coca-zero.webp', desc: 'Lata 350 ml', escolhas: [], tira: [] },
    { id: 'coca-zero-ks', tipo: 'bebida', nome: 'Coca-Cola Zero KS', preco: 6, foto: 'img/bebida-coca-zero-ks.webp', desc: 'Garrafa de vidro 290 ml', escolhas: [], tira: [] },
    { id: 'coca-1l', tipo: 'bebida', nome: 'Coca-Cola 1 L', preco: 10, foto: 'img/bebida-coca-1l.webp', desc: 'Garrafa de vidro 1 litro', escolhas: [], tira: [] },
    { id: 'coca-1l-pet', tipo: 'bebida', nome: 'Coca-Cola 1 L Pet', preco: 12, foto: 'img/bebida-coca-1l-pet.webp', desc: 'Garrafa plástica 1 litro', escolhas: [], tira: [] },
    { id: 'coca-zero-1l', tipo: 'bebida', nome: 'Coca-Cola Zero 1 L', preco: 12, foto: 'img/bebida-coca-zero-1l.webp', desc: 'Garrafa plástica 1 litro', escolhas: [], tira: [] },
    { id: 'limoneto', tipo: 'bebida', nome: 'H2OH! Limoneto', preco: 7, foto: 'img/bebida-limoneto.webp', desc: 'Garrafa 500 ml', escolhas: [], tira: [] },
    { id: 'monster', tipo: 'bebida', nome: 'Monster Energy', preco: 12, foto: 'img/bebida-monster.webp', desc: 'Lata 473 ml', escolhas: [], tira: [] }, // Nicolas, 15/10
    { id: 'agua', tipo: 'bebida', nome: 'Água mineral', preco: 2, foto: 'img/bebida-agua.webp', desc: 'Garrafa 500 ml', escolhas: [], tira: [] },
    { id: 'agua-gas', tipo: 'bebida', nome: 'Água com gás', preco: 4, foto: 'img/bebida-agua-gas.webp', desc: 'Garrafa 500 ml', escolhas: [], tira: [] }, // Nicolas, 15/10; preço 16/10
  ],
};
