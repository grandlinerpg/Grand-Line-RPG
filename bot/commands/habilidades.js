const axios = require('axios');
const { FIREBASE_URL, obterJidEfetivo } = require('../index');

// ─────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────
const NOMES_RANK = {
    1: 'Iniciante',
    2: 'Aprendiz',
    3: 'Novato',
    4: 'Intermediário',
    5: 'Veterano'
};

// Mesmos valores padrão usados na ficha do site (perfil/ficha.js)
const ATRIBUTOS_RANK = {
    1: { stm: 100,  atk: 100,  def: 100 },
    2: { stm: 250,  atk: 250,  def: 250 },
    3: { stm: 500,  atk: 500,  def: 500 },
    4: { stm: 1000, atk: 1000, def: 1000 },
    5: { stm: 2000, atk: 2000, def: 2000 }
};

const SESSAO_TTL_MS = 5 * 60 * 1000; // 5 minutos para escolher uma habilidade da lista
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
}

function renovarSessao(chave) {
    const s = sessoes.get(chave);
    if (s) s.expira = Date.now() + SESSAO_TTL_MS;
}

function formatarNumero(valor) {
    const n = Number(valor);
    return isNaN(n) ? String(valor) : n.toLocaleString('pt-BR');
}

function temValor(v) {
    return v !== undefined && v !== null && v !== '';
}

async function carregarBanco() {
    const res = await axios.get(`${FIREBASE_URL}/habilidades.json`);
    return res.data || {};
}

/** Achata habilidades/{categoria}/{sub}/{id} em uma lista de { skill, id, categoria, sub } */
function listarTodas(banco) {
    const todas = [];
    for (const [categoria, subs] of entradasObjeto(banco)) {
        for (const [sub, skills] of entradasObjeto(subs)) {
            for (const [id, skill] of entradasObjeto(skills)) {
                if (skill.nome) todas.push({ skill, id, categoria, sub });
            }
        }
    }
    return todas;
}

/** Habilidades de um estilo/raça, seguindo as heranças (heranca, heranca2, heranca3) */
function listarSubComHeranca(banco, categoria, sub) {
    const resultado = [];
    const visitados = new Set();
    const fila = [sub];

    while (fila.length) {
        const atual = fila.shift();
        if (!atual || visitados.has(atual)) continue;
        visitados.add(atual);

        const dados = banco?.[categoria]?.[atual];
        if (!dados || typeof dados !== 'object') continue;

        for (const [id, skill] of entradasObjeto(dados)) {
            if (skill.nome) resultado.push({ skill, id, categoria, sub: atual });
        }

        ['heranca', 'heranca2', 'heranca3'].forEach(k => {
            if (typeof dados[k] === 'string' && dados[k]) fila.push(dados[k]);
        });
    }
    return resultado;
}

function ordenarPorRank(itens) {
    return [...itens].sort((a, b) => {
        const ra = Number(a.skill.rank) || 99;
        const rb = Number(b.skill.rank) || 99;
        if (ra !== rb) return ra - rb;
        return String(a.skill.nome).localeCompare(String(b.skill.nome), 'pt-BR');
    });
}

/** Monta a lista numerada agrupada por rank. Os itens já devem estar ordenados. */
function montarLista(titulo, itens) {
    let texto = `${titulo}\n`;
    let rankAtual = null;

    itens.forEach((item, i) => {
        const rank = Number(item.skill.rank) || 0;
        if (rank !== rankAtual) {
            rankAtual = rank;
            const nomeRank = NOMES_RANK[rank] ? NOMES_RANK[rank].toUpperCase() : 'SEM RANK';
            texto += `\n*${nomeRank}*\n`;
        }
        texto += `${i + 1}. ${item.skill.nome}\n`;
    });

    return texto.trimEnd();
}

