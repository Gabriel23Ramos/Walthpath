// ════════════════════════════════════════════════════════
// ESTADO — Cloud (MongoDB) quando logado, localStorage como fallback
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// FIREBASE CONFIG — substitua pelos seus valores do Firebase Console
// ════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD2z0nnftdMBoZ_OHjJnEiMcbnmG5Bk-ew",
  authDomain:        "wealth-path-2adeb.firebaseapp.com",
  projectId:         "wealth-path-2adeb",
  storageBucket:     "wealth-path-2adeb.firebasestorage.app",
  messagingSenderId: "1033420606284",
  appId:             "1:1033420606284:web:4ba880838f8ac860dc1de9",
  measurementId:     "G-TC1RSVVC40"
};

// Firebase SDK (carregado via CDN no HTML)
let _db   = null;   // Firestore
let _auth = null;   // Auth
let _user = null;   // usuário logado
let _isLoggedIn = false;

// Inicializa Firebase (chamado após scripts carregarem)
function initFirebase() {
  if (typeof firebase === "undefined") return;
  firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _db   = firebase.firestore();

  _auth.onAuthStateChanged(async (user) => {
    _user = user;
    _isLoggedIn = !!user;
    updateSidebarUser(user);
    if (user) {
      await loadCloudData();
    }
    renderDashboard();
  });
}

