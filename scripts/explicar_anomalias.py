import json
import math
from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
pasta = raiz / 'resultados' / 'anomalias'
modelo = json.loads((pasta / 'modelo.json').read_text(encoding='utf-8-sig'))
registros = json.loads((pasta / 'teste_original.json').read_text(encoding='utf-8-sig'))
nomes = ['Nota G1', 'Nota G2', 'Faltas', 'Faixa de estudo']
faixas = {1: 'menos de 2 h', 2: '2 a 5 h', 3: '5 a 10 h', 4: 'mais de 10 h'}
pesos = modelo['pesos']
limite = modelo['limites']['autoencoder']
casos = []
for registro in registros:
    if not registro['autoencoder']['sinalizado']:
        continue
    valores = registro['valores']
    x = [(v - e['media']) / e['desvio'] for v, e in zip(valores, modelo['escala'])]
    oculto = [math.tanh(sum(p * v for p, v in zip(linha, x)) + vies)
              for linha, vies in zip(pesos['codificador'], pesos['viesOculto'])]
    saida = [sum(p * v for p, v in zip(linha, oculto)) + vies
             for linha, vies in zip(pesos['decodificador'], pesos['viesSaida'])]
    erros = [(real - reconstruido) ** 2 for real, reconstruido in zip(x, saida)]
    total = sum(erros)
    ordem = sorted(range(4), key=lambda j: erros[j], reverse=True)
    detalhes = []
    for j in ordem:
        reconstruido = saida[j] * modelo['escala'][j]['desvio'] + modelo['escala'][j]['media']
        detalhes.append({'variavel': nomes[j], 'valor': valores[j],
                         'reconstrucao': reconstruido, 'erro_padronizado_quadrado': erros[j],
                         'contribuicao_percentual': 100 * erros[j] / total if total else 0})
    principal = detalhes[0]
    direcao = 'acima' if principal['valor'] > principal['reconstrucao'] else 'abaixo'
    explicacao = (f"{principal['variavel']} {direcao} da reconstrução, com "
                  f"{principal['contribuicao_percentual']:.1f}% do erro total.")
    casos.append({'linha_teste_csv': registro['linha_csv'], 'G1': valores[0], 'G2': valores[1],
                  'faltas': valores[2], 'estudo_semanal': faixas[int(valores[3])],
                  'pontuacao': registro['autoencoder']['pontuacao'], 'limite': limite,
                  'explicacao': explicacao, 'detalhes': detalhes})
casos.sort(key=lambda caso: caso['pontuacao'], reverse=True)
(pasta / 'anomalias_explicadas.json').write_text(json.dumps(casos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
linhas = ['Registros sinalizados para revisão',
          f'Limite de pontuação {limite:.4f}. Identificação pela linha de dados/teste.csv.',
          'A reconstrução descreve o modelo. Valores reconstruídos podem ser fracionários ou ultrapassar faixas originais.',
          'A contribuição informa qual variável aumentou o erro. A causa real exige revisão contextual.', '']
for caso in casos:
    linhas.append(f"Linha {caso['linha_teste_csv']} | G1 {caso['G1']} | G2 {caso['G2']} | "
                  f"Faltas {caso['faltas']} | Estudo {caso['estudo_semanal']} | "
                  f"Pontuação {caso['pontuacao']:.4f} | {caso['explicacao']}")
relatorio = '\n'.join(linhas) + '\n'
(pasta / 'anomalias_explicadas.txt').write_text(relatorio, encoding='utf-8')
print(relatorio)
