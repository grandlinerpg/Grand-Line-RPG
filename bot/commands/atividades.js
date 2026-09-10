const axios = require('axios');
const { FIREBASE_URL, GRUPOS_ARENA, batalhas, obterJidEfetivo } = require('../index');
const { iniciarEstruturaBatalha } = require('../gameEngine');

// Armazena as sessões de criação
const sessoesCriacao = {};

// Armazena as atividades ativas no grupo
// {
//   nomeAtividade, faccaoCriador, anunciantes: [], defensores: [],
//   fase: 'lista' | 'selecao' | 'combates',
//   bancoAtacantes: [], bancoDefensores: [],
//   vezSelecao: 'atacante' | 'defensor' | 'banco_atacante' | 'banco_defensor',
//   proximoDesafiante: null,
//   lutadoresAtivos: [],
//   vitoriasAtacantes: 0, vitoriasDefensores: 0,
//   historicoLutas: [], derrotados: [], timer, criadoEm
// }
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
                String(playersData[u]?.number?.n || '').trim() === senderId
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
            String(playersData[u]?.number?.n || '').trim() === senderId
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
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const uidsParticipantes = new Set();
        if (text.includes('eu')) uidsParticipantes.add(sessao.criadorUid);

        const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentionedJids) {
            const targetId = jid.split('@')[0].split(':')[0].trim();
            const targetUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === targetId || 
                String(playersData[u]?.number?.n || '').trim() === targetId
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
                String(playersData[u]?.number?.n || '').trim() === senderId
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
                faccao: faccaoJogador
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

    // Inicialização dos Bancos de Reservas
    atividade.bancoAtacantes = [...atividade.anunciantes];
    atividade.bancoDefensores = [...atividade.defensores];
    atividade.fase = 'selecao';

    // 1 vs 1 Direto
    if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
        const p1 = atividade.bancoAtacantes.shift();
        const p2 = atividade.bancoDefensores.shift();
        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';
        await enviarRelatorioGrupo(sock, from);
    } else {
        // Escolha inicial do lado atacante
        atividade.vezSelecao = 'atacante';
        let faccaoDefensora = atividade.bancoDefensores[0]?.faccao || 'Inimigos';
        await sock.sendMessage(from, { 
            text: `⚔️ *INÍCIO DA FASE DE CONFRONTOS!*\n\nVez da facção *${atividade.faccaoCriador}* escolher o primeiro combate!\nUse *!escolher @jogador* para selecionar um oponente da facção *${faccaoDefensora}*.` 
        });
    }
}

async function processarEscolhaLutador(sock, from, targetId) {
    const atividade = atividadesAtivas[from];
    if (!atividade || atividade.fase !== 'selecao') return;

    let p1, p2;

    if (atividade.vezSelecao === 'atacante') {
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco da defesa!' });
            return;
        }

        // Seleção aleatória do atacante que escolheu o desafio
        const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
        p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];

        await alocarLutaNaArena(sock, from, p1, p2);

        // Se sobrou apenas 1 em cada lado, pareia diretamente
        if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
            const lastAtq = atividade.bancoAtacantes.shift();
            const lastDef = atividade.bancoDefensores.shift();
            await alocarLutaNaArena(sock, from, lastAtq, lastDef);
            atividade.fase = 'combates';
        } else if (atividade.bancoDefensores.length > 0 && atividade.bancoAtacantes.length > 0) {
            // Alterna a vez para a facção defensora escolher
            atividade.vezSelecao = 'defensor';
            await sock.sendMessage(from, { 
                text: `⚔️ Vez da facção defensora escolher o próximo combate!\nUse *!escolher @jogador* marcando um membro de *${atividade.faccaoCriador}*.` 
            });
        } else {
            atividade.fase = 'combates';
        }

    } else if (atividade.vezSelecao === 'defensor') {
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco dos atacantes!' });
            return;
        }

        const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
        p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
        p1 = atividade.bancoAtacantes.splice(idxAtq, 1)[0];

        await alocarLutaNaArena(sock, from, p1, p2);

        if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
            const lastAtq = atividade.bancoAtacantes.shift();
            const lastDef = atividade.bancoDefensores.shift();
            await alocarLutaNaArena(sock, from, lastAtq, lastDef);
            atividade.fase = 'combates';
        } else if (atividade.bancoAtacantes.length > 0 && atividade.bancoDefensores.length > 0) {
            atividade.vezSelecao = 'atacante';
            let faccaoDefensora = atividade.defensores[0]?.faccao || 'Inimigos';
            await sock.sendMessage(from, { 
                text: `⚔️ Vez de *${atividade.faccaoCriador}* escolher o combate!\nUse *!escolher @jogador* marcando um membro da defesa (*${faccaoDefensora}*).` 
            });
        } else {
            atividade.fase = 'combates';
        }

    } else if (atividade.vezSelecao === 'banco_defensor') {
        // Banco da Defesa escolhe quem entra contra o vencedor Atacante
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco da defesa!' });
            return;
        }

        p1 = atividade.proximoDesafiante;
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';

    } else if (atividade.vezSelecao === 'banco_atacante') {
        // Banco Atacante escolhe quem entra contra o vencedor Defensor
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco atacante!' });
            return;
        }

        p2 = atividade.proximoDesafiante;
        p1 = atividade.bancoAtacantes.splice(idxAtq, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        atividade.fase = 'combates';
    }

    await enviarRelatorioGrupo(sock, from);
}

