import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Autoencoder, carregar, ajustarEscala, padronizar, percentil95, cenarios } from './anomalias.mjs';

const modelo = new Autoencoder();
const x = [0.2, -0.7, 1.1, 0.4];
const original = structuredClone(modelo);
const taxa = 0.0001;
const epsilon = 0.000001;
modelo.atualizar(x, taxa);
for (const campo of ['codificador', 'decodificador', 'viesOculto', 'viesSaida']) {
    const matriz = Array.isArray(original[campo][0]);
    const linhas = matriz ? original[campo] : [original[campo]];
    for (let i = 0; i < linhas.length; i++) {
        for (let j = 0; j < linhas[i].length; j++) {
            const copiar = () => Object.assign(new Autoencoder(), structuredClone(original));
            const mais = copiar();
            const menos = copiar();
            if (matriz) {
                mais[campo][i][j] += epsilon;
                menos[campo][i][j] -= epsilon;
            } else {
                mais[campo][j] += epsilon;
                menos[campo][j] -= epsilon;
            }
            const numerico = (mais.pontuar(x) - menos.pontuar(x)) / (2 * epsilon);
            const atualizado = matriz ? modelo[campo][i][j] : modelo[campo][j];
            const analitico = (linhas[i][j] - atualizado) / taxa;
            assert.ok(Math.abs(numerico - analitico) < 1e-6, `Gradiente incorreto em ${campo}`);
        }
    }
}
assert.equal(percentil95([0, 10, 20, 30, 40]), 38);
const treino = carregar('treino');
const escala = ajustarEscala(treino);
for (let j = 0; j < 4; j++) {
    const valores = treino.map((item) => padronizar(item.x, escala)[j]);
    assert.ok(Math.abs(valores.reduce((a, b) => a + b, 0) / valores.length) < 1e-12);
    assert.ok(Math.abs(valores.reduce((a, b) => a + b * b, 0) / valores.length - 1) < 1e-12);
}
for (const item of carregar('teste')) {
    for (const cenario of cenarios) {
        if (!cenario.elegivel(item.x)) continue;
        const antes = [...item.x];
        const alterado = cenario.alterar(item.x);
        assert.deepEqual(item.x, antes);
        assert.ok(alterado[0] >= 0 && alterado[0] <= 20 && alterado[1] >= 0 && alterado[1] <= 20);
        assert.ok(alterado[2] >= 0 && alterado[2] <= 93 && alterado[3] >= 1 && alterado[3] <= 4);
    }
}
const salvo = JSON.parse(fs.readFileSync(new URL('../resultados/anomalias/modelo.json', import.meta.url), 'utf8'));
assert.deepEqual(salvo.escala, escala);
const recarregado = Object.assign(new Autoencoder(), salvo.pesos);
assert.ok(Number.isFinite(recarregado.pontuar(x)));
console.log('Verificações aprovadas: gradientes, percentil, normalização, alterações e modelo salvo.');
