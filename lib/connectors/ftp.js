'use babel';

import FS from 'fs-plus';
import Path from 'path';
import FTP from '@icetee/ftp';
import Connector from '../connector';
import { isEEXIST, isEISDIR, isAlreadyExits, isPermissionDenied } from '../notifications';
import { getObject, separateRemoteItems, splitPaths, simpleSortDepth, sortDepth, traverseTree } from '../helpers';

function tryApply(callback, context, args) {
  if (typeof callback === 'function') {
    callback.apply(context, args);
  }
}

class ConnectorFTP extends Connector {
  constructor(...args) {
    super(...args);

    this.ftp = null;
    this.client = atom.project.remoteftp;
  }

  isConnected() {
    return this.ftp && this.ftp.connected;
  }

  _isConnectedApply(completed) {
    if (!this.isConnected()) {
      tryApply(completed, null, ['Not connected']);
      return false;
    }
    return true;
  }

  connect(info, completed) {
    this.info = info;

    this.ftp = new FTP();
    this.ftp
      .on('greeting', (msg) => {
        this.emit('greeting', msg);
      })
      .on('ready', () => {
        this.checkFeatures(() => {
          this.emit('connected');

          // disable keepalive manually when specified in .ftpconfig
          this.ftp._socket.setKeepAlive(this.info.keepalive > 0);

          tryApply(completed, this, []);
        });
      })
      .on('end', () => {
        this.emit('ended');
      })
      .on('error', (err) => {
        const errCode = getObject({
          obj: err,
          keys: ['code'],
        });

        if (errCode === 421 || errCode === 'ECONNRESET') {
          this.emit('closed', 'RECONNECT');
          return;
        }

        this.emit('error', err, errCode);
      });

    this.ftp.connect(this.info);

    this.ftp._parser.on('response', (code, text) => {
      this.emit('response', code, text);
    });

    return this;
  }

  disconnect(completed) {
    if (this.ftp) {
      this.ftp.destroy();
      this.ftp = null;
    }

    tryApply(completed, null, []);

    return this;
  }

  abort(completed) {
    if (!this._isConnectedApply(completed)) return false;

    this.ftp.abort(() => {
      tryApply(completed, null, []);
    });

    return this;
  }

  checkFeatures(cb) {
    this.ftp._send('EPSV', (errEPSV) => {
      if (errEPSV) {
        if (errEPSV.code >= 500 || /Operation not permitted/.test(errEPSV.message)) {
          this.ftp._epsvFeat = false;
          this.ftp._eprtFeat = false;
          this.ftp.options.forcePasv = true;
        }
      }
      cb();
    });
  }

  list(path, recursive, completed, isFile) {
    if (!this._isConnectedApply(completed)) return false;

    // NOTE: isFile is included as the list command from FTP does not throw an error
    // when you try to get the files in a file.

    const showHiddenFiles = atom.config.get('Remote-FTP.tree.showHiddenFiles');
    const nPath = Path.posix.resolve(path);

    if (isFile === true) {
      completed.apply(null, [null, []]);
      return true;
    }
    if (recursive) {
      const list = [];
      let digg = 0;

      const error = () => { tryApply(completed, null, [null, list]); };

      const l = (np) => {
        const p = Path.posix.resolve(np);
        ++digg;
        this.ftp.list((showHiddenFiles ? `-al ${p}` : p), (err, lis) => {
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

          return true;
        });
      };
      l(nPath);
    } else {
      this.ftp.list((showHiddenFiles ? `-al ${nPath}` : nPath), (err, lis) => {
        let list = [];

        if (lis && !err) {
          list = separateRemoteItems(lis);
        }

        tryApply(completed, null, [err, list]);
      });
    }

    return this;
  }

  mlsd(path, completed) {
    if (!this._isConnectedApply(completed)) return;

    const nPath = Path.posix.resolve(path);

    this.ftp.mlsd(nPath, (err, lis) => {
      let list = [];

      if (lis && !err) {
        list = separateRemoteItems(lis);
      }

      tryApply(completed, null, [err, list]);
    });
  }

  type(path, cb) {
    this.ftp.cwd(path, (res) => {
      let rtn = 'd';

      if (res && res.code !== 250) {
        rtn = 'f';
      }

      this.ftp.cwd('/', () => {
        cb(rtn);
      });
    });
  }

