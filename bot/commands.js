const { handleGeralCommands } = require('./commands/geral');
const { handleCompeticaoCommands } = require('./commands/competicao');
const { handleDesafiosCommands } = require('./commands/desafios');
const { handleCombatesCommands } = require('./commands/combates');

async function handleCommand(sock, m) {
    const rawText = m.message.conversation || 
                    m.message.extendedTextMessage?.text || 
                    m.message.imageMessage?.caption || 
                    m.message.videoMessage?.caption || '';

    const text = rawText.trim().toLowerCase();
    const from = m.key.remoteJid;

    if (!text) return;

    // Executa em cadeia nos módulos isolados
    if (await handleGeralCommands(sock, m, text, from)) return;
    if (await handleCompeticaoCommands(sock, m, text, from)) return;
    if (await handleDesafiosCommands(sock, m, text, from)) return;
    if (await handleCombatesCommands(sock, m, text, from)) return;
}

module.exports = { handleCommand };
