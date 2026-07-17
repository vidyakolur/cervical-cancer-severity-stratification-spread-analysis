import React, { useState } from 'react';
import './App.css'; // Uses existing styles where applicable

const PathologistReviewPanel = ({ aiResult, patientId, onSubmit }) => {
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fallback for missing AI result
  if (!aiResult) return null;

  const handleSubmit = async () => {
    if (!decision || !confirmed) return;
    setLoading(true);

    const payload = {
      patient_id: patientId || "UNKNOWN",
      ai_result: {
        prediction: aiResult.prediction,
        confidence: aiResult.confidence,
        severity: aiResult.severity
      },
      doctor_decision: decision,
      notes: notes,
      reviewed_by: "Dr. Admin" // Hardcoded for demo, normally from auth context
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.status === "success") {
        setSubmitted(true);
        if (onSubmit) onSubmit(data.data); // pass data back to parent
      } else {
        alert("Failed to submit review.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    }

    setLoading(false);
  };

  return (
    <div className="pathologist-form" style={{ marginTop: '20px' }}>
      <div className="panel-header" style={{ padding: '0 0 10px 0', background: 'transparent' }}>
        <h3>Pathologist Review</h3>
      </div>
      
      {/* Read-only AI Result Summary */}
      <div style={{ marginBottom: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <div><strong>AI Finding:</strong> {aiResult.prediction}</div>
        <div><strong>Confidence:</strong> {(aiResult.confidence * 100).toFixed(1)}%</div>
        <div><strong>Severity:</strong> {aiResult.severity}</div>
      </div>

      {submitted ? (
        <div className="status-banner severity-low" style={{ marginBottom: 0 }}>
          <h4>Review Submitted</h4>
          <p>This case has been successfully reviewed and logged.</p>
        </div>
      ) : (
        <>
          {/* Decision Buttons */}
          <div className="action-row" style={{ marginBottom: '15px' }}>
            <button 
              className={`decision-btn approve ${decision === 'Approve' ? 'selected' : ''}`}
              style={decision === 'Approve' ? { background: 'rgba(76, 175, 80, 0.4)', color: '#fff' } : {}}
              onClick={() => setDecision('Approve')}
            >
              Approve AI
            </button>
            <button 
              className={`decision-btn reject ${decision === 'Reject' ? 'selected' : ''}`}
              style={decision === 'Reject' ? { background: 'rgba(244, 67, 54, 0.4)', color: '#fff' } : {}}
              onClick={() => setDecision('Reject')}
            >
              Reject
            </button>
          </div>

          {/* Clinical Notes */}
          <textarea
            rows="4"
            placeholder="Enter clinical observations..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Confirmation Checkbox */}
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={confirmed} 
              onChange={(e) => setConfirmed(e.target.checked)} 
            />
            I confirm this review is accurate
          </label>

          {/* Submit Button */}
          <button 
            className="action-btn success" 
            style={{ marginTop: '10px' }}
            disabled={!decision || !confirmed || loading}
            onClick={handleSubmit}
          >
            {loading ? "Submitting..." : "Submit Final Review"}
          </button>
        </>
      )}
    </div>
  );
};

export default PathologistReviewPanel;
