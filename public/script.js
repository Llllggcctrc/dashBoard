const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const PRODUCTS = [
  { produto: 'Smash Clássico', categoria: 'Lanche', preco: 28.90 },
  { produto: 'X-Bacon', categoria: 'Lanche', preco: 34.50 },
  { produto: 'Chicken Burger', categoria: 'Lanche', preco: 31.00 },
  { produto: 'Batata Rústica', categoria: 'Acompanhamento', preco: 18.00 },
  { produto: 'Onion Rings', categoria: 'Acompanhamento', preco: 16.50 },
  { produto: 'Refrigerante', categoria: 'Bebida', preco: 7.50 },
  { produto: 'Suco Natural', categoria: 'Bebida', preco: 11.00 },
  { produto: 'Milk-shake', categoria: 'Sobremesa', preco: 19.00 },
  { produto: 'Brownie', categoria: 'Sobremesa', preco: 14.00 }
];
const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
/* Dados iniciais gerados aqui para a página funcionar também via file://, sem fetch. */
const SAMPLE_DATA = criarDadosDemonstrativos();

let allRows = SAMPLE_DATA;
let currentSourceIsDemo = true;
let lastImportSummary = '';
let charts = {};
let sortKey = 'data';
let sortDirection = -1;

const el = {};
document.addEventListener('DOMContentLoaded', iniciar);
initializeIntro();

function initializeIntro() {
  const splash = document.getElementById('boot-splash');
  const skipButton = document.getElementById('skip-intro');
  if (!splash || !skipButton) return;

  const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    splash.hidden = true;
    return;
  }

  const finishIntro = (event) => {
    if (event && (event.target !== splash || !['splash-dismiss', 'splash-skip'].includes(event.animationName))) return;
    splash.hidden = true;
    skipButton.removeEventListener('click', skipIntro);
    document.removeEventListener('keydown', onIntroKeydown);
    splash.removeEventListener('animationend', finishIntro);
  };
  const skipIntro = () => {
    if (!splash.hidden) splash.classList.add('is-skipped');
  };
  const onIntroKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      skipIntro();
    }
  };

  skipButton.addEventListener('click', skipIntro);
  document.addEventListener('keydown', onIntroKeydown);
  splash.addEventListener('animationend', finishIntro);
}

function criarDadosDemonstrativos() {
  const rows = [];
  for (let i = 1; i <= 200; i += 1) {
    const month = ((i - 1) % 12) + 1;
    const day = ((i * 7) % 28) + 1;
    const product = PRODUCTS[(i * 7) % PRODUCTS.length];
    const quantity = (i % 4) + 1;
    rows.push({
      id_venda: `V${String(i).padStart(4, '0')}`,
      data: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      produto: product.produto,
      categoria: product.categoria,
      regiao: REGIONS[(i * 3) % REGIONS.length],
      quantidade: quantity,
      preco_unitario: product.preco,
      faturamento: quantity * product.preco
    });
  }
  return rows;
}

function iniciar() {
  [
    'import-button', 'csv-file', 'export-button', 'clear-filters', 'date-start', 'date-end',
    'category-filter', 'region-filter', 'table-search', 'sales-table-body', 'empty-state',
    'row-count', 'invalid-count', 'metric-revenue', 'metric-sales', 'metric-units',
    'metric-average', 'source-message', 'data-quality-note', 'region-note', 'filter-note'
  ].forEach((id) => { el[id] = document.getElementById(id); });

  bindEvents();
  updateFilterOptions();
  renderDashboard();
  installAmbientParallax();
}

/* Um deslocamento leve acompanha o ponteiro; não roda em toque ou movimento reduzido. */
function installAmbientParallax() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reducedMotion || !finePointer) return;

  let framePending = false;
  let driftX = 0;
  let driftY = 0;
  window.addEventListener('pointermove', (event) => {
    driftX = ((event.clientX / window.innerWidth) - 0.5) * 26;
    driftY = ((event.clientY / window.innerHeight) - 0.5) * 18;
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(() => {
      document.body.style.setProperty('--drift-x', `${driftX.toFixed(1)}px`);
      document.body.style.setProperty('--drift-y', `${driftY.toFixed(1)}px`);
      framePending = false;
    });
  }, { passive: true });
}

