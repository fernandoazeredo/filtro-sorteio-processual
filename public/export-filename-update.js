(() => {
  "use strict";

  const FILTER_NAMES = {
    ALEATORIO: "ALEATÓRIO",
    ANA: "ANA MULLER",
    COMPROMETIDO: "COMPROMETIDO",
    ED: "ED",
    EF: "EF",
    EP: "EP",
    FLAVIO: "FLÁVIO MARQUES",
    IMPROCEDENTE: "IMPROCEDENTE",
    NADJA: "NADJA/ANA",
    "NADJA/FLAVIO": "NADJA/FLAVIO"
  };

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  let appliedFilter = "";

  function sourcePrefix() {
    const fileName = document.getElementById("excelFile")?.files?.[0]?.name || "";
    const normalized = normalize(fileName);

    if (normalized.includes("ANTIGOS")) return "PROCESSOS ANTIGOS";
    if (normalized.includes("NOVOS")) return "PROCESSOS NOVOS";
    if (normalized.includes("CONSOLIDAD")) return "PROCESSOS CONSOLIDADOS";
    return "PROCESSOS";
  }

  function filterKeyFromValue(value) {
    const normalized = normalize(value);
    const aliases = {
      "ALEATORIO": "ALEATORIO",
      "ANA": "ANA",
      "ANA MULLER": "ANA",
      "COMPROMETIDO": "COMPROMETIDO",
      "ED": "ED",
      "EF": "EF",
      "EP": "EP",
      "FLAVIO": "FLAVIO",
      "FLAVIO MARQUES": "FLAVIO",
      "IMPROCEDENTE": "IMPROCEDENTE",
      "NADJA": "NADJA",
      "NADJA/ANA": "NADJA",
      "NADJA/FLAVIO": "NADJA/FLAVIO"
    };
    return aliases[normalized] || "";
  }

  function currentBaseName() {
    const key = appliedFilter || filterKeyFromValue(document.getElementById("filterInput")?.value);
    const filterName = FILTER_NAMES[key] || "TODOS";
    const safeFilterName = filterName.replace(/\//g, "-");
    return `${sourcePrefix()} - ${safeFilterName}`;
  }

  function patchExports() {
    const applyButton = document.getElementById("applyFilterBtn");
    const clearFiltersButton = document.getElementById("clearFiltersBtn");
    const clearAllButton = document.getElementById("clearBtn");
    const fileInput = document.getElementById("excelFile");

    applyButton?.addEventListener("click", () => {
      appliedFilter = filterKeyFromValue(document.getElementById("filterInput")?.value);
    });

    clearFiltersButton?.addEventListener("click", () => {
      appliedFilter = "";
    });

    clearAllButton?.addEventListener("click", () => {
      appliedFilter = "";
    });

    fileInput?.addEventListener("change", () => {
      appliedFilter = "";
    });

    if (window.jspdf?.jsPDF?.prototype?.save) {
      const originalPdfSave = window.jspdf.jsPDF.prototype.save;
      window.jspdf.jsPDF.prototype.save = function(filename, options) {
        if (filename === "relatorio-processos.pdf" || filename === "relatorio-processos-por-socio.pdf") {
          filename = `${currentBaseName()}.pdf`;
        }
        return originalPdfSave.call(this, filename, options);
      };
    }

    if (window.XLSX?.writeFile) {
      const originalWriteFile = window.XLSX.writeFile;
      window.XLSX.writeFile = function(workbook, filename, options) {
        if (filename === "relatorio-processos.xlsx" || filename === "relatorio-processos-por-socio.xlsx") {
          filename = `${currentBaseName()}.xlsx`;
        }
        return originalWriteFile.call(this, workbook, filename, options);
      };
    }
  }

  window.addEventListener("DOMContentLoaded", patchExports);
})();