// Atualiza sidebar e topbar com info do usuário
function updateSidebarUser(user) {
  const nameEl   = document.getElementById("sidebarName");
  const roleEl   = document.getElementById("sidebarRole");
  const avatarEl = document.getElementById("sidebarAvatar");
  // topbar
  const profileLabel  = document.getElementById("profileLabel");
  const profileAvatar = document.getElementById("profileAvatar");

  if (user) {
    const displayName = user.displayName || user.email.split("@")[0];
    const initial     = displayName[0].toUpperCase();

    if (nameEl)   nameEl.textContent   = displayName;
    if (roleEl)   roleEl.textContent   = user.email;
    if (avatarEl) avatarEl.textContent = initial;

    // topbar: mostra nome e avatar com inicial
    if (profileLabel)  profileLabel.textContent  = displayName.split(" ")[0];
    if (profileAvatar) profileAvatar.innerHTML =
      `<span style="font-size:12px;font-weight:800;letter-spacing:-0.5px">${initial}</span>`;
  } else {
    if (nameEl)   nameEl.textContent   = "Visitante";
    if (roleEl)   roleEl.textContent   = "Não autenticado";
    if (avatarEl) avatarEl.textContent = "?";

    // topbar: volta para ícone padrão e texto "Entrar"
    if (profileLabel)  profileLabel.textContent  = "Entrar";
    if (profileAvatar) profileAvatar.innerHTML =
      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
}

// Clique no perfil: se logado -> logout, se não -> vai para login
async function handleProfileClick() {
  if (_isLoggedIn && _auth) {
    await _auth.signOut();
    // Limpa localStorage e reseta para estado vazio (não demo)
    localStorage.removeItem("ff_tx");
    localStorage.removeItem("ff_goals");
    localStorage.removeItem("ff_debts");
    localStorage.removeItem("ff_fixed");
    transactions = [];
    goals        = [];
    debts        = [];
    fixed        = [];
    renderDashboard();
    showToast("Até logo! 👋", "ok");
  } else {
    window.location.href = "./login.html";
  }
}

// Dados padrão para visitantes (demo)
const DEFAULT_GOALS = [
  { id:1, name:'Reserva de emergência', icon:'🛡️', color:'#3b82f6', target:10000, saved:3200 },
  { id:2, name:'Viagem de férias',      icon:'✈️', color:'#10b981', target:5000,  saved:1750 },
  { id:3, name:'Novo notebook',         icon:'💻', color:'#8b5cf6', target:3500,  saved:2800 },
];
const DEFAULT_DEBTS = [
  {
    id:1, name:'Cartão Nubank', icon:'💳', color:'#8b5cf6', venc:'dia 10',
    tipo:'cartao', limite:5000, faturamento: new Date().toISOString().substring(0,7),
    itens:[
      { id:101, desc:'iFood - Delivery', valor:89.90, categoria:'🍔 Alimentação', data:'2026-04-01', pago:false },
      { id:102, desc:'Netflix',           valor:39.90, categoria:'📺 Streaming',   data:'2026-04-02', pago:false },
      { id:103, desc:'Posto de gasolina', valor:150,   categoria:'⛽ Combustível', data:'2026-04-03', pago:true  },
    ],
  },
  {
    id:2, name:'Financiamento Moto', icon:'🏍️', color:'#f59e0b', venc:'dia 5',
    tipo:'parcelas', total:15000, valorParcela:312.50, totalParcelas:48, parcelasPagas:18,
    historico:[{ parcela:18, valor:312.50, data:'2026-03-05', obs:'Pix' }],
  },
];
const DEFAULT_FIXED = [
  { id:1, name:'Aluguel',  icon:'🏠', day:5,  value:1200  },
  { id:2, name:'Internet', icon:'📶', day:10, value:99.90 },
  { id:3, name:'Netflix',  icon:'🎬', day:15, value:39.90 },
  { id:4, name:'Spotify',  icon:'🎵', day:1,  value:21.90 },
  { id:5, name:'Academia', icon:'🏋️', day:1,  value:80    },
];

// Estado inicial vazio — dados carregados da nuvem após login
let transactions = [];
let goals        = [];
let debts        = [];
let fixed        = [];

// ── Funções de persistência inteligentes ──────────────
async function saveCollection(name, data) {
  const lsKey = name === "transactions" ? "ff_tx" : `ff_${name}`;
  localStorage.setItem(lsKey, JSON.stringify(data));
  if (_isLoggedIn && _db && _user) {
    try {
      await _db.collection("users").doc(_user.uid)
        .collection("finance").doc(name)
        .set({ data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      console.warn("Firestore save error:", e.message);
    }
  }
}

function saveTx()    { saveCollection('transactions', transactions); }
function saveGoals() { saveCollection('goals', goals); }
function saveDebts() { saveCollection('debts', debts); }
function saveFixed() { saveCollection('fixed', fixed); }

// ── Carrega dados da API (usuário logado) ─────────────
async function loadCloudData() {
  if (!_db || !_user) return;
  try {
    const base = _db.collection("users").doc(_user.uid).collection("finance");
    const [txSnap, goalsSnap, debtsSnap, fixedSnap] = await Promise.all([
      base.doc("transactions").get(),
      base.doc("goals").get(),
      base.doc("debts").get(),
      base.doc("fixed").get(),
    ]);
    if (txSnap.exists    && Array.isArray(txSnap.data().data))    transactions = txSnap.data().data;
    if (goalsSnap.exists && Array.isArray(goalsSnap.data().data)) goals        = goalsSnap.data().data;
    if (debtsSnap.exists && Array.isArray(debtsSnap.data().data)) debts        = debtsSnap.data().data;
    if (fixedSnap.exists && Array.isArray(fixedSnap.data().data)) fixed        = fixedSnap.data().data;
    // Sincroniza localStorage
    localStorage.setItem("ff_tx",    JSON.stringify(transactions));
    localStorage.setItem("ff_goals", JSON.stringify(goals));
    localStorage.setItem("ff_debts", JSON.stringify(debts));
    localStorage.setItem("ff_fixed", JSON.stringify(fixed));
  } catch (e) {
    console.warn("Não foi possível carregar dados da nuvem:", e.message);
  }
}

let currentType   = 'income';
let currentPeriod = 7;
let flowChartRef, catChartRef;
let payingDebtId  = null;
let activeCardId  = null; // cartão aberto no detalhe

const TODAY     = new Date();
let selectedMonth = TODAY.getMonth();
let selectedYear  = TODAY.getFullYear();

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ════════════════════════════════════════════════════════
// NAVEGAÇÃO DE MÊS
// ════════════════════════════════════════════════════════
function updateMonthUI() {
  const isCurrent = selectedMonth === TODAY.getMonth() && selectedYear === TODAY.getFullYear();
  const lbl = document.getElementById('monthTag');
  const nxt = document.getElementById('monthNextBtn');
  if (lbl) lbl.textContent = `${MONTHS_PT[selectedMonth]} ${selectedYear}`;
  if (nxt) nxt.disabled = isCurrent;
}

function changeMonth(dir) {
  let m = selectedMonth + dir, y = selectedYear;
  if (m < 0)  { m = 11; y--; }
  if (m > 11) { m = 0;  y++; }
  if (y > TODAY.getFullYear() || (y === TODAY.getFullYear() && m > TODAY.getMonth())) return;
  selectedMonth = m; selectedYear = y;
  updateMonthUI();
  renderDashboard();
}

// ════════════════════════════════════════════════════════
// NAVEGAÇÃO DE PÁGINAS
// ════════════════════════════════════════════════════════
const PAGES = {
  dashboard:    { title:'Dashboard',     sub:'Visão geral das suas finanças' },
  transactions: { title:'Transações',    sub:'Histórico completo de entradas e saídas' },
  goals:        { title:'Metas',         sub:'Acompanhe seus objetivos financeiros' },
  debts:        { title:'Dívidas',       sub:'Controle dívidas e cartões de crédito' },
  fixed:        { title:'Gastos Fixos',  sub:'Despesas que se repetem todo mês' },
  detail:       { title:'Detalhes',      sub:'Análise detalhada' },
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('.nitem').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');
  if (name === 'detail') document.getElementById('nav-dashboard')?.classList.add('active');
  const cfg = PAGES[name];
  if (cfg) {
    document.getElementById('pageTitle').textContent = cfg.title;
    document.getElementById('pageSub').textContent   = cfg.sub;
  }
  if (name === 'dashboard')    renderDashboard();
  if (name === 'transactions') renderAllTx();
  if (name === 'goals')        renderGoals();
  if (name === 'debts')        renderDebts();
  if (name === 'fixed')        renderFixed();
  closeSidebar();
}

// ════════════════════════════════════════════════════════
// TEMA
// ════════════════════════════════════════════════════════
function setTheme(theme, btn) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ff_theme', theme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  setTimeout(renderCharts, 80);
}

// ════════════════════════════════════════════════════════
// MODAL TRANSAÇÃO
// ════════════════════════════════════════════════════════
function openModal() {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('fDate').valueAsDate = new Date();
  setTimeout(() => document.getElementById('fDesc').focus(), 300);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  ['fDesc','fValue','fCat'].forEach(id => { document.getElementById(id).value = ''; });
  setType('income');
}

function overlayClick(e) { if (e.target.id === 'overlay') closeModal(); }

function setType(type) {
  currentType = type;
  document.getElementById('tabInc').classList.toggle('active', type === 'income');
  document.getElementById('tabExp').classList.toggle('active', type === 'expense');
}

function addTransaction() {
  const desc   = document.getElementById('fDesc').value.trim();
  const amount = parseFloat(document.getElementById('fValue').value);
  const date   = document.getElementById('fDate').value;
  const catRaw = document.getElementById('fCat').value;
  if (!desc)               return showToast('Digite uma descrição!','err');
  if (!amount || amount<=0) return showToast('Digite um valor válido!','err');
  if (!date)               return showToast('Selecione uma data!','err');
  if (!catRaw)             return showToast('Selecione uma categoria!','err');
  const [category, icon] = catRaw.split('|');
  transactions.unshift({ id:Date.now(), type:currentType, desc, amount, date, category, icon });
  saveTx();
  closeModal();
  renderDashboard();
  showToast('Transação salva! ✓','ok');
}

function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTx();
  renderDashboard();
  renderAllTx();
  showToast('Removida.','ok');
}

// saveTx definida no topo (cloud + localStorage)

// ════════════════════════════════════════════════════════
// MODAL METAS
// ════════════════════════════════════════════════════════
function openGoalModal() {
  document.getElementById('goalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('gName').focus(), 300);
}

function closeGoalModal() {
  document.getElementById('goalOverlay').classList.remove('open');
  ['gName','gTarget','gSaved'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('gSaved').value = '0';
}

function addGoal() {
  const name   = document.getElementById('gName').value.trim();
  const target = parseFloat(document.getElementById('gTarget').value);
  const saved  = parseFloat(document.getElementById('gSaved').value) || 0;
  const icon   = document.getElementById('gIcon').value;
  const color  = document.getElementById('gColor').value;
  if (!name)              return showToast('Digite o nome da meta!','err');
  if (!target || target<=0) return showToast('Digite o valor da meta!','err');
  if (saved > target)     return showToast('O valor guardado não pode ser maior que a meta!','err');
  goals.push({ id:Date.now(), name, target, saved, icon, color });
  saveGoals();
  closeGoalModal();
  renderGoals();
  renderDashboard();
  showToast('Meta criada! 🎯','ok');
}

function deleteGoal(id) {
  goals = goals.filter(g => g.id !== id);
  saveGoals();
  renderGoals();
  renderDashboard();
  showToast('Meta removida.','ok');
}

function addToGoal(id) {
  const goal = goals.find(g => g.id === id);
  if (!goal) return;
  const amount = parseFloat(prompt(`Quanto adicionar à meta "${goal.name}"?\nAtual: ${fmt(goal.saved)} de ${fmt(goal.target)}`));
  if (!amount || amount <= 0) return;
  goal.saved = Math.min(goal.saved + amount, goal.target);
  saveGoals();
  renderGoals();
  renderDashboard();
  showToast(`${fmt(amount)} adicionado! 💰`, 'ok');
}

// saveGoals definida no topo (cloud + localStorage)

// ════════════════════════════════════════════════════════
// DÍVIDAS — modal tipo selector
// ════════════════════════════════════════════════════════
function openDebtModal() {
  document.getElementById('debtOverlay').classList.add('open');
  setTimeout(() => document.getElementById('dName').focus(), 300);
}

function closeDebtModal() {
  document.getElementById('debtOverlay').classList.remove('open');
  ['dName','dTotal','dTotalParcelas','dValorParcela','dParcelasPagas','dVenc','dLimite'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const pp = document.getElementById('dParcelasPagas');
  if (pp) pp.value = '0';
  selectDebtTipo('parcelas');
}

let currentDebtTipo = 'parcelas';

function selectDebtTipo(tipo) {
  currentDebtTipo = tipo;
  document.getElementById('dtipoParcelas').classList.toggle('active', tipo === 'parcelas');
  document.getElementById('dtipoCartao').classList.toggle('active', tipo === 'cartao');
  document.getElementById('debtFieldsParcelas').style.display = tipo === 'parcelas' ? 'block' : 'none';
  document.getElementById('debtFieldsCartao').style.display   = tipo === 'cartao'   ? 'block' : 'none';
}

function addDebt() {
  const name  = document.getElementById('dName').value.trim();
  const icon  = document.getElementById('dIcon').value;
  const color = document.getElementById('dColor').value;
  const venc  = document.getElementById('dVenc').value.trim() || '—';
  const alertDays = parseInt(document.getElementById('dAlert').value) || 5;
  // Extrai número do dia do vencimento para alertas (ex: "dia 10" → 10)
  const vencDay = parseInt(venc.replace(/\D/g,'')) || null;

  if (!name) return showToast('Digite o nome da dívida!','err');

  if (currentDebtTipo === 'parcelas') {
    const total         = parseFloat(document.getElementById('dTotal').value);
    const totalParcelas = parseInt(document.getElementById('dTotalParcelas').value);
    const valorParcela  = parseFloat(document.getElementById('dValorParcela').value);
    const parcelasPagas = parseInt(document.getElementById('dParcelasPagas').value) || 0;

    if (!total || total <= 0)                return showToast('Digite o valor total!','err');
    if (!totalParcelas || totalParcelas <= 0) return showToast('Digite o nº de parcelas!','err');
    if (!valorParcela || valorParcela <= 0)   return showToast('Digite o valor da parcela!','err');
    if (parcelasPagas > totalParcelas)        return showToast('Parcelas pagas maior que o total!','err');

    debts.push({
      id: Date.now(), name, icon, color, venc, vencDay, alertDays,
      tipo: 'parcelas',
      total, totalParcelas, valorParcela, parcelasPagas,
      historico: [],
    });

  } else {
    // cartão
    const limite = parseFloat(document.getElementById('dLimite').value) || 0;
    debts.push({
      id: Date.now(), name, icon, color, venc, vencDay, alertDays,
      tipo: 'cartao',
      limite,
      faturamento: new Date().toISOString().substring(0,7),
      itens: [],
    });
  }

  saveDebts();
  closeDebtModal();
  renderDebts();
  renderDashboard();
  showToast('Dívida adicionada! 💳','ok');
}

function deleteDebt(id) {
  debts = debts.filter(d => d.id !== id);
  saveDebts();
  renderDebts();
  renderDashboard();
  showToast('Dívida removida.','ok');
}

// saveDebts definida no topo (cloud + localStorage)

// ── Seletor de cor ──────────────────────────────
function selectColor(prefix, btn, color) {
  document.querySelectorAll(`#${prefix}ColorPicker .color-opt`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`${prefix}Color`).value = color;
}

// ════════════════════════════════════════════════════════
// PAGAMENTO DE PARCELA
// ════════════════════════════════════════════════════════
function openPayDebtModal(id) {
  payingDebtId = id;
  const debt = debts.find(d => d.id === id);
  if (!debt) return;
  document.getElementById('payDebtName').textContent    = debt.name;
  document.getElementById('payDebtParcela').textContent = `Parcela ${debt.parcelasPagas + 1} de ${debt.totalParcelas}`;
  document.getElementById('payDebtValor').value         = debt.valorParcela.toFixed(2);
  document.getElementById('payDebtData').valueAsDate    = new Date();
  document.getElementById('payDebtObs').value           = '';
  document.getElementById('payDebtOverlay').classList.add('open');
}

function closePayDebtModal() {
  document.getElementById('payDebtOverlay').classList.remove('open');
  payingDebtId = null;
}

function confirmPayDebt() {
  const debt = debts.find(d => d.id === payingDebtId);
  if (!debt) return;
  const valor = parseFloat(document.getElementById('payDebtValor').value);
  const data  = document.getElementById('payDebtData').value;
  const obs   = document.getElementById('payDebtObs').value.trim();
  if (!valor || valor <= 0) return showToast('Digite o valor pago!','err');
  if (!data)                return showToast('Selecione a data!','err');
  if (!debt.historico) debt.historico = [];
  debt.historico.push({ parcela: debt.parcelasPagas + 1, valor, data, obs: obs || null });
  debt.parcelasPagas = Math.min(debt.parcelasPagas + 1, debt.totalParcelas);
  saveDebts();
  closePayDebtModal();
  renderDebts();
  renderDashboard();
  showToast(`Parcela ${debt.parcelasPagas}/${debt.totalParcelas} paga! ✓`, 'ok');
}

// ════════════════════════════════════════════════════════
// CARTÃO DE CRÉDITO — itens
// ════════════════════════════════════════════════════════
function openCardDetail(id) {
  activeCardId = id;
  const card = debts.find(d => d.id === id);
  if (!card) return;
  document.getElementById('cardDetailTitle').textContent = card.name;
  document.getElementById('cardDetailLimit').textContent = card.limite ? fmt(card.limite) : '—';
  document.getElementById('cardDetailVenc').textContent  = card.venc;
  document.getElementById('ciData').valueAsDate = new Date();
  renderCardItens(id);
  document.getElementById('cardDetailOverlay').classList.add('open');
}

function closeCardDetail() {
  document.getElementById('cardDetailOverlay').classList.remove('open');
  activeCardId = null;
}

function renderCardItens(id) {
  const card = debts.find(d => d.id === id);
  if (!card) return;
  const itens = card.itens || [];
  const total    = itens.reduce((s,i) => s + (i.valorParcela ?? i.valor ?? 0), 0);
  const pago     = itens.filter(i => i.pago).reduce((s,i) => s + (i.valorParcela ?? i.valor ?? 0), 0);
  const pendente = total - pago;

  document.getElementById('cardTotalVal').textContent    = fmt(total);
  document.getElementById('cardPagoVal').textContent     = fmt(pago);
  document.getElementById('cardPendenteVal').textContent = fmt(pendente);

  // Botão pagar fatura completa
  const payAllWrap = document.getElementById('cardPayAllWrap');
  const payAllTotal = document.getElementById('cardPayAllTotal');
  if (payAllWrap && payAllTotal) {
    const itensPendentes = itens.filter(i => !i.pago);
    if (itensPendentes.length > 0) {
      payAllWrap.style.display = 'block';
      payAllTotal.textContent = fmt(pendente);
    } else {
      payAllWrap.style.display = 'none';
    }
  }

  const listEl = document.getElementById('cardItensList');
  if (itens.length === 0) {
    listEl.innerHTML = `<div class="empty" style="padding:32px 20px"><div class="empty-icon">🧾</div><div class="empty-text">Nenhum gasto no cartão ainda.<br>Clique em "+ Adicionar gasto" para começar.</div></div>`;
    return;
  }

  listEl.innerHTML = itens.map(item => {
    const vParcela = item.valorParcela ?? item.valor ?? 0;
    const isParc   = (item.totalParcelas ?? 1) > 1;
    const badge    = isParc
      ? `<span style="background:rgba(212,175,55,0.14);color:var(--acc);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;margin-left:5px">${item.parcelaAtual}/${item.totalParcelas}×</span>`
      : '';
    const sub = isParc
      ? `${item.categoria} · ${fmtDate(item.data)} · Total ${fmt(item.valorTotal)}`
      : `${item.categoria} · ${fmtDate(item.data)}`;
    return `
    <div class="card-item ${item.pago ? 'card-item-pago' : ''}">
      <div class="card-item-ico">${item.categoria.split(' ')[0]}</div>
      <div class="card-item-info">
        <div class="card-item-desc">${item.desc}${badge}</div>
        <div class="card-item-cat">${sub}</div>
      </div>
      <div class="card-item-right">
        <div class="card-item-val">${fmt(vParcela)}</div>
        <button class="card-item-toggle ${item.pago ? 'pago' : ''}" onclick="toggleCardItemPago(${id},${item.id})">
          ${item.pago ? '✓ Pago' : 'Marcar pago'}
        </button>
      </div>
      <button class="icon-btn" onclick="deleteCardItem(${id},${item.id})" title="Remover">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`;
  }).join('');
}

function calcParcela() {
  const valor    = parseFloat(document.getElementById('ciValor').value) || 0;
  const parcelas = parseInt(document.getElementById('ciParcelas').value) || 1;
  const por = parcelas > 0 ? valor / parcelas : 0;
  const parcelaInput = document.getElementById('ciParcelaDisplay');
  parcelaInput.value = por > 0 ? por.toFixed(2) : '';
  // Garante que parcela atual não ultrapasse o total
  const atualInput = document.getElementById('ciParcelaAtual');
  if (parseInt(atualInput.value) > parcelas) atualInput.value = parcelas;
  atualInput.max = parcelas;
}

function onParcelaManual() {
  // Usuário digitou a parcela manualmente — atualiza o valor total
  const parcelas  = parseInt(document.getElementById('ciParcelas').value) || 1;
  const parcelaVal = parseFloat(document.getElementById('ciParcelaDisplay').value) || 0;
  const totalCalc = parcelaVal * parcelas;
  if (totalCalc > 0) {
    document.getElementById('ciValor').value = totalCalc.toFixed(2);
  }
}

function addCardItem() {
  const card = debts.find(d => d.id === activeCardId);
  if (!card) return;

  const desc         = document.getElementById('ciDesc').value.trim();
  const valorTotal   = parseFloat(document.getElementById('ciValor').value);
  const totalParc    = parseInt(document.getElementById('ciParcelas').value) || 1;
  const parcelaAtual = parseInt(document.getElementById('ciParcelaAtual').value) || 1;
  const cat          = document.getElementById('ciCat').value;
  const data         = document.getElementById('ciData').value;

  if (!desc)                      return showToast('Digite a descrição!','err');
  if (!valorTotal || valorTotal<=0) return showToast('Digite o valor!','err');
  if (!data)                      return showToast('Selecione a data!','err');
  if (parcelaAtual > totalParc)   return showToast('Parcela atual maior que o total!','err');

  // Usa valor da parcela digitado manualmente se disponível
  const parcelaManual = parseFloat(document.getElementById('ciParcelaDisplay').value);
  const valorParcela  = parcelaManual > 0
    ? parseFloat(parcelaManual.toFixed(2))
    : parseFloat((valorTotal / totalParc).toFixed(2));

  if (!card.itens) card.itens = [];
  card.itens.push({
    id: Date.now(),
    desc,
    valorTotal,
    valorParcela,
    totalParcelas: totalParc,
    parcelaAtual,
    categoria: cat,
    data,
    pago: false,
    // retrocompat: mantém valor = valorParcela
    valor: valorParcela,
  });

  saveDebts();
  renderCardItens(activeCardId);
  renderDebts();

  // Limpa campos
  document.getElementById('ciDesc').value        = '';
  document.getElementById('ciValor').value       = '';
  document.getElementById('ciParcelas').value    = '1';
  document.getElementById('ciParcelaAtual').value= '1';
  document.getElementById('ciParcelaDisplay').value = '';
  showToast('Gasto adicionado! 🧾','ok');
}

function toggleCardItemPago(cardId, itemId) {
  const card = debts.find(d => d.id === cardId);
  if (!card) return;
  const item = (card.itens || []).find(i => i.id === itemId);
  if (!item) return;
  item.pago = !item.pago;

  const vParcela = item.valorParcela ?? item.valor ?? 0;
  const today = new Date().toISOString().substring(0,10);

  if (item.pago) {
    // Lança despesa nas transações
    const txId = Date.now() + Math.floor(Math.random()*1000);
    item._txId = txId; // guarda referência para desfazer
    const parcLabel = (item.totalParcelas ?? 1) > 1
      ? ` (${item.parcelaAtual}/${item.totalParcelas}×)`
      : '';
    transactions.unshift({
      id: txId,
      type: 'expense',
      desc: `💳 ${card.name} — ${item.desc}${parcLabel}`,
      amount: vParcela,
      date: today,
      category: item.categoria || 'Cartão',
      icon: '💳',
      _fromCard: true,
    });
    saveTx();
    showToast(`Despesa de ${fmt(vParcela)} lançada ✓`, 'ok');
  } else {
    // Remove a despesa correspondente
    if (item._txId) {
      transactions = transactions.filter(t => t.id !== item._txId);
      item._txId = undefined;
      saveTx();
    }
    showToast('Desmarcado — despesa removida', 'ok');
  }

  saveDebts();
  renderCardItens(cardId);
  renderDebts();
  renderDashboard();
}

function pagarFaturaCompleta(cardId) {
  const card = debts.find(d => d.id === cardId);
  if (!card) return;
  const itens = (card.itens || []).filter(i => !i.pago);
  if (itens.length === 0) return showToast('Todos os itens já foram pagos!', 'ok');

  const today = new Date().toISOString().substring(0,10);
  const total = itens.reduce((s, i) => s + (i.valorParcela ?? i.valor ?? 0), 0);

  itens.forEach(item => {
    item.pago = true;
    const txId = Date.now() + Math.floor(Math.random()*9999);
    item._txId = txId;
    const parcLabel = (item.totalParcelas ?? 1) > 1
      ? ` (${item.parcelaAtual}/${item.totalParcelas}×)`
      : '';
    transactions.unshift({
      id: txId,
      type: 'expense',
      desc: `💳 ${card.name} — ${item.desc}${parcLabel}`,
      amount: item.valorParcela ?? item.valor ?? 0,
      date: today,
      category: item.categoria || 'Cartão',
      icon: '💳',
      _fromCard: true,
    });
  });

  saveTx();
  saveDebts();
  renderCardItens(cardId);
  renderDebts();
  renderDashboard();
  showToast(`Fatura paga! ${fmt(total)} lançado nas despesas 🎉`, 'ok');
}

function deleteCardItem(cardId, itemId) {
  const card = debts.find(d => d.id === cardId);
  if (!card) return;
  card.itens = (card.itens || []).filter(i => i.id !== itemId);
  saveDebts();
  renderCardItens(cardId);
  renderDebts();
  showToast('Item removido.','ok');
}

// ════════════════════════════════════════════════════════
// GASTOS FIXOS
// ════════════════════════════════════════════════════════
function openFixedModal() {
  document.getElementById('fixedOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fxName').focus(), 300);
}

function closeFixedModal() {
  document.getElementById('fixedOverlay').classList.remove('open');
  ['fxName','fxValue','fxDay'].forEach(id => { document.getElementById(id).value = ''; });
}

function addFixed() {
  const name  = document.getElementById('fxName').value.trim();
  const value = parseFloat(document.getElementById('fxValue').value);
  const day   = parseInt(document.getElementById('fxDay').value);
  const icon  = document.getElementById('fxIcon').value;
  const alertDays = parseInt(document.getElementById('fxAlert').value) || 5;
  if (!name)               return showToast('Digite o nome!','err');
  if (!value || value <= 0) return showToast('Digite o valor!','err');
  if (!day || day<1 || day>31) return showToast('Dia inválido (1–31)!','err');
  fixed.push({ id:Date.now(), name, value, day, icon, alertDays });
  saveFixed();
  closeFixedModal();
  renderFixed();
  renderDashboard();
  showToast('Gasto fixo adicionado! 📅','ok');
}

function closeFixedModal() {
  document.getElementById('fixedOverlay').classList.remove('open');
  ['fxName','fxValue','fxDay'].forEach(id => { document.getElementById(id).value = ''; });
}

function deleteFixed(id) {
  fixed = fixed.filter(f => f.id !== id);
  saveFixed();
  renderFixed();
  renderDashboard();
  showToast('Gasto fixo removido.','ok');
}

// saveFixed definida no topo (cloud + localStorage)

// ════════════════════════════════════════════════════════
// FORMATAÇÃO
// ════════════════════════════════════════════════════════
function fmt(v) { return Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }

function fmtDate(str) {
  if (!str) return '—';
  const [,m,d] = str.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

function txHTML(tx) {
  const isInc = tx.type === 'income';
  return `
    <div class="tx-item">
      <div class="tx-ico" style="background:${isInc?'var(--ga)':'var(--ra)'}">${tx.icon||'💰'}</div>
      <div class="tx-info">
        <div class="tx-name">${tx.desc}</div>
        <div class="tx-cat"><span class="tx-badge ${isInc?'tx-badge-inc':'tx-badge-exp'}">${tx.category}</span></div>
      </div>
      <div class="tx-date">${fmtDate(tx.date)}</div>
      <div class="tx-amount ${isInc?'tx-amount-inc':'tx-amount-exp'}">${isInc?'+':'-'}${fmt(tx.amount)}</div>
      <div class="tx-actions">
        <button class="icon-btn" onclick="deleteTx(${tx.id})" title="Remover">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
function renderDashboard() {
  const month = selectedMonth, year = selectedYear;
  const isCurrent = month === TODAY.getMonth() && year === TODAY.getFullYear();

  const monthTx = transactions.filter(tx => {
    const d = new Date(tx.date + 'T12:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income  = monthTx.filter(t=>t.type==='income') .reduce((s,t)=>s+t.amount, 0);
  const expense = monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount, 0);
  const balance = transactions.reduce((s,t)=>t.type==='income'?s+t.amount:s-t.amount, 0);
  const savings = income - expense;

  document.getElementById('totalBalance').textContent = fmt(balance);
  document.getElementById('totalIncome').textContent  = fmt(income);
  document.getElementById('totalExpense').textContent = fmt(expense);
  document.getElementById('totalSavings').textContent = fmt(savings);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';

  // Banner
  const bm = document.getElementById('bannerMonth');
  if (bm) bm.textContent = MONTHS_PT[month] + ' ' + year;
  const bt = document.getElementById('bannerTxCount');
  if (bt) bt.textContent = monthTx.length + (monthTx.length === 1 ? ' transação' : ' transações');
  const bs = document.getElementById('bannerStatus');
  if (bs) {
    if (!isCurrent)   { bs.textContent='📅 Histórico'; bs.style.color='var(--t2)'; }
    else if(savings>0){ bs.textContent='✅ Positivo';  bs.style.color='var(--green)'; }
    else if(savings<0){ bs.textContent='⚠️ Atenção';   bs.style.color='var(--red)'; }
    else              { bs.textContent='—'; bs.style.color='var(--t2)'; }
  }

  // Resumo metas
  const dg = document.getElementById('dashGoalsSummary');
  if (dg) {
    if (goals.length === 0) {
      dg.innerHTML = `<p style="font-size:12px;color:var(--t2)">Nenhuma meta cadastrada.</p>`;
    } else {
      dg.innerHTML = goals.slice(0,3).map(g => {
        const pct = Math.round(g.saved/g.target*100);
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--t2);margin-bottom:4px">
            <span>${g.icon} ${g.name}</span><span style="color:var(--t1);font-weight:700">${pct}%</span>
          </div>
          <div class="prog-bar" style="margin:0"><div class="prog-fill" style="width:${pct}%;background:${g.color}"></div></div>
        </div>`;
      }).join('');
    }
  }

  // Resumo dívidas
  const dd = document.getElementById('dashDebtsSummary');
  if (dd) {
    if (debts.length === 0) {
      dd.innerHTML = `<p style="font-size:12px;color:var(--t2)">Nenhuma dívida cadastrada.</p>`;
    } else {
      const totalResta = debts.reduce((s,d) => {
        if (d.tipo === 'cartao') {
          return s + (d.itens||[]).filter(i=>!i.pago).reduce((ss,i)=>ss+(i.valorParcela||i.valor||0),0);
        }
        return s + Math.max((d.total || 0) - (d.parcelasPagas||0)*(d.valorParcela||0), 0);
      }, 0);
      dd.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:4px">
          <span style="font-size:12px;color:var(--t2)">${debts.length} dívida${debts.length>1?'s':''} ativas</span>
          <span style="font-family:var(--fh);font-size:16px;font-weight:800;color:var(--red)">${fmt(totalResta)}</span>
        </div>
        <div style="font-size:11px;color:var(--t2)">Total a pagar</div>`;
    }
  }

  // Resumo fixos
  const df = document.getElementById('dashFixedSummary');
  if (df) {
    if (fixed.length === 0) {
      df.innerHTML = `<p style="font-size:12px;color:var(--t2)">Nenhum gasto fixo cadastrado.</p>`;
    } else {
      const totalFixed = fixed.reduce((s,f)=>s+f.value,0);
      df.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:4px">
          <span style="font-size:12px;color:var(--t2)">${fixed.length} gasto${fixed.length>1?'s':''} fixos</span>
          <span style="font-family:var(--fh);font-size:16px;font-weight:800;color:var(--red)">${fmt(totalFixed)}<span style="font-size:11px;font-weight:400">/mês</span></span>
        </div>
        <div style="font-size:11px;color:var(--t2)">Total fixo por mês</div>`;
    }
  }

  // Lista recente
  const listEl = document.getElementById('recentList');
  if (listEl) {
    listEl.innerHTML = transactions.length === 0
      ? `<div class="empty"><div class="empty-icon">💸</div><div class="empty-text">Nenhuma transação ainda.<br>Clique em <b>"+ Nova Transação"</b> para começar!</div></div>`
      : transactions.slice(0,5).map(txHTML).join('');
  }

  renderCharts();
  renderAlerts();
}

