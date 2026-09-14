(() => {
  "use strict";

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  function isNadjaAnaFilter() {
    const select = document.getElementById("filterInput");
    const value = normalize(select?.value || "");
    const text = normalize(select?.selectedOptions?.[0]?.textContent || "");
    return value === "NADJA" || text === "NADJA/ANA";
  }

  function sourcePrefix() {
    const fileName = document.getElementById("excelFile")?.files?.[0]?.name || "";
    const normalized = normalize(fileName);
    if (normalized.includes("ANTIGOS")) return "PROCESSOS ANTIGOS";
    if (normalized.includes("NOVOS")) return "PROCESSOS NOVOS";
    if (normalized.includes("CONSOLIDAD")) return "PROCESSOS CONSOLIDADOS";
    return "PROCESSOS";
  }

  function nadjaAnaBaseName() {
    return `${sourcePrefix()} - NADJA-ANA`;
  }

  function patchPdfSave() {
    const proto = window.jspdf?.jsPDF?.prototype;
    if (!proto?.save || proto.save.__nadjaAnaFixed) return;

    const originalSave = proto.save;
    const patchedSave = function(filename, options) {
      if (isNadjaAnaFilter() && typeof filename === "string" && filename.toLowerCase().endsWith(".pdf")) {
        filename = `${nadjaAnaBaseName()}.pdf`;
      }
      return originalSave.call(this, filename, options);
    };
    patchedSave.__nadjaAnaFixed = true;
    proto.save = patchedSave;
  }

  function patchExcelSave() {
    if (!window.XLSX?.writeFile || window.XLSX.writeFile.__nadjaAnaFixed) return;

    const originalWriteFile = window.XLSX.writeFile;
    const patchedWriteFile = function(workbook, filename, options) {
      if (isNadjaAnaFilter() && typeof filename === "string" && filename.toLowerCase().endsWith(".xlsx")) {
        filename = `${nadjaAnaBaseName()}.xlsx`;
      }
      return originalWriteFile.call(this, workbook, filename, options);
    };
    patchedWriteFile.__nadjaAnaFixed = true;
    window.XLSX.writeFile = patchedWriteFile;
  }

  function applyFix() {
    patchPdfSave();
    patchExcelSave();
  }

  window.addEventListener("DOMContentLoaded", applyFix);
})();
