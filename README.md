# Jison Refactored

A refactored version of the Jison parser generator, implementing modern JavaScript practices and design patterns.

## Features

- Multiple parsing algorithms support:
  - LR(0)
  - SLR(1)
  - LALR(1)
  - LR(1)
  - LL(1)
- Modern JavaScript features (ES6+)
- Improved error handling
- Better state management
- Comprehensive test coverage
- Modular design

## Installation

```bash
npm install jison-refactored
```

## Usage

```javascript
const Jison = require('jison-refactored');

// Create a parser with a grammar
const grammar = {
    bnf: {
        start: 'S',
        productions: [
            { symbol: 'S', handle: ['a', 'B'] },
            { symbol: 'B', handle: ['b'] },
            { symbol: 'B', handle: ['c'] }
        ],
        tokens: ['a', 'b', 'c']
    }
};

const parser = Jison(grammar, { type: 'lalr' });

// Parse input
const result = parser.parse('ab');
```

## API

### Jison(grammar, options)

Creates a parser instance from a grammar specification.

#### Parameters

- `grammar` (Object): The grammar specification
  - `bnf` (Object): The grammar in BNF format
    - `start` (String): The start symbol
    - `productions` (Array): Array of production rules
    - `tokens` (Array): Array of terminal symbols
- `options` (Object): Parser options
  - `type` (String): Parser type ('lr0', 'slr', 'lalr', 'lr1', 'll')
  - `debug` (Boolean): Enable debug mode

#### Returns

- `Parser`: A parser instance

### Parser.parse(input)

Parses the input string according to the grammar.

#### Parameters

- `input` (String): The input string to parse

#### Returns

- The parsed result

## Development

### Prerequisites

- Node.js (v12 or higher)
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/jison-refactored.git
cd jison-refactored
```

2. Install dependencies:
```bash
npm install
```

### Testing

Run the test suite:
```bash
npm test
```

### Building

Build the project:
```bash
npm run build
```

## Design Patterns Used

- Factory Pattern: `ParserGeneratorFactory` creates appropriate parser generators
- Template Method Pattern: `BaseGenerator` defines the skeleton of the generation algorithm
- Strategy Pattern: Different parsing algorithms are implemented as separate classes
- State Pattern: `ParserState` manages parser state transitions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original Jison project
- All contributors and users of the project

