# 🩺 Cervical Cancer Severity Stratification and Spread Analysis Using Medical Images

## 📌 Project Overview

Cervical cancer is one of the major health concerns among women worldwide. Early and accurate identification of abnormal cervical cells can help in timely diagnosis and treatment.

This project presents a deep learning-based system for analyzing cervical cell images and classifying them into different cell types. The system also includes a cervical/non-cervical image classification stage to improve the reliability of the analysis.

The project uses a **ResNet50-based deep learning model** for image classification and provides a web-based interface using **React** and **FastAPI**.

---

## 🎯 Objectives

- Detect whether an input image is cervical or non-cervical.
- Classify cervical cell images into different cell categories.
- Analyze the severity-related characteristics of cervical cells.
- Provide predictions through an easy-to-use web interface.
- Develop a practical deep learning-based medical image analysis system.

---

## 🧠 Methodology

The system follows these major stages:

1. **Input Image**
2. **Image Preprocessing**
3. **Cervical / Non-Cervical Classification**
4. **Cervical Cell Classification**
5. **Severity Analysis**
6. **Prediction Display**

### Workflow

```text
Input Medical Image
        ↓
Image Preprocessing
        ↓
Cervical / Non-Cervical Classification
        ↓
Cervical Cell Classification
        ↓
ResNet50 Deep Learning Model
        ↓
Predicted Cell Category
        ↓
Result Display

