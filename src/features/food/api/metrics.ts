type Labels = Readonly<Record<string, string>>;

/** In-process counters. An OpenTelemetry exporter replaces the storage in Slice 4.8. */
export function createMetrics() {
  const counters = new Map<string, number>();
  const id = (name: string, labels: Labels) => `${name}${JSON.stringify(Object.entries(labels).sort())}`;

  return {
    increment(name: string, labels: Labels): void {
      counters.set(id(name, labels), (counters.get(id(name, labels)) ?? 0) + 1);
    },
    read(name: string, labels: Labels): number {
      return counters.get(id(name, labels)) ?? 0;
    },
  };
}

export type Metrics = ReturnType<typeof createMetrics>;
