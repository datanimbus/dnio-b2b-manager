const { writeFileSync } = require('fs');

const codeGen = require('./code.generator');
const sampleJSON = require('./sample.json');

const stages = codeGen.generateStages(sampleJSON);
const code = codeGen.generateCode(sampleJSON);

writeFileSync('../stage.utils.js', stages);
writeFileSync('../route.js', code);