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

// Controle em memória das sessões ativas (Quiz, Batalhas e Timers de Desafios)
const jogosQuiz = {};
const batalhas = {};
const timersDesafio = {}; // Guarda os timeouts de 24h para W.O.

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

// Limpa timers de qualquer combate ativo
function limparTimersBatalha(batalha) {
    if (!batalha) return;
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

// Função auxiliar para formatar JID individual (PV) a partir de um LID/Número
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

        // Notifica no PV do jogador da vez
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

    // Notifica P1 no PV
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

// Estrutura modular para disparar combates em qualquer sistema (!battle, PVP, PVE, Boss)
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

            // COMANDO !DADO (1d100)
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

                                    // Envio do comprovante individual no PV
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

            // --- SISTEMA DE DESAFIOS NO FIREBASE (/desafios) COM REGRAS DE 24H ---

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
                const tempoExpiracao = 24 * 60 * 60 * 1000; // 24 Horas

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

                // Limpa timer anterior caso exista
                if (timersDesafio[groupIdClean]) clearTimeout(timersDesafio[groupIdClean]);

                // Configura a Derrota Automática por W.O. em 24 Horas
                timersDesafio[groupIdClean] = setTimeout(async () => {
                    try {
                        const checkDesafio = await axios.get(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                        if (checkDesafio.data && checkDesafio.data.status === 'pendente') {
                            await axios.delete(`${FIREBASE_URL}/desafios/${groupIdClean}.json`);
                            
                            const msgWO = `💀 *DERROTA POR W.O.!* 💀\n\n` +
                                          `🎯 O jogador *${nomeDesafiado}* não aceitou o desafio de *${nomeDesafiante}* dentro do prazo de 24 horas!\n\n` +
                                          `🏆 *Vitória automática concedida a:* ${nomeDesafiante}`;

                            await sock.sendMessage(from, { text: msgWO });

                            // Avisa o perdedor por W.O. no PV
                            const targetPvJid = formatarJidPv(targetLid);
                            if (targetPvJid) {
                                await sock.sendMessage(targetPvJid, { text: `💀 *DERROTA POR W.O.!*\nVocê não respondeu ao desafio de *${nomeDesafiante}* no prazo de 24 horas e acumulou uma derrota.` });
                            }

                            // Avisa o vencedor por W.O. no PV
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

                // Notifica o Desafiado no PV
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

                // Cancela o Timer do W.O. de 24h
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

            // COMANDO !CANCELAR (Cancelamento do Desafio pelo Desafiante)
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

            // --- GERENCIAMENTO DE COMBATE INDEPENDENTE DA ORIGEM ---

            // COMANDO !BATTLE (Combate rápido/avulso)
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

            // COMANDO !INICIAR (Acelera fase de apresentação)
            if (text === '!iniciar') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'apresentacao') return;

                await comecarCombateDeFato(from, sock);
                return;
            }

            // COMANDO !PROX (Passa o turno)
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

                // Notifica jogador da vez no PV
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

            // COMANDO !WIN (Declarar Vencedor)
            if (text.startsWith('!win')) {
                const bat = batalhas[from];
                if (!bat) {
                    return await sock.sendMessage(from, { text: '❌ Não há nenhuma batalha ativa neste grupo para declarar um vencedor!' }, { quoted: m });
                }

                const rawSender = m.key.participant || m.key.remoteJid || from;
                const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                let vencedorObj = null;

                // Verifica se mencionou alguém no comando (!win @vencedor)
                const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

                if (mentionedJid) {
                    const targetLid = mentionedJid.split('@')[0].split(':')[0].trim();
                    if (bat.p1?.lid === targetLid) vencedorObj = bat.p1;
                    if (bat.p2?.lid === targetLid) vencedorObj = bat.p2;
                } else {
                    // Se quem enviou o comando for P1 ou P2, assume ele como vencedor
                    if (bat.p1?.lid === senderLid) vencedorObj = bat.p1;
                    else if (bat.p2?.lid === senderLid) vencedorObj = bat.p2;
                    else vencedorObj = bat[`p${bat.jogadorVez}`]; // Caso seja um admin, assume o jogador da vez
                }

                const nomeVencedor = vencedorObj?.nome || 'Combatente Vencedor';

                // Atualiza o registro no Firebase caso seja um desafio registrado
                const groupIdClean = from.replace(/[^a-zA-Z0-9]/g, '_');
                await axios.patch(`${FIREBASE_URL}/desafios/${groupIdClean}.json`, { 
                    status: 'finalizado',
                    vencedor: nomeVencedor 
                }).catch(() => {});

                const msgWin = `🏆 *VITÓRIA DECLARADA!* 🏆\n\n` +
                               `🎉 O combatente *${nomeVencedor}* saiu vitorioso deste duelo após *${bat.turnoAtual} rodadas*!\n\n` +
                               `⚔️ O combate foi encerrado com sucesso.`;

                await sock.sendMessage(from, { text: msgWin });

                // Notifica o Vencedor no PV
                const pvVencedorJid = formatarJidPv(vencedorObj?.lid);
                if (pvVencedorJid) {
                    try {
                        await sock.sendMessage(pvVencedorJid, { 
                            text: `🏆 *PARABÉNS PELA VITÓRIA!*\n\nSua vitória no duelo de RPG em grupo foi confirmada pelo bot!` 
                        });
                    } catch (pvErr) {
                        console.error('[PV] Erro ao enviar declaração de vitória no PV:', pvErr.message);
                    }
                }

                // Encerra a batalha e limpa da memória
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
