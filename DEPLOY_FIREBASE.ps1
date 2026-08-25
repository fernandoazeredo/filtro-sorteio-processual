param(
    [string]$FirebaseProjectId = "filtro-sorteio-processual"
)

$ErrorActionPreference = "Stop"
$ProjectIdOficial = "filtro-sorteio-processual"

if ($FirebaseProjectId -ne $ProjectIdOficial) {
    throw "Project ID incorreto. Este projeto aceita somente: $ProjectIdOficial"
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    throw "Firebase CLI não encontrado. Instale com: npm install -g firebase-tools"
}

if (-not (Test-Path -LiteralPath ".\firebase.json")) {
    throw "firebase.json não encontrado. Execute o script dentro da pasta oficial do projeto."
}

if (-not (Test-Path -LiteralPath ".\public\index.html")) {
    throw "public\index.html não encontrado. O projeto está incompleto."
}

Write-Host "Validando acesso ao Firebase..." -ForegroundColor Cyan
firebase --version | Out-Host

$ProjectsJson = firebase projects:list --json | ConvertFrom-Json
$ProjectFound = $ProjectsJson.result | Where-Object { $_.projectId -eq $ProjectIdOficial }

if (-not $ProjectFound) {
    throw "O projeto Firebase '$ProjectIdOficial' não foi localizado na conta conectada. Execute firebase login e tente novamente."
}

Write-Host "Publicando somente o Firebase Hosting em '$ProjectIdOficial'..." -ForegroundColor Cyan
firebase deploy --only hosting --project $ProjectIdOficial

if ($LASTEXITCODE -ne 0) {
    throw "O deploy do Firebase Hosting não foi concluído."
}

$HostingUrl = "https://$ProjectIdOficial.web.app"
Write-Host "Release complete!" -ForegroundColor Green
Write-Host "URL final: $HostingUrl" -ForegroundColor Green
