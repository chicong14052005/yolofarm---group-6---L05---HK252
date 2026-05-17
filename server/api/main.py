from io import BytesIO
from PIL import Image
import tensorflow as tf
import numpy as np
from tensorflow.keras.models import load_model
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS: cho phép Node.js server và client gọi tới FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Định nghĩa thông tin bệnh và cách chữa (Đảm bảo đúng thứ tự khi Train)
DISEASE_INFO = {
    0: {
        "name": "Bệnh đốm vi khuẩn (Bacterial spot)",
        "treatment": "Sử dụng thuốc gốc đồng (Booc-đô), tỉa bớt lá chân cho thông thoáng và tránh tưới nước trực tiếp lên lá vào chiều tối."
    },
    1: {
        "name": "Bệnh đốm sớm (Early blight)",
        "treatment": "Cắt bỏ các lá già bị bệnh nặng. Phun thuốc trừ nấm chứa hoạt chất Chlorothalonil hoặc Mancozeb."
    },
    2: {
        "name": "Bệnh mốc sương/đốm muộn (Late blight)",
        "treatment": "Đây là bệnh nguy hiểm. Tiêu hủy cây bệnh nặng. Phun thuốc đặc hiệu như Ridomil Gold hoặc các loại thuốc chứa hoạt chất Metalaxyl."
    },
    3: {
        "name": "Bệnh mốc lá (Leaf Mold)",
        "treatment": "Tăng cường thông gió. Sử dụng thuốc phun chứa gốc lưu huỳnh hoặc thuốc trừ nấm phổ rộng."
    },
    4: {
        "name": "Bệnh xoăn lá (Tomato Yellow Leaf Curl Virus)",
        "treatment": "Không có thuốc chữa virus. Cần nhổ bỏ cây bệnh để tránh lây lan và tiêu diệt bọ phấn trắng (vật trung gian truyền bệnh)."
    },
    5: {
        "name": "Cà chua khỏe mạnh",
        "treatment": "Cây đang phát triển tốt. Duy trì chế độ phân bón và tưới nước hợp lý."
    }
}

model = load_model('plant_disease_recog_model_pwp_3.keras')

def read_file_as_image(data):
    img = Image.open(BytesIO(data))
    img = img.convert("RGB")
    img = img.resize((224, 224))
    return np.array(img)

@app.post("/detect-disease")
async def detectDisease(file: UploadFile = File(...)):

    image_bytes = await file.read()
    image = read_file_as_image(image_bytes)
    
    img_array = np.expand_dims(image, 0)
    img_array = tf.keras.applications.efficientnet.preprocess_input(img_array)

    predictions_raw = model(img_array, training=False)


    predictions_softmax = tf.nn.softmax(predictions_raw)


    predicted_class_idx = int(np.argmax(predictions_softmax[0]))


    confidence = float(predictions_softmax[0][predicted_class_idx])


    info = DISEASE_INFO.get(predicted_class_idx, {
        "name": "Không xác định",
        "treatment": "Vui lòng liên hệ chuyên gia nông nghiệp."
    })

    return {
        "success": True,
        "data": {
            "disease_id": predicted_class_idx,
            "disease_name": info["name"],
            "treatment": info["treatment"],
            "confidence": round(confidence * 100, 2)
        }
    }