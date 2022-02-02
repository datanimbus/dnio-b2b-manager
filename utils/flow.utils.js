function validatePayload(payload) {
	if (!payload.name) {
		return 'Name is mandatory';
	}
	if (!payload.stages || payload.stages.length == 0) {
		return 'Atleast One Stage is required';
	}
}




module.exports.validatePayload = validatePayload;