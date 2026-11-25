# imagen del Backend IA (#370)
FROM python:3.11-slim

# libs de sistema que pide opencv (dependencia de ultralytics)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf \
    YOLO_CONFIG_DIR=/opt/ultralytics

WORKDIR /app

# torch solo CPU (+cpu le gana a la build con CUDA de PyPI)
COPY requirements.txt ./
RUN pip install --default-timeout=120 --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# pesos en la imagen: mismos nombres que app/ml/pipeline.py
# HF_HUB_DISABLE_XET: descarga HTTP simple, sin el cliente xet
RUN HF_HUB_DISABLE_XET=1 python -c "import timm, ultralytics; ultralytics.YOLO('yolov8n.pt'); timm.create_model('vit_base_patch14_dinov2.lvd142m', pretrained=True)" \
    && yolo settings sync=False

COPY app ./app

# sin red en el arranque
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    YOLO_OFFLINE=1

RUN useradd --create-home --uid 1000 app \
    && chown -R app /app /opt/ultralytics
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
