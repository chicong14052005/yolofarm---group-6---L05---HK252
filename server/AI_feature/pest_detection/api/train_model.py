"""
Training script cải tiến cho Plant Disease Recognition Model.
Sử dụng EfficientNetB0 + data augmentation mạnh + model head cải tiến.

Chạy: python train_model.py
Yêu cầu: tensorflow, pillow, numpy

Dataset: PlantVillage/ trong cùng thư mục
Output: plant_disease_recog_model_pwp_5.keras
"""

import os
import sys
import shutil
import random

# Fix encoding cho Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import tensorflow as tf
from tensorflow.keras import layers, models
import numpy as np

# ======================== CẤU HÌNH ========================

# 6 class Tomato (giống model hiện tại)
TARGET_CLASSES = [
    "Tomato_Bacterial_spot",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_Leaf_Mold",
    "Tomato__Tomato_YellowLeaf__Curl_Virus",
    "Tomato_healthy",
]

DATASET_DIR = os.path.join(os.path.dirname(__file__), "PlantVillage")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "training_data")
MODEL_OUTPUT = os.path.join(os.path.dirname(__file__), "plant_disease_recog_model_pwp_5.keras")

BATCH_SIZE = 32
IMG_SIZE = (224, 224)
INITIAL_EPOCHS = 10
FINE_TUNE_EPOCHS = 10
BASE_LEARNING_RATE = 0.001

# Tỷ lệ chia dataset: 80% train, 10% val, 10% test
TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1


# ======================== BƯỚC 1: CHUẨN BỊ DATASET ========================

def prepare_dataset():
    """
    Chia dataset PlantVillage thành train/val/test,
    chỉ lấy 6 class Tomato.
    """
    print("=" * 60)
    print("BƯỚC 1: Chuẩn bị dataset")
    print("=" * 60)

    # Tạo thư mục output
    for split in ["train", "val", "test"]:
        for cls in TARGET_CLASSES:
            os.makedirs(os.path.join(OUTPUT_DIR, split, cls), exist_ok=True)

    for cls in TARGET_CLASSES:
        src_dir = os.path.join(DATASET_DIR, cls)
        if not os.path.exists(src_dir):
            print(f"  [WARNING] Không tìm thấy thư mục: {src_dir}")
            continue

        files = [f for f in os.listdir(src_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        random.seed(42)  # Reproducible
        random.shuffle(files)

        n_total = len(files)
        n_train = int(n_total * TRAIN_RATIO)
        n_val = int(n_total * VAL_RATIO)

        splits = {
            "train": files[:n_train],
            "val": files[n_train:n_train + n_val],
            "test": files[n_train + n_val:],
        }

        for split_name, split_files in splits.items():
            dst_dir = os.path.join(OUTPUT_DIR, split_name, cls)
            for f in split_files:
                src = os.path.join(src_dir, f)
                dst = os.path.join(dst_dir, f)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)

        print(f"  {cls}: {len(splits['train'])} train / {len(splits['val'])} val / {len(splits['test'])} test")

    print(f"\n  Dataset đã sẵn sàng tại: {OUTPUT_DIR}")


# ======================== BƯỚC 2: TẠO DATA PIPELINE ========================

def create_datasets():
    """Tạo tf.data.Dataset cho train/val/test."""
    print("\n" + "=" * 60)
    print("BƯỚC 2: Tạo data pipeline")
    print("=" * 60)

    train_dir = os.path.join(OUTPUT_DIR, "train")
    val_dir = os.path.join(OUTPUT_DIR, "val")
    test_dir = os.path.join(OUTPUT_DIR, "test")

    train_dataset = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        shuffle=True,
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        label_mode='categorical',
    )

    val_dataset = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        shuffle=True,
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        label_mode='categorical',
    )

    test_dataset = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        label_mode='categorical',
    )

    class_names = train_dataset.class_names
    print(f"  Classes: {class_names}")
    print(f"  Số class: {len(class_names)}")

    # Prefetch cho performance
    AUTOTUNE = tf.data.AUTOTUNE
    train_dataset = train_dataset.prefetch(buffer_size=AUTOTUNE)
    val_dataset = val_dataset.prefetch(buffer_size=AUTOTUNE)
    test_dataset = test_dataset.prefetch(buffer_size=AUTOTUNE)

    return train_dataset, val_dataset, test_dataset, class_names


# ======================== BƯỚC 3: XÂY DỰNG MODEL ========================

