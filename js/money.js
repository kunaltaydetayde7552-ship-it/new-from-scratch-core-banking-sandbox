/**
 * CoreBanking Sandbox — money utilities (integer paise only).
 */
(function (root) {
  'use strict';

  /**
   * @param {number|string} n — rupees (may include up to 2 decimal places)
   * @returns {number} whole paise
   */
  function rupeesToPaise(n) {
    if (n === null || n === undefined || n === '') {
      return 0;
    }
    const trimmed = String(n).trim();
    const match = trimmed.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      return NaN;
    }
    const sign = match[1] === '-' ? -1 : 1;
    const rupees = BigInt(match[2]);
    let frac = match[3] || '0';
    if (frac.length === 1) {
      frac += '0';
    }
    const paisePart = BigInt(frac);
    const total = rupees * 100n + paisePart;
    const asNumber = Number(total) * sign;
    if (!Number.isSafeInteger(asNumber)) {
      return NaN;
    }
    return asNumber;
  }

  /**
   * @param {number} n — integer paise
   * @returns {number} rupees as decimal number (for display/math only)
   */
  function paiseToRupees(n) {
    if (!Number.isFinite(n)) {
      return NaN;
    }
    const rounded = Math.round(n);
    return rounded / 100;
  }

  /**
   * @param {number} paise — integer paise
   * @returns {string} e.g. "₹1,500.00"
   */
  function formatINR(paise) {
    if (!Number.isFinite(paise)) {
      return '₹0.00';
    }
    const isNegative = paise < 0;
    const absPaise = Math.abs(Math.round(paise));
    const rupees = Math.floor(absPaise / 100);
    const remainder = absPaise % 100;
    const paiseStr = String(remainder).padStart(2, '0');
    const formattedRupees = new Intl.NumberFormat('en-IN').format(rupees);
    const body = `${formattedRupees}.${paiseStr}`;
    return isNegative ? `-₹${body}` : `₹${body}`;
  }

  const money = {
    rupeesToPaise,
    paiseToRupees,
    formatINR
  };

  root.CoreBank = root.CoreBank || {};
  root.CoreBank.money = money;
})(typeof window !== 'undefined' ? window : globalThis);