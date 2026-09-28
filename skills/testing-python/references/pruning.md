# Pruning tests

This is for a change that deletes or consolidates tests: working through a member's suite, or
collapsing the tests of one seam. The policy in SKILL.md decides what stays. This file is how to find
the candidates and prove that nothing was lost.

## 1. Measure the scope

Take one member's tests plus the integration tests that drive that member. Record which production
lines each test executes in its **run** phase:

```bash
S=$(mktemp -d)
T="services/catalog/tests tests/integration"              # the scope
COVERAGE_FILE=$S/.coverage uv run pytest $T -m "not slow and not e2e" -n 16 -q \
  --cov --cov-context=test --cov-report=
COVERAGE_FILE=$S/.coverage uv run coverage json --show-contexts -o $S/cov.json -q
uv run pytest $T -m "not slow and not e2e" --collect-only -q | grep '::' > $S/ids.txt
```

Each context is `<test id>|setup`, `|run` or `|teardown`. Count **`|run` only**. Teardown contexts pick
up lazy imports and interpreter exit work, and they make a source-reading test look as if it ran
production code.

## 2. Tests that execute no production line

Save this as `$S/zero.py`:

```python
import json
import sys

cov = json.load(open(sys.argv[1]))
ran = {c.removesuffix("|run") for f in cov["files"].values() for cs in f["contexts"].values() for c in cs if c.endswith("|run")}
for test_id in open(sys.argv[2]).read().split():
    if test_id not in ran:
        print(test_id)
```

`uv run python $S/zero.py $S/cov.json $S/ids.txt` prints them. Each one is one of three kinds:

- **A source, AST, prose or file-name reader.** Delete it. If the rule matters, express it as a ruff
  `banned-api` rule or an import-linter contract in the same change.
- **A test of a library's behaviour** (Pydantic storing a field). Delete it.
- **A test of import-time behaviour.** Lines that run at import are attributed to collection, not to
  the test. Keep it only if the claim really is about import time.

Verified 2026-09-28 on `packages/validate/tests` plus two catalog files: the finder listed exactly the
ten source- and file-reading tests, and none of the tests that call the code.

The finder cannot see a test whose only production lines are a lazy import inside the test body.
For example, `test_the_governed_create_is_reachable_without_a_route` asserts `callable()` on an
imported function and is not listed. Read the asserts too: a test with no Act is a candidate
whatever its line count.

## 3. Subset twins

For two tests of the same seam, if test A's `|run` lines are a subset of test B's and A asserts
nothing B does not, delete A. When the pair is a unit test and an integration test, keep the
integration test. For parametrize cases of one function, keep one case per distinct line set (a
distinct branch). Cases that walk the same lines are one case.

## 4. Prove nothing was lost

- Rerun step 1 on the kept set. The union of production lines executed must not shrink.
  `make coverage` shows it member-wide.
- For each branch whose test you merged or deleted, do the red check (`rask-fixtures.md`) against the
  kept test: break that branch, and the kept test must go red.
- State the net delta in the commit message (`tests: +N −M`), together with the scope measured.
