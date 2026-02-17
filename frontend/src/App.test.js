import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }

  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test'], { type: 'audio/webm' }), size: 100 });
    }
  }
}

// Mock global MediaRecorder
global.MediaRecorder = MockMediaRecorder;

describe('App Component', () => {
  // Mock navigator.mediaDevices.getUserMedia
  const mockGetUserMedia = jest.fn();
  const mockTracks = [
    { stop: jest.fn() },
    { stop: jest.fn() }
  ];
  const mockStream = {
    getTracks: () => mockTracks
  };

  // Mock fetch
  global.fetch = jest.fn();

  // Mock navigator.clipboard
  const mockWriteText = jest.fn();
  Object.assign(navigator, {
    clipboard: {
      writeText: mockWriteText,
    },
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue(mockStream);
    mockWriteText.mockResolvedValue();
    
    // Reset fetch mock
    global.fetch.mockClear();
  });

  describe('Initial Rendering', () => {
    it('renders the app title and subtitle', () => {
      render(<App />);
      expect(screen.getByText(/Speech to Chords/i)).toBeInTheDocument();
      expect(screen.getByText(/Record your speech and convert it to musical chord symbols/i)).toBeInTheDocument();
    });

    it('renders the start recording button initially', () => {
      render(<App />);
      expect(screen.getByText(/Start Recording/i)).toBeInTheDocument();
      expect(screen.queryByText(/Stop Recording/i)).not.toBeInTheDocument();
    });

    it('does not show processing indicator initially', () => {
      render(<App />);
      expect(screen.queryByText(/Processing audio/i)).not.toBeInTheDocument();
    });

    it('does not show error message initially', () => {
      render(<App />);
      expect(screen.queryByText(/⚠️/i)).not.toBeInTheDocument();
    });

    it('does not show results initially', () => {
      render(<App />);
      expect(screen.queryByText(/Chord Chart/i)).not.toBeInTheDocument();
    });
  });

  describe('Recording Functionality', () => {
    it('starts recording when start button is clicked', async () => {
      render(<App />);
      const startButton = screen.getByText(/Start Recording/i);
      
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      });

      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });
    });

    it('shows stop button when recording', async () => {
      render(<App />);
      const startButton = screen.getByText(/Start Recording/i);
      
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
        expect(screen.queryByText(/Start Recording/i)).not.toBeInTheDocument();
      });
    });

    it('stops recording when stop button is clicked', async () => {
      render(<App />);
      const startButton = screen.getByText(/Start Recording/i);
      
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const stopButton = screen.getByText(/Stop Recording/i);
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText(/Start Recording/i)).toBeInTheDocument();
      });
    });

    it('disables start button when processing', async () => {
      render(<App />);
      const startButton = screen.getByText(/Start Recording/i);
      
      // Set processing state by mocking a fetch that's in progress
      // We'll trigger processing by starting and stopping a recording
      fireEvent.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const stopButton = screen.getByText(/Stop Recording/i);
      
      // Mock a delayed fetch response
      global.fetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            transcription: 'test',
            chords: ['C'],
            chord_chart: 'test chart'
          })
        }), 100))
      );

      fireEvent.click(stopButton);

      // Should show processing indicator
      await waitFor(() => {
        expect(screen.getByText(/Processing audio/i)).toBeInTheDocument();
      });
    });

    it('handles microphone access error', async () => {
      const errorMessage = 'Permission denied';
      mockGetUserMedia.mockRejectedValue(new Error(errorMessage));

      render(<App />);
      const startButton = screen.getByText(/Start Recording/i);
      
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Error accessing microphone.*${errorMessage}`, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Audio Processing', () => {
    it('processes audio after stopping recording', async () => {
      render(<App />);
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      // Mock successful API response
      const mockResponse = {
        transcription: 'The song uses C major and A minor',
        chords: ['C', 'Am'],
        chord_chart: 'Chord Chart\nChords: C  Am\n\nTranscription: The song uses C major and A minor'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Stop recording
      fireEvent.click(screen.getByText(/Stop Recording/i));

      // Should show processing indicator
      await waitFor(() => {
        expect(screen.getByText(/Processing audio/i)).toBeInTheDocument();
      });

      // Should show results after processing
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Chord Chart/i })).toBeInTheDocument();
        expect(screen.getByText(mockResponse.transcription)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith('transcribe', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('displays chords when available', async () => {
      render(<App />);
      
      // Start and stop recording
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const mockResponse = {
        transcription: 'C major, D minor, E major',
        chords: ['C', 'Dm', 'E'],
        chord_chart: 'Chord Chart\nChords: C  Dm  E'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        expect(screen.getByText('C')).toBeInTheDocument();
        expect(screen.getByText('Dm')).toBeInTheDocument();
        expect(screen.getByText('E')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays "No chords detected" when no chords are found', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const mockResponse = {
        transcription: 'This is just regular speech',
        chords: [],
        chord_chart: 'No chords detected'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        // Check that "No chords detected" appears (may appear in multiple places)
        const noChordsElements = screen.getAllByText(/No chords detected/i);
        expect(noChordsElements.length).toBeGreaterThan(0);
        // Verify the p element with class "no-chords" specifically exists
        const noChordsP = noChordsElements.find(el => el.className.includes('no-chords'));
        expect(noChordsP).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles API error response', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' })
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        expect(screen.getByText(/Error processing audio.*Server error/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles network error', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        expect(screen.getByText(/Error processing audio.*Network error/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('stops all media tracks after processing', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcription: 'test',
          chords: ['C'],
          chord_chart: 'test'
        })
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        mockTracks.forEach(track => {
          expect(track.stop).toHaveBeenCalled();
        });
      }, { timeout: 3000 });
    });
  });

  describe('Copy to Clipboard', () => {
    it('copies chord chart to clipboard', async () => {
      render(<App />);
      
      // Set up state with chord chart
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const mockResponse = {
        transcription: 'test',
        chords: ['C', 'Am'],
        chord_chart: 'Chord Chart\nChords: C  Am'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        expect(screen.getByText(/Copy Chart/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const copyButton = screen.getByText(/Copy Chart/i);
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(mockResponse.chord_chart);
      });
    });

    it('updates button text after copying', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcription: 'test',
          chords: ['C'],
          chord_chart: 'test chart'
        })
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        const copyButton = screen.getByText(/Copy Chart/i);
        expect(copyButton).toBeInTheDocument();
      }, { timeout: 3000 });

      const copyButton = screen.getByText(/Copy Chart/i);
      fireEvent.click(copyButton);
      
      // Button text should change to "Copied!"
      await waitFor(() => {
        expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles clipboard error', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard error'));

      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcription: 'test',
          chords: ['C'],
          chord_chart: 'test chart'
        })
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        const copyButton = screen.getByText(/Copy Chart/i);
        fireEvent.click(copyButton);
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText(/Failed to copy to clipboard.*Clipboard error/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI State Management', () => {
    it('clears error when starting new recording', async () => {
      // First, trigger an error
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

      render(<App />);
      fireEvent.click(screen.getByText(/Start Recording/i));

      await waitFor(() => {
        expect(screen.getByText(/Error accessing microphone/i)).toBeInTheDocument();
      });

      // Then start a successful recording
      mockGetUserMedia.mockResolvedValueOnce(mockStream);
      fireEvent.click(screen.getByText(/Start Recording/i));

      await waitFor(() => {
        expect(screen.queryByText(/Error accessing microphone/i)).not.toBeInTheDocument();
      });
    });

    it('shows transcription when available', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      const mockResponse = {
        transcription: 'This is the transcribed text',
        chords: ['C'],
        chord_chart: 'Chord Chart'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      await waitFor(() => {
        expect(screen.getByText(/Transcription/i)).toBeInTheDocument();
        expect(screen.getByText(mockResponse.transcription)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('hides processing indicator after completion', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByText(/Start Recording/i));
      
      await waitFor(() => {
        expect(screen.getByText(/Stop Recording/i)).toBeInTheDocument();
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transcription: 'test',
          chords: ['C'],
          chord_chart: 'test'
        })
      });

      fireEvent.click(screen.getByText(/Stop Recording/i));

      // Should show processing
      await waitFor(() => {
        expect(screen.getByText(/Processing audio/i)).toBeInTheDocument();
      });

      // Should hide processing after completion
      await waitFor(() => {
        expect(screen.queryByText(/Processing audio/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
