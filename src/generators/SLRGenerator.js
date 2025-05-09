const { BaseGenerator } = require('./BaseGenerator');
const { ParserActions } = require('../utils/constants');
const { SpecialSymbols } = require('../utils/constants');

class SLRGenerator extends BaseGenerator {
    constructor(grammar, options = {}) {
        super(grammar, options);
        this.type = 'SLR(1)';
        this.nonterminals = new Set();
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
                const [lhs, rhs] = item.production;
                if (item.dotPosition === rhs.length) {
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
        // SLR(1) doesn't merge states
        return;
    }

    generateModule() {
        return {
            table: this.table,
            defaultActions: this.defaultActions,
            productions: this.productions,
            symbols: [...this.terminals, ...Array.from(this.nonterminals)],
            terminals: this.terminals,
            nonterminals: Array.from(this.nonterminals)
        };
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

module.exports = { SLRGenerator }; 