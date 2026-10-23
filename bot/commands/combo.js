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

async function checarDerrotaPorStatus(sock, from, arenaAtiva, jogadorObj, oponenteObj, playersData) {
    const uidJogador = jogadorObj?.uid || buscarUidPlayer(playersData, jogadorObj?.numero || jogadorObj?.lid);
    if (!uidJogador || !playersData[uidJogador]) return false;

    const stats = playersData[uidJogador].stats || {};
    const hp = Number(stats.hp) ?? 100;
    const stm = Number(stats.sta ?? stats.stm) ?? 100;

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

        if (ehAtk && categoriaSkill !== 'ofensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Ofensivo*!` }, { quoted: m });
            return true;
        }

        if (ehDef && categoriaSkill !== 'defensivo') {
            await sock.sendMessage(from, { text: `❌ A habilidade "*${skill.nome}*" não é do tipo *Defensivo*!` }, { quoted: m });
            return true;
        }

        // 2. Busca o Atacante / Defensor Atual
        const jogadorAtual = buscarJogadorPorSender(playersData, senderId);
        if (!jogadorAtual) {
            await sock.sendMessage(from, { text: '❌ Você não está cadastrado no jogo.' }, { quoted: m });
            return true;
        }

        const uidAtual = jogadorAtual.uid;
        const statsAtual = jogadorAtual.stats || {};
        const forAtual = Number(statsAtual.str) || 0;
        const stmConsumo = Number(obterAtributoBaseSkill(skill, 'stm')) || 2;

        // Deduz Stamina do usuário
        let stmAtual = Math.max(0, (Number(statsAtual.sta ?? statsAtual.stm) || 100) - stmConsumo);
        await axios.patch(`${FIREBASE_URL}/players/${uidAtual}/stats.json`, {
            sta: stmAtual,
            stm: stmAtual
        });
        if (playersData[uidAtual]?.stats) {
            playersData[uidAtual].stats.sta = stmAtual;
            playersData[uidAtual].stats.stm = stmAtual;
        }

        // 3. Verifica Arena Ativa
        const arenaAtiva = await obterArenaAtiva(from);
        let oponenteObj = null;
        let jogadorObj = null;
        let uidAlvo = null;

        if (arenaAtiva && arenaAtiva.fase === 'em_combate') {
            const p1LimpoNum = limparId(arenaAtiva.p1?.numero);
            const p1LimpoLid = limparId(arenaAtiva.p1?.lid);
            const senderLimpo = limparId(senderId);

            const ehP1 = senderLimpo === p1LimpoNum || senderLimpo === p1LimpoLid;
            jogadorObj = ehP1 ? arenaAtiva.p1 : arenaAtiva.p2;
            oponenteObj = ehP1 ? arenaAtiva.p2 : arenaAtiva.p1;

            if (oponenteObj) {
                uidAlvo = oponenteObj.uid || buscarUidPlayer(playersData, oponenteObj.numero || oponenteObj.lid);
            }
        }

        // Checa se o próprio jogador morreu por falta de Stamina
        if (arenaAtiva && jogadorObj && oponenteObj) {
            const encerrou = await checarDerrotaPorStatus(sock, from, arenaAtiva, jogadorObj, oponenteObj, playersData);
            if (encerrou) return true;
        }

        const statsAlvo = uidAlvo && playersData[uidAlvo] ? (playersData[uidAlvo].stats || {}) : {};
        let resAlvo = Number(statsAlvo.res) || 0;
        let hpAlvo = Number(statsAlvo.hp) || 100;

        const nomeSkillFormatado = String(skill.nome).toUpperCase();
        const imagemBuffer = await baixarImagemHabilidade(skill);

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE ATAQUE (!atk)
        // ─────────────────────────────────────────────
        if (ehAtk) {
            const atkSkill = obterAtributoBaseSkill(skill, 'atk');
            let ataqueTotal = atkSkill + forAtual;

            // Se houver defesa acumulada na arena nesta rodada, abate do ataque
            if (arenaAtiva && arenaAtiva.defesaPendente && arenaAtiva.defesaPendenteAlvo === uidAtual) {
                ataqueTotal = Math.max(0, ataqueTotal - arenaAtiva.defesaPendente);
                delete arenaAtiva.defesaPendente;
                delete arenaAtiva.defesaPendenteAlvo;
                await salvarArenaAtiva(from, arenaAtiva);
            }

            let danoHp = 0;
            let ultrapassouRes = false;

            if (ataqueTotal > resAlvo) {
                ultrapassouRes = true;
                danoHp = ataqueTotal - resAlvo;
            }

            // Res reduz 10% do valor do Atk recebido
            const reducaoRes = Math.floor(ataqueTotal * 0.10);
            const resRestante = Math.max(0, resAlvo - reducaoRes);
            const hpRestante = Math.max(0, hpAlvo - danoHp);

            if (uidAlvo) {
                await axios.patch(`${FIREBASE_URL}/players/${uidAlvo}/stats.json`, {
                    res: resRestante,
                    hp: hpRestante
                });
                if (playersData[uidAlvo]?.stats) {
                    playersData[uidAlvo].stats.res = resRestante;
                    playersData[uidAlvo].stats.hp = hpRestante;
                }
            }

            const textoResumen = ultrapassouRes
                ? `O ataque passou a Res do adversário e tirou ${danoHp} pontos de HP.`
                : `O ataque não superou a Res do adversário e não causou dano ao HP.`;

            const legendaAtk = `*${nomeSkillFormatado}*\n\n` +
                               `> Atk: ${atkSkill} + ${forAtual} (For) = ${ataqueTotal}\n\n` +
                               `${textoResumen}\n\n` +
                               `> Res Restante: ${resRestante}\n` +
                               `> HP Restante: ${hpRestante}`;

            if (imagemBuffer) {
                await sock.sendMessage(from, { image: imagemBuffer, caption: legendaAtk }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text: legendaAtk }, { quoted: m });
            }

            // Verifica se o alvo morreu após o ataque
            if (arenaAtiva && oponenteObj && jogadorObj) {
                await checarDerrotaPorStatus(sock, from, arenaAtiva, oponenteObj, jogadorObj, playersData);
            }

            return true;
        }

        // ─────────────────────────────────────────────
        // PROCESSAMENTO DE DEFESA (!def)
        // ─────────────────────────────────────────────
        if (ehDef) {
            const defSkill = obterAtributoBaseSkill(skill, 'def');
            const metadeFor = Math.floor(forAtual * 0.5);
            const defTotal = defSkill + metadeFor;

            // Registra defesa na arena para abater no próximo ataque
            if (arenaAtiva && oponenteObj) {
                arenaAtiva.defesaPendente = defTotal;
                arenaAtiva.defesaPendenteAlvo = uidAlvo;
                await salvarArenaAtiva(from, arenaAtiva);
            }

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
