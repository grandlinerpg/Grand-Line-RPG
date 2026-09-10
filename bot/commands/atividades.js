const axios = require('axios');
const { FIREBASE_URL, GRUPOS_ARENA, batalhas, obterJidEfetivo } = require('../index');
const { iniciarEstruturaBatalha } = require('../gameEngine');

// Armazena as sessões de criação
const sessoesCriacao = {};

// Armazena as atividades ativas no grupo
const atividadesAtivas = {};

async function handleAtividadesCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);

    // 1. Comando Inicial: !iniciaratividade
    if (text === '!iniciaratividade') {
        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ Você precisa ter um personagem cadastrado para iniciar uma atividade!' }, { quoted: m });
                return true;
            }

            const faccao = playersData[playerUid]?.character?.faction;
            if (!faccao) {
                await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
                return true;
            }

            sessoesCriacao[from] = {
                fase: 'aguardando_nome',
                criadorUid: playerUid,
                faccaoCriador: faccao
            };

            await sock.sendMessage(from, { text: '❓ *Qual atividade você quer iniciar?*' }, { quoted: m });
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao validar personagem para atividade.' }, { quoted: m });
            return true;
        }
    }

    // 2. Passo 1: Nome da Atividade
    if (sessoesCriacao[from] && sessoesCriacao[from].fase === 'aguardando_nome') {
        const sessao = sessoesCriacao[from];
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};
        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        try {
            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes/${sessao.faccaoCriador}/atividades.json`);
            const atividadesFaccao = faccoesRes.data || {};

            const chaveAtividade = Object.keys(atividadesFaccao).find(k => 
                k.toLowerCase() === text.toLowerCase() || 
                (atividadesFaccao[k]?.nome && atividadesFaccao[k].nome.toLowerCase() === text.toLowerCase())
            );

            if (!chaveAtividade) {
                await sock.sendMessage(from, { text: `❌ A atividade "*${text}*" não pertence ou não está disponível para a facção *${sessao.faccaoCriador}*.` }, { quoted: m });
                delete sessoesCriacao[from];
                return true;
            }

            const ativDados = atividadesFaccao[chaveAtividade];
            sessao.nomeAtividade = ativDados?.nome || text;
            sessao.nivelAtividade = ativDados?.nivel || 1;
            sessao.fase = 'aguardando_participantes';

            await sock.sendMessage(from, { text: '👥 *Quais jogadores vão participar da atividade?*\n\n_(Mencione usando @ ou digite "eu" para incluir a si mesmo)_' }, { quoted: m });
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao consultar as atividades da facção no Firebase.' }, { quoted: m });
            delete sessoesCriacao[from];
            return true;
        }
    }

    // 3. Passo 2: Participantes Inicializadores
    if (sessoesCriacao[from] && sessoesCriacao[from].fase === 'aguardando_participantes') {
        const sessao = sessoesCriacao[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};
        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const uidsParticipantes = new Set();
        if (text.toLowerCase().includes('eu')) uidsParticipantes.add(sessao.criadorUid);

        const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentionedJids) {
            const targetId = jid.split('@')[0].split(':')[0].trim();
            const targetUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === targetId || 
                String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
            );
            if (targetUid) uidsParticipantes.add(targetUid);
        }

        if (uidsParticipantes.size === 0) {
            await sock.sendMessage(from, { text: '❌ Nenhum jogador válido foi identificado. Marque alguém com @ ou digite "eu".' }, { quoted: m });
            return true;
        }

        const anunciantes = [];
        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            if (player?.character?.faction !== sessao.faccaoCriador) {
                const nomeInvalido = player?.character?.charName || player?.nome || 'Um dos jogadores';
                await sock.sendMessage(from, { text: `❌ O jogador *${nomeInvalido}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }
            anunciantes.push({
                uid: uid,
                nome: player?.character?.charName || player?.nome || 'Lutador',
                level: player?.info?.level ?? 1,
                lid: player?.number?.LID || senderId,
                numero: player?.number?.n || senderId,
                faccao: sessao.faccaoCriador
            });
        }

        atividadesAtivas[from] = {
            nomeAtividade: sessao.nomeAtividade,
            faccaoCriador: sessao.faccaoCriador,
            anunciantes: anunciantes,
            defensores: [],
            fase: 'lista',
            bancoAtacantes: [],
            bancoDefensores: [],
            vezSelecao: 'atacante',
            proximoDesafiante: null,
            lutadoresAtivos: [],
            vitoriasAtacantes: 0,
            vitoriasDefensores: 0,
            historicoLutas: [],
            derrotados: []
        };

        atividadesAtivas[from].timer = setTimeout(async () => {
            if (atividadesAtivas[from] && atividadesAtivas[from].fase === 'lista') {
                await sock.sendMessage(from, { text: `⏳ *O tempo de 30 minutos da atividade "${atividadesAtivas[from].nomeAtividade}" encerrou! Iniciando fase de combates...*` });
                await encerrarListaEIniciarPartida(sock, from);
            }
        }, 30 * 60 * 1000);

        delete sessoesCriacao[from];
        await enviarPainelAtividade(sock, from, atividadesAtivas[from]);
        return true;
    }

    // 4. Entrar na defesa: !participar
    if (text === '!participar') {
        const atividade = atividadesAtivas[from];
        if (!atividade || atividade.fase !== 'lista') {
            await sock.sendMessage(from, { text: '❌ Não há nenhuma atividade aberta para inscrições no momento.' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ Você precisa estar cadastrado para participar!' }, { quoted: m });
                return true;
            }

            const player = playersData[playerUid];
            const faccaoJogador = player?.character?.faction;

            if (faccaoJogador === atividade.faccaoCriador) {
                await sock.sendMessage(from, { text: '❌ Aliados da mesma facção não podem entrar como defensores!' }, { quoted: m });
                return true;
            }

            const jaEhAnunciante = atividade.anunciantes.some(a => a.uid === playerUid);
            const jaEhDefensor = atividade.defensores.some(d => d.uid === playerUid);

            if (jaEhAnunciante || jaEhDefensor) {
                await sock.sendMessage(from, { text: '⚠️ Você já está registrado nesta atividade!' }, { quoted: m });
                return true;
            }

            atividade.defensores.push({
                uid: playerUid,
                nome: player?.character?.charName || player?.nome || 'Defensor',
                level: player?.info?.level ?? 1,
                lid: player?.number?.LID || senderId,
                numero: player?.number?.n || senderId,
                faccao: faccaoJogador || 'Defesa'
            });

            await enviarPainelAtividade(sock, from, atividade);
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao registrar participação.' }, { quoted: m });
            return true;
        }
    }

    // 5. Encerrar Lista e Iniciar Confrontos: !encerrar
    if (text === '!encerrar') {
        const atividade = atividadesAtivas[from];
        if (!atividade || atividade.fase !== 'lista') {
            await sock.sendMessage(from, { text: '❌ Não há nenhuma lista de atividade aguardando encerramento.' }, { quoted: m });
            return true;
        }

        if (atividade.timer) clearTimeout(atividade.timer);
        await encerrarListaEIniciarPartida(sock, from);
        return true;
    }

    // 6. Selecionar oponente durante as rodadas de pareamento: !escolher @jogador
    if (text.startsWith('!escolher')) {
        const atividade = atividadesAtivas[from];
        if (!atividade || atividade.fase !== 'selecao') return false;

        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedJid) {
            await sock.sendMessage(from, { text: '❌ Marque o adversário que deseja escolher. Ex: *!escolher @jogador*' }, { quoted: m });
            return true;
        }

        const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
        await processarEscolhaLutador(sock, from, targetId);
        return true;
    }

    return false;
}

