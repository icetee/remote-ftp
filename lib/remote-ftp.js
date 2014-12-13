var fs, path, Client, TreeView;

module.exports = {
	configDefaults: {
		hideLocalWhenDisplayed: false
	},

	treeView: null,
	client: null,

	activate: function (state) {
		if (!atom.project || !atom.project.path)
			return;

		if (!fs) {
			fs = require('fs-plus');
			path = require('path');

			Client = require('./client');
			TreeView = require('./views/tree-view');
		}

		atom.project.remoteftp = new Client();

		atom.workspaceView.command('remote-ftp:create-config', function () {
			fs.writeFile(atom.project.resolve('.ftpconfig'), '{\n\
    "protocol": "ftp",\n\
	"host": "example.com",\n\
    "port": "21",\n\
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
		});

		atom.workspaceView.command('remote-ftp:toggle', function () {
			self.treeView.toggle();
		});

		//atom.workspaceView.command('remote-ftp:connect', function () {
		//	atom.project.remoteftp.readConfig(function (e) {
		//		if (e) {
		//			alert(e, 'Remote FTP');
		//			return;
		//		}
		//		atom.project.remoteftp.connect();
		//	});
		//});

		self.treeView = new TreeView();
	},

	deactivate: function () {

	}
}
