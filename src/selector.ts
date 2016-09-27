export class Selector {
  private static selectors = new Map<string, Selector>()

  static get(source) {
    let selector: Selector
    const selectors = Selector.selectors
    source = source.toString().trim()

    if (selectors.has(source)) {
      selector = selectors.get(source)!
    } else {
      selector = new Selector(source)
      selectors.set(source, selector)
    }

    return selector
  }

  source: string
  tokens: Token[]
  attributes: Set<string>

  constructor(source) {
    try {
      this.source = source
      this.tokens = Token.readTokens(this.source)
      this.attributes = attributesFromTokens(this.tokens)
    } catch (error) {
      throw new Error(`Error in selector '${source}': ${error.message}`)
    }
  }

  matches(element: Element): boolean {
    return element.matches(this.toString())
  }

  toString() {
    return this.source
  }
}

enum TokenType {
  TAG, ID, CLASS, ATTR
}

class Token {
  static PATTERNS = function() {
    const UNICODE  = `\\\\[0-9a-fA-F]{1,6}(?:\\r\\n|[ \\n\\r\\t\\f])?`
    const ESCAPE   = `(?:${UNICODE})|\\\\[^\\n\\r\\f0-9a-fA-F]`
    const NL       = `\\n|\\r\\n|\\r|\\f`
    const NONASCII = `[^\\0-\\177]`
    const NMSTART  = `[_a-zA-Z]|(?:${NONASCII})|(?:${ESCAPE})`
    const NMCHAR   = `[_a-zA-Z0-9-]|(?:${NONASCII})|(?:${ESCAPE})`
    const IDENT    = `-?(?:${NMSTART})(?:${NMCHAR})*`
    const STRING1  = `"(?:[^\\n\\r\\f\\\\"]|\\\\(?:${NL})|(?:${ESCAPE}))*`
    const STRING2  = `'(?:[^\\n\\r\\f\\\\']|\\\\(?:${NL})|(?:${ESCAPE}))*`
    const STRING   = `(?:${STRING1})|(?:${STRING2})`
    const ATTROP   = `=|~=|\\|=|\\^=|\\$=|\\*=`
    const ATTRVAL  = `(?:${IDENT})|(?:${STRING})`

    return {
      [TokenType.TAG]:   new RegExp(`^(${IDENT})`),
      [TokenType.ID]:    new RegExp(`^#(${IDENT})`),
      [TokenType.CLASS]: new RegExp(`^\\.(${IDENT})`),
      [TokenType.ATTR]:  new RegExp(`^\\[(${IDENT})(?:(${ATTROP})(${ATTRVAL}))?\\]`)
    }
  }()

  static readTokens(source: string): Token[] {
    const token =
      Token.readToken(source, TokenType.TAG)   ||
      Token.readToken(source, TokenType.ID)    ||
      Token.readToken(source, TokenType.CLASS) ||
      Token.readToken(source, TokenType.ATTR)

    if (token) {
      const rest = source.slice(token.length)
      return [token, ...Token.readTokens(rest)]
    } else if (source.length == 0) {
      return []
    } else {
      throw new Error(`Invalid or unsupported syntax near '${source}'`)
    }
  }

  static readToken(source: string, type: TokenType): Token | undefined {
    const pattern = Token.PATTERNS[type]
    const negated = source.slice(0, 5) == ":not("
    const offset = negated ? 5 : 0
    const match = source.slice(offset).match(pattern)

    if (match) {
      const [value, data] = match

      if (negated) {
        if (source.charAt(value.length + offset) == ")") {
          return new Token(type, `:not(${value})`, data, true)
        } else {
          throw new Error(`Expected close-parenthesis after ':not(${value}'`)
        }
      } else {
        return new Token(type, value, data, false)
      }
    }
  }

  type: TokenType
  value: string
  data: string
  negated: boolean

  constructor(type: TokenType, value: string, data: string | null, negated: boolean) {
    this.type = type
    this.value = value
    this.data = data || ""
    this.negated = negated
  }

  get attribute(): string | undefined {
    switch (this.type) {
      case TokenType.ID:    return "id"
      case TokenType.CLASS: return "class"
      case TokenType.ATTR:  return this.data
    }
  }

  get length(): number {
    return this.value.length
  }
}

function attributesFromTokens(tokens: Token[]): Set<string> {
  const result = new Set<string>()
  for (const token of tokens) {
    const attribute = token.attribute
    if (attribute != undefined) {
      result.add(attribute)
    }
  }
  return result
}
