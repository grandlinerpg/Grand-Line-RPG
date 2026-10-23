const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');
const { obterArenaAtiva, buscarUidPlayer, limparId, salvarArenaAtiva, resetarArenaAguardando, limparTimersBatalha } = require('./combates');

const CLOUDINARY_HABILIDADES = 'https://res.cloudinary.com/djh45admn/image/upload/v1781908673';

const ATRIBUTOS_RANK = {
    1: { stm: 2, atk: 2, def: 2 },
    2: { stm: 4, atk: 5, def: 5 },
    3: { stm: 8, atk: 10, def: 10 },
    4: { stm: 15, atk: 15, def: 15 },
    5: { stm: 20, atk: 20, def: 20 }
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

async function checarDerrotaPorStatus(sock, from, arenaAtiva, jogadorObj, oponenteObj) {
    const hp = Number(jogadorObj.hp) ?? 100;
    const stm = Number(jogadorObj.sta) ?? 100;

    if (hp <= 0 || stm <= 0) {
        const motivo = hp <= 0 ? 'Ficou sem HP' : 'Ficou sem Stamina (STM)';
        const msgWin = `💀 *COMBATE ENCERRADO!* 💀\n\nO jogador *${jogadorObj.nome}* foi derrotado! (${motivo})\n\n🏆 Vitória concedida a *${oponenteObj.nome}*!`;
        await sock.sendMessage(from, { text: msgWin });

        limparTimersBatalha(arenaAtiva);
        await resetarArenaAguardando(from, arenaAtiva);
        return true;
    }
    return false;
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
        const arenaAtiva = await obterArenaAtiva(from);

        if (!arenaAtiva || arenaAtiva.fase !== 'em_combate') {
            await sock.sendMessage(from, { text: '❌ Não há combate em andamento neste grupo!' }, { quoted: m });
            return true;
        }

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
        const skillRank = Number(skill.rank) || 1;
        const skillNomeFormatado = String(skill.nome).toUpperCase();

        if (ehAtk && categoriaSkill !== 'ofensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Ofensivo*!` }, { quoted: m });
            return true;
        }

        if (ehDef && categoriaSkill !== 'defensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Defensivo*!` }, { quoted: m });
            return true;
        }

        // Identifica se é P1 ou P2 na arena
        const p1Num = limparId(arenaAtiva.p1?.numero);
        const p1Lid = limparId(arenaAtiva.p1?.lid);
        const senderLimpo = limparId(senderId);

        const ehP1 = senderLimpo === p1Num || senderLimpo === p1Lid;
        const jogadorArena = ehP1 ? arenaAtiva.p1 : arenaAtiva.p2;
        const oponenteArena = ehP1 ? arenaAtiva.p2 : arenaAtiva.p1;

        // Verifica Cooldown
        if (!jogadorArena.cooldowns) jogadorArena.cooldowns = {};
        if (jogadorArena.cooldowns[skill.nome] && jogadorArena.cooldowns[skill.nome] > 0) {
            await sock.sendMessage(from, { text: `⏳ A habilidade *${skill.nome}* está em cooldown por mais ${jogadorArena.cooldowns[skill.nome]} turno(s)!` }, { quoted: m });
            return true;
        }

        // Aplica o Cooldown (igual ao rank)
        jogadorArena.cooldowns[skill.nome] = skillRank;

        // Busca Status do Jogador no Firebase para pegar Força (str) e consumíveis
        const jogadorInfo = buscarJogadorPorSender(playersData, senderId);
        const statsBase = jogadorInfo?.player?.stats || jogadorInfo?.stats || {};
        const forAtual = Number(statsBase.str) || 0;
        const stmConsumo = Number(obterAtributoBaseSkill(skill, 'stm')) || 2;

        // Inicializa ou garante stats na arena se faltarem
        if (jogadorArena.hp === undefined) jogadorArena.hp = Number(statsBase.hp) || 100;
        if (jogadorArena.sta === undefined) jogadorArena.sta = Number(statsBase.sta ?? statsBase.stm) || 100;
        if (jogadorArena.res === undefined) jogadorArena.res = Number(statsBase.res) || 0;

        if (oponenteArena.hp === undefined) {
            const uidOponente = oponenteArena.uid || buscarUidPlayer(playersData, oponenteArena.numero || oponenteArena.lid);
            const opStats = uidOponente && playersData[uidOponente] ? (playersData[uidOponente].stats || {}) : {};
            oponenteArena.hp = Number(opStats.hp) || 100;
            oponenteArena.res = Number(opStats.res) || 0;
            oponenteArena.sta = Number(opStats.sta ?? opStats.stm) || 100;
        }

        // Deduz Stamina do usuário na Arena
        jogadorArena.sta = Math.max(0, Number(jogadorArena.sta) - stmConsumo);
        await salvarArenaAtiva(from, arenaAtiva);

        // Checa se o usuário morreu por falta de Stamina
        const morreuStm = await checarDerrotaPorStatus(sock, from, arenaAtiva, jogadorArena, oponenteArena);
        if (morreuStm) return true;

        const imagemBuffer = await baixarImagemHabilidade(skill);

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE ATAQUE (!atk)
        // ─────────────────────────────────────────────
        if (ehAtk) {
            const atkSkill = obterAtributoBaseSkill(skill, 'atk');
            let ataqueTotal = atkSkill + forAtual;

            // Se houver defesa acumulada pelo oponente nesta rodada
            if (arenaAtiva.defesaPendente && arenaAtiva.defesaPendenteAlvo === oponenteArena.uid) {
                ataqueTotal = Math.max(0, ataqueTotal - arenaAtiva.defesaPendente);
                delete arenaAtiva.defesaPendente;
                delete arenaAtiva.defesaPendenteAlvo;
            }

            let danoHp = 0;
            let ultrapassouRes = false;

            if (ataqueTotal > oponenteArena.res) {
                ultrapassouRes = true;
                danoHp = ataqueTotal - oponenteArena.res;
            }

            const reducaoRes = Math.floor(ataqueTotal * 0.10);
            oponenteArena.res = Math.max(0, Number(oponenteArena.res) - reducaoRes);
            oponenteArena.hp = Math.max(0, Number(oponenteArena.hp) - danoHp);

            await salvarArenaAtiva(from, arenaAtiva);

            const textoResumo = ultrapassouRes
                ? `O ataque passou a Res do adversário e tirou ${danoHp} pontos de HP.`
                : `O ataque não superou a Res do adversário e não causou dano ao HP.`;

            const legendaAtk = `*${skillNomeFormatado}*\n\n` +
                               `> Atk: ${atkSkill} + ${forAtual} (For) = ${ataqueTotal}\n\n` +
                               `${textoResumo}\n\n` +
                               `> Res Restante: ${oponenteArena.res}\n` +
                               `> HP Restante: ${oponenteArena.hp}`;

            if (imagemBuffer) {
                await sock.sendMessage(from, { image: imagemBuffer, caption: legendaAtk }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: legendaAtk }, { quoted: m });
            }

            // Checa se o oponente foi derrotado
            await checarDerrotaPorStatus(sock, from, arenaAtiva, oponenteArena, jogadorArena);
            return true;
        }

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE DEFESA (!def)
        // ─────────────────────────────────────────────
        if (ehDef) {
            const defSkill = obterAtributoBaseSkill(skill, 'def');
            const metadeFor = Math.floor(forAtual * 0.5);
            const defTotal = defSkill + metadeFor;

            // Registra a defesa na arena para amortecer o próximo ataque recebido
            arenaAtiva.defesaPendente = defTotal;
            arenaAtiva.defesaPendenteAlvo = jogadorArena.uid;
            await salvarArenaAtiva(from, arenaAtiva);

            const danoDefensivoHp = 0; // Defesa protege contra o dano direto no HP na rodada

            const legendaDef = `*${skillNomeFormatado}*\n\n` +
                               `> Def: ${defSkill} + ${metadeFor} (50% For) = ${defTotal}\n\n` +
                               `Sua Defesa bloqueou totalmente o ataque!\n\n` +
                               `> Res Restante: ${jogadorArena.res}\n` +
                               `> HP Restante: ${jogadorArena.hp}`;

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
