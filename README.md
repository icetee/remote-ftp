# Remote-FTP

FTP/FTPS/SFTP client for Atom.io

![Screenshot](https://raw.githubusercontent.com/mgrenier/remote-ftp/master/screenshot.png "Screenshot")

## Getting started

1. **Open** an existing **project** or create a new one (File -> Open folder...)
1. **Open** remote-ftp **sidebar** (Packages -> Remote-FTP -> Toggle)
1. **Create a configuration file** for your project (Packages -> Remote-FTP -> Create (s)FTP config file)
1. Once connected you should be seeing the content of the remote connection
1. **All** basic **commands** (`connect`, `disconnect`, ...) are **available from** the **sidebar context menu** and the Command Palette

## Package keyboard useful shortcuts

| action | Windows | Mac |
| Remote FTP toggle | Ctrl + Alt + o | Ctrl + Alt + o |
| Connect | Ctrl + Alt + c | Ctrl + Alt + c |
| Disconnect | Ctrl + Alt + d | Ctrl + Alt + d |


'ctrl-alt-o': 'remote-ftp:toggle'
'ctrl-alt-d': 'remote-ftp:disconnect'
'ctrl-alt-c': 'remote-ftp:connect'

## Package preferences

There are some settings hidden in the package preferences!

![Screenshot of Settings](https://raw.githubusercontent.com/mgrenier/remote-ftp/master/screenshot-settings.png "Screenshot-settings")

## Configuration in project's `.ftpconfig` file

**SFTP Configuration Options**
```
{
    "protocol": "sftp",
    "host": "example.com", // string - Hostname or IP address of the server. Default: 'localhost'
    "port": 22, // integer - Port number of the server. Default: 22
    "user": "user", // string - Username for authentication. Default: (none)
    "pass": "pass", // string - Password for password-based user authentication. Default: (none)
    "promptForPass": false, // boolean - Set to true for enable password/passphrase dialog. This will prevent from using cleartext password/passphrase in this config. Default: false
    "remote": "/", // try to use absolute paths starting with /
    "agent": "", // string - Path to ssh-agent's UNIX socket for ssh-agent-based user authentication. Windows users: set to 'pageant' for authenticating with Pageant or (actual) path to a cygwin "UNIX socket." Default: (none)
    "privatekey": "", // string - Path to the private key file (in OpenSSH format). Default: (none)
    "passphrase": "", // string - For an encrypted private key, this is the passphrase used to decrypt it. Default: (none)
    "hosthash": "", // string - 'md5' or 'sha1'. The host's key is hashed using this method and passed to the hostVerifier function. Default: (none)
    "ignorehost": true,
    "connTimeout": 10000, // integer - How long (in milliseconds) to wait for the SSH handshake to complete. Default: 10000
    "keepalive": 10000, // integer - How often (in milliseconds) to send SSH-level keepalive packets to the server (in a similar way as OpenSSH's ServerAliveInterval config option). Set to 0 to disable. Default: 10000
    "watch":[ // array - Files that are watched and when edited outside of the atom editor are uploaded. Useful if using a build tool e.g Gulp. Default : []
        "./dist/stylesheets/main.css" // reference file from the root of the project.
    ]
}
```

**FTP & FTPS Configuration Options**
```
{
    "protocol": "ftp",
    "host": "example.com", // string - The hostname or IP address of the FTP server. Default: 'localhost'
    "port": 21, // integer - The port of the FTP server. Default: 21
    "user": "user", // string - Username for authentication. Default: 'anonymous'
    "pass": "pass", // string - Password for authentication. Default: 'anonymous@'
    "promptForPass": false, // boolean - Set to true for enable password dialog. This will prevent from using cleartext password in this config. Default: false
    "remote": "/",
    "secure": false, // mixed - Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990) Default: false
    "secureOptions": null, // object - Additional options to be passed to tls.connect(). Default: (null) see http://nodejs.org/api/tls.html#tls_tls_connect_options_callback
    "connTimeout": 10000, // integer - How long (in milliseconds) to wait for the control connection to be established. Default: 10000
    "pasvTimeout": 10000, // integer - How long (in milliseconds) to wait for a PASV data connection to be established. Default: 10000
    "keepalive": 10000, // integer - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000
    "watch":[ // array - Files that are watched and when edited outside of the atom editor are uploaded. Useful if using a build tool e.g Gulp. Default : []
        "./dist/stylesheets/main.css" // reference file from the root of the project.
    ]
}
```

## I'd like to support this project
Help me bring this project to the moon! Atom's rocket needs to get somewhere, right?
- **Bug hunting!** [Report](https://github.com/mgrenier/remote-ftp/issues) them!
- **Feature request?** [Please let me know](https://github.com/mgrenier/remote-ftp/issues) by filling an issue!
- **Contribute!** It'll be happy to accept pull request!
- **Share the love!**
 - Star this project on [Atom](https://atom.io/packages/remote-ftp), [Github](https://github.com/mgrenier/remote-ftp)
 - Speak out on the [forum](https://discuss.atom.io/)
 -  [![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PZ3HU7CCJQ6BL) a little something !
