
var http = require('http'),
	stream = require('stream'),
	fs = require('fs'),
	path = require('path');


// server
var server = http.createServer(function (req, res) {
	fs.stat('.' + req.url, function(err, stat) {
		if(!err) {
			streamFile(res,'.' + req.url);
		}
	})

}).listen(8080);

function getMime(filepath) {
	var ext = path.extname(filepath);
	var mime = {
		'.html': 	'text/html',
		'.txt': 	'text/plain',
		'.mp4': 	'video/mp4',
		'.ogg': 	'video/ogg',
	}
	var keys = Object.keys(mime);
	for(var i=0; i<keys.length; i++) {
		if(ext == keys[i]) {
			return mime[keys[i]];
		}
	}

	return null;
}

function streamFile(res, path) {

	var mime = getMime(path);
	if(!mime) {
		res.writeHead(404);
		res.end('nope.');
		return;
	}

	res.writeHead(200, {	'Content-Type': 		mime,
							'Transfer-Encoding': 	'chunked' });

	try {
		var output = fs.createReadStream(path);
		console.log('streaming (' + path + ')....');
		output.pipe(res);
		output.on('end', function() {
			console.log('> end');
			res.end();
		})
	} catch(e) {
		console.log(e);
	}
}