import { useState, useRef } from "react";
import "./App.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PathologistReviewPanel from "./PathologistReviewPanel";
import GradcamPage from "./GradcamPage";

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [gradcam, setGradcam] = useState(null);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.5);
  const [pathologistReview, setPathologistReview] = useState(null);

  const [result, setResult] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [description, setDescription] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [allProbs, setAllProbs] = useState(null);
  const [suspiciousTiles, setSuspiciousTiles] = useState([]);
  const [followUp, setFollowUp] = useState(null);
  const [localizationMap, setLocalizationMap] = useState(null);
  const [maskedImage, setMaskedImage] = useState(null);

  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [reportDate] = useState(new Date().toLocaleDateString());

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("overlay"); // "native", "gradcam", "overlay"
  const [zoom, setZoom] = useState(1);
  const [showReportPage, setShowReportPage] = useState(false);
  const [showGradcamPage, setShowGradcamPage] = useState(false);

  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null); // Reset previous results on new upload
    setGradcam(null);
    setZoom(1);
    setViewMode('native');
    setPathologistReview(null);
    setSuspiciousTiles([]);
    setFollowUp(null);
    setLocalizationMap(null);
    setMaskedImage(null);
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
      setSuspiciousTiles(data.suspicious_tiles || []);
      setFollowUp(data.follow_up);
      setLocalizationMap(data.localization_map);
      setMaskedImage(data.masked_image);
      setViewMode('side-by-side');
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
      const pageWidth = 210;
      const pageHeight = 297;
      let imgWidth = pageWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > pageHeight) {
        const ratio = pageHeight / imgHeight;
        imgHeight = pageHeight;
        imgWidth = imgWidth * ratio;
      }

      const xOffset = (pageWidth - imgWidth) / 2;
      pdf.addImage(imgData, "PNG", xOffset, 0, imgWidth, imgHeight);
      
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
                    <strong>Medical Score / Severity</strong>
                    <span>{(confidence * 100).toFixed(1)}%</span>
                    <p>Calculated Risk: {severity}</p>
                  </div>
                </div>
                {followUp && (
                  <div className="pdf-followup-box">
                    <strong>Recommended Clinical Follow-up</strong>
                    <p>{followUp}</p>
                  </div>
                )}
              </div>

              {suspiciousTiles && suspiciousTiles.length > 0 && (
                <div className="pdf-results-box">
                  <h3>Suspicious Cell Clusters (High-Res Snapshots)</h3>
                  <div className="pdf-tiles-grid">
                    {suspiciousTiles.map((tileObj, idx) => (
                      <div key={idx} className="pdf-tile-item">
                        <img src={`data:image/jpeg;base64,${tileObj.image}`} alt={`Cluster ${idx+1}`} />
                        <span>{tileObj.prediction} ({(tileObj.confidence * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {pathologistReview && (
                <div className="pdf-results-box" style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <h3>Pathologist Review</h3>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>Final Decision: </strong> 
                    <span style={{ 
                      color: pathologistReview.doctor_decision === 'Approve' ? '#4caf50' : pathologistReview.doctor_decision === 'Reject' ? '#f44336' : '#ff9800',
                      fontWeight: 'bold',
                      fontSize: '16px'
                    }}>
                      {pathologistReview.doctor_decision}
                    </span>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <strong>Clinical Notes:</strong>
                    <p style={{ marginTop: '8px', padding: '12px', background: '#fff', border: '1px solid #eee', fontSize: '14px', lineHeight: '1.5' }}>
                      {pathologistReview.notes || "No additional notes provided."}
                    </p>
                  </div>
                  
                  <div style={{ marginTop: '30px', borderTop: '1px dashed #ccc', paddingTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ paddingTop: '25px' }}>
                      <div style={{ width: '250px', borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#333', fontWeight: 'bold' }}>Physician Signature</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>Review Timestamp</p>
                      <p style={{ margin: 0, fontSize: '14px' }}>{pathologistReview.timestamp}</p>
                    </div>
                  </div>
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
      {!showReportPage && !showGradcamPage ? (
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
               <button className={`tool-btn ${viewMode === 'overlay' ? 'active' : ''}`} onClick={() => setViewMode('overlay')} disabled={!gradcam}>Overlay</button>
               <button className={`tool-btn ${viewMode === 'side-by-side' ? 'active' : ''}`} onClick={() => setViewMode('side-by-side')} disabled={!gradcam}>Split</button>
            </div>
            {viewMode === 'overlay' && gradcam && (
              <div className="tool-group">
                <span className="tool-label">Opacity:</span>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={heatmapOpacity} 
                  onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))} 
                />
              </div>
            )}
          </div>

          <div className="viewport-display">
            {!preview ? (
              <div className="empty-state">
                <p>No slide imported. Select "Import Slide / Image" to begin.</p>
              </div>
            ) : (
              <div className="scrollable-content">
                <div className={`image-container layout-${viewMode}`} style={{ transform: `scale(${zoom})` }}>
                  {viewMode !== 'overlay' && (
                    <>
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
                    </>
                  )}
                  
                  {viewMode === 'overlay' && gradcam && (
                    <div className="img-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                      <span className="overlay-badge" style={{ zIndex: 10 }}>Overlay View</span>
                      <img src={preview} alt="Native Sample" draggable="false" style={{ display: 'block' }} />
                      <img src={`data:image/jpeg;base64,${gradcam}`} alt="AI Heatmap" draggable="false" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: heatmapOpacity, pointerEvents: 'none', objectFit: 'fill' }} />
                    </div>
                  )}
                </div>

                {/* SPREAD ANALYSIS SECTION */}
                {localizationMap && maskedImage && (
                  <div className="spread-analysis-container">
                    <h2 className="section-title">Detailed Spread Analysis</h2>
                    
                    <div className="spread-grid">
                      <div className="spread-card">
                        <h3>1. Cancer Localization Map</h3>
                        <p>Bounding boxes define regions of high AI activation.</p>
                        <img src={`data:image/jpeg;base64,${localizationMap}`} alt="Localization Map" draggable="false" />
                      </div>
                      
                      <div className="spread-card">
                        <h3>2. Isolated Tissue View</h3>
                        <p>Healthy tissue is masked out to highlight spread area.</p>
                        <img src={`data:image/jpeg;base64,${maskedImage}`} alt="Masked Tissue" draggable="false" />
                      </div>
                    </div>

                    {suspiciousTiles && suspiciousTiles.length > 0 && (
                      <div className="micro-analysis-section">
                        <h3>3. Per-Cluster Micro-Analysis</h3>
                        <p>Each suspicious cluster is independently scored by the AI.</p>
                        <div className="micro-tiles-list">
                          {suspiciousTiles.map((tileObj, idx) => (
                            <div key={idx} className="micro-tile-row">
                              <div className="micro-img-wrapper">
                                <img src={`data:image/jpeg;base64,${tileObj.image}`} alt={`Cluster ${idx+1}`} draggable="false" />
                              </div>
                              <div className="micro-data">
                                <h4>Cluster {idx + 1}</h4>
                                <div className={`status-badge severity-${tileObj.severity.toLowerCase()}`}>
                                  {tileObj.prediction} ({tileObj.severity} Risk)
                                </div>
                                <div className="confidence-meter mini-meter">
                                  <div className="meter-bar">
                                     <div className="meter-fill" style={{ width: `${(tileObj.confidence * 100)}%`, backgroundColor: tileObj.confidence > 0.8 ? '#4caf50' : '#ff9800' }}></div>
                                  </div>
                                  <span className="meter-text">{(tileObj.confidence * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                   <h5>Model Score</h5>
                   <div className="confidence-meter">
                      <div className="meter-bar">
                         <div className="meter-fill" style={{ width: `${(confidence * 100)}%`, backgroundColor: confidence > 0.8 ? '#4caf50' : '#ff9800' }}></div>
                      </div>
                      <span className="meter-text">{(confidence * 100).toFixed(2)}%</span>
                   </div>
                   <p className="description-text">{description}</p>
                   {followUp && (
                     <div className="followup-alert">
                       <strong>Recommendation:</strong> {followUp}
                     </div>
                   )}
                </div>

                {suspiciousTiles && suspiciousTiles.length > 0 && (
                  <div className="analysis-section">
                    <h5>Smart Tile Gallery (High-Res Clusters)</h5>
                    <div className="smart-tiles-grid">
                      {suspiciousTiles.map((tileObj, idx) => (
                        <div key={idx} className="smart-tile">
                          <img src={`data:image/jpeg;base64,${tileObj.image}`} alt={`Cluster ${idx+1}`} draggable="false" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                {/* Pathologist Review Panel */}
                <PathologistReviewPanel 
                  patientId={patientId}
                  aiResult={{
                    prediction: result,
                    confidence: confidence,
                    severity: severity
                  }}
                  onSubmit={(data) => setPathologistReview(data)}
                />
              </>
            )}
          </div>

          {result && (
             <div className="panel-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="export-btn" onClick={() => setShowGradcamPage(true)}>🔍 View Full Grad-CAM</button>
                <button className="export-btn" onClick={() => setShowReportPage(true)}>📄 Generate PDF Report</button>
             </div>
          )}
        </aside>
      </div>
      ) : showReportPage ? (
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
      ) : showGradcamPage ? (
        <GradcamPage 
          preview={preview}
          gradcam={gradcam}
          localizationMap={localizationMap}
          maskedImage={maskedImage}
          suspiciousTiles={suspiciousTiles}
          onBack={() => setShowGradcamPage(false)}
        />
      ) : null}
    </div>
  );
}

export default App;