  _getFile(path, completed, progress) {
    const npath = Path.posix.resolve(path);
    const local = this.client.toLocal(npath);

    FS.makeTreeSync(Path.dirname(local));

    let size = -1;
    let pool;

    this.once('150', (reply) => {
      const str = reply.match(/([0-9]+)\s*(bytes)/);
      if (str) {
        size = parseInt(str[1], 10) || -1;
        pool = setInterval(() => {
          if (!this.ftp || !this.ftp._pasvSocket) return;
          const read = this.ftp._pasvSocket.bytesRead;
          tryApply(progress, null, [read / size]);
        }, 250);
      }
    });

    this.client.checkIgnore(npath);
    if (this.client.ignoreFilter) {
      if (this.client.ignoreFilter.ignores(npath)) {
        tryApply(completed, null, [null]);
        return;
      }
    }

    this.ftp.get(npath, (error, stream) => {
      if (error) {
        if (pool) clearInterval(pool);
        tryApply(completed, null, [error]);
        return;
      }

      const dest = FS.createWriteStream(local);

      dest.on('unpipe', () => {
        if (pool) clearInterval(pool);

        tryApply(completed, null, []);
      });

      dest.on('error', (cerror) => {
        if (cerror.code === 'EISDIR') {
          isEISDIR(cerror.path, (model) => {
            FS.removeSync(cerror.path);
            this.get(npath);

            model.removeNotification();
          });
        }

        if (pool) clearInterval(pool);

        tryApply(completed, null, [cerror]);
      });

      stream.pipe(dest);
    });
  }

