# remote-ftp

FTP/FTPS/SFTP client for Atom.io using [node-ftp](https://github.com/mscdex/node-ftp) and [ssh2](https://github.com/mscdex/ssh2)

![Screenshot](https://raw.githubusercontent.com/mgrenier/remote-ftp/master/screenshot.png "Screenshot")

## Getting started

1. **Open** an existing **project** or create a new one (File -> Open folder...)
1. **Open** remote-ftp **sidebar** (Packages -> Remote-FTP -> Toggle)
1. **Create a configuration file** for your project (Packages -> Remote-FTP -> Create (s)FTP config file)
1. Once connected you should be seeing the content of the remote connection
1. **All** basic **commands** (`connect`, `disconnect`, ...) are **available from** the **sidebar context menu** and the Command Palette

## API for other package creator

Other package can access the FTP Client with ```atom.project.remoteftp```.

### Properties
* **info** - (_object_) - Object containing the .ftpconfig's data
* **connector** - (_Connector_) - object for _raw_ access to the connector

### Events
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
