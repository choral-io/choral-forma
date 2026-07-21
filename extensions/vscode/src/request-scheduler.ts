type ScheduledRequest<T> = {
    key: string;
    controller: AbortController;
    task: (signal: AbortSignal) => Promise<T>;
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    subscribers: number;
    settled: boolean;
};

export class RequestScheduler<T> {
    private active = 0;
    private generation = 0;
    private readonly queued: Array<ScheduledRequest<T>> = [];
    private readonly requests = new Map<string, ScheduledRequest<T>>();

    constructor(private readonly concurrency = 2) {
        if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new Error("Request scheduler concurrency must be a positive integer.");
        }
    }

    schedule(key: string, task: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
        if (signal?.aborted) return Promise.reject(cancelledError());
        const generationKey = `${String(this.generation)}\0${key}`;
        let request = this.requests.get(generationKey);
        if (!request) {
            request = this.createRequest(generationKey, task);
            this.requests.set(generationKey, request);
            this.queued.push(request);
            this.pump();
        }
        return this.subscribe(request, signal);
    }

    invalidate(): void {
        this.generation += 1;
        for (const request of this.requests.values()) request.controller.abort();
    }

    private createRequest(key: string, task: (signal: AbortSignal) => Promise<T>): ScheduledRequest<T> {
        let resolveRequest: ((value: T) => void) | undefined;
        let rejectRequest: ((error: unknown) => void) | undefined;
        const promise = new Promise<T>((resolve, reject) => {
            resolveRequest = resolve;
            rejectRequest = reject;
        });
        return {
            key,
            controller: new AbortController(),
            task,
            promise,
            resolve: (value) => {
                resolveRequest?.(value);
            },
            reject: (error) => {
                rejectRequest?.(error);
            },
            subscribers: 0,
            settled: false,
        };
    }

    private subscribe(request: ScheduledRequest<T>, signal: AbortSignal | undefined): Promise<T> {
        if (signal?.aborted) return Promise.reject(cancelledError());
        request.subscribers += 1;
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const finish = (): void => {
                if (settled) return;
                settled = true;
                request.subscribers -= 1;
                signal?.removeEventListener("abort", abort);
                if (request.subscribers === 0 && !request.settled) request.controller.abort();
            };
            const abort = (): void => {
                finish();
                reject(cancelledError());
            };
            signal?.addEventListener("abort", abort, { once: true });
            request.promise.then(
                (value) => {
                    if (settled) return;
                    finish();
                    resolve(value);
                },
                (error: unknown) => {
                    if (settled) return;
                    finish();
                    reject(error instanceof Error ? error : new Error(String(error)));
                },
            );
        });
    }

    private pump(): void {
        while (this.active < this.concurrency) {
            const request = this.queued.shift();
            if (!request) return;
            if (request.controller.signal.aborted) {
                this.finish(request, undefined, cancelledError());
                continue;
            }
            this.active += 1;
            Promise.resolve()
                .then(async () => {
                    if (request.controller.signal.aborted) throw cancelledError();
                    return await request.task(request.controller.signal);
                })
                .then(
                    (value) => {
                        this.finish(request, value, undefined);
                    },
                    (error: unknown) => {
                        this.finish(request, undefined, error);
                    },
                )
                .finally(() => {
                    this.active -= 1;
                    this.pump();
                });
        }
    }

    private finish(request: ScheduledRequest<T>, value: T | undefined, error: unknown): void {
        if (request.settled) return;
        request.settled = true;
        if (this.requests.get(request.key) === request) this.requests.delete(request.key);
        if (error === undefined) request.resolve(value as T);
        else request.reject(error);
    }
}

function cancelledError(): DOMException {
    return new DOMException("Forma command was cancelled.", "AbortError");
}
