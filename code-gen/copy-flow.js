const fs = require('fs');
const path = require('path');
const copy = require('recursive-copy');

const dataStackFlows = path.join(process.cwd(), '../ds-b2b-base/generator');
const generatorsFolder = path.join(process.cwd(), 'code-gen/flows/generators');

const dataStackFlowsTest = path.join(process.cwd(), '../ds-b2b-base/test');
const generatorsFolderTest = path.join(process.cwd(), 'code-gen/flows/test');


if (fs.existsSync(generatorsFolder)) {
	fs.rmdirSync(generatorsFolder, { recursive: true });
}

copy(path.join(dataStackFlows), generatorsFolder).then(files => {
	console.log('Copied', files.length);
}).catch(console.error);
copy(path.join(dataStackFlowsTest), generatorsFolderTest).then(files => {
	console.log('Copied', files.length);
}).catch(console.error);