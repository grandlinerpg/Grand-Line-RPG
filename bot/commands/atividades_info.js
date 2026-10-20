const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// ─────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────
// Imagens das atividades (Cloudinary) - mesmo padrão do site (guia/atividade.js): <base>/<atividade.img>.jpg
const CLOUDINARY_ATIVIDADES = 'https://res.cloudinary.com/djh45admn/image/upload/v1784283109';
const LIMITE_LEGENDA = 1024; // acima disso o texto vai em mensagem separada

// Atividades passivas (tipo 1) duram 5 minutos fixos no código (viagem.js: finalizarEGravarAtividadeTipo1).
// Se mudar lá, mude aqui também.
const DURACAO_PASSIVA_MIN = 5;

const SESSAO_TTL_MS = 5 * 60 * 1000; // 5 minutos para escolher uma atividade da lista
const MAX_RESULTADOS_BUSCA = 15;     // limite de resultados quando a busca por nome é ambígua

// Sessões de consulta: { "<chat>|<jogador>": { itens: [...], expira: timestamp } }
const sessoes = new Map();

// ─────────────────────────────────────────────
// FUNÇÕES AUXILIARES
// ─────────────────────────────────────────────
function normalizar(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function temValor(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
}

function formatarNumero(valor) {
    const n = Number(valor);
    return isNaN(n) ? String(valor) : n.toLocaleString('pt-BR');
}

function entradasObjeto(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([, v]) => v && typeof v === 'object');
}

function obterSessao(chave) {
    const s = sessoes.get(chave);
    if (!s) return null;
    if (Date.now() > s.expira) {
        sessoes.delete(chave);
        return null;
    }
    return s;
}

function salvarSessao(chave, itens) {
    sessoes.set(chave, { itens, expira: Date.now() + SESSAO_TTL_MS });

    // Só uma lista aberta por jogador: fecha as do !infohab/!arsenal e do !efeitos para que
    // um "1" digitado agora não seja respondido pela lista errada.
    try { require('./infohab').limparSessaoHabilidades(chave); } catch (e) { /* módulo ausente: ignora */ }
    try { require('./efeitos').limparSessaoEfeitos(chave); } catch (e) { /* módulo ausente: ignora */ }
}

function renovarSessao(chave) {
    const s = sessoes.get(chave);
    if (s) s.expira = Date.now() + SESSAO_TTL_MS;
}

function limparSessaoAtividadesInfo(chave) {
    sessoes.delete(chave);
}

function buscarJogador(playersData, senderId) {
    const uid = Object.keys(playersData || {}).find(u =>
        String(playersData[u]?.number?.LID || '').trim() === senderId ||
        String(playersData[u]?.number?.n || '').trim() === senderId ||
        u === senderId
    );
    return uid ? { uid, player: playersData[uid] } : null;
}

async function carregarFaccoes() {
    const res = await axios.get(`${FIREBASE_URL}/faccoes.json`);
    return res.data || {};
}

/** Facções reais (ignora "Gerais", que guarda só o texto geral de ativas/passivas). */
function listarFaccoes(faccoes) {
    return entradasObjeto(faccoes)
        .filter(([id]) => id !== 'Gerais')
        .map(([id, dados]) => ({ id, nome: dados.nome || id, dados }));
}

/** Acha facção(ões) pelo texto: chave/nome exato, depois parcial ("pirata" → Piratas). */
function resolverFaccao(texto, faccoes) {
    const termo = normalizar(texto);
    if (!termo) return [];

    const todas = listarFaccoes(faccoes);
    const variantes = [termo];
    if (termo.endsWith('s')) variantes.push(termo.slice(0, -1));

    for (const v of variantes) {
        const exatas = todas.filter(f => normalizar(f.id) === v || normalizar(f.nome) === v);
        if (exatas.length) return exatas;
    }
    // Parcial só com 3+ letras, para "c" ou "pi" não casarem com qualquer facção por acaso
    if (termo.length < 3) return [];
    for (const v of variantes) {
        const parciais = todas.filter(f => normalizar(f.id).includes(v) || normalizar(f.nome).includes(v));
        if (parciais.length) return parciais;
    }
    return [];
}

