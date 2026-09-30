// Grava a configuração da loja no banco. Os botões do painel (fechadaHoje, abertaHoje, esgotados) nunca são tocados.
// Local (emulador): node scripts/seed.mjs --local --admin dono@teste.com
// Produção:         $env:GOOGLE_APPLICATION_CREDENTIALS = '<caminho>\segredos\firebase-admin.json'
//                   node scripts/seed.mjs --admin email1 --admin email2
// E-mails de admin vão por argumento, nunca no repositório (é público).
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { LOJA_ID, LOJA } from './lojas/lacarne.mjs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const admins = args.flatMap((a, i) => a === '--admin' ? [args[i + 1].toLowerCase()] : []);
if (local) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const projectId = local ? 'demo-lacarne' : JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default;

initializeApp({ projectId });
const ref = getFirestore().doc(`lojas/${LOJA_ID}`);
// mergeFields: substitui cada campo inteiro (bairro removido da tabela some de verdade) sem apagar os botões
await ref.set(LOJA, { mergeFields: Object.keys(LOJA) });
for (const email of admins) await ref.collection('admins').doc(email).set({});
console.log(`loja ${LOJA_ID} gravada em ${projectId}; admins novos: ${admins.join(', ') || 'nenhum'}`);
