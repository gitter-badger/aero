"use strict";

var fs = require("fs");
var colors = rootRequire("config/colors");

module.exports = function(app, favIconPath) {
	fs.exists(favIconPath, function(exists) {
		if(!exists) {
			console.warn(colors.warn("favicon.ico doesn't exist in your root directory, please add one!"));
			return;
		}
		
		// Send icon
		app.get("/favicon.ico", function(request, response) {
			response.sendFile(favIconPath, {root: "./"});
		});
	});
};