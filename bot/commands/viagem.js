const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// Grupo onde os anúncios/listas são enviados (mesmo grupo da atividade)
const GRUPO_ATIVIDADES_LISTA = '120363409325935641@g.us';

// Sessoes temporárias para controle do fluxo do comando !viajar
const sessoesViagem = {};

async function handleViagemCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);

    // 1. Comando Inicial: !viajar
    if (text === '!viajar') {
        const gruposPermitidos = [
            '120363408918568715@g.us',
            '120363408644122202@g.us',
            '120363411388017464@g.us'
        ];

        if (!gruposPermitidos.includes(from)) {
            await sock.sendMessage(from, { text: '❌ Este comando só pode ser utilizado nos grupos permitidos!' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ Você precisa ter um personagem cadastrado para viajar!' }, { quoted: m });
                return true;
            }

            const faccao = playersData[playerUid]?.character?.faction;
            if (!faccao) {
                await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
                return true;
            }

            sessoesViagem[from] = {
                fase: 'aguardando_participantes',
                criadorUid: playerUid,
                faccaoCriador: faccao
            };

            await sock.sendMessage(from, { text: '👥 *Quais membros querem viajar?*\n\n_(Mencione usando @ ou digite "eu" para incluir a si mesmo)_' }, { quoted: m });
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao iniciar a viagem.' }, { quoted: m });
            return true;
        }
    }

    // 2. Passo 1: Quais membros querem viajar?
    if (sessoesViagem[from] && sessoesViagem[from].fase === 'aguardando_participantes') {
        const sessao = sessoesViagem[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const uidsParticipantes = new Set();
        if (text.toLowerCase().includes('eu')) uidsParticipantes.add(sessao.criadorUid);

        const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentionedJids) {
            const targetId = jid.split('@')[0].split(':')[0].trim();
            const targetUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === targetId || 
                String(playersData[u]?.number?.n || '').trim() === targetId || u === targetId
            );
            if (targetUid) uidsParticipantes.add(targetUid);
        }

        if (uidsParticipantes.size === 0) {
            await sock.sendMessage(from, { text: '❌ Nenhum jogador válido foi identificado. Marque alguém com @ ou digite "eu".' }, { quoted: m });
            return true;
        }

        const membrosViajantes = [];
        let ilhaAtualGrupo = null;

        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            const nomePlayer = player?.character?.charName || player?.nome || 'Jogador';

            if (player?.character?.faction !== sessao.faccaoCriador) {
                await sock.sendMessage(from, { text: `❌ O jogador *${nomePlayer}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }

            const ilhaJogador = Number(player?.character?.ilha ?? 0);

            if (ilhaAtualGrupo === null) {
                ilhaAtualGrupo = ilhaJogador;
            } else if (ilhaJogador !== ilhaAtualGrupo) {
                await sock.sendMessage(from, { text: '❌ Todos os jogadores devem estar na mesma ilha para viajarem juntos!' }, { quoted: m });
                return true;
            }

            membrosViajantes.push({
                uid: uid,
                nome: nomePlayer,
                level: player?.info?.level ?? 1,
                faccao: sessao.faccaoCriador,
                ilhaAtual: ilhaJogador
            });
        }

        sessao.membros = membrosViajantes;
        sessao.ilhaAtual = ilhaAtualGrupo;
        sessao.fase = 'aguardando_ilha_destino';

        await sock.sendMessage(from, { 
            text: `🏝️ *Para qual ilha os jogadores desejam viajar?*\n\n` +
                  `Você está atualmente na *Ilha ${ilhaAtualGrupo}*.\n` +
                  `Digite um número de *0 a 12*.` 
        }, { quoted: m });
        return true;
    }

    // 3. Passo 2: Escolha do número da ilha (0 a 12) e validação de movimento
    if (sessoesViagem[from] && sessoesViagem[from].fase === 'aguardando_ilha_destino') {
        const sessao = sessoesViagem[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId || u === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const ilhaDestino = parseInt(text.trim(), 10);

        if (isNaN(ilhaDestino) || ilhaDestino < 0 || ilhaDestino > 12) {
            await sock.sendMessage(from, { text: '❌ Por favor, digite um número de ilha válido de 0 a 12.' }, { quoted: m });
            return true;
        }

        const ilhaAtual = sessao.ilhaAtual;

        // Regras de Movimentação entre ilhas
        if (ilhaAtual !== ilhaDestino) {
            if (ilhaAtual === 0) {
                // De 0 pode ir para qualquer uma (1 a 12)
            } else if (ilhaDestino === 0) {
                // De qualquer ilha (1 a 12) pode voltar para a 0
            } else {
                // Regra circular de 1 a 12: 1 para frente, 1 para trás, 12 -> 1, 1 -> 12
                const avanco = (ilhaAtual % 12) + 1; // Ex: 1->2, 12->1
                const recuo = ilhaAtual === 1 ? 12 : ilhaAtual - 1; // Ex: 2->1, 1->12

                if (ilhaDestino !== avanco && ilhaDestino !== recuo) {
                    await sock.sendMessage(from, { 
                        text: `❌ Movimento inválido! Estando na *Ilha ${ilhaAtual}*, você só pode ir para a *Ilha 0*, *Ilha ${recuo}* ou *Ilha ${avanco}*.` 
                    }, { quoted: m });
                    return true;
                }
            }
        } else {
            await sock.sendMessage(from, { text: '❌ Você já está nessa ilha!' }, { quoted: m });
            return true;
        }

        // Salvar Viagem no Firebase
        try {
            const dataInicio = new Date();
            const dataTermino = new Date(dataInicio.getTime() + 5 * 60 * 1000); // 5 minutos depois

            const formatarData = (d) => {
                const dia = String(d.getDate()).padStart(2, '0');
                const mes = String(d.getMonth() + 1).padStart(2, '0');
                const ano = d.getFullYear();
                const hora = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                const seg = String(d.getSeconds()).padStart(2, '0');
                return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
            };

            const jogadoresObj = {};
            sessao.membros.forEach((membro, index) => {
                jogadoresObj[index + 1] = membro.nome;
            });

            // Buscar viagens existentes para definir a próxima chave numérica (1, 2, 3...)
            const viagensRes = await axios.get(`${FIREBASE_URL}/ilhas/viagens.json`);
            const viagensExistentes = viagensRes.data || {};
            const proximoId = Object.keys(viagensExistentes).length + 1;

            const dadosViagem = {
                inicio: formatarData(dataInicio),
                termino: formatarData(dataTermino),
                jogadores: jogadoresObj,
                ilhaDestino: ilhaDestino,
                faccao: sessao.faccaoCriador
            };

            await axios.patch(`${FIREBASE_URL}/ilhas/viagens/${proximoId}.json`, dadosViagem);

            await sock.sendMessage(from, { 
                text: `⛵ *Viagem iniciada com sucesso!*\n\n` +
                      `📍 Destino: *Ilha ${ilhaDestino}*\n` +
                      `⏳ Chegada prevista em 5 minutos.` 
            }, { quoted: m });

            const forcaTotal = sessao.membros.reduce((acc, curr) => acc + (curr.level || 0), 0);
            const faccaoNome = sessao.faccaoCriador;
            const nomesJogadores = sessao.membros.map(m => m.nome).join(', ');

            // Agendar anúncio após 5 minutos
            setTimeout(async () => {
                try {
                    // Atualiza a ilha atual dos jogadores no banco
                    for (const membro of sessao.membros) {
                        await axios.patch(`${FIREBASE_URL}/players/${membro.uid}/character.json`, {
                            ilha: ilhaDestino
                        });
                    }

                    const mensagemChegada = 
                        `⚓ *CHEGADA NA ILHA ${ilhaDestino}*\n\n` +
                        `Membros da facção *${faccaoNome}* (${nomesJogadores}) acabaram de chegar na *Ilha ${ilhaDestino}*!\n\n` +
                        `💪 *Força total do grupo:* ${forcaTotal}`;

                    await sock.sendMessage(GRUPO_ATIVIDADES_LISTA, { text: mensagemChegada });
                } catch (err) {
                    console.error('Erro ao processar chegada da viagem:', err);
                }
            }, 5 * 60 * 1000);

            delete sessoesViagem[from];
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao salvar os dados da viagem no Firebase.' }, { quoted: m });
            delete sessoesViagem[from];
            return true;
        }
    }

    return false;
}

module.exports = {
    handleViagemCommands
};
