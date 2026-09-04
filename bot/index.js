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

// 2. CONEXÃO COM O FIREBASE
try {
    const serviceAccount = require('./firebase-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Firebase] SDK Admin conectado com sucesso!');
} catch (e) {
    console.log('[Firebase] Rodando sem chave ou arquivo firebase-key.json ainda não adicionado.');
}

const db = admin.apps.length ? admin.firestore() : null;

// 3. WHATSAPP (BAILEYS VIA CÓDIGO DE PAREAMENTO)
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Se ainda não estiver conectado, pede o código de 8 dígitos
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
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('🔴 Conexão encerrada.');
            }
        } else if (connection === 'open') {
            console.log('✅ [WhatsApp] Bot conectado com sucesso!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        // Trata mensagens simples ou com formatação/mídia acompanhada de texto
        const rawText = m.message.conversation || 
                        m.message.extendedTextMessage?.text || 
                        m.message.imageMessage?.caption || 
                        m.message.videoMessage?.caption || '';
        
        const text = rawText.trim().toLowerCase();
        const from = m.key.remoteJid;

        // Comando !ping (Funciona em PV e Grupos)
        if (text === '!ping') {
            await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
        }
    });
}

connectToWhatsApp();
