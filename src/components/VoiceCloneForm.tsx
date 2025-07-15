import { useState, useRef } from 'react'
import { SpeechifyClient } from '@speechify/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface VoiceCloneFormProps {
  apiKey: string
  onClose: () => void
  onVoiceCreated: (voiceId: string) => void
}

export function VoiceCloneForm({ apiKey, onClose, onVoiceCreated }: VoiceCloneFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const targetText = `Listening is like riding a storytelling rollercoaster, where you can lean back and enjoy the ride without having to steer.

The speaker's voice becomes your trusty guide, leading you through twists and turns. It's like having a personal audiobook adventure just for you!

So, buckle up, and let the fun begin!`

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        // Convert to WAV
        try {
          const wavBlob = await convertToWavBlob(audioBlob)
          const wavFile = new File([wavBlob], 'voice-sample.wav', { type: 'audio/wav' })
          setAudioFile(wavFile)
        } catch (err) {
          setError('Failed to process audio. Please try again.')
        }
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      console.log("recording started")
      setIsRecording(true)
      setError('')
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setError('')
    }
  }
  console.log("audioFile:")
  console.log(audioFile)

  const createVoice = async () => {
    if (!fullName || !email || !audioFile) {
      setError('Please fill in all fields and provide an audio sample.')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const client = new SpeechifyClient({ token: apiKey })
      
      // Create consent JSON
      const consent = JSON.stringify({
        fullName: fullName,
        email: email
      })
      console.log(consent)
      console.log(audioFile)

      // Use the File directly as the API should accept it
      const response = await client.tts.voices.create({
        sample: audioFile,
        name: fullName,
        gender: "male", // Default to male, could be made configurable
        consent: consent
      })

      console.log('Voice created:', response)
      
      if (response.id) {
        setSuccess('Voice created successfully!')
        onVoiceCreated(response.id)
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError('Failed to create voice. Please try again.')
      }
    } catch (err) {
      console.error('Error creating voice:', err)
      setError('Failed to create voice. Please check your API key and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-2 text-foreground">
            Clone Your Voice
          </CardTitle>
          <CardDescription className="text-center mb-4 text-muted-foreground">
            Create a custom voice model using your own voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-2 text-foreground">
                Full Name *
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isProcessing}
                className="bg-background text-foreground"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-foreground">
                Email Address *
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing}
                className="bg-background text-foreground"
              />
            </div>
          </div>

          {/* Audio Recording Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Record Your Voice Sample
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please read the following text clearly and naturally:
              </p>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <p className="text-sm text-foreground leading-relaxed">
                  {targetText}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "default"}
                disabled={isProcessing}
                className="flex-1"
              >
                {isRecording ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
                    </svg>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Start Recording
                  </>
                )}
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={isProcessing}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Audio
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            {audioFile && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Audio file ready: {audioFile.name}
                </p>
              </div>
            )}
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="bg-destructive/20 border border-destructive rounded-lg p-3">
              <p className="text-sm text-destructive-foreground">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button onClick={onClose} variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={createVoice} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Create Voice'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 

// Utility: Convert audio Blob to WAV Blob using Web Audio API
async function convertToWavBlob(blob: Blob): Promise<Blob> {
  // Decode audio data
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Encode as WAV
  const wavBuffer = encodeWAV(audioBuffer);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Minimal WAV encoder for PCM 16-bit
function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = audioBuffer.length;
  const blockAlign = numChannels * bitDepth / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Write WAV header
  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
  let offset = 0;
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, format, true); offset += 2; // AudioFormat
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitDepth, true); offset += 2;
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // Write PCM samples
  for (let ch = 0; ch < numChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch);
    let sampleOffset = 44 + ch * 2;
    for (let i = 0; i < samples; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(sampleOffset + i * blockAlign, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }
  return buffer;
} 