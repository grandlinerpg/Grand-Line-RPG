import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";



// ======================
// FIREBASE CONFIG
// ======================

const firebaseConfig = {

  apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",

  authDomain:
  "grand-line-rpg-dcda9.firebaseapp.com",

  projectId:
  "grand-line-rpg-dcda9",

  storageBucket:
  "grand-line-rpg-dcda9.appspot.com",

  messagingSenderId:
  "172042779786",

  appId:
  "1:172042779786:web:ecdff9eaf4fee36eca8173",

  measurementId:
  "G-1H48YJSFXQ",

  databaseURL:
  "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};



// ======================
// INIT
// ======================

const app =
initializeApp(firebaseConfig);


const auth =
getAuth(app);


const db =
getDatabase(app);



// ======================
// CARREGAR FACÇÃO
// ======================

async function startAuth(){


  await setPersistence(
    auth,
    browserLocalPersistence
  );



  onAuthStateChanged(auth,(user)=>{


    if(!user){

      window.location.replace("auth.html");

      return;

    }



    const uid =
    user.uid;



    // ======================
    // BUSCA PLAYER LOGADO
    // ======================

    onValue(
      ref(db,`players/${uid}`),
      (playerSnap)=>{


        if(!playerSnap.exists()){

          console.log("Player não encontrado");

          return;

        }



        const player =
        playerSnap.val();



        const faction =
        player.character?.faction;



        console.log(
          "Facção atual:",
          faction
        );



        if(!faction){

          console.log(
            "Jogador sem facção"
          );

          return;

        }



        // ======================
        // BUSCA DADOS DA FACÇÃO
        // ======================

        onValue(
          ref(db,`faccoes/${faction}`),
          (factionSnap)=>{


            if(!factionSnap.exists()){

              console.log(
                "Facção não encontrada"
              );

              return;

            }



            const data =
            factionSnap.val();



            // NOME

            document.getElementById(
              "faction-name"
            ).innerText =
            data.nome || faction;



            // IMAGEM

            document.getElementById(
              "faction-img"
            ).src =
            data.imagem ||
            "https://res.cloudinary.com/djh45admn/image/upload/v1778661201/sem-personagem.png";



            // ARMAZÉM

            document.getElementById(
              "warehouse"
            ).innerText =
            (data.armazem || 0)
            .toLocaleString("pt-BR");



            // FORÇA

            document.getElementById(
              "power"
            ).innerText =
            (data.forca || 0)
            .toLocaleString("pt-BR");



          });


        // ======================
        // BUSCA MEMBROS
        // ======================

        onValue(
          ref(db,"players"),
          (playersSnap)=>{


            const box =
            document.getElementById(
              "members-list"
            );


            box.innerHTML = "";



            playersSnap.forEach((player)=>{


              const data =
              player.val();



              const playerFaction =
              data.character?.faction;



              if(playerFaction === faction){


                const div =
                document.createElement("div");



                div.innerHTML =
                `
                👤 ${data.nome || "Sem nome"}
                `;



                box.appendChild(div);


              }


            });



            if(box.innerHTML === ""){

              box.innerHTML =
              "Sem membros";

            }


          });


      });


  });


}



// ======================
// START
// ======================

startAuth();
