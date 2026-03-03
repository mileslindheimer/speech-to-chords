import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';

function App() {
  // saved charts are stored as an array of objects
  const [savedCharts, setSavedCharts] = useState([]);

  // load saved charts from localStorage when the app mounts
  useEffect(() => {
    const stored = localStorage.getItem('savedCharts');
    if (stored) {
      try {
        setSavedCharts(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const saveChart = (chart) => {
    const updated = [chart, ...savedCharts];
    setSavedCharts(updated);
    localStorage.setItem('savedCharts', JSON.stringify(updated));
  };

  const deleteChart = (index) => {
    const updated = savedCharts.filter((_, i) => i !== index);
    setSavedCharts(updated);
    localStorage.setItem('savedCharts', JSON.stringify(updated));
  };

  return (
    <Router>
      <nav className="navbar">
        <Link to="/">Record</Link>
        <Link to="/saved">Saved Charts</Link>
      </nav>
      <Routes>
        <Route
          path="/"
          element={<HomePage saveChart={saveChart} />}
        />
        <Route
          path="/saved"
          element={<SavedCharts charts={savedCharts} deleteChart={deleteChart} />}
        />
      </Routes>
    </Router>
  );
}

function HomePage({ saveChart }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chordChart, setChordChart] = useState('');
  const [transcription, setTranscription] = useState('');
  const [chords, setChords] = useState([]);
  const [error, setError] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Error accessing microphone: ' + err.message);
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }

      const data = await response.json();
      setTranscription(data.transcription);
      setChords(data.chords);
      setChordChart(data.chord_chart);
    } catch (err) {
      setError('Error processing audio: ' + err.message);
      console.error('Error processing audio:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(chordChart);
      // Show temporary success message
      const button = document.querySelector('.copy-button');
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.style.backgroundColor = '#4caf50';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#667eea';
      }, 2000);
    } catch (err) {
      setError('Failed to copy to clipboard: ' + err.message);
    }
  };

  const handleSave = () => {
    if (chordChart) {
      saveChart({ transcription, chords, chordChart, timestamp: Date.now() });
      setShowSaveConfirm(true);
      // Auto-dismiss after 2 seconds
      setTimeout(() => setShowSaveConfirm(false), 2000);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>🎵 Speech to Chords</h1>
        <p className="subtitle">Record your speech and convert it to musical chord symbols</p>

        <div className="controls">
          {!isRecording ? (
            <button 
              className="record-button start" 
              onClick={startRecording}
              disabled={isProcessing}
            >
              🎤 Start Recording
            </button>
          ) : (
            <button 
              className="record-button stop" 
              onClick={stopRecording}
            >
              ⏹️ Stop Recording
            </button>
          )}
        </div>

        {isProcessing && (
          <div className="processing">
            <div className="spinner"></div>
            <p>Processing audio...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {chordChart && (
          <div className="results">
            <div className="chord-chart-container">
              <div className="chart-header">
                <h2>Chord Chart</h2>
                <button 
                  className="copy-button" 
                  onClick={copyToClipboard}
                >
                  📋 Copy Chart
                </button>
              </div>
              <div className="chord-display">
                {chords.length > 0 ? (
                  <div className="chords-list">
                    {chords.map((chord, index) => (
                      <span key={index} className="chord-tag">{chord}</span>
                    ))}
                  </div>
                ) : (
                  <p className="no-chords">No chords detected</p>
                )}
              </div>
              <pre className="chord-chart-text">{chordChart}</pre>
            </div>

            {transcription && (
              <div className="transcription-container">
                <h3>Transcription</h3>
                <p className="transcription-text">{transcription}</p>
              </div>
            )}
            {chordChart && (
              <button className="save-button" onClick={handleSave}>
                💾 Save Chart
              </button>
            )}
          </div>
        )}
        {showSaveConfirm && (
          <div className="save-overlay">
            <div className="save-message">✅ Chart saved successfully!</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedCharts({ charts, deleteChart }) {
  if (charts.length === 0) {
    return (
      <div className="container">
        <h2>No saved charts</h2>
        <p>Record something to save chord charts here.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Saved Chord Charts</h2>
      {charts.map((c, idx) => (
        <div key={idx} className="saved-chart">
          <div className="chart-header">
            <span>{new Date(c.timestamp).toLocaleString()}</span>
            <button className="copy-button" onClick={() => navigator.clipboard.writeText(c.chordChart)}>
              📋 Copy
            </button>
            <button className="delete-button" onClick={() => deleteChart(idx)}>
              ❌
            </button>
          </div>
          <pre className="chord-chart-text">{c.chordChart}</pre>
        </div>
      ))}
    </div>
  );
}

export default App;
