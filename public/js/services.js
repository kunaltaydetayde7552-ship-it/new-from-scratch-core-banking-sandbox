/**
 * CoreBanking Sandbox — transfer, balance, account, admin, role services.
 * Depends on: money.js, sample-data.js, store.js (load order).
 */
(function (root) {
  'use strict';

  function getDeps() {
    const cb = root.CoreBank || {};
    return {
      money: cb.money,
      store: cb.store
    };
  }

  function isActiveAccount(account) {
    if (!account) {
      return false;
    }
    const status = String(account.status || '').toLowerCase();
    return status === 'active';
  }

  function accountTxnsSorted(transactions, accountId) {
    return transactions
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  const BalanceCalculator = {
    currentBalance(accountId) {
      const { store } = getDeps();
      const loaded = store.load();
      if (!loaded.ok) {
        return 0;
      }
      const rows = accountTxnsSorted(loaded.transactions, accountId);
      if (!rows.length) {
        return 0;
      }
      return rows[rows.length - 1].balanceAfter;
    },

    availableBalance(accountId) {
      const { store } = getDeps();
      const loaded = store.load();
      if (!loaded.ok) {
        return 0;
      }
      const account = loaded.accounts.find((a) => a.accountId === accountId);
      const balance = this.currentBalance(accountId);
      if (!account || !account.overdraftEnabled) {
        return Math.max(0, balance);
      }
      return balance + account.overdraftLimit;
    },

    statementRows(accountId, filters) {
      const { store } = getDeps();
      const loaded = store.load();
      if (!loaded.ok) {
        return [];
      }
      const f = filters || {};
      let rows = accountTxnsSorted(loaded.transactions, accountId);

      if (f.type && f.type !== 'all') {
        const want = String(f.type).toLowerCase();
        rows = rows.filter((r) => r.type === want);
      }
      if (f.startDate) {
        const start = new Date(f.startDate).getTime();
        rows = rows.filter((r) => new Date(r.createdAt).getTime() >= start);
      }
      if (f.endDate) {
        const end = new Date(f.endDate).getTime() + 86400000 - 1;
        rows = rows.filter((r) => new Date(r.createdAt).getTime() <= end);
      }
      return rows;
    },

    rangeBalances(accountId, filters) {
      const { store } = getDeps();
      const loaded = store.load();
      if (!loaded.ok) {
        return { opening: 0, closing: 0 };
      }
      const f = filters || {};
      const all = accountTxnsSorted(loaded.transactions, accountId);

      let opening = 0;
      if (f.startDate) {
        const start = new Date(f.startDate).getTime();
        const before = all.filter((r) => new Date(r.createdAt).getTime() < start);
        if (before.length) {
          opening = before[before.length - 1].balanceAfter;
        }
      } else if (all.length) {
        opening = 0;
      }

      let inRange = all;
      if (f.startDate) {
        const start = new Date(f.startDate).getTime();
        inRange = inRange.filter((r) => new Date(r.createdAt).getTime() >= start);
      }
      if (f.endDate) {
        const end = new Date(f.endDate).getTime() + 86400000 - 1;
        inRange = inRange.filter((r) => new Date(r.createdAt).getTime() <= end);
      }

      let closing;
      if (inRange.length) {
        closing = inRange[inRange.length - 1].balanceAfter;
      } else if (f.startDate) {
        closing = opening;
      } else if (all.length) {
        closing = all[all.length - 1].balanceAfter;
      } else {
        closing = 0;
      }

      if (!f.startDate && all.length) {
        opening = 0;
      }

      return { opening, closing };
    }
  };

  function nextAccountId(accounts) {
    let max = 1000;
    accounts.forEach((a) => {
      const m = a.accountId && a.accountId.match(/^ACC-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) {
          max = n;
        }
      }
    });
    const next = max + 1;
    return {
      accountId: `ACC-${next}`,
      accountNumber: `100100${String(next).padStart(4, '0')}`
    };
  }

  function nextTxnId(transactions) {
    let max = 0;
    transactions.forEach((t) => {
      const m = t.txnId && t.txnId.match(/^TXN-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) {
          max = n;
        }
      }
    });
    return `TXN-${String(max + 1).padStart(3, '0')}`;
  }

  function nextTransferId(transfers) {
    let max = 1000;
    transfers.forEach((t) => {
      const m = t.transferId && t.transferId.match(/^TRF-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) {
          max = n;
        }
      }
    });
    return `TRF-${max + 1}`;
  }

  const AccountService = {
    create({ holderName, type, openingDepositPaise }, options = {}) {
      const { store } = getDeps();
      if (!holderName || !String(holderName).trim()) {
        return { ok: false, error: 'Account holder name is required.' };
      }
      if (type !== 'savings' && type !== 'current') {
        return { ok: false, error: 'Account type must be savings or current.' };
      }
      if (openingDepositPaise === undefined || openingDepositPaise < 0) {
        return { ok: false, error: 'Opening deposit cannot be negative.' };
      }

      const role = options.role || (root.CoreBank && root.CoreBank.getRole ? root.CoreBank.getRole() : 'developer');
      if (!RoleGuard.canPersistAccountChanges(role)) {
        return {
          ok: false,
          error: 'Developer role does not have permission to create accounts. Please switch to Admin role.'
        };
      }
      const shouldPersist = true;

      const loaded = store.load();
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      const ids = nextAccountId(loaded.accounts);
      const now = new Date().toISOString();
      const account = {
        accountId: ids.accountId,
        accountNumber: ids.accountNumber,
        holderName: String(holderName).trim(),
        type,
        openingDeposit: openingDepositPaise,
        overdraftEnabled: false,
        overdraftLimit: 0,
        status: 'Active',
        createdAt: now
      };

      const accounts = [...loaded.accounts, account];
      const transactions = [...loaded.transactions];

      if (openingDepositPaise > 0) {
        transactions.push({
          txnId: nextTxnId(transactions),
          transferId: null,
          accountId: account.accountId,
          type: 'credit',
          amount: openingDepositPaise,
          reference: 'Account Opening Deposit',
          balanceAfter: openingDepositPaise,
          createdAt: now
        });
      }

      const saveResult = store.save({
        accounts,
        transactions,
        transfers: loaded.transfers,
        prefs: loaded.prefs || (root.CoreBank.sampleData && root.CoreBank.sampleData.getDefaultPrefs())
      }, { persist: shouldPersist });

      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }
      return { ok: true, account, persisted: shouldPersist, role };
    },

    delete(accountId, options = {}) {
      const { store } = getDeps();
      if (!accountId) {
        return { ok: false, error: 'Account ID is required for deletion.' };
      }

      const role = options.role || (root.CoreBank && root.CoreBank.getRole ? root.CoreBank.getRole() : 'developer');
      if (!RoleGuard.canPersistAccountChanges(role)) {
        return {
          ok: false,
          error: 'Developer role does not have permission to delete accounts. Please switch to Admin role.'
        };
      }
      const shouldPersist = true;

      const loaded = store.load();
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      const account = loaded.accounts.find((a) => a.accountId === accountId);
      if (!account) {
        return { ok: false, error: `Account ${accountId} not found.` };
      }

      const updatedAccounts = loaded.accounts.filter((a) => a.accountId !== accountId);

      const saveResult = store.save({
        accounts: updatedAccounts,
        transactions: loaded.transactions,
        transfers: loaded.transfers,
        prefs: loaded.prefs
      }, { persist: shouldPersist });

      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }

      // Record deletion in memory for ATM deletion statement download
      StatementService.recordDeletion(account, role);

      return { ok: true, account, persisted: shouldPersist, role };
    }
  };

  const TransferService = {
    apply({ fromAccountId, toAccountId, amountPaise, reference }) {
      const { store, money } = getDeps();

      if (!amountPaise || amountPaise <= 0) {
        return { ok: false, error: 'Transfer amount must be greater than zero.' };
      }
      if (!fromAccountId || !toAccountId) {
        return { ok: false, error: 'Source and destination accounts are required.' };
      }
      if (fromAccountId === toAccountId) {
        return { ok: false, error: 'Source and destination must be different accounts.' };
      }

      const loaded = store.load();
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      const source = loaded.accounts.find((a) => a.accountId === fromAccountId);
      const dest = loaded.accounts.find((a) => a.accountId === toAccountId);

      if (!source) {
        return { ok: false, error: `Source account ${fromAccountId} not found.` };
      }
      if (!dest) {
        return { ok: false, error: `Destination account ${toAccountId} not found.` };
      }
      if (!isActiveAccount(source)) {
        return { ok: false, error: `Source account ${fromAccountId} is not active.` };
      }
      if (!isActiveAccount(dest)) {
        return { ok: false, error: `Destination account ${toAccountId} is not active.` };
      }

      const sourceBalance = BalanceCalculator.currentBalance(fromAccountId);
      const destBalance = BalanceCalculator.currentBalance(toAccountId);
      const newSourceBalance = sourceBalance - amountPaise;

      if (!source.overdraftEnabled) {
        if (newSourceBalance < 0) {
          return {
            ok: false,
            error: `Insufficient funds. Available: ${money.formatINR(sourceBalance)}.`
          };
        }
      } else {
        const floor = -source.overdraftLimit;
        if (newSourceBalance < floor) {
          const available = sourceBalance + source.overdraftLimit;
          return {
            ok: false,
            error: `Overdraft limit exceeded. Max spendable: ${money.formatINR(available)}.`
          };
        }
      }

      const newDestBalance = destBalance + amountPaise;
      const now = new Date().toISOString();
      const transferId = nextTransferId(loaded.transfers);
      const refText = reference && String(reference).trim() ? String(reference).trim() : 'Transfer';

      const transactions = [...loaded.transactions];
      const debitTxnId = nextTxnId(transactions);
      transactions.push({
        txnId: debitTxnId,
        transferId,
        accountId: source.accountId,
        type: 'debit',
        amount: amountPaise,
        reference: `Transfer to ${dest.accountId}: ${refText}`,
        balanceAfter: newSourceBalance,
        createdAt: now
      });

      const creditTxnId = nextTxnId(transactions);
      transactions.push({
        txnId: creditTxnId,
        transferId,
        accountId: dest.accountId,
        type: 'credit',
        amount: amountPaise,
        reference: `Transfer from ${source.accountId}: ${refText}`,
        balanceAfter: newDestBalance,
        createdAt: now
      });

      const transfers = [
        ...loaded.transfers,
        {
          transferId,
          fromAccountId: source.accountId,
          toAccountId: dest.accountId,
          amount: amountPaise,
          reference: refText,
          status: 'success',
          reason: '',
          createdAt: now
        }
      ];

      const saveResult = store.save({
        accounts: loaded.accounts,
        transactions,
        transfers,
        prefs: loaded.prefs
      });

      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }

      return {
        ok: true,
        transferId,
        debitTxnId,
        creditTxnId,
        sourceBalanceAfter: newSourceBalance,
        destBalanceAfter: newDestBalance
      };
    }
  };

  const AdminService = {
    setOverdraft(accountId, enabled, limitPaise) {
      const { store, money } = getDeps();
      const loaded = store.load();
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      const accounts = [...loaded.accounts];
      const account = accounts.find((a) => a.accountId === accountId);
      if (!account) {
        return { ok: false, error: `Account ${accountId} not found.` };
      }

      const limit = enabled ? Math.max(0, limitPaise || 0) : 0;
      const balance = BalanceCalculator.currentBalance(accountId);

      if (balance < 0) {
        const deficit = Math.abs(balance);
        if (!enabled) {
          return {
            ok: false,
            error: `Cannot disable overdraft while balance is ${money.formatINR(balance)}.`
          };
        }
        if (limit < deficit) {
          return {
            ok: false,
            error: `Overdraft limit must be at least ${money.formatINR(deficit)} to cover current deficit.`
          };
        }
      }

      account.overdraftEnabled = Boolean(enabled);
      account.overdraftLimit = enabled ? limit : 0;

      const saveResult = store.save({
        accounts,
        transactions: loaded.transactions,
        transfers: loaded.transfers,
        prefs: loaded.prefs
      });

      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error };
      }
      return { ok: true, account };
    }
  };

  const RoleGuard = {
    canAdmin(role) {
      return String(role || '').toLowerCase() === 'admin';
    },
    canChangeTheme(role) {
      return String(role || '').toLowerCase() === 'admin';
    },
    canPersistAccountChanges(role) {
      return String(role || '').toLowerCase() === 'admin';
    }
  };

  const ThemeService = {
    STORAGE_KEY: 'corebank_theme',

    getTheme() {
      try {
        return root.localStorage.getItem(this.STORAGE_KEY) || 'light';
      } catch (e) {
        return 'light';
      }
    },

    setTheme(theme, role) {
      const userRole = role || (root.CoreBank && root.CoreBank.getRole ? root.CoreBank.getRole() : 'developer');
      // Developer role must NOT have privilege to change themes.
      if (!RoleGuard.canChangeTheme(userRole)) {
        return {
          ok: false,
          error: 'Developer role does not have privilege to change themes. Admin access required.'
        };
      }
      const validTheme = theme === 'dark' ? 'dark' : 'light';
      try {
        root.localStorage.setItem(this.STORAGE_KEY, validTheme);
      } catch (e) {
        // storage disabled or quota
      }
      return { ok: true, theme: validTheme };
    }
  };

  const StatementService = {
    deletedRecords: {},

    recordDeletion(account, role) {
      if (!account || !account.accountId) {
        return;
      }
      this.deletedRecords[account.accountId] = {
        account: JSON.parse(JSON.stringify(account)),
        deletedAt: new Date().toISOString(),
        role: role || 'admin'
      };
    },

    getDeletedRecord(accountId) {
      return this.deletedRecords[accountId] || null;
    },

    getAllDeletedRecords() {
      return Object.values(this.deletedRecords);
    },

    generateAtmReceipt({ bankName, dateTime, accountNumber, accountId, holderName, accountType, txnType, role, balancePaise, status }) {
      const { money } = getDeps();
      const dt = dateTime ? new Date(dateTime).toLocaleString('en-IN', { hour12: true }) : new Date().toLocaleString('en-IN', { hour12: true });
      const isDeleted = String(txnType || '').toLowerCase().includes('delete');
      const typeStr = isDeleted ? 'Account Deleted' : 'Account Created';
      const roleStr = String(role || 'Admin').toLowerCase() === 'admin' ? 'Admin' : 'Developer';
      const balStr = money ? money.formatINR(balancePaise || 0) : `₹${((balancePaise || 0) / 100).toFixed(2)}`;
      const statusStr = status || (isDeleted ? 'ACCOUNT CLOSED' : 'ACTIVE');

      // Monospace ATM machine mini-statement format with narrow width (40 chars)
      return [
        '========================================',
        '          COREBANKING SANDBOX           ',
        '        ATM MINI-STATEMENT RECEIPT      ',
        '========================================',
        `DATE & TIME : ${dt}`,
        `ACCOUNT NO  : ${accountNumber || 'N/A'}`,
        `ACCOUNT ID  : ${accountId || 'N/A'}`,
        `HOLDER NAME : ${holderName || 'N/A'}`,
        `ACC TYPE    : ${String(accountType || 'SAVINGS').toUpperCase()}`,
        `TXN TYPE    : ${typeStr}`,
        `PERFORMED BY: ${roleStr}`,
        '----------------------------------------',
        `BALANCE     : ${balStr}`,
        `STATUS      : ${statusStr}`,
        '----------------------------------------',
        '     Thank you for banking with us!     ',
        '   Demo Sandbox - No Real Money Used    ',
        '========================================'
      ].join('\n');
    },

    downloadReceiptFile(receiptText, filename) {
      // Must NOT modify or clear local storage. Only reads data and generates file.
      const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'atm_statement.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  root.CoreBank = root.CoreBank || {};
  Object.assign(root.CoreBank, {
    transferService: TransferService,
    balanceCalculator: BalanceCalculator,
    accountService: AccountService,
    adminService: AdminService,
    statementService: StatementService,
    themeService: ThemeService,
    roleGuard: RoleGuard
  });
})(typeof window !== 'undefined' ? window : globalThis);