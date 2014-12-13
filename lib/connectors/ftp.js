var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	FS = require('fs-plus'),
	Path = require('path'),
	mkdirp = require('mkdirp'),
	FTP = require('ftp'),
	Connector = require('../connector');


module.exports = (function () {
	__extends(ConnectorFTP, Connector);

	function ConnectorFTP () {
		ConnectorFTP.__super__.constructor.apply(this, arguments);
	}

	ConnectorFTP.prototype.isConnected = function () {
		return this.ftp && this.ftp.connected;
	};

	ConnectorFTP.prototype.connect = function (info, callback) {
		var self = this;

		self.info = info;

		self.ftp = new FTP();
		self.ftp.on('greeting', function (msg) {
			self.emit('greeting', msg);
		});
		self.ftp.on('ready', function () {
			self.emit('connected');

			if (typeof callback === 'function')
				callback.apply(self, []);
		});
		self.ftp.on('close', function () {
			self.emit('closed');
		});
		self.ftp.on('end', function () {
			self.emit('ended');
		});
		self.ftp.on('error', function (err) {
			console.error(err);
			self.emit('error', err);
		});
		self.ftp.connect(self.info);

		return self;
	}

	ConnectorFTP.prototype.disconnect = function (callback) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.destroy();
			self.ftp = null;
		}

		if (typeof callback === 'function')
			callback.apply(null, []);

		return self;
	}

	ConnectorFTP.prototype.abort = function (callback) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.abort(function () {
				if (typeof callback === 'function')
					callback.apply(null, []);
			})
		} else {
			if (typeof callback === 'function')
				callback.apply(null, []);
		}

		return self;
	}

	ConnectorFTP.prototype.list = function (path, recursive, callback) {
		var self = this;

		if (self.isConnected()) {

			if (recursive) {
				var digg = 0,
					list = [];

				function e () {
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

							item.name = Path.join(p, item.name).replace(/\\/g, '/');
							list.push(item);
							if (item.type == 'd' || item.type == 'l') {
								l(item.name);
							}
						});

						if (--digg == 0)
							e();
					});
				}
				l(path);
			}
			else {
				self.ftp.list(path, function (err, lis) {
					var list = [];

					if (!err) {
						lis.forEach(function (item) {
							if (item.type == 'd' || item.type == 'l') {
								if (item.name != '.' && item.name != '..')
									list.push(item);
							} else {
								list.push(item);
							}
						});
					}

					if (typeof callback === 'function')
						callback.apply(null, [err, list]);
				})
			}

		} else {
			if (typeof callback === 'function')
				callback.apply(self, ['Not connected']);
		}

		return this;
	}

	ConnectorFTP.prototype.get = function (path, recursive, callback) {
		var self = this,
			local = self.client.toLocal(path);

		self.ftp.cwd(path, function (err) {
			self.ftp.cwd('/', function () {

				// File
				if (err) {
					FS.makeTreeSync(Path.dirname(local));
					self.ftp.get(path, function (err, stream) {
						if (err) {
							if (typeof callback === 'function')
								callback.apply(null, [err]);
							return;
						}

						var dest = FS.createWriteStream(local);
						dest.on('unpipe', function () {
							if (typeof callback === 'function')
								callback.apply(null, []);
						});
						stream.pipe(dest);
					});
				}

				// Folder
				else {

					self.list(path, recursive, function (err, list) {

						list.unshift({name: path, type: 'd'});
						list.forEach(function (item) { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
						list.sort(function (a, b) {
							if (a.depth == b.depth)
								return 0;
							return a.depth > b.depth ? 1 : -1;
						});

						var error = null;
						function e () {
							if (typeof callback === 'function')
								callback.apply(null, [error, list]);
						}
						function n () {
							var item = list.shift();
							if (item == null)
								return e();
							var local = self.client.toLocal(item.name);
							if (item.type == 'd' || item.type == 'l') {
								mkdirp(local, function (err) {
									if (err)
										error = err;
									return n();
								});
							} else {
								self.ftp.get(item.name, function (err, stream) {
									if (err) {
										error = err;
										return n();
									}
									var dest = FS.createWriteStream(local);
									dest.on('unpipe', function () {
										return n();
									});
									stream.pipe(dest);
								})
							}
						}
						n();
					});

				}

			});
		});

		return self;
	}

	ConnectorFTP.prototype.put = function (path, callback) {
		var self = this,
			remote = self.client.toRemote(path);

		// File
		if (FS.isFileSync(path)) {
			function e (err) {
				if (typeof callback === 'function')
					callback.apply(null, [err ? err : [{name: path, type: '-'}]]);
			}
			self.ftp.put(path, remote, function (err) {
				if (err) {
					self.mkdir(Path.dirname(remote).replace(/\\/g, '/'), true, function (err) {
						self.ftp.put(path, remote, function (err) {
							return e(err);
						});
					});
				}
				return e();
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
					var error,
						i = -1;
					function e () {
						if (typeof callback === 'function')
							callback.apply(null, [error, list]);
					}
					function n () {
						if (++i >= list.length)
							return e();
						var item = list[i],
							remote = self.client.toRemote(item.name);
						if (item.type == 'd' || item.type == 'l') {
							self.ftp.mkdir(remote, function (err) {
								if (err)
									error = err;
								return n();
							});
						} else {
							self.ftp.put(item.name, remote, function (err) {
								if (err)
									error = err;
								return n();
							})
						}
					}
					return n();
				});
			}
			function l (p) {
				++digg;
				FS.readdir(p, function (err, lis) {
					if (err)
						return e();

					lis.forEach(function (name) {
						if (name == '.' || name == '..')
							return;

						name = Path.join(p, name);
						if (FS.isFileSync(name)) {
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
						return e();
				});
			}
			l(path);
		}
	}

	ConnectorFTP.prototype.mkdir = function (path, recursive, callback) {
		var self = this,
			remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/'),
			dirs = ['/' + remotes.slice(0, remotes.length).join('/')];

		if (recursive) {
			for (var a = remotes.length - 1; a > 0; --a)
				dirs.unshift('/' + remotes.slice(0, a).join('/'));
		}

		function n () {
			var dir = dirs.shift();
			if (dir == null) {
				if (typeof callback === 'function')
					callback.apply(null, [null]);
			} else {
				self.ftp.mkdir(dir, function (err) {
					if (err) {
						if (typeof callback === 'function')
							callback.apply(null, [err]);
					} else {
						return n();
					}
				});
			}
		}
		n();

		return self;
	}

	ConnectorFTP.prototype.mkfile = function (path, callback) {
		var self = this,
			local = self.client.toLocal(path),
			empty = new Buffer('', 'utf8');

		self.ftp.put(empty, path, function (err) {
			mkdirp(Path.dirname(local), function (err1) {
				FS.writeFile(local, empty, function (err2) {
					if (typeof callback === 'function')
						callback.apply(null, [err1 || err2]);
				});
			})
		});

		return self;
	}

	ConnectorFTP.prototype.rename = function (source, dest, callback) {
		var self = this;

		self.ftp.rename(source, dest, function (err) {
			if (err) {
				if (typeof callback === 'function')
					callback.apply(null, [err]);
			} else {
				FS.rename(self.client.toLocal(source), self.client.toLocal(dest), function (err) {
					if (typeof callback === 'function')
						callback.apply(null, [err]);
				});
			}
		});

		return self;
	}

	ConnectorFTP.prototype.delete = function (path, callback) {
		var self = this;

		self.ftp.cwd(path, function (err) {
			self.ftp.cwd('/', function () {

				// File
				if (err) {
					self.ftp.delete(path, function (err) {
						if (typeof callback === 'function')
							callback.apply(null, [err, [{name: path, type: '-'}]]);
					});
				}

				// Folder
				else {
					self.list(path, true, function (err, list) {
						list.forEach(function (item) { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
						list.sort(function (a, b) {
							if (a.depth == b.depth)
								return 0;
							return a.depth > b.depth ? -1 : 1;
						});

						var done = 0;

						function e () {
							self.ftp.rmdir(path, function (err) {
								if (typeof callback === 'function')
									callback.apply(null, [err, list]);
							});
						}
						list.forEach(function (item) {
							++done;
							var fn = item.type == 'd' || item.type == 'l' ? 'rmdir' : 'delete';
							self.ftp[fn](item.name, function (err) {
								if (--done == 0)
									return e();
							});
						});
						if (list.length == 0)
							e();
					})
				}
			});
		});

		return self;
	}

	return ConnectorFTP;
})();
