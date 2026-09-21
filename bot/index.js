const { default: makeWASocket, useMultiFileAuthState, disconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const axios = require('axios');

// ==========================================
// 1. CONFIGURAÇÕES E CONSTANTES GLOBAIS
// ==========================================
const FIREBASE_URL = 'https://seu-firebase-app.firebaseio.com'; // Altere para a URL do seu Firebase
const PORT = process.env.PORT || 3000;

// JIDs dos Grupos Especiais
const GRUPO_COLISEU = '120363000000000000@g.us'; // Altere para o JID do Grupo Coliseu
const GRUPO_QUIZ_JID = '120363111111111111@g.us'; // Altere para o JID do Grupo Quiz/Arena Central

// Array com JIDs dos Grupos de Arena
const GRUPOS_ARENA = [
    '120363222222222222@g.us', // Arena 1
    '120363333333333333@g.us', // Arena 2
    '120363444444444444@g.us'  // Arena 3
];

// Recompensas Padrão de Arena
const RECOMPENSA_ARENA_SALDO = 5000;
const RECOMPENSA_ARENA_EXP = 150;

// Estado Global na Memória
const jogosQuiz = {};
const timersDesafio = {};

// ==========================================
// 2. FUNÇÕES AUXILIARES / UTILITÁRIAS
// ==========================================

/**
 * Resgata o ID único efetivo (LID ou Número limpo) do remetente da mensagem.
 */
function obterJidEfetivo(m, from) {
    const sender = m.key.participant || m.key.remoteJid || from;
    return sender.split('@')[0].split(':')[0].trim();
}

/**
 * Formata um número bruto para o JID de mensagem privada (@s.whatsapp.net).
 */
function formatarJidPv(numero) {
    if (!numero) return null;
    const numLimpo = String(numero).replace(/\D/g, '');
    return numLimpo ? `${numLimpo}@s.whatsapp.net` : null;
}

/**
 * Retorna o número da temporada atual cadastrada no Firebase.
 */
async function obterTemporadaAtual() {
    try {
        const res = await axios.get(`${FIREBASE_URL}/coliseu/info.json`);
        return res.data?.temporadaAtual || 1;
    } catch (e) {
        return 1;
    }
}

/**
 * Mapeia e retorna o emoji correspondente à facção.
 */
function obterEmojiFaccao(faccao) {
    if (!faccao) return '';
    const f = faccao.toLowerCase();
    if (f.includes('pirata')) return '🏴‍☠️';
    if (f.includes('marinha')) return '⚓';
    if (f.includes('revolucionario') || f.includes('revolucionário')) return '🐉';
    if (f.includes('caçador') || f.includes('cacador') || f.includes('bounty')) return '🎯';
    return '⚔️';
}

// Exportações necessárias para os submódulos do bot
module.exports = {
    FIREBASE_URL,
    GRUPO_COLISEU,
    GRUPO_QUIZ_JID,
    GRUPOS_ARENA,
    RECOMPENSA_ARENA_SALDO,
    RECOMPENSA_ARENA_EXP,
    jogosQuiz,
    timersDesafio,
    obterJidEfetivo,
    formatarJidPv,
    obterTemporadaAtual,
    obterEmojiFaccao
};

// ==========================================
// 3. IMPORTAÇÃO DOS SUBMÓDULOS DE COMANDOS
// ==========================================
const { handleVincularCommands } = require('./vincular');
const { handleGeralCommands } = require('./geral');
const { handleDesafiosCommands } = require('./desafios');
const { handleCompeticaoCommands } = require('./competicao');
const { handleCombatesCommands } = require('./combates');
const { handleAtividadesCommands } = require('./atividades');

// ==========================================
// 4. INICIALIZAÇÃO DA CONEXÃO DO WHATSAPP
// ==========================================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            console.log('⚠️ Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot conectado ao WhatsApp com sucesso!');
        }
    });

    // ==========================================
    // 5. ESCUTA DE MENSAGENS (ROTEADOR PRINCIPAL)
    // ==========================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
            if (!m.message) continue;

            const from = m.key.remoteJid;
            const text = (
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption ||
                m.message.videoMessage?.caption ||
                ''
            ).trim();

            if (!text) continue;

            try {
                // Roteamento sequencial através dos módulos
                let processado = false;

                // 1. Vincular
                processado = await handleVincularCommands(sock, m, text, from);
                if (processado) continue;

                // 2. Geral (Inclui Quiz, Dado, Ping, Info, JID)
                processado = await handleGeralCommands(sock, m, text, from);
                if (processado) continue;

                // 3. Desafios (Desafiar Arena e Coliseu)
                processado = await handleDesafiosCommands(sock, m, text, from);
                if (processado) continue;

                // 4. Competição (Rank, Inscrição e Tabela Coliseu)
                processado = await handleCompeticaoCommands(sock, m, text, from);
                if (processado) continue;

                // 5. Combates (Aceitar, Iniciar, Prox, Win e Fimcombate)
                processado = await handleCombatesCommands(sock, m, text, from);
                if (processado) continue;

                // 6. Atividades (Sistemas de Atividades e Factions)
                processado = await handleAtividadesCommands(sock, m, text, from);
                if (processado) continue;

            } catch (err) {
                console.error(`❌ Erro no processamento da mensagem [${from}]:`, err);
            }
        }
    });
}

// Inicia o bot
connectToWhatsApp();

// ==========================================
// 6. SERVIDOR EXPRESS (KEEP-ALIVE / WEBSERVER)
// ==========================================
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('🏴‍☠️ Grand Line RPG Bot está rodando perfeitamente!');
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor web rodando na porta ${PORT}`);
});
