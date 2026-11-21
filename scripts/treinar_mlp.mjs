import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MLP } from '../modelo/mlp.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(path.join(raiz, arquivo), 'utf8').replace(/^\uFEFF/, ''));
const arquitetura = lerJson('modelo/arquitetura.json');
const modelo = new MLP(arquitetura);
const classes = arquitetura.classes;
const configuracao = { semente: 42, taxa: 0.01, epocas: 500, paciencia: 60 };
const salvar = (arquivo, dados) => fs.writeFileSync(path.join(raiz, arquivo), JSON.stringify(dados, null, 2) + '\n');

function carregar(parte) {
    const linhas = fs.readFileSync(path.join(raiz, `dados/${parte}_normalizado.csv`), 'utf8')
        .replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    // Os arquivos gerados contêm apenas números e categorias sem vírgulas internas.
    const separar = (linha) => linha.split(',').map((valor) => valor.replace(/^"|"$/g, ''));
    const cabecalho = separar(linhas.shift());
    const indices = arquitetura.entradas.map((nome) => cabecalho.indexOf(nome));
    if (indices.includes(-1)) throw new Error('Colunas de entrada ausentes.');
    const alvo = cabecalho.indexOf(arquitetura.alvo);
    return linhas.map((linha, indice) => {
        const valores = separar(linha);
        const x = indices.map((coluna) => Number(valores[coluna]));
        const y = classes.indexOf(valores[alvo]);
        if (!x.every(Number.isFinite) || y < 0) throw new Error('Registro inválido.');
        return { x, y, linha: indice + 2 };
    });
}

function avaliar(dados) {
    const matriz = classes.map(() => classes.map(() => 0));
    const previsoes = dados.map(({ x, y, linha }) => {
        const resultado = modelo.prever(x);
        const previsto = classes.indexOf(resultado.classe);
        matriz[y][previsto]++;
        return { linha_csv: linha, real: classes[y], previsto: resultado.classe,
            probabilidades: resultado.probabilidades, acerto: y === previsto };
    });
    const porClasse = classes.map((classe, i) => {
        const suporte = matriz[i].reduce((soma, valor) => soma + valor, 0);
        const positivos = matriz.reduce((soma, linha) => soma + linha[i], 0);
        const precisao = positivos ? matriz[i][i] / positivos : 0;
        const recall = suporte ? matriz[i][i] / suporte : 0;
        const f1 = precisao + recall ? 2 * precisao * recall / (precisao + recall) : 0;
        return { classe, suporte, precisao, recall, f1 };
    });
    return { registros: dados.length, acuracia: previsoes.filter((p) => p.acerto).length / dados.length,
        f1_macro: porClasse.reduce((soma, item) => soma + item.f1, 0) / classes.length,
        por_classe: porClasse, matriz_confusao: matriz, previsoes };
}

function atualizar({ x, y }, pesoClasse) {
    const ativacoes = [x];
    for (const camada of modelo.camadas) {
        const anterior = ativacoes.at(-1);
        const somas = camada.pesos.map((pesos, i) => pesos.reduce(
            (soma, peso, j) => soma + peso * anterior[j], camada.vieses[i]));
        let valores;
        if (camada.ativacao === 'relu') {
            valores = somas.map((valor) => Math.max(0, valor));
        } else {
            const maior = Math.max(...somas);
            const exp = somas.map((valor) => Math.exp(valor - maior));
            const total = exp.reduce((soma, valor) => soma + valor, 0);
            valores = exp.map((valor) => valor / total);
        }
        ativacoes.push(valores);
    }
    let delta = ativacoes.at(-1).map((valor, i) => (valor - Number(i === y)) * pesoClasse);
    for (let camadaIndice = modelo.camadas.length - 1; camadaIndice >= 0; camadaIndice--) {
        const camada = modelo.camadas[camadaIndice];
        const anterior = ativacoes[camadaIndice];
        const proximoDelta = anterior.map((valor, j) => {
            const gradiente = camada.pesos.reduce((soma, pesos, i) => soma + pesos[j] * delta[i], 0);
            return valor > 0 ? gradiente : 0;
        });
        camada.pesos.forEach((pesos, i) => {
            pesos.forEach((peso, j) => { pesos[j] -= configuracao.taxa * delta[i] * anterior[j]; });
            camada.vieses[i] -= configuracao.taxa * delta[i];
        });
        delta = proximoDelta;
    }
}

const treino = carregar('treino');
const validacao = carregar('validacao');
const pesosClasses = classes.map((_, i) => treino.length / (classes.length * treino.filter((item) => item.y === i).length));
let estado = configuracao.semente;
let melhor = { f1: -1, epoca: 0 };
const historico = [];
for (let epoca = 1; epoca <= configuracao.epocas; epoca++) {
    const ordem = [...treino];
    for (let i = ordem.length - 1; i > 0; i--) {
        estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
        const j = Math.floor(estado / 4294967296 * (i + 1));
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
    for (const exemplo of ordem) atualizar(exemplo, pesosClasses[exemplo.y]);
    const resultado = avaliar(validacao);
    const perda = treino.reduce((soma, item) => soma + pesosClasses[item.y] * modelo.perda(item.x, classes[item.y]), 0) / treino.length;
    if (!Number.isFinite(perda)) throw new Error('Treinamento divergiu.');
    historico.push({ epoca, perda_treino_ponderada: perda, f1_validacao: resultado.f1_macro });
    if (resultado.f1_macro > melhor.f1) {
        melhor = { f1: resultado.f1_macro, epoca, camadas: structuredClone(modelo.camadas) };
    }
    if (epoca - melhor.epoca >= configuracao.paciencia) break;
}
modelo.camadas = melhor.camadas;
salvar('modelo/pesos_treinados.json', { estado: 'treinado', arquitetura, camadas: modelo.camadas,
    configuracao, pesos_classes: pesosClasses, melhor_epoca: melhor.epoca });
salvar('resultados/historico_mlp.json', historico);
const metricas = {};
for (const parte of ['treino', 'validacao', 'teste']) {
    const resultado = avaliar(carregar(parte));
    salvar(`resultados/mlp_${parte}_previsoes.json`, resultado.previsoes);
    delete resultado.previsoes;
    metricas[parte] = resultado;
}
salvar('resultados/mlp_metricas.json', metricas);
const baseline = lerJson('resultados/baseline_metricas.json').find((item) => item.conjunto === 'teste');
salvar('resultados/comparacao.json', { baseline: { acuracia: baseline.acuracia, f1_macro: baseline.f1_macro },
    mlp: { acuracia: metricas.teste.acuracia, f1_macro: metricas.teste.f1_macro } });
console.log(JSON.stringify({ melhor_epoca: melhor.epoca, epocas_executadas: historico.length,
    baseline: { acuracia: baseline.acuracia, f1_macro: baseline.f1_macro }, teste_mlp: metricas.teste }, null, 2));