function renderAllTx() {
  const el = document.getElementById('allList');
  if (el) el.innerHTML = transactions.length === 0
    ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Nenhuma transação ainda.</div></div>`
    : transactions.map(txHTML).join('');
}

// ════════════════════════════════════════════════════════
// ALERTAS DE VENCIMENTO
// ════════════════════════════════════════════════════════
function renderAlerts() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayDay   = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear  = today.getFullYear();
  const alerts = [];

  // ── Gastos fixos ─────────────────────────────────────
  fixed.forEach(f => {
    if (!f.day) return;
    const alertDays = f.alertDays || 5;
    // Data de vencimento deste mês
    let vencDate = new Date(todayYear, todayMonth, f.day);
    // Se já passou, considera o próximo mês
    if (vencDate < today) {
      vencDate = new Date(todayYear, todayMonth + 1, f.day);
    }
    const diffMs   = vencDate - today;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays <= alertDays && diffDays >= 0) {
      alerts.push({
        icon: f.icon, name: f.name, valor: f.value,
        diffDays, vencDate,
        urgency: diffDays === 0 ? 'today' : diffDays <= 2 ? 'urgent' : 'soon',
        tipo: 'fixo',
        id: f.id,
      });
    }
  });

  // ── Dívidas e Cartões ─────────────────────────────────
  debts.forEach(d => {
    const done = d.tipo === 'parcelas' && (d.parcelasPagas||0) >= (d.totalParcelas||1);
    if (done) return;
    const vencDay   = d.vencDay || parseInt((d.venc||'').replace(/\D/g,'')) || null;
    if (!vencDay) return;
    const alertDays = d.alertDays || 5;

    let vencDate = new Date(todayYear, todayMonth, vencDay);
    if (vencDate < today) {
      vencDate = new Date(todayYear, todayMonth + 1, vencDay);
    }
    const diffMs   = vencDate - today;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays <= alertDays && diffDays >= 0) {
      let valor = 0;
      if (d.tipo === 'parcelas') {
        valor = d.valorParcela || 0;
      } else {
        // cartão: soma pendente
        valor = (d.itens||[]).filter(i=>!i.pago).reduce((s,i)=>s+(i.valorParcela||i.valor||0),0);
      }
      alerts.push({
        icon: d.icon, name: d.name, valor,
        diffDays, vencDate,
        urgency: diffDays === 0 ? 'today' : diffDays <= 2 ? 'urgent' : 'soon',
        tipo: d.tipo,
        id: d.id,
      });
    }
  });

  // Ordena por urgência
  alerts.sort((a,b) => a.diffDays - b.diffDays);

  const section = document.getElementById('alertsSection');
  const list    = document.getElementById('alertsList');
  const sub     = document.getElementById('alertsSubtitle');
  if (!section || !list) return;

  if (alerts.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  if (sub) sub.textContent = `${alerts.length} conta${alerts.length>1?'s':''} vencendo em breve`;

  const urgencyLabel = {
    today:  { label: 'Vence hoje!',   color: 'var(--red)',    bg: 'rgba(244,63,94,0.12)',  pulse: true  },
    urgent: { label: 'Vence em breve', color: '#f59e0b',      bg: 'rgba(245,158,11,0.12)', pulse: false },
    soon:   { label: 'Próximo',        color: 'var(--blue)',   bg: 'rgba(99,102,241,0.08)', pulse: false },
  };

  list.innerHTML = alerts.map(a => {
    const u = urgencyLabel[a.urgency];
    const daysText = a.diffDays === 0
      ? 'Hoje!'
      : a.diffDays === 1 ? 'Amanhã'
      : `Em ${a.diffDays} dias`;
    const vencStr = a.vencDate.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    const clickFn = a.tipo === 'fixo'
      ? `showPage('fixed')`
      : a.tipo === 'cartao'
        ? `openCardDetail(${a.id})`
        : `showPage('debts')`;
    return `
      <div class="alert-item ${a.urgency === 'today' ? 'alert-pulse' : ''}"
           style="border-left-color:${u.color};background:${u.bg}"
           onclick="${clickFn}" title="Clique para ver">
        <div class="alert-ico">${a.icon}</div>
        <div class="alert-info">
          <div class="alert-name">${a.name}</div>
          <div class="alert-date">📅 ${vencStr} &nbsp;·&nbsp; ${u.label}</div>
        </div>
        <div class="alert-right">
          <div class="alert-val">${fmt(a.valor)}</div>
          <div class="alert-days" style="color:${u.color}">${daysText}</div>
        </div>
      </div>`;
  }).join('');
}


function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function renderCharts() {
  const txt    = cssVar('--t2')   || '#7070a0';
  const border = cssVar('--gbr')  || 'rgba(255,255,255,0.1)';
  const bg2    = cssVar('--gls2') || 'rgba(30,28,60,.65)';

  const labels=[], incData=[], expData=[];
  const today = new Date();
  for (let i = currentPeriod-1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate()-i);
    const m = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    labels.push(`${d.getDate()} ${m[d.getMonth()]}`);
    const ds = d.toISOString().split('T')[0];
    incData.push(transactions.filter(t=>t.type==='income'  && t.date===ds).reduce((s,t)=>s+t.amount,0));
    expData.push(transactions.filter(t=>t.type==='expense' && t.date===ds).reduce((s,t)=>s+t.amount,0));
  }

  if (flowChartRef) flowChartRef.destroy();
  flowChartRef = new Chart(document.getElementById('flowChart'), {
    type:'line',
    data:{ labels, datasets:[
      {label:'Receitas',data:incData,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.08)',fill:true,tension:.45,pointRadius:4,pointBackgroundColor:'#10b981',borderWidth:2},
      {label:'Despesas',data:expData,borderColor:'#f43f5e',backgroundColor:'rgba(244,63,94,.08)', fill:true,tension:.45,pointRadius:4,pointBackgroundColor:'#f43f5e',borderWidth:2},
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:txt,font:{family:'Satoshi',size:11},boxWidth:12,usePointStyle:true,pointStyle:'circle'}},
        tooltip:{backgroundColor:bg2,titleColor:txt,bodyColor:txt,borderColor:border,borderWidth:1,callbacks:{label:ctx=>` ${fmt(ctx.raw)}`}},
      },
      scales:{
        x:{ticks:{color:txt,font:{family:'Satoshi',size:10}},grid:{color:border}},
        y:{ticks:{color:txt,font:{family:'Satoshi',size:10},callback:v=>'R$'+v.toLocaleString('pt-BR')},grid:{color:border}},
      },
    },
  });

  const catTotals = {};
  transactions.filter(t=>t.type==='expense').forEach(tx=>{catTotals[tx.category]=(catTotals[tx.category]||0)+tx.amount;});
  const catLabels = Object.keys(catTotals), catValues = Object.values(catTotals);
  const palette = ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#f97316'];

  if (catChartRef) catChartRef.destroy();
  catChartRef = new Chart(document.getElementById('catChart'), {
    type:'doughnut',
    data:{ labels:catLabels.length?catLabels:['Sem dados'], datasets:[{data:catLabels.length?catValues:[1],backgroundColor:catLabels.length?palette.slice(0,catLabels.length):[border],borderWidth:0,hoverOffset:7}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{
        legend:{position:'bottom',labels:{color:txt,font:{family:'Satoshi',size:10},padding:8,boxWidth:10,usePointStyle:true}},
        tooltip:{backgroundColor:bg2,titleColor:txt,bodyColor:txt,borderColor:border,borderWidth:1,
          callbacks:{label:ctx=>{const t=catValues.reduce((a,b)=>a+b,0);return` ${fmt(ctx.raw)} (${Math.round(ctx.raw/t*100)}%)`;}}},
      },
    },
  });
}

function setPeriod(btn, days) {
  currentPeriod = days;
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderCharts();
}

// ════════════════════════════════════════════════════════
// METAS
// ════════════════════════════════════════════════════════
function renderGoals() {
  const el = document.getElementById('goalsList');
  if (!el) return;
  if (goals.length === 0) {
    el.innerHTML = `<div class="plan-empty" style="grid-column:1/-1"><div class="empty-icon">🎯</div><div class="empty-text">Nenhuma meta ainda.<br>Clique em <b>"Nova Meta"</b> para criar!</div><button class="btn-new" onclick="openGoalModal()" style="margin-top:16px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nova Meta</button></div>`;
    return;
  }
  el.innerHTML = goals.map(g => {
    const pct  = Math.round(g.saved/g.target*100);
    const done = pct >= 100;
    return `
      <div class="goal-card ${done?'goal-done':''}">
        <div class="goal-hd">
          <div class="goal-ico" style="background:${g.color}22">${g.icon}</div>
          <div style="flex:1"><div class="goal-name">${g.name}${done?' ✅':''}</div><div class="goal-target">Meta: ${fmt(g.target)}</div></div>
          <span class="tag" style="background:${g.color}22;color:${g.color};margin-left:8px">${pct}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:0%;background:${g.color}" data-w="${Math.min(pct,100)}"></div></div>
        <div class="prog-info">
          <span>Guardado: <strong>${fmt(g.saved)}</strong></span>
          <span>${done?'✅ Concluída!':'Falta: '}<strong>${done?'':fmt(g.target-g.saved)}</strong></span>
        </div>
        <div class="goal-actions">
          ${!done?`<button class="goal-btn-add" onclick="addToGoal(${g.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Adicionar valor</button>`:''}
          <button class="goal-btn-del" onclick="deleteGoal(${g.id})">Remover</button>
        </div>
      </div>`;
  }).join('');
  setTimeout(()=>{document.querySelectorAll('.prog-fill[data-w]').forEach(el=>{el.style.width=el.dataset.w+'%';});},60);
}

// ════════════════════════════════════════════════════════
// DÍVIDAS — renderização
// ════════════════════════════════════════════════════════
function renderDebts() {
  const el = document.getElementById('debtsList');
  if (!el) return;

  if (debts.length === 0) {
    el.innerHTML = `<div class="plan-empty"><div class="empty-icon">💳</div><div class="empty-text">Nenhuma dívida cadastrada.<br>Clique em <b>"Nova Dívida"</b>!</div><button class="btn-new" onclick="openDebtModal()" style="margin-top:16px;background:linear-gradient(135deg,#f43f5e,#f59e0b)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nova Dívida</button></div>`;
    return;
  }

  el.innerHTML = debts.map(d => {
    if (d.tipo === 'cartao') {
      return renderCartaoCard(d);
    } else {
      return renderParcelasCard(d);
    }
  }).join('');

  setTimeout(()=>{document.querySelectorAll('.prog-fill[data-w]').forEach(el=>{el.style.width=el.dataset.w+'%';});},60);
}

