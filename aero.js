"use strict";

// Modules
var
	fs = require("fs"),
	spdy = require("spdy"),
	http = require("http"),
	path = require("path"),
	jade = require("jade"),
	chalk = require("chalk"),
	mkdirp = require("mkdirp"),
	express = require("express"),
	compress = require("compression"),
	objectAssign = require("object-assign"),
	scripts = require("./src/manager/scripts"),
	styles = require("./src/manager/styles"),
	pageConfig = require("./config/page");
	
// Colors
var colors = {
	warn: chalk.bold.yellow,
	error: chalk.bold.red
};

// Aero
var aero = {
	// Express reference
	express: express,
	
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
		if(typeof configFile === "undefined")
			configFile = "config.json";
		
		console.log("Loading config:", configFile);
		
		// Read config file
		fs.readFile(configFile, "utf8", function(error, data) {
			if(error) {
				console.warn(colors.warn("Couldn't find " + configFile + ", will automatically create one"));
				aero.config.siteName = path.basename(path.resolve("."));
				
				// Automatically create a config file
				fs.writeFile(configFile, "{\n\t\"siteName\": \"" + aero.config.siteName + "\"\n}", function(writeError) {
					if(writeError)
						throw writeError;
				});
			} else {
				try {
					// Load config.json
					var userConfig = JSON.parse(data);
					
					// Merge config file
					aero.config = objectAssign(aero.config, userConfig);
				} catch(jsonError) {
					if(jsonError instanceof SyntaxError) {
						console.error(colors.error("There's a syntax error in " + configFile + ",", jsonError));
					} else {
						throw jsonError;
					}
				}
			}
			
			aero.init();
		});
		
		// Favicon
		aero.app.get("/favicon.ico", function(request, response) {
			var favIconPath = "favicon.ico";
			
			try {
				fs.accessSync(favIconPath);
			} catch(e) {
				console.error(colors.error("favicon.ico doesn't exist in your root directory, please add one!"));
				response.end();
				return;
			}
			
			response.sendFile(favIconPath, {root: "./"});
		});
		
		// When a new page has been found
		aero.events.on("newPage", function(pageName) {
			console.log("Installing page: " + pageName);
		});
		
		// Gzip
		aero.app.use(compress());
		
		// jQuery
		aero.loadScriptWithoutCompression(aero.root("cache/scripts/jquery.js"));
		
		// Compress these
		aero.loadScript(aero.root("scripts/helpers.js"));
		aero.loadScript(aero.root("scripts/aero.js"));
		aero.loadScript(aero.root("scripts/init.js"));
	},
	
	init: function() {
		console.log("Initializing Aero");
		
		aero.app.set("x-powered-by", "Aero");
		
		var staticFilesConfig = {
			maxAge: aero.config.browser.cache.duration
		};
		
		// Static files
		aero.config.static.forEach(function(filePath) {
			aero.app.use("/" + filePath, express.static("./" + filePath, staticFilesConfig));
		});
		
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
		
		if(aero.config.pages.length === 0)
			console.warn(colors.warn("No pages yet, consider adding \"pages\": [\"helloworld\"] to your config.json"));
		
		aero.watch(aero.config.layoutPath, function(filePath) {
			console.log("Layout changed:", filePath);
			aero.compilePages();
		});
		
		aero.startServer();
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
				console.log("|   Compiling page style: " + stylFile);
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
				
				var renderIt = function() {
					console.time(label);
					
					page.templatePath = path.join(page.path, page.id + ".jade");
					
					var renderPage = jade.compileFile(page.templatePath);
					
					// Parameter: page
					params.page = page;
					
					// We MUST save this in a local variable
					page.code = styles.scoped(page.css) + renderPage(params);
					
					// Parameter: content
					params.content = page.code;
					
					// Render Jade file to HTML
					page.layoutCode = renderLayout(params);
					
					console.timeEnd(label);
				};
				
				try {
					renderIt();
				} catch(e) {
					console.warn(colors.warn("'%s' doesn't exist yet, automatically creating it"), page.path);
					
					// Automatically create a page
					mkdirp(page.path, function(error) {
						if(error) {
							console.error(colors.error(error));
						} else {
							fs.writeFile(page.templatePath, "h2 " + page.id, function(writeError) {
								if(writeError)
									throw writeError;
								
								renderIt();
							});
						}
					});
				}
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
		if(typeof aero.config.ssl.key !== "undefined") {
			try {
				aero.startSpdyServer();
			} catch(e) {
				//console.warn(colors.warn("SSL", e));
				console.warn("SSL files could not be loaded, ignoring it");
			}
		}
		
		aero.app.listen(aero.config.port, undefined, undefined, function(error) {
			if(error) {
				console.error(colors.error("Couldn't listen on port %d"), aero.config.port);
				return;
			}
			
			console.log(aero.config.siteName + " started on port " + aero.config.port + " (http)");
		});
	},
	
	startSpdyServer: function() {
		var spdyOptions = {
			key: fs.readFileSync(aero.config.ssl.key),
			cert: fs.readFileSync(aero.config.ssl.cert),
			ca: fs.readFileSync(aero.config.ssl.ca),
			
			// Server's window size
			windowSize: 1024 * 1024,
			
			// Will the server send 3.1 frames on 3.0 *plain* spdy?
			autoSpdy31: false
		};
		
		var server = spdy.createServer(spdyOptions, aero.app);
		server.listen(aero.config.ssl.port);
		
		console.log(aero.config.siteName + " started on port " + aero.config.ssl.port + " (https)");
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