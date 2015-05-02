"use strict";

let fs = require("fs");
let nib = require("nib");
let stylus = require("stylus");
let colors = require("../config/colors");

let styles = {
	compileStylus: function(style) {
		let output = "";
		
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
		let createStylusFile = function(stylusPath, data) {
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
		let contents = "";
		
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