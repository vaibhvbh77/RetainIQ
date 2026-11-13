import { useEffect, useRef, useState } from "react";
import "./App.css";
import PredictionForm from "./PredictionForm";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionText, setActionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const predictionPanelRef = useRef(null);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function loadMetrics() {
    const data = await request("/api/metrics");
    setMetrics(data);
  }

  async function loadActions() {
    const data = await request("/api/retention-actions");
    setActions(data.actions);
  }

  async function searchCustomers(query = "") {
    const data = await request(
      `/api/customers?search=${encodeURIComponent(query)}&limit=100`
    );

    setCustomers(data.customers);
  }

  async function selectCustomer(customer) {
    setSelected(customer);
    setPrediction({
      predicted_churn: customer.churn_probability >= 0.5 ? 1 : 0,
      churn_probability: customer.churn_probability,
      risk_level: customer.risk_level,
    });
    setError("");

    // The list already contains the model prediction.
    // No second prediction request is needed.
    setTimeout(() => {
      predictionPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function createAction(event) {
    event.preventDefault();

    if (!selected || !actionText.trim()) return;

    try {
      setError("");

      await request("/api/retention-actions", {
        method: "POST",
        body: JSON.stringify({
          customer_id: String(selected.CustomerID),
          action: actionText.trim(),
          status: "Pending",
        }),
      });

      setActionText("");
      await loadActions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateAction(id, status) {
    try {
      setError("");

      await request(
        `/api/retention-actions/${encodeURIComponent(id)}?status=${encodeURIComponent(status)}`,
        { method: "PATCH" }
      );

      await loadActions();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    Promise.all([
      loadMetrics(),
      loadActions(),
      searchCustomers(),
    ]).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(search).catch((err) => setError(err.message));
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const customerActions = actions.filter(
    (action) =>
      selected &&
      String(action.customer_id) === String(selected.CustomerID)
  );

  const recommendations = selected
    ? getRecommendations(selected)
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>
          <div>
            <h2>RetainIQ</h2>
            <p>Customer intelligence</p>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav>
          <a className="nav-item active" href="#overview">
            ▦ Overview
          </a>
          <a className="nav-item" href="#customers">
            ♙ Customers
          </a>
          <a className="nav-item" href="#actions">
            ↗ Retention actions
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">RM</div>
          <div>
            <strong>Retention Manager</strong>
            <p>Employee workspace</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Overview</p>
            <h1>Customer retention</h1>
          </div>
          <div className="user-badge">RM</div>
        </header>

        <div className="demo-banner">
          <span className="demo-dot" />
          <div>
            <strong>Connected to RetainIQ API</strong>
            <span>
              Actual customer records with model-generated risk estimates.
            </span>
          </div>
        </div>

        {error && (
          <div className="prediction-error" role="alert">
            {error}
          </div>
        )}

        <section id="overview">
          <div className="section-heading">
            <div>
              <h2>Overview</h2>
              <p>Understand which customers need attention.</p>
            </div>
            <span className="period-label">LIVE API DATA</span>
          </div>

          <div className="metrics-grid">
            <Metric
              label="Customers monitored"
              value={metrics?.customers_loaded}
            />
            <Metric label="High risk" value={metrics?.high_risk} />
            <Metric label="Medium risk" value={metrics?.medium_risk} />
            <Metric
              label="Average predicted churn"
              value={
                metrics
                  ? `${(
                      metrics.average_predicted_churn_probability * 100
                    ).toFixed(1)}%`
                  : "—"
              }
            />
          </div>

          <p className="table-footnote">
            {metrics?.note || "Loading model metrics..."}
          </p>
        </section>

        <section id="customers" className="customer-section">
          <div className="section-heading">
            <div>
              <h2>Prioritized customer queue</h2>
              <p>
                Highest predicted churn probabilities appear first. Select a
                customer to see insights and retention recommendations.
              </p>
            </div>

            <span className="customer-count">
              {customers.length} shown
            </span>
          </div>

          <div className="table-controls">
            <input
              type="search"
              placeholder="Search customer ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Tenure</th>
                  <th>Complaint</th>
                  <th>Satisfaction</th>
                  <th>Churn probability</th>
                  <th>Risk</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.CustomerID}
                    className="customer-row"
                    onClick={() => selectCustomer(customer)}
                    aria-selected={
                      selected?.CustomerID === customer.CustomerID
                    }
                    title="View customer insights and recommendations"
                  >
                    <td>
                      <strong>{customer.CustomerID}</strong>
                    </td>

                    <td>
                      {customer.Tenure ?? "—"} months
                    </td>

                    <td>
                      {customer.Complain === 1
                        ? "Yes"
                        : customer.Complain === 0
                          ? "No"
                          : "Unknown"}
                    </td>

                    <td>
                      {customer.SatisfactionScore ?? "—"}/5
                    </td>

                    <td>
                      <div className="risk-cell">
                        <div className="risk-track">
                          <div
                            className={`risk-fill ${customer.risk_level.toLowerCase()}`}
                            style={{
                              width: `${
                                customer.churn_probability * 100
                              }%`,
                            }}
                          />
                        </div>

                        <span>
                          {(
                            customer.churn_probability * 100
                          ).toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`risk-badge ${customer.risk_level.toLowerCase()}`}
                      >
                        {customer.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}

                {customers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No matching customers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="table-footnote">
            Showing up to 100 matching customers. Risk scores are model
            estimates, not guarantees of future churn.
          </p>
        </section>

        {selected && (
          <section
            ref={predictionPanelRef}
            className="customer-section"
            style={{ scrollMarginTop: "24px" }}
          >
            <div className="section-heading">
              <div>
                <h2>Customer {selected.CustomerID}</h2>
                <p>Risk assessment and recommended next steps.</p>
              </div>

              <button
                className="select-customer-button"
                onClick={() => {
                  setSelected(null);
                  setPrediction(null);
                }}
              >
                Close details
              </button>
            </div>

            {prediction && (
              <div className="prediction-result">
                <p className="eyebrow">MODEL PREDICTION</p>

                <h3>
                  {prediction.predicted_churn === 1
                    ? "Customer predicted to churn"
                    : "Customer predicted not to churn"}
                </h3>

                <p className="prediction-probability">
                  {(prediction.churn_probability * 100).toFixed(1)}%
                </p>

                <span
                  className={`risk-badge ${prediction.risk_level.toLowerCase()}`}
                >
                  {prediction.risk_level} risk
                </span>

                <p className="result-disclaimer">
                  This is a model estimate, not a guarantee of future behavior.
                </p>
              </div>
            )}

            <h3 style={{ marginTop: 26 }}>Why this customer needs attention</h3>

            <ul className="recommendation-list">
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 style={{ marginTop: 26 }}>Suggested retention actions</h3>

            <ul className="recommendation-list">
              {getActions(selected).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 style={{ marginTop: 26 }}>Record an employee action</h3>

            <form className="table-controls" onSubmit={createAction}>
              <input
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
                placeholder="e.g. Review complaint and contact customer"
                required
              />

              <button className="predict-button" type="submit">
                Save action
              </button>
            </form>

            <div id="actions">
              <h3>Action history</h3>

              {customerActions.length === 0 && (
                <p className="table-footnote">
                  No actions recorded for this customer yet.
                </p>
              )}

              {customerActions.map((action) => (
                <div className="retention-action" key={action.id}>
                  <div>
                    <strong>{action.action}</strong>
                    <p>
                      {action.status} ·{" "}
                      {new Date(action.created_at).toLocaleString()}
                    </p>
                  </div>

                  <select
                    value={action.status}
                    onChange={(event) =>
                      updateAction(action.id, event.target.value)
                    }
                    aria-label={`Update status for ${action.action}`}
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>
              ))}
            </div>
            <PredictionForm/>
          </section>
        )}

        <footer>
          RetainIQ · Customer intelligence and retention prototype
        </footer>
      </main>
    </div>
  );
}

function getRecommendations(customer) {
  const recommendations = [];

  if (customer.Tenure !== null && customer.Tenure <= 1) {
    recommendations.push(
      "Early-tenure customer: review the onboarding and first-purchase experience."
    );
  }

  if (customer.Complain === 1) {
    recommendations.push(
      "Complaint recorded: review the complaint and verify whether it has been resolved."
    );
  }

  if (
    customer.SatisfactionScore !== null &&
    customer.SatisfactionScore <= 2
  ) {
    recommendations.push(
      "Low satisfaction score: contact the customer to understand their experience."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No specific EDA-based warning signal identified from these fields. Review the customer's activity and recent experience."
    );
  }

  return recommendations;
}

function getActions(customer) {
  const actions = [];

  if (customer.Complain === 1) {
    actions.push("Review and address the recorded complaint.");
  }

  if (customer.Tenure !== null && customer.Tenure <= 1) {
    actions.push("Arrange an early-life customer follow-up.");
  }

  if (
    customer.SatisfactionScore !== null &&
    customer.SatisfactionScore <= 2
  ) {
    actions.push("Investigate dissatisfaction and agree on a resolution.");
  }

  if (customer.risk_level === "High") {
    actions.push(
      "Prioritize a personal follow-up; consider a targeted incentive only if appropriate."
    );
  } else if (customer.risk_level === "Medium") {
    actions.push("Review recent activity and monitor for additional risk signals.");
  }

  if (actions.length === 0) {
    actions.push("Continue routine monitoring and review customer feedback.");
  }

  return [...new Set(actions)];
}

function Metric({ label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">↗</span>
      </div>
      <h3>{value ?? "—"}</h3>
      <p>Calculated by the backend</p>
    </article>
  );
}