function renderCartaoCard(d) {
  const itens    = d.itens || [];
  const total    = itens.reduce((s,i)=>s+(i.valorParcela||i.valor||0), 0);
  const pago     = itens.filter(i=>i.pago).reduce((s,i)=>s+(i.valorParcela||i.valor||0), 0);
  const pendente = total - pago;
  const pct      = total > 0 ? Math.round((pago/total)*100) : 0;
  const usoPct   = d.limite > 0 ? Math.round((total/d.limite)*100) : 0;

  return `
    <div class="debt-card2" style="--dc:${d.color}">
      <div class="debt2-header">
        <div class="debt2-left">
          <div class="debt2-ico" style="background:${d.color}22">${d.icon}</div>
          <div>
            <div class="debt2-name">${d.name}</div>
            <div class="debt2-venc">Vencimento: ${d.venc}${d.limite?' · Limite: '+fmt(d.limite):''}</div>
          </div>
        </div>
        <div class="debt2-right">
          <div class="debt2-total" style="color:var(--red)">${fmt(pendente)}<span style="font-size:12px;font-weight:400;color:var(--t2)"> pendente</span></div>
          <span class="debt2-tag" style="background:${d.color}22;color:${d.color}">💳 Cartão</span>
        </div>
      </div>

      <div class="debt2-stats">
        <div class="debt2-stat">
          <span class="debt2-stat-label">Total fatura</span>
          <span class="debt2-stat-val">${fmt(total)}</span>
        </div>
        <div class="debt2-stat">
          <span class="debt2-stat-label">Pago</span>
          <span class="debt2-stat-val" style="color:var(--green)">${fmt(pago)}</span>
        </div>
        <div class="debt2-stat">
          <span class="debt2-stat-label">Pendente</span>
          <span class="debt2-stat-val" style="color:var(--red)">${fmt(pendente)}</span>
        </div>
      </div>

      ${total > 0 ? `
      <div class="debt2-progress-area" style="margin-bottom:14px">
        <div class="debt2-prog-label">
          <span>Pagamentos: <b>${pct}%</b></span>
          <span style="color:var(--t2)">${itens.length} ${itens.length===1?'item':'itens'} na fatura</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:0%;background:${d.color}" data-w="${pct}"></div></div>
      </div>` : ''}

      <div class="debt2-actions">
        <button class="debt2-btn-pay" onclick="openCardDetail(${d.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
          Ver fatura (${itens.length} itens)
        </button>
        <button class="debt2-btn-del" onclick="deleteDebt(${d.id})">Remover</button>
      </div>
    </div>`;
}

