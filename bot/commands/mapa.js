const axios = require('axios');
const { 
    FIREBASE_URL,  
    obterEmojiFaccao 
} = require('../index'); 

/**
 * Converte string no formato "DD/MM/YYYY HH:mm:ss" em objeto Date.
 */
function parseDataBRT(dataStr) {
    if (!dataStr) return null;
    const [dataPart, horaPart] = dataStr.trim().split(' ');
    if (!dataPart || !horaPart) return null;

    const [dia, mes, ano] = dataPart.split('/').map(Number);
    const [hora, min, seg] = horaPart.split(':').map(Number);

    return new Date(ano, mes - 1, dia, hora, min, seg || 0);
}

/**
 * Mapeia os dados do Firebase e retorna a presença de cada facção e bando por ilha.
 */
async function handleMapaCommands(sock, m, text, from) {
    if (text === '!mapa' || text.startsWith('!mapa ')) {
        try {
            const agora = new Date();

            const [ilhasRes, playersRes, viagensRes, faccoesRes] = await Promise.all([
                axios.get(`${FIREBASE_URL}/ilhas.json`),
                axios.get(`${FIREBASE_URL}/players.json`),
                axios.get(`${FIREBASE_URL}/ilhas/viagens.json`),
                axios.get(`${FIREBASE_URL}/faccoes.json`)
            ]);

            const ilhasData = ilhasRes.data || {};
            const playersData = playersRes.data || {};
            const viagensData = viagensRes.data || {};
            const faccoesData = faccoesRes.data || {};

            // Mapeia emojis de atividades cadastrados no Firebase (/faccoes/{faccao}/atividades)
            const emojisAtividadesMap = {};
            Object.values(faccoesData).forEach(faccao => {
                const atividades = faccao?.atividades || {};
                Object.entries(atividades).forEach(([chaveAtiv, ativData]) => {
                    if (ativData?.emoji) {
                        emojisAtividadesMap[chaveAtiv.toLowerCase()] = ativData.emoji;
                        if (ativData.nome) {
                            emojisAtividadesMap[ativData.nome.toLowerCase()] = ativData.emoji;
                        }
                    }
                });
            });

            // 1. Identifica jogadores em viagem ativa e em atividade ativa
            const emViagemUids = new Set();
            const emAtividadeMap = {}; // { [playerUid]: { nomeAtividade, chaveAtividade } }

            Object.values(viagensData).forEach(registro => {
                if (!registro) return;

                const terminoDate = parseDataBRT(registro.termino);
                const inicioDate = parseDataBRT(registro.inicio);

                // Se o registro ainda está dentro do período de execução (em andamento)
                if (terminoDate && terminoDate > agora && (!inicioDate || inicioDate <= agora)) {
                    const uidsParticipantes = Object.values(registro.jogadores || {});

                    if (registro.tipo === 'viagem') {
                        uidsParticipantes.forEach(uid => emViagemUids.add(String(uid)));
                    } else if (registro.tipo === 'atividade') {
                        uidsParticipantes.forEach(uid => {
                            emAtividadeMap[String(uid)] = {
                                nomeAtividade: registro.nomeAtividade || 'Em Atividade',
                                chaveAtividade: registro.atividade || ''
                            };
                        });
                    }
                }
            });

            // Estrutura: { [idIlha]: { [chaveGrupo]: { forca, emoji, eAtividade } } }
            const ilhasPresenca = {};

            Object.entries(playersData).forEach(([uid, player]) => {
                // Se o jogador estiver em viagem ativa, não mostra no mapa
                if (emViagemUids.has(String(uid))) {
                    return;
                }

                const ilha = Number(player?.character?.ilha);
                const faccao = player?.character?.faction;
                const bando = player?.character?.bando;
                const level = Number(player?.info?.level || 1);

                // Processa apenas se o jogador tiver uma ilha válida (ignora Ilha 0) e facção definida
                if (!isNaN(ilha) && ilha !== 0 && faccao) {
                    if (!ilhasPresenca[ilha]) {
                        ilhasPresenca[ilha] = {};
                    }

                    const dadosAtividade = emAtividadeMap[String(uid)];

                    let chaveGrupo = '';
                    let emojiGrupo = '';
                    let eAtividade = false;

                    if (dadosAtividade) {
                        eAtividade = true;
                        const nomeAtiv = dadosAtividade.nomeAtividade;
                        const chaveAtiv = dadosAtividade.chaveAtividade;

                        // Busca emoji específico da atividade ou usa emoji genérico de ação
                        const emojiAtiv = emojisAtividadesMap[chaveAtiv.toLowerCase()] || 
                                          emojisAtividadesMap[nomeAtiv.toLowerCase()] || '⚔️';

                        if (faccao.trim().toLowerCase() === 'piratas') {
                            const nomeBando = bando ? bando.trim() : 'Piratas (Sem Bando)';
                            chaveGrupo = `${nomeBando} - ${nomeAtiv}`;
                        } else {
                            chaveGrupo = `${faccao} - ${nomeAtiv}`;
                        }

                        emojiGrupo = `(${emojiAtiv})`;
                    } else {
                        // Jogadores parados na ilha
                        if (faccao.trim().toLowerCase() === 'piratas') {
                            chaveGrupo = bando ? bando.trim() : 'Piratas (Sem Bando)';
                        } else {
                            chaveGrupo = faccao;
                        }

                        emojiGrupo = obterEmojiFaccao(faccao) || '🏴‍☠️';
                    }

                    if (!ilhasPresenca[ilha][chaveGrupo]) {
                        ilhasPresenca[ilha][chaveGrupo] = {
                            forca: 0,
                            emoji: emojiGrupo,
                            eAtividade: eAtividade
                        };
                    }

                    ilhasPresenca[ilha][chaveGrupo].forca += level;
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

                for (const [nomeGrupo, dados] of Object.entries(gruposPresentes)) {
                    linhasGrupos.push(`➔ ${nomeGrupo} ${dados.emoji}\n> Força: ${dados.forca}`);
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
