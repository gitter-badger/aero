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