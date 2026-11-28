/**
 * CoreBanking Sandbox — bootstrap, navigation, and role switching.
 */
(function (root) {
  'use strict';

  const VIEW_IDS = {
    dashboard: 'view-dashboard',
    accounts: 'view-accounts',
    transfer: 'view-transfer',
    statement: 'view-statement',
    admin: 'view-admin',
    about: 'view-about'
  };

  const state = {
    currentView: 'dashboard',
    role: 'developer',
    statementAccountId: '',
    isTransferSubmitting: false
  };

  function getBank() {
    return root.CoreBank;
  }

  function getUI() {
    return root.CoreBankUI;
  }

  function allPanels() {
    return document.querySelectorAll('.view-panel[data-view]');
  }

  function allNavLinks() {
    return document.querySelectorAll('#app-nav .app-nav__link[data-view]');
  }

  function showPanel(view) {
    const panelId = VIEW_IDS[view] || VIEW_IDS.dashboard;
    allPanels().forEach((panel) => {
      const isActive = panel.id === panelId;
      panel.classList.toggle('active', isActive);
      panel.classList.toggle('d-none', !isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    allNavLinks().forEach((link) => {
      const match = link.getAttribute('data-view') === view;
      link.classList.toggle('active', match);
      if (match) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function navigate(view) {
    const ui = getUI();
    const valid = Object.prototype.hasOwnProperty.call(VIEW_IDS, view);
    state.currentView = valid ? view : 'dashboard';
    showPanel(state.currentView);
    if (ui && typeof ui.refreshForView === 'function') {
      ui.refreshForView(state.currentView);
    }
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#${VIEW_IDS[state.currentView]}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setRole(role) {
    const bank = getBank();
    const ui = getUI();
    const normalized = role === 'admin' ? 'admin' : 'developer';
    state.role = normalized;

    if (bank && bank.store && typeof bank.store.load === 'function') {
      const loaded = bank.store.load();
      const prefs =
        loaded.prefs ||
        (bank.sampleData && bank.sampleData.getDefaultPrefs && bank.sampleData.getDefaultPrefs()) ||
        {};
      const save = bank.store.save({
        accounts: loaded.accounts || [],
        transactions: loaded.transactions || [],
        transfers: loaded.transfers || [],
        prefs: Object.assign({}, prefs, { role: normalized })
      });
      if (save && save.ok === false && ui) {
        ui.showFeedback('storage', save.error || 'Could not save role preference to storage.');
      }
    }

    if (ui) {
      ui.renderRoleSwitch();
      ui.applyBodyRole(normalized);
      ui.refreshForView(state.currentView);
    }
  }

  function wireNavigation() {
    allNavLinks().forEach((link) => {
      link.addEventListener('click', (e) => {
        const view = link.getAttribute('data-view');
        if (!view) {
          return;
        }
        e.preventDefault();
        navigate(view);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace(/^#/, '');
      const entry = Object.entries(VIEW_IDS).find(([, id]) => id === hash);
      if (entry) {
        navigate(entry[0]);
      }
    });
  }

  function wireRoleSwitch() {
    const roleSwitch = document.getElementById('role-switch');
    if (!roleSwitch) {
      return;
    }
    roleSwitch.addEventListener('change', (e) => {
      const target = e.target;
      if (target && target.name === 'app-role') {
        setRole(target.value);
      }
    });
  }

  function bootstrapData() {
    const bank = getBank();
    const ui = getUI();
    if (!bank || !bank.store) {
      if (ui) {
        ui.showFeedback('error', 'CoreBank store failed to load. Check js/store.js.');
      }
      return false;
    }

    const loadResult =
      typeof bank.store.load === 'function' ? bank.store.load() : { ok: true };

    if (loadResult && loadResult.ok === false) {
      if (ui) {
        ui.showFeedback(
          'storage',
          loadResult.error || 'Could not read sandbox data from browser storage.'
        );
      }
    }

    let accounts = loadResult.accounts || [];

    if (!accounts.length) {
      if (typeof bank.store.resetToSample === 'function') {
        const seedResult = bank.store.resetToSample();
        if (seedResult && seedResult.ok === false) {
          if (ui) {
            ui.showFeedback(
              'storage',
              seedResult.error || 'Could not load sample data into storage.'
            );
          }
        } else {
          const afterSeed = bank.store.load();
          accounts = afterSeed.accounts || [];
        }
      }
    }

    const fresh = bank.store.load();
    const prefs = fresh.prefs || {};
    state.role = (prefs && prefs.role) === 'admin' ? 'admin' : 'developer';
    state.statementAccountId = (prefs && prefs.lastAccountId) || '';

    return true;
  }

  function init() {
    const ui = getUI();
    if (!ui) {
      console.error('CoreBankUI not loaded. Ensure js/ui.js is included before js/app.js.');
      return;
    }

    const ok = bootstrapData();
    wireNavigation();
    wireRoleSwitch();
    if (ui.updateThemeToggleUI) {
      ui.updateThemeToggleUI();
    }
    ui.renderRoleSwitch();

    let initialView = 'dashboard';
    const hash = window.location.hash.replace(/^#/, '');
    const fromHash = Object.entries(VIEW_IDS).find(([, id]) => id === hash);
    if (fromHash) {
      initialView = fromHash[0];
    }

    if (ok) {
      navigate(initialView);
    } else {
      showPanel('dashboard');
      ui.renderDashboard();
    }
  }

  root.CoreBankApp = {
    state,
    navigate,
    setRole,
    init
  };

  root.CoreBank = root.CoreBank || {};
  root.CoreBank.getRole = function () {
    return state.role || 'developer';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);