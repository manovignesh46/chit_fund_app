// Custom type declarations for React
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

// Add JSX namespace
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface Element {
    type: any;
    props: any;
    key: any;
  }
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
