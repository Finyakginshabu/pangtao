## CPE 334 Project Deliverable 2

## Sprint 2 completion and Sprint 3 progress

## Due 29 November 2026 | 70 points | Semester 1/2026

## 1 Purpose and assessment

This deliverable proves that your team continued the engineering discipline through Sprint 2 and into Sprint 3. Complete the core expansion, demonstrate genuine Sprint 3 progress, and submit a deployed integrated release candidate with a controlled plan to finish the product.

Use the same two students, repository and assigned theme as Deliverable 1 and Labs 5-7. Follow the product scope in the Group Work Specifications document and retain approved scope changes. This assessment is worth 70 points and 7% of the course grade, within the project total of 250 points and 25%.

| Part                                         |   Points | What you must demonstrate                                   |
|----------------------------------------------|----------|-------------------------------------------------------------|
| A Sprint 1 continuity and change status      |        5 | Original slice still works; findings and changes tracked    |
| B Sprint 2 contracts and working increment   |       25 | Completed new workflows with contracts and verification     |
| C Sprint 3 contracts and working progress    |       15 | Specified remaining features and genuine tested progress    |
| D Updated requirements and test traceability |       10 | Current baseline mapped to actual tests and honest status   |
| E Integrated release candidate               |       15 | Coherent deployed candidate with regression and finish plan |
| Total                                        |       70 |                                                             |

## 2 Required checkpoint outcome

- All planned Sprint 2 features are complete, reviewed, integrated and verified against their contracts.
- Sprint 3 contracts cover the remaining baseline features. At least one meaningful Sprint 3 workflow or rule is implemented and tested in the candidate; empty screens or unexecuted tests are insufficient.
- The candidate on main integrates Sprint 1, Sprint 2 and implemented Sprint 3 work, and is deployed on GCP through the delivery process established in Lab 5.
- Earlier behavior, authentication, backend permissions and record ownership still work after new features and lab changes.
- The remaining-work list identifies exact features/AC, defects, owners, dependencies, next actions and planned completion by 13 December.

## 3 Required engineering work 3.1 Part A Sprint 1 continuity and change status

## 5 points

Identify the accepted Sprint 1 tag/commit and demonstrate that its original critical domain journey still works on the candidate. Provide a change/defect register for relevant deployment, UAT and maintenance findings: ID, source, affected requirement/feature, accepted decision, resolved or remaining status, fix/change release and re-test outcome. Record approved baseline revisions and their rationale.

## 3.2 Part B Sprint 2 contracts and working increment 25 points

## Contracts before implementation

Include the complete contract for every Sprint 2 feature: linked FR/BR/NFR; feature SDS and workflow; applicable UI/API/data definitions; validation, errors, boundaries and permissions; numbered acceptance criteria; STS with test IDs, levels, inputs and expected outcomes; and Definition of Done. State when a layer needs no change. Preserve versioned contract/test-design history before implementation, justified revisions and meaningful TDD evidence.

## Working core expansion

Implement the major remaining workflows allocated to Sprint 2. Demonstrate meaningful domain transactions or transitions with real database persistence. Include a completion table for every Sprint 2 feature showing AC, implementation, executed verification, result and accepted release. Required features cannot be moved to Sprint 3 simply to mark the sprint complete without approved scope revision.

## Verification and reviewed release

Map AC to actual tests and results. Cover important business rules, negative/boundary behavior, persistence and new access paths. Use unit, API/database integration and selected UI/end-to-end tests as appropriate. Trace completed work through Issues, feature branches, teammate-reviewed PRs, sprint integration checks and the accepted Sprint 2 release on main. Keep the original Sprint 2 release identifiable even if the current candidate includes later changes.

## 3.3 Part C Sprint 3 contracts and working progress

## 15 points

Define contracts, AC and STS for all remaining Sprint 3 features with enough UI/API/data detail to control implementation. Implement and test at least one meaningful domain workflow or rule. Distinguish planned, in progress, implemented, tested and accepted work. Record revisions without rewriting the history.

| Feature or defect   | Current status                      | Remaining action                      | Owner and target                           |
|---------------------|-------------------------------------|---------------------------------------|--------------------------------------------|
| Use your actual ID  | State achieved AC and tested commit | State missing AC, verification or fix | Student name; date before final submission |

Plan around the final examination period of 1-11 December. By 29 November, the product should be substantially complete. Use the remaining period for bounded completion, integration, defects and final verification; do not reserve the main product workflows for the last two days.

## 3.4 Part D Updated requirements and test traceability

## 10 points

