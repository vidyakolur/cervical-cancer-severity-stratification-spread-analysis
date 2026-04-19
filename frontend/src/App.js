import { useState, useRef } from "react";
import "./App.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [gradcam, setGradcam] = useState(null);

  const [result, setResult] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [description, setDescription] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [allProbs, setAllProbs] = useState(null);

  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [reportDate] = useState(new Date().toLocaleDateString());

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("side-by-side"); // "native", "gradcam", "side-by-side"
  const [zoom, setZoom] = useState(1);
  const [showReportPage, setShowReportPage] = useState(false);

  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null); // Reset previous results on new upload
    setGradcam(null);
    setZoom(1);
  };

  const triggerFileUpload = () => {
    fileInputRef.current.click();
  };

  const predict = async () => {
    if (!file) return alert("Please select a slide image first.");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setResult(data.prediction);
      setConfidence(data.confidence);
      setDescription(data.description);
      setSeverity(data.severity);
      setAllProbs(data.all_probs);
      setGradcam(data.gradcam);
    } catch (err) {
      console.error(err);
      alert("Error connecting to inference server.");
    }

    setLoading(false);
  };

  const printReport = async () => {
    const input = document.getElementById("pdf-report-container");
    if (!input) return;
    
    // Briefly force scroll to top to ensure html2canvas captures nicely (often fixes clipping)
    window.scrollTo(0,0);
    
    try {
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      
      const pNameTrim = patientName.trim();
      const pName = pNameTrim 
        ? pNameTrim.replace(/\\b\\w/g, char => char.toUpperCase()) 
        : "Patient";
      const pId = patientId.trim() || "Report";
      const fileName = `${pName}_${pId}.pdf`.replace(/\s+/g, '_');
      
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF report.");
    }
  };

  return (
    <div className="clinical-app">
      {/* HIDDEN OFF-SCREEN PDF TEMPLATE */}
      <div className="pdf-offscreen-wrapper">
        <div className="pdf-document" id="pdf-report-container">
          <div className="pdf-header">
            <h1>Cervical Cancer Severity Report</h1>
            <p>Generated Report • {reportDate}</p>
          </div>

          <div className="pdf-patient-info">
            <div>
              <strong>Patient Name</strong>
              <span style={{ textTransform: 'capitalize' }}>{patientName || "Not Provided"}</span>
            </div>
            <div>
              <strong>Patient ID</strong>
              <span>{patientId || "Not Provided"}</span>
            </div>
            <div>
              <strong>Age / DOB</strong>
              <span>{patientAge || "Not Provided"}</span>
            </div>
            <div>
              <strong>Report Date</strong>
              <span>{reportDate}</span>
            </div>
          </div>

          {result && (
            <>
              <div className="pdf-results-box">
                <h3>Diagnostic Summary</h3>
                <div className="pdf-results-grid">
                  <div className={`pdf-stat-card ${severity || 'Unknown'}`}>
                    <strong>Primary Finding</strong>
                    <span>{result}</span>
                    <p>{description}</p>
                  </div>
                  <div className="pdf-stat-card">
                    <strong>Confidence / Severity</strong>
                    <span>{(confidence * 100).toFixed(1)}%</span>
                    <p>Calculated Risk: {severity}</p>
                  </div>
                </div>
              </div>

              <div className="pdf-images">
                <div className="pdf-image-box">
                  <h4>Original Sample</h4>
                  {preview ? <img src={preview} alt="Native" crossOrigin="anonymous" /> : <p>N/A</p>}
                </div>
                <div className="pdf-image-box">
                  <h4>AI Heatmap (Grad-CAM)</h4>
                  {gradcam ? <img src={`data:image/jpeg;base64,${gradcam}`} alt="Heatmap" /> : <p>N/A</p>}
                </div>
              </div>

              {allProbs && (
                <div className="pdf-results-box">
                  <h3>Class Probabilities</h3>
                  <table className="pdf-prob-table">
                    <thead>
                      <tr>
                        <th>Classification</th>
                        <th>Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(allProbs).map(([cls, val]) => (
                        <tr key={cls}>
                          <td>{cls}</td>
                          <td>{(val * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="pdf-footer">
            {/* <p>This report was automatically generated by an artificial intelligence model and is intended for investigational use only.</p>
            <p>A certified pathologist must review and verify all findings.</p> */}
          </div>
        </div>
      </div>
      {!showReportPage ? (
      <div className="main-workspace">
        {/* LEFT SIDEBAR: PATIENT & WORKLIST */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3>Case Actions</h3>
            <input type="file" onChange={handleFile} ref={fileInputRef} hidden accept="image/*" />
            <button className="action-btn primary" onClick={triggerFileUpload}>
              📄 Import Slide / Image
            </button>
            <button className="action-btn success" onClick={predict} disabled={!preview || loading}>
              {loading ? "⚙️ Running Inference..." : "🔬 Run AI Analysis"}
            </button>
          </div>
        </aside>

        {/* CENTER VIEWPORT: DICOM/IMAGE VIEWER */}
        <section className="viewport">
          <div className="viewport-toolbar">
            <div className="tool-group">
              <button className="tool-btn" onClick={() => setZoom(z => Math.max(1, z - 0.2))}>🔍-</button>
              <button className="tool-btn" onClick={() => setZoom(z => Math.min(3, z + 0.2))}>🔍+</button>
              <span className="tool-label">{(zoom * 100).toFixed(0)}%</span>
            </div>
            <div className="tool-group">
               <button className={`tool-btn ${viewMode === 'native' ? 'active' : ''}`} onClick={() => setViewMode('native')}>Native</button>
               <button className={`tool-btn ${viewMode === 'gradcam' ? 'active' : ''}`} onClick={() => setViewMode('gradcam')} disabled={!gradcam}>Grad-CAM</button>
               <button className={`tool-btn ${viewMode === 'side-by-side' ? 'active' : ''}`} onClick={() => setViewMode('side-by-side')} disabled={!gradcam}>Split</button>
            </div>
          </div>

          <div className="viewport-display">
            {!preview ? (
              <div className="empty-state">
                <p>No slide imported. Select "Import Slide / Image" to begin.</p>
              </div>
            ) : (
              <div className={`image-container layout-${viewMode}`} style={{ transform: `scale(${zoom})` }}>
                {(viewMode === 'native' || viewMode === 'side-by-side') && (
                  <div className="img-wrapper">
                    <span className="overlay-badge">Native Slide</span>
                    <img src={preview} alt="Native Sample" draggable="false" />
                  </div>
                )}
                
                {(viewMode === 'gradcam' || viewMode === 'side-by-side') && gradcam && (
                  <div className="img-wrapper">
                    <span className="overlay-badge">AI Heatmap (Grad-CAM)</span>
                    <img src={`data:image/jpeg;base64,${gradcam}`} alt="AI Heatmap" draggable="false" />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: AI RESULTS & DIAGNOSTIC REPORT */}
        <aside className="analysis-panel">
          <div className="panel-header">
            <h3>Diagnostic Analysis</h3>
          </div>
          
          <div className="panel-content" id="report">
            {!result ? (
              <div className="info-box">
                <p>Awaiting inference. Ensure slide is loaded and click "Run AI Analysis".</p>
              </div>
            ) : (
              <>
                <div className={`status-banner severity-${severity?.toLowerCase() || 'unknown'}`}>
                  <h4>{result}</h4>
                  <p>Risk Level: {severity}</p>
                </div>

                <div className="analysis-section">
                   <h5>AI Confidence</h5>
                   <div className="confidence-meter">
                      <div className="meter-bar">
                         <div className="meter-fill" style={{ width: `${(confidence * 100)}%`, backgroundColor: confidence > 0.8 ? '#4caf50' : '#ff9800' }}></div>
                      </div>
                      <span className="meter-text">{(confidence * 100).toFixed(2)}%</span>
                   </div>
                   <p className="description-text">{description}</p>
                </div>

                <div className="analysis-section">
                  <h5>Class Probabilities</h5>
                  <div className="prob-list">
                    {allProbs && Object.entries(allProbs).map(([cls, val]) => (
                      <div key={cls} className="prob-item">
                        <div className="prob-label">
                           <span>{cls}</span>
                           <span>{(val * 100).toFixed(1)}%</span>
                        </div>
                        <div className="prob-bg">
                          <div className="prob-fill" style={{ width: `${val * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {result && (
             <div className="panel-footer">
                <button className="export-btn" onClick={() => setShowReportPage(true)}>📄 Generate PDF Report</button>
             </div>
          )}
        </aside>
      </div>
      ) : (
        <div className="report-page-container" style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', color: 'var(--text-main)', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2>Report Details</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Enter patient details before exporting the PDF.</p>
          
          <div className="sidebar-section" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-dark)' }}>
            <div className="form-group">
              <label>Patient ID</label>
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input 
                value={patientName} 
                onChange={(e) => setPatientName(e.target.value.toUpperCase())} 
              />
            </div>
            <div className="form-group">
              <label>Age / DOB</label>
              <input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input value={reportDate} disabled readOnly />
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button className="action-btn primary" onClick={() => setShowReportPage(false)}>Back</button>
              <button className="action-btn success" onClick={printReport}>🖨️ Export PDF Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;