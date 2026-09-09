const axios = require('axios');
const { 
    FIREBASE_URL, 
    jogosQuiz, 
    batalhas, 
    obterJidEfetivo 
} = require('./index');

function limparTimersBatalha(batalha) {
    if (!batalha) return;
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

function iniciarTimerTurnoMaximo(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat) return;

    if (bat.timerTurno) clearTimeout(bat.timerTurno);

    bat.timerTurno = setTimeout(async () => {
        if (!batalhas[groupId]) return;

        await sock.sendMessage(groupId, { 
            text: `⏰ TEMPO ENCERRADO!` 
        });

        if (bat.jogadorVez === 1) {
            bat.jogadorVez = 2;
        } else {
            bat.jogadorVez = 1;
            bat.turnoAtual++;
        }

        const proxJogador = bat[`p${bat.jogadorVez}`];
        const nomeProx = proxJogador?.nome || `Jogador ${bat.jogadorVez}`;

        await sock.sendMessage(groupId, { 
            text: `🔄 TURNO ${bat.turnoAtual} 🔄\n\nVEZ DE ${nomeProx.toUpperCase()}\n\nTempo: 30 minutos\n\nDigite !prox ao concluir sua jogada.` 
        });

        iniciarTimerTurnoMaximo(groupId, sock);
    }, 30 * 60 * 1000);
}

async function comecarCombateDeFato(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat || bat.fase !== 'apresentacao') return;

    if (bat.timerApresentacao) clearTimeout(bat.timerApresentacao);

    bat.fase = 'em_combate';
    bat.turnoAtual = 1;
    bat.jogadorVez = 1;

    const p1Nome = bat.p1?.nome || 'Jogador 1';

    const msgComeco = `⏰ *TEMPO ENCERRADO!*\n\n` +
                      `🔄 *TURNO 1 INICIADO* 🔄\n\n` +
                      `VEZ DE *${p1Nome.toUpperCase()}*\n\n` +
                      `*Tempo:* 30 minutos\n\n` +
                      `Digite *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgComeco });

    iniciarTimerTurnoMaximo(groupId, sock);
}

function iniciarEstruturaBatalha(groupId, p1Data, p2Data, tipoCombate = 'PVP', sock) {
    if (batalhas[groupId]) {
        limparTimersBatalha(batalhas[groupId]);
    }

    batalhas[groupId] = {
        tipo: tipoCombate,
        fase: 'apresentacao',
        turnoAtual: 1,
        jogadorVez: 1,
        p1: p1Data,
        p2: p2Data,
        timerApresentacao: null,
        timerTurno: null
    };

    batalhas[groupId].timerApresentacao = setTimeout(() => {
        comecarCombateDeFato(groupId, sock);
    }, 5 * 60 * 1000);
}

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

module.exports = {
    limparTimersBatalha,
    iniciarTimerTurnoMaximo,
    comecarCombateDeFato,
    iniciarEstruturaBatalha,
    enviarProximaPergunta,
    gerarTabelaPontuacao,
    finalizarQuiz,
    dispararQuizNoGrupo
};
