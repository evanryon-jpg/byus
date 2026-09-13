import { notFound } from 'next/navigation';
import DemoProfile from '../DemoProfile';
import { DEMO_PROFILES } from '../profiles';

export function generateStaticParams() { return Object.keys(DEMO_PROFILES).map((slug) => ({ slug })); }

export function generateMetadata({ params }) {
  const creator = DEMO_PROFILES[params.slug];
  return creator ? { title: `${creator.name} Demo — ByUs`, description: `Explore a fictional ${creator.craft.toLowerCase()} membership page on ByUs.`, alternates: { canonical: `/demo/${params.slug}` } } : {};
}

export default function DemoCreatorPage({ params }) {
  const creator = DEMO_PROFILES[params.slug];
  if (!creator) notFound();
  return <DemoProfile creator={creator} />;
}
