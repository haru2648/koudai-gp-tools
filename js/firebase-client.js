/**
 * Firebaseの初期化とエクスポート
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-functions.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction, collection, addDoc, deleteDoc, updateDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3ZZ_T7OGkJ4z2gA9wOjJCGRIwFCewbzQ",
    authDomain: "koudaisai-gp-2025.firebaseapp.com",
    projectId: "koudaisai-gp-2025",
    storageBucket: "koudaisai-gp-2025.firebasestorage.app",
    messagingSenderId: "821603922081",
    appId: "1:821603922081:web:3697ea3356f6bcf689c0e0"
};

// Firebaseアプリの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-northeast1');
const firestore = getFirestore(app);

// 必要な関数をまとめてエクスポート
export {
    auth,
    functions,
    firestore,
    httpsCallable,
    signInWithCustomToken,
    onAuthStateChanged,
    signInAnonymously,
    doc,
    getDoc,
    setDoc,
    runTransaction,
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    getDocs,
    query,
    where
};
