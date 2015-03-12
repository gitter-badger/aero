"use strict";

// Modules
var
	fs = require("fs"),
	spdy = require("spdy"),
	path = require("path"),
	jade = require("jade"),
	fse = require("fs-extra"),
	express = require("express"),
	compress = require("compression"),
	colors = require("./config/colors"),
	pageConfig = require("./config/page"),
	objectAssign = require("object-assign"),
	styles = require("./src/manager/styles"),
	scripts = require("./src/manager/scripts");

// Aero
var aero = {
	// Express reference
	express: express,
	
	// Express app
	app: express(),
	
	// Includes all page objects
	pages: {},
	
	// An array of strings containing all the JavaScript code for the site
	js: [],
	
	// Collection of strings containing all the CSS for the site
	css: {},
	
	// Components
	config: require("./config/config"),
	watch: require("node-watch"),
	download: require("./src/download"),
	
	// Aero root folder
	rootPath: path.dirname(module.filename),
	
	// Aero event manager
	events: new (require("events")).EventEmitter(),
	
	// Start
	start: function(configFile) {
		if(typeof configFile === "undefined")
			configFile = "config.json";
		
		console.log("Loading config:", configFile);
		
		// When a new page has been found
		aero.events.on("newPage", function(pageName) {
			console.log("Installing page: " + pageName);
		});
		
		// When a new style has been found
		aero.events.on("newStyle", function(stylePath, css) {
			console.log("Installing style: " + stylePath);
			aero.css[stylePath] = css;
			aero.compilePages();
		});
		
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
		var favIconPath = "favicon.ico";
		
		fs.exists(favIconPath, function(exists) {
			if(!exists) {
				console.warn(colors.warn("favicon.ico doesn't exist in your root directory, please add one!"));
				return;
			}
			
			// Send icon
			aero.app.get("/favicon.ico", function(request, response) {
				response.sendFile(favIconPath, {root: "./"});
			});
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
	
	// Init
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
		fse.ensureDir(aero.config.stylesPath, function(error) {
			if(error)
				throw error;
			
			// Load styles
			aero.loadUserStyles();
		});
		
		// Scripts
		fse.ensureDir(aero.config.scriptsPath, function(error) {
			if(error)
				throw error;
			
			// Load scripts
			aero.loadUserScripts();
			
			// Load pages
			aero.loadPages();
		});
		
		// Pages
		return true;
	},
	
	loadUserScripts: function() {
		aero.config.scripts.forEach(function(fileName) {
			aero.loadScript(path.join(aero.config.scriptsPath, fileName + ".js"));
		});
	},
	
	loadScript: function(filePath) {
		console.log("Compiling script: " + path.basename(filePath, ".js"));
		
		aero.js.push(scripts.compressJSFile(filePath));
		aero.events.emit("newScript", filePath);
	},
	
	loadScriptWithoutCompression: function(filePath) {
		console.log("Loading script: " + path.basename(filePath, ".js"));
		
		aero.js.push(fs.readFileSync(filePath, "utf8"));
		aero.events.emit("newScript", filePath);
	},
	
	loadUserStyles: function() {
		aero.config.styles.forEach(function(fileName) {
			aero.loadStyle(path.join(aero.config.stylesPath, fileName + ".styl"));
		});
	},
	
	loadStyle: function(filePath) {
		console.log("Compiling style: " + path.basename(filePath, ".styl"));
		
		styles.compileStylusFile(filePath, function(css) {
			aero.events.emit("newStyle", filePath, css);
			
			// Watch for changes
			aero.watch(filePath, function(changedFilePath) {
				console.log("Style changed:", changedFilePath);
				aero.loadStyle(changedFilePath);
			});
		});
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
		aero.pages = pages.map(function(file) {
			var pageId = file.name;
			var jsonFile = path.join(file.fullPath, pageId + ".json");
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
			
			return page;
		});
		
		aero.pages.forEach(function(page) {
			aero.events.emit("newPage", page.id);
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
					page.compile(path.extname(filePath) == ".styl");
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
			css: Object.keys(aero.css).map(function(v) { return aero.css[v]; }).join(" "),
			js: aero.js.join(";"),
			pages: aero.pages
		};
		
		// Compile jade files
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			page.path = path.join(aero.config.pagesPath, page.id);
			page.code = "";
			page.layoutCode = "";
			
			page.compile = function(compileStyle) {
				var label = "Compiling page: " + this.id;
				
				var renderIt = function() {
					console.time(label);
					
					// Style
					if(compileStyle) {
						var stylFile = path.join(page.path, page.id + ".styl");
						var style = null;
						
						try {
							style = fs.readFileSync(stylFile, "utf8");
						} catch(error) {
							//console.warn("Missing stylus file: " + stylFile);
						}
						
						if(style != null) {
							console.log("|   Compiling page style: " + stylFile);
							page.css = styles.compileStylus(style);
						}
					}
					
					// Template
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
					fse.ensureDir(page.path, function(error) {
						if(error)
							throw error;
						
						fs.exists(page.templatePath, function(exists) {
							if(exists)
								return;
							
							fs.writeFile(page.templatePath, "h2 " + page.id, function(writeError) {
								if(writeError)
									throw writeError;
								
								renderIt();
							});
						});
					});
				}
			};
			
			page.compile(true);
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
	
	root: function(fileName) {
		if(typeof fileName === "undefined")
			return aero.rootPath;
		
		return path.join(aero.rootPath, fileName);
	}
};

module.exports = aero;