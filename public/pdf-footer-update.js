(() => {
  "use strict";
  const owners = new WeakMap();

  function markPages(doc, first, last, name) {
    let pages = owners.get(doc);
    if (!pages) { pages = new Map(); owners.set(doc, pages); }
    for (let page = first; page <= last; page++) {
      const names = pages.get(page) || new Set();
      names.add(name);
      pages.set(page, names);
    }
  }

  function addFooters(doc, when, category, fallback = "Sorteio") {
    const pages = owners.get(doc);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    for (let page = 1; page <= doc.internal.getNumberOfPages(); page++) {
      const names = pages?.get(page);
      const name = names?.size === 1 ? [...names][0] : names?.size > 1 ? "Sorteio" : fallback;
      doc.setPage(page);
      doc.setDrawColor(205, 211, 220);
      doc.setLineWidth(0.2);
      doc.line(14, height - 9, width - 14, height - 9);
      doc.setFont(undefined, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(90, 100, 115);
      doc.text(`Exportado: ${when} | Categoria: ${category} | Nome: ${name}`, 14, height - 4.5);
    }
  }

  window.FSPPdfFooter = {markPages, addFooters};
})();
