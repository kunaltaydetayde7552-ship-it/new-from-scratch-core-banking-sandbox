#!/usr/bin/env python3
"""
CoreBanking Sandbox - Python 3 CLI helper (PST_PD_153).
Standard library only. Amounts stored as integer paise.
Team: Kunal Tayde, Gajangi Nikhileshwar.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_FILE = Path(__file__).resolve().parent / "bank_data.json"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def format_paise(paise: int, symbol: bool = True) -> str:
  """Format integer paise as INR with two decimal places."""
  negative = paise < 0
  absolute = abs(paise)
  rupees = absolute // 100
  remainder = absolute % 100
  prefix = ("-" if negative else "") + ("₹" if symbol else "")
  return f"{prefix}{rupees:,}.{remainder:02d}"


def parse_rupees_to_paise(amount_str: str) -> int:
  """Parse a rupee string into paise without floating-point math."""
  trimmed = str(amount_str).strip()
  if not trimmed:
    raise ValueError("Amount cannot be empty.")

  parts = trimmed.split(".")
  if len(parts) > 2:
    raise ValueError("Invalid amount format. More than one decimal point.")

  rupees_part = parts[0]
  if not rupees_part.isdigit():
    raise ValueError("Invalid amount format. Whole rupees must be digits.")

  rupees = int(rupees_part)
  paise = 0
  if len(parts) == 2:
    paise_part = parts[1]
    if len(paise_part) > 2:
      raise ValueError("Unsupported precision: maximum 2 decimal places allowed.")
    if len(paise_part) == 1:
      paise_part += "0"
    if not paise_part.isdigit():
      raise ValueError("Paise portion must be digits.")
    paise = int(paise_part)

  return rupees * 100 + paise


@dataclass
class Account:
  accountId: str
  accountNumber: str
  holderName: str
  type: str
  openingDepositPaise: int
  balancePaise: int
  overdraftEnabled: bool = False
  overdraftLimitPaise: int = 0
  status: str = "active"
  createdAt: str = ""

  def projected_balance_after_debit(self, amount_paise: int) -> int:
    return self.balancePaise - amount_paise

  def allows_debit(self, amount_paise: int) -> bool:
    """Return whether a debit of amount_paise is permitted under overdraft rules."""
    new_balance = self.projected_balance_after_debit(amount_paise)
    if not self.overdraftEnabled:
      return new_balance >= 0
    return new_balance >= -self.overdraftLimitPaise

  def max_available_paise(self) -> int:
    if not self.overdraftEnabled:
      return self.balancePaise
    return self.balancePaise + self.overdraftLimitPaise


@dataclass
class Transaction:
  txnId: str
  transferId: Optional[str]
  accountId: str
  type: str
  amountPaise: int
  reference: str
  balanceAfterPaise: int
  createdAt: str


@dataclass
class Transfer:
  transferId: str
  fromAccountId: str
  toAccountId: str
  amountPaise: int
  reference: str
  status: str
  reason: str
  createdAt: str


_FACTORY_SEED_JSON = "{\"accounts\":[{\"accountId\":\"ACC-1001\",\"accountNumber\":\"1001000001\",\"holderName\":\"Rahul Sharma\",\"type\":\"savings\",\"openingDepositPaise\":5000000,\"balancePaise\":4450000,\"overdraftEnabled\":false,\"overdraftLimitPaise\":0,\"status\":\"active\",\"createdAt\":\"2026-10-15T09:00:00.000Z\"},{\"accountId\":\"ACC-1002\",\"accountNumber\":\"1001000002\",\"holderName\":\"Priya Patel\",\"type\":\"current\",\"openingDepositPaise\":15000000,\"balancePaise\":13000000,\"overdraftEnabled\":true,\"overdraftLimitPaise\":5000000,\"status\":\"active\",\"createdAt\":\"2026-10-15T09:15:00.000Z\"},{\"accountId\":\"ACC-1003\",\"accountNumber\":\"1001000003\",\"holderName\":\"Amit Kumar\",\"type\":\"savings\",\"openingDepositPaise\":7500000,\"balancePaise\":8700000,\"overdraftEnabled\":false,\"overdraftLimitPaise\":0,\"status\":\"active\",\"createdAt\":\"2026-10-15T09:30:00.000Z\"},{\"accountId\":\"ACC-1004\",\"accountNumber\":\"1001000004\",\"holderName\":\"Sneha Joshi\",\"type\":\"savings\",\"openingDepositPaise\":3000000,\"balancePaise\":3800000,\"overdraftEnabled\":false,\"overdraftLimitPaise\":0,\"status\":\"active\",\"createdAt\":\"2026-10-15T09:45:00.000Z\"},{\"accountId\":\"ACC-1005\",\"accountNumber\":\"1001000005\",\"holderName\":\"Vikram Singh\",\"type\":\"current\",\"openingDepositPaise\":9000000,\"balancePaise\":9550000,\"overdraftEnabled\":false,\"overdraftLimitPaise\":0,\"status\":\"active\",\"createdAt\":\"2026-10-15T10:00:00.000Z\"}],\"transactions\":[{\"txnId\":\"TXN-001\",\"transferId\":null,\"accountId\":\"ACC-1001\",\"type\":\"credit\",\"amountPaise\":5000000,\"reference\":\"Account Opening Deposit\",\"balanceAfterPaise\":5000000,\"createdAt\":\"2026-10-15T09:00:00.000Z\"},{\"txnId\":\"TXN-002\",\"transferId\":null,\"accountId\":\"ACC-1002\",\"type\":\"credit\",\"amountPaise\":15000000,\"reference\":\"Account Opening Deposit\",\"balanceAfterPaise\":15000000,\"createdAt\":\"2026-10-15T09:15:00.000Z\"},{\"txnId\":\"TXN-003\",\"transferId\":null,\"accountId\":\"ACC-1003\",\"type\":\"credit\",\"amountPaise\":7500000,\"reference\":\"Account Opening Deposit\",\"balanceAfterPaise\":7500000,\"createdAt\":\"2026-10-15T09:30:00.000Z\"},{\"txnId\":\"TXN-004\",\"transferId\":null,\"accountId\":\"ACC-1004\",\"type\":\"credit\",\"amountPaise\":3000000,\"reference\":\"Account Opening Deposit\",\"balanceAfterPaise\":3000000,\"createdAt\":\"2026-10-15T09:45:00.000Z\"},{\"txnId\":\"TXN-005\",\"transferId\":null,\"accountId\":\"ACC-1005\",\"type\":\"credit\",\"amountPaise\":9000000,\"reference\":\"Account Opening Deposit\",\"balanceAfterPaise\":9000000,\"createdAt\":\"2026-10-15T10:00:00.000Z\"},{\"txnId\":\"TXN-006\",\"transferId\":\"TRF-1001\",\"accountId\":\"ACC-1001\",\"type\":\"debit\",\"amountPaise\":500000,\"reference\":\"Transfer to ACC-1003: Project book share\",\"balanceAfterPaise\":4500000,\"createdAt\":\"2026-10-16T11:00:00.000Z\"},{\"txnId\":\"TXN-007\",\"transferId\":\"TRF-1001\",\"accountId\":\"ACC-1003\",\"type\":\"credit\",\"amountPaise\":500000,\"reference\":\"Transfer from ACC-1001: Project book share\",\"balanceAfterPaise\":8000000,\"createdAt\":\"2026-10-16T11:00:00.000Z\"},{\"txnId\":\"TXN-008\",\"transferId\":\"TRF-1002\",\"accountId\":\"ACC-1002\",\"type\":\"debit\",\"amountPaise\":1500000,\"reference\":\"Transfer to ACC-1004: UI Design consultation\",\"balanceAfterPaise\":13500000,\"createdAt\":\"2026-10-17T14:30:00.000Z\"},{\"txnId\":\"TXN-009\",\"transferId\":\"TRF-1002\",\"accountId\":\"ACC-1004\",\"type\":\"credit\",\"amountPaise\":1500000,\"reference\":\"Transfer from ACC-1002: UI Design consultation\",\"balanceAfterPaise\":4500000,\"createdAt\":\"2026-10-17T14:30:00.000Z\"},{\"txnId\":\"TXN-010\",\"transferId\":\"TRF-1003\",\"accountId\":\"ACC-1003\",\"type\":\"debit\",\"amountPaise\":300000,\"reference\":\"Transfer to ACC-1005: Server hosting fee split\",\"balanceAfterPaise\":7700000,\"createdAt\":\"2026-10-18T10:15:00.000Z\"},{\"txnId\":\"TXN-011\",\"transferId\":\"TRF-1003\",\"accountId\":\"ACC-1005\",\"type\":\"credit\",\"amountPaise\":300000,\"reference\":\"Transfer from ACC-1003: Server hosting fee split\",\"balanceAfterPaise\":9300000,\"createdAt\":\"2026-10-18T10:15:00.000Z\"},{\"txnId\":\"TXN-012\",\"transferId\":\"TRF-1004\",\"accountId\":\"ACC-1004\",\"type\":\"debit\",\"amountPaise\":250000,\"reference\":\"Transfer to ACC-1001: Study material refund\",\"balanceAfterPaise\":4250000,\"createdAt\":\"2026-10-19T16:20:00.000Z\"},{\"txnId\":\"TXN-013\",\"transferId\":\"TRF-1004\",\"accountId\":\"ACC-1001\",\"type\":\"credit\",\"amountPaise\":250000,\"reference\":\"Transfer from ACC-1004: Study material refund\",\"balanceAfterPaise\":4750000,\"createdAt\":\"2026-10-19T16:20:00.000Z\"},{\"txnId\":\"TXN-014\",\"transferId\":\"TRF-1005\",\"accountId\":\"ACC-1005\",\"type\":\"debit\",\"amountPaise\":500000,\"reference\":\"Transfer to ACC-1002: Office supplies payment\",\"balanceAfterPaise\":8800000,\"createdAt\":\"2026-10-20T09:40:00.000Z\"},{\"txnId\":\"TXN-015\",\"transferId\":\"TRF-1005\",\"accountId\":\"ACC-1002\",\"type\":\"credit\",\"amountPaise\":500000,\"reference\":\"Transfer from ACC-1005: Office supplies payment\",\"balanceAfterPaise\":14000000,\"createdAt\":\"2026-10-20T09:40:00.000Z\"},{\"txnId\":\"TXN-016\",\"transferId\":\"TRF-1006\",\"accountId\":\"ACC-1001\",\"type\":\"debit\",\"amountPaise\":300000,\"reference\":\"Transfer to ACC-1004: Hackathon registration\",\"balanceAfterPaise\":4450000,\"createdAt\":\"2026-10-21T13:00:00.000Z\"},{\"txnId\":\"TXN-017\",\"transferId\":\"TRF-1006\",\"accountId\":\"ACC-1004\",\"type\":\"credit\",\"amountPaise\":300000,\"reference\":\"Transfer from ACC-1001: Hackathon registration\",\"balanceAfterPaise\":4550000,\"createdAt\":\"2026-10-21T13:00:00.000Z\"},{\"txnId\":\"TXN-018\",\"transferId\":\"TRF-1007\",\"accountId\":\"ACC-1002\",\"type\":\"debit\",\"amountPaise\":1000000,\"reference\":\"Transfer to ACC-1003: Testing stipend\",\"balanceAfterPaise\":13000000,\"createdAt\":\"2026-10-22T15:10:00.000Z\"},{\"txnId\":\"TXN-019\",\"transferId\":\"TRF-1007\",\"accountId\":\"ACC-1003\",\"type\":\"credit\",\"amountPaise\":1000000,\"reference\":\"Transfer from ACC-1002: Testing stipend\",\"balanceAfterPaise\":8700000,\"createdAt\":\"2026-10-22T15:10:00.000Z\"},{\"txnId\":\"TXN-020\",\"transferId\":\"TRF-1008\",\"accountId\":\"ACC-1004\",\"type\":\"debit\",\"amountPaise\":750000,\"reference\":\"Transfer to ACC-1005: API quota recharge\",\"balanceAfterPaise\":3800000,\"createdAt\":\"2026-10-23T11:45:00.000Z\"},{\"txnId\":\"TXN-021\",\"transferId\":\"TRF-1008\",\"accountId\":\"ACC-1005\",\"type\":\"credit\",\"amountPaise\":750000,\"reference\":\"Transfer from ACC-1004: API quota recharge\",\"balanceAfterPaise\":9550000,\"createdAt\":\"2026-10-23T11:45:00.000Z\"}],\"transfers\":[{\"transferId\":\"TRF-1001\",\"fromAccountId\":\"ACC-1001\",\"toAccountId\":\"ACC-1003\",\"amountPaise\":500000,\"reference\":\"Project book share\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-16T11:00:00.000Z\"},{\"transferId\":\"TRF-1002\",\"fromAccountId\":\"ACC-1002\",\"toAccountId\":\"ACC-1004\",\"amountPaise\":1500000,\"reference\":\"UI Design consultation\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-17T14:30:00.000Z\"},{\"transferId\":\"TRF-1003\",\"fromAccountId\":\"ACC-1003\",\"toAccountId\":\"ACC-1005\",\"amountPaise\":300000,\"reference\":\"Server hosting fee split\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-18T10:15:00.000Z\"},{\"transferId\":\"TRF-1004\",\"fromAccountId\":\"ACC-1004\",\"toAccountId\":\"ACC-1001\",\"amountPaise\":250000,\"reference\":\"Study material refund\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-19T16:20:00.000Z\"},{\"transferId\":\"TRF-1005\",\"fromAccountId\":\"ACC-1005\",\"toAccountId\":\"ACC-1002\",\"amountPaise\":500000,\"reference\":\"Office supplies payment\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-20T09:40:00.000Z\"},{\"transferId\":\"TRF-1006\",\"fromAccountId\":\"ACC-1001\",\"toAccountId\":\"ACC-1004\",\"amountPaise\":300000,\"reference\":\"Hackathon registration\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-21T13:00:00.000Z\"},{\"transferId\":\"TRF-1007\",\"fromAccountId\":\"ACC-1002\",\"toAccountId\":\"ACC-1003\",\"amountPaise\":1000000,\"reference\":\"Testing stipend\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-22T15:10:00.000Z\"},{\"transferId\":\"TRF-1008\",\"fromAccountId\":\"ACC-1004\",\"toAccountId\":\"ACC-1005\",\"amountPaise\":750000,\"reference\":\"API quota recharge\",\"status\":\"success\",\"reason\":\"\",\"createdAt\":\"2026-10-23T11:45:00.000Z\"}],\"preferences\":{\"role\":\"developer\",\"lastAccountId\":\"ACC-1001\",\"statementFilters\":{\"type\":\"all\",\"startDate\":\"\",\"endDate\":\"\"}}}"


def _factory_seed_payload() -> Dict[str, Any]:
  return json.loads(_FACTORY_SEED_JSON)


FACTORY_SEED: Dict[str, Any] = copy.deepcopy(_factory_seed_payload())


class Bank:
  """Encapsulates sandbox accounts, ledger, persistence, and banking rules."""

  def __init__(self, data_file: Path = DATA_FILE) -> None:
    self._data_file = Path(data_file)
    self._accounts: List[Account] = []
    self._transactions: List[Transaction] = []
    self._transfers: List[Transfer] = []
    self._preferences: Dict[str, Any] = {}
    self.load()

  @property
  def accounts(self) -> List[Account]:
    return list(self._accounts)

  @property
  def transactions(self) -> List[Transaction]:
    return list(self._transactions)

  def load(self) -> None:
    if not self._data_file.is_file() or self._data_file.stat().st_size == 0:
      self.reset_to_seed()
      return

    with self._data_file.open(encoding="utf-8") as handle:
      payload = json.load(handle)

    self._hydrate(payload)

  def save(self) -> None:
    payload = {
      "accounts": [asdict(account) for account in self._accounts],
      "transactions": [asdict(txn) for txn in self._transactions],
      "transfers": [asdict(trf) for trf in self._transfers],
      "preferences": self._preferences,
    }
    with self._data_file.open("w", encoding="utf-8") as handle:
      json.dump(payload, handle, indent=2)

  def _hydrate(self, payload: Dict[str, Any]) -> None:
    self._accounts = [Account(**row) for row in payload.get("accounts", [])]
    self._transactions = [Transaction(**row) for row in payload.get("transactions", [])]
    self._transfers = [Transfer(**row) for row in payload.get("transfers", [])]
    self._preferences = payload.get(
      "preferences",
      {
        "role": "developer",
        "lastAccountId": "ACC-1001",
        "statementFilters": {"type": "all", "startDate": "", "endDate": ""},
      },
    )

  def reset_to_seed(self) -> None:
    self._hydrate(copy.deepcopy(FACTORY_SEED))
    self.save()

  def get_account(self, account_id: str) -> Optional[Account]:
    normalized = account_id.strip().upper()
    for account in self._accounts:
      if account.accountId.upper() == normalized:
        return account
    return None

  def create_account(self, holder_name: str, acc_type: str, deposit_paise: int) -> Account:
    if deposit_paise < 0:
      raise ValueError("Opening deposit cannot be negative.")
    lowered = acc_type.lower()
    if lowered not in ("savings", "current"):
      raise ValueError("Account type must be 'savings' or 'current'.")

    next_index = len(self._accounts) + 1
    account_id = f"ACC-{1000 + next_index}"
    account_number = f"100100{next_index:04d}"
    now = _utc_now_iso()

    account = Account(
      accountId=account_id,
      accountNumber=account_number,
      holderName=holder_name.strip(),
      type=lowered,
      openingDepositPaise=deposit_paise,
      balancePaise=deposit_paise,
      overdraftEnabled=False,
      overdraftLimitPaise=0,
      status="active",
      createdAt=now,
    )
    self._accounts.append(account)

    if deposit_paise > 0:
      stamp = int(datetime.now(timezone.utc).timestamp() * 1000)
      self._transactions.append(
        Transaction(
          txnId=f"TXN-{stamp}-OPN",
          transferId=None,
          accountId=account_id,
          type="credit",
          amountPaise=deposit_paise,
          reference="Initial account opening deposit",
          balanceAfterPaise=deposit_paise,
          createdAt=now,
        )
      )

    self.save()
    return account

  def transfer(
    self,
    from_id: str,
    to_id: str,
    amount_paise: int,
    reference: str = "",
  ) -> Transfer:
    if amount_paise <= 0:
      raise ValueError("Transfer amount must be strictly greater than ₹0.00.")

    if from_id.strip().upper() == to_id.strip().upper():
      raise ValueError("Choose two different accounts to transfer between.")

    source = self.get_account(from_id)
    destination = self.get_account(to_id)

    if source is None:
      raise ValueError(f"Source account '{from_id}' not found.")
    if destination is None:
      raise ValueError(f"Destination account '{to_id}' not found.")

    if source.status != "active":
      raise ValueError(f"Source account {source.accountId} is not active.")
    if destination.status != "active":
      raise ValueError(f"Destination account {destination.accountId} is not active.")

    if not source.allows_debit(amount_paise):
      if not source.overdraftEnabled:
        raise ValueError(
          f"Transfer blocked. {source.accountId} has {format_paise(source.balancePaise)} "
          "available and no overdraft."
        )
      raise ValueError(
        f"Transfer blocked. {source.accountId} limit exceeded. "
        f"Max available: {format_paise(source.max_available_paise())}."
      )

    now = _utc_now_iso()
    stamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    transfer_id = f"TRF-{stamp % 1_000_000:06d}"
    ref_text = reference.strip() if reference.strip() else "CLI Transfer"

    new_source_balance = source.balancePaise - amount_paise
    new_dest_balance = destination.balancePaise + amount_paise
    source.balancePaise = new_source_balance
    destination.balancePaise = new_dest_balance

    debit = Transaction(
      txnId=f"TXN-{stamp}-D",
      transferId=transfer_id,
      accountId=source.accountId,
      type="debit",
      amountPaise=amount_paise,
      reference=f"Transfer to {destination.accountId}: {ref_text}",
      balanceAfterPaise=new_source_balance,
      createdAt=now,
    )
    credit = Transaction(
      txnId=f"TXN-{stamp}-C",
      transferId=transfer_id,
      accountId=destination.accountId,
      type="credit",
      amountPaise=amount_paise,
      reference=f"Transfer from {source.accountId}: {ref_text}",
      balanceAfterPaise=new_dest_balance,
      createdAt=now,
    )

    record = Transfer(
      transferId=transfer_id,
      fromAccountId=source.accountId,
      toAccountId=destination.accountId,
      amountPaise=amount_paise,
      reference=ref_text,
      status="success",
      reason="",
      createdAt=now,
    )

    self._transactions.extend([debit, credit])
    self._transfers.append(record)
    self.save()
    return record

  def set_overdraft(self, account_id: str, enabled: bool, limit_paise: int) -> None:
    account = self.get_account(account_id)
    if account is None:
      raise ValueError(f"Account '{account_id}' not found.")

    if account.balancePaise < 0:
      deficit = abs(account.balancePaise)
      if not enabled:
        raise ValueError(
          f"Cannot disable overdraft while balance is negative ({format_paise(account.balancePaise)}). "
          "Settle funds first."
        )
      if limit_paise < deficit:
        raise ValueError(
          f"Limit ({format_paise(limit_paise)}) cannot be lower than current deficit "
          f"({format_paise(deficit)})."
        )

    account.overdraftEnabled = enabled
    account.overdraftLimitPaise = limit_paise if enabled else 0
    self.save()

  def statement(self, account_id: str) -> Dict[str, Any]:
    account = self.get_account(account_id)
    if account is None:
      raise ValueError(f"Account '{account_id}' not found.")

    rows = [txn for txn in self._transactions if txn.accountId == account.accountId]
    rows.sort(key=lambda row: row.createdAt)
    return {
      "account": account,
      "openingBalance": account.openingDepositPaise,
      "closingBalance": account.balancePaise,
      "transactions": rows,
    }

  def total_system_funds_paise(self) -> int:
    return sum(account.balancePaise for account in self._accounts)


def _configure_stdio() -> None:
  for stream in (sys.stdout, sys.stderr):
    if stream is not None and hasattr(stream, "reconfigure"):
      try:
        stream.reconfigure(encoding="utf-8", errors="replace")
      except Exception:
        pass


def _print_account_list(bank: Bank) -> None:
  print("\n" + "=" * 80)
  print(" COREBANKING SANDBOX - ACCOUNTS SUMMARY (Project PST_PD_153)")
  print("=" * 80)
  print(
    f"{'Account ID':<12} | {'Account No':<12} | {'Holder Name':<18} | "
    f"{'Type':<8} | {'Balance':>14} | {'Overdraft':<12}"
  )
  print("-" * 80)
  for account in bank.accounts:
    od = (
      f"Limit: {format_paise(account.overdraftLimitPaise)}"
      if account.overdraftEnabled
      else "None"
    )
    print(
      f"{account.accountId:<12} | {account.accountNumber:<12} | "
      f"{account.holderName:<18} | {account.type:<8} | "
      f"{format_paise(account.balancePaise):>14} | {od:<12}"
    )
  print("-" * 80)
  print(f"Total Sandbox System Funds: {format_paise(bank.total_system_funds_paise())}\n")


def main(argv: Optional[List[str]] = None) -> None:
  _configure_stdio()
  parser = argparse.ArgumentParser(
    description="CoreBanking Sandbox companion CLI (Project PST_PD_153)"
  )
  subparsers = parser.add_subparsers(dest="command")

  subparsers.add_parser("list", help="List accounts with balances")

  create_parser = subparsers.add_parser("create", help="Create a new account")
  create_parser.add_argument("--holder", required=True, help="Account holder name")
  create_parser.add_argument("--type", choices=["savings", "current"], default="savings")
  create_parser.add_argument("--deposit", default="0.00", help="Opening deposit in INR")

  transfer_parser = subparsers.add_parser("transfer", help="Transfer between two accounts")
  transfer_parser.add_argument("--from", dest="from_id", required=True)
  transfer_parser.add_argument("--to", dest="to_id", required=True)
  transfer_parser.add_argument("--amount", required=True)
  transfer_parser.add_argument("--ref", default="", help="Optional reference note")

  statement_parser = subparsers.add_parser("statement", help="Print account statement")
  statement_parser.add_argument("--account", required=True)

  overdraft_parser = subparsers.add_parser("overdraft", help="Configure overdraft (admin)")
  overdraft_parser.add_argument("--account", required=True)
  overdraft_parser.add_argument("--enable", action="store_true")
  overdraft_parser.add_argument("--disable", action="store_true")
  overdraft_parser.add_argument("--limit", default="0.00")

  subparsers.add_parser("reset", help="Reset to 5 sample accounts and seed ledger")

  args = parser.parse_args(argv)
  bank = Bank()

  if not args.command or args.command == "list":
    _print_account_list(bank)
    return

  if args.command == "create":
    try:
      deposit = parse_rupees_to_paise(args.deposit)
      account = bank.create_account(args.holder, args.type, deposit)
      print(f"\n[SUCCESS] Created {account.accountId} ({account.accountNumber}) for {account.holderName}.")
      print(f"Type: {account.type} | Balance: {format_paise(account.balancePaise)}\n")
    except ValueError as exc:
      print(f"\n[ERROR] Account creation failed: {exc}\n", file=sys.stderr)
      sys.exit(1)
    return

  if args.command == "transfer":
    try:
      amount = parse_rupees_to_paise(args.amount)
      record = bank.transfer(args.from_id, args.to_id, amount, args.ref)
      src = bank.get_account(record.fromAccountId)
      dst = bank.get_account(record.toAccountId)
      assert src is not None and dst is not None
      print(f"\n[SUCCESS] Transfer {record.transferId} completed.")
      print(f"Amount: {format_paise(record.amountPaise)} from {src.accountId} to {dst.accountId}.")
      print(f"{src.accountId} balance: {format_paise(src.balancePaise)}")
      print(f"{dst.accountId} balance: {format_paise(dst.balancePaise)}\n")
    except ValueError as exc:
      print(f"\n[ERROR] Transfer rejected: {exc}\n", file=sys.stderr)
      sys.exit(1)
    return

  if args.command == "statement":
    try:
      data = bank.statement(args.account)
      account = data["account"]
      print("\n" + "=" * 90)
      print(f" STATEMENT: {account.accountId} - {account.holderName} ({account.type})")
      print(
        f" Opening: {format_paise(data['openingBalance'])} | "
        f"Closing: {format_paise(data['closingBalance'])}"
      )
      print("=" * 90)
      print(
        f"{'Date / Time':<24} | {'Description':<32} | {'Debit':>12} | "
        f"{'Credit':>12} | {'Running Bal':>12}"
      )
      print("-" * 90)
      for txn in data["transactions"]:
        debit = format_paise(txn.amountPaise) if txn.type == "debit" else "-"
        credit = format_paise(txn.amountPaise) if txn.type == "credit" else "-"
        print(
          f"{txn.createdAt[:19]:<24} | {txn.reference[:32]:<32} | "
          f"{debit:>12} | {credit:>12} | {format_paise(txn.balanceAfterPaise):>12}"
        )
      print("-" * 90 + "\n")
    except ValueError as exc:
      print(f"\n[ERROR] Could not generate statement: {exc}\n", file=sys.stderr)
      sys.exit(1)
    return

  if args.command == "overdraft":
    try:
      if args.disable:
        bank.set_overdraft(args.account, False, 0)
        print(f"\n[SUCCESS] Overdraft disabled for {args.account}.\n")
      else:
        limit = parse_rupees_to_paise(args.limit)
        bank.set_overdraft(args.account, True, limit)
        print(f"\n[SUCCESS] Overdraft enabled for {args.account}, limit {format_paise(limit)}.\n")
    except ValueError as exc:
      print(f"\n[ERROR] Failed to update overdraft: {exc}\n", file=sys.stderr)
      sys.exit(1)
    return

  if args.command == "reset":
    bank.reset_to_seed()
    print("\n[SUCCESS] Sandbox reset to 5 sample accounts and 21 seed transactions.\n")


if __name__ == "__main__":
  main()