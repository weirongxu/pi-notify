export function stubStdout(isTTY: boolean | undefined): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  Object.defineProperty(process.stdout, 'isTTY', {
    value: isTTY,
    configurable: true,
  })
  return () => {
    if (descriptor) {
      Object.defineProperty(process.stdout, 'isTTY', descriptor)
    } else {
      delete (process.stdout as { isTTY?: boolean }).isTTY
    }
  }
}
