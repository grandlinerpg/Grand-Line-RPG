const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys'); 
const express = require('express');
const axios = require('axios');
const Groq = require('groq-sdk');  

// NÚMERO DO BOT CONFIGURADO:
const NUMERO_BOT = "5511918448331"; 

// CHAVE DA GROQ:
const GROQ_KEY = process.env.GROQ_API_KEY || "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";

// INICIALIZAÇÃO DA IA GROQ
const groq = new Groq({ apiKey: GROQ_KEY });

// PERSONALIDADE DO PERSONAGEM (SYSTEM PROMPT)
const PERSONALIDADE_PERSONAGEM = `
Você é Monkey D. Luffy, capitão dos Chapéus de Palha do universo de One Piece.
- Responda SEMPRE como o personagem (use risadas típicas como "Nishishishi!", fale de carne, aventuras, mar de forma empolgada e simples).
- Responda sempre em Português.
- Mantenha respostas curtas e diretas (máximo de 2 a 3 frases), ideais para mensagens de WhatsApp.
- NUNCA saia do personagem, independentemente do que o usuário perguntar.
`;

// 1. SERVIDOR WEB + AUTO-PING (Render 24/7)
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
                console.log('[Auto-Ping] Bot mantido acordado.');
            } catch (err) {
                console.error('[Auto-Ping] Erro:', err.message);
            }
        }, 10 * 60 * 1000);
    }
});

// 2. WHATSAPP (BAILEYS VIA CÓDIGO DE PAREAMENTO)
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
                console.log('\n========================================');
                console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
                console.log('========================================\n');
            } catch (err) {
                console.error('[Pareamento] Erro ao solicitar código:', err.message);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Conexão encerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ [WhatsApp] Bot conectado e pronto para receber comandos!');
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

            console.log(`📩 [MSG RECEBIDA]: "${text}" | Remetente: ${from}`);

            // COMANDO !PING
            if (text === '!ping' || text.startsWith('!ping ')) {
                console.log('➡️ Executando !ping...');
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !DADO (1d100)
            if (text === '!dado' || text.startsWith('!dado ')) {
                console.log('➡️ Executando !dado...');
                const resultado = Math.floor(Math.random() * 100) + 1;
                const senderJid = m.key.participant || from;
                const senderNumber = senderJid.split('@')[0];

                const mensagemDado = `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +
                                     `👤 *Jogador:* @${senderNumber}\n` +
                                     `🎯 *Resultado:* *${resultado}*`;

                await sock.sendMessage(from, { 
                    text: mensagemDado, 
                    mentions: [senderJid] 
                }, { quoted: m });

                console.log(`✅ [Dado] Resultado ${resultado} enviado!`);
            }

            // COMANDO !INFO (BUSCA DADOS DO PRÓPRIO JOGADOR PELO NÚMERO)
            if (text === '!info' || text.startsWith('!info ')) {
                console.log('➡️ Executando !info...');

                try {
                    const response = await axios.get('https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com/players.json');
                    const playersData = response.data;

                    if (!playersData) {
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Banco de dados vazio.' }, { quoted: m });
                    }

                    const senderJid = m.key.participant || from;
                    const senderNumber = senderJid.split('@')[0];

                    // Procura o UID onde number[senderNumber] existe
                    const playerUid = Object.keys(playersData).find(uid => {
                        const playerNumbers = playersData[uid]?.number;
                        return playerNumbers && playerNumbers[senderNumber] !== undefined;
                    });

                    if (!playerUid) {
                        return await sock.sendMessage(from, { 
                            text: `❌ *Número não cadastrado!* (${senderNumber})` 
                        }, { quoted: m });
                    }

                    const player = playersData[playerUid];
                    const nome = player?.character?.charName || player?.nome || player?.name || 'Sem Nome';
                    const nivel = player?.info?.level ?? 1;
                    const exp = player?.info?.exp ?? 0;
                    const saldo = player?.info?.saldo ?? 0;

                    const infoText = `📜 *INFORMAÇÕES DO PERSONAGEM*\n\n` +
                                     `👤 *Nome:* ${nome}\n` +
                                     `⭐ *Nível:* ${nivel}\n` +
                                     `✨ *EXP:* ${exp}\n` +
                                     `💰 *Saldo:* ฿ ${saldo}`;

                    await sock.sendMessage(from, { text: infoText }, { quoted: m });
                    console.log(`✅ [Info] Dados de ${nome} enviados com sucesso!`);

                } catch (infoErr) {
                    console.error('❌ Erro no !info:', infoErr.message);
                    await sock.sendMessage(from, { text: '❌ Erro ao buscar informações do jogador.' }, { quoted: m });
                }
            }

            // COMANDO !RANK (BUSCA DIRETO DA REST API DO FIREBASE)
            if (text === '!rank' || text.startsWith('!rank ')) {
                console.log('➡️ Executando !rank via REST API...');

                try {
                    const response = await axios.get('https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com/players.json');
                    const playersData = response.data;

                    if (!playersData) {
                        console.log('⚠️ Nó "players" está vazio no Firebase.');
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhum jogador encontrado no banco de dados.' }, { quoted: m });
                    }

                    let rankText = `🏆 *RANK DE JOGADORES*\n\n`;
                    let contador = 1;

                    Object.keys(playersData).forEach((uid) => {
                        const player = playersData[uid];
                        
                        // Busca o nome do personagem
                        const nome = player?.character?.charName || player?.nome || player?.name || 'Sem Nome';
                        
                        // Busca o nível em players.uid.info.level
                        const nivel = player?.info?.level ?? 1;

                        // Troca os 3 primeiros pelas medalhas no início
                        let prefixo = `${contador}º`;
                        if (contador === 1) prefixo = '🥇';
                        else if (contador === 2) prefixo = '🥈';
                        else if (contador === 3) prefixo = '🥉';

                        // Formatação final: Ícone + Nome + (Nível)
                        rankText += `${prefixo} ${nome} (${nivel})\n\n`;

                        contador++;
                    });

                    await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
                    console.log('✅ Lista do !rank enviada com sucesso!');
                } catch (rankErr) {
                    console.error('❌ Erro no !rank REST:', rankErr.message);
                    await sock.sendMessage(from, { text: '❌ Erro ao buscar lista no Firebase.' }, { quoted: m });
                }
            }

            // COMANDO DE PERSONAGEM COM IA (!LUFFY)
            if (text === '!luffy' || text.startsWith('!luffy ')) {
                console.log('➡️ Executando conversa com IA (!luffy)...');
                
                const pergunta = rawText.replace(/^!luffy\s*/i, '').trim();

                if (!pergunta) {
                    return await sock.sendMessage(from, { 
                        text: '🍖 *Luffy:* "O que foi? Tá querendo me pedir carne?!" (Digite algo após !luffy)' 
                    }, { quoted: m });
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

                    const respostaIA = chatCompletion.choices[0]?.message?.content || "Nishishishi! Fiquei confuso e esqueci o que ia falar!";

                    await sock.sendMessage(from, { text: `🍖 *Luffy:* ${respostaIA}` }, { quoted: m });
                    console.log('✅ Resposta da IA enviada com sucesso!');

                } catch (iaErr) {
                    console.error('❌ Erro na API do Groq:', iaErr.message);
                    await sock.sendMessage(from, { 
                        text: '⚠️ *Luffy:* "Eita, deu um nó na minha cabeça!" (Erro ao conectar com a IA)' 
                    }, { quoted: m });
                }
            }

        } catch (err) {
            console.error('❌ Erro no processamento de mensagens:', err);
        }
    });
}

connectToWhatsApp();
