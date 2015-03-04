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
    js: "",
    css: "",
    compressor: UglifyJS.Compressor(),
    rootPath: path.dirname(module.filename),
    
    root: function(fileName) {
        if(typeof fileName === "undefined")
            return this.rootPath;
        
        return path.join(this.rootPath, fileName);
    },
    
    start: function(configFile) {
        // Merge
        this.config = objectAssign(this.config, JSON.parse(fs.readFileSync(configFile, "utf8")));
        
        this.init();
        this.loadStyles(this.config.stylesPath);
        
        this.loadScript(this.root("cache/scripts/jquery.js"));
        this.loadScript(this.root("scripts/helpers.js"));
        this.loadScript(this.root("scripts/aero.js"));
        this.loadScript(this.root("scripts/init.js"));
        
        // Download latest version of Google Analytics
        this.download("http://www.google-analytics.com/analytics.js", this.root("cache/scripts/analytics.js"));
        //this.download("http://www.google-analytics.com/plugins/ua/linkid.js", "aero/cache/scripts/linkid.js");
        
        aero.loadScript(this.root("cache/scripts/analytics.js"));
        
        this.config.scripts.forEach(function(scriptName) {
            var scriptPath = path.join(aero.config.scriptsPath, scriptName + ".js");
            aero.loadScript(scriptPath);
        });
        
        this.loadPages(this.config.pagesPath);
    },
    
    createDirectory: function(dirPath) {
        try {
            fs.mkdirSync(dirPath);
        } catch(e) {
            if(e.code != "EEXIST")
                throw e;
        }
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
    
    download: function(from, to, func) {
        return http.get(from, function(response) {
            var file = fs.createWriteStream(to);
            response.pipe(file);
            
            if(typeof func != "undefined")
                func();
        });
    },
    
    loadStyles: function(stylesPath) {
        var files = fs.readdirSync(stylesPath);
        
        // Combine everything into a single CSS string
        var fileObjects = files.map(function(file) {
            return {
                name: file,
                fullPath: path.join(stylesPath, file)
            };
        });
        
        // Prepend reset
        fileObjects.unshift({
            name: "reset.styl",
            fullPath: this.root("styles/reset.styl")
        });
        
        this.css = fileObjects.filter(function(file) {
            return fs.statSync(file.fullPath).isFile();
        }).map(function(file) {
            console.log("Compiling style: " + path.basename(file.name, ".styl"));
            
            var style = fs.readFileSync(file.fullPath, "utf8");
            var output = "";
            
            stylus(style)
                .set("filename", file.fullPath.replace(".styl", ".css"))
                .set("compress", true)
                .use(nib())
                .render(function(error, css) {
                    if(error)
                        throw error;
                    
                    output = css;
                });
            
            return output;
        }).reduce(function(total, style) {
            return total + style;
        });
    },
    
    loadScripts: function(scriptsPath) {
        var files = fs.readdirSync(scriptsPath);
        
        // Filter files
        this.js += files.map(function(file) {
            return {
                name: file,
                fullPath: path.join(scriptsPath, file)
            };
        }).filter(function(file) {
            return fs.statSync(file.fullPath).isFile();
        }).map(function(file) {
            return aero.compressJSFile(file.fullPath);
        }).reduce(function(total, style) {
            return total + style;
        });
    },
    
    loadScript: function(scriptPath) {
        console.log("Compiling script: " + path.basename(scriptPath, ".js"));
        
        this.js += this.compressJSFile(scriptPath);
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
        
        aero.js += this.compressJS(aero.makePages());
        
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
                css: aero.css,
                js: aero.js
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
    }
};

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

module.exports = aero;