function renderParcelasCard(d) {
  const pct         = Math.round(((d.parcelasPagas||0) / (d.totalParcelas||1)) * 100);
  const done        = (d.parcelasPagas||0) >= (d.totalParcelas||1);
  const pagoTotal   = (d.parcelasPagas||0) * (d.valorParcela||0);
  const restaTotal  = Math.max((d.total||0) - pagoTotal, 0);
  const proxima     = done ? null : (d.parcelasPagas||0) + 1;
  const historico   = d.historico || [];
  const ultimos     = historico.slice(-3).reverse();

  return `
    <div class="debt-card2 ${done?'debt-done':''}" style="--dc:${d.color}">
      <div class="debt2-header">
        <div class="debt2-left">
          <div class="debt2-ico" style="background:${d.color}22">${d.icon}</div>
          <div>
            <div class="debt2-name">${d.name}${done?' ✅':''}</div>
            <div class="debt2-venc">Vencimento: ${d.venc} · Parcela: ${fmt(d.valorParcela||0)}</div>
          </div>
        </div>
        <div class="debt2-right">
          <div class="debt2-total">${fmt(d.total||0)}</div>
          <div class="debt2-tag" style="background:${d.color}22;color:${d.color}">${pct}% pago</div>
        </div>
      </div>

      <div class="debt2-progress-area">
        <div class="debt2-prog-label">
          <span><b>${d.parcelasPagas||0}</b> de <b>${d.totalParcelas||0}</b> parcelas pagas</span>
          <span style="color:var(--t2)">${done ? 'Quitada!' : `${(d.totalParcelas||0)-(d.parcelasPagas||0)} restantes`}</span>
        </div>
        <div class="debt2-parcelas-grid">
          ${Array.from({length: Math.min(d.totalParcelas||0, 24)}, (_,i) => {
            const num = i+1, paga = num <= (d.parcelasPagas||0), prox = num === proxima;
            return `<div class="debt2-parc ${paga?'paga':''} ${prox?'proxima':''}"
              style="${paga?`background:${d.color};box-shadow:0 0 5px ${d.color}55`:prox?`border-color:${d.color};color:${d.color}`:''}"
              title="Parcela ${num}${paga?' — paga':prox?' — próxima':''}">
              ${paga ? '✓' : num}
            </div>`;
          }).join('')}
          ${(d.totalParcelas||0) > 24 ? `<div class="debt2-parc" style="opacity:.5;font-size:9px">+${(d.totalParcelas||0)-24}</div>` : ''}
        </div>
      </div>

      <div class="debt2-stats">
        <div class="debt2-stat"><span class="debt2-stat-label">Valor pago</span><span class="debt2-stat-val" style="color:var(--green)">${fmt(pagoTotal)}</span></div>
        <div class="debt2-stat"><span class="debt2-stat-label">Valor restante</span><span class="debt2-stat-val" style="color:var(--red)">${fmt(restaTotal)}</span></div>
        <div class="debt2-stat"><span class="debt2-stat-label">Próxima</span><span class="debt2-stat-val">${done?'—':`Nº ${proxima} · ${d.venc}`}</span></div>
      </div>

      ${ultimos.length > 0 ? `
      <div class="debt2-historico">
        <div class="debt2-hist-label">Últimos pagamentos</div>
        ${ultimos.map(h=>`
          <div class="debt2-hist-item">
            <span class="debt2-hist-parc">Parcela ${h.parcela}</span>
            <span class="debt2-hist-data">${fmtDate(h.data)}</span>
            <span class="debt2-hist-val">${fmt(h.valor)}</span>
            ${h.obs?`<span class="debt2-hist-obs">${h.obs}</span>`:''}
          </div>`).join('')}
      </div>` : ''}

      <div class="debt2-actions">
        ${!done ? `<button class="debt2-btn-pay" onclick="openPayDebtModal(${d.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          Pagar parcela ${proxima}
        </button>` : ''}
        <button class="debt2-btn-del" onclick="deleteDebt(${d.id})">Remover</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// GASTOS FIXOS
// ════════════════════════════════════════════════════════
function renderFixed() {
  const total = fixed.reduce((s,f)=>s+f.value, 0);
  const ftEl = document.getElementById('fixedTotal');
  if (ftEl) ftEl.textContent = `Total: ${fmt(total)}/mês`;
  const el = document.getElementById('fixedList');
  if (!el) return;
  if (fixed.length === 0) {
    el.innerHTML = `<div class="plan-empty" style="grid-column:1/-1"><div class="empty-icon">📅</div><div class="empty-text">Nenhum gasto fixo cadastrado.</div><button class="btn-new" onclick="openFixedModal()" style="margin-top:16px;background:linear-gradient(135deg,#f59e0b,#f43f5e)">+ Novo Gasto Fixo</button></div>`;
    return;
  }
  el.innerHTML = fixed.map(f => {
    const today = new Date(); today.setHours(0,0,0,0);
    const alertDays = f.alertDays || 5;
    let vencDate = new Date(today.getFullYear(), today.getMonth(), f.day);
    if (vencDate < today) vencDate = new Date(today.getFullYear(), today.getMonth()+1, f.day);
    const diffDays = Math.round((vencDate - today) / 86400000);
    const isUrgent = diffDays <= alertDays;
    const urgBadge = isUrgent
      ? `<span class="fixed-urg-badge" style="background:${diffDays===0?'rgba(244,63,94,0.18)':diffDays<=2?'rgba(245,158,11,0.15)':'rgba(99,102,241,0.12)'};color:${diffDays===0?'var(--red)':diffDays<=2?'#f59e0b':'var(--blue)'}">
          ${diffDays===0?'🔴 Hoje!':diffDays===1?'🟡 Amanhã':`🔵 ${diffDays}d`}
        </span>`
      : '';
    return `
    <div class="fixed-card ${isUrgent?'fixed-card-alert':''}">
      <div class="fixed-ico" style="background:var(--ra)">${f.icon}</div>
      <div class="fixed-info">
        <div class="fixed-name">${f.name} ${urgBadge}</div>
        <div class="fixed-day">Vence dia ${f.day} · Alerta ${alertDays}d antes</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="fixed-val">${fmt(f.value)}</div>
        <button class="icon-btn" onclick="deleteFixed(${f.id})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('')
  + `<div class="fixed-card fixed-total-card"><div style="font-size:22px">📊</div><div class="fixed-info"><div class="fixed-name">Total fixo mensal</div><div class="fixed-day">${fixed.length} gastos</div></div><div class="fixed-val" style="font-size:18px">${fmt(total)}</div></div>`;
}

// ════════════════════════════════════════════════════════
// PÁGINA DE DETALHE
// ════════════════════════════════════════════════════════
function showDetail(type) {
  // ── Dívidas pagas no mês selecionado ──────────────────
  const _getDebtsPaid = (month, year) => {
    const list = [];
    debts.forEach(d => {
      if (d.tipo === 'parcelas') {
        (d.historico || []).forEach(h => {
          const hd = new Date(h.data + 'T12:00');
          if (hd.getMonth() === month && hd.getFullYear() === year)
            list.push({ icon:d.icon, name:d.name, color:d.color, desc:`Parcela ${h.parcela}/${d.totalParcelas}`, valor:h.valor, data:h.data, obs:h.obs });
        });
      } else if (d.tipo === 'cartao') {
        (d.itens || []).filter(i => i.pago).forEach(i => {
          const id = new Date(i.data + 'T12:00');
          if (id.getMonth() === month && id.getFullYear() === year)
            list.push({ icon:d.icon, name:d.name+' · '+i.desc, color:d.color, desc:i.categoria, valor:i.valor, data:i.data });
        });
      }
    });
    return list;
  };

  const _debtPaidHTML = item => `
    <div class="tx-item">
      <div class="tx-ico" style="background:${item.color}22">${item.icon}</div>
      <div class="tx-info">
        <div class="tx-name">${item.name}</div>
        <div class="tx-cat"><span class="tx-badge tx-badge-exp">${item.desc}</span></div>
      </div>
      <div class="tx-date">${fmtDate(item.data)}</div>
      <div class="tx-amount tx-amount-exp">-${fmt(item.valor)}</div>
    </div>`;

  const _fixedHTML = f => `
    <div class="tx-item">
      <div class="tx-ico" style="background:var(--ra)">${f.icon}</div>
      <div class="tx-info">
        <div class="tx-name">${f.name}</div>
        <div class="tx-cat"><span class="tx-badge tx-badge-exp">Gasto Fixo · dia ${f.day}</span></div>
      </div>
      <div class="tx-date">Todo mês</div>
      <div class="tx-amount tx-amount-exp">-${fmt(f.value)}</div>
    </div>`;


  const month = selectedMonth, year = selectedYear;
  const now   = new Date(year, month, 1);
  const monthTx    = transactions.filter(tx=>{ const d=new Date(tx.date+'T12:00'); return d.getMonth()===month&&d.getFullYear()===year; });
  const allIncome  = monthTx.filter(t=>t.type==='income');
  const allExpense = monthTx.filter(t=>t.type==='expense');
  const totalInc   = allIncome .reduce((s,t)=>s+t.amount,0);
  const totalExp   = allExpense.reduce((s,t)=>s+t.amount,0);
  const totalBal   = transactions.reduce((s,t)=>t.type==='income'?s+t.amount:s-t.amount,0);
  const savings    = totalInc-totalExp;

  const configs = {
    balance: { label:'Saldo Total', value:fmt(totalBal), color:'var(--blue)', grad:'linear-gradient(90deg,var(--blue),var(--cyan))', bg:'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(6,182,212,0.08))', icon:'💳', desc:'O saldo total é a soma de todas as receitas menos todas as despesas já registradas.', stats:[{label:'Total de entradas',val:fmt(transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0))},{label:'Total de saídas',val:fmt(transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0))},{label:'Transações',val:transactions.length+' registradas'}], txList:transactions.slice(0,20), txTitle:'Últimas transações' },
    income:  { label:'Receitas', value:fmt(totalInc), color:'var(--green)', grad:'linear-gradient(90deg,var(--green),#84cc16)', bg:'linear-gradient(135deg,rgba(16,185,129,0.15),transparent)', icon:'📈', desc:'Receitas são todos os valores que entram no seu orçamento.', stats:[{label:'Total de receitas',val:fmt(totalInc)},{label:'Média por entrada',val:allIncome.length?fmt(totalInc/allIncome.length):'—'},{label:'Entradas',val:allIncome.length+' registradas'}], txList:allIncome, txTitle:'Todas as receitas' },
    expense: { label:'Despesas', value:fmt(totalExp), color:'var(--red)', grad:'linear-gradient(90deg,var(--red),#fb923c)', bg:'linear-gradient(135deg,rgba(244,63,94,0.15),transparent)', icon:'💸', desc:'Despesas são todos os valores que saem do seu orçamento.', stats:[{label:'Total de despesas',val:fmt(totalExp)},{label:'Média por saída',val:allExpense.length?fmt(totalExp/allExpense.length):'—'},{label:'Saídas',val:allExpense.length+' registradas'}], txList:allExpense, txTitle:'Todas as despesas' },
    savings: { label:'Economia', value:fmt(savings), color:savings>=0?'var(--yellow)':'var(--red)', grad:savings>=0?'linear-gradient(90deg,var(--yellow),var(--cyan))':'linear-gradient(90deg,var(--red),#fb923c)', bg:savings>=0?'linear-gradient(135deg,rgba(245,158,11,0.15),transparent)':'linear-gradient(135deg,rgba(244,63,94,0.15),transparent)', icon:savings>=0?'🏆':'⚠️', desc:savings>=0?`Você economizou ${fmt(savings)} este mês.`:`Suas despesas superaram as receitas em ${fmt(Math.abs(savings))}.`, stats:[{label:'Receitas',val:fmt(totalInc)},{label:'Despesas',val:fmt(totalExp)},{label:'Taxa',val:totalInc>0?Math.round((savings/totalInc)*100)+'%':'—'}], txList:monthTx, txTitle:'Todas as transações do mês' },
  };

  const monthLabel = now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  if (type === 'expense') {
    const debtsPaid  = _getDebtsPaid(month, year);
    const totalDebtsPaid = debtsPaid.reduce((s,d)=>s+d.valor,0);
    const totalFixed     = fixed.reduce((s,f)=>s+f.value,0);
    const totalExpAll    = totalExp + totalDebtsPaid + totalFixed;

    document.getElementById('detailContent').innerHTML = `
      <button class="detail-back" onclick="showPage('dashboard')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar ao Dashboard
      </button>
      <div class="detail-hero" style="background:linear-gradient(135deg,rgba(244,63,94,0.15),transparent)">
        <div class="detail-hero-line" style="background:linear-gradient(90deg,var(--red),#fb923c)"></div>
        <div class="detail-hero-info">
          <div class="detail-hero-label">Total de Saídas — ${monthLabel}</div>
          <div class="detail-hero-value" style="color:var(--red)">${fmt(totalExpAll)}</div>
          <div class="detail-hero-sub">Inclui transações, parcelas pagas e gastos fixos do mês.</div>
        </div>
        <div class="detail-hero-badge">
          <span style="font-size:52px;line-height:1">💸</span>
          <span class="tag" style="background:var(--ra);color:var(--red);border:1px solid rgba(244,63,94,.3)">${monthLabel}</span>
        </div>
      </div>
      <div class="detail-stats" style="grid-template-columns:repeat(4,1fr)">
        <div class="detail-stat-card"><div class="detail-stat-label">Transações</div><div class="detail-stat-val" style="color:var(--red)">${fmt(totalExp)}</div></div>
        <div class="detail-stat-card"><div class="detail-stat-label">Parcelas pagas</div><div class="detail-stat-val" style="color:var(--red)">${fmt(totalDebtsPaid)}</div></div>
        <div class="detail-stat-card"><div class="detail-stat-label">Gastos fixos</div><div class="detail-stat-val" style="color:var(--red)">${fmt(totalFixed)}</div></div>
        <div class="detail-stat-card"><div class="detail-stat-label">Total geral</div><div class="detail-stat-val" style="color:var(--red);font-size:18px">${fmt(totalExpAll)}</div></div>
      </div>
      <div class="detail-list-card" style="margin-bottom:16px">
        <div class="detail-list-hd">
          <span class="gc-title">💸 Transações de despesa</span>
          <span class="tag tag-red">${allExpense.length} itens · ${fmt(totalExp)}</span>
        </div>
        ${allExpense.length===0 ? '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Nenhuma transação de despesa este mês.</div></div>' : allExpense.map(txHTML).join('')}
      </div>
      <div class="detail-list-card" style="margin-bottom:16px">
        <div class="detail-list-hd">
          <span class="gc-title">💳 Parcelas e cartões pagos</span>
          <span class="tag tag-red">${debtsPaid.length} itens · ${fmt(totalDebtsPaid)}</span>
        </div>
        ${debtsPaid.length===0 ? '<div class="empty"><div class="empty-icon">💳</div><div class="empty-text">Nenhuma parcela paga registrada este mês.</div></div>' : debtsPaid.map(_debtPaidHTML).join('')}
      </div>
      <div class="detail-list-card">
        <div class="detail-list-hd">
          <span class="gc-title">📅 Gastos fixos mensais</span>
          <span class="tag tag-red">${fixed.length} itens · ${fmt(totalFixed)}/mês</span>
        </div>
        ${fixed.length===0 ? '<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Nenhum gasto fixo cadastrado.</div></div>' : fixed.map(_fixedHTML).join('')}
      </div>
    `;
    document.getElementById('pageTitle').textContent = 'Despesas';
    document.getElementById('pageSub').textContent   = 'Análise completa · ' + monthLabel;
    document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
    document.getElementById('page-detail').classList.add('active');
    return;
  }

  const cfg = configs[type];
  if (!cfg) return;

  document.getElementById('detailContent').innerHTML = `
    <button class="detail-back" onclick="showPage('dashboard')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      Voltar ao Dashboard
    </button>
    <div class="detail-hero" style="background:${cfg.bg}">
      <div class="detail-hero-line" style="background:${cfg.grad}"></div>
      <div class="detail-hero-info">
        <div class="detail-hero-label">${cfg.label}</div>
        <div class="detail-hero-value" style="color:${cfg.color}">${cfg.value}</div>
        <div class="detail-hero-sub">${cfg.desc}</div>
      </div>
      <div class="detail-hero-badge">
        <span style="font-size:52px;line-height:1">${cfg.icon}</span>
        <span class="tag" style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}33">${monthLabel}</span>
      </div>
    </div>
    <div class="detail-stats">
      ${cfg.stats.map(s=>`<div class="detail-stat-card"><div class="detail-stat-label">${s.label}</div><div class="detail-stat-val">${s.val}</div></div>`).join('')}
    </div>
    <div class="detail-list-card">
      <div class="detail-list-hd">
        <span class="gc-title">${cfg.txTitle}</span>
        <span class="tag tag-blue">${cfg.txList.length} ${cfg.txList.length===1?'transação':'transações'}</span>
      </div>
      ${cfg.txList.length===0
        ? '<div class="empty"><div class="empty-icon">'+cfg.icon+'</div><div class="empty-text">Nenhuma transação encontrada.</div></div>'
        : cfg.txList.map(txHTML).join('')}
    </div>`;

  document.getElementById('pageTitle').textContent = cfg.label;
  document.getElementById('pageSub').textContent   = 'Análise detalhada · ' + monthLabel;
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
}

// ════════════════════════════════════════════════════════
// TOASTS
// ════════════════════════════════════════════════════════
function showToast(msg, type='ok') {
  const w = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">${type==='ok'?'<polyline points="20 6 9 17 4 12"/>':'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg>${msg}`;
  w.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastOut .3s ease forwards'; setTimeout(()=>t.remove(),300); }, 3000);
}

// ════════════════════════════════════════════════════════
// SIDEBAR MOBILE
// ════════════════════════════════════════════════════════
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function toggleSidebar() {
  if (document.getElementById('sidebar').classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('ff_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === saved);
  });
  document.getElementById('fDate').valueAsDate = TODAY;
  updateMonthUI();
  selectDebtTipo('parcelas');

  // Logo clicável — navega para dashboard e fecha sidebar no mobile
  document.getElementById('brandBtn')?.addEventListener('click', () => {
    showPage('dashboard');
  });

  renderDashboard();
  // Firebase: loadCloudData() é chamado automaticamente via onAuthStateChanged
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); closeGoalModal(); closeDebtModal();
    closeFixedModal(); closePayDebtModal(); closeCardDetail();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeExportModal(); }
});

function openExportModal() {
  const old = document.getElementById('exportModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.className = 'overlay open';
  modal.onclick = e => { if (e.target === modal) closeExportModal(); };
  modal.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-hd">
        <span class="modal-title">📄 Exportar PDF</span>
        <button class="modal-close" onclick="closeExportModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div style="padding:20px 24px 24px;display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--t2);letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:6px">Período</label>
          <select class="f-input" id="expPeriod">
            <option value="month" selected>Mês atual</option>
            <option value="year">Ano atual</option>
            <option value="all">Todos os registros</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--t2);letter-spacing:.06em;text-transform:uppercase;display:block;margin-bottom:8px">Incluir no relatório</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label class="export-check"><input type="checkbox" id="expTx" checked><span>💸 Transações</span></label>
            <label class="export-check"><input type="checkbox" id="expGoals" checked><span>🎯 Metas</span></label>
            <label class="export-check"><input type="checkbox" id="expDebts" checked><span>💳 Dívidas</span></label>
            <label class="export-check"><input type="checkbox" id="expFixed" checked><span>📅 Gastos Fixos</span></label>
          </div>
        </div>
        <button class="btn-save" onclick="exportPDF()" style="background:linear-gradient(135deg,#f43f5e,#e11d48);gap:10px;justify-content:center;padding:14px 20px;font-size:14px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
          Baixar PDF
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeExportModal() {
  const m = document.getElementById('exportModal');
  if (m) m.remove();
}

function _getExportData() {
  const inclTx    = document.getElementById('expTx')?.checked    ?? true;
  const inclGoals = document.getElementById('expGoals')?.checked  ?? true;
  const inclDebts = document.getElementById('expDebts')?.checked  ?? true;
  const inclFixed = document.getElementById('expFixed')?.checked  ?? true;
  const period    = document.getElementById('expPeriod')?.value   ?? 'month';
  let txFiltered = [...transactions];
  if (period === 'month') {
    txFiltered = transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  } else if (period === 'year') {
    txFiltered = transactions.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === selectedYear);
  }
  return { inclTx, inclGoals, inclDebts, inclFixed, txFiltered };
}

