function validatePayload(payload) {
	if (!payload.name) {
		return 'Name is mandatory';
	}
	if (!payload.inputStage || !payload.inputStage.type) {
		return 'Input Stage is required';
	}
}




module.exports.validatePayload = validatePayload;