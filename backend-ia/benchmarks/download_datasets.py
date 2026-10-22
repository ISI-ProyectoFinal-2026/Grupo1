"""Descarga reproducible de los datasets de benchmark (Open Images V7 + DogFaceNet).

Uso: python benchmarks/download_datasets.py [--per-class 40] [--dogs 60] [--seed 42]
Detalle de estructura y criterios: benchmarks/datasets/README.md
"""
import argparse
import csv
import json
import random
import shutil
import sys
import urllib.request
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASETS = ROOT / "datasets"
CACHE = ROOT / ".cache"
MANIFEST = DATASETS / "manifest.csv"

OI_BASE = "https://storage.googleapis.com/openimages"
OI_CLASSES = f"{OI_BASE}/v7/oidv7-class-descriptions-boxable.csv"
OI_HIERARCHY = f"{OI_BASE}/2018_04/bbox_labels_600_hierarchy.json"
OI_SPLITS = {
    "validation": {
        "bbox": f"{OI_BASE}/v5/validation-annotations-bbox.csv",
        "labels": f"{OI_BASE}/v5/validation-annotations-human-imagelabels-boxable.csv",
        "images": f"{OI_BASE}/2018_04/validation/validation-images-with-rotation.csv",
    },
    "test": {
        "bbox": f"{OI_BASE}/v5/test-annotations-bbox.csv",
        "labels": f"{OI_BASE}/v5/test-annotations-human-imagelabels-boxable.csv",
        "images": f"{OI_BASE}/2018_04/test/test-images-with-rotation.csv",
    },
}
OI_IMAGE_URL = "https://open-images-dataset.s3.amazonaws.com/{split}/{image_id}.jpg"

DFN_URL = "https://zenodo.org/api/records/12578449/files/DogFaceNet_224resized.zip/content"
DFN_LICENSE = "CC BY 4.0"
DFN_SOURCE_URL = "https://zenodo.org/records/12578449"

MIN_BOX_AREA = 0.10
IMAGES_PER_DOG = 6

# animales reales: clases objetivo (incluye subclases de la jerarquía)
ANIMAL_TARGETS = {
    "dog": ["Dog"],
    "cat": ["Cat"],
    "rabbit": ["Rabbit"],
    "turtle": ["Turtle", "Tortoise", "Sea turtle"],
    "bird": ["Bird"],
    "other": ["Hamster", "Horse"],
}
# sin animal real: clases objetivo y clases que no pueden aparecer
NO_ANIMAL_TARGETS = {
    # los anotadores etiquetan los peluches con clases genéricas de animal
    "plush": {
        "classes": ["Teddy bear"],
        "exclude_person": False,
        "tolerate": ["Animal", "Mammal", "Carnivore", "Bear"],
    },
    "person": {"classes": ["Person", "Man", "Woman"], "exclude_person": False},
    "object": {
        "classes": ["Chair", "Car", "Bicycle", "Book", "Mobile phone", "Laptop", "Computer monitor"],
        "exclude_person": True,
    },
    "landscape": {"classes": ["Tree", "Skyscraper", "Building", "House"], "exclude_person": True},
}
PERSON_CLASSES = ["Person", "Man", "Woman", "Boy", "Girl", "Human face"]
GENERIC_ANIMAL_CLASSES = ["Animal", "Mammal", "Carnivore"]


