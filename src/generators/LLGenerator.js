const { BaseGenerator } = require('./BaseGenerator');
const { ParserActions } = require('../utils/constants');
const { SpecialSymbols } = require('../utils/constants');

class LLGenerator extends BaseGenerator {
    constructor(grammar, options = {}) {
        super(grammar, options);
        this.type = 'LL(1)';
        this.nonterminals = {};
        this.firstSets = new Map();
        this.followSets = new Map();
        this.predictSets = new Map();
    }

    preprocess() {
        this.processGrammar(this.grammar);
        this.computeFirstSets();
        this.computeFollowSets();
        this.computePredictSets();
    }

    buildTable() {
        this.table = this.buildParseTable();
        this.defaultActions = this.findDefaults(this.table);
    }

    optimize() {
        this.removeUnreachableStates();
        this.mergeEquivalentStates();
    }

    generateCode() {
        return this.generateModule();
    }

    computeFirstSets() {
        // Initialize first sets for terminals
        this.terminals.forEach(terminal => {
            this.firstSets.set(terminal, new Set([terminal]));
        });

        // Initialize first sets for nonterminals
        Object.keys(this.nonterminals).forEach(nonterminal => {
            this.firstSets.set(nonterminal, new Set());
        });

        let changed;
        do {
            changed = false;
            this.productions.forEach(production => {
                const firstSet = this.firstSets.get(production.symbol);
                const productionFirst = this.computeProductionFirst(production);
                
                productionFirst.forEach(symbol => {
                    if (!firstSet.has(symbol)) {
                        firstSet.add(symbol);
                        changed = true;
                    }
                });
            });
        } while (changed);
    }

    computeProductionFirst(production) {
        const first = new Set();
        let nullable = true;

        for (const symbol of production.handle) {
            const symbolFirst = this.firstSets.get(symbol);
            if (!symbolFirst) continue;

            symbolFirst.forEach(s => {
                if (s !== SpecialSymbols.EPSILON) {
                    first.add(s);
                }
            });

            if (!symbolFirst.has(SpecialSymbols.EPSILON)) {
                nullable = false;
                break;
            }
        }

        if (nullable) {
            first.add(SpecialSymbols.EPSILON);
        }

        return first;
    }

    computeFollowSets() {
        // Initialize follow sets
        Object.keys(this.nonterminals).forEach(nonterminal => {
            this.followSets.set(nonterminal, new Set());
        });

        // Add EOF to start symbol's follow set
        const startSymbol = this.grammar.start || this.productions[0].symbol;
        this.followSets.get(startSymbol).add(SpecialSymbols.EOF);

        let changed;
        do {
            changed = false;
            this.productions.forEach(production => {
                const followSet = this.followSets.get(production.symbol);
                
                for (let i = 0; i < production.handle.length; i++) {
                    const symbol = production.handle[i];
                    if (!this.nonterminals[symbol]) continue;

                    const symbolFollow = this.followSets.get(symbol);
                    const remainingFirst = this.computeRemainingFirst(production.handle.slice(i + 1));

                    remainingFirst.forEach(s => {
                        if (s !== SpecialSymbols.EPSILON && !symbolFollow.has(s)) {
                            symbolFollow.add(s);
                            changed = true;
                        }
                    });

                    if (remainingFirst.has(SpecialSymbols.EPSILON)) {
                        followSet.forEach(s => {
                            if (!symbolFollow.has(s)) {
                                symbolFollow.add(s);
                                changed = true;
                            }
                        });
                    }
                }
            });
        } while (changed);
    }

    computeRemainingFirst(symbols) {
        if (symbols.length === 0) {
            return new Set([SpecialSymbols.EPSILON]);
        }

        const first = new Set();
        let nullable = true;

        for (const symbol of symbols) {
            const symbolFirst = this.firstSets.get(symbol);
            if (!symbolFirst) continue;

            symbolFirst.forEach(s => {
                if (s !== SpecialSymbols.EPSILON) {
                    first.add(s);
                }
            });

            if (!symbolFirst.has(SpecialSymbols.EPSILON)) {
                nullable = false;
                break;
            }
        }

        if (nullable) {
            first.add(SpecialSymbols.EPSILON);
        }

        return first;
    }

    computePredictSets() {
        this.productions.forEach(production => {
            const predictSet = new Set();
            const firstSet = this.computeProductionFirst(production);

            firstSet.forEach(symbol => {
                if (symbol !== SpecialSymbols.EPSILON) {
                    predictSet.add(symbol);
                }
            });

            if (firstSet.has(SpecialSymbols.EPSILON)) {
                const followSet = this.followSets.get(production.symbol);
                followSet.forEach(symbol => {
                    predictSet.add(symbol);
                });
            }

            this.predictSets.set(production, predictSet);
        });
    }

    buildParseTable() {
        const table = new Map();

        this.productions.forEach(production => {
            const predictSet = this.predictSets.get(production);
            predictSet.forEach(terminal => {
                if (!table.has(production.symbol)) {
                    table.set(production.symbol, new Map());
                }

                const symbolTable = table.get(production.symbol);
                if (symbolTable.has(terminal)) {
                    this.conflicts++;
                    this.resolutions.push([production.symbol, terminal, this.resolveConflict(
                        production,
                        symbolTable.get(terminal)
                    )]);
                } else {
                    symbolTable.set(terminal, production);
                }
            });
        });

        return table;
    }

    resolveConflict(production, existingProduction) {
        // Simple conflict resolution: prefer the first production
        return production;
    }

    removeUnreachableStates() {
        // LL(1) doesn't have states
        return;
    }

    mergeEquivalentStates() {
        // LL(1) doesn't have states
        return;
    }

    generateModule() {
        const code = [];
        
        // Generate parser class
        code.push('class Parser {');
        code.push('  constructor() {');
        code.push('    this.yy = {};');
        code.push('    this.table = ' + JSON.stringify(this.table) + ';');
        code.push('    this.defaultActions = ' + JSON.stringify(this.defaultActions) + ';');
        code.push('    this.productions_ = ' + JSON.stringify(this.productions_) + ';');
        code.push('    this.symbols_ = ' + JSON.stringify(this.symbols_) + ';');
        code.push('    this.terminals_ = ' + JSON.stringify(this.terminals_) + ';');
        code.push('  }');
        
        // Add parse method
        code.push('  parse(input) {');
        code.push('    // Implementation of parse method');
        code.push('  }');
        
        code.push('}');
        
        return code.join('\n');
    }
}

module.exports = { LLGenerator }; 