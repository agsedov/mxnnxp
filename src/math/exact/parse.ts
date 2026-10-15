import { Algebraic, AlgebraicError } from './algebraic'
import { Rational, RationalParseError } from './rational'

/**
 * Parser for exact number literals: rationals, square roots and complex
 * numbers.
 *
 * Accepted syntax (whitespace ignored):
 *
 *     3/4   0.25   -7             rationals (decimals are read exactly)
 *     sqrt(2)   sqrt 2   √2       2^(1/2), -1/2, ...   radicals and roots
 *     \sqrt{2}  \frac{1}{2}       LaTeX-style spellings
 *     2sqrt(2)  (1+sqrt(5))/2     implicit multiplication before a name/paren
 *     i   2i   1 - i               the imaginary unit
 *
 * Implicit multiplication is only recognized before a name or `(`, so `1 2`
 * is an error rather than an accidental `2`.
 */

/** Thrown when a string is not a valid exact-number expression. */
export class ExactParseError extends Error {
  readonly position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'ExactParseError'
    this.position = position
  }
}

type Token =
  | { kind: 'number'; text: string; position: number }
  | { kind: 'name'; text: string; position: number }
  | { kind: 'punctuation'; text: string; position: number }

/** Parses an exact-number expression, throwing {@link ExactParseError}. */
export function parseExact(input: string): Algebraic {
  const tokens = tokenize(input)
  const parser = new Parser(tokens, input.length)
  try {
    return parser.parse()
  } catch (error) {
    if (error instanceof ExactParseError) {
      throw error
    }
    if (error instanceof AlgebraicError || error instanceof RationalParseError || error instanceof RangeError) {
      throw new ExactParseError(error.message, input.length)
    }
    throw error
  }
}

