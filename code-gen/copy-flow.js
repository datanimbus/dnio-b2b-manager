const fs = require('fs');
const path = require('path');
const copy = require('recursive-copy');

const dataStackFlows = path.join(process.cwd(), '../ds-b2b-flow/generator');
const generatorsFolder = path.join(process.cwd(), 'codeGen/flows/generators');

let indexContent = fs.readFileSync(path.join(dataStackFlows, 'index.js'), 'utf-8');
indexContent = indexContent.replace('../config', '../../config/config');


if (fs.existsSync(generatorsFolder)) {
	fs.rmdirSync(generatorsFolder, { recursive: true });
}

copy(path.join(dataStackFlows, 'generators'), generatorsFolder).then(files => {
	fs.writeFileSync('./codeGen/flows/index.js', indexContent, 'utf-8');
	console.log('Copied', files.length);
}).catch(console.error);