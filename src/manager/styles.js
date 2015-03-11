"use strict";

var fs = require("fs");
var nib = require("nib");
var stylus = require("stylus");
var colors = require("../../config/colors");

var styles = {
	compileStylus: function(style) {
		var output = "";
		
		stylus(style)
			.set("compress", true)
			.use(nib())
			.render(function(error, css) {
				if(error)
					throw error;
				
				output = css;
			});
		
		return output;
	},
	
	compileStylusFile: function(filePath, callBack) {
		var createStylusFile = function(filePath, data) {
			console.warn(colors.warn("Couldn't find style sheet '" + filePath + "', creating empty one"));
			
			fs.writeFile(filePath, data);
		};
		
		// Async
		if(typeof callBack !== "undefined") {
			fs.readFile(filePath, "utf8", function(error, data) {
				if(error) {
					data = "";
					createStylusFile(filePath, data);
				}
				
				callBack(styles.compileStylus(data));
			});
			
			return;
		}
		
		// Sync
		var data = "";
		
		try {
			data = fs.readFileSync(filePath, "utf8");
		} catch(e) {
			createStylusFile(filePath, data);
		}
		
		return styles.compileStylus(data);
	},
	
	scoped: function(css) {
		return "<style scoped>" + css + "</style>";
	}
};

module.exports = styles;