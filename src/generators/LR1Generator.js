const { BaseGenerator } = require('./BaseGenerator');
const { ParserActions } = require('../utils/constants');
const { SpecialSymbols } = require('../utils/constants');

class LR1Generator extends BaseGenerator {
    constructor(grammar, options = {}) {
        super(grammar, options);
        this.type = 'LR(1)';
        this.nonterminals = {};
        this.firstSets = new Map();
        this.followSets = new Map();
    }

    preprocess() {
        this.processGrammar(this.grammar);
        this.computeFirstSets();
        this.computeFollowSets();
    }

    buildTable() {
        this.states = this.canonicalCollection();
        this.table = this.parseTable(this.states);
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

    canonicalCollection() {
        const states = [];
        const stateMap = new Map();
        
        // Create initial state
        const initialItem = {
            production: this.productions[0],
            dotPosition: 0,
            lookahead: new Set([SpecialSymbols.EOF])
        };
        
        const initialState = this.closure([initialItem]);
        states.push(initialState);
        stateMap.set(this.stateKey(initialState), 0);

        // Process states
        for (let i = 0; i < states.length; i++) {
            const state = states[i];
            const transitions = this.computeTransitions(state);

            for (const [symbol, nextItems] of transitions) {
                const nextState = this.closure(nextItems);
                const stateKey = this.stateKey(nextState);

                if (!stateMap.has(stateKey)) {
                    stateMap.set(stateKey, states.length);
                    states.push(nextState);
                }

                const nextStateIndex = stateMap.get(stateKey);
                state.transitions = state.transitions || new Map();
                state.transitions.set(symbol, nextStateIndex);
            }
        }

        return states;
    }

    closure(items) {
        const closure = new Set(items);
        const queue = [...items];

        while (queue.length > 0) {
            const item = queue.shift();
            const symbol = item.production.handle[item.dotPosition];

            if (!symbol || !this.nonterminals[symbol]) continue;

            const firstSet = this.computeRemainingFirst(
                item.production.handle.slice(item.dotPosition + 1)
            );

            this.productions
                .filter(p => p.symbol === symbol)
                .forEach(production => {
                    const newItem = {
                        production,
                        dotPosition: 0,
                        lookahead: new Set()
                    };

                    firstSet.forEach(s => {
                        if (s !== SpecialSymbols.EPSILON) {
                            newItem.lookahead.add(s);
                        } else {
                            item.lookahead.forEach(l => newItem.lookahead.add(l));
                        }
                    });

                    const itemKey = this.itemKey(newItem);
                    if (!this.hasItem(closure, newItem)) {
                        closure.add(newItem);
                        queue.push(newItem);
                    }
                });
        }

        return Array.from(closure);
    }

    computeTransitions(state) {
        const transitions = new Map();

        state.forEach(item => {
            const symbol = item.production.handle[item.dotPosition];
            if (!symbol) return;

            const nextItem = {
                production: item.production,
                dotPosition: item.dotPosition + 1,
                lookahead: new Set(item.lookahead)
            };

            if (!transitions.has(symbol)) {
                transitions.set(symbol, []);
            }
            transitions.get(symbol).push(nextItem);
        });

        return transitions;
    }

    stateKey(state) {
        return state.map(item => this.itemKey(item)).sort().join('|');
    }

    itemKey(item) {
        return `${item.production.symbol}->${item.production.handle.join(' ')}|${item.dotPosition}|${Array.from(item.lookahead).sort().join(',')}`;
    }

    hasItem(state, item) {
        return state.some(i => this.itemKey(i) === this.itemKey(item));
    }

    parseTable(states) {
        const table = [];
        
        states.forEach((state, stateIndex) => {
            const stateTable = {};
            
            // Add shift actions
            if (state.transitions) {
                state.transitions.forEach((nextState, symbol) => {
                    stateTable[symbol] = [ParserActions.SHIFT, nextState];
                });
            }
            
            // Add reduce actions
            state.forEach(item => {
                if (item.dotPosition === item.production.handle.length) {
                    item.lookahead.forEach(lookahead => {
                        if (stateTable[lookahead]) {
                            this.conflicts++;
                            this.resolutions.push([stateIndex, lookahead, this.resolveConflict(
                                item.production,
                                stateTable[lookahead]
                            )]);
                        } else {
                            stateTable[lookahead] = [ParserActions.REDUCE, this.productions.indexOf(item.production)];
                        }
                    });
                }
            });
            
            table[stateIndex] = stateTable;
        });
        
        return table;
    }

    resolveConflict(production, action) {
        // Simple conflict resolution: prefer shift over reduce
        return action[0] === ParserActions.SHIFT ? action : [ParserActions.REDUCE, this.productions.indexOf(production)];
    }

    removeUnreachableStates() {
        const reachable = new Set([0]);
        const queue = [0];

        while (queue.length > 0) {
            const stateIndex = queue.shift();
            const state = this.states[stateIndex];

            if (state.transitions) {
                state.transitions.forEach((nextState) => {
                    if (!reachable.has(nextState)) {
                        reachable.add(nextState);
                        queue.push(nextState);
                    }
                });
            }
        }

        this.states = this.states.filter((_, index) => reachable.has(index));
    }

    mergeEquivalentStates() {
        // LR(1) doesn't merge states
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

module.exports = { LR1Generator }; 