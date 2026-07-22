import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const firebaseConfig = {

  apiKey: "AIzaSyC4kgy_L79WYFQR9XZhoDuZBfqG4AGTVUQ",
  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
  projectId: "grand-line-rpg-dcda9",
  storageBucket: "grand-line-rpg-dcda9.appspot.com",
  messagingSenderId: "172042779786",
  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);


const homeLink = document.getElementById("home-link");


console.log("GUIA AUTH CARREGOU");


async function iniciarAuth(){

  await setPersistence(
    auth,
    browserLocalPersistence
  );


  onAuthStateChanged(auth,(user)=>{

    console.log("GUIA LOGIN:", user);


    if(!homeLink) return;


    if(user){

      homeLink.innerHTML = "PERFIL";
      homeLink.href = "perfil.html";

    }else{

      homeLink.innerHTML = "INÍCIO";
      homeLink.href = "index.html";

    }

  });

}


iniciarAuth();
