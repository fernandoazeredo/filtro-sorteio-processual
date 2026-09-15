(() => {
  "use strict";

  const FILTER_NAMES = {
    "ALEATORIO": "ALEATÓRIO",
    "IMPROCEDENTE": "IMPROCEDENTE",
    "COMPROMETIDO": "COMPROMETIDO",
    "ED": "ED",
    "EF": "EF",
    "EP": "EP",
    "ANA MULLER": "ANA MULLER",
    "FLAVIO MARQUES": "FLÁVIO MARQUES",
    "NADJA/ANA": "NADJA/ANA",
    "NADJA/FLAVIO": "NADJA/FLÁVIO"
  };

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  function activeFilterName() {
    const select = document.getElementById("filterInput");
    const key = normalize(select?.value || "");
    return FILTER_NAMES[key] || "TODOS";
  }

  function exportBaseName() {
    const safeName = activeFilterName().replace(/[\\/:*?"<>|]/g, "-");
    return `PROCESSOS - ${safeName}`;
  }

  function patchExports() {
    if (window.jspdf?.jsPDF?.prototype?.save) {
      const proto = window.jspdf.jsPDF.prototype;
      if (!proto.save.__filterFilenamePatched) {
        const originalSave = proto.save;
        const patchedSave = function(filename, options) {
          if (typeof filename === "string" && filename.toLowerCase().endsWith(".pdf")) {
            if (filename === "relatorio-processos.pdf" || filename === "relatorio-processos-por-socio.pdf") {
              filename = `${exportBaseName()}.pdf`;
            }
          }
          return originalSave.call(this, filename, options);
        };
        patchedSave.__filterFilenamePatched = true;
        proto.save = patchedSave;
      }
    }

    if (window.XLSX?.writeFile && !window.XLSX.writeFile.__filterFilenamePatched) {
      const originalWriteFile = window.XLSX.writeFile;
      const patchedWriteFile = function(workbook, filename, options) {
        if (typeof filename === "string" && filename.toLowerCase().endsWith(".xlsx")) {
          if (filename === "relatorio-processos.xlsx" || filename === "relatorio-processos-por-socio.xlsx") {
            filename = `${exportBaseName()}.xlsx`;
          }
        }
        return originalWriteFile.call(this, workbook, filename, options);
      };
      patchedWriteFile.__filterFilenamePatched = true;
      window.XLSX.writeFile = patchedWriteFile;
    }
  }

  window.addEventListener("DOMContentLoaded", patchExports);
})();
