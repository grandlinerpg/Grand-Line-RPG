import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



const firebaseConfig = {

    apiKey:"AIzaC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",

    authDomain:"grand-line-rpg-dcda9.firebaseapp.com",

    projectId:"grand-line-rpg-dcda9",

    storageBucket:"grand-line-rpg-dcda9.appspot.com",

    messagingSenderId:"172042779786",

    appId:"1:172042779786:web:ecdff9eaf4fee36eca8173",

    databaseURL:"https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};



const app = initializeApp(firebaseConfig);


const db = getDatabase(app);


const auth = getAuth(app);



let usuarioAtual = null;



onAuthStateChanged(auth,(user)=>{

    usuarioAtual = user;

});





window.verificarPermissao = async function(nivelNecessario){


    if(!usuarioAtual){

        return false;

    }



    const uid =
    usuarioAtual.uid;



    const caminho =
    "players/"+uid+"/cargo";



    try{


        const snap =
        await get(
            ref(db,caminho)
        );



        if(!snap.exists()){

            return false;

        }



        const cargo =
        snap.val();



        const niveis = {


            jogador:0,

            moderador:1,

            gm: 2,

            admin:3,

            dono:4


        };



        const nivelUsuario =
        niveis[cargo] ?? 0;



        return nivelUsuario >= nivelNecessario;



    }catch(err){


        return false;

    }


};
