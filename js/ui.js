/**
 * CoreBanking Sandbox — view rendering and screen wiring (vanilla DOM).
 * Business rules live in window.CoreBank services; UI only displays and delegates.
 */
(function (root) {
  'use strict';

  const CB = function () {
    return root.CoreBank;
  };

  const feedbackTypeClass = {
    success: 'alert-success',
    error: 'alert-danger',
    validation: 'alert-danger',
    'insufficient-funds': 'alert-danger',
    unauthorized: 'alert-danger',
    loading: 'alert-info',
    storage: 'alert-danger',
    empty: 'alert-secondary',
    info: 'alert-info'
  };

  function escapeHtml(text) {
    if (text == null) {
      return '';
    }
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMoney(paise) {
    const bank = CB();
    if (!bank || !bank.money) {
      return String(paise);
    }
    return bank.money.formatINR(paise);
  }

  function loadLedger() {
    const bank = CB();
    if (!bank || !bank.store || typeof bank.store.load !== 'function') {
      return {
        ok: false,
        error: 'Store is not available.',
        accounts: [],
        transactions: [],
        transfers: [],
        prefs: null
      };
    }
    const data = bank.store.load();
    return {
      ok: data.ok !== false,
      error: data.error,
      accounts: data.accounts || [],
      transactions: data.transactions || [],
      transfers: data.transfers || [],
      prefs: data.prefs
    };
  }

  function saveSandboxPrefs(updates) {
    const bank = CB();
    const data = loadLedger();
    const basePrefs =
      data.prefs ||
      (bank.sampleData && bank.sampleData.getDefaultPrefs && bank.sampleData.getDefaultPrefs()) ||
      { role: 'developer', lastAccountId: null, statementFilters: {} };
    const prefs = Object.assign({}, basePrefs, updates);
    if (!bank || !bank.store) {
      return { ok: false, error: 'Store is not available.' };
    }
    return bank.store.save({
      accounts: data.accounts,
      transactions: data.transactions,
      transfers: data.transfers,
      prefs
    });
  }

  function accountBalancePaise(acc) {
    if (!acc) {
      return 0;
    }
    const bank = CB();
    if (bank && bank.balanceCalculator && acc.accountId) {
      return bank.balanceCalculator.currentBalance(acc.accountId);
    }
    if (typeof acc.balancePaise === 'number') {
      return acc.balancePaise;
    }
    if (typeof acc.balance === 'number') {
      return acc.balance;
    }
    if (typeof acc.balanceAfter === 'number') {
      return acc.balanceAfter;
    }
    return 0;
  }

  function overdraftLimitPaise(acc) {
    if (!acc) {
      return 0;
    }
    if (typeof acc.overdraftLimitPaise === 'number') {
      return acc.overdraftLimitPaise;
    }
    if (typeof acc.overdraftLimit === 'number') {
      return acc.overdraftLimit;
    }
    return 0;
  }

  function txnAmountPaise(txn) {
    if (!txn) {
      return 0;
    }
    if (typeof txn.amount === 'number') {
      return txn.amount;
    }
    if (typeof txn.amountPaise === 'number') {
      return txn.amountPaise;
    }
    return 0;
  }

  function txnBalanceAfterPaise(txn) {
    if (!txn) {
      return 0;
    }
    if (typeof txn.balanceAfter === 'number') {
      return txn.balanceAfter;
    }
    if (typeof txn.balanceAfterPaise === 'number') {
      return txn.balanceAfterPaise;
    }
    return 0;
  }

  function formatDateTime(iso) {
    if (!iso) {
      return '—';
    }
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (_) {
      return iso;
    }
  }

  function getRole() {
    if (root.CoreBankApp && root.CoreBankApp.state) {
      return root.CoreBankApp.state.role || 'developer';
    }
    const data = loadLedger();
    const role = data.prefs && data.prefs.role;
    return role === 'admin' ? 'admin' : 'developer';
  }

  function applyBodyRole(role) {
    document.body.setAttribute('data-role', role === 'admin' ? 'admin' : 'developer');
  }

  /**
   * @param {'success'|'error'|'validation'|'insufficient-funds'|'unauthorized'|'loading'|'storage'|'empty'|'info'} type
   * @param {string} message
   */
  function showFeedback(type, message) {
    const el = document.getElementById('feedback');
    if (!el) {
      return;
    }
    if (!message) {
      el.innerHTML = '';
      el.className = 'feedback-region';
      el.removeAttribute('data-feedback-type');
      return;
    }
    const alertClass = feedbackTypeClass[type] || 'alert-info';
    el.className = `feedback-region alert ${alertClass} mb-3`;
    el.setAttribute('data-feedback-type', type);
    if (typeof message === 'string' && message.includes('<')) {
      el.innerHTML = message;
    } else {
      el.textContent = message;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearFeedback() {
    showFeedback('info', '');
  }

  function classifyTransferError(message) {
    if (!message) {
      return 'error';
    }
    const lower = message.toLowerCase();
    if (lower.includes('insufficient') || lower.includes('blocked') || lower.includes('available')) {
      return 'insufficient-funds';
    }
    if (lower.includes('greater than') || lower.includes('different accounts') || lower.includes('required')) {
      return 'validation';
    }
    return 'error';
  }

  function serviceSuccess(result) {
    if (!result) {
      return false;
    }
    if (result.ok === true || result.success === true) {
      return true;
    }
    return false;
  }

  function serviceError(result) {
    if (!result) {
      return 'Something went wrong. Try again.';
    }
    return result.error || result.message || 'Something went wrong. Try again.';
  }

  function isLocalToday(iso) {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  function renderDashboard() {
    if (!CB() || !CB().store) {
      showFeedback('loading', 'Core banking services are still loading…');
      return;
    }

    const { accounts, transfers, transactions: txns } = loadLedger();

    const totalPaise = accounts.reduce((sum, a) => sum + accountBalancePaise(a), 0);

    let creditsToday = 0;
    let debitsToday = 0;
    txns.forEach((t) => {
      if (!isLocalToday(t.createdAt)) {
        return;
      }
      const amt = txnAmountPaise(t);
      if (t.type === 'credit') {
        creditsToday += amt;
      } else if (t.type === 'debit') {
        debitsToday += amt;
      }
    });

    const totalEl = document.querySelector('[data-summary="total-balance"]');
    const countEl = document.querySelector('[data-summary="account-count"]');
    const creditEl = document.querySelector('[data-summary="credits-today"]');
    const debitEl = document.querySelector('[data-summary="debits-today"]');

    if (totalEl) {
      totalEl.textContent = formatMoney(totalPaise);
    }
    if (countEl) {
      countEl.textContent = String(accounts.length);
    }
    if (creditEl) {
      creditEl.textContent = formatMoney(creditsToday);
    }
    if (debitEl) {
      debitEl.textContent = formatMoney(debitsToday);
    }

    const recentEl = document.getElementById('recent-transfers');
    if (!recentEl) {
      return;
    }

    if (transfers.length === 0) {
      recentEl.innerHTML =
        '<p class="text-muted p-3 mb-0 placeholder-empty">No transfers yet.</p>';
      return;
    }

    const latest = transfers
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    const rows = latest
      .map((tr) => {
        const amt = typeof tr.amount === 'number' ? tr.amount : tr.amountPaise;
        return `
          <div class="recent-transfer-row border-bottom px-3 py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <span class="badge bg-light text-dark border font-monospace">${escapeHtml(tr.transferId)}</span>
              <span class="ms-2 small">
                <strong>${escapeHtml(tr.fromAccountId)}</strong> → <strong>${escapeHtml(tr.toAccountId)}</strong>
              </span>
            </div>
            <div class="text-end">
              <span class="fw-bold font-monospace">${escapeHtml(formatMoney(amt))}</span>
              <div class="text-muted small">${escapeHtml(formatDateTime(tr.createdAt))}</div>
            </div>
          </div>
        `;
      })
      .join('');

    recentEl.innerHTML = rows;
  }

  let accountsScreenWired = false;

  function filterAccounts(accounts, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return accounts;
    }
    return accounts.filter((a) => {
      const holder = (a.holderName || '').toLowerCase();
      const id = (a.accountId || '').toLowerCase();
      const num = String(a.accountNumber || '');
      return holder.includes(q) || id.includes(q) || num.includes(q);
    });
  }

  function updateAccountFormRoleState() {
    const role = getRole();
    const isAdmin = role === 'admin';
    const submitBtn = document.getElementById('create-account-submit');
    const cardHeader = document.querySelector('#view-accounts .card-header h3');

    if (cardHeader) {
      cardHeader.innerHTML = isAdmin
        ? 'Create account <span class="badge text-bg-success ms-1 small">Admin</span>'
        : 'Create account <span class="badge text-bg-warning ms-1 small">Admin Only</span>';
    }

    if (submitBtn) {
      if (!isAdmin) {
        submitBtn.disabled = true;
        submitBtn.className = 'btn btn-secondary w-100';
        submitBtn.textContent = 'Create account (Admin Only)';
        submitBtn.title = 'Switch to Admin role in header to create accounts';
      } else {
        submitBtn.disabled = false;
        submitBtn.className = 'btn btn-primary w-100';
        submitBtn.textContent = 'Create account';
        submitBtn.title = '';
      }
    }
  }

  function renderAccountList(accounts, query) {
    const listEl = document.getElementById('account-list');
    if (!listEl) {
      return;
    }

    const all = accounts || loadLedger().accounts;
    const filtered = filterAccounts(all, query);

    if (all.length === 0) {
      listEl.innerHTML = `
        <div class="alert alert-secondary mb-0" role="status">
          No accounts yet. Create your first account or load sample data.
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="alert alert-secondary mb-0" role="status">
          No accounts match your search.
        </div>
      `;
      return;
    }

    const rows = filtered
      .map((acc) => {
        const bal = accountBalancePaise(acc);
        const balClass = bal < 0 ? 'amount-debit' : '';
        const od = acc.overdraftEnabled
          ? `<span class="badge text-bg-warning">Overdraft ${escapeHtml(formatMoney(overdraftLimitPaise(acc)))}</span>`
          : '<span class="text-muted small">No overdraft</span>';
        return `
          <tr class="account-row-clickable" data-account-id="${escapeHtml(acc.accountId)}" tabindex="0" role="button" title="Tap to view customer details">
            <td class="font-monospace fw-semibold text-primary">${escapeHtml(acc.accountId)}</td>
            <td class="font-monospace text-muted small">${escapeHtml(acc.accountNumber)}</td>
            <td><strong>${escapeHtml(acc.holderName)}</strong></td>
            <td><span class="badge text-bg-secondary text-capitalize">${escapeHtml(acc.type)}</span></td>
            <td class="text-end font-monospace fw-semibold ${balClass}">${escapeHtml(formatMoney(bal))}</td>
            <td>${od}</td>
            <td class="text-end" onclick="event.stopPropagation();">
              <button type="button" class="btn btn-sm ${getRole() === 'admin' ? 'btn-outline-danger' : 'btn-outline-secondary opacity-75'} btn-delete-account" data-account-id="${escapeHtml(acc.accountId)}" title="${getRole() === 'admin' ? 'Delete Account' : 'Admin role required to delete account'}">
                ${getRole() === 'admin' ? 'Delete' : 'Delete (Admin)'}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    listEl.innerHTML = `
      <div class="table-responsive account-table-wrap">
        <table class="table table-sm table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Account ID</th>
              <th scope="col">Number</th>
              <th scope="col">Holder</th>
              <th scope="col">Type</th>
              <th scope="col" class="text-end">Balance</th>
              <th scope="col">Overdraft</th>
              <th scope="col" class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="small text-muted mt-2 mb-0">💡 <em>Tap any customer row to view full details and download statements.</em></p>
    `;
  }

  function showCustomerDetailsModal(accountId) {
    const bank = CB();
    const data = loadLedger();
    const acc = data.accounts.find((a) => a.accountId === accountId);
    if (!acc) {
      showFeedback('error', `Account ${accountId} not found.`);
      return;
    }

    const modalEl = document.getElementById('customer-details-modal');
    const bodyEl = document.getElementById('customer-details-body');
    if (!modalEl || !bodyEl) {
      return;
    }

    const bal = accountBalancePaise(acc);
    const dateFormatted = acc.createdAt ? new Date(acc.createdAt).toLocaleString('en-IN') : 'N/A';
    const odText = acc.overdraftEnabled
      ? `Enabled (Limit: ${formatMoney(overdraftLimitPaise(acc))})`
      : 'Disabled';

    bodyEl.innerHTML = `
      <div class="row g-3">
        <div class="col-sm-6">
          <label class="text-muted small d-block">Account Holder Name</label>
          <strong class="fs-6">${escapeHtml(acc.holderName)}</strong>
        </div>
        <div class="col-sm-6">
          <label class="text-muted small d-block">Account Number</label>
          <span class="font-monospace fw-semibold">${escapeHtml(acc.accountNumber)}</span>
          <span class="badge text-bg-light border ms-1 font-monospace">${escapeHtml(acc.accountId)}</span>
        </div>
        <div class="col-sm-6">
          <label class="text-muted small d-block">Account Type</label>
          <span class="badge text-bg-secondary text-capitalize">${escapeHtml(acc.type)}</span>
        </div>
        <div class="col-sm-6">
          <label class="text-muted small d-block">Current Balance</label>
          <strong class="font-monospace fs-5 ${bal < 0 ? 'text-danger' : 'text-success'}">${escapeHtml(formatMoney(bal))}</strong>
        </div>
        <div class="col-sm-6">
          <label class="text-muted small d-block">Account Status</label>
          <span class="badge text-bg-success text-capitalize">${escapeHtml(acc.status || 'Active')}</span>
        </div>
        <div class="col-sm-6">
          <label class="text-muted small d-block">Created Date & Time</label>
          <span class="small">${escapeHtml(dateFormatted)}</span>
        </div>
        <div class="col-12">
          <label class="text-muted small d-block">Overdraft Facility</label>
          <span class="small">${escapeHtml(odText)}</span>
        </div>
      </div>
    `;

    const deleteBtn = document.getElementById('customer-details-delete-btn');
    if (deleteBtn) {
      const isAdmin = getRole() === 'admin';
      deleteBtn.textContent = isAdmin ? 'Delete Account' : 'Delete Account (Admin Only)';
      deleteBtn.className = isAdmin ? 'btn btn-outline-danger btn-sm' : 'btn btn-outline-secondary btn-sm opacity-75';
      deleteBtn.onclick = () => {
        if (!isAdmin) {
          showFeedback('error', 'Developer role does not have permission to delete accounts. Please switch to Admin role in header.');
          return;
        }
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const m = bootstrap.Modal.getInstance(modalEl);
          if (m) {
            m.hide();
          }
        }
        showDeleteAccountModal(acc.accountId);
      };
    }

    const downloadBtn = document.getElementById('customer-details-download-btn');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        downloadCreationReceipt(acc);
      };
    }

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  function showDeleteAccountModal(accountId) {
    const bank = CB();
    const data = loadLedger();
    const acc = data.accounts.find((a) => a.accountId === accountId);
    if (!acc) {
      showFeedback('error', `Account ${accountId} not found.`);
      return;
    }

    const modalEl = document.getElementById('delete-account-modal');
    const previewEl = document.getElementById('delete-account-preview');
    const confirmBtn = document.getElementById('confirm-delete-account-btn');
    if (!modalEl || !previewEl || !confirmBtn) {
      return;
    }

    const bal = accountBalancePaise(acc);
    previewEl.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <strong class="fs-6">${escapeHtml(acc.holderName)}</strong>
        <span class="badge text-bg-secondary text-capitalize">${escapeHtml(acc.type)}</span>
      </div>
      <div class="small font-monospace text-muted mb-2">
        ID: <strong>${escapeHtml(acc.accountId)}</strong> | No: <strong>${escapeHtml(acc.accountNumber)}</strong>
      </div>
      <div class="small">
        Current Balance: <strong class="font-monospace ${bal < 0 ? 'text-danger' : ''}">${escapeHtml(formatMoney(bal))}</strong>
      </div>
    `;

    confirmBtn.onclick = () => {
      const role = getRole();
      if (!bank || !bank.accountService) {
        showFeedback('error', 'Account service is not available.');
        return;
      }

      const res = bank.accountService.delete(acc.accountId, { role });
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const m = bootstrap.Modal.getInstance(modalEl);
        if (m) {
          m.hide();
        }
      }

      if (!res.ok) {
        showFeedback('error', res.error || 'Failed to delete account.');
        return;
      }

      const persistenceNote = res.persisted
        ? 'permanently deleted and updated in local storage (Admin role).'
        : 'deleted from current session only (Developer role: local storage unchanged).';

      const successHtml = `
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>Account <strong>${escapeHtml(acc.accountId)}</strong> (${escapeHtml(acc.holderName)}) ${persistenceNote}</span>
          <button type="button" class="btn btn-outline-danger btn-sm" id="btn-download-last-deletion">
            📄 Download Deletion Statement
          </button>
        </div>
      `;
      showFeedback('success', successHtml);

      const downloadLastBtn = document.getElementById('btn-download-last-deletion');
      if (downloadLastBtn) {
        downloadLastBtn.onclick = () => {
          downloadDeletionReceipt(acc, role);
        };
      }

      renderAccountList();
      populateAccountSelects();
      renderDashboard();
    };

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  function downloadCreationReceipt(acc) {
    const bank = CB();
    if (!bank || !bank.statementService) {
      showFeedback('error', 'Statement service is not available.');
      return;
    }
    const role = getRole();
    const bal = accountBalancePaise(acc);
    const receiptText = bank.statementService.generateAtmReceipt({
      dateTime: acc.createdAt,
      accountNumber: acc.accountNumber,
      accountId: acc.accountId,
      holderName: acc.holderName,
      accountType: acc.type,
      txnType: 'created',
      role: role,
      balancePaise: bal,
      status: acc.status || 'ACTIVE'
    });

    bank.statementService.downloadReceiptFile(
      receiptText,
      `atm_receipt_${acc.accountId}_created.txt`
    );
    showAtmReceiptModal(receiptText, `atm_receipt_${acc.accountId}_created.txt`);
  }

  function downloadDeletionReceipt(acc, role) {
    const bank = CB();
    if (!bank || !bank.statementService) {
      showFeedback('error', 'Statement service is not available.');
      return;
    }
    const receiptText = bank.statementService.generateAtmReceipt({
      dateTime: new Date().toISOString(),
      accountNumber: acc.accountNumber,
      accountId: acc.accountId,
      holderName: acc.holderName,
      accountType: acc.type,
      txnType: 'deleted',
      role: role || getRole(),
      balancePaise: 0,
      status: 'ACCOUNT CLOSED'
    });

    bank.statementService.downloadReceiptFile(
      receiptText,
      `atm_receipt_${acc.accountId}_deleted.txt`
    );
    showAtmReceiptModal(receiptText, `atm_receipt_${acc.accountId}_deleted.txt`);
  }

  function showAtmReceiptModal(receiptText, filename) {
    const modalEl = document.getElementById('atm-receipt-modal');
    const textEl = document.getElementById('atm-receipt-text');
    const downloadBtn = document.getElementById('atm-receipt-download-file-btn');
    if (!modalEl || !textEl) {
      return;
    }
    textEl.textContent = receiptText;
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const bank = CB();
        if (bank && bank.statementService) {
          bank.statementService.downloadReceiptFile(receiptText, filename);
        }
      };
    }
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  function wireAccountsScreen() {
    if (accountsScreenWired) {
      return;
    }
    accountsScreenWired = true;

    const listEl = document.getElementById('account-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.btn-delete-account');
        if (delBtn) {
          e.stopPropagation();
          const role = getRole();
          if (role !== 'admin') {
            showFeedback('error', 'Developer role does not have permission to delete accounts. Please switch to Admin role in header.');
            return;
          }
          const accId = delBtn.getAttribute('data-account-id');
          if (accId) {
            showDeleteAccountModal(accId);
          }
          return;
        }

        const row = e.target.closest('.account-row-clickable');
        if (row) {
          const accId = row.getAttribute('data-account-id');
          if (accId) {
            showCustomerDetailsModal(accId);
          }
        }
      });

      listEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const row = e.target.closest('.account-row-clickable');
          if (row) {
            e.preventDefault();
            const accId = row.getAttribute('data-account-id');
            if (accId) {
              showCustomerDetailsModal(accId);
            }
          }
        }
      });
    }

    const searchInput = document.getElementById('account-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderAccountList(null, searchInput.value);
      });
    }

    const form = document.getElementById('create-account-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const bank = CB();
        if (!bank || !bank.accountService) {
          showFeedback('error', 'Account service is not available.');
          return;
        }

        const holderInput = document.getElementById('create-account-holder');
        const typeInput = document.getElementById('create-account-type');
        const openingInput = document.getElementById('create-account-opening');
        const submitBtn = document.getElementById('create-account-submit');

        const holderName = holderInput ? holderInput.value.trim() : '';
        const type = typeInput ? typeInput.value : '';
        const openingStr = openingInput ? openingInput.value : '';

        if (!holderName) {
          showFeedback('validation', 'Account holder name is required.');
          return;
        }
        if (!type) {
          showFeedback('validation', 'Select an account type.');
          return;
        }

        let openingDepositPaise = 0;
        if (openingStr !== '' && openingStr != null) {
          openingDepositPaise = bank.money.rupeesToPaise(openingStr);
          if (!Number.isFinite(openingDepositPaise) || openingDepositPaise < 0) {
            showFeedback(
              'validation',
              'Invalid amount format. Use positive numbers with at most 2 decimal places (e.g. 150.00).'
            );
            return;
          }
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating…';
        }

        const role = getRole();
        if (role !== 'admin') {
          showFeedback('error', 'Developer role does not have permission to create accounts. Please switch to Admin role in header.');
          updateAccountFormRoleState();
          return;
        }

        const result = bank.accountService.create(
          {
            holderName,
            type,
            openingDepositPaise
          },
          { role }
        );

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
        }

        if (!serviceSuccess(result)) {
          showFeedback('validation', serviceError(result));
          return;
        }

        const newAcc = result.account;
        const persistenceNote = result.persisted
          ? 'created and saved to local storage (Admin role).'
          : 'created for current session only (Developer role: local storage unchanged).';

        const successHtml = `
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>Account <strong>${escapeHtml(newAcc.accountId)}</strong> (${escapeHtml(newAcc.holderName)}) ${persistenceNote}</span>
            <button type="button" class="btn btn-outline-primary btn-sm" id="btn-download-new-account-receipt">
              📄 Download Creation Statement
            </button>
          </div>
        `;
        showFeedback('success', successHtml);

        const dlBtn = document.getElementById('btn-download-new-account-receipt');
        if (dlBtn) {
          dlBtn.onclick = () => {
            downloadCreationReceipt(newAcc);
          };
        }

        form.reset();
        renderAccountList();
        renderDashboard();
        populateAccountSelects();
      });
    }
  }

  function renderAccounts() {
    wireAccountsScreen();
    const searchInput = document.getElementById('account-search');
    const query = searchInput ? searchInput.value : '';
    renderAccountList(null, query);
    updateAccountFormRoleState();
  }

  function populateAccountSelects() {
    const bank = CB();
    const accounts = loadLedger().accounts;

    const fromSel = document.getElementById('transfer-from');
    const toSel = document.getElementById('transfer-to');
    const stmtSel = document.getElementById('statement-account');

    if (fromSel) {
      const prev = fromSel.value;
      fromSel.innerHTML =
        '<option value="" disabled selected>Select source account</option>' +
        accounts
          .map((a) => {
            const bal = accountBalancePaise(a);
            return `<option value="${escapeHtml(a.accountId)}">${escapeHtml(a.accountId)} — ${escapeHtml(a.holderName)}</option>`;
          })
          .join('');
      if (prev && accounts.some((a) => a.accountId === prev)) {
        fromSel.value = prev;
      }
    }

    if (toSel) {
      const prev = toSel.value;
      toSel.innerHTML =
        '<option value="" disabled selected>Select destination account</option>' +
        accounts
          .map((a) => `<option value="${escapeHtml(a.accountId)}">${escapeHtml(a.accountId)} — ${escapeHtml(a.holderName)}</option>`)
          .join('');
      if (prev && accounts.some((a) => a.accountId === prev)) {
        toSel.value = prev;
      }
    }

    if (stmtSel) {
      const prefs = loadLedger().prefs || {};
      const selected =
        (root.CoreBankApp && root.CoreBankApp.state && root.CoreBankApp.state.statementAccountId) ||
        prefs.lastAccountId ||
        (accounts[0] && accounts[0].accountId) ||
        '';
      stmtSel.innerHTML =
        '<option value="" disabled selected>Select account</option>' +
        accounts
          .map((a) => {
            const sel = a.accountId === selected ? ' selected' : '';
            return `<option value="${escapeHtml(a.accountId)}"${sel}>${escapeHtml(a.accountId)} — ${escapeHtml(a.holderName)}</option>`;
          })
          .join('');
      if (selected) {
        stmtSel.value = selected;
      }
    }
  }

  let transferWired = false;

  function renderTransferResult(html) {
    const el = document.getElementById('transfer-result');
    if (el) {
      el.innerHTML = html;
    }
  }

  function wireTransferScreen() {
    if (transferWired) {
      return;
    }
    transferWired = true;

    const form = document.getElementById('transfer-form');
    if (!form) {
      return;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bank = CB();
      const app = root.CoreBankApp;
      if (!bank || !bank.transferService) {
        showFeedback('error', 'Transfer service is not available.');
        return;
      }
      if (app && app.state && app.state.isTransferSubmitting) {
        return;
      }

      const fromId = document.getElementById('transfer-from')?.value;
      const toId = document.getElementById('transfer-to')?.value;
      const amountStr = document.getElementById('transfer-amount')?.value;
      const reference = document.getElementById('transfer-reference')?.value || '';
      const submitBtn = document.getElementById('transfer-submit');

      if (!fromId || !toId) {
        showFeedback('validation', 'Both source and destination accounts must be selected.');
        return;
      }
      if (fromId === toId) {
        showFeedback('validation', 'Choose two different accounts to transfer between.');
        return;
      }

      const amountPaise = bank.money.rupeesToPaise(amountStr);
      if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        showFeedback('validation', 'Enter an amount greater than ₹0.00.');
        return;
      }

      if (app && app.state) {
        app.state.isTransferSubmitting = true;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing…';
      }
      renderTransferResult(
        '<p class="text-muted mb-0"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Processing transfer…</p>'
      );

      const result = bank.transferService.apply({
        fromAccountId: fromId,
        toAccountId: toId,
        amountPaise,
        reference
      });

      if (app && app.state) {
        app.state.isTransferSubmitting = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Transfer';
      }

      if (!serviceSuccess(result)) {
        const err = serviceError(result);
        const fbType = classifyTransferError(err);
        showFeedback(fbType, err);
        renderTransferResult(`<p class="amount-debit mb-0">${escapeHtml(err)}</p>`);
        return;
      }

      const msg =
        result.message ||
        `Transfer complete. ${formatMoney(amountPaise)} sent from ${fromId} to ${toId}.`;
      showFeedback('success', msg);
      renderTransferResult(`<p class="amount-credit fw-semibold mb-0">${escapeHtml(msg)}</p>`);
      form.reset();
      populateAccountSelects();
      renderDashboard();
    });
  }

  function renderTransfer() {
    populateAccountSelects();
    wireTransferScreen();
    renderTransferResult(
      '<p class="text-muted mb-0 placeholder-empty">Submit a transfer to see the outcome.</p>'
    );
  }

  function getStatementFiltersFromDom() {
    const type = document.getElementById('statement-type')?.value || 'all';
    const startDate = document.getElementById('statement-from-date')?.value || '';
    const endDate = document.getElementById('statement-to-date')?.value || '';
    return { type, startDate, endDate };
  }

  function persistStatementPrefs(accountId, filters) {
    const save = saveSandboxPrefs({
      lastAccountId: accountId,
      statementFilters: filters
    });
    if (save && save.ok === false) {
      showFeedback('storage', save.error || 'Could not save statement preferences.');
    }
  }

  let statementVisibleRows = [];

  function renderStatementTable(rows) {
    const tbody = document.getElementById('statement-table-body');
    if (!tbody) {
      return;
    }
    statementVisibleRows = rows || [];

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr class="statement-empty-row">
          <td colspan="5" class="text-muted p-3">No transactions match the selected filters.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const amt = txnAmountPaise(row);
        const bal = txnBalanceAfterPaise(row);
        const typeLabel = row.type === 'credit' ? 'Credit' : 'Debit';
        const typeClass = row.type === 'credit' ? 'amount-credit' : 'amount-debit';
        const sign = row.type === 'credit' ? '+' : '−';
        return `
          <tr>
            <td class="text-muted small">${escapeHtml(formatDateTime(row.createdAt))}</td>
            <td>
              <div class="fw-semibold">${escapeHtml(row.reference || 'Transaction')}</div>
              <small class="text-muted font-monospace">${escapeHtml(row.txnId || '')}${row.transferId ? ` · ${escapeHtml(row.transferId)}` : ''}</small>
            </td>
            <td><span class="badge text-bg-light border text-capitalize">${escapeHtml(typeLabel)}</span></td>
            <td class="text-end font-monospace ${typeClass}">${sign}${escapeHtml(formatMoney(amt).replace(/^-/, ''))}</td>
            <td class="text-end font-monospace fw-semibold">${escapeHtml(formatMoney(bal))}</td>
          </tr>
        `;
      })
      .join('');
  }

  function loadStatementData() {
    const bank = CB();
    if (!bank || !bank.balanceCalculator) {
      showFeedback('error', 'Statement service is not available.');
      return;
    }

    const accountId = document.getElementById('statement-account')?.value;
    if (!accountId) {
      renderStatementTable([]);
      const openEl = document.getElementById('statement-opening');
      const closeEl = document.getElementById('statement-closing');
      if (openEl) {
        openEl.textContent = '—';
      }
      if (closeEl) {
        closeEl.textContent = '—';
      }
      return;
    }

    const filters = getStatementFiltersFromDom();
    persistStatementPrefs(accountId, filters);

    if (root.CoreBankApp && root.CoreBankApp.state) {
      root.CoreBankApp.state.statementAccountId = accountId;
    }

    const rows = bank.balanceCalculator.statementRows(accountId, filters) || [];
    const range =
      typeof bank.balanceCalculator.rangeBalances === 'function'
        ? bank.balanceCalculator.rangeBalances(accountId, filters)
        : { opening: 0, closing: 0 };
    const opening = range.opening;
    const closing = range.closing;

    const openEl = document.getElementById('statement-opening');
    const closeEl = document.getElementById('statement-closing');
    if (openEl) {
      openEl.textContent = typeof opening === 'number' ? formatMoney(opening) : '—';
    }
    if (closeEl) {
      closeEl.textContent = typeof closing === 'number' ? formatMoney(closing) : '—';
    }

    renderStatementTable(Array.isArray(rows) ? rows : []);
  }

  let statementWired = false;

  function exportStatementCsv() {
    if (!statementVisibleRows.length) {
      showFeedback('empty', 'No transactions to export. Apply filters with at least one row visible.');
      return;
    }

    const accountId = document.getElementById('statement-account')?.value || 'account';
    const headers = ['Date', 'Description', 'Type', 'Amount (INR)', 'Balance (INR)', 'Transaction ID', 'Transfer ID'];
    const lines = [headers.join(',')];

    statementVisibleRows.forEach((row) => {
      const amt = txnAmountPaise(row);
      const bal = txnBalanceAfterPaise(row);
      const rupeesAmt = (Math.abs(amt) / 100).toFixed(2);
      const rupeesBal = (bal / 100).toFixed(2);
      const ref = (row.reference || '').replace(/"/g, '""');
      lines.push(
        [
          `"${formatDateTime(row.createdAt)}"`,
          `"${ref}"`,
          `"${(row.type || '').toUpperCase()}"`,
          rupeesAmt,
          rupeesBal,
          `"${row.txnId || ''}"`,
          `"${row.transferId || ''}"`
        ].join(',')
      );
    });

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Statement_${accountId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showFeedback('success', `Statement exported (${statementVisibleRows.length} row(s)).`);
  }

  function wireStatementScreen() {
    if (statementWired) {
      return;
    }
    statementWired = true;

    const filterForm = document.getElementById('statement-filters');
    if (filterForm) {
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadStatementData();
      });
    }

    const accountSel = document.getElementById('statement-account');
    if (accountSel) {
      accountSel.addEventListener('change', loadStatementData);
    }

    const exportBtn = document.getElementById('statement-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportStatementCsv);
    }

    const downloadCreationBtn = document.getElementById('statement-download-creation');
    if (downloadCreationBtn) {
      downloadCreationBtn.addEventListener('click', () => {
        const select = document.getElementById('statement-account');
        const accountId = select ? select.value : '';
        if (!accountId) {
          showFeedback('validation', 'Please select an account first to download its creation statement.');
          return;
        }
        const data = loadLedger();
        const acc = data.accounts.find((a) => a.accountId === accountId);
        if (!acc) {
          showFeedback('error', `Account ${accountId} not found.`);
          return;
        }
        downloadCreationReceipt(acc);
        showFeedback('success', `Account creation statement downloaded for ${acc.accountId}.`);
      });
    }

    const downloadDeletionBtn = document.getElementById('statement-download-deletion');
    if (downloadDeletionBtn) {
      downloadDeletionBtn.addEventListener('click', () => {
        const select = document.getElementById('statement-account');
        const accountId = select ? select.value : '';
        const bank = CB();
        const deletedRecord = accountId && bank && bank.statementService
          ? bank.statementService.getDeletedRecord(accountId)
          : null;

        if (deletedRecord) {
          downloadDeletionReceipt(deletedRecord.account, deletedRecord.role);
          showFeedback('success', `Account deletion statement downloaded for ${deletedRecord.account.accountId}.`);
          return;
        }

        if (accountId) {
          const data = loadLedger();
          const acc = data.accounts.find((a) => a.accountId === accountId);
          if (acc) {
            downloadDeletionReceipt(acc, getRole());
            showFeedback('success', `Account deletion statement downloaded for ${acc.accountId}.`);
            return;
          }
        }

        const allDeleted = bank && bank.statementService ? bank.statementService.getAllDeletedRecords() : [];
        if (allDeleted.length) {
          const latest = allDeleted[allDeleted.length - 1];
          downloadDeletionReceipt(latest.account, latest.role);
          showFeedback('success', `Account deletion statement downloaded for ${latest.account.accountId}.`);
          return;
        }

        showFeedback('validation', 'Please select an account first or delete an account to generate a deletion statement.');
      });
    }
  }

  function renderStatement() {
    wireStatementScreen();
    populateAccountSelects();

    const prefs = loadLedger().prefs || {};
    const saved = (prefs && prefs.statementFilters) || {};
    const fromInput = document.getElementById('statement-from-date');
    const toInput = document.getElementById('statement-to-date');
    const typeInput = document.getElementById('statement-type');
    if (fromInput && saved.startDate) {
      fromInput.value = saved.startDate;
    }
    if (toInput && saved.endDate) {
      toInput.value = saved.endDate;
    }
    if (typeInput && saved.type) {
      typeInput.value = saved.type;
    }

    loadStatementData();
  }

  let adminWired = false;

  function wireAdminScreen() {
    if (adminWired) {
      return;
    }
    adminWired = true;

    const resetBtn = document.getElementById('admin-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const role = getRole();
        const bank = CB();
        if (!bank || !bank.roleGuard || !bank.roleGuard.canAdmin(role)) {
          showFeedback('unauthorized', 'Admin role required to reset sandbox data.');
          return;
        }

        const confirmed = window.confirm(
          'Reset sandbox data? This clears local demo data and restores the default sample accounts and transactions.'
        );
        if (!confirmed) {
          return;
        }

        const resetResult = bank.store.resetToSample ? bank.store.resetToSample() : { ok: false };
        if (resetResult && resetResult.ok === false) {
          showFeedback('storage', resetResult.error || 'Could not reset sandbox data in storage.');
          return;
        }

        showFeedback(
          'success',
          'Sandbox restored to documented sample accounts and initial transactions.'
        );
        renderAdmin();
        renderDashboard();
        renderAccounts();
        populateAccountSelects();
        if (root.CoreBankApp && typeof root.CoreBankApp.navigate === 'function') {
          root.CoreBankApp.navigate('dashboard');
        }
      });
    }
  }

  function renderAdmin() {
    wireAdminScreen();
    const role = getRole();
    const bank = CB();
    const canAdmin = bank && bank.roleGuard && bank.roleGuard.canAdmin(role);
    const container = document.getElementById('overdraft-settings');
    const resetBtn = document.getElementById('admin-reset');
    const resetCard = resetBtn ? resetBtn.closest('.card') : null;

    if (!canAdmin) {
      if (container) {
        container.innerHTML = `
          <div class="alert alert-warning mb-0" role="alert">
            Unauthorized: switch to <strong>Admin</strong> role to manage overdraft settings and reset sandbox data.
          </div>
        `;
      }
      if (resetCard) {
        resetCard.classList.add('d-none');
      }
      return;
    }

    if (resetCard) {
      resetCard.classList.remove('d-none');
    }

    if (!bank || !bank.store) {
      return;
    }

    const accounts = loadLedger().accounts;
    if (!container) {
      return;
    }

    if (accounts.length === 0) {
      container.innerHTML =
        '<p class="text-muted mb-0 placeholder-empty">No accounts loaded.</p>';
      return;
    }

    const rows = accounts
      .map((acc) => {
        const limitPaise = overdraftLimitPaise(acc);
        const limitRupees = (limitPaise / 100).toFixed(2);
        const checked = acc.overdraftEnabled ? ' checked' : '';
        const disabled = acc.overdraftEnabled ? '' : ' disabled';
        return `
          <tr data-account-id="${escapeHtml(acc.accountId)}">
            <td class="font-monospace fw-semibold">${escapeHtml(acc.accountId)}</td>
            <td>${escapeHtml(acc.holderName)}</td>
            <td class="text-end font-monospace">${escapeHtml(formatMoney(accountBalancePaise(acc)))}</td>
            <td>
              <div class="form-check form-switch">
                <input class="form-check-input od-enabled" type="checkbox" id="od-${escapeHtml(acc.accountId)}"${checked} aria-label="Overdraft enabled for ${escapeHtml(acc.accountId)}">
              </div>
            </td>
            <td style="min-width: 9rem;">
              <div class="input-group input-group-sm">
                <span class="input-group-text">₹</span>
                <input type="number" class="form-control od-limit" min="0" step="0.01" value="${limitRupees}"${disabled}>
              </div>
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-primary od-save">Save</button>
            </td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Holder</th>
              <th scope="col" class="text-end">Balance</th>
              <th scope="col">Overdraft</th>
              <th scope="col">Limit (₹)</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('tbody tr').forEach((row) => {
      const accountId = row.getAttribute('data-account-id');
      const toggle = row.querySelector('.od-enabled');
      const limitInput = row.querySelector('.od-limit');
      const saveBtn = row.querySelector('.od-save');

      if (toggle && limitInput) {
        toggle.addEventListener('change', () => {
          limitInput.disabled = !toggle.checked;
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          if (!bank.adminService) {
            showFeedback('error', 'Admin service is not available.');
            return;
          }

          const enabled = toggle ? toggle.checked : false;
          let limitPaise = 0;
          if (enabled) {
            limitPaise = bank.money.rupeesToPaise(limitInput ? limitInput.value : '0');
            if (!Number.isFinite(limitPaise) || limitPaise < 0) {
              showFeedback('validation', 'Overdraft limit cannot be negative.');
              return;
            }
          }

          const result = bank.adminService.setOverdraft(accountId, enabled, limitPaise);
          if (!serviceSuccess(result)) {
            showFeedback('error', serviceError(result));
            return;
          }
          showFeedback(
            'success',
            result.message ||
              `Overdraft settings updated for ${accountId}: ${
                enabled ? 'enabled (' + formatMoney(limitPaise) + ')' : 'disabled'
              }.`
          );
          renderAdmin();
          renderAccounts();
          populateAccountSelects();
        });
      }
    });
  }

  function renderAbout() {
    const role = getRole();
    const meta = document.querySelector('#view-about .view-header .text-muted');
    if (meta) {
      const roleLabel = role === 'admin' ? 'Admin' : 'Developer';
      meta.textContent = `How this sandbox behaves. Current role: ${roleLabel}.`;
    }
  }

  function updateThemeToggleUI() {
    const bank = CB();
    const theme = (bank && bank.themeService) ? bank.themeService.getTheme() : 'light';
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);

    const iconEl = document.getElementById('theme-toggle-icon');
    const textEl = document.getElementById('theme-toggle-text');
    if (iconEl) {
      iconEl.textContent = isDark ? '☀️' : '🌙';
    }
    if (textEl) {
      textEl.textContent = isDark ? 'Light' : 'Dark';
    }
  }

  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn || btn.dataset.wired) {
      return;
    }
    btn.dataset.wired = 'true';

    btn.addEventListener('click', () => {
      const bank = CB();
      if (!bank || !bank.themeService) {
        return;
      }
      const role = getRole();
      const currentTheme = bank.themeService.getTheme();
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

      // Logic check: Developer role is blocked with a RED error message
      const res = bank.themeService.setTheme(nextTheme, role);
      if (!res.ok) {
        showFeedback('error', res.error || 'Developer role does not have privilege to change themes.');
        return;
      }
      updateThemeToggleUI();
      showFeedback('info', `Theme changed to ${nextTheme} mode.`);
    });
  }

  function renderRoleSwitch() {
    const role = getRole();
    const devRadio = document.getElementById('role-developer');
    const adminRadio = document.getElementById('role-admin');
    if (devRadio) {
      devRadio.checked = role !== 'admin';
    }
    if (adminRadio) {
      adminRadio.checked = role === 'admin';
    }
    applyBodyRole(role);

    // Theme toggle container: Available to Admin only. Hide/disable for Developer.
    const themeContainer = document.getElementById('theme-switch-container');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeContainer) {
      if (role === 'admin') {
        themeContainer.classList.remove('d-none');
        if (themeBtn) {
          themeBtn.disabled = false;
        }
      } else {
        themeContainer.classList.add('d-none');
        if (themeBtn) {
          themeBtn.disabled = true;
        }
      }
    }
    wireThemeToggle();
    updateThemeToggleUI();
    updateAccountFormRoleState();
    const searchInput = document.getElementById('account-search');
    renderAccountList(null, searchInput ? searchInput.value : '');
  }

  function refreshForView(view) {
    clearFeedback();
    switch (view) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'accounts':
        renderAccounts();
        break;
      case 'transfer':
        renderTransfer();
        break;
      case 'statement':
        renderStatement();
        break;
      case 'admin':
        renderAdmin();
        break;
      case 'about':
        renderAbout();
        break;
      default:
        break;
    }
  }

  const ui = {
    showFeedback,
    clearFeedback,
    renderDashboard,
    renderAccounts,
    renderTransfer,
    renderStatement,
    renderAdmin,
    renderAbout,
    renderRoleSwitch,
    populateAccountSelects,
    refreshForView,
    applyBodyRole,
    updateThemeToggleUI,
    getRole
  };

  root.CoreBankUI = ui;
})(typeof window !== 'undefined' ? window : globalThis);