import pytest
import os
import io
import tempfile
from unittest.mock import Mock, patch, mock_open
from flask import Flask
from app import app, extract_chords, format_chord_chart


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestExtractChords:
    """Test cases for the extract_chords function"""
    
    def test_extract_simple_major_chords(self):
        """Test extraction of simple major chords"""
        text = "The song uses C, D, and E chords"
        chords = extract_chords(text)
        assert 'C' in chords
        assert 'D' in chords
        assert 'E' in chords
    
    def test_extract_minor_chords(self):
        """Test extraction of minor chords"""
        text = "Play Am, Dm, and Em"
        chords = extract_chords(text)
        assert 'Am' in chords
        assert 'Dm' in chords
        assert 'Em' in chords
    
    def test_extract_chords_with_sharps_flats(self):
        """Test extraction of chords with sharps and flats"""
        text = "F#m and B flat are in the key"
        chords = extract_chords(text)
        assert 'F#m' in chords
        assert 'Bb' in chords
    
    def test_extract_extended_chords(self):
        """Test extraction of extended chords"""
        text = "C7, Dm7, G9, and Fmaj7"
        chords = extract_chords(text)
        # Check that extended chords are captured
        assert len(chords) > 0
    
    def test_extract_suspended_chords(self):
        """Test extraction of suspended chords"""
        text = "Csus4 and Dsus2"
        chords = extract_chords(text)
        assert len(chords) > 0
    
    def test_extract_chords_from_phrases(self):
        """Test extraction from phrases like 'C major' or 'D minor'"""
        text = "C major and D minor are common"
        chords = extract_chords(text)
        assert 'C' in chords
        assert 'Dm' in chords
    
    def test_extract_chords_with_maj_min_variations(self):
        """Test extraction with maj/min variations"""
        text = "C maj and D min"
        chords = extract_chords(text)
        assert 'C' in chords
        assert 'Dm' in chords
    
    def test_no_chords_in_text(self):
        """Test when no chords are present in text"""
        text = "This is just regular text with no musical chords"
        chords = extract_chords(text)
        assert chords == []
    
    def test_remove_duplicates(self):
        """Test that duplicate chords are removed"""
        text = "C, D, C, E, D"
        chords = extract_chords(text)
        assert chords.count('C') == 1
        assert chords.count('D') == 1
        assert 'E' in chords
    
    def test_case_insensitive_extraction(self):
        """Test that chord extraction is case insensitive"""
        text = "c, d, e, am, bm"
        chords = extract_chords(text)
        assert 'C' in chords
        assert 'D' in chords
        assert 'E' in chords
        assert 'Am' in chords
        assert 'Bm' in chords
    
    def test_complex_chord_names(self):
        """Test extraction of complex chord names"""
        text = "Cadd9, Ddim7, Eaug, F major 7"
        chords = extract_chords(text)
        assert chords == ["Cadd9", "Ddim7", "Eaug", "Fmaj7"]
    
    def test_spoken_variations(self):
        """Test extraction of spoken variations of chord names"""
        text = "B-flat minor, C-major 7."
        chords = extract_chords(text)
        assert chords == ["Bbm", "Cmaj7"]

    
    def test_chords_in_sentence_context(self):
        """Test extraction when chords are in full sentences"""
        text = "The progression goes from C major to A minor, then to F major"
        chords = extract_chords(text)
        assert 'C' in chords
        assert 'Am' in chords
        assert 'F' in chords


class TestFormatChordChart:
    """Test cases for the format_chord_chart function"""
    
    def test_format_with_chords(self):
        """Test formatting when chords are present"""
        chords = ['C', 'Am', 'F', 'G']
        transcription = "The song uses C, Am, F, and G chords"
        chart = format_chord_chart(chords, transcription)
        
        assert "Chord Chart" in chart
        assert "C" in chart
        assert "Am" in chart
        assert "F" in chart
        assert "G" in chart
        assert transcription in chart
    
    def test_format_without_chords(self):
        """Test formatting when no chords are detected"""
        chords = []
        transcription = "This is just regular speech"
        chart = format_chord_chart(chords, transcription)
        
        assert "No chords detected" in chart
        assert transcription in chart
    
    def test_format_empty_transcription(self):
        """Test formatting with empty transcription"""
        chords = ['C', 'D']
        transcription = ""
        chart = format_chord_chart(chords, transcription)
        
        assert "Chord Chart" in chart
        assert "C" in chart
        assert "D" in chart
    
    def test_format_single_chord(self):
        """Test formatting with a single chord"""
        chords = ['C']
        transcription = "Just play C"
        chart = format_chord_chart(chords, transcription)
        
        assert "C" in chart
        assert transcription in chart


