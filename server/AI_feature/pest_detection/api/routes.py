from io import BytesIO
from pathlib import Path
from threading import Lock

import numpy as np
import tensorflow as tf
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, ImageOps
from tensorflow.keras.models import load_model

router = APIRouter(tags=["pest-detection"])

MODEL_PATH = Path(__file__).resolve().parent / "plant_disease_recog_model_pwp_5.keras"
_model = None
_model_lock = Lock()

DISEASE_INFO = {
    0: {
        "name": "Benh dom vi khuan (Bacterial spot)",
        "treatment": "Su dung thuoc goc dong, tia bot la chan cho thong thoang va tranh tuoi nuoc truc tiep len la vao chieu toi.",
    },
    1: {
        "name": "Benh dom som (Early blight)",
        "treatment": "Cat bo cac la gia bi benh nang. Phun thuoc tru nam chua hoat chat Chlorothalonil hoac Mancozeb.",
    },
    2: {
        "name": "Benh moc suong/dom muon (Late blight)",
        "treatment": "Tieu huy cay benh nang. Phun thuoc dac hieu nhu Ridomil Gold hoac cac loai thuoc chua hoat chat Metalaxyl.",
    },
    3: {
        "name": "Benh moc la (Leaf Mold)",
        "treatment": "Tang cuong thong gio. Su dung thuoc phun chua goc luu huynh hoac thuoc tru nam pho rong.",
    },
    4: {
        "name": "Benh xoan la (Tomato Yellow Leaf Curl Virus)",
        "treatment": "Khong co thuoc chua virus. Nho bo cay benh de tranh lay lan va tieu diet bo phan trang.",
    },
    5: {
        "name": "Ca chua khoe manh",
        "treatment": "Cay dang phat trien tot. Duy tri che do phan bon va tuoi nuoc hop ly.",
    },
}


def get_model_status() -> dict:
    return {
        "name": "Tomato pest detection",
        "framework": "TensorFlow/Keras",
        "artifact": str(MODEL_PATH),
        "artifact_exists": MODEL_PATH.exists(),
        "loaded": _model is not None,
        "endpoint": "POST /detect-disease",
    }


def _get_model():
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            if not MODEL_PATH.exists():
                raise HTTPException(status_code=503, detail=f"Model artifact not found: {MODEL_PATH}")
            _model = load_model(MODEL_PATH)

    return _model


def _extract_leaf_region(img: Image.Image) -> Image.Image:
    try:
        import cv2
    except ImportError:
        return img

    img_cv = np.array(img)
    hsv = cv2.cvtColor(img_cv, cv2.COLOR_RGB2HSV)

    mask_green = cv2.inRange(hsv, np.array([15, 20, 20]), np.array([95, 255, 255]))
    mask_yellow = cv2.inRange(hsv, np.array([10, 30, 30]), np.array([35, 255, 255]))
    mask = cv2.bitwise_or(mask_green, mask_yellow)

    kernel = np.ones((15, 15), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img

    h_img, w_img = img_cv.shape[:2]
    center = np.array([w_img // 2, h_img // 2])

    def score_contour(contour):
        area = cv2.contourArea(contour)
        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            return 0
        cx = int(moments["m10"] / moments["m00"])
        cy = int(moments["m01"] / moments["m00"])
        dist = np.sqrt((cx - center[0]) ** 2 + (cy - center[1]) ** 2)
        max_dist = np.sqrt(center[0] ** 2 + center[1] ** 2)
        return area * (1 - dist / max_dist)

    best_contour = max(contours, key=score_contour)
    x, y, cw, ch = cv2.boundingRect(best_contour)
    pad_w = int(cw * 0.2)
    pad_h = int(ch * 0.2)
    x = max(0, x - pad_w)
    y = max(0, y - pad_h)
    cw = min(w_img - x, cw + 2 * pad_w)
    ch = min(h_img - y, ch + 2 * pad_h)

    if cw * ch > 0.1 * w_img * h_img:
        return img.crop((x, y, x + cw, y + ch))

    return img


def _preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        background = Image.new("RGB", rgba.size, (150, 150, 150))
        background.paste(rgba, mask=rgba.split()[3])
        img = background
    else:
        img = img.convert("RGB")

    img = _extract_leaf_region(img)

    w, h = img.size
    if w != h:
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        img = img.crop((left, top, left + min_dim, top + min_dim))

    img = img.resize((224, 224), Image.LANCZOS)
    return np.array(img)


def _predict_with_tta(model, image_np: np.ndarray):
    img_tensor = tf.convert_to_tensor(image_np, dtype=tf.float32)
    predictions = []

    img_batch = tf.expand_dims(img_tensor, 0)
    img_batch = tf.keras.applications.efficientnet.preprocess_input(img_batch)
    predictions.append(tf.nn.softmax(model(img_batch, training=False))[0])

    flipped = tf.image.flip_left_right(img_tensor)
    img_batch = tf.expand_dims(flipped, 0)
    img_batch = tf.keras.applications.efficientnet.preprocess_input(img_batch)
    predictions.append(tf.nn.softmax(model(img_batch, training=False))[0])

    crop_size = int(224 * 0.9)
    offset = (224 - crop_size) // 2
    cropped = img_tensor[offset : offset + crop_size, offset : offset + crop_size, :]
    cropped = tf.image.resize(tf.expand_dims(cropped, 0), [224, 224])
    cropped = tf.keras.applications.efficientnet.preprocess_input(cropped)
    predictions.append(tf.nn.softmax(model(cropped, training=False))[0])

    return tf.reduce_mean(tf.stack(predictions), axis=0)


@router.post("/detect-disease")
async def detect_disease(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")

    try:
        image = _preprocess_image(image_bytes)
        avg_predictions = _predict_with_tta(_get_model(), image)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Disease detection failed: {exc}") from exc

    predicted_class_idx = int(np.argmax(avg_predictions))
    confidence = float(avg_predictions[predicted_class_idx])
    info = DISEASE_INFO.get(
        predicted_class_idx,
        {
            "name": "Khong xac dinh",
            "treatment": "Vui long lien he chuyen gia nong nghiep.",
        },
    )

    return {
        "success": True,
        "data": {
            "disease_id": predicted_class_idx,
            "disease_name": info["name"],
            "treatment": info["treatment"],
            "confidence": round(confidence * 100, 2),
        },
    }
