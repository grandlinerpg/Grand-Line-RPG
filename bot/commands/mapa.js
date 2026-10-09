const axios = require('axios');
const { 
    FIREBASE_URL,  
    obterEmojiFaccao 
} = require('../index');

/** 
 * Mapeia os dados do Firebase e retorna a presença de cada facção e bando por ilha.
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

            // Estrutura: { [idIlha]: { [chaveComposta]: { nomeGrupo, status, forca, faccaoOriginal } } }
            const ilhasPresenca = {};

            Object.values(playersData).forEach(player => {
                const ilha = Number(player?.character?.ilha);
                const faccao = player?.character?.faction;
                const bando = player?.character?.bando;
                const statusRaw = player?.character?.status;
                const level = Number(player?.info?.level || 1);

                const statusTratado = statusRaw ? statusRaw.toString().trim() : 'Parado';

                // Se o status for "Viagem" (independente de maiúsculas/minúsculas), ignora o jogador
                if (statusTratado.toLowerCase() === 'viagem') {
                    return;
                }

                // Processa apenas se o jogador tiver uma ilha válida (ignora Ilha 0) e facção definida
                if (!isNaN(ilha) && ilha !== 0 && faccao) {
                    if (!ilhasPresenca[ilha]) {
                        ilhasPresenca[ilha] = {};
                    }

                    // Se a facção for Piratas e houver bando informado, agrupa pelo nome do bando
                    let nomeGrupo = faccao;
                    if (faccao.trim().toLowerCase() === 'piratas') {
                        nomeGrupo = bando ? bando.trim() : 'Piratas (Sem Bando)';
                    }

                    // Define o status normalizado para exibição/agrupamento
                    const isParado = statusTratado.toLowerCase() === 'parado';
                    const statusExibicao = isParado ? 'Parado' : statusTratado;

                    // Chave para agrupar por grupo e por atividade (exceto se for "Parado", onde o agrupamento é padrão)
                    const chaveUnica = isParado ? `${nomeGrupo}_Parado` : `${nomeGrupo}_${statusExibicao}`;

                    if (!ilhasPresenca[ilha][chaveUnica]) {
                        ilhasPresenca[ilha][chaveUnica] = {
                            nomeGrupo: nomeGrupo,
                            status: statusExibicao,
                            forca: 0,
                            faccaoOriginal: faccao
                        };
                    }

                    ilhasPresenca[ilha][chaveUnica].forca += level;
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

                const gruposPresentes = ilhasPresenca[idIlha];
                const linhasGrupos = [];

                for (const dados of Object.values(gruposPresentes)) {
                    const emoji = obterEmojiFaccao(dados.faccaoOriginal) || '🏴‍☠️';
                    
                    if (dados.status === 'Parado') {
                        linhasGrupos.push(`➔ ${dados.nomeGrupo} ${emoji}\n> Força: ${dados.forca}`);
                    } else {
                        linhasGrupos.push(`➔ ${dados.nomeGrupo} ${emoji}\n> Atividade: ${dados.status}\n> Força: ${dados.forca}`);
                    }
                }

                bloco += linhasGrupos.join('\n');
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
