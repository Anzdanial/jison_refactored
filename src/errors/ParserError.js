class ParserError extends Error {
    constructor(message, hash = {}) {
        super(message);
        this.name = 'ParserError';
        this.hash = hash;
        this.recoverable = hash.recoverable || false;
        this.line = hash.line;
        this.loc = hash.loc;
        this.expected = hash.expected;
        this.token = hash.token;
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }
}

module.exports = { ParserError }; 