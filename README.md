<div align="center">

# 🍔 Pede Direto

**Pedido direto pro WhatsApp do restaurante, sem app de delivery no meio e sem comissão.**

O cliente monta o pedido no site e manda pro WhatsApp da loja. A loja recebe, imprime a comanda e acompanha os números num painel.

![JavaScript](https://img.shields.io/badge/HTML_·_CSS_·_JS_puro-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firestore_·_Auth_·_App_Check-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Testes](https://img.shields.io/badge/testes-unidade_·_regras_·_e2e-3ddc97?style=flat-square)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![White label](https://img.shields.io/badge/white_label-multi--loja-7c3aed?style=flat-square)
![Em produção](https://img.shields.io/badge/em_produção-La_Carne_Burger-16a34a?style=flat-square)

</div>

---

## White label

Cada restaurante é uma loja: um arquivo em `lojas/` (cardápio, taxas por bairro, horário, WhatsApp e chave Pix) e um documento próprio no Firestore, com admins, pedidos, clientes e avaliações separados. A primeira loja em produção é a **La Carne Burger**.

## O que faz

**Pro cliente (site)**
- Cardápio com montagem de item um por vez, adicionais "em cada" e sacola com `+` pra repetir.
- Selo de aberto/fechado no fuso da loja, com a próxima abertura; fora do horário, o envio fica bloqueado.
- Pix **copia e cola** gerado na hora (BR Code estático no padrão do Banco Central).
- O pedido sai formatado pro WhatsApp da loja; CEP preenchido pelo ViaCEP.

**Pra loja (`/painel`)**
- Pedidos em colunas (novo, preparo, saiu, entregue), com aviso quando chega pedido novo.
- Botões do dia: marcar item esgotado e fechar a loja mais cedo, refletido no site ao vivo.
- **Comanda** pronta pra impressora térmica (58/80 mm) ou PDF, com QR code da avaliação.
- **Avaliação** por convite: só quem fez o pedido avalia, uma vez. Nota baixa pergunta o que deu errado; nota alta, o que agradou.
- **Números** por período, com variação contra o anterior: faturamento, ticket médio, mais vendidos, formas de pagamento, bairros, dias da semana e melhores clientes. Exporta CSV.
- **Registro** de cada ação da loja (quem e quando), gravado junto com a mudança e impossível de editar ou apagar.

## Por que sem framework

Foi escolha, não falta de opção. O cliente chega pelo link no WhatsApp, no celular e muitas vezes com internet ruim: o site precisa abrir rápido e o pedido não pode travar.

- **Peso:** todo o código próprio do site (HTML, CSS e JS) dá uns **33 KB comprimido**. O grosso do download é o SDK do Firebase, que estaria lá com ou sem framework. React, Vue ou Next só somariam bundle, build e dependência.
- **Manutenção:** produto de loja pequena precisa durar anos com pouca mão. Módulos ES nativos, sem etapa de build no código da loja; o `esbuild` só empacota as bibliotecas de terceiros em `vendor/`.
- **O que segura a qualidade não é o framework:** é regra pura e testada, regras do banco testadas no emulador, teste de ponta a ponta e CI obrigatório.

Quando o produto pedir (estado complexo no painel, várias pessoas mexendo no front), migrar o painel pra um framework é um passo pequeno, porque a regra de negócio já está fora do DOM.

## Como foi pensado

- **A regra mora num lugar só.** `pedido.js`, `horario.js`, `numeros.js` e `avaliacao.js` são puros (sem DOM, sem Firebase) e rodam igual no site, no painel e nos testes.
- **O banco não confia no navegador.** O `firestore.rules` valida o formato do pedido, quem pode ler o quê, convite de avaliação de uso único e o registro de auditoria amarrado a cada alteração. As etiquetas de avaliação existem nas regras e no código, e um teste garante que as duas listas batem.
- **Deploy que se recusa a fazer besteira.** `npm run deploy` só publica a partir do `main` limpo, com tag publicada e testes verdes.

## Testes

```bash
npm test             # lógica: horário, pedido, cardápio, números, avaliação, comanda
npm run test:regras  # 65 testes das regras do Firestore no emulador (Java 21)
npm run e2e          # site -> painel -> números de ponta a ponta no emulador (Chrome)
```

O CI (GitHub Actions) roda os três a cada Pull Request, e o `main` só aceita merge com tudo verde.

## Fluxo de trabalho

- `main` = produção. Não se commita direto nele: o branch é protegido e só aceita Pull Request com o CI verde.
- Um branch por trabalho: `feat/...` (novidade), `fix/...` (correção), `hotfix/...` (urgente em produção), `chore/...` (manutenção).
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `chore:`...).
- Versão = tag anotada no `main`, semver: `feat` sobe o minor, `fix`/`chore` sobe o patch.

## Publicar uma versão

```bash
git checkout main && git pull
git tag -a v0.3.0 -m "v0.3.0 - resumo"
git push origin v0.3.0
npm run deploy   # recusa se não for main limpo, igual ao GitHub, com tag publicada e testes verdes
```

## Desenvolvimento local

```bash
npm install
npm run dev          # emuladores: Firestore, Auth e Hosting
npm run seed:local   # em outro terminal: loja, cardápio e um admin de teste
```

Cardápio, taxas e horário: `lojas/lacarne.mjs` (o site também lê esse arquivo pra mostrar o cardápio na hora; mudou? seed **e** deploy) + `node scripts/seed.mjs` (ver o cabeçalho do script).

---

<div align="center"><sub>Feito por <a href="https://github.com/pedrolucas201">Pedro Gomes</a> · do cardápio pro WhatsApp, sem taxa de app no meio.</sub></div>
