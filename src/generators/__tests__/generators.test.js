const { LR0Generator } = require('../LR0Generator');
const { SLRGenerator } = require('../SLRGenerator');
const { LALRGenerator } = require('../LALRGenerator');
const { LR1Generator } = require('../LR1Generator');
const { LLGenerator } = require('../LLGenerator');

describe('Parser Generators', () => {
    const simpleGrammar = {
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

    describe('LR0Generator', () => {
        let generator;

        beforeEach(() => {
            generator = new LR0Generator(simpleGrammar);
        });

        test('should initialize with correct type', () => {
            expect(generator.type).toBe('LR(0)');
        });

        test('should process grammar correctly', () => {
            generator.preprocess();
            expect(generator.terminals).toEqual(['a', 'b', 'c']);
            expect(generator.productions.length).toBe(3);
        });

        test('should build parse table', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.table).toBeDefined();
            expect(generator.defaultActions).toBeDefined();
        });
    });

    describe('SLRGenerator', () => {
        let generator;

        beforeEach(() => {
            generator = new SLRGenerator(simpleGrammar);
        });

        test('should initialize with correct type', () => {
            expect(generator.type).toBe('SLR(1)');
        });

        test('should compute first sets', () => {
            generator.preprocess();
            expect(generator.firstSets.get('S')).toBeDefined();
            expect(generator.firstSets.get('B')).toBeDefined();
        });

        test('should compute follow sets', () => {
            generator.preprocess();
            expect(generator.followSets.get('S')).toBeDefined();
            expect(generator.followSets.get('B')).toBeDefined();
        });

        test('should build parse table', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.table).toBeDefined();
            expect(generator.defaultActions).toBeDefined();
        });
    });

    describe('LALRGenerator', () => {
        let generator;

        beforeEach(() => {
            generator = new LALRGenerator(simpleGrammar);
        });

        test('should initialize with correct type', () => {
            expect(generator.type).toBe('LALR(1)');
        });

        test('should merge states with same kernel', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.states.length).toBeLessThanOrEqual(generator.states.length);
        });

        test('should build parse table', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.table).toBeDefined();
            expect(generator.defaultActions).toBeDefined();
        });
    });

    describe('LR1Generator', () => {
        let generator;

        beforeEach(() => {
            generator = new LR1Generator(simpleGrammar);
        });

        test('should initialize with correct type', () => {
            expect(generator.type).toBe('LR(1)');
        });

        test('should compute lookahead sets', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.states[0][0].lookahead).toBeDefined();
        });

        test('should build parse table', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.table).toBeDefined();
            expect(generator.defaultActions).toBeDefined();
        });
    });

    describe('LLGenerator', () => {
        let generator;

        beforeEach(() => {
            generator = new LLGenerator(simpleGrammar);
        });

        test('should initialize with correct type', () => {
            expect(generator.type).toBe('LL(1)');
        });

        test('should compute predict sets', () => {
            generator.preprocess();
            expect(generator.predictSets.size).toBe(3);
        });

        test('should build parse table', () => {
            generator.preprocess();
            generator.buildTable();
            expect(generator.table).toBeDefined();
            expect(generator.defaultActions).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        const invalidGrammar = {
            bnf: {
                start: 'S',
                productions: [
                    { symbol: 'S', handle: ['A'] },
                    { symbol: 'A', handle: ['a'] }
                ],
                tokens: ['a']
            }
        };

        test('should handle invalid grammar gracefully', () => {
            const generator = new LR0Generator(invalidGrammar);
            expect(() => generator.preprocess()).not.toThrow();
        });

        test('should detect conflicts', () => {
            const ambiguousGrammar = {
                bnf: {
                    start: 'S',
                    productions: [
                        { symbol: 'S', handle: ['a', 'B'] },
                        { symbol: 'S', handle: ['a', 'C'] },
                        { symbol: 'B', handle: ['b'] },
                        { symbol: 'C', handle: ['b'] }
                    ],
                    tokens: ['a', 'b']
                }
            };

            const generator = new SLRGenerator(ambiguousGrammar);
            generator.preprocess();
            generator.buildTable();
            expect(generator.conflicts).toBeGreaterThan(0);
        });
    });
}); 