const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys'); 
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

// NÚMERO DO BOT CONFIGURADO:
const NUMERO_BOT = "5511943566512";  

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
        serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    } else {
        serviceAccount = require('./firebase-key.json');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
    });
    console.log('✅ [Firebase] SDK Admin conectado com sucesso!');
} catch (e) {
    console.log('❌ [Firebase] Erro ao carregar credenciais:', e.message);
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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            const m = messages[0];
            if (!m || !m.message || m.key.fromMe) return;

            // Pega o texto de mensagens normais, respostas ou mídias com legenda
            const rawText = m.message.conversation || 
                            m.message.extendedTextMessage?.text || 
                            m.message.imageMessage?.caption || 
                            m.message.videoMessage?.caption || '';
            
            const text = rawText.trim().toLowerCase();
            const from = m.key.remoteJid;

            console.log(`📩 [MSG RECEBIDA]: "${text}" | De: ${from}`);

            // COMANDO !PING
            if (text.startsWith('!ping')) {
                console.log('➡️ Executando !ping...');
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !RANK
            if (text.startsWith('!rank')) {
                console.log('➡️ Executando !rank...');

                if (!db) {
                    console.log('❌ DB não inicializado.');
                    return await sock.sendMessage(from, { text: '⚠️ Firebase não conectado.' }, { quoted: m });
                }

                console.log('🔍 Lendo nó "players" no Firebase...');
                const playersRef = db.ref('players');
                const snapshot = await playersRef.once('value');

                if (!snapshot.exists()) {
                    console.log('⚠️ Nó "players" está vazio no banco.');
                    return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhum jogador encontrado no banco de dados.' }, { quoted: m });
                }

                const playersData = snapshot.val();
                console.log('📦 Dados recebidos do Firebase com sucesso!');

                let listaTexto = '🏴‍☠️ *LISTA DE JOGADORES* 🏴‍☠️\n\n';
                let contador = 1;

                Object.keys(playersData).forEach(uid => {
                    const player = playersData[uid];
                    
                    // Busca charName em variações comuns de salvamento
                    const charName = player.character?.charName 
                                  || player.charName 
                                  || player.characterName 
                                  || 'Sem Personagem';

                    listaTexto += `${contador}. *${charName}*\n`;
                    contador++;
                });

                console.log('📤 Enviando lista para o WhatsApp...');
                await sock.sendMessage(from, { text: listaTexto }, { quoted: m });
                console.log('✅ Comando !rank finalizado!');
            }
        } catch (err) {
            console.error('❌ Erro crítico no processador de mensagens:', err);
        }
    });
}

connectToWhatsApp();
