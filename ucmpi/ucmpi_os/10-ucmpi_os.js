/*	alphawerk UHAI Node-Red Modules
	(c) 2018 alphaWerk Ltd
	Version: Check const _version
	Date: Check const _date

	support@alphawerk.co.uk
*/

const _version = "2.0.0"
const _date = "150921"


module.exports = function(RED) {
    "use strict";
    var modules = require('/home/pi/ucmpi_os/modules.js');
    //var debug = modules.debug;
 	modules.init("node-red", _version, _date);
 
 	// requested mode first, alarm mode second
 	var alarmmode = {
 		"cytechtext": {
 			"off":"off",
 			"away":"away",
 			"night":"night",
 			"day":"day",
 			"vacation":"vacation"
 			},
 		"cytechnumeric": {
 			"0":"off",
 			"1":"away",
 			"2":"night",
 			"3":"day",
 			"4":"vacation"
 			},
 		"homekittext": {
 			"off":"off",
 			"away":"away",
 			"night":"night",
 			"home":"day"
 			},
 		"homekitnumeric": {
 			"0":"day",
 			"1":"away",
 			"2":"night",
 			"3":"off"
 			}
 	};
 	
 	// alarmmode first, response second
 	var alarmmoderev = {
 		"cytechtext": {
 			"off":"off",
 			"away":"away",
 			"night":"night",
 			"day":"day",
 			"vacation":"vacation",
 			"arming":"arming",
 			"arming, waiting on zone":"arming, waiting on zone",
 			"entry delay":"entry delay",
 			"exit delay":"exit delay"
 			},
 		"cytechnumeric": {
 			"off":"0",
 			"away":"1",
 			"night":"2",
 			"day":"3",
 			"vacation":"4",
 			},
 		"homekittext": {
 			"off":"off",
 			"away":"away",
 			"night":"night",
 			"day":"home",
 			"vacation":"away"
 			},
 		"homekitnumeric": {
 			"off":3,
 			"away":1,
 			"night":2,
 			"day":0,
 			"vacation":1
 			}
 	};
 			
 	
 // Helper Functions
 
 	function status(node, content, timeout) {
 		if (typeof timeout === 'undefined')
 		{
 			timeout = 2;
 		}
 		
 		if (node.statustimeout) {
 			clearTimeout(node.statustimeout);
 		}
 		
 		node.status(content);
 		node.statustimeout = setTimeout(function () {
			node.status({});
			node.statustimeout = false;
			},timeout * 1000);
 	}
 	
	function setdottoobj(layer, path, value) {
		var i = 0;
   		var obj = layer;
        path = path.split('.');
		for (; i < path.length; i++) {
			if (i + 1 === path.length)
			{
				layer[path[i]] = value;
			}
			
			if(typeof layer[path[i]]!='undefined') {
				layer = layer[path[i]];
			} else {
				layer[path[i]] = {};
				layer = layer[path[i]];
			}	
			if (!layer) {
				layer = {};
			}
		}
		return obj;
	};
	
	function getdotfromobj(layer, path) {
		var i = 0;
        path = path.split('.');
    	for (; i < path.length; i++) {
			if(typeof layer[path[i]]!='undefined') {
				layer = layer[path[i]];
			} else {
				layer = null;
			}
		}
		return layer;	
	}
	
 	function detailedoutput(data, type, index, element) {
 		var contenttype;
 		 switch (type) {
 			case "zone":
 				contenttype = "zones";
 				break;
 			case "output":
 				contenttype = "outputs";
 				break;
 			case "flag":
 				contenttype = "flags";
 				break;
 			case "counter":
 				contenttype = "counters";
 				break;
 			case "sensor":
 				contenttype = "sensors";
 				break;	
 			case "alarm":
 				if (index=="type") {
					if (data.user) {
						contenttype = "users";
						index = data.user;
					} else if (data.zone) {
						contenttype = "zones";
						index = data.zone;
					}
					data.alarmtype = modules.getelement("alarmtypes",data.alarmtypeindex); 
				}	
 				break;	
 		}
 		data.type = type;
 		data.element = element;
 		data.index = index;
 		if (contenttype) {
 			data[type] = modules.getelement(contenttype, index);
 		}
 		return data;		
 	}
 	
 	function simpleoutput(value, type) {
		var simpletaxo = {
			"onoff": {"0": "off", "1": "on"},
			"boolean": {"0": false, "1": true},
			"openclosed": {"0": "closed", "1": "open"},
			"yesno": {"0": "no", "1": "yes"},
			"numeric": {"0": 0,"1":1}	
		};
		if (typeof simpletaxo[type][String(value)] !='undefined') {
			return simpletaxo[type][String(value)];
		}
		return value;
 	}
 	
 	function complexinput(value) {
 		var output = "0";
 		var on = ['yes','true','on','1','open'];
 		if (typeof value === 'string')
 			if (on.indexOf(value.toLowerCase())>-1)
				output = "1";
 		if (typeof value === 'number')
 			if (value>0)
 				output = "1";
 		if (typeof value === 'boolean')
 			if (value)
 				output = "1";
 		return output;		
	}
	
	function debug(message, obj, severity) {
		try {
			severity = severity || 1;
			if (obj) {
				if (typeof obj == 'object') {
					message += ":" + JSON.stringify(obj);
				} else {
					message += ":" + obj;
				}
			}		
			modules.debug(message, severity);
		} catch (err) {
			console.log ("Caught error on debug " + err);	
		}
	}



	// CytechZoneEvent

	function CytechZoneEvent(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        // Store local copies of the node configuration (as defined in the .html)
        this.zone = n.zone;
        this.event = n.event;
        this.trigger = n.trigger;
        this.setvirtualinput = n.setvirtualinput;
        this.setvirtualinputparam = n.setvirtualinputparam;
        this.setbypass = n.setbypass;
        this.setbypassparam = n.setbypassparam;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputsimplifiedvalue = n.outputsimplifiedvalue;

        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
		debug('Deploying Zone Node', node);

        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("zone",this.zone,this.event,node.id, function(type, index, element, data) {
				status(node, {fill: "green", shape: "dot", text: "Event: Zone " + index + ":" + element + "=" + data[element]});           		
           		var msg = {};
           		if ((node.outputtype == "detailed")||(node.event=="*")) {
					msg = {
					payload: {
						event: detailedoutput(data, type, index, element)
						}
					};
					
				} else {
					msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
				}
				debug(type + ' ' + index + ' triggered ' + element + ', sending ', msg);	
				node.send(msg);       		 
				});
		}
		
        // respond to inputs....
        this.on('input', function (msg) {
        	var target;
        	var element = node.event;
        	
        	if (node.zone!="*")
			{
				target = node.zone;
			}
			else if (msg.payload.id) 
			{
				target = String(msg.payload.id);
			}

			if ((getdotfromobj(msg,node.setbypassparam)!=null)&&(target)&&(node.setbypass)) {
				status(node, {fill: "yellow", shape: "dot", text: "Set: Zone " + target + ":bypass=" + getdotfromobj(msg,node.setbypassparam)});
				element = "bypass";
				debug("Request to change zone " + target + " bypass state to " + complexinput(getdotfromobj(msg,node.setbypassparam)));
				modules.requeststatus("zone",target, element,complexinput(getdotfromobj(msg,node.setbypassparam)));	
			}			

			if ((getdotfromobj(msg,node.setvirtualinputparam)!=null)&&(target)&&(node.setvirtualinput)) {
				status(node, {fill: "yellow", shape: "dot", text: "Set: Zone " + target + ":virtual input=" + getdotfromobj(msg,node.setvirtualinputparam)});
				debug("Request to change zone " + target + " virtual input state to " + complexinput(getdotfromobj(msg,node.setvirtualinputparam)));
				modules.requeststatus("zone",target, "virtualinput",complexinput(getdotfromobj(msg,node.setvirtualinputparam)));	
			}		
				
				
							
			if ((target)&&(node.inputtype!="off")){
			
				if (element == "*") {
					element = "value";
				}	
				if ((node.inputtype == "passive")&&(target)) {
					status(node,{fill: "green", shape: "dot", text: "Get: Zone " + target + ":" + element +"=" + modules.getstatus("zone",target, element)[element]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
							msg.payload.status =  detailedoutput(modules.getstatus("zone",target, element), "zone", target, element);
						} else {
									msg = {
										payload: {
											status: detailedoutput(modules.getstatus("zone",target, element), "zone", target, element)
										}
									};
								}
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(modules.getstatus("zone",target, element)[element],node.outputsimplifiedvalue));
						if (node.zone=="*") {
							// append id to msg.payload for simple outputs when node is listening to all events
							msg.payload.id = target;
						}
					}
					debug("Passive request for zone " + target + " " + element + ", responding with ",msg);
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							debug("Active response timed out ", node);
							modules.eventunsubscribe(timeout);
						},node.activewait * 1000);
						node.msg = msg
						debug("Active request for zone " + target + " " + element + ", creating subscription");
						modules.eventsubscribe("zone",target,element,timeout, function(type, index, element, data) {           		
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Zone " + index + ":" + element + "=" + data[element]});         
							if ((node.outputtype == "detailed")||(node.event=="*")) {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}
							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
							}
							debug("Active request response for " + type + ' ' + index + ' triggered ' + element + ', sending ', msg);	
							node.send(msg);
							// unsubscribe after receiving the event
							debug("Cancelling timeout as event received", node);
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						debug("Active request for zone " + target + " " + element + ", no need for subscription, already triggered");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Zone " + target + ":" + element});					
					modules.pollstatus("zone", target, element); 	
				}
        	}	
        });

        this.on("close", function() {
        	debug('Revoking Zone Node', node);
        	if (node.trigger) {
        		debug('Revoking Zone Node subscription ', node.id);
        		modules.eventunsubscribe(node.id);
        	}
        });
    }

	// CytechOutputEvent  
    
    function CytechOutputEvent(n) {
        RED.nodes.createNode(this,n);
        
        this.output = n.output;
        this.trigger = n.trigger;
        this.setvalue = n.setvalue;
        this.setvalueparam = n.setvalueparam;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputsimplifiedvalue = n.outputsimplifiedvalue;
        
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("output",this.output,"*",node.id, function(type, index, element, data) {
			status(node, {fill: "green", shape: "dot", text: "Event: Zone " + index + ":" + element + "=" + data[element]});           		
           	var msg = {};
           		if (node.outputtype == "detailed") {
					msg = {
					payload: {
						event: detailedoutput(data, type, index, element)
						}
					};					
				} else {
					msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
				}
			node.send(msg);       		 
			});
		}
        
         // respond to inputs....
        this.on('input', function (msg) {
        	var target;
        	var element = "value";
        	
        	if (node.output!="*")
			{
				target = node.output;
			}
			else if (msg.payload.id) 
			{
				target = String(msg.payload.id);
			}

			if ((getdotfromobj(msg,node.setvalueparam)!=null)&&(target)&&(node.setvalue)) {
				status(node, {fill: "yellow", shape: "dot", text: "Set: Output " + target + ":value=" + getdotfromobj(msg,node.setvalueparam)});
				modules.requeststatus("output",target, element,complexinput(getdotfromobj(msg,node.setvalueparam)));	
			}			

							
			if ((target)&&(node.inputtype!="off")){
			
					
				if ((node.inputtype == "passive")&&(target)) {
					status(node,{fill: "green", shape: "dot", text: "Get: Output " + target + ":" + element +"=" + modules.getstatus("output",target, element)[element]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
								msg.payload.status =  detailedoutput(modules.getstatus("output",target, element), "output", target, element);
							} else {
									msg = {
										payload: {
											status: detailedoutput(modules.getstatus("output",target, element), "output", target, element)
										}
									};
								}
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(modules.getstatus("output",target, element)[element],node.outputsimplifiedvalue));
						if (node.output=="*") {
							// append id to msg.payload for simple outputs when node is listening to all events
							msg.payload.id = target;
						}
					}
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							node.warn ("Timeout expired");
							modules.eventunsubscribe(timeout);
						},node.activewait * 1000);
						node.warn ("Subscribing to event");
						node.msg = msg
						modules.eventsubscribe("output",target,element,timeout, function(type, index, element, data) {           		
							node.warn ("Event received")
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Output " + index + ":" + element + "=" + data[element]});         
							if ((node.outputtype == "detailed")||(node.event=="*")) {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
							}
							node.send(msg);
							// unsubscribe after receiving the event
							node.warn ("Cancelling timeout as event received");
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						node.warn ("No need to setup subscription, I have a trigger");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Output " + target + ":" + element});					
					modules.pollstatus("output", target, element); 	
				}
        	}	
        });
            
        	
        this.on("close", function() {
        	if (node.trigger) {
        		modules.eventunsubscribe(node.id);
        	}
        });
    	// on initial deployment, poll the status

    }
    
    // CytechFlagEvent  
    
    function CytechFlagEvent(n) {
        RED.nodes.createNode(this,n);
        
        this.flag = n.flag;
        this.trigger = n.trigger;
        this.setvalue = n.setvalue;
        this.setvalueparam = n.setvalueparam;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputsimplifiedvalue = n.outputsimplifiedvalue;
        
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("flag",this.flag,"*",node.id, function(type, index, element, data) {
			status(node, {fill: "green", shape: "dot", text: "Event: Flag " + index + ":" + element + "=" + data[element]});           		
           	var msg = {};
           		if (node.outputtype == "detailed") {
					msg = {
					payload: {
						event: detailedoutput(data, type, index, element)
						}
					};					
				} else {
					msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
				}
			node.send(msg);       		 
			});
		}
        
         // respond to inputs....
        this.on('input', function (msg) {
        	var target;
        	var element = "value";
        	
        	if (node.flag!="*")
			{
				target = node.flag;
			}
			else if (msg.payload.id) 
			{
				target = String(msg.payload.id);
			}

			if ((getdotfromobj(msg,node.setvalueparam)!=null)&&(target)&&(node.setvalue)) {
				status(node, {fill: "yellow", shape: "dot", text: "Set: Flag " + target + ":value=" + getdotfromobj(msg,node.setvalueparam)});
				modules.requeststatus("flag",target, element,complexinput(getdotfromobj(msg,node.setvalueparam)));	
			}			

							
			if ((target)&&(node.inputtype!="off")){
			
					
				if ((node.inputtype == "passive")&&(target)) {
					status(node,{fill: "green", shape: "dot", text: "Get: Flag " + target + ":" + element +"=" + modules.getstatus("flag",target, element)[element]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
							msg.payload.status =  detailedoutput(modules.getstatus("flag",target, element), "flag", target, element);
						} else {
							msg = {
								payload: {
									status: detailedoutput(modules.getstatus("flag",target, element), "flag", target, element)
								}
							};
						}				
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(modules.getstatus("flag",target, element)[element],node.outputsimplifiedvalue));
						if (node.output=="*") {
							// append id to msg.payload for simple outputs when node is listening to all events
							msg.payload.id = target;
						}
					}
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							node.warn ("Timeout expired");
							modules.eventunsubscribe(timeout);
						},node.activewait * 1000);
						node.warn ("Subscribing to event");
						node.msg = msg
						modules.eventsubscribe("flag",target,element,timeout, function(type, index, element, data) {           		
							node.warn ("Event received")
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Flag " + index + ":" + element + "=" + data[element]});         
							if ((node.outputtype == "detailed")||(node.event=="*")) {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,simpleoutput(data[element],node.outputsimplifiedvalue));				
							}
							node.send(msg);
							// unsubscribe after receiving the event
							node.warn ("Cancelling timeout as event received");
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						node.warn ("No need to setup subscription, I have a trigger");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Flag " + target + ":" + element});					
					modules.pollstatus("flag", target, element); 	
				}
        	}	
        });
            
        
        this.on("close", function() {
        	if (node.trigger) {
        		modules.eventunsubscribe(node.id);
        	}
        });
    }

	// Cytech Counter Event

   	function CytechCounterEvent(n) {
        RED.nodes.createNode(this,n);
        
        this.counter = n.counter;
        this.trigger = n.trigger;
        this.setvalue = n.setvalue;
        this.setvalueparam = n.setvalueparam;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputsimplifiedvalue = n.outputsimplifiedvalue;
        
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("counter",this.counter,"*",node.id, function(type, index, element, data) {
			status(node, {fill: "green", shape: "dot", text: "Event: Counter " + index + ":" + element + "=" + data[element]});           		
           	var msg = {};
           		if (node.outputtype == "detailed") {
					msg = {
					payload: {
						event: detailedoutput(data, type, index, element)
						}
					};					
				} else {
					msg = setdottoobj(msg,node.outputsimplifiedkey,data[element]);				
				}
			node.send(msg);       		 
			});
		}
        
         // respond to inputs....
        this.on('input', function (msg) {
        	var target;
        	var element = "value";
        	
        	if (node.counter!="*")
			{
				target = node.counter;
			}
			else if (msg.payload.id) 
			{
				target = String(msg.payload.id);
			}

			if ((getdotfromobj(msg,node.setvalueparam)!=null)&&(target)) {
				status(node, {fill: "yellow", shape: "dot", text: "Set: Counter " + target + ":value=" + getdotfromobj(msg,node.setvalueparam)});
				modules.requeststatus("counter",target, element,getdotfromobj(msg,node.setvalueparam));	
			}			

							
			if ((target)&&(node.inputtype!="off")){
			
					
				if ((node.inputtype == "passive")&&(target)) {
					status(node,{fill: "green", shape: "dot", text: "Get: Counter " + target + ":" + element +"=" + modules.getstatus("counter",target, element)[element]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
							msg.payload.status =  detailedoutput(modules.getstatus("counter",target, element), "counter", target, element);
						} else {
							msg = {
								payload: {
									status: detailedoutput(modules.getstatus("counter",target, element), "counter", target, element)
								}
							};
						}				
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,modules.getstatus("counter",target, element)[element]);
						if (node.output=="*") {
							// append id to msg.payload for simple outputs when node is listening to all events
							msg.payload.id = target;
						}
					}
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							node.warn ("Timeout expired");
							modules.eventunsubscribe(timeout);
						},node.activewait * 1000);
						node.warn ("Subscribing to event");
						node.msg = msg
						modules.eventsubscribe("counter",target,element,timeout, function(type, index, element, data) {           		
							node.warn ("Event received")
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Counter " + index + ":" + element + "=" + data[element]});         
							if ((node.outputtype == "detailed")||(node.event=="*")) {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,data[element]);				
							}
							node.send(msg);
							// unsubscribe after receiving the event
							node.warn ("Cancelling timeout as event received");
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						node.warn ("No need to setup subscription, I have a trigger");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Counter " + target + ":" + element});					
					modules.pollstatus("counter", target, element); 	
				}
        	}	
        });
            
        
        this.on("close", function() {
        	if (node.trigger) {
        		modules.eventunsubscribe(node.id);
        	}
        });
    }

	// Cytech Sensor Event

	function CytechSensorEvent(n) {
        RED.nodes.createNode(this,n);
        
        this.sensor = n.sensor;
        this.trigger = n.trigger;
        this.setvalue = n.setvalue;
        this.setvalueparam = n.setvalueparam;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputsimplifiedvalue = n.outputsimplifiedvalue;
        
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("sensor",this.sensor,"*",node.id, function(type, index, element, data) {
			status(node, {fill: "green", shape: "dot", text: "Event: Sensor " + index + ":" + element + "=" + data[element]});           		
           	var msg = {};
           		if (node.outputtype == "detailed") {
					msg = {
					payload: {
						event: detailedoutput(data, type, index, element)
						}
					};					
				} else {
					msg = setdottoobj(msg,node.outputsimplifiedkey,data[element]);				
				}
			node.send(msg);       		 
			});
		}
        
         // respond to inputs....
        this.on('input', function (msg) {
        	var target;
        	var element = "value";
        	
        	if (node.sensor!="*")
			{
				target = node.sensor;
			}
			else if (msg.payload.id) 
			{
				target = String(msg.payload.id);
			}

			if ((getdotfromobj(msg,node.setvalueparam)!=null)&&(target)&&(node.setvalue)) {
				node.warn("Requested state change on " + target + " to " + getdotfromobj(msg,node.setvalueparam) + " via " + node.setvalueparam);
				status(node, {fill: "yellow", shape: "dot", text: "Set: Sensor " + target + ":value=" + getdotfromobj(msg,node.setvalueparam)});
				modules.requeststatus("sensor",target, element,getdotfromobj(msg,node.setvalueparam));	
			}			

							
			if ((target)&&(node.inputtype!="off")){
			
					
				if ((node.inputtype == "passive")&&(target)) {
					status(node,{fill: "green", shape: "dot", text: "Get: Sensor " + target + ":" + element +"=" + modules.getstatus("sensor",target, element)[element]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
							msg.payload.status =  detailedoutput(modules.getstatus("sensor",target, element), "sensor", target, element);
						} else {
							msg = {
								payload: {
									status: detailedoutput(modules.getstatus("sensor",target, element), "sensor", target, element)
								}
							};
						}				
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,modules.getstatus("sensor",target, element)[element]);
						if (node.output=="*") {
							// append id to msg.payload for simple outputs when node is listening to all events
							msg.payload.id = target;
						}
					}
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							node.warn ("Timeout expired");
							modules.eventunsubscribe(timeout);
						},node.activewait * 1000);
						node.warn ("Subscribing to event");
						node.msg = msg
						modules.eventsubscribe("sensor",target,element,timeout, function(type, index, element, data) {           		
							node.warn ("Event received")
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Sensor " + index + ":" + element + "=" + data[element]});         
							if ((node.outputtype == "detailed")||(node.event=="*")) {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,data[element]);				
							}
							node.send(msg);
							// unsubscribe after receiving the event
							node.warn ("Cancelling timeout as event received");
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						node.warn ("No need to setup subscription, I have a trigger");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Sensor " + target + ":" + element});					
					modules.pollstatus("sensor", target, element); 	
				}
        	}	
        });
            
        
        this.on("close", function() {
        	if (node.trigger) {
        		modules.eventunsubscribe(node.id);
        	}
        });
    }


	// Cytech Alarm Mode Event

	function CytechAlarmModeEvent(n) {
        RED.nodes.createNode(this,n);
        
        this.trigger = n.trigger;
        this.setmode = n.setmode;
        this.setmodeparam = n.setmodeparam;
        this.setmodevalue = n.setmodevalue;
        this.setpassparam = n.setpassparam;
        this.setpassvalue = n.setpassvalue;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputmodevalue = n.outputmodevalue;
        
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("alarm","mode","status",node.id, function(type, index, element, data) {
				status(node, {fill: "green", shape: "dot", text: "Event: Mode  =" + data["status"]});           		
				var msg = {};
					if (node.outputtype == "detailed") {
						msg = {
							payload: {
								event: detailedoutput(data, type, index, "status")
							}
						};					
					} else {
						msg = setdottoobj(msg,node.outputsimplifiedkey,parsemoderesponse(data["status"],node.outputmodevalue));				
					}
				node.send(msg);       		 
			});
		}
        
         // respond to inputs....
        this.on('input', function (msg) {


        	var passcode = node.setpassvalue; 
			if (getdotfromobj(msg,node.setpassparam)!=null) {
				passcode = getdotfromobj(msg,node.setpassparam);
			}

			if ((getdotfromobj(msg,node.setmodeparam)!=null)&&(node.setmode)) {
				var mode = parsemoderequest(getdotfromobj(msg,node.setmodeparam),node.setmodevalue);
				if (typeof mode != 'undefined') {
					mode = mode + ":" + passcode;
					status(node, {fill: "yellow", shape: "dot", text: "Set: Mode = " + getdotfromobj(msg,node.setmodeparam)});
					modules.requeststatus("alarm","mode", "status",mode);	
				} 
			}	

							
			if (node.inputtype!="off"){
				if (node.inputtype == "passive") {
					status(node,{fill: "green", shape: "dot", text: "Get: Mode = " + modules.getstatus("alarm","mode", "status")["status"]});
					// passive just gets latest values
					if (node.outputtype=="detailed") {
						if (typeof msg.payload == 'object') {
							msg.payload.status =  detailedoutput(modules.getstatus("alarm","mode", "status"), "alarm","mode","status");
						} else {
							msg = {
								payload: {
									status: detailedoutput(modules.getstatus("alarm","mode", "status"), "alarm","mode", "status")
								}
							};
						}				
					} else {        			
						msg = setdottoobj(msg,node.outputsimplifiedkey,parsemoderesponse(modules.getstatus("alarm","mode", "status")["status"],node.outputmodevalue));
					}
					node.send(msg);			
				} else {
					// active polls the device, if it is also triggering no need to add a subscription as it already exists 
					if (node.trigger==false) {
						node.warn ("Setting timeout at " + (node.activewait * 1000) + " milliseconds");
						var timeout = setTimeout(function () {
							node.warn ("Timeout expired");
							modules.eventunsubscribe(timeout);
							},node.activewait * 1000);
						node.warn ("Subscribing to event");
						node.msg = msg
						modules.eventsubscribe("alarm","mode","status",timeout, function(type, index, element, data) {           		
							node.warn ("Event received")
							var msg = node.msg;
							status(node,{fill: "green", shape: "dot", text: "Event: Mode =" + data[element]});         
							if (node.outputtype == "detailed") {
								if (typeof msg.payload == 'object') {
									msg.payload.status = detailedoutput(data, type, index, element);
								} else {
									msg = {
										payload: {
											status: detailedoutput(data, type, index, element)
										}
									};
								}							
							} else {
								msg = setdottoobj(msg,node.outputsimplifiedkey,parsemoderesponse(data[element],node.outputmodevalue));				
							}
							node.send(msg);
							// unsubscribe after receiving the event
							node.warn ("Cancelling timeout as event received");
							clearTimeout(timeout);
							modules.eventunsubscribe(timeout);       		 
						});
					
					} else {
						node.warn ("No need to setup subscription, I have a trigger");
					}
					status(node,{fill: "green", shape: "dot", text: "Poll: Mode "});					
					modules.pollstatus("alarm", "mode", "status"); 	
				}
        	}	
       });
            
        
        this.on("close", function() {
        	if (node.trigger) {
        		modules.eventunsubscribe(node.id);
        	}
        });
        
        // helper functions
        
        function parsemoderesponse(status, type) {
			if (typeof status == 'number') {
				status = status.toString();
			}
			if (typeof status != 'string'){
					node.warn("Status should be a string but is " + typeof status);
					return;
			}
			if (typeof alarmmoderev[type] != 'undefined') {
				status = status.toLowerCase();		
			if (typeof alarmmoderev[type][status] != 'undefined') {
 					return alarmmoderev[type][status];
 				} else {
 					node.warn ("Unable to find status \"" + status + "\" in " + type + ", valid types are:" + JSON.stringify(alarmmoderev[type])); 
 					return;
				}
			} else {
				node.warn ("Unable to find type " + type + " in known alarm types");
				return;
			}
   		}
        
        function parsemoderequest(status, type) {
 			if (typeof status == 'number') {
        		status = status.toString();
        	}
 		
 			if (typeof status != 'string'){
 				node.warn("Status should be a string but is " + typeof status);
 				return;
 			}
 			if (typeof alarmmode[type] != 'undefined') {
 				status = status.toLowerCase();		
 				if (typeof alarmmode[type][status] != 'undefined') {
 					return alarmmode[type][status];
 				} else {
 					node.warn ("Unable to find status \"" + status + "\" in " + type + ", valid types are:" + JSON.stringify(alarmmode[type])); 
 					return;	
 				}
 			} else {
 				node.warn ("Unable to find type " + type + " in known alarm types");
 				return;
 			}
   		}    
	}
	
	// Cytech Alarm Status Event

	function CytechAlarmStatusEvent(n) {
		// Create a RED node
		RED.nodes.createNode(this,n);
		
		this.trigger = n.trigger;
        this.setmode = n.setmode;
        this.setmodeparam = n.setmodeparam;
        this.setmodevalue = n.setmodevalue;
        this.setpassparam = n.setpassparam;
        this.setpassvalue = n.setpassvalue;
        this.inputtype = n.inputtype;
        this.activewait = n.activewait;
        this.outputtype = n.outputtype;
        this.outputsimplifiedkey = n.outputsimplifiedkey;
        this.outputmodevalue = n.outputmodevalue;

        // Store local copies of the node configuration (as defined in the .html)
        this.topic = n.topic;

        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
        
        // if the node will trigger events, do stuff here...
        if (node.trigger) {
			modules.eventsubscribe("alarm","type","status",node.id, function(type, index, element, data) {
				status(node, {fill: "green", shape: "dot", text: "Event: Mode  =" + data["status"]});           		
				var msg = {};
					if (node.outputtype == "detailed") {
						msg = {
							payload: {
								event: detailedoutput(data, type, index, "status")
							}
						};					
					} else {
						msg = setdottoobj(msg,node.outputsimplifiedkey,parsemoderesponse(data["status"],node.outputmodevalue));				
					}
				node.send(msg);       		 
			});
		}

        this.on("close", function() {
			if(node.trigger)
			{
				modules.eventunsubscribe(node.id);
			}
        });
	}

	
	function CytechResponse(n) {
		// Create a RED node
		RED.nodes.createNode(this,n);
		this.response = n.response;
        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
    	this.on('input', function (msg) {
    		if (typeof msg.payload == "boolean") {
    			if (this.response != "*") {
					var id = modules.getelementidbyname("responses",this.response);
					if (id>-1) {
						modules.requeststatus("response", id.toString(), "response", true);
						status(node, {fill: "green", shape: "dot", text: "Response " + this.response + " triggered"}); 		
					} else {
						status(node, {fill: "red", shape: "dot", text: "Response " + this.response + " not found"}); 
					}	
    			}
    		} else if(typeof msg.payload == "number") {
    			modules.requeststatus("response", msg.payload.toString(), "response", true);
    			status(node, {fill: "green", shape: "dot", text: "Response " + msg.payload.toString() + " triggered"});
    		} else if(typeof msg.payload == "string") {
    			var id = modules.getelementidbyname("responses",msg.payload);
    			if (id>-1) {
    				modules.requeststatus("response", id.toString(), "response", true);
    				status(node, {fill: "green", shape: "dot", text: "Response " + msg.payload + " triggered"});		
    			} else {
    				status(node, {fill: "red", shape: "dot", text: "Response " + msg.payload + " not found"}); 
    			}
    		} else {
    			node.warn("Unsupported msg.payload, must send boolean (true), index of response or name of response to trigger response");
    			status(node, {fill: "red", shape: "dot", text: "msg.payload of " + typeof msg.payload + " not supported"}); 
    		}
    	});
       
	}


    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    
    RED.nodes.registerType("cytech zone event",CytechZoneEvent);
    RED.nodes.registerType("cytech output event",CytechOutputEvent);
    RED.nodes.registerType("cytech flag event",CytechFlagEvent);
    RED.nodes.registerType("cytech counter event",CytechCounterEvent);
    RED.nodes.registerType("cytech sensor event",CytechSensorEvent);
	RED.nodes.registerType("cytech alarm mode event",CytechAlarmModeEvent);
	RED.nodes.registerType("cytech alarm status event",CytechAlarmStatusEvent);
	RED.nodes.registerType("cytech response",CytechResponse);
    
    RED.httpAdmin.get('/cytech/config/elements', function(req,res,next)
    {
    	var type = (req.query.type).toString();
		var items = modules.getelements(type);
		res.end(JSON.stringify(items));
	});
		
}
