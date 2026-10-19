# Software environment

## module command
All software is provided as modules; a base set is preloaded at login.
```bash
module avail                    # available modules
module load <appl>              # load into current shell
module load autoload <appl>     # load with all dependencies
module load <appl>/<version>    # specific (or hidden) version
module list                     # currently loaded
module help <appl>              # app-specific help
module unload <appl>            # unload one
module purge                    # unload all
module av -a                    # include hidden (unguaranteed) modules
```

## modmap
Modules are grouped into profiles; only `base` loads at login. `modmap` searches all
profiles at once.
```bash
modmap -m <name>        # find a module across profiles (e.g. modmap -m lammps)
modmap -c compilers     # list available compilers
```
To load a module from a non-base profile, load the profile first:
```bash
module load profile/chem-phys
module load lammps/29aug2024
```

## Compilers
GCC is always available without loading a module; newer versions via `module load gcc/<ver>`.
The `gcc` module sets `CC=gcc`, `CXX=g++`, `FC/F90/F77=gfortran`.

- **NVIDIA GPUs:** `nvhpc` (nvc, nvc++, nvfortran, nvcc; also legacy pgcc/pgf90). Flags:
  `-cuda` for CUDA, `-acc` for OpenACC, `-gpu` to target the GPU, `-mp` for OpenMP
  (`-mp=gpu` for GPU offload). Also GCC and `cuda`.
- **Intel CPUs:** `intel-oneapi-compilers` (oneAPI icx/icpx/ifx; classic icc/icpc/ifort via
  `intel-oneapi-compilers-classic`). Also GCC.
- **AMD CPUs:** `aocc` (clang, clang++, flang). Also GCC.

Example (Fortran with oneAPI):
```bash
module load intel-oneapi-compilers/<version>
ifx -o myexec myprog.f90
```

## Basic MPI execution
Single-process test on the login node:
```bash
module load <mpi module used to build your exec>
mpirun ./myexec
```
Parallel run: allocate compute nodes (salloc/sbatch) then launch with `srun` or `mpirun`:
```bash
module load <mpi module>
salloc -N 2 --ntasks-per-node=1 --cpus-per-task=1 --gres=gpu:1 -A <account> \
       --time=<time> --partition=<name> --qos=<name>
srun -n 2 ./myexec
```

## Python virtual environments
Create envs in `$WORK`, not `$HOME`.
```bash
module load python/<version>
module load py-mpi4py/<version>      # if MPI is needed
python -m venv my_env_test
source my_env_test/bin/activate
pip install <package>
deactivate                           # when done
```
Check versions with `modmap -m python` / `modmap -m py-mpi4py`. For Cineca-optimized AI/HPC
stacks, see the cineca-ai and cineca-hpyc modules.

## Spack
Package manager for installing extra software.
```bash
ml spack
spack spec -Il <package>     # ALWAYS run first: check the spec and dependency status
spack install <package>      # install (add @version %compiler +variant ^dep as needed)
ml <package>                 # load the created module
```
On Cineca clusters, prefer Cineca-optimized dependencies (shown as `^`). Force a specific
dependency by hash: `spack spec -Il <package> ^/hash` then `spack install <package> ^/hash`.
If a created module misses dependencies, refresh modulefiles:
```bash
spack module tcl refresh --upstream-modules <package>
module use $PUBLIC/spack-<version>/modules   # e.g. on Leonardo
module av <package_module>
module load <package_module>
```
