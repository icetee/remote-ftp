var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	FS = require('fs-plus'),
	Path = require('path'),
	SSH2 = require('ssh2'),
	Connector = require('../connector');


module.exports = (function () {
	__extends(ConnectorSFTP, Connector);

	function ConnectorSFTP () {
		ConnectorSFTP.__super__.constructor.apply(this, arguments);
		this.ssh2 = null;
		this.sftp = null;
		this.status = 'disconnected';
	}

	ConnectorSFTP.prototype.isConnected = function () {
		var self = this;

		return self.status != 'disconnected' && self.sftp;
	};

	ConnectorSFTP.prototype.connect = function (info, completed) {
		var self = this;
		self.info = info;
    self.info.debug = true;
    self.filePermissions = parseInt(self.info.filePermissions, 8);

		var debug = self.info.debug;
    var connectInfo = Object.assign({}, self.info);

    delete connectInfo.filePermissions;

		self.status = 'connecting';

		self.ssh2 = new SSH2();
		self.ssh2.on('banner', function (msg, lang) {
			self.emit('greeting', msg);
		});
		self.ssh2.on('ready', function () {
			self.ssh2.sftp(function (err, sftp) {
				if (err) {
					self.disconnect();
					return;
				}

				self.status = 'connected';

				self.sftp = sftp;
				self.sftp.on('end', function () {
					self.disconnect();
					self.emit('ended');
				});

				self.emit('connected');

				if (typeof completed === 'function')
					completed.apply(self, []);
			});

		});
		self.ssh2.on('end', function () {
			self.disconnect();
			self.emit('ended');
		});
		self.ssh2.on('close', function () {
			self.disconnect();
			self.emit('closed');
		});
		self.ssh2.on('error', function (err) {
			self.emit('error', err);
		});
		self.ssh2.on('debug', function (str) {
			if (typeof debug == 'function')
				debug.apply(null, [str]);
		});
		self.ssh2.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
			finish([self.info.password]);
		});
		//self.ssh2.connect(self.info);
    self.ssh2.connect(connectInfo);

		return self;
	};

	ConnectorSFTP.prototype.disconnect = function (completed) {
		var self = this;

		self.status = 'disconnected';

		if (self.sftp) {
			self.sftp.end();
			self.sftp = null;
		}

		if (self.ssh2) {
			self.ssh2.end();
			self.ssh2 = null;
		}

		if (typeof completed === 'function')
			completed.apply(null, []);

		return self;
	};

	ConnectorSFTP.prototype.abort = function (completed) {

		// TODO find a way to abort current operation

		if (typeof completed === 'function')
			completed.apply(null, []);

		return this;
	};

	ConnectorSFTP.prototype.list = function (path, recursive, completed) {
		var self = this;

		if (!self.isConnected()) {
			if (typeof completed === 'function') completed.apply(null, ['Not connected']);
			return;
		}

		var list = [];
		var digg = 0;

		var callCompleted = function() {
			if (typeof completed === 'function') completed.apply(null, [null, list]);
		};

		var oneDirCompleted = function() {
			if (--digg === 0) callCompleted();
		};

		var listDir = function(path) {
			digg++;
			if (digg > 500) {
				console.log('recursion depth over 500!');
			}
			self.sftp.readdir(path, function (err, li) {
				if (err) return callCompleted();
				var filesLeft = li.length;

				if (filesLeft === 0) return callCompleted();

				li.forEach(function (item) {

					// symlinks
					if (item.attrs.isSymbolicLink()) {
						// NOTE: we only follow one symlink down here!
						// symlink -> symlink -> file won't work!
						var fname = Path.join(path, item.filename).replace(/\\/g, '/');

							self.sftp.realpath(fname, function(err, target) {

							if (err) {
								atom.notifications.addError('Could not call realpath for symlink', {
                  detail: err,
                  dismissable: false,
                } );
								if (--filesLeft === 0) oneDirCompleted();
								return;
							}

							self.sftp.stat(target, function(err, stats){
								if (err) {
									atom.notifications.addError('Could not correctly resolve symlink', {
                     detail: fname + ' -> ' + target,
                     dismissable: false,
                   } );
									if (--filesLeft === 0) oneDirCompleted();
									return;
								}
								var entry = {
									name: fname,
									type: stats.isFile() ? 'f' : 'd',
									size: stats.size,
									date: new Date()
								};
								entry.date.setTime(stats.mtime * 1000);
								list.push(entry);
								if (recursive && entry.type === 'd') listDir(entry.name);
								if (--filesLeft === 0) oneDirCompleted();
							});
						});

					// regular files & dirs
					} else {
						var entry = {
							name: Path.join(path, item.filename).replace(/\\/g, '/'),
							type: item.attrs.isFile() ? 'f' : 'd',
							size: item.attrs.size,
							date: new Date()
						};
						entry.date.setTime(item.attrs.mtime * 1000);
						list.push(entry);
						if (recursive && entry.type === 'd') listDir(entry.name);
						if (--filesLeft === 0) oneDirCompleted();
					}
				});
			});
		};

		listDir(path);
	};

	ConnectorSFTP.prototype.get = function (path, recursive, completed, progress, symlinkPath) {
		var self = this, local = self.client.toLocal(symlinkPath || path);
		if (!self.isConnected()) {
			if (typeof completed === 'function') completed.apply(null, ['Not connected']);
			return;
		}
		self.sftp.lstat(path, function (err, stats) {
			if (err) {
				if (typeof completed === 'function') completed.apply(null, [err]);
				return;
			}
			if (stats.isSymbolicLink()) {
				self.sftp.realpath(path, function(err, target) {
					if (err) {
						if (typeof completed === 'function') completed.apply(null, [err]);
						return;
					}
					self.get(target, recursive, completed, progress, path);
				});
			}
			else if (stats.isFile()) {
				// File
				FS.makeTreeSync(Path.dirname(local));
				self.sftp.fastGet(path, local, {
					step: function (read, chunk, size) {
						if (typeof progress === 'function')
							progress.apply(null, [read / size]);
					}
				}, function (err) {
					if (typeof completed === 'function')
						completed.apply(null, [err]);
					return;
				});
			}
			else {
				// Directory
				self.list(path, recursive, function (err, list) {
					list.unshift({ name: path, type: 'd' });
					list.forEach(function (item) {
						item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length;
					});
					list.sort(function (a, b) {
						if (a.depth == b.depth) return 0;
						return a.depth > b.depth ? 1 : -1;
					});

					var error = null,
						total = list.length,
						i = -1;
					var e = function () {
						if (typeof completed === 'function')
							completed.apply(null, [error, list]);
					};
					var n = function () {
						++i;
						if (typeof progress === 'function')
							progress.apply(null, [i / total]);

						var item = list.shift();
						if (typeof item === 'undefined' || item === null)
							return e();
						var local = self.client.toLocal(item.name);
						if (item.type == 'd' || item.type == 'l') {
							//mkdirp(local, function (err) {
							FS.makeTree(local, function (err) {
								if (err)
									error = err;
								return n();
							});
						} else {
							self.sftp.fastGet(item.name, local, {
								step: function (read, chunk, size) {
									if (typeof progress === 'function')
										progress.apply(null, [(i / total) + (read / size / total)]);
								}
							}, function (err) {
								if (err)
									error = err;
								return n();
							});
						}
					};
					n();
				});
			}
		});

		return self;
	};

	ConnectorSFTP.prototype.put = function (path, completed, progress) {
		var self = this,
			remote = self.client.toRemote(path);


			function put(obj) {
				// Possibly deconstruct in coffee script? If thats a thing??
				var localPath = obj.localPath;
				var remotePath = obj.remotePath;
				var e = obj.e; // callback
				var i = obj.i;
				var total = obj.total;

        var options = {
          mode: self.filePermissions,
        };

				var readStream = FS.createReadStream( localPath );
				var writeStream = self.sftp.createWriteStream( remotePath, options );
				var fileSize = FS.statSync( localPath ).size; // used for setting progress bar
				var totalRead = 0; // used for setting progress bar


				function applyProgress() {
					if (typeof progress !== 'function') return;
					if(total != null && i != null){
						progress.apply(null, [(i / total) + (totalRead / fileSize / total)]);
					}
					else{
						progress.apply(null, [totalRead / fileSize]);
					}
				}


				writeStream
				.on("finish", function() {
					applyProgress(); // completes the progress bar
					return e();
				})
				.on("error", function(err) {
					if( !obj.hasOwnProperty("err") && (err.message == "No such file" || err.message === "NO_SUCH_FILE")){

							self.mkdir(Path.dirname(remote).replace(/\\/g, '/'), true, function (err) {
										if (err){
											var error = err.message || err;
											atom.notifications.addError("Remote FTP: Upload Error " + error, {
                        dismissable: false,
                      });
											return err;
										}
										put(Object.assign({}, obj, {err:err}));
								});
					}
					else{
						var error = err.message || err;
						atom.notifications.addError("Remote FTP: Upload Error " + error, {
              dismissable: false,
            });
					}

	      });

				readStream
				.on("data", function(chunk) {
					totalRead += chunk.length;
					if(totalRead === fileSize) return; // let writeStream.on("finish") complete the progress bar
					applyProgress();
				});

				readStream.pipe( writeStream );

			}

		if (self.isConnected()) {

			// File
			if (FS.isFileSync(path)) {
				var e = function (err) {
					if (typeof completed === 'function')
						completed.apply(null, [err ? err : null, [{name: path, type: 'f'}]]);
				};

				put({
					localPath:path,
					remotePath:remote,
					e:e
				});

			}

			// Folder
			else{
					self.client._traverseTree(path, function (list) {
						self.mkdir(remote, true, function (err) {
							var error,
								i = -1,
								total = list.length;
							var e = function () {
								if (typeof completed === 'function')
									completed.apply(null, [error, list]);
							};
							var n = function () {

								if (++i >= list.length) return e();

								var item = list[i];
								var remote = self.client.toRemote(item.name);

								if (item.type == 'd' || item.type == 'l') {
									self.sftp.mkdir(remote, {}, function (err) {
										if (err)
											error = err;
										return n();
									});
								} else {

									put({
										localPath:item.name,
										remotePath:remote,
										i:i,
										total:total,
										e:function(err) {
											if(err) error = err;
											return n();
										}
									});

								}
							};
							return n();
						});
					});
			}
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	};

	ConnectorSFTP.prototype.mkdir = function (path, recursive, completed) {
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
					last = dirs.length === 0;

				self.sftp.mkdir(dir, {}, function (err) {
					if (last) {
						if (typeof completed === 'function')
							completed.apply(null, [err ? err : null]);
					} else {
						return n();
					}
				});
			};
			n();
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	};

	ConnectorSFTP.prototype.mkfile = function (path, completed) {
		var self = this,
			local = self.client.toLocal(path),
			empty = new Buffer('', 'utf8');

		if (self.isConnected()) {
			self.sftp.open(path, 'w', {}, function (err, handle) {
				if (err) {
					if (typeof completed === 'function')
						completed.apply(null, [err]);
					return;
				}
				self.sftp.write(handle, empty, 0, 0, 0, function (err) {
					if (err) {
						if (typeof completed === 'function')
							completed.apply(null, [err]);
						return;
					}
					//mkdirp(Path.dirname(local), function (err1) {
					FS.makeTree(Path.dirname(local), function (err1) {
						FS.writeFile(local, empty, function (err2) {
							if (typeof completed === 'function')
								completed.apply(null, [err1 || err2]);
						});
					});
				});
			});
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	};

	ConnectorSFTP.prototype.rename = function (source, dest, completed) {
		var self = this;

		if (self.isConnected()) {
			self.sftp.rename(source, dest, function (err) {
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
	};

	ConnectorSFTP.prototype.delete = function (path, completed) {
		var self = this;

		if (self.isConnected()) {
			self.sftp.stat(path, function (err, stats) {
				if (err) {
					if (typeof completed === 'function') completed.apply(null, [err]);
					return;
				}

				if (stats.isSymbolicLink()) {
					self.sftp.realpath(path, function(err, target) {
						if (err) {
							if (typeof completed === 'function') completed.apply(null, [err]);
							return;
						}
						self.delete(target, completed);
					});
				}
				else if (stats.isFile()) {
					// File
					self.sftp.unlink(path, function (err) {
						if (typeof completed === 'function')
							completed.apply(null, [err, [{name: path, type: 'f'}]]);
					});
				}
				else {
					// Directory
					self.list(path, true, function (err, list) {
						list.forEach(function (item) { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
						list.sort(function (a, b) {
							if (a.depth == b.depth)
								return 0;
							return a.depth > b.depth ? -1 : 1;
						});

						var done = 0;

						var e = function () {
							self.sftp.rmdir(path, function (err) {
								if (typeof completed === 'function')
									completed.apply(null, [err, list]);
							});
						};
						list.forEach(function (item) {
							++done;
							var fn = item.type == 'd' || item.type == 'l' ? 'rmdir' : 'unlink';
							self.sftp[fn](item.name, function (err) {
								if (--done === 0);
									return e();
							});
						});
						if (list.length === 0);
							e();
					});
				}
			});
		}
		else {
			if (typeof completed === 'function')
				completed.apply(null, ['Not connected']);
		}

		return self;
	};

	return ConnectorSFTP;
})();
