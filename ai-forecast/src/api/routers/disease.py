from fastapi import APIRouter, File, UploadFile, HTTPException

router = APIRouter()


@router.post("/detect-disease")
async def detect_disease(image: UploadFile = File(...)) -> dict:
    """Detect crop disease from uploaded image.

    Currently returns a structured placeholder since the vision model
    is not deployed to this service yet. When ready, replace this with
    inference against a fine-tuned plant disease classifier.

    Expected integration: Node.js proxies POST /detect-disease here
    after receiving the image from the frontend.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    contents = await image.read()
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit.")

    # Placeholder: return a structured response indicating the service is
    # not yet connected to a vision model. The frontend can use this to
    # show an appropriate message.
    return {
        "disease_name": "unknown",
        "confidence": 0.0,
        "description": "Disease detection model is not deployed. This endpoint is a placeholder for future integration.",
        "crop_type": "unknown",
        "pest_common_name": "unknown",
        "threat_level": "low",
        "treatments": [],
    }
