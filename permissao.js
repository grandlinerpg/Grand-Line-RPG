import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const firebaseConfig = {

apiKey:"AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",

authDomain:"grand-line-rpg-dcda9.firebaseapp.com",

projectId:"grand-line-rpg-dcda9",

storageBucket:"grand-line-rpg-dcda9.appspot.com",

messagingSenderId:"172042779786",

appId:"1:172042779786:web:ecdff9eaf4fee36eca8173",

databaseURL:"https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};


const app = initializeApp(firebaseConfig);

const db = getDatabase(app);


window.verificarPermissao = async function(nivelNecessario){

    const user = JSON.parse(
        localStorage.getItem("usuario")
    );


    if(!user){
        return false;
    }


    const snap = await get(
        ref(db,"players/"+user.uid+"/cargo")
    );


    if(!snap.exists()){
        return false;
    }


    const cargo = snap.val();


    const niveis = {

        jogador:0,
        moderador:1,
        admin:2,
        dono:3

    };


    return niveis[cargo] >= nivelNecessario;

}
