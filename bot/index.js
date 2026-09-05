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

// Armazenamento em memória
const jogosQuiz = {};
const batalhas = {};

// --- FUNÇÕES UTILITÁRIAS ---

function obterEmojiFaccao(faccao) {
    if (!faccao) return '🏴‍☠️';
    const faccaoLimpa = String(faccao).trim().toLowerCase();
    if (faccaoLimpa.includes('exército revolucionário') || faccaoLimpa.includes('exercito revolucionario')) return '⚔️';
    if (faccaoLimpa.includes('governo mundial')) return '⚓';
    if (faccaoLimpa.includes('piratas') || faccaoLimpa.includes('pirata')) return '🏴‍☠️';
    return '🏴‍☠️';
}

async function buscarNomePersonagem(lid) {
    try {
        const response = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = response.data || {};
        const playerUid = Object.keys(playersData).find(uid => 
            String(playersData[uid]?.number?.LID || '').trim() === lid
        );

        if (playerUid) {
            return {
                uid: playerUid,
                nome: playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador",
                dados: playersData[playerUid]
            };
        }
    } catch (e) {
        console.error("Erro ao buscar dados do jogador no Firebase:", e.message);
    }
    return { uid: null, nome: "Lutador", dados: null };
}

// --- NÚCLEO DO SISTEMA DE COMBATE (REUTILIZÁVEL) ---

function limparTimersBatalha(batalha) {
    if (batalha.timerApresentacao) clearTimeout(batalha.timerApresentacao);
    if (batalha.timerTurno) clearTimeout(batalha.timerTurno);
}

function iniciarTimerTurnoMaximo(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat) return;

    if (bat.timerTurno) clearTimeout(bat.timerTurno);

    bat.timerTurno = setTimeout(async () => {
        if (!batalhas[groupId]) return;

        const nomeDoVez = bat.jogadorVez === 1 ? bat.p1Nome : bat.p2Nome;

        await sock.sendMessage(groupId, { 
            text: `⏰ *TEMPO ESGOTADO!* O limite de 30 minutos para a jogada de *${nomeDoVez}* (Turno ${bat.turnoAtual}) acabou!\nPassando a vez...` 
        });

        avancarTurno(groupId, sock);
    }, 30 * 60 * 1000);
}

async function comecarCombateDeFato(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat || bat.fase !== 'apresentacao') return;

    if (bat.timerApresentacao) clearTimeout(bat.timerApresentacao);

    bat.fase = 'em_combate';
    bat.turnoAtual = 1;
    bat.jogadorVez = 1;

    const msgComeco = `⏰ *TEMPO DE APRESENTAÇÃO ENCERRADO!*\n\n` +
                      `⚔️ *TURNO 1 INICIADO*\n` +
                      `👤 *Vez de:* ${bat.p1Nome}\n` +
                      `⏳ *Tempo limite para esta jogada:* 30 minutos.\n\n` +
                      `👉 Digite *!passar* ou *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgComeco });
    iniciarTimerTurnoMaximo(groupId, sock);
}

// Inicializador genérico: pode ser invocado por !battle, !duelo, !arena, etc.
async function criarSessaoCombate(groupId, p1Lid, p1Nome, p2Lid = null, p2Nome = "Jogador 2", tipoCombate = "Livre", sock) {
    if (batalhas[groupId]) return false;

    batalhas[groupId] = {
        tipo: tipoCombate,
        fase: 'apresentacao',
        turnoAtual: 1,
        jogadorVez: 1,
        p1Lid: p1Lid,
        p1Nome: p1Nome,
        p2Lid: p2Lid,
        p2Nome: p2Nome,
        timerApresentacao: null,
        timerTurno: null
    };

    const msgInicio = `⚔️ *COMBATE INICIADO (${tipoCombate.toUpperCase()})!* ⚔️\n\n` +
                      `🥊 *Desafiante:* ${p1Nome}\n` +
                      `🎯 *Oponente:* ${p2Nome}\n\n` +
                      `📝 Os lutadores têm *5 minutos* para apresentar seu *Card Combatente* no grupo!\n\n` +
                      `👉 Digite *!iniciar* para começar o Turno 1 imediatamente.`;

    await sock.sendMessage(groupId, { text: msgInicio });

    batalhas[groupId].timerApresentacao = setTimeout(() => {
        comecarCombateDeFato(groupId, sock);
    }, 5 * 60 * 1000);

    return true;
}

async function avancarTurno(groupId, sock) {
    const bat = batalhas[groupId];
    if (!bat || bat.fase !== 'em_combate') return;

    if (bat.jogadorVez === 1) {
        bat.jogadorVez = 2;
    } else {
        bat.jogadorVez = 1;
        bat.turnoAtual++;
    }

    const proximoNome = bat.jogadorVez === 1 ? bat.p1Nome : bat.p2Nome;

    const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual} — VEZ DE ${proximoNome.toUpperCase()}*\n\n` +
                         `⏳ *Tempo limite desta jogada:* 30 minutos.\n` +
                         `👉 Digite *!passar* ou *!prox* ao concluir sua jogada.`;

    await sock.sendMessage(groupId, { text: msgNovoTurno });
    iniciarTimerTurnoMaximo(groupId, sock);
}

