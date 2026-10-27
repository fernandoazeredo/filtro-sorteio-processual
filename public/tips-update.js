window.addEventListener("DOMContentLoaded", () => {
  const tips = document.querySelector("#tipsDialog .tips-content");
  if (!tips) return;

  tips.innerHTML = `
    <p class="tips-intro"><strong>Sorteio por reclamada.</strong> O Tipo classifica os processos e cada reclamada fica com um único sócio em toda a base.</p>
    <section class="tips-step"><h3><span>1</span> Planilha de entrada</h3><ol>
      <li>Use: <strong>Reclamante, Reclamada, Número de CNJ, Tipo, Valor da causa, Última Decisão e Sorteado Para</strong>.</li>
      <li><strong>Sócio a gerir</strong> e <strong>Critério</strong> não fazem parte do novo sorteio e não são utilizados pelo aplicativo.</li>
      <li>A coluna <strong>Sorteado Para</strong> preserva a distribuição importada. Para uma nova distribuição, importe uma cópia com essa coluna vazia.</li>
      <li>A Reclamada é a referência principal. Sem Reclamada, o app usa o CNJ; sem CNJ, usa a Reclamada. O mesmo CNJ permanece com um único sócio. Sem ambos, informe uma identificação antes de sortear.</li>
      <li>Valor da causa em branco é considerado zero.</li>
    </ol></section>
    <section class="tips-step"><h3><span>2</span> Classificação</h3><ol>
      <li>A única fonte de classificação é a coluna <strong>Tipo</strong>.</li>
      <li>Tipos proporcionais: <strong>ALEATÓRIO, IMPROCEDENTE, ED, EF e EP</strong>.</li>
      <li>Tipos fixos: <strong>COMPROMETIDO → Flávio</strong>; <strong>ANA MULLER → Ana</strong>; <strong>FLÁVIO MARQUES → Flávio</strong>; <strong>NADJA/ANA → Ana</strong>; <strong>NADJA/FLÁVIO → Flávio</strong>.</li>
      <li><strong>Última Decisão</strong> é apenas informativa e não altera o Tipo.</li>
    </ol></section>
    <section class="tips-step"><h3><span>3</span> Execução</h3><ol>
      <li>Escolha um Tipo no filtro e clique em <strong>Aplicar Filtro</strong>.</li>
      <li>Clique em <strong>Executar Sorteio por filtro</strong>.</li>
      <li>Nos grupos proporcionais, a divisão busca aproximadamente <strong>60% para Flávio e 40% para Ana</strong>, considerando quantidade e valor.</li>
      <li>Nos grupos fixos, o aplicativo apenas preenche <strong>Sorteado Para</strong> conforme o Tipo.</li>
      <li>A mesma reclamada, inclusive em Tipos diferentes, permanece com um único sócio. Atribuições existentes e Tipos fixos são respeitados; conflitos precisam ser corrigidos antes do sorteio.</li>
      <li>Os grupos de reclamadas são indivisíveis. Por isso, a proporção 60% / 40% pode variar.</li>
    </ol></section>
    <section class="tips-step"><h3><span>4</span> Relatórios</h3><ol>
      <li>Tela, PDF e Excel exibem Reclamante, Reclamada, Número de CNJ, Tipo, Valor da causa, Última Decisão e Sorteado Para.</li>
      <li>Os relatórios mostram <strong>Sorteado Para</strong> como última coluna.</li>
      <li>O PDF separa os processos destinados a Flávio e Ana e apresenta o resumo consolidado ao final.</li>
    </ol></section>`;
});