/** Atributos (ATK/DEF/POW) e atributos consumidos (STM), com as mesmas regras da ficha do site */
function calcularAtributos(skill) {
    const base = ATRIBUTOS_RANK[Number(skill.rank)] || {};
    const attrs = skill.atributos || {};
    const valor = (campo) => (temValor(attrs[campo]) ? attrs[campo] : base[campo]);

    const atributos = [];
    if (skill.categoria === 'Ofensivo' && temValor(valor('atk'))) atributos.push(`ATK ${formatarNumero(valor('atk'))}`);
    if (skill.categoria === 'Defensivo' && temValor(valor('def'))) atributos.push(`DEF ${formatarNumero(valor('def'))}`);
    if (temValor(attrs.pow)) atributos.push(`POW ${formatarNumero(attrs.pow)}`);

    const consumidos = [];
    if (temValor(valor('stm'))) consumidos.push(`STM ${formatarNumero(valor('stm'))}`);

    return { atributos, consumidos };
}

function listarIdsEfeitos(skill) {
    const ef = skill.efeito;
    if (!ef) return [];
    if (Array.isArray(ef)) return ef.filter(Boolean);
    if (typeof ef === 'object') return Object.keys(ef);
    return [ef];
}

function montarDetalhe(item, efeitosDb) {
    const { skill } = item;
    const { atributos, consumidos } = calcularAtributos(skill);

    let texto = `📖 *— ${String(skill.nome).toUpperCase()} —* 📖\n\n`;

    if (skill.rank && NOMES_RANK[Number(skill.rank)]) {
        texto += `🏅 *Rank:* ${NOMES_RANK[Number(skill.rank)]}\n`;
    }
    if (atributos.length) texto += `⚔️ *Atributos:* ${atributos.join(' | ')}\n`;
    if (consumidos.length) texto += `💠 *Atributos Consumidos:* ${consumidos.join(' | ')}\n`;
    if (temValor(skill.alvos)) texto += `🎯 *Alvos:* ${skill.alvos}\n`;
    if (temValor(skill.alcance)) texto += `📏 *Alcance:* ${skill.alcance}\n`;
    if (temValor(skill.propriedade)) texto += `🧬 *Propriedade:* ${skill.propriedade}\n`;

    const efeitos = listarIdsEfeitos(skill)
        .map(id => efeitosDb?.[id])
        .filter(Boolean);

    if (efeitos.length) {
        texto += `\n✨ *Efeitos:*\n`;
        efeitos.forEach(ef => {
            texto += `➔ ${ef.emoji || '❔'} *${ef.nome || 'Efeito'}*\n`;
            const detalhe = ef.funcionamento || ef.description;
            if (detalhe) texto += `> ${detalhe}\n`;
        });
    }

    return texto.trimEnd();
}

async function enviarDetalhe(sock, from, m, item) {
    let efeitosDb = {};
    if (listarIdsEfeitos(item.skill).length) {
        try {
            const res = await axios.get(`${FIREBASE_URL}/efeitos.json`);
            efeitosDb = res.data || {};
        } catch (e) {
            console.error('[habilidades] Erro ao buscar efeitos:', e.message);
        }
    }
    await sock.sendMessage(from, { text: montarDetalhe(item, efeitosDb) }, { quoted: m });
}

/**
 * Resolve a escolha do jogador dentro de uma lista de itens.
 * - número: posição na lista
 * - nome exato (sem acento/maiúscula)
 * - se parcial = true, aceita também nome parcial; devolve vários itens se ambíguo
 */
function resolverEscolha(texto, itens, parcial = false) {
    const termo = normalizar(texto);
    if (!termo) return [];

    if (/^\d+$/.test(termo)) {
        const item = itens[Number(termo) - 1];
        return item ? [item] : [];
    }

    const exatos = itens.filter(it => normalizar(it.skill.nome) === termo);
    if (exatos.length) return exatos;

    if (parcial) return itens.filter(it => normalizar(it.skill.nome).includes(termo));
    return [];
}

function buscarJogador(playersData, senderId) {
    const uid = Object.keys(playersData || {}).find(u =>
        String(playersData[u]?.number?.LID || '').trim() === senderId ||
        String(playersData[u]?.number?.n || '').trim() === senderId
    );
    return uid ? { uid, player: playersData[uid] } : null;
}

const RODAPE_LISTA = `\n\n_Responda com o *número* ou o *nome* da habilidade para ver os detalhes. Digite *cancelar* para sair._`;

