# Slurm on CINECA

Every job is billed to an active project account; its data is read from `$WORK` or `$SCRATCH`.

## Leonardo Booster (GPU)

| Item | Value |
|---|---|
| GPU partition | `boost_usr_prod` |
| One node | 4× NVIDIA A100 64 GB, 32 CPU cores |
| Debug QOS | `boost_qos_dbg` — schedules fast, short walltime; for tests |
| Production QOS | `boost_qos_bprod` — full jobs |
| Default partition | `lrd_all_serial` — CPU-only, never for GPU jobs |

A full node is 4 GPUs + 32 cores: ask for `--gres=gpu:4 --ntasks=1 --cpus-per-task=32`.

## Which account

```bash
sacctmgr show assoc user=$USER format=account%30             # every account the user belongs to
sacctmgr show assoc user=$USER format=account%30,partition,qos%50
saldo -b                                                     # budget left and validity dates
```

A listed account can still have an expired or used-up budget; jobs on it fail with
`invalid account or expired budget`. Pick one with budget left and set it once on the cluster, in
`~/.bashrc`: `export SBATCH_ACCOUNT=<project>` (sbatch reads it; srun reads `SLURM_ACCOUNT`, salloc
`SALLOC_ACCOUNT`).

## Batch jobs

```bash
sbatch job.sh          # submit
squeue -u $USER        # your jobs
scancel <job_id>       # cancel
```

| Directive | Purpose | Example |
|-----------|---------|---------|
| `--job-name` | job name | `#SBATCH --job-name=my_job` |
| `--output` / `--error` | stdout / stderr file (`%j` = job id) | `#SBATCH --output=out_%j.log` |
| `--time` | max walltime | `#SBATCH --time=01:00:00` |
| `--nodes` | nodes | `#SBATCH --nodes=1` |
| `--ntasks` / `--ntasks-per-node` | tasks | `#SBATCH --ntasks-per-node=32` |
| `--cpus-per-task` | CPUs per task | `#SBATCH --cpus-per-task=8` |
| `--mem` | memory per node | `#SBATCH --mem=64G` |
| `--gres` | GPUs | `#SBATCH --gres=gpu:4` |
| `--partition` / `--qos` / `--account` | where it runs, priority class, who pays | see above |

A Leonardo GPU job:

```bash
#!/bin/bash
#SBATCH --job-name=gpu-job
#SBATCH --partition=boost_usr_prod
#SBATCH --qos=boost_qos_dbg
#SBATCH --account=<project>
#SBATCH --nodes=1
#SBATCH --gres=gpu:4
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=32
#SBATCH --time=00:30:00
#SBATCH --output=gpu-job_%j.log

nvidia-smi
srun ./my_application
```

A CPU job is the same without `--gres` and with a CPU partition and QOS.

## Interactive jobs

Allocate, then run on the compute node with `srun`; a command without `srun` runs on the login node:

```bash
salloc -N 1 --ntasks-per-node=8 -A <project> --partition=<name> --qos=<name> --time=1:00:00
srun hostname          # the compute node
exit                   # end the allocation
```

A shell on a GPU node (`--overlap` lets nested `srun` calls share the allocation):

```bash
srun --partition=boost_usr_prod --qos=boost_qos_dbg --account=<project> --gres=gpu:4 \
     --cpus-per-task=8 --mem=64G --time=00:30:00 --pty bash
```

The prompt changes from `login…` to a node name (`lrdn…`) once the allocation is ready.

## Monitoring and cancelling

```bash
squeue -u $USER          # your jobs (ST: R running, PD pending)
squeue --start           # estimated start of pending jobs
squeue -o "%.18i %.9P %.8j %.8u %.2t %.10M %.6D %R"   # custom columns
sinfo -s                 # partition / node state summary
scontrol show job <id>   # one job in detail
scontrol hold <id>       # keep a pending job from starting; scontrol release <id> undoes it
scancel <id>             # one job;  scancel -u $USER: all of them;  scancel -n <name>: by name
```

## Errors

| Error | Cause | Fix |
|---|---|---|
| `Job violates accounting/QOS policy` | no partition or account, or a limit exceeded | add `--partition` and `--account`; lower `--mem` / `--time` |
| `invalid account or expired budget` | the account has no live budget | another account; `saldo -b` |
| `QOSMaxMemoryPerUser` | the default (serial) partition's memory cap | `--partition=boost_usr_prod` |
| `Invalid account` | a wrong or truncated account name | `sacctmgr show assoc user=$USER format=account%30` |