  _getFolder(path, recursive, completed, progress) {
    const npath = Path.posix.resolve(path);

    this.list(npath, recursive, (lError, list) => {
      this.client.checkIgnore(npath);

      list.unshift({ name: npath, type: 'd' });
      list.forEach((item, index, object) => {
        if (this.client.ignoreFilter) {
          if (this.client.ignoreFilter.ignores(item.name)) {
            object.splice(index, 1);
          }
        }
        item.depth = splitPaths(item.name).length;
      });
      list.sort(sortDepth);

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

        const nLocal = this.client.toLocal(item.name);

        if (item.type === 'd' || item.type === 'l') {
          try {
            FS.makeTreeSync(nLocal);
          } catch (cerror) {
            if (cerror.code === 'EEXIST') {
              isEEXIST(cerror.path, (model) => {
                FS.removeSync(cerror.path);
                this.get(npath);
                // FS.makeTreeSync(nLocal);

                model.removeNotification();
              });
            }
          }

          n();
        } else {
          size = 0;
          read = 0;

          this.once('150', (reply) => {
            const str = reply.match(/([0-9]+)\s*(bytes)/);
            if (str) {
              size = parseInt(str[1], 10) || -1;
              pool = setInterval(() => {
                if (!this.ftp || !this.ftp._pasvSocket) return;
                read = this.ftp._pasvSocket.bytesRead;
                tryApply(progress, null, [(i / total) + (read / size / total)]);
              }, 250);
            }
          });

          this.ftp.get(item.name, (getError, stream) => {
            if (getError) {
              error = getError;

              if (/Permission denied/.test(error)) {
                isPermissionDenied(item.name);
              }

              return n();
            }

            const dest = FS.createWriteStream(nLocal);

            dest.on('unpipe', () => n());
            dest.on('error', () => n());

            stream.pipe(dest);

            return true;
          });
        }
        return true;
      };
      n();
    });
  }

  get(path, recursive, completed, progress) {
    if (!this._isConnectedApply(completed)) return;

    const npath = Path.posix.resolve(path);

    this.type(npath, (type) => {
      if (type === 'f') {
        this._getFile(npath, completed, progress);
      } else {
        this._getFolder(npath, recursive, completed, progress);
      }
    });
  }

  put(path, completed, progress) {
    if (!this._isConnectedApply(completed)) return false;

    const remote = this.client.toRemote(path);

    if (FS.isFileSync(path)) {
      // NOTE: File
      const stats = FS.statSync(path);
      const size = stats.size;
      let written = 0;

      const e = (err) => {
        tryApply(completed, null, [err || null, [{ name: path, type: 'f' }]]);
      };
      const pool = setInterval(() => {
        if (!this.ftp || !this.ftp._pasvSocket) return;
        written = this.ftp._pasvSocket.bytesWritten;
        tryApply(progress, null, [written / size]);
      }, 250);

      this.ftp.put(path, remote, (err) => {
        let fatal = false;

        if (/Permission denied/.test(err)) {
          isPermissionDenied(path);
          fatal = true;
          return e(err);
        }

        if (err && !fatal) {
          this.mkdir(Path.dirname(remote)
            .replace(/\\/g, '/'), true, () => {
              this.ftp.put(path, remote, (putError) => {
                if (pool) clearInterval(pool);
                return e(putError);
              });
            });
        }
        if (pool) clearInterval(pool);
        return e();
      });
    } else {
      // NOTE: Folder
      traverseTree(path, (list) => {
        this.mkdir(remote, true, () => {
          let error;
          let i = -1;
          let size = 0;
          let written = 0;

          const total = list.length;
          const pool = setInterval(() => {
            if (!this.ftp || !this.ftp._pasvSocket) return;
            written = this.ftp._pasvSocket.bytesWritten;
            tryApply(progress, null, [(i / total) + (written / size / total)]);
          }, 250);
          const e = () => {
            if (pool) clearInterval(pool);
            tryApply(completed, null, [error, list]);
          };
          const n = () => {
            if (++i >= list.length) return e();
            const item = list[i];
            const nRemote = this.client.toRemote(item.name);
            if (item.type === 'd' || item.type === 'l') {
              this.ftp.mkdir(nRemote, (mkdirErr) => {
                if (mkdirErr) error = mkdirErr;
                return n();
              });
            } else {
              const stats = FS.statSync(item.name);
              size = stats.size;
              written = 0;
              this.ftp.put(item.name, nRemote, (putErr) => {
                if (putErr) error = putErr;
                return n();
              });
            }
            return true;
          };
          return n();
        });
      });
    }

    return this;
  }

  mkdir(path, recursive, completed) {
    if (!this._isConnectedApply(completed)) return false;

    const remotes = splitPaths(path);
    const dirs = [`/${remotes.slice(0, remotes.length).join('/')}`];
    const remotePath = splitPaths(this.client.info.remote);

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

      this.ftp.list(dir, false, (errList, list) => {
        if (typeof list !== 'undefined') {
          const dirName = path.split('/').pop();
          const folders = list.filter(o => o.type === 'd' || o.type === 'l');
          const dirNames = folders.map(o => o.name);

          if (typeof list !== 'undefined' && dirNames.indexOf(dirName) > -1) {
            if (last) {
              tryApply(completed, null, [errList || null]);
              return;
            }

            n();
            return;
          }
        }

        this.ftp.mkdir(dir, (err) => {
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

    return this;
  }

  mkfile(path, completed) {
    if (!this._isConnectedApply(completed)) return false;

    const local = this.client.toLocal(path);
    const empty = new Buffer('', 'utf8');
    const enableTransfer = atom.config.get('Remote-FTP.notifications.enableTransfer');

    this.ftp.list(path, false, (listErr, list) => {
      if (typeof list !== 'undefined') {
        const files = list.filter(o => o.type === '-');

        // File exists
        if (files.length !== 0) {
          if (enableTransfer) isAlreadyExits(path, 'file');

          tryApply(completed, null, [listErr]);
          return;
        }
      }

      this.ftp.put(empty, path, (putErr) => {
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

    return this;
  }

  rename(source, dest, completed) {
    if (!this._isConnectedApply(completed)) return false;

    this.ftp.rename(source, dest, (err) => {
      if (err) {
        tryApply(completed, null, [err]);
      } else {
        FS.rename(this.client.toLocal(source), this.client.toLocal(dest), (rErr) => {
          tryApply(completed, null, [rErr]);
        });
      }
    });

    return this;
  }

  site(command, completed) {
    if (!this._isConnectedApply(completed)) return false;

    this.ftp.site(command, (err) => {
      if (err) {
        tryApply(completed, null, [err]);
      }
    });

    return this;
  }

  chmod(path, mode, completed = () => {}) {
    if (!this._isConnectedApply(completed)) return false;

    if (this.isConnected()) {
      this.ftp.site(`CHMOD ${mode} ${path}`, completed);
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return this;
  }

  chown(path, owner, completed = () => {}) {
    if (!this._isConnectedApply(completed)) return false;

    if (this.isConnected()) {
      this.ftp.site(`CHOWN ${owner} ${path}`, completed);
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return this;
  }

  chgrp(path, group, completed = () => {}) {
    if (!this._isConnectedApply(completed)) return false;

    if (this.isConnected()) {
      this.ftp.site(`CHGRP ${group} ${path}`, completed);
    } else if (typeof completed === 'function') {
      completed(...['Not connected']);
    }

    return this;
  }

  delete(path, completed) {
    if (!this._isConnectedApply(completed)) return false;

    this.type(path, (type) => {
      if (type === 'f') {
        // NOTE: File
        this.ftp.delete(path, (err) => {
          tryApply(completed, null, [err, [{ name: path, type: 'f' }]]);
        });
      } else {
        // NOTE: Folder
        this.list(path, true, (err, list) => {
          list.forEach((item) => {
            item.depth = splitPaths(item.name).length;
          });
          list.sort(simpleSortDepth);

          let done = 0;

          const e = () => {
            this.ftp.rmdir(path, (eErr) => {
              tryApply(completed, null, [eErr, list]);
            });
          };
          list.forEach((item) => {
            ++done;
            const fn = item.type === 'd' || item.type === 'l' ? 'rmdir' : 'delete';
            this.ftp[fn](item.name, () => {
              if (--done === 0) return e();
              return true;
            });
          });
          if (list.length === 0) e();
        });
      }
    });

    return this;
  }

}

export default ConnectorFTP;