// ==========================================
// FUNÇÕES AUXILIARES E LÓGICA DE MATCHMAKING
// ==========================================

async function encerrarListaEIniciarPartida(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    if (atividade.defensores.length === 0) {
        await sock.sendMessage(from, { text: `⚠️ A atividade *${atividade.nomeAtividade}* foi encerrada sem defensores.` });
        delete atividadesAtivas[from];
        return;
    }

    atividade.bancoAtacantes = [...atividade.anunciantes];
    atividade.bancoDefensores = [...atividade.defensores];
    atividade.fase = 'selecao';

    await sock.sendMessage(from, { 
        text: `⚔️ *INÍCIO DA FASE DE CONFRONTOS!*\n\nAtacantes: ${atividade.bancoAtacantes.length} | Defensores: ${atividade.bancoDefensores.length}` 
    });

    await verificarEParearAutomatico(sock, from);
}

async function verificarEParearAutomatico(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    // Se temos um próximo desafiante (vencedor do combate anterior)
    if (atividade.proximoDesafiante) {
        if (atividade.vezSelecao === 'banco_defensor') {
            if (atividade.bancoDefensores.length === 1) {
                const p1 = atividade.proximoDesafiante;
                const p2 = atividade.bancoDefensores.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *Defesa só tem 1 opção!* ${p2.nome} foi alocado automaticamente contra ${p1.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
                atividade.fase = 'combates';
                await enviarRelatorioGrupo(sock, from);
                return;
            } else if (atividade.bancoDefensores.length > 1) {
                let faccaoDef = atividade.defensores[0]?.faccao || 'Defensora';
                await sock.sendMessage(from, { 
                    text: `🏆 Vez do banco da facção *${faccaoDef}* escolher quem enfrentará *${atividade.proximoDesafiante.nome}* usando *!escolher @jogador*.` 
                });
                return;
            }
        } else if (atividade.vezSelecao === 'banco_atacante') {
            if (atividade.bancoAtacantes.length === 1) {
                const p2 = atividade.proximoDesafiante;
                const p1 = atividade.bancoAtacantes.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *Atacantes só têm 1 opção!* ${p1.nome} foi alocado automaticamente contra ${p2.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
                atividade.fase = 'combates';
                await enviarRelatorioGrupo(sock, from);
                return;
            } else if (atividade.bancoAtacantes.length > 1) {
                await sock.sendMessage(from, { 
                    text: `🏆 Vez do banco de *${atividade.faccaoCriador}* escolher quem enfrentará *${atividade.proximoDesafiante.nome}* usando *!escolher @jogador*.` 
                });
                return;
            }
        }
    }

    // Regra geral de seleção inicial / revezamento
    if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
        const p1 = atividade.bancoAtacantes.shift();
        const p2 = atividade.bancoDefensores.shift();
        
        await sock.sendMessage(from, { text: `⚡ *Resta apenas 1 combatente de cada lado!* Pareamento automático: ${p1.nome} VS ${p2.nome}` });
        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';
        await enviarRelatorioGrupo(sock, from);
    } else if (atividade.bancoAtacantes.length > 0 && atividade.bancoDefensores.length > 0) {
        if (atividade.vezSelecao === 'atacante' && atividade.bancoDefensores.length === 1) {
            // Se só há 1 defensor disponível para o atacante escolher
            const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
            const p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
            const p2 = atividade.bancoDefensores.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 defensor!* ${p2.nome} foi pareado automaticamente contra ${p1.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await verificarEParearAutomatico(sock, from);
        } else if (atividade.vezSelecao === 'defensor' && atividade.bancoAtacantes.length === 1) {
            // Se só há 1 atacante disponível para a defesa escolher
            const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
            const p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
            const p1 = atividade.bancoAtacantes.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 atacante!* ${p1.nome} foi pareado automaticamente contra ${p2.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await verificarEParearAutomatico(sock, from);
        } else {
            let faccaoVez = atividade.vezSelecao === 'atacante' ? atividade.faccaoCriador : (atividade.defensores[0]?.faccao || 'Defesa');
            let faccaoAlvo = atividade.vezSelecao === 'atacante' ? (atividade.defensores[0]?.faccao || 'Defesa') : atividade.faccaoCriador;

            await sock.sendMessage(from, { 
                text: `⚔️ Vez da facção *${faccaoVez}* escolher o combate!\nUse *!escolher @jogador* marcando um adversário de *${faccaoAlvo}*.` 
            });
        }
    } else {
        atividade.fase = 'combates';
    }
}

async function processarEscolhaLutador(sock, from, targetId) {
    const atividade = atividadesAtivas[from];
    if (!atividade || atividade.fase !== 'selecao') return;

    let p1, p2;

    if (atividade.vezSelecao === 'atacante') {
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId || d.uid === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco da defesa!' });
            return;
        }

        const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
        p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.vezSelecao = 'defensor';
        await verificarEParearAutomatico(sock, from);

    } else if (atividade.vezSelecao === 'defensor') {
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId || a.uid === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco dos atacantes!' });
            return;
        }

        const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
        p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
        p1 = atividade.bancoAtacantes.splice(idxAtq, 1)[0];

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.vezSelecao = 'atacante';
        await verificarEParearAutomatico(sock, from);

    } else if (atividade.vezSelecao === 'banco_defensor') {
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId || d.uid === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco da defesa!' });
            return;
        }

        p1 = atividade.proximoDesafiante;
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';
        await enviarRelatorioGrupo(sock, from);

    } else if (atividade.vezSelecao === 'banco_atacante') {
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId || a.uid === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco atacante!' });
            return;
        }

        p2 = atividade.proximoDesafiante;
        p1 = atividade.bancoAtacantes.splice(idxAtq, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';
        await enviarRelatorioGrupo(sock, from);
    }
}

