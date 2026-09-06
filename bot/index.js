const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

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

// Controle em memória
const jogosQuiz = {};
const batalhas = {};
const timersDesafio = {};

// Função para buscar a Temporada Atual do Coliseu
async function obterTemporadaAtual() {
    try {
        const infoRes = await axios.get(`${FIREBASE_URL}/coliseu/info.json`);
        const info = infoRes.data;
        return info?.temporada || 1;
    } catch (e) {
        return 1;
    }
}

// Função auxiliar para mapear o emoji de facção
function obterEmojiFaccao(faccao) {
    if (!faccao) return '';
    const faccaoLimpa = String(faccao).trim().toLowerCase();
    if (faccaoLimpa.includes('exército revolucionário') || faccaoLimpa.includes('exercito revolucionario')) {
        return '⚔️';
    }
    if (faccaoLimpa.includes('governo mundial')) {
        return '⚓️';
    }
    if (faccaoLimpa.includes('piratas') || faccaoLimpa.includes('pirata')) {
        return '🏴‍☠️';
    }
    return '';
}

function limparTimersBatalha(batalha) {
    if (!batalha) return;
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

function formatarJidPv(lid) {
    if (!lid) return null;
    const cleanLid = String(lid).split('@')[0].split(':')[0].trim();
    return `${cleanLid}@s.whatsapp.net`;
}

function iniciarTimerTurnoMaximo(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat) return;

    if (bat.timerTurno) clearTimeout(bat.timerTurno);

    bat.timerTurno = setTimeout(async () => {
        if (!batalhas[groupId]) return;

        const pAtual = bat[`p${bat.jogadorVez}`];
        const nomeAtual = pAtual?.nome || `Jogador ${bat.jogadorVez}`;

        await sock.sendMessage(groupId, { 
            text: `⏰ *TEMPO ESGOTADO!* O limite de 30 minutos para a jogada de *${nomeAtual}* (Turno ${bat.turnoAtual}) acabou!\nPassando a vez...` 
        });

        if (bat.jogadorVez === 1) {
            bat.jogadorVez = 2;
        } else {
            bat.jogadorVez = 1;
            bat.turnoAtual++;
        }

        const proxJogador = bat[`p${bat.jogadorVez}`];
        const nomeProx = proxJogador?.nome || `Jogador ${bat.jogadorVez}`;

        const msgProxTurno = `🔄 *TURNO ${bat.turnoAtual} — VEZ DE ${nomeProx.toUpperCase()}*\n\n⏳ *Tempo Máximo:* 30 minutos.\n👉 Digite *!prox* ao concluir sua jogada.`;

        await sock.sendMessage(groupId, { text: msgProxTurno });

        const jidPvProx = formatarJidPv(proxJogador?.lid);
        if (jidPvProx) {
            try {
                await sock.sendMessage(jidPvProx, { text: `⚔️ *SUA VEZ!* É o Turno ${bat.turnoAtual} no seu combate em grupo!\n\n👉 Responda no grupo e digite *!prox* ao concluir.` });
            } catch (pvErr) {}
        }

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
    const p2Nome = bat.p2?.nome || 'Jogador 2';

    const msgComeco = `⏰ *TEMPO DE APRESENTAÇÃO ENCERRADO!*\n\n` +
                      `⚔️ *TURNO 1 INICIADO (${bat.tipo === 'COLISEU' ? 'COLISEU' : 'ARENA'})*\n` +
                      `👥 *Luta:* ${p1Nome} VS ${p2Nome}\n` +
                      `👤 *Vez inicial:* ${p1Nome}\n` +
                      `⏳ *Tempo limite para esta jogada:* 30 minutos.\n\n` +
                      `👉 Digite *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgComeco });

    const p1Jid = formatarJidPv(bat.p1?.lid);
    if (p1Jid) {
        try {
            await sock.sendMessage(p1Jid, { text: `⚔️ *O COMBATE COMEÇOU!* É a sua vez (Turno 1) contra *${p2Nome}*.\n\n👉 Envie sua jogada no grupo e digite *!prox*.` });
        } catch (pvErr) {}
    }

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

// LÓGICA COMPLETA DO QUIZ
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
                text: `⏰ *TEMPO ESGOTADO!* Ninguém acertou. A resposta correta era: *${q.resposta}*`
            });
            jogo.perguntaAtual++;
            setTimeout(() => enviarProximaPergunta(chatJid, sock), 3000);
        }
    }, 15000);
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

            for (const lid of participantes) {
                const acertos = jogo.pontos[lid];
                const premioGanhado = acertos * (jogo.premioTotal / jogo.perguntas.length);

                const playerUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === lid);
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

        // MARCAR TODOS NO GRUPO
        let mentions = [];
        try {
            const groupMetadata = await sock.groupMetadata(chatJid);
            mentions = groupMetadata.participants.map(p => p.id);
        } catch (e) {}

        await sock.sendMessage(chatJid, { 
            text: `⏰ *HORÁRIO DO QUIZ DIÁRIO (21:52)!* ⏰\n\n🏴‍☠️ *O QUIZ DA GRAND LINE COMEÇOU!*\n\n💰 *Prêmio Total:* ฿ ${PREMIO_TOTAL}\n🎯 *Total de Perguntas:* ${perguntasSorteadas.length}\n\n📢 @todos fiquem atentos!`,
            mentions: mentions
        });

        setTimeout(() => {
            enviarProximaPergunta(chatJid, sock);
        }, 3000);

    } catch (err) {
        console.error('Erro ao disparar quiz automático:', err.message);
    }
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

            // ⏰ PROGRAMAÇÃO DO QUIZ DIÁRIO (21:52 Brasil = 00:52 UTC)
            cron.schedule('52 0 * * *', () => {
                console.log('⏰ [CRON] Iniciando Quiz Automático das 21:52...');
                const GRUPO_QUIZ_JID = "120363409325935641@g.us";
                dispararQuizNoGrupo(GRUPO_QUIZ_JID, sock);
            });
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

            // VERIFICAÇÃO DE RESPOSTAS DO QUIZ
            if (jogosQuiz[from] && jogosQuiz[from].ativo && !jogosQuiz[from].respondida) {
                const jogo = jogosQuiz[from];
                const qAtual = jogo.perguntas[jogo.perguntaAtual];

                if (qAtual && text === String(qAtual.resposta).trim().toLowerCase()) {
                    jogo.respondida = true;
                    if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                    jogo.pontos[senderLid] = (jogo.pontos[senderLid] || 0) + 1;

                    await sock.sendMessage(from, {
                        text: `🎉 *RESPOSTA CORRETA!* @${senderLid} acertou e pontuou!\nResposta: *${qAtual.resposta}*`,
                        mentions: [rawSender]
                    }, { quoted: m });

                    jogo.perguntaAtual++;
                    setTimeout(() => enviarProximaPergunta(from, sock), 3000);
                    return;
                }
            }

            // COMANDO !INICIARQUIZ (Manual)
            if (text === '!iniciarquiz') {
                await dispararQuizNoGrupo(from, sock);
                return;
            }

            // COMANDO !JID
            if (text === '!jid') {
                await sock.sendMessage(from, { text: `🆔 *ID deste chat:* \`${from}\`` }, { quoted: m });
            }

            // COMANDO !PING
            if (text === '!ping' || text.startsWith('!ping ')) {
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !DADO
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
                } catch (dadoErr) {}

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
                        return String(playersData[uid]?.number?.LID || '').trim() === senderLid;
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

            // COMANDO !RANK (Sem Posição 0)
            if (text === '!rank' || text.startsWith('!rank ')) {
                try {
                    const [rankRes, playersRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/ranking.json`),
                        axios.get(`${FIREBASE_URL}/players.json`)
                    ]);

                    const rankingObj = rankRes.data || {};
                    const playersData = playersRes.data || {};

                    const posicoesOrdenadas = Object.keys(rankingObj)
                        .map(Number)
                        .filter(p => p > 0 && !isNaN(p))
                        .sort((a, b) => a - b);

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

                        rankText += `${pos}º ${nome} (${nivel}) ${emojiFaccao}\n`;
                    });

                    await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
                } catch (rankErr) {
                    await sock.sendMessage(from, { text: '❌ Erro ao carregar o ranking.' }, { quoted: m });
                }
            }

            // COMANDO !INSCREVER (Coliseu)
            if (text === '!inscrever' || text.startsWith('!inscrever ')) {
                try {
                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();
                    const tempAtual = await obterTemporadaAtual();

                    const [playersRes, coliseuRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/players.json`),
                        axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
                    ]);

                    const playersData = playersRes.data || {};
                    const coliseuData = coliseuRes.data || {};

                    const playerUid = Object.keys(playersData).find(uid => {
                        return String(playersData[uid]?.number?.LID || '').trim() === senderLid;
                    });

                    if (!playerUid) {
                        return await sock.sendMessage(from, { text: '❌ Você precisa de um personagem cadastrado para se inscrever!' }, { quoted: m });
                    }

                    if (coliseuData[playerUid]) {
                        return await sock.sendMessage(from, { text: `⚠️ Você já está inscrito na Temporada ${tempAtual} do Coliseu!` }, { quoted: m });
                    }

                    const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
                    const TAXA_INSCRICAO = 20000;

                    if (saldoAtual < TAXA_INSCRICAO) {
                        return await sock.sendMessage(from, { text: `❌ Saldo insuficiente! A inscrição custa *฿ ${TAXA_INSCRICAO}* e você tem *฿ ${saldoAtual}*.` }, { quoted: m });
                    }

                    const novoSaldo = saldoAtual - TAXA_INSCRICAO;
                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { saldo: novoSaldo });

                    await axios.put(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${playerUid}.json`, {
                        vitorias: 0,
                        derrotas: 0,
                        pontos: 0,
                        inscritoEm: Date.now()
                    });

                    const nomeChar = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || 'Combatente';

                    const msgSucesso = `🏟 *INSCRIÇÃO CONFIRMADA NO COLISEU!* 🏟\n` +
                                       `🏆 *Temporada ${tempAtual}*\n\n` +
                                       `👤 *Lutador:* ${nomeChar}\n` +
                                       `💰 *Taxa Paga:* ฿ ${TAXA_INSCRICAO}\n` +
                                       `💳 *Novo Saldo:* ฿ ${novoSaldo}\n\n` +
                                       `⚔️ Use *!desafiarcoliseu @jogador* para desafiar outros inscritos!`;

                    return await sock.sendMessage(from, { text: msgSucesso }, { quoted: m });
                } catch (inscErr) {
                    return await sock.sendMessage(from, { text: '❌ Erro ao processar inscrição no Coliseu.' }, { quoted: m });
                }
            }

            // COMANDO !COLISEU
            if (text === '!coliseu' || text.startsWith('!coliseu ')) {
                try {
                    const args = text.split(' ');
                    const tempPadrao = await obterTemporadaAtual();
                    const tempDesejada = args[1] ? parseInt(args[1]) : tempPadrao;

                    const [coliseuRes, playersRes, infoColiseuRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempDesejada}/jogadores.json`),
                        axios.get(`${FIREBASE_URL}/players.json`),
                        axios.get(`${FIREBASE_URL}/coliseu/info.json`)
                    ]);

                    const coliseuData = coliseuRes.data || {};
                    const playersData = playersRes.data || {};
                    const coliseuInfo = infoColiseuRes.data || { periodo: '01/09 ~ 31/09' };

                    const inscritosUids = Object.keys(coliseuData);

                    if (inscritosUids.length === 0) {
                        return await sock.sendMessage(from, { text: `🏟 *O Coliseu não possui inscritos na Temporada ${tempDesejada}!*` }, { quoted: m });
                    }

                    inscritosUids.sort((a, b) => {
                        const pA = coliseuData[a];
                        const pB = coliseuData[b];
                        if ((pB.pontos || 0) !== (pA.pontos || 0)) return (pB.pontos || 0) - (pA.pontos || 0);
                        if ((pB.vitorias || 0) !== (pA.vitorias || 0)) return (pB.vitorias || 0) - (pA.vitorias || 0);
                        return (pA.derrotas || 0) - (pB.derrotas || 0);
                    });

                    let coliseuText = `🏟 *— COLISEU CORRIDA —* 🏟\n` +
                                      `🏆 *— TEMPORADA ${tempDesejada} — 🏆*\n\n` +
                                      `*Período: ${coliseuInfo.periodo}*\n\n`;

                    inscritosUids.forEach((uid, index) => {
                        const dadosCol = coliseuData[uid];
                        const player = playersData[uid];

                        const nome = player?.character?.charName || player?.nome || 'Lutador';
                        const nivel = player?.info?.level ?? 1;
                        const faccao = player?.character?.faction || '';
                        const emojiFaccao = obterEmojiFaccao(faccao);

                        const vitorias = dadosCol.vitorias ?? 0;
                        const derrotas = dadosCol.derrotas ?? 0;
                        const pontos = dadosCol.pontos ?? 0;

                        const espacoEmoji = emojiFaccao ? ` ${emojiFaccao}` : '';

                        coliseuText += `${index + 1}º ${nome} (${nivel})${espacoEmoji}\n`;
                        coliseuText += `> *✔️ ${vitorias} | ✖️ ${derrotas} | 🏅${pontos}*\n\n`;
                    });

                    await sock.sendMessage(from, { text: coliseuText.trim() }, { quoted: m });
                } catch (colErr) {
                    await sock.sendMessage(from, { text: '❌ Erro ao carregar as informações do Coliseu.' }, { quoted: m });
                }
            }

            // COMANDO !DESAFIARCOLISEU
            if (text.startsWith('!desafiarcoliseu')) {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');

                if (batalhas[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um combate rodando neste grupo!' }, { quoted: m });
                }

                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (!mentionedJid) {
                    return await sock.sendMessage(from, { text: '❌ Marque o jogador que deseja desafiar no Coliseu!\nExemplo: *!desafiarcoliseu @jogador*' }, { quoted: m });
                }

                const targetLid = mentionedJid.split('@')[0].split(':')[0].trim();

                if (senderLid === targetLid) {
                    return await sock.sendMessage(from, { text: '❌ Você não pode desafiar a si mesmo!' }, { quoted: m });
                }

                const tempAtual = await obterTemporadaAtual();

                const [playersRes, coliseuRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/players.json`),
                    axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
                ]);

                const playersData = playersRes.data || {};
                const coliseuData = coliseuRes.data || {};

                const desafianteUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === senderLid);
                const desafiadoUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === targetLid);

                if (!coliseuData[desafianteUid]) {
                    return await sock.sendMessage(from, { text: '❌ Você precisa estar inscrito na temporada atual do Coliseu!' }, { quoted: m });
                }
                if (!coliseuData[desafiadoUid]) {
                    return await sock.sendMessage(from, { text: '❌ O jogador desafiado NÃO está inscrito nesta temporada do Coliseu!' }, { quoted: m });
                }

                const nomeDesafiante = playersData[desafianteUid]?.character?.charName || playersData[desafianteUid]?.nome || 'Desafiante';
                const nomeDesafiado = playersData[desafiadoUid]?.character?.charName || playersData[desafiadoUid]?.nome || 'Desafiado';

                const desafioPayload = {
                    desafianteLid: senderLid,
                    desafianteNome: nomeDesafiante,
                    desafiadoLid: targetLid,
                    desafiadoNome: nomeDesafiado,
                    status: 'pendente',
                    criadoEm: Date.now()
                };

                await axios.put(`${FIREBASE_URL}/desafios_coliseu/${groupIdClean}.json`, desafioPayload);

                const msgDesafio = `🏟️ *DESAFIO DO COLISEU LANÇADO!* 🏟️\n\n` +
                                   `👤 *Desafiante:* ${nomeDesafiante}\n` +
                                   `🎯 *Desafiado:* ${nomeDesafiado}\n\n` +
                                   `📢 @${targetLid}, responda no grupo com *!aceitarcoliseu* quando estiver pronto para o confronto!`;

                await sock.sendMessage(from, { text: msgDesafio, mentions: [mentionedJid] }, { quoted: m });

                const pvTargetJid = formatarJidPv(targetLid);
                if (pvTargetJid) {
                    try {
                        await sock.sendMessage(pvTargetJid, { text: `🏟️ *VOCÊ FOI DESAFIADO NO COLISEU!*\n\n👤 *Desafiante:* ${nomeDesafiante}\n👉 Responda com *!aceitarcoliseu* no grupo quando desejar lutar!` });
                    } catch (e) {}
                }
                return;
            }

            // COMANDO !ACEITARCOLISEU
            if (text === '!aceitarcoliseu') {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const desafioRes = await axios.get(`${FIREBASE_URL}/desafios_coliseu/${groupIdClean}.json`);
                const desafio = desafioRes.data;

                if (!desafio || desafio.status !== 'pendente') {
                    return await sock.sendMessage(from, { text: '❌ Não há desafio do Coliseu pendente neste grupo.' }, { quoted: m });
                }

                if (desafio.desafiadoLid !== senderLid) {
                    return await sock.sendMessage(from, { text: '❌ Apenas o desafiado pode aceitar este confronto!' }, { quoted: m });
                }

                await axios.patch(`${FIREBASE_URL}/desafios_coliseu/${groupIdClean}.json`, { status: 'aceito' });

                const p1 = { lid: desafio.desafianteLid, nome: desafio.desafianteNome };
                const p2 = { lid: desafio.desafiadoLid, nome: desafio.desafiadoNome };

                iniciarEstruturaBatalha(from, p1, p2, 'COLISEU', sock);

                const msgInicio = `🏟️ *DESAFIO DO COLISEU ACEITO!* 🏟️\n\n` +
                                   `🥊 *${p1.nome}* VS *${p2.nome}*\n\n` +
                                   `📝 Apresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;

                return await sock.sendMessage(from, { text: msgInicio });
            }

            // COMANDO !DESAFIAR (Arena Comum)
            if (text.startsWith('!desafiar') && !text.startsWith('!desafiarcoliseu')) {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');

                if (batalhas[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um combate rodando neste grupo!' }, { quoted: m });
                }

                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (!mentionedJid) {
                    return await sock.sendMessage(from, { text: '❌ Marque quem deseja desafiar!\nExemplo: *!desafiar @jogador*' }, { quoted: m });
                }

                const targetLid = mentionedJid.split('@')[0].split(':')[0].trim();

                if (senderLid === targetLid) {
                    return await sock.sendMessage(from, { text: '❌ Você não pode desafiar a si mesmo!' }, { quoted: m });
                }

                const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
                const playersData = playersRes.data || {};

                const desafianteUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === senderLid);
                const desafiadoUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === targetLid);

                if (!desafianteUid || !desafiadoUid) {
                    return await sock.sendMessage(from, { text: '❌ Um dos jogadores não está cadastrado no sistema!' }, { quoted: m });
                }

                const nomeDesafiante = playersData[desafianteUid]?.character?.charName || playersData[desafianteUid]?.nome || 'Desafiante';
                const nomeDesafiado = playersData[desafiadoUid]?.character?.charName || playersData[desafiadoUid]?.nome || 'Desafiado';

                const agora = Date.now();
                const tempoExpiracao = 24 * 60 * 60 * 1000;

                const desafioPayload = {
                    desafianteLid: senderLid,
                    desafianteNome: nomeDesafiante,
                    desafiadoLid: targetLid,
                    desafiadoNome: nomeDesafiado,
                    status: 'pendente',
                    criadoEm: agora,
                    expiraEm: agora + tempoExpiracao
                };

                await axios.put(`${FIREBASE_URL}/desafios/${groupIdClean}.json`, desafioPayload);

                if (timersDesafio[groupIdClean]) clearTimeout(timersDesafio[groupIdClean]);

                timersDesafio[groupIdClean] = setTimeout(async () => {
                    try {
                        const checkDesafio = await axios.get(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                        if (checkDesafio.data && checkDesafio.data.status === 'pendente') {
                            await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                            await sock.sendMessage(from, { text: `💀 *DERROTA POR W.O.!* O jogador *${nomeDesafiado}* não aceitou o desafio de Arena a tempo.` });
                        }
                    } catch (e) {}
                }, tempoExpiracao);

                const msgDesafio = `⚔️ *DESAFIO DE ARENA LANÇADO!* ⚔️\n\n` +
                                   `👤 *Desafiante:* ${nomeDesafiante}\n` +
                                   `🎯 *Desafiado:* ${nomeDesafiado}\n\n` +
                                   `⏳ @${targetLid}, você tem *24 horas* para responder digitando *!aceitar*.`;

                await sock.sendMessage(from, { text: msgDesafio, mentions: [mentionedJid] }, { quoted: m });
                return;
            }

            // COMANDO !ACEITAR
            if (text === '!aceitar') {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const desafioRes = await axios.get(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                const desafio = desafioRes.data;

                if (!desafio || desafio.status !== 'pendente') {
                    return await sock.sendMessage(from, { text: '❌ Não há nenhum desafio de Arena pendente neste grupo.' }, { quoted: m });
                }

                if (desafio.desafiadoLid !== senderLid) {
                    return await sock.sendMessage(from, { text: '❌ Apenas o desafiado pode aceitar este duelo!' }, { quoted: m });
                }

                if (timersDesafio[groupIdClean]) {
                    clearTimeout(timersDesafio[groupIdClean]);
                    delete timersDesafio[groupIdClean];
                }

                await axios.patch(`${FIREBASE_URL}/desafios/${groupIdClean}.json`, { status: 'aceito' });

                const p1 = { lid: desafio.desafianteLid, nome: desafio.desafianteNome };
                const p2 = { lid: desafio.desafiadoLid, nome: desafio.desafiadoNome };

                iniciarEstruturaBatalha(from, p1, p2, 'PVP', sock);

                const msgInicio = `⚔️ *COMBATE DE ARENA INICIADO!* ⚔️\n\n` +
                                   `🥊 *${p1.nome}* VS *${p2.nome}*\n\n` +
                                   `📝 Apresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;

                return await sock.sendMessage(from, { text: msgInicio });
            }

            // COMANDO !PROX
            if (text === '!prox') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'em_combate') return;

                if (bat.jogadorVez === 1) {
                    bat.jogadorVez = 2;
                } else {
                    bat.jogadorVez = 1;
                    bat.turnoAtual++;
                }

                const proximoJogadorObj = bat[`p${bat.jogadorVez}`];
                const nomeDoVez = proximoJogadorObj?.nome || `Jogador ${bat.jogadorVez}`;

                const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual} — VEZ DE ${nomeDoVez.toUpperCase()}*\n\n` +
                                     `⏳ *Tempo limite desta jogada:* 30 minutos.\n` +
                                     `👉 Digite *!prox* ao concluir sua jogada.`;

                await sock.sendMessage(from, { text: msgNovoTurno });

                const jidPvProx = formatarJidPv(proximoJogadorObj?.lid);
                if (jidPvProx) {
                    try {
                        await sock.sendMessage(jidPvProx, { text: `⚔️ *SUA VEZ!* Turno ${bat.turnoAtual} iniciado no grupo!\n\n👉 Responda no grupo e digite *!prox* ao terminar.` });
                    } catch (pvErr) {}
                }

                iniciarTimerTurnoMaximo(from, sock);
                return;
            }

            // COMANDO !WIN (Vitoria sobe 1 posição no Rank na Arena)
            if (text.startsWith('!win')) {
                const bat = batalhas[from];
                if (!bat) {
                    return await sock.sendMessage(from, { text: '❌ Não há nenhuma batalha ativa neste grupo!' }, { quoted: m });
                }

                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                let vencedorObj = null;
                let perdedorObj = null;

                const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

                if (mentionedJid) {
                    const targetLid = mentionedJid.split('@')[0].split(':')[0].trim();
                    if (bat.p1?.lid === targetLid) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
                    if (bat.p2?.lid === targetLid) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
                } else {
                    if (bat.p1?.lid === senderLid) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
                    else if (bat.p2?.lid === senderLid) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
                    else {
                        vencedorObj = bat[`p${bat.jogadorVez}`];
                        perdedorObj = bat.jogadorVez === 1 ? bat.p2 : bat.p1;
                    }
                }

                const nomeVencedor = vencedorObj?.nome || 'Combatente Vencedor';

                if (bat.tipo === 'COLISEU') {
                    try {
                        const tempAtual = await obterTemporadaAtual();

                        const [playersRes, coliseuRes] = await Promise.all([
                            axios.get(`${FIREBASE_URL}/players.json`),
                            axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
                        ]);

                        const playersData = playersRes.data || {};
                        const coliseuData = coliseuRes.data || {};

                        const uidVencedor = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === vencedorObj?.lid);
                        const uidPerdedor = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === perdedorObj?.lid);

                        if (uidVencedor && coliseuData[uidVencedor]) {
                            await axios.patch(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${uidVencedor}.json`, {
                                vitorias: (coliseuData[uidVencedor].vitorias || 0) + 1,
                                pontos: (coliseuData[uidVencedor].pontos || 0) + 2
                            });
                        }

                        if (uidPerdedor && coliseuData[uidPerdedor]) {
                            await axios.patch(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${uidPerdedor}.json`, {
                                derrotas: (coliseuData[uidPerdedor].derrotas || 0) + 1,
                                pontos: (coliseuData[uidPerdedor].pontos || 0) + 1
                            });
                        }
                    } catch (colErr) {
                        console.error('Erro ao somar pontos coliseu:', colErr.message);
                    }

                    const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                    await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${groupIdClean}.json`).catch(() => {});
                } else {
                    // LÓGICA DE SUBIR 1 POSIÇÃO NO RANKING ARENA
                    try {
                        const [rankRes, playersRes] = await Promise.all([
                            axios.get(`${FIREBASE_URL}/ranking.json`),
                            axios.get(`${FIREBASE_URL}/players.json`)
                        ]);

                        const rankingObj = rankRes.data || {};
                        const playersData = playersRes.data || {};

                        const uidVencedor = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === vencedorObj?.lid);

                        if (uidVencedor) {
                            const posAtualStr = Object.keys(rankingObj).find(pos => rankingObj[pos] === uidVencedor);

                            if (posAtualStr) {
                                const posAtual = parseInt(posAtualStr);

                                if (posAtual > 1) {
                                    const posAcima = posAtual - 1;
                                    const uidAcima = rankingObj[posAcima];

                                    const updates = {};
                                    updates[posAcima] = uidVencedor;
                                    updates[posAtual] = uidAcima || null;

                                    await axios.patch(`${FIREBASE_URL}/ranking.json`, updates);
                                }
                            }
                        }
                    } catch (rankUpErr) {
                        console.error('Erro ao subir no ranking:', rankUpErr.message);
                    }

                    const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                    await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`).catch(() => {});
                }

                const msgWin = `🏆 *VITÓRIA DECLARADA!* 🏆\n\n` +
                               `🎉 O combatente *${nomeVencedor}* venceu no *${bat.tipo === 'COLISEU' ? 'COLISEU' : 'ARENA'}* após *${bat.turnoAtual} rodadas*!\n\n` +
                               `${bat.tipo === 'COLISEU' ? '🏟️ Pontuação do Coliseu atualizada!' : '⚔️ *Ranking atualizado:* O vencedor subiu 1 posição!'}`;

                await sock.sendMessage(from, { text: msgWin });

                limparTimersBatalha(bat);
                delete batalhas[from];
                return;
            }

            // COMANDO !FIMCOMBATE
            if (text === '!fimcombate') {
                if (!batalhas[from]) return;

                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`).catch(() => {});
                await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${groupIdClean}.json`).catch(() => {});

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
