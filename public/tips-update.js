window.addEventListener("DOMContentLoaded", () => {
  const tips = document.querySelector("#tipsDialog .tips-content");
  if (!tips) return;

  tips.innerHTML = `
    <p class="tips-intro"><strong>Fluxo validado de operação.</strong> Carregue a planilha original recebida do Jurídico e execute os sorteios sempre por filtro. O App preserva os resultados já processados e mantém separados os grupos proporcionais e os grupos de atribuição fixa.</p>

    <section class="tips-step">
      <h3><span>1</span> Carregamento da planilha</h3>
      <ol>
        <li>Use a planilha original recebida do Jurídico, sem preparar ou reduzir manualmente o arquivo.</li>
        <li>O App utiliza somente as colunas: <strong>Cliente, Número de CNJ, Tipo, Valor da causa, Última Decisão, Sócio a gerir e Critério</strong>.</li>
        <li>A aba <strong>Cálculos</strong> é utilizada como cadastro-base quando presente.</li>
        <li>O cruzamento com as abas operacionais é realizado somente por <strong>ID exato</strong>.</li>
        <li>A planilha <strong>EF.xlsx</strong> é processada separadamente do fluxo principal.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>2</span> Conferência dos grupos</h3>
      <ol>
        <li>O botão <strong>Conferir Grupos</strong> serve somente para conferência geral.</li>
        <li>Ele mostra a quantidade de processos e a regra aplicável a cada grupo.</li>
        <li>Esse botão <strong>não executa sorteio</strong> e não altera nenhuma atribuição.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>3</span> Sorteio por filtro</h3>
      <ol>
        <li>Escolha o grupo desejado no campo <strong>Filtro</strong>.</li>
        <li>Clique em <strong>Aplicar Filtro</strong>.</li>
        <li>Clique em <strong>Executar Sorteio por filtro</strong>.</li>
        <li>Somente o grupo atualmente aplicado será processado.</li>
        <li>Os sorteios realizados anteriormente em outros filtros são preservados.</li>
        <li>Se um mesmo filtro for executado novamente, somente aquele grupo será recalculado.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>4</span> Regra de divisão</h3>
      <ol>
        <li><strong>EP, ED, Comprometido, Improcedente, Aleatório e EF</strong> seguem a regra de aproximadamente <strong>60% para Flávio e 40% para Ana</strong>, considerando quantidade e equilíbrio de valor dentro do próprio grupo.</li>
        <li><strong>Cliente Ana Paula</strong> e <strong>NADJA/Ana</strong> são atribuídos integralmente à Ana.</li>
        <li><strong>Cliente Flávio</strong> e <strong>NADJA/Flávio</strong> são atribuídos integralmente ao Flávio.</li>
        <li>Não existe compensação entre grupos para forçar uma proporção global de 60/40.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>5</span> Exportar PDF</h3>
      <ol>
        <li>O botão <strong>Exportar PDF</strong> gera somente o relatório do <strong>filtro atualmente aplicado</strong>.</li>
        <li>O PDF apresenta primeiro os processos do Flávio em azul, depois os processos da Ana em vermelho e, ao final, o resumo consolidado daquele filtro.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>6</span> Exportar Excel</h3>
      <ol>
        <li>O botão <strong>Exportar Excel</strong> mantém o formato operacional de planilha.</li>
        <li>A exportação corresponde aos dados atualmente exibidos na tabela e pode ser usada normalmente para filtros e análises no Excel.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>7</span> Baixar Relatórios do Lote</h3>
      <ol>
        <li>O botão só é liberado quando <strong>todos os processos do lote estiverem atribuídos</strong>.</li>
        <li>Ele ignora o filtro que estiver selecionado no momento do clique.</li>
        <li>O arquivo gerado contém os relatórios individuais dos grupos e o <strong>Resumo Consolidado do Lote</strong> com toda a base processada.</li>
        <li>O consolidado final representa a soma real de todos os grupos, sem ajuste artificial.</li>
      </ol>
    </section>

    <section class="tips-step">
      <h3><span>8</span> Importante sobre o percentual consolidado</h3>
      <p class="fsp-warn"><strong>O Resumo Consolidado do Lote não precisa fechar em 60% / 40% exatos.</strong> Isso é esperado porque os grupos fixos são atribuídos 100% a um dos sócios. A regra 60/40 deve ser verificada dentro de cada grupo proporcional. O total geral apenas soma os resultados reais, sem compensar um grupo com outro.</p>
    </section>
  `;
});
