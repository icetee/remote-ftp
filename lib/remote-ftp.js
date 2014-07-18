var fs, path, mkdirp, chokidar, events, $, FTP, Directory, File;

module.exports = {

    treeView: null,
    config: null,

    activate: function (state) {
        if (!atom.project || !atom.project.path)
            return;

        var self = this;

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

        atom.project.remote = new Directory({
            parent: null,
            name: '/',
            path: '',
            ftp: this,
            isExpanded: true
        });

        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.on('saved', self.fileSaved.bind(self));
        });

        atom.workspaceView.command('remote-ftp:toggle', function () {

        });

        atom.workspaceView.command('remote-ftp:connect', function () {
            self.disconnect();
            self.readConfig(function () {
                self.connect();
            });
        });

        atom.workspaceView.command('remote-ftp:disconnect', function () {
            self.disconnect();
        });

        atom.project.on('ftp:ready', self.ready.bind(self));
    },

    deactivate: function () {
        var self = this;
        atom.workspace.eachEditor(function (ed) {
            var buffer = ed.buffer;
            buffer.off('saved', self.fileSaved);
        });

        atom.project.off('ftp:ready', self.ready);

        atom.project.remote.destroy();

        self.disconnect();
    },

	fileSaved: function (text) {
        if (!atom.project.ftp || !atom.project.ftp.connected)
            return;

        console.log('changed', atom.project.relativize(text.file.path));
    },

    // Read config
    readConfig: function (callback) {
        var self = this;
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

            atom.project.remote.path = '/' + self.config.remote.replace(/^\/+/, '');
            atom.project.remote.open();

            if (typeof callback === 'function')
                callback.apply(self);

        });
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

        atom.project.ftp = new FTP();
        atom.project.ftp.on('greeting', function (msg) {
            atom.project.emit('ftp:greeting', msg);
        });
        atom.project.ftp.on('ready', function () {
            atom.project.emit('ftp:ready');
        });
        atom.project.ftp.on('close', function (error) {
            atom.project.emit('ftp:close', error);
        });
        atom.project.ftp.on('end', function () {
            atom.project.emit('ftp:end');
        });
        atom.project.ftp.on('error', function (error) {
            atom.project.emit('ftp:error', error);
        });
        atom.project.ftp.connect(info);
    },

    // Disconnect
    disconnect: function () {
        if (atom.project.ftp) {
            atom.project.ftp.destroy();
            atom.project.ftp = null;
        }
    },

    _current: null,
    _queue: [],

    _next: function (force) {
        if (!atom.project.ftp || !atom.project.ftp.connected)
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
        return path.join(this.config.remote, atom.project.relativize(local)).replace(/\\/g, '/');
    },

    toLocal: function (remote) {
        return atom.project.resolve(remote.substr(this.config.remote.length));
    },

    ready: function () {
        this._next(true);
    },

    abort: function (all) {
        var self = this;
        if (all)
            self._queue = [];

        self._current = null;

        atom.project.ftp.abort(function () {

            self._next(true);

        });
    },

    list: function (remote, recursive, callback) {
        var self = this;
        if (recursive) {

            var digg = 0,
                list = [];
            self._enqueue(function () {
                function e () {
                    self._next(true);
                    if (typeof callback === 'function')
                        callback.apply(callback, [null, list]);
                }
                function l (r) {
                    ++digg;
                    atom.project.ftp.list(r, function (err, lis) {
                        if (err) {
                            e();
                            return;
                        }

                        lis.forEach(function (item) {
                            if (item.name == '.' || item.name == '..')
                                return;
                            if (item.type == 'd' || item.type == 'l') {
                                item.name = path.join(r, item.name).replace(/\\/g, '/');
                                list.push(item);
                                l(item.name);
                            } else {
                                item.name = path.join(r, item.name).replace(/\\/g, '/');
                                list.push(item);
                            }
                        });

                        if (--digg == 0)
                            e();
                    });
                }
                l(remote);

            });

        } else {
            self._enqueue(function () {
                atom.project.ftp.list(remote, function (err, list) {
                    self._next(true);

                    if (err)
                        return;

                    if (typeof callback === 'function')
                        callback.apply(callback, [err, list]);
                });
            });
        }
    },

    download: function (remote, recursive, callback) {
        var self = this,
            local = self.toLocal(remote);
        self._enqueue(function () {

            atom.project.ftp.cwd(remote, function (err) {
                atom.project.ftp.cwd('/', function () {
                    if (err) { // File

                        mkdirp(path.dirname(local), function (err) {
                            if (err)
                                return;
                            atom.project.ftp.get(remote, function (err, stream) {
                                if (err) {
                                    self._next(true);
                                    if (typeof callback === 'function')
                                        callback.apply(callback, [err]);
                                    return;
                                }

                                var dest = fs.createWriteStream(local);
                                dest.on('unpipe', function () {
                                    self._next(true);
                                    if (typeof callback === 'function')
                                        callback.apply(callback, []);
                                });
                                stream.pipe(dest);
                            });
                        });

                    } else { // Directory

                        self.list(remote, recursive, function (err, list) {
                            list.forEach(function (item) {
                                item.depth = item.name.split('/').length;
                            });
                            list.sort(function (a, b) {
                                if (a.depth == b.depth)
                                    return 0;
                                return a.depth > b.depth ? 1 : -1;
                            });

                            var error;
                            function e () {
                                self._next(true);
                                if (typeof callback === 'function')
                                    callback.apply(callback, [error]);
                            }
                            function n () {
                                var item = list.shift();
                                if (item == null) {
                                    e();
                                    return;
                                }

                                var local = self.toLocal(item.name);
                                if (item.type == 'd' || item.type == 'l')
                                    mkdirp(local, function (err) {
                                        if (err)
                                            error = err;
                                        n();
                                    });
                                else
                                    atom.project.ftp.get(item.name, function (err, stream) {
                                        var dest = fs.createWriteStream(local);
                                        dest.on('unpipe', function () {
                                            n();
                                        });
                                        stream.pipe(dest);
                                    });
                            }
                            n();
                        });
                        self._next(true);
                    }
                });
            });

        });
    },

    upload: function (local, callback) {
        var self = this,
            remote = self.toRemote(local);
        local = atom.project.resolve(local);

        // Upload file
        if (fs.isFileSync(local)) {
            self.mkdir(path.dirname(local), true, function () {
                atom.project.ftp.put(local, remote, function (err) {
                    self._next(true);
                    if (typeof callback === 'function')
                        callback.apply(callback, [err]);
                });
            });
        }
        // Upload folder
        else {
            var list = [{name: local, type: 'd'}],
                digg = 0;

            function e () {
                list.forEach(function (item) {
                    item.depth = item.name.split(path.sep).length;
                });
                list.sort(function (a, b) {
                    if (a.depth == b.depth)
                        return 0;
                    return a.depth > b.depth ? 1 : -1;
                });
                self._enqueue(function () {
                    var error;
                    function e () {
                        self._next(true);
                        if (typeof callback === 'function')
                            callback.apply(callback, [error]);
                    }
                    function n () {
                        var item = list.shift();
                        if (item == null) {
                            e();
                            return;
                        }

                        var remote = self.toRemote(item.name);
                        if (item.type == 'd') {
                            atom.project.ftp.mkdir(remote, function (err) {
                                if (err)
                                    error = err;
                                n();
                            })
                        } else {
                            atom.project.ftp.put(item.name, remote, function (err) {
                                if (err)
                                    error = err;
                                n();
                            })
                        }
                    }
                    n();
                });
            }
            function l (p) {
                ++digg;
                fs.readdir(p, function (err, lis) {
                    lis.forEach(function (name) {
                        if (name == '.' || name == '..')
                            return;

                        name = path.join(p, name);
                        if (fs.isFileSync(name)) {
                            list.push({
                                type: '-',
                                name: name
                            });
                        } else {
                            list.push({
                                type: 'd',
                                name: name
                            });
                            l(name);
                        }
                    });
                    if (--digg == 0)
                        e();
                });
            }
            l(local);

        }
    },

    mkdir: function (remote, recursive, callback) {
        var self = this,
            remotes = remote.replace(/^\/+/, '').replace(/\/+$/, '').split('/'),
            dirs = ['/' + remotes.slice(0, remotes.length).join('/')];
        if (recursive) {
            for (var a = remotes.length - 1; a > 0; --a)
                dirs.unshift('/' + remotes.slice(0, a).join('/'));
        }

        self._enqueue(function () {
            var error;
            function n () {
                var dir = dirs.shift();
                if (dir == null) {
                    self._next(true);
                    if (typeof callback === 'function')
                        callback.apply(callback, [error]);
                    return;
                }
                atom.project.ftp.mkdir(dir, function (err) {
                    error = err;
                    n();
                });
                n();
            };
            n();
        });
    },

    delete: function (remote, recursive, callback) {
        var self = this;
        self._enqueue(function () {

            atom.project.ftp.cwd(remote, function (err) {
                atom.project.ftp.cwd('/', function () {
                    // File maybe
                    if (err) {
                        atom.project.ftp.delete(remote, function (err) {
                            self._next(true);
                            if (typeof callback === 'function')
                                callback.apply(callback, [err]);
                        });
                    }
                    // Folder maybe
                    else {
                        self.list(remote, true, function (err, list) {
                            list.forEach(function (item) {
                                item.depth = item.name.replace(/^\/+/).replace(/\/+$/).split('/').length;
                            });
                            list.sort(function (a, b) {
                                if (a.depth == b.depth)
                                    return 0;
                                return a.depth > b.depth ? -1 : 1;
                            });

                            function e () {
                                atom.project.ftp.rmdir(remote, function (err) {
                                    self._next(true);
                                    if (typeof callback === 'function')
                                        callback.apply(callback, [err]);
                                });
                            }

                            var done = 0,
                                error;
                            list.forEach(function (item) {
                                ++done;
                                var fn = item.type == 'd' || item.type == 'l' ? 'rmdir' : 'delete';
                                atom.project.ftp[fn](item.name, function (err) {
                                    if (err)
                                        error = err;
                                    if (--done == 0)
                                        e();
                                });
                            });
                            if (list.length == 0)
                                e();
                        });
                        self._next(true);
                    }
                });
            });
        });
    }

}
