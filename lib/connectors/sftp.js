var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	FS = require('fs-plus'),
	Path = require('path'),
	SFTP = require('node-sftp'),
	Connector = require('./connector');


module.exports = (function () {
	__extends(ConnectorSFTP, Connector);

	function ConnectorSFTP () {
		ConnectorSFTP.__super__.constructor.apply(this, arguments);
	}

	ConnectorSFTP.prototype.isConnected = function () {
		return this.sftp && this.sftp.connected;
	};

	ConnectorSFTP.prototype.connect = function (info, callback) {
		var self = this;

		self.info = info;

		return self;
	}

	return ConnectorSFTP;
})();
