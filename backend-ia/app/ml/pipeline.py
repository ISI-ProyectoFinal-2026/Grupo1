"""Pipeline de detección (YOLO) + embedding (OpenCLIP).

Reproduce exactamente lo validado en el notebook del POC
(`docs/pocs/POC_Similitudes.ipynb`): YOLOv8n para detectar y recortar la
mascota, OpenCLIP ViT-B-32 (pretrained laion2b_s34b_b79k) para generar el
embedding de 512 dims. Los modelos se cargan una sola vez a nivel de módulo
(igual que el notebook), no por request.
"""

import open_clip
import torch
import ultralytics
from PIL import Image

_YOLO_WEIGHTS = "yolov8n.pt"
_CLIP_MODEL_NAME = "ViT-B-32"
_CLIP_PRETRAINED = "laion2b_s34b_b79k"

# Nombres de clase COCO que nos interesan — evita índices mágicos.
_PET_LABELS = {"cat", "dog"}

yolo_model = ultralytics.YOLO(_YOLO_WEIGHTS)

clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
    _CLIP_MODEL_NAME,
    pretrained=_CLIP_PRETRAINED,
)
clip_model.eval()


def detect_and_crop(image: Image.Image) -> Image.Image | None:
    """Corre YOLO sobre `image` y devuelve el recorte de la detección de
    mayor confianza cuya clase sea "cat" o "dog". Devuelve None si no se
    detectó ninguna mascota.
    """
    results = yolo_model(image)

    best_box = None
    best_conf = -1.0
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            label = yolo_model.names[int(box.cls[0])]
            if label not in _PET_LABELS:
                continue
            conf = float(box.conf[0])
            if conf > best_conf:
                best_conf = conf
                best_box = box

    if best_box is None:
        return None

    x1, y1, x2, y2 = (int(v) for v in best_box.xyxy[0])
    return image.crop((x1, y1, x2, y2))


def generate_embedding(image: Image.Image) -> list[float]:
    """Genera el embedding OpenCLIP de `image`, normalizado (norma L2 = 1),
    como lo hace el notebook del POC.
    """
    tensor = clip_preprocess(image).unsqueeze(0)
    with torch.no_grad():
        features = clip_model.encode_image(tensor)
        features = features / features.norm(dim=-1, keepdim=True)
    return features[0].tolist()
