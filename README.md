# La Carne Burger · Pede Direto

Site de pedidos (cliente monta o pedido, vai pro WhatsApp da loja) + painel da loja em `/painel`.
HTML/CSS/JS puro, Firebase (Hosting, Firestore, Auth, App Check).

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

## Testes

```bash
npm test             # lógica (horário, pedido, números)
npm run test:regras  # regras do Firestore no emulador (Java 21)
npm run e2e          # site -> painel -> números no emulador (Chrome)
```

Desenvolvimento local: `npm run dev` e, em outro terminal, `npm run seed:local`.
Cardápio, taxas e horário: `scripts/lojas/lacarne.mjs` + `node scripts/seed.mjs` (ver o cabeçalho do script).
