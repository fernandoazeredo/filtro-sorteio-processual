window.addEventListener("DOMContentLoaded", () => {
  const tips = document.querySelector("#tipsDialog .tips-content");
  if (!tips) return;

  tips.innerHTML = `
    <p class="tips-intro"><strong>Novo sorteio.</strong> O aplicativo trabalha somente com seis colunas e usa exclusivamente <strong>Tipo</strong> para classificar cada processo.</p>
    <section class="tips-step"><h3><span>1</span> Planilha de entrada</h3><ol>
      <li>Mantenha somente: <strong>Cliente, Número de CNJ, Tipo, Valor da causa, Última Decisão e Sorteado Para</strong>.</li>
      <li><strong>Sócio a gerir</strong> e <strong>Critério</strong> não fazem parte do novo sorteio e não são utilizados pelo aplicativo.</li>
      <li>A coluna <strong>Sorteado Para</strong> é zerada no carregamento para impedir reaproveitamento de resultado anterior.</li>
    </ol></section>
    <section class="tips-step"><h3><span>2</span> Classificação</h3><ol>
      <li>A única fonte de classificação é a coluna <strong>Tipo</strong>.</li>
      <li>Tipos proporcionais: <strong>ALEATÓRIO, IMPROCEDENTE, COMPROMETIDO, ED, EF e EP</strong>.</li>
      <li>Tipos fixos: <strong>ANA MULLER → Ana</strong>; <strong>FLÁVIO MARQUES → Flávio</strong>; <strong>NADJA/ANA → Ana</strong>; <strong>NADJA/FLÁVIO → Flávio</strong>.</li>
      <li><strong>Última Decisão</strong> é apenas informativa e não altera o Tipo.</li>
    </ol></section>
    <section class="tips-step"><h3><span>3</span> Execução</h3><ol>
      <li>Escolha um Tipo no filtro e clique em <strong>Aplicar Filtro</strong>.</li>
      <li>Clique em <strong>Executar Sorteio por filtro</strong>.</li>
      <li>Nos grupos proporcionais, a divisão busca aproximadamente <strong>60% para Flávio e 40% para Ana</strong>, considerando quantidade e valor.</li>
      <li>Nos grupos fixos, o aplicativo apenas preenche <strong>Sorteado Para</strong> conforme o Tipo.</li>
      <li>Ao executar novamente um filtro, somente aquele Tipo é recalculado; os demais resultados são preservados.</li>
    </ol></section>
    <section class="tips-step"><h3><span>4</span> Relatórios</h3><ol>
      <li>Tela, PDF e Excel exibem somente as seis colunas do novo modelo.</li>
      <li>Os relatórios mostram <strong>Sorteado Para</strong> como última coluna.</li>
      <li>O PDF separa os processos destinados a Flávio e Ana e apresenta o resumo consolidado ao final.</li>
    </ol></section>`;
});
