class ParserState {
    constructor() {
        this.stack = [0];
        this.symbolStack = [];
        this.valueStack = [null];
        this.locationStack = [];
        this.recovering = 0;
        this.preErrorSymbol = null;
    }

    getCurrentState() {
        return this.stack[this.stack.length - 1];
    }

    pushState(state) {
        this.stack.push(state);
    }

    pushSymbol(symbol) {
        this.symbolStack.push(symbol);
    }

    pushValue(value) {
        this.valueStack.push(value);
    }

    pushLocation(location) {
        this.locationStack.push(location);
    }

    popStack(n) {
        this.stack.length = this.stack.length - 2 * n;
        this.valueStack.length = this.valueStack.length - n;
        this.locationStack.length = this.locationStack.length - n;
    }

    setRecovering(value) {
        this.recovering = value;
    }

    setPreErrorSymbol(symbol) {
        this.preErrorSymbol = symbol;
    }

    getPreErrorSymbol() {
        return this.preErrorSymbol;
    }

    clearPreErrorSymbol() {
        this.preErrorSymbol = null;
    }

    getStack() {
        return this.stack;
    }

    getValueStack() {
        return this.valueStack;
    }

    getLocationStack() {
        return this.locationStack;
    }
}

module.exports = { ParserState }; 