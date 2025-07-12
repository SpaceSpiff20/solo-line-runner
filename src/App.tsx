import { useState, useRef, useEffect } from 'react'
import { SpeechifyClient } from '@speechify/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import './App.css'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { VoiceCloneForm } from '@/components/VoiceCloneForm'

interface Dialogue {
  speaker: string
  text: string
}

// Available voice IDs for character assignment
const AVAILABLE_VOICES = [
  "scott", "declan", "benjamin", "jennifer", "alejandro", "russel", "claudette", 
  "dylan", "emily", "christina"
]

function App() {
  const [apiKey, setApiKey] = useState('')
  const [client, setClient] = useState<SpeechifyClient | null>(null)
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [cues, setCues] = useState<Dialogue[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState('')
  const [speakers, setSpeakers] = useState<string[]>([])
  const [currentCueIndex, setCurrentCueIndex] = useState(0)
  const [isPracticing, setIsPracticing] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openAIApiKey, setOpenAIApiKey] = useState('')
  const [systemMessage, setSystemMessage] = useState('')
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({})
  const [showVoiceCloneForm, setShowVoiceCloneForm] = useState(false)
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null)
  const [useClonedVoice, setUseClonedVoice] = useState(false)
  const [showVoiceAssignments, setShowVoiceAssignments] = useState(false)
  const [showVoiceCloneStatus, setShowVoiceCloneStatus] = useState(false)
  const [useLLMWrapper, setUseLLMWrapper] = useState(true)

  // Load system message from file
  useEffect(() => {
    fetch('/src/lib/llmSystemMessage.txt')
      .then(res => res.text())
      .then(setSystemMessage)
      .catch(err => console.error('Failed to load system message', err))
  }, [])

  // Initialize Speechify client when API key changes
  useEffect(() => {
    if (apiKey) {
      setClient(new SpeechifyClient({ token: apiKey }))
    }
  }, [apiKey])

  // Assign unique voices to characters when speakers change
  useEffect(() => {
    if (speakers.length > 0) {
      const voiceAssignments: Record<string, string> = {}
      speakers.forEach((speaker, index) => {
        voiceAssignments[speaker] = AVAILABLE_VOICES[index % AVAILABLE_VOICES.length]
      })
      setCharacterVoices(voiceAssignments)
    }
  }, [speakers])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    
    reader.onload = () => {
      const lines = (reader.result as string)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)

      const parsedDialogues = lines.map(line => {
        const colonIndex = line.indexOf(':')
        return colonIndex > -1
          ? { speaker: line.slice(0, colonIndex).trim(), text: line.slice(colonIndex + 1).trim() }
          : { speaker: '', text: line }
      })

      setDialogues(parsedDialogues)
      
      // Get unique speakers
      const uniqueSpeakers = Array.from(new Set(parsedDialogues.map(d => d.speaker).filter(Boolean)))
      setSpeakers(uniqueSpeakers)
    }
    
    reader.readAsText(file)
  }

  const startPractice = () => {
    if (!selectedCharacter || !client) return

    const otherCharacterCues = dialogues.filter(d => d.speaker !== selectedCharacter)
    setCues(otherCharacterCues)
    setCurrentCueIndex(0)
    setIsPracticing(true)
    
    // Speak first cue
    if (otherCharacterCues.length > 0) {
      speakCue(otherCharacterCues[0])
    }
  }

  const speakCue = async (cue: Dialogue) => {
    if (!client) return

    let enhancedText = cue.text
    
    // Only use LLM wrapper if enabled and OpenAI API key is provided
    if (useLLMWrapper && openAIApiKey) {
      try {
        // Enhance cue.text with SSML using OpenAI
        const { text } = await generateText({
          model: createOpenAI({ apiKey: openAIApiKey, compatibility: 'strict' })('gpt-4.1-nano'),
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: cue.text }
          ]
        })
        enhancedText = text
        console.log('Enhanced text:', enhancedText)
      } catch (err) {
        console.error('OpenAI enhancement failed, using original text:', err)
      }
    } else if (useLLMWrapper && !openAIApiKey) {
      console.warn('LLM wrapper enabled but no OpenAI API key provided, using original text')
    } else {
      console.log('Using original text (LLM wrapper disabled)')
    }

    try {
      // Use the assigned voice for this character, or cloned voice if enabled and available
      let voiceId = characterVoices[cue.speaker] || "oliver" // fallback to oliver if no assignment
      
      // If user wants to use their cloned voice and it's available, use it for their character
      if (useClonedVoice && clonedVoiceId && cue.speaker === selectedCharacter) {
        voiceId = clonedVoiceId
      }
      
      const { audioData } = await client.tts.audio.speech({
        input: enhancedText,
        voiceId: voiceId,
        audioFormat: 'wav'
      })
      const audio = new Audio(`data:audio/wav;base64,${audioData}`)
      await audio.play()
    } catch (error) {
      console.error('Error speaking cue:', error)
    }
  }

  const nextCue = () => {
    const nextIndex = currentCueIndex + 1
    if (nextIndex < cues.length) {
      setCurrentCueIndex(nextIndex)
      speakCue(cues[nextIndex])
    }
  }

  // Handle spacebar for next cue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPracticing) {
        e.preventDefault()
        nextCue()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPracticing, currentCueIndex, cues])

  const currentCue = cues[currentCueIndex]
  const isEndOfScene = isPracticing && currentCueIndex >= cues.length - 1

  const exitPractice = () => {
    setIsPracticing(false)
    setCurrentCueIndex(0)
    setCues([])
  }

  const handleVoiceCreated = (voiceId: string) => {
    setClonedVoiceId(voiceId)
    setShowVoiceCloneForm(false)
  }

  const handleCloseVoiceCloneForm = () => {
    setShowVoiceCloneForm(false)
  }

  return (
    <div className={`app-container ${isPracticing ? 'practice-active' : ''}`}>
      <div className={`main-panels ${showVoiceAssignments ? 'showing-voice-assignments' : ''} ${showVoiceCloneStatus ? 'showing-voice-clone-status' : ''}`}>
        {/* Voice Clone Status Panel */}
        {showVoiceCloneStatus && clonedVoiceId && (
          <div className="voice-clone-status-panel">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Voice Clone Status
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  Your Cloned Voice Details
                </CardDescription>
              </CardHeader>
              <CardContent className="card-content space-y-4">
                <div className="space-y-4">
                  {/* Success Status */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-purple-800">Voice Cloned Successfully</span>
                        <p className="text-xs text-purple-600">Your voice has been cloned and is ready to use</p>
                      </div>
                    </div>
                  </div>

                  {/* Voice ID */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Voice ID:</span>
                      <span className="text-purple-600 font-mono text-sm bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                        {clonedVoiceId.slice(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-purple-700">Read my lines for me</label>
                      <button
                        onClick={() => setUseClonedVoice(!useClonedVoice)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                          useClonedVoice ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useClonedVoice ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {useClonedVoice && (
                      <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-purple-700">
                          Your cloned voice will be used for your character's lines
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-purple-800">Voice Clone Info</span>
                  </div>
                  <p className="text-xs text-purple-700 leading-relaxed">
                    Your cloned voice is stored securely and can be used to read your character's lines during practice sessions. 
                    Toggle the switch above to enable or disable this feature.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="controls-panel">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                The Solo Line Runner
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 mt-2">
                Powered by Speechify API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                          <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="openai-api-key" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  OpenAI API Key
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">LLM Enhancement</span>
                  <button
                    onClick={() => setUseLLMWrapper(!useLLMWrapper)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      useLLMWrapper ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    disabled={isPracticing}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        useLLMWrapper ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <Input
                id="openai-api-key"
                type="password"
                placeholder={useLLMWrapper ? "Enter your OpenAI API key" : "LLM enhancement disabled"}
                value={openAIApiKey}
                onChange={(e) => setOpenAIApiKey(e.target.value)}
                disabled={isPracticing || !useLLMWrapper}
                className={`h-12 border-2 transition-all duration-200 ${
                  useLLMWrapper 
                    ? 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' 
                    : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              />
              {!useLLMWrapper && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Using original text without AI enhancement
                </p>
              )}
            </div>
              <div className="space-y-2">
                <label htmlFor="api-key" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Speechify API Key
                </label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Speechify API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isPracticing}
                  className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Script File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isPracticing}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-12 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                  disabled={isPracticing || !apiKey}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Script
                </Button>
                {fileName && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {fileName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="character" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  I will read as:
                </label>
                <Select
                  value={selectedCharacter}
                  onValueChange={setSelectedCharacter}
                  disabled={speakers.length === 0 || isPracticing}
                >
                  <SelectTrigger id="character" className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                    <SelectValue placeholder="Select your character" />
                  </SelectTrigger>
                  <SelectContent>
                    {speakers.map(speaker => (
                      <SelectItem key={speaker} value={speaker}>
                        <div className="flex items-center justify-between w-full">
                          <span>{speaker}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            Voice: {characterVoices[speaker] || 'oliver'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Assignments Toggle Button */}
              {speakers.length > 0 && (
                <Button
                  onClick={() => setShowVoiceAssignments(!showVoiceAssignments)}
                  variant="outline"
                  className="w-full h-12 border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200"
                  disabled={isPracticing}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {showVoiceAssignments ? 'Hide' : 'Show'} Voice Assignments
                </Button>
              )}

               {/* Clone Voice Button */}
               <Button
                onClick={() => setShowVoiceCloneForm(true)}
                variant="outline"
                className="w-full h-12 border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200"
                disabled={!apiKey || isPracticing}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Clone Own Voice
              </Button>

              {/* Voice Clone Status Toggle Button */}
              {clonedVoiceId && (
                <Button
                  onClick={() => setShowVoiceCloneStatus(!showVoiceCloneStatus)}
                  variant="outline"
                  className="w-full h-12 border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200"
                  disabled={isPracticing}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {showVoiceCloneStatus ? 'Hide' : 'Show'} Voice Clone Status
                </Button>
              )}

              <Button
                onClick={startPractice}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                disabled={!selectedCharacter || !apiKey || (useLLMWrapper && !openAIApiKey) || isPracticing}
              >
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Practice
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Voice Assignments Panel */}
        {showVoiceAssignments && speakers.length > 0 && (
          <div className="voice-assignments-panel">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Voice Assignments
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  Character to Voice Mapping
                </CardDescription>
              </CardHeader>
              <CardContent className="card-content space-y-4">
                <div className="space-y-3">
                  {speakers.map(speaker => (
                    <div key={speaker} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {speaker.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800">{speaker}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Voice:</span>
                        <span className="text-blue-600 font-mono text-sm bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                          {characterVoices[speaker] || 'oliver'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-800">Voice Assignment Info</span>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Each character is automatically assigned a unique voice from our available voice library. 
                    You can clone your own voice to use for your selected character.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {isPracticing && (
        <>
          {/* Exit Button */}
          <button
            onClick={exitPractice}
            className="fixed top-6 right-6 z-30 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-white"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="cue-panel">
            <Card className="w-full max-w-4xl">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="text-center">
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Cue {currentCueIndex + 1} of {cues.length}
                    </div>
                  </div>
                
                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${((currentCueIndex + 1) / cues.length) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {Math.round(((currentCueIndex + 1) / cues.length) * 100)}% complete
                  </p>
                </div>
                
                <div className="relative">
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-6xl text-blue-200 opacity-30">"</div>
                  <p className="text-3xl font-medium text-gray-800 leading-relaxed mb-6 relative z-10">
                    {isEndOfScene ? (
                      <span className="text-green-600">🎉 End of scene! Great job!</span>
                    ) : currentCue ? (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-blue-600 font-semibold">{currentCue.speaker}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Voice: {characterVoices[currentCue.speaker] || 'oliver'}
                          </span>
                        </div>
                        <span>{currentCue.text}</span>
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                  <div className="absolute -bottom-8 right-1/2 transform translate-x-1/2 text-6xl text-blue-200 opacity-30">"</div>
                </div>
                
                {!isEndOfScene && (
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Press <kbd className="px-3 py-1 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm">Space</kbd> for next cue
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {/* Voice Clone Form Modal */}
      {showVoiceCloneForm && (
        <VoiceCloneForm
          apiKey={apiKey}
          onClose={handleCloseVoiceCloneForm}
          onVoiceCreated={handleVoiceCreated}
        />
      )}
    </div>
  )
}

export default App
