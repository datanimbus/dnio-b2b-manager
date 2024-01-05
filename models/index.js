function init(){
	require('./agent-action.model');
	require('./agent-logs.model');
	require('./agent.model');
	require('./bundle-deployment.model');
	require('./custom-node.model');
	require('./data-format.model');
	require('./faas.model');
	require('./flow.model');
	require('./interaction.model');
}
module.exports.init = init;