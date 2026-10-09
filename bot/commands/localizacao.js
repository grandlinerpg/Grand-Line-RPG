const axios = require('axios');
const {
    FIREBASE_URL,
    obterEmojiFaccao,
    obterJidEfetivo,
    formatarJidPv
} = require('../index');

// =========================================================================
// CONFIGURAÇÕES DO COMANDO
// =========================================================================

const PIRATAS_EXIGEM_MESMO_BANDO = true;

const GRUPOS_FACCOES = [
    '120363408918568715@g.us', // Exército Revolucionário
    '120363408644122202@g.us'  // Governo Mundial
];

const GRUPOS_BANDOS = [
    '120363411388017464@g.us'  // Piratas das Feras
];

const GRUPOS_PERMITIDOS = [...GRUPOS_FACCOES, ...GRUPOS_BANDOS];

// =========================================================================
// FUNÇÕES AUXILIARES DE DATA E VIAGEM / ATIVIDADE
// =========================================================================

function converterDataPtBrParaDate(strData) {
    if (!strData || typeof strData !== 'string') return null;
    // Espera formato "DD/MM/YYYY HH:mm:ss" ou similar
    const partes = strData.split(' ');
    if (partes.length < 2) return null;

    const [dia, mes, ano] = partes[0].split('/').map(Number);
    const [hora, min, seg] = partes[1].split(':').map(Number);

    return new Date(ano, mes - 1, dia, hora, min, seg || 0);
}

function obterViagensAtivas(viagensData) {
    if (!viagensData) return [];
    const agora = new Date();

    return Object.values(viagensData).filter(v => {
        if (!v || !v.inicio || !v.termino) return false;
        const inicio = converterDataPtBrParaDate(v.inicio);
        const termino = converterDataPtBrParaDate(v.termino);

        return inicio && termino && agora >= inicio && agora <= termino;
    });
}

function obterViagemAtivaDoJogador(uid, viagensAtivas) {
    return viagensAtivas.find(v => {
        if (!v.jogadores) return false;
        return Object.values(v.jogadores).includes(uid);
    });
}

