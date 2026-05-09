const firebaseConfig = {
  apiKey: "AIzaSyDt2LBQ7W_k2XGOYw273AozZ2-sY2i4z6k",
  authDomain: "fukashigi-1.firebaseapp.com",
  projectId: "fukashigi-1",
  storageBucket: "fukashigi-1.firebasestorage.app",
  messagingSenderId: "130242994746",
  appId: "1:130242994746:web:0dd04ccf2f0c74dbeb8b03",
  measurementId: "G-7S8QM44H4Q"
};

// Firebaseの初期化
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// グローバル変数にセット
window.auth = firebase.auth();
window.db = firebase.firestore();
