const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// Armazena as sessões de criação e os eventos de atividades ativas em memória
// { [jid]: { fase: 'aguardando_nome' | 'aguardando_participantes', criadorUid, faccaoCriador, nomeAtividade, nivelAtividade } }
const sessoesCriacao = {};

// { [jid]: { nomeAtividade, faccaoCriador, anunciantes: [{ uid, nome, level }], defensores: [{ uid, nome, level, faccao }], timer, criadoEm } }
const atividadesAtivas = {};

async function handleAtividadesCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);

    // 1. Comando Inicial: !iniciaratividade
    if (text === '!iniciaratividade') {
        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ Você precisa ter um personagem cadastrado para iniciar uma atividade!' }, { quoted: m });
                return true;
            }

            const faccao = playersData[playerUid]?.character?.faction;
            if (!faccao) {
                await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
                return true;
            }

            sessoesCriacao[from] = {
                fase: 'aguardando_nome',
                criadorUid: playerUid,
                faccaoCriador: faccao
            };

            await sock.sendMessage(from, { text: '❓ *Qual atividade você quer iniciar?*' }, { quoted: m });
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao validar personagem para atividade.' }, { quoted: m });
            return true;
        }
    }

    // 2. Passo 1: Receber o nome da atividade e validar na facção no Firebase
    if (sessoesCriacao[from] && sessoesCriacao[from].fase === 'aguardando_nome') {
        const sessao = sessoesCriacao[from];
        
        // Garantir que apenas o criador responda os passos do assistente
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};
        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        try {
            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes/${sessao.faccaoCriador}/atividades.json`);
            const atividadesFaccao = faccoesRes.data || {};

            // Procura a atividade informada (case insensitive)
            const chaveAtividade = Object.keys(atividadesFaccao).find(k => 
                k.toLowerCase() === text.toLowerCase() || 
                (atividadesFaccao[k]?.nome && atividadesFaccao[k].nome.toLowerCase() === text.toLowerCase())
            );

            if (!chaveAtividade) {
                await sock.sendMessage(from, { text: `❌ A atividade "*${text}*" não pertence ou não está disponível para a facção *${sessao.faccaoCriador}*.` }, { quoted: m });
                delete sessoesCriacao[from];
                return true;
            }

            const ativDados = atividadesFaccao[chaveAtividade];
            sessao.nomeAtividade = ativDados?.nome || text;
            sessao.nivelAtividade = ativDados?.nivel || 1;
            sessao.fase = 'aguardando_participantes';

            await sock.sendMessage(from, { text: '👥 *Quais jogadores vão participar da atividade?*\n\n_(Mencione usando @ ou digite "eu" para incluir a si mesmo)_' }, { quoted: m });
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao consultar as atividades da facção no Firebase.' }, { quoted: m });
            delete sessoesCriacao[from];
            return true;
        }
    }

    // 3. Passo 2: Receber e validar os anunciantes/atacantes
    if (sessoesCriacao[from] && sessoesCriacao[from].fase === 'aguardando_participantes') {
        const sessao = sessoesCriacao[from];

        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};
        const responderUid = Object.keys(playersData).find(u => 
            String(playersData[u]?.number?.LID || '').trim() === senderId || 
            String(playersData[u]?.number?.n || '').trim() === senderId
        );

        if (responderUid !== sessao.criadorUid) return false;

        const uidsParticipantes = new Set();

        // Se digitou "eu", inclui o próprio criador
        if (text.includes('eu')) {
            uidsParticipantes.add(sessao.criadorUid);
        }

        // Se marcou outros jogadores (@)
        const mentionedJids = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentionedJids) {
            const targetId = jid.split('@')[0].split(':')[0].trim();
            const targetUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === targetId || 
                String(playersData[u]?.number?.n || '').trim() === targetId
            );
            if (targetUid) uidsParticipantes.add(targetUid);
        }

        if (uidsParticipantes.size === 0) {
            await sock.sendMessage(from, { text: '❌ Nenhum jogador válido foi identificado. Marque alguém com @ ou digite "eu".' }, { quoted: m });
            return true;
        }

        // Valida se todos os participantes pertencem à mesma facção
        const anunciantes = [];
        for (const uid of uidsParticipantes) {
            const player = playersData[uid];
            if (player?.character?.faction !== sessao.faccaoCriador) {
                const nomeInvalido = player?.character?.charName || player?.nome || 'Um dos jogadores';
                await sock.sendMessage(from, { text: `❌ O jogador *${nomeInvalido}* não pertence à facção *${sessao.faccaoCriador}*!` }, { quoted: m });
                return true;
            }
            anunciantes.push({
                uid: uid,
                nome: player?.character?.charName || player?.nome || 'Lutador',
                level: player?.info?.level ?? 1
            });
        }

        // Cria a atividade ativa no grupo
        atividadesAtivas[from] = {
            nomeAtividade: sessao.nomeAtividade,
            faccaoCriador: sessao.faccaoCriador,
            anunciantes: anunciantes,
            defensores: []
        };

        // Timer de 30 minutos para fechar a lista
        atividadesAtivas[from].timer = setTimeout(async () => {
            if (atividadesAtivas[from]) {
                await sock.sendMessage(from, { text: `⏳ *O tempo de 30 minutos da atividade "${atividadesAtivas[from].nomeAtividade}" encerrou!*` });
                delete atividadesAtivas[from];
            }
        }, 30 * 60 * 1000);

        delete sessoesCriacao[from];

        // Manda o painel inicial
        await enviarPainelAtividade(sock, from, atividadesAtivas[from]);
        return true;
    }

    // 4. Comando para Defensores entrarem: !participar
    if (text === '!participar') {
        const atividade = atividadesAtivas[from];
        if (!atividade) {
            await sock.sendMessage(from, { text: '❌ Não há nenhuma atividade aberta no momento neste grupo.' }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            const playerUid = Object.keys(playersData).find(u => 
                String(playersData[u]?.number?.LID || '').trim() === senderId || 
                String(playersData[u]?.number?.n || '').trim() === senderId
            );

            if (!playerUid) {
                await sock.sendMessage(from, { text: '❌ Você precisa estar cadastrado para participar!' }, { quoted: m });
                return true;
            }

            const player = playersData[playerUid];
            const faccaoJogador = player?.character?.faction;

            // Inimigos entram na defesa, aliados (mesma facção) não podem
            if (faccaoJogador === atividade.faccaoCriador) {
                await sock.sendMessage(from, { text: '❌ Aliados da mesma facção não podem entrar como defensores!' }, { quoted: m });
                return true;
            }

            const jaEhAnunciante = atividade.anunciantes.some(a => a.uid === playerUid);
            const jaEhDefensor = atividade.defensores.some(d => d.uid === playerUid);

            if (jaEhAnunciante || jaEhDefensor) {
                await sock.sendMessage(from, { text: '⚠️ Você já está registrado nesta atividade!' }, { quoted: m });
                return true;
            }

            atividade.defensores.push({
                uid: playerUid,
                nome: player?.character?.charName || player?.nome || 'Defensor',
                level: player?.info?.level ?? 1,
                faccao: faccaoJogador
            });

            await enviarPainelAtividade(sock, from, atividade);
            return true;
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erro ao registrar participação.' }, { quoted: m });
            return true;
        }
    }

    return false;
}

// Função auxiliar para calcular forças e formatar o painel da atividade
async function enviarPainelAtividade(sock, from, atividade) {
    const forcaAtacantes = atividade.anunciantes.reduce((acc, curr) => acc + curr.level, 0);
    const forcaDefensores = atividade.defensores.reduce((acc, curr) => acc + curr.level, 0);

    let anunciantesTexto = atividade.anunciantes
        .map(a => `${a.nome} (${a.level})`)
        .join('\n');

    let defensoresTexto = atividade.defensores.length > 0
        ? atividade.defensores.map(d => `${d.nome} (${d.level})`).join('\n')
        : 'Nenhum nome registrado.';

    const mensagemPainel = `*${atividade.nomeAtividade}*\n\n` +
        `Anunciantes:\n\n${anunciantesTexto}\n\n` +
        `Força: ${forcaAtacantes}\n\n` +
        `Defensores:\n\n${defensoresTexto}\n\n` +
        `Força: ${forcaDefensores} --\n\n` +
        `⏳ _30 minutos de lista._`;

    await sock.sendMessage(from, { text: mensagemPainel });
}

module.exports = { handleAtividadesCommands };
