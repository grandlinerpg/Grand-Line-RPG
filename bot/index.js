const { default: makeWASocket, DisconnectReason, initAuthCreds, proto } = require('@whiskeysockets/baileys'); 
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

// NÚMERO DO BOT CONFIGURADO:
const NUMERO_BOT = "5511943566512"; 

// 1. SERVIDOR WEB + AUTO-PING (Render 24/7)
const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

app.get('/', (req, res) => res.send('⚔️ Bot Grand Line RPG Online na Render!'));
app.listen(PORT, () => {
    console.log(`[Web] Servidor ativo na porta ${PORT}`);
    if (RENDER_URL) {
        setInterval(async () => {
            try {
                await axios.get(RENDER_URL);
                console.log('[Auto-Ping] Bot mantido acordado.');
            } catch (err) {
                console.error('[Auto-Ping] Erro:', err.message);
            }
        }, 10 * 60 * 1000);
    }
});

// 2. CONEXÃO COM O FIREBASE (REALTIME DATABASE)
try {
    let serviceAccount;

    if (process.env.FIREBASE_KEY) {
        serviceAccount = typeof process.env.FIREBASE_KEY === 'string' 
            ? JSON.parse(process.env.FIREBASE_KEY) 
            : process.env.FIREBASE_KEY;
    } else {
        serviceAccount = require('./firebase-key.json');
    }

    // Tratamento correto de quebras de linha e remoção segura de aspas nas extremidades
    if (serviceAccount && serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/^"|"$/g, '');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://grand-line-rpg-dcda9-default-rtdb.firebaseio.com"
        });
    }

    console.log('✅ [Firebase] SDK Admin conectado com sucesso!');
} catch (e) {
    console.error('❌ [Firebase] Erro ao carregar credenciais:', e.message);
}

const db = admin.apps.length ? admin.database() : null;

// ADAPTADOR DE SESSÃO PERSISTENTE NO FIREBASE
async function useFirebaseAuthState(dbRef) {
    const readData = async (key) => {
        try {
            const snapshot = await dbRef.child(key).once('value');
            return snapshot.exists() ? snapshot.val() : null;
        } catch {
            return null;
        }
    };

    const writeData = async (key, data) => {
        try {
            if (data === null || data === undefined) {
                await dbRef.child(key).remove();
            } else {
                await dbRef.child(key).set(data);
            }
        } catch (e) {
            console.error('❌ Erro ao salvar sessão no Firebase:', e.message);
        }
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(writeData(key, value));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        }
    };
}

// 3. WHATSAPP (BAILEYS VIA SESSÃO PERSISTENTE NO FIREBASE)
async function connectToWhatsApp() {
    if (!db) {
        console.error('❌ Não é possível conectar ao WhatsApp sem conexão com o Firebase.');
        return;
    }

    // Salva a sessão no nó 'whatsapp_session' no Firebase
    const sessionRef = db.ref('whatsapp_session');
    const { state, saveCreds } = await useFirebaseAuthState(sessionRef);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(NUMERO_BOT);
                console.log('\n========================================');
                console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);
                console.log('========================================\n');
            } catch (err) {
                console.error('[Pareamento] Erro ao solicitar código:', err.message);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Conexão encerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ [WhatsApp] Bot conectado e pronto para receber comandos!');
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate.messages || !chatUpdate.messages[0]) return;
            const m = chatUpdate.messages[0];

            if (m.key.fromMe || !m.message) return;

            const rawText = m.message.conversation || 
                            m.message.extendedTextMessage?.text || 
                            m.message.imageMessage?.caption || 
                            m.message.videoMessage?.caption || '';

            const text = rawText.trim().toLowerCase();
            const from = m.key.remoteJid;

            if (!text) return;

            console.log(`📩 [MSG RECEBIDA]: "${text}" | Remetente: ${from}`);

            // COMANDO !PING
            if (text === '!ping' || text.startsWith('!ping ')) {
                console.log('➡️ Executando !ping...');
                await sock.sendMessage(from, { text: '🏓 *Pong!* Grand Line RPG no ar.' }, { quoted: m });
            }

            // COMANDO !DADO (1d100)
            if (text === '!dado' || text.startsWith('!dado ')) {
                console.log('➡️ Executando !dado...');
                const resultado = Math.floor(Math.random() * 100) + 1;
                const senderJid = m.key.participant || from;
                const senderNumber = senderJid.split('@')[0];

                const mensagemDado = `🎲 *ROLAGEM DE DADO (1d100)*\n\n` +
                                     `👤 *Jogador:* @${senderNumber}\n` +
                                     `🎯 *Resultado:* *${resultado}*`;

                await sock.sendMessage(from, { 
                    text: mensagemDado, 
                    mentions: [senderJid] 
                }, { quoted: m });

                console.log(`✅ [Dado] Resultado ${resultado} enviado!`);
            }

            // COMANDO !RANK
            if (text === '!rank' || text.startsWith('!rank ')) {
                console.log('➡️ Executando !rank...');

                if (!db) {
                    console.log('❌ DB (Firebase) não inicializado.');
                    return await sock.sendMessage(from, { text: '⚠️ Firebase não conectado.' }, { quoted: m });
                }

                try {
                    console.log('🔍 Buscando dados no nó "players"...');

                    // Timeout de 8 segundos para não travar a aplicação
                    const promiseTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout de conexão com o Firebase (8s)')), 8000)
                    );

                    const snapshot = await Promise.race([
                        db.ref('players').once('value'),
                        promiseTimeout
                    ]);

                    if (!snapshot.exists()) {
                        console.log('⚠️ Nó "players" retornou nulo.');
                        return await sock.sendMessage(from, { text: '🏴‍☠️ Nenhum jogador encontrado no banco de dados.' }, { quoted: m });
                    }

                    const playersData = snapshot.val();
                    let listaTexto = '🏴‍☠️ *LISTA DE JOGADORES* 🏴‍☠️\n\n';
                    let contador = 1;

                    Object.keys(playersData).forEach(uid => {
                        const player = playersData[uid];
                        const charName = player?.character?.charName || 'Personagem Sem Nome';
                        listaTexto += `${contador}. *${charName}*\n`;
                        contador++;
                    });

                    await sock.sendMessage(from, { text: listaTexto }, { quoted: m });
                    console.log('✅ Comando !rank executado com sucesso!');
                } catch (rankErr) {
                    console.error('❌ Erro na consulta ao Firebase:', rankErr.message);
                    await sock.sendMessage(from, { text: `❌ Erro ao acessar o banco: ${rankErr.message}` }, { quoted: m });
                }
            }
        } catch (err) {
            console.error('❌ Erro no processamento de mensagens:', err);
        }
    });
}

connectToWhatsApp();
