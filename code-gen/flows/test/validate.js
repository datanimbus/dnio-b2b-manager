const { writeFileSync, readdirSync } = require('fs');
const { extname } = require('path');

const codeGen = require('../generator/code.generator');
const validator = require('../generator/schema.validator');

try {
	readdirSync('.')
		.filter(file => extname(file) == '.json')
		.forEach(file => {
			console.log(file);
		});
} catch (e) {
	console.log(e.message);
}
