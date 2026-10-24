# Delta for docs-code-consistency

Targets: `docs/ARQUITECTURA.md`, `README.md`, `docs/githubactions/README.md`, and any other technical doc found stale. Text changes only; no runtime, schema or production code changes.

## ADDED Requirements

### Requirement: Listed facts match code and CI

After the change, these docs MUST state: React 19, PostgreSQL 16, Node 24 in CI, no Redis in the stack, no Dependabot, docker-compose with Postgres only, and four CI jobs (backend, frontend, e2e-ui, backend-ia).

#### Scenario: Stale terms gone
- GIVEN the target docs after the update
- WHEN they are searched for "React 18", "PostgreSQL 15", "Node 20", "Dependabot" (as active) and a Redis queue (as present)
- THEN none are found as current facts

#### Scenario: Compose description
- GIVEN `docker-compose.yml` defines only Postgres
- WHEN `README.md` is read
- THEN it describes Postgres only, with no backend, IA or pgAdmin service

### Requirement: Every changed claim is verified

Each updated claim MUST be checked against a code or CI file before it is written. A claim that cannot be verified MUST be removed or marked `No verificado`. The unverified statement that `openai` pretrained weights do not give 512 dimensions MUST NOT be repeated.

#### Scenario: Unverifiable claim
- GIVEN a doc claim with no matching code or CI evidence
- WHEN the update is reviewed
- THEN the claim is removed or marked `No verificado`

### Requirement: Planned features are not described as present

Features that are planned or deferred (for example the Redis queue, issue #177) MUST be described as not implemented, with the reference to where the decision stands.

#### Scenario: Redis
- GIVEN no Redis in compose or code
- WHEN `docs/ARQUITECTURA.md` is read
- THEN Redis appears only as deferred, citing #177

### Requirement: Other stale docs

Any other technical doc found to contradict code or CI while doing this work MUST be corrected in the same change, or listed with a reason when it is left.

#### Scenario: New drift found
- GIVEN a doc outside the three targets contradicts the code
- WHEN it is found
- THEN it is updated, or listed as a deferred item with the reason

### Requirement: Accepted ADRs are not used as drift fixes

Drift MUST NOT be corrected by editing an accepted ADR.

#### Scenario: ADR disagrees with code
- GIVEN an accepted ADR no longer matches the code
- WHEN drift is handled
- THEN a superseding ADR is proposed and the accepted one stays unchanged
