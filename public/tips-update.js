window.addEventListener("DOMContentLoaded", () => {
  const tips = document.querySelector("#tipsDialog .tips-content");
  if (!tips) return;

  tips.innerHTML = `
    <p class="tips-intro">Busque, edite e sorteie as linhas que quiser.</p>
    <section class="tips-step"><h3><span>1</span> Buscar</h3><ol>
      <li>Digite um nome ou palavra em <strong>Buscar</strong>. Aparecem todas as linhas que contêm essa palavra exata, em qualquer coluna e em todas as abas.</li>
      <li>Exemplo: <strong>ANA</strong> encontra "ANA MARIA", mas não "SANTANA".</li>
      <li>A tabela mostra 100 linhas por página. Use <strong>Anterior</strong> e <strong>Próxima</strong> ou escolha 250, 500 ou Todas.</li>
      <li><strong>Selecionar Todos</strong> marca todas as linhas da lista, em todas as páginas.</li>
    </ol></section>
    <section class="tips-step"><h3><span>2</span> Editar</h3><ol>
      <li>Use ✏️ para editar a linha e 💾 para salvar. Todos os campos são editáveis.</li>
    </ol></section>
    <section class="tips-step"><h3><span>3</span> Sortear</h3><ol>
      <li><strong>Executar Sorteio</strong> sorteia somente as linhas encontradas. Sem busca, sorteia todas.</li>
      <li><strong>Sócio a gerir</strong> preenchido com Ana ou Flávio permanece; o restante busca 60% para Flávio e 40% para Ana.</li>
      <li>Cada reclamante fica com um único sócio, inclusive em linhas fora da busca.</li>
      <li><strong>APAGAR SORTEIO</strong> limpa toda a coluna <strong>Sorteado Para</strong> para sortear de novo. A mesma base gera o mesmo resultado.</li>
      <li><strong>APAGAR TUDO</strong> tira a planilha do aplicativo. <strong>Selecionar Todos</strong> e <strong>Excluir Selecionados</strong> removem todas as linhas.</li>
    </ol></section>`;
});
