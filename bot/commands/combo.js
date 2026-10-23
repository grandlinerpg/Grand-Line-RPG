const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');
const { obterArenaAtiva, buscarUidPlayer, limparId } = require('./combates');

const CLOUDINARY_HABILIDADES = 'https://res.cloudinary.com/djh45admn/image/upload/v1781908673';

const ATRIBUTOS_RANK = {
    1: { stm: 100, atk: 100, def: 100 },
    2: { stm: 250, atk: 250, def: 250 },
    3: { stm: 500, atk: 500, def: 500 },
    4: { stm: 1000, atk: 1000, def: 1000 },
    5: { stm: 2000, atk: 2000, def: 2000 }
};

function normalizar(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function entradasObjeto(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([, v]) => v && typeof v === 'object');
}

/**
 * Busca uma habilidade pelo nome dentro da estrutura do banco.
 */
function buscarHabilidadePorNome(banco, nomeBusca) {
    const termo = normalizar(nomeBusca);
    let encontrada = null;

    for (const [, subs] of entradasObjeto(banco)) {
        for (const [, skills] of entradasObjeto(subs)) {
            for (const [id, skill] of entradasObjeto(skills)) {
                if (skill.nome && normalizar(skill.nome) === termo) {
                    return { skill, id };
                }
                if (skill.nome && normalizar(skill.nome).includes(termo) && !encontrada) {
                    encontrada = { skill, id };
                }
            }
        }
    }
    return encontrada;
}

/**
 * Obtém o valor base de ATK da skill respeitando a lógica do infohab.js
 */
function obterAtkBaseSkill(skill) {
    const rank = Number(skill.rank) || 1;
    const baseRank = ATRIBUTOS_RANK[rank] || {};
    const attrs = skill.atributos || {};

    if (attrs.atk !== undefined && attrs.atk !== null && attrs.atk !== '') {
        return Number(attrs.atk) || 0;
    }
    return Number(baseRank.atk) || 0;
}

function obterUrlImagemHabilidade(skill) {
    const img = String(skill?.img || '').trim();
    if (!img) return null;
    if (/^https?:\/\//i.test(img)) return img;
    return `${CLOUDINARY_HABILIDADES}/${img}${/\.[a-z0-9]{3,4}$/i.test(img) ? '' : '.jpg'}`;
}

async function baixarImagemHabilidade(skill) {
    const url = obterUrlImagemHabilidade(skill);
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) {
        console.error(`[combo] Erro ao baixar imagem da habilidade "${skill.nome}":`, e.message);
        return null;
    }
}

/**
 * Localiza jogador nos dados do Firebase pelo senderId (LID ou número)
 */
function buscarJogadorPorSender(playersData, senderId) {
    if (!playersData || !senderId) return null;
    const senderLimpo = limparId(senderId);

    const uid = Object.keys(playersData).find(u => {
        const p = playersData[u];
        if (!p) return false;
        return (
            u === senderId ||
            u === senderLimpo ||
            limparId(p.number?.LID) === senderLimpo ||
            limparId(p.number?.n) === senderLimpo
        );
    });

    return uid ? { uid, ...playersData[uid] } : null;
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL DO COMBO
// ─────────────────────────────────────────────
async function handleComboCommands(sock, m, text, from) {
    if (!text.startsWith('!atk')) return false;

    const nomeAtaque = text.slice('!atk'.length).trim();
    if (!nomeAtaque) {
        await sock.sendMessage(from, { text: '⚠️ Uso correto: `!atk <Nome da Habilidade>`' }, { quoted: m });
        return true;
    }

    try {
        const senderId = obterJidEfetivo(m, from);

        // Busca banco de habilidades e players simultaneamente
        const [habilidadesRes, playersRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/habilidades.json`),
            axios.get(`${FIREBASE_URL}/players.json`)
        ]);

        const bancoHabilidades = habilidadesRes.data || {};
        const playersData = playersRes.data || {};

        // 1. Busca a Habilidade
        const habResult = buscarHabilidadePorNome(bancoHabilidades, nomeAtaque);
        if (!habResult) {
            await sock.sendMessage(from, { text: `❌ Habilidade "*${nomeAtaque}*" não encontrada!` }, { quoted: m });
            return true;
        }

        const skill = habResult.skill;
        const atkSkill = obterAtkBaseSkill(skill);

        // 2. Busca o Jogador Atacante
        const atacante = buscarJogadorPorSender(playersData, senderId);
        if (!atacante) {
            await sock.sendMessage(from, { text: '❌ Você não está cadastrado no jogo.' }, { quoted: m });
            return true;
        }

        const statsAtacante = atacante.stats || {};
        const forAtacante = Number(statsAtacante.str) || 0;
        const ataqueTotal = atkSkill + forAtacante;

        // 3. Tenta identificar se há um combate em andamento e quem é o defensor
        let resDefensor = 0;
        let hpAtualDefensor = 100;
        let uidDefensor = null;

        const arenaAtiva = await obterArenaAtiva(from);

        if (arenaAtiva && arenaAtiva.fase === 'em_combate') {
            const p1LimpoNum = limparId(arenaAtiva.p1?.numero);
            const p1LimpoLid = limparId(arenaAtiva.p1?.lid);
            const senderLimpo = limparId(senderId);

            const ehP1 = senderLimpo === p1LimpoNum || senderLimpo === p1LimpoLid;
            const defensorObj = ehP1 ? arenaAtiva.p2 : arenaAtiva.p1;

            if (defensorObj) {
                uidDefensor = defensorObj.uid || buscarUidPlayer(playersData, defensorObj.numero || defensorObj.lid);
                if (uidDefensor && playersData[uidDefensor]) {
                    const statsDefensor = playersData[uidDefensor].stats || {};
                    resDefensor = Number(statsDefensor.res) || 0;
                    hpAtualDefensor = Number(statsDefensor.hp) || 0;
                }
            }
        }

        // 4. Cálculo de Dano
        const danoReal = Math.max(0, ataqueTotal - resDefensor);
        const hpRestante = Math.max(0, hpAtualDefensor - danoReal);

        // 5. Atualiza HP do defensor no Firebase se estiver em combate ativo
        if (uidDefensor) {
            await axios.patch(`${FIREBASE_URL}/players/${uidDefensor}/stats.json`, {
                hp: hpRestante
            }).catch(e => console.error('[combo] Erro ao atualizar HP no Firebase:', e.message));
        }

        // 6. Montagem da Mensagem e Envio da Imagem
        const nomeAtaqueFormatado = String(skill.nome).toUpperCase();

        const legenda = `*${nomeAtaqueFormatado}*\n\n` +
                        `> Atk: ${atkSkill} + ${forAtacante} (For) = ${ataqueTotal}\n\n` +
                        `O ataque passou a Res do adversário e tirou ${danoReal} pontos de HP.\n\n` +
                        `> HP Restante: ${hpRestante}`;

        const imagemBuffer = await baixarImagemHabilidade(skill);

        if (imagemBuffer) {
            await sock.sendMessage(from, { image: imagemBuffer, caption: legenda }, { quoted: m });
        } else {
            await sock.sendMessage(from, { text: legenda }, { quoted: m });
        }

        return true;
    } catch (e) {
        console.error('Erro ao executar comando !atk no combo.js:', e);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar o ataque.' }, { quoted: m });
        return true;
    }
}

module.exports = {
    handleComboCommands
};
