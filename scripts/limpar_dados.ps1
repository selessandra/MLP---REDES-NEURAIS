param(
    [string]$Entrada = (Join-Path $PSScriptRoot '../dados/student-por_complementado_simulado.csv'),
    [string]$Saida = (Join-Path $PSScriptRoot '../dados/student-por_limpo.csv')
)

$ErrorActionPreference = 'Stop'
$cultura = [Globalization.CultureInfo]::InvariantCulture
$dados = @(Import-Csv -LiteralPath $Entrada)
$faixas = @{
    age = @(15, 22); Medu = @(0, 4); Fedu = @(0, 4)
    traveltime = @(1, 4); studytime = @(1, 4); failures = @(0, 4)
    famrel = @(1, 5); freetime = @(1, 5); goout = @(1, 5)
    Dalc = @(1, 5); Walc = @(1, 5); health = @(1, 5)
    absences = @(0, 93); G1 = @(0, 20); G2 = @(0, 20); G3 = @(0, 20)
    frequencia_percentual_simulada = @(0, 100); total_aulas_assumido = @(120, 120)
    nota_atividades_simulada = @(0, 20); horas_estudo_semanais_simuladas = @(0.5, 20)
    participacao_aulas_simulada = @(0, 10)
}
$decimais = @('frequencia_percentual_simulada', 'nota_atividades_simulada',
    'horas_estudo_semanais_simuladas', 'participacao_aulas_simulada')
$categorias = @{
    school = @('GP', 'MS'); sex = @('F', 'M'); address = @('U', 'R')
    famsize = @('LE3', 'GT3'); Pstatus = @('T', 'A')
    Mjob = @('teacher', 'health', 'services', 'at_home', 'other')
    Fjob = @('teacher', 'health', 'services', 'at_home', 'other')
    reason = @('home', 'reputation', 'course', 'other')
    guardian = @('mother', 'father', 'other')
    situacao_regra_didatica = @('aprovado', 'recuperacao', 'reprovado')
    origem_campos_adicionados = @('simulacao_e_regra_didatica')
}
foreach ($coluna in @('schoolsup', 'famsup', 'paid', 'activities', 'nursery',
    'higher', 'internet', 'romantic')) {
    $categorias[$coluna] = @('yes', 'no')
}
$vistos = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$limpos = [Collections.Generic.List[object]]::new()
$ajustes = 0
foreach ($aluno in $dados) {
    foreach ($campo in $aluno.PSObject.Properties) {
        $valor = $campo.Value.Trim()
        if ([string]::IsNullOrWhiteSpace($valor)) {
            throw "Valor ausente na linha $($limpos.Count + 2), coluna $($campo.Name)."
        }
        if ($valor -cne $campo.Value) { $ajustes++ }
        if ($faixas.ContainsKey($campo.Name)) {
            $numero = [double]::Parse($valor, [Globalization.NumberStyles]::Float, $cultura)
            $limites = $faixas[$campo.Name]
            if (-not [double]::IsFinite($numero) -or $numero -lt $limites[0] -or $numero -gt $limites[1]) {
                throw "Valor fora da faixa na coluna $($campo.Name)."
            }
            if ($campo.Name -notin $decimais -and $numero -ne [Math]::Truncate($numero)) {
                throw "Valor fracionario na coluna inteira $($campo.Name)."
            }
            $valor = $numero.ToString('0.###############', $cultura)
        } elseif ($categorias.ContainsKey($campo.Name)) {
            if ($valor -cnotin $categorias[$campo.Name]) {
                throw "Categoria desconhecida na coluna $($campo.Name)."
            }
        } else { throw "Coluna sem regra de limpeza: $($campo.Name)." }
        $campo.Value = $valor
    }
    $frequencia = [Math]::Round(100 * (120 - [int]$aluno.absences) / 120, 2)
    if ([Math]::Abs([double]::Parse($aluno.frequencia_percentual_simulada, $cultura) - $frequencia) -gt 0.005) {
        throw 'Frequencia simulada inconsistente com as faltas.'
    }
    $horas = [double]::Parse($aluno.horas_estudo_semanais_simuladas, $cultura)
    $intervalos = @{ 1 = @(0.5, 1.9); 2 = @(2, 4.9); 3 = @(5, 10); 4 = @(10.5, 20) }
    $intervalo = $intervalos[[int]$aluno.studytime]
    if ($horas -lt $intervalo[0] -or $horas -gt $intervalo[1]) {
        throw 'Horas simuladas inconsistentes com studytime.'
    }
    $situacao = if ([int]$aluno.G3 -ge 10) { 'aprovado' } elseif ([int]$aluno.G3 -ge 7) { 'recuperacao' } else { 'reprovado' }
    if ($aluno.situacao_regra_didatica -cne $situacao) { throw 'Situacao inconsistente com a regra didatica.' }
    $chave = ConvertTo-Json -InputObject @($aluno.PSObject.Properties.Value) -Compress
    if ($vistos.Add($chave)) { $limpos.Add($aluno) }
}
$limpos | Export-Csv -LiteralPath $Saida -NoTypeInformation -Encoding utf8
Write-Output "Entrada: $($dados.Count). Saida: $($limpos.Count). Duplicados removidos: $($dados.Count - $limpos.Count). Espacos corrigidos: $ajustes."
