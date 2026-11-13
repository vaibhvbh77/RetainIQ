import { useState } from "react";

const API_URL = "http://127.0.0.1:8000/api/predict";

const initialCustomer = {
  Tenure: 1,
  PreferredLoginDevice: "Mobile Phone",
  CityTier: 1,
  WarehouseToHome: 10,
  PreferredPaymentMode: "Debit Card",
  Gender: "Male",
  HourSpendOnApp: 3,
  NumberOfDeviceRegistered: 3,
  PreferedOrderCat: "Laptop & Accessory",
  SatisfactionScore: 2,
  MaritalStatus: "Single",
  NumberOfAddress: 2,
  Complain: 1,
  OrderAmountHikeFromlastYear: 11,
  CouponUsed: 1,
  OrderCount: 1,
  DaySinceLastOrder: 5,
  CashbackAmount: 150,
};

export default function PredictionForm() {
  const [customer, setCustomer] = useState(initialCustomer);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setCustomer((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    // Convert numeric inputs from strings to numbers.
    const numericFields = [
      "Tenure",
      "CityTier",
      "WarehouseToHome",
      "HourSpendOnApp",
      "NumberOfDeviceRegistered",
      "SatisfactionScore",
      "NumberOfAddress",
      "Complain",
      "OrderAmountHikeFromlastYear",
      "CouponUsed",
      "OrderCount",
      "DaySinceLastOrder",
      "CashbackAmount",
    ];

    const payload = { ...customer };

    numericFields.forEach((field) => {
      payload[field] = Number(payload[field]);
    });

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail
            ? JSON.stringify(data.detail)
            : "Prediction request failed."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the prediction API. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { name: "Tenure", label: "Tenure (months)", type: "number" },
    {
      name: "PreferredLoginDevice",
      label: "Preferred login device",
      options: ["Mobile Phone", "Computer"],
    },
    { name: "CityTier", label: "City tier", type: "number" },
    {
      name: "WarehouseToHome",
      label: "Warehouse to home distance",
      type: "number",
    },
    {
      name: "PreferredPaymentMode",
      label: "Preferred payment mode",
      options: [
        "Debit Card",
        "Credit Card",
        "E wallet",
        "UPI",
        "COD",
        "Cash on Delivery",
      ],
    },
    {
      name: "Gender",
      label: "Gender",
      options: ["Male", "Female"],
    },
    {
      name: "HourSpendOnApp",
      label: "Hours spent on app",
      type: "number",
    },
    {
      name: "NumberOfDeviceRegistered",
      label: "Registered devices",
      type: "number",
    },
    {
      name: "PreferedOrderCat",
      label: "Preferred order category",
      options: [
        "Laptop & Accessory",
        "Mobile Phone",
        "Fashion",
        "Grocery",
        "Others",
      ],
    },
    {
      name: "SatisfactionScore",
      label: "Satisfaction score (1–5)",
      type: "number",
    },
    {
      name: "MaritalStatus",
      label: "Marital status",
      options: ["Single", "Married", "Divorced"],
    },
    {
      name: "NumberOfAddress",
      label: "Number of addresses",
      type: "number",
    },
    {
      name: "Complain",
      label: "Has complaint?",
      options: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
      ],
    },
    {
      name: "OrderAmountHikeFromlastYear",
      label: "Order amount increase (%)",
      type: "number",
    },
    { name: "CouponUsed", label: "Coupons used", type: "number" },
    { name: "OrderCount", label: "Order count", type: "number" },
    {
      name: "DaySinceLastOrder",
      label: "Days since last order",
      type: "number",
    },
    {
      name: "CashbackAmount",
      label: "Cashback amount",
      type: "number",
    },
  ];

  return (
    <section className="prediction-section">
      <div className="section-heading">
        <div>
          <h2>Predict customer churn</h2>
          <p>
            Submit customer details to your trained Random Forest model.
          </p>
        </div>
        <span className="period-label">LIVE MODEL API</span>
      </div>

      <form onSubmit={handleSubmit} className="prediction-form">
        <div className="prediction-grid">
          {fields.map((field) => (
            <label className="prediction-field" key={field.name}>
              <span>{field.label}</span>

              {field.options ? (
                <select
                  name={field.name}
                  value={customer[field.name]}
                  onChange={handleChange}
                  required
                >
                  {field.options.map((option) => {
                    const item =
                      typeof option === "object"
                        ? option
                        : { label: option, value: option };

                    return (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="number"
                  name={field.name}
                  value={customer[field.name]}
                  onChange={handleChange}
                  min={
                    field.name === "SatisfactionScore"
                      ? 1
                      : field.name === "CityTier"
                        ? 1
                        : 0
                  }
                  max={
                    field.name === "SatisfactionScore"
                      ? 5
                      : field.name === "Complain"
                        ? 1
                        : undefined
                  }
                  step="any"
                  required
                />
              )}
            </label>
          ))}
        </div>

        <button
          className="predict-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Analyzing customer..." : "Predict churn →"}
        </button>
      </form>

      {error && (
        <div className="prediction-error" role="alert">
          <strong>Prediction failed</strong>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="prediction-result" aria-live="polite">
          <p className="eyebrow">MODEL PREDICTION</p>

          <h3>
            {result.predicted_churn === 1
              ? "Customer predicted to churn"
              : "Customer predicted not to churn"}
          </h3>

          <p className="prediction-probability">
            {(result.churn_probability * 100).toFixed(1)}%
          </p>

          <p className="result-caption">
            Estimated churn probability
          </p>

          <span
            className={`risk-badge ${result.risk_level.toLowerCase()}`}
          >
            {result.risk_level} risk
          </span>

          <p className="result-disclaimer">
            This is a model estimate, not a guarantee of customer behavior.
          </p>
        </div>
      )}
    </section>
  );
}