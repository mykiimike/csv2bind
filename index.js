var fs = require("fs");
var readline = require('readline');
var ejs = require("ejs");
var ipTrans = require("ip");
var jen = require("node-jen")(false);

require("colors");
var clim = require("clim");
var oldConsole = console;
var console = require("console");

clim.logWrite = function(level, prefixes, msg) {
	var line = clim.getTime().gray + " " ;
	var pro = process.stdout;
	if(level == "LOG")
		line += level.bgBlue.white;
	else if(level == "INFO")
		line += level.bgGreen.white;
	else if(level == "WARN")
		line += level.bgYellow.red;
	else if(level == "ERROR") {
		line += level.bgRed.white;
		pro = process.stderr;
	}
	if(prefixes.length > 0) 
		line += " " + prefixes.join(" ");
	line += " " + msg;
	  
	pro.write(line + "\n");
};

function context(config) {
	this.zoneFile = {};
	this.revertFile = {};
	this.defaultAddress = {};
	this.zoneIPS = {};
	this.zoneCNAME = {};
	this.compute = 0;
	this.config = config;
	this.tld = config.domain.split('.');
	
	this.inputs = 0;
	this.filtered = 0;
	this.linesNum = 0;
	this.lines = [];
}

var regexDHCP = /^dhcp-([0-9]+)\./;
var regexNS = /^ns([0-9]+)/;
var regexDomain = /^([a-z0-9_.-]+)$/i;
var regexIPv4 = /^([0-9]+).([0-9]+).([0-9]+).([0-9]+)$/;

context.prototype.firstPass = function(line) {
	var self = this;
	
	var sp = line.split(";"),
	ns = sp[0].toLowerCase(),
	ip = sp[1];
	
	if(ns.length > 1 && ip.length > 1) {
		
		var domName = ns.split('.');
		var aDomName = ns.split('.');
		if(domName.length > 1) {
			var domNamePre = domName.shift();
			domName = domName.join('.');
			
			/* control NS */
			if(!regexDomain.test(ns)) {
				console.log("Skipping "+ns+" on line "+self.linesNum+" not a domain name");
				self.filtered++;
				return;
			}
			
			/* control the input domName */
			if(ns == self.config.domain) {
				/* special case for default address for global TLD */
				if(!self.defaultAddress.hasOwnProperty(ns))
					self.defaultAddress[ns] = [];
				self.defaultAddress[ns].push(ip);
				return;
			}
			else {
				for(var a=aDomName.length-1, b=self.tld.length-1; b>=0; a--, b--) {
					if(aDomName[a] != self.tld[b]) {
						console.log("Drop line "+ns+" on line "+self.linesNum);
						self.filtered++;
						return;
					}
				}
			}
	
			/* initial */
			if(!self.zoneFile.hasOwnProperty(domName)) {
				self.zoneFile[domName] = {};
				self.zoneIPS[domName] = {};
				self.zoneCNAME[domName] = {};
			}
			
			/* is assignator an IP ? */
			if(!regexIPv4.test(ip)) {
				
				/* is a CNAME ? removed for the moment */
				/*
				if(regexDomain.test(ip) && ip.split('.').length > 1) {
					if(!self.zoneCNAME[domName].hasOwnProperty(domNamePre)) {
						self.zoneCNAME[domName][domNamePre] = ip;
						console.log("Adding CNAME "+ns+" > "+ip);
						return;
					}
					
					console.info("Two CNAMEs are used for the same entry: "+ns+" pointing to "+ip);
					return;
				}
				*/
				return;
			}
			
			/* check for default address */
			if(self.zoneFile.hasOwnProperty(ns)) {
				if(!self.defaultAddress.hasOwnProperty(ns))
					self.defaultAddress[ns] = [];
				self.defaultAddress[ns].push(ip);
			}
			
			/* check for DHCP rules */
			var dhcp = regexDHCP.exec(ns);
			if(dhcp) {
				var dhcpNum = dhcp[1];
				var ipBase = ipTrans.toLong(ip);
	
				for(var a=1; a<=dhcpNum; a++) {
					var newNs = ejs.render(self.config.dhcpEJS, {
						num: a,
						rand: jen.password(5)
					});
					
					var nIP = self.zoneFile[domName][newNs] = ipTrans.fromLong(ipBase+a);
					
					var ipRange = nIP.split('.');
					var ipRangePre = ipRange.pop();
					ipRange = ipRange.join('.');
	
					if(!self.revertFile[ipRange])
						self.revertFile[ipRange] = {};
					
					self.revertFile[ipRange][ipRangePre] = newNs;
					self.inputs++;
				}
				
				console.info("DHCP processing "+dhcpNum+" entries for "+ns+" starting at "+ip);
				return;
			}
			
			/* update default zone */
			self.zoneFile[domName][domNamePre] = ip.trim();
			
			/* add IP address */
			if(!self.zoneIPS[domName][domNamePre])
				self.zoneIPS[domName][domNamePre] = [];
			
			self.zoneIPS[domName][domNamePre].push(ip.trim());
			
			var ipRange = ip.split('.');
			var ipRangePre = ipRange.pop();
			ipRange = ipRange.join('.');
	
			if(!self.revertFile[ipRange])
				self.revertFile[ipRange] = {};
			
			self.revertFile[ipRange][ipRangePre] = ns.trim();
			self.inputs++;
		}
	}
	
};