function bindEvents() {
  el['import-button'].addEventListener('click', () => el['csv-file'].click());
  el['csv-file'].addEventListener('change', importarCSV);
  ['date-start', 'date-end', 'category-filter', 'region-filter'].forEach((id) => {
    el[id].addEventListener('input', renderDashboard);
    el[id].addEventListener('change', renderDashboard);
  });
  el['table-search'].addEventListener('input', renderTable);
  el['clear-filters'].addEventListener('click', limparFiltros);
  el['export-button'].addEventListener('click', exportarCSV);
  document.querySelectorAll('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextKey = button.dataset.sort;
      sortDirection = nextKey === sortKey ? sortDirection * -1 : 1;
      sortKey = nextKey;
      document.querySelectorAll('[data-sort]').forEach((item) => {
        item.setAttribute('aria-sort', item.dataset.sort === sortKey ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none');
      });
      renderTable();
    });
  });
}

function limparFiltros() {
  el['date-start'].value = '';
  el['date-end'].value = '';
  el['category-filter'].value = '';
  el['region-filter'].value = '';
  el['table-search'].value = '';
  renderDashboard();
}

function atualizarControlesDeFiltro() {
  el['date-start'].value = '';
  el['date-end'].value = '';
  el['table-search'].value = '';
  const categories = uniqueValues(allRows, 'categoria');
  const regions = uniqueValues(allRows, 'regiao');
  fillSelect(el['category-filter'], 'Todas as categorias', categories);
  fillSelect(el['region-filter'], 'Todas as regiões', regions);
}

function updateFilterOptions() {
  fillSelect(el['category-filter'], 'Todas as categorias', uniqueValues(allRows, 'categoria'));
  fillSelect(el['region-filter'], 'Todas as regiões', uniqueValues(allRows, 'regiao'));
}

function fillSelect(select, defaultLabel, values) {
  const selected = select.value;
  select.replaceChildren(new Option(defaultLabel, ''));
  values.forEach((value) => select.add(new Option(value, value)));
  select.value = values.includes(selected) ? selected : '';
}

function uniqueValues(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function aplicarFiltros() {
  const start = el['date-start'].value;
  const end = el['date-end'].value;
  const category = el['category-filter'].value;
  const region = el['region-filter'].value;
  return allRows.filter((row) =>
    (!start || row.data >= start) &&
    (!end || row.data <= end) &&
    (!category || row.categoria === category) &&
    (!region || row.regiao === region)
  );
}

function renderDashboard() {
  const filtered = aplicarFiltros();
  renderMetrics(filtered);
  renderCharts(filtered);
  renderTable(filtered);
}

function renderMetrics(rows) {
  const revenue = rows.reduce((sum, row) => sum + row.faturamento, 0);
  const sales = new Set(rows.map((row) => row.id_venda)).size;
  const units = rows.reduce((sum, row) => sum + row.quantidade, 0);
  el['metric-revenue'].textContent = formatCurrency(revenue);
  el['metric-sales'].textContent = formatInteger(sales);
  el['metric-units'].textContent = formatNumber(units);
  el['metric-average'].textContent = formatCurrency(sales === 0 ? 0 : revenue / sales);
}

function renderCharts(rows) {
  const monthly = aggregate(rows, 'mes');
  const category = aggregate(rows, 'categoria');
  const region = aggregate(rows, 'regiao');
  const labelsByMonth = periodLabels(rows);
  const monthlyMap = new Map(monthly.map((item) => [item.label, item.value]));
  drawChart('monthly', 'monthly-chart', 'line', labelsByMonth.map((item) => item.label), labelsByMonth.map((item) => monthlyMap.get(item.key) || 0));
  drawChart('category', 'category-chart', 'bar', category.map((item) => item.label), category.map((item) => item.value), true);
  drawChart('region', 'region-chart', 'bar', region.map((item) => item.label), region.map((item) => item.value), true);
  const missingRegion = !currentSourceIsDemo && allRows.every((row) => row.regiao === 'Não informada');
  el['region-note'].hidden = !missingRegion;
  el['region-note'].textContent = missingRegion ? 'A base importada não tem coluna de região; os registros aparecem agrupados como “Não informada”.' : '';
}

function aggregate(rows, field) {
  const sums = new Map();
  rows.forEach((row) => {
    const key = field === 'mes' ? row.data.slice(0, 7) : row[field];
    sums.set(key, (sums.get(key) || 0) + row.faturamento);
  });
  return [...sums.entries()]
    .map(([key, value]) => ({ key, label: field === 'mes' ? key : key, value }))
    .sort((a, b) => field === 'mes' ? a.key.localeCompare(b.key) : b.value - a.value);
}

function periodLabels(rows) {
  if (rows.length === 0) return [];
  const dates = rows.map((row) => row.data).sort();
  const first = dates[0].slice(0, 7).split('-').map(Number);
  const last = dates[dates.length - 1].slice(0, 7).split('-').map(Number);
  const labels = [];
  let year = first[0];
  let month = first[1];
  while (year < last[0] || (year === last[0] && month <= last[1])) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    labels.push({ key, label: `${MONTHS[month - 1]} ${year}` });
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return labels;
}

function drawChart(name, canvasId, type, labels, values, horizontal = false) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById(canvasId);
  if (charts[name]) charts[name].destroy();
  const isLine = type === 'line';
  const context = canvas.getContext('2d');
  const gradient = isLine && context ? context.createLinearGradient(0, 0, 0, 260) : null;
  if (gradient) {
    gradient.addColorStop(0, 'rgba(72, 201, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(72, 201, 235, 0.005)');
  }
  charts[name] = new Chart(canvas, {
    type,
    data: {
      labels: labels.length ? labels : ['Sem dados'],
      datasets: [{
        label: 'Faturamento',
        data: values.length ? values : [0],
        borderColor: '#48c9eb',
        backgroundColor: isLine ? gradient : (name === 'category' ? '#3289aa' : '#289a76'),
        borderWidth: isLine ? 2.5 : 0,
        fill: isLine,
        tension: .34,
        pointRadius: isLine ? 3 : 0,
        pointHoverRadius: isLine ? 5 : 0,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
        borderRadius: horizontal ? 4 : 5,
        maxBarThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#102c3a',
          padding: 10,
          titleFont: { family: 'Space Grotesk', size: 11, weight: '600' },
          bodyFont: { family: 'Space Grotesk', size: 11 },
          callbacks: { label: (item) => ` ${formatCurrency(item.raw)}` }
        }
      },
      scales: {
        x: {
          beginAtZero: horizontal,
          grid: { display: horizontal, color: 'rgba(143, 184, 200, .12)', drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#8299a5', font: { family: 'Space Grotesk', size: 9 },
            maxRotation: 0, autoSkip: true, maxTicksLimit: name === 'monthly' ? 12 : undefined,
            callback: horizontal ? (value) => formatCompactCurrency(value) : (value) => isLine ? labels[value] : undefined
          }
        },
        y: {
          beginAtZero: !horizontal,
          grid: { display: isLine, color: 'rgba(143, 184, 200, .12)', drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#8299a5', font: { family: 'Space Grotesk', size: 9 },
            callback: horizontal ? undefined : (value) => formatCompactCurrency(value)
          }
        }
      }
    }
  });
}

