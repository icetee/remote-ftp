'use babel';

const __hasProp = {}.hasOwnProperty;
import FS from 'fs-plus';
import Path from 'path';
import SSH2 from 'ssh2';
import Connector from '../connector';
import { traverseTree } from '../helpers';

export default (() => {
  class ConnectorSFTP extends Connector {
    constructor() {
      super(...arguments);
      this.ssh2 = null;
      this.sftp = null;
      this.status = 'disconnected';
    }

    isConnected() {
      const self = this;

      return self.status != 'disconnected' && self.sftp;
    }

    connect(info, completed) {
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

          if (self.info.remoteShell) {
            self.emit('openingShell', self.info.remoteShell);
            self.ssh2.shell((err, stream) => {
              if (err) {
                self.emit('error', err);
                self.disconnect();
                return;
              }
              stream.end(self.info.remoteShell + '\nexit\n');
            });
          }

          if (self.info.remoteCommand) {
            self.emit('executingCommand', self.info.remoteCommand);
            self.ssh2.exec(self.info.remoteCommand, (err, stream) => {
              if (err) {
                self.emit('error', err);
                self.disconnect();
                return;
              }
            });
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
        if (typeof debug === 'function')				{ debug(...[str]); }
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
    }

    disconnect(completed) {
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

      if (typeof completed === 'function')			{ completed(...[]); }

      return self;
    }

    abort(completed) {
          // TODO find a way to abort current operation

      if (typeof completed === 'function')			{ completed(...[]); }

      return this;
    }

    list(path, recursive, completed) {
      const self = this;

      if (!self.isConnected()) {
        if (typeof completed === 'function') completed(...['Not connected']);
        return;
      }

      const list = [];
      let digg = 0;

      const callCompleted = () => {
        if (typeof completed === 'function') completed(...[null, list]);
      };

      const oneDirCompleted = () => {
        if (--digg === 0) callCompleted();
      };

      const listDir = path => {
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
    }

    get(path, recursive, completed, progress, symlinkPath) {
      let self = this;
      let local = self.client.toLocal(symlinkPath || path);
      if (!self.isConnected()) {
        if (typeof completed === 'function') completed(...['Not connected']);
        return;
      }
      self.sftp.lstat(path, (err, stats) => {
        if (err) {
          if (typeof completed === 'function') completed(...[err]);
          return;
        }
        if (stats.isSymbolicLink()) {
          self.sftp.realpath(path, (err, target) => {
            if (err) {
              if (typeof completed === 'function') completed(...[err]);
              return;
            }
            self.get(target, recursive, completed, progress, path);
          });
        } else if (stats.isFile()) {
                  // File
          FS.makeTreeSync(Path.dirname(local));
          self.sftp.fastGet(path, local, {
            step(read, chunk, size) {
              if (typeof progress === 'function')							{ progress(...[read / size]); }
            },
          }, (err) => {
            if (typeof completed === 'function')						{ completed(...[err]); }
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

            let error = null;
            let total = list.length;
            let i = -1;
            const e = () => {
              if (typeof completed === 'function')							{ completed(...[error, list]); }
            };
            const n = () => {
              ++i;
              if (typeof progress === 'function')							{ progress(...[i / total]); }

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
                    if (typeof progress === 'function')										{ progress(...[(i / total) + (read / size / total)]); }
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
    }

    put(path, completed, progress) {
      let self = this;
      let remote = self.client.toRemote(path);


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
              progress(...[(i / total) + (totalRead / fileSize / total)]);
            } else {
              progress(...[totalRead / fileSize]);
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
          const e = err => {
            if (typeof completed === 'function')						{ completed(...[err || null, [{ name: path, type: 'f' }]]); }
          };

          put({
            localPath: path,
            remotePath: remote,
            e,
          });
        }

              // Folder
        else {
          traverseTree(path, (list) => {
            self.mkdir(remote, true, (err) => {
              let error;
              let i = -1;
              const total = list.length;
              const e = () => {
                if (typeof completed === 'function')									{ completed(...[error, list]); }
              };
              const n = () => {
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
      } else if (typeof completed === 'function')				{ completed(...['Not connected']); }

      return self;
    }

    mkdir(path, recursive, completed) {
      let self = this;
      let remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
      let dirs = [`/${remotes.slice(0, remotes.length).join('/')}`];

      if (self.isConnected()) {
        if (recursive) {
          for (let a = remotes.length - 1; a > 0; --a)					{ dirs.unshift(`/${remotes.slice(0, a).join('/')}`); }
        }

        const n = () => {
          let dir = dirs.shift();
          let last = dirs.length === 0;

          self.sftp.mkdir(dir, {}, (err) => {
            if (last) {
              if (typeof completed === 'function')							{ completed(...[err || null]); }
            } else {
              return n();
            }
          });
        };
        n();
      } else if (typeof completed === 'function')				{ completed(...['Not connected']); }

      return self;
    }

    mkfile(path, completed) {
      let self = this;
      let local = self.client.toLocal(path);
      let empty = new Buffer('', 'utf8');

      if (self.isConnected()) {
        self.sftp.open(path, 'w', {}, (err, handle) => {
          if (err) {
            if (typeof completed === 'function')						{ completed(...[err]); }
            return;
          }
          self.sftp.write(handle, empty, 0, 0, 0, (err) => {
            if (err) {
              if (typeof completed === 'function')							{ completed(...[err]); }
              return;
            }
                      // mkdirp(Path.dirname(local), function (err1) {
            FS.makeTree(Path.dirname(local), (err1) => {
              FS.writeFile(local, empty, (err2) => {
                if (typeof completed === 'function')								{ completed(...[err1 || err2]); }
              });
            });
          });
        });
      } else if (typeof completed === 'function')				{ completed(...['Not connected']); }

      return self;
    }

    rename(source, dest, completed) {
      const self = this;

      if (self.isConnected()) {
        self.sftp.rename(source, dest, (err) => {
          if (err) {
            if (typeof completed === 'function')						{ completed(...[err]); }
          } else {
            FS.rename(self.client.toLocal(source), self.client.toLocal(dest), (err) => {
              if (typeof completed === 'function')							{ completed(...[err]); }
            });
          }
        });
      } else if (typeof completed === 'function')				{ completed(...['Not connected']); }

      return self;
    }

    delete(path, completed) {
      const self = this;

      if (self.isConnected()) {
        self.sftp.stat(path, (err, stats) => {
          if (err) {
            if (typeof completed === 'function') completed(...[err]);
            return;
          }

          if (stats.isSymbolicLink()) {
            self.sftp.realpath(path, (err, target) => {
              if (err) {
                if (typeof completed === 'function') completed(...[err]);
                return;
              }
              self.delete(target, completed);
            });
          } else if (stats.isFile()) {
                      // File
            self.sftp.unlink(path, (err) => {
              if (typeof completed === 'function')							{ completed(...[err, [{ name: path, type: 'f' }]]); }
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

              const e = () => {
                self.sftp.rmdir(path, (err) => {
                  if (typeof completed === 'function')									{ completed(...[err, list]); }
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
      } else if (typeof completed === 'function')				{ completed(...['Not connected']); }

      return self;
    }
  }

  return ConnectorSFTP;
})();