/** Atividades de uma facção: [{ ativ, id, faccaoId, faccaoNome, tipo }] ordenadas por nome. */
function listarAtividades(faccao) {
    return entradasObjeto(faccao.dados.atividades)
        .filter(([, ativ]) => temValor(ativ.nome))
        .map(([id, ativ]) => ({
            ativ,
            id,
            faccaoId: faccao.id,
            faccaoNome: faccao.nome,
            tipo: Number(ativ.tipo || 1) // mesmo padrão do atividades_lista.js: sem tipo = passiva
        }))
        .sort((a, b) => String(a.ativ.nome).localeCompare(String(b.ativ.nome), 'pt-BR'));
}

/** Passivas (tipo 1) primeiro, depois as de combate (tipos 2 e 3). */
function ordenarPassivasECombate(itens) {
    return [
        ...itens.filter(it => it.tipo === 1),
        ...itens.filter(it => it.tipo !== 1)
    ];
}

/** Monta a lista numerada dividida em PASSIVAS e DE COMBATE. Os itens já devem vir ordenados. */
function montarLista(titulo, itens) {
    let texto = `${titulo}\n`;
    let grupoAtual = null;

    itens.forEach((item, i) => {
        const grupo = item.tipo === 1 ? 'PASSIVAS' : 'DE COMBATE';
        if (grupo !== grupoAtual) {
            grupoAtual = grupo;
            texto += `\n*${grupo}*\n`;
        }
        texto += `${i + 1}. ${item.ativ.emoji || '📋'} ${item.ativ.nome}\n`;
    });

    return texto.trimEnd();
}

function descreverTipo(tipo) {
    if (tipo === 1) return 'Passiva';
    if (tipo === 2) return 'Combate — ataque ao território (reduz o escudo da ilha)';
    if (tipo === 3) return 'Combate — conquista de território (só com a ilha sem escudo)';
    return `Tipo ${tipo}`;
}

function montarDetalhe(item) {
    const { ativ, tipo } = item;
    const emoji = ativ.emoji || '📋';

    let texto = `${emoji} *— ${String(ativ.nome).toUpperCase()} —* ${emoji}\n\n`;

    if (temValor(ativ.description)) {
        texto += `_${String(ativ.description).trim()}_\n\n`;
    }

    if (temValor(ativ.funcionamento)) {
        texto += `⚙️ *Funcionamento:*\n${String(ativ.funcionamento).trim()}\n\n`;
    }

    // Recompensa: mesmos campos lidos pelo bot ao creditar (dinheiro/saldo/berries e exp)
    const rec = ativ.recompensa || {};
    const berries = rec.dinheiro ?? rec.saldo ?? rec.berries;
    const quemRecebe = tipo === 1 ? 'cada participante' : 'cada jogador da facção vencedora';

    texto += `> Facção: ${item.faccaoNome}\n`;
    if (tipo === 1) texto += `> Duração: ${DURACAO_PASSIVA_MIN} minutos\n`;
    if (temValor(ativ.jogadores?.min) || temValor(ativ.jogadores?.max)) {
        const min = temValor(ativ.jogadores?.min) ? ativ.jogadores.min : '?';
        const max = temValor(ativ.jogadores?.max) ? ativ.jogadores.max : '?';
        texto += `* *Jogadores:* (${min}) ~ (${max})\n`;
    }
    if (temValor(ativ.limite)) texto += `> Limite: ${ativ.limite} por jogador\n`;
    if (temValor(ativ.nivel)) texto += `* *Nível:* ${ativ.nivel}\n`;
    if (temValor(berries)) texto += `* *Berries:* ฿ ${formatarNumero(berries)} _(${quemRecebe})_\n`;
    if (temValor(rec.exp)) texto += `* *EXP:* ${formatarNumero(rec.exp)} _(${quemRecebe})_\n`;

    const extras = Array.isArray(ativ.extras)
        ? ativ.extras
        : (ativ.extras && typeof ativ.extras === 'object' ? Object.values(ativ.extras) : (ativ.extras ? [ativ.extras] : []));
    const extrasLimpos = extras.map(e => String(e || '').trim()).filter(Boolean);
    if (extrasLimpos.length) {
        texto += `\n📜 *INFORMAÇÕES* 📜\n\n`;
        extrasLimpos.forEach(extra => { texto += `➔ ${extra}\n`; });
    }

    return texto.trimEnd();
}

