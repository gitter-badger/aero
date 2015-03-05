module.exports = function(pageName) {
    return {
        title: pageName.capitalize(),
        url: pageName,
        visible: true
    };
}