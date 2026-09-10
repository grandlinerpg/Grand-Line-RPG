const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

async function handleVincularCommands(sock, m, text, from) {
    if (text.startsWith('!vincular')) {
        const args = text.split(' ').slice(1);

        if (args.length === 0) {
            const msgAjuda = `❌ *Uso incorreto do comando!*\n\n` +
                             `📌 *Como usar:*\n` +
                             `• \`!vincular <NOME_DO_PERSONAGEM> <NUMERO>\`\n\n` +
                             `💡 *Exemplo:* \`!vincular Luffy 5511999998888\``;
            await sock.sendMessage(from, { text: msgAjuda }, { quoted: m });
            return true;
        }

        // Verifica a flag de forçar sobrescrita (-f)
        const forcar = args[args.length - 1] === '-f';
        if (forcar) args.pop();

        // Extrai o número informado pelo jogador e o nome do personagem
        const numeroBruto = args.pop() || '';
        const buscaNome = args.join(' ').trim().toLowerCase();

        // Higieniza o número enviado (remove +, -, (), espaços, etc)
        const numeroLimpo = numeroBruto.replace(/\D/g, '');

        if (!buscaNome || !numeroLimpo) {
            const msgErroFormato = `❌ *Informações incompletas!*\n\n` +
                                   `Você precisa informar o *Nome do Personagem* e o seu *Número com DDD*.\n\n` +
                                   `💡 *Exemplo:* \`!vincular Luffy 5511999998888\``;
            await sock.sendMessage(from, { text: msgErroFormato }, { quoted: m });
            return true;
        }

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            // Busca o personagem no Firebase pelo nome
            const targetUid = Object.keys(playersData).find(uid => {
                const charName = playersData[uid]?.character?.charName || playersData[uid]?.nome || '';
                return charName.toLowerCase() === buscaNome;
            });

            if (!targetUid) {
                const msgNaoEncontrado = `❌ *Personagem não encontrado!*\n\n` +
                                         `Nenhum registro coincide com "*${buscaNome}*".\n` +
                                         `⚠️ _Certifique-se de que a ficha já possui um UID válido cadastrado no banco de dados para permitir o vínculo._`;
                await sock.sendMessage(from, { text: msgNaoEncontrado }, { quoted: m });
                return true;
            }

            const playerData = playersData[targetUid];
            const nomeChar = playerData?.character?.charName || playerData?.nome || 'Combatente';

            // Trava de segurança para impedir sobrescrita indevida
            const numExistente = playerData?.number?.n;
            if (numExistente && String(numExistente).trim() !== '' && String(numExistente) !== numeroLimpo && !forcar) {
                const msgTrava = `⚠️ *ESTA FICHA JÁ POSSUI UM NÚMERO VINCULADO!*\n\n` +
                                 `👤 *Personagem:* ${nomeChar}\n` +
                                 `📱 *Registrado:* \`${numExistente}\`\n\n` +
                                 `Caso esta ficha seja sua e deseje sobrescrever, repita com \`-f\` no final:\n` +
                                 `\`!vincular ${nomeChar} ${numeroLimpo} -f\``;
                await sock.sendMessage(from, { text: msgTrava }, { quoted: m });
                return true;
            }

            // Resgata o LID diretamente da mensagem capturada pelo bot
            const lidResgatado = obterJidEfetivo(m, from);

            // Salva no Firebase: LID resgatado pelo bot e n enviado pelo jogador
            await axios.patch(`${FIREBASE_URL}/players/${targetUid}/number.json`, {
                n: numeroLimpo,
                LID: lidResgatado
            });

            const msgSucesso = `✅ *VINCULAÇÃO CONCLUÍDA COM SUCESSO!*\n\n` +
                               `👤 *Personagem:* ${nomeChar}\n` +
                               `📱 *Número (n):* \`${numeroLimpo}\`\n` +
                               `🔑 *LID:* \`${lidResgatado}\``;

            await sock.sendMessage(from, { text: msgSucesso }, { quoted: m });

        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao tentar vincular os dados no Firebase.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleVincularCommands };
