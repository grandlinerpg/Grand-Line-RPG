const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys'); 
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

// NÚMERO DO BOT CONFIGURADO:
const NUMERO_BOT = "5511918448331"; 

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

// 2. CONEXÃO COM O FIREBASE (REALTIME DATABASE)
try {
    let serviceAccount;

    if (process.env.FIREBASE_KEY) {
        serviceAccount = typeof process.env.FIREBASE_KEY === 'string' 
            ? JSON.parse(process.env.FIREBASE_KEY) 
            : process.env.FIREBASE_KEY;
    } else {
        serviceAccount = require('./firebase-key.json');
    }

    // Tratamento rigoroso para corrigir quebras de linha enviadas pela Render
    if (serviceAccount && serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/^"|"$/g, '')
            .trim();
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
        });
    }

    console.log('✅ [Firebase] SDK Admin inicializado!');
} catch (e) {
    console.error('❌ [Firebase] Erro ao carregar credenciais:', e.message);
}

const db = admin.apps.length ? admin.database() : null;

// 3. WHATSAPP (BAILEYS VIA CÓDIGO DE PAREAMENTO)
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

            // COMANDO !RANK (LISTA SIMPLES DE JOGADORES)
            if (text === '!rank' || text.startsWith('!rank ')) {
                console.log('➡️ Executando !rank...');

                if (!db) {
                    console.log('❌ DB (Firebase) não inicializado.');
                    return await sock.sendMessage(from, { text: '⚠️ Firebase não inicializado.' }, { quoted: m });
                }

                try {
                    console.log('🔍 Buscando dados no nó "players"...');
                    const snapshot = await db.ref('players').once('value');

                    if (!snapshot.exists()) {
                        console.log('⚠️ Nó "players" está vazio no Firebase.');
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhum jogador encontrado no banco de dados.' }, { quoted: m });
                    }

                    const playersData = snapshot.val();
                    let rankText = `📋 *LISTA DE JOGADORES*\n\n`;
                    let contador = 1;

                    Object.keys(playersData).forEach(uid => {
                        const player = playersData[uid];
                        const nome = player?.character?.charName || player?.nome || player?.name || 'Sem Nome';

                        rankText += `${contador}. ${nome}\n`;
                        contador++;
                    });

                    await sock.sendMessage(from, { text: rankText }, { quoted: m });
                    console.log('✅ Lista do !rank enviada com sucesso!');
                } catch (rankErr) {
                    console.error('❌ Erro no !rank:', rankErr.message);
                    await sock.sendMessage(from, { text: '❌ Erro ao buscar lista no Firebase.' }, { quoted: m });
                }
            }
        } catch (err) {
            console.error('❌ Erro no processamento de mensagens:', err);
        }
    });
}

connectToWhatsApp();