def build_model():
    """
    Xây dựng model EfficientNetB0 + head cải tiến:
    - Data augmentation mạnh hơn (RandomZoom, RandomTranslation)
    - Thêm Dense hidden layer + Dropout
    """
    print("\n" + "=" * 60)
    print("BƯỚC 3: Xây dựng model")
    print("=" * 60)

    # ---- Data Augmentation cải tiến ----
    data_augmentation = tf.keras.Sequential([
        layers.RandomFlip('horizontal'),
        layers.RandomRotation(0.3),                  
        layers.RandomBrightness(0.5),
        layers.RandomContrast(0.5),
        layers.RandomZoom(                           
            height_factor=(-0.2, 0.2),
            width_factor=(-0.2, 0.2),
        ),
        layers.RandomTranslation(0.1, 0.1),         
        layers.GaussianNoise(0.1),
    ], name="data_augmentation")

    # ---- Preprocessing ----
    preprocess_input = tf.keras.applications.efficientnet.preprocess_input

    # ---- Base model (EfficientNetB0) ----
    base_model = tf.keras.applications.EfficientNetB0(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet',
    )
    base_model.trainable = False  # Đóng băng khi bắt đầu

    # ---- Xây model ----
    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = data_augmentation(inputs)
    x = preprocess_input(x)
    x = base_model(x, training=False)

    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)                      # Tăng từ 0.2 → 0.3
    x = layers.Dense(128, activation='relu')(x)      # MỚI: hidden layer
    x = layers.Dropout(0.2)(x)                      # MỚI: dropout
    outputs = layers.Dense(6)(x)                     # 6 classes (logits)

    model = models.Model(inputs=inputs, outputs=outputs)

    print(f"  Base model layers: {len(base_model.layers)}")
    print(f"  Total model params: {model.count_params():,}")
    print(f"  Trainable params: {sum(tf.keras.backend.count_params(w) for w in model.trainable_weights):,}")

    return model, base_model


# ======================== BƯỚC 4: TRAINING ========================

def train_model(model, base_model, train_dataset, val_dataset):
    """
    Training 2 giai đoạn:
    1. Train head (base_model đóng băng)
    2. Fine-tune top layers của base_model
    """
    print("\n" + "=" * 60)
    print("BƯỚC 4: Training")
    print("=" * 60)

    # ---- Giai đoạn 1: Train head ----
    print("\n--- Giai đoạn 1: Train head (base model frozen) ---")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=BASE_LEARNING_RATE),
        loss=tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=0.1),
        metrics=['accuracy'],
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            patience=3,
            restore_best_weights=True,
            monitor='val_loss',
        ),
    ]

    history = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=INITIAL_EPOCHS,
        callbacks=callbacks,
    )

    print(f"\n  Giai đoạn 1 hoàn tất!")
    print(f"  Best val_accuracy: {max(history.history['val_accuracy']):.4f}")

    # ---- Giai đoạn 2: Fine-tune ----
    print("\n--- Giai đoạn 2: Fine-tune top layers ---")
    base_model.trainable = True

    # Đóng băng 100 layer đầu, chỉ train các layer cuối
    fine_tune_at = 100
    for layer_item in base_model.layers[:fine_tune_at]:
        layer_item.trainable = False

    trainable_count = sum(tf.keras.backend.count_params(w) for w in model.trainable_weights)
    print(f"  Trainable params sau fine-tune: {trainable_count:,}")

    model.compile(
        optimizer=tf.keras.optimizers.RMSprop(learning_rate=BASE_LEARNING_RATE / 10),
        loss=tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=0.1),
        metrics=['accuracy'],
    )

    total_epochs = INITIAL_EPOCHS + FINE_TUNE_EPOCHS

    callbacks_ft = [
        tf.keras.callbacks.EarlyStopping(
            patience=3,
            restore_best_weights=True,
            monitor='val_loss',
        ),
    ]

    history_fine = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=total_epochs,
        initial_epoch=len(history.epoch),
        callbacks=callbacks_ft,
    )

    print(f"\n  Fine-tuning hoàn tất!")
    print(f"  Best val_accuracy: {max(history_fine.history['val_accuracy']):.4f}")

    return history, history_fine


# ======================== BƯỚC 5: ĐÁNH GIÁ & LƯU ========================

def evaluate_and_save(model, test_dataset, class_names):
    """Đánh giá model trên tập test và lưu."""
    print("\n" + "=" * 60)
    print("BƯỚC 5: Đánh giá & Lưu model")
    print("=" * 60)

    loss, accuracy = model.evaluate(test_dataset)
    print(f"  Test loss: {loss:.4f}")
    print(f"  Test accuracy: {accuracy:.4f}")

    # Lưu model
    model.save(MODEL_OUTPUT)
    print(f"\n  Model đã lưu tại: {MODEL_OUTPUT}")

    # In class mapping
    print(f"\n  Class mapping:")
    for i, name in enumerate(class_names):
        print(f"    {i}: {name}")

    return accuracy


# ======================== MAIN ========================

def main():
    print("\n" + "=" * 60)
    print("  PLANT DISEASE RECOGNITION - IMPROVED TRAINING")
    print("  Dataset: PlantVillage (6 Tomato classes)")
    print("  Backbone: EfficientNetB0 (ImageNet pretrained)")
    print("=" * 60)

    # Kiểm tra GPU
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"\n  GPU detected: {gpus}")
        # Memory growth để tránh OOM
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    else:
        print("\n  [WARNING] Không phát hiện GPU! Training sẽ chạy trên CPU (rất chậm).")
        print("  Nên sử dụng Google Colab để train nhanh hơn.")

    # Chuẩn bị dataset
    prepare_dataset()

    # Tạo data pipeline
    train_dataset, val_dataset, test_dataset, class_names = create_datasets()

    # Xây model
    model, base_model = build_model()

    # Training
    train_model(model, base_model, train_dataset, val_dataset)

    # Đánh giá & lưu
    accuracy = evaluate_and_save(model, test_dataset, class_names)

    print("\n" + "=" * 60)
    print(f"  HOÀN TẤT! Test accuracy = {accuracy:.4f}")
    print(f"  Model: {MODEL_OUTPUT}")
    print("=" * 60)


if __name__ == "__main__":
    main()