context.prototype.addFile = function(file) {
	var fd = fs.createReadStream(file);
	var rl = readline.createInterface({
		input: fd
	});

	var self = this;
	
	this.compute++;
	rl.on("line", function(line) {
		self.linesNum++;
		
		/* first order */
		var sp = line.split(";"),
		ns = sp[0],
		ip = sp[1];
		
		if(ns && ip && ns.length > 1 && ip.length > 1)
			self.lines.push(line);
	});
	fd.on('end', function() {
		console.info(self.linesNum+" lines processed from "+file);
		if(self.filtered > 0)
			console.warn(self.filtered+" filtered entries in "+file);
		
		if(self.filtered > 0 && self.inputs == 0)
			console.warn("Actually you only have filtered entries you probably need to change the TLD using -domain");
		self.compute--;
	});
	
};

context.prototype.render = function(cb) {
	var self = this;
	setInterval(function() {
		
		if(self.compute == 0) {
			
			/* descending sort */
			console.log("Descendant sort on "+self.linesNum+" lines");
			function cmp(a, b) {
				if(a.length < b.length)
					return(1);
				if(a.length > b.length)
					return(-1);
				return(0);
			}
			
			/* processing first pass */
			console.log("Processing first pass");
			for(var a in self.lines)
				self.firstPass(self.lines[a]);
			
			console.info(self.inputs+" entries found and selected");
			
			var namedLocalZone = [];
			var namedLocalRevert = [];
			
			/* tld */
			var TLD = self.zoneFile[self.config.domain];
			
			/* zone files */
			var tpl = fs.readFileSync("./template/zone.txt").toString();

			console.log("Processing second pass");
			for(var zfile in self.zoneFile) {
				var zone = self.zoneFile[zfile];
				var fileName = self.config.out+"/zones/"+zfile+".zone";
				var now = new Date();
				var serial = ""+now.getYear()+
					now.getMonth()+
					now.getDay()+
					Math.round(Math.random()*100);
					
				/* check name server definition */
				var nss = [];
				for(var a in zone) {
					if(regexNS.test(a))
						nss.push(a);
				}
				if(zone.hasOwnProperty("ns"))
					nss.push("ns");
				
				/* multiple NS and no ns entry ? */
				if(nss.length > 0 && !zone.hasOwnProperty("ns")) {
					// \todo multiIP
					zone["ns"] = zone[nss[0]];
					console.info("Creating NS entry for "+zfile);
				}
				else if(TLD.hasOwnProperty("ns") && !zone.hasOwnProperty("ns")) {
					self.zoneFile[zfile]['ns'] = TLD['ns'];
					nss.push("ns");
					console.log("Creating NS entry for "+zfile);
				}
				
				if(!zone.hasOwnProperty("ns")) {
					console.warn("No NS entry for zone "+zfile+" and no default entry from TLD");
				}
				
				/* check root server */
				if(!self.zoneFile[zfile].hasOwnProperty("root")) {
					if(nss.length == 0) {
						if(!TLD.hasOwnProperty("ns"))
							console.error("No root entry defined for "+zfile+" can not default to NS!!");
						else {
							self.zoneFile[zfile]["root"] = TLD['ns'];
							console.log("No root entry defined for "+zfile+" default to TLD NS");
						}
					}
					else {
						console.log("No root entry defined for "+zfile+" default to NS");
						self.zoneFile[zfile]["root"] = self.zoneFile[zfile][nss[0]];
					}
				}
				
				/* check CNAME collision */
				for(var a in self.zoneCNAME[zfile]) {
					var cname = self.zoneCNAME[zfile][a];
					console.log(a, cname)
					
				}
				
				/* minimal */
				if(!self.defaultAddress.hasOwnProperty(zfile))
					self.defaultAddress[zfile] = [];
				
				var buf = ejs.render(tpl, {
					config: self.config,
					domName: zfile,
					serial: serial,
					list: self.zoneFile[zfile],
					defaultAddress: self.defaultAddress[zfile],
					ips: self.zoneIPS[zfile],
					nss: nss,
					cname: self.zoneCNAME[zfile],
				});
				namedLocalZone.push({
					domName: zfile,
				});
				fs.writeFileSync(fileName, buf);
				
				console.log("Rendering "+fileName+" with serial "+serial);
			}

			/* revert files */
			var tpl = fs.readFileSync("./template/revert.txt").toString();

			for(var zfile in self.revertFile) {
				
				var now = new Date();
				var serial = ""+now.getYear()+
					now.getMonth()+
					now.getDay()+
					Math.round(Math.random()*100);

				var arpa = zfile.split(".").reverse();
				arpa.push("in-addr");
				arpa.push("arpa");
				var arpa = arpa.join('.');
				var buf = ejs.render(tpl, {
					config: self.config,
					arpa: arpa,
					serial: serial,
					list: self.revertFile[zfile]
				});
				namedLocalRevert.push({
					arpa: arpa
				});
				var fileName = self.config.out+"/zones/"+arpa;
				fs.writeFileSync(fileName, buf);
			}

			/* named local files */
			var tpl = fs.readFileSync("./template/named.local.txt").toString();
			var buf = ejs.render(tpl, {
				zones: namedLocalZone,
				revert: namedLocalRevert,
				config: self.config
			});

			fs.writeFileSync(self.config.out+"/named.conf.auto", buf);

			cb();
			clearInterval(this);
		}
	}, 100);
};

