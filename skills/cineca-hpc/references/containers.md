# Containers with GPUs (Singularity on Leonardo)

Tested on `boost_usr_prod` with SingularityPRO 3.9. The partition, QOS and account flags of the
allocations below are in `references/slurm.md`.

## `singularity`, not `apptainer`

Leonardo's module provides a binary named `singularity`; there is no `apptainer`. Singularity split in
2021 into the open-source **Apptainer** (Linux Foundation) and Sylabs' **SingularityCE / PRO**, with a
near-identical CLI (`exec`, `run`, `shell`, `pull`, `--nv`), so commands written for one run on the
other with the binary name swapped. CINECA ships SingularityPRO (`singularity/3.9-pro`).

## Load the module (login node)

It lives under `profile/global`, which is not loaded by default:

```bash
module load profile/global
module load singularity/3.9-pro
singularity --version
```

`module avail` shows nothing → `module spider singularity` searches the whole hierarchy and names any
prerequisite module.

## Pull images on the login node

Pull or build `.sif` files on a login node, into `$SCRATCH` (they are large):

```bash
cd $SCRATCH
singularity pull docker://nvidia/cuda:12.4.0-base-ubuntu22.04   # ~86 MB; ends with "Creating SIF file..."
```

## Inside the job: load the module again

A job shell starts from `profile/base`, which does not provide `singularity/3.9-pro`:

```
[ERR] The following modulefiles are not provided by module profile 'profile/base':
[ERR]   + singularity/3.9-pro
```

Load `profile/global` and the module again inside the job, interactive or batch.

## Check GPU passthrough

```bash
nvidia-smi                                                          # host: 4× A100
singularity exec --nv $SCRATCH/cuda_12.4.0-base-ubuntu22.04.sif nvidia-smi   # the same 4, from inside
singularity exec --nv my_image.sif python -c \
  "import torch; print(torch.cuda.is_available(), torch.cuda.device_count())"  # True 4
```

`--nv` binds the host NVIDIA driver and libraries into the container; without it the container sees no
GPU even when the host does.

| Symptom | Meaning |
|---|---|
| `nvidia-smi` works on the node, fails in the container | `--nv` missing, or the module not loaded |
| `nvidia-smi` fails on the node too | no GPUs allocated: check `--gres=gpu:4` and the partition |
| torch says `0` GPUs, `nvidia-smi` in the container shows them | torch built without CUDA, or a CUDA/driver mismatch |
| an image can't be pulled in a job | expected: pull on the login node |

In a batch script, the same lines follow the `#SBATCH` header of the GPU job in `references/slurm.md`.
