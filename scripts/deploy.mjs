// Publica no Firebase só versão marcada e testada.
// Trava se: fora do main, mudança não commitada, main diferente do GitHub, commit sem tag vX.Y.Z publicada, teste falhando.
import { execSync } from 'node:child_process';

const sh = c => execSync(c, { encoding: 'utf8' }).trim();
const falha = m => { console.error(`\ndeploy recusado: ${m}\n`); process.exit(1); };

if (sh('git branch --show-current') !== 'main') falha('não está no main');
if (sh('git status --porcelain')) falha('tem mudança não commitada');
sh('git fetch -q origin main --tags');
if (sh('git rev-parse HEAD') !== sh('git rev-parse origin/main')) falha('main local diferente do GitHub (faltou push ou pull)');
const tag = sh('git tag --points-at HEAD').split('\n').find(t => /^v\d+\.\d+\.\d+$/.test(t));
if (!tag) falha('commit sem tag de versão (git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z)');
if (!sh(`git ls-remote --tags origin refs/tags/${tag}`)) falha(`tag ${tag} não está no GitHub (git push origin ${tag})`);

try { execSync('npm test && npm run test:regras && npm run e2e', { stdio: 'inherit' }); }
catch { falha('teste falhando'); }

execSync(`npx firebase deploy --only hosting,firestore:rules -m "${tag}"`, { stdio: 'inherit' });
console.log(`\n${tag} no ar\n`);