/** Like {@link parseExact}, but returns `null` instead of throwing. */
export function tryParseExact(input: string): Algebraic | null {
  try {
    return parseExact(input)
  } catch {
    return null
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < input.length) {
    const character = input[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if (character === '\\') {
      let end = index + 1
      while (end < input.length && /[A-Za-z]/.test(input[end])) {
        end += 1
      }
      const command = input.slice(index + 1, end).toLowerCase()
      if (command === 'sqrt') {
        tokens.push({ kind: 'name', text: 'sqrt', position: index })
      } else if (command === 'frac') {
        tokens.push({ kind: 'name', text: 'frac', position: index })
      } else if (command === 'cdot' || command === 'times') {
        tokens.push({ kind: 'punctuation', text: '*', position: index })
      } else {
        throw new ExactParseError(`Unknown command "\\${command}"`, index)
      }
      index = end
      continue
    }
    if (character === '\u221a') {
      tokens.push({ kind: 'name', text: 'sqrt', position: index })
      index += 1
      continue
    }
    if (character === '\u00b7' || character === '\u00d7') {
      tokens.push({ kind: 'punctuation', text: '*', position: index })
      index += 1
      continue
    }
    if (character === '\u2212') {
      tokens.push({ kind: 'punctuation', text: '-', position: index })
      index += 1
      continue
    }
    if (character === '(' || character === '{') {
      tokens.push({ kind: 'punctuation', text: '(', position: index })
      index += 1
      continue
    }
    if (character === ')' || character === '}') {
      tokens.push({ kind: 'punctuation', text: ')', position: index })
      index += 1
      continue
    }
    if ('+-*/^'.includes(character)) {
      tokens.push({ kind: 'punctuation', text: character, position: index })
      index += 1
      continue
    }
    if (/[0-9.]/.test(character)) {
      let end = index
      while (end < input.length && /[0-9.]/.test(input[end])) {
        end += 1
      }
      tokens.push({ kind: 'number', text: input.slice(index, end), position: index })
      index = end
      continue
    }
    if (/[A-Za-z]/.test(character)) {
      let end = index
      while (end < input.length && /[A-Za-z]/.test(input[end])) {
        end += 1
      }
      tokens.push({ kind: 'name', text: input.slice(index, end).toLowerCase(), position: index })
      index = end
      continue
    }
    throw new ExactParseError(`Unexpected character "${character}"`, index)
  }
  return tokens
}

class Parser {
  private readonly tokens: Token[]
  private readonly endPosition: number
  private index = 0

  constructor(tokens: Token[], endPosition: number) {
    this.tokens = tokens
    this.endPosition = endPosition
  }

  parse(): Algebraic {
    const value = this.expression()
    const token = this.peek()
    if (token) {
      throw new ExactParseError(`Unexpected "${describe(token)}"`, token.position)
    }
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private expression(): Algebraic {
    let value = this.term()
    for (;;) {
      const token = this.peek()
      if (token?.kind === 'punctuation' && (token.text === '+' || token.text === '-')) {
        this.index += 1
        const right = this.term()
        value = token.text === '+' ? value.add(right) : value.sub(right)
      } else {
        return value
      }
    }
  }

  private term(): Algebraic {
    let value = this.unary()
    for (;;) {
      const token = this.peek()
      if (token?.kind === 'punctuation' && (token.text === '*' || token.text === '/')) {
        this.index += 1
        const right = this.unary()
        try {
          value = token.text === '*' ? value.mul(right) : value.div(right)
        } catch (error) {
          throw new ExactParseError(messageOf(error), token.position)
        }
      } else if (token && startsPrimary(token)) {
        value = value.mul(this.unary())
      } else {
        return value
      }
    }
  }

  private unary(): Algebraic {
    const token = this.peek()
    if (token?.kind === 'punctuation' && (token.text === '-' || token.text === '+')) {
      this.index += 1
      const value = this.unary()
      return token.text === '-' ? value.neg() : value
    }
    return this.power()
  }

  private power(): Algebraic {
    const base = this.primary()
    const token = this.peek()
    if (token?.kind === 'punctuation' && token.text === '^') {
      this.index += 1
      const exponent = this.unary()
      try {
        return base.pow(exponent)
      } catch (error) {
        throw new ExactParseError(messageOf(error), token.position)
      }
    }
    return base
  }

  private primary(): Algebraic {
    const token = this.tokens[this.index]
    if (!token) {
      throw new ExactParseError('Unexpected end of input', this.endPosition)
    }
    this.index += 1
    if (token.kind === 'number') {
      return parseNumber(token)
    }
    if (token.kind === 'punctuation') {
      if (token.text === '(') {
        const value = this.expression()
        this.expect(')')
        return value
      }
      throw new ExactParseError(`Unexpected "${token.text}"`, token.position)
    }
    switch (token.text) {
      case 'i':
        return Algebraic.I
      case 'sqrt':
        return this.root(token.position)
      case 'frac':
        return this.fraction(token.position)
      default:
        throw new ExactParseError(`Unknown name "${token.text}"`, token.position)
    }
  }

  private root(position: number): Algebraic {
    const argument = this.unary()
    try {
      return argument.nthRoot(2n)
    } catch (error) {
      throw new ExactParseError(messageOf(error), position)
    }
  }

  private fraction(position: number): Algebraic {
    const numerator = this.unary()
    const denominator = this.unary()
    try {
      return numerator.div(denominator)
    } catch (error) {
      throw new ExactParseError(messageOf(error), position)
    }
  }

  private expect(text: string): void {
    const token = this.tokens[this.index]
    if (!token || token.kind !== 'punctuation' || token.text !== text) {
      throw new ExactParseError(`Expected "${text}"`, token?.position ?? this.endPosition)
    }
    this.index += 1
  }
}

function parseNumber(token: Extract<Token, { kind: 'number' }>): Algebraic {
  try {
    return Algebraic.fromRational(Rational.parse(token.text))
  } catch {
    throw new ExactParseError(`Invalid number "${token.text}"`, token.position)
  }
}

function startsPrimary(token: Token): boolean {
  if (token.kind === 'name') {
    return true
  }
  return token.kind === 'punctuation' && token.text === '('
}

function describe(token: Token): string {
  return token.text
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
