const axios = require('axios');
const { 
    FIREBASE_URL, 
    RECOMPENSA_ARENA_SALDO, 
    RECOMPENSA_ARENA_EXP, 
    GRUPO_COLISEU, 
    GRUPOS_ARENA, 
    obterTemporadaAtual, 
    obterJidEfetivo 
} = require('../index');

const batalhas = {};

function limparId(id) {
    if (!id) return '';
    return String(id).split('@')[0].split(':')[0].replace(/\D/g, '').trim();
}

function buscarUidPlayer(playersData, idBuscado) {
    if (!playersData || !idBuscado) return null;
    
    const idLimpo = limparId(idBuscado);

    return Object.keys(playersData).find(uid => {
        if (uid === idBuscado || uid === idLimpo) return true;

        const player = playersData[uid];
        if (!player) return false;

        const numLid = limparId(player.number?.LID);
        const numN = limparId(player.number?.n);

        return numLid === idLimpo || numN === idLimpo;
    });
}

function limparTimersBatalha(bat) {
    if (!bat) return;
    if (bat.timerApresentacao) clearTimeout(bat.timerApresentacao);
    if (bat.timerTurno) clearTimeout(bat.timerTurno);
    bat.timerApresentacao = null;
    bat.timerTurno = null;
}

function iniciarEstruturaBatalha(grupoJid, p1, p2, tipo = 'PVP', sock = null) {
    limparTimersBatalha(batalhas[grupoJid]);

    const novaBatalha = {
        grupoJid,
        tipo,
        p1: { lid: p1.lid, numero: p1.numero, nome: p1.nome },
        p2: { lid: p2.lid, numero: p2.numero, nome: p2.nome },
        fase: 'apresentacao',
        jogadorVez: 1,
        turnoAtual: 1,
        sock
    };

    novaBatalha.timerApresentacao = setTimeout(async () => {
        if (batalhas[grupoJid] && batalhas[grupoJid].fase === 'apresentacao') {
            await comecarCombateDeFato(grupoJid, sock);
        }
    }, 5 * 60 * 1000);

    batalhas[grupoJid] = novaBatalha;
    return novaBatalha;
}

async function comecarCombateDeFato(grupoJid, sock) {
    const bat = batalhas[grupoJid];
    if (!bat) return;

    if (bat.timerApresentacao) clearTimeout(bat.timerApresentacao);
    bat.timerApresentacao = null;

    bat.fase = 'em_combate';
    bat.jogadorVez = 1;
    bat.turnoAtual = 1;

    const p1Nome = bat.p1?.nome || 'Jogador 1';
    const msg = `⚔️ *O COMBATE COMEÇOU!* ⚔️\n\n` +
                `🔄 *TURNO 1 🔄*\n` +
                `➔ VEZ DE: *${p1Nome.toUpperCase()}*\n\n` +
                `⏳ > Término: 00:00 (UTC-3)\n` +
                `Utilize *!prox* para encerrar a sua jogada.`;

    const socketParaEnviar = sock || bat.sock;
    if (socketParaEnviar) {
        await socketParaEnviar.sendMessage(grupoJid, { text: msg });
    }

    iniciarTimerTurnoMaximo(grupoJid, socketParaEnviar);
    await salvarArenaAtiva(grupoJid, bat);
}

function iniciarTimerTurnoMaximo(grupoJid, sock) {
    const bat = batalhas[grupoJid];
    if (!bat) return;

    if (bat.timerTurno) clearTimeout(bat.timerTurno);

    bat.timerTurno = setTimeout(async () => {
        const b = batalhas[grupoJid];
        if (b && b.fase === 'em_combate') {
            const socketParaEnviar = sock || b.sock;
            const perdedor = b.jogadorVez === 1 ? b.p1 : b.p2;
            const vencedor = b.jogadorVez === 1 ? b.p2 : b.p1;

            if (socketParaEnviar) {
                await socketParaEnviar.sendMessage(grupoJid, {
                    text: `⏰ *TEMPO ESGOTADO!* O jogador *${perdedor?.nome}* excedeu o limite de 30 minutos do turno.\n\n🏆 Vitória concedida a *${vencedor?.nome}*!`
                });
            }

            limparTimersBatalha(b);
            await resetarArenaAguardando(grupoJid, b);
        }
    }, 30 * 60 * 1000);
}

