// ════════════════════════════════════════════════════════
// FIXES — colar no script.js substituindo as funções abaixo
// ════════════════════════════════════════════════════════

// ── FIX 1: confirmPayDebt ────────────────────────────
// Problema: pagamento de parcela não lançava transação,
// então não aparecia no dashboard de despesas.
function confirmPayDebt() {
  const debt = debts.find(d => d.id === payingDebtId);
  if (!debt) return;
  const valor = parseFloat(document.getElementById('payDebtValor').value);
  const data  = document.getElementById('payDebtData').value;
  const obs   = document.getElementById('payDebtObs').value.trim();
  if (!valor || valor <= 0) return showToast('Digite o valor pago!','err');
  if (!data)                return showToast('Selecione a data!','err');
  if (!debt.historico) debt.historico = [];

  const proxima = (debt.parcelasPagas || 0) + 1;

  debt.historico.push({ parcela: proxima, valor, data, obs: obs || null });
  debt.parcelasPagas = Math.min(proxima, debt.totalParcelas);

  // ✅ FIX: lança a despesa nas transações para aparecer no dashboard
  const txId = Date.now() + Math.floor(Math.random() * 1000);
  transactions.unshift({
    id: txId,
    type: 'expense',
    desc: `💳 ${debt.name} — Parcela ${proxima}/${debt.totalParcelas}`,
    amount: valor,
    date: data,
    category: 'Dívidas',
    icon: debt.icon || '💳',
    _fromDebt: true,
  });

  saveTx();
  saveDebts();
  closePayDebtModal();
  renderDebts();
  renderDashboard();
  showToast(`Parcela ${debt.parcelasPagas}/${debt.totalParcelas} paga! ✓`, 'ok');
}

// ── FIX 2: toggleCardItemPago ────────────────────────
// Problema: renderDashboard() não era chamado ao desmarcar item,
// e a data usada era sempre "hoje" em vez da data da compra.
function toggleCardItemPago(cardId, itemId) {
  const card = debts.find(d => d.id === cardId);
  if (!card) return;
  const item = (card.itens || []).find(i => i.id === itemId);
  if (!item) return;
  item.pago = !item.pago;

  const vParcela = item.valorParcela ?? item.valor ?? 0;
  // ✅ FIX: usa a data da compra em vez de sempre "hoje"
  const dataLancamento = item.data || new Date().toISOString().substring(0, 10);

  if (item.pago) {
    const txId = Date.now() + Math.floor(Math.random() * 1000);
    item._txId = txId;
    const parcLabel = (item.totalParcelas ?? 1) > 1
      ? ` (${item.parcelaAtual}/${item.totalParcelas}×)`
      : '';
    transactions.unshift({
      id: txId,
      type: 'expense',
      desc: `💳 ${card.name} — ${item.desc}${parcLabel}`,
      amount: vParcela,
      date: dataLancamento,
      category: item.categoria || 'Cartão',
      icon: '💳',
      _fromCard: true,
    });
    saveTx();
    showToast(`Despesa de ${fmt(vParcela)} lançada ✓`, 'ok');
  } else {
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
  renderDashboard(); // ✅ já estava, mas garantido aqui
}

// ── FIX 3: pagarFaturaCompleta ───────────────────────
// Problema: mesma questão de data — usava Date.now() fixo
// causando race condition nos IDs.
function pagarFaturaCompleta(cardId) {
  const card = debts.find(d => d.id === cardId);
  if (!card) return;
  const itens = (card.itens || []).filter(i => !i.pago);
  if (itens.length === 0) return showToast('Todos os itens já foram pagos!', 'ok');

  const total = itens.reduce((s, i) => s + (i.valorParcela ?? i.valor ?? 0), 0);

  itens.forEach((item, idx) => {
    item.pago = true;
    // ✅ FIX: ID único garantido com índice
    const txId = Date.now() + idx;
    item._txId = txId;
    const dataLancamento = item.data || new Date().toISOString().substring(0, 10);
    const parcLabel = (item.totalParcelas ?? 1) > 1
      ? ` (${item.parcelaAtual}/${item.totalParcelas}×)`
      : '';
    transactions.unshift({
      id: txId,
      type: 'expense',
      desc: `💳 ${card.name} — ${item.desc}${parcLabel}`,
      amount: item.valorParcela ?? item.valor ?? 0,
      date: dataLancamento,
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
