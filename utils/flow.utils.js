function validatePayload(payload) {
	if (!payload.name) {
		return 'Name is mandatory';
	}
	if (!payload.inputNode || !payload.inputNode.type) {
		return 'Input Node is required';
	}
}




module.exports.validatePayload = validatePayload;