async function obterArenaAtiva(grupoJid) {
    const chaveGrupo = grupoJid.replace('@g.us', '');
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`);
        if (res.data) {
            batalhas[grupoJid] = { ...(batalhas[grupoJid] || {}), ...res.data };
            return batalhas[grupoJid];
        }
        return batalhas[grupoJid] || null;
    } catch (e) {
        return batalhas[grupoJid] || null;
    }
}

async function salvarArenaAtiva(grupoJid, dadosBatalha) {
    const chaveGrupo = grupoJid.replace('@g.us', '');
    batalhas[grupoJid] = dadosBatalha;
    
    const dadosParaSalvar = { ...dadosBatalha };
    delete dadosParaSalvar.sock;
    delete dadosParaSalvar.timerApresentacao;
    delete dadosParaSalvar.timerTurno;

    try {
        await axios.put(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`, dadosParaSalvar);
    } catch (e) {
        console.error('Erro ao salvar arena no Firebase:', e.message);
    }
}

async function resetarArenaAguardando(grupoJid, batAtual) {
    const indexArena = GRUPOS_ARENA.indexOf(grupoJid) + 1;
    const arenaReset = {
        numeroArena: batAtual?.numeroArena || (indexArena > 0 ? indexArena : 1),
        nomeArena: batAtual?.nomeArena || `Arena ${indexArena > 0 ? indexArena : 1}`,
        fase: "aguardando",
        grupoJid: grupoJid,
        jogadorVez: 1,
        tipo: "PVP",
        turnoAtual: 0
    };
    await salvarArenaAtiva(grupoJid, arenaReset);
}

async function iniciarCombateAposAceitar(sock, from, desafio, tipo = 'PVP') {
    const arenaAtiva = await obterArenaAtiva(from);

    const p1 = { lid: desafio.desafianteLid, numero: desafio.desafianteNum, nome: desafio.desafianteNome };
    const p2 = { lid: desafio.desafiadoLid, numero: desafio.desafiadoNum, nome: desafio.desafiadoNome };

    const indexArena = GRUPOS_ARENA.indexOf(from) + 1;
    const nomeArena = tipo === 'COLISEU' 
        ? 'COLISEU' 
        : (arenaAtiva?.nomeArena || (indexArena > 0 ? `ARENA ${indexArena}` : 'ARENA'));

    const dadosBatalha = {
        ...(arenaAtiva || {}),
        ...iniciarEstruturaBatalha(from, p1, p2, tipo, sock),
        fase: 'apresentacao',
        numeroArena: arenaAtiva?.numeroArena || indexArena,
        nomeArena: nomeArena
    };

    await salvarArenaAtiva(from, dadosBatalha);

    const msgInicio = tipo === 'COLISEU'
        ? `⚔️ COMBATE INICIADO NO COLISEU! ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem os vossos cards em 5 minutos ou digitem !iniciar.`
        : `⚔️ *COMBATE INICIADO NA ${nomeArena.toUpperCase()}!* ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem os vossos cards em *5 minutos* ou digitem *!iniciar*.`;

    return await sock.sendMessage(from, { text: msgInicio });
}