function obterUrlImagem(ativ) {
    const img = String(ativ?.img || '').trim();
    if (!img) return null;
    if (/^https?:\/\//i.test(img)) return img;
    // img pode ser um public_id com pasta (ex.: "Grand Line RPG/Atividades/xyz"), então codifica o caminho
    const caminho = img.split('/').map(encodeURIComponent).join('/');
    return `${CLOUDINARY_ATIVIDADES}/${caminho}${/\.[a-z0-9]{3,4}$/i.test(img) ? '' : '.jpg'}`;
}

// Retorna o buffer da imagem ou null (sem imagem cadastrada / falha no download)
async function baixarImagem(ativ) {
    const url = obterUrlImagem(ativ);
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) {
        console.error(`[atividades] Erro ao baixar imagem da atividade "${ativ.nome}":`, e.message);
        return null;
    }
}

async function enviarDetalhe(sock, from, m, item) {
    const texto = montarDetalhe(item);
    const imagem = await baixarImagem(item.ativ);

    if (!imagem) {
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    } else if (texto.length <= LIMITE_LEGENDA) {
        await sock.sendMessage(from, { image: imagem, caption: texto }, { quoted: m });
    } else {
        // Texto longo demais para a legenda: imagem primeiro, informações logo depois
        await sock.sendMessage(from, { image: imagem }, { quoted: m });
        await sock.sendMessage(from, { text: texto }, { quoted: m });
    }
}

/**
 * Resolve a escolha do jogador dentro de uma lista de atividades.
 * - número: posição na lista
 * - nome exato (sem acento/maiúscula) ou id exato
 * - se parcial = true, aceita também nome parcial; devolve vários itens se ambíguo
 */
function resolverEscolha(texto, itens, parcial = false) {
    const termo = normalizar(texto);
    if (!termo) return [];

    if (/^\d+$/.test(termo)) {
        const item = itens[Number(termo) - 1];
        return item ? [item] : [];
    }

    const exatos = itens.filter(it =>
        normalizar(it.ativ.nome) === termo || normalizar(it.id) === termo
    );
    if (exatos.length) return exatos;

    if (parcial) return itens.filter(it => normalizar(it.ativ.nome).includes(termo));
    return [];
}

const RODAPE_LISTA = `\n\n_Responda com o *número* ou o *nome* da atividade para ver os detalhes. Digite *cancelar* para sair._`;

async function mostrarListaFaccao(sock, m, from, chave, faccao) {
    const itens = ordenarPassivasECombate(listarAtividades(faccao));

    if (!itens.length) {
        await sock.sendMessage(from, { text: `📋 *${faccao.nome}* ainda não possui atividades cadastradas.` }, { quoted: m });
        return;
    }

    salvarSessao(chave, itens);
    const titulo = `📋 *— ATIVIDADES: ${faccao.nome.toUpperCase()} —* 📋`;
    await sock.sendMessage(from, { text: montarLista(titulo, itens) + RODAPE_LISTA }, { quoted: m });
}

