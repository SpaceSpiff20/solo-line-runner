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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Dialogue {
  speaker: string
  text: string
}

// Available voice IDs for character assignment
const AVAILABLE_VOICES_EN = [
  "scott", "oliver", "benjamin", "jennifer", "alejandro", "russel", "claudette", 
  "dylan", "emily", "christina"
]

const AVAILABLE_VOICES_ES = [
  "alejandro", "Celia"
]

const AVAILABLE_VOICES_FR = [
  "raphael", "elise"
]

const AVAILABLE_VOICES_DE = [
  "frederick", "andra"
]

const AVAILABLE_VOICES_PT_BR = [
  "lucas", "luiza"
]

const AVAILABLE_VOICES_PT_PT = [
  "diogo", "agueda"
]

const AVAILABLE_VOICES_HI_IN = [
  "hemant", "priya"
]
// Language configuration
const LANGUAGE_CONFIG = {
  "en": {
    code: "en",
    name: "English",
    model: "simba-base",
    voices: AVAILABLE_VOICES_EN,
    scriptFile: "sampleScript-en.txt"
  },
  "es": {
    code: "es-ES",
    name: "Español",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_ES,
    scriptFile: "sampleScript-es-ES.txt"
  },
  "fr": {
    code: "fr-FR",
    name: "Français",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_FR,
    scriptFile: "sampleScript-fr-FR.txt"
  },
  "de": {
    code: "de-DE",
    name: "Deutsch",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_DE,
    scriptFile: "sampleScript-de-DE.txt"
  },
  "pt-BR": {
    code: "pt-BR",
    name: "Português (Brasil)",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_PT_BR,
    scriptFile: "sampleScript-pt-BR.txt"
  },
  "pt-PT": {
    code: "pt-PT",
    name: "Português (Portugal)",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_PT_PT,
    scriptFile: "sampleScript-pt-PT.txt"
  },
  "hi-IN": {
    code: "hi-IN",
    name: "हिंदी",
    model: "simba-multilingual",
    voices: AVAILABLE_VOICES_HI_IN,
    scriptFile: "sampleScript-hi-IN.txt"
  }
}

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
  const [] = useState(false)
  const [] = useState(false)
  const [useLLMWrapper, setUseLLMWrapper] = useState(false)
  const [currentSpeechMarks, setCurrentSpeechMarks] = useState<any[] | null>(null)
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  // Add new state for loading and preloaded cues
  const [isLoadingCues, setIsLoadingCues] = useState(false)
  const [preloadedCues, setPreloadedCues] = useState<any[]>([])
  const [, setSampleScript] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [, setShowScriptBanner] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [currentLanguageCode, setCurrentLanguageCode] = useState('en')
  const [currentModel, setCurrentModel] = useState('simba-base')

  // Script validation for malformed lines and duplicates
  const [scriptWarnings, setScriptWarnings] = useState<string[]>([])
  useEffect(() => {
    const lines = scriptText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const seen = new Set<string>()
    const warnings: string[] = []
    lines.forEach((line, idx) => {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) {
        warnings.push(`Line ${idx + 1} is malformed: "${line}"`)
      } else {
        const key = line
        if (seen.has(key)) {
          warnings.push(`Duplicate line at ${idx + 1}: "${line}"`)
        }
        seen.add(key)
      }
    })
    setScriptWarnings(warnings)
  }, [scriptText])

  // Track if audio is currently playing
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  // Load system message from file
  useEffect(() => {
    fetch('/llmSystemMessage.txt')
      .then(res => res.text())
      .then(setSystemMessage)
      .catch(err => console.error('Failed to load system message', err))
  }, [])

  // Load sample script from file
  useEffect(() => {
    const languageConfig = LANGUAGE_CONFIG[selectedLanguage as keyof typeof LANGUAGE_CONFIG]
    if (languageConfig) {
      fetch(`/${languageConfig.scriptFile}`)
        .then(res => res.text())
        .then(text => {
          setSampleScript(text)
          setScriptText(text)
        })
        .catch(err => console.error('Failed to load sample script', err))
      
      setCurrentLanguageCode(languageConfig.code)
      setCurrentModel(languageConfig.model)
    }
  }, [selectedLanguage])

  // Initialize Speechify client when API key changes
  useEffect(() => {
    if (apiKey) {
      setClient(new SpeechifyClient({ token: apiKey }))
    }
  }, [apiKey])

  // Assign unique voices to characters when speakers change
  useEffect(() => {
    if (speakers.length > 0) {
      const languageConfig = LANGUAGE_CONFIG[currentLanguageCode as keyof typeof LANGUAGE_CONFIG]
      const availableVoices = languageConfig ? languageConfig.voices : AVAILABLE_VOICES_EN
      const voiceAssignments: Record<string, string> = {}
      speakers.forEach((speaker, index) => {
        voiceAssignments[speaker] = availableVoices[index % availableVoices.length]
      })
      setCharacterVoices(voiceAssignments)
    }
  }, [speakers, currentLanguageCode])

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

  // Add handler for using the script text
  const handleUseScriptText = () => {
    // Parse scriptText into dialogues and speakers
    const lines = scriptText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const parsedDialogues = lines.map(line => {
      const colonIndex = line.indexOf(':')
      return colonIndex > -1
        ? { speaker: line.slice(0, colonIndex).trim(), text: line.slice(colonIndex + 1).trim() }
        : { speaker: '', text: line }
    })
    setDialogues(parsedDialogues)
    const uniqueSpeakers = Array.from(new Set(parsedDialogues.map(d => d.speaker).filter(Boolean)))
    setSpeakers(uniqueSpeakers)
    const languageConfig = LANGUAGE_CONFIG[currentLanguageCode as keyof typeof LANGUAGE_CONFIG]
    setFileName(`${languageConfig?.name || 'Sample'} Script`)
    setShowScriptBanner(true)
    setTimeout(() => setShowScriptBanner(false), 2500)
  }

  // Helper to get enhanced text and audio for a cue
  const fetchCueAudio = async (cue: Dialogue) => {
    let enhancedText = cue.text
    if (useLLMWrapper && openAIApiKey) {
      try {
        const { text } = await generateText({
          model: createOpenAI({ apiKey: openAIApiKey, compatibility: 'strict' })('gpt-4.1-nano'),
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: cue.text }
          ]
        })
        enhancedText = text
        console.log(text)
      } catch (err) {
        // fallback to original text
      }
    }
    let voiceId = characterVoices[cue.speaker] || "oliver"
    if (
      useClonedVoice &&
      clonedVoiceId &&
      cue.speaker === selectedCharacter
    ) {
      voiceId = clonedVoiceId
    }
    const { audioData, speechMarks } = await client!.tts.audio.speech({
      input: enhancedText,
      voiceId: voiceId,
      audioFormat: 'wav',
      language: currentLanguageCode,
      model: currentModel as "simba-english" | "simba-multilingual"
    })
    return {
      cue,
      audio: new Audio(`data:audio/wav;base64,${audioData}`),
      speechMarks: speechMarks?.chunks || null,
      enhancedText
    }
  }

  // Preload up to N cues serially
  const preloadCues = async (startIdx: number, count: number, cueList: Dialogue[]) => {
    const results = []
    for (let i = 0; i < count; i++) {
      const idx = startIdx + i
      if (idx >= cueList.length) break
      try {
        const preloaded = await fetchCueAudio(cueList[idx])
        results.push(preloaded)
      } catch (e) {
        // If a cue fails, push null to keep indices aligned
        results.push(null)
      }
    }
    return results
  }

  // Fix playPreloadedCue to use absolute cue index
  const playPreloadedCue = (cueIdx: number, preloads = preloadedCues) => {
    const pre = preloads[cueIdx] // use absolute index
    if (!pre) return
    // Stop previous audio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }
    setCurrentSpeechMarks(pre.speechMarks)
    setCurrentWordIndex(-1)
    setCurrentAudio(pre.audio)
    setIsAudioPlaying(true)
    if (highlightTimerRef.current) {
      cancelAnimationFrame(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
    pre.audio.onplay = () => {
      setIsAudioPlaying(true)
      const updateHighlight = () => {
        if (!pre.speechMarks) return
        const timeMs = pre.audio.currentTime * 1000
        let idx = pre.speechMarks.findIndex((chunk: any) =>
          chunk.type === 'word' &&
          timeMs >= chunk.startTime &&
          timeMs < chunk.endTime
        )
        if (idx === -1 && timeMs >= (pre.speechMarks[pre.speechMarks.length - 1]?.endTime || 0)) {
          idx = pre.speechMarks.length - 1
        }
        setCurrentWordIndex(idx)
        if (!pre.audio.paused && !pre.audio.ended) {
          highlightTimerRef.current = requestAnimationFrame(updateHighlight)
        }
      }
      highlightTimerRef.current = requestAnimationFrame(updateHighlight)
    }
    pre.audio.onended = () => {
      setCurrentWordIndex(-1)
      setIsAudioPlaying(false)
      if (highlightTimerRef.current) {
        cancelAnimationFrame(highlightTimerRef.current)
        highlightTimerRef.current = null
      }
    }
    pre.audio.onpause = () => {
      setIsAudioPlaying(false)
    }
    pre.audio.play()
  }

  // Buffer management: keep 5 cues preloaded ahead
  useEffect(() => {
    if (!isPracticing) return
    const bufferSize = 5
    const nextToPreload = currentCueIndex + preloadedCues.length
    if (preloadedCues.length < bufferSize && nextToPreload < cues.length) {
      // Preload next cue serially
      (async () => {
        const nextPreload = await preloadCues(nextToPreload, 1, cues)
        setPreloadedCues(prev => [...prev, ...nextPreload])
      })()
    }
  }, [isPracticing, currentCueIndex, preloadedCues, cues])

  // Update nextCue to always update UI, only play audio for non-user lines
  const nextCue = () => {
    if (isAudioPlaying && currentAudio && !currentAudio.paused && !currentAudio.ended) return
    const nextIndex = currentCueIndex + 1
    if (nextIndex < cues.length) {
      setCurrentCueIndex(nextIndex)
      // Always update UI for the next cue
      if (cues[nextIndex].speaker !== selectedCharacter && preloadedCues[nextIndex]) {
        playPreloadedCue(nextIndex, preloadedCues)
      } else {
        setCurrentSpeechMarks(null)
        setCurrentWordIndex(-1)
        setCurrentAudio(null)
        setIsAudioPlaying(false)
      }
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

  // Update startPractice to preload all cues and use absolute indexing
  const startPractice = async () => {
    if (!selectedCharacter || !client) return
    // Always include all lines for cues
    const cuesToPractice = dialogues
    setCues(cuesToPractice)
    setCurrentCueIndex(0)
    setIsLoadingCues(true)
    const preloadCount = cuesToPractice.length // preload all cues for absolute indexing
    const preloaded = await preloadCues(0, preloadCount, cuesToPractice)
    setPreloadedCues(preloaded)
    setIsLoadingCues(false)
    setIsPracticing(true)
    // Only play audio if the first cue is not the user's line
    if (preloaded[0] && cuesToPractice[0].speaker !== selectedCharacter) {
      playPreloadedCue(0, preloaded)
    } else {
      setCurrentSpeechMarks(null)
      setCurrentWordIndex(-1)
      setCurrentAudio(null)
      setIsAudioPlaying(false)
    }
  }

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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        cancelAnimationFrame(highlightTimerRef.current)
      }
    }
  }, [])

  // Practice mode cue panel UI
  const renderPracticePanel = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95">
      <Card className="w-full max-w-3xl p-8 shadow-2xl border border-border bg-card relative">
        {/* Exit Button */}
                <Button
          onClick={exitPractice}
                  variant="outline"
          className="absolute top-4 right-4"
        >
          Exit
                </Button>
              <CardContent className="pt-8 pb-8 px-8">
                <div className="text-center">
                  <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-full text-sm font-medium">
                      Cue {currentCueIndex + 1} of {cues.length}
                    </div>
                  </div>
                {/* Progress Bar */}
                <div className="mb-8">
              <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${((currentCueIndex + 1) / cues.length) * 100}%` }}
                    ></div>
                  </div>
              <p className="text-xs text-muted-foreground mt-2">
                    {Math.round(((currentCueIndex + 1) / cues.length) * 100)}% complete
                  </p>
                </div>
                <div className="relative">
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-6xl text-muted opacity-20 select-none">"</div>
              {/* Speaker and voice info (move out of <p>) */}
              {isEndOfScene ? null : currentCue ? (
                <div className="flex items-center gap-3 mb-2 justify-center">
                  <span className="text-blue-400 font-semibold">{currentCue.speaker}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            Voice: {characterVoices[currentCue.speaker] || 'oliver'}
                          </span>
                        </div>
              ) : null}
              <p className="text-3xl font-medium text-foreground leading-relaxed mb-6 relative z-10">
                {isEndOfScene ? (
                  <span className="text-green-400">🎉 End of scene! Great job!</span>
                ) : currentCue ? (
                  <>
                        {/* Highlighted text rendering */}
                        {currentSpeechMarks && currentSpeechMarks.length > 0 ? (
                          <span>
                            {currentSpeechMarks.filter((chunk: any) => chunk.type === 'word').map((chunk: any, idx: number) => (
                              <span
                                key={idx}
                            style={idx === currentWordIndex ? { backgroundColor: '#a78bfa', color: '#fff', borderRadius: 4, padding: '0 2px' } : {}}
                              >
                                {chunk.value}{' '}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span>{currentCue.text}</span>
                        )}
                      </>
                    ) : (
                      ''
                    )}
                  </p>
              <div className="absolute -bottom-8 right-1/2 transform translate-x-1/2 text-6xl text-muted opacity-20 select-none">"</div>
                </div>
                {!isEndOfScene && (
              <div className="mt-8 p-4 bg-muted rounded-lg border border-border">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  Press <kbd className="px-3 py-1 text-sm font-semibold bg-background border border-border rounded-md shadow-sm">Space</kbd> for next cue
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
  )

  // Advanced tab content: character assignments, voice cloning, LLM enhancement, and cloned voice status/toggle
  const renderAdvancedTab = () => (
    <Card className="w-full max-w-2xl p-8 shadow-2xl border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center mb-2">Advanced Settings</CardTitle>
        <CardDescription className="text-center mb-4">
          Character voice assignments, voice cloning, and LLM enhancement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Character Assignments */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Character Voice Assignments</h3>
          <div className="space-y-2">
            {speakers.length === 0 && <div className="text-muted-foreground text-sm">No characters loaded yet.</div>}
            {speakers.map(speaker => (
              <div key={speaker} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <span className="font-medium text-foreground">{speaker}</span>
                <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                  Voice: {characterVoices[speaker] || 'oliver'}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Voice Cloning & Status */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Voice Cloning</h3>
          <Button type="button" onClick={() => setShowVoiceCloneForm(true)}>
            Clone Your Voice
          </Button>
          {clonedVoiceId && (
            <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-medium text-foreground">Voice Cloned Successfully</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">Voice ID:</span>
                <span className="text-purple-400 font-mono text-xs bg-background px-2 py-1 rounded border border-border">
                  {clonedVoiceId.slice(0, 8)}...
                </span>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <label className="text-sm font-medium text-foreground">Read my lines for me</label>
                <Button
                  type="button"
                  variant={useClonedVoice ? 'default' : 'outline'}
                  onClick={() => setUseClonedVoice(v => !v)}
                  className={useClonedVoice ? '' : 'opacity-70'}
                >
                  {useClonedVoice ? 'On' : 'Off'}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {useClonedVoice
                  ? 'Your cloned voice will be used to read your character’s lines. The entire script will be read.'
                  : 'Only other characters’ lines will be read aloud.'}
              </div>
            </div>
          )}
        </div>
        {/* LLM Enhancement */}
        <div>
          <h3 className="text-lg font-semibold mb-2">LLM Enhancement</h3>
          <div className="flex items-center gap-4">
            <Input
              id="openai-api-key"
              type="password"
              placeholder="OpenAI API Key"
              value={openAIApiKey}
              onChange={e => setOpenAIApiKey(e.target.value)}
              className="w-64"
            />
            <Button
              type="button"
              variant={useLLMWrapper ? 'default' : 'outline'}
              onClick={() => setUseLLMWrapper(v => !v)}
            >
              {useLLMWrapper ? 'LLM On' : 'LLM Off'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {useLLMWrapper
              ? 'AI will enhance cue text using your OpenAI API key.'
              : 'LLM enhancement is disabled.'}
          </div>
        </div>
        {/* Voice Clone Modal */}
      {showVoiceCloneForm && (
        <VoiceCloneForm
          apiKey={apiKey}
            onClose={() => setShowVoiceCloneForm(false)}
          onVoiceCreated={handleVoiceCreated}
        />
      )}
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center px-2 relative">
      {/* Loading Overlay */}
      {isLoadingCues && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-6"></div>
          <div className="text-xl font-semibold text-white">Loading Lines...</div>
        </div>
      )}
      {/* Speechify logo at top left */}
      <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 50 }}>
        <svg width="240" height="64" viewBox="0 0 384 96" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'brightness(0)' }}>
          <image href="https://website.cdn.speechify.com/speechify-logo-v2.svg?quality=95&width=384" width="240" height="64" />
        </svg>
      </div>
      {/* Show practice panel if practicing, otherwise show tabbed UI */}
      {isPracticing ? (
        renderPracticePanel()
      ) : (
        <Tabs defaultValue="main" className="w-full max-w-2xl">
          <TabsList className="mb-4 flex justify-center">
            <TabsTrigger value="main">Main</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="main">
            <Card className="w-full p-8 shadow-2xl border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-center mb-2">Solo Line Runner</CardTitle>
                <CardDescription className="text-center mb-4">
                  Powered by Speechify API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Language Selection */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex-1">
                    <label htmlFor="language" className="block text-sm font-medium mb-1">Language</label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="apiKey" className="block text-sm font-medium mb-1">Speechify API Key</label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter Speechify API Key"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                {/* Script Input */}
                <div>
                  <label htmlFor="scriptText" className="block text-sm font-medium mb-1">Script</label>
                  <textarea
                    id="scriptText"
                    className="w-full min-h-[120px] rounded-md border border-input bg-background text-foreground p-3 mb-2 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
                    value={scriptText}
                    onChange={e => setScriptText(e.target.value)}
                    placeholder="Paste or write your script here. Format: Character: Line"
                  />
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleUseScriptText} size="sm">Use Script</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Upload File</Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  {fileName && <div className="text-xs text-muted-foreground mt-1">Loaded: {fileName}</div>}
                  {scriptWarnings.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-sm text-yellow-800">
                      <h4 className="font-semibold mb-1">Script Warnings:</h4>
                      <ul className="list-disc list-inside">
                        {scriptWarnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {/* Practice Controls */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex-1">
                    <label htmlFor="character" className="block text-sm font-medium mb-1">Your Character</label>
                    <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select character" />
                      </SelectTrigger>
                      <SelectContent>
                        {speakers.map(speaker => (
                          <SelectItem key={speaker} value={speaker}>{speaker}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 flex gap-2 items-end">
                    <Button type="button" onClick={startPractice} disabled={dialogues.length === 0 || !selectedCharacter}>
                      Start Practice
                    </Button>
          </div>
        </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="advanced">
            {renderAdvancedTab()}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default App