// ─────────────────────────────────────────────
// !infohab
// ─────────────────────────────────────────────
async function comandoInfohab(sock, m, from, chave, termoOriginal) {
    const banco = await carregarBanco();
    const todas = listarTodas(banco);

    if (todas.length === 0) {
        await sock.sendMessage(from, { text: '📖 *Nenhuma habilidade cadastrada.*' }, { quoted: m });
        return;
    }

    const termo = normalizar(termoOriginal);

    // Sem argumentos: ajuda + grupos disponíveis
    if (!termo) {
        let ajuda = `📖 *— HABILIDADES —* 📖\n\n` +
            `➔ *!infohab <habilidade>* — detalhes de uma habilidade\n` +
            `➔ *!infohab <estilo ou raça>* — lista as habilidades do grupo\n` +
            `➔ *!arsenal* — habilidades que você possui\n`;

        for (const [categoria, subs] of entradasObjeto(banco)) {
            const nomesSubs = entradasObjeto(subs).map(([sub]) => sub);
            if (nomesSubs.length) ajuda += `\n*${categoria}:*\n${nomesSubs.join(', ')}\n`;
        }

        await sock.sendMessage(from, { text: ajuda.trimEnd() }, { quoted: m });
        return;
    }

    // 1. Nome exato de habilidade
    let encontrados = resolverEscolha(termoOriginal, todas, false);

    // 2. Nome de categoria (ex.: "raças") → lista os grupos dela
    if (!encontrados.length) {
        const categoriaKey = Object.keys(banco).find(c => normalizar(c) === termo);
        if (categoriaKey) {
            const nomesSubs = entradasObjeto(banco[categoriaKey]).map(([sub]) => sub);
            await sock.sendMessage(from, {
                text: `📖 *— ${categoriaKey.toUpperCase()} —* 📖\n\n${nomesSubs.join(', ')}\n\n_Use *!infohab <nome>* para ver as habilidades de um deles._`
            }, { quoted: m });
            return;
        }
    }

    // 3. Nome de estilo/raça → lista as habilidades (com heranças)
    if (!encontrados.length) {
        const grupos = [];
        for (const [categoria, subs] of entradasObjeto(banco)) {
            for (const [sub] of entradasObjeto(subs)) {
                if (normalizar(sub) === termo) grupos.push({ categoria, sub });
            }
        }

        if (grupos.length) {
            const itens = ordenarPorRank(
                grupos.flatMap(g => listarSubComHeranca(banco, g.categoria, g.sub))
            );

            if (!itens.length) {
                await sock.sendMessage(from, { text: `📖 *${grupos[0].sub}* ainda não possui habilidades cadastradas.` }, { quoted: m });
                return;
            }

            salvarSessao(chave, itens);
            const titulo = `📖 *— HABILIDADES: ${grupos[0].sub.toUpperCase()} —* 📖`;
            await sock.sendMessage(from, { text: montarLista(titulo, itens) + RODAPE_LISTA }, { quoted: m });
            return;
        }
    }

    // 4. Nome parcial de habilidade
    if (!encontrados.length) {
        encontrados = resolverEscolha(termoOriginal, todas, true);
    }

    if (!encontrados.length) {
        await sock.sendMessage(from, { text: `❌ Nenhuma habilidade, estilo ou raça encontrado para "*${termoOriginal.trim()}*".\n\n_Use *!infohab* para ver os grupos disponíveis._` }, { quoted: m });
        return;
    }

    if (encontrados.length === 1) {
        await enviarDetalhe(sock, from, m, encontrados[0]);
        return;
    }

    // Vários resultados: deixa o jogador escolher
    const ordenados = ordenarPorRank(encontrados);
    const exibidos = ordenados.slice(0, MAX_RESULTADOS_BUSCA);
    salvarSessao(chave, exibidos);

    let titulo = `📖 *— RESULTADOS PARA "${termoOriginal.trim().toUpperCase()}" —* 📖`;
    let texto = montarLista(titulo, exibidos);
    if (ordenados.length > exibidos.length) {
        texto += `\n\n_...e mais ${ordenados.length - exibidos.length}. Refine a busca para ver o restante._`;
    }
    await sock.sendMessage(from, { text: texto + RODAPE_LISTA }, { quoted: m });
}

