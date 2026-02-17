import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chordChart, setChordChart] = useState('');
  const [transcription, setTranscription] = useState('');
  const [chords, setChords] = useState([]);
  const [error, setError] = useState('');
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
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
