'use babel';

import FS from 'fs-plus';
import { $ } from 'atom-space-pen-views';
import Path from 'path';
import { EventEmitter } from 'events';
import stripJsonComments from 'strip-json-comments';
import { LintStream } from 'jslint';
import chokidar from 'chokidar';
import { multipleHostsEnabled, getObject } from './helpers';
import Directory from './directory';
import Progress from './progress';
import FTP from './connectors/ftp';
import SFTP from './connectors/sftp';
import PromptPassDialog from './dialogs/prompt-pass-dialog';

const atom = global.atom;

export default (function INIT() {
  class Client extends EventEmitter {
    constructor() {
      super();
      const self = this;
      self.info = null;
      self.connector = null;
      self._current = null;
      self._queue = [];

      self.root = new Directory({
        name: '/',
        path: '/',
        client: this,
        isExpanded: true,
      });

      self.status = 'NOT_CONNECTED'; // Options NOT_CONNECTED, CONNECTING, CONNECTED

      self.watch = {
        watcher: null,
        files: [],
        addListeners() {
          let watchData = getObject({
            keys: ['info', 'watch'],
            obj: self
          });
          if (watchData === null || watchData === false) return;
          if (typeof watchData === 'string') watchData = [watchData];

          if (!Array.isArray(watchData) || watchData.length === 0) return;

          const dir = self.getProjectPath();

          const watchDataFormatted = watchData.map(watch => Path.resolve(dir, watch));

          const watcher = chokidar.watch(watchDataFormatted, {
            ignored: /[\/\\]\./,
            persistent: true,
          });

          watcher
          .on('change', (path) => {
            self.watch.queueUpload.apply(self, [path]);
          });

          self.files = watchDataFormatted.slice();

          atom.notifications.addInfo('Remote FTP: Added watch listeners');
          self.watcher = watcher;
        },
        removeListeners() {
          if (self.watcher != null) {
            self.watcher.close();
            atom.notifications.addInfo('Remote FTP: Stopped watch listeners');
          }
        },
        queue: {},
        queueUpload(fileName) {
          const timeoutDuration = isNaN(parseInt(self.info.watchTimeout, 10)) === true
            ? 500
            : parseInt(self.info.watchTimeout, 10);


          function scheduleUpload(file) {
            self.watch.queue[file] = setTimeout(() => {
              self.upload(file, () => {});
            }, timeoutDuration);
          }

          if (self.watch.queue[fileName] !== null) {
            clearTimeout(self.watch.queue[fileName]);
            self.watch.queue[fileName] = null;
          }

          scheduleUpload(fileName);
        },

      };

      self.watch.addListeners = self.watch.addListeners.bind(self);
      self.watch.removeListeners = self.watch.removeListeners.bind(self);

      self.on('connected', self.watch.addListeners);
      self.on('disconnected', self.watch.removeListeners);
    }

    readConfig(callback) {
      const self = this;
      const error = (err) => {
        if (typeof callback === 'function') callback.apply(self, [err]);
      };
      self.info = null;
      self.ftpConfigPath = self.getConfigPath();

      FS.readFile(self.ftpConfigPath, 'utf8', (err, res) => {
        if (err) return error(err);

        const data = stripJsonComments(res);
        let json = null;
        if (self.validateConfig(data)) {
          try {
            json = JSON.parse(data);

            self.info = json;
            self.root.name = '';
            self.root.path = `/${self.info.remote.replace(/^\/+/, '')}`;
          } catch (e) {
            atom.notifications.addError('Could not process `.ftpconfig`', {
              detail: e,
            });
          }
        }
        if (json !== null && typeof callback === 'function') {
          callback.apply(self, [err, json]);
        }
      });
    }

    getFilePath(relativePath) {
      const self = this;
      const projectPath = self.getProjectPath();
      if (projectPath === false) return false;
      return Path.resolve(projectPath, relativePath);
    }

    getProjectPath() {
      const self = this;
      let projectPath;

      if (multipleHostsEnabled() === true) {
        const $selectedDir = $('.tree-view .selected');
        const $currentProject = $selectedDir.hasClass('project-root') ? $selectedDir : $selectedDir.closest('.project-root');
        projectPath = $currentProject.find('.header span.name').data('path');
      } else {
        projectPath = atom.project.getDirectories()[0].path;
      }

      if (projectPath != null) {
        self.projectPath = projectPath;
        return projectPath;
      }
      atom.notifications.addError('Remote FTP: Could not get project path');
      return false;
    }

    getConfigPath() {
      const self = this;
      return self.getFilePath('./.ftpconfig');
    }

    validateConfig(data) {
      let valid = true;

      const lintStream = new LintStream({
        edition: 'latest',
        white: true,
      });
      lintStream.write({
        file: '.ftpconfig',
        body: data,
      });
      lintStream.on('data', (chunk) => {
        let error = chunk.linted.errors.slice(0, 1);
        if (error.length) {
          error = error[0];
          atom.notifications.addError('Could not parse `.ftpconfig`', {
            detail: `${error.message}\n${chunk.linted.lines[error.line]}`,
          });

          atom.workspace.open('.ftpconfig').then((editor) => {
            const decorationConfig = {
              class: 'ftpconfig_line_error',
            };
            editor.getDecorations(decorationConfig).forEach((decoration) => {
              decoration.destroy();
            });

            const range = editor.getBuffer().clipRange([[error.line, 0], [error.line, Infinity]]);
            const marker = editor.markBufferRange(range, {
              invalidate: 'inside',
            });

            decorationConfig.type = 'line';
            editor.decorateMarker(marker, decorationConfig);
          });

          valid = false;
        }
      });

      return valid;
    }

    isConnected() {
      const self = this;
      return self.connector && self.connector.isConnected();
    }

    onceConnected(onconnect) {
      const self = this;
      if (self.connector && self.connector.isConnected()) {
        onconnect.apply(self);
        return true;
      } else if (typeof onconnect === 'function') {
        if (self.status === 'NOT_CONNECTED') {
          self.status = 'CONNECTING';
          self.readConfig((err) => {
            if (err !== null) {
              self.status = 'NOT_CONNECTED';
              // NOTE: Remove notification as it will just say there
              // is no ftpconfig if none in directory all the time
              // atom.notifications.addError("Remote FTP: " + err);
              return;
            }
            self.connect(true);
          });
        }

        self.once('connected', onconnect);
        return false;
      }
      console.warn(`Remote-FTP: Not connected and typeof onconnect is ${typeof onconnect}`);
      return false;
    }

    connect(reconnect) {
      const self = this;
      if (reconnect !== true) self.disconnect();
      if (self.isConnected()) return;
      if (!self.info) return;
      if (self.info.promptForPass === true) self.promptForPass();
      else self.doConnect();
    }

    doConnect() {
      const self = this;

      atom.notifications.addInfo('Remote FTP: Connecting...');

      let info;
      switch (self.info.protocol) {
        case 'ftp': {
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
            debug(str) {
              const log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
              if (!log) return;
              if (log[2].match(/^PASS /)) log[2] = 'PASS ******';
              self.emit('debug', `${log[1]} ${log[2]}`);
              console.debug(`${log[1]} ${log[2]}`);
            },
          };
          self.connector = new FTP(self);
          break;
        }

        case 'sftp': {
          let pk;
          try {
            pk = FS.readFileSync(self.info.privatekey);
          } catch (e) {
            pk = false;
          }
          info = {
            host: self.info.host || '',
            port: self.info.port || 21,
            username: self.info.user || '',
            readyTimeout: self.info.connTimeout || 10000,
            pingInterval: self.info.keepalive || 10000,
          };

          if (self.info.pass) info.password = self.info.pass;

          if (self.info.privatekey && pk) info.privateKey = pk;

          if (self.info.passphrase) info.passphrase = self.info.passphrase;

          if (self.info.agent) info.agent = self.info.agent;

          if (self.info.agent === 'env') info.agent = process.env.SSH_AUTH_SOCK;

          if (self.info.hosthash) info.hostHash = self.info.hosthash;

          if (self.info.ignorehost) {
            // NOTE: hostVerifier doesn't run at all if it's not a function.
            // Allows you to skip hostHash option in ssh2 0.5+
            info.hostVerifier = false;
          }

          if (self.info.keyboardInteractive) info.tryKeyboard = true;

          self.connector = new SFTP(self);
          break;
        }

        default:
          throw new Error('No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> Remote-FTP -> Create (S)FTP config file.');
      }

      self.connector.connect(info, () => {
        if (self.root.status !== 1) self.root.open();
        self.emit('connected');
        self.status = 'CONNECTED';

        atom.notifications.addSuccess('Remote FTP: Connected');
      });

      self.connector.on('closed', () => {
        self.disconnect();
        self.status = 'NOT_CONNECTED';
        self.emit('closed');

        atom.notifications.addInfo('Remote FTP: Connection closed');
      });
      self.connector.on('ended', () => {
        self.emit('ended');
      });
      self.connector.on('error', (err) => {
        atom.notifications.addError(`Remote FTP: ${err}`);
      });
    }

    disconnect() {
      const self = this;

      if (self.connector) {
        self.connector.disconnect();
        delete self.connector;
        self.connector = null;
      }

      if (self.root) {
        self.root.status = 0;
        self.root.destroy();
      }

      self.watch.removeListeners.apply(self);

      self._current = null;
      self._queue = [];

      self.emit('disconnected');
      self.status = 'NOT_CONNECTED';


      return self;
    }

    toRemote(local) {
      const self = this;

      return Path.join(
        self.info.remote,
        atom.project.relativize(local)
      ).replace(/\\/g, '/');
    }

    toLocal(remote) {
      const self = this;
      if (multipleHostsEnabled() === true) { // if multiple hosts is checked
        return `${self.projectPath}\\${remote.substr(self.info.remote.length).replace(/^\/+/, '')}`;
      }

      return atom.project.getDirectories()[0].resolve(`./${remote.substr(self.info.remote.length).replace(/^\/+/, '')}`);
    }

    _next() {
      const self = this;

      if (!self.isConnected()) return;

      self._current = self._queue.shift();

      if (self._current) self._current[1].apply(self, [self._current[2]]);

      atom.project.remoteftp.emit('queue-changed');
    }

    _enqueue(func, desc) {
      const self = this;
      const progress = new Progress();

      self._queue.push([desc, func, progress]);
      if (self._queue.length == 1 && !self._current) self._next();

      else self.emit('queue-changed');

      return progress;
    }

    abort() {
      const self = this;

      if (self.isConnected()) {
        self.connector.abort(() => {
          self._next();
        });
      }

      return self;
    }

    abortAll() {
      const self = this;

      self._current = null;
      self._queue = [];

      if (self.isConnected()) {
        self.connector.abort();
      }

      self.emit('queue-changed');

      return self;
    }

    list(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.list(remote, recursive, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          });
        }, `Listing ${recursive ? 'recursively ' : ''}${Path.basename(remote)}`);
      });

      return self;
    }

    download(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue((progress) => {
          self.connector.get(remote, recursive, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          }, (percent) => {
            progress.setProgress(percent);
          });
        }, `Downloading ${Path.basename(remote)}`);
      });

      return self;
    }

    upload(local, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue((progress) => {
          self.connector.put(local, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          }, (percent) => {
            progress.setProgress(percent);
          });
        }, `Uploading ${Path.basename(local)}`);
      });

      return self;
    }

    _traverseTree(path, callback) {
      const list = [];
      let digg = 0;

      const error = function () {
        list.forEach((item) => {
          item.depth = item.name.split('/').length;
        });
        list.sort((a, b) => {
          if (a.depth == b.depth) return 0;

          return a.depth > b.depth ? 1 : -1;
        });

        if (typeof callback === 'function') callback.apply(null, [list]);
      };

      const l = function (p) {
        ++digg;
        FS.readdir(p, (err, lis) => {
          if (err) return error();

          lis.forEach((name) => {
            if (name === '.' || name === '..') return;

            name = Path.join(p, name);
            const stats = FS.statSync(name);
            list.push({
              name,
              size: stats.size,
              date: stats.mtime,
              type: stats.isFile() ? 'f' : 'd',
            });

            if (!stats.isFile()) l(name);
          });
          if (--digg === 0) return error();
        });
      };
      l(path);
    }

    syncRemoteLocal(remote, callback) {
      const self = this;

      if (!remote) return;

      self.onceConnected(() => {
        self._enqueue(() => {
          const local = self.toLocal(remote);

          self.connector.list(remote, true, (err, remotes) => {
            if (err) {
              if (typeof callback === 'function') callback.apply(null, [err]);

              return;
            }

            self._traverseTree(local, (locals) => {
              const error = function () {
                if (typeof callback === 'function') callback.apply(null);
                self._next();
                return;
              };
              const n = function () {
                const remote = remotes.shift();
                let toLocal;
                let local;

                if (!remote) return error();


                if (remote.type === 'd') return n();

                toLocal = self.toLocal(remote.name);
                local = null;

                for (let a = 0, b = locals.length; a < b; ++a) {
                  if (locals[a].name === toLocal) {
                    local = locals[a];
                    break;
                  }
                }

                // Download only if not present on local or size differ
                if (!local || remote.size !== local.size) {
                  self.connector.get(remote.name, false, () => n());
                } else {
                  n();
                }
              };
              n();
            });
          });
        }, `Sync local ${Path.basename(remote)}`);
      });
      return self;
    }

    syncLocalRemote(local,callback) {
      const self = this;

      self.onceConnected(() => {
        self._enqueue((progress) => {
          const remote = self.toRemote(local);

          self.connector.list(remote, true, (err, remotes) => {
            if (err) {
              if (typeof callback === 'function') callback.apply(null, [err]);
              return;
            }

            self._traverseTree(local, (locals) => {
              const error = function () {
                if (typeof callback === 'function') callback.apply(null);
                self._next();
                return;
              };
              const n = function () {
                const local = locals.shift();
                let remote;

                if (!local) return error();

                if (local.type === 'd') return n();

                const toRemote = self.toRemote(local.name);
                remote = null;

                for (let a = 0, b = remotes.length; a < b; ++a) {
                  if (remotes[a].name === toRemote) {
                    remote = remotes[a];
                    break;
                  }
                }

                // NOTE: Upload only if not present on remote or size differ
                if (!remote || remote.size !== local.size) {
                  self.connector.put(local.name, () => n());
                } else {
                  n();
                }
              };
              n();
            });
          });
        }, `Sync remote ${Path.basename(local)}`);
      });

      return self;
    }

    mkdir(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.mkdir(remote, recursive, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          });
        }, `Creating folder ${Path.basename(remote)}`);
      });

      return self;
    }

    mkfile(remote, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.mkfile(remote, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          });
        }, `Creating file ${Path.basename(remote)}`);
      });

      return self;
    }

    rename(source, dest, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.rename(source, dest, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          });
        }, `Renaming ${Path.basename(source)}`);
      });
      return self;
    }

    delete(remote, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.delete(remote, function () {
            if (typeof callback === 'function') callback.apply(null, arguments);
            self._next();
          });
        }, `Deleting ${Path.basename(remote)}`);
      });

      return self;
    }

    promptForPass() {
      const self = this;
      const dialog = new PromptPassDialog('', true);
      dialog.on('dialog-done', (e, pass) => {
        self.info.pass = pass;
        self.info.passphrase = pass;
        dialog.close();
        self.doConnect();
      });
      dialog.attach();
    }
  }


  return Client;
}());
