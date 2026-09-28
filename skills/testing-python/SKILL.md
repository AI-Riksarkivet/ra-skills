---
name: testing-python
description: pytest at the suite level — collection and markers (--strict-markers, testpaths, the skip list), parallel runs with pytest-xdist, hang limits, --durations, the red check that proves a new test can fail, and pruning redundant tests with per-test coverage. Use when a test does not collect or runs in no lane, when a suite is slow, hangs or fails only under -n, when proving a test goes red, or when auditing or pruning a suite.
---

# Testing Python: the suite

One test (what earns it a place, tiers, fixtures, doubles, async, parametrize) is `writing-python` →
`references/testing.md`; read that first. A FastAPI app's client and lifespan: `fastapi` →
`references/testing.md`. A project's own wiring (which directories, which lanes, the fixtures it
ships) lives in that project's skill. This skill is the suite as a whole.

## The red check

Run it once for every new or changed test, with the fix and the test both in the working tree:

```bash
git stash push -- <path/to/fixed_module.py>      # set the fix aside; the test stays
find <src-root> -name __pycache__ -prune -exec rm -rf {} +
PYTHONDONTWRITEBYTECODE=1 uv run pytest <test_file>::<test_name> -p no:cacheprovider
#   expect: FAILED, on the assertion that names the bug
PYTHONDONTWRITEBYTECODE=1 uv run pytest <this code's tests> <the integration tests that drive it> \
  -m "<the default lane's marker filter>" -n <N> -q -rf -p no:cacheprovider
#   expect: your test is the only failure
git stash pop
PYTHONDONTWRITEBYTECODE=1 uv run pytest <test_file>::<test_name>   # expect: passed
```

- **New behaviour has no fix to stash.** Break the line the test is about instead, and restore it.
- **Purge `__pycache__` and set `PYTHONDONTWRITEBYTECODE=1`.** Python reuses a cached `.pyc` when the
  source's mtime and size match, so a stash and pop within one second, at the same file size, can
  leave the fixed code running while you believe it is reverted.
- **Red for the right reason.** An `ImportError`, a fixture error or a timeout is not red. The failure
  is the assertion the test exists for.
- **Another test went red as well**: it already catches this bug, so one of the two is redundant. Keep
  the integration test (`writing-python` → `references/testing.md` § Tiers).
- **A fix already committed**: reverse it with `git show <sha> -- <path> | git apply -R`, and restore
  it with `git checkout -- <path>`.

Done when: the test is red with the fix reverted, on its own assertion, green with the fix restored,
and no other test went red on the revert.

## Collection and markers

- **Register every marker and put `--strict-markers` in `addopts`.** Without it a misspelled marker is
  only a warning, and `@pytest.mark.slwo` runs inside `-m "not slow"` (measured, pytest 9.1.1).
- **With `testpaths` set, a bare `pytest` collects only those directories.** A new package's `tests/`
  runs once it is added to the list. Adding the directory is part of adding the package.
- **Run each lane with `-rs` and read the skip reasons.** A skipped test ran nowhere. A skip for a
  missing tool or broker is a lane defect: provide the tool in the lane (`writing-python` →
  `references/testing.md` § Determinism).

## Speed and hangs

- **Measure first.** `pytest --durations=20` lists the slowest setup, call and teardown phases. Time
  `pytest --collect-only -q` on its own to see import cost. Fix the slowest first.
- **Parallel with pytest-xdist: `-n <N>` in the lane's command, not in `addopts`**, so a one-test debug
  run and a model-loading suite are not forced parallel. Give a number inside a container: `-n auto`
  reads the host's cores, not the container's CPU quota. `-n 0` runs one process when a failure needs
  a readable traceback.
- **`--dist load` (the default) spreads single tests; `--dist loadfile` keeps a file's tests on one
  worker.** Use `loadfile` when tests in one file share process-global state (a logger, a module-level
  cache, a marker file). A failure that appears only under `load` points at a test that depends on
  running after a sibling in its file.
- **Each xdist worker is its own process.** Session fixtures and `functools.cache` build once per
  worker, not once per run. A resource that must exist once per run needs a file lock
  (`writing-python` → `references/testing.md` § Fixtures).
- **A per-test ceiling in CI**: pytest-timeout with `--timeout=<s> --timeout-method=thread`. A hung test
  then fails and prints every thread's stack, instead of stalling the job with no output. Set the
  ceiling far above the suite's runtime: it detects hangs, it is not a speed budget.

## Pruning a suite

Deleting or consolidating tests, or auditing a suite for redundancy: `references/pruning.md`. It finds
the tests that execute no production line and the tests whose lines are a subset of another test's,
and proves nothing was lost.
