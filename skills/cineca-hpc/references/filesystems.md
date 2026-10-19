# Filesystems and data management

All CINECA HPC systems share the same Lustre-based filesystem layout. Always use the
predefined environment variables (e.g. `$WORK`) in scripts, not full paths.

## Data areas
| Variable | Attributes | Quota | Backup | Notes |
|----------|-----------|-------|--------|-------|
| `$HOME` | permanent, user-specific | 50 GB | daily | Personal area. |
| `$WORK` | permanent, shared | 1 TB | no | Large data shared with project collaborators. |
| `$FAST` | permanent, shared | 1 TB | no | Leonardo only; faster I/O. |
| `$SCRATCH` | temporary, user-specific | 20 TB | no | Files older than 40 days are deleted. |
| `$TMPDIR` | temporary, user-specific | — | no | Removed at job completion. |
| `$PUBLIC` | permanent, open, user-specific | 50 GB | no | Leonardo only. |
| `$DRES` | permanent, shared | by project | no | Project data resource. |

Storage areas are **temporary** (auto-deleted after a time window) or **permanent**
(kept up to 6 months after project end), and **user-specific**, **shared** (same project),
or **open** (all users).

## Guidance
- `$SCRATCH` has files older than 40 days auto-deleted; it is for producing data, **not**
  long-term storage. Do not use `touch`/scripts to artificially keep files alive.
- Backup on `$HOME` may be temporarily inactive on some clusters — check each cluster's docs.
