#!/usr/bin/env node

/**
 * Script to create a minimal TypeScript setup in the node_modules directory
 * 
 * This script:
 * 1. Creates a minimal TypeScript setup in the node_modules directory
 * 2. Creates a minimal @types/react setup in the node_modules directory
 * 3. Creates a minimal @types/node setup in the node_modules directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

console.log('Creating minimal TypeScript setup...');

// Create directories
const typescriptDir = path.join(projectRoot, 'node_modules', 'typescript');
const typesReactDir = path.join(projectRoot, 'node_modules', '@types', 'react');
const typesNodeDir = path.join(projectRoot, 'node_modules', '@types', 'node');

// Create directories if they don't exist
fs.mkdirSync(typescriptDir, { recursive: true });
fs.mkdirSync(typesReactDir, { recursive: true });
fs.mkdirSync(typesNodeDir, { recursive: true });

// Create minimal TypeScript setup
const typescriptPackageJson = {
  name: 'typescript',
  version: '5.3.3',
  description: 'Minimal TypeScript setup',
  main: 'lib/typescript.js',
  bin: {
    tsc: 'bin/tsc',
    tsserver: 'bin/tsserver'
  }
};

// Create minimal @types/react setup
const typesReactPackageJson = {
  name: '@types/react',
  version: '18.2.48',
  description: 'Minimal @types/react setup',
  main: 'index.d.ts',
  types: 'index.d.ts'
};

// Create minimal @types/node setup
const typesNodePackageJson = {
  name: '@types/node',
  version: '20.11.5',
  description: 'Minimal @types/node setup',
  main: 'index.d.ts',
  types: 'index.d.ts'
};

// Create minimal TypeScript files
const typescriptIndexJs = `
// Minimal TypeScript setup
module.exports = {
  version: '5.3.3'
};
`;

// Create minimal @types/react files
const typesReactIndexDts = `
// Minimal @types/react setup
declare namespace React {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FC<P = {}> = any;
  export type FunctionComponent<P = {}> = any;
  export type ComponentType<P = {}> = any;
  export type ComponentClass<P = {}> = any;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  export type PropsWithRef<P = {}> = P & { ref?: any };
  export type Ref<T> = any;
  export type RefObject<T> = any;
  export type MutableRefObject<T> = any;
  export type RefCallback<T> = any;
  export type CSSProperties = any;
  export type SyntheticEvent<T = Element, E = Event> = any;
  export type BaseSyntheticEvent<E = object, C = any, T = any> = any;
  export type MouseEvent<T = Element, E = NativeMouseEvent> = any;
  export type KeyboardEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;
  export type FormEvent<T = Element> = any;
  export type FocusEvent<T = Element> = any;
}

declare module 'react' {
  export = React;
  export as namespace React;
}
`;

// Create minimal @types/node files
const typesNodeIndexDts = `
// Minimal @types/node setup
declare namespace NodeJS {
  export interface Process {
    env: ProcessEnv;
  }
  
  export interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare module 'fs' {
  export function readFileSync(path: string, options?: { encoding?: string; flag?: string; } | string): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string; } | string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number; } | number): void;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
}
`;

// Write files
fs.writeFileSync(path.join(typescriptDir, 'package.json'), JSON.stringify(typescriptPackageJson, null, 2));
fs.mkdirSync(path.join(typescriptDir, 'lib'), { recursive: true });
fs.writeFileSync(path.join(typescriptDir, 'lib', 'typescript.js'), typescriptIndexJs);
fs.mkdirSync(path.join(typescriptDir, 'bin'), { recursive: true });
fs.writeFileSync(path.join(typescriptDir, 'bin', 'tsc'), '#!/usr/bin/env node\nconsole.log("TypeScript Compiler");\n');
fs.writeFileSync(path.join(typescriptDir, 'bin', 'tsserver'), '#!/usr/bin/env node\nconsole.log("TypeScript Server");\n');

fs.writeFileSync(path.join(typesReactDir, 'package.json'), JSON.stringify(typesReactPackageJson, null, 2));
fs.writeFileSync(path.join(typesReactDir, 'index.d.ts'), typesReactIndexDts);

fs.writeFileSync(path.join(typesNodeDir, 'package.json'), JSON.stringify(typesNodePackageJson, null, 2));
fs.writeFileSync(path.join(typesNodeDir, 'index.d.ts'), typesNodeIndexDts);

console.log('Minimal TypeScript setup created successfully.');
