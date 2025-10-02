/*	alphawerk UHAI manager
	(c) 2018, 2021 alphaWerk Ltd
	Version: Check const _version
	Date: Check const _date
	Modified by Pat Rooney
	support@alphawerk.co.uk
*/

const _version = "2.0.0.4"
const _date = "202538"

const express = require('express');
const exphbs = require('express-handlebars');
const layouts = require('express-handlebars-layouts');
const session = require('express-session');
const memorystore = require('memorystore')(session);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const fileUpload = require('express-fileupload');
const parseXML = require('xml2js').parseString;
const fs = require('fs-extra');
const path = require('path');
const modules = require('./modules.js');
const uid = require('uid-safe');
const https = require('https');

const os = require('os');
const cp = require('child_process');

const externalretain = modules.externalretain;
const serialNumber = modules.serialNumber;
const debug = modules.debug;
const app = express();

const expressWs = require('express-ws')(app);

const listenport = 1080;
const configPath = '/etc/ucmpi_os/config';
const watchdogpin = 13;   // Output (Heartbeat to Comfort)
const watchdogwarn = 12;  // Input (Comfort warning)
const alertpin = 20;      // Input (Comfort alert)

const watchdogcycle = 7000;
const watchdoghigh = 2000;
const systemhealthcycle = 5000;

const friendlynameurl = "https://uhai.alphawerk.co.uk/api/friendlyname";
const registerurl = "https://uhai.alphawerk.co.uk/api/register";

var key = "";

var watchdog_timer = null;
var watchdog_mode = "running";
var watchdog_pinout = "";
var watchdog_reboot = null;
var starttime = null;

var systemhealth_timer = null;

//Safely access deeply nested values
const idx = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o)

//Ensure config path exists
configPath
    .split(path.sep)
    .reduce((currentPath, folder) => {
        currentPath += folder + path.sep;
        if (!fs.existsSync(currentPath)){
            fs.mkdirSync(currentPath);
        }
        return currentPath;
    }, '');
modules.init("manager", _version, _date)

// Webserver
var hbs = exphbs.create({
    extname      :'hbs',
    defaultLayout: false,     // Don't look for startup file main.hbs
    layoutsDir   : 'manager/views',
    partialsDir  : [
        'manager/views/layouts',
        'manager/views/fragment'
    ]
});

app.engine('hbs', hbs.engine);

app.set('view engine', 'hbs');
app.set('views', 'manager/views');

//Register layouts helpers on handlebars
hbs.handlebars.registerHelper(layouts(hbs.handlebars));
hbs.handlebars.registerHelper('each', function(context, options) {
    var ret = "";

    for(var i=0, j=context.length; i<j; i++) {
        ret = ret + options.fn(context[i]);
    }

    return ret;
});

// Register partials
hbs.handlebars.registerPartial('base_layout', fs.readFileSync('manager/views/layouts/base_layout.html.hbs', 'utf8'));
//hbs.handlebars.registerPartial('base_layout', fs.readFileSync('manager/views/base_layout.html.hbs', 'utf8'));

//Configure Express
app.use(fileUpload());
app.use(express.static(path.join(__dirname,'manager/views')));
app.use('/static', express.static(path.join(__dirname,'manager/static')));
app.use(express.urlencoded({extended: true}));
app.use(session({
    name: 'UCMPi',
    secret: 'session-secret',
    saveUninitialized: true,
    resave: true,
    store: new memorystore({
        checkPeriod: 86400000
    })
}));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

app.use((req, res, next) => {
    if (req.cookies.UCMPi && !req.session.user) {
        res.clearCookie('UCMPi-session-cookie');
    }
    next();
});

var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.redirect('/pi');
    } else {
        next();
    }
};

app.get('/', sessionChecker, (req,res)=> {
    if (req.session.user && req.cookies.UCMPi) {
        res.redirect('/pi');
    } else {
        res.redirect('/login');
    }
});

