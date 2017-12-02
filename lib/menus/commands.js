'use babel';

import FS from 'fs-plus';
import Path from 'path';
import { $ } from 'atom-space-pen-views';
import {
  hasProject,
  getObject,
} from '../helpers';

import DirectoryView from '../views/directory-view';
import PermissionView from '../views/permission-view';
import AddDialog from '../dialogs/add-dialog';
import MoveDialog from '../dialogs/move-dialog';
import NavigateTo from '../dialogs/navigate-to-dialog';


const init = () => {
  const client = atom.project.remoteftp;
  const remoteftp = atom.project['remoteftp-main'];

  const getRemotes = (errMessage) => {
    const remotes = remoteftp.treeView.getSelected();

    if (!remotes || remotes.length === 0) {
      atom.notifications.addWarning(`Remote FTP: ${errMessage}`, {
        dismissable: false,
      });
      return false;
    }

    return remotes;
  };

  const createConfig = (obj) => {
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
          keyboardInteractiveForPass: false,
          remoteCommand: '',
          remoteShell: '',
          watch: [],
          watchTimeout: 500,
        });
      },
    },
    'remote-ftp:create-ignore-file': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const fileContents = ['.ftpconfig', '.ftpignore', 'id_rsa', '.DS_Store', '.git'];
        const ftpIgnorePath = client.getFilePath('./.ftpignore');

        FS.writeFile(ftpIgnorePath, fileContents.join('\n'), (err) => {
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
            atom.notifications.addError('Remote FTP: Could not read `.ftpconfig` file.', {
              detail: e,
              dismissable: false,
            });

            return;
          }

          let hideFTPTreeView = false;
          if (!remoteftp.treeView.isVisible()) {
            remoteftp.treeView.toggle();
            hideFTPTreeView = true;
          }

          client.connect();

          if (hideFTPTreeView) {
            atom.project.remoteftp.emitter.once('connected', () => {
              remoteftp.treeView.toggle();
            });
          }
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
          atom.notifications.addError(`Remote FTP: Cannot add a file to ${remotes[0].item.remote}`, {
            dismissable: false,
          });

          return;
        }

        const dialog = new AddDialog('', true);

        dialog.on('new-path', (e, name) => {
          const remote = Path.join(remotes[0].item.remote, name).replace(/\\/g, '/');
          dialog.close();
          client.mkdir(remotes[0].item.remote, true, () => {
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
          atom.notifications.addError(`Remote FTP: Cannot add a folder to ${remotes[0].item.remote}`, {
            dismissable: false,
          });
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
          client.rename(remotes[0].item.remote, newremote, (err) => {
            const errMessage = getObject({
              obj: err,
              keys: ['message'],
            });

            dialog.close();

            if (errMessage === 'file exists' || errMessage === 'File already exists') {
              atom.notifications.addError('Remote FTP: File / Folder already exists.', {
                dismissable: false,
              });
              return;
            }

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
            'Move to Trash': () => {
              remotes.forEach((view) => {
                if (!view) return;

                const dir = Path.dirname(view.item.remote).replace(/\\/g, '/');
                const parent = remoteftp.treeView.resolve(dir);

                client.delete(view.item.remote, (err) => {
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
    'remote-ftp:download-active': {
      enabled: true,
      command() {
        if (!hasProject()) return;
        if (!client.isConnected()) return;
        if (client.ftpConfigPath !== client.getConfigPath()) return;

        const activeTextEditor = atom.workspace.getActiveTextEditor();

        if (typeof activeTextEditor === 'undefined') return;

        const currentPath = activeTextEditor.getPath();

        if (currentPath === client.getConfigPath()) return;
        if (client.watch.files.indexOf(currentPath) >= 0) return;

        const downloadItem = client.toRemote(currentPath);
        client.download(downloadItem, true, () => {

        });
      },
    },
    'remote-ftp:download-selected-local': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        if (client.root.local === '') {
          atom.notifications.addError('Remote FTP: You must define your local root folder in the projects .ftpconfig file.', {
            dismissable: false,
          });

          return;
        }

        if (!client.isConnected()) {
          const viewWorkspace = atom.views.getView(atom.workspace);

          atom.commands.dispatch(viewWorkspace, 'remote-ftp:connect');

          atom.project.remoteftp.onceConnected(() => {
            atom.commands.dispatch(viewWorkspace, 'remote-ftp:download-selected-local');
          });

          return;
        }

        // TODO: correctly count files within a subdirectory
        const $treeSelected = $('.tree-view .selected');
        const requestedTransfers = $treeSelected.length;

        let successfulTransfers = 0;
        let attemptedTransfers = 0;

        $treeSelected.each((key, elem) => {
          const path = elem.getPath ? elem.getPath() : '';
          const localPath = path.replace(client.root.local, '');
          const remotePath = Path.posix.normalize((atom.project.remoteftp.root.remote + localPath).replace(/\\/g, '/'));
 
          client.download(remotePath, true, () => {
            if (atom.config.get('Remote-FTP.notifications.enableTransfer')) {
              // TODO: check if any errors were thrown, indicating an unsuccessful transfer
              attemptedTransfers++;
              successfulTransfers++;
            }
          });
        });

        if (atom.config.get('Remote-FTP.notifications.enableTransfer')) {
          const waitingForTransfers = setInterval(() => {
            if (attemptedTransfers === requestedTransfers) {
              // we're done waiting
              clearInterval(waitingForTransfers);

              if (successfulTransfers === requestedTransfers) {
                // great, all uploads worked
                atom.notifications.addSuccess(`Remote FTP: All transfers succeeded (${successfulTransfers} of ${requestedTransfers}).`);
              } else {
                // :( some uploads failed
                atom.notifications.addError(`Remote FTP: Some transfers failed<br />There were ${successfulTransfers} successful out of an expected ${requestedTransfers}.`);
              }
            }
          }, 200);
        }
      },
    },
    'remote-ftp:upload-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        if (!client.isConnected()) {
          const viewWorkspace = atom.views.getView(atom.workspace);

          atom.commands.dispatch(viewWorkspace, 'remote-ftp:connect');

          atom.project.remoteftp.onceConnected(() => {
            atom.commands.dispatch(viewWorkspace, 'remote-ftp:upload-selected');
          });

          return;
        }

        const locals = $('.tree-view .selected').map(function MAP() {
          return this.getPath ? this.getPath() : '';
        }).get();

        const enableTransfer = atom.config.get('Remote-FTP.notifications.enableTransfer');

        let successfulTransfers;
        let attemptedTransfers;

        if (enableTransfer) {
          successfulTransfers = 0;
          attemptedTransfers = 0;
        }

        locals.forEach((local) => {
          if (!local) return;

          client.upload(local, (err, list) => {
            if (enableTransfer) { attemptedTransfers++; }
            if (err && !/File exists/.test(err)) {
              console.error(err);
              return;
            }

            if (enableTransfer) { successfulTransfers++; }

            const dirs = [];
            list.forEach((item) => {
              const remote = client.toRemote(item.name);
              const dir = Path.dirname(remote);
              if (dirs.indexOf(dir) === -1) dirs.push(dir);
            });

            dirs.forEach((dir) => {
              const view = remoteftp.treeView.resolve(dir);
              if (view) view.open();
            });
          });
        });

        if (atom.config.get('Remote-FTP.notifications.enableTransfer')) {
          const waitingForTransfers = setInterval(() => {
            if (attemptedTransfers === locals.length) {
              // we're done waiting
              clearInterval(waitingForTransfers);

              if (successfulTransfers === locals.length) {
                // great, all uploads worked
                atom.notifications.addSuccess(`Remote FTP: All transfers succeeded (${successfulTransfers} of ${locals.length}).`);
              } else {
                // :( some uploads failed
                atom.notifications.addError(`Remote FTP: Some transfers failed<br />There were ${successfulTransfers} successful out of an expected ${locals.length}.`);
              }
            }
          }, 200);
        }
      },
    },
    'remote-ftp:upload-active': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const editor = atom.workspace.getActiveTextEditor();
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

          // checking to see if we're working with a file
          if (view.item.constructor.name === 'File') {
            try {
              client.syncRemoteFileToLocal(view.item.remote);
            } catch (err) {
              // syncRemoteFileToLocal() is not setup to return any errors here,
              // as they are handled else where. TODO: perhaps look into a way to restructure
              // sequence to handle all errors in one location (here)
              atom.notifications.addError(`Remote FTP: Error Syncing "${Path.basename(view.item.remote)}" to local.`, {
                dismissable: true,
              });
            } finally {
              // TODO: Verify transfer was completed successfully by checking files
              // and verifying sizes or hash of both files
              atom.notifications.addInfo(`Remote FTP: Synced "${Path.basename(view.item.remote)}" to local.`, {
                dismissable: false,
              });
            }
          } else { // process sync for entire directory
            const isFile = false;
            try {
              client.syncRemoteDirectoryToLocal(view.item.remote, isFile);
            } catch (err) {
              // syncRemoteDirectoryToLocal() is not setup to return any errors here,
              // as they are handled else where. TODO: perhaps look into a way to restructure
              // sequence to handle all errors in one location (here)
              atom.notifications.addError(`Remote FTP: Error in Syncing "${Path.basename(view.item.remote)}" to local.`, {
                dismissable: true,
              });
            } finally {
              // TODO: Verify transfer was completed successfully by checking files
              // and verifying sizes or hash of both files
              atom.notifications.addInfo(`Remote FTP: Synced "${Path.basename(view.item.remote)}" to local.`, {
                dismissable: false,
              });
            }
          }
        });
      },
    },

    // Local -> Remote
    'remote-ftp:sync-with-local': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        if (!client.isConnected()) {
          const viewWorkspace = atom.views.getView(atom.workspace);

          atom.commands.dispatch(viewWorkspace, 'remote-ftp:connect');

          atom.project.remoteftp.emitter.once('connected', () => {
            atom.commands.dispatch(viewWorkspace, 'remote-ftp:sync-with-local');
          });

          return;
        }

        const locals = $('.tree-view .selected').map(function MAP() {
          return this.getPath ? this.getPath() : '';
        }).get();

        locals.forEach((local) => {
          if (!local) return;

          // checking to see if we're working with a file
          if (FS.isFileSync(local) === true) {
            try {
              client.syncLocalFileToRemote(local);
            } catch (err) {
              // syncLocalFileToRemote() is not setup to return any errors here,
              // as they are handled else where. TODO: perhaps look into a way to restructure
              // sequence to handle all errors in one location (here)
              atom.notifications.addError(`Remote FTP: Error Syncing "${Path.basename(local)}" to remote.`, {
                dismissable: true,
              });
            } finally {
              // TODO: Verify transfer was completed successfully by checking remote
              // and verifying sizes or hash of both files
              atom.notifications.addInfo(`Remote FTP: Synced "${Path.basename(local)}" to remote.`, {
                dismissable: false,
              });
            }
          } else { // process sync for entire directory
            try {
              client.syncLocalDirectoryToRemote(local, () => {
                // TODO: Verify transfer was completed successfully by checking remote
                // and verifying sizes or hash of both files
                atom.notifications.addInfo(`Remote FTP: Synced "${local}" to remote.`, {
                  dismissable: false,
                });
              });
            } catch (err) {
              // syncLocalDirectoryToRemote() is not setup to return any errors here,
              // as they are handled else where. TODO: perhaps look into a way to restructure
              // sequence to handle all errors in one location (here)
              atom.notifications.addError(`Remote FTP: Error Syncing "${local}" to remote.`, {
                dismissable: true,
              });
            }
          }
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

    'remote-ftp:permission-selected': {
      enabled: true,
      command() {
        if (!hasProject()) return;

        const remotes = remoteftp.treeView.getSelected();
        if (!remotes || remotes.length === 0) return;

        const isRoot = remotes[0].hasClass('project-root');
        if (isRoot) return;

        const original = remotes[0].item.original;

        const permission = new PermissionView({
          rights: original.rights,
          group: original.group,
          owner: original.owner,
        }, remotes[0]);
      },
    },

  };

  return commands;
};

export default init;
