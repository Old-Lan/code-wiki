export function add(a: number, b: number): number {
  return a + b;
}

export function validate(input: string): boolean {
  return input.length > 0;
}

export function splitPath(p: string): string[] {
  return p.split('/');
}