async function handleCombatesCommands(sock, m, text, from) {
    if (text === '!iniciar') {
        const bat = await obterArenaAtiva(from);
        if (!bat) {
            return await sock.sendMessage(from, { text: '❌ Nenhuma arena ativa neste grupo para iniciar.' }, { quoted: m });
        }

        if (bat.fase === 'apresentacao' || bat.fase === 'aguardando' || !bat.fase) {
            await comecarCombateDeFato(from, sock);
            bat.fase = 'em_combate';
            bat.jogadorVez = bat.jogadorVez || 1;
            bat.turnoAtual = bat.turnoAtual || 1;
            await salvarArenaAtiva(from, bat);
            return true;
        } else if (bat.fase === 'em_combate') {
            return await sock.sendMessage(from, { text: '⚠️ O combate já está em andamento!' }, { quoted: m });
        }
        return true;
    }

    if (text === '!prox') {
        const bat = await obterArenaAtiva(from);
        if (!bat || bat.fase !== 'em_combate') return true;

        if (bat.jogadorVez === 1) {
            bat.jogadorVez = 2;
        } else {
            bat.jogadorVez = 1;
            bat.turnoAtual = (bat.turnoAtual || 1) + 1;
        }

        await salvarArenaAtiva(from, bat);

        const proximoJogadorObj = bat[`p${bat.jogadorVez}`];
        const nomeDoVez = proximoJogadorObj?.nome || `Jogador ${bat.jogadorVez}`;

        const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual}* 🔄\n\n➔ VEZ DE *${nomeDoVez.toUpperCase()}*\n\n> Término: 00:00 (UTC-3)\n\nDigite *!prox* ao concluir a sua jogada.`;
        await sock.sendMessage(from, { text: msgNovoTurno });

        iniciarTimerTurnoMaximo(from, sock);
        return true;
    }

    if (text.startsWith('!win')) {
        const bat = await obterArenaAtiva(from);
        if (!bat || bat.fase === 'aguardando') {
            return await sock.sendMessage(from, { text: '❌ Não há combate ativo neste grupo!' }, { quoted: m });
        }

        const senderId = obterJidEfetivo(m, from);
        const senderIdLimpo = limparId(senderId);
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const targetId = mentionedJid ? limparId(mentionedJid) : null;

        let vencedorObj = null;
        let perdedorObj = null;

        const p1Num = limparId(bat.p1?.numero);
        const p1Lid = limparId(bat.p1?.lid);
        const p2Num = limparId(bat.p2?.numero);
        const p2Lid = limparId(bat.p2?.lid);

        if (targetId) {
            if (p1Num === targetId || p1Lid === targetId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            else if (p2Num === targetId || p2Lid === targetId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        }

        if (!vencedorObj) {
            if (p1Num === senderIdLimpo || p1Lid === senderIdLimpo) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            else if (p2Num === senderIdLimpo || p2Lid === senderIdLimpo) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        }

        if (!vencedorObj) {
            vencedorObj = bat[`p${bat.jogadorVez}`] || bat.p1;
            perdedorObj = (vencedorObj === bat.p1) ? bat.p2 : bat.p1;
        }

        const nomeVencedor = vencedorObj?.nome || 'Combatente Vencedor';

        if (bat.tipo === 'ATIVIDADE' && bat.grupoOrigemAtividade) {
            try {
                const { registrarResultadoLutaAtividade } = require('./atividades');
                await registrarResultadoLutaAtividade(sock, bat.grupoOrigemAtividade, vencedorObj, perdedorObj);
            } catch (e) {
                console.error('Erro ao registrar atividade:', e.message);
            }

            const msgWin = `🏆 *VITÓRIA DECLARADA NO COMBATE DE ATIVIDADE!* 🏆\n\nO jogador *${nomeVencedor}* venceu a luta na arena!`;
            await sock.sendMessage(from, { text: msgWin });

            limparTimersBatalha(bat);
            await resetarArenaAguardando(from, bat);
            return true;
        }

        let alterouRanking = false;

        if (bat.tipo === 'COLISEU') {
            try {
                const tempAtual = await obterTemporadaAtual();
                const [playersRes, coliseuRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/players.json`),
                    axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
                ]);

                const playersData = playersRes.data || {};
                const coliseuData = coliseuRes.data || {};

                const uidVencedor = buscarUidPlayer(playersData, vencedorObj?.numero || vencedorObj?.lid);
                const uidPerdedor = buscarUidPlayer(playersData, perdedorObj?.numero || perdedorObj?.lid);

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
            } catch (e) {
                console.error('Erro no processamento do Coliseu:', e.message);
            }

            const desafioKey1 = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            const desafioKey2 = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey1}.json`).catch(() => {});
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey2}.json`).catch(() => {});
        } 
        else {
            try {
                const [rankRes, playersRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/ranking.json`),
                    axios.get(`${FIREBASE_URL}/players.json`)
                ]);

                const rankingObj = rankRes.data || {};
                const playersData = playersRes.data || {};

                const uidVencedor = buscarUidPlayer(playersData, vencedorObj?.numero || vencedorObj?.lid);
                const uidPerdedor = buscarUidPlayer(playersData, perdedorObj?.numero || perdedorObj?.lid);

                if (uidVencedor) {
                    const saldoAtual = playersData[uidVencedor]?.info?.saldo || 0;
                    const expAtual = playersData[uidVencedor]?.info?.exp || 0;

                    await axios.patch(`${FIREBASE_URL}/players/${uidVencedor}/info.json`, {
                        saldo: saldoAtual + RECOMPENSA_ARENA_SALDO,
                        exp: expAtual + RECOMPENSA_ARENA_EXP
                    });

                    const posVencedorStr = Object.keys(rankingObj).find(pos => rankingObj[pos] === uidVencedor);
                    const posPerdedorStr = uidPerdedor ? Object.keys(rankingObj).find(pos => rankingObj[pos] === uidPerdedor) : null;

                    if (posVencedorStr) {
                        const posVencedor = parseInt(posVencedorStr, 10);
                        const posPerdedor = posPerdedorStr ? parseInt(posPerdedorStr, 10) : null;

                        // Só sobe se o vencedor for quem desafiou (estava abaixo do perdedor)
                        if (posPerdedor && posVencedor > posPerdedor) {
                            const posNova = posVencedor - 1; // Sobe exatamente 1 posição
                            if (posNova >= 1) {
                                const uidQuemEstavaAcima = rankingObj[String(posNova)];

                                const updates = {};
                                updates[String(posNova)] = uidVencedor;
                                if (uidQuemEstavaAcima) {
                                    updates[String(posVencedor)] = uidQuemEstavaAcima;
                                }
                                await axios.patch(`${FIREBASE_URL}/ranking.json`, updates);
                                alterouRanking = true;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Erro ao atualizar recompensas e ranking:', e.message);
            }

            const desafioKey1 = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            const desafioKey2 = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
            await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey1}.json`).catch(() => {});
            await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey2}.json`).catch(() => {});
        }

        const msgSubiuRank = alterouRanking ? ' e subiu 1 posição no ranking!' : '!';
        const msgWin = `🏆 *VITÓRIA DECLARADA!* 🏆\n\n` +
                       `O jogador *${nomeVencedor}* venceu o combate após ${bat.turnoAtual || 1} rodada${(bat.turnoAtual || 1) > 1 ? 's' : ''}${msgSubiuRank}\n\n` +
                       `RECOMPENSAS DO COMBATE:\n` +
                       `💰 +฿ ${RECOMPENSA_ARENA_SALDO.toLocaleString('pt-BR')}\n` +
                       `✨ +${RECOMPENSA_ARENA_EXP} EXP`;

        await sock.sendMessage(from, { text: msgWin });

        limparTimersBatalha(bat);
        await resetarArenaAguardando(from, bat);
        return true;
    }

    if (text === '!fimcombate') {
        const bat = await obterArenaAtiva(from);
        if (!bat) return true;

        const desafioKey1 = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
        const desafioKey2 = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;

        await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey1}.json`).catch(() => {});
        await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey2}.json`).catch(() => {});
        await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey1}.json`).catch(() => {});
        await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey2}.json`).catch(() => {});

        limparTimersBatalha(bat);
        await resetarArenaAguardando(from, bat);
        await sock.sendMessage(from, { text: '🏳️ *Combate encerrado com sucesso!*' }, { quoted: m });
        return true;
    }

    return false;
}

module.exports = { 
    handleCombatesCommands,
    iniciarEstruturaBatalha,
    iniciarCombateAposAceitar,
    obterArenaAtiva,
    limparId,
    buscarUidPlayer
};
