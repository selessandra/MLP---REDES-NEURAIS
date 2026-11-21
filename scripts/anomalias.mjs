import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const campos = ['G1', 'G2', 'absences', 'studytime'];
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'resultados/anomalias');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8').replace(/^\uFEFF/, '');
const gravar = (nome, valor) => fs.writeFileSync(path.join(pasta, nome), JSON.stringify(valor, null, 2) + '\n');

export function carregar(parte) {
    const linhas = ler(`dados/${parte}.csv`).trim().split(/\r?\n/);
    const separar = (linha) => linha.split(',').map((valor) => valor.replace(/^"|"$/g, ''));
    const nomes = separar(linhas.shift());
    const indices = campos.map((campo) => nomes.indexOf(campo));
    if (indices.includes(-1)) throw new Error('Coluna original ausente.');
    return linhas.map((linha, i) => {
        const valores = separar(linha);
        const x = indices.map((indice) => Number(valores[indice]));
        if (!x.every(Number.isFinite)) throw new Error('Entrada inválida.');
        return { linha: i + 2, x };
    });
}

export function ajustarEscala(dados) {
    return campos.map((_, j) => {
        const media = dados.reduce((soma, item) => soma + item.x[j], 0) / dados.length;
        const variancia = dados.reduce((soma, item) => soma + (item.x[j] - media) ** 2, 0) / dados.length;
        return { media, desvio: Math.sqrt(variancia) || 1 };
    });
}

export function padronizar(x, escala) {
    return x.map((valor, j) => (valor - escala[j].media) / escala[j].desvio);
}

export function percentil95(valores) {
    const ordenados = [...valores].sort((a, b) => a - b);
    const posicao = 0.95 * (ordenados.length - 1);
    const i = Math.floor(posicao);
    return ordenados[i] + (posicao - i) * (ordenados[Math.ceil(posicao)] - ordenados[i]);
}

export class Autoencoder {
    constructor() {
        let estado = 42;
        const sortear = () => {
            estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
            return estado / 4294967296;
        };
        this.codificador = Array.from({ length: 2 }, () => campos.map(() => (sortear() - 0.5) * 0.5));
        this.decodificador = campos.map(() => [0, 0].map(() => (sortear() - 0.5) * 0.5));
        this.viesOculto = [0, 0];
        this.viesSaida = campos.map(() => 0);
    }

    reconstruir(x) {
        const oculto = this.codificador.map((pesos, i) => Math.tanh(
            pesos.reduce((soma, peso, j) => soma + peso * x[j], this.viesOculto[i])));
        const saida = this.decodificador.map((pesos, i) => pesos.reduce(
            (soma, peso, j) => soma + peso * oculto[j], this.viesSaida[i]));
        return { oculto, saida };
    }

    pontuar(x) {
        return this.reconstruir(x).saida.reduce((soma, valor, j) => soma + (valor - x[j]) ** 2, 0) / x.length;
    }

    atualizar(x, taxa) {
        const { oculto, saida } = this.reconstruir(x);
        const deltaSaida = saida.map((valor, j) => 2 * (valor - x[j]) / x.length);
        const deltaOculto = oculto.map((valor, j) => (1 - valor ** 2) * this.decodificador.reduce(
            (soma, pesos, i) => soma + pesos[j] * deltaSaida[i], 0));
        this.decodificador.forEach((pesos, i) => {
            pesos.forEach((_, j) => { pesos[j] -= taxa * deltaSaida[i] * oculto[j]; });
            this.viesSaida[i] -= taxa * deltaSaida[i];
        });
        this.codificador.forEach((pesos, i) => {
            pesos.forEach((_, j) => { pesos[j] -= taxa * deltaOculto[i] * x[j]; });
            this.viesOculto[i] -= taxa * deltaOculto[i];
        });
    }
}

export const cenarios = [
    { nome: 'queda_notas', elegivel: ([g1, g2]) => g1 >= 12 && g2 >= 10,
        alterar: ([g1, , faltas, estudo]) => [g1, 0, faltas, estudo] },
    { nome: 'faltas_notas_altas', elegivel: ([g1, g2, faltas]) => g1 >= 15 && g2 >= 15 && faltas <= 10,
        alterar: ([g1, g2, , estudo]) => [g1, g2, 30, estudo] },
    { nome: 'estudo_notas_baixas', elegivel: ([g1, g2, , estudo]) => g1 <= 9 && g2 <= 9 && estudo <= 2,
        alterar: ([g1, g2, faltas]) => [g1, g2, faltas, 4] }
];

