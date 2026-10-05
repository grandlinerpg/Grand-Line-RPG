/**
 * level.js - Módulo de gerenciamento de Level e Experiência
 */

/**
 * Processa o ganho de EXP e calcula o novo level do jogador.
 * A cada 1000 de EXP acumulado, o jogador sobe 1 level.
 * 
 * @param {Object} info - Objeto info do jogador contendo exp e level atuais.
 * @param {number} expGanho - Quantidade de EXP a ser adicionada.
 * @returns {Object} Objeto contendo o novoExp, novoLevel e a quantidade de levels subidos.
 */
function processarGanhoExp(info = {}, expGanho = 0) {
    const expAtual = Number(info.exp ?? 0);
    const levelAtual = Number(info.level ?? 1);

    const novoExp = expAtual + Number(expGanho);
    
    // Regra: Cada 1000 de EXP equivale a 1 Level (mínimo level 1)
    const novoLevel = Math.max(1, Math.floor(novoExp / 1000) + 1);
    const subiuLevel = novoLevel > levelAtual;
    const levelsGanhos = novoLevel - levelAtual;

    return {
        novoExp,
        novoLevel,
        subiuLevel,
        levelsGanhos
    };
}

module.exports = {
    processarGanhoExp
};
