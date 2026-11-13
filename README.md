# RetainIQ – Customer Intelligence & Retention

An end-to-end Machine Learning and Full-Stack application that predicts customer churn, identifies high-risk customers, and provides customer-specific retention recommendations using Retrieval-Augmented Generation (RAG).

## Overview

RetainIQ helps businesses identify customers who are likely to leave and understand how to approach customer retention.

The application combines a Machine Learning pipeline with an interactive dashboard and an LLM-powered retention assistant.

### Key Features

- **Customer Churn Prediction:** Predicts customer churn probability using a trained Random Forest classifier.
- **Customer Risk Segmentation:** Categorizes customers into Low, Medium, and High-risk groups.
- **Interactive Dashboard:** Displays customer information, churn probabilities, and overall business metrics.
- **Customer-Specific AI Assistant:** Uses customer attributes, ML predictions, and retrieved retention knowledge to generate contextual recommendations.
- **RAG Pipeline:** Retrieves relevant information from PDF-based retention knowledge using ChromaDB.
- **LLM Observability:** Integrates LangSmith to trace and debug RAG executions.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React |
| Backend | Python, FastAPI |
| Machine Learning | Pandas, NumPy, Scikit-learn |
| ML Models | Logistic Regression, Random Forest |
| Data Processing | Scikit-learn Pipelines, StandardScaler, OneHotEncoder |
| LLM | OpenAI GPT-4o-mini |
| RAG | ChromaDB, Sentence Transformers |
| Embedding Model | all-MiniLM-L6-v2 |
| Observability | LangSmith |
| Model Persistence | Joblib |

## Machine Learning Pipeline

### Dataset

The project uses the [E-Commerce Customer Churn Dataset](https://www.kaggle.com/datasets/ankitverma2010/ecommerce-customer-churn-analysis-and-prediction).

- Total records: 5,630
- Total features: 20
- Target variable: `Churn`
- Churned customers: 948 (16.84%)
- Non-churned customers: 4,682 (83.16%)

### Data Preprocessing

The preprocessing pipeline includes:

- Missing-value imputation using median for numerical features.
- Missing-value imputation using most-frequent values for categorical features.
- StandardScaler for numerical features.
- OneHotEncoder for categorical features.
- CustomerID excluded from model training.

### Model Training and Evaluation

Two classification algorithms were compared:

1. Logistic Regression – Baseline model.
2. Random Forest – Final selected model.

Random Forest achieved a mean 5-fold cross-validation ROC-AUC of approximately **0.977 ± 0.0056**.

The trained preprocessing and prediction pipeline is saved using Joblib as:

`random_forest_churn_pipeline.joblib`

The saved pipeline is loaded by the FastAPI backend and reused for customer predictions without retraining on every API request.

### Evaluation Metrics

- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC
- Confusion Matrix

**Note:** Cross-validation performance is reported separately from dashboard predictions. Dashboard metrics are calculated across the available customer dataset and should not be interpreted as independent test-set evaluation results.

## Application Architecture

```text
                 React Frontend
                       |
                       | REST API
                       |
                 FastAPI Backend
                       |
             ----------------------
             |                    |
       ML Prediction          RAG Assistant
             |                    |
       Saved ML Model        User Question
        (Joblib)                  |
             |              Sentence Transformer
       Churn Probability          |
       Risk Classification    ChromaDB
                                  |
                           Retrieved PDF Chunks
                                  |
                             OpenAI GPT-4o-mini
                                  |
                           Contextual Response
                                  |
                              React UI
```

## RAG-Based Customer Retention Assistant

RetainIQ includes a Retrieval-Augmented Generation pipeline that provides retention guidance using a PDF knowledge base.

### How RAG Works

1. **Document Ingestion:** Extract text from the customer retention PDF.
2. **Chunking:** Divide extracted text into smaller chunks.
3. **Embedding Generation:** Generate vector embeddings using Sentence Transformers (`all-MiniLM-L6-v2`).
4. **Vector Storage:** Store embeddings and document metadata in persistent ChromaDB.
5. **Retrieval:** Convert the user's question into an embedding and retrieve the most relevant document chunks.
6. **Answer Generation:** Pass the retrieved context and user question to OpenAI GPT-4o-mini to generate a grounded response.

### Customer-Specific RAG

For customer-specific questions, the assistant receives:

- Customer attributes from the dataset.
- Churn probability and risk level predicted by the Random Forest model.
- Relevant retention knowledge retrieved from the PDF.

The LLM uses this information to generate contextual retention recommendations.

**Important:** The assistant does not currently use SHAP or another feature-attribution method to identify which features drove an individual model prediction. Its recommendations are contextual, not causal explanations of the model.

## LangSmith – LLM Observability

LangSmith is integrated to trace and debug the RAG workflow.

It helps inspect:

- RAG execution traces.
- Retrieval execution.
- LLM inputs and outputs.
- Execution latency.
- OpenAI model calls.
- Errors and execution flow.

The current implementation instruments the OpenAI SDK using LangSmith's `wrap_openai` and `@traceable` decorators.

## Risk Classification

Customers are categorized using churn probability:

| Risk Level | Churn Probability |
|---|---|
| Low | Below 30% |
| Medium | 30% to below 70% |
| High | 70% or above |

These are prototype business-defined thresholds and can be adjusted based on retention costs and business requirements.

## Project Structure

```text
ecommerce-customer-intelligence/
│
├── 01_eda.ipynb
├── backend/
│   ├── main.py
│   ├── rag.py
│   ├── ingest.py
│   ├── RetainIQ_Customer_Retention_Knowledge_Base.pdf
│   └── random_forest_churn_pipeline.joblib
│
├── frontend/
│   └── React application
│
├── requirements.txt
├── .gitignore
└── README.md
```

*The structure above is representative; adjust filenames if your local project differs.*

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/vaibhvbh77/RetainIQ.git

cd RetainIQ
```

### 2. Backend Setup

Create and activate a virtual environment:

```bash
python -m venv .venv

source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key

LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=RetainIQ
```

Start the FastAPI server:

```bash
uvicorn backend.main:app --reload
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the React application:

```bash
npm run dev
```

### 4. RAG Knowledge Base

Run the document ingestion script when setting up the local knowledge base:

```bash
python backend/ingest.py
```

Ensure the retention PDF is available at the expected backend path.

## Future Improvements

- Add SHAP-based model explainability.
- Implement query routing between customer analytics and document-based RAG.
- Add automated evaluation of retrieval relevance and answer groundedness.
- Experiment with XGBoost and LightGBM.
- Add retention campaign outcome tracking.
- Improve prediction monitoring and model retraining workflows.

## Author

**Vaibhav Bhatnagar**

M.E. Computer Science, BITS Pilani

GitHub: [vaibhvbh77](https://github.com/vaibhvbh77)

---

*RetainIQ – Turning customer data into actionable retention insights.*