import { initializeApp, getFirestore, connectFirestoreEmulator, initializeAppCheck, ReCaptchaV3Provider } from './vendor/firebase/base.js';

// Config do app web (preenchida na Task 13). Não é segredo: quem protege são as regras e o App Check.
const CONFIG = null;
const RECAPTCHA = ''; // chave de site reCAPTCHA v3 do App Check (Task 13); vazio = sem App Check
export const LOJA_ID = 'lacarne';
export const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// local = emuladores com projeto demo: nada toca o banco real.
// authDomain = o próprio domínio (o Hosting serve /__/auth), evita problema de cookie de terceiros no login
export const app = initializeApp(LOCAL ? { projectId: 'demo-lacarne', apiKey: 'demo' } : { ...CONFIG, authDomain: location.host });
if (!LOCAL && RECAPTCHA) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(RECAPTCHA), isTokenAutoRefreshEnabled: true });
export const db = getFirestore(app);
if (LOCAL) connectFirestoreEmulator(db, '127.0.0.1', 8080);
