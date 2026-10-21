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

// Garante o formato clássico @s.whatsapp.net exigido pelo groupParticipantsUpdate
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
            let nomeExibicaoFaccao = '';
            let bandoNome = null;
            let grupoDestinoJid = null;

            if (ehGovMundial || ehExercitoRev) {
                // Caso seja Governo Mundial ou Exército Revolucionário
                novaFaccaoKey = ehGovMundial ? 'Governo Mundial' : 'Exército Revolucionário';
                
                // Tenta achar a chave exata no Firebase
                const facEncontradaKey = Object.keys(faccoesData).find(k => normalizar(k) === normalizar(novaFaccaoKey));
                if (facEncontradaKey) {
                    novaFaccaoKey = facEncontradaKey;
                    grupoDestinoJid = faccoesData[facEncontradaKey]?.grupo || null;
                }
                nomeExibicaoFaccao = novaFaccaoKey;
                bandoNome = null; // Remove o bando
            } else {
                // Caso seja qualquer outro nome -> Torna-se PIRATAS com nó BANDO
                novaFaccaoKey = 'Piratas';
                nomeExibicaoFaccao = `Piratas (${entradaFaccaoOuBando})`;

                // Procura em faccoes/Piratas/bandos
                const piratasData = faccoesData['Piratas'] || faccoesData['piratas'] || {};
                const bandosData = piratasData.bandos || {};

                // Procura o bando dentro do nó
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
                grupoDestinoJid = bandoObj?.grupo || bandoObj?.grupoJid || null;
            }

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

            // Descobrir o grupo antigo para remoção
            let grupoAntigoJid = null;
            if (faccaoAtual) {
                if (normalizar(faccaoAtual) === normalizar('Piratas') && bandoAtual) {
                    const piratasData = faccoesData['Piratas'] || faccoesData['piratas'] || {};
                    const bandosData = piratasData.bandos || {};
                    const bandoKey = Object.keys(bandosData).find(k => normalizar(k) === normalizar(bandoAtual) || normalizar(bandosData[k]?.nome) === normalizar(bandoAtual));
                    if (bandoKey) {
                        grupoAntigoJid = bandosData[bandoKey]?.grupo || bandosData[bandoKey]?.grupoJid;
                    }
                } else {
                    const facObj = faccoesData[faccaoAtual];
                    if (facObj) grupoAntigoJid = facObj.grupo;
                }
            }

            // 5. Atualizar no Firebase
            const updatePayload = {
                faction: novaFaccaoKey,
                bando: bandoNome ? bandoNome : null // Se for Governo/Exército, bando é apagado (null)
            };

            await axios.patch(`${FIREBASE_URL}/players/${playerUid}/character.json`, updatePayload);

            // 6. Preparar JIDs para atualização nos grupos
            const numeroTelefone = player?.number?.n || targetId;
            const userAddJid = formatarJidParaAdicao(numeroTelefone);
            const userRemoveJid = formatarJidParaAdicao(targetId) || userAddJid;

            // 7. Remover do grupo antigo (Tratado com try-catch para evitar queda do bot)
            let removidoComSucesso = false;
            if (grupoAntigoJid && grupoAntigoJid !== grupoDestinoJid) {
                try {
                    await sock.groupParticipantsUpdate(grupoAntigoJid, [userRemoveJid], 'remove');
                    removidoComSucesso = true;
                } catch (errRemover) {
                    console.error(`[alterar] Erro seguro ao remover de ${grupoAntigoJid}:`, errRemover.message);
                }
            }

            // 8. Adicionar ao novo grupo (Tratado com try-catch e atraso mínimo para estabilidade do socket)
            let adicionadoComSucesso = false;
            if (grupoDestinoJid && userAddJid) {
                try {
                    // Pequena pausa para garantir estabilidade da conexão do socket
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const res = await sock.groupParticipantsUpdate(grupoDestinoJid, [userAddJid], 'add');
                    if (res && res[0] && (res[0].status === '408' || res[0].status === 408)) {
                        console.log(`[alterar] Jogador com restrição de privacidade.`);
                    } else {
                        adicionadoComSucesso = true;
                    }
                } catch (errAdicionar) {
                    console.error(`[alterar] Erro seguro ao adicionar em ${grupoDestinoJid}:`, errAdicionar.message);
                }
            }

            // 9. Mensagem de Confirmação
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
                    : `⚠️ Não foi possível adicionar ao grupo (verifique as permissões de admin do bot ou privacidade do usuário).\n`;
            }

            if (grupoAntigoJid && grupoAntigoJid !== grupoDestinoJid) {
                resposta += removidoComSucesso
                    ? `➖ Removido do grupo antigo.`
                    : `⚠️ Não foi possível remover do grupo antigo.`;
            }

            await sock.sendMessage(from, { text: resposta.trim() }, { quoted: m });

        } catch (e) {
            console.error('Erro no comando !alterar:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao alterar a facção/bando do jogador.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleAlterarCommands };
