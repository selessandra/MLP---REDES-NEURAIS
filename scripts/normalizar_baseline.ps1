$ErrorActionPreference = 'Stop'
$cultura = [Globalization.CultureInfo]::InvariantCulture
$pastaDados = Join-Path $PSScriptRoot '../dados'
$pastaResultados = Join-Path $PSScriptRoot '../resultados'
New-Item -ItemType Directory -Path $pastaResultados -Force | Out-Null
$treino = @(Import-Csv (Join-Path $pastaDados 'treino.csv'))
$alvo = 'situacao_regra_didatica'
$ignoradas = @($alvo, 'origem_campos_adicionados', 'total_aulas_assumido')
$parametros = [ordered]@{}

# Aprende media, desvio populacional e categorias somente no treino.
foreach ($coluna in $treino[0].PSObject.Properties.Name) {
    if ($coluna -in $ignoradas) { continue }
    $numero = 0.0
    if ([double]::TryParse($treino[0].PSObject.Properties[$coluna].Value,
            [Globalization.NumberStyles]::Float, $cultura, [ref]$numero)) {
        $valores = @($treino | ForEach-Object {
            [double]::Parse($_.PSObject.Properties[$coluna].Value, $cultura)
        })
        $media = ($valores | Measure-Object -Average).Average
        $variancia = ($valores | ForEach-Object { [Math]::Pow($_ - $media, 2) } |
            Measure-Object -Average).Average
        $desvio = [Math]::Sqrt($variancia)
        if ($desvio -eq 0) { $desvio = 1 }
        $parametros[$coluna] = @{ tipo = 'numerico'; media = $media; desvio = $desvio }
    } else {
        $categorias = @($treino | ForEach-Object { $_.PSObject.Properties[$coluna].Value } |
            Sort-Object -Unique)
        $parametros[$coluna] = @{ tipo = 'categorico'; categorias = $categorias }
    }
}
$parametros | ConvertTo-Json -Depth 5 |
    Set-Content (Join-Path $pastaResultados 'normalizacao.json') -Encoding utf8

$classeMajoritaria = ($treino | Group-Object -Property $alvo |
    Sort-Object @{ Expression = 'Count'; Descending = $true }, Name |
    Select-Object -First 1).Name
$classes = @($treino | Select-Object -ExpandProperty $alvo | Sort-Object -Unique)
$metricas = foreach ($parte in @('treino', 'validacao', 'teste')) {
    $dados = @(Import-Csv (Join-Path $pastaDados "$parte.csv"))
    $normalizados = foreach ($aluno in $dados) {
        $vetor = [ordered]@{}
        foreach ($coluna in $parametros.Keys) {
            $regra = $parametros[$coluna]
            $valor = $aluno.PSObject.Properties[$coluna].Value
            if ($regra.tipo -eq 'numerico') {
                $normalizado = ([double]::Parse($valor, $cultura) - $regra.media) / $regra.desvio
                $vetor[$coluna] = $normalizado.ToString('G17', $cultura)
            } else {
                foreach ($categoria in $regra.categorias) {
                    $vetor["${coluna}__${categoria}"] = [int]($valor -ceq $categoria)
                }
                $vetor["${coluna}__desconhecido"] = [int]($valor -cnotin $regra.categorias)
            }
        }
        $vetor[$alvo] = $aluno.$alvo
        [pscustomobject]$vetor
    }
    $normalizados | Export-Csv (Join-Path $pastaDados "${parte}_normalizado.csv") -NoTypeInformation -Encoding utf8
    $previsoes = @($dados | ForEach-Object {
        [pscustomobject]@{ real = $_.$alvo; previsto = $classeMajoritaria }
    })
    $previsoes | Export-Csv (Join-Path $pastaResultados "baseline_${parte}.csv") -NoTypeInformation -Encoding utf8
    $porClasse = foreach ($classe in $classes) {
        $tp = @($previsoes | Where-Object { $_.real -eq $classe -and $_.previsto -eq $classe }).Count
        $fp = @($previsoes | Where-Object { $_.real -ne $classe -and $_.previsto -eq $classe }).Count
        $fn = @($previsoes | Where-Object { $_.real -eq $classe -and $_.previsto -ne $classe }).Count
        $precisao = if ($tp + $fp -gt 0) { $tp / ($tp + $fp) } else { 0 }
        $recall = if ($tp + $fn -gt 0) { $tp / ($tp + $fn) } else { 0 }
        $f1 = if ($precisao + $recall -gt 0) { 2 * $precisao * $recall / ($precisao + $recall) } else { 0 }
        [pscustomobject]@{ classe = $classe; precisao = $precisao; recall = $recall; f1 = $f1; suporte = $tp + $fn }
    }
    [pscustomobject]@{
        conjunto = $parte
        registros = $dados.Count
        classe_prevista = $classeMajoritaria
        acuracia = @($previsoes | Where-Object { $_.real -eq $_.previsto }).Count / $dados.Count
        f1_macro = ($porClasse | Measure-Object -Property f1 -Average).Average
        por_classe = @($porClasse)
    }
}
$metricas | ConvertTo-Json -Depth 6 |
    Set-Content (Join-Path $pastaResultados 'baseline_metricas.json') -Encoding utf8
$metricas | Select-Object conjunto, registros, classe_prevista, acuracia, f1_macro | Format-Table
