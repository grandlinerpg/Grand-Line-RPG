const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');

const NUMERO_BOT = "5511918448331";
const FIREBASE_URL = "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com";

// Servidor Web + Auto-Ping
const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

app.get('/', (req, res) => res.send('⚔️ Bot Grand Line RPG Online na Render!'));
app.listen(PORT, () => {
    console.log(`[Web] Servidor ativo na porta ${PORT}`);
    if (RENDER_URL) {
        setInterval(async () => {
            try {
                await axios.get(RENDER_URL);
            } catch (err) {
                console.error('[Auto-Ping] Erro:', err.message);
            }
        }, 10 * 60 * 1000);
    }
});

// Controle em memória dos Quizzes e Combates
const jogosQuiz = {};
const batalhas = {};

// Função auxiliar para mapear o emoji de facção
function obterEmojiFaccao(faccao) {
    if (!faccao) return '🏴‍☠️';
    const faccaoLimpa = String(faccao).trim().toLowerCase();
    if (faccaoLimpa.includes('exército revolucionário') || faccaoLimpa.includes('exercito revolucionario')) {
        return '⚔️';
    }
    if (faccaoLimpa.includes('governo mundial')) {
        return '⚓';
    }
    if (faccaoLimpa.includes('piratas') || faccaoLimpa.includes('pirata')) {
        return '🏴‍☠️';
    }
    return '🏴‍☠️';
}

// Limpa timers do combate
function limparTimersBatalha(batalha) {
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

// Inicia/Reinicia o timer de 30 minutos para a VEZ do jogador atual
function iniciarTimerTurnoMaximo(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat) return;

    if (bat.timerTurno) clearTimeout(bat.timerTurno);

    bat.timerTurno = setTimeout(async () => {
        if (!batalhas[groupId]) return;

        await sock.sendMessage(groupId, { 
            text: `⏰ *TEMPO ESGOTADO!* O limite de 30 minutos para a jogada do *Jogador ${bat.jogadorVez}* (Turno ${bat.turnoAtual}) acabou!\nPassando a vez...` 
        });

        // Alterna o jogador e avança o número do turno se for o Jogador 2
        if (bat.jogadorVez === 1) {
            bat.jogadorVez = 2;
        } else {
            bat.jogadorVez = 1;
            bat.turnoAtual++;
        }

        await sock.sendMessage(groupId, { 
            text: `🔄 *TURNO ${bat.turnoAtual} — VEZ DO JOGADOR ${bat.jogadorVez}*\n\n⏳ *Tempo Máximo:* 30 minutos.\n👉 Digite *!passar* ou *!prox* ao concluir sua jogada.`
        });

        iniciarTimerTurnoMaximo(groupId, sock);
    }, 30 * 60 * 1000);
}

