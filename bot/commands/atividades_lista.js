const axios = require('axios'); 
const { FIREBASE_URL, obterJidEfetivo } = require('../index');
const { 
    atividadesAtivas, 
    sessoesCriacao, 
    obterEmojiFaccao, 
    obterNomeTerritorio, 
    encerrarListaEIniciarPartida, 
    processarEscolhaLutador 
} = require('./atividades_lutas');

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

    // 3. Passo 2: Participantes Inicializadores (Atacantes)
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
        let ilhaReferencia = null;

        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            const nomePlayer = player?.character?.charName || player?.nome || 'Lutador';

            if (player?.character?.faction !== sessao.faccaoCriador) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }

            const ilhaJogador = Number(player?.character?.ilha ?? 0);

            if (ilhaJogador === 0) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não está localizado em uma ilha válida (Ilha 0).` }, { quoted: m });
                return true;
            }

            if (ilhaReferencia === null) {
                ilhaReferencia = ilhaJogador;
            } else if (ilhaJogador !== ilhaReferencia) {
                await sock.sendMessage(from, { text: `❌ Todos os atacantes escolhidos devem estar na mesma ilha!` }, { quoted: m });
                return true;
            }

            anunciantes.push({
                uid: uid,
                nome: nomePlayer,
                level: player?.info?.level ?? 1,
                lid: player?.number?.LID || senderId,
                numero: player?.number?.n || senderId,
                faccao: sessao.faccaoCriador,
                ilha: ilhaJogador
            });
        }

        atividadesAtivas[from] = {
            nomeAtividade: sessao.nomeAtividade,
            faccaoCriador: sessao.faccaoCriador,
            faccaoDefensora: null,
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
            derrotados: [],
            horaInicio: null,
            idIlha: ilhaReferencia
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

    // 4. Entrar na defesa: !participar ou !participar @jogador
    if (text.startsWith('!participar')) {
        const atividade = atividadesAtivas[from];
        if (!atividade || atividade.fase !== 'lista') {
            await sock.sendMessage(from, { text: '❌ Não há nenhuma atividade aberta para inscrições no momento.' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const targetsToRegister = [];

            if (mentionedJids.length > 0) {
                for (const jid of mentionedJids) {
                    const targetId = jid.split('@')[0].split(':')[0].trim();
                    const targetUid = Object.keys(playersData).find(u => 
                        String(playersData[u]?.number?.LID || '').trim() === targetId || 
                        String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
                    );
                    if (targetUid) targetsToRegister.push(targetUid);
                }
            } else {
                const playerUid = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.LID || '').trim() === senderId || 
                    String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
                );
                if (playerUid) targetsToRegister.push(playerUid);
            }

            if (targetsToRegister.length === 0) {
                await sock.sendMessage(from, { text: '❌ Você precisa estar cadastrado para participar!' }, { quoted: m });
                return true;
            }

            let adicionouAlguem = false;

            for (const playerUid of targetsToRegister) {
                const player = playersData[playerUid];
                const faccaoJogador = player?.character?.faction;

                if (!faccaoJogador) continue;

                if (faccaoJogador === atividade.faccaoCriador) {
                    await sock.sendMessage(from, { text: `❌ *${player?.character?.charName || 'Jogador'}* pertence à mesma facção atacante (*${atividade.faccaoCriador}*) e não pode entrar na defesa!` }, { quoted: m });
                    continue;
                }

                if (atividade.faccaoDefensora && faccaoJogador !== atividade.faccaoDefensora) {
                    await sock.sendMessage(from, { text: `❌ Todos os defensores devem pertencer à mesma facção! A defesa atual pertence à facção *${atividade.faccaoDefensora}*.` }, { quoted: m });
                    continue;
                }

                const jaEhAnunciante = atividade.anunciantes.some(a => a.uid === playerUid);
                const jaEhDefensor = atividade.defensores.some(d => d.uid === playerUid);

                if (jaEhAnunciante || jaEhDefensor) {
                    await sock.sendMessage(from, { text: `⚠️ *${player?.character?.charName || 'Jogador'}* já está registrado nesta atividade!` }, { quoted: m });
                    continue;
                }

                const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + (curr.level || 0), 0);
                const forcaDefensoresAtual = atividade.defensores.reduce((acc, curr) => acc + (curr.level || 0), 0);
                const nivelNovoJogador = player?.info?.level ?? 1;

                if (forcaDefensoresAtual + nivelNovoJogador > forcaAtacantes) {
                    await sock.sendMessage(from, { text: `❌ *${player?.character?.charName || 'Jogador'}* (Level ${nivelNovoJogador}) não pode ser inserido! A força da defesa (${forcaDefensoresAtual + nivelNovoJogador}) ultrapassaria a força dos atacantes (${forcaAtacantes}).` }, { quoted: m });
                    continue;
                }

                if (!atividade.faccaoDefensora) {
                    atividade.faccaoDefensora = faccaoJogador;
                }

                atividade.defensores.push({
                    uid: playerUid,
                    nome: player?.character?.charName || player?.nome || 'Defensor',
                    level: nivelNovoJogador,
                    lid: player?.number?.LID || senderId,
                    numero: player?.number?.n || senderId,
                    faccao: faccaoJogador
                });

                adicionouAlguem = true;
            }

            if (adicionouAlguem) {
                await enviarPainelAtividade(sock, from, atividade);
            }
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao registrar participação.' }, { quoted: m });
            return true;
        }
    }

    // 5. Remover da lista: !remover ou !remover @jogador
    if (text.startsWith('!remover')) {
        const atividade = atividadesAtivas[from];
        if (!atividade || atividade.fase !== 'lista') {
            await sock.sendMessage(from, { text: '❌ Não há nenhuma atividade aberta em fase de inscrição para remover participantes.' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const targetsToRemove = [];

            if (mentionedJids.length > 0) {
                for (const jid of mentionedJids) {
                    const targetId = jid.split('@')[0].split(':')[0].trim();
                    const targetUid = Object.keys(playersData).find(u => 
                        String(playersData[u]?.number?.LID || '').trim() === targetId || 
                        String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
                    );
                    if (targetUid) targetsToRemove.push(targetUid);
                }
            } else {
                const playerUid = Object.keys(playersData).find(u => 
                    String(playersData[u]?.number?.LID || '').trim() === senderId || 
                    String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
                );
                if (playerUid) targetsToRemove.push(playerUid);
            }

            if (targetsToRemove.length === 0) {
                await sock.sendMessage(from, { text: '❌ Jogador não encontrado no banco de dados.' }, { quoted: m });
                return true;
            }

            let removeuAlguem = false;

            for (const uid of targetsToRemove) {
                const idxAtq = atividade.anunciantes.findIndex(a => a.uid === uid);
                if (idxAtq !== -1) {
                    atividade.anunciantes.splice(idxAtq, 1);
                    removeuAlguem = true;
                    continue;
                }

                const idxDef = atividade.defensores.findIndex(d => d.uid === uid);
                if (idxDef !== -1) {
                    atividade.defensores.splice(idxDef, 1);
                    removeuAlguem = true;
                    if (atividade.defensores.length === 0) {
                        atividade.faccaoDefensora = null;
                    }
                }
            }

            if (removeuAlguem) {
                await enviarPainelAtividade(sock, from, atividade);
            } else {
                await sock.sendMessage(from, { text: '⚠️ O(s) jogador(es) informado(s) não estão inscritos na atividade.' }, { quoted: m });
            }

            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao remover participante.' }, { quoted: m });
            return true;
        }
    }

    // 6. Encerrar Lista e Iniciar Confrontos: !encerrar
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

    // 7. Selecionar oponente durante as rodadas de pareamento: !escolher @jogador
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

async function enviarPainelAtividade(sock, from, atividade) {
    const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + (curr.level || 0), 0);
    const forcaDefensores = atividade.defensores.reduce((acc, curr) => acc + (curr.level || 0), 0);

    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador, atividade);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;

    let anunciantesTexto = atividade.anunciantes.map(a => `➔ ${a.nome} (${a.level || 1})`).join('\n');
    let defensoresTexto = atividade.defensores.length > 0
        ? atividade.defensores.map(d => `➔ ${d.nome} (${d.level || 1})`).join('\n')
        : 'Nenhum nome registrado.';

    const tituloDefesa = atividade.faccaoDefensora || 'Defensores';

    const dataTermino = new Date(Date.now() + 30 * 60 * 1000);
    let horas = dataTermino.getUTCHours() - 3;
    if (horas < 0) horas += 24;

    const horasStr = String(horas).padStart(2, '0');
    const minutosStr = String(dataTermino.getUTCMinutes()).padStart(2, '0');
    const horarioFormatado = `${horasStr}:${minutosStr}`;

    const textoTerritorio = await obterNomeTerritorio(atividade.idIlha);

    let mensagemPainel = `*${nomeAtividadeMaiusculo}*\n\n`;
    if (textoTerritorio) {
        mensagemPainel += `${textoTerritorio}\n`;
    }
    mensagemPainel += `> Término: ${horarioFormatado} (BRT)\n\n` +
        `${atividade.faccaoCriador}:\n\n${anunciantesTexto}\n\n` +
        `> Força: ${forcaAtacantes}\n\n` +
        `${tituloDefesa}:\n\n${defensoresTexto}\n\n` +
        `> Força: ${forcaDefensores}`;

    await sock.sendMessage(from, { text: mensagemPainel });
}

module.exports = { 
    handleAtividadesCommands 
};
