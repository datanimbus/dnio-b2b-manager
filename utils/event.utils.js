
const agentEventMap = {};
agentEventMap['EVENT_AGENT_APP_CREATE'] = 'Medium';
agentEventMap['EVENT_AGENT_APP_START'] = 'Medium';
agentEventMap['EVENT_AGENT_APP_UPDATE_PASSWORD'] = 'High';
agentEventMap['EVENT_AGENT_APP_UPDATE_SETTINGS'] = 'Medium';
agentEventMap['EVENT_AGENT_APP_UPDATE_SCHEDULE'] = 'High';
agentEventMap['EVENT_AGENT_APP_DELETE'] = 'High';
agentEventMap['EVENT_AGENT_PARTNER_START'] = 'Medium';
agentEventMap['EVENT_AGENT_PARTNER_UPDATE_PASSWORD'] = 'High';
agentEventMap['EVENT_AGENT_PARTNER_UPDATE_SETTINGS'] = 'Medium';
agentEventMap['EVENT_AGENT_PARTNER_UPDATE_SCHEDULE'] = 'High';


const flowEventMap = {};
flowEventMap['EVENT_FLOW_CREATE'] = 'Medium';
flowEventMap['EVENT_FLOW_UPDATE'] = 'High';
flowEventMap['EVENT_FLOW_START'] = 'Medium';
flowEventMap['EVENT_FLOW_STOP'] = 'High';
flowEventMap['EVENT_FLOW_DEPLOY'] = 'High';
flowEventMap['EVENT_FLOW_DELETE'] = 'High';

const dfEventMap = {};
dfEventMap['EVENT_DF_CREATE'] = 'Medium';
dfEventMap['EVENT_DF_UPDATE'] = 'High';
dfEventMap['EVENT_DF_DELETE'] = 'High';

const nsEventMap = {};
nsEventMap['EVENT_NS_CREATE'] = 'Medium';
nsEventMap['EVENT_NS_UPDATE'] = 'High';
nsEventMap['EVENT_NS_DELETE'] = 'High';

const partnerEventMap = {};
partnerEventMap['EVENT_PARTNER_CREATE'] = 'Medium';
partnerEventMap['EVENT_PARTNER_UPDATE'] = 'High';
partnerEventMap['EVENT_PARTNER_ADDED_FLOW'] = 'High';
partnerEventMap['EVENT_PARTNER_REMOVED_FLOW'] = 'High';
partnerEventMap['EVENT_PARTNER_DELETE'] = 'High';


function getAgentEventId(type, eventId) {
	if (type === 'PARTNERAGENT') {
		if (eventId === 'EVENT_AGENT_APP_UPDATE_PASSWORD') {
			return 'EVENT_AGENT_PARTNER_UPDATE_PASSWORD';
		}
		if (eventId === 'EVENT_AGENT_APP_UPDATE_SETTINGS') {
			return 'EVENT_AGENT_PARTNER_UPDATE_SETTINGS';
		}
		if (eventId === 'EVENT_AGENT_APP_UPDATE_SCHEDULE') {
			return 'EVENT_AGENT_PARTNER_UPDATE_SCHEDULE';
		}
		if (eventId === 'EVENT_AGENT_APP_START') {
			return 'EVENT_AGENT_PARTNER_START';
		}
		if (eventId === 'EVENT_AGENT_APP_CREATE') {
			return 'EVENT_AGENT_PARTNER_CREATE';
		}
	}
	if (!eventId) {
		return 'EVENT_AGENT_APP_CREATE';
	}
	return eventId;
}

function getAgentEventPriority(eventId) {
	return agentEventMap[eventId];
}

function getFlowEventPriority(eventId) {
	return flowEventMap[eventId];
}

function getDFEventPriority(eventId) {
	return dfEventMap[eventId];
}

function getNSEventPriority(eventId) {
	return nsEventMap[eventId];
}

function getPartnerEventPriority(eventId) {
	return partnerEventMap[eventId];
}


module.exports.getAgentEventId = getAgentEventId;
module.exports.getAgentEventPriority = getAgentEventPriority;
module.exports.getFlowEventPriority = getFlowEventPriority;
module.exports.getDFEventPriority = getDFEventPriority;
module.exports.getNSEventPriority = getNSEventPriority;
module.exports.getPartnerEventPriority = getPartnerEventPriority;