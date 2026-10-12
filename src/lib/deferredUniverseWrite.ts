/** A debounced write which can be drained before leaving a universe. */
export class DeferredUniverseWrite {
  private pending?: () => Promise<void>;
  private running?: Promise<boolean>;
  private timer?: ReturnType<typeof setTimeout>;
  error?: unknown;

  schedule(write: () => Promise<void>, delay = 500) {
    this.pending = write;
    this.cancelTimer();
    this.timer = setTimeout(() => {
      void this.flush();
    }, delay);
  }

  cancelTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  flush(): Promise<boolean> {
    this.cancelTimer();
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async drain() {
    while (this.pending) {
      const write = this.pending;
      this.pending = undefined;
      try {
        await write();
        this.error = undefined;
      } catch (error) {
        this.error = error;
        this.pending ??= write;
        return false;
      }
    }
    return true;
  }
}
