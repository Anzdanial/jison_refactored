const { ParserGeneratorFactory } = require('./generators/ParserGeneratorFactory');
const { Parser } = require('./core/Parser');
const { ParserError } = require('./errors/ParserError');

function Jison(grammar, options = {}) {
    const generator = ParserGeneratorFactory.createGenerator(options.type || 'lalr', grammar, options);
    return generator.createParser();
}

Jison.Parser = Parser;
Jison.ParserError = ParserError;
Jison.Generator = ParserGeneratorFactory;

module.exports = Jison; 