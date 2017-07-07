# Change Log

## [Unreleased]

## [1.1.2] - 2017-07-08

## Changed

+ Add check exists symlinks

## Fixed

+ Cannot read property 'filter' of undefined #890
+ Resolve wrong paths
+ Incorrect type identification #889

## [1.1.1] - 2017-07-07

## Fixed

+ Solved #877 issue.
+ Optimized structure query for mkdir
+ Add plus notification (remote-ftp:add-file and remote-ftp:add-folder commands)
+ Unfortunately, there are currently unverified transactions. #876
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
