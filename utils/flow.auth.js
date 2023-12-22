const router = require('express').Router();
const { AuthCacheMW } = require('@appveen/ds-auth-cache');
const _ = require('lodash');
const config = require('../config');

const logger = global.logger;

const commonUrls = [
	'/{app}/{api}'
];


router.use(AuthCacheMW({ secret: config.RBAC_JWT_KEY, decodeOnly: true }));

router.use((req, res, next) => {
	if (!req.locals) {
		req.locals = {
			app: req.path.split('/')[1]
		};
	}

	// Check if user is an app admin or super admin.
	if (req.user) {
		if (req.locals.app) {
			const temp = (req.user.allPermissions || []).find(e => e.app === req.locals.app);
			req.user.appPermissions = temp ? temp.permissions : [];
		} else {
			req.user.appPermissions = [];
		}
		if (req.user.isSuperAdmin || (req.user.apps && req.user.apps.indexOf(req.locals.app) > -1)) {
			req.locals.skipPermissionCheck = true;
		}
	}
	logger.trace(`User app permissions :: ${JSON.stringify(req.user.appPermissions)}`);
	next();
});

router.use((req, res, next) => {
	// All these paths required permissions check.
	if (commonUrls.some(e => compareURL(e, req.path))) {
		// Pass if user is admin or super admin.
		if (req.locals.skipPermissionCheck) {
			return next();
		}

		if (!req.locals.app) {
			return res.status(400).json({ message: 'App value needed for this API' });
		}

		if (!global.activeFlows[req.path]) {
			return res.status(404).json({ message: 'Flow is not running' });
		}

		// Check if user has permission for the path.
		if (canAccessPath(req)) {
			return next();
		}
	}
	return res.status(403).json({ message: 'You don\'t have access for this flow' });
});


function compareURL(tempUrl, url) {
	let tempUrlSegment = tempUrl.split('/').filter(_d => _d != '');
	let urlSegment = url.split('/').filter(_d => _d != '');
	if (tempUrlSegment.length != urlSegment.length) return false;

	let flag = tempUrlSegment.every((_k, i) => {
		if (_k.startsWith('{') && _k.endsWith('}') && urlSegment[i] != '') return true;
		return _k === urlSegment[i];
	});
	logger.trace(`Compare URL :: ${tempUrl}, ${url} :: ${flag}`);
	return flag;
}

function canAccessPath(req) {
	// Flows
	const routeData = global.activeFlows[req.path];

	if (compareURL('/{app}/{api}', req.path) && _.intersectionWith(req.user.appPermissions, [`FLOW_${routeData?.flowId}`], comparator).length > 0) {
		return true;
	}

	return false;
}

function comparator(main, pattern) {
	return main.startsWith(pattern);
}


module.exports = router;
