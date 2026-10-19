---
name: cineca-hpc
description: >
  CINECA HPC clusters (Leonardo, Marconi, Galileo100, Pitagora) — 2FA login with Smallstep SSH
  certificates, Slurm jobs on the Leonardo Booster GPUs, modules and containers, filesystems, budget.
  Use when the user mentions CINECA or Leonardo, step ssh login, sbatch/srun/squeue on these
  clusters, saldo, or an HPC login/2FA problem.
---

# CINECA HPC

Getting onto CINECA's clusters and running work there. Login nodes: `login.leonardo.cineca.it`,
`login.marconi.cineca.it`, `login.g100.cineca.it`, `login.pitagora.cineca.it`. Support:
superc@cineca.it.

## The account lives in the user's local config

Read personal values from the machine; never write them into a shared file or repo.

```bash
ssh -G login.leonardo.cineca.it | awk '/^user /{print $2}'   # cluster username: ~/.ssh/config `User`
cat ~/.step/config/defaults.json   # `identity` (the UserDB email) + `provisioner` for step ssh login
echo $SBATCH_ACCOUNT               # on the cluster: the project account jobs are billed to
```

A value is missing → the one-time setup in `references/login.md` stores it; finding the live project
account → `references/slurm.md`.

## Everyday login

One terminal, in order:

```bash
eval $(ssh-agent)
step ssh login                 # browser: SSO password + 6-digit OTP, wait for "Success"
ssh login.leonardo.cineca.it   # the username comes from ~/.ssh/config
```

The certificate lasts **12 hours** and is gone after a reboot: re-run the first two lines.
`ssh-add -l` shows one `(ECDSA-CERT)` line while it is loaded.

## Scope routing

| If you need to… | Read |
|---|---|
| set up 2FA, Smallstep or the local config; fix a failed login or an SSH error | `references/login.md` |
| write a job script, allocate a node interactively, pick the Leonardo GPU partition / QOS / account, read a Slurm error | `references/slurm.md` |
| load modules, compilers, Python venvs, Spack | `references/environment.md` |
| run a container with GPUs (Singularity) | `references/containers.md` |
| decide where data goes; quotas and purge rules | `references/filesystems.md` |
| check or understand budget consumption | `references/budget.md` |

## House rules — non-negotiable

- **Log in with the cluster username**, never the UserDB/SSO portal name (`name.surname_NNNNN`).
- **Compute nodes have no internet**: fetch images, models, datasets and packages on a login node first.
- **Login nodes are for editing, transfers and short tests (≤ 10 min CPU)**; real work goes through Slurm.
- **Environments and data go in `$WORK` / `$SCRATCH`** (`$FAST` on Leonardo), not `$HOME` (50 GB).
- **GPU jobs name their partition, QOS and account**: Leonardo's default partition is CPU-only.

## Top gotchas

- **"REMOTE HOST IDENTIFICATION HAS CHANGED"** — expected: one login name covers several machines →
  `references/login.md`.
- **A password prompt, or "no separate private key for certificate"** — the certificate is missing or
  the agent lost its key → `references/login.md`.
- **`invalid account or expired budget`** — the account is listed but has no live budget →
  `references/slurm.md`.
- **A job shell can't find `singularity`** — it starts from `profile/base`; load the profile again in
  the job → `references/containers.md`.

## Cross-skill boundaries

- **A project's job scripts** (what it runs, its environment setup) live in that project's repo, e.g. a
  `slurm/` folder; this skill covers the clusters themselves.
