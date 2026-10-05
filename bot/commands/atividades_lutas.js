const axios = require('axios'); 
const { FIREBASE_URL, GRUPOS_ARENA } = require('../index');
const { iniciarEstruturaBatalha } = require('./combates'); 
const { processarGanhoExp, calcularRank } = require('./level');

// Mapeamento auxiliar de emojis de facção
const EMOJIS_FACCAO = {
    'Marinha': '⚓', 
    'Piratas': '🏴‍☠',
    'Exército Revolucionário': '⚔️',
    'Governo Mundial': '⚓',
    'Caçadores de Recompensa': '🎯'
};

// Armazena as sessões de criação
const sessoesCriacao = {};

// Armazena as atividades ativas no grupo
const atividadesAtivas = {};

function obterEmojiFaccao(param, atividade = null) {
    let nomeFaccao = null;

    if (typeof param === 'object' && param !== null) {
        nomeFaccao = param.faccao || param.faction;
    } else if (typeof param === 'string') {
        if (EMOJIS_FACCAO[param]) {
            nomeFaccao = param;
        }
    }

    if (!nomeFaccao && atividade) {
        const idOuNome = (typeof param === 'object' && param !== null) ? (param.lid || param.uid || param.nome) : param;
        
        const atacante = atividade.anunciantes?.find(a => a.lid === idOuNome || a.uid === idOuNome || a.nome === idOuNome);
        if (atacante) {
            nomeFaccao = atacante.faccao || atividade.faccaoCriador;
        } else {
            const defensor = atividade.defensores?.find(d => d.lid === idOuNome || d.uid === idOuNome || d.nome === idOuNome);
            if (defensor) {
                nomeFaccao = defensor.faccao || atividade.faccaoDefensora;
            }
        }
    }

    return EMOJIS_FACCAO[nomeFaccao] || '⚔';
}

function obterHoraAtualUTC3() {
    const agora = new Date();
    let horas = agora.getUTCHours() - 3;
    if (horas < 0) horas += 24;
    const horasStr = String(horas).padStart(2, '0');
    const minutosStr = String(agora.getUTCMinutes()).padStart(2, '0');
    return `${horasStr}:${minutosStr}`;
}

async function obterNomeTerritorio(idIlha) {
    if (idIlha === undefined || idIlha === null || Number(idIlha) === 0) {
        return null;
    }

    try {
        const ilhasRes = await axios.get(`${FIREBASE_URL}/ilhas.json`);
        const ilhasData = ilhasRes.data || {};
        const ilhaObj = ilhasData[idIlha] || ilhasData[String(idIlha)];

        if (ilhaObj && ilhaObj.nome) {
            return `> Local: ${idIlha}. ${ilhaObj.nome}`;
        }
        return `> Local: ${idIlha}`;
    } catch (e) {
        console.error('Erro ao buscar ilhas no Firebase:', e.message);
        return `> Local: ${idIlha}`;
    }
}

// ==========================================
// FUNÇÕES AUXILIARES E LÓGICA DE MATCHMAKING
// ==========================================

