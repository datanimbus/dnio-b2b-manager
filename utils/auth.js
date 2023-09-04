const router = require('express').Router();
const { AuthCacheMW } = require('@appveen/ds-auth-cache');
const _ = require('lodash');
const config = require('../config');

const logger = global.logger;


const permittedUrls = [
	'/auth/login',
	'/internal/env',
	'/internal/app/{id}',
	'/internal/health/live',
	'/internal/health/ready'
];

const onlyAuthUrls = [
	'/{app}/agent/utils/{id}/init',
	'/{app}/agent/utils/{id}/heartbeat',
	'/{app}/agent/utils/{id}/re-issue',
	'/{app}/agent/utils/logs',
	'/{app}/agent/utils/{id}/upload',
	'/{app}/agent/utils/{id}/download',
	'/{app}/agent/utils/{id}/agentAction',
	// '/{app}/interaction/{flowId}/utils/update',
];

const internalUrls = [
	'/faas/fetchAll',
	'/app/',
	// '/app/{id}',
	'/{app}/faas/utils/{id}/init',
	'/{app}/faas/utils/{id}/statusChange',
	'/{app}/flow/utils/{id}/init',
	'/{app}/flow/utils/node-library',
];

const adminOnlyUrls = [
	'/{app}/flow/utils/node-library',
	'/{app}/flow/utils/node-library/{id}',
	'/{app}/flow/utils/node-library/utils/count',
];

const superAdminOnlyUrls = [
	'/internal/document/{type}/{id}'
];

const commonUrls = [
	'/{app}/agent/',
	'/{app}/agent/{id}',
	'/{app}/agent/utils/count',
	'/{app}/agent/utils/{agentId}/sessions',
	'/{app}/agent/utils/{agentId}/sessions/{id}/{action}',
	'/{app}/agent/utils/{id}/password',
	'/{app}/agent/utils/{id}/session',
	'/{app}/agent/utils/{id}/stop',
	'/{app}/agent/utils/{id}/update',
	'/{app}/agent/utils/{id}/download/exec',
	'/{app}/agent/utils/{id}/logs',

	'/{app}/dataFormat/',
	'/{app}/dataFormat/{id}',

	'/{app}/faas/',
	'/{app}/faas/{id}',
	'/{app}/faas/utils/count',
	'/{app}/faas/utils/status/count',
	'/{app}/faas/utils/{id}/deploy',
	'/{app}/faas/utils/{id}/repair',
	'/{app}/faas/utils/{id}/start',
	'/{app}/faas/utils/{id}/stop',
	'/{app}/faas/utils/startAll',
	'/{app}/faas/utils/stopAll',
	'/{app}/faas/utils/{id}/draftDelete',

	'/{app}/flow/',
	'/{app}/flow/{id}',
	'/{app}/flow/utils/count',
	'/{app}/flow/utils/status/count',
	'/{app}/flow/utils/{id}/init',
	'/{app}/flow/utils/{id}/deploy',
	'/{app}/flow/utils/{id}/repair',
	'/{app}/flow/utils/{id}/start',
	'/{app}/flow/utils/{id}/stop',
	'/{app}/flow/utils/startAll',
	'/{app}/flow/utils/stopAll',
	'/{app}/flow/utils/{id}/draftDelete',
	'/{app}/flow/utils/{id}/yamls',

	'/{app}/interaction/{flowId}/',
	'/{app}/interaction/{flowId}/{id}',
	'/{app}/interaction/{flowId}/{id}/state',
	'/{app}/interaction/{flowId}/{id}/state/{stateId}/data',
	'/{app}/node/',
	'/{app}/node/{id}',
	'/{app}/node/utils/count',
	'/{app}/plugin/',
	'/{app}/plugin/{id}',
	'/{app}/plugin/utils/count',
];


router.use(AuthCacheMW({ permittedUrls: _.concat(permittedUrls, internalUrls), secret: config.RBAC_JWT_KEY, decodeOnly: true }));

