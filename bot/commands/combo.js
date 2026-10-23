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
 * Busca uma habilidade pelo nome dentro do banco de dados.
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
 * Obtém o valor base de ATK/DEF da skill
 */
function obterAtributoBaseSkill(skill, tipo = 'atk') {
    const rank = Number(skill.rank) || 1;
    const baseRank = ATRIBUTOS_RANK[rank] || {};
    const attrs = skill.atributos || {};

    if (attrs[tipo] !== undefined && attrs[tipo] !== null && attrs[tipo] !== '') {
        return Number(attrs[tipo]) || 0;
    }
    return Number(baseRank[tipo]) || 0;
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
// HANDLER PRINCIPAL DO COMBO (!atk E !def)
// ─────────────────────────────────────────────
async function handleComboCommands(sock, m, text, from) {
    const ehAtk = text.startsWith('!atk');
    const ehDef = text.startsWith('!def');

    if (!ehAtk && !ehDef) return false;

    const prefixo = ehAtk ? '!atk' : '!def';
    const nomeHabilidade = text.slice(prefixo.length).trim();

    if (!nomeHabilidade) {
        await sock.sendMessage(from, { text: `⚠️ Uso correto: \`${prefixo} <Nome da Habilidade>\`` }, { quoted: m });
        return true;
    }

    try {
        const senderId = obterJidEfetivo(m, from);

        const [habilidadesRes, playersRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/habilidades.json`),
            axios.get(`${FIREBASE_URL}/players.json`)
        ]);

        const bancoHabilidades = habilidadesRes.data || {};
        const playersData = playersRes.data || {};

        // 1. Busca a Habilidade
        const habResult = buscarHabilidadePorNome(bancoHabilidades, nomeHabilidade);
        if (!habResult) {
            await sock.sendMessage(from, { text: `❌ Habilidade "*${nomeHabilidade}*" não encontrada!` }, { quoted: m });
            return true;
        }

        const skill = habResult.skill;
        const categoriaSkill = String(skill.categoria || '').trim().toLowerCase();

        // Verificação estrita de categoria
        if (ehAtk && categoriaSkill !== 'ofensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Ofensivo*!` }, { quoted: m });
            return true;
        }

        if (ehDef && categoriaSkill !== 'defensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Defensivo*!` }, { quoted: m });
            return true;
        }

        // 2. Busca o Jogador Atual
        const jogador = buscarJogadorPorSender(playersData, senderId);
        if (!jogador) {
            await sock.sendMessage(from, { text: '❌ Você não está cadastrado no jogo.' }, { quoted: m });
            return true;
        }

        const statsJogador = jogador.stats || {};
        const forJogador = Number(statsJogador.str) || 0;

        // 3. Tenta identificar se há um combate em andamento
        let resAlvo = 0;
        let hpAlvo = 100;
        let uidAlvo = null;

        const arenaAtiva = await obterArenaAtiva(from);

        if (arenaAtiva && arenaAtiva.fase === 'em_combate') {
            const p1LimpoNum = limparId(arenaAtiva.p1?.numero);
            const p1LimpoLid = limparId(arenaAtiva.p1?.lid);
            const senderLimpo = limparId(senderId);

            const ehP1 = senderLimpo === p1LimpoNum || senderLimpo === p1LimpoLid;
            const oponenteObj = ehP1 ? arenaAtiva.p2 : arenaAtiva.p1;

            if (oponenteObj) {
                uidAlvo = oponenteObj.uid || buscarUidPlayer(playersData, oponenteObj.numero || oponenteObj.lid);
                if (uidAlvo && playersData[uidAlvo]) {
                    const statsAlvo = playersData[uidAlvo].stats || {};
                    resAlvo = Number(statsAlvo.res) || 0;
                    hpAlvo = Number(statsAlvo.hp) || 0;
                }
            }
        }

        const nomeSkillFormatado = String(skill.nome).toUpperCase();
        const imagemBuffer = await baixarImagemHabilidade(skill);

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE ATAQUE (!atk)
        // ─────────────────────────────────────────────
        if (ehAtk) {
            const atkSkill = obterAtributoBaseSkill(skill, 'atk');
            const ataqueTotal = atkSkill + forJogador;

            // Dano reduzido da Res primeiro; o que sobrar tira do HP
            let danoAosHp = 0;
            let resRestante = resAlvo;

            if (ataqueTotal > resAlvo) {
                danoAosHp = ataqueTotal - resAlvo;
                resRestante = 0;
            } else {
                resRestante = resAlvo - ataqueTotal;
            }

            const hpRestante = Math.max(0, hpAlvo - danoAosHp);

            if (uidAlvo) {
                await axios.patch(`${FIREBASE_URL}/players/${uidAlvo}/stats.json`, {
                    res: resRestante,
                    hp: hpRestante
                }).catch(e => console.error('[combo] Erro ao atualizar stats no Firebase:', e.message));
            }

            const legendaAtk = `*${nomeSkillFormatado}*\n\n` +
                               `> Atk: ${atkSkill} + ${forJogador} (For) = ${ataqueTotal}\n\n` +
                               `O ataque passou a Res do adversário e tirou ${danoAosHp} pontos de HP.\n\n` +
                               `> Res Restante: ${resRestante}\n` +
                               `> HP Restante: ${hpRestante}`;

            if (imagemBuffer) {
                await sock.sendMessage(from, { image: imagemBuffer, caption: legendaAtk }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: legendaAtk }, { quoted: m });
            }

            return true;
        }

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE DEFESA (!def)
        // ─────────────────────────────────────────────
        if (ehDef) {
            const defSkill = obterAtributoBaseSkill(skill, 'def');
            const metadeFor = Math.floor(forJogador * 0.5);
            const defTotal = defSkill + metadeFor;

            const legendaDef = `*${nomeSkillFormatado}*\n\n` +
                               `> Def: ${defSkill} + ${metadeFor} (50% For) = ${defTotal}\n\n` +
                               `Seu ataque ultrapassa minha Def e me atinge.\n\n` +
                               `> Res Restante: ${resAlvo}\n` +
                               `> HP Restante: ${hpAlvo}`;

            if (imagemBuffer) {
                await sock.sendMessage(from, { image: imagemBuffer, caption: legendaDef }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: legendaDef }, { quoted: m });
            }

            return true;
        }

        return true;
    } catch (e) {
        console.error('Erro ao executar comandos no combo.js:', e);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao processar o comando.' }, { quoted: m });
        return true;
    }
}

module.exports = {
    handleComboCommands
};
