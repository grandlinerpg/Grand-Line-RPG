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

// Formata o número/JID para o formato padrão do WhatsApp (@s.whatsapp.net)
function formatarJidPadrao(numeroOuJid) {
    if (!numeroOuJid) return null;
    const numLimpo = String(numeroOuJid).split('@')[0].split(':')[0].replace(/\D/g, '').trim();
    return numLimpo ? `${numLimpo}@s.whatsapp.net` : null;
}

// Garante o formato do JID do grupo
function formatarJidGrupo(grupoJid) {
    if (!grupoJid) return null;
    let g = String(grupoJid).trim();
    if (!g.includes('@')) g = `${g}@g.us`;
    return g;
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
            const entradaFaccaoOuBando = partes.slice(2).join(' ').trim();

            if (!entradaFaccaoOuBando) {
                await sock.sendMessage(from, { text: '❌ Informe a facção ou bando! Exemplo: `!alterar @Jogador Ninered Scabbards`' }, { quoted: m });
                return true;
            }

            // 2. Buscar dados no Firebase
            const [faccoesRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/faccoes.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);

            const faccoesData = faccoesRes.data || {};
            const playersData = playersRes.data || {};

            // 3. Verificar se é uma das facções principais ou um Bando de Piratas
            const entNorm = normalizar(entradaFaccaoOuBando);
            const ehGovMundial = entNorm === normalizar('Governo Mundial');
            const ehExercitoRev = entNorm === normalizar('Exército Revolucionário');

            let novaFaccaoKey = '';
            let bandoNome = null;
            let grupoDestinoRaw = null;

            if (ehGovMundial || ehExercitoRev) {
                novaFaccaoKey = ehGovMundial ? 'Governo Mundial' : 'Exército Revolucionário';
                
                const facEncontradaKey = Object.keys(faccoesData).find(k => normalizar(k) === normalizar(novaFaccaoKey));
                if (facEncontradaKey) {
                    novaFaccaoKey = facEncontradaKey;
                    grupoDestinoRaw = faccoesData[facEncontradaKey]?.grupo || null;
                }
                bandoNome = null;
            } else {
                novaFaccaoKey = 'Piratas';

                // Procura em faccoes/Piratas/bandos
                const piratasKey = Object.keys(faccoesData).find(k => normalizar(k) === 'piratas') || 'Piratas';
                const piratasData = faccoesData[piratasKey] || {};
                const bandosData = piratasData.bandos || {};

                const bandoEncontradoKey = Object.keys(bandosData).find(key => {
                    const bandoObj = bandosData[key];
                    return normalizar(key) === entNorm || normalizar(bandoObj?.nome) === entNorm;
                });

                if (!bandoEncontradoKey) {
                    await sock.sendMessage(from, { text: `❌ O bando/facção *"${entradaFaccaoOuBando}"* não foi encontrado em faccoes/Piratas/bandos!` }, { quoted: m });
                    return true;
                }

                const bandoObj = bandosData[bandoEncontradoKey];
                bandoNome = bandoObj?.nome || bandoEncontradoKey;
                grupoDestinoRaw = bandoObj?.grupo || bandoObj?.grupoJid || null;
            }

            const grupoDestinoJid = formatarJidGrupo(grupoDestinoRaw);

            // 4. Localizar jogador na base de dados
            const targetId = mentionedJid.split('@')[0].split(':')[0].replace(/\D/g, '').trim();
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
            const bandoAtual = player?.character?.bando;
            const nomePersonagem = player?.character?.charName || player?.nome || 'Lutador';

            // Localizar grupo antigo
            let grupoAntigoRaw = null;
            if (faccaoAtual) {
                if (normalizar(faccaoAtual) === normalizar('Piratas') && bandoAtual) {
                    const piratasKey = Object.keys(faccoesData).find(k => normalizar(k) === 'piratas') || 'Piratas';
                    const bandosData = faccoesData[piratasKey]?.bandos || {};
                    const bandoKey = Object.keys(bandosData).find(k => normalizar(k) === normalizar(bandoAtual) || normalizar(bandosData[k]?.nome) === normalizar(bandoAtual));
                    if (bandoKey) {
                        grupoAntigoRaw = bandosData[bandoKey]?.grupo || bandosData[bandoKey]?.grupoJid;
                    }
                } else {
                    const facKey = Object.keys(faccoesData).find(k => normalizar(k) === normalizar(faccaoAtual));
                    if (facKey && faccoesData[facKey]) {
                        grupoAntigoRaw = faccoesData[facKey].grupo;
                    }
                }
            }

            const grupoAntigoJid = formatarJidGrupo(grupoAntigoRaw);

            // 5. Atualizar registro no Firebase
            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/character.json`, {
                faction: novaFaccaoKey,
                bando: bandoNome ? bandoNome : null
            });

            // 6. Preparar JID do participante
            const numeroTelefone = player?.number?.n || targetId;
            const userJidFormatado = formatarJidPadrao(numeroTelefone);

            let removidoComSucesso = false;
            let adicionadoComSucesso = false;

            // 7. Remover do grupo antigo
            if (grupoAntigoJid && grupoAntigoJid !== grupoDestinoJid && userJidFormatado) {
                try {
                    await sock.groupParticipantsUpdate(grupoAntigoJid, [userJidFormatado], 'remove');
                    removidoComSucesso = true;
                } catch (errRemover) {
                    console.error(`[alterar] Erro ao remover do grupo ${grupoAntigoJid}:`, errRemover?.message || errRemover);
                }
                // Pausa de segurança entre requisições para evitar queda do socket
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // 8. Adicionar ao novo grupo
            if (grupoDestinoJid && userJidFormatado) {
                try {
                    const res = await sock.groupParticipantsUpdate(grupoDestinoJid, [userJidFormatado], 'add');
                    if (res && res[0] && (res[0].status === '408' || res[0].status === 408)) {
                        console.log(`[alterar] Jogador com restrição de privacidade no WhatsApp.`);
                    } else {
                        adicionadoComSucesso = true;
                    }
                } catch (errAdicionar) {
                    console.error(`[alterar] Erro ao adicionar no grupo ${grupoDestinoJid}:`, errAdicionar?.message || errAdicionar);
                }
            }

            // 9. Retorno com a confirmação
            let resposta = `✅ *ALTERAÇÃO REALIZADA COM SUCESSO!*\n\n` +
                `👤 *Jogador:* ${nomePersonagem}\n` +
                `🏛️ *Nova Facção:* ${novaFaccaoKey}\n`;

            if (bandoNome) {
                resposta += `🏴‍☠️ *Bando:* ${bandoNome}\n`;
            }

            resposta += `\n`;

            if (grupoDestinoJid) {
                resposta += adicionadoComSucesso
                    ? `➕ Adicionado ao grupo correspondente.\n`
                    : `⚠️ Não foi possível adicionar ao grupo (verifique se o bot é admin ou se o usuário restringiu adições).\n`;
            }

            if (grupoAntigoJid && grupoAntigoJid !== grupoDestinoJid) {
                resposta += removidoComSucesso
                    ? `➖ Removido do grupo antigo.`
                    : `⚠️ Não foi possível remover do grupo antigo (verifique se o bot é admin no grupo de origem).`;
            }

            await sock.sendMessage(from, { text: resposta.trim() }, { quoted: m });

        } catch (e) {
            console.error('Erro geral no comando !alterar:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao alterar a facção/bando do jogador.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleAlterarCommands };
