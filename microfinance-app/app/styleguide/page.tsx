import { notFound } from 'next/navigation';
import StyleguideClient from './styleguide-client';

export const metadata = {
  title: 'Styleguide · AM Fincorp',
  robots: { index: false, follow: false },
};

/**
 * Internal reference page for tokens, primitives and the kit.
 * Off unless the server is BUILT with ENABLE_STYLEGUIDE=1 (the root layout is
 * force-static, so the check runs at build time); otherwise it is a 404.
 * Not linked from navigation; middleware auth applies as for every page.
 */
export default function StyleguidePage() {
  if (process.env.ENABLE_STYLEGUIDE !== '1') notFound();
  return <StyleguideClient />;
}
