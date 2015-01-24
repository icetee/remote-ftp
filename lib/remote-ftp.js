var FS, Path, $, Client, TreeView, AddDialog, MoveDialog;

function hasProject () {
	return atom.project.path !== undefined;
}

function isConnected () {
	return atom.project.remoteftp ? atom.project.remoteftp.isConnected() : false;
}

module.exports = {
	configDefaults: {
		hideLocalWhenDisplayed: false
	},

	treeView: null,
	client: null,

	activate: function (state) {
		var self = this;

		//if (!atom.project || !atom.project.path)
		//	return;


		if (!FS) {
			FS = require('fs-plus');
			Path = require('path');
			$ = require('atom').$;

			Client = require('./client');
			TreeView = require('./views/tree-view');
		}

		atom.project.remoteftp = new Client();

		self.treeView = new TreeView();
		self.treeView.detach();
		setTimeout(function () {
			self.treeView.attach();
			self.treeView.hide();
		}, 1);

		if (hasProject()) {
			FS.exists(atom.project.resolve('.ftpconfig'), function (exists) {
				if (exists)
					self.treeView.show();
			});
		}

		atom.commands.add('atom-workspace', {

			'remote-ftp:create-ftp-config': function () {
				if (!hasProject()) return;

				FS.writeFile(atom.project.resolve('.ftpconfig'), '{\n\
    "protocol": "ftp",\n\
	"host": "example.com",\n\
    "port": 21,\n\
    "user": "user",\n\
    "pass": "pass",\n\
    "remote": "/",\n\
    "secure": false,\n\
    "secureOptions": null,\n\
    "connTimeout": 10000,\n\
    "pasvTimeout": 10000,\n\
    "keepalive": 10000\n\
}'			, function (err) {
					if (!err)
						atom.workspace.open(atom.project.resolve('.ftpconfig'));
				});
			},

			'remote-ftp:create-sftp-config': function () {
				if (!hasProject()) return;

				FS.writeFile(atom.project.resolve('.ftpconfig'), '{\n\
    "protocol": "sftp",\n\
	"host": "example.com",\n\
    "port": 22,\n\
    "user": "user",\n\
    "pass": "pass",\n\
    "remote": "/",\n\
	"agent": "",\n\
    "privatekey": "",\n\
	"passphrase": "",\n\
	"hosthash": "",\n\
	"ignorehost": true,\n\
	"connTimeout": 10000,\n\
	"keepalive": 10000\n\
}'			, function (err) {
					if (!err)
						atom.workspace.open(atom.project.resolve('.ftpconfig'));
				});
			},

			'remote-ftp:toggle': function () {
				if (!hasProject()) return;

	            self.treeView.toggle();
	        },

	        'remote-ftp:connect': function () {
				if (!hasProject()) return;

	            atom.project.remoteftp.readConfig(function (e) {
	                if (e) {
						throw "Could not read `.ftpconfig` file";
	                    return;
	                }
	                atom.project.remoteftp.connect();
	            });
	        },

	        'remote-ftp:disconnect': function () {
				if (!hasProject()) return;

	            atom.project.remoteftp.disconnect();
	        },

	        'remote-ftp:add-file': function () {
				if (!hasProject() || !isConnected()) return;

	            var remotes = self.treeView.getSelected();

	            if (!AddDialog)
	                AddDialog = require('./dialogs/add-dialog');

	            var dialog = new AddDialog('');
	    		dialog.on('new-path', function (e, name) {
					dialog.close();

	                var remote = Path.join(remotes[0].remote, name).replace(/\\/g, '/');

	                atom.project.remoteftp.mkdir(remotes[0].remote, true, function (err) {
	                    atom.project.remoteftp.mkfile(remote, function (err) {

	                        remotes[0].open();

	                        if (!err)
	                            atom.workspace.open(atom.project.remoteftp.toLocal(remote));
	                    })
	                });
	    		});
	            dialog.attach();
	        },

	        'remote-ftp:add-folder': function () {
				if (!hasProject() || !isConnected()) return;

	            var remotes = self.treeView.getSelected();

	            if (!AddDialog)
	                AddDialog = require('./dialogs/add-dialog');

	            var dialog = new AddDialog('');
	            dialog.on('new-path', function (e, name) {
	                var remote = Path.join(remotes[0].remote, name).replace(/\\/g, '/');

	                atom.project.remoteftp.mkdir(remote, true, function (err) {
	                    dialog.close();

	                    remotes[0].open();
	                })
	            });
	            dialog.attach();
	        },

	        'remote-ftp:refresh-selected': function () {
				if (!hasProject() || !isConnected()) return;

	            var remotes = self.treeView.getSelected();

	            remotes.forEach(function (remote) {
	                remote.open();
	            });
	        },

	        'remote-ftp:move-selected': function () {
				if (!hasProject() || !isConnected()) return;

	            var remotes = self.treeView.getSelected();

	            if (!MoveDialog)
	                MoveDialog = require('./dialogs/move-dialog');

	            var dialog = new MoveDialog(remotes[0].remote);
	    		dialog.on('path-changed', function (e, newremote) {
	    			atom.project.remoteftp.rename(remotes[0].remote, newremote, function (error) {

	    				if (error) {
	    					dialog.close();
	    					return;
						}

	                    remotes[0].destroy();
	                    var parent = atom.project.remoteftp.resolve(Path.dirname(newremote).replace(/\\/g, '/'));
	                    if (parent)
	                        parent.open();
	    			});
	    		});
	    		dialog.attach();
	        },

	        'remote-ftp:delete-selected': function () {
				if (!hasProject() || !isConnected()) return;

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
	                                         var dir = Path.dirname(item.name).replace(/\\/g, '/'),
	                                             parent = atom.project.remoteftp.resolve(dir);

	                                         if (parent)
	                                             parent.open();
	                                     });
	                             });
	                         });
	    				},
	    				"Cancel": null
	    			}
	    		});
	        },

	       'remote-ftp:download-selected': function () {
				if (!hasProject() || !isConnected()) return;

	            var remotes = self.treeView.getSelected();

	            remotes.forEach(function (item) {
	                if (!item) return;

	                atom.project.remoteftp.download(item.remote, true, function (err) {

	                })
	            })
	        },

	        'remote-ftp:upload-selected': function () {
				if (!hasProject() || !isConnected()) return;

	            var locals = $('.tree-view .selected').map(function () {
	                return this.getPath ? this.getPath() : '';
	            }).get();

	            locals.forEach(function (local) {
	                if (!local) return;

	                atom.project.remoteftp.upload(local, function (err, list) {
						// TODO refresh parent ?
	                    /*if (list) {
	                        list.forEach(function (item) {
	                            var remote = atom.project.remoteftp.toRemote(item.name),
	                                dir = Path.join(remote, '..').replace(/\\/g, '/'),
	                                parent = atom.project.remoteftp.resolve(dir);

	                            if (parent)
	                                parent.open();
	                        });
						}*/
	                });
	            });
	        },

			'remote-ftp:abort-current': function () {
				if (!hasProject()) return;

				atom.project.remoteftp.abort();
			}

		})

		atom.workspace.eachEditor(function (ed) {
			var buffer = ed.buffer;
			buffer.on('saved', self.fileSaved.bind(self));
		});
	},

	deactivate: function () {
		var self = this;
		atom.workspace.eachEditor(function (ed) {
			var buffer = ed.buffer;
			buffer.off('saved', self.fileSaved);
		});

		if (atom.project.remoteftp)
			atom.project.remoteftp.disconnect();
	},

	fileSaved: function (text) {
		if (!hasProject() || !isConnected()) return;

		var self = this;

		//if (!atom.project.remoteftp.isConnected())
		//	return;

		var local = text.file.path;

		if (!atom.project.contains(local))
			return;

		if (local == atom.project.resolve('.ftpconfig'))
			return;

		atom.project.remoteftp.upload(local, function (err) {
			try {
				var remote = atom.project.remoteftp.toRemote(local),
					parent = atom.project.remoteftp.resolve(Path.dirname(remote).replace(/\\/g, '/'));
				if (parent)
					parent.open();
			} catch (e) {}
		});
	}
}
