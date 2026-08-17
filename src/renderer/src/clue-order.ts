export function getCluesNewestFirst(clueIds: readonly string[]): string[] {
  return [...clueIds].reverse();
}
