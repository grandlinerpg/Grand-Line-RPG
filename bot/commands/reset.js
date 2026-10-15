const axios = require('axios');
const { FIREBASE_URL } = require('../index');

const GRUPO_NOTIFICACAO = '120363429956961386@g.us';

// Função responsável por fazer a limpeza/reset no Firebase
async function executarResetAtividades(sock) {
    try {
        console.log('⏰ [Reset] Iniciando o reset semanal de atividades...');

        // 1. Busca todos os jogadores cadastrados no Firebase
        const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
        const playersData = playersRes.data || {};

        const playerUids = Object.keys(playersData);

        if (playerUids.length === 0) {
            console.log('⚠️ [Reset] Nenhum jogador encontrado no banco de dados.');
            return false;
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

            // Aplica as alterações no nó 'atividades' do jogador
            await axios.put(`${FIREBASE_URL}/players/${uid}/atividades.json`, atividadesAtualizadas);
        }

        // 3. Notifica no grupo no término do reset
        if (sock) {
            await sock.sendMessage(GRUPO_NOTIFICACAO, {
                text: '✅ *O reset semanal de atividades foi concluído com sucesso para todos os jogadores!*'
            });
        }

        console.log('✅ [Reset] Reset concluído com sucesso!');
        return true;
    } catch (e) {
        console.error('❌ Erro ao executar o reset de atividades:', e);
        return false;
    }
}

// Handler para ser acionado manualmente via chat (!reset)
async function handleResetCommand(sock, m, text, from) {
    if (text.trim().toLowerCase() !== '!reset') {
        return false;
    }

    const sucesso = await executarResetAtividades(sock);

    if (sucesso && from !== GRUPO_NOTIFICACAO) {
        await sock.sendMessage(from, { text: '✅ Comando de reset executado com sucesso!' }, { quoted: m });
    } else if (!sucesso) {
        await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao tentar resetar as atividades dos jogadores.' }, { quoted: m });
    }

    return true;
}

module.exports = {
    handleResetCommand,
    executarResetAtividades
};
