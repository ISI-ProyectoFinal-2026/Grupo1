"""Calidad de la foto: nitidez del recorte de la mascota (issue #212).

Solo genera un aviso al usuario, nunca rechaza el reporte. Métrica y umbral
calibrados en ADR-0023.
"""

import numpy as np
from PIL import Image

# ADR-0023: por debajo, la foto se considera borrosa o movida
SHARPNESS_THRESHOLD = 10.0

# lado largo del recorte al medir, igual que en la calibración
SHARPNESS_SIDE = 512


def sharpness(image: Image.Image) -> float:
    """Varianza del laplaciano 3x3 del recorte en gris, con el lado largo a 512 px."""
    if min(image.size) == 0:
        return 0.0
    scale = SHARPNESS_SIDE / max(image.size)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    gray = np.asarray(image.resize(size, Image.BILINEAR).convert("L"), dtype=np.float64)

    # bordes reflejados sin repetir el borde, como BORDER_REFLECT_101 de OpenCV
    padded = np.pad(gray, 1, mode="reflect")
    laplacian = padded[:-2, 1:-1] + padded[2:, 1:-1] + padded[1:-1, :-2] + padded[1:-1, 2:] - 4 * gray
    return float(laplacian.var())


def is_low_quality(image: Image.Image) -> bool:
    return sharpness(image) < SHARPNESS_THRESHOLD
