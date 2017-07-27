'use babel';

import FS from 'fs-plus';
import Path from 'path';
import FTP from '@icetee/ftp';
import Connector from '../connector';
import { getObject, separateRemoteItems } from '../helpers';

const atom = global.atom;
// const errorMessages = {
//
// }

function tryApply(callback, context, args) {
  if (typeof callback === 'function') {
    callback.apply(context, args);
  }
}

export default (function INIT() {
  class ConnectorFTP extends Connector {
    constructor(...args) {
      super(...args);
      const self = this;
      self.ftp = null;
    }


    isConnected() {
      const self = this;
      return self.ftp && self.ftp.connected;
    }

    connect(info, completed) {
      const self = this;

      self.info = info;

      self.ftp = new FTP();
      self.ftp
      .on('greeting', (msg) => {
        self.emit('greeting', msg);
      })
      .on('ready', () => {
        self.emit('connected');

        // disable keepalive manually when specified in .ftpconfig
        self.ftp._socket.setKeepAlive(self.info.keepalive > 0);

        tryApply(completed, self, []);
      })
      .on('end', () => {
        self.emit('ended');
      })
      .on('error', (err) => {
        const errCode = getObject({
          obj: err,
          keys: ['code'],
        });

        if (errCode === 421 || errCode === 'ECONNRESET') {
          self.emit('closed', 'RECONNECT');
          self.disconnect();
        }

        self.emit('error', err, errCode);
      });

      self.ftp.connect(self.info);

      self.ftp._parser.on('response', (code, text) => {
        if (code === 421) {
          self.emit('closed', 'RECONNECT');
          self.disconnect();
        }
        self.emit('response', code, text);
      });

      return self;
    }

    disconnect(completed) {
      const self = this;

      if (self.ftp) {
        self.ftp.destroy();
        self.ftp = null;
      }
      tryApply(completed, null, []);
      return self;
    }

    abort(completed) {
      const self = this;

      if (self.isConnected()) {
        self.ftp.abort(() => {
          tryApply(completed, null, []);
        });
      } else tryApply(completed, null, []);
      return self;
    }

    list(path, recursive, completed, isFile) {
      // NOTE: isFile is included as the list command from FTP does not throw an error
      // when you try to get the files in a file.

      // NOTE: // prepend '-al ' before path to show hidden files in ftp command
      // e.g. LIST -al /foobar/
      const self = this;
      const showHiddenFiles = atom.config.get('Remote-FTP.tree.showHiddenFiles');
      const nPath = Path.posix.resolve(path);

      if (self.isConnected()) {
        if (isFile === true) {
          completed.apply(null, [null, []]);
          return;
        }
        if (recursive) {
          const list = [];
          let digg = 0;

          const error = () => {
            tryApply(completed, null, [null, list]);
          };
          const l = function (np) {
            const p = Path.posix.resolve(np);
            ++digg;
            self.ftp.list((showHiddenFiles ? `-al ${p}` : p), (err, lis) => {
              if (err) return error();

              if (lis) {
                lis.forEach((item) => {
                  if (item.name === '.' || item.name === '..') return;
                // NOTE: if the same, then we synhronize file
                  if (p !== item.name) item.name = `${p}/${item.name}`;

                  if (item.type === 'd' || item.type === 'l') {
                    list.push(item);
                    l(item.name);
                  } else {
                    item.type = 'f';
                    list.push(item);
                  }
                });
              }
              if (--digg === 0) error();
            });
          };
          l(nPath);
        } else {
          self.ftp.list((showHiddenFiles ? `-al ${nPath}` : nPath), (err, lis) => {
            let list = [];

            if (lis && !err) {
              list = separateRemoteItems(lis);
            }

            tryApply(completed, null, [err, list]);
          });
        }
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

    mlsd(path, completed) {
      const nPath = Path.posix.resolve(path);

      if (this.isConnected()) {
        this.ftp.mlsd(nPath, (err, lis) => {
          let list = [];

          if (lis && !err) {
            list = separateRemoteItems(lis);
          }

          tryApply(completed, null, [err, list]);
        });
      } else {
        tryApply(completed, null, ['Not connected']);
      }
    }

    type(path, cb) {
      this.mlsd(path, (err) => {
        let rtn = 'd';

        if (err && err.code !== 550) {
          console.error(err);
          rtn = false;
        }

        if (err && err.code === 550) {
          rtn = 'f';
        }

        cb(rtn);
      });
    }

    get(path, recursive, completed, progress) {
      const self = this;
      const npath = Path.posix.resolve(path);
      const local = self.client.toLocal(npath);

      if (self.isConnected()) {
        self.list(npath, recursive, (lError, flist) => {
          self.type(npath, (type) => {
            if (type === 'f') {
              // NOTE: File
              FS.makeTreeSync(Path.dirname(local));
              let size = -1;
              let pool;
              self.once('150', (reply) => {
                const str = reply.match(/([0-9]+)\s*(bytes)/);
                if (str) {
                  size = parseInt(str[1], 10) || -1;
                  pool = setInterval(() => {
                    if (!self.ftp || !self.ftp._pasvSocket) return;
                    const read = self.ftp._pasvSocket.bytesRead;
                    tryApply(progress, null, [read / size]);
                  }, 250);
                }
              });

              self.ftp.get(npath, (error, stream) => {
                if (error) {
                  if (pool) clearInterval(pool);
                  tryApply(completed, null, [err]);
                  return;
                }

                const dest = FS.createWriteStream(local);
                dest.on('unpipe', () => {
                  if (pool) clearInterval(pool);
                  tryApply(completed, null, []);
                });
                dest.on('error', (cerror) => {
                  if (cerror.code === 'EISDIR') {
                    atom.notifications.addWarning('Already exists folder in localhost', {
                      detail: `Delete or rename folder before downloading file ${cerror.path}`,
                      dismissable: true,
                      buttons: [
                        {
                          text: 'Delete folder',
                          className: 'btn btn-error',
                          onDidClick() {
                            FS.removeSync(cerror.path);
                            self.get(npath);
                            this.removeNotification();
                          },
                        },
                        {
                          text: 'Cancel',
                          className: 'btn btn-float-right',
                          onDidClick() {
                            this.removeNotification();
                          },
                        },
                      ],
                    });
                  }
                  if (pool) clearInterval(pool);
                  tryApply(completed, null, [cerror]);
                });
                stream.pipe(dest);
              });
            } else {
              // NOTE: Folder
              self.list(npath, recursive, (lError, list) => {
                list.unshift({ name: npath, type: 'd' });
                list.forEach((item) => { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
                list.sort((a, b) => {
                  if (a.depth === b.depth) return 0;
                  return a.depth > b.depth ? 1 : -1;
                });
                let error = null;
                let i = -1;
                let size = 0;
                let read = 0;
                let pool;
                const total = list.length;
                const e = () => {
                  tryApply(completed, null, [error, list]);
                };
                const n = () => {
                  ++i;
                  if (pool) clearInterval(pool);
                  tryApply(progress, null, [i / total]);

                  const item = list.shift();
                  if (typeof item === 'undefined' || item === null) return e();
                  const nLocal = self.client.toLocal(item.name);
                  if (item.type === 'd' || item.type === 'l') {
                    try {
                      FS.makeTreeSync(nLocal);
                    } catch (cerror) {
                      window.cerror = cerror;
                      if (cerror.code === 'EEXIST') {
                        atom.notifications.addWarning('Already exists file in localhost', {
                          detail: `Delete or rename file before downloading folder ${cerror.path}`,
                          dismissable: true,
                          buttons: [
                            {
                              text: 'Delete file',
                              className: 'btn btn-error',
                              onDidClick() {
                                FS.removeSync(cerror.path);
                                FS.makeTreeSync(nLocal);
                                this.removeNotification();
                              },
                            },
                            {
                              text: 'Cancel',
                              className: 'btn btn-float-right',
                              onDidClick() {
                                this.removeNotification();
                              },
                            },
                          ],
                        });
                      }
                    }
                    n();
                  } else {
                    size = 0;
                    read = 0;
                    self.once('150', (reply) => {
                      const str = reply.match(/([0-9]+)\s*(bytes)/);
                      if (str) {
                        size = parseInt(str[1], 10) || -1;
                        pool = setInterval(() => {
                          if (!self.ftp || !self.ftp._pasvSocket) return;
                          read = self.ftp._pasvSocket.bytesRead;
                          tryApply(progress, null, [(i / total) + (read / size / total)]);
                        }, 250);
                      }
                    });
                    self.ftp.get(item.name, (getError, stream) => {
                      if (getError) {
                        error = getError;
                        return n();
                      }
                      const dest = FS.createWriteStream(nLocal);
                      dest.on('unpipe', () => n());
                      dest.on('error', err => n());
                      stream.pipe(dest);
                    });
                  }
                };
                n();
              });
            }
          });
        });
      } else tryApply(completed, null, ['Not connected']);
      return self;
    }

    put(path, completed, progress) {
      const self = this;
      const remote = self.client.toRemote(path);

      if (self.isConnected()) {
        if (FS.isFileSync(path)) {
          // NOTE: File
          const stats = FS.statSync(path);
          const size = stats.size;
          let written = 0;

          const e = (err) => {
            tryApply(completed, null, [err || null, [{ name: path, type: 'f' }]]);
          };
          const pool = setInterval(() => {
            if (!self.ftp || !self.ftp._pasvSocket) return;
            written = self.ftp._pasvSocket.bytesWritten;
            tryApply(progress, null, [written / size]);
          }, 250);

          self.ftp.put(path, remote, (err) => {
            let fatal = false;

            if (/Permission denied/.test(err)) {
              fatal = true;
            }

            if (err && !fatal) {
              self.mkdir(Path.dirname(remote).replace(/\\/g, '/'), true, (err) => {
                self.ftp.put(path, remote, (putError) => {
                  if (pool) clearInterval(pool);
                  return e(putError);
                });
              });
              return;
            }
            if (pool) clearInterval(pool);
            return e();
          });
        } else {
          // NOTE: Folder
          self.client.traverseTree(path, (list) => {
            self.mkdir(remote, true, (err) => {
              let error;
              let i = -1;
              let size = 0;
              let written = 0;

              const total = list.length;
              const pool = setInterval(() => {
                if (!self.ftp || !self.ftp._pasvSocket) return;
                written = self.ftp._pasvSocket.bytesWritten;
                tryApply(progress, null, [(i / total) + (written / size / total)]);
              }, 250);
              const e = function () {
                if (pool) clearInterval(pool);
                tryApply(completed, null, [error, list]);
              };
              const n = function () {
                if (++i >= list.length) return e();
                const item = list[i];
                const nRemote = self.client.toRemote(item.name);
                if (item.type === 'd' || item.type === 'l') {
                  self.ftp.mkdir(nRemote, (mkdirErr) => {
                    if (mkdirErr) error = mkdirErr;
                    return n();
                  });
                } else {
                  const stats = FS.statSync(item.name);
                  size = stats.size;
                  written = 0;
                  self.ftp.put(item.name, nRemote, (putErr) => {
                    if (putErr) error = putErr;
                    return n();
                  });
                }
              };
              return n();
            });
          });
        }
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

    mkdir(path, recursive, completed) {
      const self = this;
      const remotes = path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
      const dirs = [`/${remotes.slice(0, remotes.length).join('/')}`];
      const enableTransfer = atom.config.get('Remote-FTP.notifications.enableTransfer');
      const remotePath = self.client.info.remote.replace(/^\/+/, '').replace(/\/+$/, '').split('/');

      if (self.isConnected()) {
        if (recursive) {
          for (let a = remotes.length - 1; a > 0; --a) {
            // Observe the specified path
            const sRemote = `/${remotePath.slice(0, a).join('/')}`;
            const pRemote = `/${remotes.slice(0, a).join('/')}`;

            if (sRemote !== pRemote) {
              dirs.unshift(`/${remotes.slice(0, a).join('/')}`);
            }
          }
        }

        const n = () => {
          const dir = dirs.shift();
          const last = dirs.length === 0;

          self.ftp.list(dir, false, (errList, list) => {
            if (typeof list !== 'undefined') {
              const dirName = path.split('/').pop();
              const folders = list.filter(o => o.type === 'd' || o.type === 'l');

              if (typeof list !== 'undefined' && folders.map(o => o.name).indexOf(dirName) > -1) {
                if (enableTransfer) {
                  atom.notifications.addWarning('The folder already exists.', {
                    detail: `${dir} has already on the server!`,
                  });
                }

                if (last) {
                  tryApply(completed, null, [errList || null]);
                  return;
                }

                n();
                return;
              }
            }

            self.ftp.mkdir(dir, (err) => {
              if (last) {
                tryApply(completed, null, [err || null]);
              } else {
                return n();
              }

              return false;
            });
          });
        };

        n();
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

    mkfile(path, completed) {
      const self = this;
      const local = self.client.toLocal(path);
      const empty = new Buffer('', 'utf8');
      const enableTransfer = atom.config.get('Remote-FTP.notifications.enableTransfer');

      if (self.isConnected()) {
        self.ftp.list(path, false, (listErr, list) => {
          if (typeof list !== 'undefined') {
            const files = list.filter(o => o.type === '-');

            // File exists
            if (files.length !== 0) {
              if (enableTransfer) {
                atom.notifications.addWarning('The file already exists.', {
                  detail: `${path} has already on the server!`,
                });
              }
              tryApply(completed, null, [listErr]);
              return;
            }
          }

          self.ftp.put(empty, path, (putErr) => {
            if (putErr) {
              tryApply(completed, null, [putErr]);
              return;
            }

            FS.makeTreeSync(Path.dirname(local));
            FS.writeFile(local, empty, (err2) => {
              tryApply(completed, null, [err2]);
            });
          });
        });
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

    rename(source, dest, completed) {
      const self = this;

      if (self.isConnected()) {
        self.ftp.rename(source, dest, (err) => {
          if (err) {
            tryApply(completed, null, [err]);
          } else {
            FS.rename(self.client.toLocal(source), self.client.toLocal(dest), (err) => {
              tryApply(completed, null, [err]);
            });
          }
        });
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

    delete(path, completed) {
      const self = this;

      if (self.isConnected()) {
        self.ftp.cwd(path, (err) => {
          self.ftp.cwd('/', () => {
            if (err) {
              // NOTE: File
              self.ftp.delete(path, (err) => {
                tryApply(completed, null, [err, [{ name: path, type: 'f' }]]);
              });
            } else {
              // NOTE: Folder
              self.list(path, true, (err, list) => {
                list.forEach((item) => { item.depth = item.name.replace(/^\/+/, '').replace(/\/+$/).split('/').length; });
                list.sort((a, b) => {
                  if (a.depth == b.depth) return 0;
                  return a.depth > b.depth ? -1 : 1;
                });

                let done = 0;

                const e = function () {
                  self.ftp.rmdir(path, (err) => {
                    tryApply(completed, null, [err, list]);
                  });
                };
                list.forEach((item) => {
                  ++done;
                  const fn = item.type === 'd' || item.type === 'l' ? 'rmdir' : 'delete';
                  self.ftp[fn](item.name, (err) => {
                    if (--done === 0) return e();
                  });
                });
                if (list.length === 0) e();
              });
            }
          });
        });
      } else tryApply(completed, null, ['Not connected']);

      return self;
    }

}

  return ConnectorFTP;
}());
