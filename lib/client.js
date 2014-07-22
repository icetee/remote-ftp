var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	fs = require('fs-plus'),
	path = require('path'),
	mkdirp = require('mkdirp'),
	events = require('events'),
	FTP = require('ftp'),
	Directory = require('./directory');

module.exports = (function () {

	__extends(Client, events.EventEmitter);

	function Client () {
		this.info = null;
		this.ftp = null;
		this._current = null;
		this._queue = [];

		this.root = new Directory({
			name: '/',
			path: '/',
			client: this,
			isExpanded: true
		});
	}

	Client.prototype.isConnected = function () {
		return this.ftp && this.ftp.connected;
	}

	Client.prototype.readConfig = function (callback) {
		var self = this;

		function e (err) {
			if (typeof callback === 'function')
				callback.apply(self, [err]);
		}
		// TODO support CSON (season package)
		fs.readFile(atom.project.resolve('.ftpconfig'), 'utf8', function (err, data) {
			if (err)
				return e(err);

			var json;
			try {
				json = JSON.parse(data);
			} catch (err) {
				return e('Parse error in .ftpconfg\'s JSON :\n  '+ err);
			}

			self.info = json;
			self.root.name = '';
			self.root.path = '/' + self.info.remote.replace(/^\/+/, '');

			if (typeof callback === 'function')
				callback.apply(self, []);
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

	Client.prototype.connect = function () {
		var self = this;

		self.disconnect();

		self.info.debug = function (str) {
			var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
			if (!log)
				return;

			if (log[2].match(/^PASS /))
				log[2] = 'PASS ******';

			console.debug(['FTP', log[1], log[2]].join(' '));
		}

		self.ftp = new FTP();
		self.ftp.on('greeting', function (msg) {
			self.emit('greeting', msg);
		});
		self.ftp.on('ready', function () {
			self.emit('connected');
			self.root.open();
		});
		self.ftp.on('close', function () {
			self.emit('closed');
		});
		self.ftp.on('end', function () {
			self.emit('ended');
		});
		self.ftp.on('error', function (err) {
			//console.log(err);
			//self.emit('error', err);
		});
		self.ftp.connect(self.info);

		return self;
	}

	Client.prototype.disconnect = function () {
		var self = this;

		if (self.isConnected()) {
			self.ftp.destroy();
			self.ftp = null;
		}

		if (self.root) {
			self.root.destroy();
			//self.root = null;
		}

		self._current = null;
		self._queue = [];

		return self;
	}

	Client.prototype._next = function () {
		var self = this;

		if (!self.isConnected())
			return;

		self._current = self._queue.shift();
		if (self._current)
			self._current.apply(self);
	}

	Client.prototype._enqueue = function (func) {
		var self = this;

		self._queue.push(func);
		if (self._queue.length == 1)
			self._next();
	}

	Client.prototype.toRemote = function (local) {
		var self = this;

		return path.join(
			self.info.remote,
			atom.project.relativize(local)
		).replace(/\\/g, '/');
	}

	Client.prototype.toLocal = function (remote) {
		var self = this;

		return atom.project.resolve(
			'./' + remote.substr(self.info.remote.length)
		);
	}

	Client.prototype.abort = function () {
		var self = this;

		if (!self.isConnected())
			return;

		self.ftp.abort(function () {
			self._next();
		});

		return this;
	}

	Client.prototype.abortAll = function () {
		var self = this;

		self._current = null;
		self._queue = [];

		return self.abort();
	}

	Client.prototype.list = function (remote, recursive, callback) {
		var self = this;

		if (!self.isConnected())
			return self;

		// Recursive
		if (recursive) {
			var digg = 0,
				list = [];

			self._enqueue(function () {
				function e () {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, [null, list]);
				}
				function l (p) {
					++digg;
					self.ftp.list(p, function (err, lis) {
						if (err)
							return e();

						lis.forEach(function (item) {
							if (item.name == '.' || item.name == '..')
								return;
							item.name = path.join(p, item.name).replace(/\\/g, '/');
							if (item.type == 'd' || item.type == 'l') {
								list.push(item);
								l(item.name);
							} else {
								list.push(item);
							}
						})

						if (--digg == 0)
							e();
					});
				}
				l(remote);
			});

		// Single
		} else {
			self._enqueue(function () {
				self.ftp.list(remote, function (err, lis) {
					var list = [];

					if (lis)
						lis.forEach(function (item) {
							if (item.type == 'd' || item.type == 'l') {
								if (item.name != '.' && item.name != '..')
									list.push(item);
							} else {
								list.push(item);
							}
							item.name = path.join(remote, item.name).replace(/\\/g, '/');
						});

					self._next();

					if (typeof callback === 'function')
						callback.apply(null, [err, list]);
				})
			});
		}

		return self;
	}

	Client.prototype.download = function (remote, recursive, callback) {
		var self = this,
			local = self.toLocal(remote);

		self._enqueue(function () {

			// If folder
			self.ftp.cwd(remote, function (err) {
				self.ftp.cwd('/', function () {
					// Wasn't a folder
					if (err) {
						mkdirp(path.dirname(local), function (err) {
							if (err) {
								self._next();
								if (typeof callback === 'function')
									callback.apply(null, [err]);
								return;
							}

							self.ftp.get(remote, function (err, stream) {
								if (err) {
									self._next();
									if (typeof callback === 'function')
										callback.apply(null, [err]);
									return;
								}

								var dest = fs.createWriteStream(local);
								dest.on('unpipe', function () {
									self._next();
									if (typeof callback === 'function')
										callback.apply(null, []);
								});
								stream.pipe(dest);
							})
						});
					}

					// Is a folder
					else {

						self.list(remote, recursive, function (err, list) {
							list.unshift({name: remote, type: 'd'});
							list.forEach(function (item) { item.depth = item.name.split('/').length; });
							list.sort(function (a, b) {
								if (a.depth == b.depth)
									return 0;
								return a.depth > b.depth ? 1 : -1;
							});

							var error;
							function e () {
								self._next();
								if (typeof callback === 'function')
									callback.apply(null, [error, list]);
							}
							function n () {
								var item = list.shift();
								if (item == null)
									return e();

								var local = self.toLocal(item.name);
								if (item.type == 'd' || item.type == 'l')
									mkdirp(local, function (err) {
										if (err)
											error = err;
										n();
									});
								else
									self.ftp.get(item.name, function (err, stream) {
										if (err) {
											error = err;
											return n();
										}
										var dest = fs.createWriteStream(local);
										dest.on('unpipe', function () {
											n();
										})
										stream.pipe(dest);
									})
							}
							n();

						});

					}
				})
			})

		});

		return self;
	}

	Client.prototype.upload = function (local, callback) {
		var self = this,
			remote = self.toRemote(local);

		// File
		if (fs.isFileSync(local)) {
			self.ftp.put(local, remote, function (err) {
				if (err) {
					self.mkdir(path.dirname(remote).replace(/\\/g, '/'), true, function (err) {
						self.ftp.put(local, remote, function (err) {
							self._next();
							if (typeof callback === 'function')
								callback.apply(null, [err, err ? [] : [{name: local, type: '-'}]]);
						})
					});
					return;
				}
				self._next();
				if (typeof callback === 'function')
					callback.apply(null, [err, err ? [] : [{name: local, type: '-'}]]);
			});
		}

		// Folder
		else {
			var list = [],
				digg = 0;

			function e () {
				list.forEach(function (item) { item.depth = item.name.split('/').length; });
				list.sort(function (a, b) {
					if (a.depth == b.depth)
						return 0;
					return a.depth > b.depth ? 1 : -1;
				});

				self.mkdir(remote, true, function (err) {
					self._enqueue(function () {
						var error,
							i = -1;
						function e () {
							self._next();
							if (typeof callback === 'function')
								callback.apply(null, [error, list]);
						}
						function n () {
							if (++i >= list.length)
								return e();

							var item = list[i],
								remote = self.toRemote(item.name);
							if (item.type == 'd')
								self.ftp.mkdir(remote, function (err) {
									if (err)
										error = err;
									n();
								});
							else
								self.ftp.put(item.name, remote, function (err) {
									if (err)
										error = err;
									n();
								});
						}
						n();
					});
				});
			}
			function l (p) {
				++digg;
				fs.readdir(p, function (err, lis) {
					lis.forEach(function (name) {
						if (name == '.' || name == '..')
							return;

						name = path.join(p, name);
						if (fs.isFileSync(name)) {
							list.push({
								name: name,
								type: '-'
							});
						} else {
							list.push({
								name: name,
								type: 'd'
							});
							l(name);
						}
					});
					if (--digg == 0)
						e();
				})
			}
			l(local);
		}

		return self;
	}

	Client.prototype.mkdir = function (remote, recursive, callback) {
		var self = this,
			remotes = remote.replace(/^\/+/, '').replace(/\/+$/, '').split('/'),
			dirs = ['/' + remotes.slice(0, remotes.length).join('/')];

		if (recursive) {
			for (var a = remotes.length - 1; a > 0; --a)
				dirs.unshift('/' + remotes.slice(0, a).join('/'));
		}

		self._enqueue(function () {
			var error;
			function n () {
				var dir = dirs.shift();
				if (dir == null) {
					self._next();
					if (typeof callback === 'function')
						callback.apply(null, [error]);
					return;
				}
				self.ftp.mkdir(dir, function (err) {
					if (err)
						error = err;
					n();
				});
			}
			n();
		});

		return self;
	}

	Client.prototype.delete = function (remote, recursive, callback) {
		var self = this;

		self._enqueue(function () {
			// Check if folder
			self.ftp.cwd(remote, function (err) {
				self.ftp.cwd('/', function () {
					// File maybe
					if (err) {
						self.ftp.delete(remote, function (err) {
							self._next();
							if (typeof callback === 'function')
								callback.apply(null, [err, [{name: remote, type: '-'}]]);
						});
					}

					// Folder maybe
					else {
						self.list(remote, true, function (err, list) {
							list.forEach(function (item) { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
							list.sort(function (a, b) {
								if (a.depth == b.depth)
									return 0;
								return a.depth > b.depth ? -1 : 1;
							});

							var done = 0,
								error;

							function e () {
								self.ftp.rmdir(remote, function (err) {
									self._next();
									if (typeof callback === 'function')
										callback.apply(null, [error, list]);
								})
							}
							list.forEach(function (item) {
								++done;
								var fn = item.type == 'd' || item.type == 'l' ? 'rmdir' : 'delete';
								self.ftp[fn](item.name, function (err) {
									if (err)
										error = err;
									if (--done == 0)
										e();
								});
							});
							if (list.length == 0)
								e();
						});
					}
				})
			})
		});

		return self;
	}

	Client.prototype.mkfile = function (remote, callback) {
		var self = this,
			local = self.toLocal(remote);

		self._enqueue(function () {
			var empty = new Buffer('', 'utf8');

			self.ftp.put(empty, remote, function (err) {

				mkdirp(path.dirname(local), function (err) {
					fs.writeFile(local, empty, function (err) {
						self._next();
						if (typeof callback === 'function')
							callback.apply(null, [err]);
					});
				})
			});
		});
	}

	Client.prototype.rename = function (remote, dest, callback) {
		var self = this;

		self._enqueue(function () {
			self.ftp.rename(remote, dest, function (err) {
				self._next();
				if (typeof callback === 'function')
					callback.apply(null, [err]);
			});
		});

		return self;
	}

	return Client;
})();