class TestHealthEndpoint:
    """Test cases for the /health endpoint"""
    
    def test_health_endpoint(self, client):
        """Test that health endpoint returns healthy status"""
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'


class TestTranscribeEndpoint:
    """Test cases for the /transcribe endpoint"""
    
    def test_transcribe_missing_audio_file(self, client):
        """Test transcribe endpoint without audio file"""
        response = client.post('/transcribe')
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'No audio file provided' in data['error']
    
    @patch('app.model')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    def test_transcribe_success(self, mock_unlink, mock_tempfile, mock_model, client):
        """Test successful transcription with chord extraction"""
        # Mock the transcription result
        mock_model.transcribe.return_value = {
            "text": "The song uses C major, A minor, and F major chords"
        }
        
        # Mock temporary file context manager
        mock_file = Mock()
        mock_file.name = '/tmp/test_audio.webm'
        mock_file.__enter__ = Mock(return_value=mock_file)
        mock_file.__exit__ = Mock(return_value=False)
        mock_tempfile.return_value = mock_file
        
        # Create a mock audio file
        audio_data = b'fake audio data'
        
        # Make the request
        response = client.post(
            '/transcribe',
            data={'audio': (io.BytesIO(audio_data), 'test.webm')},
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'transcription' in data
        assert 'chords' in data
        assert 'chord_chart' in data
        assert 'C' in data['chords'] or 'A' in data['chords'] or 'F' in data['chords']
        
        # Verify cleanup
        mock_unlink.assert_called_once()
    
    @patch('app.model')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    def test_transcribe_no_chords_detected(self, mock_unlink, mock_tempfile, mock_model, client):
        """Test transcription when no chords are detected"""
        # Mock the transcription result with no chords
        mock_model.transcribe.return_value = {
            "text": "This is just regular speech with no musical content"
        }
        
        # Mock temporary file context manager
        mock_file = Mock()
        mock_file.name = '/tmp/test_audio.webm'
        mock_file.__enter__ = Mock(return_value=mock_file)
        mock_file.__exit__ = Mock(return_value=False)
        mock_tempfile.return_value = mock_file
        
        # Create a mock audio file
        audio_data = b'fake audio data'
        
        # Make the request
        response = client.post(
            '/transcribe',
            data={'audio': (io.BytesIO(audio_data), 'test.webm')},
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'transcription' in data
        assert 'chords' in data
        assert data['chords'] == []
        assert 'chord_chart' in data
    
    @patch('app.model')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    def test_transcribe_whisper_error(self, mock_unlink, mock_tempfile, mock_model, client):
        """Test error handling when Whisper fails"""
        # Mock Whisper to raise an exception
        mock_model.transcribe.side_effect = Exception("Whisper model error")
        
        # Mock temporary file context manager
        mock_file = Mock()
        mock_file.name = '/tmp/test_audio.webm'
        mock_file.__enter__ = Mock(return_value=mock_file)
        mock_file.__exit__ = Mock(return_value=False)
        mock_tempfile.return_value = mock_file
        
        # Create a mock audio file
        audio_data = b'fake audio data'
        
        # Make the request
        response = client.post(
            '/transcribe',
            data={'audio': (io.BytesIO(audio_data), 'test.webm')},
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
    
    @patch('app.model')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    def test_transcribe_file_cleanup_on_error(self, mock_unlink, mock_tempfile, mock_model, client):
        """Test that temporary file is cleaned up even on error"""
        # Mock Whisper to raise an exception
        mock_model.transcribe.side_effect = Exception("Processing error")
        
        # Mock temporary file context manager
        mock_file = Mock()
        mock_file.name = '/tmp/test_audio.webm'
        mock_file.__enter__ = Mock(return_value=mock_file)
        mock_file.__exit__ = Mock(return_value=False)
        mock_tempfile.return_value = mock_file
        
        # Create a mock audio file
        audio_data = b'fake audio data'
        
        # Make the request
        response = client.post(
            '/transcribe',
            data={'audio': (io.BytesIO(audio_data), 'test.webm')},
            content_type='multipart/form-data'
        )
        
        # Verify cleanup was called even on error
        mock_unlink.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
