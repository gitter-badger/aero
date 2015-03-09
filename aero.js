"use strict";

var
	fs = require("fs"),
	http = require("http"),
	path = require("path"),
	jade = require("jade"),
	express = require("express"),
	compress = require("compression"),
	objectAssign = require("object-assign"),
	scripts = require("./src/manager/scripts"),
	styles = require("./src/manager/styles"),
	pageConfig = require("./config/page");

var aero = {
	// Express app
	app: express(),
	
	// Aero configuration
	config: require("./config/config"),
	
	// Includes all page objects
	pages: {},
	
	// An array of strings containing all the JavaScript code for the site
	js: [],
	
	// An array of strings containing all the CSS for the site
	css: [],
	
	// Components
	watch: require("node-watch"),
	
	// Aero root folder
	rootPath: path.dirname(module.filename),
	
	// Aero event manager
	events: new (require("events")).EventEmitter(),
	
	start: function(configFile) {
		// Merge config file
		if(typeof configFile !== "undefined")
			aero.config = objectAssign(aero.config, JSON.parse(fs.readFileSync(configFile, "utf8")));
		
		aero.init();
		
		// jQuery is compressed already
		aero.loadScriptWithoutCompression(aero.root("cache/scripts/jquery.js"));
		
		// Compress these
		aero.loadScript(aero.root("scripts/helpers.js"));
		aero.loadScript(aero.root("scripts/aero.js"));
		aero.loadScript(aero.root("scripts/init.js"));
		
		// Download latest version of Google Analytics
		aero.download("http://www.google-analytics.com/analytics.js", aero.root("cache/scripts/analytics.js"), function() {
			aero.loadScriptWithoutCompression(aero.root("cache/scripts/analytics.js"));
			
			if(aero.config.fonts.length > 0)
				aero.download("http://fonts.googleapis.com/css?family=" + aero.config.fonts.join("|"), aero.root("cache/styles/google-fonts.css"), aero.loadAndStart);
			else
				aero.loadAndStart();
		});
	},
	
	loadAndStart: function() {
		if(!aero.loadUserData()) {
			aero.loadAdminInterface();
		}
		
		aero.watch(aero.config.layoutPath, function(filePath) {
			console.log("Layout changed:", filePath);
			aero.compilePages();
		});
		
		aero.startServer();
	},
	
	init: function() {
		var staticFilesConfig = {
			maxAge: aero.config.browser.cache.duration
		};
		
		// Gzip
		aero.app.use(compress());
		
		// Static files
		aero.config.static.forEach(function(filePath) {
			aero.app.use("/" + filePath, express.static("./" + filePath, staticFilesConfig));
		});
		
		// Favicon
		aero.app.get("/favicon.ico", function(request, response) {
			var favIconPath = "favicon.ico";
			
			try {
				fs.accessSync(favIconPath);
			} catch(e) {
				console.error("favicon.ico doesn't exist in your root directory, please add one!");
				response.end();
				return;
			}
			
			response.sendFile(favIconPath, {root: "./"});
		});

		aero.events.on("newPage", function(pageName) {
			console.log("Installing page: " + pageName);
		});
	},
	
	loadUserData: function() {
		// CSS reset
		aero.loadStyle(aero.root("styles/reset.styl"));
		
		if(aero.config.fonts.length > 0)
			aero.loadStyle(aero.root("cache/styles/google-fonts.css"));
		
		// Styles
		aero.config.styles.forEach(function(fileName) {
			aero.loadStyle(path.join(aero.config.stylesPath, fileName + ".styl"));
		});
		
		// Scripts
		aero.config.scripts.forEach(function(fileName) {
			aero.loadScript(path.join(aero.config.scriptsPath, fileName + ".js"));
		});
		
		// Pages
		return aero.loadPages();
	},
	
	loadScript: function(filePath) {
		console.log("Compiling script: " + path.basename(filePath, ".js"));
		
		aero.js.push(scripts.compressJSFile(filePath));
	},
	
	loadScriptWithoutCompression: function(filePath) {
		console.log("Loading script: " + path.basename(filePath, ".js"));
		
		aero.js.push(fs.readFileSync(filePath, "utf8"));
	},
	
	loadStyle: function(filePath) {
		console.log("Compiling style: " + path.basename(filePath, ".styl"));
		
		aero.css.push(styles.compileStylusFile(filePath));
	},
	
	loadPages: function(pagesPath) {
		if(typeof pagesPath === "undefined")
			pagesPath = aero.config.pagesPath;
		
		// Filter directories
		var pages = aero.config.pages.map(function(file) {
			return {
				name: file,
				fullPath: path.join(pagesPath, file)
			};
		});
		
		// Find all pages
		pages.forEach(function(file) {
			var pageId = file.name;
			var jsonFile = path.join(file.fullPath, pageId + ".json");
			var stylFile = path.join(file.fullPath, pageId + ".styl");
			var pageJSON;
			
			// JSON
			try {
				pageJSON = fs.readFileSync(jsonFile, "utf8");
			} catch(error) {
				pageJSON = null;
				//console.warn("Missing page information file: " + jsonFile);
			}
			
			// Create page
			var page = pageConfig(pageId);
			
			// Merge
			if(pageJSON != null)
				page = objectAssign(page, JSON.parse(pageJSON));
			
			var style = null;
			
			// Style
			try {
				style = fs.readFileSync(stylFile, "utf8");
			} catch(error) {
				//console.warn("Missing stylus file: " + stylFile);
			}
			
			if(style != null) {
				console.log(" - Compiling page style: " + stylFile);
				page.css = styles.compileStylus(style);
			}
			
			aero.pages[pageId] = page;
			aero.events.emit("newPage", pageId);
		});
		
		aero.js.push(scripts.compressJS(aero.makePages()));
		aero.js.push("$(document).ready(function(){aero.setTitle(\"" + aero.config.siteName + "\");$(window).trigger(\"resize\");});");
		
		aero.compilePages();
		
		// Set up routing
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			// Set up raw response with cached output
			aero.app.get("/raw/" + page.url, function(request, response) {
				response.header("Content-Type", "text/html; charset=utf-8");
				response.end(page.code);
			});
			
			// Set up full response with cached output
			aero.app.get("/" + page.url, function(request, response) {
				response.header("Content-Type", "text/html; charset=utf-8");
				response.end(page.layoutCode);
			});
			
			// Watch directory
			aero.watch(page.path, function(filePath) {
				try {
					console.log("File changed:", filePath);
					page.compile();
				} catch(e) {
					console.error(e);
				}
			});
		});
		
		return true;
	},
	
	compilePages: function() {
		var renderLayout = jade.compileFile(aero.config.layoutPath);
		
		var params = {
			siteName: aero.config.siteName,
			css: aero.css.join(" "),
			js: aero.js.join(";"),
			pages: aero.pages
		};
		
		// Compile jade files
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			page.path = path.join(aero.config.pagesPath, page.id);
			page.code = "";
			page.layoutCode = "";
			
			page.compile = function() {
				var label = "Compiling page: " + this.id;
				console.time(label);
				
				var renderPage = jade.compileFile(path.join(page.path, page.id + ".jade"));
				
				// Parameter: page
				params.page = this;
				
				// We MUST save this in a local variable
				page.code = styles.scoped(this.css) + renderPage(params);
				
				// Parameter: content
				params.content = page.html;
				
				// Render Jade file to HTML
				page.layoutCode = renderLayout(params);
				
				console.timeEnd(label);
			};
			
			page.compile();
		});
	},
	
	loadAdminInterface: function() {
		/*console.log("Loading admin interface");
		
		aero.loadPages(aero.root("./pages"));
		
		aero.app.get("/", function(request, response) {
			response.writeHead(302, {'Location': '/admin'});
			response.end();
		});*/
	},
	
	makePages: function() {
		var makePages = [];
		
		Object.keys(aero.pages).forEach(function(key) {
			var page = aero.pages[key];
			
			makePages.push("aero.makePage(\"" + page.title + "\", \"" + key + "\", \"" + page.url + "\");");
		});
		
		return "$(document).ready(function(){" + makePages.join("") + "});";
	},
	
	// Start server
	startServer: function() {
		// Start server
		aero.app.listen(aero.config.port);
		
		console.log(aero.config.siteName + " started on port " + aero.config.port + ".");
	},
	
	createDirectory: function(dirPath) {
		try {
			fs.mkdirSync(dirPath);
		} catch(e) {
			if(e.code !== "EEXIST")
				throw e;
		}
	},
	
	download: function(from, to, callBack) {
		return http.get(from, function(response) {
			var file = fs.createWriteStream(to);
			response.pipe(file);
			
			file.on("finish", function() {
				file.close(callBack);
			});
		});
	},
	
	root: function(fileName) {
		if(typeof fileName === "undefined")
			return aero.rootPath;
		
		return path.join(aero.rootPath, fileName);
	}
};

module.exports = aero;