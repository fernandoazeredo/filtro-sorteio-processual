(() => {
  "use strict";

  const FILTER_SEQUENCE = [
    {group: "ALEATORIO", type: "ALEATÓRIO", file: "01 - ALEATÓRIO"},
    {group: "IMPROCEDENTE", type: "IMPROCEDENTE", file: "02 - IMPROCEDENTE"},
    {group: "COMPROMETIDO", type: "COMPROMETIDO", file: "03 - COMPROMETIDO"},
    {group: "ED", type: "ED", file: "04 - ED"},
    {group: "EF", type: "EF", file: "05 - EF"},
    {group: "EP", type: "EP", file: "06 - EP"},
    {group: "ANA", type: "ANA MULLER", file: "07 - ANA MULLER"},
    {group: "FLAVIO", type: "FLÁVIO MARQUES", file: "08 - FLÁVIO MARQUES"},
    {group: "NADJA", type: "NADJA/ANA", file: "09 - NADJA-ANA"},
    {group: "NADJA/FLAVIO", type: "NADJA/FLÁVIO", file: "10 - NADJA-FLÁVIO"}
  ];

  const RANDOM_GROUPS = new Set(["ALEATORIO", "IMPROCEDENTE", "COMPROMETIDO", "ED", "EF", "EP"]);
  const FIXED_TO_ANA = new Set(["ANA", "NADJA"]);
  const REQUIRED = ["Cliente", "Número de CNJ", "Tipo", "Valor da causa", "Última Decisão"];
  const REPORT_COLS = [...REQUIRED, "Sorteado Para"];

  const normalize = value => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const parseBRL = value => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let text = String(value ?? "").trim();
    const negative = /^-|^-\s*R\$|^\(.*\)$/i.test(text);
    if (/^\(.*\)$/.test(text)) text = text.slice(1, -1);
    text = text.replace(/R\$/gi, "").replace(/-/g, "").replace(/\s/g, "");
    if (text.includes(",")) text = text.replace(/\./g, "").replace(/,/g, ".");
    const number = Number.parseFloat(text);
    return Number.isFinite(number) ? (negative ? -number : number) : 0;
  };

  const brl = value => parseBRL(value).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
  const pct = (a, b) => b ? `${((a / b) * 100).toFixed(2)}%` : "0%";

  function typeToGroup(value) {
    const map = {
      ALEATORIO: "ALEATORIO",
      IMPROCEDENTE: "IMPROCEDENTE",
      COMPROMETIDO: "COMPROMETIDO",
      ED: "ED",
      EF: "EF",
      EP: "EP",
      "ANA MULLER": "ANA",
      "FLAVIO MARQUES": "FLAVIO",
      "NADJA/ANA": "NADJA",
      "NADJA/FLAVIO": "NADJA/FLAVIO"
    };
    return map[normalize(value)] || "";
  }

  function readRows(workbook) {
    const sheetName = workbook.SheetNames.find(name => normalize(name) === "BASE PARA SORTEIO") || workbook.SheetNames[0];
    if (!sheetName || !workbook.Sheets[sheetName]) throw new Error("A planilha não possui uma aba válida para leitura.");

    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {defval: "", raw: true})
      .filter(row => String(row.Cliente ?? "").trim());

    if (!raw.length) throw new Error("Nenhum processo foi encontrado na planilha.");

    const missing = REQUIRED.filter(column => !Object.prototype.hasOwnProperty.call(raw[0], column));
    if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);

    const rows = raw.map((row, index) => {
      const group = typeToGroup(row.Tipo);
      if (!group) throw new Error(`Tipo inválido ou vazio na linha ${index + 2}: ${row.Tipo || "(vazio)"}.`);
      return {
        Cliente: row.Cliente ?? "",
        "Número de CNJ": row["Número de CNJ"] ?? "",
        Tipo: row.Tipo ?? "",
        "Valor da causa": row["Valor da causa"] ?? "",
        "Última Decisão": row["Última Decisão"] ?? "",
        "Sorteado Para": "",
        __group: group
      };
    });

    return {rows, sheetName};
  }

  function quota(rows) {
    const flavio = Math.round(rows.length * 0.60);
    return {flavio, ana: rows.length - flavio};
  }

  function assignFixed(rows, group) {
    const name = FIXED_TO_ANA.has(group) ? "Ana" : "Flávio";
    rows.forEach(row => row["Sorteado Para"] = name);
  }

  function assignBalanced(rows) {
    if (!rows.length) return;

    const q = quota(rows);
    const totalValue = rows.reduce((sum, row) => sum + Math.max(0, parseBRL(row["Valor da causa"])), 0);
    const ordered = [...rows].sort((a, b) =>
      Math.max(0, parseBRL(b["Valor da causa"])) - Math.max(0, parseBRL(a["Valor da causa"])) ||
      String(a.Cliente || "").localeCompare(String(b.Cliente || ""), "pt-BR")
    );

    let fc = 0;
    let ac = 0;
    let fv = 0;
    let processedValue = 0;

    for (let i = 0; i < ordered.length; i++) {
      const row = ordered[i];
      const value = Math.max(0, parseBRL(row["Valor da causa"]));
      const processedCount = i + 1;
      processedValue += value;
      let toFlavio;

      if (ac >= q.ana) toFlavio = true;
      else if (fc >= q.flavio) toFlavio = false;
      else {
        const scoreFlavio = Math.abs((fc + 1) / processedCount - 0.60) + (processedValue ? Math.abs((fv + value) / processedValue - 0.60) : 0);
        const scoreAna = Math.abs(fc / processedCount - 0.60) + (processedValue ? Math.abs(fv / processedValue - 0.60) : 0);
        toFlavio = scoreFlavio <= scoreAna;
      }

      if (toFlavio) {
        row["Sorteado Para"] = "Flávio";
        fc++;
        fv += value;
      } else {
        row["Sorteado Para"] = "Ana";
        ac++;
      }
    }

    const target = totalValue * 0.60;
    for (let pass = 0; pass < 3; pass++) {
      const flavioRows = rows.filter(row => row["Sorteado Para"] === "Flávio");
      const anaRows = rows.filter(row => row["Sorteado Para"] === "Ana");
      let best = null;
      let gain = 0;
      const current = Math.abs(fv - target);

      for (const fr of flavioRows) {
        const fval = Math.max(0, parseBRL(fr["Valor da causa"]));
        for (const ar of anaRows) {
          const aval = Math.max(0, parseBRL(ar["Valor da causa"]));
          const nextFv = fv - fval + aval;
          const nextGain = current - Math.abs(nextFv - target);
          if (nextGain > gain + 1e-9) {
            gain = nextGain;
            best = {fr, ar, nextFv};
          }
        }
      }

      if (!best) break;
      best.fr["Sorteado Para"] = "Ana";
      best.ar["Sorteado Para"] = "Flávio";
      fv = best.nextFv;
    }
  }

  function executeFullAllocation(rows) {
    for (const filter of FILTER_SEQUENCE) {
      const rowsOfGroup = rows.filter(row => row.__group === filter.group);
      if (RANDOM_GROUPS.has(filter.group)) assignBalanced(rowsOfGroup);
      else assignFixed(rowsOfGroup, filter.group);
    }

    const unassigned = rows.filter(row => !row["Sorteado Para"]);
    if (unassigned.length) throw new Error(`${unassigned.length} processo(s) ficaram sem atribuição.`);
  }

  function groupSummary(rows) {
    let ac = 0, av = 0, fc = 0, fv = 0;
    rows.forEach(row => {
      const value = parseBRL(row["Valor da causa"]);
      if (row["Sorteado Para"] === "Ana") { ac++; av += value; }
      else if (row["Sorteado Para"] === "Flávio") { fc++; fv += value; }
    });
    return {ac, av, fc, fv, tc: ac + fc, tv: av + fv};
  }

  function partnerSection(doc, title, rows, y, headFillColor) {
    const cols = REPORT_COLS;
    doc.setFillColor(...headFillColor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.rect(14, y, 269, 8, "F");
    doc.text(title, 18, y + 5.5);
    y += 10;

    doc.setTextColor(20, 30, 45);
    doc.autoTable({
      startY: y,
      head: [cols.map(c => c === "Valor da causa" ? "Valor da causa (R$)" : c)],
      body: rows.map(row => cols.map(c => c === "Valor da causa" ? brl(row[c]) : (row[c] ?? ""))),
      theme: "striped",
      headStyles: {fillColor: headFillColor, textColor: 255, fontSize: 6.5},
      styles: {fontSize: 6.2, cellPadding: 1.2},
      margin: {left: 14, right: 14}
    });
    return doc.lastAutoTable.finalY + 6;
  }

  function makeFilterPdf(filter, rows) {
    const doc = new window.jspdf.jsPDF({orientation: "landscape"});
    const title = `Relatório - ${filter.type}`;

    doc.setFontSize(13);
    doc.setTextColor(18, 45, 92);
    doc.setFont(undefined, "bold");
    doc.text(title, 14, 12);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 115);
    doc.text(`Exportado em: ${new Date().toLocaleString("pt-BR")}`, 14, 18);

    const flavioRows = rows.filter(row => row["Sorteado Para"] === "Flávio");
    const anaRows = rows.filter(row => row["Sorteado Para"] === "Ana");
    let y = 23;

    if (flavioRows.length) y = partnerSection(doc, "FLÁVIO MARQUES", flavioRows, y, [39, 72, 190]);
    if (anaRows.length) {
      if (y > 150) { doc.addPage(); y = 18; }
      y = partnerSection(doc, "ANA PAULA BONADIMAN MULLER", anaRows, y, [220, 38, 38]);
    }

    const s = groupSummary(rows);
    if (y > 160) { doc.addPage(); y = 18; }
    doc.setTextColor(20, 30, 45);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("RESUMO CONSOLIDADO FINAL", 14, y);
    doc.autoTable({
      startY: y + 4,
      head: [["Sócio", "Quantidade", "% Quantidade", "Valor Total (R$)", "% Valor"]],
      body: [
        ["Flávio Marques", s.fc, pct(s.fc, s.tc), brl(s.fv), pct(s.fv, s.tv)],
        ["Ana Paula Bonadiman Muller", s.ac, pct(s.ac, s.tc), brl(s.av), pct(s.av, s.tv)],
        ["Total Geral", s.tc, s.tc ? "100%" : "0%", brl(s.tv), s.tv ? "100%" : "0%"]
      ],
      headStyles: {fillColor: [51, 65, 85], textColor: 255},
      styles: {fontSize: 8}
    });

    return doc;
  }

  function makeSummaryPdf(rows) {
    const doc = new window.jspdf.jsPDF({orientation: "landscape"});
    const body = FILTER_SEQUENCE.map(filter => {
      const rowsOfGroup = rows.filter(row => row.__group === filter.group);
      const s = groupSummary(rowsOfGroup);
      return [filter.type, s.tc, s.fc, pct(s.fc, s.tc), s.ac, pct(s.ac, s.tc), brl(s.fv), pct(s.fv, s.tv), brl(s.av), pct(s.av, s.tv)];
    });

    const total = groupSummary(rows);
    body.push(["TOTAL GERAL", total.tc, total.fc, pct(total.fc, total.tc), total.ac, pct(total.ac, total.tc), brl(total.fv), pct(total.fv, total.tv), brl(total.av), pct(total.av, total.tv)]);

    doc.setTextColor(18, 45, 92);
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("RESUMO CONSOLIDADO DO SORTEIO", 14, 14);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 115);
    doc.text(`Total de processos: ${rows.length} | Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 20);

    doc.autoTable({
      startY: 25,
      head: [["Tipo", "Total", "Qtd Flávio", "% Qtd F.", "Qtd Ana", "% Qtd A.", "Valor Flávio", "% Valor F.", "Valor Ana", "% Valor A."]],
      body,
      theme: "grid",
      headStyles: {fillColor: [51, 65, 85], textColor: 255, fontSize: 7},
      styles: {fontSize: 6.8, cellPadding: 1.3}
    });

    return doc;
  }

  async function loadJSZip() {
    if (window.JSZip) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Falha ao carregar o componente ZIP."));
      document.head.appendChild(script);
    });
  }

  async function executeAndDownloadZip(button) {
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

    const confirmed = window.confirm("Executar agora o sorteio completo de todos os filtros, aplicar os grupos fixos e baixar todos os relatórios em um único ZIP?");
    if (!confirmed) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Processando sorteio e relatórios...";

    try {
      await loadJSZip();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), {type: "array", cellStyles: true});
      const {rows} = readRows(workbook);

      executeFullAllocation(rows);

      const zip = new JSZip();
      let included = 0;

      for (const filter of FILTER_SEQUENCE) {
        const rowsOfGroup = rows.filter(row => row.__group === filter.group);
        if (!rowsOfGroup.length) continue;
        included += rowsOfGroup.length;
        const pdf = makeFilterPdf(filter, rowsOfGroup);
        zip.file(`${filter.file}.pdf`, pdf.output("arraybuffer"));
      }

      if (included !== rows.length) throw new Error(`${rows.length - included} processo(s) ficaram fora dos relatórios.`);

      const summaryPdf = makeSummaryPdf(rows);
      zip.file("11 - RESUMO CONSOLIDADO.pdf", summaryPdf.output("arraybuffer"));

      const blob = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SORTEIO_COMPLETO_RELATORIOS_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      alert(`Sorteio completo concluído. ${rows.length} processos foram atribuídos e os relatórios foram gerados em sequência dentro do ZIP.`);
    } catch (error) {
      alert(`Erro no sorteio completo: ${error.message}`);
    } finally {
      button.textContent = originalText;
      button.disabled = !input.files?.[0];
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("packageBtn");
    const input = document.getElementById("excelFile");
    if (!button || !input) return;

    button.onclick = null;
    button.textContent = "Baixar Relatórios do Lote";
    button.title = "Executa o sorteio completo de todos os filtros e baixa um ZIP com os PDFs no mesmo layout da exportação individual.";
    button.addEventListener("click", () => executeAndDownloadZip(button));

    const syncEnabled = () => { button.disabled = !input.files?.[0]; };

    input.addEventListener("change", () => setTimeout(syncEnabled, 0));
    const observer = new MutationObserver(() => {
      if (input.files?.[0] && button.disabled && button.textContent !== "Processando sorteio e relatórios...") button.disabled = false;
      if (!input.files?.[0] && !button.disabled) button.disabled = true;
    });
    observer.observe(button, {attributes: true, attributeFilter: ["disabled"]});
    syncEnabled();
  });
})();