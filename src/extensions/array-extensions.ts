declare global {
  export interface Array<T> {
    chunk(size: number): T[][]
  }
}

Array.prototype.chunk = function<T>(size: number): T[][] {
  const result : Array<T>[] = []
  for (let i = 0; i < this.length; i += size) {
    result.push(this.slice(i, i + size))
  }

  return result
}
