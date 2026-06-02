'use client'
import { useState, useEffect } from 'react'
import { FiCheck, FiSearch, FiChevronDown } from 'react-icons/fi'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useMediaQuery } from '@/hooks/use-media-query'

const avatarUrl = (seed) =>
    `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}`

function VoiceList({ voices, selected, onSelect, search, setSearch, isLoading }) {
    const filtered = voices.filter(v =>
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.country?.toLowerCase().includes(search.toLowerCase()) ||
        v.language?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex flex-col">
            <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 border border-border px-3 py-2">
                    <FiSearch size={13} className="text-muted-foreground shrink-0" />
                    <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search voices..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
            </div>
            <div className="overflow-y-auto flex flex-col divide-y divide-border max-h-[50vh]">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading voices...</div>
                ) : (
                    <>
                        {filtered.map(voice => (
                            <button
                                key={voice.id}
                                onClick={() => onSelect(voice)}
                                className="flex items-center gap-4 px-4 py-3 hover:bg-accent transition-colors text-left"
                            >
                                <img src={avatarUrl(voice.name)} alt={voice.name} className="w-9 h-9 shrink-0" />
                                <div className="flex-1 flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">{voice.name}</span>
                                    <span className="text-xs text-muted-foreground">{voice.country}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs rounded-none">{voice.language}</Badge>
                                <Badge variant="secondary" className="text-xs rounded-none">{voice.gender}</Badge>
                                {selected?.id === voice.id && <FiCheck size={14} />}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-4 py-8 text-center text-xs text-muted-foreground">No voices found.</div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default function VoiceSelector({ selected, onSelect, compact = false }) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [voices, setVoices] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const isDesktop = useMediaQuery("(min-width: 768px)")

    useEffect(() => {
        const fetchVoices = async () => {
            try {
                const response = await fetch('/api/voices')
                if (response.ok) {
                    const data = await response.json()
                    setVoices(data)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchVoices()
    }, [])

    const handleSelect = (voice) => {
        onSelect(voice)
        setOpen(false)
        setSearch('')
    }

    const trigger = compact ? (
        <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-border hover:bg-accent transition-colors"
        >
            {selected && <img src={avatarUrl(selected.name)} alt={selected.name} className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{selected ? selected.name : 'Select Voice'}</span>
            <FiChevronDown size={12} className="text-muted-foreground" />
        </button>
    ) : (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Voice</span>
            <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border border-border bg-card hover:bg-accent transition-colors"
            >
                {selected && <img src={avatarUrl(selected.name)} alt={selected.name} className="w-7 h-7 shrink-0" />}
                <span className="flex-1 text-left text-sm font-medium">{selected ? selected.name : 'Select Voice'}</span>
                <span className="text-xs text-muted-foreground">{selected ? selected.country : ''}</span>
            </button>
        </div>
    )

    if (isDesktop) {
        return (
            <>
                {trigger}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="p-0 gap-0 rounded-none max-w-lg">
                        <DialogHeader className="px-4 py-4 border-b border-border">
                            <DialogTitle className="text-sm">Select Voice</DialogTitle>
                        </DialogHeader>
                        <VoiceList
                            voices={voices}
                            selected={selected}
                            onSelect={handleSelect}
                            search={search}
                            setSearch={setSearch}
                            isLoading={isLoading}
                        />
                    </DialogContent>
                </Dialog>
            </>
        )
    }

    return (
        <>
            {trigger}
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent className="rounded-none">
                    <DrawerHeader className="px-4 py-4 border-b border-border">
                        <DrawerTitle className="text-sm">Select Voice</DrawerTitle>
                    </DrawerHeader>
                    <VoiceList
                        voices={voices}
                        selected={selected}
                        onSelect={handleSelect}
                        search={search}
                        setSearch={setSearch}
                        isLoading={isLoading}
                    />
                </DrawerContent>
            </Drawer>
        </>
    )
}