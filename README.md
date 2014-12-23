# remote-ftp

FTP client for Atom.io using [node-ftp](https://github.com/mscdex/node-ftp)

## API access

Detail after screenshots.

## API for other package creator

Other package can access the FTP Client with ```atom.project.remoteftp```.

### Properties
* **info** - (_object_) - Object containing the .ftpconfig's data
* **ftp** - (_FTP_) - [node-ftp](https://github.com/mscdex/node-ftp) object for _raw_ access to the connection

### Events [node-ftp](https://github.com/mscdex/node-ftp#events)
* **connected**() - Connected to the server
* **closed**() - Connection closed
* **ended**() - Connection has ended
* **error**(_string_ error) - Connection had an error

### Methods
* **readConfig**(_function_ callback) - (void) - Read .ftpconfig file
* **connect**(_bool_ reconnect) - (_Client_) - Initiate connection
* **disconnect**() - (_Client_) - Close connection
* **isConnected**() - (_bool_) - Check if connected
* **onceConnected**(_function_ callback) - (_bool_) - Try to reconnect and execute callback
* **abort**() - (_Client_) - Abort single operation
* **abortAll**() - (_Client_) - Abort all pending operation
* **list**(_string_ remote, _bool_ recursive, _function_ callback) - (_Client_) - Retrieve a list of resource at location
* **download**(_string_ remote, _bool_ recursive, _function_ callback) - (_Client_) - Download remote path to local
* **upload**(_string_ remote, _function_ callback) - (_Client_) - Upload local path to remote
* **mkdir**(_string_ remote, _bool_ recursive, _function_ callback) - (_Client_) - Create a folder at remote
* **mkfile**(_string_ remote, _function_ callback) - (_Client_) - Create empty file at remote
* **rename**(_string_ source, _string_ destination, _function_ callback) - (_Client_) - Rename remote to destination
* **delete**(_string_ remote, _bool_ recursive, _function_ callback) - (_Client_) - Delete remote location

### Helpers

* **toLocal**(_string_ remote) - (_string_) - Convert remote absolute path to local absolute path
* **toRemote**(_string_ local) - (_string_) - Convert local absolute path to remote absolute path
