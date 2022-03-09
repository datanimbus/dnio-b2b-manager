const fs = require('fs');
const Ajv = require('ajv');
const ajv = new Ajv();

let schema = fs.readFileSync('../flow.schema.json').toString();
schema = JSON.parse(schema);
const validate = ajv.compile(schema);

const cl = console.log;

function checkFlowGraph(flowDefinition) {
	console.log('Checking node dependency graph');
	let nodes = [];
	let dg = {
		i: {s: [], e:[]},
		e: {s: [], e:[]}
	};
	cl(`Flow name - ${flowDefinition.name}`);
	flowDefinition.inputStage.onSuccess.forEach(node => {
		if(nodes.indexOf(node._id) != -1) nodes.push(node._id);
		dg.i.s.push(node._id);
	});
	flowDefinition.inputStage.onError.forEach(node => {
		if(nodes.indexOf(node._id) != -1) nodes.push(node._id);
		dg.i.e.push(node._id);
	});
	flowDefinition.stages.forEach(stage => {
		dg[stage._id] = {s: [], e:[]};
		if(nodes.indexOf(stage._id) == -1) nodes.push(stage._id);
		
		stage.onSuccess.forEach(node => {
			if(nodes.indexOf(node._id) != -1) nodes.push(node._id);
			dg[stage._id].s.push(node._id);
		});
		stage.onError.forEach(node => {
			if(nodes.indexOf(node._id) != -1) nodes.push(node._id);
			dg[stage._id].e.push(node._id);
		});
	});
	flowDefinition.error.forEach(stage => {
		dg[stage._id] = {s: [], e:[]};
		stage.onSuccess.forEach(node => dg[stage._id].s.push(node._id));
		stage.onError.forEach(node => dg[stage._id].e.push(node._id));
	})
	cl(nodes);
	cl(dg);
}

module.exports = (flowDefinition) => {
	const valid = validate(flowDefinition);
	if (!valid) throw Error(ajv.errorsText(validate.errors));
	console.log('Flow definition is valid');
	checkFlowGraph(flowDefinition);
};