const axios = require('axios'); 
const { FIREBASE_URL, GRUPOS_ARENA, obterJidEfetivo } = require('../index');
const { iniciarEstruturaBatalha } = require('./combates'); 

// Mapeamento auxiliar de emojis de facção
const EMOJIS_FACCAO = {
    'Marinha': '⚓',
    'Piratas': '🏴‍☠️',
    'Exército Revolucionário': '⚔️',
    'Governo Mundial': '⚓',
    'Caçadores de Recompensa': '🎯'
};

function obterEmojiFaccao(param) {
    // Aceita tanto a string do nome da facção quanto o próprio objeto do jogador
    const nomeFaccao = (typeof param === 'object' && param !== null) ? (param.faccao || param.faction) : param;
    return EMOJIS_FACCAO[nomeFaccao] || '⚔️';
}

function obterHoraAtualUTC3() {
    const agora = new Date();
    let horas = agora.getUTCHours() - 3;
    if (horas < 0) horas += 24;
    const horasStr = String(horas).padStart(2, '0');
    const minutosStr = String(agora.getUTCMinutes()).padStart(2, '0');
    return `${horasStr}:${minutosStr}`;
}

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
            horaInicio: null
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

                if (!atividade.faccaoDefensora) {
                    atividade.faccaoDefensora = faccaoJogador;
                }

                atividade.defensores.push({
                    uid: playerUid,
                    nome: player?.character?.charName || player?.nome || 'Defensor',
                    level: player?.info?.level ?? 1,
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

async function obterBlocoArenasFormatado(atividade) {
    if (!atividade || !atividade.lutadoresAtivos || atividade.lutadoresAtivos.length === 0) {
        return 'Nenhum combate em andamento no momento.';
    }

    let arenasAtivas = {};
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas.json`);
        arenasAtivas = res.data || {};
    } catch (e) {}

    const blocos = [];

    atividade.lutadoresAtivos.forEach(luta => {
        const arenaJid = luta.arena;
        const indexArena = GRUPOS_ARENA.indexOf(arenaJid) + 1;
        const chaveSemGus = arenaJid.replace('@g.us', '');
        const arenaData = arenasAtivas[chaveSemGus] || arenasAtivas[arenaJid];

        const nomeArena = arenaData?.nomeArena || (indexArena > 0 ? `Campo de Batalha ${indexArena}` : 'Campo de Batalha');
        const emojiP1 = obterEmojiFaccao(luta.p1);
        const emojiP2 = obterEmojiFaccao(luta.p2);
        blocos.push(`${nomeArena}:\n${luta.p1.nome} ${emojiP1} VS ${luta.p2.nome} ${emojiP2}`);
    });

    return blocos.join('\n\n');
}

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
    atividade.horaInicio = obterHoraAtualUTC3();

    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    const forcaAtacantes = atividade.bancoAtacantes.reduce((acc, curr) => acc + curr.level, 0);
    const forcaDefensores = atividade.bancoDefensores.reduce((acc, curr) => acc + curr.level, 0);

    let atacantesTexto = atividade.bancoAtacantes.map(a => `➔ ${a.nome} (${a.level})`).join('\n');
    let defensoresTexto = atividade.bancoDefensores.map(d => `➔ ${d.nome} (${d.level})`).join('\n');

    const msgInicioConfrontos = `⚔️ *INÍCIO DA FASE DE CONFRONTOS!*\n\n` +
        `${atividade.faccaoCriador}:\n\n${atacantesTexto}\n\n` +
        `> Força: ${forcaAtacantes}\n\n` +
        `${nomeDefesa}:\n\n${defensoresTexto}\n\n` +
        `> Força: ${forcaDefensores}`;

    await sock.sendMessage(from, { text: msgInicioConfrontos });

    await verificarEParearAutomatico(sock, from);
}

async function verificarEParearAutomatico(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    if (atividade.proximoDesafiante) {
        if (atividade.vezSelecao === 'banco_defensor') {
            if (atividade.bancoDefensores.length === 1) {
                const p1 = atividade.proximoDesafiante;
                const p2 = atividade.bancoDefensores.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *${nomeDefesa} só tem 1 opção!* ${p2.nome} foi alocado automaticamente contra ${p1.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
                await enviarRelatorioGrupo(sock, from);
                return;
            } else if (atividade.bancoDefensores.length > 1) {
                await sock.sendMessage(from, { 
                    text: `🏆 Vez do banco da facção *${nomeDefesa}* escolher quem enfrentará *${atividade.proximoDesafiante.nome}* usando *!escolher @jogador*.` 
                });
                return;
            }
        } else if (atividade.vezSelecao === 'banco_atacante') {
            if (atividade.bancoAtacantes.length === 1) {
                const p2 = atividade.proximoDesafiante;
                const p1 = atividade.bancoAtacantes.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *${atividade.faccaoCriador} só tem 1 opção!* ${p1.nome} foi alocado automaticamente contra ${p2.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
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

    if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
        const p1 = atividade.bancoAtacantes.shift();
        const p2 = atividade.bancoDefensores.shift();
        
        await sock.sendMessage(from, { text: `⚡ *Resta apenas 1 combatente de cada lado!* Pareamento automático: ${p1.nome} VS ${p2.nome}` });
        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
    } else if (atividade.bancoAtacantes.length > 0 && atividade.bancoDefensores.length > 0) {
        if (atividade.vezSelecao === 'atacante' && atividade.bancoDefensores.length === 1) {
            const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
            const p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
            const p2 = atividade.bancoDefensores.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 defensor da facção ${nomeDefesa}!* ${p2.nome} foi pareado automaticamente contra ${p1.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await enviarRelatorioGrupo(sock, from);
            await verificarEParearAutomatico(sock, from);
        } else if (atividade.vezSelecao === 'defensor' && atividade.bancoAtacantes.length === 1) {
            const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
            const p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
            const p1 = atividade.bancoAtacantes.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 atacante da facção ${atividade.faccaoCriador}!* ${p1.nome} foi pareado automaticamente contra ${p2.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await enviarRelatorioGrupo(sock, from);
            await verificarEParearAutomatico(sock, from);
        } else {
            let faccaoVez = atividade.vezSelecao === 'atacante' ? atividade.faccaoCriador : nomeDefesa;
            let faccaoAlvo = atividade.vezSelecao === 'atacante' ? nomeDefesa : atividade.faccaoCriador;

            await sock.sendMessage(from, { 
                text: `⚔️ Vez da facção *${faccaoVez}* escolher o combate!\nUse *!escolher @jogador* marcando um adversário de *${faccaoAlvo}*.` 
            });
        }
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
        await enviarRelatorioGrupo(sock, from);
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
        p1 = atividade.bancoAtacantes.shift();

        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
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
        await enviarRelatorioGrupo(sock, from);
    }
}

async function alocarLutaNaArena(sock, grupoOrigem, p1, p2) {
    const atividade = atividadesAtivas[grupoOrigem];
    let arenasAtivas = {};
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas.json`);
        arenasAtivas = res.data || {};
    } catch (e) {}

    const arenaDisponivelJid = GRUPOS_ARENA.find(arenaJid => {
        const chaveSemGus = arenaJid.replace('@g.us', '');
        const arenaRemote = arenasAtivas[chaveSemGus] || arenasAtivas[arenaJid];
        
        const ocupadaNoFirebase = arenaRemote && arenaRemote.fase !== 'aguardando';

        return !ocupadaNoFirebase;
    });

    if (!arenaDisponivelJid) {
        await sock.sendMessage(grupoOrigem, { text: '⚠️ Todas as arenas estão ocupadas no momento! Aguardando vaga...' });
        return false;
    }

    const chaveGrupo = arenaDisponivelJid.replace('@g.us', '');
    const indexArena = GRUPOS_ARENA.indexOf(arenaDisponivelJid) + 1;
    const arenaRemote = arenasAtivas[chaveGrupo] || {};

    const dadosBatalhaBase = iniciarEstruturaBatalha(arenaDisponivelJid, p1, p2, 'ATIVIDADE', sock);
    
    const dadosBatalha = {
        ...arenaRemote,
        ...dadosBatalhaBase,
        numeroArena: arenaRemote.numeroArena || (indexArena > 0 ? indexArena : 1),
        nomeArena: arenaRemote.nomeArena || `Campo de Batalha ${indexArena > 0 ? indexArena : 1}`,
        fase: 'apresentacao',
        grupoOrigemAtividade: grupoOrigem
    };

    const dadosParaSalvar = { ...dadosBatalha };
    delete dadosParaSalvar.sock;
    delete dadosParaSalvar.timerApresentacao;
    delete dadosParaSalvar.timerTurno;

    try {
        await axios.put(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`, dadosParaSalvar);
    } catch (e) {
        console.error('Erro ao salvar arena da atividade no Firebase:', e.message);
    }

    atividade.lutadoresAtivos.push({ p1, p2, arena: arenaDisponivelJid });

    const msgArena = `⚔️ *COMBATE DE ATIVIDADE NA ${dadosBatalha.nomeArena.toUpperCase()}!* ⚔️\n\n${p1.nome} (${p1.faccao})\n———VS———\n${p2.nome} (${p2.faccao})\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
    await sock.sendMessage(arenaDisponivelJid, { text: msgArena });

    return true;
}

async function registrarResultadoLutaAtividade(sock, grupoOrigem, vencedorObj, perdedorObj) {
    const atividade = atividadesAtivas[grupoOrigem];
    if (!atividade) return;

    atividade.historicoLutas.push({ vencedor: vencedorObj, perdedor: perdedorObj });
    atividade.derrotados.push(perdedorObj);

    atividade.lutadoresAtivos = atividade.lutadoresAtivos.filter(
        l => l.p1.lid !== vencedorObj.lid && l.p2.lid !== vencedorObj.lid
    );

    const ehAtacante = atividade.anunciantes.some(a => a.lid === vencedorObj.lid || a.numero === vencedorObj.numero || a.uid === vencedorObj.uid);

    if (ehAtacante) {
        atividade.vitoriasAtacantes++;
        
        const defensoresEmLuta = atividade.lutadoresAtivos.map(l => l.p2);
        const totalDefensoresVivos = atividade.bancoDefensores.length + defensoresEmLuta.length;

        if (atividade.bancoDefensores.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_defensor';
            await verificarEParearAutomatico(sock, grupoOrigem);
            return;
        } else if (totalDefensoresVivos > 0) {
            if (!atividade.bancoAtacantes.some(a => a.lid === vencedorObj.lid || a.uid === vencedorObj.uid)) {
                atividade.bancoAtacantes.push(vencedorObj);
            }
        } else {
            atividade.proximoDesafiante = vencedorObj;
        }
    } else {
        atividade.vitoriasDefensores++;

        const atacantesEmLuta = atividade.lutadoresAtivos.map(l => l.p1);
        const totalAtacantesVivos = atividade.bancoAtacantes.length + atacantesEmLuta.length;

        if (atividade.bancoAtacantes.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_atacante';
            await verificarEParearAutomatico(sock, grupoOrigem);
            return;
        } else if (totalAtacantesVivos > 0) {
            if (!atividade.bancoDefensores.some(d => d.lid === vencedorObj.lid || d.uid === vencedorObj.uid)) {
                atividade.bancoDefensores.push(vencedorObj);
            }
        } else {
            atividade.proximoDesafiante = vencedorObj;
        }
    }

    const semLutasEmAndamento = atividade.lutadoresAtivos.length === 0;
    const atacantesTotalmenteEliminados = atividade.bancoAtacantes.length === 0 && !atividade.lutadoresAtivos.some(l => l.p1);
    const defensoresTotalmenteEliminados = atividade.bancoDefensores.length === 0 && !atividade.lutadoresAtivos.some(l => l.p2);

    if (semLutasEmAndamento && (atacantesTotalmenteEliminados || defensoresTotalmenteEliminados)) {
        await finalizarAtividade(sock, grupoOrigem);
    } else {
        await enviarRelatorioGrupo(sock, grupoOrigem);
    }
}

async function enviarRelatorioGrupo(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    const horaInicioStr = atividade.horaInicio || '16:30';

    let derrotadosTexto = atividade.derrotados.length > 0
        ? atividade.derrotados.map(d => `➔ ${(typeof d === 'object' && d !== null ? d.nome : d)} ${obterEmojiFaccao(d)}`).join('\n')
        : 'Nenhum';

    const todosAguardando = [...atividade.bancoAtacantes, ...atividade.bancoDefensores];
    if (atividade.proximoDesafiante) {
        if (!todosAguardando.some(p => p.lid === atividade.proximoDesafiante.lid)) {
            todosAguardando.push(atividade.proximoDesafiante);
        }
    }

    let aguardandoTexto = todosAguardando.length > 0
        ? todosAguardando.map(a => `➔ ${a.nome} ${obterEmojiFaccao(a)}`).join('\n')
        : 'Nenhum';

    const blocoArenas = await obterBlocoArenasFormatado(atividade);

    const msgStatus = `📊 STATUS DA ATIVIDADE 📊\n\n` +
        `> Início: ${horaInicioStr} (UTC-3)\n` +
        `───────────────────\n` +
        `*LUTAS EM ANDAMENTO:*\n\n` +
        `${blocoArenas}\n` +
        `───────────────────\n` +
        `*JOGADORES DERROTADOS:*\n\n` +
        `${derrotadosTexto}\n` +
        `───────────────────\n` +
        `*JOGADORES AGUARDANDO:*\n\n` +
        `${aguardandoTexto}`;

    await sock.sendMessage(from, { text: msgStatus });
}

async function enviarRelatorioFinalSobreviventes(sock, from, sobreviventesLista) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    const horaInicioStr = atividade.horaInicio || '16:30';

    let sobreviventesTexto = sobreviventesLista.length > 0
        ? sobreviventesLista.map(s => `➔ ${s.nome} ${obterEmojiFaccao(s)}`).join('\n')
        : 'Nenhum';

    let derrotadosTexto = atividade.derrotados.length > 0
        ? atividade.derrotados.map(d => `➔ ${(typeof d === 'object' && d !== null ? d.nome : d)} ${obterEmojiFaccao(d)}`).join('\n')
        : 'Nenhum';

    const msgStatusFinal = `📊 STATUS DA ATIVIDADE 📊\n\n` +
        `> Início: ${horaInicioStr} (UTC-3)\n` +
        `───────────────────\n` +
        `*JOGADORES VIVOS:*\n\n` +
        `${sobreviventesTexto}\n` +
        `───────────────────\n` +
        `*JOGADORES DERROTADOS:*\n\n` +
        `${derrotadosTexto}`;

    await sock.sendMessage(from, { text: msgStatusFinal });
}

async function finalizarAtividade(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    const atacantesEmLuta = atividade.lutadoresAtivos.map(l => l.p1);
    const defensoresEmLuta = atividade.lutadoresAtivos.map(l => l.p2);

    const atacantesVivos = [...atividade.bancoAtacantes, ...atacantesEmLuta];
    const defensoresVivos = [...atividade.bancoDefensores, ...defensoresEmLuta];

    // Inclui o próximo desafiante (vencedor da última luta que ficou sem oponente) na lista de vivos correspondente
    if (atividade.proximoDesafiante) {
        const pd = atividade.proximoDesafiante;
        const ehAtacante = atividade.anunciantes.some(a => a.lid === pd.lid || a.numero === pd.numero || a.uid === pd.uid);
        if (ehAtacante) {
            if (!atacantesVivos.some(a => a.lid === pd.lid)) atacantesVivos.push(pd);
        } else {
            if (!defensoresVivos.some(d => d.lid === pd.lid)) defensoresVivos.push(pd);
        }
    }

    let faccaoVencedora = null;
    let vencedoresLista = [];

    if (atacantesVivos.length > 0 && defensoresVivos.length === 0) {
        faccaoVencedora = atividade.faccaoCriador;
        vencedoresLista = atacantesVivos;
    } else if (defensoresVivos.length > 0 && atacantesVivos.length === 0) {
        faccaoVencedora = nomeDefesa;
        vencedoresLista = defensoresVivos;
    }

    // Envia o último relatório antes de decretar a vitória com os Sobreviventes
    await enviarRelatorioFinalSobreviventes(sock, from, vencedoresLista);

    let textoRecompensas = '';

    if (faccaoVencedora && vencedoresLista.length > 0) {
        try {
            // Busca no nó geral do firebase /faccoes todas as atividades para garantir que vai achar
            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes.json`);
            const faccoesData = faccoesRes.data || {};

            let recompensa = null;

            // Tenta achar na própria facção vencedora primeiro
            const ativsFaccao = faccoesData[faccaoVencedora]?.atividades || {};
            let chaveAtividade = Object.keys(ativsFaccao).find(k => 
                k.toLowerCase() === atividade.nomeAtividade.toLowerCase() || 
                (ativsFaccao[k]?.nome && ativsFaccao[k].nome.toLowerCase() === atividade.nomeAtividade.toLowerCase())
            );

            if (chaveAtividade && ativsFaccao[chaveAtividade]) {
                recompensa = ativsFaccao[chaveAtividade].recompensa;
            } else {
                // Varre qualquer facção caso não encontre
                for (const f of Object.keys(faccoesData)) {
                    const ativs = faccoesData[f]?.atividades || {};
                    const kFound = Object.keys(ativs).find(k => 
                        k.toLowerCase() === atividade.nomeAtividade.toLowerCase() || 
                        (ativs[k]?.nome && ativs[k].nome.toLowerCase() === atividade.nomeAtividade.toLowerCase())
                    );
                    if (kFound && ativs[kFound]?.recompensa) {
                        recompensa = ativs[kFound].recompensa;
                        break;
                    }
                }
            }

            if (recompensa) {
                const berriesGanho = Number(recompensa.dinheiro || recompensa.saldo || recompensa.berries || 0);
                const expGanho = Number(recompensa.exp || 0);

                // Carrega todos os jogadores para garantir a localização pelo LID
                const playersAllRes = await axios.get(`${FIREBASE_URL}/players.json`);
                const playersAllData = playersAllRes.data || {};

                for (const jogador of vencedoresLista) {
                    const targetLid = String(jogador.lid || '').trim();
                    const targetNum = String(jogador.numero || '').trim();

                    // Procura a chave real no Firebase pelo LID ou número
                    const realFirebaseKey = Object.keys(playersAllData).find(key => {
                        const p = playersAllData[key];
                        const pLid = String(p?.number?.LID || '').trim();
                        const pNum = String(p?.number?.n || '').trim();
                        return (targetLid && pLid === targetLid) || (targetNum && pNum === targetNum) || key === jogador.uid;
                    });

                    if (!realFirebaseKey) continue;

                    const playerData = playersAllData[realFirebaseKey] || {};
                    const playerInfo = playerData.info || {};

                    const expAtual = Number(playerInfo.exp ?? playerData.exp ?? 0);
                    const saldoAtual = Number(playerInfo.saldo ?? playerData.saldo ?? 0);

                    const novoExp = expAtual + expGanho;
                    const novoSaldo = saldoAtual + berriesGanho;

                    // Atualiza em /info
                    await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}/info.json`, {
                        exp: novoExp,
                        saldo: novoSaldo
                    });

                    // Atualiza na raiz se os campos existirem lá
                    if (playerData.exp !== undefined || playerData.saldo !== undefined) {
                        await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}.json`, {
                            exp: novoExp,
                            saldo: novoSaldo
                        });
                    }
                }

                textoRecompensas = `\n\n🎁 *Recompensas Aplicadas aos Sobreviventes:*\n💰 Berries: +${berriesGanho.toLocaleString('pt-BR')}\n⭐ EXP: +${expGanho.toLocaleString('pt-BR')}`;
            }
        } catch (e) {
            console.error('Erro ao processar e creditar recompensas no Firebase:', e.message);
        }
    }

    const resultadoTexto = faccaoVencedora ? `Facção *${faccaoVencedora}*` : 'Empate!';

    const msgFinal = `🎉 *ATIVIDADE CONCLUÍDA!* 🎉\n\n` +
        `Atividade: *${atividade.nomeAtividade}*\n` +
        `🏆 *VENCEDOR DA ATIVIDADE:* ${resultadoTexto.toUpperCase()}!${textoRecompensas}`;

    await sock.sendMessage(from, { text: msgFinal });
    delete atividadesAtivas[from];
}

async function enviarPainelAtividade(sock, from, atividade) {
    const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + curr.level, 0);
    const forcaDefensores = atividade.defensores.reduce((acc, curr) => acc + curr.level, 0);

    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;

    let anunciantesTexto = atividade.anunciantes.map(a => `➔ ${a.nome} (${a.level})`).join('\n');
    let defensoresTexto = atividade.defensores.length > 0
        ? atividade.defensores.map(d => `➔ ${d.nome} (${d.level})`).join('\n')
        : 'Nenhum nome registrado.';

    const tituloDefesa = atividade.faccaoDefensora || 'Defensores';

    const dataTermino = new Date(Date.now() + 30 * 60 * 1000);
    let horas = dataTermino.getUTCHours() - 3;
    if (horas < 0) horas += 24;

    const horasStr = String(horas).padStart(2, '0');
    const minutosStr = String(dataTermino.getUTCMinutes()).padStart(2, '0');
    const horarioFormatado = `${horasStr}:${minutosStr}`;

    const mensagemPainel = `*${nomeAtividadeMaiusculo}*\n\n` +
        `> Término: ${horarioFormatado} (UTC-3)\n\n` +
        `${atividade.faccaoCriador}:\n\n${anunciantesTexto}\n\n` +
        `> Força: ${forcaAtacantes}\n\n` +
        `${tituloDefesa}:\n\n${defensoresTexto}\n\n` +
        `> Força: ${forcaDefensores}`;

    await sock.sendMessage(from, { text: mensagemPainel });
}

module.exports = { 
    handleAtividadesCommands, 
    registrarResultadoLutaAtividade 
};
