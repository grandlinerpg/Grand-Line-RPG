const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// Grupo onde os anúncios gerais de atividades e viagens são enviados
const GRUPO_ATIVIDADES_LISTA = '120363409325935641@g.us';

// Sessoes temporárias para controle de viagens e atividades tipo 1
const sessoesViagem = {};
const sessoesAtividadeTipo1 = {};

// Função auxiliar para buscar o nome da ilha no Firebase e formatar como "X. Nome da Ilha"
async function obterNomeFormatadoIlha(idIlha) {
    if (Number(idIlha) === 0) return '0. Base Operacional';
    try {
        const res = await axios.get(`${FIREBASE_URL}/ilhas/${idIlha}.json`);
        const nomeIlha = res.data?.nome;
        return nomeIlha ? `${idIlha}. ${nomeIlha}` : `${idIlha}. Ilha ${idIlha}`;
    } catch (e) {
        return `${idIlha}. Ilha ${idIlha}`;
    }
}

// Função auxiliar para formatação da data
function formatarData(d) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

// =========================================================================
// FUNÇÃO EXPORTADA: Recebe o fluxo de Atividade Tipo 1 do atividades_lista.js
// =========================================================================
async function iniciarProcessoTipo1(sock, grupoOrigem, sessao, m) {
    if (sessao.ilhaReferencia === 0) {
        const faccaoLower = String(sessao.faccaoCriador).toLowerCase();
        if (faccaoLower.includes('pirata')) {
            await sock.sendMessage(grupoOrigem, { text: '❌ Membros da facção *Piratas* não possuem acesso à Ilha 0!' }, { quoted: m });
            return true;
        }

        sessoesAtividadeTipo1[grupoOrigem] = {
            criadorUid: sessao.criadorUid,
            faccaoCriador: sessao.faccaoCriador,
            chaveAtividade: sessao.chaveAtividade,
            nomeAtividade: sessao.nomeAtividade,
            anunciantes: sessao.anunciantes
        };

        await sock.sendMessage(grupoOrigem, { 
            text: `🏝️ *Em qual ilha será iniciada a atividade?*\n\n` +
                  `Você está na *Base Operacional (Ilha 0)*.\n` +
                  `Digite o número da ilha desejada (*1 a 12*).` 
        }, { quoted: m });
        return true;
    } else {
        // Já está em uma ilha (> 0), inicia imediatamente
        return await finalizarEGravarAtividadeTipo1(sock, grupoOrigem, sessao, sessao.ilhaReferencia, m);
    }
}

