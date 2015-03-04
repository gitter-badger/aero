var fs = require("fs");
var nib = require("nib");
var http = require("http");
var path = require("path");
var jade = require("jade");
var events = require("events");
var stylus = require("stylus");
var express = require("express");
var UglifyJS = require("uglify-js");
var compress = require("compression");
var objectAssign = require("object-assign");

// Init
var app = express();
var eventEmitter = new events.EventEmitter();

var aero = {
    config: {
        siteName: "Untitled",
        pagesPath: "./pages",
        stylesPath: "./styles",
        scriptsPath: "./scripts",
        scripts: [],
        port: 80
    },
    js: [],
    css: [],
    compressor: UglifyJS.Compressor(),
    rootPath: path.dirname(module.filename),
    
    start: function(configFile) {
        // Merge
        this.config = objectAssign(this.config, JSON.parse(fs.readFileSync(configFile, "utf8")));
        
        this.init();
        
        this.loadScript(this.root("cache/scripts/jquery.js"));
        this.loadScript(this.root("scripts/helpers.js"));
        this.loadScript(this.root("scripts/aero.js"));
        this.loadScript(this.root("scripts/init.js"));
        
        // Download latest version of Google Analytics
        this.download("http://www.google-analytics.com/analytics.js", this.root("cache/scripts/analytics.js"));
        //this.download("http://www.google-analytics.com/plugins/ua/linkid.js", "aero/cache/scripts/linkid.js");
        
        aero.loadScript(this.root("cache/scripts/analytics.js"));
        
        this.loadUserData();
    },
    
    init: function() {
        var options = {
            maxAge: 30 * 24 * 60 * 60 * 1000
        };
        
        // Set up jade
        app.set("views", aero.config.pagesPath);
        app.set("view engine", "jade");
        app.locals.basedir = path.join(__dirname, "pages");

        // Static files
        app.use(compress());
        app.use("/js", express.static("./js", options));
        app.use("/images", express.static("./images", options));
        
        // Favicon
        app.get("/favicon.ico", function(request, response) {
            response.sendFile("favicon.ico", {root: "./"});
        });

        eventEmitter.on("newPage", function(pageName) {
            console.log("Installing page: " + pageName);
        });
    },
    
    loadUserData: function() {
        // Styles
        this.config.styles.forEach(function(fileName) {
            aero.loadStyle(path.join(aero.config.stylesPath, fileName + ".styl"));
        });
        
        // Scripts
        this.config.scripts.forEach(function(fileName) {
            aero.loadScript(path.join(aero.config.scriptsPath, fileName + ".js"));
        });
        
        // Pages
        this.loadPages(this.config.pagesPath);
    },
    
    loadScript: function(filePath) {
        console.log("Compiling script: " + path.basename(filePath, ".js"));
        
        this.js.push(this.compressJSFile(filePath));
    },
    
    loadStyle: function(filePath) {
        console.log("Compiling style: " + path.basename(filePath, ".styl"));
        
        this.css.push(this.compileStylusFile(filePath));
    },
    
    loadPages: function(pagesPath) {
        var files = fs.readdirSync(pagesPath);
        
        // Filter directories
        var pages = files.map(function(file) {
            return {
                name: file,
                fullPath: path.join(pagesPath, file)
            };
        }).filter(function(file) {
            return fs.statSync(file.fullPath).isDirectory();
        });
        
        // Find all pages
        pages.forEach(function(file) {
            var pageName = file.name;
            var jsonFile = path.join(file.fullPath, pageName + ".json");
            var stylFile = path.join(file.fullPath, pageName + ".styl");
            
            var jsonString = null;
            
            // JSON
            try {
                jsonString = fs.readFileSync(jsonFile, "utf8");
            } catch(error) {
                //console.warn("Missing page information file: " + jsonFile);
            }
            
            var page = {
                title: pageName.capitalize(),
                url: pageName,
                visible: true
            };
            
            // Merge
            if(jsonString != null)
                page = objectAssign(page, JSON.parse(jsonString));
            
            var style = null;
            
            // Style
            try {
                style = fs.readFileSync(stylFile, "utf8");
            } catch(error) {
                //console.warn("Missing stylus file: " + stylFile);
            }
            
            if(style != null) {
                stylus(style)
                    .set("filename", stylFile.replace(".styl", ".css"))
                    .set("compress", true)
                    .use(nib())
                    .render(function(error, css) {
                        if(error)
                            throw error;
                        
                            page.css = css;
                    });
            }
            
            if(typeof aero.config.pages == "undefined")
                aero.config.pages = {};
            
            aero.config.pages[pageName] = page;
            eventEmitter.emit("newPage", pageName);
        });
        
        aero.js.push(this.compressJS(aero.makePages()));
        aero.js.push('$(document).ready(function(){aero.setTitle(\"\");$(window).trigger("resize");});');
        
        var combinedJS = aero.js.join(";");
        var combinedCSS = aero.css.join(" ");
        
        // Compile jade files
        pages.forEach(function(file) {
            var key = file.name;
            var page = aero.config.pages[key];
            
            console.log("Compiling page: " + page.title);
            
            var params = {
                pageId: key,
                page: page,
                pages: aero.config.pages,
                siteName: aero.config.siteName,
                css: combinedCSS,
                js: combinedJS
            };
            
            // Render Jade file to HTML
            app.render(key + "/" + key, params, function(error, html) {
                if(error)
                    throw error;
                
                params.content = html;
                
                // Set up response with cached output
                app.get("/raw/" + page.url, function(request, response) {
                    response.header("Content-Type", "text/html; charset=utf-8");
                    response.end(html);
                });
                
                // Render Jade file to HTML
                app.render("layout", params, function(error, html) {
                    if(error)
                        console.log(error);
                    
                    // Set up response with cached output
                    app.get("/" + page.url, function(request, response) {
                        response.header("Content-Type", "text/html; charset=utf-8");
                        response.end(html);
                    });
                });
            });
        });
        
        aero.startServer();
    },
    
    compressJS: function(code) {
        var ast = UglifyJS.parse(code);
        ast.figure_out_scope();
        return ast.transform(this.compressor).print_to_string();
    },
    
    compressJSFile: function(filePath) {
        var data = fs.readFileSync(filePath, "utf8");
        return this.compressJS(data);
    },
    
    compileStylusFile: function(filePath) {
        var style = fs.readFileSync(filePath, "utf8");
        var output = "";
        
        stylus(style)
            .set("filename", filePath.replace(".styl", ".css"))
            .set("compress", true)
            .use(nib())
            .render(function(error, css) {
                if(error)
                    throw error;
                
                output = css;
            });
            
        return output;
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
        app.listen(aero.config.port);
        
        console.log("Server started on port " + aero.config.port + ".");
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

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

module.exports = aero;