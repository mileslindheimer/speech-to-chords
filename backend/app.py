from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import os
import tempfile
import re

app = Flask(__name__)
CORS(app)

# Load Whisper model (using base model for faster processing)
model = whisper.load_model("base")

def extract_chords(text):
    """
    Extract chord symbols from transcribed text.
    Looks for common chord patterns like C, Dm, F#m, G7, etc.
    """
    # Common chord patterns
    # Major chords: A, B, C, D, E, F, G (with optional sharps/flats)
    # Minor chords: Am, Bm, Cm, etc.
    # Extended chords: C7, Dm7, G9, etc.
    # Suspended chords: Csus4, Dsus2, etc.
    
    # First, look for phrases like "C major", "D minor", etc. (these take precedence)
    phrase_pattern = r'\b([A-G][#b]?)\s+(major|minor|maj|min|diminished|augmented)\b'
    phrase_matches = re.finditer(phrase_pattern, text, re.IGNORECASE)
    phrase_notes = set()  # Track notes that are part of phrases
    chords = []
    
    for match in phrase_matches:
        note = match.group(1).capitalize()
        quality = match.group(2).lower()
        phrase_notes.add(note.lower())  # Track this note as part of a phrase
        if quality in ['minor', 'min']:
            chord = note + 'm'
        else:
            chord = note
        chords.append(chord)
    
    # Pattern to match chord names (skip notes that are already in phrases)
    chord_pattern = r'\b([A-G][#b]?)(m|maj|min|dim|aug|sus[24]|7|9|11|13|add[249]|m7|maj7|dim7|aug7)?\b'
    
    # Find all potential chords
    matches = re.finditer(chord_pattern, text, re.IGNORECASE)
    
    for match in matches:
        note = match.group(1)
        quality = match.group(2)
        # Skip if this note is already part of a phrase pattern
        if note.lower() in phrase_notes and not quality:
            continue
        
        chord = match.group(0)
        # Normalize chord names
        chord = chord.capitalize()
        # Handle common variations
        if chord.endswith('maj'):
            chord = chord[:-3]
        elif chord.endswith('min'):
            chord = chord[:-3] + 'm'
        chords.append(chord)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_chords = []
    for chord in chords:
        if chord not in seen:
            seen.add(chord)
            unique_chords.append(chord)
    
    return unique_chords

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        try:
            # Transcribe audio
            result = model.transcribe(tmp_path)
            transcribed_text = result["text"]
            
            # Extract chords from transcribed text
            chords = extract_chords(transcribed_text)
            
            # Format chord chart
            chord_chart = format_chord_chart(chords, transcribed_text)
            
            return jsonify({
                "transcription": transcribed_text,
                "chords": chords,
                "chord_chart": chord_chart
            })
        finally:
            # Clean up temporary file
            os.unlink(tmp_path)
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def format_chord_chart(chords, transcription):
    """Format chords into a readable chord chart"""
    if not chords:
        return f"Transcription: {transcription}\n\nNo chords detected in the transcription."
    
    chart = "Chord Chart\n"
    chart += "=" * 50 + "\n\n"
    
    # Display chords in a line
    chart += "Chords: " + "  ".join(chords) + "\n\n"
    
    # Display transcription for reference
    chart += "Transcription: " + transcription + "\n"
    
    return chart

if __name__ == '__main__':
    app.run(debug=True, port=5000)
