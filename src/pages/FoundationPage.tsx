import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Container,
  PageSection,
} from '../components/layout/LayoutPrimitives'
import { Heading, Text } from '../components/ui/Typography'

export interface FoundationPageProps {
  area: 'customer' | 'business'
  title: string
  description: string
}

export function FoundationPage({
  area,
  title,
  description,
}: FoundationPageProps) {
  return (
    <PageSection>
      <Container>
        <div className="mx-auto flex min-h-[58vh] max-w-xl flex-col items-center justify-center text-center">
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-ovia-primary uppercase">
            Ovia Closet
          </p>
          <Heading>{title}</Heading>
          <Text className="mt-4" tone="muted">{description}</Text>
          <Link
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ovia-primary px-6 text-sm font-bold text-white transition-colors hover:bg-ovia-plum"
            to={area === 'business' ? '/business' : '/'}
          >
            <ArrowLeft aria-hidden="true" size={17} />
            {area === 'business' ? 'Return to business' : 'Return to the Ovia edit'}
          </Link>
        </div>
      </Container>
    </PageSection>
  )
}
