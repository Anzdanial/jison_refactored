const { ParserError } = require('../errors/ParserError');
const { ParserState } = require('./ParserState');
const { ParserActions } = require('../utils/constants');

class Parser {
    constructor() {
        this.yy = {};
        this.table = null;
        this.defaultActions = null;
        this.performAction = null;
        this.productions_ = null;
        this.symbols_ = null;
        this.terminals_ = null;
        this.state = new ParserState();
    }

    init(dict) {
        this.table = dict.table;
        this.defaultActions = dict.defaultActions;
        this.performAction = dict.performAction;
        this.productions_ = dict.productions_;
        this.symbols_ = dict.symbols_;
        this.terminals_ = dict.terminals_;
    }

    parse(input) {
        const self = this;
        const stack = [0];
        const vstack = [null]; // semantic value stack
        const lstack = []; // location stack
        const table = this.table;
        let yytext = '';
        let yylineno = 0;
        let yyleng = 0;
        let recovering = 0;
        const TERROR = 2;
        const EOF = 1;

        const args = lstack.slice.call(arguments, 1);

        const lexer = Object.create(this.lexer);
        const sharedState = { yy: {} };

        // Copy state
        for (const k in this.yy) {
            if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
                sharedState.yy[k] = this.yy[k];
            }
        }

        lexer.setInput(input, sharedState.yy);
        sharedState.yy.lexer = lexer;
        sharedState.yy.parser = this;

        if (typeof lexer.yylloc === 'undefined') {
            lexer.yylloc = {};
        }

        const yyloc = lexer.yylloc;
        lstack.push(yyloc);

        const ranges = lexer.options && lexer.options.ranges;

        if (typeof sharedState.yy.parseError === 'function') {
            this.parseError = sharedState.yy.parseError;
        } else {
            this.parseError = Object.getPrototypeOf(this).parseError;
        }

        function popStack(n) {
            stack.length = stack.length - 2 * n;
            vstack.length = vstack.length - n;
            lstack.length = lstack.length - n;
        }

        let symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;

        while (true) {
            state = stack[stack.length - 1];

            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lexer.lex() || EOF;
                }
                action = table[state] && table[state][symbol];
            }

            if (typeof action === 'undefined' || !action.length || !action[0]) {
                let error_rule_depth;
                let errStr = '';

                if (!recovering) {
                    expected = [];
                    for (p in table[state]) {
                        if (this.terminals_[p] && p > TERROR) {
                            expected.push("'" + this.terminals_[p] + "'");
                        }
                    }

                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ":\n" + lexer.showPosition() + "\nExpecting " + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ": Unexpected " +
                            (symbol == EOF ? "end of input" :
                                ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }

                    this.parseError(errStr, {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false)
                    });
                }

                if (error_rule_depth === false) {
                    throw new ParserError(errStr || 'Parsing halted. No suitable error recovery rule available.');
                }

                popStack(error_rule_depth);

                preErrorSymbol = (symbol == TERROR ? null : symbol);
                symbol = TERROR;
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3;
            }

            if (action[0] instanceof Array && action.length > 1) {
                throw new ParserError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
            }

            switch (action[0]) {
                case ParserActions.SHIFT:
                    stack.push(symbol);
                    vstack.push(lexer.yytext);
                    lstack.push(lexer.yylloc);
                    stack.push(action[1]);
                    symbol = null;
                    if (!preErrorSymbol) {
                        yyleng = lexer.yyleng;
                        yytext = lexer.yytext;
                        yylineno = lexer.yylineno;
                        yyloc = lexer.yylloc;
                        if (recovering > 0) {
                            recovering--;
                        }
                    } else {
                        symbol = preErrorSymbol;
                        preErrorSymbol = null;
                    }
                    break;

                case ParserActions.REDUCE:
                    len = this.productions_[action[1]][1];

                    yyval.$ = vstack[vstack.length - len];
                    yyval._$ = {
                        first_line: lstack[lstack.length - (len || 1)].first_line,
                        last_line: lstack[lstack.length - 1].last_line,
                        first_column: lstack[lstack.length - (len || 1)].first_column,
                        last_column: lstack[lstack.length - 1].last_column
                    };

                    if (ranges) {
                        yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
                    }

                    r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack].concat(args));

                    if (typeof r !== 'undefined') {
                        return r;
                    }

                    if (len) {
                        stack = stack.slice(0, -1 * len * 2);
                        vstack = vstack.slice(0, -1 * len);
                        lstack = lstack.slice(0, -1 * len);
                    }

                    stack.push(this.productions_[action[1]][0]);
                    vstack.push(yyval.$);
                    lstack.push(yyval._$);
                    newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                    stack.push(newState);
                    break;

                case ParserActions.ACCEPT:
                    return true;
            }
        }
    }

    parseError(str, hash) {
        if (hash.recoverable) {
            this.trace(str);
        } else {
            throw new ParserError(str);
        }
    }
}

module.exports = { Parser }; 