
from pathlib import Path
import json
import uuid
from datetime import datetime, timezone

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# --------------------------------------------------
# 1. PATHS AND MODEL LOADING
# --------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent

MODEL_PATH = ROOT / "random_forest_churn_pipeline.joblib"
DATA_PATH = ROOT / "E Commerce Dataset.xlsx"
ACTIONS_PATH = ROOT / "backend" / "retention_actions.json"


# Load trained model and customer dataset
model = joblib.load(MODEL_PATH)

df = pd.read_excel(
    DATA_PATH,
    sheet_name="E Comm"
)

df["CustomerID"] = df["CustomerID"].astype(str)

FEATURES = list(model.feature_names_in_)


# --------------------------------------------------
# 2. FASTAPI INITIALIZATION
# --------------------------------------------------

app = FastAPI(
    title="RetainIQ API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# 3. REQUEST MODELS
# --------------------------------------------------

class RetentionAction(BaseModel):
    customer_id: str
    action: str = Field(min_length=2, max_length=300)
    status: str = "Pending"


class CustomerQuestion(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=1000
    )


# --------------------------------------------------
# 4. HELPER FUNCTIONS
# --------------------------------------------------

def get_customer(customer_id: str):

    matches = df[
        df["CustomerID"] == str(customer_id)
    ]

    if matches.empty:
        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )

    return matches.iloc[0]


def predict_row(row):

    customer_df = pd.DataFrame(
        [
            {
                feature: row[feature]
                for feature in FEATURES
            }
        ],
        columns=FEATURES,
    )

    probabilities = model.predict_proba(customer_df)[0]

    prediction = int(
        model.predict(customer_df)[0]
    )

    probability = float(
        probabilities[
            list(model.classes_).index(1)
        ]
    )

    risk = (
        "High" if probability >= 0.70
        else "Medium" if probability >= 0.30
        else "Low"
    )

    return {
        "predicted_churn": prediction,
        "churn_probability": round(probability, 4),
        "risk_level": risk,
        "message": (
            "Customer predicted to churn"
            if prediction == 1
            else "Customer predicted not to churn"
        ),
    }


def load_actions():

    if not ACTIONS_PATH.exists():
        return []

    with ACTIONS_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


def save_actions(actions):

    ACTIONS_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with ACTIONS_PATH.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            actions,
            file,
            indent=2
        )


# --------------------------------------------------
# 5. HOME AND MODEL INFORMATION
# --------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "RetainIQ API",
        "model_loaded": True
    }


@app.get("/api/model-info")
def model_info():

    return {
        "model_type": type(model).__name__,
        "model_loaded": True,
        "number_of_features": len(FEATURES),
    }


# --------------------------------------------------
# 6. CUSTOMER ENDPOINTS
# --------------------------------------------------

@app.get("/api/customers")
def customers(
    search: str = "",
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):

    results = df

    if search.strip():

        results = results[
            results["CustomerID"].str.contains(
                search.strip(),
                case=False,
                regex=False
            )
        ]

    page = results.iloc[
        offset:offset + limit
    ]

    features = page[FEATURES]

    probabilities = model.predict_proba(features)

    churn_index = list(
        model.classes_
    ).index(1)

    churn_probabilities = probabilities[
        :, churn_index
    ]

    records = []

    for (_, row), probability in zip(
        page.iterrows(),
        churn_probabilities
    ):

        probability = float(probability)

        risk = (
            "High" if probability >= 0.70
            else "Medium" if probability >= 0.30
            else "Low"
        )

        records.append({

            "CustomerID": str(row["CustomerID"]),

            "Tenure": (
                None if pd.isna(row["Tenure"])
                else row["Tenure"]
            ),

            "Complain": (
                None if pd.isna(row["Complain"])
                else row["Complain"]
            ),

            "SatisfactionScore": (
                None if pd.isna(row["SatisfactionScore"])
                else row["SatisfactionScore"]
            ),

            "OrderCount": (
                None if pd.isna(row["OrderCount"])
                else row["OrderCount"]
            ),

            "churn_probability": round(
                probability,
                4
            ),

            "risk_level": risk,
        })

    records.sort(
        key=lambda customer: customer["churn_probability"],
        reverse=True
    )

    return {
        "total_matches": len(results),
        "customers": records,
    }


