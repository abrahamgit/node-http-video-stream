
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
			res.end();
		})
	} catch(e) {
		console.log(e);
	}
}

// streaming clients
var clients = [];

// do the transcoding & stream the data
clients['video'] = [];
function streamVideoCamera(res, req, format) {

	console.log(cli.greenBright('Client ' + clients['video'].length + ' connected to VIDEO'));

	if(!videoStream.isActive()) {

		console.log(cli.greenBright('start video stream'));

		videoStream.resume();
		videoStream.start();

		videoStream.on('data', function(chunk) {
			process.stdout.write(cli.yellowBright('V'));

			for(var i=0; i<clients['video'].length; i++) {
				clients['video'][i].res.write(chunk, 'binary');
			}

		})
	}

	// unpipe when client disconnects
	var cleanup = function(req, res) {

		var out = [];
		for(var i=0; i<clients['video'].length; i++) {
			if(clients['video'][i].req != req) {
				out.push(clients['video'][i]);
			} else {
				console.log('Client ' + i + ' disconnected from VIDEO');
			}
		}
		clients['video'] = out;

		videoStream.stop();

		if(!videoStream.isActive()) {
			console.log(cli.redBright('end VIDEO stream'));
		}

	}
	req.on('close', function() {
		cleanup(req, null);
	});

	// stream it
	res.writeHead(200, {	'Content-Type': 		'video/webm',
							'Transfer-Encoding': 	'chunked' });

	clients['video'].push({	res: res, req: req });
	
}

// do the transcoding & stream the data
clients['audio'] = [];
function streamMicrophone(res, req, format) {

	console.log(cli.greenBright('Client ' + clients['audio'].length + ' connected to AUDIO'));

	if(!audioStream.isActive()) {

		console.log(cli.greenBright('start audio stream'));

		audioStream.resume();
		audioStream.start();

		audioStream.on('data', function(chunk) {
			process.stdout.write(cli.blueBright('A'));

			for(var i=0; i<clients['audio'].length; i++) {
				clients['audio'][i].res.write(chunk, 'binary');
			}

		})
	}

	// unpipe when client disconnects
	var cleanup = function(req, res) {

		var out = [];
		for(var i=0; i<clients['audio'].length; i++) {
			if(clients['audio'][i].req != req) {
				out.push(clients['audio'][i]);
			} else {
				console.log('Client ' + i + ' disconnected from AUDIO');
			}
		}
		clients['audio'] = out;

		audioStream.stop();

		if(!audioStream.isActive()) {
			console.log(cli.redBright('end VIDEO stream'));
		}

	}
	req.on('close', function() {
		cleanup(req, null);
	});

	// stream it
	res.writeHead(200, {	'Content-Type': 		'video/webm',
							'Transfer-Encoding': 	'chunked' });

	clients['audio'].push({	res: res, req: req });
	
}