var http = require("http");
var fs = require("fs");

module.exports = function(from, to, callBack) {
    return http.get(from, function(response) {
        var file = fs.createWriteStream(to);
        response.pipe(file);
        
        file.on("finish", function() {
            file.close(callBack);
        });
    });
};