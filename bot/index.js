const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys'); 
const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk'); 

const NUMERO_BOT = "5511918448331"; 
const GROQ_KEY = process.env.GROQ_API_KEY || "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";
const FIREBASE_URL = "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com";

const groq = new Groq({ apiKey: GROQ_KEY });

const PERSONALIDADE_PERSONAGEM = `
Você é Monkey D. Luffy, capitão dos Chapéus de Palha do universo de One Piece.
- Responda SEMPRE como o personagem (use risadas típicas como "Nishishishi!", fale de carne, aventuras, mar de forma empolgada e simples).
- Responda sempre em Português.
- Mantenha respostas curtas e diretas (máximo de 2 a 3 frases), ideais para mensagens de WhatsApp.
- NUNCA saia do personagem, independentemente do que o usuário perguntar.
`;

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

// Controle em memória dos Quizzes em andamento
const jogosQuiz = {};

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
                const senderJid = m.key.participant || from;
                const senderIdentifier = senderJid.split('@')[0].split(':')[0];

                const mensagemDado = `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +
                                     `👤 *Jogador:* @${senderIdentifier}\n` +
                                     `🎯 *Resultado:* *${resultado}*`;

                await sock.sendMessage(from, { text: mensagemDado, mentions: [senderJid] }, { quoted: m });
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

                    const infoText = `📜 *INFORMAÇÕES DO PERSONAGEM*\n\n` +
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
                    const response = await axios.get(`${FIREBASE_URL}/players.json`);
                    const playersData = response.data;

                    if (!playersData) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhum jogador encontrado.' }, { quoted: m });
                    }

                    let rankText = `🏆 *RANK DE JOGADORES*\n\n`;
                    let contador = 1;

                    Object.keys(playersData).forEach((uid) => {
                        const player = playersData[uid];
                        const nome = player?.character?.charName || player?.nome || 'Sem Nome';
                        const nivel = player?.info?.level ?? 1;

                        let prefixo = `${contador}º`;
                        if (contador === 1) prefixo = '🥇';
                        else if (contador === 2) prefixo = '🥈';
                        else if (contador === 3) prefixo = '🥉';

                        rankText += `${prefixo} ${nome} (${nivel})\n\n`;
                        contador++;
                    });

                    await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
                } catch (rankErr) {
                    await sock.sendMessage(from, { text: '❌ Erro ao buscar lista no Firebase.' }, { quoted: m });
                }
            }

            // COMANDO !LUFFY
            if (text === '!luffy' || text.startsWith('!luffy ')) {
                const pergunta = rawText.replace(/^!luffy\s*/i, '').trim();
                if (!pergunta) {
                    return await sock.sendMessage(from, { text: '🍖 *Luffy:* "O que foi? Tá querendo me pedir carne?!"' }, { quoted: m });
                }

                try {
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            { role: "system", content: PERSONALIDADE_PERSONAGEM },
                            { role: "user", content: pergunta }
                        ],
                        model: "llama-3.3-70b-versatile",
                        temperature: 0.8,
                        max_tokens: 200
                    });

                    const respostaIA = chatCompletion.choices[0]?.message?.content || "Nishishishi! Fiquei confuso!";
                    await sock.sendMessage(from, { text: `🍖 *Luffy:* ${respostaIA}` }, { quoted: m });
                } catch (iaErr) {
                    await sock.sendMessage(from, { text: '⚠️ *Luffy:* "Eita, deu um nó na minha cabeça!"' }, { quoted: m });
                }
            }

            // --- SISTEMA DE QUIZ COM PERGUNTAS RANDÔMICAS ---

            // 1. INICIAR QUIZ
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

                    // Transforma o objeto de chaves ("001", "002", ...) em um Array
                    let listaPerguntas = Object.values(quizObj);

                    if (listaPerguntas.length === 0) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhuma pergunta disponível.' }, { quoted: m });
                    }

                    // Sorteia/Embaralha as perguntas (Algoritmo Fisher-Yates)
                    for (let i = listaPerguntas.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [listaPerguntas[i], listaPerguntas[j]] = [listaPerguntas[j], listaPerguntas[i]];
                    }

                    // Quantidade de perguntas por rodada
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

                    const primeiraPergunta = perguntasSorteadas[0].pergunta;
                    const numPerguntaAtual = 1;
                    const totalRodada = perguntasSorteadas.length;

                    await sock.sendMessage(from, { 
                        text: `🏴‍☠️ *O QUIZ DA GRAND LINE COMEÇOU!*\n\n💰 *Prêmio Total:* ฿ ${PREMIO_TOTAL}\n🎯 *Total de Perguntas:* ${totalRodada}\n\n*Pergunta ${numPerguntaAtual}/${totalRodada}:*\n${primeiraPergunta}` 
                    });
                    return;
                } catch (quizErr) {
                    console.error('❌ Erro ao buscar quiz no Firebase:', quizErr.message);
                    return await sock.sendMessage(from, { text: '❌ Erro ao carregar as perguntas do Firebase.' }, { quoted: m });
                }
            }

            // 2. VERIFICAR RESPOSTAS DO QUIZ
            if (jogosQuiz[from] && jogosQuiz[from].ativo) {
                const quiz = jogosQuiz[from];
                const perguntaObj = quiz.perguntas[quiz.perguntaAtual];

                if (text === String(perguntaObj.resposta).trim().toLowerCase()) {
                    const rawSender = m.key.participant || m.key.remoteJid || from;
                    const senderLid = rawSender.split('@')[0].split(':')[0].trim();

                    // Computa acerto
                    quiz.pontos[senderLid] = (quiz.pontos[senderLid] || 0) + 1;

                    // Monta Tabela
                    let tabela = `🎯 *ACERTOU!* @${senderLid} ganhou +1 ponto!\n\n📊 *TABELA DE PONTOS:*`;
                    const ranking = Object.entries(quiz.pontos).sort((a, b) => b[1] - a[1]);

                    ranking.forEach(([lid, pts], idx) => {
                        tabela += `\n${idx + 1}º | @${lid}: *${pts} pt(s)*`;
                    });

                    await sock.sendMessage(from, { 
                        text: tabela, 
                        mentions: ranking.map(([lid]) => `${lid}@lid`) 
                    }, { quoted: m });

                    quiz.perguntaAtual++;

                    // 3. FINALIZAR QUIZ E ENVIAR RECOMPENSA PARA O FIREBASE
                    if (quiz.perguntaAtual >= quiz.perguntas.length) {
                        quiz.ativo = false;

                        const totalPontos = Object.values(quiz.pontos).reduce((a, b) => a + b, 0);
                        let textoFinal = `🏆 *QUIZ FINALIZADO!*\n\n🎁 *DIVISÃO DO PRÊMIO (฿ ${quiz.premioTotal}):*\n`;

                        if (totalPontos === 0) {
                            textoFinal += "\nNinguém acertou nada! O prêmio não foi distribuído.";
                        } else {
                            const valorPorPonto = quiz.premioTotal / totalPontos;

                            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
                            const playersData = playersRes.data || {};

                            for (const [lid, pts] of Object.entries(quiz.pontos)) {
                                const premioJogador = Math.floor(pts * valorPorPonto);
                                textoFinal += `\n👤 @${lid}: *${pts} acerto(s)* ➔ Recebeu *฿ ${premioJogador}*`;

                                const playerUid = Object.keys(playersData).find(uid => {
                                    return String(playersData[uid]?.number?.LID || '').trim() === lid;
                                });

                                if (playerUid) {
                                    const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
                                    const novoSaldo = saldoAtual + premioJogador;

                                    await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, {
                                        saldo: novoSaldo
                                    });
                                    console.log(`✅ Saldo de ${playerUid} (LID ${lid}) atualizado para ฿ ${novoSaldo}`);
                                }
                            }
                        }

                        await sock.sendMessage(from, { text: textoFinal });
                        delete jogosQuiz[from];
                        return;
                    }

                    // Próxima Pergunta Sorteada
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

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
