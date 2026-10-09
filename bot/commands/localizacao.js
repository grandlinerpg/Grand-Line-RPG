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
const RESPONDER_NO_PRIVADO = false;

const GRUPOS_FACCOES = [
    '120363408918568715@g.us', // Exército Revolucionário
    '120363408644122202@g.us'  // Governo Mundial
];

const GRUPOS_BANDOS = [
    '120363411388017464@g.us'  // Piratas das Feras
];

const GRUPOS_PERMITIDOS = [...GRUPOS_FACCOES, ...GRUPOS_BANDOS];

// =========================================================================
// FUNÇÕES AUXILIARES DE DATA E VIAGEM
// =========================================================================

function converterDataPtBrParaDate(strData) {
    if (!strData || typeof strData !== 'string') return null;
    // Espera formato "DD/MM/YYYY HH:mm:ss"
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
            nomes[id] = '0. Base Operacional';
            return;
        }
        try {
            const res = await axios.get(`${FIREBASE_URL}/ilhas/${id}/nome.json`);
            nomes[id] = res.data ? `${id}. ${res.data}` : `${id}. Ilha ${id}`;
        } catch (e) {
            nomes[id] = `${id}. Ilha ${id}`;
        }
    }));

    return nomes;
}

function rotuloIlha(nomes, id, viagem) {
    if (viagem) {
        const terminoDate = converterDataPtBrParaDate(viagem.termino);
        const horaMin = terminoDate
            ? `${String(terminoDate.getHours()).padStart(2, '0')}:${String(terminoDate.getMinutes()).padStart(2, '0')}`
            : '';

        const nomeDestino = nomes[viagem.ilhaDestino] || `Ilha ${viagem.ilhaDestino}`;
        return `🌊 *Em viagem para:* ${nomeDestino}${horaMin ? ` *(Chegada: ${horaMin})*` : ''}`;
    }

    return (id === null || id === undefined) ? '❓ Desconhecida' : nomes[id];
}

