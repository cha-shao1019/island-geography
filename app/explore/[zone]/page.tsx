import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import IslandApp from '@/components/IslandApp';
import { ALL } from '@/content/zones';

const IDS = ['all', 'link', ...ALL.map((z) => z.id)];

export function generateStaticParams() {
  return IDS.map((zone) => ({ zone }));
}

export async function generateMetadata({ params }: { params: Promise<{ zone: string }> }): Promise<Metadata> {
  const { zone } = await params;
  const z = ALL.find((q) => q.id === zone);
  return { title: z ? `${z.name}｜一座島・地理` : '探索｜一座島・地理', description: z?.lead };
}

export default async function ExplorePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  if (!IDS.includes(zone)) notFound();
  return <IslandApp initialZone={zone} />;
}
