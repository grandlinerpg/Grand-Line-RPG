// =========================
// FIREBASE
// =========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// =========================
// CONFIG FIREBASE
// =========================

const firebaseConfig = {

    apiKey: "AIzaSyC4kgy_L79WYFqr9XZhoDuZBfqG4AGTVUQ",
    authDomain: "grand-line-rpg-dcda9.firebaseapp.com",
    projectId: "grand-line-rpg-dcda9",
    storageBucket: "grand-line-rpg-dcda9.appspot.com",
    messagingSenderId: "172042779786",
    appId: "1:172042779786:web:ecdff9eaf4fee36eca8173",
    measurementId: "G-1H48YJSFXQ",
    databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"

};


const app = initializeApp(firebaseConfig);

const db = getDatabase(app);


// =========================
// VARIÁVEIS
// =========================

let perguntas = [];

let perguntaAtual = 0;

let pontos = 0;

let bloqueado = false;


// =========================
// CARREGAR QUIZ
// =========================

async function carregarQuiz(){

    try{

        const caminhos = [

            "quiz/facil",
            "quiz/medio",
            "quiz/dificil"

        ];


        for(let caminho of caminhos){


            const snapshot = await get(
                ref(db,caminho)
            );


            if(snapshot.exists()){


                const dados = snapshot.val();


                Object.values(dados).forEach(pergunta=>{


                    perguntas.push(pergunta);


                });


            }


        }


        console.log(
            "Perguntas carregadas:",
            perguntas
        );


        iniciarQuiz();


    }catch(error){

        console.error(
            "Erro ao carregar quiz:",
            error
        );

    }

}


// =========================
// INICIAR QUIZ
// =========================

function iniciarQuiz(){


    if(perguntas.length === 0){

        console.log(
            "Nenhuma pergunta encontrada"
        );

        return;

    }


    perguntas.sort(
        ()=> Math.random() - 0.5
    );


    // somente 10 perguntas

    perguntas = perguntas.slice(0,10);


    document.getElementById(
        "total-questions"
    ).textContent = perguntas.length;


    adicionarEventos();


    mostrarPergunta();


}


// =========================
// MOSTRAR PERGUNTA
// =========================

function mostrarPergunta(){


    const pergunta = perguntas[perguntaAtual];


    document.getElementById(
        "question-text"
    ).textContent = pergunta.pergunta;



    const respostas = document.querySelectorAll(
        ".answer"
    );


    respostas[0].textContent =
        "A) " + pergunta.a;


    respostas[1].textContent =
        "B) " + pergunta.b;


    respostas[2].textContent =
        "C) " + pergunta.c;


    respostas[3].textContent =
        "D) " + pergunta.d;



    respostas.forEach(botao=>{


        botao.classList.remove(
            "correct",
            "wrong"
        );


        botao.disabled = false;


    });



    document.getElementById(
        "current-question"
    ).textContent = perguntaAtual + 1;



}


// =========================
// EVENTOS DOS BOTÕES
// =========================

function adicionarEventos(){


    const botoes = document.querySelectorAll(
        ".answer"
    );


    botoes.forEach((botao,index)=>{


        botao.addEventListener(
            "click",
            ()=>{

                verificarResposta(
                    botao,
                    index
                );

            }
        );


    });


}


// =========================
// VERIFICAR RESPOSTA
// =========================

function verificarResposta(
    botao,
    index
){


    if(bloqueado) return;


    bloqueado = true;


    const pergunta = perguntas[perguntaAtual];


    const letras = [
        "a",
        "b",
        "c",
        "d"
    ];


    const resposta =
        letras[index];



    const botoes = document.querySelectorAll(
        ".answer"
    );



    if(resposta === pergunta.correta){


        botao.classList.add(
            "correct"
        );


        pontos++;


    }else{


        botao.classList.add(
            "wrong"
        );


        const correta =
            letras.indexOf(
                pergunta.correta
            );


        botoes[correta].classList.add(
            "correct"
        );


    }



    setTimeout(()=>{


        perguntaAtual++;


        if(
            perguntaAtual < perguntas.length
        ){


            mostrarPergunta();


        }else{


            finalizarQuiz();


        }


        bloqueado = false;


    },1000);



}


// =========================
// FINAL
// =========================

function finalizarQuiz(){


    document.querySelector(
        ".quiz-box"
    ).innerHTML = `


        <h2 class="title-center">
            QUIZ FINALIZADO
        </h2>


        <p style="
        text-align:center;
        color:#f6d365;
        font-family:'Cinzel';
        font-size:20px;
        ">

        Você acertou
        ${pontos}
        de
        ${perguntas.length}

        </p>


    `;


}


// =========================
// START
// =========================

carregarQuiz();
