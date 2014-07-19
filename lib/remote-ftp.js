var fs, Client;

module.exports = {

    treeView: null,
    config: null,
    client: null,

    activate: function (state) {
        if (!atom.project || !atom.project.path)
            return;

        var self = this;

        // Delay require
        if (!fs) {
            fs = require('fs-plus');
            Client = require('./client');
        }

        self.client = new Client();

        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.on('saved', self.fileSaved.bind(self));
        });

        atom.workspaceView.command('remote-ftp:toggle', function () {

        });

        atom.workspaceView.command('remote-ftp:connect', function () {
            self.client.disconnect();
            self.readConfig(function () {
                self.client.connect(self.config);
            });
        });

        atom.workspaceView.command('remote-ftp:disconnect', function () {
            self.client.disconnect();
        });
    },

    deactivate: function () {
        var self = this;
        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.off('saved', self.fileSaved);
        });

        self.client.disconnect();
    },

    // File saved
	fileSaved: function (text) {
        var self = this;

        if (!self.client.isConnected())
            return;

        console.log('changed', atom.project.relativize(text.file.path));
    },

    // Read config
    readConfig: function (callback) {
        var self = this;

        // TODO support CSON (season package)
        fs.readFile(atom.project.resolve('.ftpconfig'), 'utf8', function (err, data) {
            if (err)
                return;

            var json;
            try {
                json = JSON.parse(data);
            } catch (e) {
                alert('Parse error in .ftpconfg\'s JSON :\n  '+ e);
                return;
            }

            if (self.config == json)
                return;

            self.config = json;

            self.client.root.name = '';
            self.client.root.path = '/' + self.config.remote.replace(/^\/+/, '');

            if (typeof callback === 'function')
                callback.apply(self);

        });
    }

}
