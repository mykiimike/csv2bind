var fs = require('fs');
var jen = require('node-jen')();
var ipTrans = require('ip');

var domain = "loopback.lo";
var bits16pre = "10.69.0.0";

var pass = fs.readFileSync(__dirname+"/worst500pass.txt").toString().split("\n");
var result = 'ns.'+domain+";"+ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2))+"\n";
result += 'root.'+domain+";"+ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2))+"\n";

for(var a=0; a<jen.randomBetween(10000, 5000); a++) {
	var domainN = jen.randomBetween(4);
	var ns = '';
	
	for(var b=0; b<jen.randomBetween(6, 2); b++) {
		
		var word = pass[jen.randomBetween(pass.length)];
		ns += word+'.';
	}
	
	ns += domain;
	ip = ipTrans.fromLong(ipTrans.toLong(bits16pre)+jen.random(2));
	
	result += ns+";"+ip+"\n";
}

fs.writeFileSync("demo.csv", result);
