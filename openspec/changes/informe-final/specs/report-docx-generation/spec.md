# Delta for report-docx-generation (Phase B, optional)

Not required for 2026-11-04. Starts only after Phase A is frozen.

## ADDED Requirements

### Requirement: Build method decided by a spike

A time-boxed spike MUST compare pandoc with `--reference-doc` against a python-docx fallback, and its outcome MUST be recorded before the build is implemented. The chosen method MUST be justified by whether the template styles survive.

#### Scenario: Spike outcome
- GIVEN the spike has run
- WHEN its record is read
- THEN it states the chosen method, the styles tested and the reason

### Requirement: Template styles preserved

The generated `.docx` SHOULD apply the template's styles (TituloN for heading level N, as in `docs/Template Presentacion Final (1).docx`), so that headings in `docs/informe/` map to the matching style.

#### Scenario: Heading mapping
- GIVEN a level-3 heading in Markdown
- WHEN the `.docx` is generated
- THEN that heading uses style Titulo3

### Requirement: Single command, no source changes

Generation MUST run from one documented command and MUST NOT modify files in `docs/informe/`. Sections marked `No disponible` or Phase B markers MUST be carried over visibly, not dropped.

#### Scenario: Placeholder carried over
- GIVEN a section reads `No disponible`
- WHEN the `.docx` is generated
- THEN the text appears in the document

### Requirement: Phase A independence

No Phase A deliverable MUST depend on the generator.

#### Scenario: Generator absent
- GIVEN no generator exists
- WHEN Phase A acceptance is checked
- THEN it still passes
