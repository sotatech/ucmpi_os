# ucmpi_os

This is the open source repo to build the UCMPi/OS.

## What's this all about

alphaWerk and Cytech collaborated in the development of a UCM for the Comfort range of Alarm / Home Automation systems to embed a Raspberry Pi.

This repo is an open source licensed version of the original Beta software which is now being retired in favour of this new open source version.

More information can be found here:

[Detailed Installation Instructions](https://github.com/alphawerk/ucmpi_os/blob/main/docs/README.md)

## Installation

For fresh installations, the following command will install the open source version, as per the instructions above:
```
curl -sL https://raw.githubusercontent.com/alphawerk/ucmpi_os/main/webfiles/install.sh | bash -
```

If you are already running the open source version and wish to use the latest and greatest main version, the following will update:
```
curl -sL https://raw.githubusercontent.com/alphawerk/ucmpi_os/main/webfiles/update.sh | bash -
```

If you are upgrading from an existing **alphaWerk** beta version, the following command can be used to facilitate the migration: 
```
curl -sL https://raw.githubusercontent.com/alphawerk/ucmpi_os/main/webfiles/upgrade.sh | bash -
```

## Further Information ##

This repo is maintained by alphaWerk but it is open source as per the [GNU GENERAL PUBLIC LICENSE](https://github.com/alphawerk/ucmpi_os/blob/main/LICENSE). We welcome contributions from users.

## Useful Links ##

The hardware is supported by [Cytech](http://www.cytech.biz) & [alphaWerk](http://www.alphawerk.co.uk).

There is a [forum](http://www.comfortforums.com/forum138/) for support

If you wish to join the slack group, please send an email to matt@alphawerk.co.uk

Copyright (c)  2018,2019,2020,2021 alphaWerk Ltd

## Compatibility Notes (Updated Sept 2025)

This fork of `ucmpi_os` has been updated for modern Raspberry Pi OS (Debian Bookworm) and Node.js 20.x.  
Several changes were made compared to the original `alphawerk` repo to ensure stability:

- **Node.js**: Requires Node.js **20.19.x or later**.  
- **bcrypt → bcryptjs**: Replaced native `bcrypt` (which often fails to compile) with pure-JS `bcryptjs`.  
- **serialport pinned**: Locked to `serialport@9.2.8` (newer releases require code changes for this project).  
- **epoll override**: `rpi-gpio` pulls in an old `epoll@2.x` that won’t compile.  
  This repo forces `epoll@^4.0.0` via the `overrides` field in `package.json`.  
- **express-handlebars**: Pinned at `3.0.0` for compatibility.  
  (Upgrading to `>=5.x` would require template changes.)  
- **request**: Still in use, but deprecated. Consider replacing with `node-fetch` or `axios` in the future.  
- **Known npm warnings**: Some transient dependencies (e.g. `inflight`, `har-validator`, `uuid@3`) are deprecated.  
  Since this system typically runs on a local network, these are acceptable for now but should eventually be cleaned up.  

### Installing

Clone this repo and run:

```bash
cd ~/ucmpi_os
./install.sh
