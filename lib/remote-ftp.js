'use babel';

import { File, Disposable, CompositeDisposable } from 'atom';
import Path from 'path';
import Client from './client';
import TreeView from './views/tree-view';
import StatusBarView from './views/status-bar';
import { hasProject, setIconHandler } from './helpers';
import initCommands from './menus/main';
import config from './config-schema.json';
import RemoteStorage from './remote-storage';

export default {

  config,
  client: null,
  treeView: null,
  statusBarTile: null,
  statusBarView: null,
  subscriptions: null,

  activate(state) {
    this.storage = new RemoteStorage(state);

    if (this.subscriptions) {
      this.deactivate();
    }

    this.config = config;
    this.client = new Client();
    atom.project.remoteftpMain = this; // change remoteftp to object containing client and main?
    atom.project.remoteftp = this.client;
    this.treeView = new TreeView(this.storage);

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

      atom.workspace.paneContainers.left.onDidChangeActivePaneItem((activeItem) => {
        if (this.treeView !== activeItem) return;

        this.storage.data.options.treeViewSide = 'left';
      }),

      atom.workspace.paneContainers.right.onDidChangeActivePaneItem((activeItem) => {
        if (this.treeView !== activeItem) return;

        this.storage.data.options.treeViewSide = 'right';
      }),

      atom.workspace.paneContainers.bottom.onDidChangeActivePaneItem((activeItem) => {
        if (this.treeView !== activeItem) return;

        this.storage.data.options.treeViewSide = 'bottom';
      }),

      atom.workspace.paneContainers.left.onDidChangeVisible((visible) => {
        if (this.storage.data.options.treeViewSide !== 'left') return;

        this.storage.data.options.treeViewShow = visible;
      }),

      atom.workspace.paneContainers.right.onDidChangeVisible((visible) => {
        if (this.storage.data.options.treeViewSide !== 'right') return;

        this.storage.data.options.treeViewShow = visible;
      }),

      atom.workspace.paneContainers.bottom.onDidChangeVisible((visible) => {
        if (this.storage.data.options.treeViewSide !== 'bottom') return;

        this.storage.data.options.treeViewShow = visible;
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
          if (exists && atom.config.get('remote-ftp.tree.showViewOnStartup')) {
            this.treeView.attach();
          }
        }).catch((error) => {
          const err = (error.reason) ? error.reason : error.message;

          atom.notifications.addWarning(err);
        });
      }, 0);
    }

    // NOTE: Adds commands to context menus and atom.commands
    initCommands();
  },

  deactivate() {
    this.subscriptions.dispose();
    this.destroyStatusBar();

    if (this.client) this.client.disconnect();
    if (this.treeView) this.treeView.detach();

    this.client = null;
    this.treeView = null;

    delete atom.project.remoteftpMain;
    delete atom.project.remoteftp;
  },

  fileSaved(text) {
    if (!hasProject()) return;

    if (!this.storage.data.options.autosave) return;
    if (atom.config.get('remote-ftp.connector.autoUploadOnSave') === 'never') return;

    if (!this.client.isConnected() && atom.config.get('remote-ftp.connector.autoUploadOnSave') !== 'always') return;

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
      if (atom.config.get('remote-ftp.notifications.enableTransfer')) {
        if (err) {
          atom.notifications.addError(`Remote FTP: ${uploadedItem} could not upload.`);
        } else {
          atom.notifications.addSuccess(`Remote FTP: ${uploadedItem} uploaded.`);
        }
      }
    });
  },

  serialize() {
    return this.storage.data;
  },

  consumeElementIcons(fn) {
    setIconHandler(fn);
    return new Disposable(() => {
      setIconHandler(null);
    });
  },

  setStatusbar(statusBar) {
    this.destroyStatusBar(statusBar);

    this.subscriptions.add(
      atom.config.onDidChange('remote-ftp.statusbar.enable', () => {
        this.setStatusbar(statusBar);
      }),
    );

    if (!atom.config.get('remote-ftp.statusbar.enable')) return;

    this.statusBarView = new StatusBarView();

    const options = {
      item: this.statusBarView,
      priority: atom.config.get('remote-ftp.statusbar.priority'),
    };

    if (atom.config.get('remote-ftp.statusbar.position') === 'left') {
      this.statusBarTile = statusBar.addLeftTile(options);
    } else {
      this.statusBarTile = statusBar.addRightTile(options);
    }

    this.subscriptions.add(
      atom.config.onDidChange('remote-ftp.statusbar.position', () => {
        this.setStatusbar(statusBar);
      }),

      atom.config.onDidChange('remote-ftp.statusbar.priority', () => {
        this.setStatusbar(statusBar);
      }),
    );
  },

  destroyStatusBar() {
    if (this.statusBarTile) {
      this.statusBarTile.destroy();
      this.statusBarTile = null;
    }

    if (this.statusBarView) {
      this.statusBarView.dispose();
      this.statusBarView = null;
    }
  },

  consumeStatusBar(statusBar) {
    this.setStatusbar(statusBar);
  },

};
