# Pangtao: Requirements Traceability

Related documents: [SRS](srs.md) · [Feature inventory](features.md) · [System-Level SDS](system-sds.md) · [Three-sprint plan](sprints/plan.md)

## 1. Requirements-to-feature-to-sprint traceability

AC and test IDs follow the convention AC-NN.k and TEST-NN.k, where NN is the feature number. Test levels: U unit, A API/database integration, E end-to-end. Sprint 1 IDs are fixed in Part E; later-sprint rows get contracts before implementation.

| Requirement | Feature | Sprint | Planned verification |
|---|---|---|---|
| FR-01 | F-01 | 1 | AC-01.x / TEST-01.x · A, E |
| FR-02 | F-01 | 1 | AC-01.x / TEST-01.x · A, E |
| FR-03 | F-01 | 1 | AC-01.x / TEST-01.x · A |
| FR-04 | F-01 | 1 | AC-01.x / TEST-01.x · A (role and ownership) |
| FR-05 | F-02 | 1 | AC-02.x / TEST-02.x · A |
| FR-06 | F-02 | 1 | AC-02.x / TEST-02.x · A, E |
| FR-07 | F-17 | 3 | Contract in Sprint 3 · A |
| FR-08 | F-03 | 1 | AC-03.x / TEST-03.x · U, A, E |
| FR-09 | F-09 | 2 | Contract in Sprint 2 · A, E |
| FR-10 | F-04 | 1 | AC-04.x / TEST-04.x · U, A |
| FR-11 | F-12 | 2 | Contract in Sprint 2 · A |
| FR-12 | F-05 | 1 | AC-05.x / TEST-05.x · U, A, E |
| FR-13 | F-06 | 1 | AC-06.x / TEST-06.x · U, A, E |
| FR-14 | F-10 | 2 | Contract in Sprint 2 · U, A, E |
| FR-15 | F-11 | 2 | Contract in Sprint 2 · U, A |
| FR-16 | F-13 | 2 | Contract in Sprint 2 · U, A, E |
| FR-17 | F-07 | 1 | AC-07.x / TEST-07.x · A, E |
| FR-18 | F-14 | 3 | Contract in Sprint 3 · A |
| FR-19 | F-15 | 3 | Contract in Sprint 3 · A |
| FR-20 | F-15 | 3 | Contract in Sprint 3 · A, E |
| FR-21 | F-10 | 2 | Contract in Sprint 2 · A |
| FR-22 | F-08 | 1 | AC-08.x / TEST-08.x · U, A, E |
| FR-23 | F-16 | 3 | Contract in Sprint 3 · A |
| FR-24 | F-16 | 3 | Contract in Sprint 3 · A |
| FR-25 | F-07 | 1 | AC-07.3 / TEST-07.3 · A |
| BR-01 | F-01 (all routes), F-03, F-07, F-08 | 1 | AC-01.x, 03.x, 07.x, 08.x · A (cross-user access); AC-01.9 verified by TEST-07.4 (f-01 v1.1) |
| BR-02 | F-01 (all routes), F-02, F-03, F-07, F-08 | 1 | AC-01.x, 02.x, 03.x, 07.x, 08.x · A (admin denied financial data) |
| BR-03 | F-02 | 1 | AC-02.x · A |
| BR-04 | F-04, F-05, F-06 | 1 | AC-04.x, 05.x, 06.x · U, A |
| BR-05 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-06 | F-05, F-06 (subset); F-10, F-11 (rest) | 1, 2 | AC-05.x, 06.x · U, A; extended in Sprint 2 |
| BR-07 | F-03, F-05, F-06 | 1 | AC-03.x, 05.x, 06.x · U, A |
| BR-08 | F-08 | 1 | AC-08.x · U, A |
| BR-09 | F-05, F-08 | 1 | AC-05.x, 08.x · A, E |
| BR-10 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-11 | F-04, F-12 | 1, 2 | AC-04.x · A; management in Sprint 2 |
| BR-12 | F-13 | 2 | Contract in Sprint 2 · A |
| BR-13 | F-02 | 1 | AC-02.x · A |
| BR-14 | F-09 | 2 | Contract in Sprint 2 · A |
| BR-15 | F-15 | 3 | Contract in Sprint 3 · A |
| BR-16 | F-05, F-06 | 1 | AC-05.10, AC-06.4 / TEST-05.10, TEST-06.4 · A |
| NFR-01 | F-01 | 1 | AC-01.x · A |
| NFR-02 | F-01 (all routes) | 1, re-run in 2, 3 | AC-01.x · A route-list test |
| NFR-03 | F-03 | 1, re-run in 2 | AC-03.x · U, A invariant test |
| NFR-04 | F-01 | 1 | AC-01.x · A |
| NFR-05 | F-19 (local run verified in Sprint 1; Docker in Lab 5) | 1 local, Lab 5 Docker | README run-through; Lab 5 evidence |
| NFR-06 | F-19 (local restart check in Sprint 1; redeploy in Lab 5) | 1 local, Lab 5 | Restart check; Lab 5 evidence |
| NFR-07 | F-18 | 3 | Timing script |
| NFR-08 | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08 (Sprint 1 screens), F-18 (all) | 1 (built screens), 3 | E checks plus checklist |
| NFR-09 | F-19 | 1 local, Lab 5 CI | Coverage report; CI runs |
| NFR-10 | F-01 | 1 | AC-01.6, AC-01.12, AC-01.13 / TEST-01.6, TEST-01.12, TEST-01.13 · A |

## 2. Coverage and change status

Baseline v1.0 contains 25 FR, 16 BR and 10 NFR. Every one is mapped to a feature or system responsibility and a sprint. Sprint 1 carries 13 FR (FR-01–06, 08, 10, 12, 13, 17, 22, 25), Sprint 2 carries 6 (FR-09, 11, 14, 15, 16, 21) and Sprint 3 carries 6 (FR-07, 18, 19, 20, 23, 24). **Uncovered requirements: none.**

| Version | Date | Change | Approved |
|---|---|---|---|
| v1.0 | 7 Nov 2026 | Initial baseline | Team |
| v1.1 | 10 Nov 2026 | F-01 contract v1.1: AC-01.9 verification moved to F-07 (TEST-07.4); no requirement added or dropped | Pending teammate review (PR #10) |

All assumptions and decisions (A-01–A-04, D-01–D-07) are fully resolved and agreed by the team; zero open items remain.
