window.addEventListener("DOMContentLoaded", () => {
  const BLUE = [30, 64, 175];
  const RED = [220, 38, 38];
  const REPORT_COLS = ["Cliente", "Número de CNJ", "Tipo", "Valor da causa", "Última Decisão", "Critério", "Sorteado Para"];
  let fullAssignedRows = [];
  let renderTimer = null;

  const norm = v => String(v ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const parseBRL = value => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let t = String(value ?? "").trim().replace(/R\$/gi, "").replace(/\s/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(/,/g, ".");
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };
  const brl = v => parseBRL(v).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
  const pct = (a, b) => b ? `${((a / b) * 100).toFixed(2)}%` : "0,00%";
  const partner = r => {
    const v = norm(r["Sorteado Para"]);
    return v.includes("ANA") ? "Ana" : v.includes("FLAVIO") ? "Flávio" : "";
  };

  function readTableRows() {
    const headers = [...document.querySelectorAll("#headerRow th")].map(th => th.textContent.trim());
    if (!headers.length) return [];
    return [...document.querySelectorAll("#tableBody tr")].map(tr => {
      const cells = [...tr.children];
      const row = {};
      headers.forEach((h, i) => { if (h) row[h] = cells[i]?.textContent.trim() ?? ""; });
      return row;
    });
  }

  function isFullyAssigned(rows) {
    return rows.length > 0 && rows.every(r => partner(r));
  }

  function summarize(rows) {
    const flavio = rows.filter(r => partner(r) === "Flávio");
    const ana = rows.filter(r => partner(r) === "Ana");
    const fv = flavio.reduce((s, r) => s + parseBRL(r["Valor da causa"]), 0);
    const av = ana.reduce((s, r) => s + parseBRL(r["Valor da causa"]), 0);
    return {flavio, ana, fv, av, total: flavio.length + ana.length, tv: fv + av};
  }

  function reportTable(rows, cls) {
    const cols = REPORT_COLS.filter(c => rows.some(r => Object.prototype.hasOwnProperty.call(r, c)));
    const head = cols.map(c => `<th>${esc(c === "Valor da causa" ? "Valor da causa (R$)" : c)}</th>`).join("");
    const body = [...rows].sort((a,b) => String(a.Cliente||"").localeCompare(String(b.Cliente||""), "pt-BR")).map(r =>
      `<tr>${cols.map(c => `<td>${esc(c === "Valor da causa" ? brl(r[c]) : (r[c] ?? ""))}</td>`).join("")}</tr>`
    ).join("");
    return `<div class="partner-table-scroll"><table class="partner-table ${cls}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function partnerSection(name, rows, value, total, totalValue, theme) {
    const isFlavio = name === "Flávio";
    const fullName = isFlavio ? "Flávio Marques" : "Ana Paula Bonadiman Muller";
    return `<section class="partner-card partner-${theme}">
      <header class="partner-card-head"><div><span class="partner-kicker">${isFlavio ? "SÓCIO" : "SÓCIA"}</span><h2>${esc(fullName)}</h2></div><span class="partner-badge">${rows.length} processos</span></header>
      <div class="partner-summary">
        <div class="partner-summary-title"><strong>Resumo ${isFlavio ? "do Flávio" : "da Ana"}</strong><span>Processos atribuídos ${isFlavio ? "ao sócio" : "à sócia"}</span></div>
        <div class="partner-metric"><span>Quantidade</span><strong>${rows.length}</strong></div>
        <div class="partner-metric"><span>Valor Total (R$)</span><strong>${esc(brl(value))}</strong></div>
        <div class="partner-metric"><span>% Quantidade</span><strong>${pct(rows.length,total)}</strong></div>
        <div class="partner-metric"><span>% Valor</span><strong>${pct(value,totalValue)}</strong></div>
      </div>
      ${rows.length ? reportTable(rows, `table-${theme}`) : `<p class="partner-empty">Nenhum processo neste recorte.</p>`}
    </section>`;
  }

  function renderPartnerView(rows) {
    let host = document.getElementById("partnerReport");
    if (!host) {
      host = document.createElement("section");
      host.id = "partnerReport";
      host.className = "partner-report";
      const anchor = document.querySelector(".resumo-area");
      anchor?.insertAdjacentElement("afterend", host);
    }
    if (!isFullyAssigned(rows)) { host.hidden = true; host.innerHTML = ""; return; }
    const s = summarize(rows);
    host.hidden = false;
    host.innerHTML = `<div class="partner-report-title"><p>VISÃO POR SÓCIO</p><h2>${esc(document.getElementById("filterInput")?.selectedOptions?.[0]?.textContent || "Relatório de Processos")}</h2><span>Primeiro Flávio, depois Ana, com resumo individual e consolidado final.</span></div>
      ${partnerSection("Flávio", s.flavio, s.fv, s.total, s.tv, "blue")}
      ${partnerSection("Ana", s.ana, s.av, s.total, s.tv, "red")}
      <section class="partner-final-summary">
        <h2>Resumo Consolidado Final</h2>
        <div class="partner-final-grid">
          <div class="final-box final-blue"><strong>Flávio Marques</strong><span>${s.flavio.length} processos</span><b>${esc(brl(s.fv))}</b><small>${pct(s.flavio.length,s.total)} da quantidade · ${pct(s.fv,s.tv)} do valor</small></div>
          <div class="final-box final-total"><strong>Total Geral</strong><span>${s.total} processos</span><b>${esc(brl(s.tv))}</b><small>100% da quantidade · 100% do valor</small></div>
          <div class="final-box final-red"><strong>Ana Paula Bonadiman Muller</strong><span>${s.ana.length} processos</span><b>${esc(brl(s.av))}</b><small>${pct(s.ana.length,s.total)} da quantidade · ${pct(s.av,s.tv)} do valor</small></div>
        </div>
      </section>`;
  }

  function refreshFromTable() {
    const rows = readTableRows();
    if (isFullyAssigned(rows)) {
      if (rows.length >= fullAssignedRows.length) fullAssignedRows = rows.map(r => ({...r}));
      renderPartnerView(rows);
    } else renderPartnerView([]);
  }

  function scheduleRefresh() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(refreshFromTable, 80);
  }

  const mainTable = document.getElementById("mainTable");
  if (mainTable) new MutationObserver(scheduleRefresh).observe(mainTable, {childList:true, subtree:true, characterData:true});
  document.getElementById("excelFile")?.addEventListener("change", () => { fullAssignedRows = []; renderPartnerView([]); }, true);

  function pdfColumns(rows) {
    return REPORT_COLS.filter(c => rows.some(r => Object.prototype.hasOwnProperty.call(r, c)));
  }

  function addSectionHeader(doc, y, name, rows, value, total, totalValue, color) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...color); doc.roundedRect(12, y, w - 24, 12, 2, 2, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont(undefined,"bold"); doc.text(name, 17, y + 8);
    const sy = y + 17;
    doc.autoTable({startY:sy, margin:{left:12,right:12}, theme:"grid",
      head:[["Quantidade","Valor Total (R$)","% Quantidade","% Valor"]],
      body:[[String(rows.length), brl(value), pct(rows.length,total), pct(value,totalValue)]],
      headStyles:{fillColor:color, textColor:[255,255,255], halign:"center"},
      bodyStyles:{halign:"center", fontSize:9, fontStyle:"bold"}, styles:{cellPadding:2.2, fontSize:8.5}});
    doc.setTextColor(20,30,50); return doc.lastAutoTable.finalY + 5;
  }

  function addPartnerPDF(doc, name, rows, value, total, totalValue, color) {
    let y = 14;
    y = addSectionHeader(doc, y, name, rows, value, total, totalValue, color);
    if (!rows.length) { doc.setFontSize(10); doc.text("Nenhum processo neste recorte.", 14, y + 6); return; }
    const cols = pdfColumns(rows);
    const body = [...rows].sort((a,b)=>String(a.Cliente||"").localeCompare(String(b.Cliente||""),"pt-BR")).map(r => cols.map(c => c === "Valor da causa" ? brl(r[c]) : (r[c] ?? "")));
    doc.autoTable({startY:y, margin:{left:8,right:8,bottom:10}, head:[cols.map(c => c === "Valor da causa" ? "Valor da causa (R$)" : c)], body,
      headStyles:{fillColor:color, textColor:[255,255,255], fontStyle:"bold"},
      styles:{fontSize:6.2, cellPadding:1.2, overflow:"linebreak"}, alternateRowStyles:{fillColor:[246,248,251]},
      didDrawPage:data=>{if(data.pageNumber>1){doc.setFontSize(7);doc.setTextColor(...color);doc.text(`${name} — continuação`, 10, 6);doc.setTextColor(20,30,50);}}
    });
  }

  function makePartnerPDF(title, rows) {
    const doc = new jspdf.jsPDF({orientation:"landscape", unit:"mm", format:"a4"});
    const s = summarize(rows), now = new Date().toLocaleString("pt-BR");
    doc.setTextColor(18,45,92); doc.setFontSize(16); doc.setFont(undefined,"bold"); doc.text(title, 12, 10);
    doc.setFontSize(7.5); doc.setFont(undefined,"normal"); doc.setTextColor(90,100,115); doc.text(`Exportado em: ${now}`, 12, 15);
    addPartnerPDF(doc, "FLÁVIO MARQUES", s.flavio, s.fv, s.total, s.tv, BLUE);
    doc.addPage();
    doc.setTextColor(18,45,92); doc.setFontSize(16); doc.setFont(undefined,"bold"); doc.text(title, 12, 10);
    doc.setFontSize(7.5); doc.setFont(undefined,"normal"); doc.setTextColor(90,100,115); doc.text(`Exportado em: ${now}`, 12, 15);
    addPartnerPDF(doc, "ANA PAULA BONADIMAN MULLER", s.ana, s.av, s.total, s.tv, RED);
    doc.addPage();
    doc.setTextColor(18,45,92); doc.setFontSize(16); doc.setFont(undefined,"bold"); doc.text("RESUMO CONSOLIDADO FINAL", 12, 14);
    doc.autoTable({startY:20, margin:{left:18,right:18}, theme:"grid",
      head:[["Sócio","Quantidade","% Quantidade","Valor Total (R$)","% Valor"]],
      body:[
        ["Flávio Marques", s.flavio.length, pct(s.flavio.length,s.total), brl(s.fv), pct(s.fv,s.tv)],
        ["Ana Paula Bonadiman Muller", s.ana.length, pct(s.ana.length,s.total), brl(s.av), pct(s.av,s.tv)],
        ["Total Geral", s.total, "100%", brl(s.tv), "100%"]
      ],
      headStyles:{fillColor:[51,65,85], textColor:[255,255,255], halign:"center"},
      columnStyles:{0:{fontStyle:"bold"}}, bodyStyles:{halign:"center", fontSize:10}, styles:{cellPadding:3}
    });
    return doc;
  }

  function currentReportTitle() {
    const sel = document.getElementById("filterInput");
    const name = sel?.value ? sel.selectedOptions[0]?.textContent : "Processos";
    return `Relatório - ${name}`;
  }

  function classify(r) {
    const type=norm(r.Tipo), dec=norm(r["Última Decisão"]), crit=norm(r.Critério);
    if(type==="EF")return"EF";
    if(crit.includes("CLIENTE ANA PAULA")||crit==="ANA")return"ANA";
    if(crit.includes("CLIENTE FLAVIO")||crit==="FLAVIO")return"FLAVIO";
    if(crit.includes("NADJA - SOLICITOU FICAR FLAVIO")||crit.includes("NADJA/FLAVIO"))return"NADJA/FLAVIO";
    if(crit==="NADJA")return"NADJA";
    if(crit.includes("COMPROMET")||crit.includes("COMPREMET"))return"COMPROMETIDO";
    if(dec==="IMPROCEDENTE")return"IMPROCEDENTE";
    if(type==="ED")return"ED";
    if(type==="EP")return"EP";
    return"ALEATORIO";
  }

  async function loadJSZip() {
    if (window.JSZip) return;
    await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";s.onload=resolve;s.onerror=()=>reject(Error("Falha ao carregar JSZip"));document.head.appendChild(s);});
  }

  async function downloadPackage() {
    const rows = fullAssignedRows.length ? fullAssignedRows : readTableRows();
    if (!isFullyAssigned(rows)) return alert("Execute os sorteios antes de gerar os relatórios do lote.");
    await loadJSZip();
    const zip = new JSZip();
    const reports = [["COMPROMETIDO","COMPROMETIDO"],["IMPROCEDENTE","IMPROCEDENTE"],["EF","EF"],["ED","ED"],["EP","EP"],["ALEATORIO","ALEATORIO SORTEADO"],["NADJA","NADJA-ANA"],["NADJA/FLAVIO","NADJA-FLAVIO"],["FLAVIO","CLIENTES FLAVIO"],["ANA","CLIENTE ANA PAULA"]];
    for (const [g,n] of reports) {
      const part = rows.filter(r => classify(r) === g);
      if (part.length) zip.file(`${n}.pdf`, makePartnerPDF(n, part).output("arraybuffer"));
    }
    zip.file("RESUMO CONSOLIDADO.pdf", makePartnerPDF("Resumo Consolidado", rows).output("arraybuffer"));
    const blob=await zip.generateAsync({type:"blob"}), url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=`Relatorios_Sorteio_${new Date().toISOString().slice(0,10)}.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  document.addEventListener("click", e => {
    const pdfBtn = e.target.closest?.("#exportPDF");
    if (pdfBtn) {
      e.preventDefault(); e.stopImmediatePropagation();
      const rows = readTableRows();
      if (!isFullyAssigned(rows)) return alert("Execute o sorteio antes de exportar o PDF por sócio.");
      makePartnerPDF(currentReportTitle(), rows).save("relatorio-processos-por-socio.pdf");
      return;
    }
    const packageBtn = e.target.closest?.("#packageBtn");
    if (packageBtn) {
      e.preventDefault(); e.stopImmediatePropagation();
      downloadPackage().catch(err => alert(err.message));
    }
  }, true);
});
