import {
    getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";



const app = getApp();

const auth = getAuth(app);

const db = getDatabase(app);



let nivelAdminAtual = 0;



export async function carregarPermissao(){


    return new Promise((resolve)=>{


        onAuthStateChanged(auth, async(user)=>{


            if(!user){

                nivelAdminAtual = 0;

                resolve(0);

                return;

            }



            const snap =
            await get(
                ref(db,"usuarios/"+user.uid)
            );



            if(!snap.exists()){

                nivelAdminAtual = 0;

                resolve(0);

                return;

            }



            const dados =
            snap.val();



            nivelAdminAtual =
            Number(dados.nivelAdmin || 0);



            resolve(nivelAdminAtual);


        });


    });


}





export function pegarNivelAdmin(){

    return nivelAdminAtual;

}





export async function temPermissao(nivel){


    const atual =
    await carregarPermissao();


    return atual >= Number(nivel);


}





export async function aplicarPermissoes(){


    const nivel =
    await carregarPermissao();



    document
    .querySelectorAll("[data-nivel]")
    .forEach(botao=>{


        const necessario =
        Number(botao.dataset.nivel);



        if(nivel >= necessario){

            botao.style.display = "";


        }else{

            botao.style.display = "none";

        }


    });


}