router.use((req, res, next) => {
	if (!req.locals) {
		req.locals = {};
	}
	if (req.params.app) {
		req.locals.app = req.params.app;
	} else if (req.query.app) {
		req.locals.app = req.query.app;
	} else if (req.query.filter) {
		let filter = req.query.filter;
		if (typeof filter === 'string') {
			filter = JSON.parse(filter);
		}
		req.locals.app = filter.app;
	} else if (req.body.app) {
		req.locals.app = req.body.app;
	}
	const matchingPath = commonUrls.find(e => compareURL(e, req.path));
	if (matchingPath) {
		const params = getUrlParams(matchingPath, req.path);

		if (params && params['{app}'] && !params['{app}'].match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]+$/)) {
			return next(new Error('APP_NAME_ERROR :: App name must consist of alphanumeric characters or \'-\' , and must start and end with an alphanumeric character.'));
		}

		if (req.locals.app && params && req.locals.app !== params['{app}']) {
			return next(new Error('App in url does not match with one in either body or filter.'));
		}

		if (!req.locals.app && params && params['{app}']) req.locals.app = params['{app}'];
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
	next();
});

router.use((req, res, next) => {

	// Check if path required only authentication checks.
	if (_.concat(onlyAuthUrls, permittedUrls).some(e => compareURL(e, req.path))) {
		return next();
	}

	// Check if path is for internal Use.
	if (internalUrls.some(e => compareURL(e, req.path))) {
		// Some Auth check for internal URLs required.
		req.locals.skipPermissionCheck = true;
		return next();
	}

	if (req.locals.app && !req.locals.app.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]+$/)) {
		return next(new Error('APP_NAME_ERROR :: App name must consist of alphanumeric characters or \'-\' , and must start and end with an alphanumeric character.'));
	}

	// Check if path is allowed only to super admins.
	if (superAdminOnlyUrls.some(e => compareURL(e, req.path)) && req.user && req.user.isSuperAdmin) {
		return next();
	}

	// Check if path is allowed only to admins and super admins.
	if (adminOnlyUrls.some(e => compareURL(e, req.path)) && req.locals.skipPermissionCheck) {
		return next();
	}

	// All these paths required permissions check.
	if (commonUrls.some(e => compareURL(e, req.path))) {
		// Pass if user is admin or super admin.
		if (req.locals.skipPermissionCheck) {
			return next();
		}

		if (!req.locals.app) {
			res.status(400).json({ message: 'App value needed for this API' });
			return next(new Error('App value needed for this API'));
		}

		if (!req.user.isSuperAdmin && !req.user.allPermissions.find(e => e.app === req.locals.app) && !req.user.apps.includes(req.locals.app)) {
			res.status(403).json({ 'message': 'You don\'t have permissions for this app.' });
			return next(new Error('You don\'t have permissions for this app.'));
		}

		// Check if user has permission for the path.
		if (canAccessPath(req)) {
			return next();
		}
	}
	return res.status(403).json({ message: 'You don\'t have access for this API' });
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

function getUrlParams(tempUrl, url) {
	const values = {};
	let tempUrlSegment = tempUrl.split('/').filter(_d => _d != '');
	let urlSegment = url.split('/').filter(_d => _d != '');
	tempUrlSegment.forEach((_k, i) => {
		if (_k.startsWith('{') && _k.endsWith('}') && urlSegment[i] != '') {
			values[_k] = urlSegment[i];
		}
	});
	logger.trace(`Params Map :: ${values}`);
	return values;
}

