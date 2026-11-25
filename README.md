# CoreBanking Sandbox (PST_PD_153)

**Team:** Kunal Tayde, Gajangi Nikhileshwar  
**Stack:** HTML, CSS, JavaScript, Bootstrap 5, Python 3 (Sem 1 Frontend + Intro to Programming)

## Demo disclaimer

This is an **educational demo only**. All names, accounts, and balances are synthetic. No real money moves here. This app is **not** production banking software and does not meet real banking security or compliance requirements.

## What this project shows

Core banking rules in a small sandbox:

- Direct account creation (no separate customer onboarding)
- Fund transfers with **double-entry** ledger rows (debit + credit share the same `transferId`)
- Integer **paise** storage (`₹1.00` = `100` paise), shown with 2 decimal places
- Overdraft only when enabled and within limit (ACC-1002 ships with overdraft in sample data)
- Account statements with running balance

## Project layout

```text
corebanking-sandbox/
├── index.html          # Web UI (Bootstrap 5)
├── css/styles.css
├── bank.py             # Python CLI (stdlib only)
├── bank_data.json      # JSON persistence (CLI + conceptual match to web localStorage)
└── README.md
```

Web UI screens (PRD): Dashboard, Create Account, Transfer Funds, Account Statement, Admin / Overdraft settings, plus role switch (Developer vs Admin).

## Run the web app

**Option A:** Open `index.html` with VS Code **Live Server** (or any static file server).

**Option B:**

```powershell
cd C:\Users\KUNAL TAYDE\Projects\corebanking-sandbox
python -m http.server 5500
```

Then open: http://localhost:5500

## Run the Python CLI

Requires **Python 3**. No pip packages.

```powershell
cd C:\Users\KUNAL TAYDE\Projects\corebanking-sandbox
```

| Command | Purpose |
|--------|---------|
| `python bank.py list` | List accounts and total sandbox funds |
| `python bank.py create --holder "Name" --type savings --deposit 2500.00` | New account |
| `python bank.py transfer --from ACC-1001 --to ACC-1003 --amount 500.00 --ref "Note"` | Transfer |
| `python bank.py statement --account ACC-1001` | Statement |
| `python bank.py overdraft --account ACC-1003 --enable --limit 25000.00` | Enable overdraft |
| `python bank.py overdraft --account ACC-1003 --disable` | Disable overdraft |
| `python bank.py reset` | Restore 5 sample accounts + 21 transactions |

### Sample CLI session

```powershell
python bank.py list
python bank.py statement --account ACC-1002
python bank.py transfer --from ACC-1001 --to ACC-1004 --amount 1000.00 --ref "Lab fee"
python bank.py create --holder "Anjali Deshmukh" --type savings --deposit 1500.00
python bank.py reset
```

## Banking rules (CLI = web)

1. **Money:** Store and compute in paise integers; display as INR with 2 decimals.
2. **Transfer:** Amount must be &gt; 0; source and destination must differ; both accounts active.
3. **Overdraft:** Without flag, balance cannot go below zero. With flag, floor is `-overdraftLimitPaise`.
4. **Ledger:** Each successful transfer writes one debit and one credit with the **same** `transferId`.
5. **Conservation:** Transfers move money; they do not create or destroy sandbox total funds.

## `bank_data.json` shape

Same idea as browser `localStorage` keys:

- `accounts`
- `transactions`
- `transfers`
- `preferences` (role, last account, statement filters)

If `bank_data.json` is missing or empty, `bank.py` seeds the PRD sample (5 accounts, 8 transfers, 21 transactions).

## OOP (syllabus)

- `Account`, `Transaction`, `Transfer` dataclasses
- `Bank` class encapsulates load/save, transfers, and overdraft policy
- `Account.allows_debit()` encapsulates overdraft checks