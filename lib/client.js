'use babel';

import FS from 'fs-plus';
import os from 'os';
import { File, CompositeDisposable, Emitter, watchPath } from 'atom';
import { $ } from 'atom-space-pen-views';
import Path from 'path';
import stripJsonComments from 'strip-json-comments';
import ignore from 'ignore';
import sshConfig from 'ssh-config';
import { multipleHostsEnabled, getObject, hasProject, logger, traverseTree, validateConfig, resolveHome, mkdirSyncRecursive } from './helpers';
import Directory from './directory';
import Progress from './progress';
import FTP from './connectors/ftp';
import SFTP from './connectors/sftp';
import PromptPassDialog from './dialogs/prompt-pass-dialog';

const SSH2_ALGORITHMS = require('ssh2-streams').constants.ALGORITHMS;

export default class Client {
  constructor() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();

    const self = this;
    self.info = null;
    self.connector = null;
    self.current = null;
    self.queue = [];

    self.configFileName = '.ftpconfig';
    self.ignoreBaseName = '.ftpignore';
    self.ignoreFilter = false;
    self.watchers = [];

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

        const ig = ignore().add(watchData);

        watchPath(self.getProjectPath(), {}, (events) => {
          Object.keys(events).forEach((key) => {
            const event = events[key];
            const relativePath = Path.relative(self.getProjectPath(), event.path);

            if (!ig.ignores(relativePath)) return;
            self.watch.files.push(relativePath);

            if (event.action === 'modified' && !relativePath.match(/(^|[/\\])\../)) {
              self.watch.queueUpload.apply(self, [event.path, () => {
                if (atom.config.get('remote-ftp.notifications.enableWatchFileChange')) {
                  atom.notifications.addInfo(`Remote FTP: Change detected in: ${event.path}`, {
                    dismissable: false,
                  });
                }

                const index = self.watch.files.indexOf(relativePath);

                if (index > -1) {
                  delete self.watch.files[index];
                }
              }]);
            }
          });
        }).then(disposable => self.watchers.push(disposable));

