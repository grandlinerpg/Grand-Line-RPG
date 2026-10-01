const axios = require('axios');
const { 
    FIREBASE_URL, 
    obterEmojiFaccao 
} = require('../index');

/**
 * Mapeia os dados do Firebase e retorna a presença de cada facção por ilha.
 */
async function handleMapaCommands(sock, m, text, from) {
    if (text === '!mapa' || text.startsWith('!mapa ')) {
        try {
            const [ilhasRes, playersRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/ilhas.json`),
                axios.get(`${FIREBASE_URL}/players.json`)
            ]);

            const ilhasData = ilhasRes.data || {};
            const playersData = playersRes.data || {};

            // Mapeia os jogadores agrupados por ilha e depois por facção
            // Estrutura: { [idIlha]: { [faccao]: forçaTotal } }
            const ilhasPresenca = {};

            Object.values(playersData).forEach(player => {
                const ilha = Number(player?.character?.ilha);
                const faccao = player?.character?.faction;
                const level = Number(player?.info?.level || 1);

                // Processa apenas se o jogador tiver uma ilha válida (ignora Ilha 0) e facção definida
                if (!isNaN(ilha) && ilha !== 0 && faccao) {
                    if (!ilhasPresenca[ilha]) {
                        ilhasPresenca[ilha] = {};
                    }
                    if (!ilhasPresenca[ilha][faccao]) {
                        ilhasPresenca[ilha][faccao] = 0;
                    }
                    ilhasPresenca[ilha][faccao] += level;
                }
            });

            // Pega os IDs das ilhas que possuem jogadores (exceto 0) e ordena numericamente
            const ilhasOcupadas = Object.keys(ilhasPresenca)
                .map(Number)
                .filter(id => id !== 0)
                .sort((a, b) => a - b);

            if (ilhasOcupadas.length === 0) {
                await sock.sendMessage(from, { text: '🌊 *Nenhum jogador encontrado nas ilhas no momento.*' }, { quoted: m });
                return true;
            }

            let mapaText = `🌍 *— GRAND LINE —* 🌍\n\n`;
            const blocosIlhas = [];

            for (const idIlha of ilhasOcupadas) {
                // Busca o nome da ilha na estrutura do Firebase (Array ou Objeto)
                let nomeIlha = `Ilha ${idIlha}`;
                if (Array.isArray(ilhasData)) {
                    if (ilhasData[idIlha]?.nome) nomeIlha = ilhasData[idIlha].nome;
                } else if (ilhasData[idIlha]?.nome) {
                    nomeIlha = ilhasData[idIlha].nome;
                }

                let bloco = `*${idIlha}. ${nomeIlha}*\n\n`;

                const faccoesPresentes = ilhasPresenca[idIlha];
                const linhasFaccoes = [];

                for (const [faccao, forca] of Object.entries(faccoesPresentes)) {
                    const emoji = obterEmojiFaccao(faccao) || '🚩';
                    linhasFaccoes.push(`➔ ${faccao} ${emoji}\n> Força: ${forca}`);
                }

                bloco += linhasFaccoes.join('\n');
                blocosIlhas.push(bloco);
            }

            mapaText += blocosIlhas.join('\n──────────────────\n');

            await sock.sendMessage(from, { text: mapaText.trim() }, { quoted: m });
            return true;
        } catch (e) {
            console.error('Erro no comando !mapa:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao carregar o mapa das ilhas.' }, { quoted: m });
            return true;
        }
    }

    return false;
}

module.exports = {
    handleMapaCommands
};
