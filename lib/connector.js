var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	events = require('events'),
	error = function (callback) {
if (typeof callback === 'function')
	callback.apply(this, ['Abstract connector']);
};

module.exports = (function () {
	
	__extends(Connector, events.EventEmitter);

	function Connector (client) {
		var self = this;
		self.client = client;
	}

	Connector.prototype.client = null;

	Connector.prototype.isConnected = function () {
		return false;
	};

	Connector.prototype.info = {};

	Connector.prototype.connect = function (info, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.disconnect = function (callback) {
		error(callback);

		return this;
	}

	Connector.prototype.abort = function (callback) {
		error(callback);

		return this;
	}

	Connector.prototype.list = function (path, recursive, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.get = function (path, recursive, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.put = function (path, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.mkdir = function (path, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.mkfile = function (path, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.rename = function (source, dest, callback) {
		error(callback);

		return this;
	}

	Connector.prototype.delete = function (path, callback) {
		error(callback);

		return this;
	}

	return Connector;
})();
