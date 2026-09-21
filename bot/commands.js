const { handleGeralCommands } = require('./commands/geral');
const { handleCompeticaoCommands } = require('./commands/competicao');
const { handleDesafiosCommands } = require('./commands/desafios');
const { handleAtividadesCommands } = require('./commands/atividades');
const { handleCombatesCommands } = require('./commands/combates');
const { handleVincularCommands } = require('./commands/vincular');

async function handleCommand(sock, m) {
    try {
        if (!m || !m.message) return;

        // Desembrulha a mensagem se for temporária/ephemeral ou view once
        const msgContent = m.message.ephemeralMessage?.message || 
                           m.message.viewOnceMessage?.message || 
                           m.message.viewOnceMessageV2?.message || 
                           m.message;

        // Extrai o texto de qualquer formato possível
        const rawText = msgContent.conversation || 
                        msgContent.extendedTextMessage?.text || 
                        msgContent.imageMessage?.caption || 
                        msgContent.videoMessage?.caption || 
                        msgContent.buttonsResponseMessage?.selectedButtonId || 
                        msgContent.listResponseMessage?.singleSelectReply?.selectedRowId || '';

        const text = rawText.trim().toLowerCase();
        const from = m.key?.remoteJid;

        if (!text || !from) return;

        console.log(`📩 [Mensagem Recebida em ${from}]: "${text}"`);

        // Executa os handlers em ordem
        if (await handleGeralCommands(sock, m, text, from)) return;
        if (await handleCompeticaoCommands(sock, m, text, from)) return;
        if (await handleDesafiosCommands(sock, m, text, from)) return;
        if (await handleAtividadesCommands(sock, m, text, from)) return;
        if (await handleCombatesCommands(sock, m, text, from)) return;
        if (await handleVincularCommands(sock, m, text, from)) return;

    } catch (err) {
        console.error('❌ Erro no handleCommand:', err);
    }
}

module.exports = { handleCommand };
