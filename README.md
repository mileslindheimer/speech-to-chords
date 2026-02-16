# Speech to Chords 🎵

A web application that converts speech input from your microphone into musical chord symbols using OpenAI Whisper for transcription.

## Features

- 🎤 Real-time microphone recording
- 🗣️ Speech-to-text using OpenAI Whisper
- 🎹 Automatic chord symbol extraction from transcribed text
- 📋 Chord chart generation with autocopy functionality
- 🎨 Modern, responsive React frontend
- 🐍 Flask backend with CORS support

## Project Structure

```
speech-to-chords/
├── backend/
│   ├── app.py              # Flask server with Whisper integration
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── App.css         # Styling
│   │   ├── index.js        # React entry point
│   │   └── index.css       # Global styles
│   └── package.json        # Node.js dependencies
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd speech-to-chords/backend
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

**Note:** The first time you run the app, Whisper will download the model files (the "base" model is approximately 150MB). This may take a few minutes depending on your internet connection.

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
```bash
cd speech-to-chords/frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000` and automatically open in your browser.

## Usage

1. Make sure both the backend and frontend servers are running
2. Click "Start Recording" to begin recording audio from your microphone
3. Speak chord names (e.g., "C major", "D minor", "F sharp", "G seven")
4. Click "Stop Recording" when finished
5. The app will process your audio and display:
   - Detected chord symbols
   - A formatted chord chart
   - The full transcription
6. Click "Copy Chart" to automatically copy the chord chart to your clipboard

## How It Works

1. **Audio Recording**: The React frontend uses the MediaRecorder API to capture audio from the user's microphone
2. **Speech Transcription**: The audio is sent to the Flask backend, which uses OpenAI Whisper to transcribe the speech
3. **Chord Extraction**: The backend uses regex patterns to identify chord names in the transcribed text
4. **Chord Chart Generation**: Detected chords are formatted into a readable chord chart
5. **Display & Copy**: The frontend displays the results and provides a one-click copy feature

## Supported Chord Formats

The app recognizes various chord naming conventions:
- Major chords: C, D, E, F, G, A, B (with optional sharps/flats)
- Minor chords: Cm, Dm, Em, etc.
- Extended chords: C7, Dm7, G9, etc.
- Suspended chords: Csus4, Dsus2, etc.
- Spoken formats: "C major", "D minor", etc.

## Troubleshooting

- **Microphone not working**: Make sure you've granted microphone permissions in your browser
- **Backend connection error**: Verify the Flask server is running on port 5000
- **Model download issues**: Check your internet connection for the initial Whisper model download
- **CORS errors**: Ensure flask-cors is installed and the backend is running

## License

MIT License - feel free to use this project for your own purposes!
