const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// ─────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────
// Imagens dos efeitos (Cloudinary) - mesmo padrão do site (guia/efeito.js): <base>/<efeito.img>.jpg
const CLOUDINARY_EFEITOS = 'https://res.cloudinary.com/djh45admn/image/upload/v1784283109';
const LIMITE_LEGENDA = 1024; // acima disso o texto vai em mensagem separada

const SESSAO_TTL_MS = 5 * 60 * 1000; // 5 minutos para escolher um efeito da lista
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

    // Só uma lista aberta por jogador: fecha a do !infohab/!arsenal para que
    // um "1" digitado agora não seja respondido pela lista errada.
    try {
        require('./infohab').limparSessaoHabilidades(chave);
    } catch (e) { /* infohab ainda não carregado ou sem a função: ignora */ }
}

function renovarSessao(chave) {
    const s = sessoes.get(chave);
    if (s) s.expira = Date.now() + SESSAO_TTL_MS;
}

function limparSessaoEfeitos(chave) {
    sessoes.delete(chave);
}

async function carregarEfeitos() {
    const res = await axios.get(`${FIREBASE_URL}/efeitos.json`);
    return res.data || {};
}

/** Converte efeitos/{id} em uma lista ordenada por nome: [{ efeito, id }] */
function listarTodos(banco) {
    return Object.entries(banco || {})
        .filter(([, ef]) => ef && typeof ef === 'object' && temValor(ef.nome))
        .map(([id, efeito]) => ({ efeito, id }))
        .sort((a, b) => String(a.efeito.nome).localeCompare(String(b.efeito.nome), 'pt-BR'));
}

/** Monta a lista numerada. Os itens já devem estar ordenados. */
function montarLista(titulo, itens) {
    let texto = `${titulo}\n\n`;
    itens.forEach((item, i) => {
        texto += `${i + 1}. ${item.efeito.emoji || '❔'} ${item.efeito.nome}\n`;
    });
    return texto.trimEnd();
}

function listarExtras(efeito) {
    const ex = efeito.extras;
    if (!ex) return [];
    const lista = Array.isArray(ex) ? ex : (typeof ex === 'object' ? Object.values(ex) : [ex]);
    return lista.map(e => String(e || '').trim()).filter(Boolean);
}

function montarDetalhe(item) {
    const { efeito } = item;
    const emoji = efeito.emoji || '❔';

    let texto = `${emoji} *— ${String(efeito.nome).toUpperCase()} —* ${emoji}\n\n`;

    if (temValor(efeito.description)) {
        texto += `_${String(efeito.description).trim()}_\n\n`;
    }

    if (temValor(efeito.funcionamento)) {
        texto += `⚙️ *Funcionamento:*\n${String(efeito.funcionamento).trim()}\n\n`;
    }

    const extras = listarExtras(efeito);
    if (extras.length) {
        texto += `✨ *Extras:*\n`;
        extras.forEach(extra => {
            texto += `➔ ${extra}\n`;
        });
    }

    return texto.trimEnd();
}

function obterUrlImagemEfeito(efeito) {
    const img = String(efeito?.img || '').trim();
    if (!img) return null;
    if (/^https?:\/\//i.test(img)) return img;
    // img pode ser um public_id com pasta (ex.: "Grand Line RPG/Efeitos/xyz"), então codifica o caminho
    const caminho = img.split('/').map(encodeURIComponent).join('/');
    return `${CLOUDINARY_EFEITOS}/${caminho}${/\.[a-z0-9]{3,4}$/i.test(img) ? '' : '.jpg'}`;
}

// Retorna o buffer da imagem ou null (sem imagem cadastrada / falha no download)
async function baixarImagemEfeito(efeito) {
    const url = obterUrlImagemEfeito(efeito);
    if (!url) return null;
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch (e) {
        console.error(`[efeitos] Erro ao baixar imagem do efeito "${efeito.nome}":`, e.message);
        return null;
    }
}

async function enviarDetalhe(sock, from, m, item) {
    const texto = montarDetalhe(item);
    const imagem = await baixarImagemEfeito(item.efeito);

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
 * Resolve a escolha do jogador dentro de uma lista de itens.
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
        normalizar(it.efeito.nome) === termo || normalizar(it.id) === termo
    );
    if (exatos.length) return exatos;

    if (parcial) return itens.filter(it => normalizar(it.efeito.nome).includes(termo));
    return [];
}

