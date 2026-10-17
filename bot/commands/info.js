const axios = require('axios');
const {
    FIREBASE_URL,
    obterTemporadaAtual,
    obterEmojiFaccao,
    obterJidEfetivo,
    GRUPOS_PERMITIDOS
} = require('../index');

// Função auxiliar para determinar o nome de exibição da facção/bando
function obterNomeExibicaoFaccao(faccao, bando) {
    if (faccao === 'Piratas' && bando) {
        return bando;
    }
    return faccao;
}

// ===== Imagem do personagem (Cloudinary) =====
const CLOUDINARY_BASE = 'https://res.cloudinary.com/djh45admn/image/upload/v1778334616';
const IMAGEM_PADRAO = 'https://res.cloudinary.com/djh45admn/image/upload/v1778336777/Picsart_26-05-07_12-17-03-057_nkedrn.png';

// Mesmo padrão de slug usado no site (perfil.js / perfil-alter.js)
function gerarSlugPersonagem(charName) {
    return (charName || 'default')
        .toLowerCase()
        .replaceAll(' ', '-')
        .replaceAll('.', '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Prioriza character.imagem (URL completa ou nome do arquivo no Cloudinary).
// Se não existir, usa o nome do personagem, como o site já faz.
function obterUrlImagemPersonagem(character) {
    const imagem = String(character?.imagem || '').trim();
    if (imagem) {
        if (/^https?:\/\//i.test(imagem)) return imagem;
        return `${CLOUDINARY_BASE}/${imagem}${/\.[a-z0-9]{3,4}$/i.test(imagem) ? '' : '.png'}`;
    }
    return `${CLOUDINARY_BASE}/${gerarSlugPersonagem(character?.charName)}.png`;
}

async function baixarImagem(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(res.data);
}

// Tenta a imagem do personagem; se falhar, usa a imagem padrão; se falhar de novo, retorna null.
async function obterBufferImagemPersonagem(character) {
    try {
        return await baixarImagem(obterUrlImagemPersonagem(character));
    } catch (e) {
        try {
            return await baixarImagem(IMAGEM_PADRAO);
        } catch (e2) {
            return null;
        }
    }
}

function valorOuPadrao(valor, padrao = 'Nenhum') {
    const v = String(valor ?? '').trim();
    return v && v !== '-' ? v : padrao;
}

async function handleInfoCommands(sock, m, text, from) {
    if (text === '!jid') {
        await sock.sendMessage(from, { text: `🆔 *ID deste chat:* \`${from}\`` }, { quoted: m });
        return true;
    }

    if (text === '!ping' || text.startsWith('!ping ')) {
        await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
        return true;
    }

    if (text === '!comandos' || text.startsWith('!comandos ')) {
        const comandosText = `📜 *— COMANDOS —* 📜\n\n` +
            `🔹 *!dado*\n` +
            `🔹 *!info*\n` +
            `🔹 *!infohab*\n` +
            `🔹 *!arsenal*\n` +
            `🔹 *!rank*\n` +
            `🔹 *!desafios*\n` +
            `🔹 *!desafiar*\n` +
            `🔹 *!aceitar*\n` +
            `🔹 *!dominio*\n` +
            `🔹 *!mapa*\n` +
            `🔹 *!coliseu*\n` +
            `🔹 *!inscrever*\n` +
            `🔹 *!local*\n` +
            `🔹 *!viajar*\n` +
            `🔹 *!participar*\n` +
            `🔹 *!remover*\n` +
            `🔹 *!iniciaratividade*\n` +
            `🔹 *!relatorio*\n`;

        await sock.sendMessage(from, { text: comandosText }, { quoted: m });
        return true;
    }

    if (text === '!dado' || text.startsWith('!dado ')) {
        const resultado = Math.floor(Math.random() * 100) + 1;
        const senderId = obterJidEfetivo(m, from);

        let nomeJogador = "Lutador";
        try {
            const response = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = response.data || {};
            const playerUid = Object.keys(playersData).find(uid =>
                String(playersData[uid]?.number?.LID || '').trim() === senderId ||
                String(playersData[uid]?.number?.n || '').trim() === senderId
            );
            if (playerUid) nomeJogador = playersData[playerUid]?.character?.charName || playersData[playerUid]?.nome || "Lutador";
        } catch (e) { }

        await sock.sendMessage(from, { text: `🎲 *ROLAGEM DE DADO (1d100)*\n\n👤 *Jogador:* ${nomeJogador}\n🎯 *Resultado:* *${resultado}*` }, { quoted: m });
        return true;
    }

    if (text === '!info' || text.startsWith('!info ')) {
        try {
            const response = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = response.data;
            if (!playersData) return await sock.sendMessage(from, { text: '🏴‍☠️ Banco de dados vazio.' }, { quoted: m });

            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const targetId = mentionedJid
                ? mentionedJid.split('@')[0].split(':')[0].trim()
                : obterJidEfetivo(m, from);

            const playerUid = Object.keys(playersData).find(uid =>
                String(playersData[uid]?.number?.LID || '').trim() === targetId ||
                String(playersData[uid]?.number?.n || '').trim() === targetId
            );

            if (!playerUid) {
                const mensagemErro = mentionedJid
                    ? '❌ *O jogador mencionado não está cadastrado!*'
                    : `❌ *Usuário não cadastrado!* (${targetId})`;
                return await sock.sendMessage(from, { text: mensagemErro }, { quoted: m });
            }

            const player = playersData[playerUid];
            const character = player?.character || {};
            const expFormatado = (player?.info?.exp ?? 0).toLocaleString('pt-BR');
            const saldoFormatado = (player?.info?.saldo ?? 0).toLocaleString('pt-BR');

            const emojiFaccao = obterEmojiFaccao(character.faction) || '📜';
            const infoText = `*${emojiFaccao} ${character.charName || player?.nome || 'Sem Nome'} ${emojiFaccao}*\n\n` +
                `➔ *Nível:* ${player?.info?.level ?? 1}\n` +
                `> *EXP:* ${expFormatado}\n\n` +
                `➔ *Raça:* ${valorOuPadrao(character.race, 'Não definida')}\n` +
                `➔ *Estilo:* ${valorOuPadrao(character.style, 'Não definido')}\n` +
                `➔ *Akuma:* ${valorOuPadrao(character.fruit, 'Nenhuma')}\n\n` +
                `💰 *Saldo:* _฿ ${saldoFormatado}_`;

            const imagemBuffer = await obterBufferImagemPersonagem(character);

            if (imagemBuffer) {
                await sock.sendMessage(from, { image: imagemBuffer, caption: infoText }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: infoText }, { quoted: m });
            }
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao buscar informações.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!rank' || text.startsWith('!rank ')) {
        try {
            const [rankRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/ranking.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);
            const rankingObj = rankRes.data || {};
            const playersData = playersRes.data || {};
            const posicoesOrdenadas = Object.keys(rankingObj).map(Number).filter(p => p > 0 && !isNaN(p)).sort((a, b) => a - b);

            if (posicoesOrdenadas.length === 0) return await sock.sendMessage(from, { text: '🏴‍☠️ Ranking vazio.' }, { quoted: m });

            let rankText = `*🏆 — RANKING ARENA — 🏆*\n\n`;
            posicoesOrdenadas.forEach((pos) => {
                const uid = rankingObj[pos];
                const player = playersData[uid];
                const emoji = obterEmojiFaccao(player?.character?.faction);
                rankText += `${pos}º ${player?.character?.charName || player?.nome || 'Sem Nome'}${emoji ? ' ' + emoji : ''}\n`;
            });
            await sock.sendMessage(from, { text: rankText.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao carregar ranking.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!dominacao' || text.startsWith('!dominio')) {
        try {
            const response = await axios.get(`${FIREBASE_URL}/ilhas.json`);
            const ilhasData = response.data;

            if (!ilhasData) {
                return await sock.sendMessage(from, { text: '🌎 *Nenhuma ilha cadastrada.*' }, { quoted: m });
            }

            // Garante o tratamento caso ilhas venha como Array ou Objeto do Firebase
            const listaIlhas = Array.isArray(ilhasData)
                ? ilhasData.filter(Boolean)
                : Object.values(ilhasData);

            if (listaIlhas.length === 0) {
                return await sock.sendMessage(from, { text: '🌎 *Nenhuma ilha encontrada.*' }, { quoted: m });
            }

            let domText = `🌎 *— DOMINAÇÃO —* 🌎\n\n`;

            listaIlhas.forEach((ilha, index) => {
                const qtdEscudos = parseInt(ilha.escudo) || 0;

                // Constrói os escudos: ⛊ para os escudos ativos e ⛉ para os restantes (até o limite de 3)
                const escudosFechados = '⛊'.repeat(Math.min(qtdEscudos, 3));
                const escudosAbertos = '⛉'.repeat(Math.max(0, 3 - qtdEscudos));
                const formatEscudos = `(${escudosFechados}${escudosAbertos})`;

                const dominioNome = ilha.dominio || 'Nenhum';
                let emojiFaccao = '🏴‍☠️';

                if (dominioNome.trim().toLowerCase() === 'governo mundial') {
                    emojiFaccao = '⚓';
                } else if (dominioNome.trim().toLowerCase() === 'exército revolucionário') {
                    emojiFaccao = '⚔';
                }

                domText += `*${index + 1}. ${ilha.nome || 'Ilha Sem Nome'} ${formatEscudos}*\n`;
                domText += `> ${dominioNome} ${emojiFaccao}\n\n`;
            });

            await sock.sendMessage(from, { text: domText.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao buscar dados de dominação.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!inscrever' || text.startsWith('!inscrever ')) {
        try {
            const senderId = obterJidEfetivo(m, from);
            const tempAtual = await obterTemporadaAtual();

            const [playersRes, coliseuRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores.json`)
            ]);

            const playersData = playersRes.data || {};
            const coliseuData = coliseuRes.data || {};
            const playerUid = Object.keys(playersData).find(uid =>
                String(playersData[uid]?.number?.LID || '').trim() === senderId ||
                String(playersData[uid]?.number?.n || '').trim() === senderId
            );

            if (!playerUid) return await sock.sendMessage(from, { text: '❌ Personagem não cadastrado!' }, { quoted: m });
            if (coliseuData[playerUid]) return await sock.sendMessage(from, { text: `⚠️ Você já está inscrito na Temporada ${tempAtual}!` }, { quoted: m });

            const saldoAtual = playersData[playerUid]?.info?.saldo ?? 0;
            const TAXA = 20000;
            if (saldoAtual < TAXA) return await sock.sendMessage(from, { text: `❌ Saldo insuficiente! Taxa: *฿ ${TAXA}*. Seu saldo: *฿ ${saldoAtual}*.` }, { quoted: m });

            const novoSaldo = saldoAtual - TAXA;
            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/info.json`, { saldo: novoSaldo });
            await axios.put(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempAtual}/jogadores/${playerUid}.json`, {
                vitorias: 0, derrotas: 0, pontos: 0, inscritoEm: Date.now()
            });

            return await sock.sendMessage(from, { text: `🏟 *INSCRIÇÃO CONFIRMADA NO COLISEU!*\n🏆 *Temporada ${tempAtual}*\n\n👤 *Lutador:* ${playersData[playerUid]?.character?.charName || 'Combatente'}\n💰 *Taxa Paga:* ฿ ${TAXA}\n💳 *Novo Saldo:* ฿ ${novoSaldo}` }, { quoted: m });
        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Erro na inscrição.' }, { quoted: m });
        }
    }

    if (text === '!coliseu' || text.startsWith('!coliseu ')) {
        try {
            const tempPadrao = await obterTemporadaAtual();
            const tempDesejada = text.split(' ')[1] ? parseInt(text.split(' ')[1]) : tempPadrao;

            const [coliseuRes, playersRes, infoColiseuRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/coliseu/temporadas/temporada_${tempDesejada}/jogadores.json`),
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/coliseu/info.json`)
            ]);

            const coliseuData = coliseuRes.data || {};
            const playersData = playersRes.data || {};
            const coliseuInfo = infoColiseuRes.data || { periodo: '01/09 ~ 31/09' };
            const inscritosUids = Object.keys(coliseuData);

            if (inscritosUids.length === 0) return await sock.sendMessage(from, { text: `🏟 *Coliseu sem inscritos na Temporada ${tempDesejada}!*` }, { quoted: m });

            inscritosUids.sort((a, b) => {
                const pA = coliseuData[a] || {}; const pB = coliseuData[b] || {};
                if ((pB.pontos || 0) !== (pA.pontos || 0)) return (pB.pontos || 0) - (pA.pontos || 0);
                if ((pB.vitorias || 0) !== (pA.vitorias || 0)) return (pB.vitorias || 0) - (pA.vitorias || 0);
                return (pA.derrotas || 0) - (pB.derrotas || 0);
            });

            let coliseuText = `🏟 *— COLISEU CORRIDA —* 🏟\n🏆 *— TEMPORADA ${tempDesejada} — 🏆*\n\n*Período: ${coliseuInfo.periodo}*\n\n`;
            inscritosUids.forEach((uid, index) => {
                const dados = coliseuData[uid] || {};
                const player = playersData[uid];
                const emoji = obterEmojiFaccao(player?.character?.faction);
                coliseuText += `${index + 1}º ${player?.character?.charName || 'Lutador'}${emoji ? ' ' + emoji : ''}\n> *✔️ ${dados.vitorias || 0} | ✖ ${dados.derrotas || 0} | 🏅${dados.pontos || 0}*\n\n`;
            });

            await sock.sendMessage(from, { text: coliseuText.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao carregar Coliseu.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!relatorio' || text.startsWith('!relatorio ')) {
        if (!GRUPOS_PERMITIDOS.includes(from)) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos permitidos!' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const targetId = mentionedJid
                ? mentionedJid.split('@')[0].split(':')[0].trim()
                : obterJidEfetivo(m, from);

            const playerUid = Object.keys(playersData).find(uid =>
                String(playersData[uid]?.number?.LID || '').trim() === targetId ||
                String(playersData[uid]?.number?.n || '').trim() === targetId || uid === targetId
            );

            if (!playerUid) {
                const mensagemErro = mentionedJid
                    ? '❌ *O jogador mencionado não está cadastrado!*'
                    : '❌ Você precisa ter um personagem cadastrado para ver o relatório!';
                await sock.sendMessage(from, { text: mensagemErro }, { quoted: m });
                return true;
            }

            const player = playersData[playerUid];
            const faccao = player?.character?.faction;
            const bando = player?.character?.bando;
            const nomeJogador = player?.character?.charName || player?.nome || 'Lutador';

            if (!faccao) {
                await sock.sendMessage(from, { text: `❌ O personagem *${nomeJogador}* não possui uma facção registrada no banco de dados!` }, { quoted: m });
                return true;
            }

            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes/${faccao}/atividades.json`);
            const atividadesFaccao = faccoesRes.data || {};
            const chavesAtividades = Object.keys(atividadesFaccao);

            const nomeExibicaoFaccao = obterNomeExibicaoFaccao(faccao, bando);
            const emojiFaccao = obterEmojiFaccao(faccao) || '🏴‍☠️';

            if (chavesAtividades.length === 0) {
                await sock.sendMessage(from, { text: `📊 *— RELATÓRIO —*\n\n👤 *${nomeJogador}*\n🏛️ ${nomeExibicaoFaccao}\n\n❌ Não há atividades cadastradas para esta facção.` }, { quoted: m });
                return true;
            }

            let relatorioTexto = `📊 *— RELATÓRIO —* 📊\n\n👤 *${nomeJogador}*\n${emojiFaccao} ${nomeExibicaoFaccao}\n\n`;

            chavesAtividades.forEach((chave) => {
                const ativData = atividadesFaccao[chave] || {};
                const nomeAtiv = ativData.nome || chave;
                const limiteAtiv = ativData.limite !== undefined && ativData.limite !== null ? ativData.limite : 'Sem limite';
                const realizadas = Number(player?.atividades?.[chave] ?? 0);

                const textoLimite = limiteAtiv === 'Sem limite' ? 'Sem limite' : `${realizadas}/${limiteAtiv}`;
                relatorioTexto += `• *${nomeAtiv}*: ${textoLimite}\n`;
            });

            const tetoSemanal = Number(player?.atividades?.teto ?? 0).toLocaleString('pt-BR');
            relatorioTexto += `\n> Teto Semanal: ${tetoSemanal}/1.000`;

            await sock.sendMessage(from, { text: relatorioTexto.trim() }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao gerar relatório de atividades.' }, { quoted: m });
        }
        return true;
    }
    
    return false;
}

module.exports = { handleInfoCommands };
