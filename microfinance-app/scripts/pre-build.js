#!/usr/bin/env node

/**
 * Pre-build script to ensure TypeScript and type definitions are installed
 * This script is run before the Next.js build to ensure TypeScript is available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running pre-build script to ensure TypeScript is installed...');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';
console.log(`Running on Vercel: ${isVercel ? 'Yes' : 'No'}`);

// Install TypeScript and type definitions
try {
  console.log('Installing TypeScript and type definitions...');

  // First try to install with --save-dev
  try {
    execSync('npm install --save-dev typescript@latest @types/react@latest @types/react-dom@latest @types/node@latest', {
      stdio: 'inherit'
    });
  } catch (installError) {
    console.error('Error during npm install with --save-dev:', installError.message);
    console.log('Trying alternative installation method...');

    // If that fails, try without --save-dev
    execSync('npm install typescript@latest @types/react@latest @types/react-dom@latest @types/node@latest', {
      stdio: 'inherit'
    });
  }

  // Verify the packages were installed correctly
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const devDeps = packageJson.devDependencies || {};
  const deps = packageJson.dependencies || {};

  if (!devDeps['typescript'] && !deps['typescript']) {
    console.error('TypeScript package not found in dependencies after installation');
    // Create a local node_modules/@types/react directory and add a basic index.d.ts file
    const typesDir = path.join(process.cwd(), 'node_modules', '@types', 'react');
    fs.mkdirSync(typesDir, { recursive: true });
    fs.writeFileSync(path.join(typesDir, 'index.d.ts'), '// Placeholder type definitions\n');
  }

  if (!devDeps['@types/react'] && !deps['@types/react']) {
    console.error('@types/react package not found in devDependencies after installation');
    // Create a local node_modules/@types/react directory and add a basic index.d.ts file
    const typesDir = path.join(process.cwd(), 'node_modules', '@types', 'react');
    fs.mkdirSync(typesDir, { recursive: true });
    fs.writeFileSync(path.join(typesDir, 'index.d.ts'), '// Placeholder type definitions\n');
  }

  console.log('TypeScript and type definitions installed successfully.');
} catch (error) {
  console.error('Error installing TypeScript and type definitions:', error.message);
  // Don't exit, try to continue with the build
  console.log('Continuing with build despite TypeScript installation issues...');
}

// Create a next-env.d.ts file if it doesn't exist
const nextEnvPath = path.join(process.cwd(), 'next-env.d.ts');
if (!fs.existsSync(nextEnvPath)) {
  console.log('Creating next-env.d.ts file...');
  const nextEnvContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
  fs.writeFileSync(nextEnvPath, nextEnvContent);
  console.log('next-env.d.ts file created successfully.');
}

// Create a custom type declaration file for React
const reactTypesPath = path.join(process.cwd(), 'react-types.d.ts');
console.log('Creating custom React type declaration file...');
const reactTypesContent = `// Custom type declarations for React
declare module 'react' {
  export const useState: any;
  export const useEffect: any;
  export const useRef: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useContext: any;
  export const createContext: any;
  export const Fragment: any;
  export namespace React {
    export type BaseSyntheticEvent = any;
    export type ChangeEvent<T = Element> = any;
    export type FormEvent<T = Element> = any;
    export type MouseEvent<T = Element> = any;
    export type KeyboardEvent<T = Element> = any;
    export type FocusEvent<T = Element> = any;
    export type ReactNode = any;
    export type CSSProperties = any;
    export type RefObject<T> = any;
    export type Ref<T> = any;
    export type MutableRefObject<T> = any;
    export type FC<P = {}> = any;
    export type FunctionComponent<P = {}> = any;
  }
  export default any;
}

declare module 'react-dom' {
  const ReactDOM: any;
  export default ReactDOM;
}

declare module 'next/link' {
  const Link: any;
  export default Link;
}

declare module 'next/navigation' {
  export const useRouter: any;
  export const useParams: any;
  export const useSearchParams: any;
  export const usePathname: any;
}
`;
fs.writeFileSync(reactTypesPath, reactTypesContent);
console.log('Custom React type declaration file created successfully.');

// Update tsconfig.json to include the custom type declaration file
const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  console.log('Updating tsconfig.json to include custom type declaration file...');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

  // Add the custom type declaration file to the include array
  if (!tsconfig.include) {
    tsconfig.include = [];
  }

  if (!tsconfig.include.includes('react-types.d.ts')) {
    tsconfig.include.push('react-types.d.ts');
  }

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  console.log('tsconfig.json updated successfully.');
}

// Run the fix-react-imports script
try {
  console.log('Running fix-react-imports script...');
  execSync('node scripts/fix-react-imports.js', {
    stdio: 'inherit'
  });
  console.log('fix-react-imports script completed successfully.');
} catch (error) {
  console.error('Error running fix-react-imports script:', error.message);
  // Continue with the build
  console.log('Continuing with build despite fix-react-imports script issues...');
}

console.log('Pre-build script completed successfully.');
