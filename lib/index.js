
var http 					= require('http'),
	fs 						= require('fs'),
	path 					= require('path'),
	cli 					= require('cli-color'),
	VideoTranscodeStream 	= require('./VideoTranscodeStream.js');

// Video Stream
function videoStreamPreset(ffmpeg) {
  ffmpeg
	.fromFormat('video4linux2')
	.addOption('-threads', '4')
	.addOption('-qmax', '1')
	.addOption('-qmin', '1')
	.toFormat('webm')
  return ffmpeg;
}

var videoStream;
function newVideoStream() {
	videoStream = new VideoTranscodeStream( { highWaterMark: 0 },
											{ 	source: '/dev/video0',
												priority: 1,
												timeout: -1 },
											videoStreamPreset );
}
newVideoStream();

// Audio Stream
function audioStreamPreset(ffmpeg) {
  ffmpeg
  	.fromFormat('alsa')
	.addOption('-threads', '4')
	.withAudioBitrate('64k')
	.withAudioCodec('libmp3lame')
	.toFormat('mp3')
  return ffmpeg;
}

// Audio Stream
var audioStream;
function newAudioStream() {
	audioStream = new VideoTranscodeStream( { highWaterMark: 0 },
											{ 	priority: 1,
												source: 'pulse',
												timeout: -1},
											audioStreamPreset );
}
newAudioStream();

// hosting port
var port = process.argv[2] ? process.argv[2] : 8080;
console.log('serving from locahost:' + port);

// server
var server = http.createServer(function (req, res) {
	console.log('> (' + req.connection.remoteAddress + ') ' + req.url);
	if(req.url.substr(0,6) == '/video') {
		streamVideoCamera(res, req, req.url.substr(7,3));;
	} else if (req.url.substr(0,6) == '/audio') {
		streamMicrophone(res, req, req.url.substr(7,3));
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
		'.webm': 	'video/webm',
		'.wav': 	'audio/wav',
		'.mp3': 	'audio/mp3',
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

	console.log(	cli.greenBright('start video stream for ') +
					cli.yellowBright(req.connection.remoteAddress));

	res.writeHead(200, {	'Content-Type': 		'video/webm',
							'Transfer-Encoding': 	'chunked' });

	videoStream.on('data', function(chunk) {
		res.write(chunk, 'binary');
		process.stdout.write('V');
	})
	videoStream.start();

	// unpipe when client disconnects
	var cleanup = function() {
		videoStream.stop();
		console.log(	cli.redBright('end VIDEO stream for ') +
						cli.yellowBright(req.connection.remoteAddress));
	}
	req.on('close', cleanup);
	req.on('end', cleanup);

}

// do the transcoding & stream the data
function streamMicrophone(res, req, format) {

	console.log(	cli.greenBright('start audio stream for ') +
					cli.yellowBright(req.connection.remoteAddress));

	res.writeHead(200, {	'Content-Type': 		'audio/mp3',
							'Transfer-Encoding': 	'chunked' });

	audioStream.on('data', function(chunk) {
		res.write(chunk, 'binary');
		process.stdout.write('A');
	})
	audioStream.start();

	// unpipe when client disconnects
	var cleanup = function() {
		audioStream.stop();
		console.log(	cli.redBright('end AUDIO stream for ') +
						cli.yellowBright(req.connection.remoteAddress));
	}
	req.on('close', cleanup);
	req.on('end', cleanup);

}