// ─────────────────────────────────────────────
// !atividades / !atividade
// ─────────────────────────────────────────────
async function comandoAtividades(sock, m, from, chave, senderId, termoOriginal) {
    const [playersRes, faccoes] = await Promise.all([
        axios.get(`${FIREBASE_URL}/players.json`),
        carregarFaccoes()
    ]);

    const jogador = buscarJogador(playersRes.data, senderId);
    const termo = normalizar(termoOriginal);

    // !atividades <facção> → lista as atividades daquela facção
    if (termo) {
        const faccoesEncontradas = resolverFaccao(termoOriginal, faccoes);

        if (faccoesEncontradas.length === 1) {
            await mostrarListaFaccao(sock, m, from, chave, faccoesEncontradas[0]);
            return;
        }

        if (faccoesEncontradas.length > 1) {
            const nomes = faccoesEncontradas.map(f => `• ${f.nome}`).join('\n');
            await sock.sendMessage(from, { text: `❓ Mais de uma facção corresponde a "*${termoOriginal.trim()}*":\n\n${nomes}\n\n_Digite o nome completo da facção._` }, { quoted: m });
            return;
        }

        // Não é facção: tenta como nome de atividade da facção do próprio jogador
        const faccaoJogador = jogador ? resolverFaccao(jogador.player?.character?.faction, faccoes)[0] : null;
        if (faccaoJogador) {
            const todas = ordenarPassivasECombate(listarAtividades(faccaoJogador));
            let encontrados = resolverEscolha(termoOriginal, todas, false);
            if (!encontrados.length) encontrados = resolverEscolha(termoOriginal, todas, true);

            if (encontrados.length === 1) {
                await enviarDetalhe(sock, from, m, encontrados[0]);
                return;
            }
            if (encontrados.length > 1) {
                const exibidos = encontrados.slice(0, MAX_RESULTADOS_BUSCA);
                salvarSessao(chave, exibidos);
                const titulo = `📋 *— RESULTADOS PARA "${termoOriginal.trim().toUpperCase()}" —* 📋`;
                let texto = montarLista(titulo, exibidos);
                if (encontrados.length > exibidos.length) {
                    texto += `\n\n_...e mais ${encontrados.length - exibidos.length}. Refine a busca para ver o restante._`;
                }
                await sock.sendMessage(from, { text: texto + RODAPE_LISTA }, { quoted: m });
                return;
            }
        }

        const disponiveis = listarFaccoes(faccoes).map(f => f.nome).join(', ');
        await sock.sendMessage(from, { text: `❌ Nenhuma facção ou atividade encontrada para "*${termoOriginal.trim()}*".\n\n_Facções disponíveis: ${disponiveis || 'nenhuma cadastrada'}._` }, { quoted: m });
        return;
    }

    // !atividades (sem argumentos) → atividades da facção do próprio jogador
    if (!jogador) {
        await sock.sendMessage(from, { text: `❌ *Usuário não cadastrado!* (${senderId})\n\n_Use *!atividades <facção>* para ver as atividades de uma facção._` }, { quoted: m });
        return;
    }

    const nomeFaccaoJogador = jogador.player?.character?.faction;
    if (!nomeFaccaoJogador) {
        await sock.sendMessage(from, { text: '❌ Seu personagem não possui uma facção definida no banco de dados!' }, { quoted: m });
        return;
    }

    const faccaoJogador = resolverFaccao(nomeFaccaoJogador, faccoes)[0];
    if (!faccaoJogador) {
        await sock.sendMessage(from, { text: `❌ Não encontrei atividades cadastradas para a facção *${nomeFaccaoJogador}*.` }, { quoted: m });
        return;
    }

    await mostrarListaFaccao(sock, m, from, chave, faccaoJogador);
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
async function handleAtividadesInfoCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);
    const chave = `${from}|${senderId}`;

    const match = normalizar(text).match(/^!atividades?(?:\s+(.*))?$/);
    if (match) {
        // Usa o texto original (não normalizado) como argumento para preservar o que o jogador digitou
        const argumento = text.replace(/^!atividades?/i, '');
        try {
            await comandoAtividades(sock, m, from, chave, senderId, argumento);
        } catch (e) {
            console.error('Erro no comando !atividades:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar as atividades.' }, { quoted: m });
        }
        return true;
    }

    // Resposta a uma lista aberta (número ou nome exato). Qualquer outra mensagem passa direto.
    const sessao = obterSessao(chave);
    if (sessao && !text.startsWith('!')) {
        if (text === 'cancelar' || text === 'sair') {
            sessoes.delete(chave);
            await sock.sendMessage(from, { text: '❎ Consulta de atividades encerrada.' }, { quoted: m });
            return true;
        }

        const escolhidos = resolverEscolha(text, sessao.itens, false);
        if (!escolhidos.length) return false;

        try {
            renovarSessao(chave);
            await enviarDetalhe(sock, from, m, escolhidos[0]);
        } catch (e) {
            console.error('Erro ao enviar detalhes da atividade:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar os detalhes da atividade.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleAtividadesInfoCommands, limparSessaoAtividadesInfo };
