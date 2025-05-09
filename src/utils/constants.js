const ParserActions = {
    SHIFT: 1,
    REDUCE: 2,
    ACCEPT: 3
};

const SpecialSymbols = {
    EOF: '$end',
    ACCEPT: '$accept',
    ERROR: 'error'
};

const ErrorCodes = {
    TERROR: 2,
    EOF: 1
};

module.exports = {
    ParserActions,
    SpecialSymbols,
    ErrorCodes
}; 