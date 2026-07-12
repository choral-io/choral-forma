export class DocumentInspectCache<T> {
    private readonly values = new Map<string, T>();
    private readonly inFlight = new Map<string, Promise<T>>();
    private generation = 0;

    constructor(private readonly capacity = 64) {}

    async get(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
        const cached = this.values.get(key);
        if (cached) return cached;
        let pending = this.inFlight.get(key);
        if (!pending) {
            const generation = this.generation;
            pending = load()
                .then((value) => {
                    if (generation === this.generation) this.store(key, value);
                    return value;
                })
                .finally(() => {
                    if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
                });
            this.inFlight.set(key, pending);
        }
        return await abortable(pending, signal);
    }

    clear(): void {
        this.generation += 1;
        this.values.clear();
        this.inFlight.clear();
    }

    private store(key: string, value: T): void {
        this.values.set(key, value);
        while (this.values.size > this.capacity) {
            const oldest = this.values.keys().next().value;
            if (oldest === undefined) break;
            this.values.delete(oldest);
        }
    }
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    if (!signal) return operation;
    if (signal.aborted) return Promise.reject(new DOMException("Forma command was cancelled.", "AbortError"));
    return new Promise<T>((resolve, reject) => {
        const abort = (): void => {
            reject(new DOMException("Forma command was cancelled.", "AbortError"));
        };
        signal.addEventListener("abort", abort, { once: true });
        operation.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", abort);
        });
    });
}
