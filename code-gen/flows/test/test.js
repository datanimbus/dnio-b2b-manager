// const { writeFileSync } = require('fs');

// const codeGen = require('../generator/code.generator');
const validator = require('../generator/schema.validator');

// const sampleJSON = require('./test.01.API.JSON.json');
// const sampleJSON = require('./test.01.error.json');
// const sampleJSON = require('./test.02.Mapper.json');
// const sampleJSON = require('./test.04.Branch.WithCondition.json');
const sampleJSON = require('./test.05.Dataservice.POST.json');

try {
	validator(sampleJSON);
	// const stages = codeGen.parseStages(sampleJSON);
	// const code = codeGen.parseFlow(sampleJSON);
	// console.log("Flow code generated!");
	// writeFileSync('../stage.utils.js', stages);
	// writeFileSync('../route.js', code);
} catch (e) {
	console.log(e.message);
}
