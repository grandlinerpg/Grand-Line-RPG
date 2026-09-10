const axios = require('axios');
const { 
    FIREBASE_URL, 
    RECOMPENSA_ARENA_SALDO, 
    RECOMPENSA_ARENA_EXP, 
    GRUPO_COLISEU, 
    GRUPOS_ARENA, 
    batalhas, 
    obterTemporadaAtual, 
    obterJidEfetivo 
} = require('../index');

const { 
    limparTimersBatalha, 
    iniciarTimerTurnoMaximo, 
    comecarCombateDeFato, 
    iniciarEstruturaBatalha 
} = require('../gameEngine');

async function handleCombatesCommands(sock, m, text, from) {
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

        // Busca no banco mapeando diretamente pelo LID
        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId ||
            String(playersData[u]?.number?.n || '').trim() === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId ||
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        const desafianteLid = playersData[desafianteUid]?.number?.LID || targetId;
        const desafiadoLid = playersData[desafiadoUid]?.number?.LID || senderId;

        const desafioKey = `${desafianteLid}_VS_${desafiadoLid}`;

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

        // Busca o UID mapeando pelo LID do cadastro
        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId ||
            String(playersData[u]?.number?.n || '').trim() === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId ||
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        // Garante que o ID utilizado na busca da chave seja o LID
        const desafianteLid = playersData[desafianteUid]?.number?.LID || targetId;
        const desafiadoLid = playersData[desafiadoUid]?.number?.LID || senderId;

        const desafioKey = `${desafianteLid}_VS_${desafiadoLid}`;

        const desafioRes = await axios.get(`${FIREBASE_URL}/desafios/${desafioKey}.json`);
        const desafio = desafioRes.data;

        if (!desafio || desafio.status !== 'pendente') {
            return await sock.sendMessage(from, { text: '❌ Nenhum desafio pendente encontrado entre vocês.' }, { quoted: m });
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
        return true;
    }

    if (text === '!prox') {
        const bat = batalhas[from];
        if (!bat || bat.fase !== 'em_combate') return true;

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
        return true;
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
            if (bat.p1?.lid === targetId || bat.p1?.numero === targetId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            if (bat.p2?.lid === targetId || bat.p2?.numero === targetId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        } else {
            if (bat.p1?.lid === senderId || bat.p1?.numero === senderId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            else if (bat.p2?.lid === senderId || bat.p2?.numero === senderId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
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
                    String(playersData[u]?.number?.LID || '').trim() === String(vencedorObj?.lid).trim()
                );
                const uidPerdedor = Object.keys(playersData).find(u => 
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

            const desafioKey = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`).catch(() => {});
        } else {
            try {
                const [rankRes, playersRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/ranking.json`),
                    axios.get(`${FIREBASE_URL}/players.json`)
                ]);

                const rankingObj = rankRes.data || {};
                const playersData = playersRes.data || {};
                const uidVencedor = Object.keys(playersData).find(u => 
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

            const desafioKey = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
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
        return true;
    }

    if (text === '!fimcombate') {
        if (!batalhas[from]) return true;

        const bat = batalhas[from];
        const desafioKey = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;

        await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey}.json`).catch(() => {});
        await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`).catch(() => {});

        limparTimersBatalha(bat);
        delete batalhas[from];
        await sock.sendMessage(from, { text: '🏳️ *Combate encerrado com sucesso!*' }, { quoted: m });
        return true;
    }

    return false;
}

module.exports = { handleCombatesCommands };
