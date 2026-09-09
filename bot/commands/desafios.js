const axios = require('axios');
const { 
    FIREBASE_URL, 
    GRUPO_COLISEU, 
    GRUPO_QUIZ_JID, 
    timersDesafio, 
    obterTemporadaAtual, 
    formatarJidPv, 
    obterJidEfetivo 
} = require('../index');

async function handleDesafiosCommands(sock, m, text, from) {
    if (text === '!desafios' || text.startsWith('!desafios ')) {
        try {
            const senderId = obterJidEfetivo(m, from);

            const [playersRes, desafiosArenaRes, desafiosColiseuRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/desafios.json`),
                axios.get(`${FIREBASE_URL}/desafios_coliseu.json`)
            ]);

            const playersData = playersRes.data || {};
            const desafiosArena = desafiosArenaRes.data || {};
            const desafiosColiseu = desafiosColiseuRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId
            );
            if (!playerUid) return await sock.sendMessage(from, { text: '❌ Seu personagem não está cadastrado!' }, { quoted: m });

            const myNum = String(playersData[playerUid]?.number?.n || '').trim();

            const formatarData = (timestamp) => {
                if (!timestamp) return 'Data N/A';
                const data = new Date(timestamp);
                const dataStr = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
                const horaStr = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                return `${dataStr} às ${horaStr}`;
            };

            const obterNivelOponente = (numOponente) => {
                const uid = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.n || '').trim() === String(numOponente).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(numOponente).trim()
                );
                return uid ? (playersData[uid]?.info?.level ?? 1) : 1;
            };

            let ativos = [];
            let enviados = [];

            Object.values(desafiosArena).forEach(desafio => {
                if (desafio && desafio.status === 'pendente') {
                    const dataFormatada = formatarData(desafio.criadoEm);
                    if (desafio.desafiadoNum === myNum || desafio.desafiadoLid === senderId) {
                        const lv = obterNivelOponente(desafio.desafianteNum || desafio.desafianteLid);
                        ativos.push(`⚔️ ${desafio.desafianteNome} (${lv})\nData: ${dataFormatada}`);
                    } else if (desafio.desafianteNum === myNum || desafio.desafianteLid === senderId) {
                        const lv = obterNivelOponente(desafio.desafiadoNum || desafio.desafiadoLid);
                        enviados.push(`⚔️ ${desafio.desafiadoNome} (${lv})\nData: ${dataFormatada}`);
                    }
                }
            });

            Object.values(desafiosColiseu).forEach(desafio => {
                if (desafio && desafio.status === 'pendente') {
                    const dataFormatada = formatarData(desafio.criadoEm);
                    if (desafio.desafiadoNum === myNum || desafio.desafiadoLid === senderId) {
                        const lv = obterNivelOponente(desafio.desafianteNum || desafio.desafianteLid);
                        ativos.push(`🏟️ ${desafio.desafianteNome} (${lv})\nData: ${dataFormatada}`);
                    } else if (desafio.desafianteNum === myNum || desafio.desafianteLid === senderId) {
                        const lv = obterNivelOponente(desafio.desafiadoNum || desafio.desafiadoLid);
                        enviados.push(`🏟️ ${desafio.desafiadoNome} (${lv})\nData: ${dataFormatada}`);
                    }
                }
            });

            if (ativos.length === 0 && enviados.length === 0) {
                const msgVazio = `📜 *— DESAFIOS ATIVOS —* 📜\n\nNão há nenhum desafio pendente contra ou a favor de você no momento.`;
                return await sock.sendMessage(from, { text: msgVazio }, { quoted: m });
            }

            let resposta = `📜 — DESAFIOS ATIVOS — 📜\n\n`;
            resposta += ativos.length > 0 ? ativos.join('\n\n') : 'Nenhum desafio recebido.';

            resposta += `\n\n📜 — ENVIADOS — 📜\n\n`;
            resposta += enviados.length > 0 ? enviados.join('\n\n') : 'Nenhum desafio enviado.';

            return await sock.sendMessage(from, { text: resposta }, { quoted: m });

        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Erro ao buscar seus desafios.' }, { quoted: m });
        }
    }

    if (text.startsWith('!desafiarcoliseu')) {
        const senderId = obterJidEfetivo(m, from);

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) return await sock.sendMessage(from, { text: '❌ Marque o jogador! Ex: *!desafiarcoliseu @jogador*' }, { quoted: m });

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
        
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId
        );

        if (!desafianteUid || !desafiadoUid) return await sock.sendMessage(from, { text: '❌ Um dos jogadores não está cadastrado!' }, { quoted: m });
        if (desafianteUid === desafiadoUid) return await sock.sendMessage(from, { text: '❌ Você não pode se desafiar!' }, { quoted: m });

        const tempAtual = await obterTemporadaAtual();
        const coliseuRes = await axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`);
        const coliseuData = coliseuRes.data || {};

        if (!coliseuData[desafianteUid]) return await sock.sendMessage(from, { text: '❌ Você precisa estar inscrito na temporada atual do Coliseu!' }, { quoted: m });
        if (!coliseuData[desafiadoUid]) return await sock.sendMessage(from, { text: '❌ O jogador desafiado NÃO está inscrito no Coliseu!' }, { quoted: m });

        const desafianteNum = String(playersData[desafianteUid]?.number?.n || senderId).trim();
        const desafiadoNum = String(playersData[desafiadoUid]?.number?.n || targetId).trim();

        const nomeDesafiante = playersData[desafianteUid]?.character?.charName || playersData[desafianteUid]?.nome || 'Desafiante';
        const nomeDesafiado = playersData[desafiadoUid]?.character?.charName || playersData[desafiadoUid]?.nome || 'Desafiado';

        const desafioPayload = {
            desafianteLid: playersData[desafianteUid]?.number?.LID || senderId,
            desafianteNum: desafianteNum,
            desafianteNome: nomeDesafiante,
            desafiadoLid: playersData[desafiadoUid]?.number?.LID || targetId,
            desafiadoNum: desafiadoNum,
            desafiadoNome: nomeDesafiado,
            status: 'pendente',
            criadoEm: Date.now()
        };

        const desafioKey = `${desafianteNum}_VS_${desafiadoNum}`;
        await axios.put(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`, desafioPayload);

        const targetJidMsg = `${desafiadoNum}@s.whatsapp.net`;
        const msgDesafioColiseu = `🏟️ *DESAFIO DO COLISEU LANÇADO!* 🏟️\n\n👤 *Desafiante:* ${nomeDesafiante}\n🎯 *Desafiado:* ${nomeDesafiado}\n\n📢 @${desafiadoNum}, responda no grupo do Coliseu marcando o desafiante: *!aceitarcoliseu @${desafianteNum}*`;

        await sock.sendMessage(GRUPO_COLISEU, { text: msgDesafioColiseu, mentions: [targetJidMsg] });

        if (from !== GRUPO_COLISEU) {
            await sock.sendMessage(from, { text: `✅ Desafio enviado para o grupo do Coliseu!` }, { quoted: m });
        }

        const pvTargetJid = formatarJidPv(desafiadoNum);
        if (pvTargetJid) {
            try {
                await sock.sendMessage(pvTargetJid, { text: `🏟️ *VOCÊ FOI DESAFIADO NO COLISEU!*\n\n👤 *Desafiante:* ${nomeDesafiante}\n👉 Vá ao grupo do Coliseu e responda com *!aceitarcoliseu @${desafianteNum}*` });
            } catch (e) {}
        }
        return true;
    }

    if (text.startsWith('!desafiar') && !text.startsWith('!desafiarcoliseu')) {
        const senderId = obterJidEfetivo(m, from);

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) return await sock.sendMessage(from, { text: '❌ Marque quem deseja desafiar!\nEx: *!desafiar @jogador*' }, { quoted: m });

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId
        );

        if (!desafianteUid || !desafiadoUid) return await sock.sendMessage(from, { text: '❌ Um dos jogadores não está cadastrado!' }, { quoted: m });
        if (desafianteUid === desafiadoUid) return await sock.sendMessage(from, { text: '❌ Você não pode desafiar a si mesmo!' }, { quoted: m });

        const desafianteNum = String(playersData[desafianteUid]?.number?.n || senderId).trim();
        const desafiadoNum = String(playersData[desafiadoUid]?.number?.n || targetId).trim();

        const nomeDesafiante = playersData[desafianteUid]?.character?.charName || playersData[desafianteUid]?.nome || 'Desafiante';
        const nomeDesafiado = playersData[desafiadoUid]?.character?.charName || playersData[desafiadoUid]?.nome || 'Desafiado';

        const agora = Date.now();
        const tempoExpiracao = 24 * 60 * 60 * 1000;
        const desafioKey = `${desafianteNum}_VS_${desafiadoNum}`;

        const desafioPayload = {
            desafianteLid: playersData[desafianteUid]?.number?.LID || senderId,
            desafianteNum: desafianteNum,
            desafianteNome: nomeDesafiante,
            desafiadoLid: playersData[desafiadoUid]?.number?.LID || targetId,
            desafiadoNum: desafiadoNum,
            desafiadoNome: nomeDesafiado,
            status: 'pendente',
            criadoEm: agora,
            expiraEm: agora + tempoExpiracao
        };

        await axios.put(`${FIREBASE_URL}/desafios/${desafioKey}.json`, desafioPayload);

        if (timersDesafio[desafioKey]) clearTimeout(timersDesafio[desafioKey]);

        timersDesafio[desafioKey] = setTimeout(async () => {
            try {
                const checkDesafio = await axios.get(`${FIREBASE_URL}/desafios/${desafioKey}.json`);
                if (checkDesafio.data && checkDesafio.data.status === 'pendente') {
                    await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey}.json`);
                    await sock.sendMessage(GRUPO_QUIZ_JID, { text: `💀 *DERROTA POR W.O.!* O jogador *${nomeDesafiado}* não aceitou o desafio de *${nomeDesafiante}* a tempo.` });
                }
            } catch (e) {}
        }, tempoExpiracao);

        const targetJidMsg = `${desafiadoNum}@s.whatsapp.net`;
        const msgDesafio = `⚔️ *DESAFIO DE ARENA LANÇADO!* ⚔️\n\n👤 *Desafiante:* ${nomeDesafiante}\n🎯 *Desafiado:* ${nomeDesafiado}\n\n⏳ @${desafiadoNum}, você tem *24 horas* para aceitar marcando o desafiante em um dos grupos da Arena: *!aceitar @${desafianteNum}*`;
        
        await sock.sendMessage(GRUPO_QUIZ_JID, { text: msgDesafio, mentions: [targetJidMsg] });

        if (from !== GRUPO_QUIZ_JID) {
            await sock.sendMessage(from, { text: `✅ Desafio enviado para o grupo do Quiz!` }, { quoted: m });
        }

        const pvTargetJid = formatarJidPv(desafiadoNum);
        if (pvTargetJid) {
            try {
                await sock.sendMessage(pvTargetJid, { text: `⚔️ *VOCÊ FOI DESAFIADO NA ARENA!*\n\n👤 *Desafiante:* ${nomeDesafiante}\n👉 Acesse o grupo de Arena e aceite usando: *!aceitar @${desafianteNum}*` });
            } catch (e) {}
        }
        return true;
    }

    return false;
}

module.exports = { handleDesafiosCommands };
