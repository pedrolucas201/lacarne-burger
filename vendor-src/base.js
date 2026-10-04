export { initializeApp } from 'firebase/app';
export { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';
export {
  getFirestore, connectFirestoreEmulator, doc, collection, query, where, orderBy, onSnapshot,
  getDoc, getDocs, setDoc, updateDoc, runTransaction, serverTimestamp, increment, Timestamp,
  writeBatch, getAggregateFromServer, count, average,
} from 'firebase/firestore';
