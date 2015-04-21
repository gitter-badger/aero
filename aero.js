"use strict";

// Modules
var
	fs = require("fs-extra"),
	jade = require("jade"),
	path = require("path"),
	compress = require("compression"),
	merge = require("object-assign"),
	express = require("express"),
	bodyParser = require("body-parser");

// Local
var
	styles = require("./src/styles"),
	scripts = require("./src/scripts"),
	colors = require("./config/colors"),
	pageConfig = require("./config/page");

// Aero
var aero = {
	// App reference
	app: express(),
	
	// Express reference
	express: express,
	
	// Server reference
	server: require("aero-server"),
	
	// All the JavaScript code for the site
	js: require("aero-js-manager"),
	
	// All the CSS code for the site
	css: require("aero-css-manager"),
	
	// Default config
	config: require("./config/config"),
	
	// File system watcher
	watch: require("node-watch"),
	
	// Download function
	download: require("aero-download"),
	
	// Favicon support
	initFavIcon: require("./src/favicon"),
	
	// Aero event manager
	events: new (require("events")).EventEmitter(),
	
	// Aero root folder
	rootPath: path.dirname(module.filename),
	
	// Includes all page objects
	pages: {},
	
	// Start
	start: function(configFile) {
		// When config has been loaded
		aero.events.on("configLoaded", function() {
			console.timeEnd("Loading config");
			
			aero.init();
		});
		
		// When a new page has been found
		aero.events.on("newPage", function(pageName) {
			console.log("Installing page: " + pageName);
		});
		
		// When a new style has been found
		aero.events.on("cssChanged", function(name, css) {
			console.log("Updating style: " + name);
			
			aero.css[name] = css;
			aero.compilePages();
		});
		
		// Read config file
		aero.loadConfig(configFile);
		
		// jQuery
		aero.loadScript("jquery", aero.root("cache/scripts/jquery.js"), false);
		
		// Compress these
		aero.loadScript("aero-helpers", aero.root("scripts/helpers.js"));
		aero.loadScript("aero-main", aero.root("scripts/aero.js"));
		aero.loadScript("aero-init", aero.root("scripts/init.js"));
	},
	
	// Init
	init: function() {
		console.log("Initializing Aero");
		
		aero.app.set("x-powered-by", "Aero");
		
		// Body parsers
		aero.urlEncodedParser = bodyParser.urlencoded({
			extended: false
		});
		
		// Gzip
		aero.app.use(compress());
		
		// Favicon
		aero.initFavIcon(aero.app, "favicon.ico");
		
		// Cache duration
		var staticFilesConfig = {
			maxAge: aero.config.browser.cache.duration
		};
		
		// Static files
		aero.config.static.forEach(function(filePath) {
			aero.app.use("/" + filePath, aero.express.static("./" + filePath, staticFilesConfig));
		});
		
		// Download latest version of Google Analytics
		aero.download("http://www.google-analytics.com/analytics.js", aero.root("cache/scripts/analytics.js"), function() {
			aero.loadScript("google-analytics", aero.root("cache/scripts/analytics.js"), false);
			
			if(aero.config.fonts.length > 0)
				aero.download("http://fonts.googleapis.com/css?family=" + aero.config.fonts.join("|"), aero.root("cache/styles/google-fonts.css"), aero.loadAndStart);
			else
				aero.loadAndStart();
		});
	},
	
	// Load and start
	loadAndStart: function() {
		aero.loadUserData();
		
		if(aero.config.pages.length === 0)
			console.warn(colors.warn("No pages yet, consider adding \"pages\": [\"helloworld\"] to your config.json"));
		
		aero.watch(aero.config.layoutPath, function(filePath) {
			console.log("Layout changed:", filePath);
			aero.compilePages();
		});
		
		// HTTP server
		aero.server.start(aero.app, aero.config.port);
		
		// HTTPS server
		if(typeof aero.config.ssl !== "undefined" && typeof aero.config.ssl.cert !== "undefined")
			aero.server.startHTTPS(aero.app, aero.config.ssl.port, aero.config.ssl);
			
		// Event
		aero.events.emit("initialized");
	},
	
	// Load config
	loadConfig: function(configFile) {
		if(typeof configFile === "undefined")
			configFile = "config.json";
		
		console.time("Loading config");
		
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
					aero.config = merge(aero.config, userConfig);
				} catch(jsonError) {
					if(jsonError instanceof SyntaxError) {
						console.error(colors.error("There's a syntax error in " + configFile + ",", jsonError));
					} else {
						throw jsonError;
					}
				}
			}
			
			aero.events.emit("configLoaded");
		});
	},
	
	// Load user data
	loadUserData: function() {
		// CSS reset
		aero.loadStyle("aero-reset", aero.root("styles/reset.styl"));
		
		if(aero.config.fonts.length > 0)
			aero.loadStyle("aero-fonts", aero.root("cache/styles/google-fonts.css"));
		
		// Styles
		fs.ensureDir(aero.config.stylesPath, function(error) {
			if(error)
				throw error;
			
			// Load styles
			aero.loadUserStyles();
		});
		
		// Scripts
		fs.ensureDir(aero.config.scriptsPath, function(error) {
			if(error)
				throw error;
			
			// Load scripts
			aero.loadUserScripts();
			
			// Load pages
			aero.loadPages();
		});
	},
	
	// Load user scripts
	loadUserScripts: function() {
		aero.config.scripts.forEach(function(fileName) {
			aero.loadScript(fileName, path.join(aero.config.scriptsPath, fileName + ".js"));
		});
	},
	
	// Load user styles
	loadUserStyles: function() {
		aero.config.styles.forEach(function(fileName) {
			aero.loadStyle(fileName, path.join(aero.config.stylesPath, fileName + ".styl"));
		});
	},
	
	// Load script
	loadScript: function(id, filePath, compressionEnabled) {
		if(typeof compressionEnabled === "undefined")
			compressionEnabled = true;
		
		console.log("Compiling script: " + id);
		
		aero.js[id] = compressionEnabled ? scripts.compressJSFile(filePath) : fs.readFileSync(filePath, "utf8");
		aero.events.emit("newScript", id);
	},
	
	// Load style
	loadStyle: function(id, filePath) {
		console.log("Compiling style: " + id);
		
		var recompileStyle = function() {
			styles.compileStylusFile(filePath, function(css) {
				aero.events.emit("cssChanged", id, css);
			});
		};
		
		recompileStyle();
		
		aero.watch(filePath, function(changedFilePath) {
			console.log("Style changed:", changedFilePath);
			recompileStyle();
		});
	},
	
	// Load pages
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
				page = merge(page, JSON.parse(pageJSON));
			
			return page;
		});
		
		aero.pages.forEach(function(page) {
			aero.events.emit("newPage", page.id);
		});
		
		aero.js["aero-pages-js"] = scripts.compressJS(aero.makePages());
		aero.js["aero-setup-js"] = "$(document).ready(function(){aero.setTitle(\"" + aero.config.siteName + "\");});";
		
		aero.compilePages();
		
		// Set up routing
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			// Response header
			var contentType = "text/html; charset=utf-8";
			
			// Set up raw response with cached output
			if(page.static) {
				aero.app.get("/raw/" + page.url, function(request, response) {
					response.header("Content-Type", contentType);
					response.end(page.code);
				});
			} else {
				// GET
				if(typeof page.controller.get !== "undefined") {
					aero.app.get("/raw/" + page.url, function(request, response) {
						response.header("Content-Type", contentType);
						page.controller.get(request, function(data) {
							response.end(page.render(data));
						});
					});
				}
				
				// POST
				if(typeof page.controller.post !== "undefined") {
					aero.app.post("/raw/" + page.url, aero.urlEncodedParser, function(request, response) {
						response.header("Content-Type", contentType);
						page.controller.post(request, function(data) {
							response.end(page.render(data));
						});
					});
				}
			}
			
			// Static or dynamic?
			if(page.static) {
				// Static pages have maximum performance, just output the code we rendered before
				aero.app.get("/" + page.url, function(request, response) {
					response.header("Content-Type", contentType);
					response.end(page.layoutCode);
				});
			} else {
				// Dynamic pages render the layout again without having to reload it from the FS
				
				// GET
				if(typeof page.controller.get !== "undefined") {
					aero.app.get("/" + page.url, function(request, response) {
						response.header("Content-Type", contentType);
						page.controller.get(request, function(data) {
							response.end(page.renderWithLayout(data));
						});
					});
				}
				
				// POST
				if(typeof page.controller.post !== "undefined") {
					aero.app.post("/" + page.url, aero.urlEncodedParser, function(request, response) {
						response.header("Content-Type", contentType);
						page.controller.post(request, function(data) {
							response.end(page.renderWithLayout(data));
						});
					});
				}
			}
			
			// Watch directory
			aero.watch(page.path, function(filePath) {
				try {
					console.log("File changed:", filePath);
					
					switch(path.extname(filePath)) {
						case ".styl":
							page.compile(true);
							break;
							
						case ".js":
							// In any case we reload the page controller because we don't know
							// if the JS file is used in the controller or in the browser.
							page.reloadController();
							
							// If it wasn't the page controller we need to recompile the page
							// because the JavaScript file might have been a browser based one.
							if(page.controllerPath.indexOf(filePath) === -1)
								page.compile(false);
							
							break;
							
						default:
							page.compile(false);
							break;
					}
				} catch(e) {
					console.error(e);
				}
			});
		});
		
		return true;
	},
	
	// Compile pages
	compilePages: function() {
		var renderLayout = function() {
			return "";
		};
		
		try {
			renderLayout = jade.compileFile(path.join(aero.config.layoutPath, path.basename(aero.config.layoutPath) + ".jade"));
		} catch(e) {
			if(e.code === "ENOENT")
				console.error(colors.error("You should add a layout " + aero.config.layoutPath + " !"));
		}
		
		// Compile jade files
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			page.path = path.join(aero.config.pagesPath, page.id);
			page.controllerPath = path.resolve(path.join(page.path, page.id + ".js"));
			page.code = "";
			page.layoutCode = "";
			
			page.reloadController = function() {
				console.log("| Loading controller: " + page.id);
				
				// Delete cached module
				delete require.cache[page.controllerPath];
				
				// Reload it
				page.controller = require(page.controllerPath);
			};
			
			try {
				page.reloadController();
				page.static = false;
			} catch(e) {
				if(e.code === "MODULE_NOT_FOUND") {
					page.controller = undefined;
					page.static = true;
				} else {
					throw e;
				}
			}
			
			page.render = function(additionalParams) {
				var params = {
					siteName: aero.config.siteName,
					pages: aero.pages
				};
				
				if(typeof additionalParams !== "undefined")
					params = merge(params, additionalParams);
				
				return styles.scoped(page.css) + page.renderJade(params);
			};
			
			page.renderWithLayout = function(additionalParams) {
				var params = {
					siteName: aero.config.siteName,
					pages: aero.pages,
					css: aero.css.compile(["aero-reset", "aero-fonts"].concat(aero.config.styles)),
					js: aero.js.compile(["jquery", "aero-helpers", "aero-main", "aero-init", "google-analytics", "aero-pages-js", "aero-setup-js"].concat(aero.config.scripts))
				};
				
				if(typeof additionalParams !== "undefined")
					params = merge(params, additionalParams);
				
				// Parameter: page
				params.page = page;
				
				// We MUST save this in a local variable
				page.code = page.render(additionalParams);
				
				// Parameter: content
				params.content = page.code;
				
				// Render Jade file to HTML
				return renderLayout(params);
			};
			
			page.compile = function(compileStyle) {
				var label = "| Compiling page: " + this.id;
				
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
							console.log("| Compiling page style: " + stylFile);
							page.css = styles.compileStylus(style);
						}
					}
					
					// Template
					page.templatePath = path.join(page.path, page.id + ".jade");
					
					page.renderJade = jade.compileFile(page.templatePath);
					
					if(page.static)
						page.layoutCode = page.renderWithLayout();
					
					console.timeEnd(label);
				};
				
				try {
					renderIt();
				} catch(e) {
					// Rendering error?
					if(!(e instanceof Error) || e.code !== "ENOENT" || e.toString().indexOf(page.templatePath) === -1) {
						console.error(colors.error(e));
						return;
					}
					
					console.warn(colors.warn("'%s' doesn't exist yet, automatically creating it"), page.path);
					
					// Automatically create a page
					fs.ensureDir(page.path, function(error) {
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
	
	// Make pages
	makePages: function() {
		var makePages = [];
		
		Object.keys(aero.pages).forEach(function(key) {
			var page = aero.pages[key];
			
			makePages.push("aero.makePage(\"" + page.title + "\", \"" + key + "\", \"" + page.url + "\");");
		});
		
		return "$(document).ready(function(){" + makePages.join("") + "});";
	},
	
	// Root
	root: function(fileName) {
		if(typeof fileName === "undefined")
			return this.rootPath;
		
		return path.join(this.rootPath, fileName);
	}
};

module.exports = aero;