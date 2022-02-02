function init(){
	require('./agent-action.model');
	require('./agent-logs.model');
	require('./agent.model');
	require('./data-format.model');
	require('./faas.model');
	require('./flow.model');
	require('./interaction.model');
	require('./partner.model');
}
module.exports.init = init;