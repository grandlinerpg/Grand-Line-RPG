const axios = require('axios');
const { 
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
} = require('./index');

const { 
    jogosQuiz, 
    batalhas, 
    timersDesafio, 
    limparTimersBatalha, 
    iniciarTimerTurnoMaximo, 
    comecarCombateDeFato, 
    iniciarEstruturaBatalha, 
    gerarTabelaPontuacao, 
    enviarProximaPergunta, 
    dispararQuizNoGrupo 
} = require('./gameEngine');

async function handleCommand(sock, m, text, from) {
    // RESPOSTAS DO QUIZ
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
            return;
        }
    }

    if (text === '!iniciarquiz') {
        await dispararQuizNoGrupo(from, sock);
        return;
    }

    if (text === '!jid') {
        await sock.sendMessage(from, { text: `🆔 *ID deste chat:* \`${from}\`` }, { quoted: m });
        return;
    }

    if (text === '!ping' || text.startsWith('!ping ')) {
        await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
        return;
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
        return;
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
        return;
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
        return;
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
        return;
    }

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
                return await sock.sendMessage(from, { text: `📜 *— DESAFIOS ATIVOS —* 📜\n\nNão há nenhum desafio pendente contra ou a favor de você no momento.` }, { quoted: m });
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
        return;
    }

    if (text.startsWith('!aceitarcoliseu')) {
        if (from !== GRUPO_COLISEU) {
            return await sock.sendMessage(from, { text: '❌ O comando *!aceitarcoliseu* só pode ser usado no grupo oficial do Coliseu!' }, { quoted: m });
        }

        if (batalhas[from]) {
            return await sock.sendMessage(from, { text: '⚠️ Já existe uma luta ocorrendo no Coliseu! Aguarde o término.' }, { quoted: m });
        }

        const senderId = obterJidEfetivo(m, from);
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) {
            return await sock.sendMessage(from, { text: '❌ Você precisa marcar o desafiante para aceitar!\nExemplo: *!aceitarcoliseu @desafiante*' }, { quoted: m });
        }

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        const desafianteNum = playersData[desafianteUid]?.number?.n || targetId;
        const desafiadoNum = playersData[desafiadoUid]?.number?.n || senderId;

        const desafioKey = `${desafianteNum}_VS_${desafiadoNum}`;
        const desafioRes = await axios.get(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`);
        const desafio = desafioRes.data;

        if (!desafio || desafio.status !== 'pendente') {
            return await sock.sendMessage(from, { text: '❌ Nenhum desafio pendente encontrado entre vocês dois.' }, { quoted: m });
        }

        await axios.patch(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`, { status: 'aceito' });

        const p1 = { lid: desafio.desafianteLid, numero: desafio.desafianteNum, nome: desafio.desafianteNome };
        const p2 = { lid: desafio.desafiadoLid, numero: desafio.desafiadoNum, nome: desafio.desafiadoNome };

        iniciarEstruturaBatalha(from, p1, p2, 'COLISEU', sock);

        const msgInicio = `⚔️ COMBATE INICIADO! ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem seus cards em 5 minutos ou digitem !iniciar.`;
        return await sock.sendMessage(from, { text: msgInicio });
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
        return;
    }

    if (text.startsWith('!aceitar') || text.startsWith('!battle')) {
        if (!GRUPOS_ARENA.includes(from)) {
            return await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos oficiais de Arena!' }, { quoted: m });
        }

        if (batalhas[from]) {
            return await sock.sendMessage(from, { text: '⚠️ Já existe uma luta ativa neste grupo! Aguarde o término.' }, { quoted: m });
        }

        const senderId = obterJidEfetivo(m, from);
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) {
            return await sock.sendMessage(from, { text: '❌ Marque o desafiante para aceitar!\nExemplo: *!aceitar @desafiante*' }, { quoted: m });
        }

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        const desafianteNum = playersData[desafianteUid]?.number?.n || targetId;
        const desafiadoNum = playersData[desafiadoUid]?.number?.n || senderId;

        const desafioKey = `${desafianteNum}_VS_${desafiadoNum}`;
        const desafioRes = await axios.get(`${FIREBASE_URL}/desafios/${desafioKey}.json`);
        const desafio = desafioRes.data;

        if (!desafio || desafio.status !== 'pendente') {
            return await sock.sendMessage(from, { text: '❌ Nenhum desafio pendente encontrado entre vocês.' }, { quoted: m });
        }

        if (timersDesafio[desafioKey]) {
            clearTimeout(timersDesafio[desafioKey]);
            delete timersDesafio[desafioKey];
        }

        await axios.patch(`${FIREBASE_URL}/desafios/${desafioKey}.json`, { status: 'aceito' });

        const p1 = { lid: desafio.desafianteLid, numero: desafio.desafianteNum, nome: desafio.desafianteNome };
        const p2 = { lid: desafio.desafiadoLid, numero: desafio.desafiadoNum, nome: desafio.desafiadoNome };

        iniciarEstruturaBatalha(from, p1, p2, 'PVP', sock);

        const msgInicio = `⚔️ *COMBATE INICIADO!* ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
        return await sock.sendMessage(from, { text: msgInicio });
    }

    if (text === '!iniciar') {
        const bat = batalhas[from];
        if (bat && bat.fase === 'apresentacao') {
            await comecarCombateDeFato(from, sock);
        }
        return;
    }

    if (text === '!prox') {
        const bat = batalhas[from];
        if (!bat || bat.fase !== 'em_combate') return;

        if (bat.jogadorVez === 1) {
            bat.jogadorVez = 2;
        } else {
            bat.jogadorVez = 1;
            bat.turnoAtual++;
        }

        const proximoJogadorObj = bat[`p${bat.jogadorVez}`];
        const nomeDoVez = proximoJogadorObj?.nome || `Jogador ${bat.jogadorVez}`;

        const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual}* 🔄\n\nVEZ DE ${nomeDoVez.toUpperCase()}\n\n*Tempo:* 30 minutos\n\nDigite *!prox* ao concluir sua jogada.`;
        await sock.sendMessage(from, { text: msgNovoTurno });

        iniciarTimerTurnoMaximo(from, sock);
        return;
    }

    if (text.startsWith('!win')) {
        const bat = batalhas[from];
        if (!bat) return await sock.sendMessage(from, { text: '❌ Não há combate ativo neste grupo!' }, { quoted: m });

        const senderId = obterJidEfetivo(m, from);
        let vencedorObj = null;
        let perdedorObj = null;

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (mentionedJid) {
            const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
            if (bat.p1?.numero === targetId || bat.p1?.lid === targetId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            if (bat.p2?.numero === targetId || bat.p2?.lid === targetId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        } else {
            if (bat.p1?.numero === senderId || bat.p1?.lid === senderId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            else if (bat.p2?.numero === senderId || bat.p2?.lid === senderId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
            else {
                vencedorObj = bat[`p${bat.jogadorVez}`];
                perdedorObj = bat.jogadorVez === 1 ? bat.p2 : bat.p1;
            }
        }

        const nomeVencedor = vencedorObj?.nome || 'Combatente Vencedor';

        if (bat.tipo === 'COLISEU') {
            try {
                const tempAtual = await obterTemporadaAtual();
                const [playersRes, coliseuRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/players.json`),
                    axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
                ]);

                const playersData = playersRes.data || {};
                const coliseuData = coliseuRes.data || {};

                const uidVencedor = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.n || '').trim() === String(vencedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(vencedorObj?.lid).trim()
                );
                const uidPerdedor = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.n || '').trim() === String(perdedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(perdedorObj?.lid).trim()
                );

                if (uidVencedor && coliseuData[uidVencedor]) {
                    await axios.patch(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${uidVencedor}.json`, {
                        vitorias: (coliseuData[uidVencedor].vitorias || 0) + 1,
                        pontos: (coliseuData[uidVencedor].pontos || 0) + 2
                    });
                }

                if (uidPerdedor && coliseuData[uidPerdedor]) {
                    await axios.patch(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${uidPerdedor}.json`, {
                        derrotas: (coliseuData[uidPerdedor].derrotas || 0) + 1,
                        pontos: (coliseuData[uidPerdedor].pontos || 0) + 1
                    });
                }
            } catch (e) {}

            const desafioKey = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`).catch(() => {});
        } else {
            // ARENA (PVP)
            try {
                const [rankRes, playersRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/ranking.json`),
                    axios.get(`${FIREBASE_URL}/players.json`)
                ]);

                const rankingObj = rankRes.data || {};
                const playersData = playersRes.data || {};
                const uidVencedor = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.n || '').trim() === String(vencedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(vencedorObj?.lid).trim()
                );

                if (uidVencedor) {
                    const posAtualStr = Object.keys(rankingObj).find(pos => rankingObj[pos] === uidVencedor);
                    if (posAtualStr) {
                        const posAtual = parseInt(posAtualStr);
                        if (posAtual > 1) {
                            const posAcima = posAtual - 1;
                            const uidAcima = rankingObj[posAcima];

                            const updates = {};
                            updates[posAcima] = uidVencedor;
                            updates[posAtual] = uidAcima || null;
                            await axios.patch(`${FIREBASE_URL}/ranking.json`, updates);
                        }
                    }

                    const saldoAtual = playersData[uidVencedor]?.info?.saldo || 0;
                    const expAtual = playersData[uidVencedor]?.info?.exp || 0;

                    await axios.patch(`${FIREBASE_URL}/players/${uidVencedor}/info.json`, {
                        saldo: saldoAtual + RECOMPENSA_ARENA_SALDO,
                        exp: expAtual + RECOMPENSA_ARENA_EXP
                    });
                }
            } catch (e) {
                console.error('Erro ao atualizar recompensa/ranking da Arena:', e.message);
            }

            const desafioKey = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey}.json`).catch(() => {});
        }

        const msgWin = `🏆 *VITÓRIA DECLARADA!* 🏆\n\n` +
                       `O jogador *${nomeVencedor}* venceu o combate após ${bat.turnoAtual} rodada${bat.turnoAtual > 1 ? 's' : ''} e subiu 1 posição no ranking!\n\n` +
                       `RECOMPENSAS DO COMBATE:\n\n` +
                       `💰 +฿ ${RECOMPENSA_ARENA_SALDO.toLocaleString('pt-BR')}\n` +
                       `✨ +${RECOMPENSA_ARENA_EXP} EXP`;
        
        await sock.sendMessage(from, { text: msgWin });

        limparTimersBatalha(bat);
        delete batalhas[from];
        return;
    }

    if (text === '!fimcombate') {
        if (!batalhas[from]) return;

        const bat = batalhas[from];
        const desafioKey = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;

        await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey}.json`).catch(() => {});
        await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`).catch(() => {});

        limparTimersBatalha(bat);
        delete batalhas[from];
        return await sock.sendMessage(from, { text: '🏳️ *Combate encerrado com sucesso!*' }, { quoted: m });
    }
}

module.exports = { handleCommand };
