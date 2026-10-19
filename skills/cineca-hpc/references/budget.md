# Budget and accounting

## Checking budget with saldo
Run `saldo` with no options for full usage help.

```bash
saldo -b <User Account>     # budget of all project accounts for a username
saldo -b                    # default partition (Booster on Leonardo)
saldo -b --dcgp             # DCGP partition on Leonardo (flag mandatory)
saldo -a <Project Account>  # per-user usage of a project account (by date, jobs)
```

`saldo -b` columns: account, start/end dates, total local hours, consumed (local),
total consumed %, month total, month consumed. One user account can belong to several
project accounts.

## Billing policy
Budget is consumed in **effective CPU hours (CPUh)**:

```
B_H = T · N · R · C
```
- **T** = elapsed time (hours)
- **N** = nodes allocated
- **C** = CPUs per node (architecture-dependent; e.g. 32 on a Leonardo Booster node)
- **R** = reserved fraction of a node = `max over resource types of Allocated/Total`
  (CPUs, GPUs, or memory). Reserving all of any one resource type makes the whole node
  unavailable, so it bills as a full node.

Example: 1 node, 4 CPUs, 4/4 GPUs, runs 2 h on Leonardo Booster (C=32).
GPU fraction = 4/4 = 1.0 dominates → R = 1.0.
`B_H = 2 · 1 · 1.0 · 32 = 64 CPUh`.

Notes:
- The **serial partition** is free of charge and usable even after a project expires
  (for limited post-production analysis).
- Memory allocated per node defaults to proportional to CPUs requested.
- Exclusive-mode requests reserve the whole node regardless of what was asked.
- Per-node resource counts are in each cluster's Hardware Details section.

## Budget linearization
Each project account gets a monthly quota `MQ = TB / NM` (total budget / number of months).
Each month starts at full priority; as the monthly quota is consumed, job priority drops.
Jobs still run after the quota is exhausted but at reduced priority versus accounts with
remaining quota. Spread usage evenly across months for best throughput and fairness.