const RODAPE_LISTA = `\n\n_Responda com o *número* ou o *nome* do efeito para ver os detalhes. Digite *cancelar* para sair._`;

// ─────────────────────────────────────────────
// !efeitos
// ─────────────────────────────────────────────
async function comandoEfeitos(sock, m, from, chave, termoOriginal) {
    const todos = listarTodos(await carregarEfeitos());

    if (todos.length === 0) {
        await sock.sendMessage(from, { text: '✨ *Nenhum efeito cadastrado.*' }, { quoted: m });
        return;
    }

    const termo = normalizar(termoOriginal);

    // Sem argumentos: lista todos os efeitos
    if (!termo) {
        salvarSessao(chave, todos);
        const titulo = `✨ *— EFEITOS —* ✨`;
        await sock.sendMessage(from, { text: montarLista(titulo, todos) + RODAPE_LISTA }, { quoted: m });
        return;
    }

    // !efeitos <nome ou número>: exato primeiro, depois parcial
    let encontrados = resolverEscolha(termoOriginal, todos, false);
    if (!encontrados.length) encontrados = resolverEscolha(termoOriginal, todos, true);

    if (!encontrados.length) {
        await sock.sendMessage(from, { text: `❌ Nenhum efeito encontrado para "*${termoOriginal.trim()}*".\n\n_Use *!efeitos* para ver a lista completa._` }, { quoted: m });
        return;
    }

    if (encontrados.length === 1) {
        await enviarDetalhe(sock, from, m, encontrados[0]);
        return;
    }

    // Vários resultados: deixa o jogador escolher
    const exibidos = encontrados.slice(0, MAX_RESULTADOS_BUSCA);
    salvarSessao(chave, exibidos);

    const titulo = `✨ *— RESULTADOS PARA "${termoOriginal.trim().toUpperCase()}" —* ✨`;
    let texto = montarLista(titulo, exibidos);
    if (encontrados.length > exibidos.length) {
        texto += `\n\n_...e mais ${encontrados.length - exibidos.length}. Refine a busca para ver o restante._`;
    }
    await sock.sendMessage(from, { text: texto + RODAPE_LISTA }, { quoted: m });
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
async function handleEfeitosCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);
    const chave = `${from}|${senderId}`;

    if (text === '!efeitos' || text.startsWith('!efeitos ')) {
        try {
            await comandoEfeitos(sock, m, from, chave, text.slice('!efeitos'.length));
        } catch (e) {
            console.error('Erro no comando !efeitos:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar os efeitos.' }, { quoted: m });
        }
        return true;
    }

    // Resposta a uma lista aberta (número ou nome exato). Qualquer outra mensagem passa direto.
    const sessao = obterSessao(chave);
    if (sessao && !text.startsWith('!')) {
        if (text === 'cancelar' || text === 'sair') {
            sessoes.delete(chave);
            await sock.sendMessage(from, { text: '❎ Consulta de efeitos encerrada.' }, { quoted: m });
            return true;
        }

        const escolhidos = resolverEscolha(text, sessao.itens, false);
        if (!escolhidos.length) return false;

        try {
            renovarSessao(chave);
            await enviarDetalhe(sock, from, m, escolhidos[0]);
        } catch (e) {
            console.error('Erro ao enviar detalhes do efeito:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar os detalhes do efeito.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleEfeitosCommands, limparSessaoEfeitos };
