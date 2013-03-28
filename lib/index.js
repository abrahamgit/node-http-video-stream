
var http 		= require('http'),
	stream 		= require('stream'),
	fs 			= require('fs'),
	path 		= require('path'),
	ffmpeg 		= require('fluent-ffmpeg'),
	cli 		= require('cli-color');

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

}).listen(8080);

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

function streamVideoCamera(res, req, format) {

	var mime = "";
	switch(format) {

		case 'mp4':
			mime = 'video/mp4';
			break;

		case 'ogg':
			mime = 'video/ogg';
			break;

		case 'web':
			mime = 'video/webm';
			format = 'webm'
			break;

	}

	res.writeHead(200, {	'Content-Type': 		mime,
							'Transfer-Encoding': 	'chunked' });

	console.log( 	cli.redBright('Streaming video as ') + 
					cli.greenBright(format) + 
					cli.redBright(' format to ') + 
					cli.yellowBright(req.connection.remoteAddress)  );
	
	var transcoder = new ffmpeg(	{ 	source: '/dev/video0',
										priority: 10,
										nolog: false })
									.fromFormat('video4linux2')
									.addOption('-qmax', '42')
									.addOption('-qmin', '10')
									.addOption('-vb', '1M')
									.toFormat(format)			
									.writeToStream(res, function(retcode, error){
										if(error) {
											console.log(error);
										} else {
											console.log('done processing input stream');
										}
									});

}