function encerrarCombate(groupId) {
    if (!batalhas[groupId]) return false;
    limparTimersBatalha(batalhas[groupId]);
    delete batalhas[groupId];
    return true;
}

// --- CONEXÃO WHATSAPP ---

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

            const rawSender = m.key.participant || m.key.remoteJid || from;
            const senderLid = rawSender.split('@')[0].split(':')[0].trim();

            // COMANDO !PING
            if (text === '!ping' || text.startsWith('!ping ')) {
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !DADO
            if (text === '!dado' || text.startsWith('!dado ')) {
                const resultado = Math.floor(Math.random() * 100) + 1;
                const player = await buscarNomePersonagem(senderLid);

                const mensagemDado = `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +
                                     `👤 *Jogador:* ${player.nome}\n` +
                                     `🎯 *Resultado:* *${resultado}*`;

                await sock.sendMessage(from, { text: mensagemDado }, { quoted: m });
            }

            // COMANDO !INFO
            if (text === '!info' || text.startsWith('!info ')) {
                const player = await buscarNomePersonagem(senderLid);

                if (!player.uid) {
                    return await sock.sendMessage(from, { text: `❌ *LID não cadastrado!* (${senderLid})` }, { quoted: m });
                }

                const data = player.dados;
                const nivel = data?.info?.level ?? 1;
                const exp = data?.info?.exp ?? 0;
                const saldo = data?.info?.saldo ?? 0;

                const infoText = `*📜 — INFORMAÇÕES — 📜*\n\n` +
                                 `👤 *Nome:* ${player.nome}\n` +
                                 `⭐ *Nível:* ${nivel}\n` +
                                 `✨ *EXP:* ${exp}\n` +
                                 `💰 *Saldo:* ฿ ${saldo}`;

                await sock.sendMessage(from, { text: infoText }, { quoted: m });
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
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhuma pergunta encontrada.' }, { quoted: m });
                    }

                    let listaPerguntas = Object.values(quizObj);
                    if (listaPerguntas.length === 0) return;

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

                    await sock.sendMessage(from, { 
                        text: `🏴‍☠️ *O QUIZ DA GRAND LINE COMEÇOU!*\n\n💰 *Prêmio Total:* ฿ ${PREMIO_TOTAL}\n🎯 *Total de Perguntas:* ${perguntasSorteadas.length}` 
                    });

                    setTimeout(async () => {
                        await sock.sendMessage(from, {
                            text: `❓ *PRIMEIRA PERGUNTA (1/${perguntasSorteadas.length}):*\n\n${perguntasSorteadas[0].pergunta}`
                        });
                    }, 2000);

                    return;
                } catch (quizErr) {
                    return await sock.sendMessage(from, { text: '❌ Erro ao carregar o Quiz.' }, { quoted: m });
                }
            }

            if (jogosQuiz[from] && jogosQuiz[from].ativo) {
                const quiz = jogosQuiz[from];
                const perguntaObj = quiz.perguntas[quiz.perguntaAtual];

                if (text === String(perguntaObj.resposta).trim().toLowerCase()) {
                    const player = await buscarNomePersonagem(senderLid);

                    quiz.pontos[senderLid] = (quiz.pontos[senderLid] || 0) + 1;

                    let tabela = `🎯 *ACERTOU!* *${player.nome}* ganhou +1 ponto!\n\n📊 *TABELA DE PONTOS:*`;
                    const ranking = Object.entries(quiz.pontos).sort((a, b) => b[1] - a[1]);

                    for (const [lid, pts] of ranking) {
                        const pData = await buscarNomePersonagem(lid);
                        tabela += `\n*${pData.nome}*: *${pts} pt(s)*`;
                    }

                    await sock.sendMessage(from, { text: tabela }, { quoted: m });

                    quiz.perguntaAtual++;

                    if (quiz.perguntaAtual >= quiz.perguntas.length) {
                        quiz.ativo = false;

                        const totalPontos = Object.values(quiz.pontos).reduce((a, b) => a + b, 0);
                        let textoFinal = `🏆 *QUIZ FINALIZADO!*\n\n🎁 *DIVISÃO DO PRÊMIO (฿ ${quiz.premioTotal}):*\n`;

                        if (totalPontos > 0) {
                            const valorPorPonto = quiz.premioTotal / totalPontos;

                            for (const [lid, pts] of Object.entries(quiz.pontos)) {
                                const premioJogador = Math.floor(pts * valorPorPonto);
                                const pData = await buscarNomePersonagem(lid);

                                textoFinal += `\n👤 *${pData.nome}*: *${pts} acerto(s)* ➔ Recebeu *฿ ${premioJogador}*`;

                                if (pData.uid) {
                                    const saldoAtual = pData.dados?.info?.saldo ?? 0;
                                    await axios.patch(`${FIREBASE_URL}/players/${pData.uid}/info.json`, {
                                        saldo: saldoAtual + premioJogador
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
                        await sock.sendMessage(from, { 
                            text: `❓ *PRÓXIMA PERGUNTA (${quiz.perguntaAtual + 1}/${quiz.perguntas.length}):*\n\n${proxima.pergunta}` 
                        });
                    }, 2000);
                }
            }

            // --- SISTEMA DE COMBATE E COMANDOS DEDICADOS ---

            // 1. Comando principal de início rápido
            if (text === '!battle') {
                const player = await buscarNomePersonagem(senderLid);
                const iniciado = await criarSessaoCombate(from, senderLid, player.nome, null, "Jogador 2", "Treino", sock);
                
                if (!iniciado) {
                    await sock.sendMessage(from, { text: '⚠️ Já existe um combate em andamento neste grupo!' }, { quoted: m });
                }
                return;
            }

            // 2. Acelerador da fase de cards
            if (text === '!iniciar') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'apresentacao') return;
                await comecarCombateDeFato(from, sock);
                return;
            }

            // 3. Controle manual de passagem de turno
            if (text === '!passar' || text === '!prox') {
                const bat = batalhas[from];
                if (!bat || bat.fase !== 'em_combate') return;
                await avancarTurno(from, sock);
                return;
            }

            // 4. Encerramento forçado
            if (text === '!fimcombate') {
                const encerrado = encerrarCombate(from);
                if (encerrado) {
                    await sock.sendMessage(from, { text: '🏳️ *Combate encerrado com sucesso!*' }, { quoted: m });
                }
                return;
            }

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
