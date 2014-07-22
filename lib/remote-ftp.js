var fs, path, $, Client, TreeView, MoveDialog, AddDialog;

module.exports = {

    configDefaults: {
        hideLocalWhenDisplayed: false
    },

    treeView: null,
    client: null,

    activate: function (state) {
        if (!atom.project || !atom.project.path)
            return;

        var self = this;

        // Delay require
        if (!fs) {
            fs = require('fs-plus');
            path = require('path');
            Client = require('./client');
            TreeView = require('./views/tree-view');
            $ = require('atom').$;
        }

        atom.project.remoteftp = new Client();

        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.on('saved', self.fileSaved.bind(self));
        });

        atom.workspaceView.command('remote-ftp:create-config', function () {
            fs.writeFile(atom.project.resolve('.ftpconfig'), '{\n' +
                '    "host": "example.com",\n' +
                '    "port": "21",\n' +
                '    "user": "user",\n' +
                '    "password": "pass",\n' +
                '    "remote": "/",\n' +
                '    "secure": false,\n' +
                '    "secureOptions": null,\n' +
                '    "connTimeout": 10000,\n' +
                '    "pasvTimeout": 10000,\n' +
                '    "keepalive": 10000\n' +
                '}', function (err) {
                if (!err)
                    atom.workspace.open(atom.project.resolve('.ftpconfig'));
            })
        });

        atom.workspaceView.command('remote-ftp:toggle', function () {
            self.treeView.toggle();
        });

        atom.workspaceView.command('remote-ftp:connect', function () {
            atom.project.remoteftp.readConfig(function (e) {
                if (e) {
                    alert(e, 'Remote FTP');
                    return;
                }
                atom.project.remoteftp.connect();
            });
        });

        atom.workspaceView.command('remote-ftp:disconnect', function () {
            atom.project.remoteftp.disconnect();
        });

        atom.workspaceView.command('remote-ftp:add-file', function () {
            var remotes = self.treeView.getSelected();

            if (!AddDialog)
                AddDialog = require('./dialogs/add-dialog');

            var dialog = new AddDialog('');
    		dialog.on('new-path', function (e, name) {
                var remote = path.join(remotes[0].remote, name).replace(/\\/g, '/');

                atom.project.remoteftp.mkdir(remotes[0].remote, true, function (err) {
                    atom.project.remoteftp.mkfile(remote, function (err) {
                        dialog.close();

                        remotes[0].open();

                        if (!err)
                            atom.workspace.open(atom.project.remoteftp.toLocal(remote));
                    })
                });
    		});
            dialog.attach();
        });

        atom.workspaceView.command('remote-ftp:add-folder', function () {
            var remotes = self.treeView.getSelected();

            if (!AddDialog)
                AddDialog = require('./dialogs/add-dialog');

            var dialog = new AddDialog('');
            dialog.on('new-path', function (e, name) {
                var remote = path.join(remotes[0].remote, name).replace(/\\/g, '/');

                atom.project.remoteftp.mkdir(remote, true, function (err) {
                    dialog.close();

                    remotes[0].open();
                })
            });
            dialog.attach();
        });

        atom.workspaceView.command('remote-ftp:refresh-selected', function () {
            var remotes = self.treeView.getSelected();

            remotes.forEach(function (remote) {
                remote.open();
            });
        });

        atom.workspaceView.command('remote-ftp:move-selected', function () {
            var remotes = self.treeView.getSelected();

            if (!MoveDialog)
                MoveDialog = require('./dialogs/move-dialog');

            var dialog = new MoveDialog(remotes[0].remote);
    		dialog.on('path-changed', function (e, newremote) {
    			atom.project.remoteftp.rename(remotes[0].remote, newremote, function (error) {
    				if (error)
    					return;
    				dialog.close();

                    remotes[0].destroy();
                    var parent = atom.project.remoteftp.resolve(path.dirname(newremote).replace(/\\/g, '/'));
                    if (parent)
                        parent.open();
    			});
    		});
    		dialog.attach();
        });

        atom.workspaceView.command('remote-ftp:delete-selected', function () {
            var remotes = self.treeView.getSelected();

            atom.confirm({
    			message: "Are you sure you want to delete the selected item?",
    			detailedMessage: "You are deleting:"+ remotes.map(function (item) { return "\n  " + item.remote; }),
                buttons: {
    				"Move to Trash": function () {
    					remotes.forEach(function (item) {
                             if (!item) return;

                             atom.project.remoteftp.delete(item.remote, true, function (err, list) {
                                 if (list)
                                     list.forEach(function (item) {
                                         var dir = path.dirname(item.name).replace(/\\/g, '/'),
                                             parent = atom.project.remoteftp.resolve(dir);

                                         if (parent)
                                             parent.open();
                                     });
                             });
                         });
    				},
    				"Cancel": null
    			}
    		})
        });

        atom.workspaceView.command('remote-ftp:download-selected', function () {
            var remotes = self.treeView.getSelected();

            remotes.forEach(function (item) {
                if (!item) return;

                atom.project.remoteftp.download(item.remote, true, function (err) {

                })
            })
        });

        atom.workspaceView.command('remote-ftp:upload-selected', function () {
            var locals = $('.tree-view .selected').map(function () {
                var view = $(this).view();
                return view ? view.getPath() : '';
            }).get();

            locals.forEach(function (local) {
                if (!local) return;

                atom.project.remoteftp.upload(local, function (err, list) {
                    if (list)
                        list.forEach(function (item) {
                            var remote = atom.project.remoteftp.toRemote(item.name),
                                dir = path.join(remote, '..').replace(/\\/g, '/'),
                                parent = atom.project.remoteftp.resolve(dir);

                            if (parent)
                                parent.open();
                        });
                });
            });
        });

        self.treeView = new TreeView();
    },

    deactivate: function () {
        var self = this;
        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.off('saved', self.fileSaved);
        });

        atom.project.remoteftp.disconnect();
    },

    // File saved
    fileSaved: function (text) {
        var self = this;

        if (!atom.project.remoteftp.isConnected())
            return;

        var local = text.file.path;

        if (!atom.project.contains(local))
            return;

        var remote = atom.project.remoteftp.toRemote(text.file.path),
            parent = atom.project.remoteftp.resolve(path.dirname(remote).replace(/\\/g, '/'));

        atom.project.remoteftp.upload(local, function (err) {
            if (parent)
                parent.open();
        })
    }

}