app.route('/login')
    .get(sessionChecker, (req,res) => {
        if (modules.getusers().length === 0) {
            res.redirect('/registerbuilder');
        } else {
            res.render('login.html.hbs');
        }
    })
    .post((req, res) => {
        var username = req.body.username;
        var password = req.body.password;
        if (modules.checkuserpasswordnoright(username, password)) {
            req.session.user = username;
            req.session.admin = modules.checkuser (username, modules.userrights['Admin']);
            res.redirect('/pi');
        } else {
            res.redirect('/login');
        }
    });

app.get('/registerbuilder', sessionChecker, (req,res) =>  {
    var querystring = "?serialnum=" + modules.serialNumber + "&UUID=" + modules.getuuid();
    if (req.query.msg)
        querystring += "&msg=" + req.query.msg;
    request(friendlynameurl + '?serialnumber=' + modules.serialNumber + '&password=' + modules.getuuid(), function (error, response, body) {
        if (error) {
            debug ("Unable to get FriendlyName " + error);
            querystring += "&reg=4";
            res.redirect("/register" + querystring);
        } else {
            if (response.statusCode === 200) {
                querystring += "&reg=2&friendlyname=" + body;
                res.redirect("/register" + querystring);
            } else {
                switch (response.body) {
                    case "Not Found":
                        querystring += "&reg=1";
                        res.redirect("/register" + querystring);
                        break;
                    case "Error 437":
                        querystring += "&reg=4";
                        res.redirect("/register" + querystring);
                        break;
                    case "Error 438":
                        querystring += "&reg=3";
                        res.redirect("/register" + querystring);
                        break;
                    case "Error 439":
                        querystring += "&reg=4";
                        res.redirect("/register" + querystring);
                        break;
                    default:
                        querystring += "&reg=4";
                        res.redirect("/register" + querystring);
                }
            }
        }
    });

});

app.route('/register')
    .get(sessionChecker, (req,res) => {
        if (modules.getusers().length > 0) {
            res.redirect('/login');
        } else {
            res.render('register.html.hbs');
        }
    })
    .post(sessionChecker,(req, res) => {
        if (modules.getusers().length > 0) {
            res.redirect('/login');
        }
        var useremail = req.body.useremail;
        var username = req.body.username;
        var password = req.body.password;
        var passwordcomp = req.body.passwordcomp;
        var friendlyname = req.body.friendlyname;
        var diagschk = req.body.diagschk;
        var configchk = req.body.configchk;
        var nodechk = req.body.nodechk;
        var betachk = req.body.betachk;
        if (password !== passwordcomp) {
            res.redirect('/registerbuilder?msg=2');
            return;
        }
        if ((!username) || (!useremail) || (!password)) {
            res.redirect('/registerbuilder?msg=0');
            return;
        }
        if (!betachk) {
            res.redirect('/registerbuilder?msg=1');
            return;
        }

        if (modules.adduser(username,useremail,password,modules.userrights.Admin + modules.userrights['Node-Red-Write'])) {
            // register on cloud server here
            request(registerurl + '?serialnumber=' + modules.serialNumber + "&email=" + useremail, function (error, response, body) {
                res.redirect('/login');
            });
        } else {
            res.redirect('/registerbuilder?msg=0');
        }
    });

app.route('/password')
    .get ((req,res) => {
        if (req.session.user && req.cookies.UCMPi) {
            res.render('updatepassword.html.hbs', {
                "username": req.session.user,
                "admin": req.session.admin
            });
        } else {
            res.redirect('/login');
        }
    })
    .post((req, res) => {
        if (req.session.user && req.cookies.UCMPi) {
            var username = req.session.user;
            var oldpassword = req.body.oldpassword;
            var newpassword = req.body.newpassword;
            var newpasswordconf = req.body.newpasswordconf;
            if (newpassword !== newpasswordconf) {
                res.redirect('/password?msg=2');
            }
            if (modules.checkuserpasswordnoright(username, oldpassword)) {
                if (modules.modifyuserpassword(username, oldpassword, newpassword)) {
                    res.redirect('/pi');
                } else {
                    res.redirect('/password?msg=3');
                }
            } else {
                res.redirect('/password?msg=1');
            }
        } else {
            res.redirect('/login');
        }
    });

app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.clearCookie('UCMPi');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

