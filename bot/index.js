const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const NUMERO_BOT = "5511943566512";

// ======================================================
// 1. SERVIDOR WEB + AUTO-PING (RENDER)
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

app.get('/', (req, res) => {
    res.send('⚔️ Bot Grand Line RPG Online na Render!');
});

app.listen(PORT, () => {

    console.log(`[Web] Servidor ativo na porta ${PORT}`);

    if (RENDER_URL) {

        setInterval(async () => {

            try {

                await axios.get(RENDER_URL);

                console.log('[Auto-Ping] Bot mantido acordado.');

            } catch (err) {

                console.error(
                    '[Auto-Ping] Erro:',
                    err.message
                );

            }

        }, 10 * 60 * 1000);
    }
});

// ======================================================
// 2. CONEXÃO COM FIREBASE
// ======================================================

try {

    let serviceAccount;

    if (process.env.FIREBASE_KEY) {

        serviceAccount =
            typeof process.env.FIREBASE_KEY === 'string'
                ? JSON.parse(process.env.FIREBASE_KEY)
                : process.env.FIREBASE_KEY;

    } else {

        serviceAccount = require('./firebase-key.json');
    }

    // Corrige private_key
    if (serviceAccount && serviceAccount.private_key) {

        serviceAccount.private_key =
            serviceAccount.private_key
                .replace(/\\n/g, '\n')
                .replace(/^"|"$/g, '');
    }

    // Inicializa Firebase apenas uma vez
    if (!admin.apps.length) {

        admin.initializeApp({

            credential: admin.credential.cert(
                serviceAccount
            ),

            databaseURL:
                "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
        });
    }

    console.log(
        '✅ [Firebase] SDK Admin conectado com sucesso!'
    );

} catch (e) {

    console.error(
        '❌ [Firebase] Erro ao carregar credenciais:',
        e.message
    );
}

// Referência do banco
const db = admin.apps.length
    ? admin.database()
    : null;


// ======================================================
// 3. CONEXÃO COM WHATSAPP
// ======================================================

