import { THEME_INIT_SCRIPT } from './inline-script';

/** Pre-hydration script — must render in <head> before body paint. */
export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
