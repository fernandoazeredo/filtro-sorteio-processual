(() => {
  "use strict";

  const FILTER_SEQUENCE = [
    {key: "ALEATORIO", label: "ALEATÓRIO"},
    {key: "IMPROCEDENTE", label: "IMPROCEDENTE"},
    {key: "COMPROMETIDO", label: "COMPROMETIDO"},
    {key: "ED", label: "ED"},
    {key: "EF", label: "EF"},
    {key: "EP", label: "EP"},
    {key: "ANA MULLER", label: "ANA MULLER"},
    {key: "FLAVIO MARQUES", label: "FLÁVIO MARQUES"},
    {key: "NADJA/ANA", label: "NADJA/ANA"},
    {key: "NADJA/FLAVIO", label: "NADJA/FLÁVIO"}
  ];

  const COLS = ["Cliente", "Número de CNJ", "Tipo", "Valor da causa", "Última Decisão", "Sorteado Para"];

  const normalize = value => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const parseBRL = value => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let text = String(value ?? "").trim().replace(/R\$/gi, "").replace(/\s/g, "");
    if (text.includes(",")) text = text.replace(/\./g, "").replace(/,/g, ".");
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? n : 0;
  };

  const brl = value => parseBRL(value).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});

  function getRowsFromWorkbook(workbook) {
    const sheetName = workbook.SheetNames.find(name => normalize(name) === "BASE PARA SORTEIO") || workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) throw new Error("A planilha não possui uma aba válida para leitura.");

    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {defval: "", raw: true})
      .filter(row => String(row.Cliente ?? "").trim());

    if (!raw.length) throw new Error("Nenhum processo foi encontrado na planilha.");

    return raw.map(row => ({
      Cliente: row.Cliente ?? "",
      "Número de CNJ": row["Número de CNJ"] ?? "",
      Tipo: row.Tipo ?? "",
      "Valor da causa": row["Valor da causa"] ?? "",
      "Última Decisão": row["Última Decisão"] ?? "",
      "Sorteado Para": ""
    }));
  }

  function addFilterSection(doc, label, rows, firstSection) {
    if (!firstSection) doc.addPage();

    doc.setFillColor(220, 38, 38);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.rect(14, 10, 269, 9, "F");
    doc.text(label, 18, 16);

    doc.setTextColor(60, 70, 85);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`Quantidade: ${rows.length} | Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 24);

    doc.autoTable({
      startY: 28,
      head: [["Cliente", "Número de CNJ", "Tipo", "Valor da causa (R$)", "Última Decisão", "Sorteado Para"]],
      body: rows.map(row => [
        row.Cliente ?? "",
        row["Número de CNJ"] ?? "",
        row.Tipo ?? "",
        brl(row["Valor da causa"]),
        row["Última Decisão"] ?? "",
        ""
      ]),
      theme: "striped",
      headStyles: {fillColor: [220, 38, 38], textColor: 255, fontSize: 6.8},
      styles: {fontSize: 6.2, cellPadding: 1.15, overflow: "linebreak"},
      margin: {left: 14, right: 14},
      columnStyles: {
        0: {cellWidth: 48},
        1: {cellWidth: 43},
        2: {cellWidth: 27},
        3: {cellWidth: 31},
        4: {cellWidth: 88},
        5: {cellWidth: 28}
      }
    });
  }

  async function downloadLotPdf() {
    const input = document.getElementById("excelFile");
    const file = input?.files?.[0];
    if (!file) {
      alert("Selecione primeiro a planilha do novo sorteio.");
      return;
    }
    if (!window.XLSX || !window.jspdf?.jsPDF) {
      alert("Os componentes de Excel/PDF ainda não foram carregados. Atualize a página e tente novamente.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), {type: "array", cellStyles: true});
      const rows = getRowsFromWorkbook(workbook);
      const doc = new window.jspdf.jsPDF({orientation: "landscape"});

      let firstSection = true;
      let totalIncluded = 0;

      for (const filter of FILTER_SEQUENCE) {
        const groupRows = rows.filter(row => normalize(row.Tipo) === filter.key);
        if (!groupRows.length) continue;
        addFilterSection(doc, filter.label, groupRows, firstSection);
        firstSection = false;
        totalIncluded += groupRows.length;
      }

      if (firstSection) throw new Error("Nenhum processo corresponde aos filtros configurados.");
      if (totalIncluded !== rows.length) {
        const outside = rows.length - totalIncluded;
        throw new Error(`${outside} processo(s) possuem Tipo fora da sequência oficial de filtros. O PDF não foi gerado.`);
      }

      doc.save("RELATORIOS DO LOTE - POR FILTROS.pdf");
    } catch (error) {
      alert(`Erro ao gerar o PDF do lote: ${error.message}`);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("packageBtn");
    const input = document.getElementById("excelFile");
    if (!button || !input) return;

    button.onclick = null;
    button.textContent = "Baixar Relatórios do Lote";
    button.title = "Baixa um único PDF com todos os processos agrupados na sequência dos filtros, sem executar sorteio.";
    button.addEventListener("click", downloadLotPdf);

    const syncEnabled = () => {
      button.disabled = !input.files?.[0];
    };

    input.addEventListener("change", () => setTimeout(syncEnabled, 0));
    const observer = new MutationObserver(() => {
      if (input.files?.[0] && button.disabled) button.disabled = false;
      if (!input.files?.[0] && !button.disabled) button.disabled = true;
    });
    observer.observe(button, {attributes: true, attributeFilter: ["disabled"]});
    syncEnabled();
  });
})();