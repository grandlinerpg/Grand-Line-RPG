import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const db = getDatabase();


window.verificarPermissao = async function(nivelNecessario){

    const user = JSON.parse(
        localStorage.getItem("usuario")
    );


    if(!user){
        return false;
    }


    const snap = await get(
        ref(db,"usuarios/"+user.uid+"/cargo")
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
