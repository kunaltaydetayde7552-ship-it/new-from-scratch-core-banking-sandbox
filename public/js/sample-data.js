/**
 * CoreBanking Sandbox — sample accounts, ledger, transfers, prefs.
 */
(function (root) {
  'use strict';

  const accounts = [
    {
      accountId: 'ACC-1001',
      accountNumber: '1001000001',
      holderName: 'Rahul Sharma',
      type: 'savings',
      openingDeposit: 5000000,
      overdraftEnabled: false,
      overdraftLimit: 0,
      status: 'Active',
      createdAt: '2026-10-15T09:00:00.000Z'
    },
    {
      accountId: 'ACC-1002',
      accountNumber: '1001000002',
      holderName: 'Priya Patel',
      type: 'current',
      openingDeposit: 15000000,
      overdraftEnabled: true,
      overdraftLimit: 5000000,
      status: 'Active',
      createdAt: '2026-10-15T09:15:00.000Z'
    },
    {
      accountId: 'ACC-1003',
      accountNumber: '1001000003',
      holderName: 'Amit Kumar',
      type: 'savings',
      openingDeposit: 7500000,
      overdraftEnabled: false,
      overdraftLimit: 0,
      status: 'Active',
      createdAt: '2026-10-15T09:30:00.000Z'
    },
    {
      accountId: 'ACC-1004',
      accountNumber: '1001000004',
      holderName: 'Sneha Joshi',
      type: 'savings',
      openingDeposit: 3000000,
      overdraftEnabled: false,
      overdraftLimit: 0,
      status: 'Active',
      createdAt: '2026-10-15T09:45:00.000Z'
    },
    {
      accountId: 'ACC-1005',
      accountNumber: '1001000005',
      holderName: 'Vikram Singh',
      type: 'current',
      openingDeposit: 9000000,
      overdraftEnabled: false,
      overdraftLimit: 0,
      status: 'Active',
      createdAt: '2026-10-15T10:00:00.000Z'
    }
  ];

  const transfers = [
    {
      transferId: 'TRF-1001',
      fromAccountId: 'ACC-1001',
      toAccountId: 'ACC-1003',
      amount: 500000,
      reference: 'Project book share',
      status: 'success',
      reason: '',
      createdAt: '2026-10-16T11:00:00.000Z'
    },
    {
      transferId: 'TRF-1002',
      fromAccountId: 'ACC-1002',
      toAccountId: 'ACC-1004',
      amount: 1500000,
      reference: 'UI Design consultation',
      status: 'success',
      reason: '',
      createdAt: '2026-10-17T14:30:00.000Z'
    },
    {
      transferId: 'TRF-1003',
      fromAccountId: 'ACC-1003',
      toAccountId: 'ACC-1005',
      amount: 300000,
      reference: 'Server hosting fee split',
      status: 'success',
      reason: '',
      createdAt: '2026-10-18T10:15:00.000Z'
    },
    {
      transferId: 'TRF-1004',
      fromAccountId: 'ACC-1004',
      toAccountId: 'ACC-1001',
      amount: 250000,
      reference: 'Study material refund',
      status: 'success',
      reason: '',
      createdAt: '2026-10-19T16:20:00.000Z'
    },
    {
      transferId: 'TRF-1005',
      fromAccountId: 'ACC-1005',
      toAccountId: 'ACC-1002',
      amount: 500000,
      reference: 'Office supplies payment',
      status: 'success',
      reason: '',
      createdAt: '2026-10-20T09:40:00.000Z'
    },
    {
      transferId: 'TRF-1006',
      fromAccountId: 'ACC-1001',
      toAccountId: 'ACC-1004',
      amount: 300000,
      reference: 'Hackathon registration',
      status: 'success',
      reason: '',
      createdAt: '2026-10-21T13:00:00.000Z'
    },
    {
      transferId: 'TRF-1007',
      fromAccountId: 'ACC-1002',
      toAccountId: 'ACC-1003',
      amount: 1000000,
      reference: 'Testing stipend',
      status: 'success',
      reason: '',
      createdAt: '2026-10-22T15:10:00.000Z'
    },
    {
      transferId: 'TRF-1008',
      fromAccountId: 'ACC-1004',
      toAccountId: 'ACC-1005',
      amount: 750000,
      reference: 'API quota recharge',
      status: 'success',
      reason: '',
      createdAt: '2026-10-23T11:45:00.000Z'
    }
  ];

  const transactions = [
    {
      txnId: 'TXN-001',
      transferId: null,
      accountId: 'ACC-1001',
      type: 'credit',
      amount: 5000000,
      reference: 'Account Opening Deposit',
      balanceAfter: 5000000,
      createdAt: '2026-10-15T09:00:00.000Z'
    },
    {
      txnId: 'TXN-002',
      transferId: null,
      accountId: 'ACC-1002',
      type: 'credit',
      amount: 15000000,
      reference: 'Account Opening Deposit',
      balanceAfter: 15000000,
      createdAt: '2026-10-15T09:15:00.000Z'
    },
    {
      txnId: 'TXN-003',
      transferId: null,
      accountId: 'ACC-1003',
      type: 'credit',
      amount: 7500000,
      reference: 'Account Opening Deposit',
      balanceAfter: 7500000,
      createdAt: '2026-10-15T09:30:00.000Z'
    },
    {
      txnId: 'TXN-004',
      transferId: null,
      accountId: 'ACC-1004',
      type: 'credit',
      amount: 3000000,
      reference: 'Account Opening Deposit',
      balanceAfter: 3000000,
      createdAt: '2026-10-15T09:45:00.000Z'
    },
    {
      txnId: 'TXN-005',
      transferId: null,
      accountId: 'ACC-1005',
      type: 'credit',
      amount: 9000000,
      reference: 'Account Opening Deposit',
      balanceAfter: 9000000,
      createdAt: '2026-10-15T10:00:00.000Z'
    },
  {
      txnId: 'TXN-006',
      transferId: 'TRF-1001',
      accountId: 'ACC-1001',
      type: 'debit',
      amount: 500000,
      reference: 'Transfer to ACC-1003: Project book share',
      balanceAfter: 4500000,
      createdAt: '2026-10-16T11:00:00.000Z'
    },
    {
      txnId: 'TXN-007',
      transferId: 'TRF-1001',
      accountId: 'ACC-1003',
      type: 'credit',
      amount: 500000,
      reference: 'Transfer from ACC-1001: Project book share',
      balanceAfter: 8000000,
      createdAt: '2026-10-16T11:00:00.000Z'
    },
    {
      txnId: 'TXN-008',
      transferId: 'TRF-1002',
      accountId: 'ACC-1002',
      type: 'debit',
      amount: 1500000,
      reference: 'Transfer to ACC-1004: UI Design consultation',
      balanceAfter: 13500000,
      createdAt: '2026-10-17T14:30:00.000Z'
    },
    {
      txnId: 'TXN-009',
      transferId: 'TRF-1002',
      accountId: 'ACC-1004',
      type: 'credit',
      amount: 1500000,
      reference: 'Transfer from ACC-1002: UI Design consultation',
      balanceAfter: 4500000,
      createdAt: '2026-10-17T14:30:00.000Z'
    },
    {
      txnId: 'TXN-010',
      transferId: 'TRF-1003',
      accountId: 'ACC-1003',
      type: 'debit',
      amount: 300000,
      reference: 'Transfer to ACC-1005: Server hosting fee split',
      balanceAfter: 7700000,
      createdAt: '2026-10-18T10:15:00.000Z'
    },
    {
      txnId: 'TXN-011',
      transferId: 'TRF-1003',
      accountId: 'ACC-1005',
      type: 'credit',
      amount: 300000,
      reference: 'Transfer from ACC-1003: Server hosting fee split',
      balanceAfter: 9300000,
      createdAt: '2026-10-18T10:15:00.000Z'
    },
    {
      txnId: 'TXN-012',
      transferId: 'TRF-1004',
      accountId: 'ACC-1004',
      type: 'debit',
      amount: 250000,
      reference: 'Transfer to ACC-1001: Study material refund',
      balanceAfter: 4250000,
      createdAt: '2026-10-19T16:20:00.000Z'
    },
    {
      txnId: 'TXN-013',
      transferId: 'TRF-1004',
      accountId: 'ACC-1001',
      type: 'credit',
      amount: 250000,
      reference: 'Transfer from ACC-1004: Study material refund',
      balanceAfter: 4750000,
      createdAt: '2026-10-19T16:20:00.000Z'
    },
    {
      txnId: 'TXN-014',
      transferId: 'TRF-1005',
      accountId: 'ACC-1005',
      type: 'debit',
      amount: 500000,
      reference: 'Transfer to ACC-1002: Office supplies payment',
      balanceAfter: 8800000,
      createdAt: '2026-10-20T09:40:00.000Z'
    },
    {
      txnId: 'TXN-015',
      transferId: 'TRF-1005',
      accountId: 'ACC-1002',
      type: 'credit',
      amount: 500000,
      reference: 'Transfer from ACC-1005: Office supplies payment',
      balanceAfter: 14000000,
      createdAt: '2026-10-20T09:40:00.000Z'
    },
    {
      txnId: 'TXN-016',
      transferId: 'TRF-1006',
      accountId: 'ACC-1001',
      type: 'debit',
      amount: 300000,
      reference: 'Transfer to ACC-1004: Hackathon registration',
      balanceAfter: 4450000,
      createdAt: '2026-10-21T13:00:00.000Z'
    },
    {
      txnId: 'TXN-017',
      transferId: 'TRF-1006',
      accountId: 'ACC-1004',
      type: 'credit',
      amount: 300000,
      reference: 'Transfer from ACC-1001: Hackathon registration',
      balanceAfter: 4550000,
      createdAt: '2026-10-21T13:00:00.000Z'
    },
    {
      txnId: 'TXN-018',
      transferId: 'TRF-1007',
      accountId: 'ACC-1002',
      type: 'debit',
      amount: 1000000,
      reference: 'Transfer to ACC-1003: Testing stipend',
      balanceAfter: 13000000,
      createdAt: '2026-10-22T15:10:00.000Z'
    },
    {
      txnId: 'TXN-019',
      transferId: 'TRF-1007',
      accountId: 'ACC-1003',
      type: 'credit',
      amount: 1000000,
      reference: 'Transfer from ACC-1002: Testing stipend',
      balanceAfter: 8700000,
      createdAt: '2026-10-22T15:10:00.000Z'
    },
    {
      txnId: 'TXN-020',
      transferId: 'TRF-1008',
      accountId: 'ACC-1004',
      type: 'debit',
      amount: 750000,
      reference: 'Transfer to ACC-1005: API quota recharge',
      balanceAfter: 3800000,
      createdAt: '2026-10-23T11:45:00.000Z'
    },
    {
      txnId: 'TXN-021',
      transferId: 'TRF-1008',
      accountId: 'ACC-1005',
      type: 'credit',
      amount: 750000,
      reference: 'Transfer from ACC-1004: API quota recharge',
      balanceAfter: 9550000,
      createdAt: '2026-10-23T11:45:00.000Z'
    }
  ];

  const prefs = {
    role: 'developer',
    lastAccountId: null,
    statementFilters: {}
  };

  const sampleData = {
    accounts,
    transactions,
    transfers,
    prefs,
    getDefaultPrefs() {
      return JSON.parse(JSON.stringify(prefs));
    }
  };

  root.CoreBank = root.CoreBank || {};
  root.CoreBank.sampleData = sampleData;
})(typeof window !== 'undefined' ? window : globalThis);