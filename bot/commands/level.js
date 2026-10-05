const axios = require('axios');
const { FIREBASE_URL } = require('../index');

/**
 * Módulo de Gerenciamento de Level e Experiência (EXP)
 */

/**
 * Calcula o level baseado no EXP total acumulado.
 * Regra: Cada 1000 de EXP concede 1 Level (Level mínimo: 1).
 * 
 * @param {number} exp - Quantidade total de EXP.
 * @returns {number} O level calculado.
 */
function calcularLevel(exp = 0) {
    const expNum = Math.max(0, Number(exp) || 0);
    return Math.floor(expNum / 1000) + 1;
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
    
    // EXP exigido para atingir o nível atual e o próximo nível
    const expInicioLevelAtual = (levelAtual - 1) * 1000;
    const expProximoLevel = levelAtual * 1000;
    
    const expNoLevelAtual = exp - expInicioLevelAtual;
    const expNecessarioLevelAtual = 1000;
    const porcentagem = Math.min(100, Math.floor((expNoLevelAtual / expNecessarioLevelAtual) * 100));

    return {
        levelAtual,
        expTotal: exp,
        expNoLevelAtual,
        expNecessarioProximoLevel: expProximoLevel - exp,
        porcentagemProgresso: porcentagem
    };
}

/**
 * Processa o ganho de EXP de um jogador, verifica se houve subida de nível
 * e calcula o novo level correspondente.
 * 
 * @param {Object} info - Objeto `info` do jogador (contendo .exp e .level).
 * @param {number} expGanho - Quantidade de EXP a ser creditada.
 * @returns {Object} Resultado do processamento com novoExp, novoLevel e flags de level up.
 */
function processarGanhoExp(info = {}, expGanho = 0) {
    const expAtual = Number(info.exp ?? 0);
    const levelAtual = Number(info.level ?? calcularLevel(expAtual));

    const qtdExpGanho = Math.max(0, Number(expGanho) || 0);
    const novoExp = expAtual + qtdExpGanho;
    
    // Novo level calculado com a regra de 1000 exp por nível
    const novoLevel = calcularLevel(novoExp);
    
    const subiuLevel = novoLevel > levelAtual;
    const levelsGanhos = Math.max(0, novoLevel - levelAtual);

    return {
        expAnterior: expAtual,
        levelAnterior: levelAtual,
        expGanho: qtdExpGanho,
        novoExp,
        novoLevel,
        subiuLevel,
        levelsGanhos
    };
}

/**
 * Atualiza o EXP e Level de um jogador diretamente no Firebase.
 * Sincroniza tanto no nó `info` quanto na raiz do nó do player se existirem campos duplicados.
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

        // Atualização no nó info (padrão principal)
        await axios.patch(`${FIREBASE_URL}/players/${playerKey}/info.json`, {
            exp: resultado.novoExp,
            level: resultado.novoLevel
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
        console.error(`Erro ao atualizar EXP/Level do jogador (${playerKey}):`, error.message);
        return {
            sucesso: false,
            erro: error.message
        };
    }
}

module.exports = {
    calcularLevel,
    obterProgressoLevel,
    processarGanhoExp,
    adicionarExpJogadorFirebase
};
