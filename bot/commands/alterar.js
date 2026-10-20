const axios = require('axios');
const {
    FIREBASE_URL,
    obterJidEfetivo,
    GRUPOS_PERMITIDOS 
} = require('../index');

function normalizar(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Garante o formato clássico @s.whatsapp.net exigido pelo groupParticipantsUpdate ('add')
function formatarJidParaAdicao(numeroOuJid) {
    if (!numeroOuJid) return null;
    const numLimpo = String(numeroOuJid).split('@')[0].split(':')[0].replace(/\D/g, '').trim();
    return numLimpo ? `${numLimpo}@s.whatsapp.net` : null;
}

async function handleAlterarCommands(sock, m, text, from) {
    if (text.startsWith('!alterar ') || text === '!alterar') {
        if (GRUPOS_PERMITIDOS && !GRUPOS_PERMITIDOS.includes(from)) {
            await sock.sendMessage(from, { text: '❌ Este comando não pode ser utilizado neste grupo!' }, { quoted: m });
            return true;
        }

        try {
            // 1. Identificar o jogador mencionado
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentionedJid) {
                await sock.sendMessage(from, { text: '❌ Mencione o jogador usando *@Jogador*!' }, { quoted: m });
                return true;
            }

            const partes = text.trim().split(/\s+/);
            const novaFaccaoNome = partes.slice(2).join(' ').trim();

            if (!novaFaccaoNome) {
                await sock.sendMessage(from, { text: '❌ Informe o nome da nova facção! Exemplo: `!alterar @Jogador Marinha`' }, { quoted: m });
                return true;
            }

            // 2. Buscar dados no Firebase
            const [faccoesRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/faccoes.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);

            const faccoesData = faccoesRes.data || {};
            const playersData = playersRes.data || {};

            // 3. Validar Facção de Destino
            const faccaoEncontradaKey = Object.keys(faccoesData).find(key => {
                const fac = faccoesData[key];
                return normalizar(key) === normalizar(novaFaccaoNome) || normalizar(fac?.nome) === normalizar(novaFaccaoNome);
            });

            if (!faccaoEncontradaKey) {
                await sock.sendMessage(from, { text: `❌ A facção *"${novaFaccaoNome}"* não existe no banco de dados!` }, { quoted: m });
                return true;
            }

            const novaFaccao = faccoesData[faccaoEncontradaKey];
            const nomeNovaFaccaoFormatado = novaFaccao?.nome || faccaoEncontradaKey;

            // 4. Localizar jogador na base de dados
            const targetId = mentionedJid.split('@')[0].split(':')[0].trim();
            const playerUid = Object.keys(playersData).find(uid =>
                String(playersData[uid]?.number?.LID || '').trim() === targetId ||
                String(playersData[uid]?.number?.n || '').trim() === targetId ||
                uid === targetId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ O jogador mencionado não está cadastrado!' }, { quoted: m });
                return true;
            }

            const player = playersData[playerUid];
            const faccaoAtual = player?.character?.faction;
            const nomePersonagem = player?.character?.charName || player?.nome || 'Lutador';

            if (normalizar(faccaoAtual) === normalizar(faccaoEncontradaKey)) {
                await sock.sendMessage(from, { text: `⚠️ O personagem *${nomePersonagem}* já pertence à facção *${nomeNovaFaccaoFormatado}*!` }, { quoted: m });
                return true;
            }

            // 5. Atualizar no Firebase
            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/character.json`, {
                faction: faccaoEncontradaKey
            });

            // 6. Preparar os JIDs para o WhatsApp (Resolve problema de LID vs Número Real)
            const numeroTelefone = player?.number?.n || targetId;
            const userAddJid = formatarJidParaAdicao(numeroTelefone);
            const userRemoveJid = mentionedJid.includes('@') ? mentionedJid : `${mentionedJid}@s.whatsapp.net`;

            // 7. Remover do grupo antigo
            let removidoComSucesso = false;
            if (faccaoAtual && faccoesData[faccaoAtual]?.grupo) {
                const grupoAntigoJid = faccoesData[faccaoAtual].grupo;
                try {
                    await sock.groupParticipantsUpdate(grupoAntigoJid, [userRemoveJid], 'remove');
                    removidoComSucesso = true;
                } catch (errRemover) {
                    console.error(`[alterar] Falha ao remover de ${grupoAntigoJid}:`, errRemover.message);
                }
            }

            // 8. Adicionar ao novo grupo
            let adicionadoComSucesso = false;
            if (novaFaccao?.grupo && userAddJid) {
                const grupoNovoJid = novaFaccao.grupo;
                try {
                    const res = await sock.groupParticipantsUpdate(grupoNovoJid, [userAddJid], 'add');
                    // Verifica se o WhatsApp respondeu com erro de privacidade do usuário
                    if (res && res[0] && res[0].status === '408') {
                        console.log(`[alterar] Jogador restrito por privacidade para adição automática.`);
                    } else {
                        adicionadoComSucesso = true;
                    }
                } catch (errAdicionar) {
                    console.error(`[alterar] Falha ao adicionar em ${grupoNovoJid}:`, errAdicionar.message);
                }
            }

            // 9. Mensagem de Confirmação
            let resposta = `✅ *FACÇÃO ALTERADA COM SUCESSO!*\n\n` +
                `👤 *Jogador:* ${nomePersonagem}\n` +
                `🏛️ *Nova Facção:* ${nomeNovaFaccaoFormatado}\n\n`;

            if (novaFaccao?.grupo) {
                resposta += adicionadoComSucesso
                    ? `➕ Adicionado ao grupo da nova facção.\n`
                    : `⚠️ Não foi possível adicionar diretamente ao novo grupo (o bot precisa ser admin no grupo de destino ou o usuário tem restrição de privacidade).\n`;
            }

            if (faccaoAtual && faccoesData[faccaoAtual]?.grupo) {
                resposta += removidoComSucesso
                    ? `➖ Removido do grupo da facção antiga.`
                    : `⚠️ Não foi possível remover do grupo antigo.`;
            }

            await sock.sendMessage(from, { text: resposta.trim() }, { quoted: m });

        } catch (e) {
            console.error('Erro no comando !alterar:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao alterar a facção do jogador.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleAlterarCommands };
