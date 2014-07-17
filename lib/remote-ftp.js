var fs, path, mkdirp, chokidar, events, $, FTP, Directory, File;

module.exports = {

    treeView: null,
    config: null,
    ftp: null,
    root: null,

    activate: function (state) {
        if (!atom.project || !atom.project.path)
            return;

        // Delay require
        if (!fs) {
            fs = require('fs-plus');
            path = require('path');
            mkdirp = require('mkdirp');
            chokidar = require('chokidar');
            events = require('events');
            $ = require('atom').$;
            FTP = require('ftp');
            Directory = require('./directory');
            //File = require('./file');
        }


        setTimeout(function () {

            treeView = atom.packages.getLoadedPackage('tree-view').mainModule.treeView;
            $(treeView).addClass('ftp-view');

            this.readConfig();

        }.bind(this), 1000);

        this.root = new Directory({
            parent: null,
            name: '/',
            path: '',
            ftp: this,
            isExpanded: true
        });

        atom.project.on('ftp:config-changed', this.connect.bind(this));
        atom.project.on('ftp:ready', this.ready.bind(this));

        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.on('saved', this.fileSaved.bind(this));
        }.bind(this));
    },

    deactivate: function () {
        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.off('saved', this.fileSaved);
        }.bind(this));

        atom.project.off('ftp:ready', this.ready);

        this.root.destroy();

        this.disconnect();
    },
	
	fileSaved: function (text) {
        console.log('changed', atom.project.relativize(text.file.path));
    },

    // Read config
    readConfig: function () {
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

            if (this.config == json)
                return;

            this.config = json;

            this.root.path = '/' + this.config.remote.replace(/^\/+/, '');
            this.root.open();

            atom.project.emit('ftp:config-changed', this.config);

        }.bind(this));
    },

    // Connect to ftp
    connect: function () {
        this.disconnect();

        var info = this.config;
        info.debug = function (str) {
            var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
            if (!log)
                return;

            console.debug(['FTP', log[1], log[2]].join(' '));
        }

        this.ftp = new FTP();
        this.ftp.on('greeting', function (msg) {
            atom.project.emit('ftp:greeting', msg);
        });
        this.ftp.on('ready', function () {
            atom.project.emit('ftp:ready');
        });
        this.ftp.on('close', function (error) {
            atom.project.emit('ftp:close', error);
        });
        this.ftp.on('end', function () {
            atom.project.emit('ftp:end');
        });
        this.ftp.on('error', function (error) {
            atom.project.emit('ftp:error', error);
        });
        this.ftp.connect(info);
    },

    // Disconnect
    disconnect: function () {
        if (this.ftp) {
            this.ftp.destroy();
            this.ftp = null;
        }
    },

    _current: null,
    _queue: [],

    _next: function (force) {
        if (!this.ftp)
            return;
        if (!force && this._current != null)
            return;

        this._current = this._queue.shift();
        if (this._current)
            this._current.apply(this);
    },

    _enqueue: function (func) {
        this._queue.push(func);
        this._next();
    },

    toRemote: function (local) {
        return path.join(this.config.remote, local).replace(/\\/g, '/');
    },

    toLocal: function (remote) {
        return atom.project.resolve(remote.substr(this.config.remote.length));
    },

    ready: function () {
        this._next(true);
    },

    abort: function (all) {
        if (all)
            this._queue = [];

        this._current = null;

        this.ftp.abort(function () {

            this._next();

        }.bind(this));
    },

    list: function (remote, recursive, callback) {
        this._enqueue(function () {
            this.ftp.list(remote, function (err, list) {
                this._next(true);

                if (err)
                    return;

                if (typeof callback === 'function')
                    callback.apply(callback, [err, list]);
            }.bind(this));
        })
    },

    download: function (remote, recursive, callback) {
        var local = this.toLocal(remote);
        this._enqueue(function () {

            this.ftp.cwd(remote, function (err) {
                this.ftp.cwd('/', function () {
                    if (err) { // File

                        mkdirp(path.dirname(local), function (err) {
                            if (err)
                                return;
                            this.ftp.get(remote, function (err, stream) {
                                if (err) {
                                    this._next(true);
                                    if (typeof callback === 'function')
                                        callback.apply(callback, [err]);
                                    return;
                                }

                                var dest = fs.createWriteStream(local);
                                dest.on('unpipe', function () {
                                    this._next(true);
                                    if (typeof callback === 'function')
                                        callback.apply(callback, []);
                                }.bind(this));
                                stream.pipe(dest);
                            }.bind(this));
                        }.bind(this));

                    } else { // Directory

                        console.error('Download folder', recursive ? 'recursively' : '');
                        this._next(true);

                    }
                }.bind(this));
            }.bind(this));

        }.bind(this));
    },

    upload: function (local, callback) {
        var remote = this.toRemote(local);
        local = atom.project.resolve(local);
        this._enqueue(function () {

            if (fs.isFileSync(local)) { // File

                this.ftp.put(local, remote, function (err) {
                    this._next(true);
                    if (typeof callback === 'function')
                        callback.apply(callback, [err]);
                }.bind(this));

            } else { // Directory
                console.error('Upload folder');
                this._next(true);
            }
        }.bind(this));
    },

    mkdir: function (remote, recursive, callback) {

    },

    delete: function (remote, recursive, callback) {

    }

}
