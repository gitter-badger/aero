"use strict";

var fs = require("fs");
var UglifyJS = require("uglify-js");

var scripts = {
	compressor: new UglifyJS.Compressor(),
	
	compressJS: function(code) {
		var ast = UglifyJS.parse(code);
		ast.figure_out_scope();
		return ast.transform(this.compressor).print_to_string();
	},
	
	compressJSFile: function(filePath) {
		var data = "";
		
		try {
			data = fs.readFileSync(filePath, "utf8");
		} catch(e) {
			console.error("Couldn't find script: " + filePath);
		}
		
		return this.compressJS(data);
	}
};

module.exports = scripts;