"use strict";

var fs = require("fs");
var nib = require("nib");
var stylus = require("stylus");
var colors = rootRequire("config/colors");

var styles = {
	compileStylus: function(style) {
		var output = "";
		
		stylus(style)
			.set("compress", true)
			.use(nib())
			.render(function(error, css) {
				if(error)
					console.error(colors.error(error));
				
				output = css;
			});
		
		return output;
	},
	
	compileStylusFile: function(filePath, callBack) {
		var createStylusFile = function(stylusPath, data) {
			console.warn(colors.warn("Couldn't find style sheet '" + stylusPath + "', creating empty one"));
			
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
			
			return "";
		}
		
		// Sync
		var contents = "";
		
		try {
			contents = fs.readFileSync(filePath, "utf8");
		} catch(e) {
			createStylusFile(filePath, contents);
		}
		
		return this.compileStylus(contents);
	},
	
	scoped: function(css) {
		return "<style scoped>" + css + "</style>";
	}
};

module.exports = styles;