async function alocarLutaNaArena(sock, grupoOrigem, p1, p2) {
    const atividade = atividadesAtivas[grupoOrigem];

    // Busca status das arenas ativas no Firebase
    let arenasAtivas = {};
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas.json`);
        arenasAtivas = res.data || {};
    } catch (e) {}

    // Encontra uma arena disponível dos GRUPOS_ARENA
    const arenaDisponivel = GRUPOS_ARENA.find(arenaJid => !batalhas[arenaJid] && !arenasAtivas[arenaJid]);

    if (!arenaDisponivel) {
        await sock.sendMessage(grupoOrigem, { text: '⚠️ Todas as arenas estão ocupadas no momento! Aguardando vaga...' });
        return false;
    }

    const dadosBatalha = iniciarEstruturaBatalha(arenaDisponivel, p1, p2, 'ATIVIDADE', sock);
    dadosBatalha.grupoOrigemAtividade = grupoOrigem;

    batalhas[arenaDisponivel] = dadosBatalha;

    try {
        await axios.put(`${FIREBASE_URL}/arenas_ativas/${arenaDisponivel}.json`, dadosBatalha);
    } catch (e) {
        console.error('Erro ao salvar arena da atividade no Firebase:', e.message);
    }

    atividade.lutadoresAtivos.push({ p1, p2, arena: arenaDisponivel });

    const msgArena = `⚔️ *COMBATE DE ATIVIDADE!* ⚔️\n\n${p1.nome} (${p1.faccao})\n———VS———\n${p2.nome} (${p2.faccao})\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
    await sock.sendMessage(arenaDisponivel, { text: msgArena });

    return true;
}

