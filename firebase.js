// FIREBASE

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// CONFIG

const firebaseConfig = {
  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.firebasestorage.app",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  measurementId: "G-1H48YJSFXQ"
};

// INICIAR FIREBASE

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

// REGISTRAR

window.register = async function(){

  const email =
    document.getElementById("register-email").value;

  const senha =
    document.getElementById("register-password").value;

  try{

    await createUserWithEmailAndPassword(
      auth,
      email,
      senha
    );

    alert("Conta criada com sucesso!");

    showLogin();

  }catch(error){

    alert(error.message);

  }

}

// LOGIN

window.login = async function(){

  const email =
    document.getElementById("login-email").value;

  const senha =
    document.getElementById("login-password").value;

  try{

    await signInWithEmailAndPassword(
      auth,
      email,
      senha
    );

    alert("Login realizado!");

    window.location.href = "index.html";

  }catch(error){

    alert(error.message);

  }

}
