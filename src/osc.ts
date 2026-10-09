const BEL = '\x07'
const ESC = '\x1b'

function sanitize(segment: string): string {
  return segment
    .replaceAll(ESC, '')
    .replaceAll(BEL, '')
    .replace(/\r\n|\r|\n/g, ' ')
}

export function osc777(title: string, body: string): string {
  const cleanTitle = sanitize(title).replace(/;/g, ',')
  return `${ESC}]777;notify;${cleanTitle};${sanitize(body)}${BEL}`
}

export function osc9(body: string): string {
  return `${ESC}]9;${sanitize(body)}${BEL}`
}

export function tmuxPassthrough(sequence: string): string {
  return `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ESC}\\`
}

export function buildOscSequences(
  title: string,
  body: string,
  inTmux: boolean,
): string[] {
  const sequences = [osc777(title, body), osc9(body)]
  return sequences.map((seq) => (inTmux ? tmuxPassthrough(seq) : seq))
}

interface OscTarget {
  readonly title: string
  readonly body: string
}

export function sendOsc({ title, body }: OscTarget): void {
  if (!process.stdout.isTTY) return
  const output = buildOscSequences(
    title,
    body,
    process.env.TMUX !== undefined,
  ).join('')
  try {
    process.stdout.write(output)
  } catch {
    // Terminal notifications are best-effort; never surface write failures.
  }
}
