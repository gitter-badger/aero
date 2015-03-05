module.exports = function(pageName) {
    return {
        title: pageName.capitalize(),
        url: pageName,
        visible: true
    };
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};