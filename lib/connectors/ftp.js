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
		this.ftp = null;
	}

	ConnectorFTP.prototype.isConnected = function () {
		return this.ftp && this.ftp.connected;
	};

	ConnectorFTP.prototype.connect = function (info, completed) {
		var self = this;

		self.info = info;

		self.ftp = new FTP();
		self.ftp.on('greeting', function (msg) {
			self.emit('greeting', msg);
		});
		self.ftp.on('ready', function () {
			self.emit('connected');

			if (typeof completed === 'function')
				completed.apply(self, []);
		});
		self.ftp.on('close', function () {
			self.emit('closed');
		});
		self.ftp.on('end', function () {
			self.emit('ended');
		});
		self.ftp.on('error', function (err) {
			self.emit('error', err);
		});
		self.info._debug = self.info.debug;
		self.info.debug = function (str) {
			var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
			if (!log || log[1] != '<') return;

			var reply = log[2].match(/^[0-9]+/);
			if (reply)
				self.emit(reply[0], log[2]);

			if (typeof self.info._debug == 'function')
				self.info._debug.apply(null, [str]);
		}
		self.ftp.connect(self.info);

		return self;
	}

	ConnectorFTP.prototype.disconnect = function (completed) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.destroy();
			self.ftp = null;
		}

		if (typeof completed === 'function')
			completed.apply(null, []);

		return self;
	}

	ConnectorFTP.prototype.abort = function (completed) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.abort(function () {
				if (typeof completed === 'function')
					completed.apply(null, []);
			})
		} else {
			if (typeof completed === 'function')
				completed.apply(null, []);
		}

		return self;
	}

	ConnectorFTP.prototype.list = function (path, recursive, completed) {
		var self = this;

		if (self.isConnected()) {

			if (recursive) {
				var digg = 0,
					list = [];

				var e = function () {
					if (typeof completed === 'function')
						completed.apply(null, [null, list]);
				}
				var l = function (p) {
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

					if (typeof completed === 'function')
						completed.apply(null, [err, list]);
				})
			}

		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return this;
	}

	ConnectorFTP.prototype.get = function (path, recursive, completed, progress) {
		var self = this,
			local = self.client.toLocal(path);

		if (self.isConnected()) {
			self.ftp.cwd(path, function (err) {
				self.ftp.cwd('/', function () {

					// File
					if (err) {
						FS.makeTreeSync(Path.dirname(local));
						var size = -1, pool;
						self.once('150', function (reply) {
							var str = reply.match(/([0-9]+)\s*(bytes)/);
							if (str) {
								size = parseInt(str[1], 10) || -1;
								pool = setInterval(function () {
									if (!self.ftp._pasvSocket) return;
									var read = self.ftp._pasvSocket.bytesRead;
									if (typeof progress === 'function')
										progress.apply(null, [read / size]);
								}, 250);
							}
						});
						self.ftp.get(path, function (err, stream) {
							if (err) {
								if (pool)
									clearInterval(pool);
								if (typeof completed === 'function')
									completed.apply(null, [err]);
								return;
							}

							var dest = FS.createWriteStream(local);
							dest.on('unpipe', function () {
								if (pool)
									clearInterval(pool);
								if (typeof completed === 'function')
									completed.apply(null, []);
							});
							dest.on('error', function (err) {
								if (pool)
									clearInterval(pool);
								if (typeof completed === 'function')
									completed.apply(null, [err]);
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

							var error = null,
								total = list.length,
								i = -1,
								size = 0,
								read = 0,
								pool;
							var e = function () {
								if (typeof completed === 'function')
									completed.apply(null, [error, list]);
							}
							var n = function () {
								++i;
								if (pool)
									clearInterval(pool);
								if (typeof progress === 'function')
									progress.apply(null, [i / total]);

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
									size = 0;
									read = 0;
									self.once('150', function (reply) {
										var str = reply.match(/([0-9]+)\s*(bytes)/);
										if (str) {
											size = parseInt(str[1], 10) || -1;
											pool = setInterval(function () {
												if (!self.ftp._pasvSocket) return;
												read = self.ftp._pasvSocket.bytesRead;
												if (typeof progress === 'function')
													progress.apply(null, [(i / total) + (read / size / total)]);
											}, 250);
										}
									});
									self.ftp.get(item.name, function (err, stream) {
										if (err) {
											error = err;
											return n();
										}
										var dest = FS.createWriteStream(local);
										dest.on('unpipe', function () {
											return n();
										});
										dest.on('error', function (err) {
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
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	ConnectorFTP.prototype.put = function (path, completed, progress) {
		var self = this,
			remote = self.client.toRemote(path);

		if (self.isConnected()) {
			// File
			if (FS.isFileSync(path)) {
				var stats = FS.statSync(path),
					size = stats['size'],
					written = 0,
					pool;
				var e = function (err) {
					if (typeof completed === 'function')
						completed.apply(null, [err ? err : null, [{name: path, type: '-'}]]);
				}
				pool = setInterval(function () {
					if (!self.ftp._pasvSocket) return;
					written = self.ftp._pasvSocket.bytesWritten;
					if (typeof progress === 'function')
						progress.apply(null, [written / size]);
				}, 250);
				self.ftp.put(path, remote, function (err) {
					if (err) {
						self.mkdir(Path.dirname(remote).replace(/\\/g, '/'), true, function (err) {
							self.ftp.put(path, remote, function (err) {
								if (pool)
									clearInterval(pool);
								return e(err);
							});
						});
						return;
					}
					if (pool)
						clearInterval(pool);
					return e();
				});
			}

			// Folder
			else {
				var list = [],
					digg = 0;

				var e = function () {
					list.forEach(function (item) { item.depth = item.name.split('/').length; });
					list.sort(function (a, b) {
						if (a.depth == b.depth)
							return 0;
						return a.depth > b.depth ? 1 : -1;
					});
					self.mkdir(remote, true, function (err) {
						var error,
							i = -1,
							total = list.length,
							size = 0,
							written = 0,
							pool = setInterval(function () {
								if (!self.ftp._pasvSocket) return;
								written = self.ftp._pasvSocket.bytesWritten;
								if (typeof progress === 'function')
									progress.apply(null, [(i / total) + (written / size / total)]);
							}, 250);
						var e = function () {
							if (pool)
								clearInterval(pool);
							if (typeof completed === 'function')
								completed.apply(null, [error, list]);
						}
						var n = function () {
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
								var stats = FS.statSync(item.name);
								size = stats['size'];
								written = 0;
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
				var l = function (p) {
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
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	ConnectorFTP.prototype.mkdir = function (path, recursive, completed) {
		var self = this,
			remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/'),
			dirs = ['/' + remotes.slice(0, remotes.length).join('/')];

		if (self.isConnected()) {
			if (recursive) {
				for (var a = remotes.length - 1; a > 0; --a)
					dirs.unshift('/' + remotes.slice(0, a).join('/'));
			}

			var n = function () {
				var dir = dirs.shift(),
					last = dirs.length == 0;

				self.ftp.mkdir(dir, function (err) {
					if (last) {
						if (typeof completed === 'function')
							completed.apply(null, [err ? err : null]);
					} else {
						return n();
					}
				});
			}
			n();
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	ConnectorFTP.prototype.mkfile = function (path, completed) {
		var self = this,
			local = self.client.toLocal(path),
			empty = new Buffer('', 'utf8');

		if (self.isConnected()) {
			self.ftp.put(empty, path, function (err) {
				mkdirp(Path.dirname(local), function (err1) {
					FS.writeFile(local, empty, function (err2) {
						if (typeof completed === 'function')
							completed.apply(null, [err1 || err2]);
					});
				})
			});
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	ConnectorFTP.prototype.rename = function (source, dest, completed) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.rename(source, dest, function (err) {
				if (err) {
					if (typeof completed === 'function')
						completed.apply(null, [err]);
				} else {
					FS.rename(self.client.toLocal(source), self.client.toLocal(dest), function (err) {
						if (typeof completed === 'function')
							completed.apply(null, [err]);
					});
				}
			});
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	ConnectorFTP.prototype.delete = function (path, completed) {
		var self = this;

		if (self.isConnected()) {
			self.ftp.cwd(path, function (err) {
				self.ftp.cwd('/', function () {

					// File
					if (err) {
						self.ftp.delete(path, function (err) {
							if (typeof completed === 'function')
								completed.apply(null, [err, [{name: path, type: '-'}]]);
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

							var e = function () {
								self.ftp.rmdir(path, function (err) {
									if (typeof completed === 'function')
										completed.apply(null, [err, list]);
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
						});
					}
				});
			});
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	}

	return ConnectorFTP;
})();
