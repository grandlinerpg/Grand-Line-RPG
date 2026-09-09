const axios = require('axios');

const NUMERO_BOT = "5511918448331";
const FIREBASE_URL = "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com";

// CONFIGURAÇÃO DE RECOMPENSAS DA ARENA
const RECOMPENSA_ARENA_SALDO = 5000;
const RECOMPENSA_ARENA_EXP = 500; 

// GRUPOS
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

// Helper functions
async function obterTemporadaAtual() {
    try {
        const infoRes = await axios.get(`${FIREBASE_URL}/coliseu/info.json`);
        const info = infoRes.data;
        return info?.temporada || 1;
    } catch (e) {
        return 1;
    }
}

function obterEmojiFaccao(faccao) {
    if (!faccao) return '';
    const faccaoLimpa = String(faccao).trim().toLowerCase();
    if (faccaoLimpa.includes('exército revolucionário') || faccaoLimpa.includes('exercito revolucionario')) return '⚔️';
    if (faccaoLimpa.includes('governo mundial')) return '⚓️';
    if (faccaoLimpa.includes('piratas') || faccaoLimpa.includes('pirata')) return '🏴‍☠️';
    return '';
}

function formatarJidPv(num) {
    if (!num) return null;
    const cleanNum = String(num).split('@')[0].split(':')[0].replace(/\D/g, '').trim();
    return cleanNum ? `${cleanNum}@s.whatsapp.net` : null;
}

function obterJidEfetivo(m, from) {
    const rawSender = m.key.participant || m.key.remoteJid || from;
    return rawSender.split('@')[0].split(':')[0].trim();
}

module.exports = {
    NUMERO_BOT,
    FIREBASE_URL,
    RECOMPENSA_ARENA_SALDO,
    RECOMPENSA_ARENA_EXP,
    GRUPO_COLISEU,
    GRUPO_QUIZ_JID,
    GRUPOS_ARENA,
    obterTemporadaAtual,
    obterEmojiFaccao,
    formatarJidPv,
    obterJidEfetivo
};
