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

async function handleAlterarCommands(sock, m, text, from) {
    if (text.startsWith('!alterar ') || text === '!alterar') {
        // Validação de segurança por grupo se necessário
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

            // Extrai a facção digitada após a menção (!alterar @Jogador Facção)
            const partes = text.trim().split(/\s+/);
            // Remove o !alterar e a menção para capturar o nome da nova facção
            const novaFaccaoNome = partes.slice(2).join(' ').trim();

            if (!novaFaccaoNome) {
                await sock.sendMessage(from, { text: '❌ Informe o nome da nova facção! Exemplo: `!alterar @Jogador Marinha`' }, { quoted: m });
                return true;
            }

            // 2. Buscar dados das Facções e dos Jogadores
            const [faccoesRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/faccoes.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);

            const faccoesData = faccoesRes.data || {};
            const playersData = playersRes.data || {};

            // 3. Validar se a facção de destino existe no Firebase
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

            // 4. Localizar o jogador mencionado no Firebase
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

            // 5. Atualizar a facção no Firebase
            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/character.json`, {
                faction: faccaoEncontradaKey
            });

            // Formatando o JID do usuário para remoção e adição nos grupos do WhatsApp
            const userGroupJid = mentionedJid.includes('@') ? mentionedJid : `${mentionedJid}@s.whatsapp.net`;

            // 6. Remover do grupo da facção antiga (se existir)
            let removidoComSucesso = false;
            if (faccaoAtual && faccoesData[faccaoAtual]?.grupo) {
                const grupoAntigoJid = faccoesData[faccaoAtual].grupo;
                try {
                    await sock.groupParticipantsUpdate(grupoAntigoJid, [userGroupJid], 'remove');
                    removidoComSucesso = true;
                } catch (errRemover) {
                    console.error(`[alterar] Falha ao remover de ${grupoAntigoJid}:`, errRemover.message);
                }
            }

            // 7. Adicionar ao grupo da nova facção (se existir)
            let adicionadoComSucesso = false;
            if (novaFaccao?.grupo) {
                const grupoNovoJid = novaFaccao.grupo;
                try {
                    await sock.groupParticipantsUpdate(grupoNovoJid, [userGroupJid], 'add');
                    adicionadoComSucesso = true;
                } catch (errAdicionar) {
                    console.error(`[alterar] Falha ao adicionar em ${grupoNovoJid}:`, errAdicionar.message);
                }
            }

            // 8. Mensagem de confirmação
            let resposta = `✅ *FACÇÃO ALTERADA COM SUCESSO!*\n\n` +
                `👤 *Jogador:* ${nomePersonagem}\n` +
                `🏛️ *Nova Facção:* ${nomeNovaFaccaoFormatado}\n\n`;

            if (novaFaccao?.grupo) {
                resposta += adicionadoComSucesso
                    ? `➕ Adicionado ao grupo da nova facção.\n`
                    : `⚠️ Não foi possível adicionar ao grupo novo (verifique as permissões do bot).\n`;
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