var config = {
	domain: "loopback.lo",
	out: "./",
	
	revRefresh: 14400,
	revRetry: 3600,
	revExpire: 604800,
	revMinimum: 10800,
	
	zoneRefresh: 21600,
	zoneRetry: 3600,
	zoneExpire: 604800,
	zoneMinimum: 300,
	
	dhcpEJS: "dhcp-<%= num %>-lease-<%= rand %>"
};

var info = {
	domain: "Default UP domain",
	out: "Output bind9 configuration",
	
	revRefresh: "Reverse ARPA refresh after 6 hours",
	revRetry: "Reverse ARPA retry after 1 hour",
	revExpire: "Reverse ARPA expire after 1 week",
	revMinimum: "Reverse ARPA minimum TTL of 1 day",
	
	zoneRefresh: "Zone refresh after 6 hours",
	zoneRetry: "Zone retry after 1 hour",
	zoneExpire: "Zone expire after 1 week",
	zoneMinimum: "Zone minimum TTL of 1 day",
	
	dhcpEJS: "EJS DHCP template"	
};

/* load Package */
var pack = JSON.parse(fs.readFileSync(__dirname+"/package.json"));

/* process command line */
var argh = {};
var arghLast = 2;
var cmdReg = /^-([a-z0-9]+)=(.*)$/i;
var optReg = /^-(.*)/;
var files = [];

for(var a=2; a<process.argv.length; a++) {
	var el = process.argv[a];
	var m = cmdReg.exec(el);
	if(m)
		argh[m[1]] = m[2];
	else {
		var m = optReg.exec(el);
		if(m)
			argh[m[1]] = true;
		else 
			files.push(el);
	}
}

function check(a) {
	if(argh.hasOwnProperty(a))
		return(true);
	return(false);
}

/* is help ? */
if(check("help") || check("-help")) {
	console.log("csv2bind usage: csv2bind <commands> <options> file1.csv file2.csv file3.csv...");
	console.log("Basic commands");
	console.log("    --help: This message");
	console.log("    --version: Version message");
	console.log("    --verbose: Display log message");
	console.log("    --demo: Generate a demo CSV file");
	//console.log("  --quiet: Set quiet mode");
	console.log("List of supported options");
	for(var a in config)
		console.log("    -"+a+": "+info[a]+". Default: "+config[a]);
	
	process.exit(0);
}
	
/* is version ? */
if(check("version") || check("-version")) {
	console.log(
		"csv2bind "+pack.version+"\n"+
		"Simple bind9 CSV translator\n"+
		"Copyright (C) 2015  Michael VERGOZ @mykiimike\n"+
		"\n"+
		"This program is distributed in the hope that it will be useful,\n"+
		"but WITHOUT ANY WARRANTY; without even the implied warranty of\n"+
		"MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n"+
		"GNU General Public License for more details.\n"
	);
	process.exit(0);
}

/* is demo ? */
if(check("demo") || check("-demo")) {
	console.info("Generating a random CSV file at ./csv2bindDemo.csv");
	require("child_process").execSync("node "+__dirname+"/test/generateCSV.js");
	process.exit(0);
}

/* is verbose ? */
console = clim();
if(!check("verbose") && !check("-verbose"))
	console.log = function(m) {};

/* initialize app */
console.info("csv2bind - Simple bind9 CSV translator version "+pack.version);

/* check config */
for(var a in argh) {
	if(config.hasOwnProperty(a)) {
		console.log("Set option "+a+" to "+argh[a]);
		config[a] = argh[a];
	}
}

/* check files */
if(files.length == 0) {
	console.error("No input file provided !");
	process.exit(0);
}
console.info("Need to process "+files.length+" files");

/* check output directory */
try {
	fs.statSync(config.out);
} catch(e) {
	console.error("Directory "+config.out+" does not exist, please read it first");
	process.exit(-1);
}

/* check for zones/ directory */
try {
	fs.statSync(config.out+"/zones");
} catch(e) {
	fs.mkdirSync(config.out+"/zones");
	console.log("Directory "+config.out+"/zones does not exist: creation");
}

/* here we go */
var context = new context(config);

for(var a in files)
	context.addFile(files[a]);

context.render(function() {
	console.info('Work done');
});

