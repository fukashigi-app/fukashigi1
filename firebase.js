// あなたのFUKASHIGIプロジェクト専用の設定値
const firebaseConfig = {
  apiKey: "AIzaSyDt2LBQ7W_k2XGOYw273AozZ2-sY2i4z6k",
  authDomain: "fukashigi-1.firebaseapp.com",
  projectId: "fukashigi-1",
  storageBucket: "fukashigi-1.firebasestorage.app",
  messagingSenderId: "130242994746",
  appId: "1:130242994746:web:0dd04ccf2f0c74dbeb8b03"
};

// Firebaseの初期化（Compat版の書き方）
firebase.initializeApp(firebaseConfig);

// 認証(Auth)とデータベース(Firestore)を使えるように変数に入れる
const auth = firebase.auth();
const db = firebase.firestore();
