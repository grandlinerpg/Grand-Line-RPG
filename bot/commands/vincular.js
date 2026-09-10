const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

async function handleVincularCommands(sock, m, text, from) {
    if (text.startsWith('!vincular')) {
        const args = text.split(' ').slice(1);
        const input = args.join(' ').trim();

        if (!input) {
            const msgAjuda = `❌ *Uso incorreto do comando!*\n\n` +
                             `📌 *Formas de uso:*\n` +
                             `• \`!vincular <ID_DO_PERSONAGEM>\`\n` +
                             `• \`!vincular <NOME_DO_PERSONAGEM>\`\n\n` +
                             `💡 *Exemplo:* \`!vincular PER12345\` ou \`!vincular Luffy\``;
            await sock.sendMessage(from, { text: msgAjuda }, { quoted: m });
            return true;
        }

        // Verifica se a flag de forçar sobrescrita foi enviada
        const forcar = input.endsWith('-f');
        const buscaTermo = forcar ? input.replace('-f', '').trim().toLowerCase() : input.toLowerCase();

        try {
            const playersRes = await axios.get(`${FIREBASE_URL}/players.json`);
            const playersData = playersRes.data || {};

            // 1. Tenta encontrar a chave/UID exata ou por correspondência de nome
            let targetUid = Object.keys(playersData).find(uid => uid.toLowerCase() === buscaTermo);

            if (!targetUid) {
                targetUid = Object.keys(playersData).find(uid => {
                    const charName = playersData[uid]?.character?.charName || playersData[uid]?.nome || '';
                    return charName.toLowerCase() === buscaTermo;
                });
            }

            if (!targetUid) {
                await sock.sendMessage(from, { text: `❌ *Personagem não encontrado!* Nenhum registro coincide com "*${buscaTermo}*".` }, { quoted: m });
                return true;
            }

            const playerData = playersData[targetUid];
            const nomeChar = playerData?.character?.charName || playerData?.nome || 'Combatente';

            // 2. Extrai os dados do remetente da mensagem
            const rawSender = m.key.participant || m.key.remoteJid || '';
            const numeroLimpo = obterJidEfetivo(m, from);
            const lidFormatado = rawSender.includes('@lid') 
                ? rawSender.split('@')[0].trim() 
                : numeroLimpo;

            // 3. Trava de segurança: verifica se o personagem já tem número vinculado
            const numExistente = playerData?.number?.n;
            if (numExistente && String(numExistente).trim() !== '' && String(numExistente) !== numeroLimpo && !forcar) {
                const msgTrava = `⚠️ *ESTA FICHA JÁ POSSUI UM NÚMERO VINCULADO!*\n\n` +
                                 `👤 *Personagem:* ${nomeChar}\n` +
                                 `📱 *Registrado:* \`${numExistente}\`\n\n` +
                                 `Caso esta ficha seja sua e deseje sobrescrever, use:\n` +
                                 `\`!vincular ${targetUid} -f\``;
                await sock.sendMessage(from, { text: msgTrava }, { quoted: m });
                return true;
            }

            // 4. Salva as informações de número no Firebase
            await axios.patch(`${FIREBASE_URL}/players/${targetUid}/number.json`, {
                n: numeroLimpo,
                LID: lidFormatado
            });

            const msgSucesso = `✅ *VINCULAÇÃO CONCLUÍDA COM SUCESSO!*\n\n` +
                               `👤 *Personagem:* ${nomeChar}\n` +
                               `🆔 *ID (UID):* \`${targetUid}\`\n` +
                               `📱 *Número (n):* \`${numeroLimpo}\`\n` +
                               `🔑 *LID:* \`${lidFormatado}\``;

            await sock.sendMessage(from, { text: msgSucesso }, { quoted: m });

        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Ocorreu um erro ao tentar vincular os dados no Firebase.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleVincularCommands };
