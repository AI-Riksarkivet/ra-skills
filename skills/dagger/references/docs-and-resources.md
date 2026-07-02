# Docs & Resources

Use these resources when the skill's patterns don't cover a specific
method, option struct, or advanced feature. Listed in priority order.
Fastest interactive discovery is `.help` in Dagger Shell — see SKILL.md
§ Finding answers beyond this skill.

---

## Go SDK reference (pkg.go.dev)

Canonical source of truth for method signatures and option structs:
→ https://pkg.go.dev/dagger.io/dagger

Search for types: `Container`, `Directory`, `File`, `Secret`, `Service`,
`CacheVolume`, `GitRepository`, `LLM`, `Env`, `CurrentModule`.

## Official documentation (docs.dagger.io)

Conceptual guides and tutorials organized by topic:

**Core types** (each type has its own sub-page with examples):
→ https://docs.dagger.io/getting-started/types

- Container: https://docs.dagger.io/getting-started/types/container
- Directory: https://docs.dagger.io/getting-started/types/directory
- File: https://docs.dagger.io/getting-started/types/file
- Secret: https://docs.dagger.io/getting-started/types/secret
- Service: https://docs.dagger.io/getting-started/types/service
- CacheVolume: https://docs.dagger.io/getting-started/types/cachevolume
- LLM: https://docs.dagger.io/getting-started/types/llm
- Env: https://docs.dagger.io/getting-started/types/env
- GitRepository: https://docs.dagger.io/getting-started/types/git

**Writing modules & functions**:

- Functions: https://docs.dagger.io/extending/functions
- Arguments & pragmas: https://docs.dagger.io/extending/arguments
- Return types: https://docs.dagger.io/extending/return-types
- Chaining: https://docs.dagger.io/extending/chaining
- Module dependencies: https://docs.dagger.io/extending/module-dependencies
- Custom types: https://docs.dagger.io/extending

**Core concepts**:

- Toolchains & checks: https://docs.dagger.io/core-concepts/toolchains
- Functions: https://docs.dagger.io/core-concepts/functions

**Recipes & integrations**:

- Cookbook: https://docs.dagger.io/cookbook
- GitHub Actions: https://docs.dagger.io/getting-started/ci-integrations/github-actions
- GitLab CI: https://docs.dagger.io/getting-started/ci-integrations/gitlab
- Use cases: https://docs.dagger.io/use-cases

**Full API reference**: https://docs.dagger.io/reference/

## Daggerverse (community modules)

Before writing something from scratch, check if a module already exists:
→ https://daggerverse.dev/

Search for common tasks: golang, python, node, docker-compose, trivy,
helm, golangci-lint, argocd, terraform, and many more.

### Notable modules

**docker-compose** — native Dagger reimplementation of Docker Compose.
API: `dag.DockerCompose().Project(source).Service("name").Up()` — install
command and full usage in go-patterns.md § Docker Compose integration.

### Using modules ad-hoc (without installing)

`dagger -m <module-ref> call ...` — see cli-reference.md § Using remote
modules directly.

### Installing as a dependency

`dagger install` plus usage via `dag`: see SKILL.md § Module dependencies.

Modules on Daggerverse have documentation pages showing available
functions, arguments, and usage examples. Always pin to a version tag.

### Listing installed dependencies

```bash
cat dagger.json  # shows module dependencies
dagger functions  # lists all functions including from dependencies
```

## When to search the web

Check the SDK version in `go.mod` (e.g. `dagger.io/dagger v0.19.x`)
and search accordingly — some methods are added or changed between versions.