        atom.notifications.addInfo('Remote FTP: Added watch listeners.', {
          dismissable: false,
        });
      },
      removeListeners() {
        if (self.watchers.length > 0) {
          self.watchers.forEach(watcher => watcher.dispose());

          atom.notifications.addInfo('Remote FTP: Stopped watch listeners.', {
            dismissable: false,
          });

          self.watchers = [];
        }
      },
      queue: {},
      queueUpload(fileName, callback) {
        const timeoutDuration = isNaN(parseInt(self.info.watchTimeout, 10)) === true
          ? 500
          : parseInt(self.info.watchTimeout, 10);

        function scheduleUpload(file) {
          self.watch.queue[file] = setTimeout(() => {
            self.upload(file, callback);
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

    self.onDidConnected(self.watch.addListeners);
    self.onDidDisconnected(self.watch.removeListeners);

    self.events();
  }

  onDidChangeStatus(callback) {
    this.subscriptions.add(
      this.emitter.on('change-status', () => {
        callback(this.status);
      }),
    );
  }

  onDidConnected(callback) {
    this.subscriptions.add(
      this.emitter.on('connected', () => {
        callback(this.status);
        this.emitter.emit('change-status');
      }),
    );
  }

  onDidDisconnected(callback) {
    this.subscriptions.add(
      this.emitter.on('disconnected', () => {
        callback(this.status);
        this.emitter.emit('change-status');
      }),
    );
  }

  onDidClosed(callback) {
    this.subscriptions.add(
      this.emitter.on('closed', () => {
        callback(this.status);
      }),
    );
  }

  onDidDebug(callback) {
    this.subscriptions.add(
      this.emitter.on('debug', (message) => {
        callback(message);
      }),
    );
  }

  onDidQueueChanged(callback) {
    this.subscriptions.add(
      this.emitter.on('queue-changed', () => {
        callback();
      }),
    );
  }

  events() {
    this.subscriptions.add(
      atom.config.onDidChange('remote-ftp.dev.debugResponse', (values) => {
        this.watchDebug(values.newValue);
      }),
      atom.config.onDidChange('remote-ftp.tree.showProjectName', () => {
        this.setProjectName();
      }),
    );
  }

  setProjectName() {
    if (typeof this.ftpConfigPath === 'undefined') return;

    const projectRoot = atom.config.get('remote-ftp.tree.showProjectName');
    const $rootName = $('.ftptree-view .project-root > .header span');

    let rootName = '/';

    if (typeof this.info[projectRoot] !== 'undefined') {
      rootName = this.info[projectRoot];
    }

    this.root.name = rootName;
    $rootName.text(rootName);
  }

  readConfig(callback) {
    let CSON;

    const error = (err) => {
      if (typeof callback === 'function') callback.apply(this, [err]);
    };
    this.info = null;
    this.ftpConfigPath = this.getConfigPath();

    const csonConfig = new File(this.getFilePath(`${this.ftpConfigPath}.cson`));

    if (this.ftpConfigPath === false) throw new Error('Remote FTP: getConfigPath returned false, but expected a string');

    const modifyConfig = (json) => {
      this.info = json;
      this.root.name = '';
      if (this.info.remote) {
        this.root.path = `/${this.info.remote.replace(/^\/+/, '')}`;
      } else {
        this.root.path = '/';
      }

      if (this.info.privatekey) {
        this.info.privatekey = resolveHome(this.info.privatekey);
      }

      this.setProjectName();
    };

    const extendsConfig = (json, err) => {
      if (json !== null && typeof callback === 'function') {
        const sshConfigPath = atom.config.get('remote-ftp.connector.sshConfigPath');

        if (sshConfigPath && this.info.protocol === 'sftp') {
          const configPath = Path.normalize(sshConfigPath.replace('~', os.homedir()));

          FS.readFile(configPath, 'utf8', (fileErr, conf) => {
            if (fileErr) return error(fileErr);

            const config = sshConfig.parse(conf);

            const section = config.find({
              Host: this.info.host,
            });

            if (section !== null) {
              const mapping = new Map([
                ['HostName', 'host'],
                ['Port', 'port'],
                ['User', 'user'],
                ['IdentityFile', 'privatekey'],
                ['ServerAliveInterval', 'keepalive'],
                ['ConnectTimeout', 'connTimeout'],
              ]);

              section.config.forEach((line) => {
                const key = mapping.get(line.param);

                if (typeof key !== 'undefined') {
                  this.info[key] = line.value;
                }
              });
            }

            return callback.apply(this, [err, this.info]);
          });
        } else {
          callback.apply(this, [err, json]);
        }
      }
    };

    if (csonConfig.existsSync()) {
      if (typeof CSON === 'undefined') {
        CSON = require('cson-parser');
      }

      let json = null;

      csonConfig.read(true).then((content) => {
        try {
          json = CSON.parse(content);
          modifyConfig(json);
        } catch (e) {
          atom.notifications.addError(`Could not process \`${this.configFileName}\`.`, {
            detail: e,
            dismissable: false,
          });
        }

        extendsConfig(json, null);
      });

      return;
    }

    FS.readFile(this.ftpConfigPath, 'utf8', (err, res) => {
      if (err) return error(err);

      const data = stripJsonComments(res);
      let json = null;
      if (validateConfig(data, this.configFileName)) {
        try {
          json = JSON.parse(data);

          modifyConfig(json);
        } catch (e) {
          atom.notifications.addError(`Could not process \`${this.configFileName}\`.`, {
            detail: e,
            dismissable: false,
          });
        }
      }

      extendsConfig(json, err);

      return true;
    });
  }

  getFilePath(relativePath) {
    const projectPath = this.getProjectPath();
    if (projectPath === false) return false;
    return Path.resolve(projectPath, relativePath);
  }

  getProjectPath() {
    let projectPath = null;

    if (multipleHostsEnabled() === true) {
      const $selectedDir = $('.tree-view .selected');
      const $currentProject = $selectedDir.hasClass('project-root') ? $selectedDir : $selectedDir.closest('.project-root');
      projectPath = $currentProject.find('> .header span.name').data('path');
    } else {
      const firstDirectory = atom.project.getDirectories()[0];
      if (firstDirectory != null) projectPath = firstDirectory.path;
    }

    if (projectPath != null) {
      this.projectPath = projectPath;
      return projectPath;
    }

    return false;
  }

  getConfigPath() {
    if (!hasProject) return false;

    return this.getFilePath(`./${this.configFileName}`);
  }

  updateIgnore() {
    const ignorePath = this.getFilePath(this.ignoreBaseName);
    const ignoreFile = new File(ignorePath);

    if (!ignoreFile.existsSync()) {
      return false;
    }

    this.ignoreFilter = ignore().add(ignoreFile.readSync(true));

    return true;
  }

  checkIgnore(filepath) {
    const relativeFilepath = Client.toRelative(filepath);

    let ignoreIsActual = true;

    // updateIgnore when not set or .ftpignore is saved
    if (!this.ignoreFilter || (relativeFilepath === this.getFilePath(this.ignoreBaseName))) {
      ignoreIsActual = this.updateIgnore();
    }

    if (ignoreIsActual && this.ignoreFilter.ignores(relativeFilepath)) {
      return true;
    }

    return false;
  }

  isConnected() {
    return this.connector && this.connector.isConnected();
  }

  onceConnected(onconnect) {
    if (this.connector && this.connector.isConnected()) {
      onconnect.apply(this);
      return true;
    } else if (typeof onconnect === 'function') {
      if (this.status === 'NOT_CONNECTED') {
        this.status = 'CONNECTING';
        this.readConfig((err) => {
          if (err !== null) {
            this.status = 'NOT_CONNECTED';
            // NOTE: Remove notification as it will just say there
            // is no ftpconfig if none in directory all the time
            // atom.notifications.addError("Remote FTP: " + err);
            return;
          }
          this.connect(true);
        });
      }

      this.emitter.once('connected', onconnect);
      return false;
    }
    console.warn(`Remote FTP: Not connected and typeof onconnect is ${typeof onconnect}`);
    return false;
  }

  connect(reconnect) {
    if (reconnect !== true) this.disconnect();
    if (this.isConnected()) return;
    if (!this.info) return;
    if (this.info.promptForPass === true) {
      this.promptForPass();
    } else if (this.info.keyboardInteractive === true) {
      this.promptForKeyboardInteractive();
    } else if (this.info.keyboardInteractiveForPass === true) {
      this.info.verifyCode = this.info.pass;
      this.doConnect();
    } else {
      this.doConnect();
    }
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
          forcePasv: self.info.forcePasv || true,
          keepalive: (self.info.keepalive === undefined ? 10000 : self.info.keepalive), // long version, because 0 is a valid value
          debug(str) {
            const log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
            if (!log) return;
            if (log[2].match(/^PASS /)) log[2] = 'PASS ******';
            self.emitter.emit('debug', `${log[1]} ${log[2]}`);
          },
        };
        self.connector = new FTP(self);
        break;
      }

      case 'sftp': {
        info = {
          host: self.info.host || '',
          port: self.info.port || 22,
          username: self.info.user || '',
          readyTimeout: self.info.connTimeout || 10000,
          keepaliveInterval: self.info.keepalive || 10000,
          verifyCode: self.info.verifyCode || '',
        };

        if (self.info.pass) info.password = self.info.pass;

        if (self.info.privatekey) {
          self.info.privatekey = resolveHome(self.info.privatekey);

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
          kex: SSH2_ALGORITHMS.SUPPORTED_KEX,
          cipher: SSH2_ALGORITHMS.SUPPORTED_CIPHER,
          serverHostKey: SSH2_ALGORITHMS.SUPPORTED_SERVER_HOST_KEY,
          hmac: SSH2_ALGORITHMS.SUPPORTED_HMAC,
          compress: SSH2_ALGORITHMS.SUPPORTED_COMPRESS,
        };

        info.filePermissions = self.info.filePermissions;
        info.remoteCommand = self.info.remoteCommand;
        info.remoteShell = self.info.remoteShell;

        if (self.info.keyboardInteractive) info.tryKeyboard = true;
        if (self.info.keyboardInteractiveForPass) info.tryKeyboard = true;

        self.connector = new SFTP(self);
        break;
      }

      default:
        throw new Error('No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> Remote FTP -> Create (S)FTP config file.');
    }

    self.connector.connect(info, () => {
      if (self.root.status !== 1) self.root.open();
      self.status = 'CONNECTED';
      self.emitter.emit('connected');

      atom.notifications.addSuccess('Remote FTP: Connected', {
        dismissable: false,
      });
    });

    self.connector.on('closed', (action) => {
      if (self.status === 'NOT_CONNECTED') return;

      self.status = 'NOT_CONNECTED';
      self.emitter.emit('closed');

      atom.notifications.addInfo('Remote FTP: Connection closed', {
        dismissable: false,
      });

      self.disconnect(() => {
        if (action === 'RECONNECT') self.connect(true);
      });
    });

    self.connector.on('ended', () => {
      self.emitter.emit('ended');
    });

    self.connector.on('error', (err, code) => {
      if (code === 421 || code === 'ECONNRESET') return;
      atom.notifications.addError('Remote FTP: Connection failed', {
        detail: err,
        dismissable: false,
      });
    });

    self.watchDebug(atom.config.get('remote-ftp.dev.debugResponse'));
  }

  watchDebug(isWatching) {
    this.emitter.off('debug', logger);

    if (isWatching) {
      this.emitter.on('debug', logger);
    } else {
      this.emitter.off('debug', logger);
    }
  }

  disconnect(cb) {
    if (this.connector) {
      this.connector.disconnect();
      delete this.connector;
      this.connector = null;
    }

    if (this.root) {
      this.root.status = 0;
      this.root.destroy();
    }

    this.watch.removeListeners.apply(this);

    this.current = null;
    this.queue = [];

    this.status = 'NOT_CONNECTED';
    this.emitter.emit('disconnected');

    if (typeof cb === 'function') cb();

    return this;
  }

  static toRelative(path) {
    let relativePath = atom.project.relativize(path);

    if (!relativePath.length) {
      relativePath = '/';
    } else if (relativePath[0] === '/') {
      relativePath = relativePath.substr(1);
    }

    return relativePath;
  }

  toRemote(local) {
    return Path.join(
      this.info.remote,
      atom.project.relativize(local),
    ).replace(/\\/g, '/');
  }

  toLocal(remote, target = '') {
    const projectPath = this.getProjectPath();
    const remoteLength = this.info.remote.length;

    if (projectPath === false) return false;
    if (typeof remote !== 'string') {
      throw new Error(`Remote FTP: remote must be a string, was passed ${typeof remote}`);
    }

    let path = null;
    if (remoteLength > 1) {
      path = `./${remote.substr(this.info.remote.length)}`;
    } else {
      path = `./${remote}`;
    }

    return Path.resolve(Path.join(projectPath, target, `./${path.replace(/^\/+/, '')}`));
  }

  _next() {
    if (!this.isConnected()) return;

    this.current = this.queue.shift();

    if (this.current) this.current[1].apply(this, [this.current[2]]);

    if (typeof atom.project.remoteftp.emitter !== 'undefined') {
      atom.project.remoteftp.emitter.emit('queue-changed');
    }
  }

  _enqueue(func, desc) {
    const progress = new Progress();

    this.queue.push([desc, func, progress]);
    if (this.queue.length === 1 && !this.current) this._next();

    else this.emitter.emit('queue-changed');

    return progress;
  }

  abort() {
    if (this.isConnected()) {
      this.connector.abort(() => {
        this._next();
      });
    }

    return this;
  }

  abortAll() {
    this.current = null;
    this.queue = [];

    if (this.isConnected()) {
      this.connector.abort();
    }

    this.emitter.emit('queue-changed');

    return this;
  }

  list(remote, recursive, callback) {
    this.onceConnected(() => {
      this._enqueue(() => {
        this.connector.list(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        });
      }, `Listing ${recursive ? 'recursively ' : ''}${Path.basename(remote)}`);
    });

    return this;
  }

  downloadTo(remotePath, targetPath, recursive, callback) {
    if (this.checkIgnore(remotePath)) {
      this._next();
      return;
    }

    this.onceConnected(() => {
      this._enqueue((progress) => {
        this.connector.getTo(remotePath, targetPath, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        }, (percent) => {
          progress.setProgress(percent);
        });
      }, `Downloading ${Path.basename(remotePath)}`);
    });
  }

  download(remote, recursive, callback) {
    if (this.checkIgnore(remote)) {
      this._next();
      return;
    }

    this.onceConnected(() => {
      this._enqueue((progress) => {
        this.connector.get(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        }, (percent) => {
          progress.setProgress(percent);
        });
      }, `Downloading ${Path.basename(remote)}`);
    });
  }

  upload(local, callback) {
    if (this.checkIgnore(local)) {
      this._next();
      return;
    }

    this.onceConnected(() => {
      this._enqueue((progress) => {
        this.connector.put(local, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        }, (percent) => {
          progress.setProgress(percent);
        });
      }, `Uploading ${Path.basename(local)}`);
    });
  }

  uploadTo(local, remote, callback) {
    if (this.checkIgnore(local)) {
      this._next();
      return;
    }

    this.onceConnected(() => {
      this._enqueue((progress) => {
        this.connector.putTo(local, remote, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        }, (percent) => {
          progress.setProgress(percent);
        });
      }, `Uploading ${Path.basename(local)}`);
    });
  }

  syncRemoteFileToLocal(remote, callback) {
    if (this.checkIgnore(remote)) {
      this._next();
      return;
    }

    // verify active connection
    if (this.status === 'CONNECTED') {
      this._enqueue(() => {
        this.connector.get(remote, false, (err) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }
          this._next();
        });
      }, `Sync ${Path.basename(remote)}`);
    } else {
      atom.notifications.addError('Remote FTP: Not connected!', {
        dismissable: true,
      });
    }
  }

  syncRemoteDirectoryToLocal(remote, isFile, callback) {
    // TODO: Tidy up this function. Does ( probably ) not need to list from the connector
    // if isFile === true. Will need to check to see if that doesn't break anything before
    // implementing. In the meantime current solution should work for #453
    //
    // TODO: This method only seems to be referenced by the context menu command so gracefully
    // removing list without breaking this method should be do-able. 'isFile' is always sending
    // false at the moment inside commands.js
    if (!remote) return;

    // Check ignores
    if (this.checkIgnore(remote)) {
      this._next();
      return;
    }

    this._enqueue(() => {
      const local = this.toLocal(remote);

      this.connector.list(remote, true, (err, remotes) => {
        if (err) {
          if (typeof callback === 'function') callback.apply(null, [err]);

          return;
        }

        // Create folder if no exists in local
        mkdirSyncRecursive(local);

        // remove ignored remotes
        if (this.ignoreFilter) {
          for (let i = remotes.length - 1; i >= 0; i--) {
            if (this.checkIgnore(remotes[i].name)) {
              remotes.splice(i, 1); // remove from list
            }
          }
        }

        traverseTree(local, (locals) => {
          const error = () => {
            if (typeof callback === 'function') callback.apply(null);
            this._next();
          };

          const n = () => {
            const remoteOne = remotes.shift();
            let loc;

            if (!remoteOne) return error();

            const toLocal = this.toLocal(remoteOne.name);
            loc = null;

            for (let a = 0, b = locals.length; a < b; ++a) {
              if (locals[a].name === toLocal) {
                loc = locals[a];
                break;
              }
            }

            // Download only if not present on local or size differ
            if (!loc || remoteOne.size !== loc.size) {
              this.connector.get(remoteOne.name, true, () => n());
            } else {
              n();
            }

            return true;
          };

          if (remotes.length === 0) {
            this.connector.get(remote, false, () => n());
            return;
          }
          n();
        });
      }, isFile);
      // NOTE: Added isFile to end of call to prevent breaking any functions
      // that already use list command. Is file is used only for ftp connector
      // as it will list a file as a file of itself unlinke with sftp which
      // will throw an error.
    }, `Sync ${Path.basename(remote)}`);
  }

  syncLocalFileToRemote(local, callback) {
    // Check ignores
    if (this.checkIgnore(local)) {
      this._next();
      return;
    }

    // verify active connection
    if (this.status === 'CONNECTED') {
      // progress
      this._enqueue(() => {
        this.connector.put(local, (err) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }
          this._next();
        });
      }, `Sync: ${Path.basename(local)}`);
    } else {
      atom.notifications.addError('Remote FTP: Not connected!', {
        dismissable: true,
      });
    }
  }

  syncLocalDirectoryToRemote(local, callback) {
    // Check ignores
    if (this.checkIgnore(local)) {
      this._next();
      return;
    }

    // verify active connection
    if (this.status === 'CONNECTED') {
      this._enqueue(() => {
        const remote = this.toRemote(local);

        this.connector.list(remote, true, (err, remotes) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }

          // remove ignored remotes
          if (this.ignoreFilter) {
            for (let i = remotes.length - 1; i >= 0; i--) {
              if (this.checkIgnore(remotes[i].name)) {
                remotes.splice(i, 1); // remove from list
              }
            }
          }

          traverseTree(local, (locals) => {
            const error = () => {
              if (typeof callback === 'function') callback.apply(null);
              this._next();
            };

            // remove ignored locals
            if (this.ignoreFilter) {
              for (let i = locals.length - 1; i >= 0; i--) {
                if (this.checkIgnore(locals[i].name)) {
                  locals.splice(i, 1); // remove from list
                }
              }
            }

            const n = () => {
              const nLocal = locals.shift();
              let nRemote;

              if (!nLocal) {
                return error();
              }

              const toRemote = this.toRemote(nLocal.name);
              nRemote = null;

              for (let a = 0, b = remotes.length; a < b; ++a) {
                if (remotes[a].name === toRemote) {
                  nRemote = remotes[a];
                  break;
                }
              }

              // NOTE: Upload only if not present on remote or size differ
              if (!nRemote) {
                if (nLocal.type === 'd') {
                  this.connector.mkdir(toRemote, false, () => n());
                } else if (nLocal.type === 'f') {
                  this.connector.put(nLocal.name, () => n());
                } else {
                  n();
                }
              } else if (nRemote.size !== nLocal.size && nLocal.type === 'f') {
                this.connector.put(nLocal.name, () => n());
              } else {
                n();
              }

              return true;
            };

            n();
          });
        });
      }, `Sync ${Path.basename(local)}`);
    } else {
      atom.notifications.addError('Remote FTP: Not connected!', {
        dismissable: true,
      });
    }
  }

  mkdir(remote, recursive, callback) {
    this.onceConnected(() => {
      this._enqueue(() => {
        this.connector.mkdir(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        });
      }, `Creating folder ${Path.basename(remote)}`);
    });

    return this;
  }

  mkfile(remote, callback) {
    this.onceConnected(() => {
      this._enqueue(() => {
        this.connector.mkfile(remote, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        });
      }, `Creating file ${Path.basename(remote)}`);
    });

    return this;
  }

  rename(source, dest, callback) {
    this.onceConnected(() => {
      this._enqueue(() => {
        this.connector.rename(source, dest, (err) => {
          if (typeof callback === 'function') callback.apply(null, [err]);
          this._next();
        });
      }, `Renaming ${Path.basename(source)}`);
    });
    return this;
  }

  delete(remote, callback) {
    this.onceConnected(() => {
      this._enqueue(() => {
        this.connector.delete(remote, (...args) => {
          if (typeof callback === 'function') callback(...args);
          this._next();
        });
      }, `Deleting ${Path.basename(remote)}`);
    });

    return this;
  }

  site(command, callback) {
    this.onceConnected(() => {
      this.connector.site(command, (...args) => {
        if (typeof callback === 'function') callback(args);
      });
    });
  }

  chmod(path, mode, callback) {
    this.onceConnected(() => {
      this.connector.chmod(path, mode, callback);
    });
  }

  chown(path, uid, gid, callback) {
    this.onceConnected(() => {
      if (typeof gid === 'function') {
        this.connector.chown(path, uid, gid);
      } else {
        this.connector.chown(path, uid, gid, callback);
      }
    });
  }

  chgrp(path, uid, gid, callback) {
    this.onceConnected(() => {
      this.connector.chgrp(path, uid, gid, callback);
    });
  }

  promptForPass() {
    const dialog = new PromptPassDialog('', true);
    dialog.on('dialog-done', (e, pass) => {
      this.info.pass = pass;
      this.info.passphrase = pass;
      dialog.close();
      this.doConnect();
    });
    dialog.attach();
  }

  promptForKeyboardInteractive() {
    const dialog = new PromptPassDialog(true);

    dialog.on('dialog-done', (e, pass) => {
      this.info.verifyCode = pass;
      dialog.close();
      this.doConnect();
    });

    dialog.attach();
  }

  dispose() {
    this.subscriptions.dispose();
    this.emitter.dispose();
    this.watch.removeListeners();
  }
}
