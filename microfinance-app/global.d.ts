// Global TypeScript declarations

// React types
declare module 'react' {
  export const useState: any;
  export const useEffect: any;
  export const useRef: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useContext: any;
  export const createContext: any;
  export const Fragment: any;
  export const forwardRef: any;
  export const memo: any;
  export const Children: any;
  export const cloneElement: any;
  export const createElement: any;
  export const isValidElement: any;
  export const Component: any;
  export const PureComponent: any;
  export const Suspense: any;
  export const lazy: any;

  export namespace React {
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
    export type DragEvent<T = Element> = any;
    export type TouchEvent<T = Element> = any;
    export type WheelEvent<T = Element> = any;
    export type AnimationEvent<T = Element> = any;
    export type TransitionEvent<T = Element> = any;
    export type ClipboardEvent<T = Element> = any;
    export type CompositionEvent<T = Element> = any;
    export type PointerEvent<T = Element> = any;
  }

  export default any;
}

// React DOM types
declare module 'react-dom' {
  export function render(element: any, container: any, callback?: () => void): void;
  export function hydrate(element: any, container: any, callback?: () => void): void;
  export function createPortal(children: any, container: any): any;
  export function findDOMNode(component: any): any;
  export function unmountComponentAtNode(container: any): boolean;
  export const version: string;
  export const unstable_batchedUpdates: any;

  export default any;
}

// Next.js types
declare module 'next/link' {
  export default function Link(props: any): any;
}

declare module 'next/image' {
  export default function Image(props: any): any;
  export function unstable_getImgProps(props: any): any;
}

declare module 'next/navigation' {
  export function useRouter(): any;
  export function useParams(): any;
  export function usePathname(): any;
  export function useSearchParams(): any;
}

declare module 'next/server' {
  export class NextRequest extends Request {
    constructor(input: RequestInfo, init?: RequestInit);
    cookies: any;
    nextUrl: any;
  }

  export class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    cookies: any;
  }

  export function NextRequest(req: Request): NextRequest;
  export function NextResponse(res: Response): NextResponse;
}

// JSX namespace
declare namespace JSX {
  interface Element {
    type: any;
    props: any;
    key: any;
  }

  interface IntrinsicElements {
    [elemName: string]: any;
  }

  interface ElementClass {
    render: any;
  }

  interface ElementAttributesProperty {
    props: any;
  }

  interface ElementChildrenAttribute {
    children: any;
  }

  interface IntrinsicAttributes {
    key?: any;
  }

  interface IntrinsicClassAttributes<T> {
    ref?: any;
  }
}