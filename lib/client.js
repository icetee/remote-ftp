'use babel';

import FS from 'fs-plus';
import os from 'os';
import { File, CompositeDisposable, Emitter } from 'atom';
import { $ } from 'atom-space-pen-views';
import Path from 'path';
import stripJsonComments from 'strip-json-comments';
import chokidar from 'chokidar';
import ignore from 'ignore';
import sshConfig from 'ssh-config';
import { multipleHostsEnabled, getObject, hasProject, logger, traverseTree, validateConfig, resolveHome } from './helpers';
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

    self.ignoreBaseName = '.ftpignore';
    self.ignoreFile = null;
    self.ignoreFilter = false;

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

        const watchDataFormatted = watchData.map(watch => Path.normalize(`${dir}/${watch}`));
        // console.log(JSON.stringify(watchDataFormatted));

        const watcher = chokidar.watch(watchDataFormatted, {
          ignored: /(^|[/\\])\../,
          persistent: true,
        });

        watcher.on('change', (path) => {
          self.watch.queueUpload.apply(self, [path]);
          if (atom.config.get('Remote-FTP.notifications.enableWatchFileChange')) {
            atom.notifications.addInfo(`Remote FTP: Change detected in: ${path}`, {
              dismissable: false,
            });
          }
        });

        self.files = watchDataFormatted.slice();

        atom.notifications.addInfo('Remote FTP: Added watch listeners.', {
          dismissable: false,
        });
        self.watcher = watcher;
      },
      removeListeners() {
        if (self.watcher != null) {
          self.watcher.close();
          atom.notifications.addInfo('Remote FTP: Stopped watch listeners.', {
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
    const self = this;

    this.subscriptions.add(
      atom.config.onDidChange('Remote-FTP.dev.debugResponse', (values) => {
        self.watchDebug(values.newValue);
      }),
      atom.config.onDidChange('Remote-FTP.tree.showProjectName', () => {
        self.setProjectName();
      }),
    );
  }

  setProjectName() {
    const self = this;
    const projectRoot = atom.config.get('Remote-FTP.tree.showProjectName');
    const $rootName = $('.ftptree-view .project-root > .header span');

    let rootName = '/';

    if (typeof self.info[projectRoot] !== 'undefined') {
      rootName = self.info[projectRoot];
    }

    self.root.name = rootName;
    $rootName.text(rootName);
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
      if (validateConfig(data)) {
        try {
          json = JSON.parse(data);

          self.info = json;
          self.root.name = '';
          if (self.info.remote) {
            self.root.path = `/${self.info.remote.replace(/^\/+/, '')}`;
          } else {
            self.root.path = '/';
          }

          if (self.info.privatekey) {
            self.info.privatekey = resolveHome(self.info.privatekey);
          }

          self.setProjectName();
        } catch (e) {
          atom.notifications.addError('Could not process `.ftpconfig`.', {
            detail: e,
            dismissable: false,
          });
        }
      }
      if (json !== null && typeof callback === 'function') {
        const ssconfigPath = atom.config.get('Remote-FTP.connector.sshConfigPath');

        if (ssconfigPath && self.info.protocol === 'sftp') {
          const configPath = Path.normalize(ssconfigPath.replace('~', os.homedir()));

          FS.readFile(configPath, 'utf8', (fileErr, conf) => {
            if (fileErr) return error(fileErr);

            const config = sshConfig.parse(conf);

            const section = config.find({
              Host: self.info.host,
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
                self.info[mapping.get(line.param)] = line.value;
              });
            }

            return callback.apply(self, [err, self.info]);
          });
        } else {
          callback.apply(self, [err, json]);
        }
      }

      return true;
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
      projectPath = $currentProject.find('> .header span.name').data('path');
    } else {
      const firstDirectory = atom.project.getDirectories()[0];
      if (firstDirectory != null) projectPath = firstDirectory.path;
    }

    if (projectPath != null) {
      self.projectPath = projectPath;
      return projectPath;
    }
    atom.notifications.addError('Remote FTP: Could not get project path.', {
      dismissable: false, // Want user to report error so don't let them close it
      detail: `Please report this error if it occurs. Multiple Hosts is ${multipleHostsEnabled()}.`,
    });
    return false;
  }

  getConfigPath() {
    if (!hasProject) return false;

    return this.getFilePath('./.ftpconfig');
  }

  updateIgnore() {
    const self = this;

    if (!self.ignoreFile) {
      self.ignorePath = self.getFilePath(self.ignoreBaseName);
      self.ignoreFile = new File(self.ignorePath);
    }

    if (!self.ignoreFile.existsSync()) {
      self.ignoreFilter = false;
      return false;
    }

    if (self.ignoreFile.getBaseName() === self.ignoreBaseName) {
      self.ignoreFilter = ignore().add(self.ignoreFile.readSync(true));
      return true;
    }

    return false;
  }

  checkIgnore(local) {
    const self = this;
    let haseIgnore = true;

    if (!self.ignoreFilter) {
      haseIgnore = self.updateIgnore();
    }

    if (haseIgnore && self.ignoreFilter && self.ignoreFilter.ignores(local)) {
      return true;
    }

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

      self.emitter.once('connected', onconnect);
      return false;
    }
    console.warn(`Remote-FTP: Not connected and typeof onconnect is ${typeof onconnect}`);
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
          port: self.info.port || 21,
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
        throw new Error('No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> Remote-FTP -> Create (S)FTP config file.');
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

    self.watchDebug(atom.config.get('Remote-FTP.dev.debugResponse'));
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

    self.current = null;
    self.queue = [];

    self.status = 'NOT_CONNECTED';
    self.emitter.emit('disconnected');

    if (typeof cb === 'function') cb();

    return self;
  }

  toRemote(local) {
    const self = this;

    return Path.join(
      self.info.remote,
      atom.project.relativize(local),
    ).replace(/\\/g, '/');
  }

  toLocal(remote) {
    const self = this;
    const projectPath = self.getProjectPath();
    const remoteLength = self.info.remote.length;

    if (projectPath === false) return false;
    if (typeof remote !== 'string') {
      throw new Error(`Remote FTP: remote must be a string, was passed ${typeof remote}`);
    }

    let path = null;
    if (remoteLength > 1) {
      path = `./${remote.substr(self.info.remote.length)}`;
    } else {
      path = `./${remote}`;
    }

    return Path.resolve(projectPath, `./${path.replace(/^\/+/, '')}`);
  }

  _next() {
    const self = this;

    if (!self.isConnected()) return;

    self.current = self.queue.shift();

    if (self.current) self.current[1].apply(self, [self.current[2]]);

    atom.project.remoteftp.emitter.emit('queue-changed');
  }

  _enqueue(func, desc) {
    const self = this;
    const progress = new Progress();

    self.queue.push([desc, func, progress]);
    if (self.queue.length === 1 && !self.current) self._next();

    else self.emitter.emit('queue-changed');

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

    self.current = null;
    self.queue = [];

    if (self.isConnected()) {
      self.connector.abort();
    }

    self.emitter.emit('queue-changed');

    return self;
  }

  list(remote, recursive, callback) {
    const self = this;
    self.onceConnected(() => {
      self._enqueue(() => {
        self.connector.list(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
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
        self.connector.get(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
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
        self.connector.put(local, (...args) => {
          if (typeof callback === 'function') callback(...args);
          self._next();
        }, (percent) => {
          progress.setProgress(percent);
        });
      }, `Uploading ${Path.basename(local)}`);
    });

    return self;
  }

  syncRemoteFileToLocal(remote, callback) {
    const self = this;
    // verify active connection
    if (self.status === 'CONNECTED') {
      self._enqueue(() => {
        self.connector.get(remote, false, (err) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }
          self._next();
        });
      }, `Sync ${Path.basename(remote)}`);
    } else {
      atom.notifications.addError('Remote FTP: Not connected!', {
        dismissable: true,
      });
    }
    return self;
  }

  syncRemoteDirectoryToLocal(remote, isFile, callback) {
    // TODO: Tidy up this function. Does ( probably ) not need to list from the connector
    // if isFile === true. Will need to check to see if that doesn't break anything before
    // implementing. In the meantime current solution should work for #453
    //
    // TODO: This method only seems to be referenced by the context menu command so gracefully
    // removing list without breaking this method should be do-able. 'isFile' is always sending
    // false at the moment inside commands.js
    const self = this;

    if (!remote) return;

    self.download(remote, true, (err) => {
      if (err) {
        console.error(err);
      }
    });

    self._enqueue(() => {
      const local = self.toLocal(remote);

      self.connector.list(remote, true, (err, remotes) => {
        if (err) {
          if (typeof callback === 'function') callback.apply(null, [err]);

          return;
        }

        traverseTree(local, (locals) => {
          const error = () => {
            if (typeof callback === 'function') callback.apply(null);
            self._next();
          };

          const n = () => {
            const remoteOne = remotes.shift();
            let loc;

            if (!remoteOne) return error();

            if (remoteOne.type === 'd') return n();

            const toLocal = self.toLocal(remoteOne.name);
            loc = null;

            for (let a = 0, b = locals.length; a < b; ++a) {
              if (locals[a].name === toLocal) {
                loc = locals[a];
                break;
              }
            }

            // Download only if not present on local or size differ
            if (!loc || remoteOne.size !== loc.size) {
              self.connector.get(remoteOne.name, false, () => n());
            } else {
              n();
            }

            return true;
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
    }, `Sync ${Path.basename(remote)}`);
  }

  syncLocalFileToRemote(local, callback) {
    const self = this;
    // verify active connection
    if (self.status === 'CONNECTED') {
      // progress
      self._enqueue(() => {
        self.connector.put(local, (err) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }
          self._next();
        });
      }, `Sync: ${Path.basename(local)}`);
    } else {
      atom.notifications.addError('Remote FTP: Not connected!', {
        dismissable: true,
      });
    }
    return self;
  }

  syncLocalDirectoryToRemote(local, callback) {
    const self = this;
    // verify active connection
    if (self.status === 'CONNECTED') {
      self._enqueue(() => {
        const remote = self.toRemote(local);

        self.connector.list(remote, true, (err, remotes) => {
          if (err) {
            if (typeof callback === 'function') callback.apply(null, [err]);
            return;
          }

          traverseTree(local, (locals) => {
            const error = () => {
              if (typeof callback === 'function') callback.apply(null);
              self._next();
            };

            // remove ignored locals
            self.checkIgnore(local);
            if (self.ignoreFilter) {
              for (let i = locals.length - 1; i >= 0; i--) {
                if (self.ignoreFilter.ignores(locals[i].name)) {
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
              if (nLocal.type === 'd') return n();

              const toRemote = self.toRemote(nLocal.name);
              nRemote = null;

              for (let a = 0, b = remotes.length; a < b; ++a) {
                if (remotes[a].name === toRemote) {
                  nRemote = remotes[a];
                  break;
                }
              }

              // NOTE: Upload only if not present on remote or size differ
              if (!nRemote || remote.size !== nLocal.size) {
                self.connector.put(nLocal.name, () => n());
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
    return self;
  }

  mkdir(remote, recursive, callback) {
    const self = this;
    self.onceConnected(() => {
      self._enqueue(() => {
        self.connector.mkdir(remote, recursive, (...args) => {
          if (typeof callback === 'function') callback(...args);
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
        self.connector.mkfile(remote, (...args) => {
          if (typeof callback === 'function') callback(...args);
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
        self.connector.delete(remote, (...args) => {
          if (typeof callback === 'function') callback(...args);
          self._next();
        });
      }, `Deleting ${Path.basename(remote)}`);
    });

    return self;
  }

  site(command, callback) {
    this.onceConnected(() => {
      this.connector.site(command, (...args) => {
        if (typeof callback === 'function') callback(args);
      });
    });
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

  promptForKeyboardInteractive() {
    const self = this;
    const dialog = new PromptPassDialog(true);

    dialog.on('dialog-done', (e, pass) => {
      self.info.verifyCode = pass;
      dialog.close();
      self.doConnect();
    });

    dialog.attach();
  }

  dispose() {
    this.subscriptions.dispose();
    this.emitter.dispose();
    this.watch.removeListeners();
  }
}
