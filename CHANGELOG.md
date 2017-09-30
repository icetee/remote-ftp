# Change Log

## [Unreleased]

## [1.2.0] - 2017-09-30

## Fixed
+ Fix .ftpconfig ENOENT issue
+ Add usable notifications [#896](https://github.com/icetee/remote-ftp/issues/896) [#112](https://github.com/icetee/remote-ftp/issues/112) [#373](https://github.com/icetee/remote-ftp/issues/873) [#434](https://github.com/icetee/remote-ftp/issues/434)
+ Add `ssh-agent` documentation [#849](https://github.com/icetee/remote-ftp/issues/849) (Thanks [@zlibra](https://github.com/zlibra), [@BenKennish](https://github.com/BenKennish))
+ Bad substr logic and set recursive download for 'Local < Remote' command [#918](https://github.com/icetee/remote-ftp/issues/918)
+ Add multiproject detail [#920](https://github.com/icetee/remote-ftp/issues/920)
+ Fix correct download list [#923](https://github.com/icetee/remote-ftp/issues/923)
+ Fix double click file download [#925](https://github.com/icetee/remote-ftp/issues/925)
+ Fix [#952](https://github.com/icetee/remote-ftp/issues/952) (Thanks [@lioutikov](https://github.com/lioutikov))
+ Fix keyboardInteractive dialog for Google Authenticator [#962](https://github.com/icetee/remote-ftp/issues/962) (Thanks [@maxswjeon](https://github.com/maxswjeon))
+ Fix memory leaks on save [#908](https://github.com/icetee/remote-ftp/issues/908)
+ Add (old school) method for check file type (if no available MLSD example IIS) [19e1738](https://github.com/icetee/remote-ftp/commit/19e17383d20a0079ec50ad67d35fd8a55b79c62a)
+ Fix duplication connect (when reconnected)
+ 🎨 Fix root icon position

## Featured
+ Supported UTF-8 filename in File-tree [#919](https://github.com/icetee/remote-ftp/issues/919)
+ Supported unix path style for privatekey [#216](https://github.com/icetee/remote-ftp/issues/216)
+ Supported IPv6 [#949](https://github.com/icetee/remote-ftp/issues/949)
+ Supported changes to permission and owner [#685](https://github.com/icetee/remote-ftp/issues/685)
+ Supported Drag & Drop (only move on a server) [BETA]

## Changed
+ Add `.ftpignore` documentation
+ Update deprecated packages
+ Tree view, File view, Directory view, file.js, directory.js changed to ES6
+ Extended `.eslintrc`
+ Remove `theorist` dependency (no maintained)
+ `Theorist` changed to `event-kit`
+ Begin notifications collect to notifications.js
+ Implemented `mlsd`
+ Add more helpers
+ Change double `cwd` to `mlsd` method
+ Centralized `isConnected` method in ftp.js
+ Change `self` to `this` several places
+ Optimized codes
+ 🎨 Change code styles
+ Add picto to offline view
+ Configurable server label [#848](https://github.com/icetee/remote-ftp/issues/848)
+ Add Permission Denied notification
+ 🎨 There are many code beauties 🎨
+ Add `remote-ftp:download-active` command (BETA)
+ Remove log when readconfig (spamming console)
+ Remove isAlreadyExits notification [a8019ff](https://github.com/icetee/remote-ftp/commit/a8019ff6449835383739851736d0f453c0fd8f78)
+ Implemented `SITE` method
+ Modify context-menu sequence [c68464b](https://github.com/icetee/remote-ftp/commit/c68464b2d9eb08aaf50e99065cea0e9b7b81a99e)
+ 🎨 Design if no use dock integration

## [1.1.4] - 2017-07-30 [CANCELED]

## [1.1.3] - 2017-07-11

## Fixed

+ Fix timeout to use Pure-FTP [#591](https://github.com/icetee/remote-ftp/issues/591)
+ Fix infinity listen debug event

## [1.1.2] - 2017-07-08

## Changed

+ Add check exists symlinks

## Fixed

+ Cannot read property 'filter' of undefined [#890](https://github.com/icetee/remote-ftp/issues/890)
+ Resolve wrong paths
+ Incorrect type identification [#889](https://github.com/icetee/remote-ftp/issues/889)

## [1.1.1] - 2017-07-07

## Fixed

+ Solved [#877](https://github.com/icetee/remote-ftp/issues/877) issue.
+ Optimized structure query for mkdir
+ Add plus notification (remote-ftp:add-file and remote-ftp:add-folder commands)
+ Unfortunately, there are currently unverified transactions. [#876](https://github.com/icetee/remote-ftp/issues/876)
+ Fixed wrong notification
+ Flush unnecessary cwd
+ Check undefined FTP folder list

## [1.1.0] - 2017-07-03

## Changed

+ Little ES6 styles
+ Renew config types
+ Simplify config query in attach method
+ Dock option change name
+ Modernize debugger
+ Hide resize-handle in Dock mode
+ Code beautification
+ Skip create folder structure in case permission denied
+ Add notification permission denied
+ Remove duplicate notification
+ Add global OS lib in client.js
+ Remove unnecessary debug lines
+ Clarifying variables
+ Check exists if create folder or file in remote
+ Rewrite .ftpignore
+ Transfered ownership [#813](https://github.com/icetee/remote-ftp/issues/813)
+ Added contributors in README.md
+ Add exception in .gitignore

## Fixed

+ Bad version number in new Dock notification
+ Fix [#820](https://github.com/icetee/remote-ftp/issues/820) issue, thanks [@robhuska](https://github.com/robhuska)
+ Fix bad watch paths [#724](https://github.com/icetee/remote-ftp/issues/724)
+ 421 Timeout issue [#591](https://github.com/icetee/remote-ftp/issues/591)
+ Fix invalid getFileName [#840](https://github.com/icetee/remote-ftp/issues/840)
+ Fix editor.getPath is not a function [#810](https://github.com/icetee/remote-ftp/issues/810)
+ Auto hide in Info notifications [#767](https://github.com/icetee/remote-ftp/issues/767)
+ Fix ENOTDIR issue [#112](https://github.com/icetee/remote-ftp/issues/112)
+ Fix checkIgnore parameter

## [1.0.0] - 2017-06-17

## Add

- Supported new [Atom dock](http://blog.atom.io/2017/04/12/atom-1-16.html)
- New setting option (useNewDockIntegration)
- CHANGELOG.md

## Fixed

- Class constructor Connector [(#729)](https://github.com/icetee/remote-ftp/pull/731)
- Fix JSON config file not reporting errors [(#738)](https://github.com/icetee/remote-ftp/pull/738)
- Fix upload issue Atom 1.7 [(#772)](https://github.com/icetee/remote-ftp/pull/772)
- Upload notifications [(#764)](https://github.com/icetee/remote-ftp/pull/764)

## Changed

- README
