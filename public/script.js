// Gerenciamento de Processos: upload, filtros, exportação PDF/XLSX e resumo consolidado.

window.addEventListener("DOMContentLoaded", () => {
  const DATA_STORAGE_KEY = "filtroSorteioProcessual.data.v1";
  const THEME_STORAGE_KEY = "filtroSorteioProcessual.theme.v1";
  let originalData = [];
  let filteredData = [];
  let activeFilter = "";

  const excelFile = document.getElementById("excelFile");
  const searchInput = document.getElementById("searchInput");
  const filterInput = document.getElementById("filterInput");
  const applyFilterBtn = document.getElementById("applyFilterBtn");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const drawBtn = document.getElementById("drawBtn");
  const clearBtn = document.getElementById("clearBtn");
  const sortAZ = document.getElementById("sortAZ");
  const sortZA = document.getElementById("sortZA");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const deleteSelBtn = document.getElementById("deleteSelBtn");
  const headerRow = document.getElementById("headerRow");
  const tableBody = document.getElementById("tableBody");
  const exportPDFBtn = document.getElementById("exportPDF");
  const exportXLSXBtn = document.getElementById("exportXLSX");
  const themeToggle = document.getElementById("themeToggle");
  const themeLabel = document.getElementById("themeLabel");
  const tipsBtn = document.getElementById("tipsBtn");
  const tipsDialog = document.getElementById("tipsDialog");
  const tipsPanel = tipsDialog.querySelector(".tips-panel");
  const tipsCloseBtn = document.getElementById("tipsCloseBtn");
  const tipsCloseFooterBtn = document.getElementById("tipsCloseFooterBtn");
  const downloadModelBtn = document.getElementById("downloadModelBtn");
  let lastFocusedElement = null;

  const normalize = (str) =>
    String(str ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .trim();

  const parseBRL = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalizedValue = String(value ?? "")
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    const parsedValue = Number.parseFloat(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  };

  const formatBRL = (value) =>
    parseBRL(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const percent = (part, total) =>
    total ? `${((part / total) * 100).toFixed(2)}%` : "0%";

  function saveData() {
    try {
      localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(originalData));
      return true;
    } catch (error) {
      alert(`Não foi possível salvar os dados no navegador: ${error.message}`);
      return false;
    }
  }

  function restoreData() {
    try {
      const savedData = localStorage.getItem(DATA_STORAGE_KEY);
      if (!savedData) return;
      const parsedData = JSON.parse(savedData);
      if (!Array.isArray(parsedData)) return;
      originalData = parsedData;
      filteredData = [...originalData];
      renderTable(filteredData);
      atualizarResumo(filteredData);
    } catch (error) {
      localStorage.removeItem(DATA_STORAGE_KEY);
      alert(`Os dados salvos no navegador não puderam ser recuperados: ${error.message}`);
    }
  }

  function setTheme(theme) {
    const darkMode = theme === "dark";
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute("aria-pressed", String(darkMode));
    themeLabel.textContent = darkMode ? "Modo claro" : "Modo escuro";
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const preferredTheme = savedTheme || (
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  setTheme(preferredTheme === "dark" ? "dark" : "light");

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  });

  function openTips() {
    lastFocusedElement = document.activeElement;
    tipsDialog.hidden = false;
    document.body.classList.add("modal-open");
    tipsBtn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => tipsPanel.focus());
  }

  function closeTips() {
    tipsDialog.hidden = true;
    document.body.classList.remove("modal-open");
    tipsBtn.setAttribute("aria-expanded", "false");
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  }

  tipsBtn.addEventListener("click", openTips);
  tipsCloseBtn.addEventListener("click", closeTips);
  tipsCloseFooterBtn.addEventListener("click", closeTips);
  tipsDialog.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-tips")) closeTips();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tipsDialog.hidden) closeTips();
  });

  downloadModelBtn.addEventListener("click", () => {
    if (!window.XLSX) {
      alert("Não foi possível carregar o gerador do modelo Excel.");
      return;
    }

    const headers = [[
      "Cliente",
      "Número de CNJ",
      "Tipo",
      "Valor da causa",
      "Última Decisão",
      "Sócio a gerir",
      "Critério"
    ]];
    const modelSheet = XLSX.utils.aoa_to_sheet(headers);
    modelSheet["!cols"] = [
      { wch: 28 },
      { wch: 27 },
      { wch: 14 },
      { wch: 18 },
      { wch: 25 },
      { wch: 20 },
      { wch: 24 }
    ];

    const instructions = [
      ["INSTRUÇÕES DO MODELO"],
      ["1. Preencha os dados na aba MODELO_UPLOAD, a partir da linha 2."],
      ["2. Não altere os nomes dos sete cabeçalhos."],
      ["3. Deixe Sócio a gerir em branco para os processos que participarão do sorteio."],
      ["4. O aplicativo lê somente a primeira aba do arquivo."],
      ["5. Salve o arquivo no formato .xlsx antes de importá-lo."]
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet["!cols"] = [{ wch: 100 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, modelSheet, "MODELO_UPLOAD");
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "INSTRUÇÕES");
    XLSX.writeFile(workbook, "Modelo_Planilha_Filtro_Sorteio_Processual.xlsx");
  });

  excelFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        originalData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        filteredData = [...originalData];
        activeFilter = "";
        saveData();
        renderTable(filteredData);
        atualizarResumo(filteredData);
      } catch (error) {
        alert(`Erro ao ler planilha: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  function renderTable(data) {
    headerRow.innerHTML = "";
    tableBody.innerHTML = "";
    if (!data.length) return;

    const columns = Object.keys(data[0]);
    const selectionHeader = document.createElement("th");
    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.setAttribute("aria-label", "Selecionar todas as linhas");
    selectionHeader.appendChild(selectAllCheckbox);
    headerRow.appendChild(selectionHeader);

    columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      headerRow.appendChild(th);
    });

    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      const selectionCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "rowCheckbox";
      checkbox.dataset.index = index;
      checkbox.setAttribute("aria-label", `Selecionar linha ${index + 1}`);
      selectionCell.appendChild(checkbox);
      tr.appendChild(selectionCell);

      columns.forEach((column) => {
        const td = document.createElement("td");
        td.textContent = column === "Valor da causa" ? formatBRL(row[column]) : row[column];
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });

    selectAllCheckbox.addEventListener("change", () => {
      document.querySelectorAll(".rowCheckbox").forEach((checkbox) => {
        checkbox.checked = selectAllCheckbox.checked;
      });
    });
  }

  applyFilterBtn.addEventListener("click", () => {
    const selectedFilter = normalize(filterInput.value);
    const validFilters = [
      "EP",
      "ED",
      "EF",
      "IMPROCEDENTE",
      "NADJA",
      "NADJA/FLAVIO",
      "COMPROMETIDO",
      "FLÁVIO",
      "ANA"
    ].map(normalize);

    if (!validFilters.includes(selectedFilter)) {
      alert("Filtro inválido ou não selecionado.");
      return;
    }

    filteredData = originalData.filter((row) => {
      const type = normalize(row["Tipo"]);
      const lastDecision = normalize(row["Última Decisão"]);
      const criterion = normalize(row["Critério"]);
      if (["EP", "ED", "EF"].includes(selectedFilter)) return type === selectedFilter;
      if (selectedFilter === normalize("IMPROCEDENTE")) return lastDecision === selectedFilter;
      return criterion.includes(selectedFilter);
    });

    activeFilter = selectedFilter;
    renderTable(filteredData);
    atualizarResumo(filteredData);
  });

  searchInput.addEventListener("input", () => {
    const term = normalize(searchInput.value);
    activeFilter = "";
    filteredData = originalData.filter((row) =>
      Object.values(row).some((value) => normalize(value).includes(term))
    );
    renderTable(filteredData);
    atualizarResumo(filteredData);
  });

  sortAZ.addEventListener("click", () => {
    filteredData.sort((a, b) =>
      String(a.Cliente || "").localeCompare(String(b.Cliente || ""), "pt-BR")
    );
    renderTable(filteredData);
  });

  sortZA.addEventListener("click", () => {
    filteredData.sort((a, b) =>
      String(b.Cliente || "").localeCompare(String(a.Cliente || ""), "pt-BR")
    );
    renderTable(filteredData);
  });

  selectAllBtn.addEventListener("click", () => {
    document.querySelectorAll(".rowCheckbox").forEach((checkbox) => {
      checkbox.checked = true;
    });
  });

  deleteSelBtn.addEventListener("click", () => {
    const selectedIndexes = Array.from(document.querySelectorAll(".rowCheckbox:checked"))
      .map((checkbox) => Number(checkbox.dataset.index))
      .sort((a, b) => b - a);

    selectedIndexes.forEach((index) => {
      const item = filteredData[index];
      const originalIndex = originalData.indexOf(item);
      if (originalIndex > -1) originalData.splice(originalIndex, 1);
      filteredData.splice(index, 1);
    });

    saveData();
    renderTable(filteredData);
    atualizarResumo(filteredData);
  });

  clearFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterInput.value = "";
    activeFilter = "";
    filteredData = [...originalData];
    renderTable(filteredData);
    atualizarResumo(filteredData);
  });

  clearBtn.addEventListener("click", () => {
    originalData = [];
    filteredData = [];
    excelFile.value = "";
    searchInput.value = "";
    filterInput.value = "";
    activeFilter = "";
    headerRow.innerHTML = "";
    tableBody.innerHTML = "";
    localStorage.removeItem(DATA_STORAGE_KEY);
    atualizarResumo([]);
  });

  function randomIndex(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    const randomValues = new Uint32Array(1);
    const maximumValidValue = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let randomValue;
    do {
      crypto.getRandomValues(randomValues);
      randomValue = randomValues[0];
    } while (randomValue >= maximumValidValue);
    return randomValue % maxExclusive;
  }

  function shuffle(items) {
    const shuffledItems = [...items];
    for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
      const selectedIndex = randomIndex(index + 1);
      [shuffledItems[index], shuffledItems[selectedIndex]] = [
        shuffledItems[selectedIndex],
        shuffledItems[index]
      ];
    }
    return shuffledItems;
  }

  drawBtn.addEventListener("click", () => {
    if (!activeFilter) {
      alert("Aplique um filtro antes de realizar o sorteio.");
      return;
    }

    if (!filteredData.length) {
      alert("O filtro aplicado não possui processos para sortear.");
      return;
    }

    const assignedToAna = filteredData.filter((row) =>
      normalize(row["Sócio a gerir"]).includes(normalize("ANA"))
    ).length;
    const assignedToFlavio = filteredData.filter((row) =>
      normalize(row["Sócio a gerir"]).includes(normalize("FLÁVIO"))
    ).length;
    const unassignedRows = filteredData.filter((row) => {
      const partner = normalize(row["Sócio a gerir"]);
      return !partner.includes(normalize("ANA")) && !partner.includes(normalize("FLÁVIO"));
    });

    if (!unassignedRows.length) {
      alert("Todos os processos deste filtro já possuem sócio atribuído.");
      return;
    }

    const targetFlavio = Math.round(filteredData.length * 0.6);
    const targetAna = filteredData.length - targetFlavio;
    let remainingForFlavio = Math.max(0, targetFlavio - assignedToFlavio);
    let remainingForAna = Math.max(0, targetAna - assignedToAna);

    if (remainingForFlavio + remainingForAna < unassignedRows.length) {
      const surplus = unassignedRows.length - remainingForFlavio - remainingForAna;
      if (assignedToFlavio > targetFlavio) {
        remainingForAna += surplus;
      } else {
        remainingForFlavio += surplus;
      }
    }

    const shuffledRows = shuffle(unassignedRows);
    shuffledRows.forEach((row, index) => {
      row["Sócio a gerir"] = index < remainingForFlavio ? "Flávio" : "Ana";
    });

    saveData();
    renderTable(filteredData);
    atualizarResumo(filteredData);

    const summary = consolidatedSummary(filteredData);
    alert(
      `Sorteio concluído para o filtro ${filterInput.value}.\n` +
      `Flávio: ${summary.flavioCount} processo(s).\n` +
      `Ana: ${summary.anaCount} processo(s).`
    );
  });

  function consolidatedSummary(data) {
    let anaCount = 0;
    let anaValue = 0;
    let flavioCount = 0;
    let flavioValue = 0;

    data.forEach((row) => {
      const value = parseBRL(row["Valor da causa"]);
      const partner = normalize(row["Sócio a gerir"]);
      if (partner.includes(normalize("ANA"))) {
        anaCount += 1;
        anaValue += value;
      } else if (partner.includes(normalize("FLÁVIO"))) {
        flavioCount += 1;
        flavioValue += value;
      }
    });

    return {
      anaCount,
      anaValue,
      flavioCount,
      flavioValue,
      totalCount: anaCount + flavioCount,
      totalValue: anaValue + flavioValue
    };
  }

  exportPDFBtn.addEventListener("click", () => {
    if (!filteredData.length) {
      alert("Nenhum dado para exportar.");
      return;
    }

    const doc = new jspdf.jsPDF({ orientation: "landscape" });
    const columns = Object.keys(filteredData[0]);
    doc.autoTable({
      head: [columns],
      body: filteredData.map((row) => columns.map((column) => row[column]))
    });

    const summary = consolidatedSummary(filteredData);
    const y = doc.lastAutoTable.finalY + 10;
    doc.text("Resumo Consolidado por Sócio", 14, y);
    doc.autoTable({
      startY: y + 6,
      head: [["Sócio", "Qtd", "% qtd", "Valor", "% valor"]],
      body: [
        [
          "Ana",
          summary.anaCount,
          percent(summary.anaCount, filteredData.length),
          formatBRL(summary.anaValue),
          percent(summary.anaValue, summary.totalValue)
        ],
        [
          "Flávio",
          summary.flavioCount,
          percent(summary.flavioCount, filteredData.length),
          formatBRL(summary.flavioValue),
          percent(summary.flavioValue, summary.totalValue)
        ],
        ["Total Geral", filteredData.length, "100%", formatBRL(summary.totalValue), "100%"]
      ]
    });
    doc.save("relatorio-processos.pdf");
  });

  exportXLSXBtn.addEventListener("click", () => {
    if (!filteredData.length) {
      alert("Nenhum dado para exportar.");
      return;
    }

    const dataSheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Dados");

    const summary = consolidatedSummary(filteredData);
    const summaryData = [
      ["Sócio", "Qtd", "% qtd", "Valor", "% valor"],
      [
        "Ana",
        summary.anaCount,
        percent(summary.anaCount, filteredData.length),
        formatBRL(summary.anaValue),
        percent(summary.anaValue, summary.totalValue)
      ],
      [
        "Flávio",
        summary.flavioCount,
        percent(summary.flavioCount, filteredData.length),
        formatBRL(summary.flavioValue),
        percent(summary.flavioValue, summary.totalValue)
      ],
      ["Total Geral", filteredData.length, "100%", formatBRL(summary.totalValue), "100%"]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
    XLSX.writeFile(workbook, "relatorio-processos.xlsx");
  });

  function atualizarResumo(data) {
    const summary = consolidatedSummary(data);
    document.getElementById("qtdAna").textContent = summary.anaCount;
    document.getElementById("percentAna").textContent = percent(summary.anaCount, summary.totalCount);
    document.getElementById("valorAna").textContent = formatBRL(summary.anaValue);
    document.getElementById("percentValorAna").textContent = percent(summary.anaValue, summary.totalValue);
    document.getElementById("qtdFlavio").textContent = summary.flavioCount;
    document.getElementById("percentFlavio").textContent = percent(summary.flavioCount, summary.totalCount);
    document.getElementById("valorFlavio").textContent = formatBRL(summary.flavioValue);
    document.getElementById("percentValorFlavio").textContent = percent(summary.flavioValue, summary.totalValue);
    document.getElementById("qtdTotal").textContent = summary.totalCount;
    document.getElementById("valorTotal").textContent = formatBRL(summary.totalValue);
  }

  restoreData();
});
