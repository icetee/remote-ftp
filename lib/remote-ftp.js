var FS, Path, $, Client, TreeView, AddDialog, MoveDialog;

function hasProject () {
	return atom.project && atom.project.getPaths().length;
}

module.exports = {
	config: {
		hideLocalWhenDisplayed: {
			type: 'boolean',
			'default': false
		},
		autoUploadOnSave: {
			type: 'boolean',
			'default': true
		}
	},

	treeView: null,
	client: null,

	activate: function (state) {
		var self = this;

		if (!FS) {
			FS = require('fs-plus');
			Path = require('path');
			$ = require('atom-space-pen-views').$;

			Client = require('./client');
			TreeView = require('./views/tree-view');
			Directory = require('./directory');
		}

		atom.project.remoteftp = new Client();

		self.treeView = new TreeView();
		self.treeView.detach();

		atom.project.remoteftp.on('connected', function () {
			self.treeView.root.name.attr('data-name', Path.basename(atom.project.remoteftp.root.remote));
			self.treeView.root.name.attr('data-path', atom.project.remoteftp.root.remote);
		});

		if (hasProject() && atom.project.getDirectories()[0].resolve('.ftpconfig')) {
			FS.exists(atom.project.getDirectories()[0].resolve('.ftpconfig'), function (exists) {
				if (exists)
					self.treeView.attach();
			});
		}

		atom.commands.add('atom-workspace', {

			'remote-ftp:create-ftp-config': function () {
				if (!hasProject()) return;

				FS.writeFile(atom.project.getDirectories()[0].resolve('.ftpconfig'), '{\n\
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
						atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpconfig'));
				});
			},

			'remote-ftp:create-sftp-config': function () {
				if (!hasProject()) return;

				FS.writeFile(atom.project.getDirectories()[0].resolve('.ftpconfig'), '{\n\
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
    "keepalive": 10000,\n\
    "keyboardInteractive": false\n\
}'			, function (err) {
					if (!err)
						atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpconfig'));
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

					if (!self.treeView.isVisible()) {
						self.treeView.toggle();
					}

					atom.project.remoteftp.connect();
				});
			},

			'remote-ftp:disconnect': function () {
				if (!hasProject()) return;

				atom.project.remoteftp.disconnect();
			},

			'remote-ftp:add-file': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				if (!AddDialog)
					AddDialog = require('./dialogs/add-dialog');

				var dialog = new AddDialog('', true);
				dialog.on('new-path', function (e, name) {
					dialog.close();

					var remote = Path.join(remotes[0].item.remote, name).replace(/\\/g, '/');

					atom.project.remoteftp.mkdir(remotes[0].item.remote, true, function (err) {
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
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				if (!AddDialog)
					AddDialog = require('./dialogs/add-dialog');

				var dialog = new AddDialog('');
				dialog.on('new-path', function (e, name) {
					var remote = Path.join(remotes[0].item.remote, name).replace(/\\/g, '/');

					atom.project.remoteftp.mkdir(remote, true, function (err) {
						dialog.close();

						remotes[0].open();
					})
				});
				dialog.attach();
			},

			'remote-ftp:refresh-selected': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				remotes.forEach(function (remote) {
					remote.open();
				});
			},

			'remote-ftp:move-selected': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				if (!MoveDialog)
					MoveDialog = require('./dialogs/move-dialog');

				var dialog = new MoveDialog(remotes[0].item.remote);
				dialog.on('path-changed', function (e, newremote) {
					atom.project.remoteftp.rename(remotes[0].item.remote, newremote, function (error) {
						dialog.close();

						// Refresh new folder
						var parentNew = self.treeView.resolve(Path.dirname(newremote));
						if (parentNew)
							parentNew.open();

						// Refresh old folder
						var parentOld = self.treeView.resolve(Path.dirname(remotes[0].item.remote));
						if (parentOld && parentOld != parentNew)
							parentOld.open();

						remotes[0].destroy();
					});
				});
				dialog.attach();
			},

			'remote-ftp:delete-selected': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				atom.confirm({
					message: "Are you sure you want to delete the selected item?",
					detailedMessage: "You are deleting:"+ remotes.map(function (view) { return "\n  " + view.item.remote; }),
					buttons: {
						"Move to Trash": function () {
							remotes.forEach(function (view) {
								if (!view) return;

								var dir = Path.dirname(view.item.remote).replace(/\\/g, '/'),
									parent = self.treeView.resolve(dir);

								atom.project.remoteftp.delete(view.item.remote, function (err, list) {
									if (!err && parent) {
										parent.open();
									}
								});
							 });
						},
						"Cancel": null
					}
				});
			},

			'remote-ftp:download-selected': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length == 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				remotes.forEach(function (view) {
					if (!view) return;

					atom.project.remoteftp.download(view.item.remote, true, function (err) {

					})
				})
			},

			'remote-ftp:upload-selected': function () {
				if (!hasProject()) return;

				var locals = $('.tree-view .selected').map(function () {
					return this.getPath ? this.getPath() : '';
				}).get();

				locals.forEach(function (local) {
					if (!local) return;

					atom.project.remoteftp.upload(local, function (err, list) {
						if (err)
							return;

						var dirs = [];
						list.forEach(function (item) {
							var remote = atom.project.remoteftp.toRemote(item.name),
								dir = Path.dirname(remote);
							if (dirs.indexOf(dir) == -1)
								dirs.push(dir);
						});

						dirs.forEach(function (dir) {
							var view = self.treeView.resolve(dir);

							if (view)
								view.open();
						});
					});
				});
			},

			// Remote -> local
			'remote-ftp:sync-with-remote': function () {
				var remotes = self.treeView.getSelected();

				remotes.forEach(function (view) {
					if (!view) return;

					atom.project.remoteftp.syncRemoteLocal(view.item.remote, function (err) {

					});
				});
			},

			// Local -> Remote
			'remote-ftp:sync-with-local': function () {
				if (!hasProject()) return;

				var locals = $('.tree-view .selected').map(function () {
					return this.getPath ? this.getPath() : '';
				}).get();

				locals.forEach(function (local) {
					if (!local) return;

					atom.project.remoteftp.syncLocalRemote(local, function (err) {
						var remote = atom.project.remoteftp.toRemote(local);
						if (remote) {
							var parent = self.treeView.resolve(remote);
							if (parent && !(parent.item instanceof Directory))
								parent = self.treeView.resolve(Path.dirname(remote).replace(/\\/g, '/'));

							if (parent)
								parent.open();
						}
					});
				});
			},

			'remote-ftp:abort-current': function () {
				if (!hasProject()) return;

				atom.project.remoteftp.abort();
			},

			'remote-ftp:navigate-to': function () {
				if (!hasProject()) return;

				if (!AddDialog)
					AddDialog = require('./dialogs/navigate-to-dialog');

				var dialog = new NavigateTo();
				dialog.on('navigate-to', function (e, path) {
					dialog.close();

					atom.project.remoteftp.root.openPath(path);
				});
				dialog.attach();
			}
		})

		atom.workspace.observeTextEditors(function (ed) {
			var buffer = ed.buffer;
			buffer.onDidSave(self.fileSaved.bind(self));
		});
	},

	deactivate: function () {
		var self = this;
		atom.workspace.observeTextEditors(function (ed) {
			var buffer = ed.buffer;
			buffer.off('saved', self.fileSaved);
		});

		if (atom.project.remoteftp)
			atom.project.remoteftp.disconnect();
	},

	fileSaved: function (text) {
		if (!hasProject()) return;

		if (!atom.config.get('Remote-FTP.autoUploadOnSave')) return;

		var self = this;

		//if (!atom.project.remoteftp.isConnected())
		//	return;

		var local = text.path;

		if (!atom.project.contains(local))
			return;

		if (local == atom.project.getDirectories()[0].resolve('.ftpconfig'))
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
