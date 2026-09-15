window.addEventListener("DOMContentLoaded", () => {
  const THEME_STORAGE_KEY = "filtroSorteioProcessual.theme.v2";
  const SOURCE_COLS = ["Cliente", "Número de CNJ", "Tipo", "Valor da causa", "Última Decisão"];
  const DEFAULT_COLS = [...SOURCE_COLS, "Sorteado Para"];
  const REQUIRED = [...SOURCE_COLS];

  const RANDOM_GROUPS = ["ALEATORIO", "IMPROCEDENTE", "COMPROMETIDO", "ED", "EF", "EP"];
  const FIXED_GROUPS = ["ANA", "FLAVIO", "NADJA", "NADJA/FLAVIO"];
  const ALL_GROUPS = [...RANDOM_GROUPS, ...FIXED_GROUPS];

  const labels = {
    ALEATORIO: "ALEATÓRIO",
    IMPROCEDENTE: "IMPROCEDENTE",
    COMPROMETIDO: "COMPROMETIDO",
    ED: "ED",
    EF: "EF",
    EP: "EP",
    ANA: "ANA MULLER",
    FLAVIO: "FLÁVIO MARQUES",
    NADJA: "NADJA/ANA",
    "NADJA/FLAVIO": "NADJA/FLÁVIO"
  };

  let master = [];
  let filtered = [];
  let available = [...DEFAULT_COLS];
  let selected = [...DEFAULT_COLS];
  let activeFilter = "";
  let batchDone = false;
  let groupMap = new Map();

  const $ = id => document.getElementById(id);
  const norm = value => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));

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
  const partner = row => {
    const value = norm(row["Sorteado Para"]);
    if (value.includes("ANA")) return "Ana";
    if (value.includes("FLAVIO")) return "Flávio";
    return "";
  };

  function ensureModal() {
    if ($("fspModal")) return;
    const box = document.createElement("div");
    box.id = "fspModal";
    box.hidden = true;
    box.innerHTML = `<div class="fsp-modal-backdrop"></div><section class="fsp-modal-card" role="dialog" aria-modal="true" aria-labelledby="fspModalTitle"><header><h2 id="fspModalTitle"></h2><button id="fspModalX" type="button" aria-label="Fechar">×</button></header><div id="fspModalBody"></div><footer><button id="fspModalCancel" class="btn btn-neutral" type="button">Fechar</button><button id="fspModalConfirm" class="btn btn-sorteio" type="button" hidden>Confirmar</button></footer></section>`;
    document.body.appendChild(box);
    const style = document.createElement("style");
    style.textContent = `#fspModal{position:fixed;inset:0;z-index:1500;display:grid;place-items:center;padding:16px}#fspModal[hidden]{display:none}.fsp-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.74)}.fsp-modal-card{position:relative;width:min(860px,100%);max-height:90vh;overflow:auto;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.fsp-modal-card header,.fsp-modal-card footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:var(--summary-header-bg)}.fsp-modal-card header{border-bottom:1px solid var(--border)}.fsp-modal-card footer{border-top:1px solid var(--border);justify-content:flex-end}.fsp-modal-card header button{border:0;background:transparent;color:var(--text);font-size:28px;cursor:pointer}.fsp-modal-card #fspModalBody{padding:20px;line-height:1.55}.fsp-modal-card table{width:100%;margin-top:10px}.fsp-modal-card th,.fsp-modal-card td{padding:8px;border:1px solid var(--border);font-size:13px}.fsp-ok{padding:10px 12px;border-radius:7px;background:color-mix(in srgb,#dcfce7 75%,var(--surface));border:1px solid #86efac}.fsp-warn{padding:10px 12px;border-radius:7px;background:color-mix(in srgb,#fef9c3 75%,var(--surface));border:1px solid #facc15}`;
    document.head.appendChild(style);
  }

  function modal(title, html, {confirmText = "", onConfirm = null} = {}) {
    ensureModal();
    const modalBox = $("fspModal");
    const confirm = $("fspModalConfirm");
    $("fspModalTitle").textContent = title;
    $("fspModalBody").innerHTML = html;
    confirm.hidden = !confirmText;
    confirm.textContent = confirmText || "Confirmar";
    modalBox.hidden = false;
    document.body.classList.add("modal-open");
    const close = () => {
      modalBox.hidden = true;
      document.body.classList.remove("modal-open");
    };
    $("fspModalX").onclick = close;
    $("fspModalCancel").onclick = close;
    modalBox.querySelector(".fsp-modal-backdrop").onclick = close;
    confirm.onclick = () => {
      close();
      if (onConfirm) onConfirm();
    };
  }

  function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("themeToggle").setAttribute("aria-pressed", String(dark));
    $("themeLabel").textContent = dark ? "Modo claro" : "Modo escuro";
  }

  setTheme(localStorage.getItem(THEME_STORAGE_KEY) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("themeToggle").onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  const tips = $("tipsDialog");
  const closeTips = () => {
    tips.hidden = true;
    document.body.classList.remove("modal-open");
  };
  $("tipsBtn").onclick = () => {
    tips.hidden = false;
    document.body.classList.add("modal-open");
  };
  $("tipsCloseBtn").onclick = closeTips;
  $("tipsCloseFooterBtn").onclick = closeTips;
  tips.addEventListener("click", event => {
    if (event.target.hasAttribute("data-close-tips")) closeTips();
  });

  const controls = document.querySelector(".controls");
  const colBtn = document.createElement("button");
  const previewBtn = document.createElement("button");
  const packageBtn = document.createElement("button");
  colBtn.className = "btn btn-roxo";
  colBtn.type = "button";
  colBtn.textContent = "Escolher Colunas";
  colBtn.disabled = true;
  previewBtn.className = "btn btn-amarelo";
  previewBtn.type = "button";
  previewBtn.textContent = "Conferir Grupos";
  previewBtn.disabled = true;
  packageBtn.className = "btn btn-azul";
  packageBtn.type = "button";
  packageBtn.id = "packageBtn";
  packageBtn.textContent = "Baixar Relatórios do Lote";
  packageBtn.disabled = true;
  controls.insertBefore(colBtn, $("applyFilterBtn"));
  controls.insertBefore(previewBtn, $("applyFilterBtn"));
  controls.appendChild(packageBtn);
  $("drawBtn").textContent = "Executar Sorteio por filtro";

  function typeToGroup(value) {
    const type = norm(value);
    const map = {
      "ALEATORIO": "ALEATORIO",
      "IMPROCEDENTE": "IMPROCEDENTE",
      "COMPROMETIDO": "COMPROMETIDO",
      "ED": "ED",
      "EF": "EF",
      "EP": "EP",
      "ANA MULLER": "ANA",
      "FLAVIO MARQUES": "FLAVIO",
      "NADJA/ANA": "NADJA",
      "NADJA/FLAVIO": "NADJA/FLAVIO"
    };
    return map[type] || "";
  }

  function sheetRows(workbook, sheetName) {
    if (!workbook.Sheets[sheetName]) return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {defval: "", raw: true})
      .filter(row => String(row.Cliente ?? "").trim());
  }

  function onlyOperationalCols(row) {
    const out = {};
    SOURCE_COLS.forEach(column => out[column] = row[column] ?? "");
    out["Sorteado Para"] = "";
    return out;
  }

  function extractBase(workbook) {
    const preferred = workbook.SheetNames.find(name => norm(name) === "BASE PARA SORTEIO");
    const sheetName = preferred || workbook.SheetNames[0];
    const rows = sheetRows(workbook, sheetName);
    if (!rows.length) throw Error("Nenhum processo válido foi encontrado na planilha.");

    const first = rows[0];
    const missing = REQUIRED.filter(column => !Object.prototype.hasOwnProperty.call(first, column));
    if (missing.length) throw Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);

    const cleaned = rows.map(onlyOperationalCols);
    const invalid = cleaned
      .map((row, index) => ({line: index + 2, type: row.Tipo, group: typeToGroup(row.Tipo)}))
      .filter(item => !item.group);

    if (invalid.length) {
      const sample = invalid.slice(0, 12).map(item => `linha ${item.line}: ${item.type || "(vazio)"}`).join("<br>");
      throw Error(`Existem ${invalid.length} processo(s) com Tipo inválido ou vazio. Corrija a coluna Tipo antes do sorteio.<br>${sample}`);
    }

    return {rows: cleaned, sheetName};
  }

  function buildGroups() {
    groupMap = new Map(ALL_GROUPS.map(group => [group, []]));
    for (const row of master) {
      const group = typeToGroup(row.Tipo);
      row.__group = group;
      groupMap.get(group).push(row);
    }
  }

  const groupRows = group => groupMap.get(group) || [];
  const clearGroupAssignments = group => groupRows(group).forEach(row => row["Sorteado Para"] = "");

  function assignFixedGroup(group) {
    const name = ["ANA", "NADJA"].includes(group) ? "Ana" : "Flávio";
    groupRows(group).forEach(row => row["Sorteado Para"] = name);
    return groupRows(group).length;
  }

  function quota(rows) {
    const flavio = Math.round(rows.length * 0.60);
    return {flavio, ana: rows.length - flavio};
  }

  function assignRandom(group) {
    const pending = groupRows(group).filter(row => !partner(row));
    if (!pending.length) return 0;

    const q = quota(pending);
    const totalValue = pending.reduce((sum, row) => sum + Math.max(0, parseBRL(row["Valor da causa"])), 0);
    const ordered = [...pending].sort((a, b) =>
      Math.max(0, parseBRL(b["Valor da causa"])) - Math.max(0, parseBRL(a["Valor da causa"])) ||
      String(a.Cliente || "").localeCompare(String(b.Cliente || ""), "pt-BR")
    );

    let fc = 0, ac = 0, fv = 0, processedValue = 0;
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
      const flavioRows = pending.filter(row => partner(row) === "Flávio");
      const anaRows = pending.filter(row => partner(row) === "Ana");
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

    return pending.length;
  }

  $("excelFile").onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const workbook = XLSX.read(new Uint8Array(ev.target.result), {type: "array", cellStyles: true});
        const result = extractBase(workbook);
        master = result.rows;
        available = [...DEFAULT_COLS];
        selected = [...DEFAULT_COLS];
        buildGroups();
        filtered = [...master];
        activeFilter = "";
        batchDone = false;
        colBtn.disabled = false;
        previewBtn.disabled = false;
        packageBtn.disabled = true;
        render(filtered);
        summaryUI(filtered);
        modal("Planilha carregada", `<p><strong>${master.length}</strong> processos foram lidos da aba <strong>${esc(result.sheetName)}</strong>.</p><p class="fsp-ok">O aplicativo utiliza somente: <strong>Cliente, Número de CNJ, Tipo, Valor da causa, Última Decisão e Sorteado Para</strong>. A coluna <strong>Sorteado Para</strong> foi zerada para este novo sorteio.</p>`);
      } catch (error) {
        modal("Erro ao ler planilha", `<p>${error.message}</p>`);
        reset();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  colBtn.onclick = () => {
    const numbered = available.map((column, index) => `${index + 1}. ${column}${REQUIRED.includes(column) ? " [essencial]" : ""}`).join("\n");
    const defaults = selected.map(column => available.indexOf(column) + 1).filter(n => n > 0).join(",");
    const answer = prompt(`Escolha as colunas da tela e dos relatórios.\n\n${numbered}`, defaults);
    if (answer === null) return;
    const numbers = answer.split(/[,;\s]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= available.length);
    selected = available.filter((column, index) => numbers.includes(index + 1) || REQUIRED.includes(column));
    if (!selected.includes("Sorteado Para")) selected.push("Sorteado Para");
    render(filtered);
  };

  function previewHtml() {
    let rows = "";
    for (const group of ALL_GROUPS) {
      const data = groupRows(group);
      const isRandom = RANDOM_GROUPS.includes(group);
      const rule = isRandom ? "60/40 qtd.+valor" : (["ANA", "NADJA"].includes(group) ? "100% Ana" : "100% Flávio");
      const q = isRandom ? quota(data) : null;
      rows += `<tr><td>${labels[group]}</td><td>${data.length}</td><td>${rule}</td><td>${q ? `${q.flavio} Flávio / ${q.ana} Ana` : rule}</td></tr>`;
    }
    return `<table><thead><tr><th>Tipo</th><th>Qtd.</th><th>Regra</th><th>Cota de quantidade</th></tr></thead><tbody>${rows}</tbody></table><p><strong>Total carregado:</strong> ${master.length}</p><p class="fsp-ok">A classificação acima vem exclusivamente da coluna <strong>Tipo</strong>.</p>`;
  }

  previewBtn.onclick = () => modal("Conferência dos grupos", previewHtml());

  function sum(data) {
    let ac = 0, av = 0, fc = 0, fv = 0;
    data.forEach(row => {
      const p = partner(row);
      const value = parseBRL(row["Valor da causa"]);
      if (p === "Ana") { ac++; av += value; }
      else if (p === "Flávio") { fc++; fv += value; }
    });
    return {ac, av, fc, fv, tc: ac + fc, tv: av + fv};
  }

  function resultForGroup(group) {
    const s = sum(groupRows(group));
    return `<table><thead><tr><th>Tipo</th><th>Qtd Flávio</th><th>% Qtd F.</th><th>Qtd Ana</th><th>% Qtd A.</th><th>% Valor F.</th><th>% Valor A.</th></tr></thead><tbody><tr><td>${labels[group]}</td><td>${s.fc}</td><td>${pct(s.fc, s.tc)}</td><td>${s.ac}</td><td>${pct(s.ac, s.tc)}</td><td>${pct(s.fv, s.tv)}</td><td>${pct(s.av, s.tv)}</td></tr></tbody></table>`;
  }

  function executeCurrentFilter() {
    if (!activeFilter) return modal("Selecione um filtro", "<p>Escolha um filtro e clique em <strong>Aplicar Filtro</strong> antes de executar.</p>");
    const rows = groupRows(activeFilter);
    if (!rows.length) return modal("Filtro sem processos", `<p>O filtro <strong>${labels[activeFilter]}</strong> não possui processos.</p>`);

    clearGroupAssignments(activeFilter);
    const count = RANDOM_GROUPS.includes(activeFilter) ? assignRandom(activeFilter) : assignFixedGroup(activeFilter);
    filtered = groupRows(activeFilter);
    render(filtered);
    summaryUI(filtered);

    const assignedAll = master.filter(row => partner(row)).length;
    batchDone = assignedAll === master.length;
    packageBtn.disabled = !batchDone;

    modal("Sorteio do filtro concluído", `${resultForGroup(activeFilter)}<p class="fsp-ok"><strong>${count}</strong> processos do Tipo <strong>${labels[activeFilter]}</strong> foram processados.</p>${batchDone ? `<p class="fsp-ok">Todos os <strong>${master.length}</strong> processos já possuem atribuição.</p>` : `<p>Progresso do lote: <strong>${assignedAll}</strong> de <strong>${master.length}</strong>.</p>`}`);
  }

  $("drawBtn").onclick = () => {
    if (!master.length) return modal("Atenção", "<p>Selecione a planilha primeiro.</p>");
    if (!activeFilter) return modal("Selecione um filtro", "<p>Escolha um filtro, clique em <strong>Aplicar Filtro</strong> e depois execute o sorteio.</p>");
    const data = groupRows(activeFilter);
    const isRandom = RANDOM_GROUPS.includes(activeFilter);
    const q = isRandom ? quota(data) : null;
    const rule = isRandom ? `${q.flavio} Flávio / ${q.ana} Ana, equilibrando quantidade e valor` : (["ANA", "NADJA"].includes(activeFilter) ? "100% Ana" : "100% Flávio");
    modal("Confirmar sorteio por filtro", `<p>Tipo: <strong>${labels[activeFilter]}</strong></p><p>Processos: <strong>${data.length}</strong></p><p>Regra: <strong>${rule}</strong></p><p>Somente este Tipo será processado. Os demais permanecerão inalterados.</p>`, {confirmText: "Executar este filtro", onConfirm: executeCurrentFilter});
  };

  function render(data) {
    const header = $("headerRow");
    const body = $("tableBody");
    header.innerHTML = "";
    body.innerHTML = "";
    if (!data.length) return;

    const cols = selected.filter(column => available.includes(column));
    const selectHeader = document.createElement("th");
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectHeader.appendChild(selectAll);
    header.appendChild(selectHeader);

    cols.forEach(column => {
      const th = document.createElement("th");
      th.textContent = column === "Valor da causa" ? "Valor da causa (R$)" : column;
      header.appendChild(th);
    });

    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      const selectorCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "rowCheckbox";
      checkbox.dataset.index = index;
      selectorCell.appendChild(checkbox);
      tr.appendChild(selectorCell);

      cols.forEach(column => {
        const td = document.createElement("td");
        td.textContent = column === "Valor da causa" ? brl(row[column]) : (row[column] ?? "");
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    selectAll.onchange = () => document.querySelectorAll(".rowCheckbox").forEach(box => box.checked = selectAll.checked);
  }

  function summaryUI(data) {
    const s = sum(data);
    $("qtdAna").textContent = s.ac;
    $("percentAna").textContent = pct(s.ac, s.tc);
    $("valorAna").textContent = brl(s.av);
    $("percentValorAna").textContent = pct(s.av, s.tv);
    $("qtdFlavio").textContent = s.fc;
    $("percentFlavio").textContent = pct(s.fc, s.tc);
    $("valorFlavio").textContent = brl(s.fv);
    $("percentValorFlavio").textContent = pct(s.fv, s.tv);
    $("qtdTotal").textContent = s.tc;
    $("valorTotal").textContent = brl(s.tv);
  }

  function filterValueToGroup(value) {
    const normalized = norm(value);
    const map = {
      "ALEATORIO": "ALEATORIO",
      "IMPROCEDENTE": "IMPROCEDENTE",
      "COMPROMETIDO": "COMPROMETIDO",
      "ED": "ED",
      "EF": "EF",
      "EP": "EP",
      "ANA MULLER": "ANA",
      "FLAVIO MARQUES": "FLAVIO",
      "NADJA/ANA": "NADJA",
      "NADJA/FLAVIO": "NADJA/FLAVIO"
    };
    return map[normalized] || "";
  }

  function applyFilter() {
    const group = filterValueToGroup($("filterInput").value);
    if (!group) return modal("Filtro inválido", "<p>Selecione um Tipo válido.</p>");
    activeFilter = group;
    filtered = groupRows(group);
    render(filtered);
    summaryUI(filtered);
  }

  $("applyFilterBtn").onclick = applyFilter;
  $("clearFiltersBtn").onclick = () => {
    $("searchInput").value = "";
    $("filterInput").value = "";
    activeFilter = "";
    filtered = [...master];
    render(filtered);
    summaryUI(filtered);
  };

  $("searchInput").oninput = () => {
    const text = norm($("searchInput").value);
    activeFilter = "";
    filtered = master.filter(row => Object.entries(row).some(([key, value]) => !key.startsWith("__") && norm(value).includes(text)));
    render(filtered);
    summaryUI(filtered);
  };

  $("sortAZ").onclick = () => {
    filtered.sort((a, b) => String(a.Cliente || "").localeCompare(String(b.Cliente || ""), "pt-BR"));
    render(filtered);
  };
  $("sortZA").onclick = () => {
    filtered.sort((a, b) => String(b.Cliente || "").localeCompare(String(a.Cliente || ""), "pt-BR"));
    render(filtered);
  };
  $("selectAllBtn").onclick = () => document.querySelectorAll(".rowCheckbox").forEach(box => box.checked = true);
  $("deleteSelBtn").onclick = () => {
    const indexes = [...document.querySelectorAll(".rowCheckbox:checked")].map(box => +box.dataset.index).sort((a, b) => b - a);
    for (const index of indexes) {
      const item = filtered[index];
      master = master.filter(row => row !== item);
      filtered.splice(index, 1);
    }
    buildGroups();
    batchDone = master.length > 0 && master.every(row => partner(row));
    packageBtn.disabled = !batchDone;
    render(filtered);
    summaryUI(filtered);
  };

  const reportCols = () => DEFAULT_COLS;

  function partnerSection(doc, title, rows, y, headFillColor) {
    const cols = reportCols();
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

  function makePDF(title, rows) {
    const doc = new jspdf.jsPDF({orientation: "landscape"});
    doc.setFontSize(13);
    doc.setTextColor(18, 45, 92);
    doc.setFont(undefined, "bold");
    doc.text(title, 14, 12);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 115);
    doc.text(`Exportado em: ${new Date().toLocaleString("pt-BR")}`, 14, 18);

    const flavioRows = rows.filter(row => partner(row) === "Flávio");
    const anaRows = rows.filter(row => partner(row) === "Ana");
    let y = 23;

    if (flavioRows.length) y = partnerSection(doc, "FLÁVIO MARQUES", flavioRows, y, [39, 72, 190]);
    if (anaRows.length) {
      if (y > 150) { doc.addPage(); y = 18; }
      y = partnerSection(doc, "ANA PAULA BONADIMAN MULLER", anaRows, y, [220, 38, 38]);
    }

    const s = sum(rows);
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

  $("exportPDF").onclick = () => {
    if (!filtered.length) return modal("Sem dados", "<p>Nenhum dado para exportar.</p>");
    makePDF(activeFilter ? `Relatório - ${labels[activeFilter]}` : "Relatório de Processos", filtered).save("relatorio-processos.pdf");
  };

  $("exportXLSX").onclick = () => {
    if (!filtered.length) return modal("Sem dados", "<p>Nenhum dado para exportar.</p>");
    const cols = reportCols();
    const rows = filtered.map(row => Object.fromEntries(cols.map(column => [column, row[column] ?? ""])));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, {header: cols}), "Dados");
    XLSX.writeFile(workbook, "relatorio-processos.xlsx");
  };

  async function loadJSZip() {
    if (window.JSZip) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = resolve;
      script.onerror = () => reject(Error("Falha ao carregar JSZip"));
      document.head.appendChild(script);
    });
  }

  packageBtn.onclick = async () => {
    if (!batchDone) return modal("Atenção", "<p>Conclua todos os filtros antes de baixar os relatórios consolidados.</p>");
    try {
      await loadJSZip();
      const zip = new JSZip();
      const reports = [
        ["ALEATORIO", "ALEATORIO"], ["IMPROCEDENTE", "IMPROCEDENTE"], ["COMPROMETIDO", "COMPROMETIDO"],
        ["ED", "ED"], ["EF", "EF"], ["EP", "EP"], ["ANA", "ANA MULLER"], ["FLAVIO", "FLAVIO MARQUES"],
        ["NADJA", "NADJA-ANA"], ["NADJA/FLAVIO", "NADJA-FLAVIO"]
      ];
      for (const [group, name] of reports) {
        const rows = groupRows(group);
        if (rows.length) zip.file(`${name}.pdf`, makePDF(name, rows).output("arraybuffer"));
      }
      zip.file("RESUMO CONSOLIDADO.pdf", makePDF("Resumo Consolidado", master).output("arraybuffer"));
      const blob = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Relatorios_Sorteio_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      modal("Erro ao gerar relatórios", `<p>${esc(error.message)}</p>`);
    }
  };

  function reset() {
    master = [];
    filtered = [];
    available = [...DEFAULT_COLS];
    selected = [...DEFAULT_COLS];
    activeFilter = "";
    batchDone = false;
    groupMap = new Map();
    $("excelFile").value = "";
    $("searchInput").value = "";
    $("filterInput").value = "";
    $("headerRow").innerHTML = "";
    $("tableBody").innerHTML = "";
    colBtn.disabled = true;
    previewBtn.disabled = true;
    packageBtn.disabled = true;
    summaryUI([]);
  }

  $("clearBtn").onclick = reset;
});
