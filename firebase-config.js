// Firebase web app settings (not secrets: your data is protected by sign-in + firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyDEz2bi1-0LATbJEF7rnd5SZU4NSWT_s_8",
  authDomain: "rfid-lead-tracker.firebaseapp.com",
  projectId: "rfid-lead-tracker",
  storageBucket: "rfid-lead-tracker.firebasestorage.app",
  messagingSenderId: "372873870565",
  appId: "1:372873870565:web:07a779d6a4a5c9228da80c",
};

// The first administrator. Whoever signs in with this (verified) email becomes admin automatically.
// Must match the email written in firestore.rules.
export const ADMIN_EMAIL = "lenovo38756@gmail.com";