Update the complete SRS, feature inventory and System-Level SDS to match the current product. Provide one complete traceability matrix for all baseline FR/BR and important NFR, including approved changes. Record requirement → feature/responsibility → sprint → AC or NFR verification → planned test → actual file/test or measurement → result and version. A cross-cutting NFR may map to several features or a system responsibility.

Show uncovered requirements and planned final verification explicitly. For each AC, identify whether it is implemented and whether its verification has run and passed. Do not use "done" for an unexecuted test or use an unrelated green test as coverage. Later Sprint 3 checks may remain planned at this checkpoint.

## 3.5 Part E Integrated release candidate

## 15 points

## Integrated behavior and regression

Release a coherent candidate on main. Run the build, automated suite, integration/system checks and selected acceptance journeys on its commit. Include cross-feature checks where new work affects older behavior, shared data, roles or calculations. Disclose failed/skipped tests and unresolved defects; do not weaken tests to conceal incomplete behavior.

## Deployment and completion readiness

Deploy the candidate on GCP and match the deployed version to the tag/commit and CI run. Retain post-deployment checks of a critical journey and persistence. Keep Docker configuration, environment variables, migrations and setup current. Provide a brief readiness review and dated plan to complete the remaining features, tests, UAT re-tests, final video and release by 13 December.

## 4 What to submit

Submit one self-contained PDF per team through LEB2 by 29 November 2026 at 23:59. Include the complete documents required below and selected execution evidence. Maintain source documents, code and tests in the repository as well. Graders should be able to read the assessed engineering work without opening separate specification files.

At the beginning, identify both students and IDs, the theme/context, one repository URL, the immutable submitted tag/commit, the deployed application URL and its version. Include a contents/navigation table mapping each rubric part to PDF pages and IDs. Use internal page references for evidence; keep external links for the repository, and deployment where required.

## 4.1 PDF contents

| Part Include directly in the PDF                                                                                                                    |
|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| A Sprint 1 release/continuity evidence, baseline change log and the current status of relevant Lab 5-7 findings.                                    |
| B All Sprint 2 contracts/AC/STS/DoD, complete Sprint 2 feature completion table and selected program, test and reviewed integration evidence.       |
| C All Sprint 3 contracts/AC/STS, implemented progress with tests, and the explicit remaining-work plan.                                             |
| D Complete current SRS, feature requirements-to-feature-to-sprint-to-verification results matrix. Include baseline changes and coverage gaps.       |
| E Integrated candidate demonstrations, build/regression/CI/deployment output, release readiness, setup summary and completion plan for 13 December. |

Appendices are part of the same PDF. There is no fixed PDF page limit. Keep diagrams, tables, logs and screenshots readable at normal viewing size; a document link does not replace the required document.

## 4.2 Selected execution and process evidence

## Program demonstrations

Use captioned screenshots or screen dumps of the selected running workflows. Give feature/AC IDs, role, starting conditions, brief steps, expected and actual results, and tested version. Show retrieval of saved data, a meaningful rule rejection, and backend/API evidence for a forbidden role or ownership operation. A UI screenshot alone does not establish persistence or backend protection.

## Tests and history

Include actual commands, commit IDs and readable build/test/CI output with passing, failing and skipped counts. Embed two short actual automated test excerpts with the relevant setup/assertions and execution results: one domain or cross-feature rule and one access restriction. Show meaningful TDD red/green evidence and the associated versions. Include two selected Issue/PR chains with branch, author/reviewer,

substantive review, staging integration and release history; preserve IDs and dates.

Choose two meaningful Sprint 2 features and at least one implemented Sprint 3 workflow/rule for the program evidence. Include a short continuity demonstration of the original Sprint 1 journey. The selected evidence must support the full completion/status tables, not replace them.

## Reproduction and safe access

Include a concise setup summary: dependencies, environment-variable names/examples, Docker/build/run/test commands, database migration/seed and deployment procedure. Keep the detailed README current. Use synthetic data and provide safe test accounts through the private course handoff or

local seed procedure. Do not include real passwords, tokens or production secrets in the PDF or Git. of the access period. Graders may make targeted checks when embedded evidence is unclear or inconsistent.

Keep the assessed deployment and repository available through grading; the instructor will announce the end Later commits must not silently replace the submitted version.

## 5 Submission checklist

- The PDF contains every required part and a page-based navigation table; the rubric totals 70 points.
- The full required engineering documents and selected evidence appear inside the PDF.
- Feature and requirement statuses disclose incomplete, failed and skipped work.
- Program, test, CI and deployment evidence identify the assessed versions.
- The submitted release is on main, accessible, deployed and reproducible.
- Relevant UAT/change findings and known defects or debt are accounted for.
- All Sprint 2 features are complete; Sprint 3 working progress and bounded remaining work are demonstrated.