const { Parser } = require('../core/Parser');

class BaseGenerator {
    constructor(grammar, options = {}) {
        this.grammar = grammar;
        this.options = options;
        this.terms = {};
        this.operators = {};
        this.productions = [];
        this.conflicts = 0;
        this.resolutions = [];
        this.yy = {};
        this.DEBUG = options.debug || false;
        this.terminals = [];
        this.nonterminals = new Set();
        this.firstSets = new Map();
        this.followSets = new Map();
    }

    // Template method
    generate() {
        this.preprocess();
        this.buildTable();
        this.optimize();
        return this.generateCode();
    }

    // Abstract methods to be implemented by subclasses
    preprocess() {
        throw new Error('preprocess() must be implemented by subclass');
    }

    buildTable() {
        throw new Error('buildTable() must be implemented by subclass');
    }

    optimize() {
        throw new Error('optimize() must be implemented by subclass');
    }

    generateCode() {
        throw new Error('generateCode() must be implemented by subclass');
    }

    // Common utility methods
    processGrammar(grammar) {
        if (typeof grammar === 'string') {
            grammar = this.parseGrammar(grammar);
        }
        this.validateGrammar(grammar);
        
        // Process tokens
        if (grammar.bnf && grammar.bnf.tokens) {
            this.processTokens(grammar.bnf.tokens);
        }
        
        // Process productions and collect nonterminals
        if (grammar.bnf && grammar.bnf.productions) {
            grammar.bnf.productions.forEach(production => {
                this.nonterminals.add(production.symbol);
                this.addProduction([production.symbol, production.handle]);
            });
        }
        
        // Initialize first and follow sets for nonterminals
        this.nonterminals.forEach(nonterminal => {
            this.firstSets.set(nonterminal, new Set());
            this.followSets.set(nonterminal, new Set());
        });
    }

    parseGrammar(grammarString) {
        // Implementation for parsing grammar string
        throw new Error('parseGrammar() must be implemented by subclass');
    }

    validateGrammar(grammar) {
        if (!grammar.bnf && !grammar.ebnf) {
            throw new Error('Grammar must have either bnf or ebnf property');
        }
    }

    processTokens(tokens) {
        if (!tokens) return;
        
        if (typeof tokens === 'string') {
            tokens = tokens.trim().split(' ');
        }
        
        this.terminals = tokens;
        // Initialize first sets for terminals
        this.terminals.forEach(terminal => {
            this.firstSets.set(terminal, new Set([terminal]));
        });
    }

    processProductions(productions) {
        if (!productions) return;
        
        productions.forEach(production => {
            this.addProduction(production);
        });
    }

    addProduction(production) {
        this.productions.push(production);
    }

    computeRemainingFirst(symbols) {
        if (symbols.length === 0) {
            return new Set(['']);
        }

        const result = new Set();
        let allNullable = true;

        for (const symbol of symbols) {
            const symbolFirst = this.firstSets.get(symbol);
            if (!symbolFirst) continue;

            // Add all non-epsilon symbols
            for (const firstSymbol of symbolFirst) {
                if (firstSymbol !== '') {
                    result.add(firstSymbol);
                }
            }

            // If symbol is not nullable, stop
            if (!symbolFirst.has('')) {
                allNullable = false;
                break;
            }
        }

        // If all symbols are nullable, add epsilon
        if (allNullable) {
            result.add('');
        }

        return result;
    }

    createParser() {
        const parser = new Parser();
        parser.init({
            table: this.table,
            defaultActions: this.defaultActions,
            performAction: this.performAction,
            productions_: this.productions_,
            symbols_: this.symbols_,
            terminals_: this.terminals_
        });
        return parser;
    }

    trace(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }

    warn(...args) {
        console.warn(...args);
    }

    error(message) {
        throw new Error(message);
    }
}

module.exports = { BaseGenerator }; 