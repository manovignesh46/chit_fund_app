import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to the dashboard page
  redirect('/dashboard');

  // This part won't be executed due to the redirect
  return null;
}