// Chamado por combates.js quando !win é acionado numa luta de atividade
async function registrarResultadoLutaAtividade(sock, grupoOrigem, vencedorObj, perdedorObj) {
    const atividade = atividadesAtivas[grupoOrigem];
    if (!atividade) return;

    atividade.historicoLutas.push({ vencedor: vencedorObj.nome, perdedor: perdedorObj.nome });
    atividade.derrotados.push(perdedorObj.nome);

    atividade.lutadoresAtivos = atividade.lutadoresAtivos.filter(
        l => l.p1.lid !== vencedorObj.lid && l.p2.lid !== vencedorObj.lid
    );

    const ehAtacante = atividade.anunciantes.some(a => a.lid === vencedorObj.lid || a.numero === vencedorObj.numero || a.uid === vencedorObj.uid);

    if (ehAtacante) {
        atividade.vitoriasAtacantes++;
        if (atividade.bancoDefensores.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_defensor';
            atividade.fase = 'selecao';

            await verificarEParearAutomatico(sock, grupoOrigem);
            await enviarRelatorioGrupo(sock, grupoOrigem);
            return;
        }
    } else {
        atividade.vitoriasDefensores++;
        if (atividade.bancoAtacantes.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_atacante';
            atividade.fase = 'selecao';

            await verificarEParearAutomatico(sock, grupoOrigem);
            await enviarRelatorioGrupo(sock, grupoOrigem);
            return;
        }
    }

    const semLutasEmAndamento = atividade.lutadoresAtivos.length === 0;
    const semReservas = atividade.bancoAtacantes.length === 0 && atividade.bancoDefensores.length === 0;

    if (semLutasEmAndamento && semReservas && !atividade.proximoDesafiante) {
        await finalizarAtividade(sock, grupoOrigem);
    } else {
        await enviarRelatorioGrupo(sock, grupoOrigem);
    }
}

