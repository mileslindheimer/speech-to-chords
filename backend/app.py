from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import whisper
import os
import tempfile
import re

app = Flask(__name__)
# Enable debug logging for incoming requests
logging.basicConfig(level=logging.DEBUG)
# Configure CORS explicitly for the transcribe endpoint so that the
# dev-server proxy and browser preflights are handled predictably.
CORS(
    app,
    resources={r"/transcribe": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)

# Load Whisper model (using base model for faster processing)
model = whisper.load_model("base")

def extract_chords(text):
    """
    Extract chord symbols from transcribed text.
    Looks for common chord patterns like C, Dm, F#m, G7, etc.
    """
    # normalize hyphens/dashes since speech-to-text often outputs
    # "B-flat" or "C-major"; converting them to spaces lets our
    # existing regexes handle them uniformly.
    text = re.sub(r'[-–—]', ' ', text)

    # We'll collect (position, chord) pairs so that we can sort by where
    # the match occurred in the text.  This keeps the output in the same
    # order that chords appear in the transcription.
    positions = []
    flat_sharp_notes = set()  # Track notes that are part of flat/sharp phrases
    phrase_notes = set()      # Track notes that are part of phrase matches

    # First, handle phrases like "B flat minor" or "F sharp major 7".  We
    # need to detect the modifier and the quality in one go so the resulting
    # chord includes both (e.g. "Bbm" instead of just "Bb").
    modifier_phrase_pattern = (
        r'\b([A-G])\s+(flat|sharp)\s+'
        r'(major|minor|maj|min|diminished|augmented)(?:\s*(\d+))?\b'
    )
    for match in re.finditer(modifier_phrase_pattern, text, re.IGNORECASE):
        note = match.group(1).capitalize()
        modifier = match.group(2).lower()
        quality = match.group(3).lower()
        number = match.group(4)  # may be None
        base = note + ('b' if modifier == 'flat' else '#')
        flat_sharp_notes.add(note.lower())
        phrase_notes.add(base.lower())
        if quality in ['minor', 'min']:
            chord = base + 'm'
        else:
            chord = base + ('maj' if number else '')
        if number:
            chord += number
        positions.append((match.start(), chord))

    # Next, look for simple flat/sharp words; these might occur without a
    # following quality.
    flat_sharp_pattern = r'\b([A-G])\s+(flat|sharp)\b'
    for match in re.finditer(flat_sharp_pattern, text, re.IGNORECASE):
        # Skip matches already handled by the modifier_phrase_pattern by
        # checking if the position matches one we already recorded.
        if any(abs(match.start() - pos) < 1 for pos, _ in positions):
            continue
        note = match.group(1).capitalize()
        modifier = match.group(2).lower()
        flat_sharp_notes.add(note.lower())
        if modifier == 'flat':
            chord = note + 'b'
        elif modifier == 'sharp':
            chord = note + '#'
        positions.append((match.start(), chord))

    # Look for phrases like "C major", "D minor", "F major 7", etc.  These
    # should take precedence over simple chord regex matches.
    phrase_pattern = r'\b([A-G][#b]?)\s+(major|minor|maj|min|diminished|augmented)(?:\s*(\d+))?\b'
    for match in re.finditer(phrase_pattern, text, re.IGNORECASE):
        note = match.group(1).capitalize()
        quality = match.group(2).lower()
        number = match.group(3)  # may be None
        if note.lower() not in flat_sharp_notes:
            phrase_notes.add(note.lower())
            if quality in ['minor', 'min']:
                chord = note + 'm'
            else:
                if number:
                    chord = note + 'maj'
                else:
                    chord = note
            if number:
                chord += number
            positions.append((match.start(), chord))

    # General chord pattern; we skip notes that were already captured by the
    # phrase patterns (without an explicit quality) or by flat/sharp phrases.
    chord_pattern = r'\b([A-G][#b]?)(m|maj|min|dim|aug|sus[24]|7|9|11|13|add[249]|m7|maj7|dim7|aug7)?\b'
    for match in re.finditer(chord_pattern, text, re.IGNORECASE):
        note = match.group(1)
        quality = match.group(2)
        if (note.lower() in phrase_notes or note.lower() in flat_sharp_notes) and not quality:
            continue
        chord = match.group(0)
        chord = chord.capitalize()
        if chord.endswith('maj'):
            chord = chord[:-3]
        elif chord.endswith('min'):
            chord = chord[:-3] + 'm'
        positions.append((match.start(), chord))

    # Sort by occurrence in the text and dedupe
    positions.sort(key=lambda x: x[0])
    seen = set()
    unique_chords = []
    for _, chord in positions:
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
        # Debug: log incoming request method and headers to help diagnose
        # proxy vs curl differences (browser preflights, Origin headers, etc.).
        app.logger.debug("/transcribe called: method=%s", request.method)
        app.logger.debug("/transcribe headers: %s", dict(request.headers))

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
