var fs = require("fs");
var http = require("http");
var path = require("path");
var jade = require("jade");
var express = require("express");
var compress = require("compression");
var objectAssign = require("object-assign");
var scripts = require("./src/manager/scripts");
var styles = require("./src/manager/styles");
var pageConfig = require("./config/page");

var aero = {
    // Express app
    app: express(),
    
    // Aero configuration
    config: require("./config/config"),
    
    // An array of strings containing all the JavaScript code for the site
    js: [],
    
    // An array of strings containing all the CSS for the site
    css: [],
    
    // Aero root folder
    rootPath: path.dirname(module.filename),
    
    // Aero event manager
    events: new (require("events")).EventEmitter(),
    
    start: function(configFile) {
        // Merge config file
        if(typeof configFile !== "undefined")
            aero.config = objectAssign(this.config, JSON.parse(fs.readFileSync(configFile, "utf8")));
        
        aero.init();
        
        // jQuery is compressed already
        aero.loadScriptWithoutCompression(this.root("cache/scripts/jquery.js"));
        
        // Compress these
        aero.loadScript(this.root("scripts/helpers.js"));
        aero.loadScript(this.root("scripts/aero.js"));
        aero.loadScript(this.root("scripts/init.js"));
        
        // Download latest version of Google Analytics
        aero.download("http://www.google-analytics.com/analytics.js", this.root("cache/scripts/analytics.js"));
        //this.download("http://www.google-analytics.com/plugins/ua/linkid.js", "aero/cache/scripts/linkid.js");
        
        aero.loadScriptWithoutCompression(this.root("cache/scripts/analytics.js"));
        
        if(!aero.loadUserData()) {
            aero.loadAdminInterface();
        }
        
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
        aero.loadStyle(this.root("styles/reset.styl"));
        
        // Styles
        this.config.styles.forEach(function(fileName) {
            aero.loadStyle(path.join(aero.config.stylesPath, fileName + ".styl"));
        });
        
        // Scripts
        this.config.scripts.forEach(function(fileName) {
            aero.loadScript(path.join(aero.config.scriptsPath, fileName + ".js"));
        });
        
        // Pages
        return this.loadPages(this.config.pagesPath);
    },
    
    loadScript: function(filePath) {
        console.log("Compiling script: " + path.basename(filePath, ".js"));
        
        this.js.push(scripts.compressJSFile(filePath));
    },
    
    loadScriptWithoutCompression: function(filePath) {
        console.log("Loading script: " + path.basename(filePath, ".js"));
        
        this.js.push(fs.readFileSync(filePath, "utf8"));
    },
    
    loadStyle: function(filePath) {
        console.log("Compiling style: " + path.basename(filePath, ".styl"));
        
        this.css.push(styles.compileStylusFile(filePath));
    },
    
    loadPages: function(pagesPath) {
        var files;
        
        try {
            files = fs.readdirSync(pagesPath);
        } catch(e) {
            console.warn("Directory " + pagesPath + " doesn't exist");
            return false;
        }
        
        // Filter directories
        var pages = files.map(function(file) {
            return {
                name: file,
                fullPath: path.join(pagesPath, file)
            };
        }).filter(function(file) {
            return fs.statSync(file.fullPath).isDirectory();
        });
        
        // Set views directory
        aero.app.set("views", pagesPath);
        
        // Find all pages
        pages.forEach(function(file) {
            var pageName = file.name;
            var jsonFile = path.join(file.fullPath, pageName + ".json");
            var stylFile = path.join(file.fullPath, pageName + ".styl");
            
            var pageJSON = null;
            
            // JSON
            try {
                pageJSON = fs.readFileSync(jsonFile, "utf8");
            } catch(error) {
                //console.warn("Missing page information file: " + jsonFile);
            }
            
            var page = pageConfig(pageName);
            
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
            
            if(style != null)
                page.css = styles.compileStylus(style);
            
            aero.config.pages[pageName] = page;
            aero.events.emit("newPage", pageName);
        });
        
        aero.js.push(scripts.compressJS(aero.makePages()));
        aero.js.push('$(document).ready(function(){aero.setTitle(\"' + aero.config.siteName + '\");$(window).trigger("resize");});');
        
        var combinedJS = aero.js.join(";");
        var combinedCSS = aero.css.join(" ");
        var renderLayout = jade.compileFile("index.jade");
        
        var params = {
            siteName: aero.config.siteName,
            css: combinedCSS,
            js: combinedJS,
            pages: aero.config.pages
        };
        
        // Compile jade files
        pages.forEach(function(file) {
            var key = file.name;
            var page = aero.config.pages[key];
            
            console.log("Compiling page: " + page.title);
            
            var renderPage = jade.compileFile(path.join(aero.config.pagesPath, key + "/" + key + ".jade"));
            
            // Set page-specific parameters
            params.page = page;
            params.content = renderPage(params);
            
            // Set up raw response with cached output
            aero.app.get("/raw/" + page.url, function(request, response) {
                response.header("Content-Type", "text/html; charset=utf-8");
                response.end(params.content);
            });
            
            // Render Jade file to HTML
            var html = renderLayout(params);
            
            // Set up full response with cached output
            aero.app.get("/" + page.url, function(request, response) {
                response.header("Content-Type", "text/html; charset=utf-8");
                response.end(html);
            });
        });
        
        return true;
    },
    
    loadAdminInterface: function() {
        /*console.log("Loading admin interface");
        
        aero.loadPages(this.root("./pages"));
        
        aero.app.get("/", function(request, response) {
            response.writeHead(302, {'Location': '/admin'});
            response.end();
        });*/
    },
    
    makePages: function() {
        var makePages = [];
        
        Object.keys(aero.config.pages).forEach(function(key) {
            var page = aero.config.pages[key];
            
            makePages.push('aero.makePage("' + page.title + '", "' + key + '", "' + page.url + '");');
        });
        
        return "$(document).ready(function(){" + makePages.join('') + "});";
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
            if(e.code != "EEXIST")
                throw e;
        }
    },
    
    download: function(from, to, func) {
        return http.get(from, function(response) {
            var file = fs.createWriteStream(to);
            response.pipe(file);
            
            if(typeof func != "undefined")
                func();
        });
    },
    
    root: function(fileName) {
        if(typeof fileName === "undefined")
            return this.rootPath;
        
        return path.join(this.rootPath, fileName);
    },
};

module.exports = aero;