async function alocarLutaNaArena(sock, grupoOrigem, p1, p2) {
    const atividade = atividadesAtivas[grupoOrigem];

    // Encontra arena livre
    const arenaDisponivel = GRUPOS_ARENA.find(arenaJid => !batalhas[arenaJid]);

    if (!arenaDisponivel) {
        await sock.sendMessage(grupoOrigem, { text: '⚠️ Todas as arenas estão ocupadas no momento! Aguardando liberação...' });
        return false;
    }

    iniciarEstruturaBatalha(arenaDisponivel, p1, p2, 'ATIVIDADE', sock);
    
    // Vincula a batalha à atividade no grupo principal
    batalhas[arenaDisponivel].grupoOrigemAtividade = grupoOrigem;

    atividade.lutadoresAtivos.push({ p1, p2, arena: arenaDisponivel });

    const msgArena = `⚔️ *COMBATE DE ATIVIDADE!* ⚔️\n\n${p1.nome} (${p1.faccao})\n———VS———\n${p2.nome} (${p2.faccao})\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
    await sock.sendMessage(arenaDisponivel, { text: msgArena });

    return true;
}

// Chamado por comebates.js quando !win é acionado numa luta de atividade
async function registrarResultadoLutaAtividade(sock, grupoOrigem, vencedorObj, perdedorObj) {
    const atividade = atividadesAtivas[grupoOrigem];
    if (!atividade) return;

    // Atualiza histórico
    atividade.historicoLutas.push({ vencedor: vencedorObj.nome, perdedor: perdedorObj.nome });
    atividade.derrotados.push(perdedorObj.nome);

    // Remove das lutas ativas
    atividade.lutadoresAtivos = atividade.lutadoresAtivos.filter(
        l => l.p1.lid !== vencedorObj.lid && l.p2.lid !== vencedorObj.lid
    );

    const ehAtacante = atividade.anunciantes.some(a => a.lid === vencedorObj.lid || a.numero === vencedorObj.numero);

    if (ehAtacante) {
        atividade.vitoriasAtacantes++;
        // Se ainda restam defensores no banco, o banco da defesa escolhe o próximo oponente
        if (atividade.bancoDefensores.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_defensor';
            atividade.fase = 'selecao';

            let faccaoDef = atividade.defensores[0]?.faccao || 'Defensora';
            await sock.sendMessage(grupoOrigem, { 
                text: `🏆 *${vencedorObj.nome}* venceu o combate!\n\nAgora é a vez do banco da facção *${faccaoDef}* escolher quem irá enfrentar *${vencedorObj.nome}* usando *!escolher @jogador*.` 
            });
            await enviarRelatorioGrupo(sock, grupoOrigem);
            return;
        }
    } else {
        atividade.vitoriasDefensores++;
        // Se ainda restam atacantes no banco, o banco atacante escolhe
        if (atividade.bancoAtacantes.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_atacante';
            atividade.fase = 'selecao';

            await sock.sendMessage(grupoOrigem, { 
                text: `🏆 *${vencedorObj.nome}* venceu o combate!\n\nAgora é a vez do banco de *${atividade.faccaoCriador}* escolher quem irá enfrentar *${vencedorObj.nome}* usando *!escolher @jogador*.` 
            });
            await enviarRelatorioGrupo(sock, grupoOrigem);
            return;
        }
    }

    // Verifica se a atividade encerrou por completo
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
