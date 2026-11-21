# Previsão de desempenho acadêmico

O projeto investiga o uso de informações acadêmicas e hábitos de estudo para prever uma situação acadêmica didática e apoiar o acompanhamento de estudantes.

A fonte é Student Performance, de Paulo Cortez, disponibilizada pela UCI, DOI 10.24432/C5TG7T, licença CC BY 4.0. O arquivo de Português possui 649 registros. As colunas originais foram complementadas com simulações identificadas nos nomes. As regras adotadas incluem 120 aulas assumidas, atividades e participação estimadas e horas sorteadas nas faixas de studytime. A situação usa G3 >= 10 para aprovado, 7 a 9 para recuperação e abaixo de 7 para reprovado. Essas hipóteses são didáticas.

## Execução

Use PowerShell 7 e Node.js, sem pacotes externos, na raiz do repositório.

```powershell
pwsh -File scripts/limpar_dados.ps1
pwsh -File scripts/separar_dados.ps1
pwsh -File scripts/normalizar_baseline.ps1
node scripts/treinar_mlp.mjs
```

A limpeza verifica faixas, categorias e consistência das simulações. A divisão estratificada usa semente 42, com 454 registros de treino, 97 de validação e 98 de teste.

Cada aluno é um vetor de 79 números. As variáveis numéricas usam média e desvio do treino. As categorias usam one-hot aprendido no treino, incluindo uma coluna para categoria desconhecida. O alvo é separado das entradas. G3 e as constantes de identificação ficam fora do vetor.

A arquitetura 79 → 16 → 8 → 3 está implementada em modelo/mlp.mjs e justificada em modelo/arquitetura.txt. Usa ReLU nas camadas ocultas e softmax na saída. O treinamento usa entropia cruzada ponderada e retropropagação. A melhor época é selecionada pelo F1 macro na validação.

Os pesos treinados ficam em modelo/pesos_treinados.json. Para carregar e prever um vetor já normalizado, use MLP.carregar(arquivo).prever(vetor), importando MLP de modelo/mlp.mjs. A ordem dos valores está em arquitetura.json. Uma nova entrada deve usar os parâmetros de resultados/normalizacao.json.

Resultados, comparação, acertos, erros e limitações estão em resultados/analise_mlp.txt. O histórico por época está em resultados/historico_mlp.json. As métricas por classe e matrizes de confusão estão em resultados/mlp_metricas.json.

O teste obteve 87,76% de acurácia e F1 macro 0,773. A baseline da classe majoritária obteve 84,69% e 0,306. Os campos simulados, a amostra pequena e a ausência de confirmação temporal limitam a interpretação prática.
