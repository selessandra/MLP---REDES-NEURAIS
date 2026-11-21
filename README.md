# Detecção de anomalias no desempenho acadêmico

Trabalho final da disciplina de Redes Neurais. O projeto utiliza um autoencoder para identificar combinações pouco comuns de notas, faltas e tempo de estudo. Os registros sinalizados podem ajudar professores e coordenadores a selecionar casos para análise individual.

[Abrir o projeto no Google Colab](https://colab.research.google.com/drive/1a6NlCa_BVn8nirYoUpJyn21ACXJiDNtM)

## Integrantes

| Nome | Matrícula |
| --- | --- |
| Alan Sérgio Rodrigues de Carvalho | 01697157 |
| Alessandra Júlia S. Mendonça | 01710330 |
| Alfred Manoel Vicente Silva da Rocha | 01695802 |
| Jhonas Xavier dos Santos Silva | 01694333 |
| Pedro Artur R. F. Nogueira | 01705061 |
| Guilherme De Oliveira Lopes Silva | 01699872 |
| Marcos Emanuel Celestino Tavares | 01718690 |

## Problema e objetivo

Uma queda acentuada de notas ou uma combinação incomum de frequência e desempenho pode justificar uma revisão do histórico do estudante. O objetivo é localizar esses perfis a partir dos padrões encontrados na base.

O sistema recebe quatro informações acadêmicas, calcula uma pontuação e sinaliza os registros que ultrapassam o limite definido na validação. Para cada caso, apresenta os valores informados e a variável que mais contribuiu para o erro de reconstrução. A interpretação do sinal depende do contexto do estudante.

## Dados

Utilizamos o arquivo `student-por.csv`, do conjunto **Student Performance**, com 649 registros de estudantes de duas escolas portuguesas. A fonte reúne informações obtidas por registros escolares e questionários.

| Entrada | Significado |
| --- | --- |
| `G1` | Nota do primeiro período, de 0 a 20 |
| `G2` | Nota do segundo período, de 0 a 20 |
| `absences` | Quantidade de faltas |
| `studytime` | Faixa semanal de estudo, de 1 a 4 |

As faixas de estudo representam menos de 2 horas, de 2 a 5 horas, de 5 a 10 horas e mais de 10 horas por semana.

O detector usa essas quatro colunas originais. Os campos simulados existentes na versão complementada da base ficam fora das entradas, assim como a nota final `G3` e a situação acadêmica derivada dela.

A documentação da origem está disponível na [UCI](https://archive.ics.uci.edu/dataset/320/student+performance). A cópia consultada está no [Kaggle](https://www.kaggle.com/datasets/larsen0966/student-performance-data-set). Referência de Paulo Cortez, 2008, DOI 10.24432/C5TG7T, licença CC BY 4.0.

## Preparação

A limpeza conferiu valores ausentes, duplicados, categorias, faixas numéricas e consistência dos campos complementados. Os 649 registros foram mantidos.

| Divisão | Registros |
| --- | ---: |
| Treino | 454 |
| Validação | 97 |
| Teste | 98 |

As divisões foram feitas com semente 42 e preservadas na adaptação para anomalias. A estratificação por situação acadêmica vem da etapa inicial de classificação.

Cada estudante é representado por um vetor de quatro números, na ordem `G1`, `G2`, `absences` e `studytime`. A padronização subtrai a média e divide pelo desvio de cada variável, calculados somente no treino. Os mesmos parâmetros são aplicados à validação e ao teste.

## Modelo

O autoencoder possui quatro entradas, uma camada oculta com dois neurônios e quatro saídas.

```text
G1, G2, faltas e estudo → 2 neurônios → reconstrução das 4 entradas
```

A camada reduzida foi escolhida para aprender uma representação compacta das relações entre as variáveis. Ela usa tangente hiperbólica (`tanh`), que permite representar relações não lineares. A saída é linear para reconstruir os valores padronizados.

A função de perda é o erro quadrático médio entre a entrada e sua reconstrução. O treinamento usa retropropagação e descida do gradiente estocástica.

| Configuração | Valor |
| --- | --- |
| Taxa de aprendizado | 0,005 |
| Tamanho do lote | 1 |
| Limite de épocas | 1.000 |
| Parada sem melhora na validação | 60 épocas |
| Semente | 42 |
| Épocas executadas | 104 |
| Época selecionada | 44 |

Os pesos da época com menor perda de validação são restaurados. O erro médio de reconstrução também serve como pontuação de anomalia. Um registro é sinalizado quando sua pontuação supera o percentil 95 das pontuações da validação.

## Baseline e avaliação

A baseline calcula a média dos quadrados das quatro entradas padronizadas, como medida de distância ao perfil médio. Ela usa seu próprio limite no percentil 95 da validação. Os dois métodos recebem as mesmas entradas e divisões.

A base não possui rótulos confirmados de anomalia. Por isso, avaliamos as pontuações dos registros originais e a resposta a alterações controladas em cópias do teste. Essas cópias ficam fora do treinamento e da escolha dos limites.

| Cenário controlado | Cópias avaliadas | Autoencoder | Baseline |
| --- | ---: | ---: | ---: |
| Queda acentuada de G2 | 46 | 100% | 100% |
| Muitas faltas com notas altas | 12 | 100% | 100% |
| Maior faixa de estudo com notas baixas | 16 | 62,5% | 81,25% |

Os percentuais representam a proporção de cópias sinalizadas em cada cenário. Um estudante pode aparecer em mais de um cenário, avaliado separadamente.

O autoencoder empatou com a baseline nos dois primeiros cenários e detectou menos alterações no terceiro. O experimento não demonstrou vantagem da rede sobre a solução simples.

Nos registros originais de teste, o autoencoder sinalizou **9 de 98 casos**, e a baseline sinalizou **7 de 98**. Essas quantidades indicam casos para revisão. Acurácia, F1 e falsos positivos de anomalias reais exigiriam rótulos independentes.

### Sinais antes e depois das alterações

Novos sinais contam os registros que estavam abaixo do limite e passaram a superá-lo após a alteração. Os casos que já estavam sinalizados são informados separadamente.

| Cenário | Método | Cópias | Já sinalizados | Novos sinais | Deixaram de sinalizar | Sinalizados depois |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Queda de notas | autoencoder | 46 | 5 | 41 | 0 | 46 |
| Queda de notas | baseline | 46 | 4 | 42 | 0 | 46 |
| Faltas e notas altas | autoencoder | 12 | 0 | 12 | 0 | 12 |
| Faltas e notas altas | baseline | 12 | 4 | 8 | 0 | 12 |
| Estudo e notas baixas | autoencoder | 16 | 4 | 8 | 2 | 10 |
| Estudo e notas baixas | baseline | 16 | 3 | 10 | 0 | 13 |

No cenário de estudo, o autoencoder gerou 8 novos sinais entre 12 casos inicialmente abaixo do limite, ou 66,7%. Outros 2 casos deixaram de ser sinalizados. A baseline gerou 10 novos sinais entre 13 inicialmente abaixo, ou 76,9%. Os denominadores diferem porque cada método possui seu próprio limite.

As taxas de cópias sinalizadas da tabela anterior continuam sendo 62,5% e 81,25% nesse cenário. Cada taxa responde a uma pergunta diferente. A primeira mede quantas cópias ficaram acima do limite, e a segunda mede novas sinalizações entre os casos inicialmente abaixo.

### Alcance da avaliação

Os resultados representam um experimento com alterações controladas. Os nove registros originais sinalizados continuam aguardando revisão independente. Precisão, F1, falsos positivos e acertos ou erros de anomalias reais permanecem sem medição. Uma aplicação com estudantes reais exigiria rótulos externos ao modelo e uma nova avaliação com esses rótulos.

## Retorno e demonstração

O notebook reúne a execução do treinamento, o gráfico das perdas, a comparação com a baseline e uma tabela dos registros sinalizados. A célula Analisar um novo aluno permite preencher G1, G2, faltas e faixa de estudo. Ao executar, retorna o sinal, a pontuação, o limite e as contribuições por variável, usando o modelo já treinado.

Cada caso é identificado pela linha do CSV de teste e mostra notas, faltas, faixa de estudo, pontuação e principal contribuição para o sinal. Por exemplo, o registro da linha 98 apresenta `G1 = 9`, `G2 = 0` e nenhuma falta. A nota G2 responde por 53,4% do erro total de reconstrução.

A contribuição de cada variável é calculada pela sua parcela no erro quadrático padronizado. Ela ajuda a explicar a resposta do modelo. A causa real do perfil exige análise do histórico escolar.

As cópias alteradas também permitem mostrar exemplos detectados e alterações que passaram abaixo do limite. No terceiro cenário, o autoencoder deixou de sinalizar 6 das 16 cópias.

## Como executar

### Google Colab

1. Abra o [notebook no Colab](https://colab.research.google.com/drive/1a6NlCa_BVn8nirYoUpJyn21ACXJiDNtM).
2. Para trabalhar em uma versão própria, salve uma cópia no seu Google Drive.
3. Use um ambiente Python 3 com CPU e selecione **Executar tudo**.
4. Consulte os resultados, o gráfico e a tabela dos casos sinalizados ao final.

O notebook inclui os dados necessários e executa o detector JavaScript com Node.js. Também é possível baixar [anomalias_academicas.ipynb](notebooks/anomalias_academicas.ipynb) deste repositório e fazer upload no Colab.

A execução completa foi conferida no Colab em 21/11/2026. As verificações de gradientes, normalização, percentil e consistência dos resultados foram concluídas. O arquivo versionado inclui as saídas reais das 13 células de código, o gráfico e as tabelas. O tempo registrado pode variar entre execuções.

### Execução local

Requer Node.js 18 ou superior e Python 3 para o relatório explicativo. A rede e a baseline utilizam recursos nativos do Node.js.

Na raiz do repositório, execute na ordem abaixo.

```sh
node scripts/anomalias.mjs
node scripts/verificar_anomalias.mjs
python scripts/explicar_anomalias.py
```

Os arquivos de treino, validação e teste já estão em `dados/`. Para refazer a limpeza e a divisão a partir da base complementada, use PowerShell 7.

```powershell
pwsh -File scripts/limpar_dados.ps1
pwsh -File scripts/separar_dados.ps1
```

## Arquivos principais

| Caminho | Conteúdo |
| --- | --- |
| `notebooks/anomalias_academicas.ipynb` | Notebook com dados e execução completa |
| `scripts/anomalias.mjs` | Autoencoder, baseline, treinamento e avaliação |
| `scripts/verificar_anomalias.mjs` | Verificações numéricas |
| `scripts/explicar_anomalias.py` | Relatório dos casos sinalizados |
| `documentacao/adaptacao_anomalias.txt` | Definição do problema e protocolo de avaliação |
| `resultados/anomalias/resumo.json` | Métricas e configurações |
| `resultados/anomalias/modelo.json` | Pesos, escala e limites |
| `resultados/anomalias/historico.json` | Perdas por época |
| `resultados/anomalias/avaliacao_controlada.json` | Registros originais e cópias alteradas |
| `resultados/anomalias/anomalias_explicadas.txt` | Casos sinalizados com explicações |
| `resultados/anomalias/anomalias_explicadas.json` | Contribuições e reconstruções por variável |

O repositório também mantém os arquivos da etapa inicial de classificação acadêmica. Os resultados da tarefa de anomalias estão em `resultados/anomalias/`.

## Limitações e próximos passos

- A base é pequena e representa o contexto de duas escolas portuguesas.
- As alterações controladas são hipóteses didáticas. Algumas combinações podem ser plausíveis.
- A faixa de estudo é ordinal, e sua padronização aproxima a distância entre categorias.
- A mesma validação seleciona os pesos e calibra o limite, reduzindo a independência entre essas escolhas.
- O período de coleta das faltas exige confirmação antes de usar o detector como alerta antecipado.
- As pontuações exigem revisão contextual. Uma aplicação institucional deve preservar a privacidade e evitar decisões automáticas sobre os estudantes.

A continuidade do trabalho inclui obter uma revisão independente dos casos sinalizados, permitindo medir a utilidade do detector em situações reais.
