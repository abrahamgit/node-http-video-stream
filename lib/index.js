
var http 					= require('http'),
	fs 						= require('fs'),
	path 					= require('path'),
	cli 					= require('cli-color'),
	VideoTranscodeStream 	= require('./VideoTranscodeStream.js');

// Video Stream
function videoStreamPreset(ffmpeg) {
  ffmpeg
	.fromFormat('video4linux2')
	.addOption('-threads', '2')
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
	.addOption('-threads', '0')
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
clients['video'] = [];
clients['audio'] = [];

function removeClient(clientsArray, req, postfix, transformStream) {
	var out = [];
	console.log("");
	for(var i=0; i<clientsArray.length; i++) {
		if(clientsArray[i].req != req) {
			out.push(clientsArray[i]);
		} else {
			console.log(cli.cyanBright('Client ' + i + ' disconnected from ' + postfix));
		}
	}
	return out;
}

function streamMediaToClient(res, clientArray, color, postfix, chunk) {
	process.stdout.write(color(postfix));
	for(var i=0; i<clientArray.length; i++) {
		clientArray[i].res.write(chunk, 'binary');
	}
}

function streamMediaDevice(res, req, dev, transformStream) {

	var postfix = dev.toUpperCase();
	var clientArray = clients[dev];

	var color;
	if(dev == 'video') {
		color = cli.yellowBright;
	} else {
		color = cli.blueBright;
	}

	console.log(cli.greenBright('Client ' + clientArray.length + ' connected to ' + postfix));

	if(!transformStream.isActive()) {

		console.log(cli.greenBright('start ' + postfix + ' stream'));

		transformStream.removeAllListeners('data');
		transformStream.resume();
		transformStream.start();

		transformStream.on('data', function(chunk) {
			streamMediaToClient(res, clientArray, color, postfix[0], chunk)
		})
	}

	// client disconnects
	req.on('close', function() {
		clients[dev] = removeClient(clients[dev], req, postfix);
		clientArray = clients[dev];
		console.log(clientArray.length + ' clients connected.');
		transformStream.stop();
		if(!transformStream.isActive()) {
			console.log(cli.redBright('end ' + postfix + ' stream'));

			if(dev == 'video') {
				newVideoStream();
			} else {
				newAudioStream();
			}

		}
	});

	// stream it
	res.writeHead(200, {	'Content-Type': 		'video/webm',
							'Transfer-Encoding': 	'chunked' });

	clientArray.push({	res: res, req: req });
	
}

function streamVideoCamera(res, req, format) {
	streamMediaDevice(res, req, 'video', videoStream);
}

function streamMicrophone(res, req, format) {
	streamMediaDevice(res, req, 'audio', audioStream);
}