async function enviarRelatorioGrupo(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    let historicoTexto = atividade.historicoLutas.length > 0
        ? atividade.historicoLutas.map(h => `✅ ${h.vencedor} venceu ${h.perdedor}`).join('\n')
        : 'Nenhum combate concluído.';

    let derrotadosTexto = atividade.derrotados.length > 0
        ? atividade.derrotados.join('\n')
        : 'Nenhum jogador derrotado.';

    let bancoAtqTexto = atividade.bancoAtacantes.length > 0
        ? atividade.bancoAtacantes.map(a => a.nome).join(', ')
        : 'Vazio';

    let bancoDefTexto = atividade.bancoDefensores.length > 0
        ? atividade.bancoDefensores.map(d => d.nome).join(', ')
        : 'Vazio';

    const msgStatus = `📊 *STATUS DA ATIVIDADE: ${atividade.nomeAtividade.toUpperCase()}*\n\n` +
        `🏆 *Placar:* ${atividade.faccaoCriador} [${atividade.vitoriasAtacantes}] x [${atividade.vitoriasDefensores}] Defesa\n\n` +
        `⚔️ *Histórico de Vitórias:*\n${historicoTexto}\n\n` +
        `💀 *Jogadores Derrotados:*\n${derrotadosTexto}\n\n` +
        `🏦 *Banco Atacantes:* ${bancoAtqTexto}\n` +
        `🏦 *Banco Defensores:* ${bancoDefTexto}`;

    await sock.sendMessage(from, { text: msgStatus });
}

async function finalizarAtividade(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    let vencedorAtividade = 'Empate!';
    if (atividade.vitoriasAtacantes > atividade.vitoriasDefensores) {
        vencedorAtividade = `Facção ${atividade.faccaoCriador}`;
    } else if (atividade.vitoriasDefensores > atividade.vitoriasAtacantes) {
        vencedorAtividade = 'Facção Defensora';
    }

    const msgFinal = `🎉 *ATIVIDADE CONCLUÍDA!* 🎉\n\n` +
        `Atividade: *${atividade.nomeAtividade}*\n` +
        `Placar Final: *${atividade.faccaoCriador}* ${atividade.vitoriasAtacantes} x ${atividade.vitoriasDefensores} *Defesa*\n\n` +
        `🏆 *VENCEDOR DA ATIVIDADE:* ${vencedorAtividade.toUpperCase()}!`;

    await sock.sendMessage(from, { text: msgFinal });
    delete atividadesAtivas[from];
}

async function enviarPainelAtividade(sock, from, atividade) {
    const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + curr.level, 0);
    const forcaDefensores = atividade.defensores.reduce((acc, curr) => acc + curr.level, 0);

    let anunciantesTexto = atividade.anunciantes.map(a => `${a.nome} (${a.level})`).join('\n');
    let defensoresTexto = atividade.defensores.length > 0
        ? atividade.defensores.map(d => `${d.nome} (${d.level})`).join('\n')
        : 'Nenhum nome registrado.';

    const mensagemPainel = `*${atividade.nomeAtividade}*\n\n` +
        `Anunciantes:\n\n${anunciantesTexto}\n\n` +
        `Força: ${forcaAtacantes}\n\n` +
        `Defensores:\n\n${defensoresTexto}\n\n` +
        `Força: ${forcaDefensores} --\n\n` +
        `⏳ _30 minutos de lista ou digite !encerrar._`;

    await sock.sendMessage(from, { text: mensagemPainel });
}

module.exports = { 
    handleAtividadesCommands, 
    registrarResultadoLutaAtividade 
};
