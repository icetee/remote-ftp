var RemoteFtpView,
    fs = require('fs'),
    path = require('path'),
    FTP = require('ftp');

module.exports = {
    remoteFtpView: null,

    configFile: null,
    configWatcher: null,
    configData: null,

    ftp: null,

    activate: function (state) {
        var self = this;

        self.configFile = path.join(atom.project.path, '.ftpconfig');

        function readConfig () {
            fs.readFile(self.configFile, 'utf8', function (error, data) {
                if (error) {
                    return;
                }

                var json;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    return;
                }

                var changed = self.configData != json;
                self.configData = json;

                if (changed)
                    self.createView().setConnectionInfo(self.configData);
            });
        }
        function watchConfig () {
            if (!self.configWatcher)
                self.configWatcher = fs.watch(self.configFile, function (event, file) {
                    console.log('Config Watcher', event);

                    /*switch (event) {
                        case 'change':
                            readConfig();
                            break;
                        case 'rename':
                            //self.configWatcher.close();
                            break;
                    }*/
                    readConfig();
                });
        }
        watchConfig();

        atom.workspaceView.command('remote-ftp:write-config', function () {
            fs.writeFile(
                self.configFile,
                '{\n' +
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
                '}',
                function () {
                    atom.workspace.open(self.configFile);
                }
            );
        })

        atom.workspaceView.command('remote-ftp:toggle', function () {
            self.createView().toggle();
        });
        atom.workspaceView.command('remote-ftp:add-file', function () {
            self.createView().promptAddEntry(false);
        });
        atom.workspaceView.command('remote-ftp:add-folder', function () {
            self.createView().promptAddEntry(true);
        });
        atom.workspaceView.command('remote-ftp:refresh', function () {
            self.createView().refreshSelectedEntry();
        });
        atom.workspaceView.command('remote-ftp:move', function () {
            self.createView().moveSelectedEntry();
        });
        atom.workspaceView.command('remote-ftp:delete', function () {
            self.createView().deleteSelectedEntry();
        });
        atom.workspaceView.command('remote-ftp:open', function () {
            self.createView().refreshSelectedEntry();
        });
        atom.workspaceView.command('remote-ftp:open-active', function () {
            self.createView().refreshSelectedEntry();
        });
    },

    deactivate: function () {
        if (self.configWatcher) {
            self.configWatcher.close();
            self.configWatcher = null;
        }
    },

    createView: function (state) {
        if (!this.remoteFtpView) {
            RemoteFtpView = require('./remote-ftp-view');

            this.remoteFtpView = new RemoteFtpView(this.state);
        }

        return this.remoteFtpView;
    },
}
