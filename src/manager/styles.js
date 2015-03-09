"use strict";

var fs = require("fs");
var nib = require("nib");
var stylus = require("stylus");

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
	
	compileStylusFile: function(filePath) {
		var data = "";
		
		try {
			data = fs.readFileSync(filePath, "utf8");
		} catch(e) {
			console.error("Couldn't find style sheet: " + filePath);
		}
		
		return this.compileStylus(data);
	},
	
	scoped: function(css) {
		return "<style scoped>" + css + "</style>";
	}
};

module.exports = styles;