const fs = require('fs');
const path = require('path');
const copy = require('recursive-copy');

const dataStackFunctions = path.join(process.cwd(), '../ds-faas/generator');
const generatorsFolder = path.join(process.cwd(), 'codeGen/faas/generators');

let indexContent = fs.readFileSync(path.join(dataStackFunctions, 'index.js'), 'utf-8');

if (fs.existsSync(generatorsFolder)) {
	fs.rmdirSync(generatorsFolder, { recursive: true });
}

copy(path.join(dataStackFunctions, 'generators'), generatorsFolder).then(files => {
    fs.writeFileSync('./codeGen/faas/index.js', indexContent, 'utf-8');
	console.log('Copied', files.length);
}).catch(console.error);