from pathlib import Path

import pytest

import informe_site as hook

BASE = "https://github.com/ISI-ProyectoFinal-2026/Grupo1"
SITE = {"index.md", "informe/README.md", "informe/1-2-4-modelo-de-datos.md", "adr/README.md", "adr/0001-x.md"}


# repo de prueba
@pytest.fixture
def repo(tmp_path: Path) -> Path:
    (tmp_path / "backend/prisma/migrations").mkdir(parents=True)
    (tmp_path / "backend/prisma/schema.prisma").write_text("model X {}")
    (tmp_path / ".github/workflows").mkdir(parents=True)
    (tmp_path / ".github/workflows/ci.yml").write_text("name: CI")
    (tmp_path / "docs/informe").mkdir(parents=True)
    (tmp_path / "docs/equipo").mkdir(parents=True)
    (tmp_path / "docs/equipo/ROLES.md").write_text("# Roles")
    return tmp_path


def rewrite(md: str, repo: Path, page: str = "informe/1-2-4-modelo-de-datos.md", **kw) -> str:
    return hook.rewrite_links(
        md, page_src_uri=page, site_uris=SITE, repo_root=repo, docs_rel="docs", ref="abc123", **kw
    )


def test_file_link_becomes_blob_url_with_line_anchor(repo):
    md = "Ver [`schema.prisma`](../../backend/prisma/schema.prisma#L12)."
    assert rewrite(md, repo) == f"Ver [`schema.prisma`]({BASE}/blob/abc123/backend/prisma/schema.prisma#L12)."


def test_dotfile_path_becomes_blob_url(repo):
    md = "[ci](../../.github/workflows/ci.yml)"
    assert rewrite(md, repo) == f"[ci]({BASE}/blob/abc123/.github/workflows/ci.yml)"


def test_directory_link_becomes_tree_url(repo):
    md = "[migraciones](../../backend/prisma/migrations) y [otra](../../backend/prisma/migrations/)"
    url = f"{BASE}/tree/abc123/backend/prisma/migrations"
    assert rewrite(md, repo) == f"[migraciones]({url}) y [otra]({url})"


def test_docs_file_outside_site_becomes_blob_url(repo):
    md = "[roles](../equipo/ROLES.md)"
    assert rewrite(md, repo) == f"[roles]({BASE}/blob/abc123/docs/equipo/ROLES.md)"


def test_encoded_path_with_parentheses(repo):
    (repo / "docs/Template Final (1).docx").write_text("x")
    md = "[plantilla](../Template%20Final%20(1).docx)"
    assert rewrite(md, repo) == f"[plantilla]({BASE}/blob/abc123/docs/Template%20Final%20%281%29.docx)"


@pytest.mark.parametrize(
    "md",
    [
        "[ADR](../adr/0001-x.md)",
        "[ADR](../adr/0001-x.md#motivo)",
        "[registro](README.md)",
        "[indice](../adr/README.md)",
        "[carpeta adr](../adr/)",
        "[inicio](../index.md)",
    ],
)
def test_internal_site_links_untouched(repo, md):
    assert rewrite(md, repo) == md


@pytest.mark.parametrize(
    "md",
    [
        "[issue](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/31)",
        "[web](http://example.com/a)",
        "[mail](mailto:equipo@example.com)",
        "[seccion](#modelo-relacional)",
        "[raiz](/absoluto)",
    ],
)
def test_external_mailto_and_anchor_untouched(repo, md):
    assert rewrite(md, repo) == md


def test_code_spans_and_fences_untouched(repo):
    md = (
        "Texto `[x](../../backend/prisma/schema.prisma)` y ``[y](../../backend)``.\n"
        "```md\n[z](../../backend/prisma/schema.prisma)\n```\n"
    )
    assert rewrite(md, repo) == md


def test_link_text_kept(repo):
    md = "[../../backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)"
    assert rewrite(md, repo) == f"[../../backend/prisma/schema.prisma]({BASE}/blob/abc123/backend/prisma/schema.prisma)"


def test_reference_definition_rewritten(repo):
    md = "[schema][s]\n\n[s]: ../../backend/prisma/schema.prisma\n"
    assert rewrite(md, repo) == f"[schema][s]\n\n[s]: {BASE}/blob/abc123/backend/prisma/schema.prisma\n"


def test_link_title_kept(repo):
    md = '[ci](../../.github/workflows/ci.yml "CI")'
    assert rewrite(md, repo) == f'[ci]({BASE}/blob/abc123/.github/workflows/ci.yml "CI")'


def test_alias_maps_repo_file_to_site_file(repo):
    md = "![roc](../../backend-ia/benchmarks/results/matching/roc.png)"
    out = rewrite(md, repo, aliases={"backend-ia/benchmarks/results/matching/roc.png": "benchmark/matching/roc.png"})
    assert out == "![roc](../benchmark/matching/roc.png)"


def test_github_ref_uses_github_sha(monkeypatch):
    monkeypatch.setenv("GITHUB_SHA", "deadbeef")
    assert hook.github_ref() == "deadbeef"


def test_github_ref_defaults_to_main(monkeypatch):
    monkeypatch.delenv("GITHUB_SHA", raising=False)
    assert hook.github_ref() == "main"


def test_benchmark_files_absent_is_noop(repo):
    assert hook.benchmark_files(repo) == []


def test_benchmark_files_present_excludes_raw_and_other_types(repo):
    results = repo / "backend-ia/benchmarks/results"
    (results / "matching").mkdir(parents=True)
    (results / "raw").mkdir()
    for name in ["matching/roc.png", "matching/metrics.csv", "summary.json", "raw/dump.json", "notes.txt"]:
        (results / name).write_text("x")
    found = {(src, Path(abs_path).relative_to(repo).as_posix()) for src, abs_path in hook.benchmark_files(repo)}
    assert found == {
        ("benchmark/matching/roc.png", "backend-ia/benchmarks/results/matching/roc.png"),
        ("benchmark/matching/metrics.csv", "backend-ia/benchmarks/results/matching/metrics.csv"),
        ("benchmark/summary.json", "backend-ia/benchmarks/results/summary.json"),
    }


# corre on_files a traves de MkDocs, como en un build real
def run_on_files(repo: Path):
    from mkdocs.config import load_config
    from mkdocs.structure.files import Files

    hook_path = Path(hook.__file__).as_posix()
    (repo / "docs/index.md").write_text("# Inicio")
    (repo / "mkdocs.yml").write_text(f"site_name: t\ndocs_dir: docs\nhooks:\n  - '{hook_path}'\n")
    config = load_config(str(repo / "mkdocs.yml"))
    files = config.plugins.on_files(Files([]), config=config)
    return files, next(iter(config.hooks.values()))


def test_on_files_adds_benchmark_files_to_site(repo):
    results = repo / "backend-ia/benchmarks/results"
    results.mkdir(parents=True)
    (results / "roc.png").write_bytes(b"png")

    files, module = run_on_files(repo)

    added = files.get_file_from_path("benchmark/roc.png")
    assert added is not None and added.inclusion.is_included()
    assert module.ALIASES == {"backend-ia/benchmarks/results/roc.png": "benchmark/roc.png"}


def test_on_files_without_benchmark_folder_is_noop(repo):
    files, module = run_on_files(repo)

    assert len(files) == 0
    assert module.ALIASES == {}
