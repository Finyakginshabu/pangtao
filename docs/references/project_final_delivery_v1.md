## CPE 334 Final Project Delivery

## Complete integrated and verified product release Due 13 December 2026 | 100 points | Semester 1/2026

## 1 Purpose and assessment

Final Delivery proves that your team can finish, integrate, verify and release the complete product. Deliver the agreed product scope across all three sprints, demonstrate its behavior on the final deployed version, and provide a clear engineering handoff supported by tests and independent verification.

Use the same two students, assigned theme and repository. The product scope is established by the Group Work Specifications document and recorded approved changes. This assessment is worth 100 points and 10% of the course grade, completing the 250 project points and 25% course weight. Labs 5-7 retain their separate 100-point assessments.

| Part                                               |   Points | What you must demonstrate                                      |
|----------------------------------------------------|----------|----------------------------------------------------------------|
| A Final working product                            |       35 | Complete major workflows and correct integrated behavior       |
| B Engineering process and team evidence            |       15 | Credible history and meaningful participation by both students |
| C Final requirements and verification traceability |       20 | Entire baseline mapped to final verification results           |
| D Final QA and Product Definition of Done          |       20 | Final tests, UAT, defect status and reproducible deployment    |
| E Demonstration video                              |       10 | Actual running product explained by both students              |
| Total                                              |      100 |                                                                |

## 2 Required final outcome

- Complete the required baseline features across Sprints 1-3, including approved changes. Provide an explicit status for every requirement and feature.
- Release the accepted product on main and deploy the same version on GCP with durable data and current setup instructions.
- Verify major workflows, business rules, errors, persistence, authentication and backend permissions on the integrated product.
- Finish automated regression verification and relevant independent UAT/re-tests; resolve accepted critical defects and disclose any remaining blockers.
- Submit one self-contained final PDF and a demonstration video of at most 10 minutes with meaningful participation by both students.

This is a complete-product assessment. Final results must come from the final version. Earlier lab or sprint evidence may explain history, but an old passing test run alone does not prove that the final release still works.

## 3 Required engineering work 3.1 Part A Final working product 35 points

## Complete workflows and domain rules

Provide a complete feature/completion table, then demonstrate major journeys that span the product's three-sprint scope. Show the relevant transitions, calculations and effects on related records. Verify important negative/boundary cases and invalid transitions. The product must fulfil its stakeholder brief; basic CRUD pages without the specified domain behavior are insufficient.

## Persistence access and error handling

Demonstrate retrieval of persisted results, useful validation/error feedback and recovery from expected failures. Use real backend authentication, role permissions and record ownership for every protected workflow. Check unauthenticated requests, forbidden roles and cross-user records where applicable, including endpoints added after Sprint 1. A role selector or hidden UI control does not establish access protection.

## 3.2 Part B Engineering process and team evidence

## 15 points

Maintain the engineering chain over all three sprints: requirements/contracts before implementation, Issues, bounded feature/fix branches, meaningful tests, teammate reviews, staging integration, release PRs and recorded main releases. Preserve justified contract changes and meaningful TDD evidence for rule, defect or change work. Provide a concise release/history table and two selected Issue/PR chains from different sprints.

## 3.3 Part C Final requirements and verification traceability

## 20 points

Include the complete final SRS, feature inventory, System-Level SDS and feature contracts with AC/STS. They must describe the released behavior, including approved scope changes and final data/access/deployment design. Put detailed documents in appendices within the same PDF and refer to their pages.

Account for every baseline FR/BR and important NFR through feature/responsibility, sprint, AC or verification target, planned test, actual file/test or measurement, execution result and final version. Compare NFR results with the specified measurable targets. Where appropriate, include an actual access check rather than inventing a performance measurement that your SRS never required.

| Requirement and feature   | AC or target                          | Actual verification                      | Final result and version              |
|---------------------------|---------------------------------------|------------------------------------------|---------------------------------------|
| Use stable IDs            | Observable outcome or measured target | Test ID; file/name or measurement method | PASS/FAIL/SKIPPED/I NCOMPLETE; commit |

Do not silently delete requirements, conceal coverage gaps or label a planned check as passing. Record approved changes and all failed, skipped or incomplete work explicitly. Honest disclosure helps assess readiness but does not establish missing functionality.

## 3.4 Part D Final QA and Product Definition of Done 20 points

## Final tests and independent acceptance

Run the final build and meaningful automated/regression suite against the final commit. Include execution counts/results, relevant test assertions, integration/system checks and acceptance results. Required tests must remain enabled and their assertions meaningful. Reuse the independent UAT cases from Lab 6 where relevant, then re-test affected journeys after fixes and changes; record tester, expected/actual result and version. A developer's self-check does not replace independent acceptance.

## Defects deployment and handoff