// Começa o combate de fato (Turno 1 - Jogador 1)
async function comecarCombateDeFato(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat || bat.fase !== 'apresentacao') return;

    if (bat.timerApresentacao) clearTimeout(bat.timerApresentacao);

    bat.fase = 'em_combate';
    bat.turnoAtual = 1;
    bat.jogadorVez = 1;

    const msgComeco = `⏰ *TEMPO DE APRESENTAÇÃO ENCERRADO!*\n\n` +
                      `⚔️ *TURNO 1 INICIADO*\n` +
                      `👤 *Vez do:* Jogador 1\n` +
                      `⏳ *Tempo limite para esta jogada:* 30 minutos.\n\n` +
                      `👉 Digite *!passar* ou *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgComeco });
    iniciarTimerTurnoMaximo(groupId, sock);
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(NUMERO_BOT);
                console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
            } catch (err) {
                console.error('[Pareamento] Erro:', err.message);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ [WhatsApp] Bot conectado!');
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate.messages || !chatUpdate.messages[0]) return;
            const m = chatUpdate.messages[0];
            if (m.key.fromMe || !m.message) return;

            const rawText = m.message.conversation || 
                            m.message.extendedTextMessage?.text || 
                            m.message.imageMessage?.caption || 
                            m.message.videoMessage?.caption || '';

            const text = rawText.trim().toLowerCase();
            const from = m.key.remoteJid;

            if (!text) return;

            // COMANDO !PING
            if (text === '!ping' || text.startsWith('!ping ')) {
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !DADO (1d100) — Exibe charName do jogador
            if (text === '!dado' || text.startsWith('!dado ')) {
                const resultado = Math.floor(Math.random() * 100) + 1;
                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                let nomeJogador = "Lutador";

                try {
                    const response = await axios.get(`${FIREBASE_URL}/players.json`);
                    const playersData = response.data || {};

                    const playerUid = Object.keys(playersData).find(uid => {
                        return String(playersData[uid]?.number?.LID || '').trim() === senderLid;
                    });

                    if (playerUid) {
                        nomeJogador = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador";
                    }
                } catch (dadoErr) {
                    console.error('Erro ao buscar nome para o dado:', dadoErr.message);
                }

                const mensagemDado = `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +
                                     `👤 *Jogador:* ${nomeJogador}\n` +
                                     `🎯 *Resultado:* *${resultado}*`;

                await sock.sendMessage(from, { text: mensagemDado }, { quoted: m });
            }

            // COMANDO !INFO
            if (text === '!info' || text.startsWith('!info ')) {
                try {
                    const response = await axios.get(`${FIREBASE_URL}/players.json`);
                    const playersData = response.data;

                    if (!playersData) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Banco de dados vazio.' }, { quoted: m });
                    }

                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                    const playerUid = Object.keys(playersData).find(uid => {
                        const storedLid = String(playersData[uid]?.number?.LID || '').trim();
                        return storedLid === senderLid;
                    });

                    if (!playerUid) {
                        return await sock.sendMessage(from, { text: `❌ *LID não cadastrado!* (${senderLid})` }, { quoted: m });
                    }

                    const player = playersData[playerUid];
                    const nome = player?.character?.charName || player?.nome || 'Sem Nome';
                    const nivel = player?.info?.level ?? 1;
                    const exp = player?.info?.exp ?? 0;
                    const saldo = player?.info?.saldo ?? 0;

                    const infoText = `*📜 — INFORMAÇÕES — 📜*\n\n` +
                                     `👤 *Nome:* ${nome}\n` +
                                     `⭐ *Nível:* ${nivel}\n` +
                                     `✨ *EXP:* ${exp}\n` +
                                     `💰 *Saldo:* ฿ ${saldo}`;

                    await sock.sendMessage(from, { text: infoText }, { quoted: m });
                } catch (infoErr) {
                    await sock.sendMessage(from, { text: '❌ Erro ao buscar informações do jogador.' }, { quoted: m });
                }
            }

            // COMANDO !RANK
            if (text === '!rank' || text.startsWith('!rank ')) {
                try {
                    const [rankRes, playersRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/ranking.json`),
                        axios.get(`${FIREBASE_URL}/players.json`)
                    ]);

                    const rankingObj = rankRes.data || {};
                    const playersData = playersRes.data || {};

                    const posicoesOrdenadas = Object.keys(rankingObj).sort((a, b) => parseInt(a) - parseInt(b));

                    if (posicoesOrdenadas.length === 0) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ O ranking ainda não possui nenhum jogador.' }, { quoted: m });
                    }

                    let rankText = `*🏆 — RANKING ARENA — 🏆*\n\n`;

                    posicoesOrdenadas.forEach((pos) => {
                        const uid = rankingObj[pos];
                        const player = playersData[uid];
                        const nome = player?.character?.charName || player?.nome || 'Sem Nome';
                        const nivel = player?.info?.level ?? 1;
                        const faccao = player?.character?.faction || '';
                        const emojiFaccao = obterEmojiFaccao(faccao);

                        rankText += `${parseInt(pos)}º ${nome} (${nivel}) ${emojiFaccao}\n`;
                    });

                    await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
                } catch (rankErr) {
                    await sock.sendMessage(from, { text: '❌ Erro ao carregar o ranking do Firebase.' }, { quoted: m });
                }
            }

            // --- SISTEMA DE QUIZ ---

            if (text === '!iniciarquiz') {
                if (jogosQuiz[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um Quiz rodando neste grupo!' }, { quoted: m });
                }

                try {
                    const quizRes = await axios.get(`${FIREBASE_URL}/quiz.json`);
                    const quizObj = quizRes.data;

                    if (!quizObj) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhuma pergunta encontrada no nó /quiz do Firebase.' }, { quoted: m });
                    }

                    let listaPerguntas = Object.values(quizObj);

                    if (listaPerguntas.length === 0) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhuma pergunta disponível.' }, { quoted: m });
                    }

                    for (let i = listaPerguntas.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [listaPerguntas[i], listaPerguntas[j]] = [listaPerguntas[j], listaPerguntas[i]];
                    }

                    const QTD_PERGUNTAS = 5;
                    const perguntasSorteadas = listaPerguntas.slice(0, QTD_PERGUNTAS);
                    const PREMIO_TOTAL = 3000;

                    jogosQuiz[from] = {
                        perguntas: perguntasSorteadas,
                        perguntaAtual: 0,
                        pontos: {}, 
                        premioTotal: PREMIO_TOTAL,
                        ativo: true
                    };

                    const totalRodada = perguntasSorteadas.length;

                    await sock.sendMessage(from, { 
                        text: `🏴‍☠️ *O QUIZ DA GRAND LINE COMEÇOU!*\n\n💰 *Prêmio Total:* ฿ ${PREMIO_TOTAL}\n🎯 *Total de Perguntas:* ${totalRodada}` 
                    });

                    setTimeout(async () => {
                        const primeiraPerguntaObj = perguntasSorteadas[0];
                        await sock.sendMessage(from, {
                            text: `❓ *PRIMEIRA PERGUNTA (1/${totalRodada}):*\n\n${primeiraPerguntaObj.pergunta}`
                        });
                    }, 2000);

                    return;
                } catch (quizErr) {
                    return await sock.sendMessage(from, { text: '❌ Erro ao carregar as perguntas do Firebase.' }, { quoted: m });
                }
            }

            if (jogosQuiz[from] && jogosQuiz[from].ativo) {
                const quiz = jogosQuiz[from];
                const perguntaObj = quiz.perguntas[quiz.perguntaAtual];

                if (text === String(perguntaObj.resposta).trim().toLowerCase()) {
                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                    const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
                    const playersData = playersRes.data || {};

                    const playerUidAcertador = Object.keys(playersData).find(uid => {
                        return String(playersData[uid]?.number?.LID || '').trim() === senderLid;
                    });

                    const nomeAcertador = playersData[playerUidAcertador]?.character?.charName || 
                                          playersData[playerUidAcertador]?.nome || 
                                          `Jogador (${senderLid})`;

                    quiz.pontos[senderLid] = (quiz.pontos[senderLid] || 0) + 1;

                    let tabela = `🎯 *ACERTOU!* *${nomeAcertador}* ganhou +1 ponto!\n\n📊 *TABELA DE PONTOS:*`;
                    const ranking = Object.entries(quiz.pontos).sort((a, b) => b[1] - a[1]);

                    ranking.forEach(([lid, pts], idx) => {
                        const uid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === lid);
                        const charName = playersData[uid]?.character?.charName || playersData[uid]?.nome || lid;
                        tabela += `\n${idx + 1}º | *${charName}*: *${pts} pt(s)*`;
                    });

                    await sock.sendMessage(from, { text: tabela }, { quoted: m });

                    quiz.perguntaAtual++;

                    if (quiz.perguntaAtual >= quiz.perguntas.length) {
                        quiz.ativo = false;

                        const totalPontos = Object.values(quiz.pontos).reduce((a, b) => a + b, 0);
                        let textoFinal = `🏆 *QUIZ FINALIZADO!*\n\n🎁 *DIVISÃO DO PRÊMIO (฿ ${quiz.premioTotal}):*\n`;

                        if (totalPontos === 0) {
                            textoFinal += "\nNinguém acertou nada! O prêmio não foi distribuído.";
                        } else {
                            const valorPorPonto = quiz.premioTotal / totalPontos;

                            for (const [lid, pts] of Object.entries(quiz.pontos)) {
                                const premioJogador = Math.floor(pts * valorPorPonto);

                                const playerUid = Object.keys(playersData).find(uid => {
                                    return String(playersData[uid]?.number?.LID || '').trim() === lid;
                                });

                                const charName = playersData[playerUid]?.character?.charName || 
                                                 playersData[playerUid]?.nome || 
                                                 `Jogador (${lid})`;

                                textoFinal += `\n👤 *${charName}*: *${pts} acerto(s)* ➔ Recebeu *฿ ${premioJogador}*`;

                                if (playerUid) {
                                    const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
                                    const novoSaldo = saldoAtual + premioJogador;

                                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, {
                                        saldo: novoSaldo
                                    });
                                }
                            }
                        }

                        await sock.sendMessage(from, { text: textoFinal });
                        delete jogosQuiz[from];
                        return;
                    }

                    setTimeout(async () => {
                        const proxima = quiz.perguntas[quiz.perguntaAtual];
                        const numPergunta = quiz.perguntaAtual + 1;
                        const totalRodada = quiz.perguntas.length;

                        await sock.sendMessage(from, { 
                            text: `❓ *PRÓXIMA PERGUNTA (${numPergunta}/${totalRodada}):*\n\n${proxima.pergunta}` 
                        });
                    }, 2000);
                }
            }

            // --- SISTEMA DE COMBATE (!battle) ---

            if (text === '!battle') {
                if (batalhas[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um combate em andamento neste grupo!' }, { quoted: m });
                }

                batalhas[from] = {
                    fase: 'apresentacao',
                    turnoAtual: 1,
                    jogadorVez: 1,
                    timerApresentacao: null,
                    timerTurno: null
                };

                const msgInicio = `⚔️ *COMBATE INICIADO!* ⚔️\n\n` +
                                  `📝 Os lutadores têm *5 minutos* para apresentarem seu *Card Combatente* no grupo!\n\n` +
                                  `👉 Caso já tenham enviado os cards, digite *!iniciar* para começar o Turno 1 imediatamente.`;

                await sock.sendMessage(from, { text: msgInicio });

                // Timer de 5 minutos para os cards
                batalhas[from].timerApresentacao = setTimeout(() => {
                    comecarCombateDeFato(from, sock);
                }, 5 * 60 * 1000);

                return;
            }

            // Comando para acelerar o início se os cards já foram enviados
            if (text === '!iniciar') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'apresentacao') return;

                await comecarCombateDeFato(from, sock);
                return;
            }

            // Avançar a vez do jogador no combate
            if (text === '!passar' || text === '!prox') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'em_combate') return;

                // Alterna entre Jogador 1 e Jogador 2
                if (bat.jogadorVez === 1) {
                    bat.jogadorVez = 2;
                } else {
                    bat.jogadorVez = 1;
                    bat.turnoAtual++;
                }

                const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual} — VEZ DO JOGADOR ${bat.jogadorVez}*\n\n` +
                                     `⏳ *Tempo limite desta jogada:* 30 minutos.\n` +
                                     `👉 Digite *!passar* ou *!prox* ao concluir sua jogada.`;

                await sock.sendMessage(from, { text: msgNovoTurno });

                iniciarTimerTurnoMaximo(from, sock);
                return;
            }

            // Encerrar combate
            if (text === '!fimcombate') {
                if (!batalhas[from]) return;
                limparTimersBatalha(batalhas[from]);
                delete batalhas[from];
                return await sock.sendMessage(from, { text: '🏳️ *Combate encerrado com sucesso!*' }, { quoted: m });
            }

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
