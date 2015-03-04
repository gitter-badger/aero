// Posts
$(".get-thread-title").each(function() {
    var $this = $(this);
    var threadId = $this.attr("data-id");

    $.getJSON("https://battleofmages.com/api/thread.php?id=" + threadId, function(data) {
        var threadTitle = data.title;
        $this.html(threadTitle);
    });
});