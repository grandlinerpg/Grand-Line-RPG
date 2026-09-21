const axios = require('axios');
const { 
    FIREBASE_URL, 
    obterTemporadaAtual, 
    obterEmojiFaccao, 
    obterJidEfetivo 
} = require('../index');

async function handleInfoCommands(sock, m, text, from) {
    if (text === '!jid') {
        await sock.sendMessage(from, { text: `🆔 *ID deste chat:* \`${from}\`` }, { quoted: m });
        return true;
    }

    if (text === '!ping' || text.startsWith('!ping ')) {
        await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
        return true;
    }

    if (text === '!dado' || text.startsWith('!dado ')) {
        const resultado = Math.floor(Math.random() * 100) + 1;
        const senderId = obterJidEfetivo(m, from);

        let nomeJogador = "Lutador";
        try {
            const response = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = response.data || {};
            const playerUid = Object.keys(playersData).find(uid => 
                String(playersData[uid]?.number?.LID || '').trim() === senderId || 
                String(playersData[uid]?.number?.n || '').trim() === senderId
            );
            if (playerUid) nomeJogador = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador";
        } catch (e) {}

        await sock.sendMessage(from, { text: `🎲 *ROLAGEM DE DADO (1d100)*\n\n👤 *Jogador:* ${nomeJogador}\n🎯 *Resultado:* *${resultado}*` }, { quoted: m });
        return true;
    }

    if (text === '!info' || text.startsWith('!info ')) {
        try {
            const response = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = response.data;
            if (!playersData) return await sock.sendMessage(from, { text: '🏴‍☠️ Banco de dados vazio.' }, { quoted: m });

            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const targetId = mentionedJid 
                ? mentionedJid.split('@')[0].split(':')[0].trim() 
                : obterJidEfetivo(m, from);

            const playerUid = Object.keys(playersData).find(uid => 
                String(playersData[uid]?.number?.LID || '').trim() === targetId || 
                String(playersData[uid]?.number?.n || '').trim() === targetId
            );

            if (!playerUid) {
                const mensagemErro = mentionedJid 
                    ? '❌ *O jogador mencionado não está cadastrado!*' 
                    : `❌ *Usuário não cadastrado!* (${targetId})`;
                return await sock.sendMessage(from, { text: mensagemErro }, { quoted: m });
            }

            const player = playersData[playerUid];
            const expFormatado = (player?.info?.exp ?? 0).toLocaleString('pt-BR');
            const saldoFormatado = (player?.info?.saldo ?? 0).toLocaleString('pt-BR');

            const infoText = `*📜 — INFORMAÇÕES — 📜*\n\n👤 *Nome:* ${player?.character?.charName || player?.nome || 'Sem Nome'}\n⭐ *Nível:* ${player?.info?.level ?? 1}\n✨ *EXP:* ${expFormatado}\n💰 *Saldo:* ฿ ${saldoFormatado}`;

            await sock.sendMessage(from, { text: infoText }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao buscar informações.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!rank' || text.startsWith('!rank ')) {
        try {
            const [rankRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/ranking.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);
            const rankingObj = rankRes.data || {};
            const playersData = playersRes.data || {};
            const posicoesOrdenadas = Object.keys(rankingObj).map(Number).filter(p => p > 0 && !isNaN(p)).sort((a, b) => a - b);

            if (posicoesOrdenadas.length === 0) return await sock.sendMessage(from, { text: '🏴‍☠️ Ranking vazio.' }, { quoted: m });

            let rankText = `*🏆 — RANKING ARENA — 🏆*\n\n`;
            posicoesOrdenadas.forEach((pos) => {
                const uid = rankingObj[pos];
                const player = playersData[uid];
                const emoji = obterEmojiFaccao(player?.character?.faction);
                rankText += `${pos}º ${player?.character?.charName || player?.nome || 'Sem Nome'}${emoji ? ' ' + emoji : ''}\n`;
            });
            await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao carregar ranking.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!inscrever' || text.startsWith('!inscrever ')) {
        try {
            const senderId = obterJidEfetivo(m, from);
            const tempAtual = await obterTemporadaAtual();

            const [playersRes, coliseuRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
            ]);

            const playersData = playersRes.data || {};
            const coliseuData = coliseuRes.data || {};
            const playerUid = Object.keys(playersData).find(uid => 
                String(playersData[uid]?.number?.LID || '').trim() === senderId || 
                String(playersData[uid]?.number?.n || '').trim() === senderId
            );

            if (!playerUid) return await sock.sendMessage(from, { text: '❌ Personagem não cadastrado!' }, { quoted: m });
            if (coliseuData[playerUid]) return await sock.sendMessage(from, { text: `⚠️ Você já está inscrito na Temporada ${tempAtual}!` }, { quoted: m });

            const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
            const TAXA = 20000;
            if (saldoAtual < TAXA) return await sock.sendMessage(from, { text: `❌ Saldo insuficiente! Taxa: *฿ ${TAXA}*. Seu saldo: *฿ ${saldoAtual}*.` }, { quoted: m });

            const novoSaldo = saldoAtual - TAXA;
            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { saldo: novoSaldo });
            await axios.put(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${playerUid}.json`, {
                vitorias: 0, derrotas: 0, pontos: 0, inscritoEm: Date.now()
            });

            return await sock.sendMessage(from, { text: `🏟 *INSCRIÇÃO CONFIRMADA NO COLISEU!*\n🏆 *Temporada ${tempAtual}*\n\n👤 *Lutador:* ${playersData[playerUid]?.character?.charName || 'Combatente'}\n💰 *Taxa Paga:* ฿ ${TAXA}\n💳 *Novo Saldo:* ฿ ${novoSaldo}` }, { quoted: m });
        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Erro na inscrição.' }, { quoted: m });
        }
    }

    if (text === '!coliseu' || text.startsWith('!coliseu ')) {
        try {
            const tempPadrao = await obterTemporadaAtual();
            const tempDesejada = text.split(' ')[1] ? parseInt(text.split(' ')[1]) : tempPadrao;

            const [coliseuRes, playersRes, infoColiseuRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempDesejada}/jogadores.json`),
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/coliseu/info.json`)
            ]);

            const coliseuData = coliseuRes.data || {};
            const playersData = playersRes.data || {};
            const coliseuInfo = infoColiseuRes.data || { periodo: '01/09 ~ 31/09' };
            const inscritosUids = Object.keys(coliseuData);

            if (inscritosUids.length === 0) return await sock.sendMessage(from, { text: `🏟 *Coliseu sem inscritos na Temporada ${tempDesejada}!*` }, { quoted: m });

            inscritosUids.sort((a, b) => {
                const pA = coliseuData[a] || {}; const pB = coliseuData[b] || {};
                if ((pB.pontos || 0) !== (pA.pontos || 0)) return (pB.pontos || 0) - (pA.pontos || 0);
                if ((pB.vitorias || 0) !== (pA.vitorias || 0)) return (pB.vitorias || 0) - (pA.vitorias || 0);
                return (pA.derrotas || 0) - (pB.derrotas || 0);
            });

            let coliseuText = `🏟 *— COLISEU CORRIDA —* 🏟\n🏆 *— TEMPORADA ${tempDesejada} — 🏆*\n\n*Período: ${coliseuInfo.periodo}*\n\n`;
            inscritosUids.forEach((uid, index) => {
                const dados = coliseuData[uid] || {};
                const player = playersData[uid];
                const emoji = obterEmojiFaccao(player?.character?.faction);
                coliseuText += `${index + 1}º ${player?.character?.charName || 'Lutador'}${emoji ? ' ' + emoji : ''}\n> *✔️ ${dados.vitorias || 0} | ✖️ ${dados.derrotas || 0} | 🏅${dados.pontos || 0}*\n\n`;
            });

            await sock.sendMessage(from, { text: coliseuText.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao carregar Coliseu.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleInfoCommands };
