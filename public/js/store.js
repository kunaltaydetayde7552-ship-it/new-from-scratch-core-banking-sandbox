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

  const LocalDataStore = {
    KEYS,

    load() {
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

      return {
        ok: true,
        error: null,
        accounts: accountsR.data || [],
        transactions: txnsR.data || [],
        transfers: transfersR.data || [],
        prefs: prefsR.data
      };
    },

    save(payload) {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Save payload is required.' };
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
          error: failed.map((f) => f.error).join('; ')
        };
      }
      return { ok: true, error: null };
    },

    resetToSample() {
      const sample = root.CoreBank && root.CoreBank.sampleData;
      if (!sample) {
        return { ok: false, error: 'sampleData is not loaded. Include js/sample-data.js before store.js.' };
      }
      return this.save({
        accounts: deepClone(sample.accounts),
        transactions: deepClone(sample.transactions),
        transfers: deepClone(sample.transfers),
        prefs: sample.getDefaultPrefs ? sample.getDefaultPrefs() : deepClone(sample.prefs)
      });
    }
  };

  root.CoreBank = root.CoreBank || {};
  root.CoreBank.store = LocalDataStore;
})(typeof window !== 'undefined' ? window : globalThis);