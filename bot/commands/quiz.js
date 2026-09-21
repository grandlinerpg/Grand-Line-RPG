const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

const jogosQuiz = {};

async function enviarProximaPergunta(chatJid, sock) {
    const jogo = jogosQuiz[chatJid];
    if (!jogo || !jogo.ativo) return;

    if (jogo.perguntaAtual >= jogo.perguntas.length) {
        return await finalizarQuiz(chatJid, sock);
    }

    const q = jogo.perguntas[jogo.perguntaAtual];
    jogo.respondida = false;

    await sock.sendMessage(chatJid, {
        text: `❓ *PERGUNTA (${jogo.perguntaAtual + 1}/${jogo.perguntas.length}):*\n\n${q.pergunta}\n\n⏳ *Tempo:* 15 segundos para responder!`
    });

    if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

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
                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { saldo: saldoAtual + premioGanhado });
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

async function dispararQuizNoGrupo(chatJid, sock) {
    if (jogosQuiz[chatJid]) return;

    try {
        const quizRes = await axios.get(`${FIREBASE_URL}/quiz.json`);
        const quizObj = quizRes.data;

        if (!quizObj) return;

        let listaPerguntas = Object.values(quizObj);
        if (listaPerguntas.length === 0) return;

        for (let i = listaPerguntas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [listaPerguntas[i], listaPerguntas[j]] = [listaPerguntas[j], listaPerguntas[i]];
        }

        const QTD_PERGUNTAS = 5;
        const perguntasSorteadas = listaPerguntas.slice(0, QTD_PERGUNTAS);
        const PREMIO_TOTAL = 3000;

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

        setTimeout(() => {
            enviarProximaPergunta(chatJid, sock);
        }, 5000);

    } catch (err) {
        console.error('Erro ao disparar quiz:', err.message);
    }
}

async function handleQuizCommands(sock, m, text, from) {
    // Verificação de Respostas de Quiz
    if (jogosQuiz[from] && jogosQuiz[from].ativo && !jogosQuiz[from].respondida) {
        const jogo = jogosQuiz[from];
        const qAtual = jogo.perguntas[jogo.perguntaAtual];

        if (qAtual && text === String(qAtual.resposta).trim().toLowerCase()) {
            jogo.respondida = true;
            if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

            const senderId = obterJidEfetivo(m, from);
            jogo.pontos[senderId] = (jogo.pontos[senderId] || 0) + 1;

            const tabelaPontos = await gerarTabelaPontuacao(jogo.pontos);
            const msgAcerto = `🎉 *RESPOSTA CORRETA!* @${senderId} acertou e pontuou!\n\n${tabelaPontos}`;

            await sock.sendMessage(from, {
                text: msgAcerto,
                mentions: [m.key.participant || m.key.remoteJid || from]
            }, { quoted: m });

            jogo.perguntaAtual++;
            setTimeout(() => enviarProximaPergunta(from, sock), 3000);
            return true;
        }
    }

    if (text === '!iniciarquiz') {
        await dispararQuizNoGrupo(from, sock);
        return true;
    }

    return false;
}

module.exports = { handleQuizCommands, dispararQuizNoGrupo, jogosQuiz };
