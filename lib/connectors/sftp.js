'use babel';

import FS from 'fs-plus';
import Path from 'path';
import SSH2 from 'ssh2';
import Connector from '../connector';
import { isGenericUploadError } from '../notifications';
import { traverseTree, statsToPermissions } from '../helpers';

class ConnectorSFTP extends Connector {
  constructor(...args) {
    super(...args);

    this.ssh2 = null;
    this.sftp = null;
    this.status = 'disconnected';
  }

  isConnected() {
    const self = this;

    return self.status !== 'disconnected' && self.sftp;
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

    self.ssh2.on('banner', (msg) => {
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

          self.ssh2.shell((shellErr, stream) => {
            if (shellErr) {
              self.emit('error', shellErr);
              self.disconnect();
              return;
            }

            stream.end(`${self.info.remoteShell}\nexit\n`);
          });
        }

        if (self.info.remoteCommand) {
          self.emit('executingCommand', self.info.remoteCommand);

          self.ssh2.exec(self.info.remoteCommand, (remoteErr) => {
            if (remoteErr) {
              self.emit('error', remoteErr);
              self.disconnect();
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

        if (typeof completed === 'function') {
          completed.apply(self, []);
        }
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
      if (typeof debug === 'function') {
        debug(...[str]);
      }
    });

    self.ssh2.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      finish([self.info.verifyCode]);
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

    if (typeof completed === 'function') {
      completed(...[]);
    }

    return self;
  }

  abort(completed) {
    // TODO find a way to abort current operation

    if (typeof completed === 'function') {
      completed(...[]);
    }

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

    const listDir = (listPath) => {
      digg++;

      if (digg > 500) {
        console.log('recursion depth over 500!');
      }

      self.sftp.readdir(listPath, (err, li) => {
        if (err) return callCompleted();
        let filesLeft = li.length;

        if (filesLeft === 0) return callCompleted();

        li.forEach((item) => {
          // symlinks
          if (item.attrs.isSymbolicLink()) {
            // NOTE: we only follow one symlink down here!
            // symlink -> symlink -> file won't work!
            const fname = Path.join(listPath, item.filename).replace(/\\/g, '/');

            self.sftp.realpath(fname, (realPatherr, target) => {
              if (realPatherr) {
                atom.notifications.addError('Could not call realpath for symlink', {
                  detail: realPatherr,
                  dismissable: false,
                });

                if (--filesLeft === 0) oneDirCompleted();

                return;
              }

              self.sftp.stat(target, (statErr, stats) => {
                if (statErr) {
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
                  group: stats.gid,
                  owner: stats.uid,
                  rights: statsToPermissions(stats),
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
              name: Path.join(listPath, item.filename).replace(/\\/g, '/'),
              type: item.attrs.isFile() ? 'f' : 'd',
              size: item.attrs.size,
              group: item.attrs.gid,
              owner: item.attrs.uid,
              rights: statsToPermissions(item.attrs),
              date: new Date(),
            };

            entry.date.setTime(item.attrs.mtime * 1000);
            list.push(entry);

            if (recursive && entry.type === 'd') listDir(entry.name);
            if (--filesLeft === 0) oneDirCompleted();
          }
        });

        return true;
      });
    };

    listDir(path);
  }

  get(path, recursive, completed, progress, symlinkPath) {
    const self = this;
    const local = self.client.toLocal(symlinkPath || path);

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
        self.sftp.realpath(path, (realPatherr, target) => {
          if (realPatherr) {
            if (typeof completed === 'function') completed(...[realPatherr]);
            return;
          }

          self.get(target, recursive, completed, progress, path);
        });
      } else if (stats.isFile()) {
        // File
        FS.makeTreeSync(Path.dirname(local));

        self.sftp.fastGet(path, local, {
          step(read, chunk, size) {
            if (typeof progress === 'function') { progress(...[read / size]); }
          },
        }, (fastGetErr) => {
          if (typeof completed === 'function') { completed(...[fastGetErr]); }
        });
      } else {
        // Directory
        self.list(path, recursive, (listErr, list) => {
          list.unshift({ name: path, type: 'd' });

          list.forEach((item) => {
            item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length;
          });

          list.sort((a, b) => {
            if (a.depth === b.depth) return 0;
            return a.depth > b.depth ? 1 : -1;
          });

          let error = null;
          const total = list.length;
          let i = -1;
          const e = () => {
            if (typeof completed === 'function') { completed(...[error, list]); }
          };

          const n = () => {
            ++i;
            if (typeof progress === 'function') { progress(...[i / total]); }

            const item = list.shift();

            if (typeof item === 'undefined' || item === null) { return e(); }

            const toLocal = self.client.toLocal(item.name);

            if (item.type === 'd' || item.type === 'l') {
              // mkdirp(toLocal, function (err) {
              FS.makeTree(toLocal, (treeErr) => {
                if (treeErr) { error = treeErr; }

                return n();
              });
            } else {
              self.sftp.fastGet(item.name, toLocal, {
                step(read, chunk, size) {
                  if (typeof progress === 'function') {
                    progress(...[(i / total) + (read / size / total)]);
                  }
                },
              }, (fastGetErr) => {
                if (fastGetErr) { error = fastGetErr; }

                return n();
              });
            }
            return true;
          };
          n();
        });
      }
    });
  }

  putDirect(file) {
    const self = this;
    const fileObject = Object.assign({
      localPath: null,
      remotePath: null,
      callback: null,
      progress: null,
      i: 0,
      total: 0,
    }, file);

    const stats = (err, attrs) => {
      const options = {};

      if (this.customFilePermissions) {
        options.mode = parseInt(self.customFilePermissions, 8);
      } else if (err) {
        // using the default 0644
        options.mode = 0o0644;
      } else {
        // using the original permissions from the remote
        options.mode = attrs.mode;
      }

      const readStream = FS.createReadStream(fileObject.localPath);
      const writeStream = self.sftp.createWriteStream(fileObject.remotePath, options);
      const fileSize = FS.statSync(fileObject.localPath).size; // used for setting progress bar

      let totalRead = 0; // used for setting progress bar

      function applyProgress() {
        if (typeof progress !== 'function') return;
        if (fileObject.total != null && fileObject.i != null) {
          fileObject.progress(...[(fileObject.i / fileObject.total) + (totalRead / fileSize / fileObject.total)]);
        } else {
          fileObject.progress(...[totalRead / fileSize]);
        }
      }

      writeStream.on('finish', () => {
        applyProgress(); // completes the progress bar

        return fileObject.e();
      }).on('error', (writeErr) => {
        const hasProp = Object.prototype.hasOwnProperty.call(fileObject, 'err');

        if (!hasProp && (writeErr.message === 'No such file' || writeErr.message === 'NO_SUCH_FILE')) {
          self.mkdir(Path.dirname(fileObject.remotePath).replace(/\\/g, '/'), true, (dirErr) => {
            if (dirErr) {
              const error = writeErr.message || dirErr;
              isGenericUploadError(error);

              return dirErr;
            }

            self.putDirect(Object.assign({}, fileObject, { dirErr }));

            return true;
          });
        } else if (err && Object.prototype.hasOwnProperty.call(err, 'message')) {
          isGenericUploadError(err.message);
        } else {
          console.error(writeErr); // Useful for debugging
          isGenericUploadError(writeErr);
        }
      });

      readStream.on('data', (chunk) => {
        totalRead += chunk.length;

        if (totalRead === fileSize) return; // let writeStream.on("finish") complete the progress bar

        applyProgress();
      });

      readStream.pipe(writeStream);
    };

    self.sftp.stat(fileObject.remotePath, stats);
  }

  put(path, completed, progress) {
    const self = this;
    const remote = self.client.toRemote(path);

    if (self.isConnected()) {
      // File
      if (FS.isFileSync(path)) {
        const e = (err) => {
          if (typeof completed === 'function') {
            completed(...[err || null, [{ name: path, type: 'f' }]]);
          }
        };

        self.putDirect({
          localPath: path,
          remotePath: remote,
          progress,
          e,
        });
      } else { // Folder
        traverseTree(path, (list) => {
          self.mkdir(remote, true, () => {
            let i = -1;
            const total = list.length;
            const e = (error) => {
              if (typeof completed === 'function') { completed(...[error, list]); }
            };
            const n = (error) => {
              if (++i >= list.length) return e(error);

              const item = list[i];
              const toRemote = self.client.toRemote(item.name);

              if (item.type === 'd' || item.type === 'l') {
                self.sftp.mkdir(toRemote, {}, (travDirerr) => {
                  if (travDirerr) { error = travDirerr; }
                  return n();
                });
              } else {
                self.putDirect({
                  localPath: item.name,
                  remotePath: toRemote,
                  progress,
                  i,
                  total,
                  e(putErr) {
                    if (putErr) error = putErr;

                    return n(error);
                  },
                });
              }

              return true;
            };
            return n();
          });
        });
      }
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return self;
  }

  mkdir(path, recursive, completed) {
    const self = this;
    const remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
    const dirs = [`/${remotes.slice(0, remotes.length).join('/')}`];

    if (self.isConnected()) {
      if (recursive) {
        for (let a = remotes.length - 1; a > 0; --a) {
          dirs.unshift(`/${remotes.slice(0, a).join('/')}`);
        }
      }

      const n = () => {
        const dir = dirs.shift();
        const last = dirs.length === 0;

        self.sftp.mkdir(dir, {}, (err) => {
          if (last) {
            if (typeof completed === 'function') {
              completed(...[err || null]);
            }
          } else {
            return n();
          }

          return true;
        });
      };
      n();
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return self;
  }

  mkfile(path, completed) {
    const self = this;
    const local = self.client.toLocal(path);
    const empty = new Buffer('', 'utf8');

    if (self.isConnected()) {
      self.sftp.open(path, 'w', {}, (err, handle) => {
        if (err) {
          if (typeof completed === 'function') { completed(...[err]); }
          return;
        }

        self.sftp.write(handle, empty, 0, 0, 0, (writeErr) => {
          if (writeErr) {
            if (typeof completed === 'function') { completed(...[writeErr]); }
            return;
          }

          // mkdirp(Path.dirname(local), function (err1) {
          FS.makeTree(Path.dirname(local), (err1) => {
            FS.writeFile(local, empty, (err2) => {
              if (typeof completed === 'function') {
                completed(...[err1 || err2]);
              }
            });
          });
        });
      });
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return self;
  }

  rename(source, dest, completed) {
    const self = this;

    if (self.isConnected()) {
      self.sftp.rename(source, dest, (err) => {
        if (err) {
          if (typeof completed === 'function') { completed(...[err]); }
        } else {
          FS.rename(self.client.toLocal(source), self.client.toLocal(dest), (localErr) => {
            if (typeof completed === 'function') { completed(...[localErr]); }
          });
        }
      });
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

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
          self.sftp.realpath(path, (realPathErr, target) => {
            if (realPathErr) {
              if (typeof completed === 'function') completed(...[realPathErr]);

              return;
            }

            self.delete(target, completed);
          });
        } else if (stats.isFile()) {
          // File
          self.sftp.unlink(path, (unlinkErr) => {
            if (typeof completed === 'function') {
              completed(...[unlinkErr, [{ name: path, type: 'f' }]]);
            }
          });
        } else {
          // Directory
          self.list(path, true, (listErr, list) => {
            list.forEach((item) => { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
            list.sort((a, b) => {
              if (a.depth === b.depth) { return 0; }
              return a.depth > b.depth ? -1 : 1;
            });

            let done = 0;

            const e = () => {
              self.sftp.rmdir(path, (rmdirErr) => {
                if (typeof completed === 'function') {
                  completed(...[rmdirErr, list]);
                }
              });
            };

            list.forEach((item) => {
              ++done;
              const fn = item.type === 'd' || item.type === 'l' ? 'rmdir' : 'unlink';
              self.sftp[fn](item.name, () => {
                if (--done === 0);

                return e();
              });
            });

            if (list.length === 0);

            e();
          });
        }
      });
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return self;
  }

  chmod(path, mode, completed = () => {}) {
    const self = this;

    if (self.isConnected()) {
      self.sftp.chmod(path, parseInt(mode, 8), completed);
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }
  }

  chown(path, uid, gid, completed = () => {}) {
    const self = this;

    if (self.isConnected()) {
      self.sftp.chown(path, uid, gid, completed);
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }
  }
}

export default ConnectorSFTP;
