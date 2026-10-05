const axios = require('axios');
const { FIREBASE_URL } = require('../index'); 

/**
 * Módulo de Gerenciamento de Level, Experiência (EXP) e Rank
 */

/**
 * Calcula o rank do personagem com base no seu nível atual.
 * 
 * @param {number} level - Nível do personagem.
 * @returns {number} Rank do personagem (1 a 5).
 */
function calcularRank(level = 1) {
    if (level >= 80) return 5;
    if (level >= 60) return 4;
    if (level >= 40) return 3;
    if (level >= 20) return 2;
    return 1;
}

/**
 * Retorna quanto EXP é necessário para subir do (level) para o (level + 1).
 * 
 * @param {number} level - Level atual.
 * @returns {number} EXP necessário para o próximo nível.
 */
function expParaProximoNivel(level) {
    if (level < 11) return 100;
    if (level < 21) return 200;
    if (level < 41) return 400;
    if (level < 61) return 600;
    return 800; // Do level 61 em diante (até o 100+)
}

/**
 * Calcula o level atual baseado no EXP total acumulado.
 * 
 * @param {number} exp - Quantidade total de EXP.
 * @returns {number} O level calculado (mínimo: 1).
 */
function calcularLevel(exp = 0) {
    let expRestante = Math.max(0, Number(exp) || 0);
    let level = 1;

    while (true) {
        const custoProximo = expParaProximoNivel(level);
        if (expRestante >= custoProximo) {
            expRestante -= custoProximo;
            level++;
        } else {
            break;
        }
    }

    return level;
}

/**
 * Retorna o EXP total necessário para se alcançar determinado nível a partir do nível 1.
 * 
 * @param {number} targetLevel - Nível de destino.
 * @returns {number} EXP acumulado total necessário.
 */
function expTotalParaLevel(targetLevel) {
    let expAcumulado = 0;
    for (let lvl = 1; lvl < targetLevel; lvl++) {
        expAcumulado += expParaProximoNivel(lvl);
    }
    return expAcumulado;
}

/**
 * Calcula os detalhes do progresso do jogador em relação ao seu level atual e próximo.
 * 
 * @param {number} expTotal - EXP acumulado do jogador.
 * @returns {Object} Informações detalhadas do progresso de nível.
 */
function obterProgressoLevel(expTotal = 0) {
    const exp = Math.max(0, Number(expTotal) || 0);
    const levelAtual = calcularLevel(exp);
    const rankAtual = calcularRank(levelAtual);
    
    const expInicioLevelAtual = expTotalParaLevel(levelAtual);
    const expNecessarioProximo = expParaProximoNivel(levelAtual);
    
    const expNoLevelAtual = exp - expInicioLevelAtual;
    const porcentagem = Math.min(100, Math.floor((expNoLevelAtual / expNecessarioProximo) * 100));

    return {
        levelAtual,
        rankAtual,
        expTotal: exp,
        expNoLevelAtual,
        expNecessarioProximoLevel: expNecessarioProximo - expNoLevelAtual,
        expTotalNecessarioProximoLevel: expInicioLevelAtual + expNecessarioProximo,
        porcentagemProgresso: porcentagem
    };
}

/**
 * Processa o ganho de EXP de um jogador, verifica se houve subida de nível
 * e calcula o novo level e rank correspondentes.
 * 
 * @param {Object} info - Objeto `info` do jogador (contendo .exp e .level).
 * @param {number} expGanho - Quantidade de EXP a ser creditada.
 * @returns {Object} Resultado do processamento com novoExp, novoLevel, novoRank e flags de level up.
 */
function processarGanhoExp(info = {}, expGanho = 0) {
    const expAtual = Number(info.exp ?? 0);
    const levelAtual = Number(info.level ?? calcularLevel(expAtual));

    const qtdExpGanho = Math.max(0, Number(expGanho) || 0);
    const novoExp = expAtual + qtdExpGanho;
    
    const novoLevel = calcularLevel(novoExp);
    const novoRank = calcularRank(novoLevel);
    const subiuLevel = novoLevel > levelAtual;
    const levelsGanhos = Math.max(0, novoLevel - levelAtual);

    return {
        expAnterior: expAtual,
        levelAnterior: levelAtual,
        expGanho: qtdExpGanho,
        novoExp,
        novoLevel,
        novoRank,
        subiuLevel,
        levelsGanhos
    };
}

/**
 * Atualiza o EXP, Level e Rank de um jogador diretamente no Firebase.
 * 
 * @param {string} playerKey - Chave/ID do jogador no Firebase.
 * @param {number} expGanho - Quantidade de EXP a ser creditada.
 * @returns {Promise<Object>} Resultado detalhado do processamento e atualização.
 */
async function adicionarExpJogadorFirebase(playerKey, expGanho) {
    if (!playerKey) throw new Error('ID/Chave do jogador não fornecida.');

    try {
        const res = await axios.get(`${FIREBASE_URL}/players/${playerKey}.json`);
        const playerData = res.data || {};
        const playerInfo = playerData.info || {};

        const resultado = processarGanhoExp(playerInfo, expGanho);

        // Atualização no nó info (exp e level)
        await axios.patch(`${FIREBASE_URL}/players/${playerKey}/info.json`, {
            exp: resultado.novoExp,
            level: resultado.novoLevel
        });

        // Atualização no nó character.rank
        await axios.patch(`${FIREBASE_URL}/players/${playerKey}/character.json`, {
            rank: resultado.novoRank
        });

        // Sincronização na raiz caso existam propriedades legadas
        if (playerData.exp !== undefined || playerData.level !== undefined) {
            await axios.patch(`${FIREBASE_URL}/players/${playerKey}.json`, {
                exp: resultado.novoExp,
                level: resultado.novoLevel
            });
        }

        return {
            sucesso: true,
            playerKey,
            ...resultado
        };
    } catch (error) {
        console.error(`Erro ao atualizar EXP/Level/Rank do jogador (${playerKey}):`, error.message);
        return {
            sucesso: false,
            erro: error.message
        };
    }
}

module.exports = {
    calcularRank,
    calcularLevel,
    expParaProximoNivel,
    expTotalParaLevel,
    obterProgressoLevel,
    processarGanhoExp,
    adicionarExpJogadorFirebase
};
