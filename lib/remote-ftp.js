'use babel';

import { File, Disposable, CompositeDisposable } from 'atom';
import Path from 'path';
import Client from './client';
import TreeView from './views/tree-view';
import StatusBarView from './views/status-bar';
import { hasProject, setIconHandler } from './helpers';
import initCommands from './menus/main';
import config from './config-schema.json';

export default {

  config,
  client: null,
  treeView: null,
  statusBar: null,
  statusBarView: null,
  subscriptions: null,

  activate() {
    if (this.subscriptions) {
      this.deactivate();
    }

    this.client = new Client();
    atom.project['remoteftp-main'] = this; // change remoteftp to object containing client and main?
    atom.project.remoteftp = this.client;
    this.treeView = new TreeView();
    this.statusBarView = new StatusBarView();

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.workspace.observeTextEditors((editor) => {
        this.subscriptions.add(
          editor.onDidSave(event => this.fileSaved(event)),
        );
      }),

      atom.project.onDidChangePaths(() => {
        if (!hasProject() || !this.client.isConnected()) return;

        atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:disconnect');
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:connect');
      }),

      atom.config.onDidChange('Remote-FTP.statusbar.enable', () => {
        this.setStatusbar();
      }),

      atom.config.onDidChange('Remote-FTP.statusbar.position', () => {
        this.setStatusbar();
      }),

      atom.config.onDidChange('Remote-FTP.statusbar.priority', () => {
        this.setStatusbar();
      }),
    );

    this.client.onDidConnected(() => {
      this.treeView.root.name.attr('data-name', Path.basename(this.client.root.remote));
      this.treeView.root.name.attr('data-path', this.client.root.remote);

      // .ftpignore initialize
      this.client.updateIgnore();
    });

    // NOTE: if there is a project folder & show view on startup
    //  is true, show the Remote FTP sidebar
    if (hasProject()) {
      // NOTE: setTimeout is for when multiple hosts option is true
      setTimeout(() => {
        const conf = new File(this.client.getConfigPath());

        conf.exists().then((exists) => {
          if (exists && atom.config.get('Remote-FTP.tree.showViewOnStartup')) {
            this.treeView.attach();
          }
        }).catch((error) => {
          atom.notifications.addWarning(error.reason);
        });
      }, 0);
    }

    // NOTE: Adds commands to context menus and atom.commands
    initCommands();
  },

  deactivate() {
    this.subscriptions.dispose();
    this.statusBarTile.destroy();
    this.statusBarView.destroy();

    if (this.client) this.client.disconnect();
    if (this.treeView) this.treeView.detach();

    this.client = null;
    this.treeView = null;
    this.statusBarTile = null;

    delete atom.project['remoteftp-main'];
    delete atom.project.remoteftp;
  },

  fileSaved(text) {
    if (!hasProject()) return;

    if (atom.config.get('Remote-FTP.connector.autoUploadOnSave') === 'never') return;

    if (!this.client.isConnected() && atom.config.get('Remote-FTP.connector.autoUploadOnSave') !== 'always') return;

    const local = text.path;

    if (!atom.project.contains(local)) return;

    // Read config if undefined
    if (!this.client.ftpConfigPath) {
      this.client.readConfig();
    }

    if (this.client.ftpConfigPath !== this.client.getConfigPath()) return;

    // .ftpignore filter
    if (this.client.checkIgnore(local)) return;

    if (local === this.client.getConfigPath()) return;
    // TODO: Add fix for files which are uploaded from a glob selector
    // don't upload files watched, they will be uploaded by the watcher
    // doesn't work fully with new version of watcher
    if (this.client.watch.files.indexOf(local) >= 0) return;

    // get file name for notification message
    const uploadedItem = atom.workspace.getActiveTextEditor().getFileName();

    this.client.upload(local, (err) => {
      if (atom.config.get('Remote-FTP.notifications.enableTransfer')) {
        if (err) {
          atom.notifications.addError(`Remote FTP: ${uploadedItem} could not upload.`);
        } else {
          atom.notifications.addSuccess(`Remote FTP: ${uploadedItem} uploaded.`);
        }
      }
    });
  },

  consumeElementIcons(fn) {
    setIconHandler(fn);
    return new Disposable(() => {
      setIconHandler(null);
    });
  },

  setStatusbar() {
    this.destroyStatusBar();
    if (!atom.config.get('Remote-FTP.statusbar.enable')) return;

    const options = {
      item: this.statusBarView,
      priority: atom.config.get('Remote-FTP.statusbar.priority'),
    };

    if (atom.config.get('Remote-FTP.statusbar.position') === 'left') {
      this.statusBar.activeBar = this.statusBar.addLeftTile(options);
    } else {
      this.statusBar.activeBar = this.statusBar.addRightTile(options);
    }
  },

  destroyStatusBar() {
    if (this.statusBar.activeBar) {
      this.statusBar.activeBar.destroy();
      this.statusBar.activeBar = null;
    }
  },

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    this.setStatusbar();
  },

};
