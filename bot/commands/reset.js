const axios = require('axios');
const { FIREBASE_URL } = require('../index');

const GRUPO_NOTIFICACAO = '120363429956961386@g.us';

async function handleResetCommand(sock, m, text, from) {
    // Verifica se o comando acionado foi exatamente !reset
    if (text.trim().toLowerCase() !== '!reset') {
        return false;
    }

    try {
        // 1. Busca todos os jogadores cadastrados no Firebase
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const playerUids = Object.keys(playersData);

        if (playerUids.length === 0) {
            await sock.sendMessage(from, { text: '⚠️ Nenhum jogador encontrado para realizar o reset.' }, { quoted: m });
            return true;
        }

        // 2. Percorre cada jogador e atualiza o nó de atividades
        for (const uid of playerUids) {
            const playerAtividades = playersData[uid]?.atividades || {};
            const atividadesAtualizadas = {};

            // Percorre todas as chaves de atividades do jogador
            Object.keys(playerAtividades).forEach(chave => {
                if (chave === 'data') {
                    // Mantém o valor original do nó 'data'
                    atividadesAtualizadas[chave] = playerAtividades[chave];
                } else {
                    // Zera o contador de qualquer outra atividade
                    atividadesAtualizadas[chave] = 0;
                }
            });

            // Aplica as alterações no nó 'atividades' do jogador atual
            await axios.put(`${FIREBASE_URL}/players/${uid}/atividades.json`, atividadesAtualizadas);
        }

        // 3. Notifica no grupo solicitado que o reset foi concluído
        await sock.sendMessage(GRUPO_NOTIFICACAO, {
            text: '✅ *O reset de atividades foi concluído com sucesso para todos os jogadores!*'
        });

        // Opcional: Feedback no chat/grupo onde o comando foi digitado (caso seja diferente do grupo alvo)
        if (from !== GRUPO_NOTIFICACAO) {
            await sock.sendMessage(from, { text: '✅ Comando de reset executado com sucesso!' }, { quoted: m });
        }

        return true;
    } catch (e) {
        console.error('Erro ao executar o comando !reset:', e);
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao tentar resetar as atividades dos jogadores.' }, { quoted: m });
        return true;
    }
}

module.exports = {
    handleResetCommand
};
