'use babel';

import FS from 'fs-plus';
import { $ } from 'atom-space-pen-views';
import Path from 'path';
import { EventEmitter } from 'events';
import stripJsonComments from 'strip-json-comments';
import chokidar from 'chokidar';
import { multipleHostsEnabled, getObject } from './helpers';
import Directory from './directory';
import Progress from './progress';
import FTP from './connectors/ftp';
import SFTP from './connectors/sftp';
import PromptPassDialog from './dialogs/prompt-pass-dialog';
import Ignore from 'ignore';

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
            obj: self,
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

          atom.notifications.addInfo('Remote FTP: Added watch listeners', {
            dismissable: false,
          });
          self.watcher = watcher;
        },
        removeListeners() {
          if (self.watcher != null) {
            self.watcher.close();
            atom.notifications.addInfo('Remote FTP: Stopped watch listeners', {
              dismissable: false,
            });
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

      if (self.ftpConfigPath === false) throw new Error('Remote FTP: getConfigPath returned false, but expected a string');

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
              dismissable: false,
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
      let projectPath = null;

      if (multipleHostsEnabled() === true) {
        const $selectedDir = $('.tree-view .selected');
        const $currentProject = $selectedDir.hasClass('project-root') ? $selectedDir : $selectedDir.closest('.project-root');
        projectPath = $currentProject.find('.header span.name').data('path');
      } else {
        const firstDirectory = atom.project.getDirectories()[0];
        if (firstDirectory != null) projectPath = firstDirectory.path;
      }

      if (projectPath != null) {
        self.projectPath = projectPath;
        return projectPath;
      }
      atom.notifications.addError('Remote FTP: Could not get project path', {
        dismissable: false, // Want user to report error so don't let them close it
        detail: `Please report this error if it occurs. Multiple Hosts is ${multipleHostsEnabled()}`,
      });
      return false;
    }

    getConfigPath() {
      const self = this;
      return self.getFilePath('./.ftpconfig');
    }

    validateConfig(data) {
      try {
        // try to parse the json
        JSON.parse(data);
        return true;
      } catch (error) {
        // try to extract bad syntax location from error message
        let lineNumber = -1;
        const regex = /at position ([0-9]+)$/;
        const result = error.message.match(regex);
        if (result && result.length > 0) {
          const cursorPos = parseInt(result[1]);
          // count lines until syntax error position
          const tmp = data.substr(0, cursorPos);
          for (lineNumber = -1, index = 0; index != -1; lineNumber++, index = tmp.indexOf('\n', index + 1));
        }

        // show notification
        atom.notifications.addError('Could not parse `.ftpconfig`', {
          detail: `${error.message}`,
          dismissable: false,
        });

        // open .ftpconfig file and mark the faulty line
        atom.workspace.open('.ftpconfig').then((editor) => {
          if (lineNumber == -1) return; // no line number to mark

          const decorationConfig = {
            class: 'ftpconfig_line_error',
          };
          editor.getDecorations(decorationConfig).forEach((decoration) => {
            decoration.destroy();
          });

          const range = editor.getBuffer().clipRange([[lineNumber, 0], [lineNumber, Infinity]]);
          const marker = editor.markBufferRange(range, {
            invalidate: 'inside',
          });

          decorationConfig.type = 'line';
          editor.decorateMarker(marker, decorationConfig);
        });
      }

      // return false, as the json is not valid
      return false;
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

      atom.notifications.addInfo('Remote FTP: Connecting...', {
        dismissable: false,
      });

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
          info = {
            host: self.info.host || '',
            port: self.info.port || 21,
            username: self.info.user || '',
            readyTimeout: self.info.connTimeout || 10000,
            keepaliveInterval: self.info.keepalive || 10000,
          };

          if (self.info.pass) info.password = self.info.pass;

          if (self.info.privatekey) {
            try {
              const pk = FS.readFileSync(self.info.privatekey);
              info.privateKey = pk;
            } catch (err) {
              atom.notifications.addError('Remote FTP: Could not read privateKey file', {
                detail: err,
                dismissable: true,
              });
            }
          }

          if (self.info.passphrase) info.passphrase = self.info.passphrase;

          if (self.info.agent) info.agent = self.info.agent;

          if (self.info.agent === 'env') info.agent = process.env.SSH_AUTH_SOCK;

          if (self.info.hosthash) info.hostHash = self.info.hosthash;

          if (self.info.ignorehost) {
            // NOTE: hostVerifier doesn't run at all if it's not a function.
            // Allows you to skip hostHash option in ssh2 0.5+
            info.hostVerifier = false;
          }

          info.algorithms = {
            key: [
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group-exchange-sha1',
              'diffie-hellman-group1-sha1',
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes128-gcm@openssh.com',
              'aes256-gcm',
              'aes256-gcm@openssh.com',
              'aes256-cbc',
              'aes192-cbc',
              'aes128-cbc',
              'blowfish-cbc',
              '3des-cbc',
              'arcfour256',
              'arcfour128',
              'cast128-cbc',
              'arcfour',
            ],
            serverHostKey: [
              'ssh-rsa',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521',
              'ssh-dss',
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-md5',
              'hmac-sha2-256-96',
              'hmac-sha2-512-96',
              'hmac-ripemd160',
              'hmac-sha1-96',
              'hmac-md5-96',
            ],
            compress: [
              'none',
              'zlib@openssh.com',
              'zlib',
            ],
          };

          info.filePermissions = self.info.filePermissions;
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

        atom.notifications.addSuccess('Remote FTP: Connected', {
          dismissable: false,
        });
      });

      self.connector.on('closed', (action) => {
        self.disconnect();
        self.status = 'NOT_CONNECTED';
        self.emit('closed');
        atom.notifications.addInfo('Remote FTP: Connection closed', {
          dismissable: false,
        });

        if (action === 'RECONNECT') {
          self.connect(true);
        }
      });
      self.connector.on('ended', () => {
        self.emit('ended');
      });
      self.connector.on('error', (err) => {
        atom.notifications.addError('Remote FTP: Connection failed', {
          detail: err,
          dismissable: false,
        });
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
      const projectPath = self.getProjectPath();

      if (projectPath === false) return false;
      if (typeof remote !== 'string') {
        throw new Error(`Remote FTP: remote must be a string, was passed ${typeof remote}`);
      }
      return Path.resolve(projectPath, `./${remote.substr(self.info.remote.length).replace(/^\/+/, '')}`);
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
            if (typeof callback === 'function') callback(...arguments);
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
            if (typeof callback === 'function') callback(...arguments);
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
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          }, (percent) => {
            progress.setProgress(percent);
          });
        }, `Uploading ${Path.basename(local)}`);
      });

      return self;
    }

    traverseTree(rootPath, callback) {
      const list = [];
      const queue = [rootPath];

      // search all files in rootPath recursively
      while (queue.length > 0) {
        const currentPath = queue.pop();
        const filesFound = FS.readdirSync(currentPath);

        for (const fileName of filesFound) {
          if (fileName !== '.' && fileName !== '..') {
            const fullName = Path.join(currentPath, fileName);

            const stats = FS.statSync(fullName);
            list.push({
              name: fullName,
              size: stats.size,
              date: stats.mtime,
              type: stats.isFile() ? 'f' : 'd',
            });

            if (!stats.isFile()) queue.push(fullName);
          }
        }
      }

      // depth counting & sorting
      for (const file of list) {
        file.depth = file.name.split('/').length;
      }
      list.sort((a, b) => {
        if (a.depth === b.depth) return 0;
        return a.depth > b.depth ? 1 : -1;
      });

      // callback
      if (typeof callback === 'function') callback.apply(null, [list]);
    }

    syncRemoteLocal(remote, isFile, callback) {
      // TODO: Tidy up this function. Does ( probably ) not need to list from the connector
      // if isFile === true. Will need to check to see if that doesn't break anything before
      // implementing. In the meantime current solution should work for #453
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

            self.traverseTree(local, (locals) => {
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
              if (remotes.length === 0) {
                self.connector.get(remote, false, () => n());
                return;
              }
              n();
            });
          }, isFile);
          // NOTE: Added isFile to end of call to prevent breaking any functions
          // that already use list command. Is file is used only for ftp connector
          // as it will list a file as a file of itself unlinke with sftp which
          // will throw an error.
        }, `Sync local ${Path.basename(remote)}`);
      });
      return self;
    }

    syncLocalRemote(local, callback) {
      const self = this;

      self.onceConnected(() => {
        self._enqueue((progress) => {
          const remote = self.toRemote(local);

          self.connector.list(remote, true, (err, remotes) => {
            if (err) {
              if (typeof callback === 'function') callback.apply(null, [err]);
              return;
            }

            self.traverseTree(local, (locals) => {
              const error = function () {
                if (typeof callback === 'function') callback.apply(null);
                self._next();
                return;
              };

              // filter via .ftpignore
              const ftpignore = self.getFilePath('.ftpignore');
              const ignoreFilter = Ignore();
              if (FS.existsSync(ftpignore)) {
                ignoreFilter.add(FS.readFileSync(ftpignore).toString());
              }

              // remove ignored locals
              for (let i = locals.length - 1; i >= 0; i--) {
                if (ignoreFilter.ignores(locals[i].name)) {
                  locals.splice(i, 1); // remove from list
                }
              }

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
            if (typeof callback === 'function') callback(...arguments);
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
            if (typeof callback === 'function') callback(...arguments);
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
          self.connector.rename(source, dest, (err) => {
            if (typeof callback === 'function') callback.apply(null, [err]);
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
            if (typeof callback === 'function') callback(...arguments);
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