function formatarHorarioBRT(date) {
    if (!date) return '';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Busca o tipo da atividade na facção do personagem no Firebase
 */
async function obterTipoAtividade(faccao, nomeStatus) {
    if (!faccao || !nomeStatus) return null;
    try {
        const res = await axios.get(`${FIREBASE_URL}/faccoes/${encodeURIComponent(faccao)}/atividades.json`);
        const atividades = res.data || {};

        const chaveAtividade = Object.keys(atividades).find(k =>
            k.toLowerCase() === nomeStatus.toLowerCase() ||
            (atividades[k]?.nome && atividades[k].nome.toLowerCase() === nomeStatus.toLowerCase())
        );

        return chaveAtividade ? Number(atividades[chaveAtividade]?.tipo ?? 1) : null;
    } catch (e) {
        return null;
    }
}

// =========================================================================
// FUNÇÕES AUXILIARES GERAIS
// =========================================================================

function normalizar(valor) {
    return String(valor || '').trim().toLowerCase();
}

function semAcento(valor) {
    return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extrairId(jid) {
    return String(jid).split('@')[0].split(':')[0].trim();
}

function encontrarUid(playersData, id) {
    return Object.keys(playersData).find(uid =>
        String(playersData[uid]?.number?.LID || '').trim() === id ||
        String(playersData[uid]?.number?.n || '').trim() === id ||
        uid === id
    );
}

function nomeDoJogador(player) {
    return player?.character?.charName || player?.nome || 'Sem Nome';
}

function obterIlha(character) {
    const n = Number(character?.ilha);
    return (character?.ilha === undefined || character?.ilha === null || Number.isNaN(n)) ? null : n;
}

function ehDaMinhaFaccao(meuChar, outroChar) {
    const minhaFaccao = normalizar(meuChar?.faction);
    if (!minhaFaccao || minhaFaccao !== normalizar(outroChar?.faction)) return false;

    if (PIRATAS_EXIGEM_MESMO_BANDO && minhaFaccao.includes('pirata')) {
        const meuBando = normalizar(meuChar?.bando);
        return meuBando !== '' && meuBando === normalizar(outroChar?.bando);
    }
    return true;
}

async function obterNavioBando(nomeBando) {
    if (!nomeBando) return null;
    try {
        const res = await axios.get(`${FIREBASE_URL}/faccoes/Piratas/bandos/${encodeURIComponent(nomeBando)}/navio.json`);
        return res.data ? String(res.data) : null;
    } catch (e) {
        return null;
    }
}

async function obterNomesIlhas(ids) {
    const nomes = {};
    const unicos = [...new Set(ids.filter(id => id !== null && id !== undefined))];

    await Promise.all(unicos.map(async (id) => {
        if (id === 0) {
            nomes[id] = 'Base Operacional';
            return;
        }
        try {
            const res = await axios.get(`${FIREBASE_URL}/ilhas/${id}/nome.json`);
            nomes[id] = res.data ? res.data : `Ilha ${id}`;
        } catch (e) {
            nomes[id] = `Ilha ${id}`;
        }
    }));

    return nomes;
}

function rotuloIlha(nomes, id, viagem) {
    if (viagem) {
        const terminoDate = converterDataPtBrParaDate(viagem.termino);
        const horaMin = terminoDate ? formatarHorarioBRT(terminoDate) : '';
        const nomeDestino = nomes[viagem.ilhaDestino] || `Ilha ${viagem.ilhaDestino}`;
        return `🌊 *Em viagem para:* ${viagem.ilhaDestino}. ${nomeDestino}${horaMin ? ` *(Chegada: ${horaMin})*` : ''}`;
    }

    return (id === null || id === undefined) ? '❓ Desconhecida' : `${id}. ${nomes[id]}`;
}

function agruparPorIlhaEViagem(lista, viagensAtivas) {
    const grupos = {};

    for (const item of lista) {
        const char = item.player?.character || {};
        const statusNormalizado = normalizar(char.status || 'parado');
        const ehViagemStatus = statusNormalizado === 'viagem' || statusNormalizado === 'em viagem';

        const viagemValida = ehViagemStatus ? obterViagemAtivaDoJogador(item.uid, viagensAtivas) : null;

        let chave = '';
        if (viagemValida) {
            chave = `viagem_${viagemValida.ilhaDestino}_${viagemValida.termino}`;
        } else {
            const ilha = obterIlha(char);
            chave = ilha === null ? 'null' : `ilha_${ilha}`;
        }

        if (!grupos[chave]) {
            grupos[chave] = {
                viagem: viagemValida || null,
                ilha: viagemValida ? viagemValida.ilhaDestino : obterIlha(char),
                membros: []
            };
        }
        grupos[chave].membros.push(item);
    }
    return grupos;
}

function formatarAgrupamento(grupos, nomes, meuUid) {
    let texto = '';

    const chaves = Object.keys(grupos).sort((a, b) => {
        const gA = grupos[a];
        const gB = grupos[b];

        if (gA.viagem && !gB.viagem) return -1;
        if (!gA.viagem && gB.viagem) return 1;

        const ilhaA = gA.ilha ?? 999;
        const ilhaB = gB.ilha ?? 999;
        return ilhaA - ilhaB;
    });

    for (const chave of chaves) {
        const grupo = grupos[chave];
        const rotulo = rotuloIlha(nomes, grupo.ilha, grupo.viagem);

        texto += `\n*${rotulo}*\n`;
        for (const { uid, player } of grupo.membros) {
            texto += `➔ ${nomeDoJogador(player)}${uid === meuUid ? ' (você)' : ''}\n`;
        }
    }
    return texto;
}

/**
 * Formata o status individual de um personagem.
 */
function formatarStatusIndividual(player, registroAtivo, nomesIlha, tipoAtividade = null) {
    const char = player?.character || {};
    const nome = nomeDoJogador(player);
    const ilhaAtual = obterIlha(char);
    const nomeIlhaAtual = nomesIlha[ilhaAtual] || (ilhaAtual !== null ? `Ilha ${ilhaAtual}` : 'Desconhecida');

    const statusStr = String(char.status || 'parado').trim();
    const statusNormalizado = normalizar(statusStr);

    let texto = `📍 *— LOCALIZAÇÃO —* 📍\n\n`;
    texto += `👤 *${nome}*\n`;

    // 1. Caso esteja executando uma ATIVIDADE (ex: "Desvio de Cargas", "Treino", etc.)
    if (statusNormalizado !== 'parado' && statusNormalizado !== 'viagem' && statusNormalizado !== 'em viagem') {
        texto += `📌 ${ilhaAtual !== null ? `${ilhaAtual}. ${nomeIlhaAtual}` : '❓ Desconhecida'}\n`;
        texto += `🎯 ${statusStr}`;

        // Apenas exibe o término se for atividade do Tipo 1 (Passiva)
        if (Number(tipoAtividade) === 1) {
            texto += `\n\n`;
            let horaTermino = '';
            if (registroAtivo?.termino) {
                const terminoDate = converterDataPtBrParaDate(registroAtivo.termino);
                if (terminoDate) horaTermino = formatarHorarioBRT(terminoDate);
            }

            if (horaTermino) {
                texto += `> Término: ${horaTermino} (BRT)`;
            } else {
                texto += `> Término: --:-- (BRT)`;
            }
        }
        return texto;
    }

    // 2. Caso esteja de fato EM VIAGEM
    if (statusNormalizado === 'viagem' || statusNormalizado === 'em viagem' || (registroAtivo && statusNormalizado === 'parado')) {
        const ilhaOrigem = registroAtivo?.ilhaOrigem ?? char.ilhaOrigem ?? (ilhaAtual !== null ? ilhaAtual : '??');
        const ilhaDestino = registroAtivo?.ilhaDestino ?? char.ilhaDestino ?? ilhaAtual;

        const nomeIlhaOrigem = nomesIlha[ilhaOrigem] || (ilhaOrigem !== '??' ? `Ilha ${ilhaOrigem}` : 'Desconhecida');
        const nomeIlhaDestino = nomesIlha[ilhaDestino] || `Ilha ${ilhaDestino}`;

        let horaTermino = '';
        if (registroAtivo?.termino) {
            const terminoDate = converterDataPtBrParaDate(registroAtivo.termino);
            if (terminoDate) horaTermino = formatarHorarioBRT(terminoDate);
        }

        texto += `⛵️ ${ilhaOrigem}. ➔ ${ilhaDestino}. ${nomeIlhaDestino}\n\n`;
        if (horaTermino) {
            texto += `> Término: ${horaTermino} (BRT)`;
        } else {
            texto += `> Término: --:-- (BRT)`;
        }
        return texto;
    }

    // 3. Caso esteja PARADO
    texto += `📌 ${ilhaAtual !== null ? `${ilhaAtual}. ${nomeIlhaAtual}` : '❓ Desconhecida'}`;
    return texto;
}

async function responder(sock, m, from, texto, meuPlayer, privado) {
    await sock.sendMessage(from, { text: texto }, { quoted: m });
}

// =========================================================================
// HANDLER DO COMANDO: !local / !localizacao
// =========================================================================
async function handleLocalizacaoCommands(sock, m, text, from) {
    const match = semAcento(text).match(/^!(?:local|localizacao)(?:\s+(.*))?$/);
    if (!match) return false;

    if (!GRUPOS_PERMITIDOS.includes(from)) {
        await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos permitidos!' }, { quoted: m });
        return true;
    }

    const argumento = (match[1] || '').trim();

    try {
        const [playersRes, viagensRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/players.json`),
            axios.get(`${FIREBASE_URL}/ilhas/viagens.json`)
        ]);

        const playersData = playersRes.data || {};
        const viagensData = viagensRes.data || {};
        const viagensAtivas = obterViagensAtivas(viagensData);

        const senderId = obterJidEfetivo(m, from);
        const meuUid = encontrarUid(playersData, senderId);

        if (!meuUid) {
            await sock.sendMessage(from, { text: `❌ *Usuário não cadastrado!* (${senderId})` }, { quoted: m });
            return true;
        }

        const meuPlayer = playersData[meuUid];
        const meuChar = meuPlayer?.character || {};
        const ehPirata = normalizar(meuChar.faction).includes('pirata');

        const mencionados = [...new Set(
            (m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(extrairId)
        )];

        // -----------------------------------------------------------------
        // MODO 1: !local → localização própria
        // -----------------------------------------------------------------
        if (mencionados.length === 0 && argumento === '') {
            if (ehPirata) {
                const bando = String(meuChar.bando || '').trim();
                if (!bando) {
                    await sock.sendMessage(from, { text: '❌ Seu personagem pertence aos Piratas mas não está cadastrado em nenhum bando!' }, { quoted: m });
                    return true;
                }

                const nomeNavio = await obterNavioBando(bando);

                const tripulacao = Object.keys(playersData)
                    .filter(uid => normalizar(playersData[uid]?.character?.bando) === normalizar(bando))
                    .map(uid => ({ uid, player: playersData[uid] }));

                const statusChar = normalizar(meuChar.status || 'parado');
                const registroAtivo = obterViagemAtivaDoJogador(meuUid, viagensAtivas);

                const idsIlhas = [...tripulacao.map(t => obterIlha(t.player?.character))];
                if (registroAtivo) idsIlhas.push(registroAtivo.ilhaDestino, registroAtivo.ilhaOrigem);

                const nomes = await obterNomesIlhas(idsIlhas);

                // Se o personagem estiver solo, em atividade ou em viagem:
                if (statusChar !== 'parado' || registroAtivo) {
                    const tipoAtiv = await obterTipoAtividade(meuChar.faction, meuChar.status);
                    const respostaIndividual = formatarStatusIndividual(meuPlayer, registroAtivo, nomes, tipoAtiv);
                    await responder(sock, m, from, respostaIndividual, meuPlayer, !GRUPOS_BANDOS.includes(from));
                    return true;
                }

                const tituloCabecalho = nomeNavio
                    ? nomeNavio.toUpperCase()
                    : bando.toUpperCase();

                let resposta = `⛵ — *${tituloCabecalho}* — ⛵\n`;

                if (registroAtivo && (statusChar === 'viagem' || statusChar === 'em viagem')) {
                    const rotulo = rotuloIlha(nomes, null, registroAtivo);
                    const tripulantes = tripulacao.map(t => nomeDoJogador(t.player)).join(', ');

                    resposta += `\n${rotulo}\n` +
                        `👥 *Tripulação navegando (${tripulacao.length}):* ${tripulantes}`;
                } else {
                    const grupos = agruparPorIlhaEViagem(tripulacao, viagensAtivas);
                    const chaves = Object.keys(grupos);

                    if (chaves.length === 1 && !grupos[chaves[0]].viagem) {
                        const tripulantes = tripulacao.map(t => nomeDoJogador(t.player)).join(', ');
                        resposta += `\n🏝️ *Localização:* ${rotuloIlha(nomes, grupos[chaves[0]].ilha)}\n` +
                            `👥 *Tripulação (${tripulacao.length}):* ${tripulantes}`;
                    } else {
                        resposta += `\n⚠ *Os membros do bando não estão todos no mesmo local!* ` +
                            `Enquanto isso, o bando não consegue usar !viajar.\n` +
                            formatarAgrupamento(grupos, nomes, meuUid);
                    }
                }

                await responder(sock, m, from, resposta.trim(), meuPlayer, !GRUPOS_BANDOS.includes(from));
                return true;
            }

            // Exército Revolucionário / Governo Mundial (ou facções não-piratas)
            const statusChar = normalizar(meuChar.status || 'parado');
            const registroAtivo = obterViagemAtivaDoJogador(meuUid, viagensAtivas);
            const ilha = obterIlha(meuChar);
            const idsParaBuscar = [ilha];

            if (registroAtivo) idsParaBuscar.push(registroAtivo.ilhaDestino, registroAtivo.ilhaOrigem);

            const nomes = await obterNomesIlhas(idsParaBuscar);
            const tipoAtiv = await obterTipoAtividade(meuChar.faction, meuChar.status);
            const resposta = formatarStatusIndividual(meuPlayer, registroAtivo, nomes, tipoAtiv);

            await responder(sock, m, from, resposta, meuPlayer, false);
            return true;
        }

        const modoMencao = mencionados.length > 0;
        const modoFaccao = !modoMencao && ['faccao', 'bando', 'todos'].includes(argumento);

        if (!modoMencao && !modoFaccao) {
            const ajuda = `📍 *Como usar:*\n\n` +
                `• \`!local\` — sua localização\n` +
                `• \`!local @jogador\` — localização de um membro da sua facção\n` +
                `• \`!local facção\` — todos os membros da sua facção, por ilha ou viagem`;
            await sock.sendMessage(from, { text: ajuda }, { quoted: m });
            return true;
        }

        if (!meuChar.faction) {
            await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
            return true;
        }

        if (PIRATAS_EXIGEM_MESMO_BANDO && ehPirata && !normalizar(meuChar.bando)) {
            await sock.sendMessage(from, { text: '❌ Seu personagem pertence aos Piratas mas não está cadastrado em nenhum bando!' }, { quoted: m });
            return true;
        }

        // -----------------------------------------------------------------
        // MODO 2: !local @jogador
        // -----------------------------------------------------------------
        if (modoMencao) {
            const encontrados = [];

            for (const id of mencionados) {
                const uid = encontrarUid(playersData, id);
                if (!uid) continue;

                const player = playersData[uid];
                if (ehDaMinhaFaccao(meuChar, player?.character)) {
                    encontrados.push({ uid, player });
                }
            }

            if (encontrados.length === 0) {
                await sock.sendMessage(from, { text: '❌ Nenhum jogador válido da sua facção/bando foi encontrado.' }, { quoted: m });
                return true;
            }

            const idsIlhas = [];
            for (const { player, uid } of encontrados) {
                const ilha = obterIlha(player?.character);
                if (ilha !== null) idsIlhas.push(ilha);

                const registroAtivo = obterViagemAtivaDoJogador(uid, viagensAtivas);
                if (registroAtivo) idsIlhas.push(registroAtivo.ilhaDestino, registroAtivo.ilhaOrigem);
            }

            const nomes = await obterNomesIlhas(idsIlhas);
            let respostasTextos = [];

            for (const { uid, player } of encontrados) {
                const registroAtivo = obterViagemAtivaDoJogador(uid, viagensAtivas);
                const tipoAtiv = await obterTipoAtividade(player?.character?.faction, player?.character?.status);
                respostasTextos.push(formatarStatusIndividual(player, registroAtivo, nomes, tipoAtiv));
            }

            await responder(sock, m, from, respostasTextos.join('\n\n──────────────────\n\n'), meuPlayer, false);
            return true;
        }

        // -----------------------------------------------------------------
        // MODO 3: !local faccao
        // -----------------------------------------------------------------
        if (modoFaccao) {
            const membrosFaccao = Object.keys(playersData)
                .filter(uid => ehDaMinhaFaccao(meuChar, playersData[uid]?.character))
                .map(uid => ({ uid, player: playersData[uid] }));

            const idsIlhas = [];
            for (const { player, uid } of membrosFaccao) {
                const ilha = obterIlha(player?.character);
                if (ilha !== null) idsIlhas.push(ilha);

                const registroAtivo = obterViagemAtivaDoJogador(uid, viagensAtivas);
                if (registroAtivo) idsIlhas.push(registroAtivo.ilhaDestino, registroAtivo.ilhaOrigem);
            }

            const nomes = await obterNomesIlhas(idsIlhas);
            const grupos = agruparPorIlhaEViagem(membrosFaccao, viagensAtivas);

            const titulo = ehPirata
                ? `🏴‍☠️ *— LOCALIZAÇÃO DO BANDO (${membrosFaccao.length}) —* 🏴‍☠️`
                : `📍 *— LOCALIZAÇÃO DA FACÇÃO (${membrosFaccao.length}) —* 📍`;

            const resposta = `${titulo}\n` + formatarAgrupamento(grupos, nomes, meuUid);
            await responder(sock, m, from, resposta.trim(), meuPlayer, false);
            return true;
        }

    } catch (e) {
        console.error('Erro no comando !local:', e);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao consultar a localização.' }, { quoted: m });
        return true;
    }
}

module.exports = {
    handleLocalizacaoCommands
};