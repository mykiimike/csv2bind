var fs = require('fs');
var jen = require('node-jen')();
var ipTrans = require('ip');

var domain = "loopback.lo";
var bits16pre = "10.69.0.0";

var pass = fs.readFileSync(__dirname+"/worst500pass.txt").toString().split("\n");
var result = 'ns.'+domain+";"+ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2))+"\n";
result += 'root.'+domain+";"+ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2))+"\n";

for(var a=0; a<jen.randomBetween(20000, 5000); a++) {
	var ns = '';
	
	for(var b=0; b<jen.randomBetween(2, 1); b++) {
		
		var word = pass[jen.randomBetween(pass.length)];
		ns += word+'.';
	}
	
	ns += domain;
	ip = ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2));
	
	result += ns+";"+ip+"\n";
}

fs.writeFileSync("./csv2bindDemo.csv", result);
