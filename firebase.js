

const firebaseConfig = {
  // ※ ここは先ほど直したご自身の本物のAPIキーを入れてください
  apiKey: "AIzaSyDt2LBQ7W_k2XGOYw273AozZ2-sY2i4z6k", 
  authDomain: "fukashigi-1.firebaseapp.com",
  projectId: "fukashigi-1",
  storageBucket: "fukashigi-1.firebasestorage.app",
  messagingSenderId: "130242994746",
  appId: "1:130242994746:web:0dd04ccf2f0c74dbeb8b03",
  measurementId: "G-7S8QM44H4Q"
};

// Firebaseの初期化（Compat版の書き方）
firebase.initializeApp(firebaseConfig);

// index.html の 79行目と81行目で auth と db をそのまま使えるようにする魔法
window.auth = firebase.auth();
window.db = firebase.firestore();
