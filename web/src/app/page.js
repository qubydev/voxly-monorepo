'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from "@/lib/auth-client"
import Loader from "@/components/loader"
import VoiceSelector from '@/components/tts/VoiceSelector'
import TTSSettings from '@/components/tts/TTSSettings'
import AudioPlayer from '@/components/tts/AudioPlayer'
import { Button } from '@/components/ui/button'
import { FiDownload, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RiCopperCoinFill } from "react-icons/ri"

const CHAR_LIMIT = 30000
const POLL_INTERVAL = 1000
const defaultVoice = { id: 'en-US-EmmaMultilingualNeural', name: 'Emma', gender: 'Female', language: 'English', country: 'United States' }
const defaultSettings = { speed: 50, stability: 50, similarity: 75 }

export default function Dashboard() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const name = session?.user?.name || 'User'
  const email = session?.user?.email || 'No email'
  const image = session?.user?.image || null
  const imageFallback = name ? name.charAt(0) : '?'

  // Text and settings state
  const [text, setText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice)
  const [settings, setSettings] = useState(defaultSettings)

  // UI state
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)

  // Job state
  const [jobState, setJobState] = useState({
    status: 'idle',
    finishedChunks: 0,
    totalChunks: 0,
    audioUrl: null,
    errorMessage: null
  })
  const [credits, setCredits] = useState('Loading...')

  // Refs for polling control
  const pollTimeoutRef = useRef(null)
  const lastErrorShownRef = useRef(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  // Enhanced polling function with error deduplication
  const pollStatus = useCallback(async (options = {}) => {
    const { isInitialCheck = false } = options

    try {
      const res = await fetch('/api/tts/status')
      if (!res.ok) {
        if (isInitialCheck) setIsInitializing(false)
        return
      }

      const data = await res.json()

      // Update job state
      setJobState(prev => ({
        status: data.status,
        finishedChunks: data.finishedChunks || 0,
        totalChunks: data.totalChunks || 0,
        audioUrl: data.audioUrl || null,
        errorMessage: data.errorMessage || null
      }))

      setCredits(data.credits || 0)

      // Handle different status states
      if (data.status === 'pending' || data.status === 'processing') {
        // Continue polling for active jobs
        pollTimeoutRef.current = setTimeout(
          () => pollStatus({ isInitialCheck: false }),
          POLL_INTERVAL
        )
      } else if (data.status === 'failed') {
        // Show error toast only once per failure
        const errorKey = `${data.errorMessage}-${Date.now()}`
        if (lastErrorShownRef.current !== errorKey && !isInitialCheck) {
          toast.error(data.errorMessage || 'Generation failed.')
          lastErrorShownRef.current = errorKey
        }
      } else if (data.status === 'completed') {
        // Success state - toast already shown if needed
        lastErrorShownRef.current = null
      }

      if (isInitialCheck) setIsInitializing(false)
    } catch (err) {
      console.error('Polling error:', err)
      if (isInitialCheck) setIsInitializing(false)
    }
  }, [])

  // Load saved preferences on mount
  useEffect(() => {
    const savedText = localStorage.getItem('voxly_text')
    if (savedText) setText(savedText)

    const savedVoice = localStorage.getItem('voxly_voice')
    if (savedVoice) {
      try {
        setSelectedVoice(JSON.parse(savedVoice))
      } catch (e) {
        console.error('Failed to parse saved voice', e)
      }
    }

    const savedSettings = localStorage.getItem('voxly_settings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to parse saved settings', e)
      }
    }
  }, [])

  // Debounced localStorage saves - only save when input stops
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text) localStorage.setItem('voxly_text', text)
    }, 500)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    localStorage.setItem('voxly_voice', JSON.stringify(selectedVoice))
  }, [selectedVoice])

  useEffect(() => {
    localStorage.setItem('voxly_settings', JSON.stringify(settings))
  }, [settings])

  // Initial status check when session is ready
  useEffect(() => {
    if (!isPending && session) {
      pollStatus({ isInitialCheck: true })
    }
  }, [isPending, session, pollStatus])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.push('/landing')
    }
  }, [isPending, session, router])

  const handleGenerate = async () => {
    if (!text.trim()) {
      return toast.error('Please enter some text.')
    }

    // Check if user has enough credits
    const creditsNeeded = text.length
    const creditsAvailable = typeof credits === 'number' ? credits : 0

    if (creditsAvailable < creditsNeeded) {
      return toast.error(
        `Insufficient credits. Need ${creditsNeeded.toLocaleString()}, you have ${creditsAvailable.toLocaleString()}`
      )
    }

    // Reset error tracking and set initial state IMMEDIATELY for instant UI feedback
    lastErrorShownRef.current = null
    setJobState({
      status: 'pending',
      finishedChunks: 0,
      totalChunks: 0,
      audioUrl: null,
      errorMessage: null
    })

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice.id
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Reset state on error
        setJobState({
          status: 'idle',
          finishedChunks: 0,
          totalChunks: 0,
          audioUrl: null,
          errorMessage: null
        })
        toast.error(data.error || 'Failed to start generation.')
        return
      }

      // Start polling immediately after generation request
      pollStatus({ isInitialCheck: false })
    } catch (err) {
      console.error('Generation error:', err)
      // Reset state on error
      setJobState({
        status: 'idle',
        finishedChunks: 0,
        totalChunks: 0,
        audioUrl: null,
        errorMessage: null
      })
      toast.error('Failed to connect to server.')
    }
  }

  const handleDownload = async () => {
    if (!jobState.audioUrl || isDownloading) return

    setIsDownloading(true)
    const toastId = toast.loading('Preparing download...')

    try {
      const res = await fetch(jobState.audioUrl)
      if (!res.ok) throw new Error('Failed to fetch audio')

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `voxly-${selectedVoice.name}-${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      toast.success('Downloaded successfully!', { id: toastId })
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Direct download failed. Try opening the link manually.', { id: toastId })
    } finally {
      setIsDownloading(false)
    }
  }

  const getButtonText = () => {
    if (isInitializing) return 'Checking status...'

    const isGenerating = jobState.status === 'pending' || jobState.status === 'processing'
    if (!isGenerating) return 'Generate speech'

    if (jobState.status === 'pending') return 'Queued...'

    const percentage = jobState.totalChunks > 0
      ? Math.round((jobState.finishedChunks / jobState.totalChunks) * 100)
      : 0

    return `Processing (${percentage}%)`
  }

  const isGenerating = jobState.status === 'pending' || jobState.status === 'processing'
  const isOverLimit = text.length > CHAR_LIMIT
  const audioUrl = jobState.audioUrl
  const creditsNeeded = text.length
  const creditsAvailable = typeof credits === 'number' ? credits : 0

  if (isPending || !session) return <Loader />

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center shrink-0">
        <div className='flex items-center gap-1'>
          <Image
            src="/logo.png"
            alt="VOXLY"
            width={32}
            height={32}
            className='size-5'
          />
          <span className="text-sm font-semibold">VOXLY</span>
        </div>
        <div className='flex-1' />
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="cursor-pointer">
            <Avatar className="border border-primary">
              <AvatarImage src={image} />
              <AvatarFallback>{imageFallback}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <p>{name}</p>
              <p className="text-xs text-muted-foreground normal-case">
                {email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className='flex flex-col gap-2'>
              <p className='flex items-center gap-1 px-3 py-2 text-sm'>
                <RiCopperCoinFill className='mr-1' /> Credits: {credits}
              </p>
              <Button className="w-full" variant='destructive' onClick={() => authClient.signOut()}>
                Logout
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Editor area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Textarea */}
          <div className="flex-1 min-h-0 px-6 md:px-10 py-8">
            <textarea
              className="w-full h-full bg-transparent text-base leading-relaxed resize-none outline-none placeholder:text-muted-foreground overflow-y-auto"
              placeholder="Start typing or paste your text here..."
              value={text}
              disabled={isGenerating || isInitializing}
              onChange={e => setText(e.target.value.slice(0, CHAR_LIMIT))}
            />
          </div>

          {/* Controls footer */}
          <div className="border-t border-border px-5 py-4 flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <VoiceSelector selected={selectedVoice} onSelect={setSelectedVoice} compact />
              </div>

              <div className='flex-1'>
                {audioUrl && (
                  <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
                    <AudioPlayer url={audioUrl} />
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent transition-colors shrink-0 disabled:opacity-55"
                      aria-label="Download audio"
                    >
                      <FiDownload size={14} />
                    </button>
                  </div>
                )}
              </div>

              <span className={`text-xs shrink-0 ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {text.length.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
              </span>

              <button
                onClick={() => setMobileSettingsOpen(true)}
                className="md:hidden w-9 h-9 flex items-center justify-center border border-border hover:bg-accent transition-colors shrink-0"
                aria-label="Open settings"
              >
                <FiSettings size={15} />
              </button>

              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating || isInitializing || !text.trim() || isOverLimit}
                className="hidden md:flex gap-2 rounded-none shrink-0"
              >
                {getButtonText()}
              </Button>
            </div>

            {/* Mobile audio player */}
            {audioUrl && (
              <div className="flex md:hidden items-center gap-2 w-full">
                <AudioPlayer url={audioUrl} />
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent transition-colors shrink-0 disabled:opacity-55"
                  aria-label="Download audio"
                >
                  <FiDownload size={14} />
                </button>
              </div>
            )}

            {/* Mobile generate button */}
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || isInitializing || !text.trim() || isOverLimit}
              className="md:hidden w-full gap-2 rounded-none"
            >
              {getButtonText()}
            </Button>
          </div>
        </div>

        {/* Right sidebar - Desktop only */}
        <div className="hidden md:flex w-80 border-l border-border flex-col shrink-0 min-h-0">
          <div className="px-5 py-5 border-b border-border shrink-0">
            <VoiceSelector selected={selectedVoice} onSelect={setSelectedVoice} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5">
            <TTSSettings settings={settings} onChange={setSettings} />
          </div>
        </div>
      </div>

      {/* Mobile settings drawer */}
      <Drawer open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
        <DrawerContent className="rounded-none">
          <DrawerHeader className="px-5 py-4 border-b border-border">
            <DrawerTitle className="text-sm font-semibold">Settings</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 py-5 flex flex-col gap-6 pb-10">
            <VoiceSelector selected={selectedVoice} onSelect={setSelectedVoice} />
            <TTSSettings settings={settings} onChange={setSettings} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}