async function connectToWhatsApp() {

    try {

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(
            'auth_info_baileys'
        );

        const sock = makeWASocket({

            auth: state,

            printQRInTerminal: false
        });

        // Salva credenciais
        sock.ev.on(
            'creds.update',
            saveCreds
        );


        // ==================================================
        // PAREAMENTO
        // ==================================================

        if (!sock.authState.creds.registered) {

            setTimeout(async () => {

                try {

                    const code =
                        await sock.requestPairingCode(
                            NUMERO_BOT
                        );

                    console.log(
                        '\n========================================'
                    );

                    console.log(
                        `🔑 CÓDIGO DE PAREAMENTO: ${code}`
                    );

                    console.log(
                        '========================================\n'
                    );

                } catch (err) {

                    console.error(
                        '[Pareamento] Erro ao solicitar código:',
                        err.message
                    );
                }

            }, 5000);
        }


        // ==================================================
        // STATUS DA CONEXÃO
        // ==================================================

        sock.ev.on(
            'connection.update',
            (update) => {

                const {
                    connection,
                    lastDisconnect
                } = update;


                if (connection === 'close') {

                    const shouldReconnect =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode !==
                        DisconnectReason.loggedOut;

                    console.log(
                        '🔴 Conexão encerrada.'
                    );

                    console.log(
                        '🔄 Reconectar:',
                        shouldReconnect
                    );


                    if (shouldReconnect) {

                        setTimeout(() => {

                            connectToWhatsApp();

                        }, 3000);
                    }


                } else if (connection === 'open') {

                    console.log(
                        '✅ [WhatsApp] Bot conectado e pronto para receber comandos!'
                    );
                }
            }
        );


        // ==================================================
        // RECEBIMENTO DE MENSAGENS
        // ==================================================

        sock.ev.on(
            'messages.upsert',
            async (chatUpdate) => {

                try {

                    if (
                        !chatUpdate.messages ||
                        !chatUpdate.messages[0]
                    ) {
                        return;
                    }


                    const m =
                        chatUpdate.messages[0];


                    // Ignora mensagens do próprio bot
                    if (
                        m.key.fromMe ||
                        !m.message
                    ) {
                        return;
                    }


                    // ==========================================
                    // EXTRAÇÃO DO TEXTO
                    // ==========================================

                    const rawText =
                        m.message.conversation ||

                        m.message
                            .extendedTextMessage
                            ?.text ||

                        m.message
                            .imageMessage
                            ?.caption ||

                        m.message
                            .videoMessage
                            ?.caption ||

                        '';


                    const text =
                        rawText
                            .trim()
                            .toLowerCase();


                    const from =
                        m.key.remoteJid;


                    if (!text) {
                        return;
                    }


                    console.log(
                        `📩 [MSG RECEBIDA]: "${text}" | Remetente: ${from}`
                    );


                    // ==================================================
                    // !PING
                    // ==================================================

                    if (
                        text === '!ping' ||
                        text.startsWith('!ping ')
                    ) {

                        console.log(
                            '➡️ Executando !ping...'
                        );


                        await sock.sendMessage(

                            from,

                            {
                                text:
                                    '🏓 *Pong!* Grand Line RPG no ar.'
                            },

                            {
                                quoted: m
                            }
                        );

                        console.log(
                            '✅ !ping enviado!'
                        );
                    }


                    // ==================================================
                    // !DADO
                    // ==================================================

                    if (
                        text === '!dado' ||
                        text.startsWith('!dado ')
                    ) {

                        console.log(
                            '➡️ Executando !dado...'
                        );


                        const resultado =
                            Math.floor(
                                Math.random() * 100
                            ) + 1;


                        const senderJid =
                            m.key.participant ||
                            from;


                        const senderNumber =
                            senderJid.split('@')[0];


                        const mensagemDado =

                            `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +

                            `👤 *Jogador:* @${senderNumber}\n` +

                            `🎯 *Resultado:* *${resultado}*`;


                        await sock.sendMessage(

                            from,

                            {
                                text: mensagemDado,

                                mentions: [
                                    senderJid
                                ]
                            },

                            {
                                quoted: m
                            }
                        );


                        console.log(
                            `✅ [Dado] Resultado ${resultado} enviado!`
                        );
                    }


                    // ==================================================
                    // !RANK
                    // ==================================================

                    if (
                        text === '!rank' ||
                        text.startsWith('!rank ')
                    ) {

                        console.log(
                            '➡️ Executando !rank...'
                        );


                        // ==============================================
                        // VERIFICA FIREBASE
                        // ==============================================

                        if (!db) {

                            console.log(
                                '❌ Firebase não inicializado.'
                            );


                            await sock.sendMessage(

                                from,

                                {
                                    text:
                                        '⚠️ Firebase não conectado.'
                                },

                                {
                                    quoted: m
                                }
                            );

                            return;
                        }


                        try {

                            console.log(
                                '🔍 Buscando dados em: players'
                            );


                            // ==========================================
                            // BUSCA PLAYERS
                            // ==========================================

                            const snapshot =
                                await db
                                    .ref('players')
                                    .once('value');


                            console.log(
                                '📦 Snapshot recebido.'
                            );


                            console.log(
                                '📌 players existe:',
                                snapshot.exists()
                            );


                            // ==========================================
                            // NENHUM PLAYER
                            // ==========================================

                            if (!snapshot.exists()) {

                                console.log(
                                    '⚠️ Nó "players" está vazio ou não existe.'
                                );


                                await sock.sendMessage(

                                    from,

                                    {
                                        text:
                                            '🏴‍☠️ *LISTA DE JOGADORES*\n\n' +
                                            'Nenhum jogador encontrado no banco de dados.'
                                    },

                                    {
                                        quoted: m
                                    }
                                );

                                return;
                            }


                            // ==========================================
                            // DADOS DOS PLAYERS
                            // ==========================================

                            const playersData =
                                snapshot.val();


                            const uids =
                                Object.keys(
                                    playersData
                                );


                            console.log(
                                `👥 Total de jogadores encontrados: ${uids.length}`
                            );


                            // ==========================================
                            // MONTA RANK
                            // ==========================================

                            let listaTexto =
                                '🏴‍☠️ *LISTA DE JOGADORES* 🏴‍☠️\n\n';


                            let contador = 1;


                            uids.forEach((uid) => {

                                const player =
                                    playersData[uid];


                                // Estrutura:
                                //
                                // players
                                //   └── UID
                                //       └── character
                                //           └── charName

                                const charName =
                                    player
                                        ?.character
                                        ?.charName ||
                                    'Personagem Sem Nome';


                                console.log(
                                    `👤 ${contador}. ${charName} | UID: ${uid}`
                                );


                                listaTexto +=
                                    `${contador}. *${charName}*\n`;


                                contador++;
                            });


                            // ==========================================
                            // ENVIA RANK
                            // ==========================================

                            console.log(
                                '📤 Enviando rank para o WhatsApp...'
                            );


                            await sock.sendMessage(

                                from,

                                {
                                    text: listaTexto
                                },

                                {
                                    quoted: m
                                }
                            );


                            console.log(
                                '✅ [RANK] Rank enviado com sucesso!'
                            );


                        } catch (rankErr) {

                            console.error(
                                '❌ [RANK] Erro ao acessar Firebase:'
                            );

                            console.error(
                                rankErr
                            );


                            await sock.sendMessage(

                                from,

                                {
                                    text:
                                        '❌ *Erro ao acessar o banco de dados.*'
                                },

                                {
                                    quoted: m
                                }
                            );
                        }
                    }

                } catch (err) {

                    console.error(
                        '❌ Erro no processamento da mensagem:'
                    );

                    console.error(err);
                }
            }
        );

    } catch (err) {

        console.error(
            '❌ Erro ao iniciar WhatsApp:',
            err
        );

        // Tenta conectar novamente
        setTimeout(() => {

            connectToWhatsApp();

        }, 5000);
    }
}


// ======================================================
// INICIA O BOT
// ======================================================

connectToWhatsApp();
