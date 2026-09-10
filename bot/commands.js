const { handleGeralCommands } = require('./commands/geral');
const { handleCompeticaoCommands } = require('./commands/competicao');
const { handleDesafiosCommands } = require('./commands/desafios');
const { handleCombatesCommands } = require('./commands/combates');
const { handleAtividadesCommands } = require('./commands/atividades');
const { handleVincularCommands } = require('./commands/vincular'); // Importação

async function handleCommand(sock, m) {
    const rawText = m.message.conversation || 
                    m.message.extendedTextMessage?.text || 
                    m.message.imageMessage?.caption || 
                    m.message.videoMessage?.caption || '';

    const text = rawText.trim().toLowerCase();
    const from = m.key.remoteJid;

    if (!text) return;

    if (await handleGeralCommands(sock, m, text, from)) return;
    if (await handleCompeticaoCommands(sock, m, text, from)) return;
    if (await handleDesafiosCommands(sock, m, text, from)) return;
    if (await handleCombatesCommands(sock, m, text, from)) return;
    if (await handleAtividadesCommands(sock, m, text, from)) return;
    if (await handleVincularCommands(sock, m, text, from)) return; // Execução do vínculo
}

module.exports = { handleCommand };