Provide final defect status, severity, affected behavior, fix/re-test version and any blockers. Deploy the assessed final release through the delivery pipeline and retain post-deployment checks. Include reproducible Docker/setup, configuration examples, migration/seed and build/test/deployment procedures. Confirm the application can retrieve durable data after the expected restart/redeployment operation.

## Definition of Done and remaining debt

Review the Product Definition of Done against evidence: required behavior, tests, review/integration, independent acceptance, deployment, documents and configuration. List known defects, limitations and technical debt with impact and a sensible next action. Technical debt is a design or implementation compromise that makes future work harder; it is not a substitute label for unfinished required features. Identify unresolved blockers plainly.

## 3.5 Part E Demonstration video

## 10 points | Maximum 4 minutes

Record a demo of the actual running final product. Both students must appear to be presenting the work together, not working separately on a video conference call. Identify the deployed version and show the major workflows, an important business rule, and a rejected/failure case. Slides may introduce context but cannot replace program execution.

| Suggested segment     | Content                                              |
|-----------------------|------------------------------------------------------|
| Introduction          | Team, theme and final version                        |
| Product demonstration | Major journeys, persisted result, and rule rejection |
| Closing               | Completion and any known limitations                 |

The assessment rewards clear evidence rather than cinematic editing, accents or presentation polish. Provide video access and timestamps in PDF Part E; a separate demo video is required only at this final checkpoint.

## 4 What to submit

Submit one self-contained PDF per team through LEB2 by 13 December 2026 at 23:59. Include the complete documents required below and selected execution evidence. Maintain source documents, code and tests in the repository as well. Graders should be able to read the assessed engineering work without opening separate specification files.

At the beginning, identify both students and IDs, the theme/context, one repository URL, the immutable submitted tag/commit, the deployed application URL and its version. Include a contents/navigation table mapping each rubric part to PDF pages and IDs. Use internal page references for evidence; keep external links for the repository, deployment and final video where required.

## 4.1 PDF contents

| Part                                                                                                                                                               | Include directly in the PDF                                          |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| A table and selected final program demonstrations, including and access restrictions.                                                                              | Complete product completion persistence, a rule rejection            |
| Selected workflow/history evidence across all three sprints, two reviewed Issue/PR chains, both students' contributions and brief AI-use declaration.              | B                                                                    |
| C inventory, System-Level SDS, all feature contracts/AC/STS, and final results matrix. Use appendices and internal page references to avoid                        | Complete final SRS, feature requirement-to-verification duplication. |
| Final build/test/CI output, selected test excerpts, UAT and re-test records, defect/debt register, DoD review, deployment evidence and reproducible setup summary. | D                                                                    |
| E assessed release and a short timestamp index. The actual video is YouTube link. Make sure to allow viewing for those with a link.                                | Video title, access reference, submitted separately as a             |

Appendices are part of the same PDF. There is no fixed PDF page limit. Keep diagrams, tables, logs and screenshots readable at normal viewing size; a document link does not replace the required document. Include a short contribution table, AI-use declaration and known limitations once, then refer to their pages.

## 4.2 Selected execution and process evidence

## Program demonstrations

Use captioned screenshots or screen dumps of the selected running workflows. Give feature/AC IDs, role, starting conditions, brief steps, expected and actual results, and tested version. Show retrieval of saved data, a meaningful rule rejection, and backend/API evidence for a forbidden role or ownership operation. A UI screenshot alone does not establish persistence or backend protection.

## Tests and history

Include actual commands, commit IDs and readable build/test/CI output with passing, failing and skipped counts. Embed two short actual automated test excerpts with the relevant setup/assertions and execution results: one domain or cross-feature rule and one access restriction. Show meaningful TDD red/green evidence and the associated versions. Include two selected Issue/PR chains with branch, author/reviewer, substantive review, staging integration and release history; preserve IDs and dates.

For the final assessment, choose the two workflow/history samples from different sprints. Include actual final NFR measurements or access checks against their defined targets, and the latest relevant independent UAT/re-test records with tester and release IDs.

## Reproduction and safe access

Include a concise setup summary: dependencies, environment-variable names/examples, Docker/build/run/test commands, database migration/seed and deployment procedure. Keep the detailed README current. Use synthetic data and provide safe test accounts through the private course handoff or local seed procedure. Do not include real passwords, tokens or production secrets in the PDF or Git.

Keep the assessed deployment and repository available through grading; the instructor will announce the end of the access period. Graders may make targeted checks when embedded evidence is unclear or inconsistent. Later commits must not silently replace the submitted version.

## 5 Submission checklist

- The PDF contains every required part and a page-based navigation table; the rubric totals 100 points.
- The full required engineering documents and selected evidence appear inside the PDF.
- Feature and requirement statuses disclose incomplete, failed and skipped work.
- Program, test, CI and deployment evidence identify the assessed versions.
- The submitted release is on main, accessible, deployed and reproducible.
- Relevant UAT/change findings and known defects or debt are accounted for.
- The YouTube video link that has view permissions for those with a link.