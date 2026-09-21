const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const cron = require('node-cron'); 

// Importação dos Módulos de Comandos
const geral = require('./commands/geral');
const quiz = require('./commands/quiz');
const atividades = require('./commands/atividades');
const batalhasCmd = require('./commands/batalhas');
const competicao = require('./commands/competicao');
const desafios = require('./commands/desafios');
const vincular = require('./commands/vincular');

const NUMERO_BOT = "5511918448331";
const FIREBASE_URL = "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com";

// GRUPOS E CONFIGURAÇÕES
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

// Servidor Web + Auto-Ping
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

// Estados Globais em Memória
const jogosQuiz = {};
const batalhas = {};
const timersDesafio = {};

const ctxGlobal = {
    FIREBASE_URL,
    GRUPO_COLISEU,
    GRUPO_QUIZ_JID,
    GRUPOS_ARENA,
    jogosQuiz,
    batalhas,
    timersDesafio
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(NUMERO_BOT);
                console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
            } catch (err) { console.error('[Pareamento] Erro:', err.message); }
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
                quiz.dispararQuizNoGrupo(GRUPO_QUIZ_JID, sock, ctxGlobal);
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

            // 1. Resposta do Quiz Ativo
            if (jogosQuiz[from] && jogosQuiz[from].ativo && !jogosQuiz[from].respondida) {
                const acertou = await quiz.processarRespostaQuiz(m, text, from, sock, ctxGlobal);
                if (acertou) return;
            }

            // 2. Roteamento Direto por Comandos
            if (text === '!jid' || text === '!ping' || text.startsWith('!ping ')) {
                return await geral.executar(m, text, from, sock);
            }

            if (text === '!iniciarquiz') {
                return await quiz.dispararQuizNoGrupo(from, sock, ctxGlobal);
            }

            if (text === '!dado' || text.startsWith('!dado ')) {
                return await atividades.rolarDado(m, from, sock, ctxGlobal);
            }

            if (text === '!info' || text.startsWith('!info ')) {
                return await atividades.obterInfo(m, from, sock, ctxGlobal);
            }

            if (text === '!rank' || text.startsWith('!rank ')) {
                return await competicao.obterRank(m, from, sock, ctxGlobal);
            }

            if (text === '!inscrever' || text.startsWith('!inscrever ')) {
                return await competicao.inscreverColiseu(m, from, sock, ctxGlobal);
            }

            if (text === '!coliseu' || text.startsWith('!coliseu ')) {
                return await competicao.obterColiseu(m, text, from, sock, ctxGlobal);
            }

            if (text === '!desafios' || text.startsWith('!desafios ')) {
                return await desafios.listarDesafios(m, from, sock, ctxGlobal);
            }

            if (text.startsWith('!desafiarcoliseu')) {
                return await desafios.desafiarColiseu(m, from, sock, ctxGlobal);
            }

            if (text.startsWith('!aceitarcoliseu')) {
                return await desafios.aceitarColiseu(m, from, sock, ctxGlobal);
            }

            if (text.startsWith('!desafiar') && !text.startsWith('!desafiarcoliseu')) {
                return await desafios.desafiarArena(m, from, sock, ctxGlobal);
            }

            if (text.startsWith('!aceitar') || text.startsWith('!battle')) {
                return await desafios.aceitarArena(m, from, sock, ctxGlobal);
            }

            if (text === '!iniciar') {
                return await batalhasCmd.iniciarManual(from, sock, ctxGlobal);
            }

            if (text === '!prox') {
                return await batalhasCmd.proximoTurno(from, sock, ctxGlobal);
            }

            if (text.startsWith('!win')) {
                return await batalhasCmd.declararVitoria(m, from, sock, ctxGlobal);
            }

            if (text === '!fimcombate') {
                return await batalhasCmd.finalizarCombate(m, from, sock, ctxGlobal);
            }

            if (text.startsWith('!vincular')) {
                return await vincular.executar(m, text, from, sock, ctxGlobal);
            }

        } catch (err) {
            console.error('❌ Erro no processamento:', err);
        }
    });
}

connectToWhatsApp();
