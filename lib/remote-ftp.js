var FS, Path, $, Client, TreeView, Ignore, AddDialog, MoveDialog, NavigateTo, multipleHostsEnabled;

function hasProject() {
	return atom.project && atom.project.getPaths().length;
}

module.exports = {
	config: {
		hideLocalWhenDisplayed: {
			type: 'boolean',
			'default': false
		},
		autoUploadOnSave: {
			type: 'string',
			'default': 'always',
			enum: ['always', 'only when connected', 'never']
		},
		showHiddenFiles: {
			type: 'boolean',
			'default': true
		},
		showViewOnStartup: {
			type: 'boolean',
			'default': true
		},
		enableCopyFilename: {
			type: 'boolean',
			'default': true
		},
		"multipleHosts ( Beta )":{
			type:"boolean",
			"default":false
		}
	},

	treeView: null,
	client: null,
	listeners: [],

	activate: function (state) {
		var self = this;

		if (!FS) {
			FS = require('fs-plus');
			Path = require('path');
			Ignore = require('ignore');
			$ = require('atom-space-pen-views').$;

			Client = require('./client');
			TreeView = require('./views/tree-view');
			Directory = require('./directory');
			multipleHostsEnabled = require("./helpers").multipleHostsEnabled;
		}

		atom.project.remoteftp = new Client();

		self.treeView = new TreeView();
		self.treeView.detach();

		atom.project.remoteftp.on('connected', function () {
			self.treeView.root.name.attr('data-name', Path.basename(atom.project.remoteftp.root.remote));
			self.treeView.root.name.attr('data-path', atom.project.remoteftp.root.remote);
		});

		if ( hasProject() ) {
			if( multipleHostsEnabled() === true ){
				setTimeout(function() {
					FS.exists(atom.project.remoteftp.getConfigPath(), function (exists) {
						if (exists && atom.config.get('Remote-FTP.showViewOnStartup')) {
							self.treeView.attach();
						}
					});
				}, 0);
			}
			else{
				FS.exists(atom.project.getDirectories()[0].resolve('.ftpconfig'), function (exists) {
 					if (exists && atom.config.get('Remote-FTP.showViewOnStartup')) {
 						self.treeView.attach();
 					}
 				});
			}
		}

		var copyname_context = {
			'.remote-ftp-view .entries.list-tree:not(.multi-select) .directory .header': [
				{ label: 'Copy name', command: 'remote-ftp:copy-name' },
				{ type: 'separator' }
			],
			'.remote-ftp-view .entries.list-tree:not(.multi-select) .file': [
				{ label: 'Copy filename', command: 'remote-ftp:copy-name' },
				{ type: 'separator' }
			]
		};

		if (atom.config.get('Remote-FTP.enableCopyFilename')) {
		    atom.contextMenu.add(copyname_context);
		}

		atom.commands.add('atom-workspace', {

			'remote-ftp:create-ftp-config': function () {
				if (!hasProject()) return;

				var ftpConfigPath = atom.project.remoteftp.getConfigPath();
				FS.writeFile(ftpConfigPath, JSON.stringify({
					"protocol": "ftp",
					"host": "example.com",
					"port": 21,
					"user": "user",
					"pass": "pass",
					"promptForPass": false,
					"remote": "/",
					"secure": false,
					"secureOptions": null,
					"connTimeout": 10000,
					"pasvTimeout": 10000,
					"keepalive": 10000,
					"watch":[],
					"watchTimeout":500
				}, null, 4), function (err) {
					if (!err)
						atom.workspace.open(ftpConfigPath);
				});
			},

			'remote-ftp:create-sftp-config': function () {
				if (!hasProject()) return;
				var ftpConfigPath = atom.project.remoteftp.getConfigPath();
				FS.writeFile(ftpConfigPath, JSON.stringify({
					"protocol": "sftp",
					"host": "example.com",
					"port": 22,
					"user": "user",
					"pass": "pass",
					"promptForPass": false,
					"remote": "/",
					"agent": "",
					"privatekey": "",
					"passphrase": "",
					"hosthash": "",
					"ignorehost": true,
					"connTimeout": 10000,
					"keepalive": 10000,
					"keyboardInteractive": false,
					"watch":[],
					"watchTimeout":500
				}, null, 4), function (err) {
					if (!err)
						atom.workspace.open(ftpConfigPath);
				});
			},

			'remote-ftp:create-ignore-file' : function ()
			{
				if (!hasProject()) return;

				FS.writeFile(atom.project.getDirectories()[0].resolve('.ftpignore'), [
            '# Please note that this is a beta-feature and will only work with local-to-remote sync!',
            '# For example, the following patterns will be ignored on sync:',
            '.ftpconfig',
            '.DS_Store'
          ].join('\n'),
					function (err) {
						if (!err)
							atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpignore'));
					}
				);
			},

			'remote-ftp:toggle': function () {
				if (!hasProject()) return;

				self.treeView.toggle();
			},

			'remote-ftp:connect': function () {
				if (!hasProject()) return;

				atom.project.remoteftp.readConfig(function (e) {
					if (e) {
						atom.notifications.addError("Could not read `.ftpconfig` file", { detail: e } );
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
				if (!remotes || remotes.length === 0) {
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
						});
					});
				});
				dialog.attach();
			},

			'remote-ftp:add-folder': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length === 0) {
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
					});
				});
				dialog.attach();
			},

			'remote-ftp:refresh-selected': function () {
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length === 0) {
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
				if (!remotes || remotes.length === 0) {
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
				if (!remotes || remotes.length === 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				atom.confirm({
					message: "Are you sure you want to delete the selected item?",
					detailedMessage: "You are deleting:" + remotes.map(function (view) {
						return "\n  " + view.item.remote;
					}),
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
				if (!remotes || remotes.length === 0) {
					atom.notifications.addError("**Remote-FTP**<br />You need to select a folder first");
					return;
				}

				remotes.forEach(function (view) {
					if (!view) return;

					atom.project.remoteftp.download(view.item.remote, true, function (err) {

					});
				});
			},

			'remote-ftp:upload-selected': function () {
				if (!hasProject()) return;

				var locals = $('.tree-view .selected').map(function () {
					return this.getPath ? this.getPath() : '';
				}).get();

				var filteredLocals = self.omitIgnored(locals);

				filteredLocals.forEach(function (local) {
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

				var filteredLocals = self.omitIgnored(locals);

				filteredLocals.forEach(function (local) {
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

				if (!NavigateTo)
					NavigateTo = require('./dialogs/navigate-to-dialog');

				var dialog = new NavigateTo();
				dialog.on('navigate-to', function (e, path) {
					dialog.close();

					atom.project.remoteftp.root.openPath(path);
				});
				dialog.attach();
			},

			'remote-ftp:copy-name': function(){
				if (!hasProject()) return;

				var remotes = self.treeView.getSelected();
				if (!remotes || remotes.length === 0) { return; }

				var name = remotes.map(function(data) {
				    return data.item.name;
				}) + '';

				atom.clipboard.write(name);
			}
		});

		atom.workspace.observeTextEditors(function (ed) {
			var buffer = ed.buffer;
			var listener = buffer.onDidSave(self.fileSaved.bind(self));
			self.listeners.push(listener);
		});

		self.listeners.push(atom.project.onDidChangePaths(function() {
			if(!hasProject() || !atom.project.remoteftp.isConnected()) {
				return;
			}

			atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:disconnect');
			atom.commands.dispatch(atom.views.getView(atom.workspace), 'remote-ftp:connect');
		}));
	},

	deactivate: function () {
		var self = this;

		self.listeners.forEach(function (l) {
			l.dispose();
		});
		self.listeners = [];

		if (atom.project.remoteftp)
			atom.project.remoteftp.disconnect();
	},

	fileSaved: function (text) {
		if (!hasProject()) return;

		if (atom.config.get('Remote-FTP.autoUploadOnSave') == 'never') return;

		if (!atom.project.remoteftp.isConnected() && atom.config.get('Remote-FTP.autoUploadOnSave') != 'always')
			return;

		var self = this;

		var local = text.path;

		if (!atom.project.contains(local))
			return;

		if (local == atom.project.remoteftp.getConfigPath())
			return;

		// TODO: Add fix for files which are uploaded from a glob selector
		// don't upload files watched, they will be uploaded by the watcher
		if (atom.project.remoteftp.watch.files.indexOf(local) >= 0) return;

		atom.project.remoteftp.upload(local, function (err) {
			try {
				var remote = atom.project.remoteftp.toRemote(local),
					parent = atom.project.remoteftp.resolve(Path.dirname(remote).replace(/\\/g, '/'));
				if (parent)
					parent.open();
			} catch (e) {}
		});
	},

	omitIgnored: function (locals) {
		// NOTE: only works with first project path (for now)
		// see https://github.com/atom/atom/issues/5613
		var firstProjectPath = atom.project.getPaths()[0];
		var ftpignore = firstProjectPath + '/.ftpignore';
		// NOTE: only works with direct specification of file/folder and no duplicate names
		var filteredLocals = Ignore().addIgnoreFile(ftpignore).filter(locals);

		return filteredLocals;
	}
};
