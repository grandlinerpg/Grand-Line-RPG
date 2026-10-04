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
const { iniciarProcessoTipo1 } = require('./viagem');

const GRUPO_ATIVIDADES_LISTA = '120363409325935641@g.us';

// Função auxiliar para determinar como se referir à facção/bando
function obterNomeExibicaoFaccao(faccao, bando) {
    if (faccao === 'Piratas' && bando) {
        return bando;
    }
    return faccao;
}

async function handleAtividadesCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);

    // 1. Comando Inicial: !iniciaratividade
    if (text === '!iniciaratividade') {
        const gruposPermitidos = [
            '120363408918568715@g.us',
            '120363408644122202@g.us',
            '120363411388017464@g.us'
        ];

        if (!gruposPermitidos.includes(from)) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos permitidos!' }, { quoted: m });
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
                await sock.sendMessage(from, { text: '❌ Você precisa ter um personagem cadastrado para iniciar uma atividade!' }, { quoted: m });
                return true;
            }

            const faccao = playersData[playerUid]?.character?.faction;
            const bandoCriador = playersData[playerUid]?.character?.bando;

            if (!faccao) {
                await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
                return true;
            }

            // Buscar atividades da facção (nó permanece sendo a faccao ex: Piratas)
            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes/${faccao}/atividades.json`);
            const atividadesFaccao = faccoesRes.data || {};

            const chavesAtividades = Object.keys(atividadesFaccao);
            const nomeExibicaoFaccao = obterNomeExibicaoFaccao(faccao, bandoCriador);

            if (chavesAtividades.length === 0) {
                await sock.sendMessage(from, { text: `❌ Não há atividades cadastradas para *${nomeExibicaoFaccao}*.` }, { quoted: m });
                return true;
            }

            let listaTexto = `❓ *Qual atividade você deseja iniciar?*\n\n*Atividades disponíveis para ${nomeExibicaoFaccao}:*\n`;
            chavesAtividades.forEach(key => {
                const ativ = atividadesFaccao[key];
                const nomeAtiv = ativ?.nome || key;
                listaTexto += `• *${nomeAtiv}*\n`;
            });

            sessoesCriacao[from] = {
                fase: 'aguardando_nome',
                criadorUid: playerUid,
                faccaoCriador: faccao,
                bandoCriador: bandoCriador
            };

            await sock.sendMessage(from, { text: listaTexto }, { quoted: m });
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

            const nomeExibicaoFaccao = obterNomeExibicaoFaccao(sessao.faccaoCriador, sessao.bandoCriador);

            if (!chaveAtividade) {
                await sock.sendMessage(from, { text: `❌ A atividade "*${text}*" não pertence ou não está disponível para *${nomeExibicaoFaccao}*.` }, { quoted: m });
                delete sessoesCriacao[from];
                return true;
            }

            const ativDados = atividadesFaccao[chaveAtividade];
            sessao.chaveAtividade = chaveAtividade;
            sessao.nomeAtividade = ativDados?.nome || text;
            sessao.nivelAtividade = ativDados?.nivel || 1;
            sessao.tipoAtividade = Number(ativDados?.tipo || 1);
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

        // Validação de quantidade min e max
        try {
            const ativRes = await axios.get(`${FIREBASE_URL}/faccoes/${sessao.faccaoCriador}/atividades/${sessao.chaveAtividade}/jogadores.json`);
            const limitesJogadores = ativRes.data || {};

            const min = limitesJogadores.min !== undefined ? Number(limitesJogadores.min) : null;
            const max = limitesJogadores.max !== undefined ? Number(limitesJogadores.max) : null;
            const qtd = uidsParticipantes.size;

            if (min !== null && qtd < min) {
                await sock.sendMessage(from, { text: `❌ A quantidade de jogadores escolhida (${qtd}) é menor que o mínimo necessário (${min}) para esta atividade.` }, { quoted: m });
                return true;
            }

            if (max !== null && qtd > max) {
                await sock.sendMessage(from, { text: `❌ A quantidade de jogadores escolhida (${qtd}) excede o máximo permitido (${max}) para esta atividade.` }, { quoted: m });
                return true;
            }
        } catch (e) {}

        // Validação do limite de realização da atividade por jogador (Apenas Atacantes)
        try {
            const limiteRes = await axios.get(`${FIREBASE_URL}/faccoes/${sessao.faccaoCriador}/atividades/${sessao.chaveAtividade}/limite.json`);
            const limiteAtividade = limiteRes.data !== null ? Number(limiteRes.data) : null;

            if (limiteAtividade !== null) {
                for (const uid of uidsParticipantes) {
                    const player = playersData[uid];
                    const nomePlayer = player?.character?.charName || player?.nome || 'Jogador';
                    const realizadas = Number(player?.atividades?.[sessao.chaveAtividade] ?? 0);

                    if (realizadas >= limiteAtividade) {
                        await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* já atingiu o limite semanal desta atividade (${realizadas}/${limiteAtividade})!` }, { quoted: m });
                        return true;
                    }
                }
            }
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao consultar limite da atividade no Firebase.' }, { quoted: m });
            return true;
        }

        const anunciantes = [];
        let ilhaReferencia = null;

        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            const nomePlayer = player?.character?.charName || player?.nome || 'Lutador';
            const faccaoPlayer = player?.character?.faction;
            const bandoPlayer = player?.character?.bando;

            if (faccaoPlayer !== sessao.faccaoCriador) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }

            if (sessao.faccaoCriador === 'Piratas' && bandoPlayer !== sessao.bandoCriador) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não pertence ao mesmo bando (*${sessao.bandoCriador}*)!` }, { quoted: m });
                return true;
            }

            const ilhaJogador = Number(player?.character?.ilha ?? 0);

            if (ilhaReferencia === null) {
                ilhaReferencia = ilhaJogador;
            } else if (ilhaJogador !== ilhaReferencia) {
                await sock.sendMessage(from, { text: `❌ Todos os participantes escolhidos devem estar na mesma ilha!` }, { quoted: m });
                return true;
            }

            anunciantes.push({
                uid: uid,
                nome: nomePlayer,
                level: player?.info?.level ?? 1,
                lid: player?.number?.LID || senderId,
                numero: player?.number?.n || senderId,
                faccao: sessao.faccaoCriador,
                bando: bandoPlayer,
                ilha: ilhaJogador
            });
        }

        // ==========================================
        // REGISTRO DE ATIVIDADES E DATA NO FIREBASE
        // ==========================================
        try {
            const dataAtualIso = new Date().toISOString();
            for (const uid of uidsParticipantes) {
                const player = playersData[uid];
                const qtdAtual = Number(player?.atividades?.[sessao.chaveAtividade] ?? 0);

                // Incrementa a atividade iniciada em +1 e atualiza o campo data em /atividades
                await axios.patch(`${FIREBASE_URL}/players/${uid}/atividades.json`, {
                    [sessao.chaveAtividade]: qtdAtual + 1,
                    data: dataAtualIso
                });
            }
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao registrar o incremento de atividade dos jogadores no Firebase.' }, { quoted: m });
            return true;
        }

        sessao.anunciantes = anunciantes;
        sessao.ilhaReferencia = ilhaReferencia;

        // ==========================================
        // TRANSFERÊNCIA SE FOR TIPO 1
        // ==========================================
        if (sessao.tipoAtividade === 1) {
            delete sessoesCriacao[from];
            return await iniciarProcessoTipo1(sock, from, sessao, m);
        }

        // ==========================================
        // FLUXO PARA ATIVIDADES TIPO 2 E TIPO 3
        // ==========================================
        if (ilhaReferencia === 0) {
            await sock.sendMessage(from, { text: `❌ Os participantes não podem estar na Ilha 0 para iniciar este tipo de atividade.` }, { quoted: m });
            delete sessoesCriacao[from];
            return true;
        }

        let faccaoDefensoraCalculada = null;
        let bandoDefensorCalculado = null;

        if (sessao.tipoAtividade === 2 || sessao.tipoAtividade === 3) {
            try {
                const ilhaRes = await axios.get(`${FIREBASE_URL}/ilhas/${ilhaReferencia}.json`);
                const ilhaDados = ilhaRes.data || {};
                const dominioIlha = ilhaDados.dominio;
                const escudoIlha = Number(ilhaDados.escudo ?? 0);

                const nomeAtacante = obterNomeExibicaoFaccao(sessao.faccaoCriador, sessao.bandoCriador);

                if (dominioIlha === sessao.faccaoCriador || dominioIlha === sessao.bandoCriador) {
                    await sock.sendMessage(from, { text: `❌ O seu grupo (*${nomeAtacante}*) já domina este território!` }, { quoted: m });
                    delete sessoesCriacao[from];
                    return true;
                }

                if (sessao.tipoAtividade === 3 && escudoIlha !== 0) {
                    await sock.sendMessage(from, { text: `❌ Esta atividade não pode ser iniciada porque a ilha possui escudo ativo (Escudo: ${escudoIlha})!` }, { quoted: m });
                    delete sessoesCriacao[from];
                    return true;
                }

                if (dominioIlha) {
                    const faccoesConhecidas = ['Marinha', 'Exército Revolucionário', 'Revolucionarios', 'Governo Mundial'];
                    if (faccoesConhecidas.includes(dominioIlha)) {
                        faccaoDefensoraCalculada = dominioIlha;
                    } else {
                        faccaoDefensoraCalculada = 'Piratas';
                        bandoDefensorCalculado = dominioIlha;
                    }
                }
            } catch (e) {
                await sock.sendMessage(from, { text: '❌ Erro ao consultar dados da ilha no Firebase.' }, { quoted: m });
                delete sessoesCriacao[from];
                return true;
            }
        }

        atividadesAtivas[GRUPO_ATIVIDADES_LISTA] = {
            nomeAtividade: sessao.nomeAtividade,
            tipoAtividade: sessao.tipoAtividade,
            faccaoCriador: sessao.faccaoCriador,
            bandoCriador: sessao.bandoCriador,
            faccaoDefensora: faccaoDefensoraCalculada,
            bandoDefensor: bandoDefensorCalculado,
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

        atividadesAtivas[GRUPO_ATIVIDADES_LISTA].timer = setTimeout(async () => {
            if (atividadesAtivas[GRUPO_ATIVIDADES_LISTA] && atividadesAtivas[GRUPO_ATIVIDADES_LISTA].fase === 'lista') {
                await sock.sendMessage(GRUPO_ATIVIDADES_LISTA, { text: `⏳ *O tempo de 30 minutos da atividade "${atividadesAtivas[GRUPO_ATIVIDADES_LISTA].nomeAtividade}" encerrou! Iniciando fase de combates...*` });
                await encerrarListaEIniciarPartida(sock, GRUPO_ATIVIDADES_LISTA);
            }
        }, 30 * 60 * 1000);

        delete sessoesCriacao[from];
        await enviarPainelAtividade(sock, GRUPO_ATIVIDADES_LISTA, atividadesAtivas[GRUPO_ATIVIDADES_LISTA]);
        return true;
    }

    if (from !== GRUPO_ATIVIDADES_LISTA) {
        return false;
    }

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
                const bandoJogador = player?.character?.bando;
                const ilhaJogador = Number(player?.character?.ilha ?? 0);

                if (!faccaoJogador) continue;

                // Restrição de ilha para atividades do tipo 2 e 3
                if (atividade.tipoAtividade === 2 || atividade.tipoAtividade === 3) {
                    if (ilhaJogador !== 0 && ilhaJogador !== atividade.idIlha) {
                        await sock.sendMessage(from, { text: `❌ *${player?.character?.charName || 'Jogador'}* não está na mesma ilha da atividade e nem na Ilha 0!` }, { quoted: m });
                        continue;
                    }
                }

                // Verificação de mesmo bando / facção do atacante
                const ehMesmoGrupoAtacante = (faccaoJogador === 'Piratas' || atividade.faccaoCriador === 'Piratas')
                    ? (bandoJogador && atividade.bandoCriador && bandoJogador === atividade.bandoCriador)
                    : (faccaoJogador === atividade.faccaoCriador);

                if (ehMesmoGrupoAtacante) {
                    const nomeAtacante = obterNomeExibicaoFaccao(atividade.faccaoCriador, atividade.bandoCriador);
                    await sock.sendMessage(from, { text: `❌ *${player?.character?.charName || 'Jogador'}* pertence ao mesmo grupo atacante (*${nomeAtacante}*) e não pode entrar na defesa!` }, { quoted: m });
                    continue;
                }

                // Verificação de mesmo bando / facção dos defensores
                if (atividade.faccaoDefensora || atividade.bandoDefensor) {
                    let mesmoBandoDefensora = false;

                    if (faccaoJogador === 'Piratas' || atividade.faccaoDefensora === 'Piratas') {
                        mesmoBandoDefensora = (bandoJogador && atividade.bandoDefensor) 
                            ? (bandoJogador === atividade.bandoDefensor)
                            : (bandoJogador === atividade.faccaoDefensora || faccaoJogador === atividade.faccaoDefensora);
                    } else {
                        mesmoBandoDefensora = (faccaoJogador === atividade.faccaoDefensora);
                    }

                    if (!mesmoBandoDefensora) {
                        const nomeDefesa = obterNomeExibicaoFaccao(atividade.faccaoDefensora, atividade.bandoDefensor);
                        await sock.sendMessage(from, { text: `❌ Todos os defensores devem pertencer ao mesmo bando/facção! A defesa atual pertence a *${nomeDefesa}*.` }, { quoted: m });
                        continue;
                    }
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

                if (!atividade.faccaoDefensora && !atividade.bandoDefensor) {
                    atividade.faccaoDefensora = faccaoJogador;
                    atividade.bandoDefensor = bandoJogador;
                }

                atividade.defensores.push({
                    uid: playerUid,
                    nome: player?.character?.charName || player?.nome || 'Defensor',
                    level: nivelNovoJogador,
                    lid: player?.number?.LID || senderId,
                    numero: player?.number?.n || senderId,
                    faccao: faccaoJogador,
                    bando: bandoJogador
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
                        atividade.bandoDefensor = null;
                    }
                }
            }

            if (removeuAlguem) {
                await enviarPainelAtividade(sock, from, atividade);
            } else {
                await sock.sendMessage(from, { text: '⚠ O(s) jogador(es) informado(s) não estão inscritos na atividade.' }, { quoted: m });
            }

            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao remover participante.' }, { quoted: m });
            return true;
        }
    }

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

async function enviarPainelAtividade(sock, targetGroup, atividade) {
    const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + (curr.level || 0), 0);
    const forcaDefensores = atividade.defensores.reduce((acc, curr) => acc + (curr.level || 0), 0);

    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador, atividade);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;

    let anunciantesTexto = atividade.anunciantes.map(a => `➔ ${a.nome} (${a.level || 1})`).join('\n');
    let defensoresTexto = atividade.defensores.length > 0
        ? atividade.defensores.map(d => `➔ ${d.nome} (${d.level || 1})`).join('\n')
        : 'Nenhum nome registrado.';

    const tituloAtacante = obterNomeExibicaoFaccao(atividade.faccaoCriador, atividade.bandoCriador);
    const tituloDefesa = atividade.faccaoDefensora || atividade.bandoDefensor
        ? obterNomeExibicaoFaccao(atividade.faccaoDefensora, atividade.bandoDefensor)
        : 'Defensores';

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
        `${tituloAtacante}:\n\n${anunciantesTexto}\n\n` +
        `> Força: ${forcaAtacantes}\n\n` +
        `${tituloDefesa}:\n\n${defensoresTexto}\n\n` +
        `> Força: ${forcaDefensores}`;

    await sock.sendMessage(targetGroup, { text: mensagemPainel });
}

module.exports = { 
    handleAtividadesCommands 
};
