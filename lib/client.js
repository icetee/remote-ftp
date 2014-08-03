var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	FS = require('fs-plus'),
	Path = require('path'),
	mkdirp = require('mkdirp'),
	events = require('events'),
	Loophole = require('loophole'),
	CSON,
	FTP = require('./connectors/ftp'),
	SFTP = require('./connectors/ftp'),
	Directory = require('./directory');

Loophole.allowUnsafeEval(function () {
	CSON = require('cson');
});

module.exports = (function () {

	__extends(Client, events.EventEmitter);

	function Client () {
		this.info = null;
		this.connector = null;
		this._current = null;
		this._queue = [];

		this.root = new Directory({
			name: '/',
			path: '/',
			client: this,
			isExpanded: true
		});
	}

	// TODO this.ftp._pasvSocket is transmitting socket : .bytesRead == downloaded; .bytesWritten == uploaded; .????? == size

	Client.prototype.readConfig = function (callback) {
		var self = this;

		function e (err) {
			if (typeof callback === 'function')
				callback.apply(self, [err]);
		}

		FS.readFile(atom.project.resolve('.ftpconfig'), 'utf8', function (err, data) {
			if (err)
				return e(err);

			CSON.parse(data, function (err, cson) {

				self.info = cson;
				self.root.name = '';
				self.root.path = '/' + self.info.remote.replace(/^\/+/, '');

				if (typeof callback === 'function')
					callback.apply(self, [err, cson]);
			})
		});
	}

	Client.prototype.resolve = function (path) {
		var self = this;

		if (path.substr(0, self.root.path.length) != self.root.path)
			return null;

		var segs = path.substr(self.root.path.length).replace(/^\/+/, '').replace(/\/+$/, '').split('/');
		if (segs.length == 1 && segs[0] == '')
			return self.root;

		for (var p = self.root, a = 0, b = segs.length; a < b; ++a) {
			var s = segs[a], l = a + 1 == b, i;

			if ((i = p.exists(s, true)) !== null) {
				if (l)
					return p.folders[i];
				p = p.folders[i];
			}
			else if (l && (i = p.exists(s, false)) !== null) {
				return p.files[i];
			}
		}
		return null;
	}

	Client.prototype.isConnected = function () {
		return this.connector && this.connector.isConnected();
	}

	Client.prototype.connect = function () {
		var self = this;

		self.disconnect();

		var info;
		switch (self.info.protocol) {
			case 'ftp':
				info = {
					host: self.info.host,
					port: self.info.port,
					user: self.info.user,
					password: self.info.pass,
					secure: self.info.secure,
					secureOptions: self.info.secureOptions,
					connTimeout: self.info.timeout,
					pasvTimeout: self.info.timeout,
					keepalive: self.info.keepalive,
					debug: function (str) {
						var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
						if (!log) return;
						if (log[2].match(/^PASS /))
							log[2] = 'PASS ******';
						self.emit('debug', log[1] +' '+ log[2]);
					}
				};
				self.connector = new FTP(self);
				break;
			case 'sftp':
				info = {
					host: self.info.host,
					port: self.info.port,
					username: self.info.user,
					password: self.info.pass,
					privateKey: self.info.privatekey,
					timeout: self.info.timeout,
					autoconnect: false
				};
				self.connector = new SFTP(self);
				break;
		}
		self.connector.connect(info, function () {
			self.root.open();
			self.emit('connected');
		});

		self.connector.on('greeting', function () {
			self.emit('greeting');
		});
		self.connector.on('closed', function () {
			self.emit('closed');
		});
		self.connector.on('ended', function () {
			self.emit('ended');
		});
		self.connector.on('error', function (err) {

		});
	}

	Client.prototype.disconnect = function () {
		var self = this;

		if (self.connector) {
			self.connector.disconnect();
			delete self.connector;
			self.connector = null;
		}

		if (self.root) {
			self.root.destroy();
			//self.root = null;
		}

		self._current = null;
		self._queue = [];

		return self;
	}

	Client.prototype.toRemote = function (local) {
		var self = this;

		return Path.join(
			self.info.remote,
			atom.project.relativize(local)
		).replace(/\\/g, '/');
	}

	Client.prototype.toLocal = function (remote) {
		var self = this;

		return atom.project.resolve(
			'./' + remote.substr(self.info.remote.length).replace(/^\/+/, '')
		);
	}

	Client.prototype._next = function () {
		var self = this;

		if (!self.isConnected())
			return;

		self._current = self._queue.shift();
		if (self._current)
			self._current[1].apply(self);

		atom.project.remoteftp.emit('queue-changed');
	}

	Client.prototype._enqueue = function (func, desc) {
		var self = this;

		self._queue.push([desc, func]);
		if (self._queue.length == 1)
			self._next();
		else
			atom.project.remoteftp.emit('queue-changed');
	}

	Client.prototype.abort = function () {
		var self = this;

		if (self.isConnected())
			self.connector.abort(function () {
				self._next();
			});

		return self;
	}

	Client.prototype.list = function (remote, recursive, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.list(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'List '+ (recursive?'recursively ':'') + Path.basename(remote));
		}

		return self;
	}

	Client.prototype.download = function (remote, recursive, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.get(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Download '+ (recursive?'recursively ':'') + Path.basename(remote));
		}

		return self;
	}

	Client.prototype.upload = function (local, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.put(local, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Upload '+ Path.basename(local));
		}

		return self;
	}

	Client.prototype.mkdir = function (remote, recursive, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.mkdir(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Create folder '+ Path.basename(remote));
		}

		return self;
	}

	Client.prototype.mkfile = function (remote, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.mkfile(remote, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Create file '+ Path.basename(remote));
		}

		return self;
	}

	Client.prototype.rename = function (source, dest, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.rename(source, dest, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Rename '+ Path.basename(source));
		}

		return self;
	}

	Client.prototype.delete = function (remote, callback) {
		var self = this;

		if (self.isConnected()) {
			self._enqueue(function () {
				self.connector.delete(remote, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Delete '+ Path.basename(remote));
		}

		return self;
	}

	return Client;
})();