async function obterBlocoArenasFormatado(atividade) {
    if (!atividade || !atividade.lutadoresAtivos || atividade.lutadoresAtivos.length === 0) {
        return 'Nenhum combate em andamento no momento.';
    }

    let arenasAtivas = {};
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas.json`);
        arenasAtivas = res.data || {};
    } catch (e) {}

    const blocos = [];

    atividade.lutadoresAtivos.forEach(luta => {
        const arenaJid = luta.arena;
        const indexArena = GRUPOS_ARENA.indexOf(arenaJid) + 1;
        const chaveSemGus = arenaJid.replace('@g.us', '');
        const arenaData = arenasAtivas[chaveSemGus] || arenasAtivas[arenaJid];

        const nomeArena = arenaData?.nomeArena || (indexArena > 0 ? `Campo de Batalha ${indexArena}` : 'Campo de Batalha');
        blocos.push(`${nomeArena}:\n${luta.p1.nome} VS ${luta.p2.nome}`);
    });

    return blocos.join('\n\n');
}

async function encerrarListaEIniciarPartida(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    if (atividade.defensores.length === 0) {
        await sock.sendMessage(from, { text: `⚠️ A atividade *${atividade.nomeAtividade}* foi encerrada sem defensores.` });
        delete atividadesAtivas[from];
        return;
    }

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    atividade.bancoAtacantes = [...atividade.anunciantes];
    atividade.bancoDefensores = [...atividade.defensores];
    atividade.fase = 'selecao';
    atividade.horaInicio = obterHoraAtualUTC3();

    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    const forcaAtacantes = atividade.bancoAtacantes.reduce((acc, curr) => acc + curr.level, 0);
    const forcaDefensores = atividade.bancoDefensores.reduce((acc, curr) => acc + curr.level, 0);

    let atacantesTexto = atividade.bancoAtacantes.map(a => `➔ ${a.nome} (${a.level})`).join('\n');
    let defensoresTexto = atividade.bancoDefensores.map(d => `➔ ${d.nome} (${d.level})`).join('\n');

    // Título idêntico ao painel da lista de atividades
    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador, atividade);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;
    const textoTerritorio = await obterNomeTerritorio(atividade.idIlha);

    let cabecalho = `*${nomeAtividadeMaiusculo}*\n\n`;
    if (textoTerritorio) {
        cabecalho += `${textoTerritorio}\n`;
    }

    const msgInicioConfrontos = `${cabecalho}\n` +
        `${atividade.faccaoCriador}:\n\n${atacantesTexto}\n\n` +
        `> Força: ${forcaAtacantes}\n\n` +
        `${nomeDefesa}:\n\n${defensoresTexto}\n\n` +
        `> Força: ${forcaDefensores}`;

    await sock.sendMessage(from, { text: msgInicioConfrontos });

    await verificarEParearAutomatico(sock, from);
}

async function verificarEParearAutomatico(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    if (atividade.proximoDesafiante) {
        if (atividade.vezSelecao === 'banco_defensor') {
            if (atividade.bancoDefensores.length === 1) {
                const p1 = atividade.proximoDesafiante;
                const p2 = atividade.bancoDefensores.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *${nomeDefesa} só tem 1 opção!* ${p2.nome} foi alocado automaticamente contra ${p1.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
                await enviarRelatorioGrupo(sock, from);
                return;
            } else if (atividade.bancoDefensores.length > 1) {
                await sock.sendMessage(from, { 
                    text: `🏆 Vez do banco da facção *${nomeDefesa}* escolher quem enfrentará *${atividade.proximoDesafiante.nome}* usando *!escolher @jogador*.` 
                });
                return;
            }
        } else if (atividade.vezSelecao === 'banco_atacante') {
            if (atividade.bancoAtacantes.length === 1) {
                const p2 = atividade.proximoDesafiante;
                const p1 = atividade.bancoAtacantes.shift();
                atividade.proximoDesafiante = null;

                await sock.sendMessage(from, { text: `⚡ *${atividade.faccaoCriador} só tem 1 opção!* ${p1.nome} foi alocado automaticamente contra ${p2.nome}!` });
                await alocarLutaNaArena(sock, from, p1, p2);
                await enviarRelatorioGrupo(sock, from);
                return;
            } else if (atividade.bancoAtacantes.length > 1) {
                await sock.sendMessage(from, { 
                    text: `🏆 Vez do banco de *${atividade.faccaoCriador}* escolher quem enfrentará *${atividade.proximoDesafiante.nome}* usando *!escolher @jogador*.` 
                });
                return;
            }
        }
    }

    if (atividade.bancoAtacantes.length === 1 && atividade.bancoDefensores.length === 1) {
        const p1 = atividade.bancoAtacantes.shift();
        const p2 = atividade.bancoDefensores.shift();
        
        await sock.sendMessage(from, { text: `⚡ *Resta apenas 1 combatente de cada lado!* Pareamento automático: ${p1.nome} VS ${p2.nome}` });
        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
    } else if (atividade.bancoAtacantes.length > 0 && atividade.bancoDefensores.length > 0) {
        if (atividade.vezSelecao === 'atacante' && atividade.bancoDefensores.length === 1) {
            const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
            const p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
            const p2 = atividade.bancoDefensores.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 defensor da facção ${nomeDefesa}!* ${p2.nome} foi pareado automaticamente contra ${p1.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await enviarRelatorioGrupo(sock, from);
            await verificarEParearAutomatico(sock, from);
        } else if (atividade.vezSelecao === 'defensor' && atividade.bancoAtacantes.length === 1) {
            const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
            const p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
            const p1 = atividade.bancoAtacantes.shift();

            await sock.sendMessage(from, { text: `⚡ *Restou apenas 1 atacante da facção ${atividade.faccaoCriador}!* ${p1.nome} foi pareado automaticamente contra ${p2.nome}.` });
            await alocarLutaNaArena(sock, from, p1, p2);
            await enviarRelatorioGrupo(sock, from);
            await verificarEParearAutomatico(sock, from);
        } else {
            let faccaoVez = atividade.vezSelecao === 'atacante' ? atividade.faccaoCriador : nomeDefesa;
            let faccaoAlvo = atividade.vezSelecao === 'atacante' ? nomeDefesa : atividade.faccaoCriador;

            await sock.sendMessage(from, { 
                text: `⚔️️ Vez da facção *${faccaoVez}* escolher o combate!\nUse *!escolher @jogador* marcando um adversário de *${faccaoAlvo}*.` 
            });
        }
    }
}

async function processarEscolhaLutador(sock, from, targetId) {
    const atividade = atividadesAtivas[from];
    if (!atividade || atividade.fase !== 'selecao') return;

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    let p1, p2;

    if (atividade.vezSelecao === 'atacante') {
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId || d.uid === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco da defesa!' });
            return;
        }

        const randAtqIdx = Math.floor(Math.random() * atividade.bancoAtacantes.length);
        p1 = atividade.bancoAtacantes.splice(randAtqIdx, 1)[0];
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];

        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
        atividade.vezSelecao = 'defensor';
        await verificarEParearAutomatico(sock, from);

    } else if (atividade.vezSelecao === 'defensor') {
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId || a.uid === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está no banco dos atacantes!' });
            return;
        }

        const randDefIdx = Math.floor(Math.random() * atividade.bancoDefensores.length);
        p2 = atividade.bancoDefensores.splice(randDefIdx, 1)[0];
        p1 = atividade.bancoAtacantes.shift();

        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
        atividade.vezSelecao = 'atacante';
        await verificarEParearAutomatico(sock, from);

    } else if (atividade.vezSelecao === 'banco_defensor') {
        const idxDef = atividade.bancoDefensores.findIndex(d => d.lid === targetId || d.numero === targetId || d.uid === targetId);
        if (idxDef === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco da defesa!' });
            return;
        }

        p1 = atividade.proximoDesafiante;
        p2 = atividade.bancoDefensores.splice(idxDef, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);

    } else if (atividade.vezSelecao === 'banco_atacante') {
        const idxAtq = atividade.bancoAtacantes.findIndex(a => a.lid === targetId || a.numero === targetId || a.uid === targetId);
        if (idxAtq === -1) {
            await sock.sendMessage(from, { text: '❌ O jogador informado não está disponível no banco atacante!' });
            return;
        }

        p2 = atividade.proximoDesafiante;
        p1 = atividade.bancoAtacantes.splice(idxAtq, 1)[0];
        atividade.proximoDesafiante = null;

        await alocarLutaNaArena(sock, from, p1, p2);
        await enviarRelatorioGrupo(sock, from);
    }
}

async function alocarLutaNaArena(sock, grupoOrigem, p1, p2) {
    const atividade = atividadesAtivas[grupoOrigem];
    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];

    let arenasAtivas = {};
    try {
        const res = await axios.get(`${FIREBASE_URL}/arenas_ativas.json`);
        arenasAtivas = res.data || {};
    } catch (e) {}

    const arenaDisponivelJid = GRUPOS_ARENA.find(arenaJid => {
        const chaveSemGus = arenaJid.replace('@g.us', '');
        const arenaRemote = arenasAtivas[chaveSemGus] || arenasAtivas[arenaJid];
        
        const ocupadaNoFirebase = arenaRemote && arenaRemote.fase !== 'aguardando';

        return !ocupadaNoFirebase;
    });

    if (!arenaDisponivelJid) {
        await sock.sendMessage(grupoOrigem, { text: '⚠️ Todas as arenas estão ocupadas no momento! Aguardando vaga...' });
        return false;
    }

    const chaveGrupo = arenaDisponivelJid.replace('@g.us', '');
    const indexArena = GRUPOS_ARENA.indexOf(arenaDisponivelJid) + 1;
    const arenaRemote = arenasAtivas[chaveGrupo] || {};

    const dadosBatalhaBase = iniciarEstruturaBatalha(arenaDisponivelJid, p1, p2, 'ATIVIDADE', sock);
    
    const dadosBatalha = {
        ...arenaRemote,
        ...dadosBatalhaBase,
        numeroArena: arenaRemote.numeroArena || (indexArena > 0 ? indexArena : 1),
        nomeArena: arenaRemote.nomeArena || `Campo de Batalha ${indexArena > 0 ? indexArena : 1}`,
        fase: 'apresentacao',
        grupoOrigemAtividade: grupoOrigem
    };

    const dadosParaSalvar = { ...dadosBatalha };
    delete dadosParaSalvar.sock;
    delete dadosParaSalvar.timerApresentacao;
    delete dadosParaSalvar.timerTurno;

    try {
        await axios.put(`${FIREBASE_URL}/arenas_ativas/${chaveGrupo}.json`, dadosParaSalvar);
    } catch (e) {
        console.error('Erro ao salvar arena da atividade no Firebase:', e.message);
    }

    atividade.lutadoresAtivos.push({ p1, p2, arena: arenaDisponivelJid });

    const msgArena = `⚔️ *COMBATE DE ATIVIDADE NA ${dadosBatalha.nomeArena.toUpperCase()}!* ⚔️\n\n${p1.nome} (${p1.faccao})\n———VS———\n${p2.nome} (${p2.faccao})\n\nApresentem seus cards em *5 minutos* ou digitem *!iniciar*.`;
    await sock.sendMessage(arenaDisponivelJid, { text: msgArena });

    return true;
}

async function registrarResultadoLutaAtividade(sock, grupoOrigem, vencedorObj, perdedorObj) {
    const atividade = atividadesAtivas[grupoOrigem];
    if (!atividade) return;

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    atividade.historicoLutas = atividade.historicoLutas || [];
    atividade.derrotados = atividade.derrotados || [];

    atividade.historicoLutas.push({ vencedor: vencedorObj, perdedor: perdedorObj });
    atividade.derrotados.push(perdedorObj);

    atividade.lutadoresAtivos = atividade.lutadoresAtivos.filter(
        l => l.p1.lid !== vencedorObj.lid && l.p2.lid !== vencedorObj.lid
    );

    const ehAtacante = atividade.anunciantes.some(a => a.lid === vencedorObj.lid || a.numero === vencedorObj.numero || a.uid === vencedorObj.uid);

    if (ehAtacante) {
        atividade.vitoriasAtacantes = (atividade.vitoriasAtacantes || 0) + 1;
        
        const defensoresEmLuta = atividade.lutadoresAtivos.map(l => l.p2);
        const totalDefensoresVivos = atividade.bancoDefensores.length + defensoresEmLuta.length;

        if (atividade.bancoDefensores.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_defensor';
            await verificarEParearAutomatico(sock, grupoOrigem);
            return;
        } else if (totalDefensoresVivos > 0) {
            if (!atividade.bancoAtacantes.some(a => a.lid === vencedorObj.lid || a.uid === vencedorObj.uid)) {
                atividade.bancoAtacantes.push(vencedorObj);
            }
        } else {
            atividade.proximoDesafiante = vencedorObj;
        }
    } else {
        atividade.vitoriasDefensores = (atividade.vitoriasDefensores || 0) + 1;

        const atacantesEmLuta = atividade.lutadoresAtivos.map(l => l.p1);
        const totalAtacantesVivos = atividade.bancoAtacantes.length + atacantesEmLuta.length;

        if (atividade.bancoAtacantes.length > 0) {
            atividade.proximoDesafiante = vencedorObj;
            atividade.vezSelecao = 'banco_atacante';
            await verificarEParearAutomatico(sock, grupoOrigem);
            return;
        } else if (totalAtacantesVivos > 0) {
            if (!atividade.bancoDefensores.some(d => d.lid === vencedorObj.lid || d.uid === vencedorObj.uid)) {
                atividade.bancoDefensores.push(vencedorObj);
            }
        } else {
            atividade.proximoDesafiante = vencedorObj;
        }
    }

    const semLutasEmAndamento = atividade.lutadoresAtivos.length === 0;
    const atacantesTotalmenteEliminados = atividade.bancoAtacantes.length === 0 && !atividade.lutadoresAtivos.some(l => l.p1);
    const defensoresTotalmenteEliminados = atividade.bancoDefensores.length === 0 && !atividade.lutadoresAtivos.some(l => l.p2);

    if (semLutasEmAndamento && (atacantesTotalmenteEliminados || defensoresTotalmenteEliminados)) {
        await finalizarAtividade(sock, grupoOrigem);
    } else {
        await enviarRelatorioGrupo(sock, grupoOrigem);
    }
}

async function enviarRelatorioGrupo(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    atividade.derrotados = atividade.derrotados || [];
    const horaInicioStr = atividade.horaInicio || '16:30';

    const todosAguardando = [...atividade.bancoAtacantes, ...atividade.bancoDefensores];
    if (atividade.proximoDesafiante) {
        if (!todosAguardando.some(p => p.lid === atividade.proximoDesafiante.lid)) {
            todosAguardando.push(atividade.proximoDesafiante);
        }
    }

    const blocoArenas = await obterBlocoArenasFormatado(atividade);
    
    // Título idêntico ao painel da lista de atividades
    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador, atividade);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;
    const textoTerritorio = await obterNomeTerritorio(atividade.idIlha);

    let cabecalho = `*${nomeAtividadeMaiusculo}*\n\n`;
    if (textoTerritorio) {
        cabecalho += `${textoTerritorio}\n`;
    }
    cabecalho += `> Início: ${horaInicioStr} (BRT)\n`;

    let msgStatus = cabecalho +
        `──────────────────\n` +
        `*LUTAS EM ANDAMENTO:*\n\n` +
        `${blocoArenas}`;

    if (atividade.derrotados.length > 0) {
        const derrotadosTexto = atividade.derrotados.map(d => `➔ ${typeof d === 'object' ? d.nome : d} ${obterEmojiFaccao(d, atividade)}`).join('\n');
        msgStatus += `\n──────────────────\n` +
            `*JOGADORES DERROTADOS:*\n\n` +
            `${derrotadosTexto}`;
    }

    if (todosAguardando.length > 0) {
        const aguardandoTexto = todosAguardando.map(a => `➔ ${a.nome} ${obterEmojiFaccao(a, atividade)}`).join('\n');
        msgStatus += `\n──────────────────\n` +
            `*JOGADORES AGUARDANDO:*\n\n` +
            `${aguardandoTexto}`;
    }

    await sock.sendMessage(from, { text: msgStatus });
}

async function enviarRelatorioFinalSobreviventes(sock, from, sobreviventesLista) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    atividade.derrotados = atividade.derrotados || [];
    const horaInicioStr = atividade.horaInicio || '16:30';

    // Título idêntico ao painel da lista de atividades
    const emojiAtq = obterEmojiFaccao(atividade.faccaoCriador, atividade);
    const nomeAtividadeMaiusculo = `${emojiAtq} ${atividade.nomeAtividade.toUpperCase()} ${emojiAtq}`;
    const textoTerritorio = await obterNomeTerritorio(atividade.idIlha);

    let cabecalho = `*${nomeAtividadeMaiusculo}*\n\n`;
    if (textoTerritorio) {
        cabecalho += `${textoTerritorio}\n`;
    }
    cabecalho += `> Início: ${horaInicioStr} BRT\n`;

    let msgStatusFinal = cabecalho;

    if (sobreviventesLista.length > 0) {
        const sobreviventesTexto = sobreviventesLista.map(s => `➔ ${s.nome} ${obterEmojiFaccao(s, atividade)}`).join('\n');
        msgStatusFinal += `──────────────────\n` +
            `*JOGADORES RESTANTES:*\n\n` +
            `${sobreviventesTexto}`;
    }

    if (atividade.derrotados.length > 0) {
        const derrotadosTexto = atividade.derrotados.map(d => `➔ ${typeof d === 'object' ? d.nome : d} ${obterEmojiFaccao(d, atividade)}`).join('\n');
        if (sobreviventesLista.length > 0) {
            msgStatusFinal += `\n──────────────────\n`;
        } else {
            msgStatusFinal += `──────────────────\n`;
        }
        msgStatusFinal += `*JOGADORES DERROTADOS:*\n\n` +
            `${derrotadosTexto}`;
    }

    await sock.sendMessage(from, { text: msgStatusFinal });
}

async function finalizarAtividade(sock, from) {
    const atividade = atividadesAtivas[from];
    if (!atividade) return;

    atividade.lutadoresAtivos = atividade.lutadoresAtivos || [];
    const nomeDefesa = atividade.faccaoDefensora || 'Defensora';

    const atacantesEmLuta = atividade.lutadoresAtivos.map(l => l.p1);
    const defensoresEmLuta = atividade.lutadoresAtivos.map(l => l.p2);

    const atacantesVivos = [...atividade.bancoAtacantes, ...atacantesEmLuta];
    const defensoresVivos = [...atividade.bancoDefensores, ...defensoresEmLuta];

    if (atividade.proximoDesafiante) {
        const pd = atividade.proximoDesafiante;
        const ehAtacante = atividade.anunciantes.some(a => a.lid === pd.lid || a.numero === pd.numero || a.uid === pd.uid);
        if (ehAtacante) {
            if (!atacantesVivos.some(a => a.lid === pd.lid)) atacantesVivos.push(pd);
        } else {
            if (!defensoresVivos.some(d => d.lid === pd.lid)) defensoresVivos.push(pd);
        }
    }

    let faccaoVencedora = null;
    let jogadoresVencedores = [];

    if (atacantesVivos.length > 0 && defensoresVivos.length === 0) {
        faccaoVencedora = atividade.faccaoCriador;
        jogadoresVencedores = [...atividade.anunciantes];
    } else if (defensoresVivos.length > 0 && atacantesVivos.length === 0) {
        faccaoVencedora = nomeDefesa;
        jogadoresVencedores = [...atividade.defensores];
    }

    // Processamento de escudo e domínio da ilha para atividades tipo 2 e 3
    if (atividade.idIlha && Number(atividade.idIlha) !== 0) {
        try {
            const ilhaRes = await axios.get(`${FIREBASE_URL}/ilhas/${atividade.idIlha}.json`);
            const ilhaDados = ilhaRes.data || {};
            let escudoAtual = Number(ilhaDados.escudo ?? 0);

            if (atividade.tipoAtividade === 2) {
                if (faccaoVencedora === atividade.faccaoCriador) {
                    // Atacante venceu: reduz escudo em 1 (mínimo 0)
                    const novoEscudo = Math.max(0, escudoAtual - 1);
                    await axios.patch(`${FIREBASE_URL}/ilhas/${atividade.idIlha}.json`, { escudo: novoEscudo });
                } else if (faccaoVencedora === nomeDefesa) {
                    // Defensores venceram: aumenta escudo em 1 (máximo 3)
                    const novoEscudo = Math.min(3, escudoAtual + 1);
                    await axios.patch(`${FIREBASE_URL}/ilhas/${atividade.idIlha}.json`, { escudo: novoEscudo });
                }
            } else if (atividade.tipoAtividade === 3) {
                if (faccaoVencedora === atividade.faccaoCriador) {
                    // Atacantes venceram: domínio passa a ser a facção vencedora (ou bando) e escudo fica em 1
                    const novoDominio = (atividade.faccaoCriador === 'Piratas' && atividade.bandoCriador)
                        ? atividade.bandoCriador
                        : atividade.faccaoCriador;

                    await axios.patch(`${FIREBASE_URL}/ilhas/${atividade.idIlha}.json`, {
                        dominio: novoDominio,
                        escudo: 1
                    });
                } else if (faccaoVencedora === nomeDefesa) {
                    // Defensores venceram: ganham 1 ponto de escudo
                    const novoEscudo = Math.min(3, escudoAtual + 1);
                    await axios.patch(`${FIREBASE_URL}/ilhas/${atividade.idIlha}.json`, { escudo: novoEscudo });
                }
            }
        } catch (e) {
            console.error('Erro ao atualizar escudo/domínio da ilha no Firebase:', e.message);
        }
    }

    // Unifica todos os sobreviventes de ambas as facções para o relatório final
    const sobreviventesTodos = [...atacantesVivos, ...defensoresVivos];

    await enviarRelatorioFinalSobreviventes(sock, from, sobreviventesTodos);

    let textoRecompensas = '';

    if (jogadoresVencedores.length > 0) {
        try {
            const faccoesRes = await axios.get(`${FIREBASE_URL}/faccoes.json`);
            const faccoesData = faccoesRes.data || {};

            let recompensaBase = null;

            // Busca as regras de recompensa da atividade no Firebase
            const buscaFaccao = faccaoVencedora || atividade.faccaoCriador;
            const ativsFaccao = faccoesData[buscaFaccao]?.atividades || {};
            let chaveAtividade = Object.keys(ativsFaccao).find(k => 
                k.toLowerCase() === atividade.nomeAtividade.toLowerCase() || 
                (ativsFaccao[k]?.nome && ativsFaccao[k].nome.toLowerCase() === atividade.nomeAtividade.toLowerCase())
            );

            if (chaveAtividade && ativsFaccao[chaveAtividade]) {
                recompensaBase = ativsFaccao[chaveAtividade].recompensa;
            } else {
                for (const f of Object.keys(faccoesData)) {
                    const ativs = faccoesData[f]?.atividades || {};
                    const kFound = Object.keys(ativs).find(k => 
                        k.toLowerCase() === atividade.nomeAtividade.toLowerCase() || 
                        (ativs[k]?.nome && ativs[k].nome.toLowerCase() === atividade.nomeAtividade.toLowerCase())
                    );
                    if (kFound && ativs[kFound]?.recompensa) {
                        recompensaBase = ativs[kFound].recompensa;
                        break;
                    }
                }
            }

            if (recompensaBase) {
                const baseBerries = Number(recompensaBase.dinheiro || recompensaBase.saldo || recompensaBase.berries || 0);
                const baseExp = Number(recompensaBase.exp || 0);

                const playersAllRes = await axios.get(`${FIREBASE_URL}/players.json`);
                const playersAllData = playersAllRes.data || {};

                for (const jogador of jogadoresVencedores) {
                    const targetLid = String(jogador.lid || '').trim();
                    const targetNum = String(jogador.numero || '').trim();

                    const realFirebaseKey = Object.keys(playersAllData).find(key => {
                        const p = playersAllData[key];
                        const pLid = String(p?.number?.LID || '').trim();
                        const pNum = String(p?.number?.n || '').trim();
                        return (targetLid && pLid === targetLid) || (targetNum && pNum === targetNum) || key === jogador.uid;
                    });

                    if (!realFirebaseKey) continue;

                    const berriesGanho = baseBerries;
                    const expGanho = baseExp;

                    const playerData = playersAllData[realFirebaseKey] || {};
                    const playerInfo = playerData.info || {};

                    // Processa ganho de EXP, Level e Rank
                    const { novoExp, novoLevel, novoRank } = processarGanhoExp(playerInfo, expGanho);
                    const saldoAtual = Number(playerInfo.saldo ?? playerData.saldo ?? 0);
                    const novoSaldo = saldoAtual + berriesGanho;

                    // Atualiza o nó info (exp, level, saldo)
                    await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}/info.json`, {
                        exp: novoExp,
                        level: novoLevel,
                        saldo: novoSaldo
                    });

                    // Atualiza o nó character (rank)
                    await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}/character.json`, {
                        rank: novoRank
                    });

                    if (playerData.exp !== undefined || playerData.saldo !== undefined || playerData.level !== undefined) {
                        await axios.patch(`${FIREBASE_URL}/players/${realFirebaseKey}.json`, {
                            exp: novoExp,
                            level: novoLevel,
                            saldo: novoSaldo
                        });
                    }
                }

                textoRecompensas = `\n\n🎁 *Recompensas Distribuídas à Facção Vencedora:*\n💰 Berries: +${baseBerries.toLocaleString('pt-BR')}\n⭐ EXP: +${baseExp.toLocaleString('pt-BR')}`;
            }
        } catch (e) {
            console.error('Erro ao processar e creditar recompensas no Firebase:', e.message);
        }
    }

    const resultadoTexto = faccaoVencedora ? `Facção *${faccaoVencedora}*` : 'Empate!';

    const msgFinal = `🎉 *ATIVIDADE CONCLUÍDA!* 🎉\n\n` +
        `Atividade: *${atividade.nomeAtividade}*\n` +
        `🏆 *VENCEDOR DA ATIVIDADE:* ${resultadoTexto.toUpperCase()}!${textoRecompensas}`;

    await sock.sendMessage(from, { text: msgFinal });
    delete atividadesAtivas[from];
}

module.exports = {
    atividadesAtivas,
    sessoesCriacao,
    obterEmojiFaccao,
    obterNomeTerritorio,
    encerrarListaEIniciarPartida,
    processarEscolhaLutador,
    registrarResultadoLutaAtividade
};
