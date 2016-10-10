'use babel';

import FS from 'fs-plus';
import Path from 'path';
import { $ } from 'atom-space-pen-views';
import {
  hasProject,
} from '../helpers';
import Directory from '../directory';
import DirectoryView from '../views/directory-view';
import AddDialog from '../dialogs/add-dialog';
import MoveDialog from '../dialogs/move-dialog';
import NavigateTo from '../dialogs/navigate-to-dialog';


const init = function INIT() {
  const atom = global.atom;
  const client = atom.project.remoteftp;
  const remoteftp = atom.project['remoteftp-main'];
  const getRemotes = function GETREMOTES(errMessage) {
    const remotes = remoteftp.treeView.getSelected();

    if (!remotes || remotes.length === 0) {
      atom.notifications.addError(`Remote FTP: ${errMessage}`);
      return false;
    }

    return remotes;
  };

  const createConfig = function CREATECONFIG(obj) {
    if (!hasProject()) return;

    const ftpConfigPath = client.getConfigPath();
    const fileExists = FS.existsSync(ftpConfigPath);
    const json = JSON.stringify(obj, null, 4);

    let writeFile = true;
    if (fileExists) {
      writeFile = atom.confirm({
        message: 'Do you want to overwrite .ftpconfig?',
        detailedMessage: `You are overwriting ${ftpConfigPath}`,
        buttons: {
          Yes: () => true,
          No: () => false,
        },
      });
    }
    if (writeFile) {
      FS.writeFile(ftpConfigPath, json, (err) => {
        if (!err) atom.workspace.open(ftpConfigPath);
      });
    }
  };


  const commands = {
    'remote-ftp:create-ftp-config': {
      enabled: true,
      command() {
        createConfig({
          protocol: 'ftp',
          host: 'example.com',
          port: 21,
          user: 'user',
          pass: 'pass',
          promptForPass: false,
          remote: '/',
          local: '',
          secure: false,
          secureOptions: null,
          connTimeout: 10000,
          pasvTimeout: 10000,
          keepalive: 10000,
          watch: [],
          watchTimeout: 500,
        });
      },
    },
    'remote-ftp:create-sftp-config': {
      enabled: true,
      command() {
        createConfig({
          protocol: 'sftp',
          host: 'example.com',
          port: 22,
          user: 'user',
          pass: 'pass',
          promptForPass: false,
          remote: '/',
          local: '',
          agent: '',
          privatekey: '',
          passphrase: '',
          hosthash: '',
          ignorehost: true,
          connTimeout: 10000,
          keepalive: 10000,
          keyboardInteractive: false,
          watch: [],
          watchTimeout: 500,
        });
      },
    },
    'remote-ftp:create-ignore-file': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const fileContents = `
      # Please note that this is a beta-feature and will only work with local-to-remote sync!
      # For example, the following patterns will be ignored on sync:
      .ftpconfig
      .DS_Store
      `;

        const ftpIgnorePath = client.getFilePath('./ftpignore');

        FS.writeFile(ftpIgnorePath, fileContents, (err) => {
          if (!err) atom.workspace.open(ftpIgnorePath);
        });
      },
    },
    'remote-ftp:toggle': {
      enabled: true,
      command() {
        remoteftp.treeView.toggle();
      },
    },
    'remote-ftp:connect': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        client.readConfig((e) => {
          if (e) {
            atom.notifications.addError('Remote FTP: Could not read `.ftpconfig` file', {
              detail: e,
            });

            return;
          }

          if (!remoteftp.treeView.isVisible()) {
            remoteftp.treeView.toggle();
          }

          client.connect();
        });
      },
    },
    'remote-ftp:disconnect': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        client.disconnect();
      },
    },
    'remote-ftp:add-file': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;
        if (!(remotes[0] instanceof DirectoryView)) {
          atom.notifications.addError(`Remote FTP: Cannot add a file to ${remotes[0].item.remote}`);
          return;
        }
        const dialog = new AddDialog('', true);
        dialog.on('new-path', (e, name) => {
          const remote = Path.join(remotes[0].item.remote, name)
            .replace(/\\/g, '/');
          dialog.close();
          client.mkdir(remote[0].item.remote, true, () => {
            client.mkfile(remote, (err) => {
              remotes[0].open();
              if (!err) atom.workspace.open(client.toLocal(remote));
            });
          });
        });

        dialog.attach();
      },
    },
    'remote-ftp:add-folder': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;
        if (!(remotes[0] instanceof DirectoryView)) {
          atom.notifications.addError(`Remote FTP: Cannot add a folder to ${remotes[0].item.remote}`);
          return;
        }

        const dialog = new AddDialog('');

        dialog.on('new-path', (e, name) => {
          const remote = Path.join(remotes[0].item.remote, name)
            .replace(/\\/g, '/');
          client.mkdir(remote, true, () => {
            dialog.close();
            remotes[0].open();
          });
        });
        dialog.attach();
      },
    },
    'remote-ftp:refresh-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;

        remotes.forEach((remote) => {
          remote.open();
        });
      },
    },
    'remote-ftp:move-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;

        const dialog = new MoveDialog(remotes[0].item.remote);

        dialog.on('path-changed', (e, newremote) => {
          atom.project.remoteftp.rename(remotes[0].item.remote, newremote, () => {
            dialog.close();
            const parentNew = remoteftp.treeView.resolve(Path.dirname(newremote));
            if (parentNew) parentNew.open();
            const parentOld = remoteftp.treeView.resolve(Path.dirname(remotes[0].item.remote));
            if (parentOld && parentOld !== parentNew) parentOld.open();
            remotes[0].destroy();
          });
        });
        dialog.attach();
      },
    },
    'remote-ftp:delete-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;

        atom.confirm({
          message: 'Are you sure you want to delete the selected item ?',
          detailedMessage: `You are deleting:${remotes.map(view => `\n  ${view.item.remote}`)}`,
          buttons: {
            'Move to Trash': function MOVETOTRASH() {
              remotes.forEach((view) => {
                if (!view) return;

                const dir = Path.dirname(view.item.remote)
                  .replace(/\\/g, '/');
                const parent = remoteftp.treeView.resolve(dir);

                atom.project.remoteftp.delete(view.item.remote, (err) => {
                  if (!err && parent) {
                    parent.open();
                  }
                });
              });
            },
            Cancel: null,
          },
        });
      },
    },
    'remote-ftp:download-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = getRemotes('You need to select a folder first');
        if (remotes === false) return;

        remotes.forEach((view) => {
          if (!view) return;

          client.download(view.item.remote, true, () => {

          });
        });
      },
    },
    'remote-ftp:download-selected-local': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        if (client.root.local === '') {
          atom.notifications.addError("Remote FTP: You must define your local root folder in the project's .ftpconfig file.");
          return;
        }

        if (!client.isConnected()) {
          // just connect
          atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:connect');

          atom.project.remoteftp.once('connected', () => {
            atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:download-selected-local');
          });

          return;
        }

        $('.tree-view .selected').each(function MAP() {
          const path = this.getPath ? this.getPath() : '';
          const localPath = path.replace(atom.project.remoteftp.root.local, '');
          // if this is windows, the path may have \ instead of / as directory separators
          const remotePath = atom.project.remoteftp.root.remote + localPath.replace(/\\/g, '/');
          atom.project.remoteftp.download(remotePath, true, () => {
          });
        });

        return;
      },
    },
    'remote-ftp:upload-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const locals = $('.tree-view .selected').map(function MAP() {
          return this.getPath ? this.getPath() : '';
        })
        .get();

        const filteredLocals = remoteftp.omitIgnored(locals);

        filteredLocals.forEach((local) => {
          if (!local) return;

          client.upload(local, (err, list) => {
            if (err) return;

            const dirs = [];
            list.forEach((item) => {
              const remote = atom.project.remoteftp.toRemote(item.name);
              const dir = Path.dirname(remote);
              if (dirs.indexOf(dir) === -1) dirs.push(dir);
            });

            dirs.forEach((dir) => {
              const view = remoteftp.treeView.resolve(dir);
              if (view) view.open();
            });
          });
        });
      },
    },
    'remote-ftp:upload-active': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const editor = atom.workspace.getActivePaneItem();
        if (!editor) return;

        const local = editor.getPath();

        client.upload(local, (err, list) => {
          if (err) return;

          const dirs = [];
          list.forEach((item) => {
            const remote = atom.project.remoteftp.toRemote(item.name);
            const dir = Path.dirname(remote);
            if (dirs.indexOf(dir) === -1) dirs.push(dir);
          });

          dirs.forEach((dir) => {
            const view = remoteftp.treeView.resolve(dir);
            if (view) view.open();
          });
        });
      },
    },
    // Remote -> Local
    'remote-ftp:sync-with-remote': {
      enabled: true,
      command() {
        const remotes = remoteftp.treeView.getSelected();

        remotes.forEach((view) => {
          if (!view) return;

          atom.project.remoteftp.syncRemoteLocal(view.item.remote, () => {

          });
        });
      },
    },

    // Local -> Remote
    'remote-ftp:sync-with-local': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const locals = $('.tree-view .selected').map(function MAP() {
          return this.getPath ? this.getPath() : '';
        })
        .get();

        const filteredLocals = remoteftp.omitIgnored(locals);

        filteredLocals.forEach((local) => {
          if (!local) return;

          client.syncLocalRemote(local, () => {
            const remote = client.toRemote(local);
            if (remote) {
              let parent = remoteftp.treeView.resolve(remote);
              if (parent && !(parent.item instanceof Directory)) {
                parent = remoteftp.treeView.resolve(Path.dirname(remote).replace(/\\/g, '/'));
              }
              if (parent) parent.open();
            }
          });
        });
      },
    },
    'remote-ftp:abort-current': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        client.abort();
      },
    },
    'remote-ftp:navigate-to': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        const dialog = new NavigateTo();
        dialog.on('navigate-to', (e, path) => {
          dialog.close();
          client.root.openPath(path);
        });
        dialog.attach();
      },
    },
    'remote-ftp:copy-name': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        const remotes = remoteftp.treeView.getSelected();
        if (!remotes || remotes.length === 0) return;
        const name = `${remotes.map(data => data.item.name)}`;
        atom.clipboard.write(name);
      },
    },

  };

  return commands;
};

export default init;
