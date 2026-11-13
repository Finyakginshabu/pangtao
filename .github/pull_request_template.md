## Summary

<!-- What this PR implements, in bullets. -->

Issue: #
Contract: `docs/sprints/sprint-N/f-XX-*.md` (version )

## What's included

### Server
- 

### Database
- 

### Web
- 

## Verification

Tested commit: 
`npm run verify`: passed / failed
Unit + API: passed, failed, skipped
End-to-end: passed, failed, skipped
Service-layer coverage: %

## Acceptance criteria coverage

| AC | TEST | Level | Test file | Result |
|---|---|---|---|---|
| AC-XX.1 | TEST-XX.1 | A | `tests/api/…` | Passed |
| AC-XX.2 | TEST-XX.2 | U | `tests/unit/…` | Skipped |

## Failing-first evidence

<!-- For each AC the contract's DoD names: the commit where the test failed, then the commit that made it pass. -->

| AC | Failing-test commit | Implementation commit |
|---|---|---|
| AC-XX.k | | |

## Notes

<!-- Trade-offs, known limitations, deferred items. If a test is skipped or failing, give the reason here. -->

## Checklist
- [ ] Contract requirements met; any contract change has a version-history row
- [ ] `npm run verify` passes on the tested commit above
- [ ] `docs/traceability.md` §3 updated with this feature's results
- [ ] No plaintext passwords in source or fixtures
- [ ] No stack traces in API error responses
- [ ] Issue closed by hand after merge (PRs into staging do not close it automatically)
