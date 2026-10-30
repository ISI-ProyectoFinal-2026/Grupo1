"""Pipeline de detección (YOLO) + embedding (DINOv2).

YOLOv8n detecta y recorta la mascota; DINOv2 ViT-B/14 genera el embedding de
768 dims sobre ese recorte. Los modelos se cargan una sola vez a nivel de
módulo, no por request.

DINOv2 reemplazó a OpenCLIP ViT-B-32 (el modelo del POC). En un benchmark de
identidad (596 fotos de 92 perros y gatos individuales, foto de consulta
reducida a 480px + JPEG q50, 20 reportes candidatos y la misma tasa de falsos
positivos para todos) DINOv2 B/14 encuentra la mascota en el 88% de los casos;
OpenCLIP B-32 en el 45% y OpenCLIP L-14 en el 57%. CLIP codifica "qué es"
(raza, color) y confunde perros parecidos; DINOv2, auto-supervisado, captura
rasgos finos de la instancia. DINOv2 L/14 no encontró más mascotas y cuesta
3x más CPU. No cambiar el checkpoint sin volver a medir: la dimensión y la
escala de similitud dependen de él.
"""

import timm
import timm.data
import torch
import ultralytics
from PIL import Image

_YOLO_WEIGHTS = "yolov8n.pt"
_DINO_MODEL_NAME = "vit_base_patch14_dinov2.lvd142m"

# Must match the report_embeddings.embedding column (vector(768)).
EMBEDDING_DIM = 768

# DINOv2 is pretrained at 518px, but on the identity benchmark 224px scores the
# same (AUC 0.984 vs 0.985, mAP 0.910 vs 0.907) and the embedding runs 6x faster
# on CPU (0.30s vs 1.8s): attention cost grows with the square of the patch
# count (256 patches at 224px vs 1369 at 518px). Changing it shifts the
# similarity scale: recalibrate the thresholds in matching_service.
DINO_INPUT_SIZE = 224

# Detections smaller than this fraction of the biggest animal in the photo are
# treated as background animals and never chosen as the reported pet.
MIN_RELATIVE_AREA = 0.25

# ImageNet mean colour: once normalised by the DINOv2 transform it becomes ~0,
# so the padding added by _pad_to_square carries no signal.
PAD_COLOR = (124, 116, 104)

# Every COCO animal class (ids 14-23), by name to avoid magic indices. The upload
# screening and the async moderation (both detect_and_crop) and contains_animal
# share it: with different criteria a photo accepted on upload could end up
# rejected later.
_ANIMAL_LABELS = {
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
}

yolo_model = ultralytics.YOLO(_YOLO_WEIGHTS)

dino_model = timm.create_model(_DINO_MODEL_NAME, pretrained=True, num_classes=0, img_size=DINO_INPUT_SIZE)
dino_model.eval()
dino_transform = timm.data.create_transform(
    **timm.data.resolve_data_config({"input_size": (3, DINO_INPUT_SIZE, DINO_INPUT_SIZE)}, model=dino_model)
)


def _area(xyxy: list[float]) -> float:
    return (xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1])


def detect_and_crop(image: Image.Image) -> Image.Image | None:
    """Corre YOLO sobre `image` y devuelve el recorte de la mascota
    principal. Devuelve None si no se detectó ningún animal COCO.

    La mascota principal es la detección de mayor confianza entre las que
    ocupan al menos MIN_RELATIVE_AREA del área del animal más grande. Solo
    por confianza, un animal chico asomando en el borde le ganaba a la
    mascota en primer plano (reporte 3583: "sheep" 0.61 de borde contra
    "dog" 0.37 del perro reportado).
    """
    detections = []
    for result in yolo_model(image):
        if result.boxes is None:
            continue
        for box in result.boxes:
            if yolo_model.names[int(box.cls[0])] in _ANIMAL_LABELS:
                detections.append((float(box.conf[0]), [float(v) for v in box.xyxy[0]]))

    if not detections:
        return None

    biggest = max(_area(xyxy) for _, xyxy in detections)
    _, best = max((d for d in detections if _area(d[1]) >= MIN_RELATIVE_AREA * biggest), key=lambda d: d[0])

    x1, y1, x2, y2 = (int(v) for v in best)
    return image.crop((x1, y1, x2, y2))


def contains_animal(image: Image.Image) -> bool:
    """Return True if YOLO detects at least one COCO animal in `image`."""
    for result in yolo_model(image):
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            if yolo_model.names[int(box.cls[0])] in _ANIMAL_LABELS:
                return True
    return False


def _pad_to_square(image: Image.Image) -> Image.Image:
    """Centre `image` on a square PAD_COLOR canvas.

    The DINOv2 transform center-crops to a square, which cut the head off
    elongated crops (a sitting or lying dog). Padding first keeps the whole
    animal; on the identity benchmark it raised recall at 1% false positives
    from 0.53 to 0.65 (AUC 0.977 -> 0.987).
    """
    side = max(image.size)
    canvas = Image.new("RGB", (side, side), PAD_COLOR)
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas


def generate_embedding(image: Image.Image) -> list[float]:
    """Genera el embedding DINOv2 de `image`, normalizado (norma L2 = 1) para
    que la distancia coseno de pgvector (`<=>`) dé la similitud coseno.
    """
    tensor = dino_transform(_pad_to_square(image)).unsqueeze(0)
    with torch.no_grad():
        features = dino_model(tensor)
        features = features / features.norm(dim=-1, keepdim=True)
    return features[0].tolist()
