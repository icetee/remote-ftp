# Change Log

## [Unreleased]

## Changed
+ Remove Open Collective [#1220](https://github.com/icetee/remote-ftp/issues/1220)
+ Upgrade npm packages
+ Add more base keybinds [#1171](https://github.com/icetee/remote-ftp/issues/1171)
+ Upgrade SSH2 version [#1189](https://github.com/icetee/remote-ftp/issues/1189)

## Fixed
+ Fix [#1151](https://github.com/icetee/remote-ftp/issues/1151)
+ Fix directory "Copy name" function
+ Fix eta position
+ Fix [#1184](https://github.com/icetee/remote-ftp/issues/1184)
+ More accurate element search [#1213](https://github.com/icetee/remote-ftp/issues/1213)
+ Sometimes did not sync the root folder in the 'Sync local <- remote' command

## [2.2.0] - 2018-05-19

## Changed
+ Supported .cson config file [#1140](https://github.com/icetee/remote-ftp/issues/1140)
+ Remove `resize-handle` methods
+ Adapt to new tree-view design
+ Supported Drag & Drop download, upload
+ Add `.ftpconfig.cson` name to ftpignore

## Fixed
+ Keypress up/down move in folder
+ Improve the dock pane visibility [#1137](https://github.com/icetee/remote-ftp/issues/1137)
+ Asterisk problem solved [#1062](https://github.com/icetee/remote-ftp/issues/1062)

## [2.1.4] - 2018-01-06

## Changed
+ Change default SFTP port
+ Add `isGenericUploadError` in notifications [#1083](https://github.com/icetee/remote-ftp/pull/1083)

## Fixed
+ Remove “Could not get project path.” notification [#860](https://github.com/icetee/remote-ftp/issues/860)
+ Uncaught TypeError: Cannot read property 'emit' of undefined [#1100](https://github.com/icetee/remote-ftp/issues/1100)

## [2.1.2] - 2017-12-13

## Fixed
+ Supported APM package name conversion [#1066](https://github.com/icetee/remote-ftp/issues/1066) [#1081](https://github.com/icetee/remote-ftp/issues/1081)

## [2.1.1] - 2017-12-10

## Fixed
+ Fix .ftpignore from being loaded [#972](https://github.com/icetee/remote-ftp/issues/972)
+ Fix "Failed to activate" destroy is undefined [#1077](https://github.com/icetee/remote-ftp/issues/1077)

## Changed
+ Remove bad notifications if use ignore
+ Marked item if included in ignores
+ Upgrade ignore package

## [2.1.0] - 2017-12-06 🎅🏻

## Featured
+ Supported SFTP permissions change
+ Save Remote TreeView location [#1068](https://github.com/icetee/remote-ftp/issues/1068)

## Changed
+ Change global variable name atom.project['remoteftp-main'] -> atom.project.remoteftpMain
+ Remove Use Dock Integration options
+ Remove old panel attach, only usable Dock Pane method
+ Remove semver
+ Remove showOnRightSide deprecated change event
+ Remove useDockIntegration deprecated change event
+ Remove hideLocalWhenDisplayed deprecated event

## Fixed
+ Drop checkFeatures and add forcePasv default value [#1060](https://github.com/icetee/remote-ftp/issues/1060)
+ Fix bug [#1069](https://github.com/icetee/remote-ftp/issues/1069) and fix download onceConnected call
+ Fix force toggled TreeView
+ Fix crash change "Enable Drag and Drop" [#1075](https://github.com/icetee/remote-ftp/issues/1075)

## [2.0.0] - 2017-11-20

## Changed
+ Remove Chokidar package (~150 dependencies)
+ Supported native Filesystem Watcher API [PathWatcher](https://atom.io/docs/api/latest/PathWatcher) ([@putterson](https://github.com/putterson) Thanks)
+ The new major version drop supported older Atom versions.

## Fixed
+ Resolve undefined once method
+ Eslint issues

## [1.3.4] - 2017-11-20

## Changed
+ Upgrade SSH2 and SSH2-streams

## Fixed
+ Fix [#1029](https://github.com/icetee/remote-ftp/issues/1029)
+ Fix Cannot create icon-node for empty path [#690](https://github.com/icetee/remote-ftp/issues/690)
+ Incorrect watch notice
+ Fix path in Sync local method
+ Fix atom.project.remoteftp.once is not a function
+ Fix depth count in Windows
+ Fixed error object name in file upload
+ Fix Error: Failure [#942](https://github.com/icetee/remote-ftp/issues/942)

## [1.3.0] - 2017-11-03

## Featured
+ Supported multiple selection [#492](https://github.com/icetee/remote-ftp/issues/492) [#970](https://github.com/icetee/remote-ftp/issues/970)

## Fixed
+ Fix Download command from Project tab [#1023](https://github.com/icetee/remote-ftp/issues/1023)
+ Supported ignore Sync local and Download [#972](https://github.com/icetee/remote-ftp/issues/972)
+ Fixed multiple connection on closed (ECONNRESET and 421 error code)
+ Solved incorrect downloads [#1016](https://github.com/icetee/remote-ftp/issues/1016)
+ More checks ignores

## Changed
+ Grammar issue [#1032](https://github.com/icetee/remote-ftp/issues/1032)
+ Remove download method in syncLocal method

## [1.2.6] - 2017-10-21

## Fixed
+ Fix no property replace in .ftpconfig (remote option)
+ Supported backslash filename, foldername in UNIX system [#1021](https://github.com/icetee/remote-ftp/issues/1021)
+ Remove MLSD [#997](https://github.com/icetee/remote-ftp/issues/997) [#1000](https://github.com/icetee/remote-ftp/issues/1000) [#1006](https://github.com/icetee/remote-ftp/issues/1006) [#1007](https://github.com/icetee/remote-ftp/issues/1007) [#1011](https://github.com/icetee/remote-ftp/issues/1011) [#1016](https://github.com/icetee/remote-ftp/issues/1016) [#1018](https://github.com/icetee/remote-ftp/issues/1018) [#1022](https://github.com/icetee/remote-ftp/issues/1022) [#1024](https://github.com/icetee/remote-ftp/issues/1024) [#1025](https://github.com/icetee/remote-ftp/issues/1025)

## Changed
+ Add keyboardInteractiveForPass options

## [1.2.5] - 2017-10-11

## Fixed
+ Change pane title [#1012](https://github.com/icetee/remote-ftp/issues/1012)
+ Fix connect without password [#1004](https://github.com/icetee/remote-ftp/issues/1004)
+ Supported resolve homedir in SSH config

## [1.2.4] - 2017-10-05

## Fixed
+ Resolve [#992](https://github.com/icetee/remote-ftp/issues/992)

## [1.2.3] - 2017-10-05

## Fixed
+ Add not implemented info for [#993](https://github.com/icetee/remote-ftp/issues/993)
+ Fixed [#995](https://github.com/icetee/remote-ftp/issues/995)

## [1.2.2] - 2017-10-04

## Fixed
+ Add check features method [#992](https://github.com/icetee/remote-ftp/issues/992)

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
+ Fix root icon position

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
+ Design if no use dock integration

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