// ─────────────────────────────────────────────
// !arsenal
// ─────────────────────────────────────────────
async function comandoArsenal(sock, m, from, chave, senderId, termoOriginal) {
    const [playersRes, banco] = await Promise.all([
        axios.get(`${FIREBASE_URL}/players.json`),
        carregarBanco()
    ]);

    const jogador = buscarJogador(playersRes.data, senderId);
    if (!jogador) {
        await sock.sendMessage(from, { text: `❌ *Usuário não cadastrado!* (${senderId})` }, { quoted: m });
        return;
    }

    const nomePersonagem = jogador.player?.character?.charName || jogador.player?.nome || 'Combatente';
    const skillsJogador = jogador.player?.skills || {};

    const itens = [];
    for (const [skillId, ref] of Object.entries(skillsJogador)) {
        const skill = banco?.[ref?.categoria]?.[ref?.sub]?.[skillId];
        if (skill && skill.nome) {
            itens.push({ skill, id: skillId, categoria: ref.categoria, sub: ref.sub });
        }
    }

    if (!itens.length) {
        await sock.sendMessage(from, { text: `🗡️ *${nomePersonagem}* ainda não aprendeu nenhuma habilidade.` }, { quoted: m });
        return;
    }

    const ordenados = ordenarPorRank(itens);

    // !arsenal <nome ou número> → detalhes direto
    if (normalizar(termoOriginal)) {
        const escolhidos = resolverEscolha(termoOriginal, ordenados, true);

        if (!escolhidos.length) {
            await sock.sendMessage(from, { text: `❌ Você não possui nenhuma habilidade correspondente a "*${termoOriginal.trim()}*".` }, { quoted: m });
            return;
        }
        if (escolhidos.length === 1) {
            await enviarDetalhe(sock, from, m, escolhidos[0]);
            return;
        }

        salvarSessao(chave, escolhidos);
        const titulo = `⚔️ *— ARSENAL: RESULTADOS PARA "${termoOriginal.trim().toUpperCase()}" —* ⚔️`;
        await sock.sendMessage(from, { text: montarLista(titulo, escolhidos) + RODAPE_LISTA }, { quoted: m });
        return;
    }

    salvarSessao(chave, ordenados);
    const titulo = `⚔️ *— ARSENAL DE ${nomePersonagem.toUpperCase()} —* ⚔️`;
    await sock.sendMessage(from, { text: montarLista(titulo, ordenados) + RODAPE_LISTA }, { quoted: m });
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
async function handleHabilidadesCommands(sock, m, text, from) {
    const senderId = obterJidEfetivo(m, from);
    const chave = `${from}|${senderId}`;

    if (text === '!infohab' || text.startsWith('!infohab ')) {
        try {
            await comandoInfohab(sock, m, from, chave, text.slice('!infohab'.length));
        } catch (e) {
            console.error('Erro no comando !infohab:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar informações das habilidades.' }, { quoted: m });
        }
        return true;
    }

    if (text === '!arsenal' || text.startsWith('!arsenal ')) {
        try {
            await comandoArsenal(sock, m, from, chave, senderId, text.slice('!arsenal'.length));
        } catch (e) {
            console.error('Erro no comando !arsenal:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao carregar seu arsenal.' }, { quoted: m });
        }
        return true;
    }

    // Resposta a uma lista aberta (número ou nome exato). Qualquer outra mensagem passa direto.
    const sessao = obterSessao(chave);
    if (sessao && !text.startsWith('!')) {
        if (text === 'cancelar' || text === 'sair') {
            sessoes.delete(chave);
            await sock.sendMessage(from, { text: '❎ Consulta de habilidades encerrada.' }, { quoted: m });
            return true;
        }

        const escolhidos = resolverEscolha(text, sessao.itens, false);
        if (!escolhidos.length) return false;

        try {
            renovarSessao(chave);
            await enviarDetalhe(sock, from, m, escolhidos[0]);
        } catch (e) {
            console.error('Erro ao enviar detalhes da habilidade:', e);
            await sock.sendMessage(from, { text: '❌ Erro ao buscar os detalhes da habilidade.' }, { quoted: m });
        }
        return true;
    }

    return false;
}

module.exports = { handleHabilidadesCommands };
