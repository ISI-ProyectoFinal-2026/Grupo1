from pathlib import Path

import pytest

import informe_docx as gen

SITE_PAGES = {"informe/1-2-1-objetivos-y-alcances.md", "adr/0019-comercio-perfil-no-rol.md"}

NAV = """\
site_name: x
nav:
  - Inicio: index.md
  - 1 Desarrollo:
      - informe/1-1-1-competidores.md
      # comentario: - informe/1-2-3-pantallas.md
      - informe/1-2-4-modelo-de-datos.md
  - Decisiones:
      - adr/README.md
      - adr/0001-monorepo.md
  - Registro: informe/README.md
"""


# repo de prueba
@pytest.fixture
def repo(tmp_path: Path) -> Path:
    (tmp_path / "docs/informe/img").mkdir(parents=True)
    (tmp_path / "docs/informe/img/foto.png").write_bytes(b"png")
    (tmp_path / "docs/adr").mkdir(parents=True)
    (tmp_path / "mkdocs.yml").write_text(NAV, encoding="utf-8")
    return tmp_path


def test_nav_files_keeps_order_and_skips_comments(repo):
    assert gen.nav_files(repo) == [
        "informe/1-1-1-competidores.md",
        "informe/1-2-4-modelo-de-datos.md",
        "adr/README.md",
        "adr/0001-monorepo.md",
        "informe/README.md",
    ]


def test_strip_front_matter_removes_metadata_block():
    md = '---\nseccion: "1.2.4"\n---\n\n# 1.2.4 Modelo de Datos\n'
    assert gen.strip_front_matter(md) == "\n# 1.2.4 Modelo de Datos\n"


def test_root_number_is_first_numbered_heading():
    assert gen.root_number("intro\n\n# 1.2.4 Modelo de Datos\n## 1.2.4.1 X") == "1.2.4"


def test_root_number_none_without_numbered_heading():
    assert gen.root_number("# PATITAS\n") is None


def test_shift_headings_moves_all_levels_by_first_heading_offset():
    md = "# 1.2.4 Modelo\n\n## Entidades\n\n### Detalle"
    assert gen.shift_headings(md, 3) == "### 1.2.4 Modelo\n\n#### Entidades\n\n##### Detalle"


def test_shift_headings_ignores_hash_lines_inside_code_fences():
    md = "# 1.3 X\n\n```bash\n# comentario\n```"
    assert gen.shift_headings(md, 2) == "## 1.3 X\n\n```bash\n# comentario\n```"


def test_splice_replaces_section_until_next_heading_of_same_level():
    md = "# 1.2.2 A\n\n## 1.2.2.2 Historias\n\nVer otro archivo.\n\n## 1.2.2.3 Tareas\n\nT"
    out = gen.splice(md, "1.2.2.2", "SUB")
    assert "Ver otro archivo." not in out
    assert out.index("SUB") < out.index("## 1.2.2.3 Tareas")


def test_splice_leaves_heading_in_its_own_paragraph():
    md = "# 1.2.2 A\n\n## 1.2.2.2 Historias\n\nx\n\n## 1.2.2.3 Tareas"
    out = gen.splice(md, "1.2.2.2", "- ultima viñeta")
    assert "- ultima viñeta\n\n## 1.2.2.3 Tareas" in out


def test_fix_links_page_of_site_goes_to_site_url(repo):
    src = repo / "docs/informe/1-2-2-modelo-funcional.md"
    md = "[1.2.1](1-2-1-objetivos-y-alcances.md#objetivos)"
    assert gen.fix_links(md, src, repo, SITE_PAGES) == (
        "[1.2.1](https://isi-proyectofinal-2026.github.io/Grupo1/informe/1-2-1-objetivos-y-alcances/#objetivos)"
    )


def test_fix_links_other_repo_file_goes_to_github_blob(repo):
    src = repo / "docs/informe/1-2-2-modelo-funcional.md"
    md = "[PDD](../pdd/PDD%20v1.0.docx)"
    assert gen.fix_links(md, src, repo, SITE_PAGES) == (
        "[PDD](https://github.com/ISI-ProyectoFinal-2026/Grupo1/blob/main/docs/pdd/PDD%20v1.0.docx)"
    )


def test_fix_links_local_image_becomes_absolute_path(repo):
    src = repo / "docs/informe/1-1-1-competidores.md"
    out = gen.fix_links("![Foto](img/foto.png)", src, repo, SITE_PAGES)
    assert out == f"![Foto]({(repo / 'docs/informe/img/foto.png').as_posix()})"


def test_fix_links_keeps_external_and_anchor_links(repo):
    src = repo / "docs/informe/1-1-1-competidores.md"
    md = "[a](https://example.com) [b](#seccion)"
    assert gen.fix_links(md, src, repo, SITE_PAGES) == md


def test_report_files_excludes_registry_and_template(repo):
    files = gen.nav_files(repo) + ["adr/0000-plantilla.md"]
    informe, adrs = gen.report_files(files)
    assert informe == ["informe/1-1-1-competidores.md", "informe/1-2-4-modelo-de-datos.md"]
    assert adrs == ["adr/0001-monorepo.md"]


def test_default_output_name_has_date():
    assert gen.output_name("2026-10-28") == "Patitas-Informe-Final-2026-10-28.docx"
