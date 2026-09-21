const axios = require('axios');
const { 
    FIREBASE_URL, 
    jogosQuiz 
} = require('./index');

/**
 * Envia a pergunta atual do Quiz para o grupo e gerencia o tempo limite de resposta.
 */
async function enviarProximaPergunta(chatJid, sock) {
    const jogo = jogosQuiz[chatJid];
    if (!jogo || !jogo.ativo) return;

    // Se já respondeu todas as perguntas, encerra o Quiz
    if (jogo.perguntaAtual >= jogo.perguntas.length) {
        return await finalizarQuiz(chatJid, sock);
    }

    const q = jogo.perguntas[jogo.perguntaAtual];
    jogo.respondida = false;

    await sock.sendMessage(chatJid, {
        text: `❓ *PERGUNTA (${jogo.perguntaAtual + 1}/${jogo.perguntas.length}):*\n\n${q.pergunta}\n\n⏳ *Tempo:* 15 segundos para responder!`
    });

    if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

    // Timer de 15 segundos para responder a pergunta
    jogo.timerPergunta = setTimeout(async () => {
        if (jogosQuiz[chatJid] && !jogosQuiz[chatJid].respondida) {
            await sock.sendMessage(chatJid, {
                text: `⏰ *TEMPO ESGOTADO!* Ninguém acertou esta pergunta.`
            });
            jogo.perguntaAtual++;
            setTimeout(() => enviarProximaPergunta(chatJid, sock), 3000);
        }
    }, 15000);
}

/**
 * Monta e retorna uma mensagem formatada com o ranking atual do Quiz.
 */
async function gerarTabelaPontuacao(pontosObj) {
    const participantes = Object.keys(pontosObj);
    if (participantes.length === 0) return "Ninguém pontuou ainda.";

    participantes.sort((a, b) => pontosObj[b] - pontosObj[a]);

    try {
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        let tabela = `📊 *TABELA DE PONTUAÇÃO:*\n`;
        participantes.forEach((senderId, idx) => {
            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId
            );
            const nome = playerUid ? (playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador") : `@${senderId}`;
            tabela += `${idx + 1}º ${nome} — ${pontosObj[senderId]} Pt(s)\n`;
        });
        return tabela.trim();
    } catch (e) {
        return "Erro ao carregar ranking.";
    }
}

/**
 * Finaliza a partida de Quiz, calcula a divisão de prêmios e atualiza o saldo no Firebase.
 */
async function finalizarQuiz(chatJid, sock) {
    const jogo = jogosQuiz[chatJid];
    if (!jogo) return;

    jogo.ativo = false;
    if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

    let textoFinal = `🏴‍☠️ *O QUIZ FOI ENCERRADO!* 🏴‍☠️\n\n🏆 *GANHADORES DA RODADA:*\n`;
    const participantes = Object.keys(jogo.pontos);

    if (participantes.length === 0) {
        textoFinal += `Ninguém pontuou nesta rodada! 💀`;
    } else {
        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            for (const senderId of participantes) {
                const acertos = jogo.pontos[senderId];
                const premioGanhado = acertos * (jogo.premioTotal / jogo.perguntas.length);

                const playerUid = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.LID || '').trim() === senderId || 
                    String(playersData[u]?.number?.n || '').trim() === senderId
                );
                let nomePlayer = "Lutador";

                if (playerUid) {
                    nomePlayer = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador";
                    const saldoAtual = playersData[playerUid]?.info?.saldo || 0;
                    
                    // Atualiza o saldo do jogador no Firebase
                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { 
                        saldo: saldoAtual + premioGanhado 
                    });
                }

                textoFinal += `👤 *${nomePlayer}:* ${acertos} acerto(s) ➔ +฿ ${premioGanhado}\n`;
            }
        } catch (e) {
            console.error('Erro ao premiar quiz:', e.message);
        }
    }

    await sock.sendMessage(chatJid, { text: textoFinal });
    delete jogosQuiz[chatJid];
}

/**
 * Inicia o evento do Quiz no grupo: sorteia 5 perguntas e marca todos do grupo.
 */
async function dispararQuizNoGrupo(chatJid, sock) {
    if (jogosQuiz[chatJid]) return;

    try {
        const quizRes = await axios.get(`${FIREBASE_URL}/quiz.json`);
        const quizObj = quizRes.data;

        if (!quizObj) return;

        let listaPerguntas = Object.values(quizObj);
        if (listaPerguntas.length === 0) return;

        // Algoritmo de embaralhamento (Fisher-Yates)
        for (let i = listaPerguntas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [listaPerguntas[i], listaPerguntas[j]] = [listaPerguntas[j], listaPerguntas[i]];
        }

        const QTD_PERGUNTAS = 5;
        const perguntasSorteadas = listaPerguntas.slice(0, QTD_PERGUNTAS);
        const PREMIO_TOTAL = 3000;

        // Estrutura do jogo no estado global
        jogosQuiz[chatJid] = {
            perguntas: perguntasSorteadas,
            perguntaAtual: 0,
            pontos: {},
            premioTotal: PREMIO_TOTAL,
            ativo: true,
            respondida: false,
            timerPergunta: null
        };

        let mentions = [];
        try {
            const groupMetadata = await sock.groupMetadata(chatJid);
            mentions = groupMetadata.participants.map(p => p.id);
        } catch (e) {}

        const msgInicio = `⏰ *HORÁRIO DO QUIZ DIÁRIO (22:30)!* ⏰\n\n` +
                          `🏴‍☠️ *O QUIZ DA GRAND LINE COMEÇOU!*\n\n` +
                          `🎯 *Total de Perguntas:* ${QTD_PERGUNTAS}\n\n` +
                          `📢 @todos fiquem atentos! A primeira pergunta será enviada em instantes!`;

        await sock.sendMessage(chatJid, { text: msgInicio, mentions: mentions });

        // Aguarda 5 segundos antes de disparar a primeira pergunta
        setTimeout(() => {
            enviarProximaPergunta(chatJid, sock);
        }, 5000);

    } catch (err) {
        console.error('Erro ao disparar quiz:', err.message);
    }
}

module.exports = {
    enviarProximaPergunta,
    gerarTabelaPontuacao,
    finalizarQuiz,
    dispararQuizNoGrupo
};