function agruparPorIlhaEViagem(lista, viagensAtivas) {
    const grupos = {};

    for (const item of lista) {
        const viagem = obterViagemAtivaDoJogador(item.uid, viagensAtivas);

        let chave = '';
        if (viagem) {
            chave = `viagem_${viagem.ilhaDestino}_${viagem.termino}`;
        } else {
            const ilha = obterIlha(item.player?.character);
            chave = ilha === null ? 'null' : `ilha_${ilha}`;
        }

        if (!grupos[chave]) {
            grupos[chave] = {
                viagem: viagem || null,
                ilha: viagem ? viagem.ilhaDestino : obterIlha(item.player?.character),
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

async function responder(sock, m, from, texto, meuPlayer, privado) {
    const ehGrupo = from.endsWith('@g.us');

    if (privado && RESPONDER_NO_PRIVADO && ehGrupo) {
        const jidPv = formatarJidPv(meuPlayer?.number?.n);
        if (!jidPv) {
            await sock.sendMessage(from, {
                text: '❌ Não encontrei seu número vinculado para responder no privado.'
            }, { quoted: m });
            return;
        }
        try {
            await sock.sendMessage(jidPv, { text: texto });
            await sock.sendMessage(from, { text: '📩 Enviei a resposta no seu privado.' }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, {
                text: '❌ Não consegui enviar n o privado. Mande uma mensagem para o bot no privado e tente de novo.'
            }, { quoted: m });
        }
        return;
    }

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
        // MODO 1: !local → localização do jogador (Piratas: navio do bando)
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

                const viagemBando = obterViagemAtivaDoJogador(meuUid, viagensAtivas);

                const idsIlhas = [...tripulacao.map(t => obterIlha(t.player?.character))];
                if (viagemBando) idsIlhas.push(viagemBando.ilhaDestino);

                const nomes = await obterNomesIlhas(idsIlhas);

                const tituloCabecalho = nomeNavio
                    ? nomeNavio.toUpperCase()
                    : bando.toUpperCase();

                let resposta = `⛵ — *${tituloCabecalho}* — ⛵\n`;

                if (viagemBando) {
                    const rotulo = rotuloIlha(nomes, null, viagemBando);
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

            const viagemMinha = obterViagemAtivaDoJogador(meuUid, viagensAtivas);
            const ilha = obterIlha(meuChar);
            const nomes = await obterNomesIlhas([ilha, viagemMinha?.ilhaDestino]);

            const localTexto = rotuloIlha(nomes, ilha, viagemMinha);

            const resposta = `📍 *— LOCALIZAÇÃO —* 📍\n\n` +
                `👤 *${nomeDoJogador(meuPlayer)}*\n` +
                `📌 ${localTexto}`;

            await responder(sock, m, from, resposta, meuPlayer, false);
            return true;
        }

        const modoMencao = mencionados.length > 0;
        const modoFaccao = !modoMencao && ['faccao', 'bando', 'todos'].includes(argumento);

        if (!modoMencao && !modoFaccao) {
            const ajuda = `📍 *Como usar:*\n\n` +
                `• \`!local\` — sua localização (Piratas: localização do navio do bando)\n` +
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
            let naoCadastrados = 0;
            let foraDaFaccao = 0;

            for (const id of mencionados) {
                const uid = encontrarUid(playersData, id);
                if (!uid) { naoCadastrados++; continue; }

                const player = playersData[uid];
                if (uid !== meuUid && !ehDaMinhaFaccao(meuChar, player?.character)) {
                    foraDaFaccao++;
                    continue;
                }

                const viagem = obterViagemAtivaDoJogador(uid, viagensAtivas);
                encontrados.push({ uid, player, ilha: obterIlha(player?.character), viagem });
            }

            const idsIlhas = [
                ...encontrados.map(e => e.ilha),
                ...encontrados.map(e => e.viagem?.ilhaDestino)
            ];
            const nomes = await obterNomesIlhas(idsIlhas);

            let resposta = `📍 *— LOCALIZAÇÃO —* 📍\n`;

            for (const e of encontrados) {
                const statusTexto = rotuloIlha(nomes, e.ilha, e.viagem);
                resposta += `\n👤 *${nomeDoJogador(e.player)}*${e.uid === meuUid ? ' (você)' : ''}\n` +
                    `📌 ${statusTexto}\n`;
            }
            if (foraDaFaccao > 0) {
                resposta += `\n❌ ${foraDaFaccao} jogador(es) omitido(s) por não ser(em) da sua facção${ehPirata && PIRATAS_EXIGEM_MESMO_BANDO ? ' (mesmo bando)' : ''}.`;
            }
            if (naoCadastrados > 0) {
                resposta += `\n❌ ${naoCadastrados} jogador(es) mencionado(s) não cadastrado(s).`;
            }

            await responder(sock, m, from, resposta.trim(), meuPlayer, true);
            return true;
        }

        // -----------------------------------------------------------------
        // MODO 3: !local facção
        // -----------------------------------------------------------------
        const membros = Object.keys(playersData)
            .filter(uid => uid === meuUid || ehDaMinhaFaccao(meuChar, playersData[uid]?.character))
            .map(uid => ({ uid, player: playersData[uid] }));

        const grupos = agruparPorIlhaEViagem(membros, viagensAtivas);

        const idsIlhas = [];
        Object.values(grupos).forEach(g => {
            if (g.ilha !== null && g.ilha !== undefined) idsIlhas.push(g.ilha);
        });

        const nomes = await obterNomesIlhas(idsIlhas);
        const emoji = obterEmojiFaccao ? obterEmojiFaccao(meuChar.faction) : '🏴‍☠️';

        let titulo = meuChar.faction;
        if (ehPirata && meuChar.bando) {
            const bandoNome = String(meuChar.bando).trim();
            const navioNome = await obterNavioBando(bandoNome);

            titulo = navioNome ? `${navioNome}` : bandoNome;
        }

        const resposta = `🧭 — ${titulo.toUpperCase()} ${emoji} — 🧭\n` + formatarAgrupamento(grupos, nomes, meuUid);

        await responder(sock, m, from, resposta.trim(), meuPlayer, true);
        return true;

    } catch (e) {
        console.error('Erro no comando !local:', e);
        await sock.sendMessage(from, { text: '❌ Erro ao consultar a localização.' }, { quoted: m });
        return true;
    }
}

module.exports = { handleLocalizacaoCommands };