function exportPDF() {
  const { inclTx, inclGoals, inclDebts, inclFixed, txFiltered } = _getExportData();
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  const period = document.getElementById('expPeriod')?.value ?? 'month';
  let periodLabel = period === 'month'
    ? (MONTHS_PT[selectedMonth] + ' ' + selectedYear)
    : period === 'year' ? 'Ano ' + selectedYear : 'Todos os registros';

  const totalInc = txFiltered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExp = txFiltered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const saldo = totalInc - totalExp;
  const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmQAAAGYCAYAAADsqf5DAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAACoYUlEQVR4nOz9d5Dd15XgeX7vvT/zTL60SHhvCcKRoBWNRHlbvrq7TPdWd9X2xvZud8d27GxsxM7u/LMbMbETOxM9sxtjunt6prqruqpUJZWqVPISJVESvRMdCBAgvDfpnvuZe8/+8XuZAAiABCmIAKXzUWRkIvPl+5lk5js699xzQCmllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWU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MrGqzsP7tjI2UmVitEa9EohtTkQAyQmSUq9bAkJRWFKpkPoKnV7E7KJnvhV49Y1DTE0tcfLq77Y+66FHYnnh2a+zdmIzl89OcuLQOW7MzHHm+rSBcm3cUH2YLRs3s3XzFopQIM7z2hu/YX5pnksXteekUur3Sy8ySqnfq+2rjWxaP8rqsQZrJpqsWT3M8FCTShSIihRrLZmPmOsErk93OH95mhPnJzlxrv07X5/270rkkcd2s2nTBm7dmuX40QvcmuwQ8hrEEas2DNNoVtgwtpbIO0InZ35+kVOnznB6elqvj0qpPxi94Cil/qD2bW7I4ECNBNi9eQu9TpfpuTmuTs1w5Fr6O1+T9m4ckM0bxlkzsYrR0UFuTk1z+doks4tdJKpTa45QqQ2Cs7Q7ixifYQvP0swcZ67pAn2l1BdDLz5Kqa+ELVvGZPe2dWwYH6IWx9gAM9MLdHqe2cWU2VaHdp5z/pLWCVNKffnohUkp9cDbuXudrJ0YopYYuu0WrbkunXZOtw2X5nT9l1JKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSiml1H37/wHtbbTELUCVFwAAAABJRU5ErkJggg==";

  function _hex(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [212,175,55];
  }

  function _build() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml=14, mr=14, cw=pw-ml-mr;
    let y=0;

    function chk(n=10){ if(y+n>ph-14){ doc.addPage(); y=14; } }

    function sec(label){
      chk(14);
      doc.setFillColor(241,243,249); doc.rect(ml,y,cw,7,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setTextColor(26,26,62); doc.text(label.toUpperCase(),ml+3,y+4.8);
      y+=9;
    }

    function row(cells,widths,isHd=false,alt=false){
      chk(7); const rh=6.5;
      if(isHd) doc.setFillColor(241,243,249);
      else if(alt) doc.setFillColor(250,251,253);
      else doc.setFillColor(255,255,255);
      doc.rect(ml,y,cw,rh,'F');
      doc.setDrawColor(230,232,238); doc.line(ml,y+rh,ml+cw,y+rh);
      doc.setFont('helvetica',isHd?'bold':'normal'); doc.setFontSize(isHd?7.5:8);
      let x=ml;
      cells.forEach((cell,i)=>{
        const w=widths[i], txt=String(cell.text??cell).substring(0,40);
        const align=cell.align||'left';
        if(cell.color) doc.setTextColor(...cell.color);
        else doc.setTextColor(isHd?80:50,isHd?80:50,isHd?80:50);
        if(align==='right') doc.text(txt,x+w-2,y+4.3,{align:'right'});
        else doc.text(txt,x+2,y+4.3);
        x+=w;
      });
      y+=rh;
    }

    // HEADER
    y=10;
    doc.setFillColor(212,175,55); doc.rect(ml,y,cw,0.8,'F'); y+=5;
    try { doc.addImage(LOGO,'PNG',ml,y,18,18); } catch(e){}
    doc.setFont('helvetica','bold'); doc.setFontSize(20);
    doc.setTextColor(26,26,62); doc.text('Wealth',ml+22,y+10);
    const ww=doc.getTextWidth('Wealth');
    doc.setTextColor(212,175,55); doc.text('Path',ml+22+ww,y+10);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(130,130,130); doc.text('Relatório Financeiro Pessoal',ml+22,y+15);
    doc.text('Gerado em '+dateStr,pw-mr,y+7,{align:'right'});
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.setTextColor(26,26,62); doc.text(periodLabel,pw-mr,y+14,{align:'right'});
    y+=26;
    doc.setFillColor(212,175,55); doc.rect(ml,y,cw,0.5,'F'); y+=8;

    // RESUMO
    if(inclTx){
      const cW=(cw-8)/3;
      [[fmt(totalInc),'Total Receitas',[240,253,244],[5,150,105],ml],
       [fmt(totalExp),'Total Despesas',[255,241,242],[225,29,72],ml+cW+4],
       [fmt(saldo),'Saldo do Período',saldo>=0?[239,246,255]:[255,241,242],saldo>=0?[37,99,235]:[225,29,72],ml+(cW+4)*2]
      ].forEach(([val,lbl,bg,tc,x])=>{
        doc.setFillColor(...bg); doc.roundedRect(x,y,cW,16,2,2,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7);
        doc.setTextColor(100,100,100); doc.text(lbl.toUpperCase(),x+4,y+5.5);
        doc.setFontSize(11); doc.setTextColor(...tc); doc.text(val,x+4,y+13);
      });
      y+=22;
    }

    // TRANSAÇÕES
    if(inclTx && txFiltered.length>0){
      y+=4; sec('Transações ('+txFiltered.length+')');
      const W=[22,65,40,25,30];
      row([{text:'Data'},{text:'Descrição'},{text:'Categoria'},{text:'Tipo'},{text:'Valor',align:'right'}],W,true);
      txFiltered.forEach((t,i)=>{
        const d=new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR');
        const col=t.type==='income'?[5,150,105]:[225,29,72];
        row([{text:d},{text:t.desc},{text:t.category||'—'},
          {text:t.type==='income'?'Receita':'Despesa',color:col},
          {text:(t.type==='income'?'+':'-')+fmt(t.amount),align:'right',color:col}],W,false,i%2===1);
      });
    }

    // METAS
    if(inclGoals && goals.length>0){
      y+=6; sec('Metas Financeiras');
      const W=[65,35,35,47];
      row([{text:'Meta'},{text:'Objetivo'},{text:'Guardado'},{text:'Progresso'}],W,true);
      goals.forEach((g,i)=>{
        const pct=g.target>0?Math.min(100,(g.saved/g.target)*100):0;
        row([{text:g.icon+' '+g.name},{text:fmt(g.target)},{text:fmt(g.saved)},{text:pct.toFixed(0)+'%'}],W,false,i%2===1);
        const bY=y-2.5,bX=ml+W[0]+W[1]+W[2]+2,bW=W[3]-16;
        doc.setFillColor(230,232,238); doc.roundedRect(bX,bY,bW,2.5,1,1,'F');
        const col=g.color?_hex(g.color):[212,175,55];
        doc.setFillColor(...col); doc.roundedRect(bX,bY,Math.max(0,bW*pct/100),2.5,1,1,'F');
      });
    }

    // DÍVIDAS
    if(inclDebts && debts.length>0){
      y+=6; sec('Dívidas e Cartões');
      const W=[52,22,22,42,44];
      row([{text:'Nome'},{text:'Tipo'},{text:'Venc.'},{text:'Total'},{text:'Situação'}],W,true);
      debts.forEach((d,i)=>{
        if(d.tipo==='parcelas'){
          const pct=d.totalParcelas>0?(d.parcelasPagas/d.totalParcelas)*100:0;
          row([{text:d.icon+' '+d.name},{text:'Parcelas'},{text:d.venc},{text:fmt(d.total)},
            {text:d.parcelasPagas+'/'+d.totalParcelas+' ('+pct.toFixed(0)+'%)'}],W,false,i%2===1);
        } else {
          const usado=(d.itens||[]).filter(x=>!x.pago).reduce((s,x)=>s+x.valor,0);
          row([{text:d.icon+' '+d.name},{text:'Cartão'},{text:d.venc},
            {text:'Lim: '+fmt(d.limite||0)},{text:'Usado: '+fmt(usado)}],W,false,i%2===1);
        }
      });
    }

    // GASTOS FIXOS
    if(inclFixed && fixed.length>0){
      const totalF=fixed.reduce((s,f)=>s+f.value,0);
      y+=6; sec('Gastos Fixos — Total: '+fmt(totalF));
      const W=[100,40,42];
      row([{text:'Nome'},{text:'Dia Venc.'},{text:'Valor Mensal',align:'right'}],W,true);
      fixed.forEach((f,i)=>{
        row([{text:f.icon+' '+f.name},{text:'Dia '+f.day},
          {text:fmt(f.value),align:'right',color:[225,29,72]}],W,false,i%2===1);
      });
      chk(8);
      doc.setFillColor(255,241,242); doc.rect(ml,y,cw,7,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.setTextColor(26,26,62); doc.text('Total Mensal',ml+3,y+4.8);
      doc.setTextColor(225,29,72); doc.text(fmt(totalF),pw-mr,y+4.8,{align:'right'});
      y+=8;
    }

    // RODAPÉ todas as páginas
    const total=doc.internal.getNumberOfPages();
    for(let p=1;p<=total;p++){
      doc.setPage(p);
      doc.setFillColor(248,249,250); doc.rect(0,ph-10,pw,10,'F');
      doc.setFillColor(212,175,55); doc.rect(0,ph-10,pw,0.5,'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(7);
      doc.setTextColor(150,150,150);
      doc.text('WealthPath — Personal Finance · '+dateStr,ml,ph-4);
      doc.text('Página '+p+' de '+total,pw-mr,ph-4,{align:'right'});
      try { doc.addImage(LOGO,'PNG',pw/2-5,ph-10,10,10); } catch(e){}
    }

    doc.save('WealthPath_'+periodLabel.replace(/\s+/g,'_')+'.pdf');
    showToast('PDF baixado! 📄','ok');
  }

  closeExportModal();
  showToast('Gerando PDF... ⏳','ok');

  if(typeof window.jspdf !== 'undefined'){
    _build();
  } else {
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload=()=>_build();
    s.onerror=()=>showToast('Erro ao carregar gerador de PDF!','err');
    document.head.appendChild(s);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Inicializa Firebase após DOM pronto
window.addEventListener('load', () => {
  if (typeof firebase !== 'undefined') {
    initFirebase();
  }
});