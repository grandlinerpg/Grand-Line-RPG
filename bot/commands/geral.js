const axios = require('axios');
const { performance } = require('perf_hooks');

// Importações do index (ou config)
const { 
    FIREBASE_URL, 
    jogosQuiz, 
    obterJidEfetivo 
} = require('../index');

// Importações do Quiz vindas diretamente do módulo de Quiz (sem gameEngine)
const { 
    enviarProximaPergunta, 
    gerarTabelaPontuacao, 
    dispararQuizNoGrupo 
} = require('./quiz');

async function handleGeralCommands(sock, m, text, from) {
    // ==========================================
    // 1. RESPOSTAS E LÓGICA DO QUIZ
    // ==========================================
    if (jogosQuiz[from] && jogosQuiz[from].ativo && !jogosQuiz[from].respondida) {
        const jogo = jogosQuiz[from];
        const qAtual = jogo.perguntas[jogo.perguntaAtual];

        if (qAtual && text === String(qAtual.resposta).trim().toLowerCase()) {
            jogo.respondida = true;
            if (jogo.timerPergunta) clearTimeout(jogo.timerPergunta);

            const senderId = obterJidEfetivo(m, from);
            jogo.pontos[senderId] = (jogo.pontos[senderId] || 0) + 1;

            const tabelaPontos = await gerarTabelaPontuacao(jogo.pontos);
            const msgAcerto = `🎉 *RESPOSTA CORRETA!* @${senderId} acertou e pontuou!\n\n${tabelaPontos}`;

            await sock.sendMessage(from, {
                text: msgAcerto,
                mentions: [m.key.participant || m.key.remoteJid || from]
            }, { quoted: m });

            jogo.perguntaAtual++;
            setTimeout(() => enviarProximaPergunta(from, sock), 3000);
            return true;
        }
    }

    // ==========================================
    // 2. COMANDO !INICIARQUIZ
    // ==========================================
    if (text === '!iniciarquiz') {
        await dispararQuizNoGrupo(from, sock);
        return true;
    }

    // ==========================================
    // 3. COMANDO !JID
    // ==========================================
    if (text === '!jid') {
        await sock.sendMessage(from, { text: `🆔 *ID deste chat:* \`${from}\`` }, { quoted: m });
        return true;
    }

    // ==========================================
    // 4. COMANDO !PING (COM MS)
    // ==========================================
    if (text === '!ping' || text.startsWith('!ping ')) {
        const inicio = performance.now();
        
        // Envia mensagem de teste para calcular a latência de envio/resposta
        const msgPing = await sock.sendMessage(from, { text: '🏓 *Pinging...*' }, { quoted: m });
        
        const fim = performance.now();
        const latencia = (fim - inicio).toFixed(2);

        // Atualiza/Responde com o tempo de resposta preciso em MS
        await sock.sendMessage(from, { 
            text: `⚡ *PONG!*\n\n⏱️ *Tempo de resposta:* \`${latencia}ms\`\n🏴‍☠️ *Grand Line RPG no ar!*` 
        }, { quoted: msgPing || m });

        return true;
    }

    // ==========================================
    // 5. COMANDO !DADO
    // ==========================================
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

    // ==========================================
    // 6. COMANDO !INFO
    // ==========================================
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

    return false;
}

module.exports = { handleGeralCommands };
