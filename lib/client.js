var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) {
		for (var key in parent) {
			if (__hasProp.call(parent, key)) child[key] = parent[key];
		}

		function ctor() {
			this.constructor = child;
		}
		ctor.prototype = parent.prototype;
		child.prototype = new ctor();
		child.__super__ = parent.prototype;
		return child;
	},
	FS = require('fs-plus'),
	Path = require('path'),
	events = require('events'),
	stripJsonComments = require('strip-json-comments'),
	FTP,
	SFTP,
	Directory = require('./directory'),
	LintStream = require('jslint').LintStream,
	chokidar = require("chokidar");

module.exports = (function() {

	__extends(Client, events.EventEmitter);

	function Client() {
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

		//this.on("connected", this.watchListeners.bind(this, true));
		//this.on("disconnected", this.watchListeners.bind(this, false));
		this.on("connected", this.watch.addListeners.bind(this));
		this.on("disconnected", this.watch.removeListeners.bind(this));
	}

	__extends(Progress, events.EventEmitter);

	function Progress() {
		this.progress = -1;
		this._start = 0;
	}

	Progress.prototype.setProgress = function(progress) {
		progress = parseFloat(progress) || -1;

		if (this.progress == -1 && progress > -1)
			this._start = new Date().getTime();

		this.progress = progress;
		this.emit('progress', this.progress);

		if (this.progress == 1)
			this.emit('done');
	};

	Progress.prototype.isDone = function() {
		return this.progress >= 1;
	};

	Progress.prototype.getEta = function() {
		if (this.progress == -1)
			return Infinity;
		var now = new Date().getTime(),
			elapse = now - this._start,
			remaining = elapse * 1 / this.progress;
		//return 1 * delta / this.progress;
		return remaining - elapse;
	};

	Client.prototype.readConfig = function(callback) {
		var self = this;

		function e(err) {
			if (typeof callback === 'function')
				callback.apply(self, [err]);
		}

		FS.readFile(atom.project.getDirectories()[0].resolve('.ftpconfig'), 'utf8', function(err, data) {
			if (err)
				return e(err);

			data = stripJsonComments(data);
			var json = null;
			if (self.validateConfig(data)) {
				try {
					json = JSON.parse(data);

					self.info = json;
					self.root.name = '';
					self.root.path = '/' + self.info.remote.replace(/^\/+/, '');
				} catch (error) {
					atom.notifications.addError('Could not process `.ftpconfig`', {
						detail: error
					});
				}
			}
			if (json !== null && typeof callback === 'function') {
				callback.apply(self, [err, json]);
			}
		});
	};

	Client.prototype.validateConfig = function(data) {
		var valid = true;

		var lintStream = new LintStream({
			edition: "latest",
			white: true
		});
		lintStream.write({
			file: '.ftpconfig',
			body: data
		});
		lintStream.on('data', function(chunk) {
			var error = chunk.linted.errors.slice(0, 1);
			if (error.length) {
				error = error[0];
				atom.notifications.addError('Could not parse `.ftpconfig`', {
					detail: error.message + "\n" + chunk.linted.lines[error.line]
				});

				atom.workspace.open('.ftpconfig').then(function(editor) {
					var decorationConfig = {
						class: 'ftpconfig_line_error'
					};
					editor.getDecorations(decorationConfig).forEach(function(decoration) {
						decoration.destroy();
					});

					var range = editor.getBuffer().clipRange([
						[error.line, 0],
						[error.line, Infinity]
					]);
					var marker = editor.markBufferRange(range, {
						invalidate: 'inside'
					});

					decorationConfig.type = 'line';
					editor.decorateMarker(marker, decorationConfig);
				});

				valid = false;
			}
		});

		return valid;
	};

	Client.prototype.isConnected = function(onconnect) {
		return this.connector && this.connector.isConnected();
	};

	Client.prototype.onceConnected = function(onconnect) {
		var self = this;
		if (self.connector && self.connector.isConnected()) {
			onconnect.apply(self);
			return true;
		} else if (typeof onconnect === 'function') {
			self.readConfig(function() {
				self.connect(true);
			});
			self.removeListener('connected', onconnect);
			self.once('connected', onconnect);
			return false;
		}
	};

	Client.prototype.connect = function(reconnect) {
		var self = this;

		//self.watchListeners(true);

		if (reconnect !== true)
			self.disconnect();

		if (self.isConnected())
			return;

		if (!self.info)
			return;

		if (self.info.promptForPass === true)
			self.promptForPass();
		else
			self.doConnect();
	};

	Client.prototype.doConnect = function() {
		var self = this;

		atom.notifications.addInfo("Remote FTP: Connecting...");

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
					debug: function(str) {
						var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
						if (!log) return;
						if (log[2].match(/^PASS /))
							log[2] = 'PASS ******';
						self.emit('debug', log[1] + ' ' + log[2]);
						console.debug(log[1] + ' ' + log[2]);
					}
				};
				if (!FTP) FTP = require('./connectors/ftp');
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

				if (self.info.agent == 'env')
					info.agent = process.env.SSH_AUTH_SOCK;

				if (self.info.hosthash)
					info.hostHash = self.info.hosthash;

				if (self.info.ignorehost)
					info.hostVerifier = function() {
						return true;
					};

				if (self.info.keyboardInteractive)
					info.tryKeyboard = true;

				info.debug = function(str) {
					/*var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
					if (!log) return;
					if (log[2].match(/^PASS /))
						log[2] = 'PASS ******';
					self.emit('debug', log[1] +' '+ log[2]);
					console.debug(log[1] +' '+ log[2]);*/
				};

				if (!SFTP) SFTP = require('./connectors/sftp');
				self.connector = new SFTP(self);
				break;
			default:
				throw "No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> Remote-FTP -> Create (S)FTP config file.";
		}

		self.connector.connect(info, function() {
			if (self.root.status != 1)
				self.root.open();
			self.emit('connected');

			atom.notifications.addSuccess("Remote FTP: Connected");
		});

		//self.connector.on('greeting', function () {
		//	self.emit('greeting');
		//});
		self.connector.on('closed', function() {
			self.disconnect();
			self.emit('closed');

			atom.notifications.addInfo("Remote FTP: Connection closed");
		});
		self.connector.on('ended', function() {
			self.emit('ended');
		});
		self.connector.on('error', function(err) {
			//self.emit('error', err);
			//console.error(err);

			atom.notifications.addError("Remote FTP: " + err);
		});
	};

	Client.prototype.disconnect = function() {
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

		self.watch.removeListeners.apply(self);

		self._current = null;
		self._queue = [];

		self.emit('disconnected');


		return self;
	};

	Client.prototype.toRemote = function(local) {
		var self = this;

		return Path.join(
			self.info.remote,
			atom.project.relativize(local)
		).replace(/\\/g, '/');
	};

	Client.prototype.toLocal = function(remote) {
		var self = this;

		return atom.project.getDirectories()[0].resolve(
			'./' + remote.substr(self.info.remote.length).replace(/^\/+/, '')
		);
	};

	Client.prototype._next = function() {
		var self = this;

		if (!self.isConnected())
			return;

		self._current = self._queue.shift();
		if (self._current)
			self._current[1].apply(self, [self._current[2]]);

		atom.project.remoteftp.emit('queue-changed');
	};

	Client.prototype._enqueue = function(func, desc) {
		var self = this,
			progress = new Progress();

		self._queue.push([desc, func, progress]);
		if (self._queue.length == 1 && !self._current)
			self._next();
		else
			self.emit('queue-changed');

		return progress;
	};

	Client.prototype.abort = function() {
		var self = this;

		if (self.isConnected())
			self.connector.abort(function() {
				self._next();
			});

		return self;
	};

	Client.prototype.abortAll = function() {
		var self = this;

		self._current = null;
		self._queue = [];

		if (self.isConnected())
			self.connector.abort();

		self.emit('queue-changed');

		return self;
	};

	Client.prototype.list = function(remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function() {
				self.connector.list(remote, recursive, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				});
			}, 'Listing ' + (recursive ? 'recursively ' : '') + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.download = function(remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function(progress) {
				self.connector.get(remote, recursive, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				}, function(percent) {
					progress.setProgress(percent);
				});
			}, 'Downloading ' + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.upload = function(local, callback) {
		var self = this;
		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function(progress) {
				self.connector.put(local, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				}, function(percent) {
					progress.setProgress(percent);
				});
			}, 'Uploading ' + Path.basename(local));
		});

		return self;
	};

	Client.prototype._traverseTree = function(path, callback) {
		var list = [],
			digg = 0;

		var e = function() {
			list.forEach(function(item) {
				item.depth = item.name.split('/').length;
			});
			list.sort(function(a, b) {
				if (a.depth == b.depth)
					return 0;
				return a.depth > b.depth ? 1 : -1;
			});

			if (typeof callback === 'function')
				callback.apply(null, [list]);
		};
		var l = function(p) {
			++digg;
			FS.readdir(p, function(err, lis) {
				if (err)
					return e();

				lis.forEach(function(name) {
					if (name == '.' || name == '..')
						return;

					name = Path.join(p, name);
					var stats = FS.statSync(name);
					list.push({
						name: name,
						size: stats.size,
						date: stats.mtime,
						type: stats.isFile() ? 'f' : 'd'
					});
					if (!stats.isFile()) {
						l(name);
					}
				});
				if (--digg === 0)
					return e();
			});
		};
		l(path);
	};

	Client.prototype.syncRemoteLocal = function(remote, callback) {
		var self = this;
		if (!remote) return;

		self.onceConnected(function() {
			self._enqueue(function(progress) {

				var local = self.toLocal(remote);

				self.connector.list(remote, true, function(err, remotes) {
					if (err) {
						if (typeof callback === 'function')
							callback.apply(null, [err]);
						return;
					}

					self._traverseTree(local, function(locals) {

						var e = function() {
							if (typeof callback === 'function')
								callback.apply(null);
							self._next();
							return;
						};
						var n = function() {
							var remote = remotes.shift();
							if (!remote) {
								return e();
							}

							if (remote.type == 'd')
								return n();


							var toLocal = self.toLocal(remote.name),
								local = null;

							for (var a = 0, b = locals.length; a < b; ++a) {
								if (locals[a].name == toLocal) {
									local = locals[a];
									break;
								}
							}

							// Download only if not present on local or size differ
							if (!local || remote.size != local.size) {
								self.connector.get(remote.name, false, function() {
									return n();
								});
							} else {
								n();
							}
						};
						n();
					});
				});

			}, 'Sync local ' + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.syncLocalRemote = function(local, callback) {
		var self = this;

		self.onceConnected(function() {
			self._enqueue(function(progress) {

				var remote = self.toRemote(local);
				self.connector.list(remote, true, function(err, remotes) {
					if (err) {
						if (typeof callback === 'function')
							callback.apply(null, [err]);
						return;
					}

					self._traverseTree(local, function(locals) {

						var e = function() {
							if (typeof callback === 'function')
								callback.apply(null);
							self._next();
							return;
						};
						var n = function() {
							var local = locals.shift();
							if (!local) {
								return e();
							}

							if (local.type == 'd')
								return n();

							var toRemote = self.toRemote(local.name),
								remote = null;

							for (var a = 0, b = remotes.length; a < b; ++a) {
								if (remotes[a].name == toRemote) {
									remote = remotes[a];
									break;
								}
							}

							// Upload only if not present on remote or size differ
							if (!remote || remote.size != local.size) {
								self.connector.put(local.name, function() {
									return n();
								});
							} else {
								n();
							}
						};
						n();
					});
				});

			}, 'Sync remote ' + Path.basename(local));
		});

		return self;
	};

	Client.prototype.mkdir = function(remote, recursive, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function() {
				self.connector.mkdir(remote, recursive, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				});
			}, 'Creating folder ' + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.mkfile = function(remote, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function() {
				self.connector.mkfile(remote, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				});
			}, 'Creating file ' + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.rename = function(source, dest, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function() {
				self.connector.rename(source, dest, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				});
			}, 'Renaming ' + Path.basename(source));
		});

		return self;
	};

	Client.prototype.delete = function(remote, callback) {
		var self = this;

		//if (self.isConnected()) {
		self.onceConnected(function() {
			self._enqueue(function() {
				self.connector.delete(remote, function() {
					if (typeof callback === 'function')
						callback.apply(null, arguments);
					self._next();
				});
			}, 'Deleting ' + Path.basename(remote));
		});

		return self;
	};

	Client.prototype.promptForPass = function() {
		var self = this;

		PromptPassDialog = require('./dialogs/prompt-pass-dialog');
		var dialog = new PromptPassDialog('', true);
		dialog.on('dialog-done', function(e, pass) {
			self.info.pass = pass;
			self.info.passphrase = pass;
			dialog.close();
			self.doConnect();
		});
		dialog.attach();
	};


	Client.prototype.watch = {
		watcher:null,
		files: [],
		addListeners: function() {
			var self = this;
			var watchData = self.info.watch;
			if (watchData === null) return;
			if (typeof watchData === "string") {
				watchData = [watchData];
			}
			if (!Array.isArray(watchData) || watchData.length < 1) return;

			var dir = atom.project.getDirectories()[0].getRealPathSync();

			var watchDataFormatted = watchData.map(function(watch){
				return Path.resolve(dir, watch);
			});


			var watcher = chokidar.watch(watchDataFormatted, {
			  ignored: /[\/\\]\./,
			  persistent: true
			});

			watcher
			.on("change", function(path, stats){
				var directory = Path.dirname(path);
				self.watch.queueUpload.apply(self, [path]);
			});

			self.files = watchDataFormatted.slice();

			atom.notifications.addInfo("Remote FTP: Added watch listeners");
			self.watcher = watcher;

		},
		removeListeners: function(fileName) {
			var self = this;

			if(self.watcher != null){
				self.watcher.close();
				atom.notifications.addInfo("Remote FTP: Stopped watch listeners");
			}

		},
		queue: {},
		queueUpload: function(fileName) {
			var self = this;
			var timeoutDuration = isNaN(parseInt(self.info.watchTimeout)) === true ? 500 : parseInt(self.info.watchTimeout);


			function scheduleUpload(fileName) {
				self.watch.queue[fileName] = setTimeout(function() {
					self.upload(fileName, function() {});
				}, timeoutDuration);
			}

			if (self.watch.queue[fileName] !== null) {
				clearTimeout(self.watch.queue[fileName]);
				self.watch.queue[fileName] = null;
			}

			scheduleUpload(fileName);

		}

	};

	return Client;
})();
