import { initializeApp, getFirestore, connectFirestoreEmulator, initializeAppCheck, ReCaptchaEnterpriseProvider } from './vendor/firebase/base.js';

// Config do app web (preenchida na Task 13). Não é segredo: quem protege são as regras e o App Check.
const CONFIG = { apiKey: 'AIzaSyCXB5TxyhhAZUM6O5JbQwmh-_MBzrxUhvE', projectId: 'pede-direto-app', appId: '1:413453137627:web:4420b6f646e6841d43fefe', messagingSenderId: '413453137627' };
const RECAPTCHA = '6LcelNgtAAAAAId66pZ62ryihSVlKg6vpOP8N-Q2'; // chave de site do reCAPTCHA (Fraud Defense) do App Check; vazio = sem App Check
export const LOJA_ID = 'lacarne';
export const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// local = emuladores com projeto demo: nada toca o banco real.
// authDomain = o próprio domínio (o Hosting serve /__/auth), evita problema de cookie de terceiros no login
export const app = initializeApp(LOCAL ? { projectId: 'demo-lacarne', apiKey: 'demo' } : { ...CONFIG, authDomain: location.host });
if (!LOCAL && RECAPTCHA) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA), isTokenAutoRefreshEnabled: true });
export const db = getFirestore(app);
if (LOCAL) connectFirestoreEmulator(db, '127.0.0.1', 8080);