@app.get("/api/customers/{customer_id}")
def customer_detail(customer_id: str):

    row = get_customer(customer_id)

    record = row[
        ["CustomerID"] + FEATURES
    ].to_dict()

    record = {
        key: (
            None if pd.isna(value)
            else value
        )
        for key, value in record.items()
    }

    return {
        "customer": record
    }


@app.post("/api/customers/{customer_id}/predict")
def predict_customer(customer_id: str):

    row = get_customer(customer_id)

    return {
        "customer_id": customer_id,
        **predict_row(row),
    }


# --------------------------------------------------
# 7. CUSTOMER METRICS
# --------------------------------------------------

@app.get("/api/metrics")
def metrics():

    probabilities = model.predict_proba(
        df[FEATURES]
    )

    churn_class_index = list(
        model.classes_
    ).index(1)

    risks = probabilities[
        :, churn_class_index
    ]

    high = int(
        (risks >= 0.70).sum()
    )

    medium = int(
        (
            (risks >= 0.30) &
            (risks < 0.70)
        ).sum()
    )

    low = int(
        (risks < 0.30).sum()
    )

    return {

        "customers_loaded": int(len(df)),

        "high_risk": high,

        "medium_risk": medium,

        "low_risk": low,

        "average_predicted_churn_probability": round(
            float(risks.mean()),
            4
        ),

        "risk_thresholds": {
            "low": "Below 30%",
            "medium": "30% to below 70%",
            "high": "70% or above",
        },

        "note": (
            "Model estimates on dataset records; "
            "not verified future churn."
        ),
    }


# --------------------------------------------------
# 8. RETENTION ACTION ENDPOINTS
# --------------------------------------------------

@app.get("/api/retention-actions")
def list_retention_actions():

    return {
        "actions": load_actions()
    }


@app.post(
    "/api/retention-actions",
    status_code=201
)
def create_retention_action(
    action: RetentionAction
):

    get_customer(action.customer_id)

    if action.status not in {
        "Pending",
        "In Progress",
        "Completed"
    }:

        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    actions = load_actions()

    new_action = {

        "id": str(uuid.uuid4()),

        **action.model_dump(),

        "created_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }

    actions.insert(0, new_action)

    save_actions(actions)

    return new_action


@app.patch("/api/retention-actions/{action_id}")
def update_retention_action(
    action_id: str,
    status: str = Query(...)
):

    if status not in {
        "Pending",
        "In Progress",
        "Completed"
    }:

        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    actions = load_actions()

    for action in actions:

        if action["id"] == action_id:

            action["status"] = status

            save_actions(actions)

            return action

    raise HTTPException(
        status_code=404,
        detail="Action not found"
    )


# --------------------------------------------------
# 9. CUSTOMER-AWARE RAG ENDPOINT
# --------------------------------------------------

@app.post("/api/customers/{customer_id}/ask")
def ask_customer(
    customer_id: str,
    request: CustomerQuestion
):

    # Step 1: Fetch customer
    row = get_customer(customer_id)

    # Step 2: Extract customer features
    customer_data = {}

    for key, value in row[FEATURES].to_dict().items():

        if pd.isna(value):
            customer_data[key] = None

        elif hasattr(value, "item"):
            customer_data[key] = value.item()

        else:
            customer_data[key] = value

    # Step 3: Generate churn prediction
    prediction = predict_row(row)

    # Step 4: Combine customer data and prediction
    customer_context = {

        "CustomerID": customer_id,

        **customer_data,

        **prediction
    }

    # Step 5: Call customer-aware RAG
    try:

        from rag import ask_customer_retainiq

        result = ask_customer_retainiq(
            request.question,
            customer_context
        )

        return {

            "customer_id": customer_id,

            "customer_risk": prediction,

            "answer": result["answer"],

            "sources": result["sources"]
        }

    except ImportError:

        raise HTTPException(
            status_code=503,
            detail="RAG module or dependencies are unavailable."
        )

    except Exception:

        raise HTTPException(
            status_code=500,
            detail="Customer AI assistant failed. Check backend logs."
        )
