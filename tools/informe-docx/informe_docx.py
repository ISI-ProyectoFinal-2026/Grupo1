# genera el informe final en .docx con el esqueleto y los estilos del template
import argparse
import datetime
import hashlib
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import quote, unquote

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = "docs/Template Presentacion Final (1).docx"
SITE_URL = "https://isi-proyectofinal-2026.github.io/Grupo1/"
BLOB_URL = "https://github.com/ISI-ProyectoFinal-2026/Grupo1/blob/main/"
EXCLUDED = {"informe/README.md", "adr/README.md", "adr/0000-plantilla.md"}
DECISIONS = "2.2.2.4"

NUM = re.compile(r"^(\d+(?:\.\d+)*)\s")
HEAD = re.compile(r"^(#{1,9})\s+(.*)$")
LINK = re.compile(r"(\]\()([^)\s]+)(\))")
MERMAID = re.compile(r"^```mermaid\s*\n(.*?)^```\s*$", re.S | re.M)
NAV_ENTRY = re.compile(r"^\s*-\s*(?:[^:\n#]+:\s*)?((?:informe|adr)/[\w.-]+\.md)\s*$", re.M)


def output_name(date: str) -> str:
    return f"Patitas-Informe-Final-{date}.docx"


def nav_files(repo: Path) -> list[str]:
    text = (repo / "mkdocs.yml").read_text(encoding="utf-8")
    return NAV_ENTRY.findall(text[text.index("\nnav:"):])


def report_files(files: list[str]) -> tuple[list[str], list[str]]:
    kept = [f for f in files if f not in EXCLUDED]
    return [f for f in kept if f.startswith("informe/")], [f for f in kept if f.startswith("adr/")]


def strip_front_matter(md: str) -> str:
    return re.sub(r"\A---\n.*?\n---\n", "", md, flags=re.S)


def root_number(md: str) -> str | None:
    for line in md.splitlines():
        h = HEAD.match(line)
        if h:
            n = NUM.match(h.group(2))
            return n.group(1) if n else None
    return None


def level_of(number: str) -> int:
    return number.count(".") + 1


def shift_headings(md: str, level_of_first: int) -> str:
    out, offset, fence = [], None, False
    for line in md.splitlines():
        if line.startswith("```"):
            fence = not fence
        h = None if fence else HEAD.match(line)
        if h:
            if offset is None:
                offset = level_of_first - len(h.group(1))
            line = "#" * (len(h.group(1)) + offset) + " " + h.group(2)
        out.append(line)
    return "\n".join(out)


def splice(md: str, number: str, sub_md: str) -> str:
    # reemplaza la seccion `number` (titulo y cuerpo) por otro contenido
    lines = md.splitlines()
    start = end = depth = None
    for i, line in enumerate(lines):
        h = HEAD.match(line)
        if not h:
            continue
        if start is None and h.group(2).startswith(number + " "):
            start, depth = i, len(h.group(1))
        elif start is not None and len(h.group(1)) <= depth:
            end = i
            break
    if start is None:
        return md
    end = len(lines) if end is None else end
    return "\n".join(lines[:start] + ["", sub_md, ""] + lines[end:])


def fix_links(md: str, src: Path, repo: Path, site_pages: set[str]) -> str:
    def repl(m: re.Match) -> str:
        raw = m.group(2)
        if re.match(r"^[a-z]+:|^#", raw):
            return m.group(0)
        path, _, frag = raw.partition("#")
        target = (src.parent / unquote(path)).resolve()
        if target.suffix.lower() == ".png" and target.exists():
            return m.group(1) + target.as_posix() + m.group(3)
        rel = target.relative_to(repo.resolve()).as_posix()
        anchor = "#" + frag if frag else ""
        if rel.startswith("docs/") and rel[5:] in site_pages:
            url = SITE_URL + rel[5:-3] + "/" + anchor
        else:
            url = BLOB_URL + quote(rel) + anchor
        return m.group(1) + url + m.group(3)

    return LINK.sub(repl, md)


def render_mermaid(md: str, work: Path, mmdc: str) -> str:
    def repl(m: re.Match) -> str:
        code = m.group(1)
        name = hashlib.sha1(code.encode()).hexdigest()[:12]
        src, png = work / f"{name}.mmd", work / f"{name}.png"
        if not png.exists():
            src.write_text(code, encoding="utf-8")
            subprocess.run([mmdc, "-i", str(src), "-o", str(png), "-s", "2", "-b", "white"],
                           check=True, capture_output=True)
        return f"![]({png.as_posix()})\n"

    return MERMAID.sub(repl, md)


def template_skeleton(template: Path) -> list[tuple[int, str]]:
    import docx

    items = []
    for p in docx.Document(str(template)).paragraphs:
        name, text = p.style.name, p.text.strip()
        if name.startswith("Heading ") and text:
            items.append((int(name.split()[1]), text))
    return items


def assemble(repo: Path, work: Path, mmdc: str) -> str:
    files = nav_files(repo)
    site_pages = set(files)
    informe, adrs = report_files(files)

    def load(rel: str) -> str:
        src = repo / "docs" / rel
        md = strip_front_matter(src.read_text(encoding="utf-8"))
        return render_mermaid(fix_links(md, src, repo, site_pages), work, mmdc)

    sections = {}
    for rel in informe:
        md = load(rel)
        sections[root_number(md)] = md
    nested = {o for n in sections for o in sections if o != n and o.startswith(n + ".")}
    for num in sections:
        for other in nested:
            if other.startswith(num + "."):
                sections[num] = splice(sections[num], other, f"<<{other}>>")

    def emit(num: str) -> str:
        md = shift_headings(sections[num], level_of(num))
        for other in nested:
            if f"<<{other}>>" in md:
                md = md.replace(f"<<{other}>>", emit(other))
        return md

    decisions = [shift_headings(load("adr/README.md"), level_of(DECISIONS) + 1)]
    decisions += [shift_headings(load(rel), level_of(DECISIONS) + 1) for rel in adrs]

    parts, owned = [], None
    for level, text in template_skeleton(repo / TEMPLATE):
        n = NUM.match(text)
        num = n.group(1) if n else None
        if owned and num and (num == owned or num.startswith(owned + ".")):
            continue
        owned = None
        if num in sections and num not in nested:
            parts.append(emit(num))
            owned = num
            continue
        parts.append("#" * level + " " + text)
        if num == DECISIONS:
            parts.extend(decisions)
    return "\n\n".join(parts)


def build(repo: Path, out: Path, mmdc: str) -> Path:
    import pypandoc

    work = out.parent / ".informe-docx-work"
    work.mkdir(parents=True, exist_ok=True)
    body = assemble(repo, work, mmdc)
    (work / "informe.md").write_text(body, encoding="utf-8")
    pypandoc.convert_text(
        body, "docx", format="markdown+pipe_tables+grid_tables-auto_identifiers",
        outputfile=str(out),
        extra_args=["--reference-doc", str(repo / TEMPLATE), "--toc", "--toc-depth=6",
                    "--resource-path", str(repo / "docs"),
                    "-M", "toc-title=Índice de contenidos", "-M", "lang=es-AR"],
    )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera el informe final en .docx")
    parser.add_argument("--out", type=Path, default=Path.cwd() / output_name(datetime.date.today().isoformat()))
    parser.add_argument("--mmdc", default=shutil.which("mmdc") or "mmdc", help="ejecutable de mermaid-cli")
    args = parser.parse_args()
    print(build(REPO_ROOT, args.out.resolve(), args.mmdc))


if __name__ == "__main__":
    main()
