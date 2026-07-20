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

let tempo = 10;

let intervaloTempo;



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
            "Perguntas:",
            perguntas
        );


        iniciarQuiz();



    }catch(error){

        console.error(
            "Erro Firebase:",
            error
        );

    }

}



// =========================
// INICIAR
// =========================

function iniciarQuiz(){


    if(perguntas.length === 0){

        console.log(
            "Sem perguntas"
        );

        return;

    }



    perguntas.sort(
        ()=>Math.random()-0.5
    );


    perguntas = perguntas.slice(0,10);



    document.getElementById(
        "total-questions"
    ).textContent =
    perguntas.length;



    adicionarEventos();


    mostrarPergunta();



}



// =========================
// MOSTRAR QUESTÃO
// =========================

function mostrarPergunta(){


    clearInterval(intervaloTempo);



    const pergunta =
        perguntas[perguntaAtual];



    document.getElementById(
        "question-text"
    ).textContent =
    pergunta.pergunta;



    const botoes =
        document.querySelectorAll(".answer");



    botoes[0].textContent =
        "A) " + pergunta.a;

    botoes[1].textContent =
        "B) " + pergunta.b;

    botoes[2].textContent =
        "C) " + pergunta.c;

    botoes[3].textContent =
        "D) " + pergunta.d;



    botoes.forEach(botao=>{


        botao.classList.remove(
            "correct",
            "wrong"
        );


        botao.disabled = false;


    });



    document.getElementById(
        "current-question"
    ).textContent =
    perguntaAtual + 1;



    iniciarTempo();



}



// =========================
// TEMPO
// =========================

function iniciarTempo(){


    tempo = 10;


    document.getElementById(
        "time"
    ).textContent =
    tempo;



    intervaloTempo =
    setInterval(()=>{


        tempo--;


        document.getElementById(
            "time"
        ).textContent =
        tempo;



        if(tempo <= 0){


            clearInterval(intervaloTempo);


            tempoAcabou();


        }


    },1000);



}



// =========================
// TEMPO ESGOTADO
// =========================

function tempoAcabou(){


    if(bloqueado)
        return;



    bloqueado = true;



    const pergunta =
        perguntas[perguntaAtual];



    const letras = [
        "a",
        "b",
        "c",
        "d"
    ];



    const botoes =
        document.querySelectorAll(".answer");



    botoes[
        letras.indexOf(
            pergunta.correta
        )
    ].classList.add(
        "correct"
    );



    setTimeout(()=>{


        proximaPergunta();



    },1000);



}



// =========================
// EVENTOS
// =========================

function adicionarEventos(){


    const botoes =
        document.querySelectorAll(".answer");



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
// RESPOSTA
// =========================

function verificarResposta(
    botao,
    index
){


    if(bloqueado)
        return;



    bloqueado = true;


    clearInterval(intervaloTempo);



    const pergunta =
        perguntas[perguntaAtual];



    const letras = [
        "a",
        "b",
        "c",
        "d"
    ];



    const resposta =
        letras[index];



    const botoes =
        document.querySelectorAll(".answer");



    if(resposta === pergunta.correta){


        botao.classList.add(
            "correct"
        );


        pontos++;



    }else{


        botao.classList.add(
            "wrong"
        );



        botoes[
            letras.indexOf(
                pergunta.correta
            )
        ].classList.add(
            "correct"
        );


    }



    setTimeout(()=>{


        proximaPergunta();



    },1000);



}



// =========================
// PRÓXIMA
// =========================

function proximaPergunta(){


    perguntaAtual++;



    if(perguntaAtual < perguntas.length){


        mostrarPergunta();



    }else{


        finalizarQuiz();



    }



    bloqueado = false;



}



// =========================
// FINAL
// =========================

function finalizarQuiz(){


    clearInterval(intervaloTempo);



    const exp =
        pontos * 10;



    const berries =
        pontos * 1000;



    document.getElementById(
        "quiz-content"
    ).style.display =
    "none";



    document.getElementById(
        "quiz-result"
    ).style.display =
    "block";



    document.getElementById(
        "result-score"
    ).textContent =
    `${pontos}/${perguntas.length}`;



    document.getElementById(
        "result-exp"
    ).textContent =
    exp;



    document.getElementById(
        "result-berries"
    ).textContent =
    berries;



}



// =========================
// START
// =========================

carregarQuiz();
