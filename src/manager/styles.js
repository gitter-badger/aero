var fs = require("fs");
var nib = require("nib");
var stylus = require("stylus");

var styles = {
    compileStylus: function(style) {
        var output = "";
        
        stylus(style)
            .set("compress", true)
            .use(nib())
            .render(function(error, css) {
                if(error)
                    throw error;
                
                output = css;
            });
        
        return output;
    },
    
    compileStylusFile: function(filePath) {
        this.compileStylus(fs.readFileSync(filePath, "utf8"));
    },
};

module.exports = styles;