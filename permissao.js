import {
    initializeApp,
    getApp,
    getApps
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

    apiKey:"AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",

    authDomain:"grand-line-rpg-dcda9.firebaseapp.com",

    projectId:"grand-line-rpg-dcda9",

    storageBucket:"grand-line-rpg-dcda9.appspot.com",

    messagingSenderId:"172042779786",

    appId:"1:172042779786:web:ecdff9eaf4fee36eca8173",

    measurementId: "G-1H48YJSFXQ",

    databaseURL:"https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};



const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


const db = getDatabase(app);


const auth = getAuth(app);



console.log("PERMISSAO.JS CARREGADO");



let usuarioAtual = null;



onAuthStateChanged(auth,(user)=>{


    usuarioAtual = user;


    console.log(
        "AUTH ALTERADO:",
        user
    );


    if(user){

        console.log(
            "UID:",
            user.uid
        );

    }else{

        console.log(
            "NENHUM USUARIO LOGADO"
        );

    }


});





window.verificarPermissao = async function(nivelNecessario){


    console.log(
        "VERIFICANDO PERMISSÃO:",
        nivelNecessario
    );



    if(!usuarioAtual){


        console.log(
            "ERRO: usuarioAtual vazio"
        );


        return false;

    }



    const uid =
    usuarioAtual.uid;



    console.log(
        "UID USADO:",
        uid
    );



    const caminho =
    "players/"+uid+"/cargo";



    console.log(
        "BUSCANDO FIREBASE:",
        caminho
    );



    try{


        const snap =
        await get(
            ref(db,caminho)
        );



        console.log(
            "SNAP EXISTE:",
            snap.exists()
        );


        console.log(
            "VALOR CARGO:",
            snap.val()
        );



        if(!snap.exists()){


            console.log(
                "CARGO NÃO ENCONTRADO"
            );


            return false;

        }



        const cargo =
        snap.val();



        const niveis = {


            jogador:0,

            moderador:1,

            admin:2,

            dono:3


        };



        const nivelUsuario =
        niveis[cargo] ?? 0;



        console.log(
            "CARGO:",
            cargo
        );


        console.log(
            "NIVEL USUARIO:",
            nivelUsuario
        );


        console.log(
            "NIVEL NECESSARIO:",
            nivelNecessario
        );



        const permitido =
        nivelUsuario >= nivelNecessario;



        console.log(
            "PERMITIDO:",
            permitido
        );



        return permitido;



    }catch(err){


        console.error(
            "ERRO PERMISSÃO:",
            err
        );


        return false;

    }


};