function canAccessPath(req) {
	// Data Formats
	if (compareURL('/{app}/dataFormat/', req.path) && _.intersectionWith(req.user.appPermissions, ['PVDF', 'PMDF'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMDF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/dataFormat/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVDF', 'PMDF'], comparator).length > 0) {
		if (req.method === 'PUT' || req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMDF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}


	// Functions
	if (compareURL('/{app}/faas/', req.path) && _.intersectionWith(req.user.appPermissions, ['PVF', 'PMF'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/faas/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVF', 'PMF'], comparator).length > 0) {
		if (req.method === 'PUT' || req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/faas/utils/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVF', 'PMF'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/status/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVF', 'PMF'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/{id}/deploy', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPD'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/{id}/repair', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPD'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/{id}/start', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/{id}/stop', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/startAll', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/stopAll', req.path) && _.intersectionWith(req.user.appPermissions, ['PMFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/faas/utils/{id}/draftDelete', req.path) && _.intersectionWith(req.user.appPermissions, ['PMF'], comparator).length > 0) {
		return true;
	}


	// Integration Flows
	if (compareURL('/{app}/flow/', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF', 'INTR_'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMIF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/flow/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF', 'INTR_'], comparator).length > 0) {
		if (req.method === 'PUT' || req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMIF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/flow/utils/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/status/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/deploy', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPD'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/repair', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPD'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/start', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/stop', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/startAll', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/stopAll', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIFPS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/draftDelete', req.path) && _.intersectionWith(req.user.appPermissions, ['PMIF'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/flow/utils/{id}/yamls', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF'], comparator).length > 0) {
		return true;
	}



	// Plugins (OLD) (Permissions Same as Data Pipes)

	if (compareURL('/{app}/node/', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMIF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/node/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF'], comparator).length > 0) {
		if (req.method === 'PUT' || req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMIF'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/node/utils/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVIF', 'PMIF'], comparator).length > 0) {
		return true;
	}


	// Plugins (NEW) (Permissions Same as Data Pipes)

	if (compareURL('/{app}/plugin/', req.path) && _.intersectionWith(req.user.appPermissions, ['PVPL', 'PMPL'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMPL'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/plugin/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVPL', 'PMPL'], comparator).length > 0) {
		if (req.method === 'PUT' || req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMPL'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/plugin/utils/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVPL', 'PMPL'], comparator).length > 0) {
		return true;
	}


	// B2B Agents
	if (compareURL('/{app}/agent', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMABC'], comparator).length > 0) {
		if (req.method === 'POST') {
			if (_.intersectionWith(req.user.appPermissions, ['PMABC'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/agent/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMAB'], comparator).length > 0) {
		if (req.method === 'PUT') {
			if (_.intersectionWith(req.user.appPermissions, ['PMABU'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		if (req.method === 'DELETE') {
			if (_.intersectionWith(req.user.appPermissions, ['PMABD'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/agent/utils/count', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMAB'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{agentId}/sessions', req.path) && _.intersectionWith(req.user.appPermissions, ['PMABU'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{agentId}/sessions/{id}/{action}', req.path) && _.intersectionWith(req.user.appPermissions, ['PMABU'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/password', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAPW', 'PMAPW'], comparator).length > 0) {
		if (req.method === 'PUT') {
			if (_.intersectionWith(req.user.appPermissions, ['PMAPW'], comparator).length > 0) {
				return true;
			}
			return false;
		}
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/session', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMAB'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/stop', req.path) && _.intersectionWith(req.user.appPermissions, ['PMAS'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/update', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMABU'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/download/exec', req.path) && _.intersectionWith(req.user.appPermissions, ['PMADL'], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/agent/utils/{id}/logs', req.path) && _.intersectionWith(req.user.appPermissions, ['PVAB', 'PMAB'], comparator).length > 0) {
		return true;
	}


	// Interactions	
	if (compareURL('/{app}/interaction/{flowId}/', req.path) && _.intersectionWith(req.user.appPermissions, ['INTR_' + req.path.split('/')[3]], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/interaction/{flowId}/{id}', req.path) && _.intersectionWith(req.user.appPermissions, ['INTR_' + req.path.split('/')[3]], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/interaction/{flowId}/{id}/state', req.path) && _.intersectionWith(req.user.appPermissions, ['INTR_' + req.path.split('/')[3]], comparator).length > 0) {
		return true;
	}

	if (compareURL('/{app}/interaction/{flowId}/{id}/state/{stateId}/data', req.path) && _.intersectionWith(req.user.appPermissions, ['INTR_' + req.path.split('/')[3]], comparator).length > 0) {
		return true;
	}


	return false;
}

function comparator(main, pattern) {
	return main.startsWith(pattern);
}


module.exports = router;
