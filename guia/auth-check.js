import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



// ======================
// FIREBASE CONFIG
// ======================

const firebaseConfig = {

  apiKey: "AIzaSyC4kgy_L79WYFQR9XZhoDuZBfqG4AGTVUQ",

  authDomain: "grand-line-rpg-dcda9.firebaseapp.com",

  projectId: "grand-line-rpg-dcda9",

  storageBucket: "grand-line-rpg-dcda9.appspot.com",

  messagingSenderId: "172042779786",

  appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",

  databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};



// ======================
// INIT
// ======================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);



console.log("AUTO CHECK CARREGADO");

console.log(
  "CURRENT USER ANTES:",
  auth.currentUser
);



const homeLink =
document.getElementById("home-link");



// ======================
// VERIFICAR LOGIN
// ======================

async function verificarAuth(){


  await setPersistence(
    auth,
    browserLocalPersistence
  );


  console.log(
    "Persistência ativada"
  );



  onAuthStateChanged(
    auth,
    (user)=>{


      console.log(
        "AUTH CHECK:",
        user
      );



      if(!homeLink){

        console.log(
          "home-link não encontrado"
        );

        return;

      }



      if(user){


        homeLink.textContent =
        "PERFIL";


        homeLink.href =
        "perfil.html";


      }else{


        homeLink.textContent =
        "INÍCIO";


        homeLink.href =
        "index.html";


      }


    }

  );


}



// ======================
// START
// ======================

verificarAuth();
