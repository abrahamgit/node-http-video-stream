
var http 					= require('http'),
	fs 						= require('fs'),
	path 					= require('path'),
	cli 					= require('cli-color'),
	VideoTranscodeStream 	= require('VideoTranscodeStream.js');

// the video stream object
var videoStream = new VideoTranscodeStream();
videoStream.preset = function(ffmpeg) {
  ffmpeg
	.fromFormat('video4linux2')
	.addOption('-qmax', '1')
	.addOption('-qmin', '1')
	.toFormat('webm')	
  return ffmpeg;
};

// hosting port
var port = process.argv[2] ? process.argv[2] : 8080;
console.log('serving from locahost:' + port);

// server
var server = http.createServer(function (req, res) {
	console.log('> (' + req.connection.remoteAddress + ') ' + req.url);
	if(req.url.substr(0,6) == '/video') {
		streamVideoCamera(res, req, req.url.substr(7,3));
	} else {
		if(req.url == '/') {
			req.url = '/index.html';
		}
		fs.stat('.' + req.url, function(err, stat) {
			if(!err) {
				streamFile(res,'.' + req.url);
			}
		})
	}

}).listen(port);

function getMime(filepath) {
	var ext = path.extname(filepath);
	var mime = {
		'.html': 	'text/html',
		'.txt': 	'text/plain',
		'.mp4': 	'video/mp4',
		'.ogg': 	'video/ogg',
		'.webm': 	'video/webm',
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
		res.end('Nope. File type not supported (mime)');
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


// do the transcoding & stream the data
function streamVideoCamera(res, req, format) {

	console.log(cli.greenBright('start video stream for ') + cli.yellowBright(req.connection.remoteAddress));

	res.writeHead(200, {	'Content-Type': 		'webm',
							'Transfer-Encoding': 	'chunked' });

	videoStream.pipe(res);

	// unpipe when client disconnects
	var cleanup = function() {
		console.log(cli.redBright('end video stream for ') + cli.yellowBright(req.connection.remoteAddress));
	}
	req.on('close', cleanup);
	req.on('end', cleanup);

}