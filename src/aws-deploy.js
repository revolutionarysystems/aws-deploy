#! /usr/bin/env node

var fs = require('fs');
var program = require('commander');
var async = require('async');
var exec = require('child_process').exec;

program.version('0.1.0');

program.command('launch [environment]').action(function(environment) {
	console.log("Launching " + environment + " environment");
	fs.readFile(environment + ".json", {
		encoding: "UTF-8"
	}, function(err, contents) {
		var config = JSON.parse(contents);
		async.eachSeries(config.autoscale, function(group, callback) {
			resizeAutoScaleGroup(group, callback);
		}, function(err){
			if(err){
				console.log(err+"");
			}
		});
	});
});

program.command('terminate [environment]').action(function(environment) {
	console.log("Terminating " + environment + " environment");
	fs.readFile(environment + ".json", {
		encoding: "UTF-8"
	}, function(err, contents) {
		var config = JSON.parse(contents);
		async.eachSeries(config.autoscale, function(group, callback) {
			group.min = 0;
			group.max = 0;
			group.desired = 0;
			resizeAutoScaleGroup(group, callback);
		}, function(err){
			if(err){
				console.log(err+"");
			}
		});
	});
});

program.command('switch [environment]').action(function(environment) {
	console.log("Switching to " + environment + " environment");
	fs.readFile(environment + ".json", {
		encoding: "UTF-8"
	}, function(err, contents) {
		var config = JSON.parse(contents);
		async.eachSeries(config.route53, function(group, callback) {
			async.eachSeries(group.aliases, function(alias, callback){
				console.log("Switching " + alias.src + " to " + alias.target);
				exec("aws route53 change-resource-record-sets --hosted-zone-id " + group.zone + " --change-batch \"{ \\\"Changes\\\": [{\\\"Action\\\": \\\"UPSERT\\\", \\\"ResourceRecordSet\\\": {\\\"Name\\\": \\\"" + alias.src + "\\\", \\\"Type\\\":\\\"A\\\", \\\"AliasTarget\\\": {\\\"DNSName\\\": \\\"" + alias.target + "\\\", \\\"EvaluateTargetHealth\\\": false, \\\"HostedZoneId\\\": \\\"" + group.zone + "\\\"}}}]}\"", function(err, stdout, stderr){
					console.log(stdout);
					callback(err);
				})
			}, callback);
		}, function(err){
			if(err){
				console.log(err+"");
			}
		});
	});
})

function resizeAutoScaleGroup(group, callback){
	console.log("Resizing autoscale group " + group.name + " to " + group.desired + " instances");
	exec("aws autoscaling update-auto-scaling-group --auto-scaling-group-name " + group.name + " --min-size " + group.min + " --max-size " + group.max + " --desired-capacity " + group.desired, function(err, stdout, stderr) {
		console.log(stdout);
		callback(err);
	});
}

program.parse(process.argv);

// Takes single argument "blue" or "green"
// Read json file for list of autoscale groups and desired number of instances and call
//