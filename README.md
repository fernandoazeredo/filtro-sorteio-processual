# Filtro e Sorteio Processual

Aplicativo estático para importar planilhas Excel, buscar e filtrar processos, sortear 60% para Flávio e 40% para Ana, ordenar clientes, selecionar ou excluir registros e exportar os resultados em PDF ou Excel. O resumo consolidado apresenta quantidade, percentual e valor total por sócio.

## Estrutura

- `public/index.html`: interface do aplicativo.
- `public/style.css`: identidade visual, responsividade e temas claro/escuro.
- `public/script.js`: importação, filtros, cálculos, tabela e exportações.
- `public/favicon.svg`: ícone do aplicativo.
- `firebase.json` e `.firebaserc`: configuração exclusiva do Firebase Hosting.
- `DEPLOY_FIREBASE.ps1`: publicação validada no Firebase Hosting.

## Dados e dependências

O aplicativo não utiliza Firebase Authentication, Firestore, Realtime Database ou Storage. Os dados importados e os resultados dos sorteios são mantidos no `localStorage` do próprio navegador até o usuário clicar em **Limpar Tudo**. Nenhum dado processual é enviado ao Firebase.

## Regra do sorteio

O sorteio é habilitado depois da aplicação de um filtro. A distribuição é feita aleatoriamente, por quantidade, com 60% dos processos para Flávio e 40% para Ana. Atribuições existentes na coluna `Sócio a gerir` são preservadas, e apenas os processos ainda não atribuídos participam do sorteio.

Dependências públicas mantidas para as funcionalidades originais:

- SheetJS 0.18.5 para leitura e exportação de Excel.
- jsPDF 2.5.1 para geração de PDF.
- jsPDF-AutoTable 3.5.25 para tabelas no PDF.

## Publicação

Projeto Firebase: `filtro-sorteio-processual`

No PowerShell, dentro da pasta oficial do projeto:

```powershell
Unblock-File .\DEPLOY_FIREBASE.ps1
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\DEPLOY_FIREBASE.ps1
```

O script aceita somente o Project ID `filtro-sorteio-processual` e publica exclusivamente o Hosting.
