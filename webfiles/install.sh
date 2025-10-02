#!/bin/bash
# Minimal installer for Cytech / UCM-Pi Node-RED integration
# (c) 2025 cleaned version based on AlphaWerk script

set -e

echo "=== Updating system packages ==="
sudo apt update
sudo apt upgrade -y

echo "=== Installing prerequisites ==="
sudo apt install -y build-essential mosquitto mosquitto-clients unzip git

echo "=== Installing pigpio & confirm status ==="
sudo apt-get install -y pigpio
sudo systemctl enable pigpiod
sudo systemctl start pigpiod
sudo systemctl status pigpiod
sudo netstat -tlnp | grep pigpiod

echo "=== Installing Node-RED ==="
sudo apt install build-essential git curl
// bash <(curl -sL https://github.com/node-red/linux-installers/releases/latest/download/update-nodejs-and-nodered-deb) --confirm-pi --confirm-install --no-init
// Untested. Check if this actually works.....

echo "=== Installing required Node.js modules globally ==="
# pm2 is optional but useful for autostart
sudo npm install -g pm2

echo "=== Preparing directories ==="
mkdir -p ~/ucmpi_os
sudo mkdir -p /etc/ucmpi_os/core
sudo chown -R $USER:$USER /etc/ucmpi_os

echo "=== Cloning UCM-Pi service scripts (RS485 <-> MQTT bridge) ==="
if [ -d ~/ucmpi_os/temp ]; then
    rm -rf ~/ucmpi_os/temp
fi
mkdir ~/ucmpi_os/temp
cd ~/ucmpi_os/temp
git clone https://github.com/sotatech/ucmpi_os.git

# Copy service scripts into place
cp -r ucmpi_os/ucmpi/ucmpi_os/* ~/ucmpi_os
sudo cp ucmpi_os/ucmpi/absolute/etc/ucmpi_os/core/config.json /etc/ucmpi_os/core/config.json

echo "=== Installing Node-RED custom nodes ==="
cd ~/.node-red
# Assuming you have packaged your node-red-contrib-cytech folder with:
#   10-ucmpi_os.js, 10-ucmpi_os.html, modules.js, package.json
npm install /home/pi/ucmpi_os/

echo "=== Installing local dependencies (pinned for compatibility) ==="
cd ~/ucmpi_os

npm install \
  bcryptjs \
  body-parser \
  cookie-parser \
  express \
  express-fileupload \
  express-handlebars@3.0.0 \
  express-session \
  express-ws \
  fs-extra \
  memorystore \
  mitt \
  mqtt@4.3.7 \
  request \
  rpi-gpio \
  serialport@9.2.8 \
  uid-safe \
  xml2js \
  || error_exit "Error installing dependencies"

echo "=== Configuring Mosquitto (local broker) ==="
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
echo "bind_address 127.0.0.1" | sudo tee /etc/mosquitto/conf.d/localhost.conf
echo "allow_anonymous true" | sudo tee /etc/mosquitto/conf.d/auth.conf
sudo systemctl restart mosquitto

echo "=== Starting UCM-Pi bridge services with pm2 ==="
cd ~/ucmpi_os
pm2 start core.js configuration.js UCMEth.js manager.js node-red
pm2 list
pm2 save

echo "=== Installation complete ==="
echo "Node-RED is available at http://$(hostname -I | awk '{print $1}'):1880"
echo "Management console is at http://$(hostname -I | awk '{print $1}'):1080"
echo "You will need to create a user account in the management console before accessing Node-Red"
echo "Then set a UCM Login PIN and upload your current Comfigurator file."