def fetch(url: str, name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if target.exists() and target.stat().st_size > 0:
        return target
    print(f"  descargando {name} ...", flush=True)
    tmp = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as response, open(tmp, "wb") as out:
        shutil.copyfileobj(response, out)
    tmp.replace(target)
    return target


def read_csv(path: Path):
    with open(path, newline="", encoding="utf-8") as handle:
        yield from csv.DictReader(handle)


def subtree_ids(hierarchy: dict, root_id: str) -> set[str]:
    ids: set[str] = set()

    def walk(node: dict, inside: bool) -> None:
        here = inside or node.get("LabelName") == root_id
        if here:
            ids.add(node["LabelName"])
        for child in node.get("Subcategory", []):
            walk(child, here)

    walk(hierarchy, False)
    return ids


def build_open_images(per_class: int, rng: random.Random) -> list[dict]:
    print("Open Images V7")
    name_to_id = {row[1]: row[0] for row in csv.reader(open(fetch(OI_CLASSES, "oi_classes.csv"), encoding="utf-8"))}
    hierarchy = json.loads(fetch(OI_HIERARCHY, "oi_hierarchy.json").read_text(encoding="utf-8"))
    # "Teddy bear" figura también dentro de la rama Animal: no es un animal real
    toy_ids = subtree_ids(hierarchy, name_to_id["Teddy bear"])
    animal_ids = subtree_ids(hierarchy, name_to_id["Animal"]) - toy_ids
    person_ids = {name_to_id[n] for n in PERSON_CLASSES if n in name_to_id}
    # etiquetas genéricas: "Mammal" también se usa para personas
    generic_ids = {name_to_id[n] for n in GENERIC_ANIMAL_CLASSES}

    def expand(names: list[str]) -> set[str]:
        out: set[str] = set()
        for n in names:
            out |= subtree_ids(hierarchy, name_to_id[n]) or {name_to_id[n]}
        return out

    animal_targets = {k: expand(v) for k, v in ANIMAL_TARGETS.items()}
    no_animal_targets = {k: expand(v["classes"]) for k, v in NO_ANIMAL_TARGETS.items()}

    # por imagen: etiquetas presentes, cajas de animal reales y dibujadas
    present: dict[tuple, set] = defaultdict(set)
    real_animal_box: dict[tuple, dict] = defaultdict(dict)
    depicted_animal: set[tuple] = set()
    meta: dict[tuple, dict] = {}
    for split, urls in OI_SPLITS.items():
        for row in read_csv(fetch(urls["bbox"], f"oi_{split}_bbox.csv")):
            key = (split, row["ImageID"])
            label = row["LabelName"]
            present[key].add(label)
            if label in animal_ids:
                if row["IsDepiction"] == "1":
                    if label not in generic_ids:
                        depicted_animal.add(key)
                elif row["IsGroupOf"] != "1":
                    area = (float(row["XMax"]) - float(row["XMin"])) * (float(row["YMax"]) - float(row["YMin"]))
                    real_animal_box[key][label] = max(area, real_animal_box[key].get(label, 0.0))
        for row in read_csv(fetch(urls["labels"], f"oi_{split}_labels.csv")):
            if row["Confidence"] == "1":
                present[(split, row["ImageID"])].add(row["LabelName"])
        for row in read_csv(fetch(urls["images"], f"oi_{split}_images.csv")):
            meta[(split, row["ImageID"])] = row

    def has_any(key, ids) -> bool:
        return not present[key].isdisjoint(ids)

    candidates: dict[str, list] = {}
    for folder, ids in animal_targets.items():
        # un solo tipo de animal real, de tamaño visible, sin cajas de grupo
        candidates[f"animal/{folder}"] = sorted(
            key for key, boxes in real_animal_box.items()
            if boxes and set(boxes) <= ids and max(boxes.values()) >= MIN_BOX_AREA
            and not (present[key] & animal_ids - ids)
        )
    for folder, ids in no_animal_targets.items():
        rule = NO_ANIMAL_TARGETS[folder]
        forbidden = animal_ids - {name_to_id[n] for n in rule.get("tolerate", [])}
        candidates[f"no_animal/{folder}"] = sorted(
            key for key in present
            if has_any(key, ids) and not has_any(key, forbidden) and not real_animal_box.get(key)
            and not (rule["exclude_person"] and has_any(key, person_ids))
        )
    # dibujos: animales representados, sin ningún animal real ni peluche en la imagen
    candidates["no_animal/drawing"] = sorted(
        key for key in depicted_animal if not real_animal_box.get(key) and not has_any(key, toy_ids)
    )

    jobs = []
    for folder, keys in candidates.items():
        keys = [k for k in keys if k in meta]
        chosen = rng.sample(keys, min(per_class, len(keys)))
        print(f"  {folder}: {len(chosen)} de {len(keys)} candidatas")
        for split, image_id in chosen:
            jobs.append((folder, split, image_id, meta[(split, image_id)]))

    def download(job) -> dict | None:
        folder, split, image_id, info = job
        target = DATASETS / "moderation" / folder / f"oi_{image_id}.jpg"
        if not target.exists():
            try:
                with urllib.request.urlopen(OI_IMAGE_URL.format(split=split, image_id=image_id), timeout=60) as r:
                    target.write_bytes(r.read())
            except Exception as error:  # noqa: BLE001
                print(f"  ! {image_id}: {error}", file=sys.stderr)
                return None
        return {
            "path": target.relative_to(DATASETS).as_posix(),
            "task": "moderation",
            "label": folder,
            "source": f"Open Images V7 ({split})",
            "source_id": image_id,
            "license": info.get("License", ""),
            "author": info.get("Author", ""),
            "original_url": info.get("OriginalLandingURL", ""),
        }

    with ThreadPoolExecutor(max_workers=16) as pool:
        return [row for row in pool.map(download, jobs) if row]


def build_dogfacenet(dogs: int, rng: random.Random) -> list[dict]:
    print("DogFaceNet")
    archive = zipfile.ZipFile(fetch(DFN_URL, "dogfacenet_224resized.zip"))
    by_dog: dict[str, list[str]] = defaultdict(list)
    for name in archive.namelist():
        parts = Path(name).parts
        if name.lower().endswith((".jpg", ".jpeg", ".png")) and len(parts) >= 2:
            by_dog[parts[-2]].append(name)
    eligible = sorted(d for d, files in by_dog.items() if len(files) >= 3)
    chosen = sorted(rng.sample(eligible, min(dogs, len(eligible))))
    print(f"  matching: {len(chosen)} perros de {len(eligible)} con 3+ fotos")
    rows = []
    for index, dog in enumerate(chosen, start=1):
        folder = DATASETS / "matching" / f"dog_dfn_{index:04d}"
        folder.mkdir(parents=True, exist_ok=True)
        for photo_index, member in enumerate(sorted(by_dog[dog])[:IMAGES_PER_DOG], start=1):
            target = folder / f"{photo_index:02d}{Path(member).suffix.lower()}"
            target.write_bytes(archive.read(member))
            rows.append({
                "path": target.relative_to(DATASETS).as_posix(),
                "task": "matching",
                "label": folder.name,
                "source": "DogFaceNet (224resized)",
                "source_id": f"{dog}/{Path(member).name}",
                "license": DFN_LICENSE,
                "author": "Mougeot, Li, Jia (2019)",
                "original_url": DFN_SOURCE_URL,
            })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-class", type=int, default=40)
    parser.add_argument("--dogs", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows = build_open_images(args.per_class, random.Random(args.seed))
    rows += build_dogfacenet(args.dogs, random.Random(args.seed))

    fields = ["path", "task", "label", "source", "source_id", "license", "author", "original_url"]
    with open(MANIFEST, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda r: r["path"]))
    print(f"Listo: {len(rows)} imágenes. Manifiesto: {MANIFEST.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
