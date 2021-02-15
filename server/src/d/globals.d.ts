export { }
declare global {
    interface ReadonlyArray<T> {
        forEachSync: (cb: (element: any, index: number) => Promise<void>) => Promise<void>;
    }
}