export class GenerationRefresh {
    private requestedGeneration = -1;
    private running: Promise<void> | undefined;

    run(generation: number, refresh: () => Promise<void>): Promise<void> {
        this.requestedGeneration = Math.max(this.requestedGeneration, generation);
        this.running ??= this.loop(refresh).finally(() => {
            this.running = undefined;
        });
        return this.running;
    }

    private async loop(refresh: () => Promise<void>): Promise<void> {
        let completedGeneration: number;
        do {
            completedGeneration = this.requestedGeneration;
            await refresh();
        } while (this.requestedGeneration > completedGeneration);
    }
}