// Executa o registro, notificações e conclusão da Atividade Tipo 1
async function finalizarEGravarAtividadeTipo1(sock, grupoOrigem, sessao, ilhaDestino, m) {
    try {
        const dataInicio = new Date();
        const dataTermino = new Date(dataInicio.getTime() + 1 * 60 * 1000); // 1 minuto de duração

        // Mapeia os jogadores salvando exclusivamente seus UIDs
        const jogadoresObj = {};
        sessao.anunciantes.forEach((membro, index) => {
            jogadoresObj[index + 1] = membro.uid;
        });

        const viagensRes = await axios.get(`${FIREBASE_URL}/ilhas/viagens.json`);
        const viagensExistentes = viagensRes.data || {};
        const proximoId = Object.keys(viagensExistentes).length + 1;

        const dadosAtividade = {
            tipo: 'atividade',
            atividade: sessao.chaveAtividade,
            nomeAtividade: sessao.nomeAtividade,
            inicio: formatarData(dataInicio),
            termino: formatarData(dataTermino),
            jogadores: jogadoresObj,
            ilhaDestino: ilhaDestino,
            faccao: sessao.faccaoCriador,
            grupoOrigem: grupoOrigem
        };

        await axios.patch(`${FIREBASE_URL}/ilhas/viagens/${proximoId}.json`, dadosAtividade);

        const nomeIlhaFormatado = await obterNomeFormatadoIlha(ilhaDestino);
        const horaTermino = String(dataTermino.getHours()).padStart(2, '0');
        const minTermino = String(dataTermino.getMinutes()).padStart(2, '0');
        const horarioFormatado = `${horaTermino}:${minTermino}`;
        const forcaTotal = sessao.anunciantes.reduce((acc, curr) => acc + (curr.level || 0), 0);

        // 1. Mensagem de Confirmação no GRUPO DE ORIGEM
        await sock.sendMessage(grupoOrigem, { 
            text: `🎯 *Atividade Iniciada com Sucesso!*\n\n` +
                  `📌 Atividade: *${sessao.nomeAtividade}*\n` +
                  `📍 Local: *${nomeIlhaFormatado}*\n` +
                  `⚡ Força Total: *${forcaTotal}*\n` +
                  `> Término: ${horarioFormatado} (BRT)` 
        }, { quoted: m });

        // 2. Anúncio de INÍCIO no GRUPO DE ATIVIDADES GERAL
        const mensagemInicioExterna = 
            `📢 *ATIVIDADE INICIADA NA ${nomeIlhaFormatado.toUpperCase()}*\n\n` +
            `A atividade *${sessao.nomeAtividade}* foi iniciada por membros da facção *${sessao.faccaoCriador}*!\n\n` +
            `> Força Total: ${forcaTotal}\n` +
            `> Término Previsto: ${horarioFormatado} (BRT)`;

        await sock.sendMessage(GRUPO_ATIVIDADES_LISTA, { text: mensagemInicioExterna });

        // 3. Conclusão após 1 minuto: Atualiza ilha, credita recompensas e notifica no GRUPO DE ORIGEM
        setTimeout(async () => {
            try {
                // Atualiza a ilha atual dos personagens no Firebase
                for (const membro of sessao.anunciantes) {
                    await axios.patch(`${FIREBASE_URL}/players/${membro.uid}/character.json`, {
                        ilha: ilhaDestino
                    });
                }

                // --- LÓGICA DE BUSCA E CRÉDITO DE RECOMPENSAS ---
                let baseBerries = 0;
                let baseExp = 0;

                try {
                    const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes.json`);
                    const faccoesData = faccoesRes.data || {};

                    let recompensaBase = null;

                    // Busca as regras de recompensa da atividade no Firebase
                    const ativsFaccao = faccoesData[sessao.faccaoCriador]?.atividades || {};
                    let chaveAtividade = Object.keys(ativsFaccao).find(k => 
                        k.toLowerCase() === sessao.nomeAtividade.toLowerCase() || 
                        (ativsFaccao[k]?.nome && ativsFaccao[k].nome.toLowerCase() === sessao.nomeAtividade.toLowerCase()) ||
                        k === sessao.chaveAtividade
                    );

                    if (chaveAtividade && ativsFaccao[chaveAtividade]) {
                        recompensaBase = ativsFaccao[chaveAtividade].recompensa;
                    } else {
                        for (const f of Object.keys(faccoesData)) {
                            const ativs = faccoesData[f]?.atividades || {};
                            const kFound = Object.keys(ativs).find(k => 
                                k.toLowerCase() === sessao.nomeAtividade.toLowerCase() || 
                                (ativs[k]?.nome && ativs[k].nome.toLowerCase() === sessao.nomeAtividade.toLowerCase()) ||
                                k === sessao.chaveAtividade
                            );
                            if (kFound && ativs[kFound]?.recompensa) {
                                recompensaBase = ativs[kFound].recompensa;
                                break;
                            }
                        }
                    }

                    if (recompensaBase) {
                        baseBerries = Number(recompensaBase.dinheiro || recompensaBase.saldo || recompensaBase.berries || 0);
                        baseExp = Number(recompensaBase.exp || 0);
                    } else {
                        // Valor padrão fallback baseado na força total caso não encontre no /faccoes.json
                        baseBerries = forcaTotal * 500;
                        baseExp = forcaTotal * 50;
                    }

                    // Credita a recompensa no banco de dados para todos os participantes
                    const playersAllRes = await axios.get(`${FIREBASE_URL}/players.json`);
                    const playersAllData = playersAllRes.data || {};

                    for (const membro of sessao.anunciantes) {
                        const targetUid = membro.uid;
                        const targetLid = String(membro.lid || '').trim();
                        const targetNum = String(membro.numero || '').trim();

                        const realFirebaseKey = Object.keys(playersAllData).find(key => {
                            const p = playersAllData[key];
                            const pLid = String(p?.number?.LID || '').trim();
                            const pNum = String(p?.number?.n || '').trim();
                            return key === targetUid || (targetLid && pLid === targetLid) || (targetNum && pNum === targetNum);
                        }) || targetUid;

                        const playerData = playersAllData[realFirebaseKey] || {};
                        const playerInfo = playerData.info || {};

                        const expAtual = Number(playerInfo.exp ?? playerData.exp ?? 0);
                        const saldoAtual = Number(playerInfo.saldo ?? playerData.saldo ?? 0);

                        const novoExp = expAtual + baseExp;
                        const novoSaldo = saldoAtual + baseBerries;

                        await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}/info.json`, {
                            exp: novoExp,
                            saldo: novoSaldo
                        });

                        if (playerData.exp !== undefined || playerData.saldo !== undefined) {
                            await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}.json`, {
                                exp: novoExp,
                                saldo: novoSaldo
                            });
                        }
                    }
                } catch (e) {
                    console.error('Erro ao buscar e creditar recompensas no Firebase:', e.message);
                }

                const nomesFormatados = sessao.anunciantes.map(a => a.nome).join(', ');

                const mensagemConclusao = 
                    `🎉 *ATIVIDADE CONCLUÍDA!*\n\n` +
                    `A atividade *${sessao.nomeAtividade}* em *${nomeIlhaFormatado}* foi finalizada com sucesso!\n\n` +
                    `👥 *Participantes:* ${nomesFormatados}\n\n` +
                    `🎁 *Recompensas Distribuídas:*\n` +
                    `• +${baseBerries.toLocaleString('pt-BR')} Berries\n` +
                    `• +${baseExp.toLocaleString('pt-BR')} EXP`;

                await sock.sendMessage(grupoOrigem, { text: mensagemConclusao });
            } catch (err) {
                console.error('Erro ao concluir atividade Tipo 1:', err);
            }
        }, 1 * 60 * 1000);

        delete sessoesAtividadeTipo1[grupoOrigem];
        return true;
    } catch (e) {
        await sock.sendMessage(grupoOrigem, { text: '❌ Erro ao salvar a atividade no Firebase.' }, { quoted: m });
        delete sessoesAtividadeTipo1[grupoOrigem];
        return true;
    }
}

// Handler de Comandos e Respostas de Viagem / Atividade Tipo 1
async function handleViagemCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);

    // Resposta do Selecionador de Ilha para Atividade Tipo 1 (Apenas se veio da Ilha 0)
    if (sessoesAtividadeTipo1[from]) {
        const sessao = sessoesAtividadeTipo1[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};
        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const ilhaEscolhida = parseInt(text.trim(), 10);
        if (isNaN(ilhaEscolhida) || ilhaEscolhida < 1 || ilhaEscolhida > 12) {
            await sock.sendMessage(from, { text: '❌ Escolha uma ilha válida entre 1 e 12.' }, { quoted: m });
            return true;
        }

        return await finalizarEGravarAtividadeTipo1(sock, from, sessao, ilhaEscolhida, m);
    }

    // 1. Comando Inicial: !viajar
    if (text === '!viajar') {
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
                await sock.sendMessage(from, { text: '❌ Você precisa ter um personagem cadastrado para viajar!' }, { quoted: m });
                return true;
            }

            const criadorChar = playersData[playerUid]?.character || {};
            const faccao = criadorChar.faction;

            if (!faccao) {
                await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
                return true;
            }

            const faccaoLower = String(faccao).toLowerCase();
            const ehPirata = faccaoLower.includes('pirata');

            if (ehPirata) {
                const bandoCriador = criadorChar.bando;
                if (!bandoCriador) {
                    await sock.sendMessage(from, { text: '❌ Seu personagem pertence aos Piratas mas não está cadastrado em nenhum bando!' }, { quoted: m });
                    return true;
                }

                // Busca automaticamente todos os membros do mesmo bando
                const membrosBando = [];
                let ilhaAtualGrupo = null;

                for (const uid of Object.keys(playersData)) {
                    const pChar = playersData[uid]?.character || {};
                    if (pChar.bando && String(pChar.bando).trim().toLowerCase() === String(bandoCriador).trim().toLowerCase()) {
                        const nomePlayer = pChar.charName || playersData[uid]?.nome || 'Jogador';
                        const ilhaJogador = Number(pChar.ilha ?? 0);

                        if (ilhaAtualGrupo === null) {
                            ilhaAtualGrupo = ilhaJogador;
                        } else if (ilhaJogador !== ilhaAtualGrupo) {
                            await sock.sendMessage(from, { text: `❌ Nem todos os membros do bando *${bandoCriador}* estão na mesma ilha!` }, { quoted: m });
                            return true;
                        }

                        membrosBando.push({
                            uid: uid,
                            nome: nomePlayer,
                            level: playersData[uid]?.info?.level ?? 1,
                            faccao: faccao,
                            ilhaAtual: ilhaJogador
                        });
                    }
                }

                if (membrosBando.length === 0) {
                    await sock.sendMessage(from, { text: `❌ Nenhum membro encontrado para o bando *${bandoCriador}*.` }, { quoted: m });
                    return true;
                }

                if (ilhaAtualGrupo === 0) {
                    await sock.sendMessage(from, { text: '❌ Membros da facção *Piratas* não possuem acesso à Ilha 0!' }, { quoted: m });
                    return true;
                }

                // Define a sessão diretamente na fase de escolha da ilha de destino
                sessoesViagem[from] = {
                    fase: 'aguardando_ilha_destino',
                    criadorUid: playerUid,
                    faccaoCriador: faccao,
                    bando: bandoCriador,
                    membros: membrosBando,
                    ilhaAtual: ilhaAtualGrupo
                };

                const nomeIlhaAtualFormatado = await obterNomeFormatadoIlha(ilhaAtualGrupo);
                const nomesIntegrantes = membrosBando.map(m => m.nome).join(', ');

                await sock.sendMessage(from, { 
                    text: `🏴‍☠️ *Bando:* ${bandoCriador}\n` +
                          `👥 *Integrantes:* ${nomesIntegrantes}\n\n` +
                          `🏝️ *Para qual ilha os Piratas desejam viajar?*\n` +
                          `Atualmente na *${nomeIlhaAtualFormatado}*.\n` +
                          `Digite o número da ilha desejada (*1 a 12*).` 
                }, { quoted: m });
                return true;

            } else {
                // Outras facções continuam com a pergunta de quem vai viajar
                sessoesViagem[from] = {
                    fase: 'aguardando_participantes',
                    criadorUid: playerUid,
                    faccaoCriador: faccao
                };

                await sock.sendMessage(from, { text: '👥 *Quais membros querem viajar?*\n\n_(Mencione usando @ ou digite "eu" para incluir a si mesmo)_' }, { quoted: m });
                return true;
            }

        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao iniciar a viagem.' }, { quoted: m });
            return true;
        }
    }

    // 2. Passo 1 (Para outras facções): Quais membros querem viajar?
    if (sessoesViagem[from] && sessoesViagem[from].fase === 'aguardando_participantes') {
        const sessao = sessoesViagem[from];

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

        const membrosViajantes = [];
        let ilhaAtualGrupo = null;

        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            const nomePlayer = player?.character?.charName || player?.nome || 'Jogador';

            if (player?.character?.faction !== sessao.faccaoCriador) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }

            const ilhaJogador = Number(player?.character?.ilha ?? 0);

            if (ilhaAtualGrupo === null) {
                ilhaAtualGrupo = ilhaJogador;
            } else if (ilhaJogador !== ilhaAtualGrupo) {
                await sock.sendMessage(from, { text: '❌ Todos os jogadores devem estar na mesma ilha para viajarem juntos!' }, { quoted: m });
                return true;
            }

            membrosViajantes.push({
                uid: uid,
                nome: nomePlayer,
                level: player?.info?.level ?? 1,
                faccao: sessao.faccaoCriador,
                ilhaAtual: ilhaJogador
            });
        }

        sessao.membros = membrosViajantes;
        sessao.ilhaAtual = ilhaAtualGrupo;
        sessao.fase = 'aguardando_ilha_destino';

        const nomeIlhaAtualFormatado = await obterNomeFormatadoIlha(ilhaAtualGrupo);

        let instrucaoRetornoBase = '';
        if (ilhaAtualGrupo !== 0) {
            instrucaoRetornoBase = '\n💡 *Digite 0 para retornar à Base.*';
        }

        await sock.sendMessage(from, { 
            text: `🏝️ *Para qual ilha os jogadores desejam viajar?*\n\n` +
                  `Você está atualmente na *${nomeIlhaAtualFormatado}*.\n` +
                  `Digite o número da ilha desejada (*0 a 12*).${instrucaoRetornoBase}` 
        }, { quoted: m });
        return true;
    }

    // 3. Passo 2: Escolha do número da ilha e validação de movimento
    if (sessoesViagem[from] && sessoesViagem[from].fase === 'aguardando_ilha_destino') {
        const sessao = sessoesViagem[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const ilhaDestino = parseInt(text.trim(), 10);
        const faccaoLower = String(sessao.faccaoCriador).toLowerCase();
        const ehPirata = faccaoLower.includes('pirata');

        if (ehPirata && ilhaDestino === 0) {
            await sock.sendMessage(from, { text: '❌ Membros da facção *Piratas* não possuem opção de acesso à Ilha 0!' }, { quoted: m });
            return true;
        }

        if (isNaN(ilhaDestino) || ilhaDestino < 0 || ilhaDestino > 12) {
            await sock.sendMessage(from, { text: '❌ Por favor, digite um número de ilha válido.' }, { quoted: m });
            return true;
        }

        const ilhaAtual = sessao.ilhaAtual;

        // Regras de Movimentação entre ilhas
        if (ilhaAtual !== ilhaDestino) {
            if (ilhaAtual === 0) {
                // De 0 pode ir para qualquer uma (1 a 12)
            } else if (ilhaDestino === 0) {
                // De qualquer ilha (1 a 12) pode voltar para a 0
            } else {
                // Regra circular de 1 a 12
                const avanco = (ilhaAtual % 12) + 1;
                const recuo = ilhaAtual === 1 ? 12 : ilhaAtual - 1;

                if (ilhaDestino !== avanco && ilhaDestino !== recuo) {
                    const nomeRecuo = await obterNomeFormatadoIlha(recuo);
                    const nomeAvanco = await obterNomeFormatadoIlha(avanco);
                    const opcaoZero = ehPirata ? '' : '*0 (Retornar à Base)*, ';

                    await sock.sendMessage(from, { 
                        text: `❌ Movimento inválido! Estando na *Ilha ${ilhaAtual}*, você só pode ir para ${opcaoZero}*${nomeRecuo}* ou *${nomeAvanco}*.` 
                    }, { quoted: m });
                    return true;
                }
            }
        } else {
            await sock.sendMessage(from, { text: '❌ Você já está nessa ilha!' }, { quoted: m });
            return true;
        }

        // Salvar Viagem no Firebase
        try {
            const dataInicio = new Date();
            const dataTermino = new Date(dataInicio.getTime() + 1 * 60 * 1000); // 1 minuto depois

            // Mapeia os jogadores salvando seus UIDs
            const jogadoresObj = {};
            sessao.membros.forEach((membro, index) => {
                jogadoresObj[index + 1] = membro.uid;
            });

            const viagensRes = await axios.get(`${FIREBASE_URL}/ilhas/viagens.json`);
            const viagensExistentes = viagensRes.data || {};
            const proximoId = Object.keys(viagensExistentes).length + 1;

            const dadosViagem = {
                tipo: 'viagem',
                inicio: formatarData(dataInicio),
                termino: formatarData(dataTermino),
                jogadores: jogadoresObj,
                ilhaDestino: ilhaDestino,
                faccao: sessao.faccaoCriador,
                grupoOrigem: from
            };

            if (sessao.bando) {
                dadosViagem.bando = sessao.bando;
            }

            await axios.patch(`${FIREBASE_URL}/ilhas/viagens/${proximoId}.json`, dadosViagem);

            const nomeIlhaDestinoFormatado = await obterNomeFormatadoIlha(ilhaDestino);

            const horaTermino = String(dataTermino.getHours()).padStart(2, '0');
            const minTermino = String(dataTermino.getMinutes()).padStart(2, '0');
            const horarioFormatado = `${horaTermino}:${minTermino}`;

            await sock.sendMessage(from, { 
                text: `⛵ *Viagem iniciada com sucesso!*\n\n` +
                      `📍 Destino: *${nomeIlhaDestinoFormatado}*\n` +
                      `> Término: ${horarioFormatado} (UTC-3)` 
            }, { quoted: m });

            const forcaTotal = sessao.membros.reduce((acc, curr) => acc + (curr.level || 0), 0);
            const faccaoNome = sessao.faccaoCriador;

            // Agendar anúncio de chegada após 1 minuto
            setTimeout(async () => {
                try {
                    // Atualiza a ilha atual dos jogadores no banco de dados
                    for (const membro of sessao.membros) {
                        await axios.patch(`${FIREBASE_URL}/players/${membro.uid}/character.json`, {
                            ilha: ilhaDestino
                        });
                    }

                    const mensagemChegada = 
                        `⚓ *CHEGADA NA ${nomeIlhaDestinoFormatado.toUpperCase()}*\n\n` +
                        `Membros da facção *${faccaoNome}* ${sessao.bando ? `(*${sessao.bando}*) ` : ''}acabaram de chegar em *${nomeIlhaDestinoFormatado}*!\n\n` +
                        `> Força: ${forcaTotal}`;

                    await sock.sendMessage(GRUPO_ATIVIDADES_LISTA, { text: mensagemChegada });
                } catch (err) {
                    console.error('Erro ao processar chegada da viagem:', err);
                }
            }, 1 * 60 * 1000);

            delete sessoesViagem[from];
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao salvar os dados da viagem no Firebase.' }, { quoted: m });
            delete sessoesViagem[from];
            return true;
        }
    }

    return false;
}

module.exports = {
    handleViagemCommands,
    iniciarProcessoTipo1
};