function getTableRows(baseRows = aplicarFiltros()) {
  const query = el['table-search'].value.trim().toLocaleLowerCase('pt-BR');
  const visible = baseRows.filter((row) => {
    if (!query) return true;
    return [row.id_venda, row.data, row.produto, row.categoria, row.regiao]
      .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(query));
  });
  return visible.sort((a, b) => {
    const left = sortKey === 'faturamento' ? a.faturamento : a[sortKey];
    const right = sortKey === 'faturamento' ? b.faturamento : b[sortKey];
    const comparison = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''), 'pt-BR', { numeric: true });
    return comparison * sortDirection;
  });
}

function renderTable(baseRows = aplicarFiltros()) {
  if (!el['sales-table-body']) return;
  const rows = getTableRows(baseRows);
  el['sales-table-body'].replaceChildren();
  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const cells = [
      [row.id_venda, ''], [formatDate(row.data), ''], [row.produto, ''], [row.categoria, ''],
      [row.regiao, ''], [formatNumber(row.quantidade), 'numeric'], [formatCurrency(row.preco_unitario), 'numeric'],
      [formatCurrency(row.faturamento), 'numeric money-cell']
    ];
    cells.forEach(([value, className]) => {
      const td = document.createElement('td');
      td.textContent = value;
      if (className) td.className = className;
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });
  el['sales-table-body'].appendChild(fragment);
  el['empty-state'].hidden = rows.length > 0;
  el['row-count'].textContent = `${formatInteger(rows.length)} ${rows.length === 1 ? 'registro exibido' : 'registros exibidos'}`;
  const invalid = lastImportSummary;
  el['invalid-count'].textContent = invalid;
}

