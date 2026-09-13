import { ChevronDown, ExternalLink, GitCompare, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  COMMON_PARAMETER_GROUPS,
  GUIDE_SOURCES,
  IDENTIFICATION_CLASSES,
  MODELING_PRIORITY,
  type IdentificationClass,
  type ObjectCategory,
} from '@/data/identificationGuide'
import { classLabelToTitle } from '@/lib/format'
import { cn } from '@/lib/utils'

type CategoryFilter = ObjectCategory | 'all'

function ClassColumn({ entry }: { entry: IdentificationClass | undefined }) {
  if (!entry) return <div className="text-sm text-muted">Select a class to compare.</div>
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-foreground">{entry.name}</h4>
        <Badge variant={entry.category === 'artificial' ? 'danger' : 'secondary'}>
          {entry.category === 'artificial' ? 'Man-made' : 'Natural'}
        </Badge>
      </div>
      <p className="mb-2 text-xs text-muted">{entry.classification}</p>
      {entry.matchesLabels.length > 0 ? (
        <Badge variant="outline" className="mb-3">
          Detected as: {entry.matchesLabels.map(classLabelToTitle).join(', ')}
        </Badge>
      ) : (
        <Badge variant="warning" className="mb-3">
          Not yet trained in current model
        </Badge>
      )}
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Identification parameters
      </p>
      <ul className="mb-3 space-y-1 text-xs text-muted">
        {entry.identificationParameters.map((p) => (
          <li key={p} className="flex gap-1.5">
            <span className="text-primary">•</span>
            {p}
          </li>
        ))}
      </ul>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visual cues</p>
      <ul className="space-y-1 text-xs text-muted">
        {entry.visualDetails.map((v) => (
          <li key={v} className="flex gap-1.5">
            <span className="text-primary">•</span>
            {v}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function IdentificationGuidePage() {
  const [searchParams] = useSearchParams()
  const highlightSlug = searchParams.get('class')

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(highlightSlug ? [highlightSlug] : []))
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [compareOpen, setCompareOpen] = useState(false)
  const [compareA, setCompareA] = useState(IDENTIFICATION_CLASSES[0].slug)
  const [compareB, setCompareB] = useState(IDENTIFICATION_CLASSES[1].slug)
  const compareEntryA = IDENTIFICATION_CLASSES.find((c) => c.slug === compareA)
  const compareEntryB = IDENTIFICATION_CLASSES.find((c) => c.slug === compareB)

  useEffect(() => {
    if (!highlightSlug) return
    setExpanded((prev) => new Set(prev).add(highlightSlug))
    // Scroll after the card has had a chance to render expanded.
    const timer = setTimeout(() => {
      cardRefs.current[highlightSlug]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(timer)
  }, [highlightSlug])

  function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return IDENTIFICATION_CLASSES.filter((c) => {
      if (category !== 'all' && c.category !== category) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.classification.toLowerCase().includes(q) ||
        c.identificationParameters.some((p) => p.toLowerCase().includes(q))
      )
    })
  }, [query, category])

  return (
    <AppShell>
      <PageHeader
        title="Identification Guide"
        description="Reference parameters for classifying underwater side-scan sonar targets - SIH 2026 PS 26057 (MoES/NIOT)."
      />

      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted">
          This is a reference taxonomy of 12 object classes operators use to judge what a sonar
          contact might be. The shipped classifier currently distinguishes 5 of them (
          <em>engineering_platform, pipeline_or_cable, plane_real, seabed_surface, underwater_residual_mound</em>
          ) - classes marked <Badge variant="outline" className="mx-0.5 align-middle">not yet trained</Badge>
          are documented here for manual review and future model expansion, not something the pipeline
          currently outputs.
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes or parameters…"
            className="pl-8"
          />
        </div>
        <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
          <TabsList>
            <TabsTrigger value="all">All classes</TabsTrigger>
            <TabsTrigger value="artificial">Man-made</TabsTrigger>
            <TabsTrigger value="natural">Natural</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant={compareOpen ? 'default' : 'outline'} size="sm" onClick={() => setCompareOpen((v) => !v)}>
          <GitCompare className="h-3.5 w-3.5" /> Compare classes
        </Button>
      </div>

      {compareOpen && (
        <Card className="mb-4">
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Class comparison</h2>
            <p className="text-xs text-muted">
              How the system tells visually similar underwater targets apart - reference criteria side by side.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Select value={compareA} onValueChange={setCompareA}>
                <SelectTrigger>
                  <SelectValue placeholder="Class A" />
                </SelectTrigger>
                <SelectContent>
                  {IDENTIFICATION_CLASSES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={compareB} onValueChange={setCompareB}>
                <SelectTrigger>
                  <SelectValue placeholder="Class B" />
                </SelectTrigger>
                <SelectContent>
                  {IDENTIFICATION_CLASSES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <ClassColumn entry={compareEntryA} />
              <ClassColumn entry={compareEntryB} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((entry) => {
          const isOpen = expanded.has(entry.slug)
          const isHighlighted = highlightSlug === entry.slug
          return (
            <div
              key={entry.slug}
              ref={(el) => {
                cardRefs.current[entry.slug] = el
              }}
            >
            <Card
              className={cn('transition-colors', isHighlighted && 'border-primary ring-1 ring-primary/40')}
            >
              <button
                type="button"
                onClick={() => toggle(entry.slug)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{entry.name}</h3>
                    <Badge variant={entry.category === 'artificial' ? 'danger' : 'secondary'}>
                      {entry.category === 'artificial' ? 'Man-made' : 'Natural'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">{entry.classification}</p>
                  {!isOpen && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Key cue: {entry.identificationParameters[0]} · {entry.visualDetails[0]}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.matchesLabels.length > 0 ? (
                      entry.matchesLabels.map((label) => (
                        <Badge key={label} variant="outline">
                          Detected as: {classLabelToTitle(label)}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="warning">Not yet trained in current model</Badge>
                    )}
                  </div>
                </div>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <CardContent className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Identification parameters
                    </p>
                    <ul className="space-y-1 text-sm text-muted">
                      {entry.identificationParameters.map((p) => (
                        <li key={p} className="flex gap-1.5">
                          <span className="text-primary">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Visual modeling details
                    </p>
                    <ul className="space-y-1 text-sm text-muted">
                      {entry.visualDetails.map((v) => (
                        <li key={v} className="flex gap-1.5">
                          <span className="text-primary">•</span>
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {entry.modelingNote && (
                    <p className="sm:col-span-2 rounded-md bg-warning/10 p-2.5 text-xs text-warning">{entry.modelingNote}</p>
                  )}
                  {entry.reference && (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      <span className="font-medium text-muted">{entry.reference.label}:</span> {entry.reference.detail}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted">No classes match this search.</p>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Common Identification Parameters Across All Classes</h2>
          <p className="text-xs text-muted">Cross-cutting factors used to describe any target, regardless of class.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMON_PARAMETER_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1 text-xs font-semibold text-foreground">{group.title}</p>
              <p className="text-xs text-muted">{group.items.join(' · ')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Modeling Priority for Side-Scan Sonar</h2>
            <p className="text-xs text-muted">Suggested order of importance when judging an unfamiliar contact.</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5 text-sm text-muted">
              {MODELING_PRIORITY.map((item, i) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Sources</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {GUIDE_SOURCES.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
