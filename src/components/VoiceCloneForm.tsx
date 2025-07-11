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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' })
        const audioFile = new File([audioBlob], 'voice-sample.mp3', { type: 'audio/mpeg' })
        setAudioFile(audioFile)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Clone Your Voice
          </CardTitle>
          <CardDescription className="text-center">
            Create a custom voice model using your own voice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Audio Recording Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Record Your Voice Sample
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please read the following text clearly and naturally:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-700 leading-relaxed">
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700 flex items-center gap-2">
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={createVoice}
              disabled={!fullName || !email || !audioFile || isProcessing}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isProcessing ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Creating Voice...
                </>
              ) : (
                'Create Voice'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 