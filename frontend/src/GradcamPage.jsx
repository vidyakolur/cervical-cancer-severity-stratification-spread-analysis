import React, { useState } from 'react';
import './App.css';

function GradcamPage({ preview, gradcam, localizationMap, maskedImage, suspiciousTiles, onBack }) {
  const [opacity, setOpacity] = useState(0.5);

  return (
    <div className="gradcam-page-container" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-main)', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ margin: '0 0 10px 0' }}>Interactive Grad-CAM Analysis</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Detailed visualization of AI activation regions</p>
        </div>
        <button className="action-btn primary" onClick={onBack}>⬅ Back to Dashboard</button>
      </div>

      {!gradcam ? (
        <div className="empty-state" style={{ background: 'var(--bg-dark)', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
          <p>No Grad-CAM data available. Please run AI Analysis first.</p>
        </div>
      ) : (
        <div className="gradcam-content">
          {/* Main Viewer */}
          <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '8px', marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="tool-group" style={{ marginBottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span className="tool-label" style={{ marginRight: '15px' }}>Heatmap Opacity:</span>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={opacity} 
                onChange={(e) => setOpacity(parseFloat(e.target.value))} 
                style={{ width: '250px' }}
              />
              <span style={{ marginLeft: '15px', fontWeight: 'bold' }}>{Math.round(opacity * 100)}%</span>
            </div>

            <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
               <div className="img-wrapper" style={{ position: 'relative', width: '400px', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                 <span className="overlay-badge" style={{ zIndex: 10 }}>Native Image</span>
                 <img src={preview} alt="Native" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
               </div>

               <div className="img-wrapper" style={{ position: 'relative', width: '400px', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                 <span className="overlay-badge" style={{ zIndex: 10 }}>AI Overlay</span>
                 <img src={preview} alt="Native Base" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                 <img src={`data:image/jpeg;base64,${gradcam}`} alt="Heatmap" draggable="false" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: opacity, pointerEvents: 'none', objectFit: 'contain' }} />
               </div>
            </div>
          </div>

          {/* Spread Maps */}
          <div className="spread-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            {localizationMap && (
              <div className="spread-card" style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginTop: 0 }}>Cancer Localization Map</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '15px' }}>Bounding boxes around areas of high AI confidence.</p>
                <img src={`data:image/jpeg;base64,${localizationMap}`} alt="Localization" draggable="false" style={{ width: '100%', borderRadius: '4px', objectFit: 'contain', maxHeight: '350px' }} />
              </div>
            )}
            {maskedImage && (
              <div className="spread-card" style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginTop: 0 }}>Isolated Tissue View</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '15px' }}>Healthy background tissue masked out.</p>
                <img src={`data:image/jpeg;base64,${maskedImage}`} alt="Masked" draggable="false" style={{ width: '100%', borderRadius: '4px', objectFit: 'contain', maxHeight: '350px' }} />
              </div>
            )}
          </div>

          {/* Micro-Tiles */}
          {suspiciousTiles && suspiciousTiles.length > 0 && (
            <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginTop: 0 }}>Suspicious Tile Clusters</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>High-resolution crops of the most suspicious regions, scored individually.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                {suspiciousTiles.map((tile, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <img src={`data:image/jpeg;base64,${tile.image}`} alt={`Cluster ${idx}`} style={{ width: '100%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>{tile.prediction}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Confidence: {(tile.confidence * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: '12px', color: tile.severity === 'High' ? '#f44336' : tile.severity === 'Medium' ? '#ff9800' : '#4caf50' }}>Risk: {tile.severity}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GradcamPage;
