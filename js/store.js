/**
 * CoreBanking Sandbox — LocalDataStore (localStorage + in-memory fallback).
 */
(function (root) {
  'use strict';

  const KEYS = {
    ACCOUNTS: 'corebank_accounts',
    TRANSACTIONS: 'corebank_transactions',
    TRANSFERS: 'corebank_transfers',
    PREFS: 'corebank_prefs'
  };

  const memory = {};

  let storageOk = null;

  function canUseLocalStorage() {
    if (storageOk !== null) {
      return storageOk;
    }
    try {
      const test = '__corebank_storage_test__';
      root.localStorage.setItem(test, test);
      root.localStorage.removeItem(test);
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    return storageOk;
  }

  function readKey(key) {
    if (canUseLocalStorage()) {
      try {
        const raw = root.localStorage.getItem(key);
        if (raw === null) {
          return { ok: true, data: null };
        }
        return { ok: true, data: JSON.parse(raw) };
      } catch (err) {
        return { ok: false, error: err.message || String(err), data: null };
      }
    }
    return { ok: true, data: memory[key] !== undefined ? memory[key] : null };
  }

  function writeKey(key, value) {
    const clone = JSON.parse(JSON.stringify(value));
    if (canUseLocalStorage()) {
      try {
        root.localStorage.setItem(key, JSON.stringify(clone));
        return { ok: true };
      } catch (err) {
        memory[key] = clone;
        return {
          ok: false,
          error: err.message || String(err)
        };
      }
    }
    memory[key] = clone;
    return { ok: true };
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // In-memory session state for role-based behaviour
  // (Developer changes stay in app session and do not affect localStorage)
  let sessionState = {
    accounts: null,
    transactions: null,
    transfers: null,
    prefs: null
  };

  const LocalDataStore = {
    KEYS,

    load() {
      // If we have in-memory session accounts/data from developer actions, use session state
      if (sessionState.accounts !== null) {
        return {
          ok: true,
          error: null,
          accounts: deepClone(sessionState.accounts),
          transactions: deepClone(sessionState.transactions || []),
          transfers: deepClone(sessionState.transfers || []),
          prefs: sessionState.prefs ? deepClone(sessionState.prefs) : null
        };
      }

      const accountsR = readKey(KEYS.ACCOUNTS);
      const txnsR = readKey(KEYS.TRANSACTIONS);
      const transfersR = readKey(KEYS.TRANSFERS);
      const prefsR = readKey(KEYS.PREFS);

      const errors = [accountsR, txnsR, transfersR, prefsR]
        .filter((r) => !r.ok)
        .map((r) => r.error);

      if (errors.length) {
        return {
          ok: false,
          error: errors.join('; '),
          accounts: [],
          transactions: [],
          transfers: [],
          prefs: null
        };
      }

      const loadedAccounts = accountsR.data || [];
      const loadedTxns = txnsR.data || [];
      const loadedTransfers = transfersR.data || [];
      const loadedPrefs = prefsR.data;

      // Sync session state with initial storage load
      sessionState = {
        accounts: deepClone(loadedAccounts),
        transactions: deepClone(loadedTxns),
        transfers: deepClone(loadedTransfers),
        prefs: loadedPrefs ? deepClone(loadedPrefs) : null
      };

      return {
        ok: true,
        error: null,
        accounts: loadedAccounts,
        transactions: loadedTxns,
        transfers: loadedTransfers,
        prefs: loadedPrefs
      };
    },

    save(payload, options) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Save payload is required.' };
      }

      const opts = options || {};
      const shouldPersist = opts.persist !== false;

      // Always update session state so current app session reflects changes immediately
      if (sessionState.accounts === null) {
        this.load();
      }
      if (payload.accounts !== undefined) {
        sessionState.accounts = deepClone(payload.accounts);
      }
      if (payload.transactions !== undefined) {
        sessionState.transactions = deepClone(payload.transactions);
      }
      if (payload.transfers !== undefined) {
        sessionState.transfers = deepClone(payload.transfers);
      }
      if (payload.prefs !== undefined) {
        sessionState.prefs = deepClone(payload.prefs);
      }

      // If persistence is disabled (e.g. Developer role created/deleted account),
      // DO NOT write to, modify or clear localStorage!
      if (!shouldPersist) {
        return { ok: true, error: null, persisted: false };
      }

      const results = [];
      if (payload.accounts !== undefined) {
        results.push(writeKey(KEYS.ACCOUNTS, payload.accounts));
      }
      if (payload.transactions !== undefined) {
        results.push(writeKey(KEYS.TRANSACTIONS, payload.transactions));
      }
      if (payload.transfers !== undefined) {
        results.push(writeKey(KEYS.TRANSFERS, payload.transfers));
      }
      if (payload.prefs !== undefined) {
        results.push(writeKey(KEYS.PREFS, payload.prefs));
      }

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        return {
          ok: false,
          error: failed.map((f) => f.error).join('; '),
          persisted: false
        };
      }
      return { ok: true, error: null, persisted: true };
    },

    resetToSample() {
      sessionState = {
        accounts: null,
        transactions: null,
        transfers: null,
        prefs: null
      };
      const sample = root.CoreBank && root.CoreBank.sampleData;
      if (!sample) {
        return { ok: false, error: 'sampleData is not loaded. Include js/sample-data.js before store.js.' };
      }
      return this.save({
        accounts: deepClone(sample.accounts),
        transactions: deepClone(sample.transactions),
        transfers: deepClone(sample.transfers),
        prefs: sample.getDefaultPrefs ? sample.getDefaultPrefs() : deepClone(sample.prefs)
      }, { persist: true });
    }
  };

  root.CoreBank = root.CoreBank || {};
  root.CoreBank.store = LocalDataStore;
})(typeof window !== 'undefined' ? window : globalThis);