const { LR0Generator } = require('./LR0Generator');
const { SLRGenerator } = require('./SLRGenerator');
const { LALRGenerator } = require('./LALRGenerator');
const { LR1Generator } = require('./LR1Generator');
const { LLGenerator } = require('./LLGenerator');

class ParserGeneratorFactory {
    static createGenerator(type, grammar, options = {}) {
        const generatorMap = {
            'lr0': LR0Generator,
            'slr': SLRGenerator,
            'lalr': LALRGenerator,
            'lr1': LR1Generator,
            'll': LLGenerator
        };

        const GeneratorClass = generatorMap[type] || LALRGenerator;
        return new GeneratorClass(grammar, options);
    }

    static createLexer(grammar, options = {}) {
        // Implementation for creating lexer
        throw new Error('createLexer() not implemented');
    }
}

module.exports = { ParserGeneratorFactory }; 