app.get('/pi', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        if (req.session.admin) {
            res.render('admin_ucm_pi.html.hbs', {
                "username": req.session.user,
                "admin": req.session.admin,
                "adminSidebar": true,
                "piLink": true
            });
        } else {
            res.render('userdash.html.hbs', {
                "username": req.session.user,
                "admin": req.session.admin,
                "adminSidebar": true,
                "piLink": true
            });
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/comfort', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.render('admin_ucm_comfort.html.hbs', {
            "username": req.session.user,
            "admin": req.session.admin,
            "adminSidebar": true,
            "comfortLink": true
        });
    } else {
        res.redirect('/login');
    }
});
app.get('/users', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.render('admin_ucm_users.html.hbs', {
            "username": req.session.user,
            "admin": req.session.admin,
            "adminSidebar": true,
            "usersLink": true
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/users_table', (req, res) => {
    if ((req.session.user && req.cookies.UCMPi) || (req.ip === '::ffff:127.0.0.1')) {

    	var users = modules.getusers();

        for (var i = 0; i < users.length; i++) {
            var user = users[i];
            for (var key in modules.userrights){
            	if (user.rights & modules.userrights[key]) {
					users[i][key] = true;
				} else {
					users[i][key] = false;
				}
            }
        }

        res.render('_users_table.html.hbs', {
            "users": users,
        });
    } else {
        res.send(false);
    }
});

app.get('/trace', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.render('admin_ucm_trace.html.hbs', {
            "username": req.session.user,
            "admin": req.session.admin,
            "diagSidebar": true,
            "traceLink": true
        });
    } else {
        res.redirect('/login');
    }
});
app.get('/cloud', (req, res) => {
    if (req.session.user && req.cookies.UCMPi) {
        res.render('admin_ucm_cloud.html.hbs', {
            "username": req.session.user,
            "admin": req.session.admin,
            "adminSidebar": true,
            "cloudLink": true
        });
    } else {
        res.redirect('/login');
    }
});

// todo
// app.get('/webhooks', (req,res) => {
//     res.send([{webhook: {name: 'matt', node: true, dash: true, config: true}}, {webhook: {name: 'bob'}}]);
// });
//
// app.get('/mqtthooks', (req,res) => {
//     res.send([{mqtthook: {name: 'matt', node: true, dash: true, config: true}}, {mqtthook: {name: 'bob'}}]);
// });

app.post('/api/comfigurator_upload', (req,res) => {
    if (!req.files)
    {
        // HTTP 400 Bad Request
        debug("No file sent");
        modules.send('ws_broadcast','No files were uploaded');
        return res.status(400).send('No files were uploaded.');
    }

    debug('[+] File Uploaded!');

    let config = req.files.config;

    let configXML = config.data.toString('utf8')

    parseXML(configXML, (err, parsedConfig) => {
        if(err || idx(['Configuration', 'FileInfo', 0, '$', 'CreatedBy'], parsedConfig) !== 'Comfigurator')
        {
            // HTTP 415 Unsupported Media Type
            debug("Invalid Comfigurator File Uploaded");
            modules.send('ws_broadcast','Not Valid Comfigurator Config');
            return res.status(415).send('Not Valid Comfigurator Config');


        }

        modules.externalretain("comfiguration/content", configXML);
        modules.externalretain('comfiguration/version', parsedConfig.Configuration.FileInfo[0].$.Version);
        modules.externalretain('comfiguration/datetime', parsedConfig.Configuration.FileInfo[0].$.DateTime);
        config.mv(configPath + '/config.xml', (err) => {
            if(err)
            {
                debug(err,4);
            }
        });

        res.end();
        modules.send('ws_broadcast','New comfigurator file uploaded');
    });
});

// -----------------------------------------------------------------------------
// Websocket stuff
// -----------------------------------------------------------------------------

