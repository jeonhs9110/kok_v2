import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Root page: redirect based on geo-detected country
export default async function RootRedirectPage() {
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'US';

  if (country === 'KR') {
    redirect('/kr');
  } else {
    redirect('/en');
  }
}
