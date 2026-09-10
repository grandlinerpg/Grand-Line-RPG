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

// FUNÇÕES AUXILIARES PARA GERENCIAR ARENAS NO FIREBASE
async function obterArenaAtiva(grupoJid) {
    const chaveGrupo = grupoJid.replace('@g.us', '');
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`);
        if (res.data) {
            // Sincroniza o estado em memória com os dados remotos do Firebase
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
    
    // Removemos propriedades de instâncias locais/sockets que não devem ir ao JSON do Firebase
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

async function deletarArenaAtiva(grupoJid) {
    const chaveGrupo = grupoJid.replace('@g.us', '');
    delete batalhas[grupoJid];
    try {
        await axios.delete(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`);
    } catch (e) {
        console.error('Erro ao deletar arena do Firebase:', e.message);
    }
}

async function handleCombatesCommands(sock, m, text, from) {
    // ==========================================
    // ACEITAR COLISEU
    // ==========================================
    if (text.startsWith('!aceitarcoliseu')) {
        if (from !== GRUPO_COLISEU) {
            return await sock.sendMessage(from, { text: '❌ O comando *!aceitarcoliseu* só pode ser usado no grupo oficial do Coliseu!' }, { quoted: m });
        }

        const arenaAtiva = await obterArenaAtiva(from);
        if (arenaAtiva && arenaAtiva.fase !== 'aguardando') {
            return await sock.sendMessage(from, { text: '⚠️ Já existe uma luta ocorrendo no Coliseu! Aguarde o término.' }, { quoted: m });
        }

        const senderId = obterJidEfetivo(m, from);
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) {
            return await sock.sendMessage(from, { text: '❌ Você precisa marcar o desafiante para aceitar!\nExemplo: *!aceitarcoliseu @desafiante*' }, { quoted: m });
        }

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();

        const [playersRes, desafiosColiseuRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/players.json`),
            axios.get(`${FIREBASE_URL}/desafios_coliseu.json`)
        ]);

        const playersData = playersRes.data || {};
        const todosDesafiosColiseu = desafiosColiseuRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        const desafianteNum = String(playersData[desafianteUid]?.number?.n || targetId).trim();
        const desafiadoNum = String(playersData[desafiadoUid]?.number?.n || senderId).trim();
        const desafianteLid = String(playersData[desafianteUid]?.number?.LID || targetId).trim();
        const desafiadoLid = String(playersData[desafiadoUid]?.number?.LID || senderId).trim();

        const desafioKey = Object.keys(todosDesafiosColiseu).find(key => {
            const d = todosDesafiosColiseu[key];
            if (!d || d.status !== 'pendente') return false;

            const desafianteBate = 
                String(d.desafianteNum).trim() === desafianteNum || 
                String(d.desafianteLid).trim() === desafianteLid || 
                String(d.desafianteNum).trim() === targetId ||
                String(d.desafianteLid).trim() === targetId;

            const desafiadoBate = 
                String(d.desafiadoNum).trim() === desafiadoNum || 
                String(d.desafiadoLid).trim() === desafiadoLid || 
                String(d.desafiadoNum).trim() === senderId ||
                String(d.desafiadoLid).trim() === senderId;

            return desafianteBate && desafiadoBate;
        });

        const desafio = todosDesafiosColiseu[desafioKey];

        if (!desafio) {
            return await sock.sendMessage(from, { text: '❌ Nenhum desafio pendente encontrado entre vocês dois.' }, { quoted: m });
        }

        await axios.patch(`${FIREBASE_URL}/desafios_coliseu/${desafioKey}.json`, { status: 'aceito' });

        const p1 = { lid: desafio.desafianteLid, numero: desafio.desafianteNum, nome: desafio.desafianteNome };
        const p2 = { lid: desafio.desafiadoLid, numero: desafio.desafiadoNum, nome: desafio.desafiadoNome };

        const dadosBatalha = {
            ...(arenaAtiva || {}),
            ...iniciarEstruturaBatalha(from, p1, p2, 'COLISEU', sock),
            fase: 'apresentacao'
        };
        await salvarArenaAtiva(from, dadosBatalha);

        const msgInicio = `⚔️ COMBATE INICIADO NO COLISEU! ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem seus cards em 5 minutos ou digitem !iniciar.`;
        return await sock.sendMessage(from, { text: msgInicio });
    }

    // ==========================================
    // ACEITAR ARENA
    // ==========================================
    if (text.startsWith('!aceitar') || text.startsWith('!battle')) {
        if (!GRUPOS_ARENA.includes(from)) {
            return await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos oficiais de Arena!' }, { quoted: m });
        }

        const arenaAtiva = await obterArenaAtiva(from);
        if (arenaAtiva && arenaAtiva.fase !== 'aguardando') {
            return await sock.sendMessage(from, { text: '⚠️ Já existe uma luta ativa neste grupo! Aguarde o término.' }, { quoted: m });
        }

        const senderId = obterJidEfetivo(m, from);

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) {
            return await sock.sendMessage(from, { text: '❌ Marque o desafiante para aceitar!\nExemplo: *!aceitar @desafiante*' }, { quoted: m });
        }

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();

        const [playersRes, desafiosArenaRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/players.json`),
            axios.get(`${FIREBASE_URL}/desafios.json`)
        ]);

        const playersData = playersRes.data || {};
        const todosDesafiosArena = desafiosArenaRes.data || {};

        const desafianteUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === targetId || 
            String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
        );
        const desafiadoUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        const desafianteNum = String(playersData[desafianteUid]?.number?.n || targetId).trim();
        const desafiadoNum = String(playersData[desafiadoUid]?.number?.n || senderId).trim();
        const desafianteLid = String(playersData[desafianteUid]?.number?.LID || targetId).trim();
        const desafiadoLid = String(playersData[desafiadoUid]?.number?.LID || senderId).trim();

        const desafioKey = Object.keys(todosDesafiosArena).find(key => {
            const d = todosDesafiosArena[key];
            if (!d || d.status !== 'pendente') return false;

            const desafianteBate = 
                String(d.desafianteNum).trim() === desafianteNum || 
                String(d.desafianteLid).trim() === desafianteLid || 
                String(d.desafianteNum).trim() === targetId ||
                String(d.desafianteLid).trim() === targetId;

            const desafiadoBate = 
                String(d.desafiadoNum).trim() === desafiadoNum || 
                String(d.desafiadoLid).trim() === desafiadoLid || 
                String(d.desafiadoNum).trim() === senderId ||
                String(d.desafiadoLid).trim() === senderId;

            return desafianteBate && desafiadoBate;
        });

        const desafio = todosDesafiosArena[desafioKey];

        if (!desafio) {
            return await sock.sendMessage(from, { text: '❌ Nenhum desafio pendente encontrado entre vocês.' }, { quoted: m });
        }

        await axios.patch(`${FIREBASE_URL}/desafios/${desafioKey}.json`, { status: 'aceito' });

        const p1 = { lid: desafio.desafianteLid, numero: desafio.desafianteNum, nome: desafio.desafianteNome };
        const p2 = { lid: desafio.desafiadoLid, numero: desafio.desafiadoNum, nome: desafio.desafiadoNome };

        const indexArena = GRUPOS_ARENA.indexOf(from) + 1;
        const nomeArena = arenaAtiva?.nomeArena || (indexArena > 0 ? `ARENA ${indexArena}` : 'ARENA');

        const dadosBatalha = {
            ...(arenaAtiva || {}),
            ...iniciarEstruturaBatalha(from, p1, p2, 'PVP', sock),
            fase: 'apresentacao',
            numeroArena: arenaAtiva?.numeroArena || indexArena,
            nomeArena: nomeArena
        };
        await salvarArenaAtiva(from, dadosBatalha);

        const msgInicio = `⚔️ *COMBATE INICIADO NA ${nomeArena.toUpperCase()}!* ⚔️\n\n${p1.nome}\n———VS———\n${p2.nome}\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
        return await sock.sendMessage(from, { text: msgInicio });
    }

    // ==========================================
    // INICIAR COMBATE
    // ==========================================
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

    // ==========================================
    // PASSAR TURNO
    // ==========================================
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

        const msgNovoTurno = `🔄 *TURNO ${bat.turnoAtual}* 🔄\n\nVEZ DE ${nomeDoVez.toUpperCase()}\n\n*Tempo:* 30 minutos\n\nDigite *!prox* ao concluir sua jogada.`;
        await sock.sendMessage(from, { text: msgNovoTurno });

        iniciarTimerTurnoMaximo(from, sock);
        return true;
    }

    // ==========================================
    // DECLARAR VITORIA (!WIN)
    // ==========================================
    if (text.startsWith('!win')) {
        const bat = await obterArenaAtiva(from);
        if (!bat || bat.fase === 'aguardando') return await sock.sendMessage(from, { text: '❌ Não há combate ativo neste grupo!' }, { quoted: m });

        const senderId = obterJidEfetivo(m, from);

        let vencedorObj = null;
        let perdedorObj = null;

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (mentionedJid) {
            const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
            if (bat.p1?.numero === targetId || bat.p1?.lid === targetId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            if (bat.p2?.numero === targetId || bat.p2?.lid === targetId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        }

        if (!vencedorObj) {
            if (bat.p1?.numero === senderId || bat.p1?.lid === senderId) { vencedorObj = bat.p1; perdedorObj = bat.p2; }
            else if (bat.p2?.numero === senderId || bat.p2?.lid === senderId) { vencedorObj = bat.p2; perdedorObj = bat.p1; }
        }

        if (!vencedorObj) {
            vencedorObj = bat[`p${bat.jogadorVez}`] || bat.p1;
            perdedorObj = (vencedorObj === bat.p1) ? bat.p2 : bat.p1;
        }

        const nomeVencedor = vencedorObj?.nome || 'Combatente Vencedor';

        if (bat.tipo === 'ATIVIDADE' && bat.grupoOrigemAtividade) {
            const { registrarResultadoLutaAtividade } = require('./atividades');
            
            const msgWin = `🏆 *VITÓRIA DECLARADA NO COMBATE DE ATIVIDADE!* 🏆\n\nO jogador *${nomeVencedor}* venceu a luta na arena!`;
            await sock.sendMessage(from, { text: msgWin });

            await registrarResultadoLutaAtividade(sock, bat.grupoOrigemAtividade, vencedorObj, perdedorObj);

            limparTimersBatalha(bat);
            await resetarArenaAguardando(from, bat);
            return true;
        }

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
                    u === vencedorObj?.numero || u === vencedorObj?.lid ||
                    String(playersData[u]?.number?.n || '').trim() === String(vencedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(vencedorObj?.lid).trim()
                );
                const uidPerdedor = Object.keys(playersData).find(u => 
                    u === perdedorObj?.numero || u === perdedorObj?.lid ||
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
            } catch (e) {
                console.error('Erro no processamento do Coliseu:', e.message);
            }

            const desafioKey1 = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            const desafioKey2 = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey1}.json`).catch(() => {});
            await axios.delete(`${FIREBASE_URL}/desafios_coliseu/${desafioKey2}.json`).catch(() => {});
        } 
        else {
            let alterouRanking = false;
            try {
                const [rankRes, playersRes] = await Promise.all([
                    axios.get(`${FIREBASE_URL}/ranking.json`),
                    axios.get(`${FIREBASE_URL}/players.json`)
                ]);

                const rankingObj = rankRes.data || {};
                const playersData = playersRes.data || {};

                const uidVencedor = Object.keys(playersData).find(u => 
                    u === vencedorObj?.numero || u === vencedorObj?.lid ||
                    String(playersData[u]?.number?.n || '').trim() === String(vencedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(vencedorObj?.lid).trim()
                );

                const uidPerdedor = Object.keys(playersData).find(u => 
                    u === perdedorObj?.numero || u === perdedorObj?.lid ||
                    String(playersData[u]?.number?.n || '').trim() === String(perdedorObj?.numero).trim() ||
                    String(playersData[u]?.number?.LID || '').trim() === String(perdedorObj?.lid).trim()
                );

                if (uidVencedor) {
                    const saldoAtual = playersData[uidVencedor]?.info?.saldo || 0;
                    const expAtual = playersData[uidVencedor]?.info?.exp || 0;

                    await axios.patch(`${FIREBASE_URL}/players/${uidVencedor}/info.json`, {
                        saldo: saldoAtual + RECOMPENSA_ARENA_SALDO,
                        exp: expAtual + RECOMPENSA_ARENA_EXP
                    });

                    const posVencedorStr = Object.keys(rankingObj).find(pos => rankingObj[pos] === uidVencedor);
                    const posPerdedorStr = uidPerdedor ? Object.keys(rankingObj).find(pos => rankingObj[pos] === uidPerdedor) : null;

                    if (posVencedorStr && posPerdedorStr) {
                        const posVencedor = parseInt(posVencedorStr, 10);
                        const posPerdedor = parseInt(posPerdedorStr, 10);

                        if (posVencedor > posPerdedor) {
                            const updates = {};
                            updates[posPerdedorStr] = uidVencedor;
                            updates[posVencedorStr] = uidPerdedor;
                            await axios.patch(`${FIREBASE_URL}/ranking.json`, updates);
                            alterouRanking = true;
                        }
                    } else if (posVencedorStr) {
                        const posVencedor = parseInt(posVencedorStr, 10);
                        if (posVencedor > 1) {
                            const posAcima = posVencedor - 1;
                            const uidAcima = rankingObj[posAcima];

                            const updates = {};
                            updates[posAcima] = uidVencedor;
                            updates[posVencedorStr] = uidAcima || null;
                            await axios.patch(`${FIREBASE_URL}/ranking.json`, updates);
                            alterouRanking = true;
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Erro ao atualizar recompensas e ranking:', e);
            }

            const desafioKey1 = `${bat.p1?.numero}_VS_${bat.p2?.numero}`;
            const desafioKey2 = `${bat.p1?.lid}_VS_${bat.p2?.lid}`;
            await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey1}.json`).catch(() => {});
            await axios.delete(`${FIREBASE_URL}/desafios/${desafioKey2}.json`).catch(() => {});
        }

        const msgSubiuRank = alterouRanking ? ' e assumiu uma posição superior no ranking!' : '!';
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

    // ==========================================
    // CANCELAR / ENCERRAR COMBATE
    // ==========================================
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

// Função auxiliar para voltar a arena ao estado "aguardando" mantendo a estrutura original
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

module.exports = { handleCombatesCommands };
