'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  FS = require('fs-plus'),
  Path = require('path'),
  SSH2 = require('ssh2'),
  Connector = require('../connector');


module.exports = (function () {
  __extends(ConnectorSFTP, Connector);

  function ConnectorSFTP() {
    ConnectorSFTP.__super__.constructor.apply(this, arguments);
    this.ssh2 = null;
    this.sftp = null;
    this.status = 'disconnected';
  }

  ConnectorSFTP.prototype.isConnected = function () {
    const self = this;

    return self.status != 'disconnected' && self.sftp;
  };

  ConnectorSFTP.prototype.connect = function (info, completed) {
    const self = this;
    self.info = info;
    self.info.debug = true;
    self.customFilePermissions = self.info.filePermissions;

    const debug = self.info.debug;
    const connectInfo = Object.assign({}, self.info);

    delete connectInfo.filePermissions;

    self.status = 'connecting';

    self.ssh2 = new SSH2();
    self.ssh2.on('banner', (msg, lang) => {
      self.emit('greeting', msg);
    });
    self.ssh2.on('ready', () => {
      self.ssh2.sftp((err, sftp) => {
        if (err) {
          self.disconnect();
          return;
        }

        self.status = 'connected';

        self.sftp = sftp;
        self.sftp.on('end', () => {
          self.disconnect();
          self.emit('ended');
        });

        self.emit('connected');

        if (typeof completed === 'function')					{ completed.apply(self, []); }
      });
    });
    self.ssh2.on('end', () => {
      self.disconnect();
      self.emit('ended');
    });
    self.ssh2.on('close', () => {
      self.disconnect();
      self.emit('closed');
    });
    self.ssh2.on('error', (err) => {
      self.emit('error', err);
    });
    self.ssh2.on('debug', (str) => {
      if (typeof debug === 'function')				{ debug.apply(null, [str]); }
    });
    self.ssh2.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      finish([self.info.password]);
    });

    try {
      self.ssh2.connect(connectInfo);
    } catch (err) {
      atom.notifications.addError('SFTP connection attempt failed', {
        detail: err,
        dismissable: true,
      });
    }

    return self;
  };

  ConnectorSFTP.prototype.disconnect = function (completed) {
    const self = this;

    self.status = 'disconnected';

    if (self.sftp) {
      self.sftp.end();
      self.sftp = null;
    }

    if (self.ssh2) {
      self.ssh2.end();
      self.ssh2 = null;
    }

    if (typeof completed === 'function')			{ completed.apply(null, []); }

    return self;
  };

  ConnectorSFTP.prototype.abort = function (completed) {
		// TODO find a way to abort current operation

    if (typeof completed === 'function')			{ completed.apply(null, []); }

    return this;
  };

  ConnectorSFTP.prototype.list = function (path, recursive, completed) {
    const self = this;

    if (!self.isConnected()) {
      if (typeof completed === 'function') completed.apply(null, ['Not connected']);
      return;
    }

    const list = [];
    let digg = 0;

    const callCompleted = function () {
      if (typeof completed === 'function') completed.apply(null, [null, list]);
    };

    const oneDirCompleted = function () {
      if (--digg === 0) callCompleted();
    };

    var listDir = function (path) {
      digg++;
      if (digg > 500) {
        console.log('recursion depth over 500!');
      }
      self.sftp.readdir(path, (err, li) => {
        if (err) return callCompleted();
        let filesLeft = li.length;

        if (filesLeft === 0) return callCompleted();

        li.forEach((item) => {
					// symlinks
          if (item.attrs.isSymbolicLink()) {
						// NOTE: we only follow one symlink down here!
						// symlink -> symlink -> file won't work!
            const fname = Path.join(path, item.filename).replace(/\\/g, '/');

            self.sftp.realpath(fname, (err, target) => {
              if (err) {
                atom.notifications.addError('Could not call realpath for symlink', {
                  detail: err,
                  dismissable: false,
                });
                if (--filesLeft === 0) oneDirCompleted();
                return;
              }

              self.sftp.stat(target, (err, stats) => {
                if (err) {
                  atom.notifications.addError('Could not correctly resolve symlink', {
                    detail: `${fname} -> ${target}`,
                    dismissable: false,
                  });
                  if (--filesLeft === 0) oneDirCompleted();
                  return;
                }
                const entry = {
                  name: fname,
                  type: stats.isFile() ? 'f' : 'd',
                  size: stats.size,
                  date: new Date(),
                };
                entry.date.setTime(stats.mtime * 1000);
                list.push(entry);
                if (recursive && entry.type === 'd') listDir(entry.name);
                if (--filesLeft === 0) oneDirCompleted();
              });
            });

					// regular files & dirs
          } else {
            const entry = {
              name: Path.join(path, item.filename).replace(/\\/g, '/'),
              type: item.attrs.isFile() ? 'f' : 'd',
              size: item.attrs.size,
              date: new Date(),
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
    let self = this,
      local = self.client.toLocal(symlinkPath || path);
    if (!self.isConnected()) {
      if (typeof completed === 'function') completed.apply(null, ['Not connected']);
      return;
    }
    self.sftp.lstat(path, (err, stats) => {
      if (err) {
        if (typeof completed === 'function') completed.apply(null, [err]);
        return;
      }
      if (stats.isSymbolicLink()) {
        self.sftp.realpath(path, (err, target) => {
          if (err) {
            if (typeof completed === 'function') completed.apply(null, [err]);
            return;
          }
          self.get(target, recursive, completed, progress, path);
        });
      } else if (stats.isFile()) {
				// File
        FS.makeTreeSync(Path.dirname(local));
        self.sftp.fastGet(path, local, {
          step(read, chunk, size) {
            if (typeof progress === 'function')							{ progress.apply(null, [read / size]); }
          },
        }, (err) => {
          if (typeof completed === 'function')						{ completed.apply(null, [err]); }
          return;
        });
      } else {
				// Directory
        self.list(path, recursive, (err, list) => {
          list.unshift({ name: path, type: 'd' });
          list.forEach((item) => {
            item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length;
          });
          list.sort((a, b) => {
            if (a.depth == b.depth) return 0;
            return a.depth > b.depth ? 1 : -1;
          });

          let error = null,
            total = list.length,
            i = -1;
          const e = function () {
            if (typeof completed === 'function')							{ completed.apply(null, [error, list]); }
          };
          var n = function () {
            ++i;
            if (typeof progress === 'function')							{ progress.apply(null, [i / total]); }

            const item = list.shift();
            if (typeof item === 'undefined' || item === null)							{ return e(); }
            const local = self.client.toLocal(item.name);
            if (item.type == 'd' || item.type == 'l') {
							// mkdirp(local, function (err) {
              FS.makeTree(local, (err) => {
                if (err)									{ error = err; }
                return n();
              });
            } else {
              self.sftp.fastGet(item.name, local, {
                step(read, chunk, size) {
                  if (typeof progress === 'function')										{ progress.apply(null, [(i / total) + (read / size / total)]); }
                },
              }, (err) => {
                if (err)									{ error = err; }
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
    let self = this,
      remote = self.client.toRemote(path);


    function put(obj) {
				// Possibly deconstruct in coffee script? If thats a thing??
      const localPath = obj.localPath;
      const remotePath = obj.remotePath;
      const e = obj.e; // callback
      const i = obj.i;
      const total = obj.total;

      self.sftp.stat(remotePath, (err, attrs) => {
        const options = {};

        if (self.customFilePermissions) {
						// overwrite permissions when filePermissions option set
          options.mode = parseInt(self.customFilePermissions, 8);
        } else if (err) {
						// using the default 0644
          options.mode = 0o0644;
        } else {
						// using the original permissions from the remote
          options.mode = attrs.mode;
        }

        const readStream = FS.createReadStream(localPath);
        const writeStream = self.sftp.createWriteStream(remotePath, options);
        const fileSize = FS.statSync(localPath).size; // used for setting progress bar
        let totalRead = 0; // used for setting progress bar


        function applyProgress() {
          if (typeof progress !== 'function') return;
          if (total != null && i != null) {
            progress.apply(null, [(i / total) + (totalRead / fileSize / total)]);
          } else {
            progress.apply(null, [totalRead / fileSize]);
          }
        }


        writeStream
					.on('finish', () => {
  applyProgress(); // completes the progress bar
  return e();
})
					.on('error', (err) => {
  if (!obj.hasOwnProperty('err') && (err.message == 'No such file' || err.message === 'NO_SUCH_FILE')) {
    self.mkdir(Path.dirname(remote).replace(/\\/g, '/'), true, (err) => {
      if (err) {
        const error = err.message || err;
        atom.notifications.addError(`Remote FTP: Upload Error ${error}`, {
          dismissable: false,
        });
        return err;
      }
      put(Object.assign({}, obj, { err }));
    });
  } else {
    const error = err.message || err;
    atom.notifications.addError(`Remote FTP: Upload Error ${error}`, {
      dismissable: false,
    });
  }
});

        readStream
					.on('data', (chunk) => {
  totalRead += chunk.length;
  if (totalRead === fileSize) return; // let writeStream.on("finish") complete the progress bar
  applyProgress();
});

        readStream.pipe(writeStream);
      });
    }


    if (self.isConnected()) {
			// File
      if (FS.isFileSync(path)) {
        const e = function (err) {
          if (typeof completed === 'function')						{ completed.apply(null, [err || null, [{ name: path, type: 'f' }]]); }
        };

        put({
          localPath: path,
          remotePath: remote,
          e,
        });
      }

			// Folder
      else {
        self.client.traverseTree(path, (list) => {
          self.mkdir(remote, true, (err) => {
            let error,
              i = -1,
              total = list.length;
            const e = function () {
              if (typeof completed === 'function')									{ completed.apply(null, [error, list]); }
            };
            var n = function () {
              if (++i >= list.length) return e();

              const item = list[i];
              const remote = self.client.toRemote(item.name);

              if (item.type == 'd' || item.type == 'l') {
                self.sftp.mkdir(remote, {}, (err) => {
                  if (err)											{ error = err; }
                  return n();
                });
              } else {
                put({
                  localPath: item.name,
                  remotePath: remote,
                  i,
                  total,
                  e(err) {
                    if (err) error = err;
                    return n();
                  },
                });
              }
            };
            return n();
          });
        });
      }
    } else if (typeof completed === 'function')				{ completed.apply(null, ['Not connected']); }

    return self;
  };

  ConnectorSFTP.prototype.mkdir = function (path, recursive, completed) {
    let self = this,
      remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/'),
      dirs = [`/${remotes.slice(0, remotes.length).join('/')}`];

    if (self.isConnected()) {
      if (recursive) {
        for (let a = remotes.length - 1; a > 0; --a)					{ dirs.unshift(`/${remotes.slice(0, a).join('/')}`); }
      }

      var n = function () {
        let dir = dirs.shift(),
          last = dirs.length === 0;

        self.sftp.mkdir(dir, {}, (err) => {
          if (last) {
            if (typeof completed === 'function')							{ completed.apply(null, [err || null]); }
          } else {
            return n();
          }
        });
      };
      n();
    } else if (typeof completed === 'function')				{ completed.apply(null, ['Not connected']); }

    return self;
  };

  ConnectorSFTP.prototype.mkfile = function (path, completed) {
    let self = this,
      local = self.client.toLocal(path),
      empty = new Buffer('', 'utf8');

    if (self.isConnected()) {
      self.sftp.open(path, 'w', {}, (err, handle) => {
        if (err) {
          if (typeof completed === 'function')						{ completed.apply(null, [err]); }
          return;
        }
        self.sftp.write(handle, empty, 0, 0, 0, (err) => {
          if (err) {
            if (typeof completed === 'function')							{ completed.apply(null, [err]); }
            return;
          }
					// mkdirp(Path.dirname(local), function (err1) {
          FS.makeTree(Path.dirname(local), (err1) => {
            FS.writeFile(local, empty, (err2) => {
              if (typeof completed === 'function')								{ completed.apply(null, [err1 || err2]); }
            });
          });
        });
      });
    } else if (typeof completed === 'function')				{ completed.apply(null, ['Not connected']); }

    return self;
  };

  ConnectorSFTP.prototype.rename = function (source, dest, completed) {
    const self = this;

    if (self.isConnected()) {
      self.sftp.rename(source, dest, (err) => {
        if (err) {
          if (typeof completed === 'function')						{ completed.apply(null, [err]); }
        } else {
          FS.rename(self.client.toLocal(source), self.client.toLocal(dest), (err) => {
            if (typeof completed === 'function')							{ completed.apply(null, [err]); }
          });
        }
      });
    } else if (typeof completed === 'function')				{ completed.apply(null, ['Not connected']); }

    return self;
  };

  ConnectorSFTP.prototype.delete = function (path, completed) {
    const self = this;

    if (self.isConnected()) {
      self.sftp.stat(path, (err, stats) => {
        if (err) {
          if (typeof completed === 'function') completed.apply(null, [err]);
          return;
        }

        if (stats.isSymbolicLink()) {
          self.sftp.realpath(path, (err, target) => {
            if (err) {
              if (typeof completed === 'function') completed.apply(null, [err]);
              return;
            }
            self.delete(target, completed);
          });
        } else if (stats.isFile()) {
					// File
          self.sftp.unlink(path, (err) => {
            if (typeof completed === 'function')							{ completed.apply(null, [err, [{ name: path, type: 'f' }]]); }
          });
        } else {
					// Directory
          self.list(path, true, (err, list) => {
            list.forEach((item) => { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
            list.sort((a, b) => {
              if (a.depth == b.depth)								{ return 0; }
              return a.depth > b.depth ? -1 : 1;
            });

            let done = 0;

            const e = function () {
              self.sftp.rmdir(path, (err) => {
                if (typeof completed === 'function')									{ completed.apply(null, [err, list]); }
              });
            };
            list.forEach((item) => {
              ++done;
              const fn = item.type == 'd' || item.type == 'l' ? 'rmdir' : 'unlink';
              self.sftp[fn](item.name, (err) => {
                if (--done === 0);
                return e();
              });
            });
            if (list.length === 0);
            e();
          });
        }
      });
    } else if (typeof completed === 'function')				{ completed.apply(null, ['Not connected']); }

    return self;
  };

  return ConnectorSFTP;
}());
