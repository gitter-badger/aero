"use strict";

// Module directory
process.env.NODE_PATH = __dirname;

// Modules
var
	fs = require("fs-extra"),
	jade = require("jade"),
	path = require("path"),
	compress = require("compression"),
	objectAssign = require("object-assign");

var
	styles = require("./src/styles"),
	scripts = require("./src/scripts"),
	colors = require("./config/colors"),
	pageConfig = require("./config/page");

// Aero
var aero = {
	// Express reference
	express: require("express"),
	
	// Server reference
	server: require("aero-server"),
	
	// All the JavaScript code for the site
	js: require("aero-js-manager"),
	
	// All the CSS code for the site
	css: require("aero-css-manager"),
	
	// Components
	config: require("./config/config"),
	watch: require("node-watch"),
	download: require("aero-download"),
	initFavIcon: require("./src/favicon"),
	
	// Aero event manager
	events: new (require("events")).EventEmitter(),
	
	// Aero root folder
	rootPath: path.dirname(module.filename),
	
	// Includes all page objects
	pages: {},
	
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
		aero.events.on("newStyle", function(name, css) {
			console.log("Installing style: " + name);
			
			aero.css[name] = css;
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
		
		aero.app = aero.express();
		aero.app.set("x-powered-by", "Aero");
		
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
	},
	
	loadUserData: function() {
		// CSS reset
		aero.loadStyle(aero.root("styles/reset.styl"));
		
		if(aero.config.fonts.length > 0)
			aero.loadStyle(aero.root("cache/styles/google-fonts.css"));
		
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
	
	loadUserScripts: function() {
		aero.config.scripts.forEach(function(fileName) {
			aero.loadScript(fileName, path.join(aero.config.scriptsPath, fileName + ".js"));
		});
	},
	
	loadUserStyles: function() {
		aero.config.styles.forEach(function(fileName) {
			aero.loadStyle(path.join(aero.config.stylesPath, fileName + ".styl"));
		});
	},
	
	loadScript: function(id, filePath, compressionEnabled) {
		console.log("Compiling script: " + id);
		
		aero.js[id] = compressionEnabled ? scripts.compressJSFile(filePath) : fs.readFileSync(filePath, "utf8");
		aero.events.emit("newScript", id);
	},
	
	loadStyle: function(filePath) {
		var id = path.basename(filePath, ".styl");
		console.log("Compiling style: " + id);
		
		styles.compileStylusFile(filePath, function(css) {
			aero.events.emit("newStyle", id, css);
			
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
		
		aero.js["aero-pages-js"] = scripts.compressJS(aero.makePages());
		aero.js["aero-setup-js"] = "$(document).ready(function(){aero.setTitle(\"" + aero.config.siteName + "\");});";
		
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
			aero.app.all("/" + page.url, function(request, response) {
				response.header("Content-Type", "text/html; charset=utf-8");
				if(page.static)
					response.end(page.layoutCode);
				else
					page.render(response);
			});
			
			// Watch directory
			aero.watch(page.path, function(filePath) {
				try {
					console.log("File changed:", filePath);
					page.compile(path.extname(filePath) === ".styl");
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
			css: aero.css.compile(["reset", "google-fonts.css"].concat(aero.config.styles)),
			js: aero.js.compile(["jquery", "aero-helpers", "aero-main", "aero-init", "google-analytics", "aero-pages-js", "aero-setup-js"].concat(aero.config.scripts)),
			pages: aero.pages
		};
		
		// Compile jade files
		Object.keys(aero.pages).forEach(function(pageId) {
			var page = aero.pages[pageId];
			
			page.path = path.join(aero.config.pagesPath, page.id);
			page.code = "";
			page.layoutCode = "";
			
			page.renderLayout = function() {
				// Parameter: page
				params.page = page;
				
				// We MUST save this in a local variable
				page.code = styles.scoped(page.css) + page.render(params);
				
				// Parameter: content
				params.content = page.code;
				
				// Render Jade file to HTML
				return renderLayout(params);
			};
			
			page.compile = function(compileStyle) {
				var label = "|   Compiling page: " + this.id;
				
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
							console.log("|   |   Compiling page style: " + stylFile);
							page.css = styles.compileStylus(style);
						}
					}
					
					// Template
					page.templatePath = path.join(page.path, page.id + ".jade");
					
					page.render = jade.compileFile(page.templatePath);
					
					if(page.static)
						page.layoutCode = page.renderLayout();
					
					console.timeEnd(label);
				};
				
				try {
					renderIt();
				} catch(e) {
					// Rendering error?
					if(!(e instanceof Error) || e.code !== "ENOENT") {
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
	
	makePages: function() {
		var makePages = [];
		
		Object.keys(aero.pages).forEach(function(key) {
			var page = aero.pages[key];
			
			makePages.push("aero.makePage(\"" + page.title + "\", \"" + key + "\", \"" + page.url + "\");");
		});
		
		return "$(document).ready(function(){" + makePages.join("") + "});";
	},
	
	root: function(fileName) {
		if(typeof fileName === "undefined")
			return this.rootPath;
		
		return path.join(this.rootPath, fileName);
	}
};

module.exports = aero;