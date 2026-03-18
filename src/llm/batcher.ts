import pLimit from "p-limit";

export interface BatchTask<T> {
  execute: () => Promise<T>;
}

export class Batcher<T> {
  private limit: ReturnType<typeof pLimit>;

  constructor(concurrency: number = 5) {
    this.limit = pLimit(concurrency);
  }

  async run(tasks: BatchTask<T>[]): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.limit(() => task.execute())));
  }
}
