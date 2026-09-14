import { redirect } from 'next/navigation';

export default function WaitlistPage({ searchParams }) {
  const fromInstagram = searchParams?.source === 'instagram_campaign';
  redirect(fromInstagram ? '/signup?role=creator&source=instagram' : '/signup?role=creator');
}