app.ws('/ws', function(ws, req) {
    debug("WS session started by " + req.session.user);
    var instanceuid = uid.sync(10);
    //console.log('Websocket Opened');

    // admin specific functions
    if (req.session.admin) {
        sendws(ws,JSON.stringify({'topic':'watchdog','payload': {'status':watchdog_mode}}));
        sendws(ws,JSON.stringify({'topic':'watchdog/pinout','payload': {'status':watchdog_pinout}}));
        sendws(ws,JSON.stringify({'topic':'userrights','payload': modules.userrights}));
        sendws(ws,JSON.stringify({'topic':'userlist', 'payload': modules.getusers()}));
        sendUsersTable(ws);
        sendws(ws,JSON.stringify({'topic':'uuid', 'payload': modules.getuuid()}));

        sendws(ws,JSON.stringify({'topic':'friendlyname', 'payload': {'success': 'false', 'error' : 'Not supported'}}));
        sendws(ws,JSON.stringify({'topic':'backupcomf','payload': {'status':'false'}}));
        sendws(ws,JSON.stringify({'topic':'backupflow','payload': {'status':'false'}}));
        sendws(ws,JSON.stringify({'topic':'diags','payload': {'status':'false'}}));
        // create subscriptions
        modules.subscribetopic("uhai/manager/watchdog", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'watchdog','payload': {'status':message.toString()}}));
        }, instanceuid + "watchdog");

        modules.subscribetopic("uhai/manager/watchdog/warning", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'watchdog/warning','payload': {'status':message.toString()}}));
        }, instanceuid + "watchdog/warning");

        modules.subscribetopic("uhai/manager/watchdog/pinout", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'watchdog/pinout','payload': {'status':message.toString()}}));
        }, instanceuid + "watchdog/pinout");

        modules.subscribetopic("uhai/UCMEth/native/status", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'UCMEthNative','payload': {'status':message.toString()}}));
        }, instanceuid + "UCMEthNative");

        modules.subscribetopic("uhai/UCMEth/text/status", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'UCMEthText','payload': {'status':message.toString()}}));
        }, instanceuid + "UCMEthText");

        modules.subscribetopic("uhai/UCMEth/trace/status", (topic,message) => {
            sendws(ws,JSON.stringify({'topic':'UCMEthTrace','payload': {'status':message.toString()}}));
        }, instanceuid + "UCMEthTrace");


        modules.external("UCMEth/trace/control","status");
        modules.external("UCMEth/native/control","status");
        modules.external("UCMEth/text/control","status");

    }

    // Updates for all users

    sendws(ws,JSON.stringify({'topic':'serialnumber', 'payload':{'serialnumber':modules.serialNumber}}));

    modules.subscribetopic("uhai/manager/system/disk", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'disk','payload': {'status':message.toString()}}));
    }, instanceuid + "system/disk");

    modules.subscribetopic("uhai/manager/system/memory", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'memory','payload': {'status':message.toString()}}));
    }, instanceuid + "system/memory");

    modules.subscribetopic("uhai/manager/system/loadindex", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'loadindex','payload': {'status':message.toString()}}));
    }, instanceuid + "system/loadindex");

    modules.subscribetopic("uhai/manager/system/uptimetext", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'uptime','payload': {'status':message.toString()}}));
    }, instanceuid + "system/uptimetext");

    modules.subscribetopic("uhai/manager/system/ssh", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'ssh','payload': {'status':message.toString()}}));
    }, instanceuid + "system/ssh");

    modules.subscribetopic("uhai/manager/ws_broadcast", (topic,message) => {
        sendws(ws,JSON.stringify({'topic':'message','payload': {'status':message.toString()}}));
    }, instanceuid + "ws_broadcast");

    ws.on('close', function() {
        if (req.session.admin) {
            modules.unsubscribetopic(instanceuid + "watchdog");
            modules.unsubscribetopic(instanceuid + "watchdog/warning");
            modules.unsubscribetopic(instanceuid + "watchdog/pinout");
            modules.unsubscribetopic(instanceuid + "raw/sent");
            modules.unsubscribetopic(instanceuid + "raw/received");
            modules.unsubscribetopic(instanceuid + "debug");
            modules.unsubscribetopic(instanceuid + "UCMEthNative");
            modules.unsubscribetopic(instanceuid + "UCMEthText");
            modules.unsubscribetopic(instanceuid + "UCMEthTrace");
        }

        modules.unsubscribetopic(instanceuid + "system/disk");
        modules.unsubscribetopic(instanceuid + "system/memory");
        modules.unsubscribetopic(instanceuid + "system/loadindex");
        modules.unsubscribetopic(instanceuid + "system/uptimetext");
        modules.unsubscribetopic(instanceuid + "system/ssh");
        modules.unsubscribetopic(instanceuid + "ws_broadcast");

        //console.log("Websocket Closed");
    });

