# Quick Start
Installation instructions for getting started with the UCM-Pi

## What is this all about

This guide is intended to help new users of the UCM-Pi (a Universal Communication Module which supports a Raspberry Pi CM3 compatible single board computer) install the operating system, configure the device, install Node-Red and related code developed by alphaWerk to interface Node-Red to the Cytech Comfort Home Automation and Security System

Note: This guide is still in beta, as is the alphaWerk Node-Red modules and associated code.

## Getting Started

To get started, you will need

1. A Cytech Comfort Alarm system (www.cytech.com)  
2. A UCM-Pi available from Cytech
3. A Raspberry Pi CM3 or compatible device with onboard eMMC storage (min 4Gb)
4. A Windows, Mac or Linux computer

This guide below assumes you have performed the following steps:

1.  Flashed your UCM-Pi with the latest version of Raspbian Lite or Raspbian (https://www.raspberrypi.org/software/)
2.  Have been able to connect the UCM-Pi to your network and Comfort system, set a hostname and login.

If not please take a look at [Installing the hardware](Hardware.md)

## Configuring the Operating System

NB You can skip down to 'Installing Node-Red and the alphaWerk components' if you used the [prepared OS image](http://gofile.me/5j6S4/1pxPFapjh) provided by alphaWerk when flashing the device. 

### Enable the serial port 

`sudo raspi-config` from the command line.

1. Select Menu `3 Interfacing Options`
2. Select Menu `I6 Serial`
3. Answer `<No>` to `Would you like a login shell to be acccessible over serial?`
4. Answer `<Yes>` to `Would you like the serial port hardware to be enable?`
5. Select Menu `7 Advanced Options`
6. Select Menu `A1 Expand Filesystem`
5. Select `<Finish>` and `<Yes>` if prompted to reboot. 

Log back into the UCM-Pi once it has rebooted.

### Edit /boot/firmware/config.txt

`sudo nano /boot/firmware/config.txt` from the command line.

add the following to the bottom of the text file.

```
enable_uart=1
dtoverlay=pi3-disable-bt
dtparam=uart0=on
```

## Installing Node-Red and the alphaWerk components

This is the official script to install Node.js, npm and Node-RED onto a Raspberry Pi. The script can also be used to upgrade an existing install when a new release is available:

bash <(curl -sL https://github.com/node-red/linux-installers/releases/latest/download/update-nodejs-and-nodered-deb)

Then execute the following command to run the UCM/Pi installation script:

```
curl -sL https://raw.githubusercontent.com/sotatech/ucmpi_os/main/webfiles/install.sh | bash -
```

## All Done

Navigate to http://\<IP Address\>:1080 in a browser to create a user account and start using Node-Red.