function importarCSV(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (typeof Papa === 'undefined') {
    el['source-message'].textContent = 'Não foi possível importar: a biblioteca Papa Parse precisa de internet.';
    return;
  }
  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (header) => normalizarCabecalho(header),
    complete: (result) => {
      const normalized = normalizarLinhas(result.data);
      if (normalized.error) {
        el['source-message'].textContent = normalized.error;
        el['csv-file'].value = '';
        return;
      }
      allRows = normalized.rows;
      currentSourceIsDemo = false;
      lastImportSummary = normalized.discarded > 0
        ? `${normalized.discarded} ${normalized.discarded === 1 ? 'linha inválida descartada' : 'linhas inválidas descartadas'}`
        : '';
      atualizarControlesDeFiltro();
      el['source-message'].textContent = `${file.name} · ${formatInteger(allRows.length)} registros válidos${normalized.discarded ? ` · ${lastImportSummary}` : ''}`;
      el['data-quality-note'].textContent = normalized.discarded
        ? `Foram descartadas ${normalized.discarded} linhas com data, quantidade ou preço ausente ou inválido.`
        : 'Arquivo importado localmente; linhas e colunas opcionais foram adaptadas.';
      const missingRegion = normalized.missingRegionColumn;
      el['filter-note'].textContent = missingRegion
        ? 'A base não tem região; a análise regional agrupa as vendas como “Não informada”.'
        : 'Os filtros atualizam os indicadores, os gráficos e a tabela.';
      renderDashboard();
      el['csv-file'].value = '';
    },
    error: () => {
      el['source-message'].textContent = 'Não foi possível ler este arquivo CSV. Confira o formato e tente novamente.';
      el['csv-file'].value = '';
    }
  });
}

function normalizarCabecalho(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizarLinhas(rows) {
  if (!rows.length) return { error: 'O CSV não contém linhas de dados.' };
  const headers = Object.keys(rows[0] || {}).map(normalizarCabecalho);
  const aliases = {
    id_venda: ['id', 'venda_id', 'id_da_venda'],
    data: ['date', 'data_venda'],
    produto: ['product', 'item'],
    categoria: ['category'],
    regiao: ['regiao', 'region', 'estado_regiao'],
    quantidade: ['quantity', 'qtd', 'unidades'],
    preco_unitario: ['preco', 'valor_unitario', 'unit_price', 'preco_por_unidade']
  };
  const columns = {};
  Object.entries(aliases).forEach(([field, choices]) => {
    columns[field] = [field, ...choices].find((candidate) => headers.includes(candidate));
  });
  const missing = ['data', 'quantidade', 'preco_unitario'].filter((field) => !columns[field]);
  if (missing.length) return { error: `CSV incompatível: não encontrei as colunas ${missing.join(', ')}.` };

  let discarded = 0;
  const normalized = [];
  rows.forEach((source, index) => {
    const get = (field) => columns[field] ? source[Object.keys(source).find((key) => normalizarCabecalho(key) === columns[field])] : '';
    const date = parseDate(get('data'));
    const quantity = parseNumber(get('quantidade'));
    const price = parseNumber(get('preco_unitario'));
    if (!date || quantity === null || price === null || quantity < 0 || price < 0) {
      discarded += 1;
      return;
    }
    const id = String(get('id_venda') || '').trim() || `Linha ${index + 1}`;
    const row = {
      id_venda: id,
      data: date,
      produto: String(get('produto') || '').trim() || 'Produto não informado',
      categoria: String(get('categoria') || '').trim() || 'Não informada',
      regiao: columns.regiao ? (String(get('regiao') || '').trim() || 'Não informada') : 'Não informada',
      quantidade: quantity,
      preco_unitario: price
    };
    row.faturamento = row.quantidade * row.preco_unitario;
    normalized.push(row);
  });
  return {
    rows: normalized,
    discarded,
    missingRegionColumn: !columns.regiao,
    error: normalized.length ? null : 'Nenhuma linha válida foi encontrada. Confira datas, quantidades e preços.'
  };
}

function parseDate(value) {
  const text = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (!match) match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (!match) return null;
  const iso = match[0].includes('-') && match[1].length === 4
    ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
    : `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  const [year, month, day] = iso.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? iso : null;
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value ?? '').trim().replace(/[\s\u00a0]/g, '').replace(/^R\$/i, '');
  if (!text) return null;
  text = text.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(text)) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
  else if (dot > comma && comma >= 0) text = text.replace(/,/g, '');
  else if (comma >= 0) text = text.replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) && /^-?\d+(\.\d+)?$/.test(text) ? number : null;
}

function exportarCSV() {
  if (typeof Papa === 'undefined') {
    el['source-message'].textContent = 'Não foi possível exportar: a biblioteca Papa Parse precisa de internet.';
    return;
  }
  const rows = getTableRows();
  const output = rows.map((row) => ({
    id_venda: row.id_venda,
    data: row.data,
    produto: row.produto,
    categoria: row.categoria,
    regiao: row.regiao,
    quantidade: row.quantidade,
    preco_unitario: row.preco_unitario,
    faturamento: row.faturamento
  }));
  const csv = '\uFEFF' + Papa.unparse(output, { delimiter: ',', escapeFormulae: true });
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.href = url;
  link.download = 'vendas-filtradas.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0);
}
function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
function formatInteger(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}
function formatCompactCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}
function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