// Get updates from the system
systemmonitor();
if (req.session.admin) {
	ws.on('message', function(msg) {
		//console.log(msg);
		msg = JSON.parse(msg);
		//console.log(msg);
		switch (msg['topic']) {
			case "trace":
				if (msg['payload']['control'] === "true") {
					modules.subscribetopic("uhai/core/raw/sent", (topic, message) => {
						sendws(ws, JSON.stringify({'topic': 'tracetx', 'payload': {'status': message.toString()}}));
					}, instanceuid + "raw/sent");
					modules.subscribetopic("uhai/core/raw/received", (topic, message) => {
						sendws(ws, JSON.stringify({'topic': 'tracerx', 'payload': {'status': message.toString()}}));
					}, instanceuid + "raw/received");
				} else {
					modules.unsubscribetopic(instanceuid + "raw/sent");
					modules.unsubscribetopic(instanceuid + "raw/received");
				}
				break;
			case "debug":
				if (msg['payload']['control'] === "true") {
					modules.subscribetopic("uhai/debug", (topic, message) => {
						sendws(ws, JSON.stringify({'topic': 'debug', 'payload': JSON.parse(message)}));
					}, instanceuid + "debug");
				} else {
					modules.unsubscribetopic(instanceuid + "debug");
				}
				break;
			case "watchdog":
				switch (msg['payload']['control']) {
					case "pause":
						debug("watchdog pause requested");
						modules.send("watchdog/control", "pause");
						break;
					case "run":
						debug("watchdog run requested");
						modules.send("watchdog/control", "run");
						break;
					case "reboot":
						debug("watchdog reboot requested");
						modules.send("watchdog/control", "reboot");
						break;
					default:
						debug('unknown heartbeat command ' + msg['payload']['control']);
				}
				break;
			case "UCMEthNative":
				if (msg['payload']['control'] === 'start') {
					modules.externalretain("UCMEth/native/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					modules.externalretain("UCMEth/native/control","stop");
				}
				break;
			case "UCMEthText":
				if (msg['payload']['control'] === 'start') {
					modules.externalretain("UCMEth/text/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					modules.externalretain("UCMEth/text/control","stop");
				}
				break;
			case "UCMEthTrace":
				if (msg['payload']['control'] === 'start') {
					modules.externalretain("UCMEth/trace/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					modules.externalretain("UCMEth/trace/control","stop");
				}
				break;
			case "diags":
				if (msg['payload']['control'] === 'start') {
					//console.log("Sending On");
					modules.externalretain("logger/logging/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					//console.log("Sending Off");
					modules.externalretain("logger/logging/control","stop");
				}
				break;
			case "backupcomf":
				if (msg['payload']['control'] === 'start') {
					modules.externalretain("logger/backupcomf/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					modules.externalretain("logger/backupcomf/control","stop");
				}
				break;
			case "backupflow":
				if (msg['payload']['control'] === 'start') {
					modules.externalretain("logger/backupflow/control","start");
				} else if (msg['payload']['control'] === 'stop') {
					modules.externalretain("logger/backupflow/control","stop");
				}
				break;

			case "functionbutton":
				switch (msg['payload']['control']) {
					case "tap":
						function_button(500);
						break;
					case "5sec":
						function_button(7500);
						break;
					case "15sec":
						function_button(20000);
						break;
					case "30sec":
						function_button(40000);
						break;
					default:
						debug('unknown functionbutton command from ws ' + msg['payload']['control']);
				}
				break;
			case "updatepin":
				var ucm_config = {
					commType: "serial",
					commHost: "/dev/ttyAMA0",
					commPort: "1001",
					commUser: msg['payload']['data'],
					commBaud: "38400"
				};
				modules.external("core/config/comms", JSON.stringify(ucm_config));
				sendws(ws,JSON.stringify({'topic':'message','payload': {'status':"Pin Update Sent, check logs for success"}}));
				break;
			case "adduser":
				modules.adduser(msg['payload']['user'],msg['payload']['email'],msg['payload']['password'],msg['payload']['rights']);

				sendUsersTable(ws);
				break;
			case "deleteuser":
				modules.deleteuser(msg['payload']);

				sendUsersTable(ws);
				break;
			case "updateuser":
				modules.modifyuser(msg['payload']['user'], msg['payload']['email'], msg['payload']['rights']);

                sendUsersTable(ws);
				break;
			case "changefriendlyname":
				request(registerurl + '?serialnumber=' + modules.serialNumber + '&password=' + modules.getuuid() + "&friendlyname=" + msg['payload']['friendlyname'], function (error, response, body) {
					//console.log(body);
				});
				break;
			case "remotescript":
				debug("request to execute remote script " + msg['payload']['remotescript']);
				request(msg['payload']['remotescript'], function (error, response, body) {
					if (error) {
						sendws(ws,JSON.stringify({'topic':'message','payload': {'status':"Unable to get remote script " + error}}));
						debug("Unable to get remote script " + error);
					}
					if (response.statusCode = 200) {
						try {
							debug("removing update dir in case it exists");
							fs.removeSync("/home/pi/ucmpi_os/update");
						} catch (error) {
							debug("didn't remove update dir because " + error);
						}
						try {
							debug("Creating update dir");
							fs.mkdirSync("/home/pi/ucmpi_os/update");
							debug("Writing script to disk");
							fs.writeFileSync("/home/pi/ucmpi_os/update/update.sh", body, {mode: 0o777});
							debug("Executing script");
							var result = cp.execFileSync("/home/pi/ucmpi_os/update/update.sh", {stderr: "stdio"});
							debug("Script output " + result);
							sendws(ws,JSON.stringify({'topic':'message','payload': {'status':"Script executed:" + result}}));
							debug("Deleting temporary folder");
							fs.removeSync("/home/pi/ucmpi_os/update");
						} catch (error) {
							sendws(ws,JSON.stringify({'topic':'message','payload': {'status':"Error executing script:" + error}}));
							debug("Error executing script  " + error);
						}
					} else {
						sendws(ws,JSON.stringify({'topic':'message','payload': {'status':"Unable to get remote script " + body}}));
						debug("Unable to get remote script " + body);
					}
				});
				break;
			case "ssh":
				if (msg['payload']['control'] === 'start') {
					debug("SSH Service Starting");
					try {
						cp.execSync('sudo update-rc.d ssh enable');
						cp.execSync('sudo invoke-rc.d ssh start');
						systemmonitor();
					} catch (error) {
						debug("Error starting SSH " + error);
					}
				} else {
					debug("SSH Service Stopping");
					try {
						cp.execSync('sudo update-rc.d ssh disable');
						cp.execSync('sudo invoke-rc.d ssh stop');
						systemmonitor();
					} catch (error) {
						debug("Error stopping SSH " + error);
					}
				}
				break;
			case "flush":
				debug("Flushing Logs");
				try {
					cp.execSync('pm2 flush');
				} catch (error) {
					debug ("Error flushing logs:"+ error);
				}
				systemmonitor();
				break;
			case "pipassword":
				debug("pi password change request");
				try {
					cp.execSync('echo pi:'+ msg['payload']['password'] + ' | sudo chpasswd');
				} catch (error)	{
					debug("Error changing password: " + error);
				}
				break;
			default:
				//console.log('unknown command type ' + msg['topic']);
				break;
			}
		});
	}
});

function sendws(ws, content) {
	//console.log("Sending " + content);
	try {
		ws.send(content);
	} catch (error) {
		debug("Error sending " + content + " to websocket");
		ws.close();
		//ws.terminate();
		//ws.unref();
	}
}

app.listen(listenport, () => debug('[*] Listening on port %s', listenport, 1));

// -----------------------------------------------------------------------------
// Watchdog
// -----------------------------------------------------------------------------

const pigpio = require('pigpio-client').pigpio;
const client = pigpio({ host: '::1', port: 8888 });

let watchdogOut, watchdogWarnIn, alertIn;

// Connect to pigpio daemon
client.on('connected', () => {
    console.log("✅ Connected to pigpiod on ::1:8888");
    debug("Connected to pigpiod on ::1:8888");

    // Configure Watchdog Output (pin 13)
    watchdogOut = client.gpio(watchdogpin);
    watchdogOut.modeSet('output');

// Configure Watchdog Warning Input (pin 12)
	watchdogWarnIn = client.gpio(watchdogwarn);
	watchdogWarnIn.modeSet('input');
	watchdogWarnIn.pullUpDown(1); // PUD_DOWN
	watchdogWarnIn.notify((level) => {
		debug(`⚡ Watchdog Warn changed: ${level ? 'HIGH' : 'LOW'}`);
		gpioinput(watchdogwarn, level);
	});

	// Configure Alert Button Input (pin 20)
	alertIn = client.gpio(alertpin);
	alertIn.modeSet('input');
	alertIn.pullUpDown(2); // PUD_UP (normally high)
	alertIn.notify((level) => {
		debug(`⚡ Alert Button changed: ${level ? 'HIGH' : 'LOW'}`);
		gpioinput(alertpin, level);
});

    // Start watchdog heartbeat
    watchdog_timer = setInterval(watchDog, watchdogcycle);
    modules.sendretain("watchdog", "running");
    watchdog_mode = "running";
    debug("Watchdog heartbeat started");
});

// Heartbeat function
function watchDog() {
    if (!watchdogOut) {
        console.log("⚠️ Watchdog output not initialized yet");
        return;
    }

    watchdogOut.write(1).then(() => {
        debug("⚡ Watchdog HIGH");
        modules.send('watchdog/pinout', 'high');
        watchdog_pinout = "high";

        setTimeout(() => {
            watchdogOut.write(0).then(() => {
                debug("⚡ Watchdog LOW");
                modules.send('watchdog/pinout', 'low');
                watchdog_pinout = "low";
            }).catch(err => {
                debug("❌ Error writing watchdog LOW: " + err);
            });
        }, watchdoghigh);
    }).catch(err => {
        debug("❌ Error writing watchdog HIGH: " + err);
    });
}

/**
 * Handle comfort button presses and publish to MQTT.
 * Publishes messages to topic: uhai/manager/alert
 * 
 * Mapping:
 *  - Tap (<5s)          → "tapped"
 *  - Hold >5s           → "5 seconds"
 *  - Hold >15s          → "15 seconds"
 *  - Hold >30s          → "30 seconds"
 */
function function_button(delta) {
    if (delta > 30000) {
        modules.send("alert", "30 seconds");
        console.log("▶️ Comfort button held 30 seconds");
    } else if (delta > 15000) {
        modules.send("alert", "15 seconds");
        console.log("▶️ Comfort button held 15 seconds");
    } else if (delta > 5000) {
        modules.send("alert", "5 seconds");
        console.log("▶️ Comfort button held 5 seconds");
    } else if (delta > 100) {
        modules.send("alert", "tapped");
        console.log("▶️ Comfort button tapped");
    }
    // Ignore anything shorter (debounce)
}

// GPIO Input handler
function gpioinput(channel, value) {
    const state = (value === 1) ? 'high' : 'low';

    if (channel === alertpin) {
        if (value === 1) {
            starttime = Date.now();
        } else {
            const delta = Date.now() - starttime;
            starttime = Date.now();
            function_button(delta);
        }
    } else if (channel === watchdogwarn) {
        if (value === 1) {
            modules.send("watchdog/warning", "high");
            if (watchdog_reboot) {
                clearTimeout(watchdog_reboot);
                watchdog_reboot = null;
                debug("Watchdog shutdown cancelled");
            }
        } else {
            modules.send("watchdog/warning", "low");
            if (!watchdog_reboot) {
                debug("Watchdog preparing for shutdown");
                watchdog_reboot = setTimeout(() => {
                    debug("System shut down");
                    // cp.spawn('sudo shutdown -h 0', {"shell": true});
                }, 10000);
            }
        }
    } else {
        debug("GPIO on " + channel + " : " + state);
    }
}

// -----------------------------------------------------------------------------
// Watchdog Control (pause / run / reboot)
// -----------------------------------------------------------------------------

modules.subscribetopic("uhai/manager/watchdog/control", (topic, message) => {
    const msg = message.toString().trim();   // <— convert Buffer to string
    debug("Received message for watchdog: " + msg);

    if (msg === "pause") {
        if (watchdog_timer) clearInterval(watchdog_timer);
        watchdog_timer = null;

        if (watchdogOut) watchdogOut.write(1); // force high
        modules.sendretain("watchdog", "paused");
        modules.send("watchdog/pinout", "high");
        watchdog_mode = "paused";
        watchdog_pinout = "high";
        debug("Watchdog Paused");

    } else if (msg === "reboot") {
        if (watchdog_timer) clearInterval(watchdog_timer);
        watchdog_timer = null;

        if (watchdogOut) watchdogOut.write(0); // force low
        modules.send("watchdog/pinout", "low");
        modules.sendretain("watchdog", "rebooting");
        watchdog_mode = "rebooting";
        watchdog_pinout = "low";
        debug("Watchdog Force Reboot");

    } else if (msg === "run") {
        if (watchdog_timer) clearInterval(watchdog_timer);

        watchdog_timer = setInterval(watchDog, watchdogcycle);
        modules.sendretain("watchdog", "running");
        watchdog_mode = "running";
        debug("Watchdog Running");
    }
});

// -----------------------------------------------------------------------------
// System Monitoring
// -----------------------------------------------------------------------------

function systemmonitor() {
    cp.exec('df -h / | tail -1 | awk \'{print $4}\'', (error, stdout) => {
        if (error) {
            modules.sendretain("system/disk/error", error);
        } else {
            modules.sendretain("system/disk", stdout);
        }
    });

    cp.exec('free -h | sed -n \'2p\' | awk \'{print $4}\'', (error, stdout) => {
        if (error) {
            modules.sendretain("system/memory/error", error);
        } else {
            modules.sendretain("system/memory", stdout);
        }
    });

    cp.exec('cat /proc/loadavg | awk \'{print $1}\'', (error, stdout) => {
        if (error) {
            modules.sendretain("system/loadindex/error", error);
        } else {
            modules.sendretain("system/loadindex", stdout);
        }
    });

    cp.exec('service ssh status | grep inactive', (error, stdout) => {
        if (stdout.length > 20) {
            modules.sendretain("system/ssh", "false");
        } else {
            modules.sendretain("system/ssh", "true");
        }
    });

    cp.exec('cat /proc/uptime | awk \'{print $1}\'', (error, stdout) => {
        if (error) {
            modules.sendretain("system/uptime/error", error);
        } else {
            modules.sendretain("system/uptimesecs", stdout);
            var seconds = parseInt(stdout, 10);
            var days = Math.floor(seconds / (3600 * 24));
            seconds -= days * 3600 * 24;
            var hrs = Math.floor(seconds / 3600);
            seconds -= hrs * 3600;
            var mnts = Math.floor(seconds / 60);
            seconds -= mnts * 60;
            modules.sendretain("system/uptimetext",
                days + " days, " + hrs + " hrs, " + mnts + " mins, " + seconds + " secs"
            );
        }
    });

    // Watchdogwarn check
    if (watchdogWarnIn) {
        watchdogWarnIn.read().then(value => {
            gpioinput(watchdogwarn, value);
        }).catch(err => {
            debug("Error reading watchdogwarn GPIO: " + err);
        });
    }
}

systemhealth_timer = setInterval(systemmonitor, systemhealthcycle);

function sendUsersTable(ws) {
	request("http://localhost:1080/users_table", function (error, response, body) {
		if (error) {
			debug("Unable to get userlisttable " + error);
			sendws(ws, JSON.stringify({
				'topic': 'userlisttable',
				'payload': {'success': 'false', 'error': 'Unable to contact server' + error}
			}));
		} else {
			// todo remove duplication in error handling
			if (response.statusCode === 200) {
				sendws(ws, JSON.stringify({
					'topic': 'userlisttable',
					'payload': {'success': 'true', 'html': body}
				}));
			} else {
                sendws(ws, JSON.stringify({
                    'topic': 'userlisttable',
                    'payload': {'success': 'false', 'error': 'Unable to fetch user table.'}
                }));
            }
		}
	});
}
