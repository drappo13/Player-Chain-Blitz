import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgg5sd6bAQAMo2ENtdZJV-lP6ytduPbj4",
  authDomain: "drapk-in.firebaseapp.com",
  projectId: "drapk-in",
  storageBucket: "drapk-in.firebasestorage.app",
  messagingSenderId: "262094095705",
  appId: "1:262094095705:web:086cc2a3af9e0cd64c7848",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
