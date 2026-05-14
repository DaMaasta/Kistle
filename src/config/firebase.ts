import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase Konfiguration
// Erstelle ein Projekt unter https://console.firebase.google.com
// und ersetze diese Werte mit deinen eigenen Projekt-Daten.
const firebaseConfig = {
  apiKey: 'AIzaSyBzLGHj05Vvhzm5xvHxiV8rlRp7my5_M-w',
  authDomain: 'lagerapp-61b48.firebaseapp.com',
  projectId: 'lagerapp-61b48',
  storageBucket: 'lagerapp-61b48.firebasestorage.app',
  messagingSenderId: '741879030804',
  appId: '1:741879030804:web:eab6e9caeb722ff4a2b301',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
