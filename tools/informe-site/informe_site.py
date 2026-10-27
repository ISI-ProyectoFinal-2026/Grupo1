# hooks de MkDocs del sitio del informe
import logging
import os
import posixpath
import re
from pathlib import Path
from urllib.parse import quote, unquote

from mkdocs.structure.files import File, InclusionLevel

log = logging.getLogger("mkdocs.hooks.informe_site")

REPO_URL = "https://github.com/ISI-ProyectoFinal-2026/Grupo1"
BENCHMARK_DIR = "backend-ia/benchmarks/results"
BENCHMARK_EXT = {".png", ".csv", ".json"}
SITE_INDEXES = ("index.md", "README.md")

# ruta del repo -> src_uri dentro del sitio
ALIASES: dict[str, str] = {}

SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
CODE_SPAN = re.compile(r"(?<!`)(`+)(?!`).+?(?<!`)\1(?!`)")
TARGET = r"<[^>\n]*>|(?:[^()\s]|\([^()\s]*\))+"
INLINE_LINK = re.compile(r"(\]\(\s*)(" + TARGET + r")(?=(?:\s+(?:\"[^\"]*\"|'[^']*'|\([^)]*\)))?\s*\))")
REF_DEF = re.compile(r"^( {0,3}\[[^\]]+\]:[ \t]*)(<[^>]*>|\S+)")


def github_ref() -> str:
    return os.environ.get("GITHUB_SHA") or "main"


def benchmark_files(repo_root: Path) -> list[tuple[str, str]]:
    results = Path(repo_root) / BENCHMARK_DIR
    if not results.is_dir():
        return []
    found = []
    for path in sorted(results.rglob("*")):
        rel = path.relative_to(results)
        if path.is_file() and path.suffix.lower() in BENCHMARK_EXT and "raw" not in rel.parts[:-1]:
            found.append((f"benchmark/{rel.as_posix()}", str(path)))
    return found


def _resolve(raw: str, ctx: dict) -> str | None:
    if not raw or raw.startswith(("#", "/")) or SCHEME.match(raw):
        return None
    path, hash_sep, fragment = raw.partition("#")
    path, query_sep, query = path.partition("?")
    page_dir = posixpath.dirname(ctx["page_src_uri"])
    target = posixpath.normpath(posixpath.join(page_dir, unquote(path)))
    site = ctx["site_uris"]
    if target in site or any(posixpath.join(target, name) in site for name in SITE_INDEXES):
        return None
    repo_rel = posixpath.normpath(posixpath.join(ctx["docs_rel"], target))
    if repo_rel == ".." or repo_rel.startswith("../"):
        return None
    suffix = query_sep + query + hash_sep + fragment
    if repo_rel in ctx["aliases"]:
        return posixpath.relpath(ctx["aliases"][repo_rel], page_dir or ".") + suffix
    abs_path = Path(ctx["repo_root"]) / repo_rel
    if not abs_path.exists():
        log.info("%s: el enlace '%s' apunta a un archivo inexistente en el repositorio", ctx["page_src_uri"], raw)
    kind = "tree" if abs_path.is_dir() else "blob"
    return f"{REPO_URL}/{kind}/{ctx['ref']}/{quote(repo_rel)}{suffix}"


def _rewrite_target(target: str, ctx: dict) -> str:
    angled = target.startswith("<") and target.endswith(">")
    new = _resolve(target[1:-1] if angled else target, ctx)
    if new is None:
        return target
    return f"<{new}>" if angled else new


def _rewrite_line(line: str, ctx: dict) -> str:
    spans: list[str] = []

    def mask(match: re.Match) -> str:
        spans.append(match.group(0))
        return f"\x00{len(spans) - 1}\x00"

    masked = CODE_SPAN.sub(mask, line)
    masked = REF_DEF.sub(lambda m: m.group(1) + _rewrite_target(m.group(2), ctx), masked)
    masked = INLINE_LINK.sub(lambda m: m.group(1) + _rewrite_target(m.group(2), ctx), masked)
    return re.sub(r"\x00(\d+)\x00", lambda m: spans[int(m.group(1))], masked)


def rewrite_links(markdown, *, page_src_uri, site_uris, repo_root, docs_rel, ref, aliases=None) -> str:
    ctx = {
        "page_src_uri": page_src_uri,
        "site_uris": site_uris,
        "repo_root": repo_root,
        "docs_rel": docs_rel,
        "ref": ref,
        "aliases": aliases or {},
    }
    out, fence = [], None
    for line in markdown.splitlines(keepends=True):
        opened = FENCE.match(line)
        if fence:
            if opened and opened.group(1)[0] == fence[0] and len(opened.group(1)) >= len(fence):
                fence = None
            out.append(line)
        elif opened:
            fence = opened.group(1)
            out.append(line)
        else:
            out.append(_rewrite_line(line, ctx))
    return "".join(out)


def _repo_root(config) -> Path:
    return Path(config.config_file_path).resolve().parent


def on_files(files, config):
    ALIASES.clear()
    repo_root = _repo_root(config)
    for src_uri, abs_path in benchmark_files(repo_root):
        files.append(File.generated(config, src_uri, abs_src_path=abs_path, inclusion=InclusionLevel.INCLUDED))
        ALIASES[Path(abs_path).relative_to(repo_root).as_posix()] = src_uri
    return files


def on_page_markdown(markdown, page, config, files):
    repo_root = _repo_root(config)
    return rewrite_links(
        markdown,
        page_src_uri=page.file.src_uri,
        site_uris={f.src_uri for f in files if f.inclusion.is_included()},
        repo_root=repo_root,
        docs_rel=Path(config.docs_dir).resolve().relative_to(repo_root).as_posix(),
        ref=github_ref(),
        aliases=ALIASES,
    )
