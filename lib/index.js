
var http 		= require('http'),
	stream 		= require('stream'),
	fs 			= require('fs'),
	path 		= require('path'),
	ffmpeg 		= require('/home/seannicholls/projects/github/node-fluent-ffmpeg'),
	cli 		= require('cli-color');


// intermediary stream to enable transcoding
function VideoTranscodeStream(options) {
	if (!(this instanceof VideoTranscodeStream))
		return new VideoTranscodeStream(options);
	stream.Transform.call(this, options);
}

VideoTranscodeStream.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: VideoTranscodeStream }});

VideoTranscodeStream.prototype.chunkCount = 0;
VideoTranscodeStream.prototype.transcoder = null;

VideoTranscodeStream.prototype._transform = function(chunk, encoding, done) {
	process.stdout.write('.');
	this.chunkCount++;
	this.push(chunk);
	done();
};

// the actual video stream
var videoStream = new VideoTranscodeStream();
videoStream.pause();

videoStream.on('pause', function() {
	if(videoStream.transcoder) {
		videoStream.transcoder.stop();
	}
	videoStream.transcoder = null;
})

videoStream.on('resume', function() {
	videoStream.transcoder = new ffmpeg(	{ 	source: '/dev/video0',
												priority: 10,
												nolog: true,
												timeout: -1 })
											.fromFormat('video4linux2')/*
											.addOption('-threads', '8')
											.addOption('-qmax', '42')
											.addOption('-qmin', '10')
											.addOption('-vb', '1M')*/

											.addOption('-threads', '2')
											.addOption('-qmax', '1')
											.addOption('-qmin', '1')

											.toFormat('webm')			
											.writeToStream(videoStream, function(retcode, error){
												if(error) {
													console.log(error);
												} else {
													console.log('done processing input stream');
												}
											});
})

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

	videoStream.resume();
	videoStream.pipe(res);

	// unpipe when client disconnects
	var cleanup = function() {
		console.log(cli.redBright('end video stream for ') + cli.yellowBright(req.connection.remoteAddress));
		videoStream.pause();
		videoStream.unpipe(res);
	}
	req.on('close', cleanup);
	req.on('end', cleanup);

}