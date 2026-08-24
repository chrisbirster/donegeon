# M4 — quick add / search gate

Status: COMPLETE

M4 replaces parser/search confidence-by-count with semantic evidence.

## Quick Add

- `docs/specs/quickadd/parser-parity.json` is the shared syntax corpus.
- `internal/quickadd/parser_parity_test.go` proves the Go parser matches the corpus.
- `web/apps/client/tests/unit/quickAddParserParity.test.ts` proves the browser-local parser matches the same corpus.
- `internal/task/quickadd_persistence_contract_integration_test.go` proves parsed durable fields survive task creation: content, description, project, labels, priority, due, deadline, recurrence, and original schedule input.
- `+assignee` remains parser metadata only. The canonical task model has no durable assignee field, so M4 does not misrepresent that syntax as task assignment.

## Search / filter

- Browser search remains an open-task interaction over task content, description, and project name. End-to-end browser acceptance is M6.
- `internal/taskmanagercompat/filter_contract_integration_test.go` proves the compatibility filter's current semantic contract: case-insensitive content/description matching, completed/deleted exclusion, tenant isolation through the canonical task list boundary, limit/cursor pagination, and the `query` alias.
- The compatibility filter is not treated as a full query language. Broader filter syntax and result sets beyond the canonical bounded list contract are not promoted by M4.

## Validation

Protected CI run #72 passed on implementation head `252df6cbfd8ff4ee8f8c756f2ef8a8238a7eff98`:

- Full-history secret scan
- Go vet, full Go tests, govulncheck
- Web typecheck, Node unit tests, build, production dependency audit
- Infra typecheck and production dependency audit

## Remaining boundaries

- Workspace/collaboration and integrations: M5.
- Coherent desktop/mobile browser acceptance, including Quick Add and search: M6.
- Compatibility-suite redundancy cleanup and final matrix normalization: M7.
