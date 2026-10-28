<div align="center">

# 🍔 La Carne Burger · Pede Direto

**Pedido direto pro WhatsApp da hamburgueria, sem app de delivery no meio e sem comissão.**

O cliente monta o pedido no site e manda pro WhatsApp da loja. A loja recebe, imprime a comanda e acompanha os números num painel.

![JavaScript](https://img.shields.io/badge/HTML_·_CSS_·_JS_puro-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firestore_·_Auth_·_App_Check-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Testes](https://img.shields.io/badge/testes-unidade_·_regras_·_e2e-3ddc97?style=flat-square)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Em produção](https://img.shields.io/badge/status-em_produção-16a34a?style=flat-square)

</div>

---

## O que faz

**Pro cliente (site)**
- Cardápio com montagem de burger um por vez, adicionais "em cada" e sacola com `+` pra repetir.
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

## Como foi pensado

- **Sem framework.** HTML, CSS e JS puro, módulos ES. O `esbuild` só empacota as bibliotecas de terceiros em `vendor/`.
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

<div align="center"><sub>Feito por <a href="https://github.com/pedrolucas201">Pedro Gomes</a> · da chapa pro WhatsApp, sem taxa de app no meio.</sub></div>
