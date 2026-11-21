param([int]$Semente = 42)

$ErrorActionPreference = 'Stop'
$dados = @(Import-Csv (Join-Path $PSScriptRoot '../dados/student-por_limpo.csv'))
$aleatorio = [Random]::new($Semente)
$partes = @{
    treino = [Collections.Generic.List[object]]::new()
    validacao = [Collections.Generic.List[object]]::new()
    teste = [Collections.Generic.List[object]]::new()
}

# Divisao estratificada por situacao, com sorteio reproduzivel.
foreach ($grupo in ($dados | Group-Object situacao_regra_didatica | Sort-Object Name)) {
    $alunos = @($grupo.Group)
    for ($i = $alunos.Count - 1; $i -gt 0; $i--) {
        $j = $aleatorio.Next($i + 1)
        $alunos[$i], $alunos[$j] = $alunos[$j], $alunos[$i]
    }
    $fimTreino = [int][Math]::Round($alunos.Count * 0.70)
    $fimValidacao = $fimTreino + [int][Math]::Round($alunos.Count * 0.15)
    for ($i = 0; $i -lt $alunos.Count; $i++) {
        $destino = if ($i -lt $fimTreino) { 'treino' } elseif ($i -lt $fimValidacao) { 'validacao' } else { 'teste' }
        $partes[$destino].Add($alunos[$i])
    }
}

foreach ($nome in @('treino', 'validacao', 'teste')) {
    # G3 determina o alvo e precisa ficar fora das entradas.
    $partes[$nome] | Select-Object * -ExcludeProperty G3 |
        Export-Csv (Join-Path $PSScriptRoot "../dados/$nome.csv") -NoTypeInformation -Encoding utf8
    Write-Output "$nome = $($partes[$nome].Count)"
}
