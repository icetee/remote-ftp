'use babel';

import FS from 'fs-plus';
import Path from 'path';
import Client from './client';
import TreeView from './views/tree-view';
import {
  hasProject,
  setIconHandler,
} from './helpers';
import initCommands from './menus/main';

import { Disposable } from 'atom';
const atom = global.atom;
const config = require('./config-schema.json');

class Main {

  constructor() {
    const self = this;
    self.config = config;
    self.treeView = null;
    self.client = null;
    self.listeners = [];
  }

  activate() {
    const self = this;

    self.client = new Client();
    atom.project['remoteftp-main'] = self; // change remoteftp to object containing client and main?
    atom.project.remoteftp = self.client;
    self.treeView = new TreeView();

    self.treeView.detach();


    self.client.on('connected', () => {
      self.treeView.root.name.attr('data-name', Path.basename(self.client.root.remote));
      self.treeView.root.name.attr('data-path', self.client.root.remote);
    });


    // NOTE: if there is a project folder & show view on startup
    //  is true, show the Remote FTP sidebar

    if (hasProject()) {
      // NOTE: setTimeout is for when multiple hosts option is true
      setTimeout(() => {
        FS.exists(self.client.getConfigPath(), (exists) => {
          if (exists && atom.config.get('Remote-FTP.showViewOnStartup')) {
            self.treeView.attach();
          }
        });
      }, 0);
    }

    // NOTE: Adds commands to context menus and atom.commands
    initCommands();

    atom.workspace.observeTextEditors((ed) => {
      const buffer = ed.buffer;
      const listener = buffer.onDidSave(self.fileSaved.bind(self));
      self.listeners.push(listener);
    });

    self.listeners.push(atom.project.onDidChangePaths(() => {
      if (!hasProject() || !self.client.isConnected()) return;
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:disconnect');
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:connect');
    }));
  }

  deactivate() {
    const self = this;
    self.listeners.forEach(listener => listener.dispose());
    self.listeners = [];
    if (self.client) self.client.disconnect();
  }

  fileSaved(text) {
    const self = this;
    if (!hasProject()) return;

    if (atom.config.get('Remote-FTP.autoUploadOnSave') === 'never') return;

    if (!self.client.isConnected() && atom.config.get('Remote-FTP.autoUploadOnSave') !== 'always') return;

    const local = text.path;

    if (!atom.project.contains(local)) return;
    if (self.client.ftpConfigPath !== self.client.getConfigPath()) return;

    if (local === self.client.getConfigPath()) return;
    // TODO: Add fix for files which are uploaded from a glob selector
    // don't upload files watched, they will be uploaded by the watcher
    // doesn't work fully with new version of watcher
    if (self.client.watch.files.indexOf(local) >= 0) return;

    self.client.upload(local, () => {
      try {
        const remote = self.client.toRemote(local);
        const parent = self.client.resolve(Path.dirname(remote)
          .replace(/\\/g, '/'));
        if (parent) parent.open();
      } catch (e) {}
    });
  }

  consumeElementIcons(fn) {
    setIconHandler(fn);
    return new Disposable(() => {
      setIconHandler(null);
    });
  }

}

export default new Main();
