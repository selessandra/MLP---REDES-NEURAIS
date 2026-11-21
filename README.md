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

## Detecção de anomalias

A adaptação usa um autoencoder 4 → 2 → 4 com G1, G2, faltas e faixa de estudo originais. Execute `node scripts/anomalias.mjs` para treinar e avaliar e `node scripts/verificar_anomalias.mjs` para conferir os cálculos. O protocolo está em documentacao/adaptacao_anomalias.txt. Os resultados e limites estão em resultados/anomalias/.

A análise completa está em resultados/anomalias/analise.txt. O detector empatou com a baseline em dois cenários controlados e ficou abaixo dela no terceiro. Os registros originais não possuem anomalias confirmadas. A implementação local está disponível, e o notebook Colab permanece pendente.

## Google Colab

Abra https://colab.research.google.com/drive/1a6NlCa_BVn8nirYoUpJyn21ACXJiDNtM ou faça upload de notebooks/anomalias_academicas.ipynb. Selecione Executar tudo em um ambiente Python 3 com CPU. O notebook inclui os CSVs das quatro entradas originais e reutiliza o código JavaScript do detector via Node.js. Inclui treinamento, avaliação, gráfico das perdas e verificações numéricas. Os dados incorporados preservam as divisões locais.

Execução conferida no Google Colab em 21/11/2026, com Node.js v22.23.4. Todas as células concluíram, incluindo gráfico e verificações. Foram reproduzidas 104 épocas, seleção da época 44 e os resultados locais. A versão local do notebook contém o código e os dados incorporados. As saídas da execução estão no notebook do Google Drive.

Para detalhar os sinais, execute `python scripts/explicar_anomalias.py` após o treinamento. Os arquivos resultados/anomalias/anomalias_explicadas.json e anomalias_explicadas.txt mostram a linha do teste, entradas, pontuação, limite e contribuições por variável. A contribuição é a parcela do erro quadrático padronizado. A reconstrução e o sinal exigem interpretação contextual. O notebook também apresenta essa tabela.
