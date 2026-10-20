const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo, GRUPOS_PERMITIDOS } = require('../index');

// Emoji de cada categoria (a ordem desta lista também é a ordem de exibição no inventário).
// As regras olham o nome da categoria sem acento/maiúscula; se a categoria não casar com nenhuma,
// tentam o nome e o id do item (ex.: "Troca de Personagem", "pedraregressao").
const EMOJIS_CATEGORIA = [
    { emoji: '🍎', regra: /akuma ?no ?mi/ },                  // Akuma no Mi
    { emoji: '📦', regra: /bau/ },                             // Baús
    { emoji: '🧬', regra: /fator|linhagem|dna/ },              // Fator de Linhagem e DNA
    { emoji: '📜', regra: /pergaminho/ },                      // Pergaminhos
    { emoji: '📖', regra: /akumanomicon/ },                    // Akumanomicon
    { emoji: '💎', regra: /pedra/ },                           // Pedras
    { emoji: '🧩', regra: /troca/ }                            // Troca de Personagem
];
const EMOJI_OUTROS = '❔'; // categoria sem emoji definido acima

// Retorna { emoji, ordem } da categoria (ou, na falta, do próprio item)
function emojiDaCategoria(categoria, item, itemId) {
    const candidatos = [categoria, item?.nome, itemId].map(c => semAcento(c || '').toLowerCase());
    const indiceAkumanomicon = EMOJIS_CATEGORIA.findIndex(e => e.emoji === '📖');

    for (const texto of candidatos) {
        if (!texto) continue;
        // "akumanomicon" tem prioridade sobre "akuma no mi" (que, sem espaços, também casaria)
        if (/akumanomicon/.test(texto)) return { emoji: '📖', ordem: indiceAkumanomicon };
        const i = EMOJIS_CATEGORIA.findIndex(e => e.regra.test(texto));
        if (i !== -1) return { emoji: EMOJIS_CATEGORIA[i].emoji, ordem: i };
    }
    return { emoji: EMOJI_OUTROS, ordem: EMOJIS_CATEGORIA.length };
}

// =========================================================================
// FUNÇÕES AUXILIARES
// =========================================================================
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

function formatarNumero(valor) {
    const n = Number(valor);
    return isNaN(n) ? String(valor) : n.toLocaleString('pt-BR');
}

/** Procura o item em itens/{categoria}/{id}. Retorna { item, categoria } ou null. */
function buscarItem(bancoItens, itemId) {
    for (const [categoria, itens] of Object.entries(bancoItens || {})) {
        const item = itens?.[itemId];
        if (item && typeof item === 'object' && item.nome) return { item, categoria };
    }
    return null;
}

/**
 * Cruza players/{uid}/inventory ({ idItem: quantidade }) com o catálogo itens/.
 * Itens que não existem mais no catálogo ou com quantidade 0 são ignorados (igual ao site).
 * Retorna uma lista única [{ nome, emoji, quantidade }], ordenada pela ordem dos emojis e depois por nome.
 */
function listarInventario(inventario, bancoItens) {
    const lista = [];

    for (const [itemId, quantidade] of Object.entries(inventario || {})) {
        if (Number(quantidade) <= 0) continue;

        const encontrado = buscarItem(bancoItens, itemId);
        if (!encontrado) continue;

        const { item, categoria } = encontrado;
        const { emoji, ordem } = emojiDaCategoria(categoria, item, itemId);
        lista.push({ nome: String(item.nome), emoji, ordem, quantidade });
    }

    return lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function montarInventario(nomePersonagem, lista) {
    let texto = `🎒 *— INVENTÁRIO —* 🎒\n\n👤 *${nomePersonagem}*\n\n`;

    lista.forEach(it => {
        texto += `${it.emoji} ${it.nome} — x${formatarNumero(it.quantidade)}\n`;
    });

    return texto.trimEnd();
}

// =========================================================================
// HANDLER DO COMANDO: !inventario / !inv
// =========================================================================
async function handleInventarioCommands(sock, m, text, from) {
    const match = semAcento(text).match(/^!(?:inventario|inv)(?:\s+(.*))?$/);
    if (!match) return false;

    if (!GRUPOS_PERMITIDOS.includes(from)) {
        await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos permitidos!' }, { quoted: m });
        return true;
    }

    try {
        const [playersRes, itensRes] = await Promise.all([
            axios.get(`${FIREBASE_URL}/players.json`),
            axios.get(`${FIREBASE_URL}/itens.json`)
        ]);

        const playersData = playersRes.data || {};
        const bancoItens = itensRes.data || {};

        const senderId = obterJidEfetivo(m, from);
        const meuUid = encontrarUid(playersData, senderId);

        if (!meuUid) {
            await sock.sendMessage(from, { text: `❌ *Usuário não cadastrado!* (${senderId})` }, { quoted: m });
            return true;
        }

        // !inv @jogador → inventário do jogador marcado (usa o primeiro marcado)
        const mencionados = [...new Set(
            (m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(extrairId)
        )];

        let alvoUid = meuUid;
        if (mencionados.length > 0) {
            alvoUid = encontrarUid(playersData, mencionados[0]);
            if (!alvoUid) {
                await sock.sendMessage(from, { text: '❌ O jogador marcado não está cadastrado!' }, { quoted: m });
                return true;
            }
        } else if ((match[1] || '').trim() !== '') {
            const ajuda = `🎒 *Como usar:*\n\n` +
                `• \`!inv\` — seu inventário\n` +
                `• \`!inv @jogador\` — inventário de outro jogador`;
            await sock.sendMessage(from, { text: ajuda }, { quoted: m });
            return true;
        }

        const alvoPlayer = playersData[alvoUid];
        const nome = nomeDoJogador(alvoPlayer);
        const lista = listarInventario(alvoPlayer?.inventory, bancoItens);

        if (lista.length === 0) {
            const frase = alvoUid === meuUid
                ? '🎒 Seu inventário está vazio.'
                : `🎒 *${nome}* não possui itens no inventário.`;
            await sock.sendMessage(from, { text: frase }, { quoted: m });
            return true;
        }

        await sock.sendMessage(from, { text: montarInventario(nome, lista) }, { quoted: m });
    } catch (e) {
        console.error('Erro no comando !inventario:', e);
        await sock.sendMessage(from, { text: '❌ Erro ao carregar o inventário.' }, { quoted: m });
    }

    return true;
}

module.exports = { handleInventarioCommands };
