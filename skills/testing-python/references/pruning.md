# Pruning tests

For a change that deletes or consolidates tests: working through one package's suite, or collapsing
the tests of one seam. What a test must do to stay is `writing-python` → `references/testing.md`
§ What a test is for. This file is how to find the candidates and prove that nothing was lost.

## 1. Measure the scope

Take one package's tests plus the integration tests that drive that package. Record which production
lines each test executes in its **run** phase. This needs pytest-cov, and `[tool.coverage.run]` with
`source` naming the production source roots and `omit` excluding the tests; otherwise a test counts
its own lines as production.

```bash
S=$(mktemp -d)
T="<package>/tests <the integration tests that drive it>"        # the scope
F="<the default lane's marker filter>"                           # e.g. "not slow"
COVERAGE_FILE=$S/.coverage uv run pytest $T -m "$F" -n <N> -q --cov --cov-context=test --cov-report=
COVERAGE_FILE=$S/.coverage uv run coverage json --show-contexts -o $S/cov.json -q
uv run pytest $T -m "$F" --collect-only -q | grep '::' > $S/ids.txt
```

Each context is `<test id>|setup`, `|run` or `|teardown`. Count **`|run` only**. Teardown contexts pick
up lazy imports and interpreter-exit work, and they make a source-reading test look as if it ran
production code. Per-test contexts combine correctly under xdist (measured: the same line set and the
same findings at `-n 4` as in one process).

## 2. Tests that execute no production line

Save this as `$S/zero.py`:

```python
import json
import sys
from pathlib import Path

cov = json.loads(Path(sys.argv[1]).read_text())
ran = {c.removesuffix("|run") for f in cov["files"].values() for cs in f["contexts"].values() for c in cs if c.endswith("|run")}
for test_id in Path(sys.argv[2]).read_text().splitlines():  # a parametrize id may contain spaces
    if test_id not in ran:
        print(test_id)
```

`uv run python $S/zero.py $S/cov.json $S/ids.txt` prints them. Each one is one of three kinds:

- **A reader of source, an AST, prose or file names, or a check that something is absent.** Delete it.
  If the rule matters, express it as a ruff `banned-api` rule or an import-linter contract in the same
  change.
- **A test of a library's behaviour** (Pydantic storing a field). Delete it.
- **A test of import-time behaviour** (`__all__`, a module-level registry). Lines that run at import are
  attributed to collection, not to the test. Keep it only if the claim really is about import time.

Verified 2026-09-28 on a 17-test package: the finder listed five tests (four that read a source file,
a docs file or a path's existence, and one that checks `__all__`) and none of the tests that call the
code.

The finder cannot see a test whose only production lines are a lazy import inside its body, such as
a test that imports a function and asserts `callable()` on it. Read the asserts too: a test with no
Act is a candidate whatever its line count.

## 3. Subset twins

For two tests of the same seam, if test A's `|run` lines are a subset of test B's and A asserts nothing
B does not, delete A. When the pair is a unit test and an integration test, keep the integration test.
For the parametrize cases of one function, keep one case per distinct line set (a distinct branch).
Cases that walk the same lines are one case, except the two sides of a boundary: `n == limit` and
`n == limit + 1` can walk the same comparison, and each catches a different off-by-one. A shared line
set makes a candidate; step 4's red check is the verdict.

## 4. Prove nothing was lost

- **The union of executed production lines must not shrink.** Save this as `$S/union.py`, then run it
  on the step 1 output before and after (rerun step 1 over the kept set):

  ```python
  import json
  import sys
  from pathlib import Path

  cov = json.loads(Path(sys.argv[1]).read_text())
  print(sum(1 for f in cov["files"].values() for cs in f["contexts"].values() if any(c.endswith("|run") for c in cs)))
  ```

  The kept tests are a subset of the original ones, so their union is a subset of the original union,
  and an equal count means an equal set.
- **For each branch whose test you merged or deleted**, run the red check (`../SKILL.md` § The red
  check) against the kept test: break that branch, and the kept test must go red.
- **Record the proof in the commit message**: the scope measured, the tests deleted and merged, and the
  two union counts.
