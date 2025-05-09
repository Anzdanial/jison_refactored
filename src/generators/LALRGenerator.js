const { BaseGenerator } = require('./BaseGenerator');
const { ParserActions } = require('../utils/constants');
const { SpecialSymbols } = require('../utils/constants');

class LALRGenerator extends BaseGenerator {
    constructor(grammar, options = {}) {
        super(grammar, options);
        this.type = 'LALR(1)';
        this.nonterminals = {};
        this.firstSets = new Map();
        this.followSets = new Map();
        this.kernels = new Map();
    }

    preprocess() {
        this.processGrammar(this.grammar);
        this.computeFirstSets();
        this.computeFollowSets();
    }

    buildTable() {
        this.states = this.canonicalCollection();
        this.mergeStates();
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
        this.nonterminals.forEach(nonterminal => {
            this.firstSets.set(nonterminal, new Set());
        });

        let changed = true;
        while (changed) {
            changed = false;
            this.productions.forEach(production => {
                const [lhs, rhs] = production;
                const lhsFirst = this.firstSets.get(lhs);
                const newSymbols = this.computeProductionFirst(rhs);
                
                for (const symbol of newSymbols) {
                    if (!lhsFirst.has(symbol)) {
                        lhsFirst.add(symbol);
                        changed = true;
                    }
                }
            });
        }
    }

    computeProductionFirst(handle) {
        const result = new Set();
        let allNullable = true;

        for (const symbol of handle) {
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

    computeFollowSets() {
        // Initialize follow sets for nonterminals
        this.nonterminals.forEach(nonterminal => {
            this.followSets.set(nonterminal, new Set());
        });

        // Add $ to FOLLOW(startSymbol)
        const startSymbol = this.grammar.bnf.start;
        this.followSets.get(startSymbol).add('$');

        let changed = true;
        while (changed) {
            changed = false;
            this.productions.forEach(production => {
                const [lhs, rhs] = production;

                // For each position in RHS
                for (let i = 0; i < rhs.length; i++) {
                    const symbol = rhs[i];
                    if (!this.nonterminals.has(symbol)) continue;

                    // Get everything that can follow this symbol in the production
                    const trailer = rhs.slice(i + 1);
                    const trailerFirst = this.computeProductionFirst(trailer);

                    // Add all non-epsilon symbols from FIRST(trailer) to FOLLOW(symbol)
                    const symbolFollow = this.followSets.get(symbol);
                    for (const firstSymbol of trailerFirst) {
                        if (firstSymbol !== '' && !symbolFollow.has(firstSymbol)) {
                            symbolFollow.add(firstSymbol);
                            changed = true;
                        }
                    }

                    // If trailer can derive epsilon or we're at the end
                    if (trailerFirst.has('') || i === rhs.length - 1) {
                        // Add everything in FOLLOW(lhs) to FOLLOW(symbol)
                        const lhsFollow = this.followSets.get(lhs);
                        for (const followSymbol of lhsFollow) {
                            if (!symbolFollow.has(followSymbol)) {
                                symbolFollow.add(followSymbol);
                                changed = true;
                            }
                        }
                    }
                }
            });
        }
    }

    canonicalCollection() {
        const states = [];
        const stateMap = new Map();
        
        // Create initial state
        const initialItem = {
            production: this.productions[0],
            dotPosition: 0,
            lookahead: new Set(['$'])
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
            const [lhs, rhs] = item.production;
            const symbol = rhs[item.dotPosition];

            if (!symbol || !this.nonterminals.has(symbol)) continue;

            const firstSet = this.computeRemainingFirst(
                rhs.slice(item.dotPosition + 1)
            );

            this.productions
                .filter(p => p[0] === symbol)
                .forEach(production => {
                    const newItem = {
                        production,
                        dotPosition: 0,
                        lookahead: new Set()
                    };

                    firstSet.forEach(s => {
                        if (s !== '') {
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
            const [lhs, rhs] = item.production;
            const symbol = rhs[item.dotPosition];
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
        const [lhs, rhs] = item.production;
        return `${lhs}->${rhs.join(' ')}|${item.dotPosition}|${Array.from(item.lookahead).sort().join(',')}`;
    }

    hasItem(state, item) {
        return state.some(i => this.itemKey(i) === this.itemKey(item));
    }

    mergeStates() {
        const mergedStates = new Map();
        const newStates = [];

        // Group states by their kernel items
        this.states.forEach((state, index) => {
            const kernel = this.getKernel(state);
            const kernelKey = this.kernelKey(kernel);

            if (!mergedStates.has(kernelKey)) {
                mergedStates.set(kernelKey, []);
            }
            mergedStates.get(kernelKey).push(index);
        });

        // Merge states with the same kernel
        mergedStates.forEach((stateIndices, kernelKey) => {
            if (stateIndices.length > 1) {
                const mergedState = this.mergeStateSet(stateIndices);
                newStates.push(mergedState);
            } else {
                newStates.push(this.states[stateIndices[0]]);
            }
        });

        this.states = newStates;
    }

    getKernel(state) {
        return state.filter(item => item.dotPosition > 0 || item.production[0] === this.grammar.bnf.start);
    }

    kernelKey(kernel) {
        return kernel.map(item => 
            `${item.production[0]}->${item.production.join(' ')}|${item.dotPosition}`
        ).sort().join('|');
    }

    mergeStateSet(stateIndices) {
        const mergedState = [];
        const mergedTransitions = new Map();

        stateIndices.forEach(index => {
            const state = this.states[index];
            state.forEach(item => {
                if (!this.hasItem(mergedState, item)) {
                    mergedState.push(item);
                }
            });

            if (state.transitions) {
                state.transitions.forEach((nextState, symbol) => {
                    if (!mergedTransitions.has(symbol)) {
                        mergedTransitions.set(symbol, new Set());
                    }
                    mergedTransitions.get(symbol).add(nextState);
                });
            }
        });

        mergedState.transitions = mergedTransitions;
        return mergedState;
    }

    parseTable(states) {
        const table = [];
        
        states.forEach((state, stateIndex) => {
            const stateTable = {};
            
            // Add shift actions
            if (state.transitions) {
                state.transitions.forEach((nextState, symbol) => {
                    if (nextStates.size === 1) {
                        stateTable[symbol] = [ParserActions.SHIFT, Array.from(nextStates)[0]];
                    } else {
                        this.conflicts++;
                        this.resolutions.push([stateIndex, symbol, this.resolveConflict(
                            symbol,
                            Array.from(nextStates)
                        )]);
                    }
                });
            }
            
            // Add reduce actions
            state.forEach(item => {
                if (item.dotPosition === item.production.length) {
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
                state.transitions.forEach((nextStates) => {
                    nextStates.forEach(nextState => {
                        if (!reachable.has(nextState)) {
                            reachable.add(nextState);
                            queue.push(nextState);
                        }
                    });
                });
            }
        }

        this.states = this.states.filter((_, index) => reachable.has(index));
    }

    mergeEquivalentStates() {
        // LALR(1) already merges states during buildTable
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

    findDefaults(table) {
        const defaults = {};
        
        table.forEach((state, stateIndex) => {
            const actions = Object.values(state);
            if (actions.length === 1 && actions[0][0] === ParserActions.REDUCE) {
                defaults[stateIndex] = actions[0];
            }
        });
        
        return defaults;
    }
}

module.exports = { LALRGenerator }; 