import { useState, useRef, useEffect } from 'react'
import { SpeechifyClient } from '@speechify/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import './App.css'

interface Dialogue {
  speaker: string
  text: string
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

  // Initialize Speechify client when API key changes
  useEffect(() => {
    if (apiKey) {
      setClient(new SpeechifyClient({ token: apiKey }))
    }
  }, [apiKey])

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

    try {
      const { audioData } = await client.tts.audio.speech({
        input: cue.text,
        voiceId: 'russell',
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

  return (
    <div className={`app-container ${isPracticing ? 'practice-active' : ''}`}>
      <div className="controls-panel">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>The Solo Line Runner</CardTitle>
            <CardDescription>Powered by Speechify API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="api-key" className="text-sm font-medium">
                Speechify API Key
              </label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isPracticing}
              />
            </div>

            <div className="space-y-2">
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
                className="w-full"
                disabled={isPracticing || !apiKey}
              >
                Upload Script
              </Button>
              {fileName && (
                <p className="text-sm text-muted-foreground">{fileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="character" className="text-sm font-medium">
                I will read as:
              </label>
              <Select
                value={selectedCharacter}
                onValueChange={setSelectedCharacter}
                disabled={speakers.length === 0 || isPracticing}
              >
                <SelectTrigger id="character">
                  <SelectValue placeholder="Select your character" />
                </SelectTrigger>
                <SelectContent>
                  {speakers.map(speaker => (
                    <SelectItem key={speaker} value={speaker}>
                      {speaker}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={startPractice}
              className="w-full"
              disabled={!selectedCharacter || !apiKey || isPracticing}
            >
              Start Practice
            </Button>
          </CardContent>
        </Card>
      </div>

      {isPracticing && (
        <div className="cue-panel">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6">
              <p className="text-2xl mb-4">
                {isEndOfScene ? 'End of scene.' : currentCue ? `${currentCue.speaker}: ${currentCue.text}` : ''}
              </p>
              {!isEndOfScene && (
                <p className="text-sm text-muted-foreground">
                  Press <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">Space</kbd> for next cue
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default App
