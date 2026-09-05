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

// Controle em memória das sessões ativas
const jogosQuiz = {};
const batalhas = {};
const timersDesafio = {};

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

// Limpa timers de qualquer combate ativo
function limparTimersBatalha(batalha) {
    if (!batalha) return;
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

// Formata JID para mensagem privada (PV)
function formatarJidPv(lid) {
    if (!lid) return null;
    const cleanLid = String(lid).split('@')[0].split(':')[0].trim();
    return `${cleanLid}@s.whatsapp.net`;
}

// Inicia/Reinicia o timer de 30 minutos para o turno do jogador atual
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
            } catch (pvErr) {
                console.error('[PV] Erro ao avisar turno no PV:', pvErr.message);
            }
        }

        iniciarTimerTurnoMaximo(groupId, sock);
    }, 30 * 60 * 1000);
}

// Transição do tempo de apresentação para o Turno 1
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
                      `⚔️ *TURNO 1 INICIADO*\n` +
                      `👥 *Luta:* ${p1Nome} VS ${p2Nome}\n` +
                      `👤 *Vez inicial:* ${p1Nome}\n` +
                      `⏳ *Tempo limite para esta jogada:* 30 minutos.\n\n` +
                      `👉 Digite *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgComeco });

    const p1Jid = formatarJidPv(bat.p1?.lid);
    if (p1Jid) {
        try {
            await sock.sendMessage(p1Jid, { text: `⚔️ *O COMBATE COMEÇOU!* É a sua vez (Turno 1) contra *${p2Nome}*.\n\n👉 Envie sua jogada no grupo e digite *!prox*.` });
        } catch (pvErr) {
            console.error('[PV] Erro ao enviar início para P1:', pvErr.message);
        }
    }

    iniciarTimerTurnoMaximo(groupId, sock);
}

// Estrutura modular para disparar combates
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

            // --- SISTEMA DO COLISEU ---

            // COMANDO !INSCREVER (Custa ฿ 20.000)
            if (text === '!inscrever' || text.startsWith('!inscrever ')) {
                try {
                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                    const [playersRes, coliseuRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/players.json`),
                        axios.get(`${FIREBASE_URL}/coliseu/jogadores.json`)
                    ]);

                    const playersData = playersRes.data || {};
                    const coliseuData = coliseuRes.data || {};

                    const playerUid = Object.keys(playersData).find(uid => {
                        return String(playersData[uid]?.number?.LID || '').trim() === senderLid;
                    });

                    if (!playerUid) {
                        return await sock.sendMessage(from, { text: '❌ Você precisa de um personagem cadastrado no sistema para se inscrever!' }, { quoted: m });
                    }

                    if (coliseuData[playerUid]) {
                        return await sock.sendMessage(from, { text: '⚠️ Você já está inscrito na temporada atual do Coliseu!' }, { quoted: m });
                    }

                    const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
                    const TAXA_INSCRICAO = 20000;

                    if (saldoAtual < TAXA_INSCRICAO) {
                        return await sock.sendMessage(from, { text: `❌ Saldo insuficiente! A taxa de inscrição no Coliseu custa *฿ ${TAXA_INSCRICAO}* e você possui apenas *฿ ${saldoAtual}*.` }, { quoted: m });
                    }

                    // Desconta a taxa e inscreve o jogador
                    const novoSaldo = saldoAtual - TAXA_INSCRICAO;
                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { saldo: novoSaldo });

                    await axios.put(`${FIREBASE_URL}/coliseu/jogadores/${playerUid}.json`, {
                        vitorias: 0,
                        derrotas: 0,
                        pontos: 0,
                        inscritoEm: Date.now()
                    });

                    const nomeChar = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || 'Combatente';

                    const msgSucesso = `🏟 *INSCRIÇÃO CONFIRMADA NO COLISEU!* 🏟\n\n` +
                                       `👤 *Lutador:* ${nomeChar}\n` +
                                       `💰 *Taxa Paga:* ฿ ${TAXA_INSCRICAO}\n` +
                                       `💳 *Novo Saldo:* ฿ ${novoSaldo}\n\n` +
                                       `⚔️ Boa sorte na Corrida da Temporada! Digite *!coliseu* para conferir a tabela.`;

                    return await sock.sendMessage(from, { text: msgSucesso }, { quoted: m });
                } catch (inscErr) {
                    console.error('Erro na inscrição do coliseu:', inscErr.message);
                    return await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar sua inscrição no Coliseu.' }, { quoted: m });
                }
            }

            // COMANDO !COLISEU
            if (text === '!coliseu' || text.startsWith('!coliseu ')) {
                try {
                    const [coliseuRes, playersRes, infoColiseuRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/coliseu/jogadores.json`),
                        axios.get(`${FIREBASE_URL}/players.json`),
                        axios.get(`${FIREBASE_URL}/coliseu/info.json`)
                    ]);

                    const coliseuData = coliseuRes.data || {};
                    const playersData = playersRes.data || {};
                    const coliseuInfo = infoColiseuRes.data || { temporada: 1, periodo: '01/09 ~ 31/09' };

                    const inscritosUids = Object.keys(coliseuData);

                    if (inscritosUids.length === 0) {
                        return await sock.sendMessage(from, { text: '🏟 *O Coliseu ainda não possui lutadores inscritos nesta temporada!*\n\n👉 Digite *!inscrever* por ฿ 20.000 para participar.' }, { quoted: m });
                    }

                    // Ordena por Pontos desc, Vitórias desc, Derrotas asc
                    inscritosUids.sort((a, b) => {
                        const pA = coliseuData[a];
                        const pB = coliseuData[b];
                        if ((pB.pontos || 0) !== (pA.pontos || 0)) {
                            return (pB.pontos || 0) - (pA.pontos || 0);
                        }
                        if ((pB.vitorias || 0) !== (pA.vitorias || 0)) {
                            return (pB.vitorias || 0) - (pA.vitorias || 0);
                        }
                        return (pA.derrotas || 0) - (pB.derrotas || 0);
                    });

                    let coliseuText = `🏟 *— COLISEU CORRIDA —* 🏟\n` +
                                      `🏆 *— TEMPORADA ${coliseuInfo.temporada} — 🏆*\n\n` +
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
                    console.error('Erro ao exibir coliseu:', colErr.message);
                    await sock.sendMessage(from, { text: '❌ Erro ao carregar as informações do Coliseu.' }, { quoted: m });
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

                                    const pvJid = formatarJidPv(lid);
                                    if (pvJid) {
                                        try {
                                            await sock.sendMessage(pvJid, { 
                                                text: `💰 *PREMIAÇÃO DO QUIZ!*\n\nParabéns! Você acertou *${pts}* pergunta(s) e recebeu *฿ ${premioJogador}* na sua conta!\n\n` +
                                                      `💳 *Saldo Anterior:* ฿ ${saldoAtual}\n` +
                                                      `💳 *Novo Saldo:* ฿ ${novoSaldo}` 
                                            });
                                        } catch (pvErr) {
                                            console.error('[PV] Erro ao enviar prêmio no PV:', pvErr.message);
                                        }
                                    }
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

            // --- DESAFIOS & BATALHAS ---

            // COMANDO !DESAFIAR (@mencao)
            if (text.startsWith('!desafiar')) {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');

                if (batalhas[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um combate rodando neste grupo!' }, { quoted: m });
                }

                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (!mentionedJid) {
                    return await sock.sendMessage(from, { text: '❌ Você precisa marcar o jogador que deseja desafiar!\nExemplo: *!desafiar @jogador*' }, { quoted: m });
                }

                const targetLid = mentionedJid.split('@')[0].split(':')[0].trim();

                if (senderLid === targetLid) {
                    return await sock.sendMessage(from, { text: '❌ Você não pode desafiar a si mesmo!' }, { quoted: m });
                }

                const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
                const playersData = playersRes.data || {};

                const desafianteUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === senderLid);
                const desafiadoUid = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === targetLid);

                if (!desafianteUid) {
                    return await sock.sendMessage(from, { text: '❌ Seu perfil não foi encontrado no banco de dados!' }, { quoted: m });
                }
                if (!desafiadoUid) {
                    return await sock.sendMessage(from, { text: '❌ O jogador desafiado não possui cadastro no sistema!' }, { quoted: m });
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
                            
                            const msgWO = `💀 *DERROTA POR W.O.!* 💀\n\n` +
                                          `🎯 O jogador *${nomeDesafiado}* não aceitou o desafio de *${nomeDesafiante}* dentro do prazo de 24 horas!\n\n` +
                                          `🏆 *Vitória automática concedida a:* ${nomeDesafiante}`;

                            await sock.sendMessage(from, { text: msgWO });

                            const targetPvJid = formatarJidPv(targetLid);
                            if (targetPvJid) {
                                await sock.sendMessage(targetPvJid, { text: `💀 *DERROTA POR W.O.!*\nVocê não respondeu ao desafio de *${nomeDesafiante}* no prazo de 24 horas e acumulou uma derrota.` });
                            }

                            const senderPvJid = formatarJidPv(senderLid);
                            if (senderPvJid) {
                                await sock.sendMessage(senderPvJid, { text: `🏆 *VITÓRIA POR W.O.!*\nO jogador *${nomeDesafiado}* não aceitou seu desafio a tempo. Você venceu automaticamente!` });
                            }
                        }
                    } catch (woErr) {
                        console.error('Erro ao processar W.O.:', woErr.message);
                    }
                }, tempoExpiracao);

                const msgDesafio = `⚔️ *DESAFIO DE COMBATE LANÇADO!* ⚔️\n\n` +
                                   `👤 *Desafiante:* ${nomeDesafiante}\n` +
                                   `🎯 *Desafiado:* ${nomeDesafiado}\n\n` +
                                   `⏳ @${targetLid}, você tem *24 horas* para responder digitando *!aceitar*.\n` +
                                   `⚠️ *Aviso:* Caso não aceite a tempo, será declarada *Derrota por W.O.* automática!`;

                await sock.sendMessage(from, { text: msgDesafio, mentions: [mentionedJid] }, { quoted: m });

                const pvTargetJid = formatarJidPv(targetLid);
                if (pvTargetJid) {
                    try {
                        await sock.sendMessage(pvTargetJid, { 
                            text: `⚔️ *VOCÊ FOI DESAFIADO!*\n\n` +
                                  `👤 *Desafiante:* ${nomeDesafiante}\n` +
                                  `⏳ *Prazo:* 24 Horas\n\n` +
                                  `👉 Vá até o grupo e digite *!aceitar* para encarar o duelo ou perca por W.O.!` 
                        });
                    } catch (pvErr) {
                        console.error('[PV] Erro ao notificar desafio no PV:', pvErr.message);
                    }
                }

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
                    return await sock.sendMessage(from, { text: '❌ Não há nenhum desafio pendente neste grupo.' }, { quoted: m });
                }

                if (desafio.desafiadoLid !== senderLid) {
                    return await sock.sendMessage(from, { text: '❌ Apenas o jogador desafiado pode aceitar este duelo!' }, { quoted: m });
                }

                if (timersDesafio[groupIdClean]) {
                    clearTimeout(timersDesafio[groupIdClean]);
                    delete timersDesafio[groupIdClean];
                }

                await axios.patch(`${FIREBASE_URL}/desafios/${groupIdClean}.json`, { status: 'aceito' });

                const p1 = { lid: desafio.desafianteLid, nome: desafio.desafianteNome };
                const p2 = { lid: desafio.desafiadoLid, nome: desafio.desafiadoNome };

                iniciarEstruturaBatalha(from, p1, p2, 'PVP', sock);

                const msgInicio = `⚔️ *DESAFIO ACEITO! COMBATE INICIADO!* ⚔️\n\n` +
                                   `🥊 *${p1.nome}* VS *${p2.nome}*\n\n` +
                                   `📝 Os lutadores têm *5 minutos* para apresentarem seu *Card Combatente* no grupo!\n\n` +
                                   `👉 Caso já tenham enviado os cards, digite *!iniciar* para começar o Turno 1 imediatamente.`;

                return await sock.sendMessage(from, { text: msgInicio });
            }

            // COMANDO !CANCELAR
            if (text === '!cancelar') {
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                const desafioRes = await axios.get(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                const desafio = desafioRes.data;

                if (!desafio || desafio.status !== 'pendente') {
                    return await sock.sendMessage(from, { text: '❌ Não há nenhum desafio pendente para cancelar.' }, { quoted: m });
                }

                if (desafio.desafianteLid !== senderLid) {
                    return await sock.sendMessage(from, { text: '❌ Apenas quem enviou o desafio pode cancelá-lo!' }, { quoted: m });
                }

                if (timersDesafio[groupIdClean]) {
                    clearTimeout(timersDesafio[groupIdClean]);
                    delete timersDesafio[groupIdClean];
                }

                await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                return await sock.sendMessage(from, { text: '🚫 *Desafio cancelado pelo desafiante!*' });
            }

            // COMANDO !BATTLE
            if (text === '!battle') {
                if (batalhas[from]) {
                    return await sock.sendMessage(from, { text: '⚠️ Já existe um combate em andamento neste grupo!' }, { quoted: m });
                }

                const p1 = { lid: null, nome: 'Jogador 1' };
                const p2 = { lid: null, nome: 'Jogador 2' };

                iniciarEstruturaBatalha(from, p1, p2, 'RAPIDO', sock);

                const msgInicio = `⚔️ *COMBATE RÁPIDO INICIADO!* ⚔️\n\n` +
                                  `📝 Os lutadores têm *5 minutos* para apresentarem seu *Card Combatente* no grupo!\n\n` +
                                  `👉 Caso já tenham enviado os cards, digite *!iniciar* para começar o Turno 1 imediatamente.`;

                return await sock.sendMessage(from, { text: msgInicio });
            }

            // COMANDO !INICIAR
            if (text === '!iniciar') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'apresentacao') return;

                await comecarCombateDeFato(from, sock);
                return;
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
                    } catch (pvErr) {
                        console.error('[PV] Erro ao notificar vez no PV:', pvErr.message);
                    }
                }

                iniciarTimerTurnoMaximo(from, sock);
                return;
            }

            // COMANDO !WIN (Com Atualização Automática do Coliseu)
            if (text.startsWith('!win')) {
                const bat = batalhas[from];
                if (!bat) {
                    return await sock.sendMessage(from, { text: '❌ Não há nenhuma batalha ativa neste grupo para declarar um vencedor!' }, { quoted: m });
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

                // Lógica de Atualização Automática das Pontuações do COLISEU
                try {
                    const [playersRes, coliseuRes] = await Promise.all([
                        axios.get(`${FIREBASE_URL}/players.json`),
                        axios.get(`${FIREBASE_URL}/coliseu/jogadores.json`)
                    ]);

                    const playersData = playersRes.data || {};
                    const coliseuData = coliseuRes.data || {};

                    const uidVencedor = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === vencedorObj?.lid);
                    const uidPerdedor = Object.keys(playersData).find(u => String(playersData[u]?.number?.LID || '').trim() === perdedorObj?.lid);

                    // Se ambos estiverem cadastrados no Coliseu, atualiza os pontos: +2 pro Vencedor, +1 pro Perdedor
                    if (uidVencedor && coliseuData[uidVencedor]) {
                        const vCol = coliseuData[uidVencedor];
                        await axios.patch(`${FIREBASE_URL}/coliseu/jogadores/${uidVencedor}.json`, {
                            vitorias: (vCol.vitorias || 0) + 1,
                            pontos: (vCol.pontos || 0) + 2
                        });
                    }

                    if (uidPerdedor && coliseuData[uidPerdedor]) {
                        const pCol = coliseuData[uidPerdedor];
                        await axios.patch(`${FIREBASE_URL}/coliseu/jogadores/${uidPerdedor}.json`, {
                            derrotas: (pCol.derrotas || 0) + 1,
                            pontos: (pCol.pontos || 0) + 1
                        });
                    }
                } catch (colUpdateErr) {
                    console.error('Erro ao atualizar pontuação do coliseu:', colUpdateErr.message);
                }

                // Atualiza no Firebase o status do desafio
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                await axios.patch(`${FIREBASE_URL}/desafios/${groupIdClean}.json`, { 
                    status: 'finalizado',
                    vencedor: nomeVencedor 
                }).catch(() => {});

                const msgWin = `🏆 *VITÓRIA DECLARADA!* 🏆\n\n` +
                               `🎉 O combatente *${nomeVencedor}* saiu vitorioso deste duelo após *${bat.turnoAtual} rodadas*!\n\n` +
                               `⚔️ O combate foi encerrado e os pontos do Coliseu foram computados com sucesso.`;

                await sock.sendMessage(from, { text: msgWin });

                const pvVencedorJid = formatarJidPv(vencedorObj?.lid);
                if (pvVencedorJid) {
                    try {
                        await sock.sendMessage(pvVencedorJid, { 
                            text: `🏆 *PARABÉNS PELA VITÓRIA!*\n\nSua vitória no duelo de RPG foi confirmada e seus pontos no Coliseu foram computados!` 
                        });
                    } catch (pvErr) {
                        console.error('[PV] Erro ao enviar declaração de vitória no PV:', pvErr.message);
                    }
                }

                limparTimersBatalha(bat);
                delete batalhas[from];
                return;
            }

            // COMANDO !FIMCOMBATE
            if (text === '!fimcombate') {
                if (!batalhas[from]) return;

                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`).catch(() => {});

                limparTimersBatalha(batalhas[from]);
                delete batalhas[from];
                return await sock.sendMessage(from, { text: '🏳️ *Combate encerrado e dados limpos com sucesso!*' }, { quoted: m });
            }

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
