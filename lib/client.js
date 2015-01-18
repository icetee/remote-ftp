var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	FS = require('fs-plus'),
	Path = require('path'),
	mkdirp = require('mkdirp'),
	events = require('events'),
	FTP = require('./connectors/ftp'),
	SFTP = require('./connectors/sftp'),
	Directory = require('./directory');

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

	__extends(Progress, events.EventEmitter);

	function Progress () {
		this.progress = -1;
		this._start = 0;
	}

	Progress.prototype.setProgress = function (progress) {
		progress = parseFloat(progress) || -1;

		if (this.progress == -1 && progress > -1)
			this._start = (new Date).getTime();

		this.progress = progress;
		this.emit('progress', this.progress);

		if (this.progress == 1)
			this.emit('done');
	}

	Progress.prototype.isDone = function () {
		return this.progress >= 1;
	}

	Progress.prototype.getEta = function () {
		if (this.progress == -1)
			return Infinity;
		var now = (new Date).getTime(),
			elapse = now - this._start,
			remaining = elapse * 1 / this.progress;
		//return 1 * delta / this.progress;
		return remaining - elapse;
	}

	Client.prototype.readConfig = function (callback) {
		var self = this;

		function e (err) {
			if (typeof callback === 'function')
				callback.apply(self, [err]);
		}

		FS.readFile(atom.project.resolve('.ftpconfig'), 'utf8', function (err, data) {
			if (err)
				return e(err);

			var json;
			try {
				json = JSON.parse(data);
			} catch (err) {
				throw "Parse error in `.ftpconfig` JSON : " + err;
				//return e('Parse error in .ftpconfg\'s JSON :\n  '+ err);
			}

			self.info = json;
			self.root.name = '';
			self.root.path = '/' + self.info.remote.replace(/^\/+/, '');

			if (typeof callback === 'function')
				callback.apply(self, [err, json]);
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

	Client.prototype.isConnected = function (onconnect) {
		return this.connector && this.connector.isConnected();
	}

	Client.prototype.onceConnected = function (onconnect) {
		var self = this;
		if (self.connector && self.connector.isConnected()) {
			onconnect.apply(self);
			return true;
		} else if (typeof onconnect === 'function') {
			self.readConfig(function () {
				self.connect(true);
			});
			self.once('connected', onconnect);
			return false;
		}
	}

	Client.prototype.connect = function (reconnect) {
		var self = this;

		if (reconnect !== true)
			self.disconnect();

		if (!self.info)
			return;

		var info;
		switch (self.info.protocol) {
			case 'ftp':
				info = {
					host: self.info.host || '',
					port: self.info.port || 21,
					user: self.info.user || '',
					password: self.info.pass || '',
					secure: self.info.secure || '',
					secureOptions: self.info.secureOptions || '',
					connTimeout: self.info.timeout || 10000,
					pasvTimeout: self.info.timeout || 10000,
					keepalive: self.info.keepalive || 10000,
					debug: function (str) {
						var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
						if (!log) return;
						if (log[2].match(/^PASS /))
							log[2] = 'PASS ******';
						self.emit('debug', log[1] +' '+ log[2]);
						console.debug(log[1] +' '+ log[2]);
					}
				};
				self.connector = new FTP(self);
				break;
			case 'sftp':
				info = {
					host: self.info.host || '',
					port: self.info.port || 21,
					username: self.info.user || '',
					readyTimeout: self.info.connTimeout || 10000,
					pingInterval: self.info.keepalive || 10000
				};
				if (self.info.pass)
					info.password = self.info.pass;

				var pk;
				if (self.info.privatekey && (pk = FS.readFileSync(self.info.privatekey)))
					info.privateKey = pk;

				if (self.info.passphrase)
					info.passphrase = self.info.passphrase;

				if (self.info.agent)
					info.agent = self.info.agent;

				if (self.info.hosthash)
					info.hostHash = self.info.hosthash;

				if (self.info.ignorehost)
					info.hostVerifier = function () { return true; }

				info.debug = function (str) {
					/*var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
					if (!log) return;
					if (log[2].match(/^PASS /))
						log[2] = 'PASS ******';
					self.emit('debug', log[1] +' '+ log[2]);*/
					console.debug(log[1] +' '+ log[2]);
				}

				self.connector = new SFTP(self);
				break;
			default:
				throw "No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> Remote-FTP -> Create (S)FTP config file.";
		}
		self.connector.connect(info, function () {
			if (self.root.status != 1)
				self.root.open();
			self.emit('connected');
		});

		//self.connector.on('greeting', function () {
		//	self.emit('greeting');
		//});
		self.connector.on('closed', function () {
			self.emit('closed');
		});
		self.connector.on('ended', function () {
			self.emit('ended');
		});
		self.connector.on('error', function (err) {
			//self.emit('error', err);
			//console.error(err);
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
			self.root.status = 0;
			self.root.destroy();
			//self.root = null;
		}

		self._current = null;
		self._queue = [];

		self.emit('disconnected');

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
			self._current[1].apply(self, [self._current[2]]);

		atom.project.remoteftp.emit('queue-changed');
	}

	Client.prototype._enqueue = function (func, desc) {
		var self = this,
			progress = new Progress();

		self._queue.push([desc, func, progress]);
		if (self._queue.length == 1 && !self._current)
			self._next();
		else
			self.emit('queue-changed');

		return progress;
	}

	Client.prototype.abort = function () {
		var self = this;

		if (self.isConnected())
			self.connector.abort(function () {
				self._next();
			});

		return self;
	}

	Client.prototype.abortAll = function () {
		var self = this;

		self._current = null;
		self._queue = [];

		if (self.isConnected())
			self.connector.abort();

			self.emit('queue-changed');

		return self;
	}

	Client.prototype.list = function (remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function () {
				self.connector.list(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Listing '+ (recursive?'recursively ':'') + Path.basename(remote));
		})

		return self;
	}

	Client.prototype.download = function (remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function (progress) {
				self.connector.get(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				}, function (percent) {
					progress.setProgress(percent);
				});
			}, 'Downloading '+ Path.basename(remote));
		});

		return self;
	}

	Client.prototype.upload = function (local, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function (progress) {
				self.connector.put(local, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				}, function (percent) {
					progress.setProgress(percent);
				});
			}, 'Uploading '+ Path.basename(local));
		});

		return self;
	}

	Client.prototype.mkdir = function (remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function () {
				self.connector.mkdir(remote, recursive, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Creating folder '+ Path.basename(remote));
		});

		return self;
	}

	Client.prototype.mkfile = function (remote, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function () {
				self.connector.mkfile(remote, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Creating file '+ Path.basename(remote));
		});

		return self;
	}

	Client.prototype.rename = function (source, dest, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function () {
				self.connector.rename(source, dest, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Renaming '+ Path.basename(source));
		});

		return self;
	}

	Client.prototype.delete = function (remote, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function () {
			self._enqueue(function () {
				self.connector.delete(remote, function () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, arguments);
				});
			}, 'Deleting '+ Path.basename(remote));
		});

		return self;
	}

	return Client;
})();
