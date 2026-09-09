const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const { handleCommand } = require('./commands');
const { dispararQuizNoGrupo } = require('./gameEngine');

// ==========================================
// CONFIGURAÇÕES & CONSTANTES (Antigo config.js)
// ==========================================
const NUMERO_BOT = "5511918448331";
const FIREBASE_URL = "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com";

const RECOMPENSA_ARENA_SALDO = 5000;
const RECOMPENSA_ARENA_EXP = 500; 

const GRUPO_COLISEU = "120363411146386806@g.us";
const GRUPO_QUIZ_JID = "120363409325935641@g.us";
const GRUPOS_ARENA = [
    "120363413442959158@g.us",
    "120363432609327730@g.us",
    "120363427539819874@g.us",
    "120363430639159195@g.us",
    "120363412001808092@g.us",
    "120363429534972500@g.us"
];

// Exporta para que o commands.js e gameEngine.js continuem funcionando sem alterações
module.exports = {
    NUMERO_BOT,
    FIREBASE_URL,
    RECOMPENSA_ARENA_SALDO,
    RECOMPENSA_ARENA_EXP,
    GRUPO_COLISEU,
    GRUPO_QUIZ_JID,
    GRUPOS_ARENA,
    obterTemporadaAtual: async () => {
        try {
            const infoRes = await axios.get(`${FIREBASE_URL}/coliseu/info.json`);
            return infoRes.data?.temporada || 1;
        } catch (e) { return 1; }
    },
    obterEmojiFaccao: (faccao) => {
        if (!faccao) return '';
        const f = String(faccao).trim().toLowerCase();
        if (f.includes('exército revolucionário') || f.includes('exercito revolucionario')) return '⚔️';
        if (f.includes('governo mundial')) return '⚓️';
        if (f.includes('piratas') || f.includes('pirata')) return '🏴‍☠️';
        return '';
    },
    formatarJidPv: (num) => {
        if (!num) return null;
        const clean = String(num).split('@')[0].split(':')[0].replace(/\D/g, '').trim();
        return clean ? `${clean}@s.whatsapp.net` : null;
    },
    obterJidEfetivo: (m, from) => {
        const rawSender = m.key.participant || m.key.remoteJid || from;
        return rawSender.split('@')[0].split(':')[0].trim();
    }
};

// ==========================================
// SERVIDOR WEB & CONEXÃO WHATSAPP
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

app.get('/', (req, res) => res.send('⚔️ Bot Grand Line RPG Online na Render!'));
app.listen(PORT, () => {
    console.log(`[Web] Servidor ativo na porta ${PORT}`);
    if (RENDER_URL) {
        setInterval(async () => {
            try { await axios.get(RENDER_URL); } catch (err) {}
        }, 10 * 60 * 1000);
    }
});

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

            cron.schedule('30 22 * * *', () => {
                console.log('⏰ [CRON] Disparando Quiz Diário...');
                dispararQuizNoGrupo(GRUPO_QUIZ_JID, sock);
            }, { scheduled: true, timezone: "America/Sao_Paulo" });
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

            await handleCommand(sock, m, text, from);

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