export function executar() {
    fs.mkdirSync(pasta, { recursive: true });
    const treino = carregar('treino');
    const validacao = carregar('validacao');
    const escala = ajustarEscala(treino);
    const xTreino = treino.map((item) => padronizar(item.x, escala));
    const xValidacao = validacao.map((item) => padronizar(item.x, escala));
    const modelo = new Autoencoder();
    const configuracao = { semente: 42, taxa: 0.005, lote: 1, max_epocas: 1000, paciencia: 60 };
    const perda = (dados) => dados.reduce((soma, x) => soma + modelo.pontuar(x), 0) / dados.length;
    let melhorPerda = Infinity;
    let melhorEpoca = 0;
    let pesos;
    let estado = 42;
    const historico = [];
    const inicio = performance.now();
    for (let epoca = 1; epoca <= configuracao.max_epocas; epoca++) {
        const ordem = [...xTreino];
        for (let i = ordem.length - 1; i > 0; i--) {
            estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
            const j = Math.floor(estado / 4294967296 * (i + 1));
            [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
        }
        for (const x of ordem) modelo.atualizar(x, configuracao.taxa);
        const registro = { epoca, treino: perda(xTreino), validacao: perda(xValidacao) };
        if (!Number.isFinite(registro.validacao)) throw new Error('Treinamento divergiu.');
        historico.push(registro);
        if (registro.validacao < melhorPerda - 1e-8) {
            melhorPerda = registro.validacao;
            melhorEpoca = epoca;
            pesos = structuredClone(modelo);
        }
        if (epoca - melhorEpoca >= configuracao.paciencia) break;
    }
    Object.assign(modelo, pesos);
    const segundos = (performance.now() - inicio) / 1000;
    const metodos = {
        autoencoder: (x) => modelo.pontuar(x),
        baseline: (x) => x.reduce((soma, valor) => soma + valor ** 2, 0) / x.length
    };
    const limites = Object.fromEntries(Object.entries(metodos).map(([nome, pontuar]) =>
        [nome, percentil95(xValidacao.map(pontuar))]));
    // O teste é lido após a seleção dos pesos e dos limites.
    const teste = carregar('teste');
    const originais = teste.map((item) => {
        const x = padronizar(item.x, escala);
        return { linha_csv: item.linha, valores: item.x,
            ...Object.fromEntries(Object.entries(metodos).map(([nome, pontuar]) => {
                const pontuacao = pontuar(x);
                return [nome, { pontuacao, sinalizado: pontuacao > limites[nome] }];
            })) };
    });
    const resultados = cenarios.map((cenario) => {
        const pares = teste.filter((item) => cenario.elegivel(item.x)).map((item) => {
            const alterado = cenario.alterar(item.x);
            return { linha_csv: item.linha, original: item.x, alterado,
                ...Object.fromEntries(Object.entries(metodos).map(([nome, pontuar]) => {
                    const antes = pontuar(padronizar(item.x, escala));
                    const depois = pontuar(padronizar(alterado, escala));
                    return [nome, { antes, depois, variacao: depois - antes, detectado: depois > limites[nome] }];
                })) };
        });
        return { cenario: cenario.nome, elegiveis: pares.length,
            resumo: Object.fromEntries(Object.keys(metodos).map((nome) => [nome, {
                ja_sinalizados: pares.filter((p) => p[nome].antes > limites[nome]).length,
                novos_sinais: pares.filter((p) => p[nome].antes <= limites[nome] && p[nome].detectado).length,
                deixaram_de_sinalizar: pares.filter((p) => p[nome].antes > limites[nome] && !p[nome].detectado).length,
                avaliados_antes_abaixo: pares.filter((p) => p[nome].antes <= limites[nome]).length,
                taxa_deteccao: pares.length ? pares.filter((p) => p[nome].detectado).length / pares.length : null,
                variacao_media: pares.length ? pares.reduce((soma, p) => soma + p[nome].variacao, 0) / pares.length : null
            }])), pares };
    });
    const resumo = { campos, arquitetura: [4, 2, 4], configuracao, melhor_epoca: melhorEpoca,
        epocas_executadas: historico.length, segundos_treinamento: segundos, limites,
        registros: { treino: treino.length, validacao: validacao.length, teste: teste.length },
        teste_original: Object.fromEntries(Object.keys(metodos).map((nome) => [nome, {
            sinalizados: originais.filter((item) => item[nome].sinalizado).length,
            proporcao: originais.filter((item) => item[nome].sinalizado).length / teste.length
        }])), cenarios: resultados.map(({ pares, ...item }) => item) };
    gravar('modelo.json', { campos, escala, limites, pesos: modelo });
    gravar('historico.json', historico);
    gravar('teste_original.json', originais);
    gravar('avaliacao_controlada.json', resultados);
    gravar('resumo.json', resumo);
    console.log(JSON.stringify(resumo, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) executar();
