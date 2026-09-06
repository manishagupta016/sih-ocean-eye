import {
  ArrowRight,
  BarChart3,
  Gauge,
  Leaf,
  MapPinned,
  Radar,
  ScanSearch,
  ShieldCheck,
  Trash2,
  Waves,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const VISION_PILLARS = [
  { icon: Radar, label: 'Sonar Vision' },
  { icon: Trash2, label: 'Marine Debris Detection' },
  { icon: BarChart3, label: 'Smart Analytics' },
  { icon: ShieldCheck, label: 'Ocean Protection' },
  { icon: Leaf, label: 'Sustainable Future' },
]

const PIPELINE_STAGES = [
  { icon: ScanSearch, title: 'Detect', description: 'YOLOv8 locates candidate objects in side-scan sonar waterfall imagery.' },
  { icon: Waves, title: 'Discriminate', description: 'A separate shape/shadow/texture classifier scores natural vs. artificial.' },
  { icon: Gauge, title: 'Calibrate', description: 'Isotonic calibration turns raw confidence into a trustworthy probability.' },
  { icon: ShieldCheck, title: 'Risk-score', description: 'A transparent, inspectable formula assigns one of four risk tiers.' },
  { icon: MapPinned, title: 'Geolocate', description: 'Coordinates attach only when real navigation metadata is present.' },
]

const FEATURES = [
  {
    title: 'Never fabricated coordinates',
    description:
      'Detections without navigation metadata are clearly labeled "image-space only" and kept off the map, not silently guessed.',
  },
  {
    title: 'Calibrated, not raw, confidence',
    description:
      'Every score shown to operators has passed through isotonic calibration, with Expected Calibration Error tracked on the Analytics page.',
  },
  {
    title: 'Explainable risk scoring',
    description:
      'Risk tiers come from a weighted formula you can inspect line-by-line, not a black-box model - built for stakeholders who need to trust the output.',
  },
  {
    title: 'Cross-domain honesty',
    description:
      'Accuracy drop when moving to a different sonar device or survey site is measured and surfaced explicitly, not hidden.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo />
        <Button asChild size="sm">
          <Link to="/login">
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <img
          src="/logo-hero.png"
          alt="Ocean Eye"
          className="mx-auto mb-8 h-40 w-40 object-contain sm:h-48 sm:w-48"
        />
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
          MoES / NIOT · PS 26057
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          SEE DEEPER. PROTECT BETTER.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground/80">
          From sonar pixels to trustworthy, actionable coordinates.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted">
          Ocean Eye is an AI-powered decision-support pipeline that detects, discriminates,
          geolocates, and risk-ranks underwater marine debris from side-scan sonar surveys - built
          for research institutions and marine survey operations, not just object detection demos.
        </p>

        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {VISION_PILLARS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-muted">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              Launch console <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PIPELINE_STAGES.map(({ icon: Icon, title, description }, i) => (
            <Card key={title} className="relative">
              <CardContent className="flex flex-col items-start gap-2 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">
                  {i + 1}. {title}
                </p>
                <p className="text-xs text-muted">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="mt-1.5 text-sm text-muted">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Ocean Eye - decision-support prototype for the Smart India Hackathon.
      </footer>
    </div>
  )
}
