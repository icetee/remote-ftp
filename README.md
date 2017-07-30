# Remote-FTP

FTP/FTPS/SFTP client for Atom.io

![Screenshot](https://raw.githubusercontent.com/icetee/remote-ftp/master/screenshot.png "Screenshot")

## Getting started

1. **Open** an existing **project** or create a new one (File -> Open folder...)
2. **Open** remote-ftp **sidebar** (Packages -> Remote-FTP -> Toggle)
3. **Create a configuration file** for your project (Packages -> Remote-FTP -> Create (s)FTP config file)
4. Once connected you should be seeing the content of the remote connection
5. **All** basic **commands** (`connect`, `disconnect`, ...) are **available from** the **sidebar context menu** and the Command Palette

## Keyboard shortcuts

We all know that some handy commands can make our daily task easier, this are meant to do that, be aware that the action of any of them could overwrite or be over written by any other plugin.

|            |     Windows      |       Mac        |
|----------- | :--------------: | :--------------: |
| Toggle     |  Ctrl + Alt + o  | Ctrl + Alt + o   |
| Connect    |  Ctrl + Alt + c  | Ctrl + Alt + c   |
| Disconnect |  Ctrl + Alt + d  | Ctrl + Alt + d   |
| Upload     | Ctrl + Shift + u | Cmd + Shift + u  |

## Package preferences

There are some settings hidden in the package preferences!

![Screenshot of Settings](https://raw.githubusercontent.com/icetee/remote-ftp/master/screenshot-settings.png "Screenshot-settings")

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
    "agent": "", // string - Path to ssh-agent's UNIX socket for ssh-agent-based user authentication. Linux/Mac users can set "env" as a value to use env SSH_AUTH_SOCK variable. Windows users: set to 'pageant' for authenticating with Pageant or (actual) path to a cygwin "UNIX socket." Default: (none)
    "privatekey": "", // string - Absolute path to the private key file (in OpenSSH format). Default: (none)
    "passphrase": "", // string - For an encrypted private key, this is the passphrase used to decrypt it. Default: (none)
    "hosthash": "", // string - 'md5' or 'sha1'. The host's key is hashed using this method and passed to the hostVerifier function. Default: (none)
    "ignorehost": true,
    "connTimeout": 10000, // integer - How long (in milliseconds) to wait for the SSH handshake to complete. Default: 10000
    "keepalive": 10000, // integer - How often (in milliseconds) to send SSH-level keepalive packets to the server (in a similar way as OpenSSH's ServerAliveInterval config option). Set to 0 to disable. Default: 10000
    "watch":[ // array - Paths to files, directories, or glob patterns that are watched and when edited outside of the atom editor are uploaded. Default : []
        "./dist/stylesheets/main.css", // reference from the root of the project.
        "./dist/stylesheets/",
        "./dist/stylesheets/*.css"
    ],
    "watchTimeout":500, // integer - The duration ( in milliseconds ) from when the file was last changed for the upload to begin.
    "filePermissions":"0644" // string - Permissions for uploaded files. WARNING: if this option is set, previously set permissions on the remote are overwritten!
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
    "keepalive": 10000, // integer - How often (in milliseconds) to send a 'dummy' (NOOP) command to keep the connection alive. Default: 10000\. If set to 0, keepalive is disabled.
    "watch":[ // array - Paths to files, directories, or glob patterns that are watched and when edited outside of the atom editor are uploaded. Default : []
        "./dist/stylesheets/main.css", // reference from the root of the project.
        "./dist/stylesheets/",
        "./dist/stylesheets/*.css"
    ],
    "watchTimeout":500 // integer - The duration ( in milliseconds ) from when the file was last changed for the upload to begin.
}
```

## How to use .ftpignore?

This package use the [ignore](https://www.npmjs.com/package/ignore) npm package. Which covers the operation of fully [gitignore](https://git-scm.com/docs/gitignore).

## How use multiproject mode?

It is a very alpha / beta version. For the time being, only 1 project is supported at one time.

## I'd like to support this project

Help us bring this project to the moon! Atom's rocket needs to get somewhere, right?

- **Contribute!** I'll be happy to accept pull requests!
- **Bug hunting!** [Report](https://github.com/icetee/remote-ftp/issues) them!
- **Feature request?** [Please let me know](https://github.com/icetee/remote-ftp/issues) by filling an issue!
- **Share the love!**

  - Star this project on [Atom](https://atom.io/packages/remote-ftp), [Github](https://github.com/icetee/remote-ftp)
  - Speak out on the [forum](https://discuss.atom.io/)

## Contributors :package:

:1st_place_medal: [@mgrenier](https://github.com/mgrenier) (Original owner)  
:2nd_place_medal: [@jpxd](https://github.com/jpxd)  
:3rd_place_medal: [@jimmaaay](https://github.com/jimmaaay)  

[@pinguinjkeke](https://github.com/pinguinjkeke)
[@miclaus](https://github.com/miclaus)
[@phawxby](https://github.com/phawxby)
[@wasikuss](https://github.com/wasikuss)
[@garetmckinley](https://github.com/garetmckinley)
[@zxwef](https://github.com/zxwef)
[@MikeWillis](https://github.com/MikeWillis)
[@maxsbelt](https://github.com/maxsbelt)
[@kikoseijo](https://github.com/kikoseijo)
[@gevatter](https://github.com/gevatter)
[@morukutsu](https://github.com/morukutsu)
[@wdacgrs](https://github.com/wdacgrs)
[@coolhome](https://github.com/coolhome)
[@samifouad](https://github.com/samifouad)
[@JamesCoyle](https://github.com/JamesCoyle)
[@dhyegofernando](https://github.com/dhyegofernando)
[@DeanmvSG](https://github.com/DeanmvSG)
[@nopjmp](https://github.com/nopjmp)
[@prugel](https://github.com/prugel)
[@StephenNeate](https://github.com/StephenNeate)
[@dala00](https://github.com/dala00)
[@ghoben](https://github.com/ghoben)
[@inferst](https://github.com/inferst)
[@dantman](https://github.com/dantman)
[@UziTech](https://github.com/UziTech)
[@jackalstomper](https://github.com/jackalstomper)
[@Alhadis](https://github.com/Alhadis)
[@QwertyZW](https://github.com/QwertyZW)
[@ASnow](https://github.com/ASnow)
[@evilangelmd](https://github.com/evilangelmd)
[@kadirgun](https://github.com/kadirgun)
[@nbdamian](https://github.com/nbdamian)
[@thorstenhirsch](https://github.com/thorstenhirsch)
[@ilessiivi](https://github.com/ilessiivi)
