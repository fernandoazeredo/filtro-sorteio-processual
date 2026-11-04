window.addEventListener("DOMContentLoaded", () => {
  const THEME_STORAGE_KEY = "filtroSorteioProcessual.theme.v2";
  const SOURCE_COLS = [
    "Reclamante", "Reclamada", "Número de CNJ", "Valor da causa", "Última Decisão",
    "Sócio a gerir", "Status Antigo - Execução (REINALDO)",
    "Status Antigo - Demais (SORTEIO ANTIGO)", "Tipo"
  ];
  const DEFAULT_COLS = [...SOURCE_COLS, "Sorteado Para", "Aba de origem"];
  const REPORT_COLS = ["Reclamante", "Reclamada", "Número de CNJ", "Valor da causa", "Última Decisão", "Sorteado Para"];
  const REQUIRED = ["Reclamante"];

  let loadedFile = null;
  let master = [];
  let filtered = [];
  let available = [...DEFAULT_COLS];
  let selected = [...DEFAULT_COLS];
  let activeFilter = "";
  let pageSize = 100;
  let pageIndex = 0;
  const selectedRows = new Set();
  let batchDone = false;

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
    if (text.includes(",")) {
      text = text.replace(/\./g, "").replace(/,/g, ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, "");
    }
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
  const addProcessBtn = document.createElement("button");
  const saveBaseBtn = document.createElement("button");
  const packageBtn = document.createElement("button");
  colBtn.className = "btn btn-roxo";
  colBtn.type = "button";
  colBtn.textContent = "Escolher Colunas";
  colBtn.disabled = true;
  previewBtn.className = "btn btn-amarelo";
  previewBtn.type = "button";
  previewBtn.textContent = "Conferir Grupos";
  previewBtn.disabled = true;
  addProcessBtn.className = "btn btn-azul";
  addProcessBtn.type = "button";
  addProcessBtn.textContent = "➕ ADICIONAR PROCESSO";
  addProcessBtn.disabled = true;
  addProcessBtn.title = "Adiciona uma nova linha seguindo o modelo da Base Sorteio";
  saveBaseBtn.className = "btn btn-neutral";
  saveBaseBtn.type = "button";
  saveBaseBtn.textContent = "BAIXAR BASE ATUALIZADA";
  saveBaseBtn.disabled = true;
  saveBaseBtn.title = "Baixa em XLSX todas as alterações feitas diretamente na tabela.";
  packageBtn.className = "btn btn-azul";
  packageBtn.type = "button";
  packageBtn.id = "packageBtn";
  packageBtn.textContent = "SORTEIO EM LOTE";
  packageBtn.disabled = true;
  controls.insertBefore(colBtn, $("applyFilterBtn"));
  controls.insertBefore(previewBtn, $("applyFilterBtn"));
  controls.insertBefore(addProcessBtn, $("applyFilterBtn"));
  controls.insertBefore(saveBaseBtn, $("applyFilterBtn"));
  controls.appendChild(packageBtn);

  const editStyle = document.createElement("style");
  editStyle.textContent = `
    #tableBody td.fsp-editing{cursor:text;outline:none;background:color-mix(in srgb,#dbeafe 45%,var(--surface));box-shadow:inset 0 0 0 1px #93c5fd}
    #tableBody td.fsp-editing:focus{box-shadow:inset 0 0 0 2px #2563eb}
    #tableBody .fsp-actions{display:flex;gap:6px;align-items:center}
    #tableBody .fsp-actions .btn{padding:6px 9px;font-size:12px}
    #tableBody .fsp-cancel-row{min-width:70px}
    #tableBody .fsp-cell-input{display:block;width:100%;box-sizing:border-box;resize:vertical;font:inherit;padding:4px;border:1px solid #2563eb;border-radius:4px;background:var(--surface);color:inherit}
.tabela-area{max-height:calc(100vh - 120px);overflow:auto}
    #mainTable thead th{position:sticky;top:0;z-index:2}
    #mainTable{table-layout:fixed;width:max(100%,2240px)}
    #mainTable th,#mainTable td{overflow-wrap:anywhere;vertical-align:top}
    #mainTable th:nth-child(1){width:44px}
    #mainTable th[data-column="Reclamante"],#mainTable th[data-column="Reclamada"]{width:280px}
    #mainTable th[data-column="Sorteado Para"]{width:130px}
    #mainTable th[data-column="Número de CNJ"]{width:220px}
    #mainTable th[data-column="Valor da causa"]{width:140px}
    #mainTable th[data-column="Última Decisão"]{width:240px}
    #mainTable th[data-column="Sorteado Para"]{background:#f59e0b;color:#1f2937}
    #mainTable td[data-column="Sorteado Para"]{background:#fef3c7;color:#1f2937;font-weight:700}
    :root[data-theme="dark"] #mainTable td[data-column="Sorteado Para"]{background:#78350f;color:#fef3c7}
    #mainTable th:last-child{width:190px}
  `;
  document.head.appendChild(editStyle);
  $("drawBtn").textContent = "Executar Sorteio";

  function sourceField(row, aliases) {
    const entries = Object.entries(row || {});
    for (const alias of aliases) {
      const wanted = norm(alias);
      const found = entries.find(([key]) => norm(key) === wanted);
      if (found) return found[1] ?? "";
    }
    return "";
  }

  function headerRowIndex(sheet) {
    const preview = XLSX.utils.sheet_to_json(sheet, {header: 1, defval: "", raw: true, range: 0});
    const limit = Math.min(preview.length, 15);
    for (let index = 0; index < limit; index++) {
      const row = preview[index] || [];
      const keys = row.map(norm);
      if (keys.includes("RECLAMANTE") && (keys.includes("RECLAMADA") || keys.includes("NUMERO DE CNJ"))) return index;
    }
    return -1;
  }

  function normalizeSourceRow(row, sheetName = "") {
    const statusExecucao = sourceField(row, [
      "Status Antigo - Execução (REINALDO)", "Status Antigo - Execucao (REINALDO)"
    ]);
    const statusDemais = sourceField(row, [
      "Status Antigo - Demais (SORTEIO ANTIGO)", "Status Antigo Demais", "Status Antigo"
    ]);
    const directType = sourceField(row, ["Tipo", "Classificação", "Classificacao", "Categoria"]);
    const tipo = directType;

    return {
      "Reclamante": sourceField(row, ["Reclamante", "Cliente", "Nome do Reclamante"]),
      "Reclamada": sourceField(row, ["Reclamada", "Reclamado", "Nome da Reclamada", "Ré", "Reu", "Réu"]),
      "Número de CNJ": sourceField(row, ["Número de CNJ", "Numero de CNJ", "CNJ", "Nº", "N°", "Numero do Processo", "Número do Processo"]),
      "Valor da causa": sourceField(row, ["Valor da causa", "Valor da Causa", "Valor"]),
      "Última Decisão": sourceField(row, ["Última Decisão", "Ultima Decisao", "Última decisão", "Decisão", "Decisao"]),
      "Sócio a gerir": sourceField(row, ["Sócio a gerir", "Socio a gerir", "Sócio", "Socio"]),
      "Status Antigo - Execução (REINALDO)": statusExecucao,
      "Status Antigo - Demais (SORTEIO ANTIGO)": statusDemais,
      "Tipo": tipo,
      "Sorteado Para": sourceField(row, ["Sorteado Para"]),
      "Aba de origem": sourceField(row, ["Aba de origem", "Aba Origem"]) || sheetName
    };
  }

  function sheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const headerIndex = headerRowIndex(sheet);
    if (headerIndex < 0) return [];
    const rows = [];
    for (const raw of XLSX.utils.sheet_to_json(sheet, {defval: "", raw: true, range: headerIndex})) {
      const row = normalizeSourceRow(raw, sheetName);
      const claimant = String(row["Reclamante"] ?? "").trim();
      // O quadro de resumo fica no fim da aba e não contém processos.
      if (norm(claimant) === "QUADRO RESUMO") break;
      if (claimant) rows.push(row);
    }
    return rows;
  }

  function onlyOperationalCols(row) {
    return Object.fromEntries(DEFAULT_COLS.map(column => [column, row[column] ?? ""]));
  }

  function sheetLooksLikeStatusBase(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return false;
    const headerIndex = headerRowIndex(sheet);
    if (headerIndex < 0) return false;
    const preview = XLSX.utils.sheet_to_json(sheet, {header: 1, defval: "", raw: true, range: headerIndex});
    const headers = (preview[0] || []).map(norm);
    return headers.some(header => header.includes("STATUS ANTIGO")) || headers.includes("SOCIO A GERIR");
  }

  function extractBase(workbook) {
    const preferred = workbook.SheetNames.find(name => norm(name) === "BASE PARA SORTEIO");
    const allProcesses = workbook.SheetNames.find(name => norm(name) === "TODOS OS PROCESSOS");
    let usedSheets = [];
    let rows = [];

    if (preferred) {
      usedSheets = [preferred];
      rows = sheetRows(workbook, preferred);
    } else if (allProcesses) {
      usedSheets = [allProcesses];
      rows = sheetRows(workbook, allProcesses);
    } else {
      const statusSheets = workbook.SheetNames.filter(name => sheetLooksLikeStatusBase(workbook, name));
      if (statusSheets.length) {
        usedSheets = statusSheets;
        rows = statusSheets.flatMap(name => sheetRows(workbook, name));
      } else {
        const detailed = workbook.SheetNames.find(name => norm(name) === "ALEATORIO") || workbook.SheetNames[0];
        usedSheets = detailed ? [detailed] : [];
        rows = detailed ? sheetRows(workbook, detailed) : [];
      }
    }

    if (!rows.length) throw Error("Nenhum processo válido foi encontrado na planilha.");

    // Novo sorteio: preserva os status e o Sócio a gerir da origem, mas limpa a nova atribuição.
    const cleaned = rows.map(row => ({...onlyOperationalCols(row), "Sorteado Para": ""}));
    return {
      rows: cleaned,
      sheetName: usedSheets.length === 1 ? usedSheets[0] : `${usedSheets.length} abas operacionais`
    };
  }

  function buildGroups() {
    master.forEach(row => { row.__group = "TODOS"; });
  }

  const wordMatcher = term => {
    const text = norm(term);
    if (!text) return null;
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`);
  };

  function currentRows() {
    const matcher = wordMatcher(activeFilter);
    if (!matcher) return [...master];
    // O resultado do sorteio não entra no filtro, para a seleção não mudar depois de sortear.
    return master.filter(row => DEFAULT_COLS.some(column => column !== "Sorteado Para" && matcher.test(norm(row[column]))));
  }

  const causeValue = row => parseBRL(row["Valor da causa"]);

  // A regra de atribuição é a de reclamada-rules.js. A ordem da tela não influencia o resultado.
  function drawRows(rows) {
    const chosen = new Set(rows);
    const selection = master.filter(row => chosen.has(row));
    const snapshot = master.map(row => row["Sorteado Para"]);
    try {
      selection.forEach(row => { row["Sorteado Para"] = ""; });
      window.FSPReclamadaRules.assign(master, selection, causeValue);
      window.FSPReclamadaRules.validate(master);
    } catch (error) {
      master.forEach((row, index) => { row["Sorteado Para"] = snapshot[index]; });
      throw error;
    }
  }

  function drawAll() {
    const snapshot = master.map(row => row["Sorteado Para"]);
    try {
      master.forEach(row => { row["Sorteado Para"] = ""; });
      drawRows(master);
    } catch (error) {
      master.forEach((row, index) => { row["Sorteado Para"] = snapshot[index]; });
      throw error;
    }
  }

  window.FSPDrawState = {
    completeForBatch(file) {
      if (file !== loadedFile || !master.length) {
        throw Error("Aguarde a planilha terminar de carregar antes de executar o lote.");
      }
      drawAll();
      batchDone = master.every(row => partner(row));
      packageBtn.disabled = !batchDone;
      render(filtered);
      summaryUI(filtered);
      return master.map(row => ({...row}));
    }
  };

  $("excelFile").onchange = event => {
    const file = event.target.files[0];
    loadedFile = null;
    packageBtn.disabled = true;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const workbook = XLSX.read(new Uint8Array(ev.target.result), {type: "array", cellStyles: true});
        const result = extractBase(workbook);
        if ($("excelFile").files[0] !== file) return;
        master = result.rows;
        loadedFile = file;
        available = [...DEFAULT_COLS];
        selected = [...DEFAULT_COLS];
        buildGroups();
        filtered = [...master];
        activeFilter = "";
        pageIndex = 0;
        selectedRows.clear();
        batchDone = false;
        colBtn.disabled = false;
        previewBtn.disabled = false;
        addProcessBtn.disabled = false;
        saveBaseBtn.disabled = false;
        packageBtn.disabled = true;
        render(filtered);
        summaryUI(filtered);
        modal("Planilha carregada", `<p><strong>${master.length}</strong> registros foram lidos de <strong>${esc(result.sheetName)}</strong>.</p><p class="fsp-ok">Filtre qualquer nome, edite o que precisar e sorteie as linhas encontradas. <strong>Sorteado Para</strong> começa vazia e recebe o resultado do sorteio.</p>`);
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
    const assigned = master.filter(row => partner(row)).length;
    return `<table><thead><tr><th>Situação</th><th>Qtd.</th></tr></thead><tbody><tr><td>Com Sorteado Para</td><td>${assigned}</td></tr><tr><td>A sortear</td><td>${master.length - assigned}</td></tr></tbody></table><p><strong>Total carregado:</strong> ${master.length}</p><p class="fsp-ok">Cada reclamante fica com um único sócio.</p>`;
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

  function resultFor(rows, label) {
    const s = sum(rows);
    return `<table><thead><tr><th>Seleção</th><th>Qtd Flávio</th><th>% Qtd F.</th><th>Qtd Ana</th><th>% Qtd A.</th><th>% Valor F.</th><th>% Valor A.</th></tr></thead><tbody><tr><td>${esc(label)}</td><td>${s.fc}</td><td>${pct(s.fc, s.tc)}</td><td>${s.ac}</td><td>${pct(s.ac, s.tc)}</td><td>${pct(s.fv, s.tv)}</td><td>${pct(s.av, s.tv)}</td></tr></tbody></table>`;
  }

  const selectionLabel = () => activeFilter || "TODOS";

  function executeCurrentFilter() {
    const rows = currentRows();
    try {
      drawRows(rows);
    } catch (error) {
      return modal("Confira os reclamantes", `<p>${esc(error.message)}</p>`);
    }
    filtered = currentRows();
    render(filtered);
    summaryUI(filtered);
    batchDone = master.every(row => partner(row));
    packageBtn.disabled = !batchDone;
    const assignedAll = master.filter(row => partner(row)).length;
    modal("Sorteio concluído", `${resultFor(filtered, selectionLabel())}<p class="fsp-ok"><strong>${rows.length}</strong> linhas de <strong>${esc(selectionLabel())}</strong> foram processadas.</p><p>Base com sócio: <strong>${assignedAll}</strong> de <strong>${master.length}</strong>.</p>`);
  }

  $("drawBtn").onclick = () => {
    if (!master.length) return modal("Atenção", "<p>Selecione a planilha primeiro.</p>");
    const data = currentRows();
    if (!data.length) return modal("Sem linhas", "<p>O filtro não encontrou linhas para sortear.</p>");
    modal("Confirmar sorteio", `<p>Filtro: <strong>${esc(selectionLabel())}</strong></p><p>Linhas: <strong>${data.length}</strong></p><p>Regra: <strong>Meta de 60% Flávio / 40% Ana, mantendo cada reclamante com um único sócio</strong></p><p>O resultado será gravado em <strong>Sorteado Para</strong>. O mesmo reclamante em outras linhas recebe o mesmo sócio.</p>`, {confirmText: "Executar sorteio", onConfirm: executeCurrentFilter});
  };

  function validateAndCommitRow(row, tr) {
    for (const td of tr.querySelectorAll("td[data-column]")) {
      const input = td.querySelector(".fsp-cell-input");
      if (input) row[td.dataset.column] = input.value.trim();
    }
    buildGroups();
    filtered = currentRows();
    batchDone = master.length > 0 && master.every(r => partner(r));
    packageBtn.disabled = !batchDone;
    render(filtered);
    summaryUI(filtered);
    return true;
  }

  function setRowEditing(tr, row, editing) {
    const cells = [...tr.querySelectorAll("td[data-column]")];
    const editBtn = tr.querySelector(".fsp-edit-row");
    const deleteBtn = tr.querySelector(".fsp-delete-row");

    cells.forEach(td => {
      const column = td.dataset.column;
      td.classList.toggle("fsp-editing", editing);
      if (editing) {
        // Um campo próprio evita recalcular a tabela inteira a cada tecla em bases grandes.
        const input = document.createElement("textarea");
        input.className = "fsp-cell-input";
        input.rows = 2;
        input.spellcheck = false;
        input.value = String(row[column] ?? "");
        input.addEventListener("keydown", event => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            input.blur();
          }
        });
        td.replaceChildren(input);
      }
    });

    if (editing) {
      tr.dataset.snapshot = JSON.stringify(Object.fromEntries(DEFAULT_COLS.map(col => [col, row[col] ?? ""])));
      editBtn.textContent = "💾 Salvar";
      editBtn.title = "Salvar alterações";
      deleteBtn.textContent = "Cancelar";
      deleteBtn.title = "Cancelar edição";
      deleteBtn.classList.add("fsp-cancel-row");
    } else {
      editBtn.textContent = "✏️ Editar";
      editBtn.title = "Editar esta linha";
      deleteBtn.textContent = "🗑️";
      deleteBtn.title = "Excluir esta linha";
      deleteBtn.classList.remove("fsp-cancel-row");
      delete tr.dataset.snapshot;
    }
  }

  function syncSelectAll(box, data) {
    box.checked = data.length > 0 && data.every(row => selectedRows.has(row));
  }

  function currentPageRows(data) {
    const size = pageSize || data.length || 1;
    const lastPage = Math.max(0, Math.ceil(data.length / size) - 1);
    pageIndex = Math.min(pageIndex, lastPage);
    return data.slice(pageIndex * size, (pageIndex + 1) * size);
  }

  const pager = document.createElement("div");
  pager.id = "fspPager";
  pager.hidden = true;
  pager.innerHTML = `
    <strong id="fspPagerInfo"></strong>
    <button id="fspPagerPrev" class="btn btn-neutral" type="button">◀ Anterior</button>
    <span id="fspPagerPage"></span>
    <button id="fspPagerNext" class="btn btn-neutral" type="button">Próxima ▶</button>
    <label>Linhas por página
      <select id="fspPagerSize" class="input-text">
        <option value="100">100</option>
        <option value="250">250</option>
        <option value="500">500</option>
        <option value="0">Todas</option>
      </select>
    </label>
  `;
  document.querySelector(".tabela-area").before(pager);
  const pagerStyle = document.createElement("style");
  pagerStyle.textContent = `
    #fspPager{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 12px}
    #fspPager[hidden]{display:none}
    #fspPager label{display:flex;align-items:center;gap:6px;margin-left:auto}
    #fspPager select{width:auto}
  `;
  document.head.appendChild(pagerStyle);

  function updatePager(data) {
    pager.hidden = !data.length;
    if (!data.length) return;
    const size = pageSize || data.length;
    const first = pageIndex * size + 1;
    const last = Math.min((pageIndex + 1) * size, data.length);
    const pages = Math.ceil(data.length / size);
    $("fspPagerInfo").textContent = `Linhas ${first.toLocaleString("pt-BR")} a ${last.toLocaleString("pt-BR")} de ${data.length.toLocaleString("pt-BR")}`;
    $("fspPagerPage").textContent = `Página ${pageIndex + 1} de ${pages}`;
    $("fspPagerPrev").disabled = pageIndex === 0;
    $("fspPagerNext").disabled = pageIndex >= pages - 1;
  }

  function goToPage(index) {
    pageIndex = Math.max(0, index);
    render(filtered);
    document.querySelector(".tabela-area").scrollTop = 0;
  }

  $("fspPagerPrev").onclick = () => goToPage(pageIndex - 1);
  $("fspPagerNext").onclick = () => goToPage(pageIndex + 1);
  $("fspPagerSize").onchange = event => {
    pageSize = Number(event.target.value);
    goToPage(0);
  };

  function render(data) {
    const header = $("headerRow");
    const body = $("tableBody");
    header.innerHTML = "";
    body.innerHTML = "";
    const pageRows = currentPageRows(data);
    updatePager(data);
    if (!data.length) return;

    const chosen = selected.filter(column => available.includes(column));
    // Na tela, Sorteado Para fica ao lado dos nomes para o resultado ser visto sem rolar.
    const first = ["Reclamante", "Reclamada", "Sorteado Para"].filter(column => chosen.includes(column));
    const cols = [...first, ...chosen.filter(column => !first.includes(column))];
    const selectHeader = document.createElement("th");
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectHeader.appendChild(selectAll);
    header.appendChild(selectHeader);

    cols.forEach(column => {
      const th = document.createElement("th");
      th.textContent = column === "Valor da causa" ? "Valor da causa (R$)" : column;
      th.dataset.column = column;
      header.appendChild(th);
    });

    const actionsHeader = document.createElement("th");
    actionsHeader.textContent = "Ações";
    actionsHeader.style.whiteSpace = "nowrap";
    header.appendChild(actionsHeader);

    pageRows.forEach(row => {
      const tr = document.createElement("tr");
      const selectorCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "rowCheckbox";
      checkbox.checked = selectedRows.has(row);
      checkbox.onchange = () => {
        if (checkbox.checked) selectedRows.add(row);
        else selectedRows.delete(row);
        syncSelectAll(selectAll, data);
      };
      selectorCell.appendChild(checkbox);
      tr.appendChild(selectorCell);

      cols.forEach(column => {
        const td = document.createElement("td");
        td.dataset.column = column;
        td.spellcheck = false;
        td.textContent = column === "Valor da causa" ? brl(row[column]) : (row[column] ?? "");
        tr.appendChild(td);
      });

      const actions = document.createElement("td");
      actions.className = "fsp-actions";
      actions.style.whiteSpace = "nowrap";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-neutral fsp-edit-row";
      editBtn.textContent = "✏️ Editar";
      editBtn.title = "Editar esta linha";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-neutral fsp-delete-row";
      deleteBtn.textContent = "🗑️";
      deleteBtn.title = "Excluir esta linha";

      editBtn.onclick = () => {
        const editing = editBtn.textContent.includes("Salvar");
        if (!editing) {
          setRowEditing(tr, row, true);
          const firstCell = tr.querySelector(".fsp-cell-input");
          if (firstCell) firstCell.focus({preventScroll: true});
          return;
        }
        validateAndCommitRow(row, tr);
      };

      deleteBtn.onclick = () => {
        const cancelling = deleteBtn.classList.contains("fsp-cancel-row");
        if (cancelling) {
          const snapshot = JSON.parse(tr.dataset.snapshot || "{}");
          Object.assign(row, snapshot);
          render(filtered);
          summaryUI(filtered);
          return;
        }

        modal(
          "Excluir processo",
          `<p>Deseja realmente excluir da base o processo de <strong>${esc(row.Reclamante || "")}</strong>${row["Número de CNJ"] ? ` — ${esc(row["Número de CNJ"])}` : ""}?</p><p class="fsp-warn">A exclusão valerá para esta sessão e para a próxima base que você baixar.</p>`,
          {
            confirmText: "Excluir",
            onConfirm: () => {
              master = master.filter(item => item !== row);
              filtered = filtered.filter(item => item !== row);
              selectedRows.delete(row);
              buildGroups();
              batchDone = master.length > 0 && master.every(r => partner(r));
              packageBtn.disabled = !batchDone;
              render(filtered);
              summaryUI(filtered);
            }
          }
        );
      };

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      tr.appendChild(actions);
      body.appendChild(tr);
    });

    syncSelectAll(selectAll, data);
    selectAll.title = "Seleciona todas as linhas da lista, em todas as páginas";
    selectAll.onchange = () => {
      if (selectAll.checked) data.forEach(row => selectedRows.add(row));
      else selectedRows.clear();
      render(data);
    };
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

  function applyFilter() {
    activeFilter = $("searchInput").value.trim();
    filtered = currentRows();
    pageIndex = 0;
    selectedRows.clear();
    render(filtered);
    summaryUI(filtered);
  }

  $("applyFilterBtn").onclick = applyFilter;
  $("clearFiltersBtn").onclick = () => {
    $("searchInput").value = "";
    applyFilter();
  };

  $("searchInput").oninput = applyFilter;

  $("sortAZ").onclick = () => {
    filtered.sort((a, b) => String(a.Reclamante || "").localeCompare(String(b.Reclamante || ""), "pt-BR"));
    pageIndex = 0;
    render(filtered);
  };
  $("sortZA").onclick = () => {
    filtered.sort((a, b) => String(b.Reclamante || "").localeCompare(String(a.Reclamante || ""), "pt-BR"));
    pageIndex = 0;
    render(filtered);
  };
  $("selectAllBtn").onclick = () => {
    filtered.forEach(row => selectedRows.add(row));
    render(filtered);
  };
  $("deleteSelBtn").onclick = () => {
    if (!selectedRows.size) return;
    master = master.filter(row => !selectedRows.has(row));
    filtered = filtered.filter(row => !selectedRows.has(row));
    selectedRows.clear();
    buildGroups();
    batchDone = master.length > 0 && master.every(row => partner(row));
    packageBtn.disabled = !batchDone;
    render(filtered);
    summaryUI(filtered);
  };

  const reportCols = () => REPORT_COLS;

  function pdfFooterName(rows) {
    const s = sum(rows);
    if (s.fc && s.ac) return "Sorteio";
    if (s.fc) return "Flávio";
    if (s.ac) return "Ana";
    return "Sorteio";
  }

  function partnerSection(doc, title, category, rows, y, headFillColor) {
    const cols = reportCols();
    doc.setFillColor(...headFillColor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.rect(14, y, 269, 8, "F");
    doc.text(title, 18, y + 5.5);
    y += 10;

    doc.setTextColor(20, 30, 45);
    const startPage = doc.internal.getNumberOfPages();
    doc.autoTable({
      startY: y,
      head: [cols.map(c => c === "Valor da causa" ? "Valor da causa (R$)" : c)],
      body: rows.map(row => cols.map(c => c === "Valor da causa" ? brl(row[c]) : (row[c] ?? ""))),
      theme: "striped",
      headStyles: {fillColor: headFillColor, textColor: 255, fontSize: 6.5},
      styles: {fontSize: 6.2, cellPadding: 1.2},
      margin: {left: 14, right: 14, top: 18, bottom: 12},
      didDrawPage: () => {
        if (doc.internal.getNumberOfPages() > startPage) {
          doc.setTextColor(...headFillColor);
          doc.setFontSize(8.5);
          doc.setFont(undefined, "bold");
          doc.text(`${title} — continuação | Categoria: ${category}`, 14, 9);
          doc.setTextColor(20, 30, 45);
        }
      }
    });
    window.FSPPdfFooter.markPages(doc, startPage, doc.internal.getNumberOfPages(), partner(rows[0]));
    return doc.lastAutoTable.finalY + 6;
  }

  function makePDF(title, rows, category = title.replace(/^Relatório -\s*/, "")) {
    const doc = new jspdf.jsPDF({orientation: "landscape"});
    const when = new Date().toLocaleString("pt-BR");
    doc.setFontSize(13);
    doc.setTextColor(18, 45, 92);
    doc.setFont(undefined, "bold");
    doc.text(title, 14, 12);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 115);
    doc.text(`Exportado em: ${when}`, 14, 18);

    const flavioRows = rows.filter(row => partner(row) === "Flávio");
    const anaRows = rows.filter(row => partner(row) === "Ana");
    let y = 23;

    if (flavioRows.length) y = partnerSection(doc, "FLÁVIO MARQUES", category, flavioRows, y, [39, 72, 190]);
    if (anaRows.length) {
      if (y > 150) { doc.addPage(); y = 18; }
      y = partnerSection(doc, "ANA PAULA BONADIMAN MULLER", category, anaRows, y, [220, 38, 38]);
    }

    const s = sum(rows);
    if (y > 160) { doc.addPage(); y = 18; }
    doc.setTextColor(20, 30, 45);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("RESUMO CONSOLIDADO FINAL", 14, y);
    const summaryStartPage = doc.internal.getNumberOfPages();
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
    window.FSPPdfFooter.markPages(doc, summaryStartPage, doc.internal.getNumberOfPages(), pdfFooterName(rows));
    window.FSPPdfFooter.addFooters(doc, when, category, pdfFooterName(rows));
    return doc;
  }

  function safeReportName(name) {
    return String(name || "TODOS").replace(/[\\/:*?"<>|]/g, "-");
  }

  addProcessBtn.onclick = () => {
    if (!master.length) return modal("Sem base carregada", "<p>Selecione primeiro a Base Sorteio.</p>");

    ensureModal();
    const modalBox = $("fspModal");
    const confirm = $("fspModalConfirm");
    $("fspModalTitle").textContent = "Adicionar processo";
    $("fspModalBody").innerHTML = `
      <p>Preencha os campos conforme o modelo da <strong>Base Sorteio</strong>.</p>
      <div class="fsp-add-grid">
        <label>Reclamante<input id="fspAddReclamante" class="input-text" type="text"></label>
        <label>Reclamada<input id="fspAddReclamada" class="input-text" type="text"></label>
        <label>Número de CNJ<input id="fspAddCNJ" class="input-text" type="text" placeholder="Pode ficar vazio"></label>
        <label>Tipo<input id="fspAddTipo" class="input-text" type="text" placeholder="Opcional"></label>
        <label>Valor da causa<input id="fspAddValor" class="input-text" type="text" placeholder="Ex.: 125000,00"></label>
        <label>Última Decisão<textarea id="fspAddDecisao" class="input-text" rows="3"></textarea></label>
        <label>Sócio a gerir
          <input id="fspAddSocio" class="input-text" type="text">
        </label>
        <label>Status Antigo - Execução (REINALDO)<input id="fspAddStatusExecucao" class="input-text" type="text"></label>
        <label>Status Antigo - Demais (SORTEIO ANTIGO)<input id="fspAddStatusDemais" class="input-text" type="text"></label>
        <label>Sorteado Para
          <select id="fspAddSorteado" class="input-text">
            <option value="">Em branco</option>
            <option value="Flávio">Flávio</option>
            <option value="Ana">Ana</option>
          </select>
        </label>
      </div>
      <p id="fspAddError" class="fsp-warn" hidden></p>
    `;

    if (!document.getElementById("fspAddStyle")) {
      const style = document.createElement("style");
      style.id = "fspAddStyle";
      style.textContent = `
        .fsp-add-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .fsp-add-grid label{display:flex;flex-direction:column;gap:6px;font-weight:600}
        .fsp-add-grid textarea{resize:vertical;min-height:76px}
        @media(max-width:700px){.fsp-add-grid{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }

    confirm.hidden = false;
    confirm.textContent = "Adicionar";
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
      const reclamante = $("fspAddReclamante").value.trim();
      const reclamada = $("fspAddReclamada").value.trim();
      const cnj = $("fspAddCNJ").value.trim();
      const tipo = $("fspAddTipo").value.trim();
      const valor = $("fspAddValor").value.trim();
      const decisao = $("fspAddDecisao").value.trim();
      const socio = $("fspAddSocio").value.trim();
      const statusExecucao = $("fspAddStatusExecucao").value.trim();
      const statusDemais = $("fspAddStatusDemais").value.trim();
      const sorteado = $("fspAddSorteado").value.trim();
      const error = $("fspAddError");

      if (!reclamante) {
        error.textContent = "Informe o Reclamante.";
        error.hidden = false;
        return;
      }
      const novo = {
        "Reclamante": reclamante,
        "Reclamada": reclamada,
        "Número de CNJ": cnj,
        "Valor da causa": valor,
        "Última Decisão": decisao,
        "Sócio a gerir": socio,
        "Status Antigo - Execução (REINALDO)": statusExecucao,
        "Status Antigo - Demais (SORTEIO ANTIGO)": statusDemais,
        "Tipo": tipo,
        "Sorteado Para": sorteado,
        "Aba de origem": "ADICIONADO NO APP"
      };

      master.push(novo);
      buildGroups();

      activeFilter = "";
      $("searchInput").value = "";
      filtered = currentRows();
      selectedRows.clear();
      pageIndex = pageSize ? Math.ceil(filtered.length / pageSize) - 1 : 0;

      batchDone = master.length > 0 && master.every(row => partner(row));
      packageBtn.disabled = !batchDone;

      render(filtered);
      summaryUI(filtered);
      close();

      modal("Processo adicionado", `<p class="fsp-ok">O processo de <strong>${esc(reclamante)}</strong> foi incluído na Base Sorteio.</p><p>Total atual: <strong>${master.length}</strong> processos.</p>`);
    };
  };

  saveBaseBtn.onclick = () => {
    if (!master.length) return modal("Sem base carregada", "<p>Selecione uma planilha antes de baixar a base atualizada.</p>");
    try {
      const cols = DEFAULT_COLS;
      const rows = master.map(row => Object.fromEntries(cols.map(column => [
        column,
        column === "Valor da causa" ? parseBRL(row[column]) : (row[column] ?? "")
      ])));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows, {header: cols});
      sheet["!cols"] = [
        {wch: 38}, {wch: 48}, {wch: 27}, {wch: 18}, {wch: 48},
        {wch: 18}, {wch: 30}, {wch: 36}, {wch: 18}, {wch: 20}, {wch: 32}
      ];
      XLSX.utils.book_append_sheet(workbook, sheet, "BASE PARA SORTEIO");
      XLSX.writeFile(workbook, `BASE_SORTEIO_ATUALIZADA_${new Date().toISOString().slice(0,10)}.xlsx`);
      modal("Base atualizada gerada", `<p class="fsp-ok"><strong>${master.length}</strong> processos foram exportados com as alterações feitas diretamente no aplicativo.</p>`);
    } catch (error) {
      modal("Erro ao gerar base", `<p>${esc(error.message)}</p>`);
    }
  };

  $("exportPDF").onclick = () => {
    if (!filtered.length) return modal("Sem dados", "<p>Nenhum dado para exportar.</p>");
    const filterName = selectionLabel();
    makePDF(activeFilter ? `Relatório - ${filterName}` : "Relatório de Processos", filtered, filterName).save(`PROCESSOS - ${safeReportName(filterName)}.pdf`);
  };

  $("exportXLSX").onclick = () => {
    if (!filtered.length) return modal("Sem dados", "<p>Nenhum dado para exportar.</p>");
    const cols = reportCols();
    const rows = filtered.map(row => Object.fromEntries(cols.map(column => [column, row[column] ?? ""])));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, {header: cols}), "Dados");
    const filterName = selectionLabel();
    XLSX.writeFile(workbook, `PROCESSOS - ${safeReportName(filterName)}.xlsx`);
  };

  function reset() {
    loadedFile = null;
    master = [];
    filtered = [];
    available = [...DEFAULT_COLS];
    selected = [...DEFAULT_COLS];
    activeFilter = "";
    pageIndex = 0;
    selectedRows.clear();
    batchDone = false;
    $("excelFile").value = "";
    $("searchInput").value = "";
    $("headerRow").innerHTML = "";
    $("tableBody").innerHTML = "";
    colBtn.disabled = true;
    previewBtn.disabled = true;
    addProcessBtn.disabled = true;
    saveBaseBtn.disabled = true;
    packageBtn.disabled = true;
    summaryUI([]);
  }

  const cancelDrawBtn = document.createElement("button");
  cancelDrawBtn.id = "cancelDrawBtn";
  cancelDrawBtn.type = "button";
  cancelDrawBtn.className = "btn btn-laranja";
  cancelDrawBtn.textContent = "APAGAR SORTEIO";
  cancelDrawBtn.title = "Remove apenas as atribuições da coluna Sorteado Para; preserva todos os processos";
  $("drawBtn").insertAdjacentElement("afterend", cancelDrawBtn);
  cancelDrawBtn.onclick = () => {
    if (!master.length) return modal("Sem base carregada", "<p>Selecione uma planilha antes de cancelar o sorteio.</p>");
    const assigned = master.filter(row => partner(row)).length;
    if (!assigned) return modal("Sorteio não realizado", "<p>A coluna Sorteado Para já está vazia.</p>");
    modal("Confirmar cancelamento do sorteio",
      `<p>As atribuições de <strong>${assigned}</strong> processos serão apagadas da coluna <strong>Sorteado Para</strong>.</p><p>Os processos, valores, CNJs e demais informações serão preservados.</p><p class="fsp-warn"><strong>Antes de cancelar:</strong> exporte uma cópia da base atual se deseja guardar o resultado anterior.</p>`,
      {confirmText: "Confirmar cancelamento", onConfirm: () => {
        master.forEach(row => { row["Sorteado Para"] = ""; });
        batchDone = false;
        packageBtn.disabled = true;
        filtered = currentRows();
        render(filtered);
        summaryUI(filtered);
        modal("Sorteio cancelado", `<p class="fsp-ok">As atribuições de <strong>${assigned}</strong> processos foram removidas apenas da base carregada no navegador. Para obter o Excel sem atribuições, clique em <strong>BAIXAR BASE ATUALIZADA</strong>.</p>`);
      }});
  };
    $("clearBtn").onclick = reset;
});

