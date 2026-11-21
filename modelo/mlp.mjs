import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pastaModelo = path.dirname(fileURLToPath(import.meta.url));

export class MLP {
    constructor(arquitetura, semente = 42) {
        this.arquitetura = arquitetura;
        let estado = semente >>> 0;
        const sortear = () => {
            estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
            return (estado + 0.5) / 4294967296;
        };
        let tamanhoAnterior = arquitetura.entradas.length;
        this.camadas = arquitetura.camadas.map((configuracao) => {
            if (configuracao.entradas !== tamanhoAnterior) {
                throw new Error('Dimensões incompatíveis entre camadas.');
            }
            if (!['relu', 'softmax'].includes(configuracao.ativacao)) {
                throw new Error('Ativação desconhecida.');
            }
            const escala = Math.sqrt(2 / configuracao.entradas);
            const pesos = Array.from({ length: configuracao.neuronios }, () =>
                Array.from({ length: configuracao.entradas }, () => {
                    const normal = Math.sqrt(-2 * Math.log(sortear())) *
                        Math.cos(2 * Math.PI * sortear());
                    return normal * escala;
                })
            );
            tamanhoAnterior = configuracao.neuronios;
            return {
                ativacao: configuracao.ativacao,
                pesos,
                vieses: Array(configuracao.neuronios).fill(0)
            };
        });
        if (tamanhoAnterior !== arquitetura.classes.length ||
                this.camadas.at(-1).ativacao !== 'softmax') {
            throw new Error('A saída deve usar softmax e um neurônio por classe.');
        }
    }

    probabilidades(entradas) {
        if (entradas.length !== this.arquitetura.entradas.length ||
                !entradas.every(Number.isFinite)) {
            throw new Error('Informe um vetor numérico finito com as 79 entradas na ordem definida.');
        }
        let valores = entradas;
        for (const camada of this.camadas) {
            const somas = camada.pesos.map((pesos, indice) =>
                pesos.reduce((soma, peso, coluna) => soma + peso * valores[coluna],
                    camada.vieses[indice])
            );
            if (camada.ativacao === 'relu') {
                valores = somas.map((valor) => Math.max(0, valor));
            } else {
                const maior = Math.max(...somas);
                const exponenciais = somas.map((valor) => Math.exp(valor - maior));
                const total = exponenciais.reduce((soma, valor) => soma + valor, 0);
                valores = exponenciais.map((valor) => valor / total);
            }
        }
        return valores;
    }

    prever(entradas) {
        const probabilidades = this.probabilidades(entradas);
        const indice = probabilidades.indexOf(Math.max(...probabilidades));
        return { classe: this.arquitetura.classes[indice], probabilidades };
    }

    perda(entradas, classeCorreta) {
        const indice = this.arquitetura.classes.indexOf(classeCorreta);
        if (indice < 0) {
            throw new Error('Classe desconhecida.');
        }
        return -Math.log(Math.max(this.probabilidades(entradas)[indice], Number.MIN_VALUE));
    }

    static carregar(arquivo) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, ''));
        const modelo = new MLP(dados.arquitetura);
        modelo.camadas = dados.camadas;
        modelo.estado = dados.estado;
        return modelo;
    }

    salvar(destino) {
        fs.writeFileSync(destino, JSON.stringify({
            estado: this.estado ?? 'inicializado',
            arquitetura: this.arquitetura,
            camadas: this.camadas
        }, null, 2) + '\n');
    }
}

// Execução direta cria os pesos iniciais para a arquitetura definida.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const arquitetura = JSON.parse(fs.readFileSync(path.join(pastaModelo, 'arquitetura.json'), 'utf8').replace(/^\uFEFF/, ''));
    const modelo = new MLP(arquitetura);
    modelo.salvar(path.join(pastaModelo, 'pesos_iniciais.json'));
    const quantidade = modelo.camadas.reduce((total, camada) =>
        total + camada.pesos.reduce((soma, linha) => soma + linha.length, 0) + camada.vieses.length, 0);
    console.log(`MLP inicializada com ${quantidade} parâmetros.`);
}
