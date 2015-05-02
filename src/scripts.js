"use strict";

let fs = require("fs");
let UglifyJS = require("uglify-js");

let scripts = {
	compressor: new UglifyJS.Compressor(),
	
	// CompressJS
	compressJS: function(code) {
		let ast = UglifyJS.parse(code);
		ast.figure_out_scope();
		return ast.transform(this.compressor).print_to_string();
	},
	
	// CompressJSFile
	compressJSFile: function(filePath) {
		let data = "";
		
		try {
			data = fs.readFileSync(filePath, "utf8");
		} catch(e) {
			console.error("Couldn't find script: " + filePath);
		}
		
		return this.compressJS(data);
	}
};

module.exports = scripts;